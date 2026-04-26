ALTER TABLE "lien_waivers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lien_waivers_tenant_isolation" ON "lien_waivers" AS PERMISSIVE FOR ALL TO public USING (
        "lien_waivers"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "lien_waivers"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "lien_waivers"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "lien_waivers"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "lien_waivers"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "lien_waivers"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );