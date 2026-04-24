"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  Icon,
  MeetingTypePill,
  StatusPill,
  formatScheduledAt,
} from "../../../../meetings-shared";
import type {
  MeetingActivityRow,
  MeetingListRow,
  MeetingType,
} from "@/domain/loaders/meetings";

import {
  ActivityRail,
  CalendarRail,
} from "../../../../meetings-rail";
import { CreateMeetingModal, type AttendeePick } from "./create-modal";

type Person = {
  userId: string;
  userName: string | null;
  userEmail: string;
  orgId: string;
  orgName: string;
  scope: "internal" | "sub" | "external";
};

type StatusFilter = "all" | "scheduled" | "in_progress" | "completed";

const MEETING_TYPES: MeetingType[] = [
  "oac",
  "preconstruction",
  "coordination",
  "progress",
  "safety",
  "closeout",
  "internal",
];

const TYPE_LABEL: Record<MeetingType, string> = {
  oac: "OAC",
  preconstruction: "Precon",
  coordination: "Coord",
  progress: "Progress",
  safety: "Safety",
  closeout: "Closeout",
  internal: "Internal",
};

// CSV escape for a single field: wrap in quotes if it contains commas,
// quotes, or newlines; double-up any embedded quotes.
function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map(csvField).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MeetingsWorkspace({
  projectId,
  projectName,
  rows,
  activity,
  people,
}: {
  projectId: string;
  projectName: string;
  rows: MeetingListRow[];
  activity: MeetingActivityRow[];
  people: Person[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<MeetingType | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const portalBase = `/contractor/project/${projectId}`;

  const kpiUpcoming = rows.filter((r) => r.status === "scheduled").length;
  const kpiInProgress = rows.filter((r) => r.status === "in_progress").length;
  const kpiCompleted = rows.filter((r) => r.status === "completed").length;
  const kpiActionOpen = rows.reduce((s, r) => s + r.actionOpenCount, 0);
  const kpiCarried = rows.reduce((s, r) => s + r.carriedForwardCount, 0);

  const typeSummary = useMemo(() => {
    const counts = new Map<
      MeetingType,
      { upcoming: number; completed: number }
    >();
    for (const t of MEETING_TYPES) {
      counts.set(t, { upcoming: 0, completed: 0 });
    }
    for (const r of rows) {
      const bucket = counts.get(r.type)!;
      if (r.status === "scheduled" || r.status === "in_progress")
        bucket.upcoming += 1;
      if (r.status === "completed") bucket.completed += 1;
    }
    return counts;
  }, [rows]);

  const visible = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.numberLabel.toLowerCase().includes(q) &&
        !r.title.toLowerCase().includes(q) &&
        !(r.chairName ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const exportCsv = () => {
    const header = [
      "Number",
      "Title",
      "Type",
      "Scheduled",
      "Duration (min)",
      "Chair",
      "Status",
      "Attendees",
      "Agenda items",
      "Open actions",
      "Carried forward",
    ];
    const body = visible.map((r) => [
      r.numberLabel,
      r.title,
      TYPE_LABEL[r.type],
      new Date(r.scheduledAt).toLocaleString("en-US"),
      r.durationMinutes,
      r.chairName ?? "",
      r.status,
      r.attendeeCount,
      r.agendaCount,
      r.actionOpenCount,
      r.carriedForwardCount,
    ]);
    const name = `meetings-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(name, [header, ...body.map((row) => row.map(String))]);
  };

  return (
    <>
      <div className="mt-page-hdr">
        <div>
          <h1 className="mt-page-title">Meetings</h1>
          <div className="mt-page-sub">
            {projectName ? `${projectName} · ` : ""}Agendas, minutes,
            attendees, and action items —{" "}
            {kpiCarried > 0 ? (
              <span style={{ color: "var(--wr)", fontWeight: 640 }}>
                {kpiCarried} item{kpiCarried === 1 ? "" : "s"} carried forward
              </span>
            ) : (
              "no open carry-forward items"
            )}
            .
          </div>
        </div>
        <div className="mt-page-actions">
          <button
            type="button"
            className="mt-btn sm"
            onClick={exportCsv}
            disabled={visible.length === 0}
          >
            {Icon.download} Export
          </button>
          <button
            type="button"
            className="mt-btn primary sm"
            onClick={() => setCreateOpen(true)}
          >
            {Icon.plus} New meeting
          </button>
        </div>
      </div>

      <div className="mt-kpi-strip">
        <div className="mt-kpi">
          <div className="mt-kpi-label">Upcoming</div>
          <div className="mt-kpi-val">{kpiUpcoming}</div>
          <div className="mt-kpi-sub">
            {Icon.calendar} this project
          </div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">In progress</div>
          <div className="mt-kpi-val">{kpiInProgress}</div>
          <div className="mt-kpi-sub">live now</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Completed</div>
          <div className="mt-kpi-val">{kpiCompleted}</div>
          <div className="mt-kpi-sub">last 30 days</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Open actions</div>
          <div className="mt-kpi-val">{kpiActionOpen}</div>
          <div className="mt-kpi-sub">across meetings</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Carried forward</div>
          <div
            className="mt-kpi-val"
            style={{ color: kpiCarried > 0 ? "var(--wr)" : undefined }}
          >
            {kpiCarried}
          </div>
          <div className="mt-kpi-sub carry">
            {kpiCarried > 0 ? "from prior meetings" : "all caught up"}
          </div>
        </div>
      </div>

      <div className="mt-type-strip">
        <div className="mt-type-strip-hdr">
          <h4>By meeting type</h4>
          <button
            type="button"
            className="mt-btn xs ghost"
            onClick={() => setTypeFilter("all")}
          >
            Clear filter
          </button>
        </div>
        <div className="mt-type-grid">
          {MEETING_TYPES.map((t) => {
            const c = typeSummary.get(t)!;
            return (
              <button
                key={t}
                type="button"
                className={`mt-type-card${typeFilter === t ? " active" : ""}`}
                onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              >
                <div className="mt-type-card-top">
                  <div className="mt-type-card-name">{TYPE_LABEL[t]}</div>
                  <div
                    className="mt-type-card-dot"
                    style={{ background: typeColorSolid(t) }}
                  />
                </div>
                <div className="mt-type-card-meta">Upcoming / Done</div>
                <div className="mt-type-card-nums">
                  <span>{c.upcoming}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>/</span>
                  <span>{c.completed}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-filter-row">
        <div className="mt-search">
          {Icon.search}
          <input
            placeholder="Search by number, title, or chair"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mt-tabs">
          {(
            [
              ["all", "All", rows.length],
              ["scheduled", "Upcoming", kpiUpcoming],
              ["in_progress", "Live", kpiInProgress],
              ["completed", "Completed", kpiCompleted],
            ] as Array<[StatusFilter, string, number]>
          ).map(([v, label, count]) => (
            <button
              key={v}
              type="button"
              className={`mt-tab${statusFilter === v ? " active" : ""}`}
              onClick={() => setStatusFilter(v)}
            >
              {label}
              <span className="mt-tab-count">{count}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-tertiary)",
            fontWeight: 540,
          }}
        >
          Showing {visible.length} of {rows.length}
        </div>
      </div>

      <div className="mt-workspace">
        {visible.length === 0 ? (
          <div className="mt-empty">
            <h3>No meetings match these filters</h3>
            <p>Clear filters or create a meeting to see it here.</p>
          </div>
        ) : (
          <div className="mt-list">
            <div className="mt-list-hdr">
              <div>Number</div>
              <div>Meeting</div>
              <div>Type</div>
              <div>When</div>
              <div>Chair</div>
              <div>Status</div>
              <div style={{ textAlign: "right" }}>Actions</div>
            </div>
            {visible.map((r) => {
              const s = formatScheduledAt(r.scheduledAt);
              return (
                <Link
                  key={r.id}
                  className="mt-row"
                  href={`${portalBase}/meetings/${r.id}`}
                >
                  <div className="mt-row-num">{r.numberLabel}</div>
                  <div>
                    <div className="mt-row-title">
                      {r.title}
                      {r.carriedForwardCount > 0 ? (
                        <span
                          className="mt-carry-pill"
                          title={`${r.carriedForwardCount} item(s) carried forward from prior meeting`}
                        >
                          {Icon.arrowR} {r.carriedForwardCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-row-sub">
                      {Icon.users} {r.attendeeCount} attendees · {r.agendaCount}{" "}
                      agenda items
                      {r.actionOpenCount > 0 ? (
                        <>
                          {" "}
                          ·{" "}
                          <span
                            style={{ color: "var(--wr)", fontWeight: 640 }}
                          >
                            {r.actionOpenCount} open action
                            {r.actionOpenCount === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <MeetingTypePill type={r.type} />
                  </div>
                  <div>
                    <div className="mt-row-when">
                      {s.dayLabel} {s.dayNumber}
                    </div>
                    <div className="mt-row-when-sub">
                      {s.timeLabel} · {r.durationMinutes}m
                    </div>
                  </div>
                  <div>
                    <div className="mt-row-chair">{r.chairName ?? "—"}</div>
                    {r.chairOrgName ? (
                      <div className="mt-row-chair-sub">{r.chairOrgName}</div>
                    ) : null}
                  </div>
                  <div>
                    <StatusPill status={r.status} />
                  </div>
                  <div
                    style={{ textAlign: "right" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Icon.chevR}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <aside className="mt-rail">
          <CalendarRail meetings={rows} portalBase={portalBase} />
          <ActivityRail rows={activity} portalBase={portalBase} limit={6} />
        </aside>
      </div>

      <CreateMeetingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        people={people}
        onCreated={(meetingId) => {
          setCreateOpen(false);
          router.push(`${portalBase}/meetings/${meetingId}`);
          router.refresh();
        }}
      />
    </>
  );
}

function typeColorSolid(t: MeetingType): string {
  return {
    oac: "#5b4fc7",
    preconstruction: "#8a5b2a",
    coordination: "#2e8a82",
    progress: "#3878a8",
    safety: "#c4700b",
    closeout: "#5b7a6a",
    internal: "#6b5d8c",
  }[t];
}

export type { AttendeePick };
