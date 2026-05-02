import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { retention, timestamps } from "./_shared";
import { documents } from "./documents";
import { organizations, users } from "./identity";
import { inspectionResults, inspections } from "./inspections";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const punchItemPriorityEnum = pgEnum("punch_item_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const punchItemStatusEnum = pgEnum("punch_item_status", [
  "open",
  "in_progress",
  "ready_to_verify",
  "verified",
  "rejected",
  "void",
]);

// -----------------------------------------------------------------------------
// punch_items — one row per walkthrough/closeout item.
//
// Sequential number per project (PI-001, PI-002, ...) via the unique
// index on (projectId, sequentialNumber); the action layer computes
// `max(sequentialNumber) + 1` inside the create transaction.
//
// State machine enforced in the action layer, NOT by triggers:
//   open → in_progress → ready_to_verify → verified (terminal)
//                              │
//                              └─→ rejected → in_progress
//   any non-terminal → void (with reason)
//
// `rejectionReason` auto-clears on `rejected → in_progress` so the next
// cycle starts clean. `voidReason` is terminal — once void, item stays
// void.
//
// `clientFacingNote` is the contractor-authored, homeowner-visible
// commentary on the item. Separate from the internal comment thread
// so GCs can curate what residential clients see without sanitizing
// the raw coordination chat.
// -----------------------------------------------------------------------------

export const punchItems = pgTable(
  "punch_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequentialNumber: integer("sequential_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    // Free-text location. Drawing-coord attach is Phase 6 scope.
    location: text("location"),
    priority: punchItemPriorityEnum("priority").default("normal").notNull(),
    status: punchItemStatusEnum("status").default("open").notNull(),
    assigneeOrgId: uuid("assignee_org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Populated when status → 'rejected'; action layer clears it when
    // the item transitions back to 'in_progress' so the next review
    // cycle starts without stale text.
    rejectionReason: text("rejection_reason"),
    // Populated when status → 'void'. Terminal; never cleared.
    voidReason: text("void_reason"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // Stamped by the action layer on every status transition. Drives
    // the "age / time-in-status" readouts and SLA calculations without
    // a separate history join.
    lastTransitionAt: timestamp("last_transition_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Homeowner-visible blurb curated by the contractor. Separate
    // field (not a derived comment) so GCs can edit independently of
    // the internal thread.
    clientFacingNote: text("client_facing_note"),
    // When a punch item is auto-created by completing an inspection
    // (Step 45), these pin it back to the originating inspection
    // and the specific line-item result that failed. Both NULL for
    // manually-created items. `set null` on delete so historical
    // punch items survive if the parent inspection is cleaned up,
    // but lose their origin pointer.
    sourceInspectionId: uuid("source_inspection_id").references(
      () => inspections.id,
      { onDelete: "set null" },
    ),
    sourceInspectionResultId: uuid("source_inspection_result_id"),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    projectNumberUnique: unique("punch_items_project_number_unique").on(
      table.projectId,
      table.sequentialNumber,
    ),
    projectStatusPriorityIdx: index(
      "punch_items_project_status_priority_idx",
    ).on(table.projectId, table.status, table.priority),
    assigneeStatusIdx: index("punch_items_assignee_status_idx").on(
      table.assigneeOrgId,
      table.status,
    ),
    sourceInspectionIdx: index("punch_items_source_inspection_idx").on(
      table.sourceInspectionId,
    ),
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    sourceInspectionResultFk: foreignKey({
      columns: [table.sourceInspectionResultId],
      foreignColumns: [inspectionResults.id],
      name: "punch_items_source_inspection_result_id_fk",
    }).onDelete("set null"),
    tenantIsolation: pgPolicy("punch_items_tenant_isolation", {
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
// punch_item_photos — mirrors daily_log_photos minus the `isHero`
// flag (punch items don't need a featured photo). Same R2 presign →
// finalize → link flow reused verbatim.
// -----------------------------------------------------------------------------

export const punchItemPhotos = pgTable(
  "punch_item_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    punchItemId: uuid("punch_item_id")
      .notNull()
      .references(() => punchItems.id, { onDelete: "cascade" }),
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
    itemIdx: index("punch_item_photos_item_idx").on(table.punchItemId),
    tenantIsolation: pgPolicy("punch_item_photos_tenant_isolation", {
      for: "all",
      using: sql`${table.punchItemId} IN (SELECT id FROM punch_items)`,
      withCheck: sql`${table.punchItemId} IN (SELECT id FROM punch_items)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// punch_item_comments — coordination thread + auto-posted system
// entries on every state transition. The `isSystem` flag separates
// them at query time. Author FK is nullable because system entries
// don't have a user record tied to them (the actor's name is baked
// into the body text per the locked phrasing in the handoff doc).
// -----------------------------------------------------------------------------

export const punchItemComments = pgTable(
  "punch_item_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    punchItemId: uuid("punch_item_id")
      .notNull()
      .references(() => punchItems.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...retention("project_record"),
  },
  (table) => ({
    itemIdx: index("punch_item_comments_item_idx").on(table.punchItemId),
    tenantIsolation: pgPolicy("punch_item_comments_tenant_isolation", {
      for: "all",
      using: sql`${table.punchItemId} IN (SELECT id FROM punch_items)`,
      withCheck: sql`${table.punchItemId} IN (SELECT id FROM punch_items)`,
    }),
  }),
).enableRLS();
