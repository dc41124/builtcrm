CREATE TYPE "public"."province_code" AS ENUM('QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU');--> statement-breakpoint
CREATE TYPE "public"."rbq_license_status" AS ENUM('active', 'expired', 'suspended', 'not_found');--> statement-breakpoint
CREATE TABLE "rbq_license_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rbq_number" varchar(12) NOT NULL,
	"legal_name" varchar(255),
	"status" "rbq_license_status" NOT NULL,
	"issued_at" date,
	"expiry_date" date,
	"subclasses" jsonb,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_version" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbq_license_cache_rbq_number_unique" UNIQUE("rbq_number")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "rbq_number" varchar(12);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "province_code" "province_code";--> statement-breakpoint
CREATE INDEX "rbq_license_cache_status_idx" ON "rbq_license_cache" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rbq_license_cache_expiry_date_idx" ON "rbq_license_cache" USING btree ("expiry_date");