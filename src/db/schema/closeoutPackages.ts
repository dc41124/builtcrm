import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { timestamps } from "./_shared";
import { documents } from "./documents";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const closeoutPackageStatusEnum = pgEnum("closeout_package_status", [
  "building",
  "review",
  "delivered",
  "accepted",
]);

export const closeoutSectionTypeEnum = pgEnum("closeout_section_type", [
  "om_manuals",
  "warranties",
  "as_builts",
  "permits_final",
  "testing_certificates",
  "cad_files",
  "other",
]);

export const closeoutCommentScopeEnum = pgEnum("closeout_comment_scope", [
  "package",
  "section",
  "item",
]);

// -----------------------------------------------------------------------------
// closeout_counters — per-contractor-org, per-year sequence pool.
//
// Real GCs file closeouts in yearly binders. A single contractor typically
// has many projects in-flight, so the sequence must be org-scoped (not
// project-scoped — each project has at most a handful of packages over
// its lifetime) and year-scoped (counters reset Jan 1 so the filing
// matches the binder year).
//
// Allocation is atomic: the create-package action does `UPDATE ... SET
// last_seq = last_seq + 1 RETURNING last_seq` inside the same txn as the
// insert into closeout_packages. SELECT MAX loses under concurrent creates.
// If no row exists yet for (orgId, year) the action inserts one with
// last_seq = 1 and uses 1.
//
// RLS Phase 3 — Pattern A. Single call site (`allocateCloseoutSequence`
// in src/lib/closeout-packages/counter.ts) runs inside the caller's
// transaction; the create-package route now wraps that transaction in
// `withTenant(orgId, ...)` so the GUC is set before the UPDATE/INSERT.
// See docs/specs/rls_sprint_plan.md and the organization_licenses
// precedent in identity.ts.
// -----------------------------------------------------------------------------

