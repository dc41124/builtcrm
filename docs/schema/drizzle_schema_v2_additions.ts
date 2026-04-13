import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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
 * Schema V2 Additions
 *
 * This file contains the new tables and modifications identified during the
 * dashboard schema validation pass. It builds on the first-pass schema and
 * adds the workflow tables needed for the contractor dashboard and subsequent
 * page designs.
 *
 * New tables:
 * - rfis + rfi_responses (RFI workflow)
 * - change_orders (change order tracking)
 * - milestones (schedule/milestone tracking)
 * - conversations + messages (project-scoped messaging)
 *
 * Modifications to existing tables:
 * - projects: add contract_value_cents, address fields
 * - activity_feed_items: add actor_user_id
 *
 * Amounts are stored as integers in cents to avoid floating-point precision
 * issues. For display, divide by 100. This supports values up to ~$21.4M
 * which covers the SMB target market. If needed for larger commercial
 * projects, migrate to bigint.
 */

// =============================================================================
// References to existing tables (imported from first-pass schema in production)
// Shown here as stubs for clarity — in the real codebase these would be imports.
// =============================================================================

// import { users, organizations, projects, documents } from "./schema_first_pass";

// =============================================================================
// New Enums
// =============================================================================

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

export const conversationTypeEnum = pgEnum("conversation_type", [
  "project_general",
  "rfi_thread",
  "change_order_thread",
  "approval_thread",
  "direct",
]);

// =============================================================================
// Shared columns (duplicated from first pass for file self-containment)
// =============================================================================

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// =============================================================================
// MODIFICATION: projects table additions
//
// These columns should be added to the existing projects table.
// In migration: ALTER TABLE projects ADD COLUMN ...
//
// New columns:
//   contract_value_cents  INTEGER   — total contract value in cents
//   address_line_1        VARCHAR   — project site address
//   address_line_2        VARCHAR
//   city                  VARCHAR
//   state_province        VARCHAR
//   postal_code           VARCHAR
//   country               VARCHAR   — default 'CA'
// =============================================================================

/**
 * Example of what the updated projects table would look like with new columns.
 * In practice, add these via ALTER TABLE migration, not a new table definition.
 */
// projects additions:
//   contractValueCents: integer("contract_value_cents"),
//   addressLine1: varchar("address_line_1", { length: 255 }),
//   addressLine2: varchar("address_line_2", { length: 255 }),
//   city: varchar("city", { length: 120 }),
//   stateProvince: varchar("state_province", { length: 120 }),
//   postalCode: varchar("postal_code", { length: 20 }),
//   country: varchar("country", { length: 3 }).default("CA"),

// =============================================================================
// MODIFICATION: activity_feed_items — add actor_user_id
//
// New column:
//   actor_user_id  UUID  REFERENCES users(id) ON DELETE SET NULL
//
// This allows the activity feed to show "Daniel Chen · 45 min ago" by
// referencing the user who triggered the activity.
// =============================================================================

// activity_feed_items addition:
//   actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),

// =============================================================================
// RFIs
//
// Sequential numbering per project (e.g., RFI-001, RFI-002).
// Thread-based: an RFI can have multiple responses before being closed.
// Can be linked to change orders when an RFI triggers a scope change.
//
// Dashboard references:
//   KPI: "6 open, 2 overdue" → WHERE rfi_status IN ('open','pending_response') AND due_at < now()
//   Activity: "RFI-012 response overdue" → WHERE rfi_status='open' AND due_at < now()
// =============================================================================

