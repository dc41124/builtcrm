import {
  char,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamps } from "./_shared";
import {
  clientSubtypeEnum,
  membershipStatusEnum,
  organizationMembershipTypeEnum,
  organizations,
  roleAssignments,
  users,
} from "./identity";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "active",
  "on_hold",
  "closed",
  "archived",
]);

export const currentPhaseEnum = pgEnum("current_phase", [
  "preconstruction",
  "phase_1",
  "phase_2",
  "phase_3",
  "closeout",
]);

export const accessStateEnum = pgEnum("access_state", [
  "active",
  "pending_onboarding",
  "pending_compliance",
  "restricted",
  "inactive",
]);

export const visibilityScopeEnum = pgEnum("visibility_scope", [
  "internal_only",
  "client_visible",
  "subcontractor_scoped",
  "project_wide",
  "phase_scoped",
  "scope_scoped",
]);

export const audienceScopeEnum = pgEnum("audience_scope", [
  "internal",
  "contractor",
  "subcontractor",
  "client",
  "commercial_client",
  "residential_client",
  "mixed",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "scheduled",
  "in_progress",
  "completed",
  "missed",
  "cancelled",
]);

export const milestoneTypeEnum = pgEnum("milestone_type", [
  "inspection",
  "deadline",
  "submission",
  "walkthrough",
  "delivery",
  "payment",
  "completion",
  "custom",
]);

export const milestoneKindEnum = pgEnum("milestone_kind", ["marker", "task"]);

// -----------------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    projectCode: varchar("project_code", { length: 80 }),
    projectType: varchar("project_type", { length: 120 }),
    clientSubtype: clientSubtypeEnum("client_subtype"),
    projectStatus: projectStatusEnum("project_status").default("draft").notNull(),
    currentPhase: currentPhaseEnum("current_phase").default("preconstruction").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetCompletionDate: timestamp("target_completion_date", { withTimezone: true }),
    actualCompletionDate: timestamp("actual_completion_date", { withTimezone: true }),
    contractorOrganizationId: uuid("contractor_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    // v2 modifications
    contractValueCents: integer("contract_value_cents"),
    addressLine1: varchar("address_line_1", { length: 255 }),
    addressLine2: varchar("address_line_2", { length: 255 }),
    city: varchar("city", { length: 120 }),
    stateProvince: varchar("state_province", { length: 120 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 3 }).default("CA"),
    // IANA tz string (e.g. "America/Toronto"). Anchors "today" for daily
    // logs and any other date-keyed workflow so a contractor in NY editing
    // a project in LA submits against LA's calendar day, not server time
    // or the submitter's browser.
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),

    // Geocoded from the street address on first use (lazy; see
    // src/lib/geocoding/nominatim.ts). Feeds the weather autofill
    // (Open-Meteo needs coordinates) and is generally useful for later
    // features like nearest-crew queries or a project map.
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    geocodedAt: timestamp("geocoded_at", { withTimezone: true }),

    // Per-project counter for meeting numbering (MTG-0001, MTG-0002, …).
    // Incremented atomically inside the create-meeting transaction via
    // `UPDATE projects SET meeting_counter = meeting_counter + 1
    // RETURNING` — the SELECT MAX+1 pattern loses under concurrent
    // creates. Sequential numbering is user-facing and must be gap-free
    // within a project; adding more counter columns here as future
    // modules need their own sequences is fine.
    meetingCounter: integer("meeting_counter").default(0).notNull(),
    // Per-project counter for transmittal numbering (TM-0001, TM-0002, …).
    // Same atomic-bump pattern as meetingCounter. Bump happens on the
    // first successful send, not on draft create — drafts don't hold
    // numbers, which would otherwise gap the sequence every time
    // someone abandoned a draft.
    transmittalCounter: integer("transmittal_counter").default(0).notNull(),

    ...timestamps,
  },
  (table) => ({
    codeUnique: unique("projects_project_code_unique").on(table.projectCode),
    contractorOrgIdx: index("projects_contractor_org_idx").on(table.contractorOrganizationId),
    statusIdx: index("projects_status_idx").on(table.projectStatus),
  }),
);

