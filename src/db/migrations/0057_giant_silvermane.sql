ALTER TABLE "audit_events" ALTER COLUMN "retention_class" SET DEFAULT 'operational';--> statement-breakpoint
-- Backfill: existing rows were inserted with the prior default
-- ('statutory_construction'). Re-tier them so the active retention
-- contract matches the schema. Safe to repeat — no rows touched on
-- second run because the WHERE clause already excludes them.
UPDATE "audit_events" SET "retention_class" = 'operational' WHERE "retention_class" = 'statutory_construction';