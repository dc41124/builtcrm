import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Drizzle Schema First Pass
 *
 * Focus:
 * - First implementation subset from the schema draft
 * - Cross-cutting enums that matter for correctness
 * - Authoritative source tables, not derived page summaries
 *
 * Notes:
 * - Project-specific overrides live primarily in projectUserMemberships
 * - billingPackages is intentionally included as an official source-model object
 * - complianceRecords is included here because it becomes first-wave if subcontractor
 *   restriction-state logic matters in the first build slice
 */

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const organizationTypeEnum = pgEnum("organization_type", [
  "contractor",
  "subcontractor",
  "client_company",
  "household",
  "internal_platform",
]);

export const portalTypeEnum = pgEnum("portal_type", [
  "contractor",
  "subcontractor",
  "client",
]);

export const clientSubtypeEnum = pgEnum("client_subtype", [
  "commercial",
  "residential",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "inactive",
  "removed",
]);

export const accessStateEnum = pgEnum("access_state", [
  "active",
  "pending_onboarding",
  "pending_compliance",
  "restricted",
  "inactive",
]);

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

/**
 * Keep these shared and tight. They are correctness-critical across the schema.
 */
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

export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "submitted",
  "completed",
  "cancelled",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "active",
  "pending_review",
  "superseded",
  "archived",
]);

export const billingPackageStatusEnum = pgEnum("billing_package_status", [
  "draft",
  "ready_for_review",
  "under_review",
  "approved",
  "rejected",
  "closed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "not_started",
  "pending",
  "in_review",
  "approved",
  "paid",
  "overdue",
  "cancelled",
]);

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "pending_issue",
  "issued",
  "revised",
  "closed",
  "cancelled",
]);

export const complianceStatusEnum = pgEnum("compliance_status", [
  "pending",
  "active",
  "expired",
  "rejected",
  "waived",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "project_update",
  "milestone_update",
  "approval_requested",
  "approval_completed",
  "file_uploaded",
  "selection_ready",
  "payment_update",
  "comment_added",
]);

export const surfaceTypeEnum = pgEnum("surface_type", [
  "feed_item",
  "homepage_summary",
  "client_update",
  "notification_source",
  "status_strip",
]);

export const organizationMembershipTypeEnum = pgEnum("organization_membership_type", [
  "contractor",
  "subcontractor",
  "client",
  "consultant",
]);

// -----------------------------------------------------------------------------
// Shared columns
// -----------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /**
   * Drizzle runtime can auto-populate this on update via `$onUpdate`, but that is
   * not a database-level trigger. Treat this as an application/runtime strategy in
   * the first pass, and keep repository/update helpers consistent.
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// -----------------------------------------------------------------------------
// Identity + organization
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    firstName: varchar("first_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }),
    displayName: varchar("display_name", { length: 200 }),
    phone: varchar("phone", { length: 40 }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    emailUnique: unique("users_email_unique").on(table.email),
  }),
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    organizationType: organizationTypeEnum("organization_type").notNull(),
    ...timestamps,
  },
  (table) => ({
    nameIdx: index("organizations_name_idx").on(table.name),
  }),
);

export const organizationUsers = pgTable(
  "organization_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipStatus: membershipStatusEnum("membership_status").default("active").notNull(),
    jobTitle: varchar("job_title", { length: 180 }),
    ...timestamps,
  },
  (table) => ({
    orgUserUnique: unique("organization_users_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    orgIdx: index("organization_users_org_idx").on(table.organizationId),
    userIdx: index("organization_users_user_idx").on(table.userId),
  }),
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    portalType: portalTypeEnum("portal_type").notNull(),
    roleKey: varchar("role_key", { length: 120 }).notNull(),
    clientSubtype: clientSubtypeEnum("client_subtype"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    /**
     * DB-enforced: only client portal roles may carry client_subtype.
     */
    clientSubtypePortalCheck: check(
      "role_assignments_client_subtype_check",
      sql`(
        (${table.portalType} = 'client' and ${table.clientSubtype} is not null)
        or
        (${table.portalType} <> 'client' and ${table.clientSubtype} is null)
      )`,
    ),
    userOrgIdx: index("role_assignments_user_org_idx").on(table.userId, table.organizationId),
    portalIdx: index("role_assignments_portal_idx").on(table.portalType),
  }),
);

// -----------------------------------------------------------------------------
// Projects + memberships
// -----------------------------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    projectCode: varchar("project_code", { length: 80 }),
    projectType: varchar("project_type", { length: 120 }),
    /**
     * Nullable until the project enters a real client-facing portal path.
     * Once a project has a client-facing experience, this should be populated.
     * This is app-enforced in the first pass because it depends on portal enablement,
     * not just local row state.
     */
    clientSubtype: clientSubtypeEnum("client_subtype"),
    projectStatus: projectStatusEnum("project_status").default("draft").notNull(),
    currentPhase: currentPhaseEnum("current_phase").default("preconstruction").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetCompletionDate: timestamp("target_completion_date", { withTimezone: true }),
    actualCompletionDate: timestamp("actual_completion_date", { withTimezone: true }),
    contractorOrganizationId: uuid("contractor_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    /**
     * App-enforced invariants in first pass:
     * - organization_id must align with a valid organization_users row for user_id
     * - role_assignment_id must belong to the same user_id + organization_id pair
     * - project membership must align with a valid project_organization_memberships row
     */
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
// File + document layer
// -----------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 120 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /**
     * Intentionally globally unique across the bucket namespace.
     */
    storageKey: text("storage_key").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    visibilityScope: visibilityScopeEnum("visibility_scope").notNull(),
    audienceScope: audienceScopeEnum("audience_scope").notNull(),
    documentStatus: documentStatusEnum("document_status").default("active").notNull(),
    isSuperseded: boolean("is_superseded").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    storageKeyUnique: unique("documents_storage_key_unique").on(table.storageKey),
    projectIdx: index("documents_project_idx").on(table.projectId),
    audienceIdx: index("documents_audience_idx").on(table.audienceScope),
  }),
);

