-- Migration: punch list module (Step 19 / 4B.3 #19)
-- Date: 2026-04-18
-- Context: closeout punch items with state machine, photo attachments,
-- and coordination thread. Contractor-authored, subcontractor-assigned,
-- residential client gets a read-only "Walkthrough Items" view when
-- project.currentPhase = 'closeout'.
--
-- State machine enforced at the action layer (see src/lib/punch-list/
-- config.ts and the transition action). Every transition auto-posts a
-- system comment with locked phrasing per the Step 19 handoff doc.
--
-- `clientFacingNote` is the homeowner-visible blurb authored separately
-- from the internal comment thread so contractors can curate client
-- copy without sanitizing coordination chat.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "punch_item_priority" AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "punch_item_status" AS ENUM (
    'open', 'in_progress', 'ready_to_verify', 'verified', 'rejected', 'void'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- punch_items — one row per walkthrough/closeout item.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "punch_items" (
  "id"                      uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id"              uuid                          NOT NULL,
  "sequential_number"       integer                       NOT NULL,
  "title"                   varchar(255)                  NOT NULL,
  "description"             text                          NOT NULL,
  "location"                text,
  "priority"                punch_item_priority           NOT NULL DEFAULT 'normal',
  "status"                  punch_item_status             NOT NULL DEFAULT 'open',
  "assignee_org_id"         uuid,
  "assignee_user_id"        uuid,
  "due_date"                date,
  "created_by_user_id"      uuid                          NOT NULL,
  "rejection_reason"        text,
  "void_reason"             text,
  "verified_by_user_id"     uuid,
  "verified_at"             timestamp with time zone,
  "last_transition_at"      timestamp with time zone      NOT NULL DEFAULT now(),
  "client_facing_note"      text,
  "created_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "punch_items_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "punch_items_assignee_org_id_fk"
    FOREIGN KEY ("assignee_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL,
  CONSTRAINT "punch_items_assignee_user_id_fk"
    FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "punch_items_created_by_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "punch_items_verified_by_user_id_fk"
    FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "punch_items_project_number_unique"
    UNIQUE ("project_id", "sequential_number")
);

CREATE INDEX IF NOT EXISTS "punch_items_project_status_priority_idx"
  ON "punch_items" ("project_id", "status", "priority");
CREATE INDEX IF NOT EXISTS "punch_items_assignee_status_idx"
  ON "punch_items" ("assignee_org_id", "status");

-- ---------------------------------------------------------------------------
-- punch_item_photos — join to documents (same pattern as daily_log_photos).
-- No isHero flag; punch items don't need a featured photo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "punch_item_photos" (
  "id"                      uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "punch_item_id"           uuid                          NOT NULL,
  "document_id"             uuid                          NOT NULL,
  "caption"                 text,
  "sort_order"              integer                       NOT NULL DEFAULT 0,
  "uploaded_by_user_id"     uuid                          NOT NULL,
  "created_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "punch_item_photos_punch_item_id_fk"
    FOREIGN KEY ("punch_item_id") REFERENCES "punch_items"("id") ON DELETE CASCADE,
  CONSTRAINT "punch_item_photos_document_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
  CONSTRAINT "punch_item_photos_uploaded_by_user_id_fk"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "punch_item_photos_item_idx"
  ON "punch_item_photos" ("punch_item_id");

-- ---------------------------------------------------------------------------
-- punch_item_comments — coordination thread with system-entry flag.
-- System comments are auto-posted on every state transition using the
-- locked phrasing from the Step 19 handoff doc (e.g. "Rachel rejected —
-- 'caulk needs smoothing'"). author_user_id is null for system rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "punch_item_comments" (
  "id"                      uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "punch_item_id"           uuid                          NOT NULL,
  "author_user_id"          uuid,
  "body"                    text                          NOT NULL,
  "is_system"               boolean                       NOT NULL DEFAULT false,
  "created_at"              timestamp with time zone      NOT NULL DEFAULT now(),
  CONSTRAINT "punch_item_comments_punch_item_id_fk"
    FOREIGN KEY ("punch_item_id") REFERENCES "punch_items"("id") ON DELETE CASCADE,
  CONSTRAINT "punch_item_comments_author_user_id_fk"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "punch_item_comments_item_idx"
  ON "punch_item_comments" ("punch_item_id");
