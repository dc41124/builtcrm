CREATE TABLE "photo_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"x" numeric(7, 6) NOT NULL,
	"y" numeric(7, 6) NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_pins_x_range" CHECK ("photo_pins"."x" BETWEEN 0 AND 1),
	CONSTRAINT "photo_pins_y_range" CHECK ("photo_pins"."y" BETWEEN 0 AND 1)
);
--> statement-breakpoint
ALTER TABLE "photo_pins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD CONSTRAINT "photo_pins_sheet_id_drawing_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD CONSTRAINT "photo_pins_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD CONSTRAINT "photo_pins_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD CONSTRAINT "photo_pins_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_pins_sheet_created_idx" ON "photo_pins" USING btree ("sheet_id","created_at");--> statement-breakpoint
CREATE INDEX "photo_pins_document_idx" ON "photo_pins" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "photo_pins_project_idx" ON "photo_pins" USING btree ("project_id");--> statement-breakpoint
CREATE POLICY "photo_pins_tenant_isolation" ON "photo_pins" AS PERMISSIVE FOR ALL TO public USING (
        "photo_pins"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "photo_pins"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "photo_pins"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "photo_pins"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );