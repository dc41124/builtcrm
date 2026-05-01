CREATE TYPE "public"."custom_field_entity_type" AS ENUM('project', 'subcontractor', 'document', 'rfi');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date', 'select', 'multi_select', 'boolean');--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" "custom_field_entity_type" NOT NULL,
	"key" varchar(60) NOT NULL,
	"label" varchar(120) NOT NULL,
	"description" text,
	"field_type" "custom_field_type" NOT NULL,
	"options_json" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_defs_org_entity_key_unique" UNIQUE("organization_id","entity_type","key")
);
--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_values_def_entity_unique" UNIQUE("definition_id","entity_id")
);
--> statement-breakpoint
ALTER TABLE "custom_field_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_field_defs_org_entity_idx" ON "custom_field_definitions" USING btree ("organization_id","entity_type","order_index");--> statement-breakpoint
CREATE INDEX "custom_field_values_entity_idx" ON "custom_field_values" USING btree ("entity_id");--> statement-breakpoint
CREATE POLICY "custom_field_definitions_tenant_isolation" ON "custom_field_definitions" AS PERMISSIVE FOR ALL TO public USING ("custom_field_definitions"."organization_id" = current_setting('app.current_org_id', true)::uuid) WITH CHECK ("custom_field_definitions"."organization_id" = current_setting('app.current_org_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "custom_field_values_tenant_isolation" ON "custom_field_values" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
        SELECT 1 FROM custom_field_definitions
        WHERE custom_field_definitions.id = "custom_field_values"."definition_id"
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM custom_field_definitions
        WHERE custom_field_definitions.id = "custom_field_values"."definition_id"
      ));