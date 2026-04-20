// Reports dashboard math — pure helpers, no DB. Kept separate from
// the loader so the formulas are testable and changeable without
// touching query code.
//
// Two main functions:
//   - computePercentComplete: milestone-based, duration-weighted when
//     startDate is set (Step 23 addition), falls back to unweighted
//     when no durations exist.
//   - computeScheduleVariance: averages delta across completed AND
//     past-due-incomplete milestones. Proposed-by-advisor math —
//     catches current slippage, not just historical.

export type MilestoneForMath = {
  id: string;
  startDate: Date | null;
  scheduledDate: Date;
  completedDate: Date | null;
  milestoneStatus:
    | "scheduled"
    | "in_progress"
    | "completed"
    | "missed"
    | "cancelled";
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Unweighted fallback weight per milestone. Arbitrary positive
// constant — only the ratio matters.
const DEFAULT_WEIGHT = 1;

// Per-milestone weight. When the milestone carries a startDate (i.e.
// it's a duration task rather than a point-in-time marker), the
// weight is the duration in days. Otherwise 1. The loader sums
// weighted-completed / weighted-total across the project.
function milestoneWeight(m: MilestoneForMath): number {
  if (!m.startDate) return DEFAULT_WEIGHT;
  const days = Math.max(
    DEFAULT_WEIGHT,
    (m.scheduledDate.getTime() - m.startDate.getTime()) / MS_PER_DAY,
  );
  return days;
}

// Percent complete on a [0, 100] scale.
//
// Duration-weighted when any milestone has `startDate` set. If none
// of the project's milestones have durations yet, falls back to
// unweighted (every row counts as 1). Caller can expose the
// fallback flag in the UI (e.g. tooltip: "duration weighting will
// kick in once more milestones have start dates").
//
// Cancelled milestones are excluded entirely — they're neither
// "done" nor "pending," they no longer count toward the project.
// An empty project (no qualifying milestones) returns null so the
// UI can render "—" rather than a misleading 0%.
export function computePercentComplete(
  milestones: MilestoneForMath[],
): { pct: number | null; weightingMode: "duration" | "unweighted" } {
  const eligible = milestones.filter((m) => m.milestoneStatus !== "cancelled");
  if (eligible.length === 0) return { pct: null, weightingMode: "unweighted" };

  const anyDuration = eligible.some((m) => m.startDate != null);
  const mode: "duration" | "unweighted" = anyDuration
    ? "duration"
    : "unweighted";

  let totalWeight = 0;
  let completedWeight = 0;
  for (const m of eligible) {
    const w = mode === "duration" ? milestoneWeight(m) : DEFAULT_WEIGHT;
    totalWeight += w;
    if (m.milestoneStatus === "completed") completedWeight += w;
  }
  if (totalWeight === 0) return { pct: null, weightingMode: mode };
  return {
    pct: Math.round((completedWeight / totalWeight) * 100),
    weightingMode: mode,
  };
}

// Schedule variance in days. Negative = ahead, positive = behind.
//
// Averages across two populations:
//   1. Completed milestones: `completedDate - scheduledDate` (actual
//      vs planned). Early completions push the average negative.
//   2. Incomplete milestones that are past their scheduled date:
//      `now - scheduledDate`. Always positive; captures current
//      slippage the moment it happens rather than waiting for
//      eventual completion.
//
// Not counted:
//   - Incomplete milestones not yet past their scheduled date (no
//     variance info — they might still finish on time).
//   - Cancelled milestones.
//
// Returns null when no qualifying milestones exist (empty project
// or all scheduled in the future).
export function computeScheduleVariance(
  milestones: MilestoneForMath[],
  now: Date = new Date(),
): number | null {
  const deltas: number[] = [];
  for (const m of milestones) {
    if (m.milestoneStatus === "cancelled") continue;
    if (m.milestoneStatus === "completed") {
      if (!m.completedDate) continue;
      deltas.push(
        (m.completedDate.getTime() - m.scheduledDate.getTime()) / MS_PER_DAY,
      );
    } else {
      // Incomplete. Only count if past due.
      if (m.scheduledDate.getTime() < now.getTime()) {
        deltas.push(
          (now.getTime() - m.scheduledDate.getTime()) / MS_PER_DAY,
        );
      }
    }
  }
  if (deltas.length === 0) return null;
  const sum = deltas.reduce((acc, d) => acc + d, 0);
  return Math.round(sum / deltas.length);
}

// Bucket label for the aging charts. Matches the thresholds in the
// build guide (0–7 / 8–14 / 15–30 / 30+). Used by both the RFI and
// change-order aging rollups.
export type AgingBucket = "0_7" | "8_14" | "15_30" | "30_plus";

export const AGING_BUCKET_ORDER: AgingBucket[] = [
  "0_7",
  "8_14",
  "15_30",
  "30_plus",
];

// Days since `from` to `now`, clamped to zero. Used by the aging
// calculations.
export function daysOpen(from: Date, now: Date = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / MS_PER_DAY),
  );
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 7) return "0_7";
  if (days <= 14) return "8_14";
  if (days <= 30) return "15_30";
  return "30_plus";
}
