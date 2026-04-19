"use client";

import { useEffect, useRef } from "react";
import Gantt from "frappe-gantt";
// frappe-gantt's package.json `exports` field blocks direct CSS
// imports ("./dist/*" is not exported), so we vendored the library's
// CSS into src/styles/frappe-gantt.css. Imported here as a side effect
// so the styles land in the client bundle on first Gantt mount.
import "@/styles/frappe-gantt.css";

import type { GanttTask } from "@/lib/ganttAdapter";

// Thin React wrapper around frappe-gantt. We hand-rolled this instead
// of pulling in `gantt-task-react` (abandoned since 2022) or
// `frappe-gantt-react` (7-year stale). The underlying frappe-gantt
// core is actively maintained (v1.2.2, last published ~a month ago);
// owning the wrapper ~60 lines of glue is cheaper than being pinned
// to an unmaintained intermediate package.
//
// Lifecycle notes:
//   - The Gantt instance mounts once on first render into `wrapperRef`.
//     Re-renders call `.refresh(tasks)` rather than reinstantiating,
//     which preserves view-mode state + scroll position.
//   - Event callbacks stored in refs so the Gantt options object never
//     needs re-passing; the instance calls the latest ref on every
//     event.
//   - `viewMode` is a prop; when it changes we call `.change_view_mode`.
//   - `readOnly` disables drag handlers by wrapping `onDateChange` to
//     re-render the task back to its server-side shape (frappe-gantt
//     has no first-class read-only flag, so this is the idiomatic dodge).

// Subset of frappe-gantt's DEFAULT_VIEW_MODES we expose. The library
// also defines "Hour", "Quarter Day", and "Half Day" — those are
// too fine-grained for construction schedules; we skip them. Note
// the library has NO 3-month-quarter mode; "Quarter Day" is a
// 6-hour bucket, not what most users mean by "Quarter."
export type FrappeGanttViewMode = "Day" | "Week" | "Month" | "Year";

export type DateChangePayload = {
  taskId: string;
  newStart: Date;
  newEnd: Date;
};

// The full frappe-gantt option surface is large and not typed. We
// model just the subset we pass in.
type FrappeGanttOptions = {
  view_mode: FrappeGanttViewMode;
  readonly?: boolean;
  on_date_change?: (task: GanttTask, start: Date, end: Date) => void;
  on_click?: (task: GanttTask) => void;
  on_progress_change?: (task: GanttTask, progress: number) => void;
  on_view_change?: (mode: FrappeGanttViewMode) => void;
  language?: string;
  popup_trigger?: "click" | "hover";
};

type GanttInstance = {
  refresh: (tasks: GanttTask[]) => void;
  change_view_mode: (mode: FrappeGanttViewMode) => void;
};

type GanttConstructor = new (
  wrapper: HTMLElement | SVGElement | string,
  tasks: GanttTask[],
  options: FrappeGanttOptions,
) => GanttInstance;

export function FrappeGantt({
  tasks,
  extraClasses,
  viewMode = "Week",
  readOnly = false,
  onDateChange,
  onTaskClick,
}: {
  tasks: GanttTask[];
  // Task-id → extra class tokens to apply to the rendered
  // bar-wrapper. Needed because frappe-gantt's custom_class is a
  // single token (classList.add chokes on spaces); this overlay
  // lets us layer status / critical / marker classes independently.
  extraClasses?: Record<string, string[]>;
  viewMode?: FrappeGanttViewMode;
  readOnly?: boolean;
  onDateChange?: (payload: DateChangePayload) => void;
  onTaskClick?: (taskId: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<GanttInstance | null>(null);

  // Stable refs for callbacks so the Gantt instance doesn't need
  // rebuilding when parent re-renders change prop identities.
  const onDateChangeRef = useRef(onDateChange);
  const onTaskClickRef = useRef(onTaskClick);
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
    onTaskClickRef.current = onTaskClick;
    readOnlyRef.current = readOnly;
  }, [onDateChange, onTaskClick, readOnly]);

  // Mount once. Empty deps: tasks are applied via the second effect.
  useEffect(() => {
    if (!wrapperRef.current) return;
    if (instanceRef.current) return;
    // Library requires at least one task at construction time, or
    // it throws. Seed with an empty array wrapped in a valid-shape
    // placeholder; the refresh effect immediately replaces it.
    const seed: GanttTask[] =
      tasks.length > 0
        ? tasks
        : [
            {
              id: "__seed",
              name: "",
              start: "1970-01-01",
              end: "1970-01-02",
              progress: 0,
              dependencies: "",
              custom_class: "gantt-seed",
            },
          ];
    const Ctor = Gantt as unknown as GanttConstructor;
    instanceRef.current = new Ctor(wrapperRef.current, seed, {
      view_mode: viewMode,
      popup_trigger: "click",
      on_date_change: (task, start, end) => {
        if (readOnlyRef.current) {
          // Re-apply server truth — the library has already moved the
          // bar visually; a refresh with the original tasks puts it
          // back. See the refresh effect below.
          instanceRef.current?.refresh(tasksRef.current);
          return;
        }
        onDateChangeRef.current?.({
          taskId: task.id,
          newStart: new Date(start),
          newEnd: new Date(end),
        });
      },
      on_click: (task) => {
        onTaskClickRef.current?.(task.id);
      },
    });
    if (tasks.length === 0) {
      // Seeded with a placeholder — clear it now.
      instanceRef.current.refresh([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tasks ref mirrors the latest tasks array so the on_date_change
  // handler can "undo" drags in read-only mode.
  const tasksRef = useRef<GanttTask[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
    if (!instanceRef.current) return;
    instanceRef.current.refresh(tasks);
    // After refresh, apply secondary class tokens per task. Each
    // rendered bar carries `data-id="<task.id>"` on its group
    // element — we scope to wrapperRef so we don't accidentally
    // touch bars from another Gantt instance on the page.
    if (extraClasses && wrapperRef.current) {
      for (const [taskId, classes] of Object.entries(extraClasses)) {
        if (classes.length === 0) continue;
        const node = wrapperRef.current.querySelector(
          `.bar-wrapper[data-id="${cssEscape(taskId)}"]`,
        );
        if (node) node.classList.add(...classes);
      }
    }
  }, [tasks, extraClasses]);

  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.change_view_mode(viewMode);
  }, [viewMode]);

  return <div ref={wrapperRef} />;
}

// Task IDs are UUIDs (no special characters), but CSS.escape is the
// correct tool for any attribute-selector value. Falls back to a
// no-op if CSS.escape is somehow unavailable in the runtime — we
// know our IDs are selector-safe.
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value;
}
