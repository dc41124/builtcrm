import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { retention, timestamps } from "./_shared";
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
//
// RLS Phase 3b — Pattern A. Two non-tenant-scoped call sites use the
// admin pool: (a) src/jobs/data-export-cleanup.ts is a daily cross-org
// sweep, and (b) src/app/api/user/data-export/route.ts GET reads the
// caller's GDPR-export history, which intentionally spans every org
// they've belonged to. Everything else (4× org/exports/* routes, the
// listRecentDataExports loader, the POST half of user/data-export)
// has a tenant context and goes through `withTenant`. See
// docs/specs/rls_sprint_plan.md §3.4.
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
    ...retention("operational"),
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
      sql`${table.exportKind} in ('projects_csv','financial_csv','documents_zip','full_archive','audit_log_csv','user_data_gdpr')`,
    ),
    statusCheck: check(
      "data_exports_status_check",
      sql`${table.status} in ('queued','running','ready','failed')`,
    ),
    tenantIsolation: pgPolicy("data_exports_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
