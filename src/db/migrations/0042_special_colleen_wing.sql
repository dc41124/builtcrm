ALTER TABLE "billing_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retainage_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedule_of_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sov_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "billing_packages_tenant_isolation" ON "billing_packages" AS PERMISSIVE FOR ALL TO public USING (
        "billing_packages"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "billing_packages"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "billing_packages"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "billing_packages"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "draw_line_items_tenant_isolation" ON "draw_line_items" AS PERMISSIVE FOR ALL TO public USING ("draw_line_items"."draw_request_id" IN (SELECT id FROM draw_requests)) WITH CHECK ("draw_line_items"."draw_request_id" IN (SELECT id FROM draw_requests));--> statement-breakpoint
CREATE POLICY "draw_requests_tenant_isolation" ON "draw_requests" AS PERMISSIVE FOR ALL TO public USING (
        "draw_requests"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "draw_requests"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "draw_requests"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "draw_requests"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "retainage_releases_tenant_isolation" ON "retainage_releases" AS PERMISSIVE FOR ALL TO public USING (
        "retainage_releases"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "retainage_releases"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "retainage_releases"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "retainage_releases"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "schedule_of_values_tenant_isolation" ON "schedule_of_values" AS PERMISSIVE FOR ALL TO public USING (
        "schedule_of_values"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "schedule_of_values"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "schedule_of_values"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "schedule_of_values"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "sov_line_items_tenant_isolation" ON "sov_line_items" AS PERMISSIVE FOR ALL TO public USING ("sov_line_items"."sov_id" IN (SELECT id FROM schedule_of_values)) WITH CHECK ("sov_line_items"."sov_id" IN (SELECT id FROM schedule_of_values));