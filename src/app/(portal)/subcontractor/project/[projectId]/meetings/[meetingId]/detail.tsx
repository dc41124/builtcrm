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
  StatusPill,
  formatDateShort,
  formatScheduledFull,
  initials,
} from "../../../../../meetings-shared";

type Tab = "agenda" | "attendees" | "minutes" | "my-actions";

// Sub-portal detail view. Read-mostly with three write paths:
//   1. RSVP for my own slot (pill-group in the hero)
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

  // Find "my" attendee row — may be by userId or org match.
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

  const myActions = detail.actionItems.filter((a) => {
    // Sub's own + their org's assignments.
    return a.assignedUserId !== null || a.assignedOrgId !== null;
  });

  const scheduledFull = formatScheduledFull(detail.scheduledAt);
  const minutesPublished = !!detail.minutes?.finalizedAt;

  return (
    <>
      <div className="mt-page-hdr">
        <div>
          <Link
            href={`${portalBase}/meetings`}
            className="mt-btn ghost sm"
            style={{ marginBottom: 6 }}
          >
            {Icon.back} All meetings
          </Link>
          <h1 className="mt-page-title" style={{ fontSize: 22 }}>
            {detail.title}
          </h1>
        </div>
      </div>

      <div className="mt-detail">
        <div className="mt-detail-main">
          <section className="mt-detail-hero">
            <div className="mt-detail-hero-top">
              <div className="mt-detail-hero-left">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    {detail.numberLabel}
                  </span>
                  <MeetingTypePill type={detail.type as MeetingType} />
                  <StatusPill status={detail.status} />
                </div>
                <h2>{detail.title}</h2>
                <div className="mt-detail-hero-meta">
                  <span>
                    {Icon.calendar} {scheduledFull}
                  </span>
                  <span>
                    {Icon.clock} {detail.durationMinutes}m
                  </span>
                  <span>
                    {Icon.user} Chair:{" "}
                    <strong>{detail.chairName ?? "—"}</strong>
                  </span>
                </div>
              </div>
              <div className="mt-hero-rsvp-wrap">
                <span className="mt-hero-rsvp-label">Your RSVP</span>
                <div
                  className={`mt-rsvp-group${myRsvp === "invited" ? " pending" : ""}`}
                >
                  <button
                    type="button"
                    className={`mt-rsvp-group-btn accepted${myRsvp === "accepted" ? " active" : ""}`}
                    disabled={
                      rsvpSaving ||
                      detail.status === "completed" ||
                      detail.status === "cancelled"
                    }
                    onClick={() => setRsvp("accepted")}
                  >
                    {Icon.check} Accept
                  </button>
                  <button
                    type="button"
                    className={`mt-rsvp-group-btn tentative${myRsvp === "tentative" ? " active" : ""}`}
                    disabled={
                      rsvpSaving ||
                      detail.status === "completed" ||
                      detail.status === "cancelled"
                    }
                    onClick={() => setRsvp("tentative")}
                  >
                    Tentative
                  </button>
                  <button
                    type="button"
                    className={`mt-rsvp-group-btn declined${myRsvp === "declined" ? " active" : ""}`}
                    disabled={
                      rsvpSaving ||
                      detail.status === "completed" ||
                      detail.status === "cancelled"
                    }
                    onClick={() => setRsvp("declined")}
                  >
                    {Icon.x} Decline
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-detail-summary">
              <div className="mt-summary-item">
                <div className="mt-summary-label">Attendees</div>
                <div className="mt-summary-val">{detail.attendeeCount}</div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Agenda</div>
                <div className="mt-summary-val">{detail.agendaCount}</div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Your actions</div>
                <div className="mt-summary-val">
                  {myActions.filter((a) => a.status !== "done").length}
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Minutes</div>
                <div className="mt-summary-val" style={{ fontSize: 14 }}>
                  {minutesPublished ? "Published" : "Pending"}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-detail-tabs">
            <div className="mt-detail-tab-bar">
              {(
                [
                  ["agenda", "Agenda", detail.agenda.length],
                  ["attendees", "Attendees", detail.attendees.length],
                  ["minutes", "Minutes", null],
                  ["my-actions", "My actions", myActions.length],
                ] as Array<[Tab, string, number | null]>
              ).map(([k, label, count]) => (
                <button
                  key={k}
                  type="button"
                  className={`mt-detail-tab${tab === k ? " active" : ""}`}
                  onClick={() => setTab(k)}
                >
                  {label}
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
                                  {Icon.arrowR} From {a.carriedFromLabel}
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
                                  {a.estimatedMinutes}m
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
                    <h3>Attendees ({detail.attendees.length})</h3>
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
                                <span className="mt-att-org">{a.orgName}</span>
                              ) : null}
                              <span className={`mt-att-scope ${a.scope}`}>
                                {ATTENDEE_SCOPE_LABEL[a.scope]}
                              </span>
                            </div>
                          </div>
                          <span className={`mt-att-rsvp ${a.attendedStatus}`}>
                            {a.attendedStatus === "accepted"
                              ? "Accepted"
                              : a.attendedStatus === "declined"
                                ? "Declined"
                                : a.attendedStatus === "tentative"
                                  ? "Tentative"
                                  : a.attendedStatus === "attended"
                                    ? "Attended"
                                    : a.attendedStatus === "absent"
                                      ? "Absent"
                                      : "Invited"}
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
                    <h3>Minutes {minutesPublished ? "(published)" : ""}</h3>
                  </div>
                  {minutesPublished && detail.minutes ? (
                    <div className="mt-minutes-readonly">
                      {detail.minutes.content}
                    </div>
                  ) : (
                    <div className="mt-minutes-readonly-pending">
                      Minutes haven&apos;t been published yet. You&apos;ll be
                      notified once the chair finalizes them.
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "my-actions" ? (
                <div>
                  <div className="mt-detail-tab-hdr">
                    <h3>Your action items ({myActions.length})</h3>
                  </div>
                  {myActions.length === 0 ? (
                    <div className="mt-empty">
                      <h3>Nothing owed from this meeting</h3>
                      <p>No action items were assigned to you or your org.</p>
                    </div>
                  ) : (
                    <div className="mt-actions-table">
                      <div className="mt-actions-table-hdr">
                        <div>Description</div>
                        <div>Assignee</div>
                        <div>Due</div>
                        <div>Status</div>
                        <div></div>
                      </div>
                      {myActions.map((a) => (
                        <div key={a.id} className="mt-actions-row">
                          <div className="mt-actions-desc">
                            <div className="mt-actions-desc-main">
                              {a.description}
                            </div>
                            {a.carriedFromLabel ? (
                              <div className="mt-actions-desc-carried">
                                {Icon.arrowR} Carried from {a.carriedFromLabel}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-actions-assignee">
                            <span className="mt-actions-assignee-name">
                              {a.assignedUserName ?? "—"}
                            </span>
                            {a.assignedOrgName ? (
                              <span className="mt-actions-assignee-org">
                                {a.assignedOrgName}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-actions-due">
                            {formatDateShort(a.dueDate)}
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
                          <div></div>
                        </div>
                      ))}
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
              <h4>{Icon.info} About this meeting</h4>
            </div>
            <div style={{ padding: "12px 14px", fontSize: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontWeight: 680,
                    fontSize: 10.5,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 3,
                  }}
                >
                  Project
                </div>
                <div style={{ fontWeight: 640 }}>{detail.project.name}</div>
              </div>
              {detail.status === "cancelled" && detail.cancelledReason ? (
                <div className="mt-att-decline-note">
                  {Icon.info} <span>{detail.cancelledReason}</span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
