import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";
import { documents } from "./documents";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const dailyLogStatusEnum = pgEnum("daily_log_status", ["draft", "submitted"]);

export const dailyLogWeatherConditionsEnum = pgEnum("daily_log_weather_conditions", [
  "clear",
  "partly_cloudy",
  "overcast",
  "light_rain",
  "heavy_rain",
  "snow",
]);

export const dailyLogWeatherSourceEnum = pgEnum("daily_log_weather_source", ["manual", "api"]);

export const dailyLogMilestoneTypeEnum = pgEnum("daily_log_milestone_type", [
  "ok",
  "warn",
  "info",
]);

export const dailyLogResidentialMoodEnum = pgEnum("daily_log_residential_mood", [
  "great",
  "good",
  "slow",
]);

export const dailyLogCrewSubmittedByRoleEnum = pgEnum("daily_log_crew_submitted_by_role", [
  "sub",
  "contractor",
]);

export const dailyLogDelayTypeEnum = pgEnum("daily_log_delay_type", [
  "weather",
  "material",
  "inspection",
  "subcontractor_no_show",
  "coordination",
  "other",
]);

export const dailyLogIssueTypeEnum = pgEnum("daily_log_issue_type", [
  "safety_near_miss",
  "safety_incident",
  "coordination",
  "quality",
  "other",
]);

export const dailyLogAmendmentStatusEnum = pgEnum("daily_log_amendment_status", [
  "pending",
  "approved",
  "rejected",
]);

// -----------------------------------------------------------------------------
// daily_logs — one row per project per day (enforced by unique constraint).
//
// The single source of truth for "what happened on this site this day."
// Contractor-authored narrative fields (notes, delays/issues, crew) plus
// optional client-facing fields that feed the commercial and residential
// read-only views. Residential fields are kept inline as nullable columns
// (1:1 with the log, not worth a separate table).
//
// Edit window: after submittedAt, the author may mutate this row in place
// for 24h (editWindowClosesAt). After that, edits must go through
// daily_log_amendments (audit-preserving post-24hr edits).
//
// logDate is anchored to projects.timezone, not server time. See projects.
// -----------------------------------------------------------------------------

export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    status: dailyLogStatusEnum("status").default("draft").notNull(),
    reportedByUserId: uuid("reported_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    editWindowClosesAt: timestamp("edit_window_closes_at", { withTimezone: true }),

    // Weather — manual entry today. weatherSource + weatherCapturedAt are
    // carried now so a later weather-API integration (Phase 6/7) doesn't
    // need a schema change.
    weatherConditions: dailyLogWeatherConditionsEnum("weather_conditions"),
    weatherHighC: integer("weather_high_c"),
    weatherLowC: integer("weather_low_c"),
    weatherPrecipPct: integer("weather_precip_pct"),
    weatherWindKmh: integer("weather_wind_kmh"),
    weatherSource: dailyLogWeatherSourceEnum("weather_source").default("manual").notNull(),
    weatherCapturedAt: timestamp("weather_captured_at", { withTimezone: true }),

    // Contractor-facing narrative (full detail, shown to GC + subs).
    notes: text("notes"),

    // Client-facing — written by GC, shown to commercial + residential clients.
    // Redacted views never expose notes/crew/delays/issues; they read from
    // these fields instead.
    clientSummary: text("client_summary"),
    // Array of short bullet strings; 2–4 items per log.
    clientHighlights: jsonb("client_highlights").$type<string[]>(),
    milestone: text("milestone"),
    milestoneType: dailyLogMilestoneTypeEnum("milestone_type"),

    // Residential-only — friendlier framing for the homeowner "Journal" view.
    residentialHeroTitle: text("residential_hero_title"),
    residentialSummary: text("residential_summary"),
    residentialMood: dailyLogResidentialMoodEnum("residential_mood"),
    residentialTeamNote: text("residential_team_note"),
    residentialTeamNoteByUserId: uuid("residential_team_note_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),

    ...timestamps,
  },
  (table) => ({
    // One log per project per day. Second submitter on the same day opens
    // the existing row for editing.
    projectDateUnique: unique("daily_logs_project_date_unique").on(
      table.projectId,
      table.logDate,
    ),
    // Primary list view — recent logs for a project, newest first.
    projectStatusDateIdx: index("daily_logs_project_status_date_idx").on(
      table.projectId,
      table.status,
      table.logDate,
    ),
    reportedByIdx: index("daily_logs_reported_by_idx").on(table.reportedByUserId),
  }),
);

// -----------------------------------------------------------------------------
// daily_log_crew_entries — one row per sub org per day per project.
//
// A real child table (not JSON on daily_logs) because:
//  - subs submit their own entry BEFORE the GC creates the log (dailyLogId
//    is nullable; createDailyLog auto-attaches matching orphans in-txn).
//  - subs query their own crew-hours across projects for the week; this
//    is a simple indexed scan here, not a JSON unnest.
//  - the GC can reconcile (override) a sub's submitted values — kept as
//    separate `reconciledHeadcount`/`reconciledHours` fields so the sub's
//    original values survive.
//
// Reconciliation re-fire: when reconciledHeadcount/reconciledHours change,
// the action layer MUST clear subAckedReconciliationAt to null in the same
// transaction so the sub's "Review required" badge re-fires.
// -----------------------------------------------------------------------------

