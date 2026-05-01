"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fmt12, minsToHM, minsToHMSlim } from "@/lib/time-tracking/format";
import type { TimeEntryRow, WorkerWeekView } from "@/domain/loaders/time-entries";

// Mobile PWA — Time tracking weekly timesheet.
// Mirrors the prototype's "MOBILE · TIMESHEET" section
// (docs/prototypes/builtcrm_time_tracking_module.jsx ~lines 1222–1289).
// Per-day cards stacked vertically. Sticky submit-week CTA at the top
// when there are drafts in the current week.

interface Props {
  view: WorkerWeekView;
}

export function MobileTimesheet({ view }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "wr" | "er"; text: string } | null>(
    null,
  );

  const myEntries = useMemo(
    () => view.entries.filter((e) => e.userId === view.user.id),
    [view.entries, view.user.id],
  );
  const todayIso = isoDate(new Date(view.serverNow));
  const dayTotals = sumByDay(myEntries, view.serverNow);
  const weekMins = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const draftCount = myEntries.filter((e) => e.status === "draft").length;
  const isCurrent = view.weekOffset === 0;

  const showToast = (kind: "ok" | "wr" | "er", text: string, ms = 2200) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), ms);
  };

  const submitWeek = async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/time-entries/submit-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOffset: view.weekOffset }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        showToast("er", j.message ?? "Failed to submit");
        return;
      }
      const j = (await r.json()) as { submitted?: number };
      showToast(
        "ok",
        `Submitted ${j.submitted ?? 0} entr${j.submitted === 1 ? "y" : "ies"}`,
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ttm-page">
      <header className="ttm-hdr">
        <div className="ttm-hdr-top">
          <Link href="/m/time" className="ttm-hdr-back">
            ← Back
          </Link>
          <span>
            {view.weekDays[0].display}–{view.weekDays[6].display}
          </span>
        </div>
        <h1 className="ttm-hdr-greet">My week</h1>
        <div className="ttm-hdr-sub">
          {minsToHM(weekMins)} logged · {draftCount} draft
          {draftCount === 1 ? "" : "s"} to submit
        </div>
      </header>

      <div className="ttm-body">
        {/* Week navigator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <button
            type="button"
            className="ttm-btn"
            onClick={() => router.push(`/m/time/timesheet?week=${view.weekOffset - 1}`)}
            disabled={view.weekOffset <= -12}
            style={{ flex: "0 0 auto", height: 38, fontSize: 13 }}
          >
            ← Prev
          </button>
          <div
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            {isCurrent
              ? "This week"
              : `${-view.weekOffset} week${-view.weekOffset === 1 ? "" : "s"} ago`}
          </div>
          <button
            type="button"
            className="ttm-btn"
            onClick={() => router.push(`/m/time/timesheet?week=${view.weekOffset + 1}`)}
            disabled={view.weekOffset >= 0}
            style={{ flex: "0 0 auto", height: 38, fontSize: 13 }}
          >
            Next →
          </button>
        </div>

        {/* Submit week CTA */}
        {draftCount > 0 && isCurrent && (
          <button
            type="button"
            className="ttm-submit-cta"
            onClick={submitWeek}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : `📤 Submit ${draftCount} draft entries`}
          </button>
        )}

        {/* Per-day cards */}
        {view.weekDays.map((d) => {
          const entries = myEntries.filter((e) => e.isoDate === d.iso);
          const total = dayTotals[d.iso] ?? 0;
          const isToday = d.iso === todayIso && isCurrent;
          return (
            <div key={d.iso} className={`ttm-day${isToday ? " today" : ""}`}>
              <div className="ttm-day-hdr">
                <div className="ttm-day-hdr-l">
                  <span className="ttm-day-name">{d.label}</span>
                  <span className="ttm-day-num">
                    {d.display.split(" ")[1]}
                  </span>
                </div>
                <span className="ttm-day-total">
                  {total > 0 ? minsToHM(total) : "—"}
                </span>
              </div>
              {entries.length === 0 ? (
                <div className="ttm-day-empty">No entries</div>
              ) : (
                <div className="ttm-day-entries">
                  {entries.map((e) => (
                    <div key={e.id} className="ttm-day-entry">
                      <span className="ttm-day-entry-time">
                        {fmt12(new Date(e.clockInAt))}
                      </span>
                      <span className="ttm-day-entry-task">
                        {e.taskLabel ?? e.projectName}
                      </span>
                      <span className="ttm-day-entry-dur">
                        {e.status === "running"
                          ? "—"
                          : minsToHMSlim(e.minutes ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom nav */}
      <nav className="ttm-nav">
        <Link href="/m/time" className="ttm-nav-item">
          <ClockIcon />
          Today
        </Link>
        <Link href="/m/time/timesheet" className="ttm-nav-item active">
          <CalIcon />
          Week
        </Link>
        <Link href="/m" className="ttm-nav-item">
          <UserIcon />
          Profile
        </Link>
      </nav>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 96,
            left: "50%",
            transform: "translateX(-50%)",
            background:
              toast.kind === "ok"
                ? "#2d8a5e"
                : toast.kind === "wr"
                  ? "#c4700b"
                  : "#c93b3b",
            color: "#fff",
            padding: "11px 18px",
            borderRadius: 9,
            fontFamily: "DM Sans, system-ui",
            fontWeight: 620,
            fontSize: 13,
            zIndex: 50,
            boxShadow: "0 14px 38px rgba(20,18,14,.22)",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sumByDay(
  entries: TimeEntryRow[],
  serverNowIso: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  const now = new Date(serverNowIso);
  for (const e of entries) {
    const minutes =
      e.status === "running"
        ? Math.max(
            0,
            Math.round(
              (now.getTime() - new Date(e.clockInAt).getTime()) / 60000,
            ),
          )
        : (e.minutes ?? 0);
    out[e.isoDate] = (out[e.isoDate] ?? 0) + minutes;
  }
  return out;
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
