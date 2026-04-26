ALTER TABLE "change_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rfis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "submittals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "change_orders_tenant_isolation" ON "change_orders" AS PERMISSIVE FOR ALL TO public USING (
        "change_orders"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "change_orders"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "change_orders"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "change_orders"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "rfis_tenant_isolation" ON "rfis" AS PERMISSIVE FOR ALL TO public USING (
        "rfis"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "rfis"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "rfis"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "rfis"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "submittals_tenant_isolation" ON "submittals" AS PERMISSIVE FOR ALL TO public USING (
        "submittals"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "submittals"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "submittals"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "submittals"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );