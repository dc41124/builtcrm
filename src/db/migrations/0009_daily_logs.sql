-- Migration: daily_logs module (Step 18 / 4B.3 #18)
-- Date: 2026-04-18
-- Context: core commercial field module. One log per project per day with
-- contractor-authored narrative + optional client-facing fields for the
-- commercial/residential redacted views. Crew, delays, issues, photos,
-- and amendments all live in child tables.
--
-- See src/db/schema/dailyLogs.ts for field-level commentary on the why
-- behind the shape (nullable dailyLogId on crew entries, reconciliation
-- re-fire rule, amendment apply semantics, hero-photo partial unique,
-- weatherSource forward-compat, logDate timezone anchoring, etc.).

-- ---------------------------------------------------------------------------
-- projects.timezone
-- ---------------------------------------------------------------------------
-- logDate on daily_logs is anchored to the project's timezone, not server
-- time or the submitter's browser. Added as NOT NULL with a UTC default so
-- existing rows don't break.
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'UTC';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "daily_log_status" AS ENUM ('draft', 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_weather_conditions" AS ENUM (
    'clear', 'partly_cloudy', 'overcast', 'light_rain', 'heavy_rain', 'snow'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_weather_source" AS ENUM ('manual', 'api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_milestone_type" AS ENUM ('ok', 'warn', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_residential_mood" AS ENUM ('great', 'good', 'slow');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_crew_submitted_by_role" AS ENUM ('sub', 'contractor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_delay_type" AS ENUM (
    'weather', 'material', 'inspection', 'subcontractor_no_show', 'coordination', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_issue_type" AS ENUM (
    'safety_near_miss', 'safety_incident', 'coordination', 'quality', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "daily_log_amendment_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- daily_logs — one row per (project, date).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_logs" (
  "id"                              uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"                      uuid                          NOT NULL,
  "log_date"                        date                          NOT NULL,
  "status"                          daily_log_status              NOT NULL DEFAULT 'draft',
  "reported_by_user_id"             uuid                          NOT NULL,
  "submitted_at"                    timestamp with time zone,
  "edit_window_closes_at"           timestamp with time zone,
  "weather_conditions"              daily_log_weather_conditions,
  "weather_high_c"                  integer,
  "weather_low_c"                   integer,
  "weather_precip_pct"              integer,
  "weather_wind_kmh"                integer,
  "weather_source"                  daily_log_weather_source      NOT NULL DEFAULT 'manual',
  "weather_captured_at"             timestamp with time zone,
  "notes"                           text,
  "client_summary"                  text,
  "client_highlights"               jsonb,
  "milestone"                       text,
  "milestone_type"                  daily_log_milestone_type,
  "residential_hero_title"          text,
  "residential_summary"             text,
  "residential_mood"                daily_log_residential_mood,
  "residential_team_note"           text,
  "residential_team_note_by_user_id" uuid,
  "created_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  "updated_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "daily_logs_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_logs_reported_by_user_id_fk"
    FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "daily_logs_residential_team_note_by_user_id_fk"
    FOREIGN KEY ("residential_team_note_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "daily_logs_project_date_unique" UNIQUE ("project_id", "log_date")
);

CREATE INDEX IF NOT EXISTS "daily_logs_project_status_date_idx"
  ON "daily_logs" ("project_id", "status", "log_date");
CREATE INDEX IF NOT EXISTS "daily_logs_reported_by_idx"
  ON "daily_logs" ("reported_by_user_id");

-- ---------------------------------------------------------------------------
-- daily_log_crew_entries — per-sub-org crew row, submittable before the
-- GC log exists (daily_log_id nullable; auto-attached on log creation).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_log_crew_entries" (
  "id"                              uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daily_log_id"                    uuid,
  "project_id"                      uuid                          NOT NULL,
  "log_date"                        date                          NOT NULL,
  "org_id"                          uuid                          NOT NULL,
  "trade"                           varchar(120),
  "headcount"                       integer                       NOT NULL,
  "hours"                           numeric(6, 2)                 NOT NULL,
  "submitted_note"                  text,
  "submitted_issues"                text,
  "submitted_by_user_id"            uuid                          NOT NULL,
  "submitted_by_role"               daily_log_crew_submitted_by_role NOT NULL,
  "submitted_at"                    timestamp with time zone      NOT NULL DEFAULT now(),
  "reconciled_headcount"            integer,
  "reconciled_hours"                numeric(6, 2),
  "reconciled_by_user_id"           uuid,
  "reconciled_at"                   timestamp with time zone,
  "sub_acked_reconciliation_at"     timestamp with time zone,
  "created_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  "updated_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "daily_log_crew_entries_daily_log_id_fk"
    FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_log_crew_entries_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_log_crew_entries_org_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "daily_log_crew_entries_submitted_by_user_id_fk"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "daily_log_crew_entries_reconciled_by_user_id_fk"
    FOREIGN KEY ("reconciled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "daily_log_crew_entries_project_date_org_unique"
    UNIQUE ("project_id", "log_date", "org_id")
);

CREATE INDEX IF NOT EXISTS "daily_log_crew_entries_org_date_idx"
  ON "daily_log_crew_entries" ("org_id", "log_date");
CREATE INDEX IF NOT EXISTS "daily_log_crew_entries_log_idx"
  ON "daily_log_crew_entries" ("daily_log_id");

-- ---------------------------------------------------------------------------
-- daily_log_delays — schedule-impacting events (hoursLost is meaningful).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_log_delays" (
  "id"                              uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daily_log_id"                    uuid                          NOT NULL,
  "delay_type"                      daily_log_delay_type          NOT NULL,
  "description"                     text                          NOT NULL,
  "hours_lost"                      numeric(5, 2)                 NOT NULL,
  "impacted_activity"               text,
  "created_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "daily_log_delays_daily_log_id_fk"
    FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "daily_log_delays_log_idx"
  ON "daily_log_delays" ("daily_log_id");

-- ---------------------------------------------------------------------------
-- daily_log_issues — non-schedule-impacting events (safety, quality, etc.).
-- No hoursLost — split from delays so reporting aggregates cleanly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_log_issues" (
  "id"                              uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daily_log_id"                    uuid                          NOT NULL,
  "issue_type"                      daily_log_issue_type          NOT NULL,
  "description"                     text                          NOT NULL,
  "created_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "daily_log_issues_daily_log_id_fk"
    FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "daily_log_issues_log_idx"
  ON "daily_log_issues" ("daily_log_id");

-- ---------------------------------------------------------------------------
-- daily_log_photos — photos uploaded to a log, linking into documents.
-- is_hero + partial unique index enforces at-most-one hero per log at the
-- database layer; flipping the hero is a single UPDATE instead of an FK swap.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_log_photos" (
  "id"                              uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daily_log_id"                    uuid                          NOT NULL,
  "document_id"                     uuid                          NOT NULL,
  "caption"                         text,
  "sort_order"                      integer                       NOT NULL DEFAULT 0,
  "is_hero"                         boolean                       NOT NULL DEFAULT false,
  "uploaded_by_user_id"             uuid                          NOT NULL,
  "created_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "daily_log_photos_daily_log_id_fk"
    FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_log_photos_document_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_log_photos_uploaded_by_user_id_fk"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "daily_log_photos_log_idx"
  ON "daily_log_photos" ("daily_log_id");

-- Partial unique index: at most one hero per log. Non-hero rows don't
-- participate, so logs can hold unlimited non-hero photos.
CREATE UNIQUE INDEX IF NOT EXISTS "daily_log_photos_one_hero_per_log"
  ON "daily_log_photos" ("daily_log_id")
  WHERE "is_hero" = true;

-- ---------------------------------------------------------------------------
-- daily_log_amendments — post-24hr edits, audit-preserving.
-- changed_fields stores { [field]: { before, after } } so the amendment
-- is self-contained for audit without joining back against a pre-amendment
-- log state that no longer exists after apply.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_log_amendments" (
  "id"                              uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daily_log_id"                    uuid                          NOT NULL,
  "change_summary"                  text                          NOT NULL,
  "changed_fields"                  jsonb                         NOT NULL,
  "status"                          daily_log_amendment_status    NOT NULL DEFAULT 'pending',
  "requested_by_user_id"            uuid                          NOT NULL,
  "requested_at"                    timestamp with time zone      NOT NULL DEFAULT now(),
  "reviewed_by_user_id"             uuid,
  "reviewed_at"                     timestamp with time zone,
  "review_note"                     text,
  "applied_at"                      timestamp with time zone,
  "created_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  "updated_at"                      timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "daily_log_amendments_daily_log_id_fk"
    FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_log_amendments_requested_by_user_id_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "daily_log_amendments_reviewed_by_user_id_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "daily_log_amendments_log_idx"
  ON "daily_log_amendments" ("daily_log_id");
CREATE INDEX IF NOT EXISTS "daily_log_amendments_status_idx"
  ON "daily_log_amendments" ("status");
