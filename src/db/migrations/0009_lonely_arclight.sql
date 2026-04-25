ALTER TABLE "users" ADD COLUMN "pending_deletion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_deletion_token_hash" text;--> statement-breakpoint
CREATE INDEX "users_pending_deletion_idx" ON "users" USING btree ("pending_deletion_at");