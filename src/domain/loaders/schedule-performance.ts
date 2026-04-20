import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { milestones, projects } from "@/db/schema";
import { computePercentComplete } from "@/lib/reports/math";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// Schedule Performance loader (Step 24.5 wiring).
//
// Per-project row with planned + actual timelines and an SPI value.
//
// Timeline bounds (from project.startDate / targetCompletionDate /
// actualCompletionDate):
//   - planned window: startDate → targetCompletionDate
//   - actual window:  startDate → actualCompletionDate (if completed)
//                     startDate → forecast-end (if still active)
//   where forecast-end = targetCompletionDate + scheduleVarianceDays
//   (days we're already slipped carry through to the forecast).
//
// The UI expects 0–100 coordinates within a single shared timeline per
// project. We scale each project's four anchor dates onto its own
// window so projects of wildly different duration still read cleanly
// on the same strip (see prototypes/builtcrm_schedule_timeline).
//
// SPI (Schedule Performance Index) is the ratio of *planned-progress*
// to *actual-progress* at "today". Computed as:
//   SPI = actualPct / plannedElapsedPct
// where plannedElapsedPct is linear time elapsed against the planned
// window and actualPct is the milestone-weighted % complete. SPI of
// 1.0 means "we've done as much as we planned to by now."

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type SchedulePerfRow = {
  projectId: string;
  projectName: string;
  // 0..100 positions within the project's own timeline window.
  plannedStart: number;
  plannedEnd: number;
  actualStart: number;
  actualEnd: number;
  today: number;
  // 1.0 = on schedule. < 0.95 behind, > 1.05 ahead.
  spi: number;
  milestonesHit: number;
  milestonesTotal: number;
  // Source dates — exposed so the UI can render absolute dates if desired.
  plannedStartIso: string | null;
  plannedEndIso: string | null;
  actualStartIso: string | null;
  actualEndIso: string | null;
};

export type SchedulePerfView = {
  rows: SchedulePerfRow[];
  totals: {
    projectCount: number;
    behindCount: number;   // spi < 0.95
    onTrackCount: number;  // 0.95 ≤ spi ≤ 1.05
    aheadCount: number;    // spi > 1.05
    avgSpi: number;
  };
  generatedAtIso: string;
};

type LoaderInput = { session: SessionLike | null | undefined };

// Forecast the actual end date for an in-flight project from its
// milestone-weighted completion pct. If pct == 0 or plan hasn't started,
// fall back to the planned end.
function forecastActualEnd(
  plannedStart: Date,
  plannedEnd: Date,
  pct: number | null,
  now: Date,
): Date {
  if (pct == null || pct <= 0) return plannedEnd;
  const plannedDurationMs = plannedEnd.getTime() - plannedStart.getTime();
  if (plannedDurationMs <= 0) return plannedEnd;
  // Linear extrapolation: if we're at pct% complete after t days since
  // start, total days = t / (pct/100). Cap to 3× planned duration so a
  // stalled project doesn't extend the chart to infinity.
  const elapsedMs = Math.max(0, now.getTime() - plannedStart.getTime());
  const projectedTotalMs = (elapsedMs * 100) / pct;
  const capped = Math.min(projectedTotalMs, plannedDurationMs * 3);
  return new Date(plannedStart.getTime() + capped);
}

