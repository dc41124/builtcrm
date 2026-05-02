CREATE TYPE "public"."breach_notification_status" AS ENUM('draft', 'sent', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."breach_notify_decision" AS ENUM('pending', 'notify', 'no_notify');--> statement-breakpoint
CREATE TYPE "public"."breach_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."breach_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('data_processing', 'marketing_email', 'product_updates', 'analytics', 'third_party_integrations');--> statement-breakpoint
CREATE TABLE "breach_notification_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"breach_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"recipient_user_id" uuid,
	"subject_line" varchar(300) NOT NULL,
	"body_text" text NOT NULL,
	"status" "breach_notification_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "breach_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" varchar(32) NOT NULL,
	"organization_id" uuid NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	"occurred_at" timestamp with time zone,
	"occurred_at_note" varchar(120),
	"severity" "breach_severity" NOT NULL,
	"affected_count" integer,
	"affected_description" text NOT NULL,
	"data_types_affected" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"containment_actions" text,
	"notify_users_decision" "breach_notify_decision" DEFAULT 'pending' NOT NULL,
	"notified_users_at" timestamp with time zone,
	"reported_to_cai_at" timestamp with time zone,
	"status" "breach_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"logged_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "breach_register_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
ALTER TABLE "breach_register" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_user_id" uuid,
	"subject_email" varchar(320),
	"consent_type" "consent_type" NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"source" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_records_subject_identifier_check" CHECK ("consent_records"."subject_user_id" IS NOT NULL OR "consent_records"."subject_email" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD CONSTRAINT "breach_notification_drafts_breach_id_breach_register_id_fk" FOREIGN KEY ("breach_id") REFERENCES "public"."breach_register"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD CONSTRAINT "breach_notification_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD CONSTRAINT "breach_notification_drafts_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD CONSTRAINT "breach_notification_drafts_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_register" ADD CONSTRAINT "breach_register_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_register" ADD CONSTRAINT "breach_register_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breach_register" ADD CONSTRAINT "breach_register_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "breach_notification_drafts_breach_idx" ON "breach_notification_drafts" USING btree ("breach_id");--> statement-breakpoint
CREATE INDEX "breach_notification_drafts_org_status_idx" ON "breach_notification_drafts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "breach_register_org_status_idx" ON "breach_register" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "breach_register_org_discovered_idx" ON "breach_register" USING btree ("organization_id","discovered_at");--> statement-breakpoint
CREATE INDEX "consent_records_org_user_idx" ON "consent_records" USING btree ("organization_id","subject_user_id");--> statement-breakpoint
CREATE INDEX "consent_records_org_email_idx" ON "consent_records" USING btree ("organization_id","subject_email");--> statement-breakpoint
CREATE INDEX "consent_records_org_type_granted_idx" ON "consent_records" USING btree ("organization_id","consent_type","granted");--> statement-breakpoint
CREATE POLICY "breach_notification_drafts_tenant_isolation" ON "breach_notification_drafts" AS PERMISSIVE FOR ALL TO public USING ("breach_notification_drafts"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("breach_notification_drafts"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "breach_register_tenant_isolation" ON "breach_register" AS PERMISSIVE FOR ALL TO public USING ("breach_register"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("breach_register"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "consent_records_tenant_isolation" ON "consent_records" AS PERMISSIVE FOR ALL TO public USING ("consent_records"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("consent_records"."organization_id" = current_setting('app.current_org_id', true)::uuid);