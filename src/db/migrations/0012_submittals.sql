-- Migration: submittals module (Step 20 / 4B.3 #20)
-- Date: 2026-04-18
-- Context: formal review workflow for product data + shop drawings.
-- Sub submits a package; GC routes to architect/engineer; reviewer returns
-- with a stamp; GC forwards result back to the sub. Distinct from RFIs
-- (questions) and change orders (scope).
--
-- Scope decisions (all locked via advisor approval before migrate):
--  - Reviewer identity = text fields on `submittals` row (reviewer_name /
--    reviewer_org / reviewer_email). One reviewer per cycle; changing
--    reviewer = new revision.
--  - External reviewer has NO portal shell in Step 20. GC logs reviewer
--    activity on their behalf; every transmittal row carries the GC's
--    user id + timestamp = full audit trail for the GC's recording act.
--    Step 20.5 layers on the reviewer portal later (enum value added
--    now so the DB is ready).
--  - `submittal_transmittals.notes` = freeform cover-letter body
--    (sensible add beyond the guide; explicit in commit message).
--  - `submittal_transmittals.document_id` is nullable since many
--    transmittals are pure log entries without a cover sheet.
--  - Document category added INLINE here (guide offered both paths).
--    Added as an enum — Step 21 extends the enum cleanly rather than
--    doing a string-to-enum conversion.
--
-- State machine (enforced at the action layer, same pattern as Step 19):
--   draft        -> submitted                   (sub sends)
--   submitted    -> under_review                (GC forwards to reviewer)
--   under_review -> returned_approved           (reviewer responds)
--                |  returned_as_noted
--                |  revise_resubmit
--                |  rejected
--   returned_*   -> closed                      (GC forwards to sub, terminal)
--   revise_resubmit closes the old row AND spawns a new draft with
--     revision_of_id pointing back (action layer handles the spawn).

-- ---------------------------------------------------------------------------
-- Enum extensions
-- ---------------------------------------------------------------------------

-- Extend portal_type for the deferred Step 20.5 external reviewer portal.
-- No data rows receive this value yet; this is schema prep only. Guarded
-- so re-running the migration doesn't error.
DO $$ BEGIN
  ALTER TYPE "portal_type" ADD VALUE IF NOT EXISTS 'external_reviewer';
EXCEPTION WHEN others THEN NULL; END $$;

-- Document category — inline per Step 20 scope decision. Step 21 will
-- extend this enum with the full taxonomy (drawings/specifications/
-- contracts/photos/permits/compliance/billing_backup/other). For now
-- only `submittal` and `other` exist so Step 20 can tag submittal docs.
DO $$ BEGIN
  CREATE TYPE "document_category" AS ENUM ('submittal', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "category" "document_category"
  NOT NULL DEFAULT 'other';

-- ---------------------------------------------------------------------------
-- Submittal enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "submittal_type" AS ENUM (
    'product_data',
    'shop_drawing',
    'sample',
    'mock_up',
    'calculations',
    'schedule_of_values'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "submittal_status" AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'returned_approved',
    'returned_as_noted',
    'revise_resubmit',
    'rejected',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "submittal_document_role" AS ENUM (
    'package',
    'reviewer_comments',
    'stamp_page'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "submittal_transmittal_direction" AS ENUM (
    'outgoing_to_reviewer',
    'incoming_from_reviewer',
    'forwarded_to_sub'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- submittals — one row per submittal package (and per revision).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "submittals" (
  "id"                      uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"              uuid                          NOT NULL,
  "sequential_number"       integer                       NOT NULL,
  "spec_section"            varchar(40)                   NOT NULL,
  "title"                   varchar(255)                  NOT NULL,
  "submittal_type"          submittal_type                NOT NULL,
  "submitted_by_org_id"     uuid                          NOT NULL,
  "routed_to_org_id"        uuid,
  -- Reviewer identity stored as data (not FKs) because there's no
  -- reviewer portal yet. One reviewer per submittal cycle.
  "reviewer_name"           varchar(200),
  "reviewer_org"            varchar(200),
  "reviewer_email"          varchar(320),
  "status"                  submittal_status              NOT NULL DEFAULT 'draft',
  "submitted_at"            timestamp with time zone,
  "returned_at"             timestamp with time zone,
  "revision_of_id"          uuid,
  "due_date"                date,
  "created_by_user_id"      uuid                          NOT NULL,
  "rejection_reason"        text,
  "last_transition_at"      timestamp with time zone      NOT NULL DEFAULT now(),
  "created_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "submittals_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "submittals_submitted_by_org_id_fk"
    FOREIGN KEY ("submitted_by_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "submittals_routed_to_org_id_fk"
    FOREIGN KEY ("routed_to_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL,
  CONSTRAINT "submittals_created_by_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "submittals_revision_of_id_fk"
    FOREIGN KEY ("revision_of_id") REFERENCES "submittals"("id") ON DELETE SET NULL,
  CONSTRAINT "submittals_project_number_unique"
    UNIQUE ("project_id", "sequential_number")
);

CREATE INDEX IF NOT EXISTS "submittals_project_status_idx"
  ON "submittals" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "submittals_spec_section_idx"
  ON "submittals" ("project_id", "spec_section");
CREATE INDEX IF NOT EXISTS "submittals_submitted_by_org_idx"
  ON "submittals" ("submitted_by_org_id", "status");
CREATE INDEX IF NOT EXISTS "submittals_revision_of_idx"
  ON "submittals" ("revision_of_id");

-- ---------------------------------------------------------------------------
-- submittal_documents — join to documents with a role tag.
-- A submittal can have multiple package files, multiple reviewer comment
-- files, and (usually) one stamp page.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "submittal_documents" (
  "id"                      uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submittal_id"            uuid                          NOT NULL,
  "document_id"             uuid                          NOT NULL,
  "role"                    submittal_document_role       NOT NULL,
  "sort_order"              integer                       NOT NULL DEFAULT 0,
  "attached_by_user_id"     uuid                          NOT NULL,
  "created_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "submittal_documents_submittal_id_fk"
    FOREIGN KEY ("submittal_id") REFERENCES "submittals"("id") ON DELETE CASCADE,
  CONSTRAINT "submittal_documents_document_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
  CONSTRAINT "submittal_documents_attached_by_user_id_fk"
    FOREIGN KEY ("attached_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "submittal_documents_unique"
    UNIQUE ("submittal_id", "document_id", "role")
);

CREATE INDEX IF NOT EXISTS "submittal_documents_submittal_idx"
  ON "submittal_documents" ("submittal_id");

-- ---------------------------------------------------------------------------
-- submittal_transmittals — outgoing-to-reviewer / incoming-from-reviewer /
-- forwarded-to-sub log. Every transmission writes a row.
--
-- `document_id` nullable by design — many transmittals are pure log
-- entries without a dedicated cover sheet. `notes` holds the freeform
-- cover-letter body.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "submittal_transmittals" (
  "id"                      uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submittal_id"            uuid                          NOT NULL,
  "direction"               submittal_transmittal_direction NOT NULL,
  "transmitted_at"          timestamp with time zone      NOT NULL DEFAULT now(),
  "transmitted_by_user_id"  uuid                          NOT NULL,
  "document_id"             uuid,
  "notes"                   text,
  "created_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "submittal_transmittals_submittal_id_fk"
    FOREIGN KEY ("submittal_id") REFERENCES "submittals"("id") ON DELETE CASCADE,
  CONSTRAINT "submittal_transmittals_transmitted_by_user_id_fk"
    FOREIGN KEY ("transmitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "submittal_transmittals_document_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "submittal_transmittals_submittal_idx"
  ON "submittal_transmittals" ("submittal_id", "transmitted_at");
