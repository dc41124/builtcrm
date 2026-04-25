CREATE TYPE "public"."closeout_comment_scope" AS ENUM('package', 'section', 'item');--> statement-breakpoint
CREATE TYPE "public"."closeout_package_status" AS ENUM('building', 'review', 'delivered', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."closeout_section_type" AS ENUM('om_manuals', 'warranties', 'as_builts', 'permits_final', 'testing_certificates', 'cad_files', 'other');--> statement-breakpoint
CREATE TABLE "closeout_counters" (
	"organization_id" uuid NOT NULL,
	"sequence_year" integer NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closeout_counters_org_year_unique" UNIQUE("organization_id","sequence_year")
);
--> statement-breakpoint
CREATE TABLE "closeout_package_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"scope" "closeout_comment_scope" NOT NULL,
	"section_id" uuid,
	"item_id" uuid,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closeout_package_comments_scope_shape" CHECK ((
        ("closeout_package_comments"."scope" = 'package' AND "closeout_package_comments"."section_id" IS NULL AND "closeout_package_comments"."item_id" IS NULL)
        OR ("closeout_package_comments"."scope" = 'section' AND "closeout_package_comments"."section_id" IS NOT NULL AND "closeout_package_comments"."item_id" IS NULL)
        OR ("closeout_package_comments"."scope" = 'item' AND "closeout_package_comments"."section_id" IS NOT NULL AND "closeout_package_comments"."item_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "closeout_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"attached_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closeout_package_items_section_doc_unique" UNIQUE("section_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "closeout_package_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"section_type" "closeout_section_type" NOT NULL,
	"custom_label" varchar(120),
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closeout_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_year" integer NOT NULL,
	"sequence_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "closeout_package_status" DEFAULT 'building' NOT NULL,
	"prepared_by_user_id" uuid NOT NULL,
	"delivered_at" timestamp with time zone,
	"delivered_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"accepted_signer" varchar(160),
	"acceptance_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closeout_packages_org_year_seq_unique" UNIQUE("organization_id","sequence_year","sequence_number")
);
--> statement-breakpoint
ALTER TABLE "closeout_counters" ADD CONSTRAINT "closeout_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD CONSTRAINT "closeout_package_comments_package_id_closeout_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."closeout_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD CONSTRAINT "closeout_package_comments_item_id_closeout_package_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."closeout_package_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD CONSTRAINT "closeout_package_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD CONSTRAINT "closeout_package_comments_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD CONSTRAINT "closeout_package_comments_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."closeout_package_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ADD CONSTRAINT "closeout_package_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ADD CONSTRAINT "closeout_package_items_attached_by_user_id_users_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ADD CONSTRAINT "closeout_package_items_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."closeout_package_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_package_sections" ADD CONSTRAINT "closeout_package_sections_package_id_closeout_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."closeout_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD CONSTRAINT "closeout_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD CONSTRAINT "closeout_packages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD CONSTRAINT "closeout_packages_prepared_by_user_id_users_id_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD CONSTRAINT "closeout_packages_delivered_by_user_id_users_id_fk" FOREIGN KEY ("delivered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD CONSTRAINT "closeout_packages_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "closeout_package_comments_package_created_idx" ON "closeout_package_comments" USING btree ("package_id","created_at");--> statement-breakpoint
CREATE INDEX "closeout_package_comments_item_idx" ON "closeout_package_comments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "closeout_package_comments_section_idx" ON "closeout_package_comments" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "closeout_package_items_section_order_idx" ON "closeout_package_items" USING btree ("section_id","sort_order");--> statement-breakpoint
CREATE INDEX "closeout_package_sections_package_order_idx" ON "closeout_package_sections" USING btree ("package_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "closeout_package_sections_fixed_type_unique" ON "closeout_package_sections" USING btree ("package_id","section_type") WHERE "closeout_package_sections"."section_type" <> 'other';--> statement-breakpoint
CREATE INDEX "closeout_packages_project_status_idx" ON "closeout_packages" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "closeout_packages_delivered_at_idx" ON "closeout_packages" USING btree ("delivered_at");