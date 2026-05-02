import {
  boolean,
  date,
  foreignKey,
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
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { retention, timestamps } from "./_shared";
import { documents } from "./documents";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const inspectionStatusEnum = pgEnum("inspection_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const inspectionOutcomeEnum = pgEnum("inspection_outcome", [
  "pass",
  "fail",
  "conditional",
  "na",
]);

export const inspectionPhaseEnum = pgEnum("inspection_phase", [
  "rough",
  "final",
]);

// -----------------------------------------------------------------------------
// Line-item shape stored in inspection_templates.line_items_json
// and frozen into inspections.template_snapshot_json on create.
// -----------------------------------------------------------------------------

export type InspectionLineItemDef = {
  key: string;
  orderIndex: number;
  label: string;
  ref?: string | null;
  photoRequired?: boolean;
};

// -----------------------------------------------------------------------------
// inspection_templates — per-org checklist library.
//
// Ten templates per contractor org are seeded on setup (framing rough,
// electrical rough, plumbing rough, HVAC rough, insulation, drywall,
// electrical final, plumbing final, mechanical final, final cleaning).
// `is_custom` stays false for seeded rows; user-created templates set
// it to true so the UI can flag them with the "CUSTOM" badge.
//
// `trade_category` is varchar (not enum) so custom templates don't
// require a migration to add a new category. The seed + create UI
// restrict to the seven JSX values (framing/electrical/plumbing/hvac/
// insulation/drywall/general) but the column accepts anything.
// -----------------------------------------------------------------------------

export const inspectionTemplates = pgTable(
  "inspection_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    tradeCategory: varchar("trade_category", { length: 40 }).notNull(),
    phase: inspectionPhaseEnum("phase").notNull(),
    description: text("description"),
    lineItemsJson: jsonb("line_items_json")
      .$type<InspectionLineItemDef[]>()
      .default([])
      .notNull(),
    isCustom: boolean("is_custom").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => ({
    orgArchivedIdx: index("inspection_templates_org_archived_idx").on(
      table.orgId,
      table.isArchived,
    ),
    orgTradeIdx: index("inspection_templates_org_trade_idx").on(
      table.orgId,
      table.tradeCategory,
    ),
    // RLS Slice A bucket 3 — Pattern A. Templates are contractor-owned
    // per-org; all reads/writes already pass through tenant context.
    tenantIsolation: pgPolicy("inspection_templates_tenant_isolation", {
      for: "all",
      using: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// inspections — one per QA/QC walkthrough on a project.
//
// Sequential number per project (INS-0001, INS-0002, ...) via the
// unique index on (projectId, sequentialNumber); the action layer
// computes `max(sequentialNumber) + 1` inside the create transaction.
//
// `template_snapshot_json` freezes the template's line items at the
// moment the inspection is created. Later edits to the source template
// do NOT change this inspection's checklist — critical for QA audit
// integrity (regulators expect the recorded checklist to match what
// was physically inspected).
//
// State machine (enforced in action layer):
//   scheduled → in_progress → completed
//   scheduled → cancelled
//   in_progress → cancelled
// Completion is terminal. Results become read-only on completion and
// any fail/conditional result spawns a punch_item linked back via
// `punch_items.source_inspection_result_id`.
// -----------------------------------------------------------------------------

export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequentialNumber: integer("sequential_number").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => inspectionTemplates.id, { onDelete: "restrict" }),
    // Snapshot of the template's line items at inspection-creation time.
    // Results reference items by `key`. If the source template is later
    // edited, historical inspections keep their original checklist.
    templateSnapshotJson: jsonb("template_snapshot_json")
      .$type<InspectionLineItemDef[]>()
      .default([])
      .notNull(),
    // Human-readable area/floor/room label. Required — every inspection
    // must be tied to a specific location ("Floor 2 East", "Mechanical
    // Room", "Unit 301") per the create modal in the JSX spec.
    zone: varchar("zone", { length: 80 }).notNull(),
    assignedOrgId: uuid("assigned_org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    scheduledDate: date("scheduled_date"),
    status: inspectionStatusEnum("status").default("scheduled").notNull(),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedByUserId: uuid("completed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    projectNumberUnique: unique("inspections_project_number_unique").on(
      table.projectId,
      table.sequentialNumber,
    ),
    projectStatusIdx: index("inspections_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    assignedOrgStatusIdx: index("inspections_assigned_org_status_idx").on(
      table.assignedOrgId,
      table.status,
    ),
    templateIdx: index("inspections_template_idx").on(table.templateId),
    // Phase 4 wave 1 — same project-scoped multi-org template as milestones.
    tenantIsolation: pgPolicy("inspections_tenant_isolation", {
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
// inspection_results — one row per line item on an inspection.
//
// `line_item_key` references the `key` field inside the inspection's
// template_snapshot_json. Unique(inspectionId, lineItemKey) means each
// line item is recorded exactly once per inspection; the upsert action
// re-uses this to update existing results.
//
// Pass-rate KPI calculation excludes `na` outcomes:
//   passRate = count(pass) / count(pass + fail + conditional)
// This matches the JSX logic and the spec's "pass rate across all
// completed inspections".
// -----------------------------------------------------------------------------

export const inspectionResults = pgTable(
  "inspection_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    lineItemKey: varchar("line_item_key", { length: 80 }).notNull(),
    outcome: inspectionOutcomeEnum("outcome").notNull(),
    notes: text("notes"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    inspectionKeyUnique: unique("inspection_results_inspection_key_unique").on(
      table.inspectionId,
      table.lineItemKey,
    ),
    inspectionIdx: index("inspection_results_inspection_idx").on(
      table.inspectionId,
    ),
    // Phase 4 wave 2 — nested under inspections.
    tenantIsolation: pgPolicy("inspection_results_tenant_isolation", {
      for: "all",
      using: sql`${table.inspectionId} IN (SELECT id FROM inspections)`,
      withCheck: sql`${table.inspectionId} IN (SELECT id FROM inspections)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// inspection_result_photos — mirrors the punch_item_photos junction
// table. R2 presign → finalize → link flow is reused: client gets a
// presigned URL from /api/upload/request, PUTs the file to R2, then
// posts here to associate the completed document with the result.
// -----------------------------------------------------------------------------

export const inspectionResultPhotos = pgTable(
  "inspection_result_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inspectionResultId: uuid("inspection_result_id").notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    caption: text("caption"),
    sortOrder: integer("sort_order").default(0).notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...retention("project_record"),
  },
  (table) => ({
    resultIdx: index("inspection_result_photos_result_idx").on(
      table.inspectionResultId,
    ),
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    inspectionResultFk: foreignKey({
      columns: [table.inspectionResultId],
      foreignColumns: [inspectionResults.id],
      name: "inspection_result_photos_inspection_result_id_fk",
    }).onDelete("cascade"),
    // Phase 4 wave 2 — depth-2 nesting through inspection_results
    // (which itself filters via inspections). Inner subquery's RLS
    // chains correctly; recursion terminates at the inspections policy.
    tenantIsolation: pgPolicy("inspection_result_photos_tenant_isolation", {
      for: "all",
      using: sql`${table.inspectionResultId} IN (SELECT id FROM inspection_results)`,
      withCheck: sql`${table.inspectionResultId} IN (SELECT id FROM inspection_results)`,
    }),
  }),
).enableRLS();
