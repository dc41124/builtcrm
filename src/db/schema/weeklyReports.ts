import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { timestamps } from "./_shared";
import { users } from "./identity";
import { projects } from "./projects";

// Weekly progress reports (Step 39 / 4D #39).
//
// Two-table design: `weekly_reports` is the per-week container (one row per
// project per week, enforced by the unique constraint), and
// `weekly_report_sections` carries the structured per-section snapshot
// payloads produced at generation time. The contractor edits sections
// in-place; clients read the sent version. The residential portal renders
// the same data through a per-portal reshaper (see
// src/domain/loaders/weekly-reports.ts in a later commit) — no schema
// duplication for warmer copy / different card layouts.

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const weeklyReportStatusEnum = pgEnum("weekly_report_status", [
  "auto_draft",
  "editing",
  "sent",
  "archived",
]);

// Six section types match the build-guide spec exactly. `rfis` and `issues`
// stay distinct in the data model even though the contractor UI can render
// them in a combined visual section — keeps the source streams clean.
export const weeklyReportSectionTypeEnum = pgEnum(
  "weekly_report_section_type",
  ["daily_logs", "photos", "milestones", "rfis", "change_orders", "issues"],
);

// -----------------------------------------------------------------------------
// weekly_reports — one container per project per week
// -----------------------------------------------------------------------------

export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Week boundaries are project-local Mondays/Sundays. Stored as date
    // (no time/zone) — the Trigger.dev job computes Monday→Sunday in
    // `projects.timezone` and writes the resulting calendar dates here.
    weekStart: date("week_start").notNull(),
    weekEnd: date("week_end").notNull(),

    status: weeklyReportStatusEnum("status").default("auto_draft").notNull(),

    // Editable contractor narrative shown above sections. The prototype's
    // "Week summary" block is this field — special-styled, always editable,
    // not a separate section row.
    summaryText: text("summary_text"),

    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Null for auto-generated drafts; populated when the contractor uses
    // "Generate off-cycle." Useful for audit and to distinguish manual
    // regenerations from the Monday-morning cron.
    generatedByUserId: uuid("generated_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    ...timestamps,
  },
  (table) => ({
    // One report per project per week. Idempotency for the generation job
    // hangs off this — re-runs that find an existing row for the same
    // (project, weekStart) tuple no-op.
    projectWeekUnique: unique("weekly_reports_project_week_unique").on(
      table.projectId,
      table.weekStart,
    ),
    projectIdx: index("weekly_reports_project_idx").on(table.projectId),
    statusIdx: index("weekly_reports_status_idx").on(table.status),
    sentAtIdx: index("weekly_reports_sent_at_idx").on(table.sentAt),
    // Phase 4 wave 1 — same project-scoped multi-org template as milestones.
    tenantIsolation: pgPolicy("weekly_reports_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.projectId} IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR ${table.projectId} IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      `,
      withCheck: sql`
        ${table.projectId} IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR ${table.projectId} IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      `,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// weekly_report_sections — structured per-section snapshots
// -----------------------------------------------------------------------------
//
// `content` jsonb shape varies by `sectionType` (discriminated union, kept
// in the loader/action layer rather than encoded in pg). Approximate shapes:
//
//   daily_logs:    { entries: Array<{ logId, date, reportedByName, narrative,
//                    weather, crewSize, hoursLogged }>, narrativeOverlay?: string }
//   photos:        { items: Array<{ documentId, caption, takenAt }>,
//                    narrativeOverlay?: string }
//   milestones:    { closed: Array<{ milestoneId, title, closedAt, detail }>,
//                    upcoming: Array<{ milestoneId, title, dueDate }> }
//   rfis:          { opened: Array<{ id, number, title, openedAt, status }>,
//                    closed: Array<{ id, number, title, closedAt, turnaroundDays }> }
//   change_orders: { submitted: Array<{ id, number, title, amountCents }>,
//                    approved: Array<{ id, number, title, amountCents }> }
//   issues:        { items: Array<{ source, sourceId, summary, severity }> }
//
// `narrativeOverlay` (where present) is contractor-typed prose layered on
// top of the structured snapshot — preserves source data while letting the
// editor add explanation. Editable through updateWeeklyReportSection.

export const weeklyReportSections = pgTable(
  "weekly_report_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => weeklyReports.id, { onDelete: "cascade" }),
    sectionType: weeklyReportSectionTypeEnum("section_type").notNull(),
    content: jsonb("content")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    ...timestamps,
  },
  (table) => ({
    reportIdx: index("weekly_report_sections_report_idx").on(table.reportId),
    // One row per (report, sectionType) — the generation job upserts on
    // this tuple, so a re-run replaces in place rather than appending.
    reportSectionUnique: unique("weekly_report_sections_report_type_unique").on(
      table.reportId,
      table.sectionType,
    ),
    // Phase 4 wave 2 — nested under weekly_reports.
    tenantIsolation: pgPolicy("weekly_report_sections_tenant_isolation", {
      for: "all",
      using: sql`${table.reportId} IN (SELECT id FROM weekly_reports)`,
      withCheck: sql`${table.reportId} IN (SELECT id FROM weekly_reports)`,
    }),
  }),
).enableRLS();