export const dailyLogCrewEntries = pgTable(
  "daily_log_crew_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dailyLogId: uuid("daily_log_id").references(() => dailyLogs.id, {
      onDelete: "cascade",
    }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    trade: varchar("trade", { length: 120 }),

    // Live (possibly reconciled) values — queries read these directly.
    headcount: integer("headcount").notNull(),
    hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),

    // Sub-submitted note + issues. GC reads these; they don't appear in
    // client views.
    submittedNote: text("submitted_note"),
    submittedIssues: text("submitted_issues"),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    submittedByRole: dailyLogCrewSubmittedByRoleEnum("submitted_by_role").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),

    // GC reconciliation — overrides submitted values. Nulls mean unchanged.
    reconciledHeadcount: integer("reconciled_headcount"),
    reconciledHours: numeric("reconciled_hours", { precision: 6, scale: 2 }),
    reconciledByUserId: uuid("reconciled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    // Sub clears their "Review required" state by acking. Re-fires when
    // GC changes reconciled values again (cleared back to null in txn).
    subAckedReconciliationAt: timestamp("sub_acked_reconciliation_at", {
      withTimezone: true,
    }),

    ...timestamps,
  },
  (table) => ({
    // One crew entry per (project, date, sub-org). Prevents dup submissions.
    projectDateOrgUnique: unique("daily_log_crew_entries_project_date_org_unique").on(
      table.projectId,
      table.logDate,
      table.orgId,
    ),
    // Cross-project weekly hours query for the sub portal.
    orgDateIdx: index("daily_log_crew_entries_org_date_idx").on(table.orgId, table.logDate),
    logIdx: index("daily_log_crew_entries_log_idx").on(table.dailyLogId),
  }),
);

// -----------------------------------------------------------------------------
// daily_log_delays — schedule-impacting delays (hours lost, impacted activity).
// Split from issues because the two tables aggregate differently in
// reporting (schedule-impact vs. safety log) and hoursLost is semantically
// meaningful for a delay but nonsensical for a safety near-miss.
// -----------------------------------------------------------------------------

export const dailyLogDelays = pgTable(
  "daily_log_delays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dailyLogId: uuid("daily_log_id")
      .notNull()
      .references(() => dailyLogs.id, { onDelete: "cascade" }),
    delayType: dailyLogDelayTypeEnum("delay_type").notNull(),
    description: text("description").notNull(),
    hoursLost: numeric("hours_lost", { precision: 5, scale: 2 }).notNull(),
    impactedActivity: text("impacted_activity"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    logIdx: index("daily_log_delays_log_idx").on(table.dailyLogId),
  }),
);

// -----------------------------------------------------------------------------
// daily_log_issues — non-schedule-impacting events (safety near-misses,
// coordination flags, quality notes). No hoursLost.
// -----------------------------------------------------------------------------

export const dailyLogIssues = pgTable(
  "daily_log_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dailyLogId: uuid("daily_log_id")
      .notNull()
      .references(() => dailyLogs.id, { onDelete: "cascade" }),
    issueType: dailyLogIssueTypeEnum("issue_type").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    logIdx: index("daily_log_issues_log_idx").on(table.dailyLogId),
  }),
);

// -----------------------------------------------------------------------------
// daily_log_photos — join between a log and documents uploaded for it.
//
// Photos reuse the existing R2 presigned-URL upload flow and are first
// written as documents rows; this table just links them to the log with
// a caption + sort order. isHero flags the single featured photo for the
// residential client's Journal view; a partial unique index enforces
// at-most-one-hero per log at the database layer.
// -----------------------------------------------------------------------------

export const dailyLogPhotos = pgTable(
  "daily_log_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dailyLogId: uuid("daily_log_id")
      .notNull()
      .references(() => dailyLogs.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    caption: text("caption"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isHero: boolean("is_hero").default(false).notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    logIdx: index("daily_log_photos_log_idx").on(table.dailyLogId),
    // At most one hero photo per log. Partial index — rows with
    // is_hero = false don't participate, so an unlimited number of
    // non-hero photos per log is fine.
    oneHeroPerLog: uniqueIndex("daily_log_photos_one_hero_per_log")
      .on(table.dailyLogId)
      .where(sql`${table.isHero} = true`),
  }),
);

// -----------------------------------------------------------------------------
// daily_log_amendments — post-24hr edits, audit-preserving.
//
// Once editWindowClosesAt passes, further edits route through this table
// as amendment requests. Apply semantics on status -> 'approved':
//   1. Read changedFields.<field>.after values.
//   2. Write them into daily_logs (mutates the original row in place).
//   3. Set appliedAt = now().
// The `before` values stay in changedFields forever — that IS the audit
// record. No separate version snapshot of the log is required.
//
// Subcontractor-visible case: an amendment that touches a crew entry
// (e.g. reconciledHours +4) surfaces to the sub as "Review required" via
// daily_log_crew_entries.subAckedReconciliationAt, NOT via this table.
// Amendments here are log-level (weather, notes, delays, milestone, etc.).
// -----------------------------------------------------------------------------

export const dailyLogAmendments = pgTable(
  "daily_log_amendments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dailyLogId: uuid("daily_log_id")
      .notNull()
      .references(() => dailyLogs.id, { onDelete: "cascade" }),
    changeSummary: text("change_summary").notNull(),
    // Shape: { [fieldName]: { before: <value>, after: <value> } }.
    // Both before + after stored so the amendment is self-contained for
    // audit; no join back against a pre-amendment log state is required.
    changedFields: jsonb("changed_fields")
      .$type<Record<string, { before: unknown; after: unknown }>>()
      .notNull(),
    status: dailyLogAmendmentStatusEnum("status").default("pending").notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    // Set when status -> 'approved' and changedFields.after values have
    // been merged into the parent daily_logs row.
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    logIdx: index("daily_log_amendments_log_idx").on(table.dailyLogId),
    statusIdx: index("daily_log_amendments_status_idx").on(table.status),
  }),
);
