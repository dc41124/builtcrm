"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Icon,
  formatScheduledAt,
  initials,
} from "./meetings-shared";
import type {
  MeetingListRow,
  MeetingActivityRow,
} from "@/domain/loaders/meetings";

// Shared rail components used by contractor workspace + detail.

// ── Calendar mini + "Next up" ──
// Navigable month grid; dots on days that have meetings. Clicking a
// day in "Next up" jumps to its detail page. Static "today" is driven
// by the browser clock, so the rail tracks real time without server
// pushes.

export function CalendarRail({
  meetings,
  portalBase,
}: {
  meetings: MeetingListRow[];
  portalBase: string;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstDay = cursor.getDay();
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();
  const daysPrevMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    0,
  ).getDate();

  const meetingDays = new Set<number>();
  for (const m of meetings) {
    const d = new Date(m.scheduledAt);
    if (
      d.getFullYear() === cursor.getFullYear() &&
      d.getMonth() === cursor.getMonth()
    ) {
      meetingDays.add(d.getDate());
    }
  }

  const isTodayDate = (n: number) =>
    n === now.getDate() &&
    cursor.getFullYear() === now.getFullYear() &&
    cursor.getMonth() === now.getMonth();

  const upcoming = meetings
    .filter((m) => m.status === "scheduled" || m.status === "in_progress")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 3);

  const prevMonth = () =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const nextMonth = () =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <div className="mt-rail-card">
      <div className="mt-rail-hdr">
        <h4>
          {Icon.calendar} {monthLabel}
        </h4>
        <div className="mt-cal-nav">
          <button type="button" onClick={prevMonth} aria-label="Previous month">
            {Icon.chevL}
          </button>
          <button type="button" onClick={nextMonth} aria-label="Next month">
            {Icon.chevR}
          </button>
        </div>
      </div>
      <div className="mt-cal">
        <div className="mt-cal-grid">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`dow-${i}`} className="mt-cal-dow">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <div
              key={`p-${i}`}
              className="mt-cal-day dim"
            >
              {daysPrevMonth - firstDay + i + 1}
            </div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const hasMeeting = meetingDays.has(d);
            const today = isTodayDate(d);
            return (
              <div
                key={`d-${d}`}
                className={`mt-cal-day${today ? " today" : ""}${hasMeeting ? " has-meeting" : ""}`}
              >
                {d}
              </div>
            );
          })}
          {Array.from(
            { length: (7 - ((firstDay + daysInMonth) % 7)) % 7 },
            (_, i) => i + 1,
          ).map((d) => (
            <div key={`n-${d}`} className="mt-cal-day dim">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-cal-upcoming">
          <div className="mt-cal-upcoming-hdr">Next up</div>
          {upcoming.length === 0 ? (
            <div
              style={{
                padding: "12px 0",
                fontSize: 11.5,
                color: "var(--text-tertiary)",
                fontWeight: 540,
              }}
            >
              No upcoming meetings.
            </div>
          ) : (
            upcoming.map((m) => {
              const s = formatScheduledAt(m.scheduledAt);
              return (
                <Link
                  key={m.id}
                  className="mt-cal-upcoming-item"
                  href={`${portalBase}/meetings/${m.id}`}
                >
                  <div className="mt-cal-upcoming-date">
                    {s.dayLabel}
                    <strong>{s.dayNumber}</strong>
                  </div>
                  <div className="mt-cal-upcoming-body">
                    <div className="mt-cal-upcoming-title">{m.title}</div>
                    <div className="mt-cal-upcoming-meta">
                      {Icon.clock} {s.timeLabel} · {m.durationMinutes}m ·{" "}
                      {m.attendeeCount} inv.
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recent activity rail ──
// Driven by the activity_feed_items table, queried per project + filtered
// to meeting-related rows by the loader. System-authored rows (carry-
// forward messages) get a distinct avatar treatment.

export function ActivityRail({
  rows,
  portalBase,
  title = "Recent activity",
  limit,
}: {
  rows: MeetingActivityRow[];
  portalBase: string;
  title?: string;
  limit?: number;
}) {
  const shown = typeof limit === "number" ? rows.slice(0, limit) : rows;
  return (
    <div className="mt-rail-card">
      <div className="mt-rail-hdr">
        <h4>
          {Icon.clock} {title}
        </h4>
      </div>
      {shown.length === 0 ? (
        <div
          style={{
            padding: "20px 14px",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontWeight: 540,
          }}
        >
          No activity yet.
        </div>
      ) : (
        shown.map((r, idx) => {
          const isSystem = !r.actorName;
          const avatarCls = isSystem ? "mt-rail-item-avatar sys" : "mt-rail-item-avatar";
          const avatarContent = isSystem
            ? Icon.arrowR
            : initials(r.actorName ?? "?");
          const link = r.relatedMeetingId
            ? `${portalBase}/meetings/${r.relatedMeetingId}`
            : null;
          const body = (
            <>
              <div className={avatarCls}>{avatarContent}</div>
              <div className="mt-rail-item-body">
                <div className="mt-rail-item-text">
                  <strong>{r.actorName ?? "System"}</strong> {r.title}
                </div>
                {r.body ? (
                  <div className="mt-rail-item-target">{r.body}</div>
                ) : null}
                <div className="mt-rail-item-when">
                  {relativeTime(r.createdAt)}
                </div>
              </div>
            </>
          );
          return link ? (
            <Link
              key={idx}
              href={link}
              className="mt-rail-item"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {body}
            </Link>
          ) : (
            <div key={idx} className="mt-rail-item">
              {body}
            </div>
          );
        })
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

