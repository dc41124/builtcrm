CREATE TYPE "public"."prequal_enforcement_mode" AS ENUM('off', 'warn', 'block');--> statement-breakpoint
CREATE TYPE "public"."prequal_document_type" AS ENUM('bond', 'insurance', 'safety_manual', 'references', 'financial_statements');--> statement-breakpoint
CREATE TYPE "public"."prequal_submission_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "prequal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"document_type" "prequal_document_type" NOT NULL,
	"storage_key" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prequal_project_exemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sub_org_id" uuid NOT NULL,
	"contractor_org_id" uuid NOT NULL,
	"granted_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "prequal_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"submitted_by_org_id" uuid NOT NULL,
	"contractor_org_id" uuid NOT NULL,
	"answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_total" integer,
	"gating_failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "prequal_submission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewer_notes" text,
	"expires_at" timestamp with time zone,
	"reminders_sent_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prequal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trade_category" varchar(120),
	"is_default" boolean DEFAULT false NOT NULL,
	"validity_months" integer DEFAULT 12,
	"questions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scoring_rules" jsonb DEFAULT '{"passThreshold": 0, "gatingFailValues": {}}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "prequal_enforcement_mode" "prequal_enforcement_mode" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_documents" ADD CONSTRAINT "prequal_documents_submission_id_prequal_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."prequal_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_documents" ADD CONSTRAINT "prequal_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD CONSTRAINT "prequal_project_exemptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD CONSTRAINT "prequal_project_exemptions_sub_org_id_organizations_id_fk" FOREIGN KEY ("sub_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD CONSTRAINT "prequal_project_exemptions_contractor_org_id_organizations_id_fk" FOREIGN KEY ("contractor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD CONSTRAINT "prequal_project_exemptions_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD CONSTRAINT "prequal_project_exemptions_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD CONSTRAINT "prequal_submissions_template_id_prequal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prequal_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD CONSTRAINT "prequal_submissions_submitted_by_org_id_organizations_id_fk" FOREIGN KEY ("submitted_by_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD CONSTRAINT "prequal_submissions_contractor_org_id_organizations_id_fk" FOREIGN KEY ("contractor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD CONSTRAINT "prequal_submissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_templates" ADD CONSTRAINT "prequal_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prequal_templates" ADD CONSTRAINT "prequal_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prequal_documents_submission_idx" ON "prequal_documents" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "prequal_documents_type_idx" ON "prequal_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "prequal_documents_submission_type_idx" ON "prequal_documents" USING btree ("submission_id","document_type");--> statement-breakpoint
CREATE INDEX "prequal_project_exemptions_project_sub_idx" ON "prequal_project_exemptions" USING btree ("project_id","sub_org_id");--> statement-breakpoint
CREATE INDEX "prequal_project_exemptions_contractor_idx" ON "prequal_project_exemptions" USING btree ("contractor_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prequal_project_exemptions_active_unique" ON "prequal_project_exemptions" USING btree ("project_id","sub_org_id") WHERE "prequal_project_exemptions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "prequal_submissions_pair_idx" ON "prequal_submissions" USING btree ("submitted_by_org_id","contractor_org_id");--> statement-breakpoint
CREATE INDEX "prequal_submissions_contractor_status_idx" ON "prequal_submissions" USING btree ("contractor_org_id","status");--> statement-breakpoint
CREATE INDEX "prequal_submissions_sub_idx" ON "prequal_submissions" USING btree ("submitted_by_org_id");--> statement-breakpoint
CREATE INDEX "prequal_submissions_template_idx" ON "prequal_submissions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "prequal_submissions_status_idx" ON "prequal_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prequal_submissions_expiry_idx" ON "prequal_submissions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "prequal_templates_org_idx" ON "prequal_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "prequal_templates_trade_idx" ON "prequal_templates" USING btree ("org_id","trade_category");--> statement-breakpoint
CREATE INDEX "prequal_templates_archived_idx" ON "prequal_templates" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prequal_templates_default_unique" ON "prequal_templates" USING btree ("org_id","trade_category") WHERE "prequal_templates"."is_default" = true;