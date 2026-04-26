ALTER TABLE "selection_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "selection_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "selection_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "selection_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "punch_item_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "punch_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_markups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_measurements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_sheets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transmittal_access_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transmittal_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transmittals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "closeout_package_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "selection_categories_tenant_isolation" ON "selection_categories" AS PERMISSIVE FOR ALL TO public USING (
        "selection_categories"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "selection_categories"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "selection_categories"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "selection_categories"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "selection_decisions_tenant_isolation" ON "selection_decisions" AS PERMISSIVE FOR ALL TO public USING (
        "selection_decisions"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "selection_decisions"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "selection_decisions"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "selection_decisions"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "selection_items_tenant_isolation" ON "selection_items" AS PERMISSIVE FOR ALL TO public USING (
        "selection_items"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "selection_items"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "selection_items"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "selection_items"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "selection_options_tenant_isolation" ON "selection_options" AS PERMISSIVE FOR ALL TO public USING ("selection_options"."selection_item_id" IN (SELECT id FROM selection_items)) WITH CHECK ("selection_options"."selection_item_id" IN (SELECT id FROM selection_items));--> statement-breakpoint
CREATE POLICY "punch_item_comments_tenant_isolation" ON "punch_item_comments" AS PERMISSIVE FOR ALL TO public USING ("punch_item_comments"."punch_item_id" IN (SELECT id FROM punch_items)) WITH CHECK ("punch_item_comments"."punch_item_id" IN (SELECT id FROM punch_items));--> statement-breakpoint
CREATE POLICY "punch_item_photos_tenant_isolation" ON "punch_item_photos" AS PERMISSIVE FOR ALL TO public USING ("punch_item_photos"."punch_item_id" IN (SELECT id FROM punch_items)) WITH CHECK ("punch_item_photos"."punch_item_id" IN (SELECT id FROM punch_items));--> statement-breakpoint
CREATE POLICY "punch_items_tenant_isolation" ON "punch_items" AS PERMISSIVE FOR ALL TO public USING (
        "punch_items"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "punch_items"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "punch_items"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "punch_items"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "drawing_comments_tenant_isolation" ON "drawing_comments" AS PERMISSIVE FOR ALL TO public USING ("drawing_comments"."sheet_id" IN (SELECT id FROM drawing_sheets)) WITH CHECK ("drawing_comments"."sheet_id" IN (SELECT id FROM drawing_sheets));--> statement-breakpoint
CREATE POLICY "drawing_markups_tenant_isolation" ON "drawing_markups" AS PERMISSIVE FOR ALL TO public USING ("drawing_markups"."sheet_id" IN (SELECT id FROM drawing_sheets)) WITH CHECK ("drawing_markups"."sheet_id" IN (SELECT id FROM drawing_sheets));--> statement-breakpoint
CREATE POLICY "drawing_measurements_tenant_isolation" ON "drawing_measurements" AS PERMISSIVE FOR ALL TO public USING ("drawing_measurements"."sheet_id" IN (SELECT id FROM drawing_sheets)) WITH CHECK ("drawing_measurements"."sheet_id" IN (SELECT id FROM drawing_sheets));--> statement-breakpoint
CREATE POLICY "drawing_sets_tenant_isolation" ON "drawing_sets" AS PERMISSIVE FOR ALL TO public USING (
        "drawing_sets"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "drawing_sets"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "drawing_sets"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "drawing_sets"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "drawing_sheets_tenant_isolation" ON "drawing_sheets" AS PERMISSIVE FOR ALL TO public USING ("drawing_sheets"."set_id" IN (SELECT id FROM drawing_sets)) WITH CHECK ("drawing_sheets"."set_id" IN (SELECT id FROM drawing_sets));--> statement-breakpoint
CREATE POLICY "transmittal_access_events_tenant_isolation" ON "transmittal_access_events" AS PERMISSIVE FOR ALL TO public USING ("transmittal_access_events"."recipient_id" IN (SELECT id FROM transmittal_recipients)) WITH CHECK ("transmittal_access_events"."recipient_id" IN (SELECT id FROM transmittal_recipients));--> statement-breakpoint
CREATE POLICY "transmittal_documents_tenant_isolation" ON "transmittal_documents" AS PERMISSIVE FOR ALL TO public USING ("transmittal_documents"."transmittal_id" IN (SELECT id FROM transmittals)) WITH CHECK ("transmittal_documents"."transmittal_id" IN (SELECT id FROM transmittals));--> statement-breakpoint
CREATE POLICY "transmittal_recipients_tenant_isolation" ON "transmittal_recipients" AS PERMISSIVE FOR ALL TO public USING ("transmittal_recipients"."transmittal_id" IN (SELECT id FROM transmittals)) WITH CHECK ("transmittal_recipients"."transmittal_id" IN (SELECT id FROM transmittals));--> statement-breakpoint
CREATE POLICY "transmittals_tenant_isolation" ON "transmittals" AS PERMISSIVE FOR ALL TO public USING (
        "transmittals"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "transmittals"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "transmittals"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "transmittals"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "closeout_package_comments_tenant_isolation" ON "closeout_package_comments" AS PERMISSIVE FOR ALL TO public USING ("closeout_package_comments"."package_id" IN (SELECT id FROM closeout_packages)) WITH CHECK ("closeout_package_comments"."package_id" IN (SELECT id FROM closeout_packages));--> statement-breakpoint
CREATE POLICY "closeout_package_items_tenant_isolation" ON "closeout_package_items" AS PERMISSIVE FOR ALL TO public USING ("closeout_package_items"."section_id" IN (SELECT id FROM closeout_package_sections)) WITH CHECK ("closeout_package_items"."section_id" IN (SELECT id FROM closeout_package_sections));--> statement-breakpoint
CREATE POLICY "closeout_package_sections_tenant_isolation" ON "closeout_package_sections" AS PERMISSIVE FOR ALL TO public USING ("closeout_package_sections"."package_id" IN (SELECT id FROM closeout_packages)) WITH CHECK ("closeout_package_sections"."package_id" IN (SELECT id FROM closeout_packages));