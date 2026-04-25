"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  MilestoneDependency,
  MilestoneRow,
} from "@/domain/loaders/schedule.shared";
import {
  buildAdjacency,
  computeCriticalPath,
  getValidPredecessorCandidates,
  type GraphNode,
} from "@/domain/schedule/dependencies";
import { buildGanttTasks, ganttDatesToMilestoneUpdate } from "@/lib/ganttAdapter";

import { FrappeGantt, type FrappeGanttViewMode } from "./FrappeGantt";

// ScheduleGanttPanel
//
// The Gantt tab body for the schedule workspace (Step 23). Renders the
// frappe-gantt chart with critical-path highlighting, handles drag-to-
// reschedule via PATCH /api/milestones/[id], and exposes a right-side
// detail panel for predecessor management.
//
// Responsive policy (advisor-refined):
//   - < 900px  → render a muted notice directing the user to the list
//                view. Frappe-gantt's column widths don't compress
//                enough for phones.
//   - 900–1200 → Gantt renders with compressed info column (library
//                option `column_width`); the side detail panel stacks
//                below instead of alongside. Tablet PMs stay productive.
//   - > 1200   → Gantt + side panel side-by-side.
//
// Drag-to-reschedule auth: only contractor_admin / contractor_pm can
// drag (passed in via `canWrite`). Subs and clients get a read-only
// Gantt — the FrappeGantt wrapper honours `readOnly` by reverting any
// bar the user tries to drag.

const VIEW_MODES: FrappeGanttViewMode[] = ["Day", "Week", "Month", "Year"];

