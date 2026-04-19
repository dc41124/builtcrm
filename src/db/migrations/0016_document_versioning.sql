-- Migration: document versioning (Step 22 / 4B.4 #22)
-- Date: 2026-04-18
-- Context: replaces the pre-existing link-row supersession pattern
-- (`document_links.link_role = 'supersedes'`) with a first-class
-- `supersedes_document_id` column on the documents table. Rationale:
--   - Self-reference column reads cleaner than a pivot join at load time
--   - Partial unique index enforces chain linearity at the DB level (one
--     direct successor per document; no branches)
--   - Cross-module pinning (`pin_version`) on link tables is a sibling
--     concept we want alongside, not threaded through pivot link roles
--
-- Backfills any existing `link_role='supersedes'` rows into the new
-- column so the transition is lossless, then drops those rows since
-- the column now owns the relationship. Safe-to-run on fresh + seeded
-- databases; both the backfill and delete are idempotent if re-run.

-- ---------------------------------------------------------------------------
-- 1. Add supersedes_document_id column + indexes.
-- ---------------------------------------------------------------------------
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "supersedes_document_id" uuid
  REFERENCES "documents"("id") ON DELETE SET NULL;

-- Walk-forward queries: "who supersedes this doc?"
CREATE INDEX IF NOT EXISTS "documents_supersedes_idx"
  ON "documents" ("supersedes_document_id");

-- Linearity enforcement: a document can be superseded by at most one
-- successor. Partial unique (nullable column allows many NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS "documents_supersedes_unique"
  ON "documents" ("supersedes_document_id")
  WHERE "supersedes_document_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Backfill from the link-row pivot. If any rows exist with
--    (linked_object_type='document', link_role='supersedes') we copy the
--    predecessor id into the successor's new column, then drop the pivot
--    rows. Idempotent: if no rows match nothing happens.
-- ---------------------------------------------------------------------------
UPDATE "documents" d
SET "supersedes_document_id" = dl."linked_object_id"
FROM "document_links" dl
WHERE dl."document_id" = d."id"
  AND dl."linked_object_type" = 'document'
  AND dl."link_role" = 'supersedes'
  AND d."supersedes_document_id" IS NULL;

DELETE FROM "document_links"
WHERE "linked_object_type" = 'document'
  AND "link_role" = 'supersedes';

-- ---------------------------------------------------------------------------
-- 3. pin_version flag on cross-module link tables.
--
-- When true, the linking module displays the exact document version
-- present at attach time rather than walking forward to the current
-- version. Needed for legally-attached docs (approved submittals,
-- executed change orders, lien waivers) where "what was agreed to" is
-- materially different from "the latest file on the project."
--
-- Default false = existing behaviour (follow chain to latest).
-- Individual modules opt into pinning via UPDATE inside their
-- state-transition actions (e.g. submittals pin on terminal
-- transitions). Step 22 adds the column everywhere and wires the
-- pinning rule for submittals; change orders follow in a later step.
-- ---------------------------------------------------------------------------
ALTER TABLE "document_links"
  ADD COLUMN IF NOT EXISTS "pin_version" boolean NOT NULL DEFAULT false;

ALTER TABLE "submittal_documents"
  ADD COLUMN IF NOT EXISTS "pin_version" boolean NOT NULL DEFAULT false;
