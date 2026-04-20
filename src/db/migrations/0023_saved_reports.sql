-- Migration: Saved reports (Step 24.5 follow-up — Reports library wiring)
-- Date: 2026-04-20
-- Context: The contractor Reports page has a "Saved Reports" library tile
-- that's been rendering seed-only data since Step 24.5. The feature is a
-- (report_type, scope) pair with an optional email delivery cadence and
-- recipient list. This migration adds the backing table so the library
-- becomes real before the remaining report slices (WIP, AR, Cost, Cashflow,
-- Labor, Schedule, Compliance) are wired to live loaders.
--
-- Shape:
--   - organization_id scoped (multi-tenant)
--   - owner_user_id = whoever saved the filter set; delivery continues even
--     if ownership changes, but restrict delete so we don't orphan
--   - report_type is a free text field matching the UI report ids; no CHECK
--     because the set grows over time and validation lives in the loader
--   - scope_filters is jsonb so each report type can store its own payload
--   - schedule_cron + schedule_timezone drive the Trigger.dev delivery job;
--     schedule_label is the human-readable copy for the library list
--   - recipients is a jsonb array of email strings (not normalized into a
--     separate table — small fanout, always read as a list, never queried by)
--
-- Indexing:
--   - org_id and (org_id, created_at) for the library list queries
--   - owner_user_id for "my saved reports" views
--   - partial index on next_run_at for the scheduled-delivery scanner
--
-- Schedule coherence CHECK: either the entire schedule is null (on-demand
-- only) or cron + timezone are both set. Prevents half-configured schedules.

CREATE TABLE "saved_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "report_type" text NOT NULL,
  "scope_description" text,
  "scope_filters" jsonb,
  "schedule_cron" text,
  "schedule_label" text,
  "schedule_timezone" text,
  "recipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "saved_reports_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE,
  CONSTRAINT "saved_reports_owner_user_id_users_id_fk"
    FOREIGN KEY ("owner_user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "saved_reports_schedule_coherence_check" CHECK (
    (
      "schedule_cron" IS NULL
      AND "schedule_label" IS NULL
      AND "schedule_timezone" IS NULL
      AND "next_run_at" IS NULL
    ) OR (
      "schedule_cron" IS NOT NULL
      AND "schedule_timezone" IS NOT NULL
    )
  )
);

CREATE INDEX "saved_reports_organization_id_idx"
  ON "saved_reports" ("organization_id");

CREATE INDEX "saved_reports_owner_user_id_idx"
  ON "saved_reports" ("owner_user_id");

CREATE INDEX "saved_reports_org_created_idx"
  ON "saved_reports" ("organization_id", "created_at");

CREATE INDEX "saved_reports_next_run_at_idx"
  ON "saved_reports" ("next_run_at")
  WHERE "schedule_cron" IS NOT NULL;
