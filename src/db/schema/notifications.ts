import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditEvents } from "./audit";
import { notificationPortalEnum, users } from "./identity";
import { projects } from "./projects";

// Per-user in-app notification inbox. Written synchronously at emission
// time (see src/lib/notifications/emit.ts) with portal-specific copy
// already baked in — e.g. a residential client's row for a CO says
// "Scope Change #4" while the contractor's row says "Change Order #4",
// so the reader can render the row as-is without portal-aware transforms.
//
// TODO(retention): notifications grow unbounded. Add a nightly
// Trigger.dev v3 job to delete rows where read_at IS NOT NULL AND
// read_at < now() - interval '90 days'. Not a problem at portfolio scale.
//
// Dedup: the emit helper tolerates rare duplicates (double-fires on
// state transition retries). A partial unique index on
// (event_id, related_object_type, related_object_id, recipient_user_id)
// with a time-window predicate isn't feasible in Postgres (index
// predicates must be immutable), and a strict unique constraint would
// reject legitimate re-notifications (e.g. a CO resubmitted after
// revision should notify again). Leaving as tolerate + monitor.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    portalType: notificationPortalEnum("portal_type").notNull(),
    // Event id from src/lib/notification-catalog.ts — validated at emit
    // time against the catalog for the recipient's portal. Stored as
    // varchar (not enum) because PG enum evolution is painful and the
    // catalog is source-controlled in TS.
    eventId: varchar("event_id", { length: 120 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    linkUrl: varchar("link_url", { length: 500 }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    relatedObjectType: varchar("related_object_type", { length: 120 }),
    relatedObjectId: uuid("related_object_id"),
    // Traceability: every emission links back to the audit_events row
    // that triggered it. Nullable because some notifications (digests,
    // reminders) originate outside the audit stream.
    sourceAuditEventId: uuid("source_audit_event_id").references(
      () => auditEvents.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    // Primary access pattern: "unread for this user" drives the bell badge
    // and the default dropdown filter. Partial-equivalent via (user, readAt)
    // lets PG use the index for both `readAt IS NULL` scans and full history.
    recipientUnreadIdx: index("notifications_recipient_unread_idx").on(
      table.recipientUserId,
      table.readAt,
    ),
    // Secondary: chronological history for the persistent page.
    recipientCreatedIdx: index("notifications_recipient_created_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
    // For per-project filtering (sidebar badges, persistent page filter).
    projectIdx: index("notifications_project_idx").on(table.projectId),
  }),
);
