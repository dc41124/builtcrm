import {
  check,
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
import { sql } from "drizzle-orm";

import { timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const meetingTypeEnum = pgEnum("meeting_type", [
  "oac", // Owner-Architect-Contractor
  "preconstruction",
  "coordination", // subcontractor coordination
  "progress",
  "safety",
  "closeout",
  "internal",
]);

export const meetingStatusEnum = pgEnum("meeting_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const attendedStatusEnum = pgEnum("attended_status", [
  "invited",
  "accepted",
  "tentative",
  "declined",
  "attended",
  "absent",
]);

export const attendeeScopeEnum = pgEnum("attendee_scope", [
  "internal",
  "sub",
  "external",
]);

export const meetingActionItemStatusEnum = pgEnum(
  "meeting_action_item_status",
  ["open", "in_progress", "done"],
);

// -----------------------------------------------------------------------------
// meetings — one row per scheduled meeting on a project.
//
// Per-project sequence (MTG-0001, MTG-0002, …) via an atomic counter
// column on `projects` (projects.meeting_counter). The create action
// does `UPDATE projects SET meeting_counter = meeting_counter + 1
// RETURNING meeting_counter` inside the insert transaction, avoiding
// the SELECT MAX+1 race that two concurrent creates would lose.
//
// Carry-forward: when a new meeting is created, any open action items
// AND any un-covered agenda items from the most recent completed
// meeting of the SAME `type` on the project are copied forward. Both
// the agenda clone and the action-item clone stamp
// `carriedFromMeetingId` for the UI's "Carried forward" pills. Skip
// for `internal` meetings and when no prior same-type meeting exists.
//
// State machine (enforced in action layer):
//   scheduled → in_progress → completed
//   scheduled → cancelled
//   in_progress → cancelled
// Completion is terminal.
// -----------------------------------------------------------------------------

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequentialNumber: integer("sequential_number").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    type: meetingTypeEnum("type").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").default(60).notNull(),
    status: meetingStatusEnum("status").default("scheduled").notNull(),
    chairUserId: uuid("chair_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    cancelledReason: text("cancelled_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => ({
    projectNumberUnique: unique("meetings_project_number_unique").on(
      table.projectId,
      table.sequentialNumber,
    ),
    projectStatusIdx: index("meetings_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    projectTypeIdx: index("meetings_project_type_idx").on(
      table.projectId,
      table.type,
    ),
    scheduledIdx: index("meetings_scheduled_at_idx").on(table.scheduledAt),
    // Phase 4 wave 1 — same project-scoped multi-org template as
    // milestones (rls_sprint_plan.md §4.2 adapted to project-scoped).
    tenantIsolation: pgPolicy("meetings_tenant_isolation", {
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
// meeting_agenda_items — ordered list of topics for a meeting.
//
// `orderIndex` is dense-packed 1..N and re-normalized when rows are
// deleted or reordered. Drag-reorder in the UI sends the full list
// back to the server for a single UPDATE pass.
//
// `carriedFromMeetingId` is set when the row was copied forward from
// a prior same-type meeting that ended with un-covered agenda. The UI
// shows an amber "Carried forward" pill on these rows.
// -----------------------------------------------------------------------------

export const meetingAgendaItems = pgTable(
  "meeting_agenda_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    estimatedMinutes: integer("estimated_minutes").default(5).notNull(),
    carriedFromMeetingId: uuid("carried_from_meeting_id"),
    ...timestamps,
  },
  (table) => ({
    meetingOrderIdx: index("meeting_agenda_items_meeting_order_idx").on(
      table.meetingId,
      table.orderIndex,
    ),
    // Explicit short-form name: long-form auto-name would brush 63 chars.
    carriedFromFk: foreignKey({
      columns: [table.carriedFromMeetingId],
      foreignColumns: [meetings.id],
      name: "meeting_agenda_items_carried_from_meeting_id_fk",
    }).onDelete("set null"),
  }),
);

// -----------------------------------------------------------------------------
// meeting_attendees — one row per invitee.
//
// IDENTITY MODEL: a row always represents ONE human. Exactly one of
// `userId` (internal/invited platform user) or `email` (external
// invitee with no user record) must be populated — enforced by the
// CHECK below. `orgId` is always INFORMATIONAL CONTEXT, never identity:
// it records which company the attendee is showing up on behalf of in
// THIS meeting. The same person wearing two hats (e.g. a PM
// moonlighting as a consultant on a different project) is modeled as
// two separate rows if they're invited twice in two capacities.
// External invitees (email-populated) often have an `orgId` too —
// when we know which architecture firm they're with — but orgId is
// never used as the join key for membership or authorization.
//
// `isChair` is a denormalized flag for the chair of THIS meeting.
// The chair is the primary source of truth on `meetings.chairUserId`;
// `isChair` on the attendee row makes the UI query a single join.
// -----------------------------------------------------------------------------

export const meetingAttendees = pgTable(
  "meeting_attendees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 255 }),
    displayName: varchar("display_name", { length: 160 }),
    roleLabel: varchar("role_label", { length: 120 }),
    scope: attendeeScopeEnum("scope").notNull(),
    attendedStatus: attendedStatusEnum("attended_status")
      .default("invited")
      .notNull(),
    isChair: integer("is_chair").default(0).notNull(),
    declineReason: text("decline_reason"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    meetingIdx: index("meeting_attendees_meeting_idx").on(table.meetingId),
    userIdx: index("meeting_attendees_user_idx").on(table.userId),
    identityCheck: check(
      "meeting_attendees_identity_check",
      sql`(${table.userId} IS NOT NULL) <> (${table.email} IS NOT NULL)`,
    ),
  }),
);

// -----------------------------------------------------------------------------
// meeting_minutes — one row per meeting (unique(meetingId)).
//
// Written lazily: the row is created the first time someone edits the
// minutes, not at meeting creation. `finalizedAt IS NULL` means draft;
// non-null means published. Finalizing flips the row and fires the
// "minutes published" notification to all attendees. Re-finalize is
// blocked by the action layer.
//
// Phase 7.1 (Step 56) "Generate minutes from audio" writes into this
// same column via a Trigger.dev job that posts back when transcription
// + extraction complete. The button is wired for the pipeline but
// disabled with a tooltip until Step 56 lands.
// -----------------------------------------------------------------------------

export const meetingMinutes = pgTable(
  "meeting_minutes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .unique()
      .references(() => meetings.id, { onDelete: "cascade" }),
    content: text("content").default("").notNull(),
    draftedByUserId: uuid("drafted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedByUserId: uuid("finalized_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
);

// -----------------------------------------------------------------------------
// meeting_action_items — outcomes from the meeting assigned to a user.
//
// Column naming (`assignedUserId`, `assignedOrgId`, `dueDate`,
// `status`) is chosen to match what a future top-level `tasks` table
// would use, so a later consolidation into a unified tasks primitive
// is a view + backfill rather than a rename. Until that happens, the
// "My Actions" rail in the subcontractor portal queries this table
// directly: `WHERE assignedUserId = ? OR assignedOrgId IN (my
// memberships) AND status != 'done'`. Step 56 (Meeting Minutes AI)
// writes here too — same shape.
//
// `originAgendaItemId` links the action back to the agenda row it
// came from (nullable — action items can be added ad-hoc during a
// meeting). `carriedFromMeetingId` is set on carry-forward clones.
// -----------------------------------------------------------------------------

export const meetingActionItems = pgTable(
  "meeting_action_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedOrgId: uuid("assigned_org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    status: meetingActionItemStatusEnum("status").default("open").notNull(),
    originAgendaItemId: uuid("origin_agenda_item_id"),
    carriedFromMeetingId: uuid("carried_from_meeting_id"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => ({
    meetingIdx: index("meeting_action_items_meeting_idx").on(table.meetingId),
    assigneeStatusIdx: index("meeting_action_items_assignee_status_idx").on(
      table.assignedUserId,
      table.status,
    ),
    assigneeOrgStatusIdx: index(
      "meeting_action_items_assignee_org_status_idx",
    ).on(table.assignedOrgId, table.status),
    // Explicit short-form names: auto-names would exceed Postgres' 63-char
    // limit and get silently truncated (permanent drizzle-kit drift).
    originAgendaItemFk: foreignKey({
      columns: [table.originAgendaItemId],
      foreignColumns: [meetingAgendaItems.id],
      name: "meeting_action_items_origin_agenda_item_fk",
    }).onDelete("set null"),
    carriedFromFk: foreignKey({
      columns: [table.carriedFromMeetingId],
      foreignColumns: [meetings.id],
      name: "meeting_action_items_carried_from_meeting_fk",
    }).onDelete("set null"),
  }),
);
