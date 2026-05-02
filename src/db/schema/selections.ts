import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { retention, timestamps } from "./_shared";
import { users } from "./identity";
import { projects } from "./projects";
import { documents } from "./documents";

export const selectionItemStatusEnum = pgEnum("selection_item_status", [
  "not_started",
  "exploring",
  "provisional",
  "confirmed",
  "revision_open",
  "locked",
]);

export const selectionOptionTierEnum = pgEnum("selection_option_tier", [
  "included",
  "upgrade",
  "premium_upgrade",
]);

export const selectionCategories = pgTable(
  "selection_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    projectIdx: index("selection_categories_project_idx").on(table.projectId),
    tenantIsolation: pgPolicy("selection_categories_tenant_isolation", {
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

export const selectionItems = pgTable(
  "selection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => selectionCategories.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    selectionItemStatus: selectionItemStatusEnum("selection_item_status")
      .default("not_started")
      .notNull(),
    allowanceCents: integer("allowance_cents").default(0).notNull(),
    decisionDeadline: timestamp("decision_deadline", { withTimezone: true }),
    urgencyNote: text("urgency_note"),
    affectsSchedule: boolean("affects_schedule").default(false).notNull(),
    scheduleImpactNote: text("schedule_impact_note"),
    recommendedOptionId: uuid("recommended_option_id").references(
      (): AnyPgColumn => selectionOptions.id,
      { onDelete: "set null" },
    ),
    revisionWindowHours: integer("revision_window_hours").default(48).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedByUserId: uuid("published_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    categoryIdx: index("selection_items_category_idx").on(table.categoryId),
    projectIdx: index("selection_items_project_idx").on(table.projectId),
    statusIdx: index("selection_items_status_idx").on(table.selectionItemStatus),
    tenantIsolation: pgPolicy("selection_items_tenant_isolation", {
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

export const selectionOptions = pgTable(
  "selection_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    selectionItemId: uuid("selection_item_id")
      .notNull()
      .references(() => selectionItems.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    optionTier: selectionOptionTierEnum("option_tier").default("included").notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    leadTimeDays: integer("lead_time_days"),
    additionalScheduleDays: integer("additional_schedule_days"),
    imageDocumentId: uuid("image_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    swatchColor: varchar("swatch_color", { length: 7 }),
    specDocumentId: uuid("spec_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    supplierName: varchar("supplier_name", { length: 255 }),
    productSku: varchar("product_sku", { length: 120 }),
    productUrl: text("product_url"),
    tags: jsonb("tags").$type<string[]>(),
    isAvailable: boolean("is_available").default(true).notNull(),
    unavailableReason: text("unavailable_reason"),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    selectionItemIdx: index("selection_options_item_idx").on(table.selectionItemId),
    tenantIsolation: pgPolicy("selection_options_tenant_isolation", {
      for: "all",
      using: sql`${table.selectionItemId} IN (SELECT id FROM selection_items)`,
      withCheck: sql`${table.selectionItemId} IN (SELECT id FROM selection_items)`,
    }),
  }),
).enableRLS();

export const selectionDecisions = pgTable(
  "selection_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    selectionItemId: uuid("selection_item_id")
      .notNull()
      .references(() => selectionItems.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id")
      .notNull()
      .references(() => selectionOptions.id, { onDelete: "restrict" }),
    decidedByUserId: uuid("decided_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isProvisional: boolean("is_provisional").default(true).notNull(),
    isConfirmed: boolean("is_confirmed").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    revisionExpiresAt: timestamp("revision_expires_at", { withTimezone: true }),
    previousOptionId: uuid("previous_option_id").references(() => selectionOptions.id, {
      onDelete: "set null",
    }),
    revisionNote: text("revision_note"),
    priceDeltaCents: integer("price_delta_cents").default(0).notNull(),
    scheduleDeltaDays: integer("schedule_delta_days").default(0).notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    selectionItemIdx: index("selection_decisions_item_idx").on(table.selectionItemId),
    projectIdx: index("selection_decisions_project_idx").on(table.projectId),
    optionIdx: index("selection_decisions_option_idx").on(table.selectedOptionId),
    tenantIsolation: pgPolicy("selection_decisions_tenant_isolation", {
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
