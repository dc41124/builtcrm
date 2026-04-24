"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  AttendedStatus,
  MeetingDetail,
  MeetingType,
} from "@/domain/loaders/meetings";

import {
  ATTENDEE_SCOPE_LABEL,
  Icon,
  MeetingTypePill,
  RSVP_LABEL,
  StatusPill,
  formatDateShort,
  formatScheduledFull,
  initials,
} from "../../../../../meetings-shared";

type Tab = "agenda" | "attendees" | "minutes" | "my-actions";

// Sub-portal detail view. Read-mostly with three write paths:
//   1. RSVP for my own slot (pill-group in the hero, scheduled only)
//   2. Status change on action items assigned to me or my org
//   3. Nothing else — agenda, attendees, minutes are read-only.
// Pattern matches the JSX prototype's "sub-detail" screen.

export function SubMeetingDetailUI({
  projectId,
  meetingId,
  detail,
}: {
  projectId: string;
  meetingId: string;
  detail: MeetingDetail;
}) {
  const router = useRouter();
  const portalBase = `/subcontractor/project/${projectId}`;
  const [tab, setTab] = useState<Tab>("agenda");

  // Find "my" attendee row — first non-chair. A future refinement can
  // pass the viewer's userId in via props to pin this precisely when
  // the sub's org has multiple attendees on one meeting.
  const myAttendee =
    detail.attendees.find((a) => a.isChair === false) ?? null;
  const myRsvp: AttendedStatus | null = myAttendee?.attendedStatus ?? null;

  const [rsvpSaving, setRsvpSaving] = useState(false);

  const setRsvp = async (status: "accepted" | "tentative" | "declined") => {
    let declineReason: string | null = null;
    if (status === "declined") {
      const input = window.prompt(
        "Optional: let the GC know why you're declining.",
      );
      if (input === null) return;
      declineReason = input.trim() || null;
    }
    setRsvpSaving(true);
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
      setRsvpSaving(false);
    }
  };

  const updateActionStatus = async (
    itemId: string,
    status: "open" | "in_progress" | "done",
  ) => {
    const res = await fetch(
      `/api/meetings/${meetingId}/action-items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.message ?? body.error ?? "Update failed");
      return;
    }
    router.refresh();
  };

  const myActions = detail.actionItems.filter(
    (a) => a.assignedUserId !== null || a.assignedOrgId !== null,
  );
  const openMyActions = myActions.filter((a) => a.status !== "done");

  const scheduledFull = formatScheduledFull(detail.scheduledAt);
  const minutesPublished = !!detail.minutes?.finalizedAt;
  const totalEst = detail.agenda.reduce((s, a) => s + a.estimatedMinutes, 0);
  const acceptedCount = detail.attendees.filter(
    (a) => a.attendedStatus === "accepted",
  ).length;

  const addToCalendar = () => {
    const dt = new Date(detail.scheduledAt);
    const end = new Date(dt.getTime() + detail.durationMinutes * 60_000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BuiltCRM//Meetings//EN",
      "BEGIN:VEVENT",
      `UID:${meetingId}@builtcrm`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dt)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${detail.numberLabel} · ${detail.title}`,
      `DESCRIPTION:Chaired by ${detail.chairName ?? ""}${detail.chairOrgName ? ` (${detail.chairOrgName})` : ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${detail.numberLabel}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printMinutes = () => {
    // Browser-native print-to-PDF is the portfolio-grade path here;
    // server-side PDF rendering can come later. We open a print view
    // scoped to the minutes content.
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const title = `${detail.numberLabel} — ${detail.title}`;
    w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
<style>body{font-family:'Instrument Sans',system-ui,sans-serif;padding:32px;max-width:720px;margin:0 auto;line-height:1.55;color:#111}h1{font-family:'DM Sans',sans-serif;font-weight:760;font-size:20px;margin:0 0 4px}h2{font-family:'DM Sans',sans-serif;font-weight:620;font-size:13px;color:#555;margin:0 0 24px}pre{font-family:inherit;white-space:pre-wrap;font-size:13.5px}</style></head><body>
<h1>${escapeHtml(detail.title)}</h1>
<h2>${escapeHtml(detail.numberLabel)} · ${escapeHtml(scheduledFull)} · Chaired by ${escapeHtml(detail.chairName ?? "—")}</h2>
<pre>${escapeHtml(detail.minutes?.content ?? "")}</pre>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 150);
  };

  const showRsvp = detail.status === "scheduled";

  return (
    <>
      <div className="mt-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`${portalBase}/meetings`} className="mt-btn sm ghost">
            {Icon.back} Back
          </Link>
          <div
            className="mt-crumbs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--text-tertiary)",
            }}
          >
            <span>Meetings</span>
            {Icon.chevR}
            <strong
              style={{
                color: "var(--text-primary)",
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600,
              }}
            >
              {detail.numberLabel}
            </strong>
          </div>
        </div>
        <div className="mt-page-actions">
          <button
            type="button"
            className="mt-btn sm"
            onClick={addToCalendar}
          >
            {Icon.calendar} Add to calendar
          </button>
        </div>
      </div>

      <div className="mt-detail">
        <div className="mt-detail-main">
          <section className="mt-detail-hero">
            <div className="mt-detail-hero-top">
              <div className="mt-detail-hero-left" style={{ flex: 1 }}>
                <h2>{detail.title}</h2>
                <div className="mt-detail-hero-meta">
                  <MeetingTypePill type={detail.type as MeetingType} />
                  <StatusPill status={detail.status} />
                  <span>·</span>
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {Icon.calendar} <strong>{scheduledFull}</strong>
                  </span>
                  <span>·</span>
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {Icon.clock} {detail.durationMinutes} min
                  </span>
                  <span>·</span>
                  <span>
                    Chaired by <strong>{detail.chairName ?? "—"}</strong>
                  </span>
                </div>
              </div>
              {showRsvp ? (
                <div className="mt-hero-rsvp-wrap">
                  <div className="mt-hero-rsvp-label">Your RSVP</div>
                  <div
                    className={`mt-rsvp-group${myRsvp === "invited" || !myRsvp ? " pending" : ""}`}
                  >
                    <button
                      type="button"
                      className={`mt-rsvp-group-btn accepted${myRsvp === "accepted" ? " active" : ""}`}
                      disabled={rsvpSaving}
                      onClick={() => setRsvp("accepted")}
                    >
                      {Icon.check} Accept
                    </button>
                    <button
                      type="button"
                      className={`mt-rsvp-group-btn tentative${myRsvp === "tentative" ? " active" : ""}`}
                      disabled={rsvpSaving}
                      onClick={() => setRsvp("tentative")}
                    >
                      {Icon.dash} Tentative
                    </button>
                    <button
                      type="button"
                      className={`mt-rsvp-group-btn declined${myRsvp === "declined" ? " active" : ""}`}
                      disabled={rsvpSaving}
                      onClick={() => setRsvp("declined")}
                    >
                      {Icon.x} Decline
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-detail-summary">
              <div className="mt-summary-item">
                <div className="mt-summary-label">Agenda items</div>
                <div className="mt-summary-val">{detail.agenda.length}</div>
                <div className="mt-summary-sub">{totalEst} min estimated</div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Attendees</div>
                <div className="mt-summary-val">{detail.attendees.length}</div>
                <div className="mt-summary-sub">
                  {acceptedCount} accepted
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">My action items</div>
                <div
                  className="mt-summary-val"
                  style={{
                    color:
                      myActions.filter(
                        (a) =>
                          a.status !== "done" &&
                          a.dueDate &&
                          new Date(a.dueDate) < new Date(),
                      ).length > 0
                        ? "var(--er)"
                        : undefined,
                  }}
                >
                  {openMyActions.length}
                </div>
                <div className="mt-summary-sub">
                  {myActions.length === 0
                    ? "none assigned to you"
                    : `${myActions.filter((a) => a.status === "done").length} completed`}
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Minutes</div>
                <div
                  className="mt-summary-val"
                  style={{ fontSize: 15, fontWeight: 720 }}
                >
                  {detail.status === "completed"
                    ? minutesPublished
                      ? "Published"
                      : "Pending"
                    : detail.status === "in_progress"
                      ? "Drafting"
                      : "Pending"}
                </div>
                <div className="mt-summary-sub">
                  {detail.status === "completed" && minutesPublished
                    ? "by the chair"
                    : detail.status === "scheduled"
                      ? "after the meeting"
                      : detail.status === "in_progress"
                        ? "live now"
                        : "—"}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-detail-tabs">
            <div className="mt-detail-tab-bar">
              {(
                [
                  ["agenda", "Agenda", detail.agenda.length, Icon.list],
                  [
                    "attendees",
                    "Attendees",
                    detail.attendees.length,
                    Icon.users,
                  ],
                  ["minutes", "Minutes", null, Icon.edit],
                  [
                    "my-actions",
                    "My actions",
                    myActions.length,
                    Icon.clipboard,
                  ],
                ] as Array<[Tab, string, number | null, React.ReactNode]>
              ).map(([k, label, count, icon]) => (
                <button
                  key={k}
                  type="button"
                  className={`mt-detail-tab${tab === k ? " active" : ""}`}
                  onClick={() => setTab(k)}
                >
                  {icon} {label}
                  {count !== null ? (
                    <span className="mt-detail-tab-count">{count}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="mt-detail-tab-body">
              {tab === "agenda" ? (
                <div>
                  <div className="mt-detail-tab-hdr">
                    <h3>Agenda</h3>
                    <span className="mt-tab-hdr-meta">
                      {totalEst} min estimated · read-only
                    </span>
                  </div>
                  {detail.agenda.length === 0 ? (
                    <div className="mt-empty">
                      <h3>No agenda published</h3>
                      <p>The GC hasn&apos;t filled in an agenda yet.</p>
                    </div>
                  ) : (
                    <div className="mt-agenda-list">
                      {detail.agenda.map((a, idx) => (
                        <div
                          key={a.id}
                          className={`mt-agenda-row${a.carriedFromLabel ? " carry" : ""}`}
                        >
                          <div className="mt-agenda-num">{idx + 1}.</div>
                          <div className="mt-agenda-body">
                            <div className="mt-agenda-title-row">
                              <span className="mt-agenda-title">{a.title}</span>
                              {a.carriedFromLabel ? (
                                <span className="mt-carry-pill">
                                  {Icon.arrowR} Carry-forward
                                </span>
                              ) : null}
                            </div>
                            {a.description ? (
                              <div className="mt-agenda-desc">
                                {a.description}
                              </div>
                            ) : null}
                            <div className="mt-agenda-meta">
                              <span className="mt-agenda-meta-item">
                                {Icon.user}
                                <span className="mt-agenda-presenter">
                                  {a.assignedUserName ?? "—"}
                                </span>
                              </span>
                              <span className="mt-agenda-meta-item">
                                {Icon.clock}
                                <span className="mt-agenda-est">
                                  {a.estimatedMinutes} min
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "attendees" ? (
                <div>
                  <div className="mt-detail-tab-hdr">
                    <h3>Attendees</h3>
                    <span className="mt-tab-hdr-meta">read-only</span>
                  </div>
                  <div className="mt-att-grid">
                    {detail.attendees.map((a) => (
                      <div key={a.id}>
                        <div className="mt-att-row">
                          <div
                            className={`mt-att-avatar${a.isChair ? " chair" : ""}`}
                          >
                            {initials(a.displayName)}
                          </div>
                          <div className="mt-att-body">
                            <div className="mt-att-name">{a.displayName}</div>
                            <div className="mt-att-role">
                              {a.roleLabel ? <span>{a.roleLabel}</span> : null}
                              {a.orgName ? (
                                <span className="mt-att-org">· {a.orgName}</span>
                              ) : null}
                              <span className={`mt-att-scope ${a.scope}`}>
                                {ATTENDEE_SCOPE_LABEL[a.scope]}
                              </span>
                            </div>
                          </div>
                          <span className={`mt-att-rsvp ${a.attendedStatus}`}>
                            {a.attendedStatus === "accepted"
                              ? Icon.check
                              : a.attendedStatus === "declined"
                                ? Icon.x
                                : null}
                            {RSVP_LABEL[a.attendedStatus] ?? a.attendedStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "minutes" ? (
                <div>
                  <div className="mt-detail-tab-hdr">
                    <h3>
                      Meeting minutes {minutesPublished ? "(published)" : ""}
                    </h3>
                    {detail.status === "completed" && minutesPublished ? (
                      <button
                        type="button"
                        className="mt-btn xs ghost"
                        onClick={printMinutes}
                      >
                        {Icon.copy} Export PDF
                      </button>
                    ) : null}
                  </div>
                  {minutesPublished && detail.minutes ? (
                    <div className="mt-minutes-readonly">
                      {detail.minutes.content}
                    </div>
                  ) : detail.status === "in_progress" ? (
                    <div className="mt-minutes-readonly-pending">
                      Minutes are being taken live. They will appear here
                      once the chair finalizes them.
                    </div>
                  ) : (
                    <div className="mt-minutes-readonly-pending">
                      Minutes will be published here after the meeting.
                      You&apos;ll receive an email notification when
                      they&apos;re available.
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "my-actions" ? (
                <div>
                  <div className="mt-detail-tab-hdr">
                    <h3>Action items assigned to your team</h3>
                    <span className="mt-tab-hdr-meta">
                      {openMyActions.length} open ·{" "}
                      {myActions.filter((a) => a.status === "done").length}{" "}
                      completed
                    </span>
                  </div>
                  {myActions.length === 0 ? (
                    <div className="mt-minutes-readonly-pending">
                      No action items from this meeting are assigned to your
                      team.
                    </div>
                  ) : (
                    <div className="mt-actions-table">
                      <div className="mt-actions-table-hdr">
                        <div>Description</div>
                        <div>Due</div>
                        <div>Status</div>
                        <div>Carried from</div>
                        <div></div>
                      </div>
                      {myActions.map((a) => {
                        const dueStatus = dueStatusOf(a.dueDate, a.status);
                        return (
                          <div key={a.id} className="mt-actions-row">
                            <div className="mt-actions-desc">
                              {a.description}
                            </div>
                            <div
                              className={`mt-actions-due${dueStatus ? ` ${dueStatus}` : ""}`}
                            >
                              {formatDateShort(a.dueDate)}
                              {dueStatus === "overdue"
                                ? " · overdue"
                                : dueStatus === "soon"
                                  ? " · soon"
                                  : ""}
                            </div>
                            <div>
                              <select
                                className={`mt-actions-status-sel ${a.status}`}
                                value={a.status}
                                onChange={(e) =>
                                  updateActionStatus(
                                    a.id,
                                    e.target.value as
                                      | "open"
                                      | "in_progress"
                                      | "done",
                                  )
                                }
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Done</option>
                              </select>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                fontWeight: 540,
                              }}
                            >
                              {a.carriedFromLabel ?? "—"}
                            </div>
                            <div></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="mt-rail">
          <div className="mt-rail-card">
            <div className="mt-rail-hdr">
              <h4>{Icon.info} Your role</h4>
            </div>
            <div
              style={{
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--text-secondary)",
                fontWeight: 540,
                lineHeight: 1.55,
              }}
            >
              You can RSVP, read the agenda and minutes, and update the
              status of action items assigned to your team. Only the chair
              can edit meeting details.
            </div>
          </div>

          {detail.status === "scheduled" ? (
            <div className="mt-rail-card">
              <div className="mt-rail-hdr">
                <h4>{Icon.calendar} Before the meeting</h4>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 540,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color:
                        detail.agenda.length > 0
                          ? "var(--ok)"
                          : "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {detail.agenda.length > 0 ? Icon.check : Icon.dash}
                  </span>
                  <span>Review the agenda above</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color:
                        myRsvp && myRsvp !== "invited"
                          ? "var(--ok)"
                          : "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {myRsvp && myRsvp !== "invited" ? Icon.check : Icon.dash}
                  </span>
                  <span>
                    RSVP{" "}
                    {myRsvp && myRsvp !== "invited"
                      ? `(${RSVP_LABEL[myRsvp]})`
                      : "— pending"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color:
                        openMyActions.length === 0
                          ? "var(--ok)"
                          : "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {openMyActions.length === 0 ? Icon.check : Icon.dash}
                  </span>
                  <span>
                    Close out overdue action items from prior meetings
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {detail.status === "completed" ? (
            <div className="mt-rail-card">
              <div className="mt-rail-hdr">
                <h4>{Icon.sparkle} Follow-up</h4>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 540,
                  lineHeight: 1.55,
                }}
              >
                {openMyActions.length > 0 ? (
                  <>
                    You have{" "}
                    <strong style={{ color: "var(--wr)" }}>
                      {openMyActions.length} open action item
                      {openMyActions.length === 1 ? "" : "s"}
                    </strong>{" "}
                    from this meeting. Update status as you make progress.
                  </>
                ) : (
                  <>No outstanding action items from this meeting.</>
                )}
              </div>
            </div>
          ) : null}

          {detail.status === "cancelled" && detail.cancelledReason ? (
            <div className="mt-rail-card">
              <div className="mt-rail-hdr">
                <h4>{Icon.info} Cancelled</h4>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 540,
                  lineHeight: 1.55,
                }}
              >
                {detail.cancelledReason}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function dueStatusOf(
  date: string | null,
  status: "open" | "in_progress" | "done",
): "overdue" | "soon" | null {
  if (!date || status === "done") return null;
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "soon";
  return null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
