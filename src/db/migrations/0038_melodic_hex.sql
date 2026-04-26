ALTER TABLE "prequal_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prequal_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "prequal_documents_tenant_isolation" ON "prequal_documents" AS PERMISSIVE FOR ALL TO public USING ("prequal_documents"."submission_id" IN (SELECT id FROM prequal_submissions)) WITH CHECK ("prequal_documents"."submission_id" IN (SELECT id FROM prequal_submissions));--> statement-breakpoint
CREATE POLICY "prequal_submissions_tenant_isolation" ON "prequal_submissions" AS PERMISSIVE FOR ALL TO public USING (
        "prequal_submissions"."submitted_by_org_id" = current_setting('app.current_org_id', true)::uuid
        OR "prequal_submissions"."contractor_org_id" = current_setting('app.current_org_id', true)::uuid
      ) WITH CHECK (
        "prequal_submissions"."submitted_by_org_id" = current_setting('app.current_org_id', true)::uuid
        OR "prequal_submissions"."contractor_org_id" = current_setting('app.current_org_id', true)::uuid
      );--> statement-breakpoint
CREATE POLICY "prequal_templates_tenant_isolation" ON "prequal_templates" AS PERMISSIVE FOR ALL TO public USING ("prequal_templates"."org_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("prequal_templates"."org_id" = current_setting('app.current_org_id', true)::uuid);