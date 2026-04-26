ALTER TABLE "organization_subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stripe_customers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sso_providers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "organization_subscriptions_tenant_isolation" ON "organization_subscriptions" CASCADE;--> statement-breakpoint
DROP POLICY "stripe_customers_tenant_isolation" ON "stripe_customers" CASCADE;--> statement-breakpoint
DROP POLICY "sso_providers_tenant_isolation" ON "sso_providers" CASCADE;