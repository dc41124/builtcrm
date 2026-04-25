CREATE TYPE "public"."milestone_kind" AS ENUM('marker', 'task');--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "kind" "milestone_kind";--> statement-breakpoint
UPDATE "milestones" SET "kind" = CASE WHEN "start_date" IS NULL THEN 'marker'::milestone_kind ELSE 'task'::milestone_kind END;--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_kind_start_date_check" CHECK (("milestones"."kind" = 'marker' AND "milestones"."start_date" IS NULL)
        OR ("milestones"."kind" = 'task' AND "milestones"."start_date" IS NOT NULL));