export const rfis = pgTable(
  "rfis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),
    sequentialNumber: integer("sequential_number").notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body"),
    rfiStatus: rfiStatusEnum("rfi_status").default("draft").notNull(),

    // Assignment
    createdByUserId: uuid("created_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),
    assignedToUserId: uuid("assigned_to_user_id"),
      // .references(() => users.id, { onDelete: "set null" }),
    assignedToOrganizationId: uuid("assigned_to_organization_id"),
      // .references(() => organizations.id, { onDelete: "set null" }),

    // Timing
    dueAt: timestamp("due_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    // Linkages
    /**
     * If this RFI results in a scope change, link it to the resulting change order.
     * This allows traceability: RFI → CO → SOV adjustment → billing impact.
     */
    resultingChangeOrderId: uuid("resulting_change_order_id"),

    // Scoping
    visibilityScope: varchar("visibility_scope", { length: 60 }).default("project_wide").notNull(),

    // Drawing/spec reference
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
    rfiId: uuid("rfi_id").notNull(),
      // .references(() => rfis.id, { onDelete: "cascade" }),
    respondedByUserId: uuid("responded_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    /**
     * If the response includes a document (drawing markup, spec clarification),
     * link it here. The document itself lives in the documents table.
     */
    attachedDocumentId: uuid("attached_document_id"),
      // .references(() => documents.id, { onDelete: "set null" }),
    isOfficialResponse: boolean("is_official_response").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rfiIdx: index("rfi_responses_rfi_idx").on(table.rfiId),
    responderIdx: index("rfi_responses_responder_idx").on(table.respondedByUserId),
  }),
);

// =============================================================================
// Change Orders
//
// Numbered per project (CO-001, CO-002).
// Tracks amount impact (add/deduct from contract).
// Approval chain: draft → pending_review → pending_client_approval → approved.
// When approved, adjusts the schedule of values for billing.
//
// Dashboard references:
//   Priorities: "Resolve CO-14 client approval block"
//   Approvals: "CO-14 owner signoff — Blocked"
// =============================================================================

export const changeOrders = pgTable(
  "change_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),
    changeOrderNumber: integer("change_order_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    changeOrderStatus: changeOrderStatusEnum("change_order_status").default("draft").notNull(),

    // Financial impact — stored in cents
    /**
     * Positive = addition to contract, negative = deduction.
     * Net change to contract value when approved.
     */
    amountCents: integer("amount_cents").notNull().default(0),

    // Reasoning
    reason: text("reason"),
    /**
     * If this CO originated from an RFI, link it for traceability.
     */
    originatingRfiId: uuid("originating_rfi_id"),

    // Approval tracking
    requestedByUserId: uuid("requested_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: uuid("approved_by_user_id"),
      // .references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    // Timing
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

// =============================================================================
// Milestones
//
// Project schedule milestones — inspections, deadlines, walkthroughs, etc.
// These drive the "Upcoming this week" dashboard card and the project
// completion percentage (completedCount / totalCount).
//
// Dashboard references:
//   Upcoming this week: WHERE scheduled_date BETWEEN now() AND now()+7d
//   Project health %: COUNT(completed) / COUNT(all) per project
// =============================================================================

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    milestoneType: milestoneTypeEnum("milestone_type").default("custom").notNull(),
    milestoneStatus: milestoneStatusEnum("milestone_status").default("scheduled").notNull(),

    // Timing
    scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
    completedDate: timestamp("completed_date", { withTimezone: true }),

    // Phase association — ties milestone to project phase for grouping
    phase: varchar("phase", { length: 60 }),

    // Assignment — who is responsible for this milestone
    assignedToUserId: uuid("assigned_to_user_id"),
      // .references(() => users.id, { onDelete: "set null" }),
    assignedToOrganizationId: uuid("assigned_to_organization_id"),
      // .references(() => organizations.id, { onDelete: "set null" }),

    // Display
    /**
     * Order within a phase or date group for manual sorting.
     */
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

// =============================================================================
// Conversations + Messages
//
// Project-scoped messaging. Conversations can be general, or linked to a
// specific workflow object (RFI thread, CO discussion, approval discussion).
//
// Dashboard references:
//   Recent messages: conversations JOIN messages ORDER BY last_message_at DESC
//   Badge count: messages WHERE read_at IS NULL AND recipient includes current user
// =============================================================================

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    conversationType: conversationTypeEnum("conversation_type").default("project_general").notNull(),

    /**
     * If conversation is linked to a workflow object (RFI, CO, approval),
     * store the reference here. Allows navigation from message → source object.
     */
    linkedObjectType: varchar("linked_object_type", { length: 120 }),
    linkedObjectId: uuid("linked_object_id"),

    // Denormalized for efficient dashboard queries
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: varchar("last_message_preview", { length: 255 }),
    messageCount: integer("message_count").default(0).notNull(),

    visibilityScope: varchar("visibility_scope", { length: 60 }).default("project_wide").notNull(),

    ...timestamps,
  },
  (table) => ({
    projectIdx: index("conversations_project_idx").on(table.projectId),
    lastMessageIdx: index("conversations_last_message_idx").on(table.lastMessageAt),
    linkedObjectIdx: index("conversations_linked_object_idx").on(
      table.linkedObjectType,
      table.linkedObjectId,
    ),
  }),
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
      // .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
      // .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Last time this participant read the conversation. Messages with
     * created_at > last_read_at are considered unread for badge counts.
     */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationUserUnique: unique("conversation_participants_conv_user_unique").on(
      table.conversationId,
      table.userId,
    ),
    conversationIdx: index("conversation_participants_conv_idx").on(table.conversationId),
    userIdx: index("conversation_participants_user_idx").on(table.userId),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
      // .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),

    /**
     * Optional document attachment. The file itself lives in the documents
     * table with proper visibility scoping.
     */
    attachedDocumentId: uuid("attached_document_id"),
      // .references(() => documents.id, { onDelete: "set null" }),

    /**
     * If this message was edited, track when. Original body is preserved
     * in audit_events if needed.
     */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    isSystemMessage: boolean("is_system_message").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversationId),
    senderIdx: index("messages_sender_idx").on(table.senderUserId),
    createdIdx: index("messages_created_idx").on(table.createdAt),
  }),
);

// =============================================================================
// Updated migration order (v2)
// =============================================================================

/**
 * Original tables (1-15 from first pass):
 *  1. enums (including new v2 enums)
 *  2. users
 *  3. organizations
 *  4. organization_users
 *  5. role_assignments
 *  6. projects (with new contract_value_cents, address columns)
 *  7. project_organization_memberships
 *  8. project_user_memberships
 *  9. documents
 * 10. document_links
 * 11. upload_requests
 * 12. billing_packages
 * 13. compliance_records
 * 14. activity_feed_items (with new actor_user_id)
 * 15. audit_events
 *
 * New v2 tables:
 * 16. rfis
 * 17. rfi_responses
 * 18. change_orders
 * 19. milestones
 * 20. conversations
 * 21. conversation_participants
 * 22. messages
 *
 * Phase 3 additions (billing depth — not yet defined):
 * 23. schedule_of_values
 * 24. sov_line_items
 * 25. draw_requests
 * 26. draw_line_items
 * 27. retainage_records
 * 28. lien_waivers
 */
