import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects, visibilityScopeEnum } from "./projects";
import { documents } from "./documents";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "submitted",
  "revision_requested",
  "completed",
  "cancelled",
]);

export const complianceStatusEnum = pgEnum("compliance_status", [
  "pending",
  "active",
  "expired",
  "rejected",
  "waived",
]);

export const rfiTypeEnum = pgEnum("rfi_type", ["formal", "issue"]);

export const rfiStatusEnum = pgEnum("rfi_status", [
  "draft",
  "open",
  "pending_response",
  "answered",
  "closed",
]);

export const changeOrderStatusEnum = pgEnum("change_order_status", [
  "draft",
  "pending_review",
  "pending_client_approval",
  "approved",
  "rejected",
  "voided",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "needs_revision",
]);

export const approvalCategoryEnum = pgEnum("approval_category", [
  "general",
  "design",
  "procurement",
  "change_order",
  "other",
]);

// -----------------------------------------------------------------------------
// Upload requests
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
    requestedFromOrganizationId: uuid("requested_from_organization_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    expectedFileType: varchar("expected_file_type", { length: 120 }),
    submittedDocumentId: uuid("submitted_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    revisionNote: text("revision_note"),
    responseNote: text("response_note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
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
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    requestedFromOrganizationFk: foreignKey({
      columns: [table.requestedFromOrganizationId],
      foreignColumns: [organizations.id],
      name: "upload_requests_requested_from_organization_id_fk",
    }).onDelete("set null"),
    // RLS Slice A bucket 3 — project-scoped 2-clause hybrid (same template
    // as rfis / change_orders / approvals). Contractor owns the project,
    // OR caller has an active POM. requestedFromOrganizationId routes the
    // ask but doesn't gate visibility; ownership is purely project-scoped.
    tenantIsolation: pgPolicy("upload_requests_tenant_isolation", {
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
// Compliance
// -----------------------------------------------------------------------------

// RLS Phase 3c — multi-org policy. Compliance records are inherently
// cross-org: a sub uploads insurance/W-9/etc per project that the
// contractor reviews, and the contractor's org also has its own
// compliance records (state license expirations etc) on
// projectId=NULL. Pattern A alone deny-fails for contractor reading
// sub records on their projects. Same 3-clause hybrid template as
// lien_waivers — see docs/specs/rls_sprint_plan.md §4.2.
//
// projectId is nullable here (org-level records have no project), so
// clause B and clause C only fire when projectId IS NOT NULL; the
// org-level records fall through to clause A (organization_id = GUC).
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
    // Free-form metadata for presentation-layer detail strings that don't fit
    // structured columns: carrier name, coverage amount, policy number hints,
    // etc. Keys expected by the sub settings UI: `carrier`, `coverage`,
    // `detail`. Schema-free on purpose — extend without a migration.
    metadataJson: jsonb("metadata_json"),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("compliance_records_org_idx").on(table.organizationId),
    projectIdx: index("compliance_records_project_idx").on(table.projectId),
    statusIdx: index("compliance_records_status_idx").on(table.complianceStatus),
    tenantIsolation: pgPolicy("compliance_records_tenant_isolation", {
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
// RFIs
// -----------------------------------------------------------------------------

export const rfis = pgTable(
  "rfis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequentialNumber: integer("sequential_number").notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body"),
    rfiStatus: rfiStatusEnum("rfi_status").default("draft").notNull(),
    rfiType: rfiTypeEnum("rfi_type").default("issue").notNull(),

    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedToOrganizationId: uuid("assigned_to_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),

    dueAt: timestamp("due_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    resultingChangeOrderId: uuid("resulting_change_order_id").references(
      (): AnyPgColumn => changeOrders.id,
      { onDelete: "set null" },
    ),

    visibilityScope: varchar("visibility_scope", { length: 60 }).default("project_wide").notNull(),

    drawingReference: varchar("drawing_reference", { length: 255 }),
    specificationReference: varchar("specification_reference", { length: 255 }),
    locationDescription: text("location_description"),

    ...timestamps,
  },
  (table) => ({
    projectNumberUnique: unique("rfis_project_number_unique").on(
      table.projectId,
      table.sequentialNumber,
    ),
    projectIdx: index("rfis_project_idx").on(table.projectId),
    statusIdx: index("rfis_status_idx").on(table.rfiStatus),
    assignedIdx: index("rfis_assigned_idx").on(table.assignedToUserId),
    dueIdx: index("rfis_due_idx").on(table.dueAt),
    // Phase 4 wave 4 — same project-scoped 2-clause hybrid as
    // milestones / daily_logs. assignedToOrganizationId is workflow
    // routing only; ownership is the project's contractor org or any
    // active POM. See docs/specs/rls_sprint_plan.md §4.
    tenantIsolation: pgPolicy("rfis_tenant_isolation", {
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

export const rfiResponses = pgTable(
  "rfi_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfiId: uuid("rfi_id")
      .notNull()
      .references(() => rfis.id, { onDelete: "cascade" }),
    respondedByUserId: uuid("responded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    attachedDocumentId: uuid("attached_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    isOfficialResponse: boolean("is_official_response").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rfiIdx: index("rfi_responses_rfi_idx").on(table.rfiId),
    responderIdx: index("rfi_responses_responder_idx").on(table.respondedByUserId),
    // Phase 4 wave 4 nested — nested-via-parent on rfis. The parent's
    // policy already encodes the project-scoped 2-clause hybrid; we
    // just gate on rfi_id IN (SELECT id FROM rfis).
    tenantIsolation: pgPolicy("rfi_responses_tenant_isolation", {
      for: "all",
      using: sql`${table.rfiId} IN (SELECT id FROM rfis)`,
      withCheck: sql`${table.rfiId} IN (SELECT id FROM rfis)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// Change orders
// -----------------------------------------------------------------------------

export const changeOrders = pgTable(
  "change_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    changeOrderNumber: integer("change_order_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    changeOrderStatus: changeOrderStatusEnum("change_order_status").default("draft").notNull(),

    amountCents: integer("amount_cents").notNull().default(0),
    scheduleImpactDays: integer("schedule_impact_days").notNull().default(0),

    reason: text("reason"),
    originatingRfiId: uuid("originating_rfi_id").references((): AnyPgColumn => rfis.id, {
      onDelete: "set null",
    }),

    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    visibilityScope: varchar("visibility_scope", { length: 60 }).default("client_visible").notNull(),

    ...timestamps,
  },
  (table) => ({
    projectNumberUnique: unique("change_orders_project_number_unique").on(
      table.projectId,
      table.changeOrderNumber,
    ),
    projectIdx: index("change_orders_project_idx").on(table.projectId),
    statusIdx: index("change_orders_status_idx").on(table.changeOrderStatus),
    // Phase 4 wave 4 — same project-scoped 2-clause hybrid as rfis.
    // CO has no organization_id; ownership is the project's contractor
    // org or any active POM (lets the client org see/decision their own
    // CO requests via the same policy).
    tenantIsolation: pgPolicy("change_orders_tenant_isolation", {
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
// Approvals (cross-type approval queue)
// -----------------------------------------------------------------------------

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    approvalNumber: integer("approval_number").notNull(),
    category: approvalCategoryEnum("category").default("general").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    approvalStatus: approvalStatusEnum("approval_status").default("draft").notNull(),

    impactCostCents: integer("impact_cost_cents").notNull().default(0),
    impactScheduleDays: integer("impact_schedule_days").notNull().default(0),

    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedToOrganizationId: uuid("assigned_to_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),

    relatedObjectType: varchar("related_object_type", { length: 120 }),
    relatedObjectId: uuid("related_object_id"),

    visibilityScope: varchar("visibility_scope", { length: 60 })
      .default("client_visible")
      .notNull(),

    ...timestamps,
  },
  (table) => ({
    projectNumberUnique: unique("approvals_project_number_unique").on(
      table.projectId,
      table.approvalNumber,
    ),
    projectIdx: index("approvals_project_idx").on(table.projectId),
    statusIdx: index("approvals_status_idx").on(table.approvalStatus),
    // RLS Slice A bucket 3 — project-scoped 2-clause hybrid (same template
    // as rfis / change_orders / upload_requests). Approvals queue is
    // visible to the project's contractor + any active-POM org (clients
    // decision their own approvals via clause B).
    tenantIsolation: pgPolicy("approvals_tenant_isolation", {
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
