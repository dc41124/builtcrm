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
  MeetingListRow,
  MeetingType,
} from "@/domain/loaders/meetings";

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
  preconstruction: "Preconstruction",
  coordination: "Coordination",
  progress: "Progress",
  safety: "Safety",
  closeout: "Closeout",
  internal: "Internal",
};

export function MeetingsWorkspace({
  projectId,
  projectName,
  rows,
  people,
}: {
  projectId: string;
  projectName: string;
  rows: MeetingListRow[];
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
      { upcoming: number; completed: number; actionOpen: number }
    >();
    for (const t of MEETING_TYPES) {
      counts.set(t, { upcoming: 0, completed: 0, actionOpen: 0 });
    }
    for (const r of rows) {
      const bucket = counts.get(r.type)!;
      if (r.status === "scheduled" || r.status === "in_progress")
        bucket.upcoming += 1;
      if (r.status === "completed") bucket.completed += 1;
      bucket.actionOpen += r.actionOpenCount;
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

  const upcomingList = rows
    .filter((r) => r.status === "scheduled" || r.status === "in_progress")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 5);

  return (
    <>
      <div className="mt-page-hdr">
        <div>
          <h1 className="mt-page-title">Meetings</h1>
          <div className="mt-page-sub">
            {projectName ? `${projectName} · ` : ""}Agendas, minutes,
            attendees, and action items. Carry-forward keeps every
            recurring meeting honest.
          </div>
        </div>
        <div className="mt-page-actions">
          <button
            type="button"
            className="mt-btn primary"
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
          <div className="mt-kpi-sub">Scheduled</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">In progress</div>
          <div className="mt-kpi-val">{kpiInProgress}</div>
          <div className="mt-kpi-sub">Running now</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Completed</div>
          <div className="mt-kpi-val">{kpiCompleted}</div>
          <div className="mt-kpi-sub">This project</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Open actions</div>
          <div className="mt-kpi-val">{kpiActionOpen}</div>
          <div className="mt-kpi-sub">Across all meetings</div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Carried forward</div>
          <div className="mt-kpi-val">{kpiCarried}</div>
          <div className="mt-kpi-sub carry">
            {Icon.arrowR} From prior meetings
          </div>
        </div>
      </div>

      <div className="mt-workspace">
        <div>
          <div className="mt-type-strip">
            <div className="mt-type-strip-hdr">
              <h4>By type</h4>
              <button
                type="button"
                className="mt-btn ghost xs"
                onClick={() => setTypeFilter("all")}
              >
                Clear
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
                    onClick={() =>
                      setTypeFilter(typeFilter === t ? "all" : t)
                    }
                  >
                    <div className="mt-type-card-top">
                      <span className="mt-type-card-name">{TYPE_LABEL[t]}</span>
                      <span
                        className="mt-type-card-dot"
                        style={{
                          background: typeColorSolid(t),
                        }}
                      />
                    </div>
                    <div className="mt-type-card-meta">
                      {c.upcoming} upcoming · {c.completed} done
                    </div>
                    <div className="mt-type-card-nums">
                      <span>{c.actionOpen} open actions</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-filter-row" style={{ margin: "16px 0 10px" }}>
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
                  ["all", "All"],
                  ["scheduled", "Scheduled"],
                  ["in_progress", "In Progress"],
                  ["completed", "Completed"],
                ] as Array<[StatusFilter, string]>
              ).map(([v, label]) => {
                const count =
                  v === "all"
                    ? rows.length
                    : rows.filter((r) => r.status === v).length;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`mt-tab${statusFilter === v ? " active" : ""}`}
                    onClick={() => setStatusFilter(v)}
                  >
                    {label}
                    <span className="mt-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-empty">
              <h3>No meetings match these filters</h3>
              <p>Clear filters or create a meeting to see it here.</p>
            </div>
          ) : (
            <div className="mt-list">
              <div className="mt-list-hdr">
                <div>Number</div>
                <div>Title</div>
                <div>Type</div>
                <div>Scheduled</div>
                <div>Chair</div>
                <div>Status</div>
                <div>Open</div>
              </div>
              {visible.map((r) => {
                const sched = formatScheduledAt(r.scheduledAt);
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
                          <span className="mt-carry-pill">
                            {Icon.arrowR} {r.carriedForwardCount} carried
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-row-sub">
                        {Icon.users} {r.attendeeCount} attendees · {r.agendaCount}{" "}
                        items
                      </div>
                    </div>
                    <div>
                      <MeetingTypePill type={r.type} />
                    </div>
                    <div>
                      <div className="mt-row-when">
                        {sched.dayLabel} {sched.dayNumber}
                      </div>
                      <div className="mt-row-when-sub">
                        {sched.timeLabel} · {r.durationMinutes}m
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
                    <div>
                      <span
                        className={`mt-row-count${r.actionOpenCount === 0 ? " zero" : ""}`}
                      >
                        {r.actionOpenCount > 0 ? r.actionOpenCount : "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside className="mt-rail">
          <div className="mt-rail-card">
            <div className="mt-rail-hdr">
              <h4>
                {Icon.calendar} Upcoming
              </h4>
            </div>
            {upcomingList.length === 0 ? (
              <div
                style={{
                  padding: "24px 18px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12.5,
                }}
              >
                No upcoming meetings.
              </div>
            ) : (
              <div style={{ padding: "8px 14px 12px" }}>
                {upcomingList.map((r) => {
                  const s = formatScheduledAt(r.scheduledAt);
                  return (
                    <Link
                      key={r.id}
                      className="mt-cal-upcoming-item"
                      href={`${portalBase}/meetings/${r.id}`}
                    >
                      <div className="mt-cal-upcoming-date">
                        {s.dayLabel}
                        <strong>{s.dayNumber}</strong>
                      </div>
                      <div className="mt-cal-upcoming-body">
                        <div className="mt-cal-upcoming-title">{r.title}</div>
                        <div className="mt-cal-upcoming-meta">
                          {s.timeLabel}
                          <MeetingTypePill type={r.type} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
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
