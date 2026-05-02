import { sql } from "drizzle-orm";
import {
  boolean,
  date,
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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { retention, timestamps } from "./_shared";
import { documents } from "./documents";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const submittalTypeEnum = pgEnum("submittal_type", [
  "product_data",
  "shop_drawing",
  "sample",
  "mock_up",
  "calculations",
  "schedule_of_values",
]);

export const submittalStatusEnum = pgEnum("submittal_status", [
  "draft",
  "submitted",
  "under_review",
  "returned_approved",
  "returned_as_noted",
  "revise_resubmit",
  "rejected",
  "closed",
]);

export const submittalDocumentRoleEnum = pgEnum("submittal_document_role", [
  "package",
  "reviewer_comments",
  "stamp_page",
]);

export const submittalTransmittalDirectionEnum = pgEnum(
  "submittal_transmittal_direction",
  ["outgoing_to_reviewer", "incoming_from_reviewer", "forwarded_to_sub"],
);

// -----------------------------------------------------------------------------
// submittals — workflow row per submittal package (and per revision).
//
// Sequential number per project (S-001, S-002, ...) via the unique index
// on (projectId, sequentialNumber); action layer computes `max+1` inside
// the create transaction.
//
// State machine (enforced at action layer, NOT by triggers):
//   draft → submitted → under_review → returned_approved (terminal-ish)
//                                    → returned_as_noted
//                                    → revise_resubmit
//                                    → rejected
//   any returned_* → closed
//   revise_resubmit closes the row AND spawns a fresh draft clone
//     (revisionOfId points to this row).
//
// Reviewer identity lives on this row (not on transmittals): there's one
// reviewer per cycle, and if the reviewer changes the clean model is a
// new revision. Step 20.5 (external reviewer portal) will later introduce
// a reviewer user + scoped membership; until then these fields are the
// system of record for who stamped what.
// -----------------------------------------------------------------------------

export const submittals = pgTable(
  "submittals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sequentialNumber: integer("sequential_number").notNull(),
    // CSI format — accepts both compact ("033000") and spaced
    // ("03 30 00") per industry convention.
    specSection: varchar("spec_section", { length: 40 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    submittalType: submittalTypeEnum("submittal_type").notNull(),
    submittedByOrgId: uuid("submitted_by_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Nullable: GC can choose to self-review rather than route to an
    // external architect/engineer.
    routedToOrgId: uuid("routed_to_org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    // Reviewer identity as text. Populated when GC forwards to reviewer.
    reviewerName: varchar("reviewer_name", { length: 200 }),
    reviewerOrg: varchar("reviewer_org", { length: 200 }),
    reviewerEmail: varchar("reviewer_email", { length: 320 }),
    status: submittalStatusEnum("status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    revisionOfId: uuid("revision_of_id").references(
      (): AnyPgColumn => submittals.id,
      { onDelete: "set null" },
    ),
    dueDate: date("due_date"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Captured when reviewer returns a `rejected` outcome. Preserved on
    // the closed row so audit queries can quote the rationale.
    rejectionReason: text("rejection_reason"),
    lastTransitionAt: timestamp("last_transition_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    projectNumberUnique: unique("submittals_project_number_unique").on(
      table.projectId,
      table.sequentialNumber,
    ),
    projectStatusIdx: index("submittals_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    specSectionIdx: index("submittals_spec_section_idx").on(
      table.projectId,
      table.specSection,
    ),
    submittedByOrgIdx: index("submittals_submitted_by_org_idx").on(
      table.submittedByOrgId,
      table.status,
    ),
    revisionOfIdx: index("submittals_revision_of_idx").on(table.revisionOfId),
    // Phase 4 wave 4 — same project-scoped 2-clause hybrid. submittedByOrgId
    // and routedToOrgId are workflow routing only; ownership is the
    // project's contractor org or any active POM. Clause B alone wouldn't
    // cover a sub viewing/creating their own submitted package, so the
    // POM clause is required.
    tenantIsolation: pgPolicy("submittals_tenant_isolation", {
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
// submittal_documents — join to documents with a role tag. A submittal can
// have many package files, many reviewer-comment files, and (usually) one
// stamp_page. Same R2 presign → PUT → finalize flow as other modules; this
// table only stores the link row.
// -----------------------------------------------------------------------------

export const submittalDocuments = pgTable(
  "submittal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submittalId: uuid("submittal_id")
      .notNull()
      .references(() => submittals.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    role: submittalDocumentRoleEnum("role").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    attachedByUserId: uuid("attached_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // When true, the linking UI shows the exact document version
    // present at link time rather than walking forward to the chain
    // head. Set automatically when a submittal transitions to any
    // terminal/near-terminal status (returned_approved, returned_as_
    // noted, revise_resubmit, rejected, closed) — at that point the
    // reviewer's decision is tied to the specific files they stamped,
    // so downstream displays must not drift to newer versions.
    pinVersion: boolean("pin_version").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...retention("project_record"),
  },
  (table) => ({
    submittalIdx: index("submittal_documents_submittal_idx").on(
      table.submittalId,
    ),
    unq: unique("submittal_documents_unique").on(
      table.submittalId,
      table.documentId,
      table.role,
    ),
    // Phase 4 wave 4 nested — nested-via-parent on submittals.
    tenantIsolation: pgPolicy("submittal_documents_tenant_isolation", {
      for: "all",
      using: sql`${table.submittalId} IN (SELECT id FROM submittals)`,
      withCheck: sql`${table.submittalId} IN (SELECT id FROM submittals)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// submittal_transmittals — log of every transmission. Three directions:
//   outgoing_to_reviewer  — GC sent the package to the reviewer
//   incoming_from_reviewer — GC logged the reviewer's response
//   forwarded_to_sub      — GC pushed the result back to the sub
//
// Every row has transmitted_by_user_id = the GC user who performed the
// recording action → full audit trail on the GC side. `document_id` is
// nullable (many transmittals are pure log entries). `notes` holds the
// freeform cover-letter body.
// -----------------------------------------------------------------------------

export const submittalTransmittals = pgTable(
  "submittal_transmittals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submittalId: uuid("submittal_id")
      .notNull()
      .references(() => submittals.id, { onDelete: "cascade" }),
    direction: submittalTransmittalDirectionEnum("direction").notNull(),
    transmittedAt: timestamp("transmitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    transmittedByUserId: uuid("transmitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...retention("project_record"),
  },
  (table) => ({
    submittalTimelineIdx: index("submittal_transmittals_submittal_idx").on(
      table.submittalId,
      table.transmittedAt,
    ),
    // Phase 4 wave 4 nested — nested-via-parent on submittals.
    tenantIsolation: pgPolicy("submittal_transmittals_tenant_isolation", {
      for: "all",
      using: sql`${table.submittalId} IN (SELECT id FROM submittals)`,
      withCheck: sql`${table.submittalId} IN (SELECT id FROM submittals)`,
    }),
  }),
).enableRLS();
