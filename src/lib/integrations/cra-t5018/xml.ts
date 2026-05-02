import { createHash } from "node:crypto";

import type { T5018SubAggregateRow } from "./aggregate";

// Step 67 — CRA T5018 XML generator.
//
// Generates a structurally-correct CRA T5018 XML envelope:
//   <T5018>
//     <T5018Slip>...</T5018Slip>      (one per qualifying sub)
//     <T5018Summary>...</T5018Summary> (one totals row at the bottom)
//   </T5018>
//
// Maps the in-app aggregate to the boxes the prototype highlights:
//   Box 22 — Recipient name (sub legal name)
//   Box 24 — Recipient BN (or SIN if individual; we only carry BN today)
//   Box 26 — Account number (we use sub_org_id as a stable internal ref)
//   Box 27 — Recipient address
//   Box 28 — Reporting period start (Jan 1 fiscal_year)
//   Box 29 — Reporting period end   (Dec 31 fiscal_year)
//   Box 82 — Total contract payments (cents → dollars + cents)
//
// PRODUCTION DEFERRAL: this implementation does NOT validate the output
// against CRA's official .xsd schema. The envelope structure + box
// labels match CRA's published T5018 form documentation, but the actual
// CRA Internet File Transfer service expects xsd-validated XML with
// namespaces, country codes (ISO 3166-1 alpha-3), and slip-type
// indicators. Wiring those is a prod-cutover task tracked in
// docs/specs/prod_cutover_prep.md §4.9 (added in 67c).

export interface T5018XmlInput {
  fiscalYear: number;
  reporter: {
    legalName: string;
    businessNumber: string; // canonical 15-char form, "871234567RT0001"
    craReceiverCode: string | null;
    addr1: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
    filingContactName: string | null;
    filingContactEmail: string | null;
  };
  // Only `eligible`-status rows are passed through to the XML. The
  // generator does not re-filter; the caller is responsible.
  slips: T5018SubAggregateRow[];
}

export interface T5018XmlOutput {
  xml: string;
  xmlChecksum: string; // sha256 hex
  slipCount: number;
  totalAmountCents: number;
}

// Format cents as dollars-and-cents for CRA boxes (e.g. 1234567 → "12345.67").
function fmtCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs - dollars * 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

