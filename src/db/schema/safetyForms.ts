import {
  boolean,
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

import { timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const safetyFormTypeEnum = pgEnum("safety_form_type", [
  "toolbox_talk",
  "jha",
  "incident_report",
  "near_miss",
]);

export const safetyFormStatusEnum = pgEnum("safety_form_status", [
  "draft",
  "submitted",
]);
// Note: 'queued' is intentionally absent. Queued is a CLIENT-only state
// living in the Step 51 IndexedDB outbox; it never reaches the server.
// On drain the outbox flips the row to 'submitted' (or 'draft' if the
// user only saved it locally).

export const safetySeverityEnum = pgEnum("safety_severity", [
  "first_aid",
  "recordable",
  "lost_time",
  "fatality",
  "property_damage",
  "environmental",
]);

// -----------------------------------------------------------------------------
// safety_form_templates — the per-org library of form definitions.
//
// `fields_json` carries the ordered list of field defs:
//   [{ key, type, label, required, hint?, options? }, ...]
// where `type` is one of the 11 renderer types (text, textarea, select,
// checklist, datetime, signature, photo, attendees, people, hazards,
// actions). The server doesn't interpret the structure; it just round-
// trips. Validation is Zod on the API boundary.
//
// `times_used` is a denormalised counter — bumped by the create-form
// action, never decremented. Used for the templates index sort and
// stat row in the prototype. Eventual consistency is fine; if the
// counter drifts a small recompute job can resync.
//
// Templates are org-scoped. A new org gets the 3 standard seeds
// (Daily Toolbox Talk, Incident Report, Near Miss Report) inserted by
// `scripts/seed-safety-form-templates.ts` during bootstrap. Editing
// fields in v1 means editing the seed file + re-running; in-app field
// editor is tracked in production_grade_upgrades/safety_template_field_editor.md.
// -----------------------------------------------------------------------------

export type SafetyFieldType =
  | "text"
  | "textarea"
  | "select"
  | "checklist"
  | "datetime"
  | "signature"
  | "photo"
  | "attendees"
  | "people"
  | "hazards"
  | "actions";

export interface SafetyTemplateField {
  key: string;
  type: SafetyFieldType;
  label: string;
  required: boolean;
  hint?: string;
  options?: string[];
}

export const safetyFormTemplates = pgTable(
  "safety_form_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    formType: safetyFormTypeEnum("form_type").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    fieldsJson: jsonb("fields_json")
      .$type<SafetyTemplateField[]>()
      .default([])
      .notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
    timesUsed: integer("times_used").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => ({
    orgFormTypeIdx: index("safety_form_templates_org_type_idx").on(
      table.organizationId,
      table.formType,
      table.isArchived,
    ),
    // RLS Pattern A — org-owned settings table; same shape as
    // inspection_templates. Tenant context is set on every authenticated
    // route via withTenant().
    tenantIsolation: pgPolicy("safety_form_templates_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// safety_form_template_assignments — which sub orgs see which templates.
//
// Per design Decision-6: contractors explicitly assign templates to
// subcontractor orgs. A sub sees template T on project P if:
//   (a) there's an assignment row (template=T, org=sub_org, project=NULL)
//       — org-wide assignment, sub sees this template on every project, OR
//   (b) there's a row (template=T, org=sub_org, project=P) — project-scoped.
//
// Contractor users see all their org's templates regardless (templates
// belong to the contractor's org). This table only gates SUB visibility.
//
// Composite PK on (template, org, project_or_null) prevents duplicate
// assignments. Cascading deletes follow the template / org / project.
// -----------------------------------------------------------------------------

export const safetyFormTemplateAssignments = pgTable(
  "safety_form_template_assignments",
  {
    // FKs declared in the table callback below with explicit short names.
    // The auto-generated names (e.g. safety_form_template_assignments_
    // template_id_safety_form_templates_id_fk = 72 chars) exceed Postgres'
    // 63-char limit and would silently truncate on write — drizzle-kit does
    // not truncate on introspection, so drift would surface on every
    // db:push / db:generate. See CLAUDE.md "FK constraint naming".
    templateId: uuid("template_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id"),
    assignedByUserId: uuid("assigned_by_user_id"),
    ...timestamps,
  },
  (table) => ({
    templateFk: foreignKey({
      columns: [table.templateId],
      foreignColumns: [safetyFormTemplates.id],
      name: "safety_form_template_assignments_template_id_fk",
    }).onDelete("cascade"),
    organizationFk: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "safety_form_template_assignments_org_id_fk",
    }).onDelete("cascade"),
    projectFk: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: "safety_form_template_assignments_project_id_fk",
    }).onDelete("cascade"),
    assignedByUserFk: foreignKey({
      columns: [table.assignedByUserId],
      foreignColumns: [users.id],
      name: "safety_form_template_assignments_assigned_by_fk",
    }).onDelete("set null"),
    // Postgres treats NULL as not-equal to itself, so two NULL projectId
    // assignments to the same (template, org) would not collide on a plain
    // unique. We don't need to enforce uniqueness across project=NULL rows
    // because logically there's only one org-wide assignment per
    // (template, org); use a partial-style index for that case.
    orgWideUnique: unique("safety_form_template_assignments_org_wide_unique").on(
      table.templateId,
      table.organizationId,
    ),
    projectAssignmentUnique: unique(
      "safety_form_template_assignments_project_unique",
    ).on(table.templateId, table.organizationId, table.projectId),
    orgIdx: index("safety_form_template_assignments_org_idx").on(
      table.organizationId,
      table.projectId,
    ),
    // RLS — sub sees rows for their own org; contractor sees rows for
    // templates they own (template → contractor org).
    subTenantIsolation: pgPolicy("safety_form_template_assignments_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.templateId} IN (
          SELECT id FROM safety_form_templates
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      `,
      withCheck: sql`
        ${table.templateId} IN (
          SELECT id FROM safety_form_templates
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      `,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// safety_form_counters — per-contractor-org monotonic SF-#### sequence.
//
// Same allocation pattern as closeout_counters: UPDATE … SET last_seq =
// last_seq + 1 RETURNING last_seq, inside the create-form transaction.
// Per-org (not per-project, not per-year) per design Decision-3:
// matches the prototype's flat numbering (SF-0040, SF-0042, etc. are
// mixed across projects in the demo data).
// -----------------------------------------------------------------------------

export const safetyFormCounters = pgTable(
  "safety_form_counters",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    lastNumber: integer("last_number").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    tenantIsolation: pgPolicy("safety_form_counters_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// safety_forms — one row per submission.
//
// `data_json` carries the user's answers keyed to `template.fields_json[].key`.
// For signature fields the value is the inline base64 data URL of the
// canvas (per design Decision-2 — signatures are tiny, immutable, and
// keeping them in the JSON keeps the offline payload self-contained).
// For photo fields the value is an array of document IDs (uploaded
// through the Step 51 R2 chain).
//
// `client_uuid` is the Step 51 idempotency key — same pattern as
// daily_logs.client_uuid. Nullable for direct online submits that don't
// route through the outbox.
//
// `form_number` is the per-org SF-#### value, allocated atomically via
// safety_form_counters at create time.
//
// `flagged` + `flag_reason` are author-time markers (the prototype shows
// flagged near-misses and incidents). Toggleable by contractor admin/PM
// per Decision-5.
//
// RLS — same project-scoped multi-org pattern as daily_logs / inspections:
// contractor sees rows on their projects; sub sees rows on projects where
// they're a member; clients never see this table.
// -----------------------------------------------------------------------------

export const safetyForms = pgTable(
  "safety_forms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => safetyFormTemplates.id, { onDelete: "restrict" }),
    formType: safetyFormTypeEnum("form_type").notNull(),
    formNumber: varchar("form_number", { length: 20 }).notNull(),
    status: safetyFormStatusEnum("status").default("draft").notNull(),

    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    submittedByOrgId: uuid("submitted_by_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    title: varchar("title", { length: 240 }).notNull(),

    dataJson: jsonb("data_json")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),

    clientUuid: uuid("client_uuid"),

    ...timestamps,
  },
  (table) => ({
    formNumberUnique: unique("safety_forms_form_number_unique").on(
      table.submittedByOrgId,
      table.formNumber,
    ),
    clientUuidUnique: unique("safety_forms_client_uuid_unique").on(
      table.clientUuid,
    ),
    projectStatusIdx: index("safety_forms_project_status_idx").on(
      table.projectId,
      table.status,
      table.submittedAt,
    ),
    projectTypeIdx: index("safety_forms_project_type_idx").on(
      table.projectId,
      table.formType,
    ),
    submittedByOrgIdx: index("safety_forms_submitted_by_org_idx").on(
      table.submittedByOrgId,
    ),
    flaggedIdx: index("safety_forms_flagged_idx").on(
      table.projectId,
      table.flagged,
    ),
    tenantIsolation: pgPolicy("safety_forms_tenant_isolation", {
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
// safety_form_incidents — 1:1 subtype for incident_report submissions.
//
// Why a separate table:
//   - 90% of submissions aren't incidents. Keeping severity / injured /
//     root-cause / corrective-actions out of safety_forms avoids 90%-NULL
//     columns on the parent.
//   - Incident-specific reports + KPIs (open incidents, OSHA recordable
//     rate, days-without-lost-time) become a clean inner join.
//   - The corrective-actions JSON column is a known approximation tracked
//     in production_grade_upgrades/safety_corrective_action_tracker.md;
//     promoting to a proper table is a single-step migration when needed.
//
// 1:1 (not 1:N) because per-submission you have at most one incident
// summary even if multiple people were affected — those go in
// `injured_json` as an array.
// -----------------------------------------------------------------------------

export interface SafetyInjuredParty {
  name: string;
  role?: string;
  bodyPart?: string;
  nature?: string;
}

export interface SafetyCorrectiveAction {
  id: string; // client-minted UUID
  action: string;
  owner: string;
  due: string; // ISO date
}

export const safetyFormIncidents = pgTable(
  "safety_form_incidents",
  {
    safetyFormId: uuid("safety_form_id")
      .primaryKey()
      .references(() => safetyForms.id, { onDelete: "cascade" }),
    severity: safetySeverityEnum("severity").notNull(),
    incidentAt: timestamp("incident_at", { withTimezone: true }).notNull(),
    location: text("location").notNull(),
    description: text("description"),
    rootCauseText: text("root_cause_text"),
    injuredJson: jsonb("injured_json")
      .$type<SafetyInjuredParty[]>()
      .default([])
      .notNull(),
    correctiveActionsJson: jsonb("corrective_actions_json")
      .$type<SafetyCorrectiveAction[]>()
      .default([])
      .notNull(),
    photoCount: integer("photo_count").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    severityIdx: index("safety_form_incidents_severity_idx").on(table.severity),
    incidentAtIdx: index("safety_form_incidents_incident_at_idx").on(
      table.incidentAt,
    ),
    // RLS — defer to safety_forms.tenantIsolation via the FK. Same shape
    // as inspection_results / daily_log_delays — incidents are scoped by
    // their parent form's project access.
    tenantIsolation: pgPolicy("safety_form_incidents_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.safetyFormId} IN (
          SELECT id FROM safety_forms
          WHERE project_id IN (
            SELECT id FROM projects
            WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
          )
          OR project_id IN (
            SELECT project_id FROM project_organization_memberships
            WHERE organization_id = current_setting('app.current_org_id', true)::uuid
              AND membership_status = 'active'
          )
        )
      `,
      withCheck: sql`
        ${table.safetyFormId} IN (
          SELECT id FROM safety_forms
          WHERE project_id IN (
            SELECT id FROM projects
            WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
          )
          OR project_id IN (
            SELECT project_id FROM project_organization_memberships
            WHERE organization_id = current_setting('app.current_org_id', true)::uuid
              AND membership_status = 'active'
          )
        )
      `,
    }),
  }),
).enableRLS();
