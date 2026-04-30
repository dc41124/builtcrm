CREATE TYPE "public"."safety_form_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."safety_form_type" AS ENUM('toolbox_talk', 'jha', 'incident_report', 'near_miss');--> statement-breakpoint
CREATE TYPE "public"."safety_severity" AS ENUM('first_aid', 'recordable', 'lost_time', 'fatality', 'property_damage', 'environmental');--> statement-breakpoint
CREATE TABLE "safety_form_counters" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_form_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "safety_form_incidents" (
	"safety_form_id" uuid PRIMARY KEY NOT NULL,
	"severity" "safety_severity" NOT NULL,
	"incident_at" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"description" text,
	"root_cause_text" text,
	"injured_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"corrective_actions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_form_incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "safety_form_template_assignments" (
	"template_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safety_form_template_assignments_org_wide_unique" UNIQUE("template_id","organization_id"),
	CONSTRAINT "safety_form_template_assignments_project_unique" UNIQUE("template_id","organization_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "safety_form_template_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "safety_form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_type" "safety_form_type" NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"fields_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"times_used" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_form_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "safety_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"form_type" "safety_form_type" NOT NULL,
	"form_number" varchar(20) NOT NULL,
	"status" "safety_form_status" DEFAULT 'draft' NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"submitted_by_org_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"title" varchar(240) NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"client_uuid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safety_forms_form_number_unique" UNIQUE("submitted_by_org_id","form_number"),
	CONSTRAINT "safety_forms_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
ALTER TABLE "safety_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "safety_form_counters" ADD CONSTRAINT "safety_form_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_incidents" ADD CONSTRAINT "safety_form_incidents_safety_form_id_safety_forms_id_fk" FOREIGN KEY ("safety_form_id") REFERENCES "public"."safety_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_template_assignments" ADD CONSTRAINT "safety_form_template_assignments_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."safety_form_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_template_assignments" ADD CONSTRAINT "safety_form_template_assignments_org_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_template_assignments" ADD CONSTRAINT "safety_form_template_assignments_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_template_assignments" ADD CONSTRAINT "safety_form_template_assignments_assigned_by_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_templates" ADD CONSTRAINT "safety_form_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_form_templates" ADD CONSTRAINT "safety_form_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD CONSTRAINT "safety_forms_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD CONSTRAINT "safety_forms_template_id_safety_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."safety_form_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD CONSTRAINT "safety_forms_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD CONSTRAINT "safety_forms_submitted_by_org_id_organizations_id_fk" FOREIGN KEY ("submitted_by_org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "safety_form_incidents_severity_idx" ON "safety_form_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "safety_form_incidents_incident_at_idx" ON "safety_form_incidents" USING btree ("incident_at");--> statement-breakpoint
CREATE INDEX "safety_form_template_assignments_org_idx" ON "safety_form_template_assignments" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "safety_form_templates_org_type_idx" ON "safety_form_templates" USING btree ("organization_id","form_type","is_archived");--> statement-breakpoint
CREATE INDEX "safety_forms_project_status_idx" ON "safety_forms" USING btree ("project_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "safety_forms_project_type_idx" ON "safety_forms" USING btree ("project_id","form_type");--> statement-breakpoint
CREATE INDEX "safety_forms_submitted_by_org_idx" ON "safety_forms" USING btree ("submitted_by_org_id");--> statement-breakpoint
CREATE INDEX "safety_forms_flagged_idx" ON "safety_forms" USING btree ("project_id","flagged");--> statement-breakpoint
CREATE POLICY "safety_form_counters_tenant_isolation" ON "safety_form_counters" AS PERMISSIVE FOR ALL TO public USING ("safety_form_counters"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("safety_form_counters"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "safety_form_incidents_tenant_isolation" ON "safety_form_incidents" AS PERMISSIVE FOR ALL TO public USING (
        "safety_form_incidents"."safety_form_id" IN (
          SELECT id FROM safety_forms
          WHERE project_id IN (
            SELECT id FROM projects
            WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
          )
          OR project_id IN (
            SELECT project_id FROM project_organization_memberships
            WHERE organization_id = current_setting('app.current_org_id', true)::uuid
              AND membership_status = 'active'
          )
        )
      ) WITH CHECK (
        "safety_form_incidents"."safety_form_id" IN (
          SELECT id FROM safety_forms
          WHERE project_id IN (
            SELECT id FROM projects
            WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
          )
          OR project_id IN (
            SELECT project_id FROM project_organization_memberships
            WHERE organization_id = current_setting('app.current_org_id', true)::uuid
              AND membership_status = 'active'
          )
        )
      );--> statement-breakpoint
CREATE POLICY "safety_form_template_assignments_tenant_isolation" ON "safety_form_template_assignments" AS PERMISSIVE FOR ALL TO public USING (
        "safety_form_template_assignments"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "safety_form_template_assignments"."template_id" IN (
          SELECT id FROM safety_form_templates
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      ) WITH CHECK (
        "safety_form_template_assignments"."template_id" IN (
          SELECT id FROM safety_form_templates
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      );--> statement-breakpoint
CREATE POLICY "safety_form_templates_tenant_isolation" ON "safety_form_templates" AS PERMISSIVE FOR ALL TO public USING ("safety_form_templates"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("safety_form_templates"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "safety_forms_tenant_isolation" ON "safety_forms" AS PERMISSIVE FOR ALL TO public USING (
        "safety_forms"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "safety_forms"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "safety_forms"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "safety_forms"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );