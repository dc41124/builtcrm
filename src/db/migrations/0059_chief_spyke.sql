CREATE TYPE "public"."tax_jurisdiction" AS ENUM('CA', 'US', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."t5018_filing_status" AS ENUM('generated', 'filed');--> statement-breakpoint
CREATE TABLE "t5018_filing_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"sub_org_id" uuid NOT NULL,
	"sub_legal_name_snapshot" varchar(255) NOT NULL,
	"recipient_bn_encrypted" text,
	"sub_address_snapshot" text,
	"total_amount_cents" integer NOT NULL,
	"payment_count" integer NOT NULL,
	"slip_pdf_storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL,
	"retention_until" timestamp with time zone,
	"legal_hold" boolean DEFAULT false NOT NULL,
	CONSTRAINT "t5018_filing_slips_filing_sub_unique" UNIQUE("filing_id","sub_org_id")
);
--> statement-breakpoint
CREATE TABLE "t5018_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_org_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by_user_id" uuid NOT NULL,
	"xml_checksum" varchar(64) NOT NULL,
	"slip_count" integer NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"zip_storage_key" text NOT NULL,
	"xml_storage_key" text NOT NULL,
	"csv_storage_key" text,
	"status" "t5018_filing_status" DEFAULT 'generated' NOT NULL,
	"filed_at" timestamp with time zone,
	"filed_by_user_id" uuid,
	"cra_confirmation_code" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL,
	"retention_until" timestamp with time zone,
	"legal_hold" boolean DEFAULT false NOT NULL,
	CONSTRAINT "t5018_filings_contractor_year_unique" UNIQUE("contractor_org_id","fiscal_year")
);
--> statement-breakpoint
ALTER TABLE "t5018_filings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_jurisdiction" "tax_jurisdiction";--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "business_number" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "cra_receiver_code" varchar(16);--> statement-breakpoint
ALTER TABLE "t5018_filing_slips" ADD CONSTRAINT "t5018_filing_slips_filing_id_t5018_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."t5018_filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t5018_filing_slips" ADD CONSTRAINT "t5018_filing_slips_sub_org_id_organizations_id_fk" FOREIGN KEY ("sub_org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t5018_filings" ADD CONSTRAINT "t5018_filings_contractor_org_id_organizations_id_fk" FOREIGN KEY ("contractor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t5018_filings" ADD CONSTRAINT "t5018_filings_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t5018_filings" ADD CONSTRAINT "t5018_filings_filed_by_user_id_users_id_fk" FOREIGN KEY ("filed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "t5018_filing_slips_filing_idx" ON "t5018_filing_slips" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "t5018_filing_slips_sub_idx" ON "t5018_filing_slips" USING btree ("sub_org_id");--> statement-breakpoint
CREATE INDEX "t5018_filings_contractor_idx" ON "t5018_filings" USING btree ("contractor_org_id");--> statement-breakpoint
CREATE INDEX "t5018_filings_status_idx" ON "t5018_filings" USING btree ("status");--> statement-breakpoint
CREATE POLICY "t5018_filings_tenant_isolation" ON "t5018_filings" AS PERMISSIVE FOR ALL TO public USING ("t5018_filings"."contractor_org_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("t5018_filings"."contractor_org_id" = current_setting('app.current_org_id', true)::uuid);