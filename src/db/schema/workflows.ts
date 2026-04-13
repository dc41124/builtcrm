import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
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
// Compliance
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
    orgIdx: index("compliance_records_org_idx").on(table.organizationId),
    projectIdx: index("compliance_records_project_idx").on(table.projectId),
    statusIdx: index("compliance_records_status_idx").on(table.complianceStatus),
  }),
);

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
  }),
);

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
  }),
);

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
  }),
);
