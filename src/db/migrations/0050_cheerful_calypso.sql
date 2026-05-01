CREATE TYPE "public"."api_key_scope" AS ENUM('read', 'write', 'admin');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scopes" "api_key_scope"[] DEFAULT ARRAY[]::api_key_scope[] NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_org_created_idx" ON "api_keys" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "api_keys_org_status_idx" ON "api_keys" USING btree ("org_id","revoked_at");--> statement-breakpoint
CREATE POLICY "api_keys_tenant_isolation" ON "api_keys" AS PERMISSIVE FOR ALL TO public USING ("api_keys"."org_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("api_keys"."org_id" = current_setting('app.current_org_id', true)::uuid);