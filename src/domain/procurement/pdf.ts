import { PutObjectCommand } from "@aws-sdk/client-s3";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";

import type { DB } from "@/db/client";
import { db } from "@/db/client";
import {
  documentLinks,
  documents,
  organizations,
  projects,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import type { EffectiveContext } from "@/domain/context";
import { PoDocument, type PoPdfData, type PoPdfLine } from "@/lib/pdf/po-template";
import { R2_BUCKET, r2, buildStorageKey } from "@/lib/storage";

import type { PoDetailView } from "../loaders/procurement";

type TxLike =
  | DB
  | Parameters<Parameters<DB["transaction"]>[0]>[0];

// Renders a PO PDF, uploads it to R2, inserts a documents row (plus a
// document_links pivot scoped to the PO and to the project), and — when
// `supersedesDocumentId` is passed — flips the prior document's
// `isSuperseded` flag so the version chain stays clean. Used by both
// the initial issue action and the revise action.
export async function generateAndStorePoPdf(
  tx: TxLike,
  ctx: EffectiveContext,
  detail: PoDetailView,
  opts?: {
    supersedesDocumentId?: string;
  },
): Promise<{ documentId: string; storageKey: string }> {
  // ---- Resolve contractor + project context for the PDF header ----
  const [org] = await tx
    .select({
      name: organizations.name,
      addr1: organizations.addr1,
      addr2: organizations.addr2,
      city: organizations.city,
      stateRegion: organizations.stateRegion,
      postalCode: organizations.postalCode,
      phone: organizations.phone,
    })
    .from(organizations)
    .where(eq(organizations.id, ctx.organization.id))
    .limit(1);
  const [project] = await tx
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, detail.projectId))
    .limit(1);

  const contractorAddress = [
    [org?.addr1, org?.addr2].filter(Boolean).join(", "),
    [org?.city, org?.stateRegion, org?.postalCode].filter(Boolean).join(" "),
  ]
    .filter((s) => s && s.trim().length > 0)
    .join(" · ");

  const pdfLines: PoPdfLine[] = detail.lines.map((l) => ({
    sortOrder: l.sortOrder,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitCostCents: l.unitCostCents,
    lineTotalCents: l.lineTotalCents,
  }));

  const pdfData: PoPdfData = {
    poNumber: detail.poNumber,
    revisionNumber: detail.revisionNumber,
    issuedAt: detail.lastRevisedAt ?? detail.orderedAt ?? new Date(),
    expectedDeliveryAt: detail.expectedDeliveryAt,
    status: detail.status,
    contractorName: org?.name ?? ctx.organization.name,
    contractorAddress: contractorAddress.length > 0 ? contractorAddress : null,
    contractorPhone: org?.phone ?? null,
    vendorName: detail.vendorName,
    vendorContactName: detail.vendorContactName,
    vendorContactEmail: detail.vendorContactEmail,
    vendorAddress: null,
    paymentTerms: detail.paymentTerms,
    projectName: project?.name ?? detail.projectName,
    costCodeLabel: detail.costCodeLabel,
    taxRatePercent: detail.taxRatePercent,
    notes: detail.notes,
    lines: pdfLines,
    subtotalCents: detail.subtotalCents,
    taxAmountCents: detail.taxAmountCents,
    totalCents: detail.totalCents,
  };

  const buffer = await renderToBuffer(PoDocument({ data: pdfData }));

  // ---- Upload to R2 ----
  const suffix =
    detail.revisionNumber > 1
      ? `_rev${detail.revisionNumber}`
      : "";
  const filename = `${detail.poNumber}${suffix}.pdf`;
  const storageKey = buildStorageKey({
    orgId: ctx.organization.id,
    projectId: detail.projectId,
    documentType: "purchase_order",
    filename,
  });
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: "application/pdf",
    }),
  );

  // ---- Insert documents row (Step 22 supersedes chain if this is a
  //     revision). visibilityScope/audienceScope/category carry through
  //     from a predecessor if present; defaults otherwise. ----
  let category: typeof documents.$inferInsert.category = "contracts";
  let visibilityScope: typeof documents.$inferInsert.visibilityScope =
    "internal_only";
  let audienceScope: typeof documents.$inferInsert.audienceScope = "contractor";
  if (opts?.supersedesDocumentId) {
    const [prior] = await tx
      .select({
        category: documents.category,
        visibilityScope: documents.visibilityScope,
        audienceScope: documents.audienceScope,
      })
      .from(documents)
      .where(eq(documents.id, opts.supersedesDocumentId))
      .limit(1);
    if (prior) {
      category = prior.category;
      visibilityScope = prior.visibilityScope;
      audienceScope = prior.audienceScope;
    }
  }

  const [docRow] = await tx
    .insert(documents)
    .values({
      projectId: detail.projectId,
      documentType: "purchase_order",
      title: filename,
      storageKey,
      uploadedByUserId: ctx.user.id,
      visibilityScope,
      audienceScope,
      category,
      fileSizeBytes: buffer.length,
      supersedesDocumentId: opts?.supersedesDocumentId ?? null,
    })
    .returning({ id: documents.id });

  // ---- Pivot rows: project and the PO itself ----
  await tx.insert(documentLinks).values([
    {
      documentId: docRow.id,
      linkedObjectType: "project",
      linkedObjectId: detail.projectId,
      linkRole: "primary",
    },
    {
      documentId: docRow.id,
      linkedObjectType: "purchase_order",
      linkedObjectId: detail.id,
      linkRole: "primary",
    },
  ]);

  // ---- Mark the prior revision's document superseded (if any) ----
  if (opts?.supersedesDocumentId) {
    await tx
      .update(documents)
      .set({
        isSuperseded: true,
        documentStatus: "superseded",
        updatedAt: new Date(),
      })
      .where(eq(documents.id, opts.supersedesDocumentId));
  }

  await writeAuditEvent(
    ctx,
    {
      action: opts?.supersedesDocumentId ? "pdf_revision_created" : "pdf_issued",
      resourceType: "purchase_order",
      resourceId: detail.id,
      details: {
        nextState: {
          documentId: docRow.id,
          storageKey,
          revisionNumber: detail.revisionNumber,
        },
      },
    },
    tx,
  );

  return { documentId: docRow.id, storageKey };
}

// Locates the current (chain-head) PO PDF document id for a PO, if any.
// Used by the revise action so it knows which prior document to
// supersede.
export async function findCurrentPoPdfDocumentId(
  poId: string,
): Promise<string | null> {
  const rows = await db
    .select({
      id: documents.id,
      isSuperseded: documents.isSuperseded,
      createdAt: documents.createdAt,
    })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.documentId))
    .where(eq(documentLinks.linkedObjectId, poId));
  const notSuperseded = rows.filter((r) => !r.isSuperseded);
  if (notSuperseded.length === 0) return null;
  notSuperseded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return notSuperseded[0].id;
}
