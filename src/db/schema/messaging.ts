import {
  boolean,
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
import { timestamps } from "./_shared";
import { users } from "./identity";
import { projects } from "./projects";
import { documents } from "./documents";

export const conversationTypeEnum = pgEnum("conversation_type", [
  "project_general",
  "rfi_thread",
  "change_order_thread",
  "approval_thread",
  "direct",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    conversationType: conversationTypeEnum("conversation_type").default("project_general").notNull(),
    linkedObjectType: varchar("linked_object_type", { length: 120 }),
    linkedObjectId: uuid("linked_object_id"),
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
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    attachedDocumentId: uuid("attached_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    isSystemMessage: boolean("is_system_message").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversationId),
    senderIdx: index("messages_sender_idx").on(table.senderUserId),
    createdIdx: index("messages_created_idx").on(table.createdAt),
    attachedDocumentIdx: index("messages_attached_document_idx").on(
      table.attachedDocumentId,
    ),
  }),
);
