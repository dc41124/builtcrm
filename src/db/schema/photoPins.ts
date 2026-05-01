import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";
import { documents } from "./documents";
import { drawingSheets } from "./drawings";
import { users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// photo_pins — anchor a photo (document) to a fractional (x,y) coordinate on
// a drawing sheet.
//
// Design notes (per Step 54 proposal):
//   - The photo lives in `documents`, not a dedicated `photos` table. Every
//     other photo surface (daily logs, safety forms, transmittals) attaches
//     images via `documents`, and reusing keeps the offline outbox + R2
//     presign chain unchanged.
//   - `(x, y)` are stored as fractions in [0, 1] relative to the rendered
//     sheet bounds. CHECK constraints fail loud on a bad coord — better than
//     silent clamping at render time.
//   - `project_id` is denormalized from BOTH parents (sheet → set →
//     project, document → project). The action layer asserts they match
//     before insert; this column lets the RLS subquery + the
//     "show me every pin on this project" loader avoid a 3-table join.
//   - Multi-pin per (document, sheet) IS allowed — one photo can show up at
//     two coords on the same sheet (two angles of one wall, etc.). No
//     uniqueness constraint.
//   - Pin removal is hard delete; the audit trail for "photo X used to be
//     pinned on sheet Y" lives in `audit_events`, not on the row.
//
// RLS (depth-2, same shape as drawing_markups): inherits from the parent
// sheet's project tenancy. Contractor sees pins on their projects; subs see
// pins on projects they're a member of; clients are gated identically.
// -----------------------------------------------------------------------------

export const photoPins = pgTable(
  "photo_pins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => drawingSheets.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    x: numeric("x", { precision: 7, scale: 6 }).notNull(),
    y: numeric("y", { precision: 7, scale: 6 }).notNull(),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => ({
    xRange: check("photo_pins_x_range", sql`${table.x} BETWEEN 0 AND 1`),
    yRange: check("photo_pins_y_range", sql`${table.y} BETWEEN 0 AND 1`),
    sheetCreatedIdx: index("photo_pins_sheet_created_idx").on(
      table.sheetId,
      table.createdAt,
    ),
    documentIdx: index("photo_pins_document_idx").on(table.documentId),
    projectIdx: index("photo_pins_project_idx").on(table.projectId),
    tenantIsolation: pgPolicy("photo_pins_tenant_isolation", {
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