export const projectOrganizationMemberships = pgTable(
  "project_organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    membershipType: organizationMembershipTypeEnum("membership_type").notNull(),
    relationshipScope: text("relationship_scope"),
    phaseScope: text("phase_scope"),
    workScope: text("work_scope"),
    // Drawings discipline this org is scoped to on this project. Single-char
    // code matching drawing_sheets.discipline (A/S/E/M/P/…). NULL = no
    // discipline-based filter (contractor + consultant + client default).
    // Used by the drawings loader to restrict sheet visibility for subs.
    scopeDiscipline: char("scope_discipline", { length: 1 }),
    membershipStatus: membershipStatusEnum("membership_status").default("active").notNull(),
    ...timestamps,
  },
  (table) => ({
    projectOrgUnique: unique("project_org_memberships_project_org_unique").on(
      table.projectId,
      table.organizationId,
    ),
    projectIdx: index("project_org_memberships_project_idx").on(table.projectId),
    orgIdx: index("project_org_memberships_org_idx").on(table.organizationId),
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    organizationFk: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "project_organization_memberships_organization_id_fk",
    }).onDelete("cascade"),
    // Multi-org policy (3-clause hybrid; see rls_sprint_plan.md §4.2).
    //   A: own row (sub/client sees its own POM)
    //   B: contractor org owns the project (PM sees every POM on their project)
    //   C: caller's org has another active POM on the project (lets a sub
    //      see fellow POMs on shared projects — needed for "team" surfaces)
    // Cross-org system reads (notification recipients, search) bypass
    // via dbAdmin. The 'active' literal here couples to membershipStatusEnum;
    // see security_posture.md for the policy review trigger.
    tenantIsolation: pgPolicy("project_organization_memberships_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.projectId} IN (
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
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.projectId} IN (
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

export const projectUserMemberships = pgTable(
  "project_user_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    roleAssignmentId: uuid("role_assignment_id").notNull(),
    membershipStatus: membershipStatusEnum("membership_status").default("active").notNull(),
    accessState: accessStateEnum("access_state").default("active").notNull(),
    phaseScope: text("phase_scope"),
    workScope: text("work_scope"),
    defaultLandingPage: varchar("default_landing_page", { length: 120 }),
    defaultEmphasizedModule: varchar("default_emphasized_module", { length: 120 }),
    communicationScopeOverride: text("communication_scope_override"),
    notificationProfileOverride: text("notification_profile_override"),
    restrictionReason: text("restriction_reason"),
    ...timestamps,
  },
  (table) => ({
    projectUserOrgUnique: unique("project_user_memberships_project_user_org_unique").on(
      table.projectId,
      table.userId,
      table.organizationId,
    ),
    projectIdx: index("project_user_memberships_project_idx").on(table.projectId),
    userIdx: index("project_user_memberships_user_idx").on(table.userId),
    accessIdx: index("project_user_memberships_access_idx").on(table.accessState),
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    roleAssignmentFk: foreignKey({
      columns: [table.roleAssignmentId],
      foreignColumns: [roleAssignments.id],
      name: "project_user_memberships_role_assignment_id_fk",
    }).onDelete("restrict"),
    // Multi-org policy (3-clause hybrid; same template + rationale as
    // project_organization_memberships above). PUMs are read by the
    // contractor's project-team views (clause B), the user's own
    // membership lookup (clause A), and the cross-org "people on this
    // project" surfaces from sub/client portals (clause C).
    tenantIsolation: pgPolicy("project_user_memberships_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.projectId} IN (
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
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.projectId} IN (
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
// Milestones — markers (zero-duration) and tasks (duration). The `kind`
// column + CHECK constraint enforce the invariant: kind='marker' iff
// start_date IS NULL, kind='task' iff start_date IS NOT NULL.
// -----------------------------------------------------------------------------

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    milestoneType: milestoneTypeEnum("milestone_type").default("custom").notNull(),
    milestoneStatus: milestoneStatusEnum("milestone_status").default("scheduled").notNull(),
    kind: milestoneKindEnum("kind").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
    completedDate: timestamp("completed_date", { withTimezone: true }),
    phase: varchar("phase", { length: 60 }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedToOrganizationId: uuid("assigned_to_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    sortOrder: integer("sort_order").default(0).notNull(),
    visibilityScope: varchar("visibility_scope", { length: 60 }).default("project_wide").notNull(),
    ...timestamps,
  },
  (table) => ({
    projectIdx: index("milestones_project_idx").on(table.projectId),
    scheduledIdx: index("milestones_scheduled_idx").on(table.scheduledDate),
    statusIdx: index("milestones_status_idx").on(table.milestoneStatus),
    projectScheduleIdx: index("milestones_project_schedule_idx").on(
      table.projectId,
      table.scheduledDate,
    ),
    startDateIdx: index("milestones_start_date_idx").on(table.startDate),
    kindStartDateCheck: check(
      "milestones_kind_start_date_check",
      sql`(${table.kind} = 'marker' AND ${table.startDate} IS NULL)
        OR (${table.kind} = 'task' AND ${table.startDate} IS NOT NULL)`,
    ),
  }),
);

// -----------------------------------------------------------------------------
// Milestone dependencies — directed edges for CPM / Gantt (Step 23)
//
// One row per (predecessor → successor) pair. Multi-predecessor by
// design: a successor can have many predecessors, all of which must
// complete before it starts. Cycle + self-reference guards live at
// both the DB level (CHECK + partial unique) and the action layer
// (graph walks in src/domain/schedule/dependencies.ts).
// -----------------------------------------------------------------------------

export const milestoneDependencies = pgTable(
  "milestone_dependencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    predecessorId: uuid("predecessor_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    successorId: uuid("successor_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // CPM disallows self-loops; enforced at the row level so direct
    // SQL can't bypass the app-layer guard either.
    noSelfEdge: check(
      "milestone_dependencies_no_self",
      sql`${table.predecessorId} <> ${table.successorId}`,
    ),
    edgeUnique: uniqueIndex("milestone_dependencies_edge_unique").on(
      table.predecessorId,
      table.successorId,
    ),
    predecessorIdx: index("milestone_dependencies_predecessor_idx").on(
      table.predecessorId,
    ),
    successorIdx: index("milestone_dependencies_successor_idx").on(
      table.successorId,
    ),
  }),
);
