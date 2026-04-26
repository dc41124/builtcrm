ALTER POLICY "project_organization_memberships_tenant_isolation" ON "project_organization_memberships" TO public USING (
        "project_organization_memberships"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "project_organization_memberships"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
      ) WITH CHECK (
        "project_organization_memberships"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "project_organization_memberships"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
      );