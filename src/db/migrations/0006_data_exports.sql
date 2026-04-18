-- Migration: data_exports tracking table (Session 1 of Data Exports phase)
-- Date: 2026-04-17
-- Context: tracks user-requested exports. Small exports run synchronously
-- and insert + update this row in one request; heavy ones enqueue a
-- Trigger.dev v3 job that picks up the row and writes a ZIP to R2. Feature
-- gating lives in src/domain/policies/plan.ts (data_exports.full_archive,
-- audit.csv_export keys). `expired` is computed at read time (expires_at <
-- now()) — no separate status value, no background cleanup job.

CREATE TABLE IF NOT EXISTS "data_exports" (
  "id"                      uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"         uuid         NOT NULL,
  "requested_by_user_id"    uuid         NOT NULL,
  "export_kind"             text         NOT NULL,
  "scope"                   jsonb,
  "status"                  text         NOT NULL DEFAULT 'queued',
  "storage_key"             text,
  "expires_at"              timestamp with time zone,
  "error_message"           text,
  "started_at"              timestamp with time zone,
  "completed_at"            timestamp with time zone,
  "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"              timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "data_exports_organization_id_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "data_exports_requested_by_user_id_fk" FOREIGN KEY ("requested_by_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "data_exports_kind_check"
    CHECK (export_kind IN ('projects_csv','financial_csv','documents_zip','full_archive','audit_log_csv')),
  CONSTRAINT "data_exports_status_check"
    CHECK (status IN ('queued','running','ready','failed'))
);

CREATE INDEX IF NOT EXISTS "data_exports_org_idx"
  ON "data_exports" ("organization_id");
CREATE INDEX IF NOT EXISTS "data_exports_status_idx"
  ON "data_exports" ("status");
CREATE INDEX IF NOT EXISTS "data_exports_org_created_idx"
  ON "data_exports" ("organization_id", "created_at");
