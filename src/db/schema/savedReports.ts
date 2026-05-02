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
// Saved reports — named filter sets for the contractor Reports page library.
// A saved report is a (reportType, scope) pair with an optional email cadence.
// Recipients + schedule drive the background delivery job; lastRunAt / nextRunAt
// are maintained by that job. scopeFilters is report-type-specific JSON the
// loader re-applies when the report is re-run (project ids, date ranges, etc.).
//
// Scheduling model: a single cron-ish expression plus a timezone the cron is
// evaluated against. A simple human label is stored alongside for the library
// list so we don't have to reverse-render cron expressions in the UI.
// -----------------------------------------------------------------------------

export const savedReports = pgTable(
  "saved_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // Mirrors the report ids in reports-ui.tsx (wip, ar, cashflow, cost,
    // labor, schedule, compliance, payments, weekly-reports, lien-waivers,
    // procurement, overview). No CHECK constraint — the UI constrains
    // selection and new reports are added over time.
    reportType: text("report_type").notNull(),
    scopeDescription: text("scope_description"),
    // Report-type-specific filter payload: { projectIds: [...], statusFilter,
    // dateRange, etc. }. Loaders own validation.
    scopeFilters: jsonb("scope_filters"),
    scheduleCron: text("schedule_cron"),
    scheduleLabel: text("schedule_label"),
    scheduleTimezone: text("schedule_timezone"),
    recipients: jsonb("recipients").notNull().default(sql`'[]'::jsonb`),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    ...timestamps,
    ...retention("operational"),
  },
  (table) => ({
    orgIdx: index("saved_reports_organization_id_idx").on(table.organizationId),
    ownerIdx: index("saved_reports_owner_user_id_idx").on(table.ownerUserId),
    orgCreatedIdx: index("saved_reports_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    // Partial index: the scheduled-delivery job scans only rows with a
    // cron set, sorted by their next fire time.
    nextRunIdx: index("saved_reports_next_run_at_idx")
      .on(table.nextRunAt)
      .where(sql`${table.scheduleCron} is not null`),
    // Guardrails: schedule pieces are either all null or coherent.
    scheduleCoherenceCheck: check(
      "saved_reports_schedule_coherence_check",
      sql`(
        ${table.scheduleCron} is null
        and ${table.scheduleLabel} is null
        and ${table.scheduleTimezone} is null
        and ${table.nextRunAt} is null
      ) or (
        ${table.scheduleCron} is not null
        and ${table.scheduleTimezone} is not null
      )`,
    ),
    // RLS Phase 3 — Pattern A. See docs/specs/rls_sprint_plan.md.
    tenantIsolation: pgPolicy("saved_reports_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
