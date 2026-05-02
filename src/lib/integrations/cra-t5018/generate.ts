import { PutObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { organizations, t5018Filings, t5018FilingSlips } from "@/db/schema";
import {
  decryptBusinessNumberOrNull,
  encryptBusinessNumber,
} from "@/lib/integrations/crypto";
import { R2_BUCKET, r2 } from "@/lib/storage";

import {
  aggregateT5018ForFiscalYear,
  type T5018SubAggregateRow,
} from "./aggregate";
import { renderT5018Slip } from "./pdf";
import { generateT5018Xml } from "./xml";

// Step 67 — End-to-end T5018 package generator.
//
// One call from the API route does:
//   1. Aggregate sub payments for (contractor_org, fiscal_year)
//   2. Resolve reporter (contractor) identity from organizations
//   3. Generate the consolidated XML
//   4. Render one PDF per qualifying sub
//   5. Build the ZIP bundle in-memory
//   6. Upload zip / xml / csv to R2 under
//      `t5018/{contractorOrgId}/{fiscalYear}/{generatedAtIso}/...`
//      (outside the `tmp/` prefix so the orphan sweep won't touch them)
//   7. Upsert the t5018_filings row + replace its t5018_filing_slips rows
//
// Throws if the contractor org is missing required reporter identity
// (BN, legal name) — the route returns the error to the UI.

export interface GenerateT5018Input {
  contractorOrgId: string;
  fiscalYear: number;
  generatedByUserId: string;
}

export interface GenerateT5018Output {
  filingId: string;
  fiscalYear: number;
  slipCount: number;
  totalAmountCents: number;
  xmlChecksum: string;
  zipStorageKey: string;
  xmlStorageKey: string;
  csvStorageKey: string;
}

const MIME_ZIP = "application/zip";
const MIME_XML = "application/xml";
const MIME_CSV = "text/csv";

function buildCsvSummary(
  fiscalYear: number,
  rows: T5018SubAggregateRow[],
): string {
  const header = [
    "fiscal_year",
    "sub_org_id",
    "legal_name",
    "business_number",
    "mailing_address",
    "payment_count",
    "total_amount_cad",
    "status",
  ].join(",");
  const lines = rows.map((row) => {
    const cells = [
      String(fiscalYear),
      row.subOrgId,
      `"${row.legalName.replace(/"/g, '""')}"`,
      row.businessNumber ?? "",
      row.mailingAddress ? `"${row.mailingAddress.replace(/"/g, '""')}"` : "",
      String(row.paymentCount),
      (row.totalAmountCents / 100).toFixed(2),
      row.status,
    ];
    return cells.join(",");
  });
  return [header, ...lines].join("\n") + "\n";
}

async function uploadToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

async function buildZipBuffer(parts: {
  xml: Buffer;
  xmlFilename: string;
  csv: Buffer;
  csvFilename: string;
  slips: Array<{ filename: string; pdf: Buffer }>;
}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk as Buffer));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.append(parts.xml, { name: parts.xmlFilename });
    archive.append(parts.csv, { name: parts.csvFilename });
    for (const slip of parts.slips) {
      archive.append(slip.pdf, { name: `slips/${slip.filename}` });
    }
    // Adding the "data" listener puts archiver's internal Readable into
    // flowing mode, which drains chunks into our buffer. finalize()
    // writes the zip trailer; "end" fires once everything is flushed.
    archive.finalize().catch(reject);
  });
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}

