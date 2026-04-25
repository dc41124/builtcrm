CREATE TYPE "public"."transmittal_status" AS ENUM('draft', 'sent');--> statement-breakpoint
CREATE TABLE "transmittal_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transmittal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transmittal_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"attached_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transmittal_documents_unique" UNIQUE("transmittal_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "transmittal_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transmittal_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(160) NOT NULL,
	"org_label" varchar(160),
	"access_token_digest" varchar(64),
	"first_downloaded_at" timestamp with time zone,
	"last_downloaded_at" timestamp with time zone,
	"total_downloads" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transmittal_recipients_email_unique" UNIQUE("transmittal_id","email")
);
--> statement-breakpoint
CREATE TABLE "transmittals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequential_number" integer,
	"subject" varchar(300) NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "transmittal_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"sent_by_user_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transmittals_project_number_unique" UNIQUE("project_id","sequential_number")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "transmittal_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_access_events" ADD CONSTRAINT "transmittal_access_events_recipient_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."transmittal_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ADD CONSTRAINT "transmittal_documents_transmittal_id_transmittals_id_fk" FOREIGN KEY ("transmittal_id") REFERENCES "public"."transmittals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ADD CONSTRAINT "transmittal_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ADD CONSTRAINT "transmittal_documents_attached_by_user_id_users_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittal_recipients" ADD CONSTRAINT "transmittal_recipients_transmittal_id_transmittals_id_fk" FOREIGN KEY ("transmittal_id") REFERENCES "public"."transmittals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittal_recipients" ADD CONSTRAINT "transmittal_recipients_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittals" ADD CONSTRAINT "transmittals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittals" ADD CONSTRAINT "transmittals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transmittals" ADD CONSTRAINT "transmittals_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transmittal_access_events_recipient_idx" ON "transmittal_access_events" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "transmittal_access_events_downloaded_at_idx" ON "transmittal_access_events" USING btree ("downloaded_at");--> statement-breakpoint
CREATE INDEX "transmittal_documents_transmittal_idx" ON "transmittal_documents" USING btree ("transmittal_id");--> statement-breakpoint
CREATE INDEX "transmittal_recipients_transmittal_idx" ON "transmittal_recipients" USING btree ("transmittal_id");--> statement-breakpoint
CREATE INDEX "transmittal_recipients_digest_idx" ON "transmittal_recipients" USING btree ("access_token_digest");--> statement-breakpoint
CREATE INDEX "transmittals_project_status_idx" ON "transmittals" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "transmittals_sent_at_idx" ON "transmittals" USING btree ("sent_at");