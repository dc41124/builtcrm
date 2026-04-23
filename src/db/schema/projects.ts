import {
  char,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
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
  }),
);

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
  }),
);

// -----------------------------------------------------------------------------
// Milestones
//
// Dual-semantics heads up (Step 23): this table stores two conceptually
// different things.
//
//   - Point-in-time markers (start_date IS NULL) — inspections, deliveries,
//     approvals. Zero-duration nodes in CPM (critical-path-method) terms.
//     These are what the table was originally designed for; existing seed
//     data is all in this shape.
//
//   - Duration tasks (start_date IS NOT NULL) — excavation, framing,
//     drywall. Rendered as bars in the Gantt view from start_date →
//     scheduled_date. When start_date is set, treat scheduled_date as the
//     TERMINAL / TARGET date of the task.
//
// If scheduling grows deeper in a later phase we can split these into
// separate tables or add a `kind` enum. For now the nullability of
// start_date carries the distinction, and the loader + Gantt adapter
// branch on it. Dependencies live in the `milestoneDependencies` edge
// table below and apply to both shapes uniformly.
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
    // Nullable. When set, the milestone is a duration task rendered as
    // a Gantt bar from startDate → scheduledDate. When null, the row is
    // a zero-duration marker (existing behaviour).
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
