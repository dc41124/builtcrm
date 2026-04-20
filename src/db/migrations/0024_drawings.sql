-- Migration: Drawings module (Step 44 — 5.1 #44)
-- Date: 2026-04-20
-- Context: The single largest module in Phase 4+. Sheet management, markup,
-- measurement, pinned comments, version chain, sub-scoped read access. V1
-- ships everything the prototype specs (incl. measurements + calibration +
-- compare overlay); deferred: BIM, real-time multi-user markup, advanced
-- annotation, vector-level diff. See docs/specs/builtcrm_drawings_module.jsx
-- for the visual spec.
--
-- Five tables + three enums, plus one additive column on the existing
-- project_organization_memberships table. The column backs sub-scoped
-- discipline filtering in the drawings loader (a sub org with
-- scope_discipline = 'S' only sees structural sheets); contractor,
-- consultant, and client rows stay NULL and see the full set.
--
-- Storage model recap:
--   - Source multi-page PDF lives in R2 keyed by drawing_sets.source_file_key.
--   - Per-page thumbnails live in R2 keyed by drawing_sheets.thumbnail_key.
--   - We do NOT split to per-sheet PDFs on upload; react-pdf selects by
--     page_index from the source. Deferring per-sheet split to V2.
--   - Markup + measurement data are stored as one jsonb doc per user per
--     sheet to avoid per-stroke row thrashing. Viewer debounces 800ms
--     before PUTting the whole doc.
--
-- Pin atomicity note: drawing_comments.pin_number is a per-sheet sequence
-- for root comments (parent_comment_id IS NULL). The action layer computes
-- MAX(pin_number)+1 in a subquery filtered to the same sheet and relies on
-- the unique(sheet_id, pin_number) constraint as a tiebreaker, retrying
-- the insert on conflict. Replies carry pin_number = NULL and are exempt
-- from the unique constraint (Postgres treats NULLs as distinct).
--
-- Markup/measurement carryover on supersession (V1 decision): markups and
-- measurements do NOT migrate to a new version. They stay pinned to the
-- sheet_id they were created on. Rationale: avoids diff-matching logic and
-- prevents stale annotation from anchoring to a sheet whose content moved.
-- The viewer surfaces a "Markups don't carry to new versions" hint when
-- switching version in the dropdown.

-- Enums ---------------------------------------------------------------------

CREATE TYPE "public"."drawing_set_status" AS ENUM(
  'current',
  'superseded',
  'historical'
);

CREATE TYPE "public"."drawing_set_processing_status" AS ENUM(
  'pending',
  'processing',
  'ready',
  'failed'
);

CREATE TYPE "public"."drawing_calibration_source" AS ENUM(
  'title_block',
  'manual'
);

-- project_organization_memberships: discipline scope (nullable) -------------

ALTER TABLE "project_organization_memberships"
  ADD COLUMN "scope_discipline" char(1);

COMMENT ON COLUMN "project_organization_memberships"."scope_discipline" IS
  'Single-char discipline code (A/S/E/M/P/...) used by the drawings loader to scope sheet visibility for subs. NULL = no filter (contractor/consultant/client default).';

-- drawing_sets --------------------------------------------------------------

CREATE TABLE "drawing_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "family" varchar(64) NOT NULL,
  "name" varchar(160) NOT NULL,
  "version" integer NOT NULL,
  "status" "drawing_set_status" DEFAULT 'current' NOT NULL,
  "as_built" boolean DEFAULT false NOT NULL,
  "supersedes_id" uuid,
  "source_file_key" text,
  "file_size_bytes" bigint,
  "sheet_count" integer DEFAULT 0 NOT NULL,
  "uploaded_by_user_id" uuid NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processing_status" "drawing_set_processing_status" DEFAULT 'pending' NOT NULL,
  "processing_error" text,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_supersedes_id_drawing_sets_id_fk"
  FOREIGN KEY ("supersedes_id") REFERENCES "public"."drawing_sets"("id") ON DELETE set null;
ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_uploaded_by_user_id_users_id_fk"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict;

ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_project_family_version_unique"
  UNIQUE ("project_id", "family", "version");

CREATE INDEX "drawing_sets_project_idx" ON "drawing_sets" ("project_id");
CREATE INDEX "drawing_sets_project_status_idx" ON "drawing_sets" ("project_id", "status");
CREATE INDEX "drawing_sets_family_idx" ON "drawing_sets" ("project_id", "family");

-- drawing_sheets ------------------------------------------------------------

CREATE TABLE "drawing_sheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "set_id" uuid NOT NULL,
  "page_index" integer NOT NULL,
  "sheet_number" varchar(40) NOT NULL,
  "sheet_title" varchar(255) NOT NULL,
  "discipline" char(1),
  "auto_detected" boolean DEFAULT false NOT NULL,
  "thumbnail_key" text,
  "changed_from_prior_version" boolean DEFAULT false NOT NULL,
  "calibration_scale" varchar(40),
  "calibration_source" "drawing_calibration_source",
  "calibrated_by_user_id" uuid,
  "calibrated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "drawing_sheets" ADD CONSTRAINT "drawing_sheets_set_id_drawing_sets_id_fk"
  FOREIGN KEY ("set_id") REFERENCES "public"."drawing_sets"("id") ON DELETE cascade;
ALTER TABLE "drawing_sheets" ADD CONSTRAINT "drawing_sheets_calibrated_by_user_id_users_id_fk"
  FOREIGN KEY ("calibrated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;

ALTER TABLE "drawing_sheets" ADD CONSTRAINT "drawing_sheets_set_page_unique"
  UNIQUE ("set_id", "page_index");

CREATE INDEX "drawing_sheets_set_idx" ON "drawing_sheets" ("set_id");
CREATE INDEX "drawing_sheets_set_discipline_idx" ON "drawing_sheets" ("set_id", "discipline");
CREATE INDEX "drawing_sheets_set_sheet_number_idx" ON "drawing_sheets" ("set_id", "sheet_number");

-- drawing_markups -----------------------------------------------------------

CREATE TABLE "drawing_markups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sheet_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "markup_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "drawing_markups" ADD CONSTRAINT "drawing_markups_sheet_id_drawing_sheets_id_fk"
  FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade;
ALTER TABLE "drawing_markups" ADD CONSTRAINT "drawing_markups_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;

ALTER TABLE "drawing_markups" ADD CONSTRAINT "drawing_markups_sheet_user_unique"
  UNIQUE ("sheet_id", "user_id");

CREATE INDEX "drawing_markups_sheet_idx" ON "drawing_markups" ("sheet_id");

-- drawing_measurements ------------------------------------------------------

CREATE TABLE "drawing_measurements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sheet_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "measurement_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "drawing_measurements" ADD CONSTRAINT "drawing_measurements_sheet_id_drawing_sheets_id_fk"
  FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade;
ALTER TABLE "drawing_measurements" ADD CONSTRAINT "drawing_measurements_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;

ALTER TABLE "drawing_measurements" ADD CONSTRAINT "drawing_measurements_sheet_user_unique"
  UNIQUE ("sheet_id", "user_id");

CREATE INDEX "drawing_measurements_sheet_idx" ON "drawing_measurements" ("sheet_id");

-- drawing_comments ----------------------------------------------------------

CREATE TABLE "drawing_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sheet_id" uuid NOT NULL,
  "parent_comment_id" uuid,
  "user_id" uuid NOT NULL,
  "pin_number" integer,
  "x" numeric(5, 2) NOT NULL,
  "y" numeric(5, 2) NOT NULL,
  "text" text NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_by_user_id" uuid,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_sheet_id_drawing_sheets_id_fk"
  FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade;
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_parent_comment_id_drawing_comments_id_fk"
  FOREIGN KEY ("parent_comment_id") REFERENCES "public"."drawing_comments"("id") ON DELETE cascade;
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict;
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_resolved_by_user_id_users_id_fk"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;

ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_sheet_pin_unique"
  UNIQUE ("sheet_id", "pin_number");

CREATE INDEX "drawing_comments_sheet_idx" ON "drawing_comments" ("sheet_id");
CREATE INDEX "drawing_comments_sheet_resolved_idx" ON "drawing_comments" ("sheet_id", "resolved");
CREATE INDEX "drawing_comments_parent_idx" ON "drawing_comments" ("parent_comment_id");
