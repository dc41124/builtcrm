import {
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";

// Step 66 — RBQ (Régie du bâtiment du Québec) license cache.
//
// The cache is hydrated from the public RBQ Open Data catalog at
// donneesquebec.ca (CSV-only — there is no live programmatic API), via
// the `rbq-cache-refresh` Trigger.dev job that runs nightly. App-layer
// lookups never call out to RBQ at request time; they read from this
// table.
//
// One row per `rbq_number`. The same number can be referenced by
// multiple subcontractor orgs across multiple BuiltCRM contractors —
// the cache is BuiltCRM-wide, not org-scoped, and is NOT RLS'd.
//
// Retention tier: `reference` (forever). RBQ registry data is public,
// non-PII, and has no per-row deletion trigger. Per Step 66.5 the
// `reference` tier does not carry retention_class / retention_until /
// legal_hold columns.

export const rbqLicenseStatusEnum = pgEnum("rbq_license_status", [
  "active",
  "expired",
  "suspended",
  "not_found",
]);

export const rbqLicenseCache = pgTable(
  "rbq_license_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // The 10-digit RBQ number with dashes: "5641-9032-01" — natural key
    // from the public registry.
    rbqNumber: varchar("rbq_number", { length: 12 }).notNull(),
    // Legal name as it appears on the license. Null for `not_found` rows
    // that were probed but never matched.
    legalName: varchar("legal_name", { length: 255 }),
    status: rbqLicenseStatusEnum("status").notNull(),
    issuedAt: date("issued_at"),
    expiryDate: date("expiry_date"),
    // Authorized subclasses — array of { code: string, label: string }
    // pulled verbatim from the registry feed.
    subclasses: jsonb("subclasses"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Free-form label of the source dataset version, e.g.
    // "RBQ Open Data 2026-04-30". Surfaced in the admin UI footer for
    // attribution and freshness audits.
    sourceVersion: varchar("source_version", { length: 64 }),
    // Optional notes (e.g., reason a number was probed but not found).
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    rbqNumberUnique: unique("rbq_license_cache_rbq_number_unique").on(
      table.rbqNumber,
    ),
    statusIdx: index("rbq_license_cache_status_idx").on(table.status),
    expiryIdx: index("rbq_license_cache_expiry_date_idx").on(table.expiryDate),
  }),
);

// Province enum used by `projects.province_code` to drive
// jurisdiction-gated UI (RBQ widget, Ontario prompt-pay, etc.).
// Free-form `state_province` text on projects pre-dates this enum and
// stays as the human display value; province_code is the typed signal
// the app reads.
export const provinceCodeEnum = pgEnum("province_code", [
  "QC",
  "ON",
  "BC",
  "AB",
  "MB",
  "SK",
  "NS",
  "NB",
  "NL",
  "PE",
  "YT",
  "NT",
  "NU",
]);
