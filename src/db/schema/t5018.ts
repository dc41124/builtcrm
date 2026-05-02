import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { retention, timestamps } from "./_shared";
import { organizations, users } from "./identity";

// Step 67 — T5018 contractor payment slip generator.
//
// Canada Revenue Agency requires construction-industry contractors to
// issue T5018 slips to subs paid > $500 CAD in a calendar year and file
// the consolidated XML summary with CRA by Feb 28 of the following year.
//
// One row per (contractor_org_id, fiscal_year). Re-generation UPDATEs the
// existing row in place — old XML/PDF blobs in R2 are replaced, the
// xml_checksum changes, and a fresh `tax.t5018.generated` audit event
// is written.
//
// Both tables live in `statutory_tax` retention tier (CRA s.230 — keep
// payment-tax-slip source records 6 years from end of tax year). The
// `retention()` helper from _shared.ts populates `retention_until` at
// insert: created_at + 7 years to safely cover the calendar-year
// boundary. Stored XML/PDF blobs go to R2 outside the `tmp/` prefix so
// the Step 66.5 orphan sweep won't touch them.

export const t5018FilingStatusEnum = pgEnum("t5018_filing_status", [
  "generated",
  "filed",
]);

// -----------------------------------------------------------------------------
// t5018_filings — one row per (contractor_org, fiscal_year). Holds the
// package metadata: who generated, what's in it, where the blobs live in
// R2, and whether/when it was filed with CRA.
// -----------------------------------------------------------------------------

export const t5018Filings = pgTable(
  "t5018_filings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contractorOrgId: uuid("contractor_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Calendar year the slip covers (e.g. 2025). Aggregation window is
    // Jan 1 – Dec 31 of this year; CRA filing deadline is Feb 28 of the
    // following year.
    fiscalYear: integer("fiscal_year").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    generatedByUserId: uuid("generated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // SHA-256 of the generated XML content (hex). Lets the UI surface
    // "this is the same package you generated before" without re-parsing
    // the XML.
    xmlChecksum: varchar("xml_checksum", { length: 64 }).notNull(),
    slipCount: integer("slip_count").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    // R2 keys for the three artifacts. All under a non-tmp prefix
    // (typically `t5018/{contractor_org_id}/{fiscal_year}/...`) so the
    // Step 66.5 orphan sweep won't touch them.
    zipStorageKey: text("zip_storage_key").notNull(),
    xmlStorageKey: text("xml_storage_key").notNull(),
    csvStorageKey: text("csv_storage_key"),
    status: t5018FilingStatusEnum("status").default("generated").notNull(),
    // Filed-with-CRA tracking. Set manually by the org admin after they
    // upload the XML to CRA's Internet File Transfer service. The system
    // never auto-files.
    filedAt: timestamp("filed_at", { withTimezone: true }),
    filedByUserId: uuid("filed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    craConfirmationCode: varchar("cra_confirmation_code", { length: 64 }),
    notes: text("notes"),
    ...timestamps,
    ...retention("statutory_tax"),
  },
  (table) => ({
    // One filing per (contractor, year). Re-generation replaces the row
    // contents instead of inserting a new row.
    contractorYearUnique: unique("t5018_filings_contractor_year_unique").on(
      table.contractorOrgId,
      table.fiscalYear,
    ),
    contractorIdx: index("t5018_filings_contractor_idx").on(
      table.contractorOrgId,
    ),
    statusIdx: index("t5018_filings_status_idx").on(table.status),
    tenantIsolation: pgPolicy("t5018_filings_tenant_isolation", {
      for: "all",
      using: sql`${table.contractorOrgId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.contractorOrgId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// t5018_filing_slips — one row per sub on a given filing. Snapshots the
// recipient identity at generation time so a later sub-org rename or BN
// change doesn't retroactively alter the historical slip.
// -----------------------------------------------------------------------------

export const t5018FilingSlips = pgTable(
  "t5018_filing_slips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    filingId: uuid("filing_id")
      .notNull()
      .references(() => t5018Filings.id, { onDelete: "cascade" }),
    subOrgId: uuid("sub_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Snapshots — captured at generation time so the slip stays accurate
    // even if the sub later renames or changes their BN.
    subLegalNameSnapshot: varchar("sub_legal_name_snapshot", {
      length: 255,
    }).notNull(),
    // Encrypted via BUSINESS_NUMBER_ENCRYPTION_KEY (separate from
    // organizations.business_number — slip carries its own copy so a
    // future BN-key rotation doesn't desync the historical record).
    recipientBnEncrypted: text("recipient_bn_encrypted"),
    subAddressSnapshot: text("sub_address_snapshot"),
    totalAmountCents: integer("total_amount_cents").notNull(),
    paymentCount: integer("payment_count").notNull(),
    // R2 key for the per-sub PDF slip.
    slipPdfStorageKey: text("slip_pdf_storage_key").notNull(),
    ...timestamps,
    ...retention("statutory_tax"),
  },
  (table) => ({
    filingIdx: index("t5018_filing_slips_filing_idx").on(table.filingId),
    subIdx: index("t5018_filing_slips_sub_idx").on(table.subOrgId),
    // Belt-and-suspenders: a sub appears at most once per filing.
    filingSubUnique: unique("t5018_filing_slips_filing_sub_unique").on(
      table.filingId,
      table.subOrgId,
    ),
    // Inherit tenancy through the parent filing — the loader filters by
    // filing_id which is itself contractor-scoped.
  }),
);
