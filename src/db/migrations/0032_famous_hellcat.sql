ALTER TABLE "daily_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "daily_logs_tenant_isolation" ON "daily_logs" AS PERMISSIVE FOR ALL TO public USING (
        "daily_logs"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "daily_logs"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "daily_logs"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "daily_logs"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );