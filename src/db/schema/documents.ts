import {
  bigint,
  boolean,
  index,
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
import { audienceScopeEnum, projects, visibilityScopeEnum } from "./projects";

export const documentStatusEnum = pgEnum("document_status", [
  "active",
  "pending_review",
  "superseded",
  "archived",
]);

// Document category. Taxonomy locked in Step 21 (4B.4 #21). Order is
// "misc at the bottom" — `other` is the final value so iterating the enum
// into a dropdown produces sensible UX. `submittal` stays singular to
// match the pre-existing Step 20 value.
export const documentCategoryEnum = pgEnum("document_category", [
  "drawings",
  "specifications",
  "submittal",
  "contracts",
  "photos",
  "permits",
  "compliance",
  "billing_backup",
  "other",
]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 120 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    visibilityScope: visibilityScopeEnum("visibility_scope").notNull(),
    audienceScope: audienceScopeEnum("audience_scope").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    documentStatus: documentStatusEnum("document_status").default("active").notNull(),
    category: documentCategoryEnum("category").default("other").notNull(),
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
