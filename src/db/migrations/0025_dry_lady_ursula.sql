ALTER TABLE "compliance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "compliance_records_tenant_isolation" ON "compliance_records" AS PERMISSIVE FOR ALL TO public USING (
        "compliance_records"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "compliance_records"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "compliance_records"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "compliance_records"."organization_id" = current_setting('app.current_org_id', true)::uuid
        OR "compliance_records"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "compliance_records"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );