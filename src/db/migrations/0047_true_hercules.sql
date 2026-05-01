CREATE TYPE "public"."time_entry_amendment_action" AS ENUM('submitted', 'approved', 'rejected', 'amended');--> statement-breakpoint
CREATE TYPE "public"."time_entry_status" AS ENUM('running', 'draft', 'submitted', 'approved', 'rejected', 'amended');--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_label" varchar(160),
	"task_code" varchar(40),
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_out_at" timestamp with time zone,
	"duration_minutes" integer,
	"location_lat" numeric(9, 6),
	"location_lng" numeric(9, 6),
	"notes" text,
	"status" time_entry_status DEFAULT 'running' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"client_uuid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_entry_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_entry_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" time_entry_amendment_action NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_entry_amendments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_amendments" ADD CONSTRAINT "time_entry_amendments_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_amendments" ADD CONSTRAINT "time_entry_amendments_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running_per_user_idx" ON "time_entries" USING btree ("user_id") WHERE "time_entries"."status" = 'running';--> statement-breakpoint
CREATE INDEX "time_entries_org_status_idx" ON "time_entries" USING btree ("organization_id","status","clock_in_at");--> statement-breakpoint
CREATE INDEX "time_entries_user_clock_in_idx" ON "time_entries" USING btree ("user_id","clock_in_at");--> statement-breakpoint
CREATE INDEX "time_entries_project_clock_in_idx" ON "time_entries" USING btree ("project_id","clock_in_at");--> statement-breakpoint
CREATE INDEX "time_entry_amendments_entry_created_idx" ON "time_entry_amendments" USING btree ("time_entry_id","created_at");--> statement-breakpoint
CREATE POLICY "time_entries_tenant_isolation" ON "time_entries" AS PERMISSIVE FOR ALL TO public USING ("time_entries"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("time_entries"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "time_entry_amendments_tenant_isolation" ON "time_entry_amendments" AS PERMISSIVE FOR ALL TO public USING (
        "time_entry_amendments"."time_entry_id" IN (
          SELECT id FROM time_entries
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      ) WITH CHECK (
        "time_entry_amendments"."time_entry_id" IN (
          SELECT id FROM time_entries
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      );