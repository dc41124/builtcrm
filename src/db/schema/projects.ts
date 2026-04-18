import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
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
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipType: organizationMembershipTypeEnum("membership_type").notNull(),
    relationshipScope: text("relationship_scope"),
    phaseScope: text("phase_scope"),
    workScope: text("work_scope"),
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
    roleAssignmentId: uuid("role_assignment_id")
      .notNull()
      .references(() => roleAssignments.id, { onDelete: "restrict" }),
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
  }),
);

// -----------------------------------------------------------------------------
// Milestones
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
  }),
);
