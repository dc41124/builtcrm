ALTER TABLE "daily_logs" ADD COLUMN "client_uuid" uuid;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_client_uuid_unique" UNIQUE("client_uuid");