// Strip BN punctuation for the XML <BN> field; CRA expects 15 contiguous
// chars without spaces. Input format from the prototype is already
// "871234567RT0001"; this is defensive against future user input that
// includes spaces or hyphens.
function normalizeBN(bn: string): string {
  return bn.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function renderSlip(
  slip: T5018SubAggregateRow,
  fiscalYear: number,
  level: number,
): string {
  if (!slip.businessNumber) {
    throw new Error(
      `Cannot render T5018 slip for sub ${slip.subOrgId}: business number is null`,
    );
  }
  const bn = normalizeBN(slip.businessNumber);
  const i = indent(level);
  const i1 = indent(level + 1);
  const i2 = indent(level + 2);
  const lines: string[] = [];
  lines.push(`${i}<T5018Slip>`);
  lines.push(`${i1}<RecipientName>`);
  lines.push(
    `${i2}<NameLine1>${escapeXml(slip.legalName)}</NameLine1>`,
  );
  lines.push(`${i1}</RecipientName>`);
  lines.push(`${i1}<RecipientBN>${escapeXml(bn)}</RecipientBN>`);
  lines.push(`${i1}<AccountNumber>${escapeXml(slip.subOrgId)}</AccountNumber>`);
  if (slip.mailingAddress) {
    lines.push(`${i1}<RecipientAddress>`);
    lines.push(
      `${i2}<AddressLine1>${escapeXml(slip.mailingAddress)}</AddressLine1>`,
    );
    lines.push(`${i1}</RecipientAddress>`);
  }
  lines.push(
    `${i1}<ReportingPeriodStart>${fiscalYear}-01-01</ReportingPeriodStart>`,
  );
  lines.push(
    `${i1}<ReportingPeriodEnd>${fiscalYear}-12-31</ReportingPeriodEnd>`,
  );
  lines.push(
    `${i1}<ContractPaymentAmount>${fmtCents(slip.totalAmountCents)}</ContractPaymentAmount>`,
  );
  lines.push(`${i}</T5018Slip>`);
  return lines.join("\n");
}

function renderSummary(
  reporter: T5018XmlInput["reporter"],
  fiscalYear: number,
  slipCount: number,
  totalCents: number,
  level: number,
): string {
  const i = indent(level);
  const i1 = indent(level + 1);
  const i2 = indent(level + 2);
  const lines: string[] = [];
  lines.push(`${i}<T5018Summary>`);
  lines.push(`${i1}<ReporterName>`);
  lines.push(
    `${i2}<NameLine1>${escapeXml(reporter.legalName)}</NameLine1>`,
  );
  lines.push(`${i1}</ReporterName>`);
  lines.push(
    `${i1}<ReporterBN>${escapeXml(normalizeBN(reporter.businessNumber))}</ReporterBN>`,
  );
  if (reporter.craReceiverCode) {
    lines.push(
      `${i1}<ReceiverCode>${escapeXml(reporter.craReceiverCode)}</ReceiverCode>`,
    );
  }
  if (
    reporter.addr1 ||
    reporter.city ||
    reporter.province ||
    reporter.postalCode
  ) {
    lines.push(`${i1}<ReporterAddress>`);
    if (reporter.addr1) {
      lines.push(
        `${i2}<AddressLine1>${escapeXml(reporter.addr1)}</AddressLine1>`,
      );
    }
    if (reporter.city) {
      lines.push(`${i2}<City>${escapeXml(reporter.city)}</City>`);
    }
    if (reporter.province) {
      lines.push(
        `${i2}<Province>${escapeXml(reporter.province)}</Province>`,
      );
    }
    if (reporter.postalCode) {
      lines.push(
        `${i2}<PostalCode>${escapeXml(reporter.postalCode)}</PostalCode>`,
      );
    }
    lines.push(
      `${i2}<Country>${escapeXml(reporter.country || "Canada")}</Country>`,
    );
    lines.push(`${i1}</ReporterAddress>`);
  }
  if (reporter.filingContactName) {
    lines.push(`${i1}<FilingContact>`);
    lines.push(
      `${i2}<Name>${escapeXml(reporter.filingContactName)}</Name>`,
    );
    if (reporter.filingContactEmail) {
      lines.push(
        `${i2}<Email>${escapeXml(reporter.filingContactEmail)}</Email>`,
      );
    }
    lines.push(`${i1}</FilingContact>`);
  }
  lines.push(`${i1}<TaxationYear>${fiscalYear}</TaxationYear>`);
  lines.push(`${i1}<TotalSlipCount>${slipCount}</TotalSlipCount>`);
  lines.push(
    `${i1}<TotalContractPayments>${fmtCents(totalCents)}</TotalContractPayments>`,
  );
  lines.push(`${i}</T5018Summary>`);
  return lines.join("\n");
}

export function generateT5018Xml(input: T5018XmlInput): T5018XmlOutput {
  const eligible = input.slips.filter((s) => s.status === "eligible");
  const slipCount = eligible.length;
  const totalAmountCents = eligible.reduce(
    (acc, s) => acc + s.totalAmountCents,
    0,
  );

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<T5018>`);
  for (const slip of eligible) {
    lines.push(renderSlip(slip, input.fiscalYear, 1));
  }
  lines.push(
    renderSummary(
      input.reporter,
      input.fiscalYear,
      slipCount,
      totalAmountCents,
      1,
    ),
  );
  lines.push(`</T5018>`);
  const xml = lines.join("\n") + "\n";
  const xmlChecksum = createHash("sha256").update(xml).digest("hex");
  return { xml, xmlChecksum, slipCount, totalAmountCents };
}
