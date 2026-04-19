// Adapter: milestone rows (app shape) ↔ frappe-gantt Task (library shape).
//
// Marker milestones (startDate null) are zero-duration in our model but
// frappe-gantt doesn't draw zero-width bars, so we expand them to a
// single-day width for visualization only. The custom_class carries
// the distinction so the CSS can style them as diamond markers rather
// than full bars.
//
// Dependencies are serialised as the library's comma-separated-ids
// string. Critical nodes get an extra class so the CSS can tint them.

import type { MilestoneRow, MilestoneStatus } from "@/domain/loaders/schedule.shared";

export type GanttTask = {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number; // 0–100
  dependencies: string; // comma-separated ids, "" = none
  custom_class: string;
};

export type GanttEdge = { predecessorId: string; successorId: string };

// Maps milestone status to a progress percentage for the filled bar.
const PROGRESS_BY_STATUS: Record<MilestoneStatus, number> = {
  completed: 100,
  in_progress: 50,
  scheduled: 0,
  missed: 0,
  cancelled: 0,
};

function isoDate(d: Date): string {
  // Toss time-of-day — frappe-gantt's Day view rounds to whole days.
  // Using UTC avoids off-by-one when the user's locale pushes to
  // previous/next day.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function milestoneToGanttTask(input: {
  milestone: MilestoneRow;
  edges: GanttEdge[];
  isCritical: boolean;
}): GanttTask {
  const { milestone: m, edges, isCritical } = input;
  const isMarker = !m.startDate;
  const start = m.startDate ?? m.scheduledDate;
  // For markers, give a 1-day width so frappe-gantt draws something
  // recognisable; for tasks, use the scheduled (target) date.
  const end = isMarker
    ? new Date(m.scheduledDate.getTime() + 24 * 60 * 60 * 1000)
    : m.scheduledDate;

  const deps = edges
    .filter((e) => e.successorId === m.id)
    .map((e) => e.predecessorId)
    .join(",");

  const classes: string[] = [];
  classes.push(isMarker ? "gantt-marker" : "gantt-task");
  classes.push(`gantt-status-${m.milestoneStatus}`);
  if (isCritical) classes.push("gantt-critical");

  return {
    id: m.id,
    name: m.title,
    start: isoDate(start),
    end: isoDate(end),
    progress: PROGRESS_BY_STATUS[m.milestoneStatus] ?? 0,
    dependencies: deps,
    custom_class: classes.join(" "),
  };
}

// Bulk shape: convert the full milestone set to frappe-gantt tasks
// with critical-path classes pre-applied. Caller passes the result of
// computeCriticalPath().
export function buildGanttTasks(input: {
  milestones: MilestoneRow[];
  edges: GanttEdge[];
  criticalIds: Set<string>;
}): GanttTask[] {
  return input.milestones.map((m) =>
    milestoneToGanttTask({
      milestone: m,
      edges: input.edges,
      isCritical: input.criticalIds.has(m.id),
    }),
  );
}

// Inverse mapping for the drag-to-reschedule callback. The library
// hands back `start` and `end` as ISO strings or Date objects; we
// normalise to Date and split back into (startDate, scheduledDate)
// based on whether the milestone was a marker or a duration task.
//
// Markers keep startDate null; the UI moves their scheduledDate to
// the drag's start position and ignores the synthetic end.
// Duration tasks update both endpoints preserving the dragged edges.
export function ganttDatesToMilestoneUpdate(input: {
  milestone: Pick<MilestoneRow, "startDate" | "scheduledDate">;
  newStart: Date | string;
  newEnd: Date | string;
}): { startDate: Date | null; scheduledDate: Date } {
  const newStart = new Date(input.newStart);
  const newEnd = new Date(input.newEnd);
  const isMarker = !input.milestone.startDate;
  if (isMarker) {
    return { startDate: null, scheduledDate: newStart };
  }
  return { startDate: newStart, scheduledDate: newEnd };
}
