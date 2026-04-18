import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";
import { organizations, users } from "./identity";

// -----------------------------------------------------------------------------
// Data export tracking. One row per user-requested export. Small exports run
// synchronously and insert + update this row in a single request; heavy ones
// enqueue a Trigger.dev v3 job that picks up the row and writes a ZIP to R2.
//
// Feature gating lives in src/domain/policies/plan.ts — `data_exports.full_archive`
// and `audit.csv_export` keys. Routes call requireFeature before inserting.
// `expired` is computed at read time from `expires_at < now()` — no separate
// status value, no background job to flip state.
// -----------------------------------------------------------------------------

export const dataExports = pgTable(
  "data_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    exportKind: text("export_kind").notNull(),
    // Optional filters — e.g. { projectIds: [...], dateRange: { from, to } }.
    // Shape is export-kind-specific; loaders own validation.
    scope: jsonb("scope"),
    status: text("status").notNull().default("queued"),
    // R2 object key, populated when the export writes out. Signed URLs are
    // re-minted on demand from this key; we never cache a signed URL.
    storageKey: text("storage_key"),
    // R2 object TTL. When now() > expires_at, the API returns 410 Gone and the
    // UI surfaces an "export expired — request a new one" state.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("data_exports_org_idx").on(table.organizationId),
    statusIdx: index("data_exports_status_idx").on(table.status),
    orgCreatedIdx: index("data_exports_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    kindCheck: check(
      "data_exports_kind_check",
      sql`${table.exportKind} in ('projects_csv','financial_csv','documents_zip','full_archive','audit_log_csv')`,
    ),
    statusCheck: check(
      "data_exports_status_check",
      sql`${table.status} in ('queued','running','ready','failed')`,
    ),
  }),
);
