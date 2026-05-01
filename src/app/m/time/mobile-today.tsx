"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  fmt12,
  minsToHM,
} from "@/lib/time-tracking/format";
import type {
  TimeEntryRow,
  WorkerWeekView,
} from "@/domain/loaders/time-entries";

// Mobile PWA — Time tracking Today screen.
// Mirrors the prototype's "MOBILE · TODAY" section
// (docs/prototypes/builtcrm_time_tracking_module.jsx ~lines 1107–1220 +
// the bottom-nav/FAB at ~lines 1291–1322).
//
// Reads the same WorkerWeekView the desktop /subcontractor/time page
// uses; mutations route through the same /api/time-entries endpoints.

interface Props {
  view: WorkerWeekView;
}

export function MobileTimeToday({ view }: Props) {
  const router = useRouter();
  const [showClockInSheet, setShowClockInSheet] = useState(false);
  const [showClockOutSheet, setShowClockOutSheet] = useState(false);
  const [pending, setPending] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [toast, setToast] = useState<{
    kind: "ok" | "wr" | "er";
    text: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const onOn = () => setIsOnline(true);
    const onOff = () => setIsOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  const myEntries = useMemo(
    () => view.entries.filter((e) => e.userId === view.user.id),
    [view.entries, view.user.id],
  );
  const myRunning = myEntries.find((e) => e.status === "running") ?? null;
  const todayIso = isoDate(new Date(view.serverNow));
  const myToday = myEntries.filter((e) => e.isoDate === todayIso);
  const dayTotals = sumByDay(myEntries, view.serverNow);
  const todayMins = dayTotals[todayIso] ?? 0;
  const weekMins = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const myDraftCount = myEntries.filter((e) => e.status === "draft").length;
  const firstName = view.user.name.split(" ")[0];

  const showToast = (kind: "ok" | "wr" | "er", text: string, ms = 2200) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), ms);
  };

  return (
    <div className="ttm-page">
      {/* Header */}
      <header className="ttm-hdr">
        <div className="ttm-hdr-top">
          <span>Time tracking</span>
          <span className={`ttm-net${isOnline ? "" : " offline"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <h1 className="ttm-hdr-greet">Hi {firstName}</h1>
        <div className="ttm-hdr-sub">
          {view.org.name} ·{" "}
          {new Date(view.serverNow).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}{" "}
          · {myRunning ? "On the clock" : "Not clocked in"}
        </div>
      </header>

      <div className="ttm-body">
        {/* Big clock card */}
        <div className={`ttm-clock${myRunning ? " running" : ""}`}>
          <div className="ttm-clock-state">
            {myRunning && <span className="ttm-clock-led" />}
            {myRunning ? "Currently clocked in" : "Ready to start"}
          </div>
          {myRunning ? (
            <RunningTimer
              startMs={new Date(myRunning.clockInAt).getTime()}
              serverNowMs={new Date(view.serverNow).getTime()}
            />
          ) : (
            <div className="ttm-clock-idle">{minsToHM(todayMins)}</div>
          )}
          <div className="ttm-clock-meta">
            {myRunning ? (
              <>
                <strong>{myRunning.taskLabel ?? "No task"}</strong>
                <span>
                  {myRunning.projectName} · since{" "}
                  {fmt12(new Date(myRunning.clockInAt))}
                </span>
                {myRunning.hasGps && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    📍 GPS captured
                  </span>
                )}
              </>
            ) : (
              <span>logged today · tap to start a new entry</span>
            )}
          </div>
          <button
            type="button"
            className={`ttm-clock-btn ${myRunning ? "stop" : "start"}`}
            onClick={() =>
              myRunning ? setShowClockOutSheet(true) : setShowClockInSheet(true)
            }
            aria-label={myRunning ? "Clock out" : "Clock in"}
          >
            {myRunning ? <StopIcon /> : <PlayIcon />}
          </button>
          <span className="ttm-clock-btn-label">
            {myRunning ? "Tap to stop" : "Tap to start"}
          </span>
        </div>

        {/* Stats row */}
        <div className="ttm-stats">
          <div className="ttm-stat">
            <div className="ttm-stat-key">This week</div>
            <div className="ttm-stat-val">{minsToHM(weekMins)}</div>
            <div className="ttm-stat-foot">of 40h target</div>
          </div>
          <div className="ttm-stat">
            <div className="ttm-stat-key">Drafts</div>
            <div className="ttm-stat-val">{myDraftCount}</div>
            <div className="ttm-stat-foot">
              {myDraftCount > 0 ? "Submit by Sun" : "All clear"}
            </div>
          </div>
        </div>

        {/* Today's entries */}
        <div className="ttm-section-label">Today&apos;s entries</div>
        {myToday.length === 0 ? (
          <div className="ttm-empty">
            No entries yet today. Tap the clock button to start.
          </div>
        ) : (
          myToday.map((e) => (
            <div key={e.id} className={`ttm-entry ${e.status}`}>
              <div className="ttm-entry-time">
                {fmt12(new Date(e.clockInAt))}
                <br />
                <span style={{ opacity: 0.65 }}>
                  {e.clockOutAt ? fmt12(new Date(e.clockOutAt)) : "now"}
                </span>
              </div>
              <div className="ttm-entry-body">
                <div className="ttm-entry-task">{e.taskLabel ?? "No task"}</div>
                <div className="ttm-entry-proj">{e.projectName}</div>
              </div>
              <div className="ttm-entry-dur">
                {e.status === "running" ? (
                  <RunningTimer
                    startMs={new Date(e.clockInAt).getTime()}
                    serverNowMs={new Date(view.serverNow).getTime()}
                    compact
                  />
                ) : (
                  minsToHM(e.minutes)
                )}
              </div>
            </div>
          ))
        )}

        {/* GPS toggle */}
        <div className="ttm-section-label">Settings</div>
        <div
          className={`ttm-gps${gpsEnabled ? " on" : ""}`}
          onClick={() => setGpsEnabled((g) => !g)}
          role="button"
          tabIndex={0}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") setGpsEnabled((g) => !g);
          }}
        >
          <span className="ttm-gps-text">📍 Capture GPS at clock-in</span>
          <span className={`ttm-switch${gpsEnabled ? " on" : ""}`} />
        </div>
      </div>

      {/* FAB — only when not clocked in */}
      {!myRunning && (
        <button
          type="button"
          className="ttm-fab"
          aria-label="Quick clock-in"
          onClick={() => setShowClockInSheet(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Bottom nav */}
      <nav className="ttm-nav">
        <Link href="/m/time" className="ttm-nav-item active">
          <ClockIcon />
          Today
        </Link>
        <Link href="/m/time/timesheet" className="ttm-nav-item">
          <CalIcon />
          Week
        </Link>
        <Link href="/m" className="ttm-nav-item">
          <UserIcon />
          Profile
        </Link>
      </nav>

      {/* Clock-in bottom sheet */}
      {showClockInSheet && (
        <ClockInSheet
          projects={view.myProjects}
          gpsEnabled={gpsEnabled}
          isOnline={isOnline}
          pending={pending}
          onCancel={() => setShowClockInSheet(false)}
          onConfirm={async (input) => {
            setPending(true);
            try {
              const r = await fetch("/api/time-entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mode: "clock-in",
                  projectId: input.projectId,
                  taskLabel: input.taskLabel,
                  notes: input.notes,
                  locationLat: null,
                  locationLng: null,
                }),
              });
              if (!r.ok) {
                const j = (await r.json().catch(() => ({}))) as {
                  message?: string;
                };
                showToast("er", j.message ?? "Failed to clock in");
                return;
              }
              setShowClockInSheet(false);
              showToast("ok", "Clocked in");
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        />
      )}

      {/* Clock-out bottom sheet */}
      {showClockOutSheet && myRunning && (
        <ClockOutSheet
          running={myRunning}
          serverNowMs={new Date(view.serverNow).getTime()}
          pending={pending}
          onCancel={() => setShowClockOutSheet(false)}
          onConfirm={async (notes) => {
            setPending(true);
            try {
              const r = await fetch("/api/time-entries/clock-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
              });
              if (!r.ok) {
                const j = (await r.json().catch(() => ({}))) as {
                  message?: string;
                };
                showToast("er", j.message ?? "Failed to clock out");
                return;
              }
              setShowClockOutSheet(false);
              showToast("ok", "Clocked out · entry saved as draft");
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        />
      )}

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

// ─────────────────────────────────────────────────────────────────────
// Clock-in sheet — mobile bottom sheet with project + task picker.
// ─────────────────────────────────────────────────────────────────────
function ClockInSheet(props: {
  projects: WorkerWeekView["myProjects"];
  gpsEnabled: boolean;
  isOnline: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    projectId: string;
    taskLabel: string | null;
    notes: string | null;
  }) => void;
}) {
  const [projectId, setProjectId] = useState(props.projects[0]?.id ?? "");
  const [taskLabel, setTaskLabel] = useState("");
  const [notes, setNotes] = useState("");

  if (props.projects.length === 0) {
    return (
      <div className="ttm-sheet-bg" onClick={props.onCancel}>
        <div className="ttm-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="ttm-sheet-handle" />
          <h3 className="ttm-sheet-title">No projects yet</h3>
          <p className="ttm-sheet-sub">
            You need to be assigned to at least one project before you can clock in.
          </p>
          <div className="ttm-sheet-foot">
            <button type="button" className="ttm-btn" onClick={props.onCancel}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ttm-sheet-bg" onClick={props.onCancel}>
      <div className="ttm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ttm-sheet-handle" />
        <h3 className="ttm-sheet-title">Clock in</h3>
        <p className="ttm-sheet-sub">
          Pick the project and task you&apos;re starting on.
        </p>
        <div>
          <label className="ttm-input-label">Project</label>
          <select
            className="ttm-select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {props.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.contractorName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ttm-input-label">
            Task{" "}
            <span
              style={{
                color: "var(--text-tertiary)",
                textTransform: "none",
                fontWeight: 540,
                letterSpacing: 0,
              }}
            >
              (optional)
            </span>
          </label>
          <input
            type="text"
            className="ttm-input"
            placeholder="e.g., Floor 4 deck install"
            value={taskLabel}
            onChange={(e) => setTaskLabel(e.target.value)}
            maxLength={160}
          />
        </div>
        <div>
          <label className="ttm-input-label">
            Notes{" "}
            <span
              style={{
                color: "var(--text-tertiary)",
                textTransform: "none",
                fontWeight: 540,
                letterSpacing: 0,
              }}
            >
              (optional)
            </span>
          </label>
          <textarea
            className="ttm-textarea"
            placeholder="What you're working on, area, conditions…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {!props.isOnline && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 9,
              background: "rgba(196,112,11,.11)",
              color: "#c4700b",
              fontSize: 12.5,
            }}
          >
            Offline — entry will sync when connection returns.
          </div>
        )}
        <div className="ttm-sheet-foot">
          <button type="button" className="ttm-btn" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="ttm-btn primary"
            disabled={props.pending || !projectId}
            onClick={() =>
              props.onConfirm({
                projectId,
                taskLabel: taskLabel.trim() || null,
                notes: notes.trim() || null,
              })
            }
          >
            {props.pending ? "Starting…" : "Clock in now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockOutSheet(props: {
  running: TimeEntryRow;
  serverNowMs: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (notes: string | null) => void;
}) {
  const [notes, setNotes] = useState("");
  const elapsedMin = Math.max(
    0,
    Math.round(
      (props.serverNowMs - new Date(props.running.clockInAt).getTime()) / 60000,
    ),
  );

  return (
    <div className="ttm-sheet-bg" onClick={props.onCancel}>
      <div className="ttm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ttm-sheet-handle" />
        <h3 className="ttm-sheet-title">Clock out</h3>
        <p className="ttm-sheet-sub">
          You&apos;ll save this entry as a draft. Edit it until you submit your
          weekly timesheet.
        </p>
        <div
          style={{
            padding: "12px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 11,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 680,
              marginBottom: 6,
            }}
          >
            This shift
          </div>
          <div
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 800,
              fontSize: 26,
              color: "var(--text-primary)",
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            {minsToHM(elapsedMin)}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-secondary)",
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 580,
            }}
          >
            {props.running.projectName} · {props.running.taskLabel ?? "No task"}
          </div>
        </div>
        <div>
          <label className="ttm-input-label">
            Notes{" "}
            <span
              style={{
                color: "var(--text-tertiary)",
                textTransform: "none",
                fontWeight: 540,
                letterSpacing: 0,
              }}
            >
              (optional)
            </span>
          </label>
          <textarea
            className="ttm-textarea"
            placeholder="Anything to flag for your admin?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="ttm-sheet-foot">
          <button type="button" className="ttm-btn" onClick={props.onCancel}>
            Keep running
          </button>
          <button
            type="button"
            className="ttm-btn danger"
            disabled={props.pending}
            onClick={() => props.onConfirm(notes.trim() || null)}
          >
            {props.pending ? "Saving…" : `Clock out · ${minsToHM(elapsedMin)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function RunningTimer({
  startMs,
  serverNowMs,
  compact,
}: {
  startMs: number;
  serverNowMs: number;
  compact?: boolean;
}) {
  const mountRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (mountRef.current === null) mountRef.current = Date.now();
  const totalSec = Math.max(
    0,
    Math.floor((serverNowMs - startMs + (now - mountRef.current)) / 1000),
  );
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (compact) {
    return (
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 660 }}>
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
      </span>
    );
  }
  return (
    <span className="ttm-clock-time">
      {String(h).padStart(2, "0")}
      <span className="ttm-clock-colon">:</span>
      {String(m).padStart(2, "0")}
      <span className="ttm-clock-colon">:</span>
      {String(s).padStart(2, "0")}
    </span>
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

// ─────────────────────────────────────────────────────────────────────
// Inline icons
// ─────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
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
