-- Migration: Weekly reports + sections (Step 39 / 4D #39)
-- Date: 2026-04-19
-- Context: Auto-generated weekly progress reports per project, with
-- structured per-section snapshots. Two-table design:
--
--   1. `weekly_reports` — one row per project per week (enforced by
--      unique constraint on (project_id, week_start)). Holds the
--      editable contractor narrative (`summary_text`), generation +
--      send metadata, and a four-state lifecycle:
--        auto_draft → editing → sent → archived.
--
--   2. `weekly_report_sections` — structured per-section JSON payloads
--      (one row per (report, sectionType), upsert-on-generate). Six
--      section types match the build-guide spec exactly. Distinct
--      `rfis` and `issues` types in the data model even though the
--      contractor UI may render them in a combined visual section —
--      keeps the source streams clean and lets a contractor toggle
--      one without the other.
--
-- Residential portal renders the same sections through a per-portal
-- reshaper (see src/domain/loaders/weekly-reports.ts in a later
-- commit). No schema duplication for warmer copy / different cards —
-- it's the same data with a different projection.

CREATE TYPE "public"."weekly_report_status" AS ENUM (
  'auto_draft',
  'editing',
  'sent',
  'archived'
);

CREATE TYPE "public"."weekly_report_section_type" AS ENUM (
  'daily_logs',
  'photos',
  'milestones',
  'rfis',
  'change_orders',
  'issues'
);

CREATE TABLE "weekly_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "week_start" date NOT NULL,
  "week_end" date NOT NULL,
  "status" "weekly_report_status" DEFAULT 'auto_draft' NOT NULL,
  "summary_text" text,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "generated_by_user_id" uuid,
  "sent_at" timestamp with time zone,
  "sent_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "weekly_reports_project_week_unique" UNIQUE ("project_id", "week_start"),
  CONSTRAINT "weekly_reports_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "weekly_reports_generated_by_user_id_fk"
    FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "weekly_reports_sent_by_user_id_fk"
    FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "weekly_reports_project_idx" ON "weekly_reports" ("project_id");
CREATE INDEX "weekly_reports_status_idx" ON "weekly_reports" ("status");
CREATE INDEX "weekly_reports_sent_at_idx" ON "weekly_reports" ("sent_at");

CREATE TABLE "weekly_report_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL,
  "section_type" "weekly_report_section_type" NOT NULL,
  "content" jsonb DEFAULT '{}' NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "weekly_report_sections_report_type_unique" UNIQUE ("report_id", "section_type"),
  CONSTRAINT "weekly_report_sections_report_id_fk"
    FOREIGN KEY ("report_id") REFERENCES "weekly_reports"("id") ON DELETE CASCADE
);

CREATE INDEX "weekly_report_sections_report_idx" ON "weekly_report_sections" ("report_id");