export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    linkedObjectType: varchar("linked_object_type", { length: 120 }).notNull(),
    linkedObjectId: uuid("linked_object_id").notNull(),
    linkRole: varchar("link_role", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index("document_links_document_idx").on(table.documentId),
    linkedObjectIdx: index("document_links_object_idx").on(
      table.linkedObjectType,
      table.linkedObjectId,
    ),
  }),
);

// -----------------------------------------------------------------------------
// Workflow: first implementation slice candidate
// -----------------------------------------------------------------------------

export const uploadRequests = pgTable(
  "upload_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    requestStatus: requestStatusEnum("request_status").default("open").notNull(),
    requestedFromUserId: uuid("requested_from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requestedFromOrganizationId: uuid("requested_from_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    dueAt: timestamp("due_at", { withTimezone: true }),
    relatedObjectType: varchar("related_object_type", { length: 120 }),
    relatedObjectId: uuid("related_object_id"),
    visibilityScope: visibilityScopeEnum("visibility_scope").notNull(),
    ...timestamps,
  },
  (table) => ({
    targetRequiredCheck: check(
      "upload_requests_target_required_check",
      sql`${table.requestedFromUserId} is not null or ${table.requestedFromOrganizationId} is not null`,
    ),
    projectIdx: index("upload_requests_project_idx").on(table.projectId),
    statusIdx: index("upload_requests_status_idx").on(table.requestStatus),
    requestedOrgIdx: index("upload_requests_requested_org_idx").on(table.requestedFromOrganizationId),
  }),
);

// -----------------------------------------------------------------------------
// Billing layer (official source-model object for commercial workflows)
// -----------------------------------------------------------------------------

export const billingPackages = pgTable(
  "billing_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    billingPackageNumber: varchar("billing_package_number", { length: 80 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    billingPackageStatus: billingPackageStatusEnum("billing_package_status")
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => ({
    projectNumberUnique: unique("billing_packages_project_number_unique").on(
      table.projectId,
      table.billingPackageNumber,
    ),
    projectIdx: index("billing_packages_project_idx").on(table.projectId),
    statusIdx: index("billing_packages_status_idx").on(table.billingPackageStatus),
  }),
);

// -----------------------------------------------------------------------------
// Compliance layer
// -----------------------------------------------------------------------------

export const complianceRecords = pgTable(
  "compliance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    complianceType: varchar("compliance_type", { length: 120 }).notNull(),
    complianceStatus: complianceStatusEnum("compliance_status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    /**
     * First pass: active-record dedupe is app-enforced while the exact org-scoped vs
     * project-scoped uniqueness policy is still stabilizing.
     */
    orgIdx: index("compliance_records_org_idx").on(table.organizationId),
    projectIdx: index("compliance_records_project_idx").on(table.projectId),
    statusIdx: index("compliance_records_status_idx").on(table.complianceStatus),
  }),
);

// -----------------------------------------------------------------------------
// Derived + audit layer
// -----------------------------------------------------------------------------

export const activityFeedItems = pgTable(
  "activity_feed_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    activityType: activityTypeEnum("activity_type").notNull(),
    surfaceType: surfaceTypeEnum("surface_type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    relatedObjectType: varchar("related_object_type", { length: 120 }),
    relatedObjectId: uuid("related_object_id"),
    visibilityScope: visibilityScopeEnum("visibility_scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("activity_feed_items_project_idx").on(table.projectId),
    activityIdx: index("activity_feed_items_activity_idx").on(table.activityType),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    objectType: varchar("object_type", { length: 120 }).notNull(),
    objectId: uuid("object_id").notNull(),
    actionName: varchar("action_name", { length: 120 }).notNull(),
    previousState: jsonb("previous_state"),
    nextState: jsonb("next_state"),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("audit_events_actor_idx").on(table.actorUserId),
    projectIdx: index("audit_events_project_idx").on(table.projectId),
    objectIdx: index("audit_events_object_idx").on(table.objectType, table.objectId),
  }),
);

// -----------------------------------------------------------------------------
// Suggested migration order (first pass)
// -----------------------------------------------------------------------------

/**
 * 1. enums
 * 2. users
 * 3. organizations
 * 4. organization_users
 * 5. role_assignments
 * 6. projects
 * 7. project_organization_memberships
 * 8. project_user_memberships
 * 9. documents
 * 10. document_links
 * 11. upload_requests
 * 12. billing_packages
 * 13. compliance_records
 * 14. activity_feed_items
 * 15. audit_events
 */
