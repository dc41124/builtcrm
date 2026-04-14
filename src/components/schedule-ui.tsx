"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MILESTONE_STATUS_VALUES,
  MILESTONE_TYPE_VALUES,
  MILESTONE_VISIBILITY_VALUES,
  countdownLabel,
  formatShortDate,
  residentialTypeLabel,
  type MilestoneRow,
  type MilestoneStatus,
  type MilestoneType,
  type MilestoneVisibility,
  type PhaseGroup,
  type ScheduleStats,
} from "@/domain/loaders/schedule";

type ScheduleRole =
  | "contractor_admin"
  | "contractor_pm"
  | "subcontractor_user"
  | "commercial_client"
  | "residential_client";

type ScheduleViewProps = {
  projectId: string;
  projectName: string;
  role: ScheduleRole;
  canWrite: boolean;
  phases: PhaseGroup[];
  stats: ScheduleStats;
  overallProgressPct: number;
};

type FilterKey = "all" | "upcoming" | "in_progress" | "completed" | "missed";

// ---- Root component -----------------------------------------------------

export function ScheduleView(props: ScheduleViewProps) {
  if (props.role === "residential_client") {
    return <ResidentialTimeline {...props} />;
  }
  return <StandardSchedule {...props} />;
}

// ---- Contractor / sub / commercial client view -------------------------

function StandardSchedule({
  projectId,
  projectName,
  role,
  canWrite,
  phases,
  stats,
  overallProgressPct,
}: ScheduleViewProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filteredPhases = useMemo(
    () => applyFilter(phases, filter),
    [phases, filter],
  );

  const headerLabel =
    role === "commercial_client" ? "Project Schedule" : "Schedule";

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{headerLabel}</h1>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
          {projectName} · {stats.total} milestones
          {phases.length > 0 ? ` across ${phases.length} phases` : ""}
        </p>
      </header>

      <StatsRow stats={stats} />
      <OverallProgress pct={overallProgressPct} phases={phases} />

      {role !== "commercial_client" && (
        <FilterTabs filter={filter} setFilter={setFilter} stats={stats} />
      )}

      {filteredPhases.length === 0 ? (
        <p style={{ color: "#888", marginTop: 16 }}>
          No milestones match this filter.
        </p>
      ) : (
        filteredPhases.map((phase) => (
          <PhaseBlock
            key={phase.name}
            phase={phase}
            readOnly={!canWrite}
            role={role}
          />
        ))
      )}

      {canWrite && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Add Milestone</h2>
          <CreateMilestoneForm projectId={projectId} />
        </section>
      )}
    </div>
  );
}

function StatsRow({ stats }: { stats: ScheduleStats }) {
  const cells: Array<{ label: string; value: number }> = [
    { label: "Total", value: stats.total },
    { label: "Completed", value: stats.completed },
    { label: "In Progress", value: stats.inProgress },
    { label: "Upcoming (2 wks)", value: stats.upcoming },
    { label: "Missed", value: stats.missed },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          style={{
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: "8px 14px",
            minWidth: 110,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700 }}>{c.value}</div>
          <div style={{ fontSize: 11, color: "#666" }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function OverallProgress({
  pct,
  phases,
}: {
  pct: number;
  phases: PhaseGroup[];
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 6,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <strong style={{ fontSize: 13 }}>Overall Project Progress</strong>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 8,
          background: "#eee",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#5b4fc7",
          }}
        />
      </div>
      {phases.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 8,
            fontSize: 11,
            color: "#666",
            flexWrap: "wrap",
          }}
        >
          {phases.map((p) => (
            <span
              key={p.name}
              style={{
                color:
                  p.state === "completed"
                    ? "#1e6b46"
                    : p.state === "active"
                      ? "#4a3fb0"
                      : "#999",
                fontWeight: p.state === "active" ? 700 : 500,
              }}
            >
              {p.state === "completed" ? "✓ " : p.state === "active" ? "● " : ""}
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTabs({
  filter,
  setFilter,
  stats,
}: {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  stats: ScheduleStats;
}) {
  const tabs: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: stats.total },
    { key: "upcoming", label: "Upcoming", count: stats.upcoming },
    { key: "in_progress", label: "In Progress", count: stats.inProgress },
    { key: "completed", label: "Completed", count: stats.completed },
    { key: "missed", label: "Missed", count: stats.missed },
  ];
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setFilter(t.key)}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            borderRadius: 4,
            border: "1px solid #ccc",
            background: filter === t.key ? "#eeedfb" : "#fff",
            fontWeight: filter === t.key ? 700 : 500,
            cursor: "pointer",
          }}
        >
          {t.label} ({t.count})
        </button>
      ))}
    </div>
  );
}

