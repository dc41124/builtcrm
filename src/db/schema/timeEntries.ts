import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
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

import { retention, timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

// Lifecycle:
//   running    — clock-in placed, no clock-out yet (one per worker, enforced
//                by partial unique index below)
//   draft      — closed but the worker can still edit (until they submit)
//   submitted  — worker submitted weekly timesheet; read-only to worker
//   approved   — admin approved
//   rejected   — admin rejected (worker re-edits and resubmits)
//   amended    — admin edited a submitted entry; sticky terminal state.
//                Once amended, the row stays amended even if values look
//                "correct" — the audit row carries the diff.
export const timeEntryStatusEnum = pgEnum("time_entry_status", [
  "running",
  "draft",
  "submitted",
  "approved",
  "rejected",
  "amended",
]);

export const timeEntryAmendmentActionEnum = pgEnum(
  "time_entry_amendment_action",
  ["submitted", "approved", "rejected", "amended"],
);

// -----------------------------------------------------------------------------
// time_entries — one row per shift / punch.
//
// Sub-org-internal: contractors and clients never read this table directly
// (RLS denies). Cross-portal access for reporting goes through aggregated
// loaders that join via project_organization_memberships.
//
// `task_label` / `task_code` are **snapshots**, not FKs. There is no live
// `tasks` table in the schema yet (the prototype's tasks are demo data). When
// a real schedule-tasks table lands, a migration can backfill an FK column.
//
// Overlap prevention is enforced at the action layer — we don't have
// btree_gist enabled and adding a Postgres extension touches bootstrap. The
// upgrade path is tracked in
// docs/specs/production_grade_upgrades/time_entry_overlap_exclusion.md.
//
// `client_uuid` reserves an idempotency key for the future PWA outbox
// (parallels daily_logs.client_uuid). It is not yet wired through any client.
// -----------------------------------------------------------------------------

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    taskLabel: varchar("task_label", { length: 160 }),
    taskCode: varchar("task_code", { length: 40 }),

    clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),

    locationLat: numeric("location_lat", { precision: 9, scale: 6 }),
    locationLng: numeric("location_lng", { precision: 9, scale: 6 }),

    notes: text("notes"),

    status: timeEntryStatusEnum("status").notNull().default("running"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    // Reserved for the future offline outbox; not consumed by current routes.
    clientUuid: uuid("client_uuid"),

    ...timestamps,
    ...retention("statutory_construction"),
  },
  (table) => ({
    // One running entry per worker, enforced by Postgres. Partial unique
    // index — only applies when status = 'running'.
    runningPerUserUnique: uniqueIndex(
      "time_entries_one_running_per_user_idx",
    )
      .on(table.userId)
      .where(sql`${table.status} = 'running'`),

    clientUuidUnique: unique("time_entries_client_uuid_unique").on(
      table.clientUuid,
    ),

    orgStatusIdx: index("time_entries_org_status_idx").on(
      table.organizationId,
      table.status,
      table.clockInAt,
    ),
    userClockInIdx: index("time_entries_user_clock_in_idx").on(
      table.userId,
      table.clockInAt,
    ),
    projectClockInIdx: index("time_entries_project_clock_in_idx").on(
      table.projectId,
      table.clockInAt,
    ),

    // RLS Pattern A — org-owned table. Tenant context (`app.current_org_id`)
    // is set on every authenticated route via withTenant(). Workers see their
    // own org's entries; admins do too. Worker-can-only-edit-own-drafts is
    // enforced at the action layer — RLS gives read access to the whole
    // org's entries (admins need it, and workers see roster context in the
    // weekly view via aggregated loaders).
    tenantIsolation: pgPolicy("time_entries_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// time_entry_amendments — append-only audit trail.
//
// Same shape as safety_form_incidents / daily_log_delays for RLS — defer to
// parent's tenant via subquery. `before_json` / `after_json` carry typed
// snapshots so the UI can render diffs without a generic JSON renderer.
// -----------------------------------------------------------------------------

export interface TimeEntrySnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  durationMinutes: number | null;
  projectId: string;
  taskLabel: string | null;
  notes: string | null;
  status: string;
}

export const timeEntryAmendments = pgTable(
  "time_entry_amendments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    timeEntryId: uuid("time_entry_id")
      .notNull()
      .references(() => timeEntries.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: timeEntryAmendmentActionEnum("action").notNull(),
    beforeJson: jsonb("before_json").$type<TimeEntrySnapshot | null>(),
    afterJson: jsonb("after_json").$type<TimeEntrySnapshot | null>(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...retention("statutory_construction"),
  },
  (table) => ({
    entryCreatedIdx: index("time_entry_amendments_entry_created_idx").on(
      table.timeEntryId,
      table.createdAt,
    ),
    tenantIsolation: pgPolicy("time_entry_amendments_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.timeEntryId} IN (
          SELECT id FROM time_entries
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      `,
      withCheck: sql`
        ${table.timeEntryId} IN (
          SELECT id FROM time_entries
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      `,
    }),
  }),
).enableRLS();
