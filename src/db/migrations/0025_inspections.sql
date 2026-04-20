-- Migration: Inspections module (Step 45 — 5.1 #45)
-- Date: 2026-04-20
-- Context: QA/QC checklists distinct from milestones. Template library
-- → contractor creates an inspection from template → assigned sub
-- completes on mobile → pass/fail/conditional/na per line item →
-- fail/conditional auto-spawn punch_items linked back via
-- punch_items.source_inspection_result_id. See
-- docs/specs/builtcrm_inspections_module.jsx for the visual spec.
--
-- Three new tables + three enums, plus two additive nullable columns
-- on the existing punch_items table (back-link to originating
-- inspection + result). Existing punch items are unaffected.
--
-- Template snapshot note: inspections carry their own frozen copy of
-- the template's line items in template_snapshot_json at create time.
-- Later template edits do NOT rewrite history — QA regulators expect
-- the recorded checklist to match what was physically inspected.
-- Results reference items by `key`; the key is stable across label
-- edits, so edits to the inspection's own snapshot (labels, refs)
-- don't orphan results.
--
-- Pass-rate calculation (JSX spec): excludes `na` outcomes.
--   rate = count(pass) / count(pass) + count(fail) + count(conditional)

-- Enums ---------------------------------------------------------------------

CREATE TYPE "public"."inspection_status" AS ENUM(
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE "public"."inspection_outcome" AS ENUM(
  'pass',
  'fail',
  'conditional',
  'na'
);

CREATE TYPE "public"."inspection_phase" AS ENUM(
  'rough',
  'final'
);

-- inspection_templates ------------------------------------------------------

CREATE TABLE "inspection_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "trade_category" varchar(40) NOT NULL,
  "phase" "inspection_phase" NOT NULL,
  "description" text,
  "line_items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_custom" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;

CREATE INDEX "inspection_templates_org_archived_idx" ON "inspection_templates" ("org_id", "is_archived");
CREATE INDEX "inspection_templates_org_trade_idx" ON "inspection_templates" ("org_id", "trade_category");

COMMENT ON COLUMN "inspection_templates"."line_items_json" IS
  'Array of { key, orderIndex, label, ref?, photoRequired? }. Keys are slug-form and stable across label edits so historical results can still reference them.';
COMMENT ON COLUMN "inspection_templates"."is_custom" IS
  'false for seeded library templates, true for user-created. Drives the "CUSTOM" badge in the template grid.';
COMMENT ON COLUMN "inspection_templates"."trade_category" IS
  'Free-text category. Seed + create UI restrict to framing/electrical/plumbing/hvac/insulation/drywall/general but the column accepts anything so custom categories don''t require a migration.';

-- inspections ---------------------------------------------------------------

CREATE TABLE "inspections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "sequential_number" integer NOT NULL,
  "template_id" uuid NOT NULL,
  "template_snapshot_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "zone" varchar(80) NOT NULL,
  "assigned_org_id" uuid,
  "assigned_user_id" uuid,
  "scheduled_date" date,
  "status" "inspection_status" DEFAULT 'scheduled' NOT NULL,
  "notes" text,
  "created_by_user_id" uuid NOT NULL,
  "completed_by_user_id" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "inspections" ADD CONSTRAINT "inspections_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_template_id_inspection_templates_id_fk"
  FOREIGN KEY ("template_id") REFERENCES "public"."inspection_templates"("id") ON DELETE restrict;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_assigned_org_id_organizations_id_fk"
  FOREIGN KEY ("assigned_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_assigned_user_id_users_id_fk"
  FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_completed_by_user_id_users_id_fk"
  FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;

ALTER TABLE "inspections" ADD CONSTRAINT "inspections_project_number_unique"
  UNIQUE ("project_id", "sequential_number");

CREATE INDEX "inspections_project_status_idx" ON "inspections" ("project_id", "status");
CREATE INDEX "inspections_assigned_org_status_idx" ON "inspections" ("assigned_org_id", "status");
CREATE INDEX "inspections_template_idx" ON "inspections" ("template_id");

COMMENT ON COLUMN "inspections"."template_snapshot_json" IS
  'Frozen copy of the template.line_items_json at inspection create time. Template edits after creation do NOT change this snapshot. Results reference items by `key`.';
COMMENT ON COLUMN "inspections"."sequential_number" IS
  'Per-project human-readable identifier (INS-0001, INS-0002, ...). Action layer computes max+1 inside the create transaction.';

-- inspection_results --------------------------------------------------------

CREATE TABLE "inspection_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inspection_id" uuid NOT NULL,
  "line_item_key" varchar(80) NOT NULL,
  "outcome" "inspection_outcome" NOT NULL,
  "notes" text,
  "recorded_by_user_id" uuid,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspection_id_inspections_id_fk"
  FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade;
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_recorded_by_user_id_users_id_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;

ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspection_key_unique"
  UNIQUE ("inspection_id", "line_item_key");

CREATE INDEX "inspection_results_inspection_idx" ON "inspection_results" ("inspection_id");

-- inspection_result_photos --------------------------------------------------

CREATE TABLE "inspection_result_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inspection_result_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "caption" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "uploaded_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "inspection_result_photos" ADD CONSTRAINT "inspection_result_photos_inspection_result_id_inspection_results_id_fk"
  FOREIGN KEY ("inspection_result_id") REFERENCES "public"."inspection_results"("id") ON DELETE cascade;
ALTER TABLE "inspection_result_photos" ADD CONSTRAINT "inspection_result_photos_document_id_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade;
ALTER TABLE "inspection_result_photos" ADD CONSTRAINT "inspection_result_photos_uploaded_by_user_id_users_id_fk"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict;

CREATE INDEX "inspection_result_photos_result_idx" ON "inspection_result_photos" ("inspection_result_id");

-- punch_items: source inspection back-link ----------------------------------

ALTER TABLE "punch_items"
  ADD COLUMN "source_inspection_id" uuid,
  ADD COLUMN "source_inspection_result_id" uuid;

ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_source_inspection_id_inspections_id_fk"
  FOREIGN KEY ("source_inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null;
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_source_inspection_result_id_inspection_results_id_fk"
  FOREIGN KEY ("source_inspection_result_id") REFERENCES "public"."inspection_results"("id") ON DELETE set null;

CREATE INDEX "punch_items_source_inspection_idx" ON "punch_items" ("source_inspection_id");

COMMENT ON COLUMN "punch_items"."source_inspection_id" IS
  'NULL for manually-created items; populated when auto-spawned by a fail/conditional inspection result (Step 45). set null on delete so historical punch items survive parent inspection cleanup.';