function applyFilter(phases: PhaseGroup[], filter: FilterKey): PhaseGroup[] {
  if (filter === "all") return phases;
  const keep = (m: MilestoneRow) => {
    if (filter === "completed") return m.milestoneStatus === "completed";
    if (filter === "in_progress") return m.milestoneStatus === "in_progress";
    if (filter === "missed") return m.milestoneStatus === "missed";
    if (filter === "upcoming") {
      if (m.milestoneStatus !== "scheduled") return false;
      const days =
        (m.scheduledDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      return days >= 0 && days <= 14;
    }
    return true;
  };
  return phases
    .map((p) => ({ ...p, milestones: p.milestones.filter(keep) }))
    .filter((p) => p.milestones.length > 0);
}

function PhaseBlock({
  phase,
  readOnly,
  role,
}: {
  phase: PhaseGroup;
  readOnly: boolean;
  role: ScheduleRole;
}) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid #ddd",
          paddingBottom: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background:
              phase.state === "completed"
                ? "#2d8a5e"
                : phase.state === "active"
                  ? "#5b4fc7"
                  : "#ccc",
          }}
        />
        <strong style={{ fontSize: 15 }}>{phase.name}</strong>
        {phase.firstDate && phase.lastDate && (
          <span style={{ fontSize: 12, color: "#888" }}>
            {formatShortDate(phase.firstDate)} – {formatShortDate(phase.lastDate)}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#666",
            fontWeight: 600,
          }}
        >
          {phase.completedCount}/{phase.totalCount}
        </span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {phase.milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            readOnly={readOnly}
            role={role}
          />
        ))}
      </ul>
    </section>
  );
}

