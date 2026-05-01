CREATE TYPE "public"."ai_usage_operation" AS ENUM('whisper_transcribe', 'claude_extract');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_provider" AS ENUM('openai', 'anthropic');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"triggered_by_user_id" uuid,
	"provider" "ai_usage_provider" NOT NULL,
	"operation" "ai_usage_operation" NOT NULL,
	"subject_id" varchar(64),
	"audio_seconds" integer,
	"tokens_used" integer,
	"cost_estimate_cents" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_org_created_idx" ON "ai_usage" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_org_operation_idx" ON "ai_usage" USING btree ("org_id","operation");--> statement-breakpoint
CREATE INDEX "ai_usage_subject_idx" ON "ai_usage" USING btree ("subject_id");--> statement-breakpoint
CREATE POLICY "ai_usage_tenant_isolation" ON "ai_usage" AS PERMISSIVE FOR ALL TO public USING ("ai_usage"."org_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("ai_usage"."org_id" = current_setting('app.current_org_id', true)::uuid);