export async function generateT5018Package(
  input: GenerateT5018Input,
): Promise<GenerateT5018Output> {
  // Resolve reporter (contractor) identity.
  const orgRows = await dbAdmin
    .select({
      id: organizations.id,
      name: organizations.name,
      legalName: organizations.legalName,
      businessNumberEncrypted: organizations.businessNumber,
      craReceiverCode: organizations.craReceiverCode,
      addr1: organizations.addr1,
      city: organizations.city,
      stateRegion: organizations.stateRegion,
      postalCode: organizations.postalCode,
      country: organizations.country,
      taxJurisdiction: organizations.taxJurisdiction,
      primaryContactName: organizations.primaryContactName,
      primaryContactEmail: organizations.primaryContactEmail,
    })
    .from(organizations)
    .where(eq(organizations.id, input.contractorOrgId))
    .limit(1);

  if (orgRows.length === 0) {
    throw new Error(`Contractor org ${input.contractorOrgId} not found`);
  }
  const reporter = orgRows[0];
  if (reporter.taxJurisdiction !== "CA") {
    throw new Error(
      "T5018 generation requires a Canadian tax jurisdiction. Set Org → Settings → Tax jurisdiction to 'CA'.",
    );
  }
  const reporterBn = decryptBusinessNumberOrNull(
    reporter.businessNumberEncrypted,
  );
  if (!reporterBn) {
    throw new Error(
      "Contractor business number is required to generate T5018. Add it in Org settings.",
    );
  }
  const reporterLegalName = reporter.legalName ?? reporter.name;

  // Aggregate sub payments.
  const aggregate = await aggregateT5018ForFiscalYear({
    contractorOrgId: input.contractorOrgId,
    fiscalYear: input.fiscalYear,
  });
  const eligible = aggregate.rows.filter((r) => r.status === "eligible");
  if (eligible.length === 0) {
    throw new Error(
      "No eligible slips to generate. Resolve missing-data subs or wait until > $500 thresholds are crossed.",
    );
  }

  // XML.
  const xmlOut = generateT5018Xml({
    fiscalYear: input.fiscalYear,
    reporter: {
      legalName: reporterLegalName,
      businessNumber: reporterBn,
      craReceiverCode: reporter.craReceiverCode,
      addr1: reporter.addr1,
      city: reporter.city,
      province: reporter.stateRegion,
      postalCode: reporter.postalCode,
      country: reporter.country ?? "Canada",
      filingContactName: reporter.primaryContactName,
      filingContactEmail: reporter.primaryContactEmail,
    },
    slips: eligible,
  });

  // PDFs.
  const slipPdfs: Array<{ filename: string; pdf: Buffer; row: T5018SubAggregateRow }> = [];
  for (let i = 0; i < eligible.length; i++) {
    const row = eligible[i];
    const pdf = await renderT5018Slip({
      fiscalYear: input.fiscalYear,
      reporter: {
        legalName: reporterLegalName,
        businessNumber: reporterBn,
        addr1: reporter.addr1,
        city: reporter.city,
        province: reporter.stateRegion,
        postalCode: reporter.postalCode,
      },
      recipient: {
        legalName: row.legalName,
        businessNumber: row.businessNumber!,
        accountNumber: row.subOrgId,
        address: row.mailingAddress,
      },
      totalAmountCents: row.totalAmountCents,
      paymentCount: row.paymentCount,
      slipIndex: i + 1,
      slipCount: eligible.length,
    });
    slipPdfs.push({
      filename: `T5018-${safeFilenamePart(row.legalName)}.pdf`,
      pdf,
      row,
    });
  }

  // CSV summary.
  const csvBuffer = Buffer.from(buildCsvSummary(input.fiscalYear, aggregate.rows));
  const xmlBuffer = Buffer.from(xmlOut.xml);

  // Zip.
  const zipBuffer = await buildZipBuffer({
    xml: xmlBuffer,
    xmlFilename: `T5018-${reporterBn}-${input.fiscalYear}.xml`,
    csv: csvBuffer,
    csvFilename: `T5018-summary-${input.fiscalYear}.csv`,
    slips: slipPdfs.map((s) => ({ filename: s.filename, pdf: s.pdf })),
  });

  // Upload to R2 under a deterministic prefix per (contractor, year, run).
  const generatedAt = new Date();
  const generatedAtSlug = generatedAt.toISOString().replace(/[:.]/g, "-");
  const prefix = `t5018/${input.contractorOrgId}/${input.fiscalYear}/${generatedAtSlug}`;
  const xmlStorageKey = `${prefix}/T5018-${reporterBn}-${input.fiscalYear}.xml`;
  const csvStorageKey = `${prefix}/T5018-summary-${input.fiscalYear}.csv`;
  const zipStorageKey = `${prefix}/T5018-${reporterBn}-${input.fiscalYear}.zip`;

  await uploadToR2({ key: xmlStorageKey, body: xmlBuffer, contentType: MIME_XML });
  await uploadToR2({ key: csvStorageKey, body: csvBuffer, contentType: MIME_CSV });
  await uploadToR2({ key: zipStorageKey, body: zipBuffer, contentType: MIME_ZIP });

  const slipPdfKeys = await Promise.all(
    slipPdfs.map(async (s, idx) => {
      const key = `${prefix}/slips/${idx + 1}-${safeFilenamePart(s.row.legalName)}.pdf`;
      await uploadToR2({ key, body: s.pdf, contentType: "application/pdf" });
      return { row: s.row, slipPdfStorageKey: key };
    }),
  );

  // Upsert the filing row + replace child slips.
  const filingId = await dbAdmin.transaction(async (tx) => {
    // Find existing row to drive the upsert.
    const existing = await tx
      .select({ id: t5018Filings.id })
      .from(t5018Filings)
      .where(eq(t5018Filings.contractorOrgId, input.contractorOrgId))
      .limit(1);

    let id: string;
    if (existing.length > 0) {
      id = existing[0].id;
      await tx
        .update(t5018Filings)
        .set({
          fiscalYear: input.fiscalYear,
          generatedAt,
          generatedByUserId: input.generatedByUserId,
          xmlChecksum: xmlOut.xmlChecksum,
          slipCount: xmlOut.slipCount,
          totalAmountCents: xmlOut.totalAmountCents,
          zipStorageKey,
          xmlStorageKey,
          csvStorageKey,
          status: "generated",
          // Re-generation clears the prior CRA filed-state — the user
          // must re-confirm filing if they re-uploaded to CRA.
          filedAt: null,
          filedByUserId: null,
          craConfirmationCode: null,
        })
        .where(eq(t5018Filings.id, id));
      // Cascade-replace the child slips. ON DELETE CASCADE is set on
      // t5018_filing_slips.filing_id so deleting + re-inserting is safe.
      await tx
        .delete(t5018FilingSlips)
        .where(eq(t5018FilingSlips.filingId, id));
    } else {
      const inserted = await tx
        .insert(t5018Filings)
        .values({
          contractorOrgId: input.contractorOrgId,
          fiscalYear: input.fiscalYear,
          generatedAt,
          generatedByUserId: input.generatedByUserId,
          xmlChecksum: xmlOut.xmlChecksum,
          slipCount: xmlOut.slipCount,
          totalAmountCents: xmlOut.totalAmountCents,
          zipStorageKey,
          xmlStorageKey,
          csvStorageKey,
          status: "generated",
        })
        .returning({ id: t5018Filings.id });
      id = inserted[0].id;
    }

    // Insert one row per slip. recipient_bn_encrypted is encrypted under
    // BUSINESS_NUMBER_ENCRYPTION_KEY at write time.
    if (slipPdfKeys.length > 0) {
      await tx.insert(t5018FilingSlips).values(
        slipPdfKeys.map(({ row, slipPdfStorageKey }) => ({
          filingId: id,
          subOrgId: row.subOrgId,
          subLegalNameSnapshot: row.legalName,
          recipientBnEncrypted: row.businessNumber
            ? encryptBusinessNumber(row.businessNumber)
            : null,
          subAddressSnapshot: row.mailingAddress,
          totalAmountCents: row.totalAmountCents,
          paymentCount: row.paymentCount,
          slipPdfStorageKey,
        })),
      );
    }
    return id;
  });

  return {
    filingId,
    fiscalYear: input.fiscalYear,
    slipCount: xmlOut.slipCount,
    totalAmountCents: xmlOut.totalAmountCents,
    xmlChecksum: xmlOut.xmlChecksum,
    zipStorageKey,
    xmlStorageKey,
    csvStorageKey,
  };
}
