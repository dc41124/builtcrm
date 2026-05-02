CREATE TYPE "public"."dsar_province" AS ENUM('QC', 'ON', 'BC', 'AB', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."dsar_request_type" AS ENUM('access', 'deletion', 'rectification', 'portability');--> statement-breakpoint
CREATE TYPE "public"."dsar_status" AS ENUM('received', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TABLE "dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" varchar(32) NOT NULL,
	"organization_id" uuid NOT NULL,
	"requester_name" varchar(200) NOT NULL,
	"requester_email" varchar(320) NOT NULL,
	"account_email" varchar(320),
	"province" "dsar_province" DEFAULT 'QC' NOT NULL,
	"subject_user_id" uuid,
	"request_type" "dsar_request_type" NOT NULL,
	"description" text NOT NULL,
	"status" "dsar_status" DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_due_at" timestamp with time zone NOT NULL,
	"assigned_to_user_id" uuid,
	"completed_at" timestamp with time zone,
	"notes" text,
	"project_context" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dsar_requests_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
CREATE TABLE "privacy_officers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"designated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"designated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_officers_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "privacy_officers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_officers" ADD CONSTRAINT "privacy_officers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_officers" ADD CONSTRAINT "privacy_officers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_officers" ADD CONSTRAINT "privacy_officers_designated_by_user_id_users_id_fk" FOREIGN KEY ("designated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dsar_requests_organization_id_idx" ON "dsar_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dsar_requests_status_idx" ON "dsar_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dsar_requests_sla_due_at_idx" ON "dsar_requests" USING btree ("sla_due_at");--> statement-breakpoint
CREATE POLICY "privacy_officers_tenant_isolation" ON "privacy_officers" AS PERMISSIVE FOR ALL TO public USING ("privacy_officers"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("privacy_officers"."organization_id" = current_setting('app.current_org_id', true)::uuid);