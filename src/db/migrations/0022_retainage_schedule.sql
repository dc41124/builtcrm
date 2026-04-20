-- Migration: Retainage scheduled release (Step 43 follow-up)
-- Date: 2026-04-19
-- Context: The retainage_releases table models held-retainage release
-- requests through a four-state machine (held → release_requested →
-- released / forfeited) but records no expected-release date. Step 43
-- wants a "retainage releasing in <30 days" card metric, and Step 68
-- (Holdback Ledger — Ontario Construction Act tracking) will need the
-- same signal on a ledger report.
--
-- Two hooks per row:
--
--   1. `scheduled_release_at timestamptz` — free-form date the GC can
--      enter when the release isn't milestone-tied (e.g., a calendar-
--      driven "45 days after final payment" holdback). Nullable.
--
--   2. `release_trigger_milestone_id uuid` — FK to milestones. When
--      set, the canonical release date is derived at read time from
--      `milestones.scheduled_date` (so if the milestone slips, the
--      release expectation shifts automatically without a manual
--      edit). Nullable.
--
-- Resolver rule (enforced in src/domain/loaders/financial.ts):
--   milestone-tied date if present, else scheduled_release_at, else null.
--
-- Both fields are nullable; existing rows stay null and are invisible
-- to the "<30 days" card tile until the GC sets a trigger. No backfill.

ALTER TABLE "retainage_releases"
  ADD COLUMN "scheduled_release_at" timestamp with time zone,
  ADD COLUMN "release_trigger_milestone_id" uuid;

ALTER TABLE "retainage_releases"
  ADD CONSTRAINT "retainage_releases_release_trigger_milestone_id_milestones_id_fk"
    FOREIGN KEY ("release_trigger_milestone_id")
    REFERENCES "milestones"("id")
    ON DELETE SET NULL;

-- Partial index: the "<30 days" card filters on scheduled_release_at
-- when the milestone path isn't in use. Small table today; partial keeps
-- the index tight to the non-null subset.
CREATE INDEX "retainage_releases_scheduled_release_at_idx"
  ON "retainage_releases" ("scheduled_release_at")
  WHERE "scheduled_release_at" IS NOT NULL;

CREATE INDEX "retainage_releases_trigger_milestone_idx"
  ON "retainage_releases" ("release_trigger_milestone_id")
  WHERE "release_trigger_milestone_id" IS NOT NULL;
