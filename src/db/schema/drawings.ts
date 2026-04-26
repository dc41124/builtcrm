import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const drawingSetStatusEnum = pgEnum("drawing_set_status", [
  "current",
  "superseded",
  "historical",
]);

export const drawingSetProcessingStatusEnum = pgEnum(
  "drawing_set_processing_status",
  ["pending", "processing", "ready", "failed"],
);

export const drawingCalibrationSourceEnum = pgEnum(
  "drawing_calibration_source",
  ["title_block", "manual"],
);

// -----------------------------------------------------------------------------
// drawing_sets — a logical sheet package with a version. Sets within the same
// `family` chain via `supersedesId`; `status` marks which is current.
// `as_built` flags a set as the as-built record, feeding closeout (Step 48).
// -----------------------------------------------------------------------------

export const drawingSets = pgTable(
  "drawing_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    family: varchar("family", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    version: integer("version").notNull(),
    status: drawingSetStatusEnum("status").default("current").notNull(),
    asBuilt: boolean("as_built").default(false).notNull(),
    supersedesId: uuid("supersedes_id").references((): AnyPgColumn => drawingSets.id, {
      onDelete: "set null",
    }),
    sourceFileKey: text("source_file_key"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    sheetCount: integer("sheet_count").default(0).notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processingStatus: drawingSetProcessingStatusEnum("processing_status")
      .default("pending")
      .notNull(),
    processingError: text("processing_error"),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    projectIdx: index("drawing_sets_project_idx").on(table.projectId),
    projectStatusIdx: index("drawing_sets_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    familyIdx: index("drawing_sets_family_idx").on(
      table.projectId,
      table.family,
    ),
    familyVersionUnique: unique("drawing_sets_project_family_version_unique").on(
      table.projectId,
      table.family,
      table.version,
    ),
    tenantIsolation: pgPolicy("drawing_sets_tenant_isolation", {
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
// drawing_sheets — one row per page in the source PDF.
//
// `page_index` is the 0-based index into the multi-page source PDF; the viewer
// passes this to react-pdf to render that page. `discipline` is a single-char
// code (A/S/E/M/P/…) derived from the sheet-number prefix by default and used
// to filter the sub-scoped view. Calibration fields record the sheet scale
// (auto-read from title block or set manually by a two-point recalibration).
// `changed_from_prior_version` is flipped by the version-diff job when a new
// set supersedes an older one; drives the "Changed" badge in the index view.
// -----------------------------------------------------------------------------

export const drawingSheets = pgTable(
  "drawing_sheets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setId: uuid("set_id")
      .notNull()
      .references(() => drawingSets.id, { onDelete: "cascade" }),
    pageIndex: integer("page_index").notNull(),
    sheetNumber: varchar("sheet_number", { length: 40 }).notNull(),
    sheetTitle: varchar("sheet_title", { length: 255 }).notNull(),
    discipline: char("discipline", { length: 1 }),
    autoDetected: boolean("auto_detected").default(false).notNull(),
    thumbnailKey: text("thumbnail_key"),
    changedFromPriorVersion: boolean("changed_from_prior_version")
      .default(false)
      .notNull(),
    calibrationScale: varchar("calibration_scale", { length: 40 }),
    calibrationSource: drawingCalibrationSourceEnum("calibration_source"),
    calibratedByUserId: uuid("calibrated_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    calibratedAt: timestamp("calibrated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    setPageUnique: unique("drawing_sheets_set_page_unique").on(
      table.setId,
      table.pageIndex,
    ),
    setIdx: index("drawing_sheets_set_idx").on(table.setId),
    setDisciplineIdx: index("drawing_sheets_set_discipline_idx").on(
      table.setId,
      table.discipline,
    ),
    setSheetNumberIdx: index("drawing_sheets_set_sheet_number_idx").on(
      table.setId,
      table.sheetNumber,
    ),
    tenantIsolation: pgPolicy("drawing_sheets_tenant_isolation", {
      for: "all",
      using: sql`${table.setId} IN (SELECT id FROM drawing_sets)`,
      withCheck: sql`${table.setId} IN (SELECT id FROM drawing_sets)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// drawing_markups — one JSON doc per user per sheet.
//
// Single-row-per-user pattern: all a user's strokes/shapes/text for a sheet
// live in `markup_data` as an array. Avoids per-stroke row thrashing on rapid
// pen input; write path debounces client-side and PUTs the whole doc. Markups
// are pinned to this exact sheet_id — V1 does not carry over when a set is
// superseded; users must re-annotate on the new version (documented in UI).
// -----------------------------------------------------------------------------

export const drawingMarkups = pgTable(
  "drawing_markups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => drawingSheets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    markupData: jsonb("markup_data").default([]).notNull(),
    ...timestamps,
  },
  (table) => ({
    sheetUserUnique: unique("drawing_markups_sheet_user_unique").on(
      table.sheetId,
      table.userId,
    ),
    sheetIdx: index("drawing_markups_sheet_idx").on(table.sheetId),
    // Depth-2 nested: chain through drawing_sheets to drawing_sets.
    tenantIsolation: pgPolicy("drawing_markups_tenant_isolation", {
      for: "all",
      using: sql`${table.sheetId} IN (SELECT id FROM drawing_sheets)`,
      withCheck: sql`${table.sheetId} IN (SELECT id FROM drawing_sheets)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// drawing_measurements — one JSON doc per user per sheet.
//
// Kept separate from markups because measurements depend on sheet calibration
// (changing the scale re-formats every label) and belong on a distinct
// toolbar layer in the viewer. Linear segments and area polygons share the
// same doc; `type` in each entry discriminates.
// -----------------------------------------------------------------------------

export const drawingMeasurements = pgTable(
  "drawing_measurements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => drawingSheets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    measurementData: jsonb("measurement_data").default([]).notNull(),
    ...timestamps,
  },
  (table) => ({
    sheetUserUnique: unique("drawing_measurements_sheet_user_unique").on(
      table.sheetId,
      table.userId,
    ),
    sheetIdx: index("drawing_measurements_sheet_idx").on(table.sheetId),
    tenantIsolation: pgPolicy("drawing_measurements_tenant_isolation", {
      for: "all",
      using: sql`${table.sheetId} IN (SELECT id FROM drawing_sheets)`,
      withCheck: sql`${table.sheetId} IN (SELECT id FROM drawing_sheets)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// drawing_comments — pinned comments with optional reply threads.
//
// x/y are numeric(5,2) fractional coordinates (0.00–100.00) on the sheet,
// matching the prototype's percent-space pins. `parent_comment_id` is null
// for root pins (which also carry a per-sheet `pin_number`) and non-null for
// replies. Insertion strategy for pin_number: compute MAX(pin_number)+1 in a
// subquery filtered to the same sheet_id and parent_comment_id IS NULL, with
// unique(sheet_id, pin_number) as the tiebreaker — retry on conflict.
// -----------------------------------------------------------------------------

export const drawingComments = pgTable(
  "drawing_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => drawingSheets.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id").references(
      (): AnyPgColumn => drawingComments.id,
      { onDelete: "cascade" },
    ),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    pinNumber: integer("pin_number"),
    x: numeric("x", { precision: 5, scale: 2 }).notNull(),
    y: numeric("y", { precision: 5, scale: 2 }).notNull(),
    text: text("text").notNull(),
    resolved: boolean("resolved").default(false).notNull(),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    sheetIdx: index("drawing_comments_sheet_idx").on(table.sheetId),
    sheetResolvedIdx: index("drawing_comments_sheet_resolved_idx").on(
      table.sheetId,
      table.resolved,
    ),
    parentIdx: index("drawing_comments_parent_idx").on(table.parentCommentId),
    // Prevents two root pins from colliding on the same pin_number within a
    // sheet. Replies (parent_comment_id IS NOT NULL) have pin_number NULL
    // and are not affected; Postgres treats NULLs as distinct in unique
    // constraints so only real numbered pins contend for the slot.
    sheetPinUnique: unique("drawing_comments_sheet_pin_unique").on(
      table.sheetId,
      table.pinNumber,
    ),
    tenantIsolation: pgPolicy("drawing_comments_tenant_isolation", {
      for: "all",
      using: sql`${table.sheetId} IN (SELECT id FROM drawing_sheets)`,
      withCheck: sql`${table.sheetId} IN (SELECT id FROM drawing_sheets)`,
    }),
  }),
).enableRLS();
