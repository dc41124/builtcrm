ALTER TABLE "user_notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "upload_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inspection_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_notification_preferences_tenant_isolation" ON "user_notification_preferences" AS PERMISSIVE FOR ALL TO public USING ("user_notification_preferences"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid) WITH CHECK ("user_notification_preferences"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "milestone_dependencies_tenant_isolation" ON "milestone_dependencies" AS PERMISSIVE FOR ALL TO public USING ("milestone_dependencies"."predecessor_id" IN (SELECT id FROM milestones)) WITH CHECK ("milestone_dependencies"."predecessor_id" IN (SELECT id FROM milestones));--> statement-breakpoint
CREATE POLICY "approvals_tenant_isolation" ON "approvals" AS PERMISSIVE FOR ALL TO public USING (
        "approvals"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "approvals"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "approvals"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "approvals"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "upload_requests_tenant_isolation" ON "upload_requests" AS PERMISSIVE FOR ALL TO public USING (
        "upload_requests"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "upload_requests"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      ) WITH CHECK (
        "upload_requests"."project_id" IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR "upload_requests"."project_id" IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      );--> statement-breakpoint
CREATE POLICY "subscription_invoices_tenant_isolation" ON "subscription_invoices" AS PERMISSIVE FOR ALL TO public USING ("subscription_invoices"."organization_subscription_id" IN (SELECT id FROM organization_subscriptions)) WITH CHECK ("subscription_invoices"."organization_subscription_id" IN (SELECT id FROM organization_subscriptions));--> statement-breakpoint
CREATE POLICY "purchase_order_lines_tenant_isolation" ON "purchase_order_lines" AS PERMISSIVE FOR ALL TO public USING ("purchase_order_lines"."purchase_order_id" IN (SELECT id FROM purchase_orders)) WITH CHECK ("purchase_order_lines"."purchase_order_id" IN (SELECT id FROM purchase_orders));--> statement-breakpoint
CREATE POLICY "inspection_templates_tenant_isolation" ON "inspection_templates" AS PERMISSIVE FOR ALL TO public USING ("inspection_templates"."org_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("inspection_templates"."org_id" = current_setting('app.current_org_id', true)::uuid);