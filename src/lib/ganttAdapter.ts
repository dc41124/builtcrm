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
  // MUST be a single class token — frappe-gantt's bar.js does
  // `classList.add(custom_class)` which rejects spaces. Extra class
  // hooks go through `GanttTaskBundle.extraClasses` and are applied
  // by the wrapper's post-render DOM walk.
  custom_class: string;
};

// Bundle returned by buildGanttTasks. `tasks` is what frappe-gantt
// consumes verbatim; `extraClasses` is the post-render overlay the
// FrappeGantt wrapper applies via classList to each bar-wrapper's
// data-id node. Splitting this up is how we keep multi-class styling
// working despite the library's single-token custom_class API.
export type GanttTaskBundle = {
  tasks: GanttTask[];
  extraClasses: Record<string, string[]>;
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

// Builds one task plus the extra-class overlay for its bar-wrapper.
// The primary class is the most visually important one (critical
// wins, otherwise marker vs task); secondary hooks (status color,
// the other half of marker/task) live in `extraClasses`.
export function milestoneToGanttTask(input: {
  milestone: MilestoneRow;
  edges: GanttEdge[];
  isCritical: boolean;
}): { task: GanttTask; extraClasses: string[] } {
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

  // Primary class goes to frappe-gantt's custom_class. Critical is
  // the most visually important so it wins; otherwise the
  // marker/task distinction drives the primary.
  const primary = isCritical
    ? "gantt-critical"
    : isMarker
      ? "gantt-marker"
      : "gantt-task";
  // Everything else is post-applied via the wrapper. We always
  // include the status class + the marker/task class (when it isn't
  // already the primary) so CSS rules can compose off either.
  const extras: string[] = [`gantt-status-${m.milestoneStatus}`];
  if (isCritical) {
    extras.push(isMarker ? "gantt-marker" : "gantt-task");
  }

  return {
    task: {
      id: m.id,
      name: m.title,
      start: isoDate(start),
      end: isoDate(end),
      progress: PROGRESS_BY_STATUS[m.milestoneStatus] ?? 0,
      dependencies: deps,
      custom_class: primary,
    },
    extraClasses: extras,
  };
}

// Bulk shape: convert the full milestone set to frappe-gantt tasks
// with critical-path classes pre-applied. Caller passes the result of
// computeCriticalPath(). Returns a bundle — tasks go into the library,
// extraClasses overlay gets applied by the wrapper post-render.
export function buildGanttTasks(input: {
  milestones: MilestoneRow[];
  edges: GanttEdge[];
  criticalIds: Set<string>;
}): GanttTaskBundle {
  const tasks: GanttTask[] = [];
  const extraClasses: Record<string, string[]> = {};
  for (const m of input.milestones) {
    const { task, extraClasses: extras } = milestoneToGanttTask({
      milestone: m,
      edges: input.edges,
      isCritical: input.criticalIds.has(m.id),
    });
    tasks.push(task);
    if (extras.length > 0) extraClasses[task.id] = extras;
  }
  return { tasks, extraClasses };
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
