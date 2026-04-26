ALTER TABLE "role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_organization_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "role_assignments_tenant_isolation" ON "role_assignments" AS PERMISSIVE FOR ALL TO public USING ("role_assignments"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("role_assignments"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "project_organization_memberships_tenant_isolation" ON "project_organization_memberships" AS PERMISSIVE FOR ALL TO public USING (
        "project_organization_memberships"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "project_organization_memberships"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "project_organization_memberships"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "project_organization_memberships"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "project_organization_memberships"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "project_organization_memberships"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "project_user_memberships_tenant_isolation" ON "project_user_memberships" AS PERMISSIVE FOR ALL TO public USING (
        "project_user_memberships"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "project_user_memberships"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "project_user_memberships"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "project_user_memberships"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "project_user_memberships"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "project_user_memberships"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );