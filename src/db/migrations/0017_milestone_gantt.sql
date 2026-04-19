-- Migration: Gantt-view support on milestones (Step 23 / 4B.5 #23)
-- Date: 2026-04-18
-- Context: Path C from the Step 23 design review — extend the existing
-- milestones table rather than introducing a separate schedule_tasks
-- table. Two additions:
--
--   1. `milestones.start_date` (nullable) — when set, the milestone
--      renders as a duration bar from start_date to scheduled_date in
--      the Gantt view. When null, it renders as a zero-duration marker
--      (today's behaviour). Fully backward-compatible with seeded data.
--
--   2. `milestone_dependencies` — edge table with one row per
--      (predecessor, successor) pair. Multi-predecessor by design
--      (construction reality: "pour foundation" can depend on both
--      "framing inspection passed" AND "rebar delivered"). Partial
--      unique index prevents duplicate edges; app-layer cycle guards
--      prevent loops.
--
-- Dual-semantics note on milestones table:
--   The table now holds two conceptually different things —
--     (a) point-in-time markers (start_date null): inspections,
--         approvals, deliveries — zero-duration nodes in CPM terms.
--     (b) duration tasks (start_date set): excavation, framing,
--         drywall — the bars on a Gantt.
--   Both shapes coexist here for Step 23. If scheduling grows deeper
--   in a later phase we can split them or add a `kind` enum; for now
--   the nullability of start_date carries the distinction.

-- ---------------------------------------------------------------------------
-- 1. Duration support on milestones
-- ---------------------------------------------------------------------------

ALTER TABLE "milestones"
  ADD COLUMN IF NOT EXISTS "start_date" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "milestones_start_date_idx"
  ON "milestones" ("start_date");

-- ---------------------------------------------------------------------------
-- 2. Dependency edges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "milestone_dependencies" (
  "id"                 uuid                     PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "predecessor_id"     uuid                     NOT NULL,
  "successor_id"       uuid                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "milestone_dependencies_predecessor_fk"
    FOREIGN KEY ("predecessor_id") REFERENCES "milestones"("id") ON DELETE CASCADE,
  CONSTRAINT "milestone_dependencies_successor_fk"
    FOREIGN KEY ("successor_id") REFERENCES "milestones"("id") ON DELETE CASCADE,
  -- Self-edges are invalid (CPM has no self-loops). Enforced at the
  -- row level so bad data can't land via direct SQL either.
  CONSTRAINT "milestone_dependencies_no_self"
    CHECK ("predecessor_id" <> "successor_id")
);

-- Unique edge per (predecessor, successor) pair — duplicate edges
-- carry no extra information and only bloat the graph.
CREATE UNIQUE INDEX IF NOT EXISTS "milestone_dependencies_edge_unique"
  ON "milestone_dependencies" ("predecessor_id", "successor_id");

-- Lookup indexes for both directions of the graph walk (critical path
-- computation + "valid predecessor" candidate filtering).
CREATE INDEX IF NOT EXISTS "milestone_dependencies_predecessor_idx"
  ON "milestone_dependencies" ("predecessor_id");

CREATE INDEX IF NOT EXISTS "milestone_dependencies_successor_idx"
  ON "milestone_dependencies" ("successor_id");