export function ScheduleGanttPanel({
  projectId,
  milestones,
  dependencies,
  canWrite,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  dependencies: MilestoneDependency[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<FrappeGanttViewMode>("Week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Graph shape for critical-path + candidate filtering. Memoized on
  // the raw milestone + dependency arrays — recomputes only when the
  // server refresh hands back new data, not on every re-render.
  const graphNodes: GraphNode[] = useMemo(
    () =>
      milestones.map((m) => ({
        id: m.id,
        projectId,
        // Marker = zero-duration node (startMs == endMs). Duration
        // task = startDate → scheduledDate window.
        startMs:
          m.kind === "task" && m.startDate
            ? m.startDate.getTime()
            : m.scheduledDate.getTime(),
        endMs: m.scheduledDate.getTime(),
      })),
    [milestones, projectId],
  );

  const criticalIds = useMemo(
    () => computeCriticalPath({ nodes: graphNodes, edges: dependencies }),
    [graphNodes, dependencies],
  );

  const { tasks, extraClasses } = useMemo(
    () =>
      buildGanttTasks({
        milestones,
        edges: dependencies,
        criticalIds,
      }),
    [milestones, dependencies, criticalIds],
  );

  const milestoneById = useMemo(
    () => new Map(milestones.map((m) => [m.id, m])),
    [milestones],
  );

  const selected = selectedId ? milestoneById.get(selectedId) ?? null : null;
  const selectedPredecessors = useMemo(
    () =>
      selected
        ? dependencies
            .filter((d) => d.successorId === selected.id)
            .map((d) => milestoneById.get(d.predecessorId))
            .filter((m): m is MilestoneRow => !!m)
        : [],
    [selected, dependencies, milestoneById],
  );

  const validCandidateIds = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(
      getValidPredecessorCandidates({
        milestoneId: selected.id,
        allNodes: graphNodes,
        edges: dependencies,
      }),
    );
  }, [selected, graphNodes, dependencies]);

  const { predecessorsOf } = useMemo(
    () => buildAdjacency(dependencies),
    [dependencies],
  );
  // Defensive — unused currently but retained for parity with advisor
  // guidance (future panel could show successors too).
  void predecessorsOf;

  async function handleDragChange(input: {
    taskId: string;
    newStart: Date;
    newEnd: Date;
  }) {
    const m = milestoneById.get(input.taskId);
    if (!m) return;
    const { startDate, scheduledDate } = ganttDatesToMilestoneUpdate({
      milestone: m,
      newStart: input.newStart,
      newEnd: input.newEnd,
    });
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${input.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate ? startDate.toISOString() : null,
          scheduledDate: scheduledDate.toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          (body?.message as string) ?? "Could not save — please try again.",
        );
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addPredecessor(predecessorId: string) {
    if (!selected) return;
    const res = await fetch(`/api/milestones/${selected.id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError((body?.message as string) ?? "Could not add dependency.");
      return;
    }
    router.refresh();
  }

  async function removePredecessor(predecessorId: string) {
    if (!selected) return;
    const res = await fetch(
      `/api/milestones/${selected.id}/dependencies?predecessorId=${predecessorId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setError("Could not remove dependency.");
      return;
    }
    router.refresh();
  }

  if (milestones.length === 0) {
    return (
      <div className="gantt-empty">
        <h3>No schedule yet</h3>
        <p>
          Add milestones from the Schedule tab. Once any have a start date
          they&apos;ll render as Gantt bars here; others show as markers on
          their scheduled date.
        </p>
      </div>
    );
  }

  return (
    <div className="gantt-wrap">
      <div className="gantt-toolbar">
        <div className="gantt-view-modes">
          {VIEW_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`gantt-view-btn ${viewMode === m ? "on" : ""}`}
              onClick={() => setViewMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="gantt-toolbar-meta">
          {criticalIds.size > 0 ? (
            <span className="gantt-cp-legend">
              <span className="gantt-cp-swatch" aria-hidden />
              Critical path
            </span>
          ) : null}
          {saving ? <span className="gantt-saving">Saving…</span> : null}
        </div>
      </div>
      {error ? <div className="gantt-error">{error}</div> : null}
      <div className={`gantt-split ${selected ? "has-detail" : ""}`}>
        <div className="gantt-chart">
          <FrappeGantt
            tasks={tasks}
            extraClasses={extraClasses}
            viewMode={viewMode}
            readOnly={!canWrite}
            onDateChange={handleDragChange}
            onTaskClick={(id) => setSelectedId(id)}
          />
        </div>
        {selected ? (
          <aside className="gantt-detail">
            <header className="gantt-detail-head">
              <div>
                <div className="gantt-detail-eyebrow">
                  {selected.milestoneType.replace(/_/g, " ")}
                </div>
                <h3>{selected.title}</h3>
              </div>
              <button
                type="button"
                className="gantt-detail-close"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <dl className="gantt-detail-meta">
              <dt>Status</dt>
              <dd>{selected.milestoneStatus.replace(/_/g, " ")}</dd>
              <dt>Start</dt>
              <dd>
                {selected.startDate
                  ? selected.startDate.toLocaleDateString()
                  : "—"}
              </dd>
              <dt>Target</dt>
              <dd>{selected.scheduledDate.toLocaleDateString()}</dd>
              {selected.assignedToOrganizationName ? (
                <>
                  <dt>Assigned</dt>
                  <dd>{selected.assignedToOrganizationName}</dd>
                </>
              ) : null}
            </dl>
            <section className="gantt-detail-section">
              <h4>Predecessors</h4>
              {selectedPredecessors.length === 0 ? (
                <p className="gantt-detail-empty">
                  No predecessors — this milestone doesn&apos;t depend on any
                  others.
                </p>
              ) : (
                <ul className="gantt-detail-list">
                  {selectedPredecessors.map((p) => (
                    <li key={p.id}>
                      <span>{p.title}</span>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => removePredecessor(p.id)}
                          aria-label={`Remove ${p.title}`}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && validCandidateIds.size > 0 ? (
                <PredecessorPicker
                  candidates={milestones.filter((m) =>
                    validCandidateIds.has(m.id),
                  )}
                  onAdd={addPredecessor}
                />
              ) : null}
              {canWrite && validCandidateIds.size === 0 && !selected ? null : null}
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function PredecessorPicker({
  candidates,
  onAdd,
}: {
  candidates: MilestoneRow[];
  onAdd: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="gantt-detail-picker">
      <label>
        <span className="gantt-detail-picker-label">Add predecessor</span>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">Select a milestone…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          if (!value) return;
          onAdd(value);
          setValue("");
        }}
      >
        Add
      </button>
    </div>
  );
}