function MilestoneCard({
  milestone: m,
  readOnly,
  role,
}: {
  milestone: MilestoneRow;
  readOnly: boolean;
  role: ScheduleRole;
}) {
  const [editing, setEditing] = useState(false);
  const cd = countdownLabel(m);
  const toneColor =
    cd.tone === "overdue"
      ? "#a52e2e"
      : cd.tone === "soon"
        ? "#96600f"
        : cd.tone === "done"
          ? "#1e6b46"
          : "#888";

  return (
    <li
      style={{
        borderTop: "1px solid #eee",
        padding: "10px 0",
        opacity: m.milestoneStatus === "completed" ? 0.75 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <StatusDot status={m.milestoneStatus} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              textDecoration:
                m.milestoneStatus === "completed" ? "line-through" : "none",
            }}
          >
            {m.title}
          </div>
          {m.description && (
            <div
              style={{
                fontSize: 12,
                color: "#666",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {m.description}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            background: "#f3f4f6",
            color: "#444",
            textTransform: "uppercase",
          }}
        >
          {m.milestoneType}
        </span>
        {(m.assignedToUserName || m.assignedToOrganizationName) && (
          <span style={{ fontSize: 11, color: "#666" }}>
            {m.assignedToUserName ?? m.assignedToOrganizationName}
          </span>
        )}
        <div style={{ textAlign: "right", minWidth: 90 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {formatShortDate(m.scheduledDate)}
          </div>
          <div style={{ fontSize: 10.5, color: toneColor, fontWeight: 600 }}>
            {cd.text}
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            style={{ fontSize: 11 }}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        )}
      </div>
      {editing && !readOnly && (
        <EditMilestoneForm
          milestone={m}
          onDone={() => setEditing(false)}
          isContractor={
            role === "contractor_admin" || role === "contractor_pm"
          }
        />
      )}
    </li>
  );
}

function StatusDot({ status }: { status: MilestoneStatus }) {
  const color =
    status === "completed"
      ? "#2d8a5e"
      : status === "in_progress"
        ? "#5b4fc7"
        : status === "missed"
          ? "#c93b3b"
          : status === "cancelled"
            ? "#999"
            : "#ccc";
  return (
    <span
      aria-label={status}
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

// ---- Residential timeline view -----------------------------------------

function ResidentialTimeline({
  projectName,
  phases,
  overallProgressPct,
}: ScheduleViewProps) {
  // Flatten and re-sort by scheduled date for a single-axis timeline; the
  // residential client doesn't need phase grouping, they just want the story.
  const items = phases
    .flatMap((p) => p.milestones)
    .filter((m) => m.milestoneStatus !== "cancelled")
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Your Project Timeline</h1>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
          {projectName}
        </p>
      </header>

      <OverallProgress pct={overallProgressPct} phases={phases} />

      <div
        style={{
          position: "relative",
          paddingLeft: 24,
          borderLeft: "2px solid #ddd",
          marginLeft: 6,
          marginTop: 16,
        }}
      >
        {items.length === 0 ? (
          <p style={{ color: "#888" }}>
            No milestones to share yet — check back soon.
          </p>
        ) : (
          items.map((m) => <ResidentialTimelineItem key={m.id} milestone={m} />)
        )}
      </div>
    </div>
  );
}

function ResidentialTimelineItem({ milestone: m }: { milestone: MilestoneRow }) {
  const cd = countdownLabel(m);
  const isDone = m.milestoneStatus === "completed";
  const isActive = m.milestoneStatus === "in_progress";
  return (
    <div style={{ marginBottom: 18, position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: -33,
          top: 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: isDone ? "#2d8a5e" : isActive ? "#2a7f6f" : "#fff",
          border: "2px solid " + (isActive ? "#2a7f6f" : "#ccc"),
        }}
      />
      <div
        style={{
          border: "1px solid #e2e5e9",
          borderRadius: 8,
          padding: "10px 14px",
          background: isActive ? "#e6f5f1" : "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <strong style={{ fontSize: 14 }}>{m.title}</strong>
          <span style={{ fontSize: 12, color: "#666" }}>
            {formatShortDate(m.scheduledDate)}
          </span>
        </div>
        {m.description && (
          <p style={{ fontSize: 12.5, color: "#555", margin: "6px 0 0" }}>
            {m.description}
          </p>
        )}
        <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
          {residentialTypeLabel(m.milestoneType)} · {cd.text}
        </div>
      </div>
    </div>
  );
}

// ---- Create / edit forms -----------------------------------------------

function CreateMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneType, setMilestoneType] = useState<MilestoneType>("custom");
  const [phase, setPhase] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [visibilityScope, setVisibilityScope] =
    useState<MilestoneVisibility>("project_wide");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !scheduledDate) {
      setError("missing_fields");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description: description || undefined,
        milestoneType,
        phase: phase || undefined,
        scheduledDate: new Date(scheduledDate).toISOString(),
        visibilityScope,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "create_failed");
      return;
    }
    setTitle("");
    setDescription("");
    setPhase("");
    setScheduledDate("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "grid",
        gap: 6,
        maxWidth: 520,
        border: "1px dashed #ccc",
        padding: 12,
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
      />
      <label>
        Type{" "}
        <select
          value={milestoneType}
          onChange={(e) => setMilestoneType(e.target.value as MilestoneType)}
        >
          {MILESTONE_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <input
        value={phase}
        onChange={(e) => setPhase(e.target.value)}
        placeholder="Phase (e.g. Phase 2 — MEP)"
      />
      <label>
        Scheduled date{" "}
        <input
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
        />
      </label>
      <label>
        Visibility{" "}
        <select
          value={visibilityScope}
          onChange={(e) =>
            setVisibilityScope(e.target.value as MilestoneVisibility)
          }
        >
          {MILESTONE_VISIBILITY_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create milestone"}
      </button>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </form>
  );
}

function EditMilestoneForm({
  milestone: m,
  onDone,
  isContractor,
}: {
  milestone: MilestoneRow;
  onDone: () => void;
  isContractor: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(m.title);
  const [description, setDescription] = useState(m.description ?? "");
  const [milestoneType, setMilestoneType] = useState<MilestoneType>(
    m.milestoneType,
  );
  const [milestoneStatus, setMilestoneStatus] = useState<MilestoneStatus>(
    m.milestoneStatus,
  );
  const [scheduledDate, setScheduledDate] = useState(
    m.scheduledDate.toISOString().slice(0, 10),
  );
  const [phase, setPhase] = useState(m.phase ?? "");
  const [visibilityScope, setVisibilityScope] = useState<MilestoneVisibility>(
    m.visibilityScope,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        milestoneType,
        milestoneStatus,
        scheduledDate: new Date(scheduledDate).toISOString(),
        phase: phase || null,
        visibilityScope,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "update_failed");
      return;
    }
    onDone();
    router.refresh();
  }

  async function cancel() {
    if (!window.confirm("Cancel this milestone? (cannot be undone)")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneStatus: "cancelled" }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "cancel_failed");
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div
      style={{
        marginTop: 8,
        marginLeft: 24,
        display: "grid",
        gap: 6,
        maxWidth: 520,
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description"
      />
      {isContractor && (
        <label>
          Type{" "}
          <select
            value={milestoneType}
            onChange={(e) => setMilestoneType(e.target.value as MilestoneType)}
          >
            {MILESTONE_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Status{" "}
        <select
          value={milestoneStatus}
          onChange={(e) =>
            setMilestoneStatus(e.target.value as MilestoneStatus)
          }
        >
          {MILESTONE_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {isContractor && (
        <>
          <label>
            Scheduled date{" "}
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </label>
          <input
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            placeholder="Phase"
          />
          <label>
            Visibility{" "}
            <select
              value={visibilityScope}
              onChange={(e) =>
                setVisibilityScope(e.target.value as MilestoneVisibility)
              }
            >
              {MILESTONE_VISIBILITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
        {isContractor && m.milestoneStatus !== "cancelled" && (
          <button type="button" onClick={cancel} disabled={pending}>
            Cancel milestone
          </button>
        )}
      </div>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </div>
  );
}