export const closeoutCounters = pgTable(
  "closeout_counters",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceYear: integer("sequence_year").notNull(),
    lastSeq: integer("last_seq").default(0).notNull(),
    ...timestamps,
  },
  (table) => ({
    pk: unique("closeout_counters_org_year_unique").on(
      table.organizationId,
      table.sequenceYear,
    ),
    tenantIsolation: pgPolicy("closeout_counters_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// closeout_packages — structured handover deliverable for a project.
//
// Distinct from Transmittals (multi-recipient tokenized send). A closeout
// package binds to a single project, has one owner-recipient (derived
// from project membership), a fixed set of section types, and a sign-off
// contract. On accept: project.project_status flips to 'closed' and
// actual_completion_date is set.
//
// State machine (enforced in action layer):
//   building  → review       (contractor internal QA)
//   review    → delivered    (sent to client)
//   review    → building     (back-edit — audit-logged)
//   delivered → accepted     (client sign-off)
//   delivered → review       (contractor pulls back — audit-logged)
//
// Numbering: (sequence_year, sequence_number) — allocated at CREATE, not
// at deliver, because the contractor needs a stable reference during
// assembly. Display label is "CO-{sequence_year}-{sequence_number 4-digit
// padded}". Uniqueness is (organization_id, sequence_year, sequence_number)
// via closeout_counters.
//
// organization_id is denormalized from projects.contractor_organization_id
// so the unique constraint is a cheap btree lookup. Only the contractor
// org that owns the project can create a package on it — checked in the
// action layer.
// -----------------------------------------------------------------------------

// RLS Phase 3c — Pattern A. Routes follow the entry-point lookup
// pattern: dbAdmin reads the head row (pre-context, since the route
// only has the package id) to derive head.organizationId, then
// withTenant(head.organizationId, ...) wraps the mutation. The
// loader, the create route (api/closeout-packages POST already
// converted in the closeoutCounters slice), and the sub-resource
// routes (sections/items/comments) all share this shape.
export const closeoutPackages = pgTable(
  "closeout_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Assigned at CREATE. Together with organizationId + sequenceYear these
    // form the unique key. Never null.
    sequenceYear: integer("sequence_year").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    status: closeoutPackageStatusEnum("status").default("building").notNull(),
    preparedByUserId: uuid("prepared_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveredByUserId: uuid("delivered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Typed signer name captured at click-wrap time — archived literally
    // because the user's display name may change later.
    acceptedSigner: varchar("accepted_signer", { length: 160 }),
    acceptanceNote: text("acceptance_note"),
    ...timestamps,
  },
  (table) => ({
    orgYearSeqUnique: unique("closeout_packages_org_year_seq_unique").on(
      table.organizationId,
      table.sequenceYear,
      table.sequenceNumber,
    ),
    projectStatusIdx: index("closeout_packages_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    deliveredAtIdx: index("closeout_packages_delivered_at_idx").on(
      table.deliveredAt,
    ),
    tenantIsolation: pgPolicy("closeout_packages_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// closeout_package_sections — buckets inside a package. Fixed section
// types + 'other' (custom label). Fixed types are unique-per-package;
// 'other' can repeat with distinct custom labels.
// -----------------------------------------------------------------------------

export const closeoutPackageSections = pgTable(
  "closeout_package_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => closeoutPackages.id, { onDelete: "cascade" }),
    sectionType: closeoutSectionTypeEnum("section_type").notNull(),
    // Populated when sectionType = 'other'; optional rename for fixed
    // types (the UI allows it for the 'other' case today).
    customLabel: varchar("custom_label", { length: 120 }),
    orderIndex: integer("order_index").default(0).notNull(),
    ...timestamps,
  },
  (table) => ({
    packageOrderIdx: index("closeout_package_sections_package_order_idx").on(
      table.packageId,
      table.orderIndex,
    ),
    // Fixed section types unique per package; 'other' exempt so custom
    // sections can repeat. Partial index — rows with section_type = 'other'
    // don't participate in the uniqueness check.
    fixedTypeUnique: uniqueIndex("closeout_package_sections_fixed_type_unique")
      .on(table.packageId, table.sectionType)
      .where(sql`${table.sectionType} <> 'other'`),
  }),
);

// -----------------------------------------------------------------------------
// closeout_package_items — a document pinned into a section with
// contractor notes. Duplicate protection at the DB level.
//
// FK naming: the auto-name for section_id would be
// "closeout_package_items_section_id_closeout_package_sections_id_fk"
// (66 chars) which exceeds Postgres' 63-char identifier limit and gets
// silently truncated, producing permanent drizzle-kit drift. Declared
// explicitly here with a short stable name, per CLAUDE.md.
// -----------------------------------------------------------------------------

export const closeoutPackageItems = pgTable(
  "closeout_package_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id").notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    notes: text("notes"),
    sortOrder: integer("sort_order").default(0).notNull(),
    attachedByUserId: uuid("attached_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sectionOrderIdx: index("closeout_package_items_section_order_idx").on(
      table.sectionId,
      table.sortOrder,
    ),
    sectionDocUnique: unique("closeout_package_items_section_doc_unique").on(
      table.sectionId,
      table.documentId,
    ),
    // Explicit short-form name — auto-name is 66 chars.
    sectionFk: foreignKey({
      columns: [table.sectionId],
      foreignColumns: [closeoutPackageSections.id],
      name: "closeout_package_items_section_id_fk",
    }).onDelete("cascade"),
  }),
);

// -----------------------------------------------------------------------------
// closeout_package_comments — scoped comment threads on a delivered
// package. Client-authored during review, kept on record after accept.
// V1: write path is the client portal only (the contractor does not
// reply via this surface; they respond via messages/email). If that
// changes, add a separate event ID rather than quietly broadening
// closeout_package_commented — users who silenced it would be surprised.
//
// scope='package' → section_id NULL, item_id NULL
// scope='section' → section_id NOT NULL, item_id NULL
// scope='item'    → section_id NOT NULL, item_id NOT NULL
// Check constraint enforces the shape.
//
// FK naming: section_id auto-name exceeds 63 chars — declared explicitly.
// -----------------------------------------------------------------------------

export const closeoutPackageComments = pgTable(
  "closeout_package_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => closeoutPackages.id, { onDelete: "cascade" }),
    scope: closeoutCommentScopeEnum("scope").notNull(),
    sectionId: uuid("section_id"),
    itemId: uuid("item_id").references(() => closeoutPackageItems.id, {
      onDelete: "cascade",
    }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    packageCreatedIdx: index(
      "closeout_package_comments_package_created_idx",
    ).on(table.packageId, table.createdAt),
    itemIdx: index("closeout_package_comments_item_idx").on(table.itemId),
    sectionIdx: index("closeout_package_comments_section_idx").on(
      table.sectionId,
    ),
    scopeShape: check(
      "closeout_package_comments_scope_shape",
      sql`(
        (${table.scope} = 'package' AND ${table.sectionId} IS NULL AND ${table.itemId} IS NULL)
        OR (${table.scope} = 'section' AND ${table.sectionId} IS NOT NULL AND ${table.itemId} IS NULL)
        OR (${table.scope} = 'item' AND ${table.sectionId} IS NOT NULL AND ${table.itemId} IS NOT NULL)
      )`,
    ),
    // Explicit short-form name — auto-name exceeds 63 chars.
    sectionFk: foreignKey({
      columns: [table.sectionId],
      foreignColumns: [closeoutPackageSections.id],
      name: "closeout_package_comments_section_id_fk",
    }).onDelete("cascade"),
  }),
);
