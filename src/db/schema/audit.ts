import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { retention } from "./_shared";
import { organizations, users } from "./identity";
import { projects, visibilityScopeEnum } from "./projects";

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

export const activityFeedItems = pgTable(
  "activity_feed_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    activityType: activityTypeEnum("activity_type").notNull(),
    surfaceType: surfaceTypeEnum("surface_type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    relatedObjectType: varchar("related_object_type", { length: 120 }),
    relatedObjectId: uuid("related_object_id"),
    visibilityScope: visibilityScopeEnum("visibility_scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    ...retention("operational"),
  },
  (table) => ({
    projectIdx: index("activity_feed_items_project_idx").on(table.projectId),
    activityIdx: index("activity_feed_items_activity_idx").on(table.activityType),
    actorIdx: index("activity_feed_items_actor_idx").on(table.actorUserId),
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
    // Tier = operational (not statutory_construction) by deliberate
    // decision: audit_events is the denormalized event log, not the
    // regulatory record. Source rows (change_orders, lien_waivers,
    // time_entries, payment_transactions, etc.) carry the 7-year
    // statutory_construction floor on their own. See
    // docs/specs/security_posture.md §6 for the original 90-day
    // retention rationale.
    ...retention("operational"),
  },
  (table) => ({
    actorIdx: index("audit_events_actor_idx").on(table.actorUserId),
    projectIdx: index("audit_events_project_idx").on(table.projectId),
    objectIdx: index("audit_events_object_idx").on(table.objectType, table.objectId),
  }),
);
