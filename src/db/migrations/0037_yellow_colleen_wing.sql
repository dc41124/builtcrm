ALTER TABLE "rfi_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_log_delays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_log_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "submittal_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "rfi_responses_tenant_isolation" ON "rfi_responses" AS PERMISSIVE FOR ALL TO public USING ("rfi_responses"."rfi_id" IN (SELECT id FROM rfis)) WITH CHECK ("rfi_responses"."rfi_id" IN (SELECT id FROM rfis));--> statement-breakpoint
CREATE POLICY "daily_log_amendments_tenant_isolation" ON "daily_log_amendments" AS PERMISSIVE FOR ALL TO public USING ("daily_log_amendments"."daily_log_id" IN (SELECT id FROM daily_logs)) WITH CHECK ("daily_log_amendments"."daily_log_id" IN (SELECT id FROM daily_logs));--> statement-breakpoint
CREATE POLICY "daily_log_crew_entries_tenant_isolation" ON "daily_log_crew_entries" AS PERMISSIVE FOR ALL TO public USING (
        "daily_log_crew_entries"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "daily_log_crew_entries"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "daily_log_crew_entries"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "daily_log_crew_entries"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "daily_log_delays_tenant_isolation" ON "daily_log_delays" AS PERMISSIVE FOR ALL TO public USING ("daily_log_delays"."daily_log_id" IN (SELECT id FROM daily_logs)) WITH CHECK ("daily_log_delays"."daily_log_id" IN (SELECT id FROM daily_logs));--> statement-breakpoint
CREATE POLICY "daily_log_issues_tenant_isolation" ON "daily_log_issues" AS PERMISSIVE FOR ALL TO public USING ("daily_log_issues"."daily_log_id" IN (SELECT id FROM daily_logs)) WITH CHECK ("daily_log_issues"."daily_log_id" IN (SELECT id FROM daily_logs));--> statement-breakpoint
CREATE POLICY "daily_log_photos_tenant_isolation" ON "daily_log_photos" AS PERMISSIVE FOR ALL TO public USING ("daily_log_photos"."daily_log_id" IN (SELECT id FROM daily_logs)) WITH CHECK ("daily_log_photos"."daily_log_id" IN (SELECT id FROM daily_logs));--> statement-breakpoint
CREATE POLICY "submittal_documents_tenant_isolation" ON "submittal_documents" AS PERMISSIVE FOR ALL TO public USING ("submittal_documents"."submittal_id" IN (SELECT id FROM submittals)) WITH CHECK ("submittal_documents"."submittal_id" IN (SELECT id FROM submittals));--> statement-breakpoint
CREATE POLICY "submittal_transmittals_tenant_isolation" ON "submittal_transmittals" AS PERMISSIVE FOR ALL TO public USING ("submittal_transmittals"."submittal_id" IN (SELECT id FROM submittals)) WITH CHECK ("submittal_transmittals"."submittal_id" IN (SELECT id FROM submittals));