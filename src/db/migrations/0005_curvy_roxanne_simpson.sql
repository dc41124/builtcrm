ALTER TABLE "prequal_project_exemptions" DROP CONSTRAINT "prequal_project_exemptions_contractor_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD CONSTRAINT "prequal_project_exemptions_contractor_org_id_fk" FOREIGN KEY ("contractor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;