export async function getSchedulePerformanceReport(
  input: LoaderInput,
): Promise<SchedulePerfView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      startDate: projects.startDate,
      targetCompletionDate: projects.targetCompletionDate,
      actualCompletionDate: projects.actualCompletionDate,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) {
    return {
      rows: [],
      totals: { projectCount: 0, behindCount: 0, onTrackCount: 0, aheadCount: 0, avgSpi: 1 },
      generatedAtIso: now.toISOString(),
    };
  }

  const msRows = await db
    .select({
      id: milestones.id,
      projectId: milestones.projectId,
      startDate: milestones.startDate,
      scheduledDate: milestones.scheduledDate,
      completedDate: milestones.completedDate,
      milestoneStatus: milestones.milestoneStatus,
    })
    .from(milestones)
    .where(inArray(milestones.projectId, projectIds));

  const milestonesByProject = new Map<string, typeof msRows>();
  for (const m of msRows) {
    const list = milestonesByProject.get(m.projectId) ?? [];
    list.push(m);
    milestonesByProject.set(m.projectId, list);
  }

  const rows: SchedulePerfRow[] = [];
  for (const p of projectRows) {
    // A project without a planned window can't be plotted — skip.
    if (!p.startDate || !p.targetCompletionDate) continue;
    const projectMs = milestonesByProject.get(p.id) ?? [];
    const eligibleMs = projectMs.filter(
      (m) => m.milestoneStatus !== "cancelled",
    );
    const milestonesTotal = eligibleMs.length;
    const milestonesHit = eligibleMs.filter(
      (m) => m.milestoneStatus === "completed",
    ).length;
    const { pct } = computePercentComplete(projectMs);
    // computePercentComplete returns 0..100; SPI math below stays on
    // that scale (compared to plannedElapsedPct also 0..100).
    const actualPct = pct ?? 0;

    // Plan window
    const plannedStart = p.startDate;
    const plannedEnd = p.targetCompletionDate;
    const actualEnd =
      p.actualCompletionDate ??
      forecastActualEnd(plannedStart, plannedEnd, actualPct, now);

    // Build a shared window covering planned + actual + today. Padded
    // 3% on each side so edge events (e.g., a project ending today)
    // don't sit flush against the rail edge.
    const anchors = [
      plannedStart.getTime(),
      plannedEnd.getTime(),
      plannedStart.getTime(), // actual start = planned start in this model
      actualEnd.getTime(),
      now.getTime(),
    ];
    const windowStart = Math.min(...anchors);
    const windowEnd = Math.max(...anchors);
    const windowMs = Math.max(1, windowEnd - windowStart);
    const pad = windowMs * 0.03;
    const scale = (d: Date) =>
      ((d.getTime() - windowStart + pad) / (windowMs + 2 * pad)) * 100;

    // SPI: actualPct / plannedElapsedPct.
    //   plannedElapsedPct = clamp(0..1, (now - plannedStart) / plannedDuration)
    const plannedDurationMs = plannedEnd.getTime() - plannedStart.getTime();
    const plannedElapsedMs = Math.max(
      0,
      Math.min(plannedDurationMs, now.getTime() - plannedStart.getTime()),
    );
    const plannedElapsedPct =
      plannedDurationMs > 0 ? (plannedElapsedMs / plannedDurationMs) * 100 : 0;
    // SPI is undefined before the project starts. Treat as 1.0 (nothing
    // to be behind on yet) and skip projects with zero planned duration.
    const spi =
      plannedElapsedPct === 0
        ? 1
        : Math.max(0.01, actualPct / plannedElapsedPct);

    rows.push({
      projectId: p.id,
      projectName: p.name,
      plannedStart: scale(plannedStart),
      plannedEnd: scale(plannedEnd),
      actualStart: scale(plannedStart),
      actualEnd: scale(actualEnd),
      today: scale(now),
      spi,
      milestonesHit,
      milestonesTotal,
      plannedStartIso: plannedStart.toISOString(),
      plannedEndIso: plannedEnd.toISOString(),
      actualStartIso: plannedStart.toISOString(),
      actualEndIso: actualEnd.toISOString(),
    });
  }

  // Portfolio totals
  const behindCount = rows.filter((r) => r.spi < 0.95).length;
  const aheadCount = rows.filter((r) => r.spi > 1.05).length;
  const onTrackCount = rows.length - behindCount - aheadCount;
  const avgSpi =
    rows.length === 0
      ? 1
      : rows.reduce((a, r) => a + r.spi, 0) / rows.length;

  return {
    rows,
    totals: {
      projectCount: rows.length,
      behindCount,
      onTrackCount,
      aheadCount,
      avgSpi,
    },
    generatedAtIso: now.toISOString(),
  };
}
