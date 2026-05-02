import { boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// -----------------------------------------------------------------------------
// Step 66.5 — Data retention infrastructure.
//
// Every table holding PII, financial, or project-record data spreads
// `...retention("<tier>")` into its column definition. The nightly
// retention-sweep job reads `retention_until` + `legal_hold` to drive
// scheduled hard-deletion. Tier choice + the tier's floor formula are
// codified in `src/lib/retention/tiers.ts`. R2 key columns that need
// blob cleanup after row deletion are listed in
// `src/lib/retention/r2-registry.ts`.
//
// Tables NOT in scope (no retention columns):
//   - `users` / `auth_user` — Law 25 erasure path is tombstone-update,
//     handled separately so audit_log FK integrity is preserved.
//   - `organizations` and pure membership/role junctions — cascade with
//     parent.
//   - Counter tables (closeout_counters, safety_form_counters) — pure
//     sequence allocators.
//   - `r2OrphanQueue` — system housekeeping table that manages its own
//     7-day lifecycle.
//   - `reference` tier tables (lookups, catalogs, jurisdictions, role
//     definitions) — the row IS the reference; no per-row retention
//     decision.
// -----------------------------------------------------------------------------

export const retentionClassEnum = pgEnum("retention_class", [
  "statutory_tax",
  "statutory_construction",
  "project_record",
  "operational",
  "auth_ephemeral",
  "design_archive",
  "privacy_fulfillment",
  "contract_signature_audit",
]);

export type RetentionTier =
  | "statutory_tax"
  | "statutory_construction"
  | "project_record"
  | "operational"
  | "auth_ephemeral"
  | "design_archive"
  | "privacy_fulfillment"
  | "contract_signature_audit";

export const retention = (tier: RetentionTier) => ({
  retentionClass: retentionClassEnum("retention_class").default(tier).notNull(),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  legalHold: boolean("legal_hold").default(false).notNull(),
});
