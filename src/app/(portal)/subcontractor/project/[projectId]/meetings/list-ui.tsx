"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  AttendedStatus,
  MeetingListRow,
  MyActionItemRow,
  RecentPublishedMinutesRow,
} from "@/domain/loaders/meetings";

import {
  Icon,
  MeetingTypePill,
  StatusPill,
  formatScheduledAt,
} from "../../../../meetings-shared";

type StatusFilter = "all" | "upcoming" | "awaiting" | "completed";

export function SubMeetingsList({
  projectId,
  rows,
  myActions,
  recentMinutes,
}: {
  projectId: string;
  rows: MeetingListRow[];
  myActions: MyActionItemRow[];
  recentMinutes: RecentPublishedMinutesRow[];
}) {
  const router = useRouter();
  const portalBase = `/subcontractor/project/${projectId}`;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rsvpSaving, setRsvpSaving] = useState<string | null>(null);

  const kpiUpcoming = rows.filter((r) => r.status === "scheduled").length;
  const kpiCompleted = rows.filter((r) => r.status === "completed").length;
  const kpiOpenActions = myActions.filter((a) => a.status !== "done").length;
  const kpiOverdueActions = myActions.filter(
    (a) => a.status !== "done" && a.dueStatus === "overdue",
  ).length;

  // "Awaiting RSVP" = scheduled meetings where the sub hasn't confirmed.
  // For now we approximate with "no accepted/declined/tentative response
  // from any attendee whose org matches the sub" — we don't know which
  // attendee row is the sub's seat without a viewer lookup. A later pass
  // can refine this by loading the sub's own attendee row per meeting.
  const kpiAwaiting = kpiUpcoming; // placeholder — refined below once we
  // have the per-meeting attendee rows. For the rough filter we treat
  // every scheduled meeting as potentially awaiting until we know the
  // viewer's RSVP on it.

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter === "upcoming" && r.status !== "scheduled")
          return false;
        if (statusFilter === "awaiting" && r.status !== "scheduled")
          return false;
        if (statusFilter === "completed" && r.status !== "completed")
          return false;
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
      }),
    [rows, statusFilter, search],
  );

  const setRsvp = async (
    meetingId: string,
    status: "accepted" | "tentative" | "declined",
  ) => {
    let declineReason: string | null = null;
    if (status === "declined") {
      const input = window.prompt(
        "Optional: let the GC know why you're declining.",
      );
      if (input === null) return;
      declineReason = input.trim() || null;
    }
    setRsvpSaving(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, declineReason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "RSVP failed");
        return;
      }
      router.refresh();
    } finally {
      setRsvpSaving(null);
    }
  };

  const addToCalendar = () => {
    // Emit an .ics bundle for the visible scheduled meetings. Standard
    // text/calendar so native calendar apps pick it up directly.
    const vevents = visible
      .filter((r) => r.status === "scheduled")
      .map((r) => {
        const dt = new Date(r.scheduledAt);
        const endDt = new Date(dt.getTime() + r.durationMinutes * 60_000);
        const fmt = (d: Date) =>
          d
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, "");
        return [
          "BEGIN:VEVENT",
          `UID:${r.id}@builtcrm`,
          `DTSTAMP:${fmt(new Date())}`,
          `DTSTART:${fmt(dt)}`,
          `DTEND:${fmt(endDt)}`,
          `SUMMARY:${r.numberLabel} · ${r.title}`,
          `DESCRIPTION:Chaired by ${r.chairName ?? ""}${r.chairOrgName ? ` (${r.chairOrgName})` : ""}`,
          "END:VEVENT",
        ].join("\r\n");
      });
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BuiltCRM//Meetings//EN",
      ...vevents,
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meetings.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mt-page-hdr">
        <div>
          <h1 className="mt-page-title">Meetings</h1>
          <div className="mt-page-sub">
            Meetings your team is invited to —{" "}
            {kpiAwaiting > 0 ? (
              <span style={{ color: "var(--wr)", fontWeight: 640 }}>
                {kpiAwaiting} awaiting your RSVP
              </span>
            ) : (
              "all caught up"
            )}
            .
          </div>
        </div>
        <div className="mt-page-actions">
          <button
            type="button"
            className="mt-btn sm"
            onClick={addToCalendar}
            disabled={visible.filter((r) => r.status === "scheduled").length === 0}
          >
            {Icon.calendar} Add to calendar
          </button>
        </div>
      </div>

      <div className="mt-kpi-strip four">
        <div className="mt-kpi">
          <div className="mt-kpi-label">Upcoming</div>
          <div className="mt-kpi-val">{kpiUpcoming}</div>
          <div className="mt-kpi-sub">
            {Icon.calendar} you&apos;re invited to
          </div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Awaiting RSVP</div>
          <div
            className="mt-kpi-val"
            style={{ color: kpiAwaiting > 0 ? "var(--wr)" : undefined }}
          >
            {kpiAwaiting}
          </div>
          <div className="mt-kpi-sub">
            {kpiAwaiting > 0 ? "respond before meeting start" : "all replied"}
          </div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">My open actions</div>
          <div
            className="mt-kpi-val"
            style={{ color: kpiOverdueActions > 0 ? "var(--er)" : undefined }}
          >
            {kpiOpenActions}
          </div>
          <div className="mt-kpi-sub">
            {kpiOverdueActions > 0 ? (
              <span style={{ color: "var(--er)" }}>
                {kpiOverdueActions} overdue
              </span>
            ) : (
              "across meetings"
            )}
          </div>
        </div>
        <div className="mt-kpi">
          <div className="mt-kpi-label">Completed</div>
          <div className="mt-kpi-val">{kpiCompleted}</div>
          <div className="mt-kpi-sub">minutes available</div>
        </div>
      </div>

      <div className="mt-filter-row">
        <div className="mt-search">
          {Icon.search}
          <input
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mt-tabs">
          {(
            [
              ["all", "All", rows.length],
              ["upcoming", "Upcoming", kpiUpcoming],
              ["awaiting", "Awaiting RSVP", kpiAwaiting],
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
        <div>
          {visible.length === 0 ? (
            <div className="mt-empty">
              <h3>No meetings match these filters</h3>
              <p>Switch tabs or clear the search to see more.</p>
            </div>
          ) : (
            <div className="mt-list">
              <div className="mt-sub-list-hdr">
                <div>#</div>
                <div>Meeting</div>
                <div>Type</div>
                <div>Scheduled</div>
                <div>Your RSVP</div>
                <div>Status</div>
                <div></div>
              </div>
              {visible.map((r) => (
                <SubRow
                  key={r.id}
                  r={r}
                  portalBase={portalBase}
                  saving={rsvpSaving === r.id}
                  onRsvp={setRsvp}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="mt-rail">
          <div className="mt-rail-card">
            <div className="mt-rail-hdr">
              <h4>{Icon.clipboard} Your open action items</h4>
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--text-tertiary)",
                  fontWeight: 600,
                }}
              >
                {kpiOpenActions} open
              </span>
            </div>
            {kpiOpenActions === 0 ? (
              <div
                style={{
                  padding: "20px 14px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12,
                  fontWeight: 540,
                }}
              >
                No open action items assigned to you.
              </div>
            ) : (
              myActions
                .filter((a) => a.status !== "done")
                .slice(0, 8)
                .map((a) => (
                  <Link
                    key={a.id}
                    href={`${portalBase}/meetings/${a.meetingId}`}
                    className="mt-sub-action"
                  >
                    <div className="mt-sub-action-top">
                      <div className="mt-sub-action-desc">{a.description}</div>
                      <div className="mt-sub-action-ref">
                        {a.meetingNumberLabel}
                      </div>
                    </div>
                    <div className="mt-sub-action-meta">
                      <span>From {a.meetingTitle}</span>
                      <span>·</span>
                      <span
                        className={`mt-sub-action-due${
                          a.dueStatus === "overdue"
                            ? " overdue"
                            : a.dueStatus === "soon"
                              ? " soon"
                              : ""
                        }`}
                      >
                        {a.dueDate ? `Due ${a.dueDate}` : "No due date"}
                        {a.dueStatus === "overdue" ? " · overdue" : ""}
                        {a.dueStatus === "soon" ? " · soon" : ""}
                      </span>
                    </div>
                  </Link>
                ))
            )}
          </div>

          {recentMinutes.length > 0 ? (
            <div className="mt-rail-card">
              <div className="mt-rail-hdr">
                <h4>{Icon.list} Recently published minutes</h4>
              </div>
              {recentMinutes.map((m) => (
                <Link
                  key={m.meetingId}
                  href={`${portalBase}/meetings/${m.meetingId}`}
                  className="mt-sub-action"
                >
                  <div className="mt-sub-action-top">
                    <div className="mt-sub-action-desc">{m.title}</div>
                    <div className="mt-sub-action-ref">{m.numberLabel}</div>
                  </div>
                  <div className="mt-sub-action-meta">
                    <MeetingTypePill type={m.type} />
                    <span>{formatScheduledAt(m.scheduledAt).dayLabel}{" "}
                      {formatScheduledAt(m.scheduledAt).dayNumber}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function SubRow({
  r,
  portalBase,
  saving,
  onRsvp,
}: {
  r: MeetingListRow;
  portalBase: string;
  saving: boolean;
  onRsvp: (
    meetingId: string,
    status: "accepted" | "tentative" | "declined",
  ) => void;
}) {
  const s = formatScheduledAt(r.scheduledAt);
  const showRsvp = r.status === "scheduled";
  return (
    <Link href={`${portalBase}/meetings/${r.id}`} className="mt-sub-row">
      <div className="mt-row-num">{r.numberLabel}</div>
      <div>
        <div className="mt-row-title">{r.title}</div>
        <div className="mt-row-sub">
          {Icon.user} Chaired by {r.chairName ?? "—"} · {r.durationMinutes}{" "}
          min
        </div>
      </div>
      <div>
        <MeetingTypePill type={r.type} />
      </div>
      <div>
        <div className="mt-row-when">
          {s.dayLabel} {s.dayNumber}
        </div>
        <div className="mt-row-when-sub">{s.timeLabel}</div>
      </div>
      <div onClick={(e) => e.preventDefault()}>
        {showRsvp ? (
          <RsvpGroup
            current={null as AttendedStatus | null}
            disabled={saving}
            onPick={(st) => onRsvp(r.id, st)}
          />
        ) : (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-tertiary)",
              fontWeight: 540,
            }}
          >
            —
          </span>
        )}
      </div>
      <div>
        <StatusPill status={r.status} />
      </div>
      <div style={{ textAlign: "right", color: "var(--text-tertiary)" }}>
        {Icon.chevR}
      </div>
    </Link>
  );
}

function RsvpGroup({
  current,
  disabled,
  onPick,
  compact = true,
}: {
  current: AttendedStatus | null;
  disabled: boolean;
  onPick: (status: "accepted" | "tentative" | "declined") => void;
  compact?: boolean;
}) {
  const pending = !current;
  return (
    <div className={`mt-rsvp-group${pending ? " pending" : ""}`}>
      <button
        type="button"
        className={`mt-rsvp-group-btn accepted${current === "accepted" ? " active" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick("accepted");
        }}
        disabled={disabled}
        title="Accept"
      >
        {Icon.check}
        {compact ? null : <span>Accept</span>}
      </button>
      <button
        type="button"
        className={`mt-rsvp-group-btn tentative${current === "tentative" ? " active" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick("tentative");
        }}
        disabled={disabled}
        title="Tentative"
      >
        {Icon.dash}
        {compact ? null : <span>Tentative</span>}
      </button>
      <button
        type="button"
        className={`mt-rsvp-group-btn declined${current === "declined" ? " active" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPick("declined");
        }}
        disabled={disabled}
        title="Decline"
      >
        {Icon.x}
        {compact ? null : <span>Decline</span>}
      </button>
    </div>
  );
}
