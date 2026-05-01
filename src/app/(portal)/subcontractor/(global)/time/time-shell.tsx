"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  ProjectChip,
  StatusPill,
  TtIcons,
} from "@/components/time-tracking/icons";
import {
  fmt12,
  minsToDecimal,
  minsToHM,
  minsToHMSlim,
} from "@/lib/time-tracking/format";
import type {
  TimeEntryRow,
  TimeEntryStatus,
  WorkerWeekView,
} from "@/domain/loaders/time-entries";

// Worker view — Today + My Timesheet for the subcontractor portal.
// Mirrors the prototype's worker section. Reads loader props; mutations
// go through /api/time-entries/* and refresh via router.refresh().

interface Props {
  view: WorkerWeekView;
}

export function WorkerTimeTrackingShell({ view }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"today" | "timesheet">("today");
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "wr" | "er"; text: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | TimeEntryStatus>(
    "all",
  );

  const myEntries = useMemo(
    () => view.entries.filter((e) => e.userId === view.user.id),
    [view.entries, view.user.id],
  );
  const myRunning = myEntries.find((e) => e.status === "running") ?? null;
  const myToday = todayEntries(myEntries, view);
  const myDraftCount = myEntries.filter((e) => e.status === "draft").length;
  const dayTotals = sumByDayLive(myEntries, view.serverNow);
  const weekTotalMins = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const todayIso = isoDate(new Date(view.serverNow));

  const showToast = (kind: "ok" | "wr" | "er", text: string, ms = 2400) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), ms);
  };

  async function postJson(url: string, body: unknown) {
    setPending(true);
    try {
      const res = await fetch(url, {
        method: url.includes("[id]") ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        showToast("er", data.message ?? data.error ?? "Request failed");
        return null;
      }
      return data;
    } finally {
      setPending(false);
    }
  }

  async function handleClockIn(input: {
    projectId: string;
    taskLabel: string | null;
    taskCode: string | null;
    notes: string | null;
    captureGps: boolean;
  }) {
    let lat: number | null = null;
    let lng: number | null = null;
    // We surface the toggle but don't actually call the geolocation API
    // here — see production_grade_upgrades/time_tracking_geolocation.md.
    if (input.captureGps) {
      lat = null;
      lng = null;
    }
    const r = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "clock-in",
        projectId: input.projectId,
        taskLabel: input.taskLabel,
        taskCode: input.taskCode,
        notes: input.notes,
        locationLat: lat,
        locationLng: lng,
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      showToast("er", j.message ?? "Failed to clock in");
      return;
    }
    setShowClockInModal(false);
    showToast("ok", "Clocked in");
    router.refresh();
  }

  async function handleClockOut(notes: string | null) {
    const r = await fetch("/api/time-entries/clock-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      showToast("er", j.message ?? "Failed to clock out");
      return;
    }
    setShowStopModal(false);
    showToast("ok", "Clocked out · entry saved as draft");
    router.refresh();
  }

  async function handleSubmitWeek() {
    const r = await postJson("/api/time-entries/submit-week", {
      weekOffset: view.weekOffset,
    });
    if (r) {
      setShowSubmitModal(false);
      const submitted = (r as { submitted?: number }).submitted ?? 0;
      showToast("ok", `Submitted ${submitted} entr${submitted === 1 ? "y" : "ies"}`);
      router.refresh();
    }
  }

  async function handleManualEntry(input: {
    projectId: string;
    taskLabel: string | null;
    clockInAt: string;
    clockOutAt: string;
    reason: string;
    notes: string | null;
  }) {
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "manual",
        projectId: input.projectId,
        taskLabel: input.taskLabel,
        clockInAt: input.clockInAt,
        clockOutAt: input.clockOutAt,
        reason: input.reason,
        notes: input.notes,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      showToast("er", j.message ?? "Failed to save entry");
      return;
    }
    setShowManualModal(false);
    showToast("ok", "Manual entry saved as draft");
    router.refresh();
  }

  return (
    <div className="tt-root" style={{ padding: "8px 24px 60px", minHeight: "100vh" }}>
      <div
        className="tt-filter-pills"
        style={{ marginBottom: 18, width: "fit-content" }}
      >
        <button
          className={`tt-filter-pill${tab === "today" ? " active" : ""}`}
          onClick={() => setTab("today")}
        >
          {TtIcons.clock} Today
        </button>
        <button
          className={`tt-filter-pill${tab === "timesheet" ? " active" : ""}`}
          onClick={() => setTab("timesheet")}
        >
          {TtIcons.calendar} My timesheet
          <span className="tt-filter-pill-count">{myDraftCount}</span>
        </button>
        {view.isAdmin && (
          <Link
            href="/subcontractor/time/admin"
            className="tt-filter-pill"
            style={{ textDecoration: "none" }}
          >
            {TtIcons.users} Team admin
          </Link>
        )}
      </div>

      {tab === "today" && (
        <TodayPane
          view={view}
          myRunning={myRunning}
          myToday={myToday}
          weekTotalMins={weekTotalMins}
          dayTotals={dayTotals}
          todayIso={todayIso}
          gpsEnabled={gpsEnabled}
          onToggleGps={() => setGpsEnabled((g) => !g)}
          onOpenClockIn={() => setShowClockInModal(true)}
          onOpenClockOut={() => setShowStopModal(true)}
          onOpenManual={() => setShowManualModal(true)}
          onOpenTimesheet={() => setTab("timesheet")}
        />
      )}

      {tab === "timesheet" && (
        <TimesheetPane
          view={view}
          myEntries={myEntries}
          dayTotals={dayTotals}
          weekTotalMins={weekTotalMins}
          myDraftCount={myDraftCount}
          todayIso={todayIso}
          statusFilter={statusFilter}
          onStatusFilter={(f) => setStatusFilter(f)}
          onSubmit={() => setShowSubmitModal(true)}
          onWeekOffset={(d) => {
            const params = new URLSearchParams();
            params.set("week", String(view.weekOffset + d));
            router.push(`/subcontractor/time?${params.toString()}`);
          }}
        />
      )}

      {showClockInModal && (
        <ClockInModal
          projects={view.myProjects}
          gpsEnabled={gpsEnabled}
          onToggleGps={() => setGpsEnabled((g) => !g)}
          onCancel={() => setShowClockInModal(false)}
          onConfirm={handleClockIn}
          pending={pending}
        />
      )}
      {showStopModal && myRunning && (
        <StopClockModal
          running={myRunning}
          serverNow={view.serverNow}
          onCancel={() => setShowStopModal(false)}
          onConfirm={handleClockOut}
          pending={pending}
        />
      )}
      {showSubmitModal && (
        <SubmitWeekModal
          draftCount={myDraftCount}
          totalMinutes={myEntries
            .filter((e) => e.status === "draft")
            .reduce((a, e) => a + (e.minutes ?? 0), 0)}
          weekDays={view.weekDays}
          hasRunning={!!myRunning}
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={handleSubmitWeek}
          pending={pending}
        />
      )}
      {showManualModal && (
        <ManualEntryModal
          projects={view.myProjects}
          onCancel={() => setShowManualModal(false)}
          onConfirm={handleManualEntry}
          pending={pending}
        />
      )}

      {toast && (
        <div className={`tt-toast ${toast.kind}`}>
          {toast.kind === "ok" ? TtIcons.check : TtIcons.alert}
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TODAY pane
// ─────────────────────────────────────────────────────────────────────────

function TodayPane(props: {
  view: WorkerWeekView;
  myRunning: TimeEntryRow | null;
  myToday: TimeEntryRow[];
  weekTotalMins: number;
  dayTotals: Record<string, number>;
  todayIso: string;
  gpsEnabled: boolean;
  onToggleGps: () => void;
  onOpenClockIn: () => void;
  onOpenClockOut: () => void;
  onOpenManual: () => void;
  onOpenTimesheet: () => void;
}) {
  const {
    view,
    myRunning,
    myToday,
    weekTotalMins,
    dayTotals,
    todayIso,
  } = props;
  const todayMins = dayTotals[todayIso] ?? 0;
  const firstName = view.user.name.split(" ")[0];

  return (
    <>
      <div className="tt-page-hdr">
        <div>
          <h1 className="tt-page-title">Hello, {firstName}</h1>
          <div className="tt-page-sub">
            {formatLongDate(new Date(view.serverNow))}{" "}
            · {myRunning ? "Currently clocked in" : "Not clocked in"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tt-btn" onClick={props.onOpenManual}>
            {TtIcons.plus} Manual entry
          </button>
          <button className="tt-btn" onClick={props.onOpenTimesheet}>
            {TtIcons.calendar} My timesheet
          </button>
        </div>
      </div>

      {/* Clock card */}
      <div className={`tt-clock-card${myRunning ? " running" : ""}`}>
        <div className="tt-clock-state">
          <div className="tt-clock-state-label">
            {myRunning && <span className="tt-running-led" />}
            {myRunning ? "Currently clocked in" : "Ready to start"}
          </div>
          {myRunning ? (
            <RunningTimer
              startMs={new Date(myRunning.clockInAt).getTime()}
              serverNowMs={new Date(view.serverNow).getTime()}
            />
          ) : (
            <div className="tt-idle-hours">
              {minsToHM(todayMins)}
              <span
                style={{
                  fontSize: 14,
                  color: "var(--text-tertiary)",
                  fontWeight: 540,
                  marginLeft: 8,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                logged today
              </span>
            </div>
          )}
          <div className="tt-clock-state-meta">
            {myRunning ? (
              <>
                <div className="tt-clock-state-meta-row">
                  {TtIcons.building}
                  <ProjectChip name={myRunning.projectName} />
                </div>
                <div className="tt-clock-state-meta-row">
                  {TtIcons.calendar}
                  <span>
                    <strong>
                      {myRunning.taskLabel ?? "No task"}
                    </strong>{" "}
                    · started {fmt12(new Date(myRunning.clockInAt))}
                  </span>
                </div>
                {myRunning.hasGps && (
                  <div className="tt-clock-state-meta-row">
                    {TtIcons.pin}
                    <span>GPS captured at clock-in</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="tt-clock-state-meta-row">
                  {TtIcons.calendar}
                  <span>
                    This week: <strong>{minsToHM(weekTotalMins)}</strong> across{" "}
                    {view.entries.length} entr
                    {view.entries.length === 1 ? "y" : "ies"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="tt-clock-action">
          <button
            className={`tt-clock-btn ${myRunning ? "stop" : "start"}`}
            onClick={myRunning ? props.onOpenClockOut : props.onOpenClockIn}
            aria-label={myRunning ? "Clock out" : "Clock in"}
          >
            {myRunning ? TtIcons.stop : TtIcons.play}
          </button>
          <span className="tt-clock-btn-label">
            {myRunning ? "Tap to stop" : "Tap to start"}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="tt-kpi-strip">
        <div className="tt-kpi">
          <div className="tt-kpi-key">Today</div>
          <div className="tt-kpi-val">
            {Math.floor(todayMins / 60)}
            <span className="tt-kpi-unit">
              h {String(todayMins % 60).padStart(2, "0")}m
            </span>
          </div>
          <div className="tt-kpi-foot ok">{TtIcons.calendar} On pace for 8h</div>
          <div
            className="tt-kpi-bar"
            style={{
              width: `${Math.min(100, (todayMins / 480) * 100)}%`,
              background: "var(--ok)",
            }}
          />
        </div>
        <div className="tt-kpi">
          <div className="tt-kpi-key">This week</div>
          <div className="tt-kpi-val">
            {Math.floor(weekTotalMins / 60)}
            <span className="tt-kpi-unit">h {weekTotalMins % 60}m</span>
          </div>
          <div className="tt-kpi-foot">
            of 40h target ({Math.round((weekTotalMins / 2400) * 100)}%)
          </div>
          <div
            className="tt-kpi-bar"
            style={{ width: `${Math.min(100, (weekTotalMins / 2400) * 100)}%` }}
          />
        </div>
        <div className="tt-kpi">
          <div className="tt-kpi-key">Drafts to submit</div>
          <div className="tt-kpi-val">
            {view.entries.filter((e) => e.status === "draft").length}
          </div>
          <div className="tt-kpi-foot wr">
            {view.entries.filter((e) => e.status === "draft").length > 0
              ? "Submit before Sun"
              : "All clear"}
          </div>
        </div>
        <div className="tt-kpi">
          <div className="tt-kpi-key">Submitted</div>
          <div className="tt-kpi-val">
            {view.entries.filter((e) => e.status === "submitted").length}
          </div>
          <div className="tt-kpi-foot">awaiting approval</div>
        </div>
      </div>

      {/* Today's entries */}
      <div className="tt-grid">
        <div className="tt-card">
          <div className="tt-card-hdr">
            <div>
              <div className="tt-card-title">Today&apos;s entries</div>
              <div className="tt-card-sub">
                All clock-ins and clock-outs since midnight.
              </div>
            </div>
            <button className="tt-btn" onClick={props.onOpenManual}>
              {TtIcons.plus} Add entry
            </button>
          </div>
          {myToday.length === 0 ? (
            <div className="tt-empty">
              <div className="tt-empty-icon">{TtIcons.clock}</div>
              <div className="tt-empty-title">No entries yet today</div>
              <div>Clock in to start tracking your time.</div>
            </div>
          ) : (
            <div className="tt-table-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="tt-table">
                <thead>
                  <tr>
                    <th style={{ width: 92 }}>Start</th>
                    <th style={{ width: 92 }}>End</th>
                    <th style={{ width: 96 }}>Duration</th>
                    <th>Project / Task</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {myToday.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span className="tt-table-time">{fmt12(new Date(e.clockInAt))}</span>
                      </td>
                      <td>
                        <span className="tt-table-time">
                          {e.clockOutAt ? fmt12(new Date(e.clockOutAt)) : "—"}
                        </span>
                      </td>
                      <td>
                        {e.status === "running" ? (
                          <RunningTimer
                            startMs={new Date(e.clockInAt).getTime()}
                            serverNowMs={new Date(view.serverNow).getTime()}
                          />
                        ) : (
                          <span className="tt-table-dur">{minsToHM(e.minutes)}</span>
                        )}
                      </td>
                      <td>
                        <ProjectChip name={e.projectName} size="sm" />
                        <div className="tt-table-task" style={{ marginTop: 4 }}>
                          {e.taskLabel ?? "—"}
                        </div>
                      </td>
                      <td>
                        <StatusPill status={e.status} />
                      </td>
                      <td>
                        <div className="tt-table-actions">
                          {e.status === "draft" || e.status === "running" ? (
                            <button className="tt-icon-action" title="Edit">
                              {TtIcons.edit}
                            </button>
                          ) : (
                            <button
                              className="tt-icon-action"
                              title="Locked"
                              style={{ cursor: "not-allowed", opacity: 0.5 }}
                            >
                              {TtIcons.lock}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="tt-detail-rail">
          <div className="tt-rail-card">
            <h4>{TtIcons.pin} GPS</h4>
            <div
              className={`tt-gps-toggle${props.gpsEnabled ? " on" : ""}`}
              onClick={props.onToggleGps}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") props.onToggleGps();
              }}
            >
              {TtIcons.pin}
              <span className="tt-gps-toggle-text">
                Capture location on clock-in
              </span>
              <span className={`tt-switch${props.gpsEnabled ? " on" : ""}`} />
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--text-tertiary)",
                marginTop: 9,
                lineHeight: 1.5,
              }}
            >
              Optional. Asks for browser permission once. Your location is only
              stored at clock-in time, not continuously.
            </div>
          </div>

          <div className="tt-rail-card">
            <h4>{TtIcons.calendar} This week at a glance</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {view.weekDays.slice(0, 5).map((d) => {
                const m = dayTotals[d.iso] ?? 0;
                const isToday = d.iso === todayIso;
                return (
                  <div
                    key={d.iso}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        fontFamily: "'DM Sans',sans-serif",
                        fontWeight: 660,
                        color: isToday
                          ? "var(--accent)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {d.label}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "var(--surface-2)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (m / 600) * 100)}%`,
                          height: "100%",
                          background:
                            m > 0
                              ? isToday
                                ? "var(--accent)"
                                : "var(--ok)"
                              : "transparent",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11,
                        color:
                          m > 0
                            ? "var(--text-primary)"
                            : "var(--text-tertiary)",
                        minWidth: 38,
                        textAlign: "right",
                      }}
                    >
                      {m > 0 ? minsToHMSlim(m) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="tt-rail-card">
            <h4>{TtIcons.alert} Reminders</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  paddingBottom: 8,
                  borderBottom: "1px dashed var(--border)",
                }}
              >
                <strong
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 660,
                  }}
                >
                  Submit weekly timesheet
                </strong>{" "}
                by Sunday 11:59 PM. Late submissions delay payroll.
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                <strong
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 660,
                  }}
                >
                  Don&apos;t forget breaks.
                </strong>{" "}
                Clock out for lunch and back in — overlapping entries are blocked.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TIMESHEET pane
// ─────────────────────────────────────────────────────────────────────────

function TimesheetPane(props: {
  view: WorkerWeekView;
  myEntries: TimeEntryRow[];
  dayTotals: Record<string, number>;
  weekTotalMins: number;
  myDraftCount: number;
  todayIso: string;
  statusFilter: "all" | TimeEntryStatus;
  onStatusFilter: (s: "all" | TimeEntryStatus) => void;
  onSubmit: () => void;
  onWeekOffset: (delta: number) => void;
}) {
  const {
    view,
    myEntries,
    dayTotals,
    weekTotalMins,
    myDraftCount,
    todayIso,
    statusFilter,
  } = props;
  const isCurrentWeek = view.weekOffset === 0;

  const filteredEntries = useMemo(
    () =>
      [...myEntries]
        .filter((e) => statusFilter === "all" || e.status === statusFilter)
        .sort((a, b) => {
          if (a.isoDate !== b.isoDate)
            return a.isoDate < b.isoDate ? 1 : -1;
          return new Date(a.clockInAt).getTime() - new Date(b.clockInAt).getTime();
        }),
    [myEntries, statusFilter],
  );

  return (
    <>
      <div className="tt-page-hdr">
        <div>
          <h1 className="tt-page-title">My timesheet</h1>
          <div className="tt-page-sub">
            Review your week, edit drafts, and submit for approval.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="tt-btn primary"
            onClick={props.onSubmit}
            disabled={myDraftCount === 0 || !isCurrentWeek}
          >
            {TtIcons.send} Submit week ({myDraftCount})
          </button>
        </div>
      </div>

      <div className="tt-week">
        <div className="tt-week-hdr">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="tt-week-nav">
              <button
                className="tt-week-nav-btn"
                onClick={() => props.onWeekOffset(-1)}
                disabled={view.weekOffset <= -12}
                aria-label="Previous week"
              >
                {TtIcons.chevL}
              </button>
              <button
                className="tt-week-nav-btn"
                onClick={() => props.onWeekOffset(1)}
                disabled={view.weekOffset >= 0}
                aria-label="Next week"
              >
                {TtIcons.chevR}
              </button>
            </div>
            <div>
              <div className="tt-week-title">
                {isCurrentWeek ? "This week" : `${view.weekOffset === -1 ? "Last week" : `${-view.weekOffset} weeks ago`}`}{" "}
                · {view.weekDays[0].display}–{view.weekDays[6].display}
              </div>
              <div className="tt-week-sub">
                {myEntries.length} entries · {myDraftCount} draft
                {myDraftCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <div className="tt-week-totals">
            <div>
              <div className="tt-week-total-key">Week total</div>
              <div className="tt-week-total-val">{minsToHM(weekTotalMins)}</div>
            </div>
            <div>
              <div className="tt-week-total-key">Decimal</div>
              <div className="tt-week-total-val">
                {minsToDecimal(weekTotalMins)}h
              </div>
            </div>
          </div>
        </div>
        <div className="tt-week-grid">
          {view.weekDays.map((d) => {
            const entries = myEntries.filter((e) => e.isoDate === d.iso);
            const total = dayTotals[d.iso] ?? 0;
            const isToday = d.iso === todayIso && isCurrentWeek;
            return (
              <div
                key={d.iso}
                className={`tt-week-day${isToday ? " today" : ""}${d.isWeekend ? " weekend" : ""}`}
              >
                <div className="tt-week-day-hdr">
                  <span className="tt-week-day-name">{d.label}</span>
                  <span className="tt-week-day-num">
                    {d.display.split(" ")[1]}
                  </span>
                  <span
                    className={`tt-week-day-total${total === 0 ? " zero" : ""}`}
                  >
                    {total > 0 ? minsToHMSlim(total) : "—"}
                  </span>
                </div>
                <div className="tt-week-entries">
                  {entries.length === 0 ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontStyle: "italic",
                        padding: "10px 4px",
                      }}
                    >
                      No entries
                    </div>
                  ) : (
                    entries.map((e) => (
                      <div
                        key={e.id}
                        className={`tt-week-entry ${e.status}`}
                        title={`${e.projectName} — ${e.taskLabel ?? "—"}`}
                      >
                        <div className="tt-week-entry-row1">
                          <span>
                            {fmt12(new Date(e.clockInAt))}
                            {e.clockOutAt
                              ? `–${fmt12(new Date(e.clockOutAt)).replace(" AM", "a").replace(" PM", "p")}`
                              : "–now"}
                          </span>
                          <span className="tt-week-entry-dur">
                            {e.status === "running"
                              ? minsToHMSlim(e.liveMinutes ?? 0)
                              : minsToHMSlim(e.minutes ?? 0)}
                          </span>
                        </div>
                        <div className="tt-week-entry-task">
                          {e.taskLabel ?? "—"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All entries table */}
      <div className="tt-card">
        <div className="tt-card-hdr">
          <div>
            <div className="tt-card-title">All entries this week</div>
            <div className="tt-card-sub">
              Click a draft to edit. Submitted entries are read-only.
            </div>
          </div>
          <div className="tt-filter-pills">
            {(
              [
                { k: "all", label: "All" },
                { k: "draft", label: "Drafts" },
                { k: "submitted", label: "Submitted" },
                { k: "approved", label: "Approved" },
              ] as const
            ).map((p) => (
              <button
                key={p.k}
                className={`tt-filter-pill${statusFilter === p.k ? " active" : ""}`}
                onClick={() =>
                  props.onStatusFilter(p.k as "all" | TimeEntryStatus)
                }
              >
                {p.label}
                <span className="tt-filter-pill-count">
                  {p.k === "all"
                    ? myEntries.length
                    : myEntries.filter((e) => e.status === p.k).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="tt-table-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table className="tt-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Date</th>
                <th style={{ width: 86 }}>Start</th>
                <th style={{ width: 86 }}>End</th>
                <th style={{ width: 96 }}>Duration</th>
                <th>Project / Task</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e) => {
                const editable = e.status === "draft" || e.status === "running";
                return (
                  <tr key={e.id} className={editable ? "clickable" : ""}>
                    <td>
                      <span
                        style={{
                          fontFamily: "'DM Sans',sans-serif",
                          fontWeight: 620,
                          fontSize: 12,
                        }}
                      >
                        {dayLabel(view.weekDays, e.isoDate)}
                      </span>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--text-tertiary)",
                          fontFamily: "'JetBrains Mono',monospace",
                        }}
                      >
                        {e.isoDate.slice(5)}
                      </div>
                    </td>
                    <td>
                      <span className="tt-table-time">
                        {fmt12(new Date(e.clockInAt))}
                      </span>
                    </td>
                    <td>
                      <span className="tt-table-time">
                        {e.clockOutAt ? fmt12(new Date(e.clockOutAt)) : "—"}
                      </span>
                    </td>
                    <td>
                      {e.status === "running" ? (
                        <RunningTimer
                          startMs={new Date(e.clockInAt).getTime()}
                          serverNowMs={new Date(view.serverNow).getTime()}
                        />
                      ) : (
                        <span className="tt-table-dur">{minsToHM(e.minutes)}</span>
                      )}
                    </td>
                    <td>
                      <ProjectChip name={e.projectName} size="sm" />
                      <div className="tt-table-task" style={{ marginTop: 4 }}>
                        {e.taskLabel ?? "—"}
                      </div>
                      {e.notes && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-tertiary)",
                            marginTop: 3,
                            fontStyle: "italic",
                          }}
                        >
                          {e.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusPill status={e.status} />
                    </td>
                    <td>
                      <div className="tt-table-actions">
                        {editable ? (
                          <button className="tt-icon-action" title="Edit">
                            {TtIcons.edit}
                          </button>
                        ) : (
                          <button
                            className="tt-icon-action"
                            title="Locked — submitted"
                            style={{ cursor: "not-allowed", opacity: 0.5 }}
                          >
                            {TtIcons.lock}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────────────────

function ClockInModal(props: {
  projects: WorkerWeekView["myProjects"];
  gpsEnabled: boolean;
  onToggleGps: () => void;
  onCancel: () => void;
  onConfirm: (input: {
    projectId: string;
    taskLabel: string | null;
    taskCode: string | null;
    notes: string | null;
    captureGps: boolean;
  }) => void;
  pending: boolean;
}) {
  const [projectId, setProjectId] = useState(props.projects[0]?.id ?? "");
  const [taskLabel, setTaskLabel] = useState("");
  const [notes, setNotes] = useState("");

  if (props.projects.length === 0) {
    return (
      <div className="tt-modal-bg" onClick={props.onCancel}>
        <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
          <h3>No projects yet</h3>
          <div className="tt-modal-sub">
            You need to be a member of at least one project to clock in. Ask your
            admin to add you to a project.
          </div>
          <div className="tt-modal-foot">
            <button className="tt-btn ghost" onClick={props.onCancel}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tt-modal-bg" onClick={props.onCancel}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Clock in</h3>
        <div className="tt-modal-sub">
          Pick the project and task you&apos;re starting on. Notes and GPS are
          optional.
        </div>
        <div className="tt-modal-fields">
          <div>
            <label className="tt-input-label">Project</label>
            <select
              className="tt-select"
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
            <label className="tt-input-label">
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
              className="tt-input"
              placeholder="e.g., Floor 4 deck install"
              value={taskLabel}
              onChange={(e) => setTaskLabel(e.target.value)}
              maxLength={160}
            />
          </div>
          <div>
            <label className="tt-input-label">
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
              className="tt-textarea"
              placeholder="What you're working on, area, conditions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div
            className={`tt-gps-toggle${props.gpsEnabled ? " on" : ""}`}
            onClick={props.onToggleGps}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") props.onToggleGps();
            }}
          >
            {TtIcons.pin}
            <span className="tt-gps-toggle-text">Capture GPS at clock-in</span>
            <span className={`tt-switch${props.gpsEnabled ? " on" : ""}`} />
          </div>
        </div>
        <div className="tt-modal-foot">
          <button className="tt-btn ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className="tt-btn primary lg"
            disabled={props.pending || !projectId}
            onClick={() =>
              props.onConfirm({
                projectId,
                taskLabel: taskLabel.trim() || null,
                taskCode: null,
                notes: notes.trim() || null,
                captureGps: props.gpsEnabled,
              })
            }
          >
            {TtIcons.play} Clock in now
          </button>
        </div>
      </div>
    </div>
  );
}

function StopClockModal(props: {
  running: TimeEntryRow;
  serverNow: string;
  onCancel: () => void;
  onConfirm: (notes: string | null) => void;
  pending: boolean;
}) {
  const [notes, setNotes] = useState("");
  const elapsedMinutes = Math.max(
    0,
    Math.round(
      (new Date(props.serverNow).getTime() -
        new Date(props.running.clockInAt).getTime()) /
        60000,
    ),
  );

  return (
    <div className="tt-modal-bg" onClick={props.onCancel}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Clock out</h3>
        <div className="tt-modal-sub">
          You&apos;ll save this entry as a draft. You can keep editing it
          until you submit your weekly timesheet.
        </div>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 680,
              }}
            >
              This shift
            </span>
          </div>
          <div
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: "var(--text-primary)",
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            {minsToHM(elapsedMinutes)}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: "var(--text-secondary)",
            }}
          >
            <ProjectChip name={props.running.projectName} size="sm" />
            <span>·</span>
            <span
              style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620 }}
            >
              {props.running.taskLabel ?? "No task"}
            </span>
          </div>
        </div>
        <div className="tt-modal-fields">
          <div>
            <label className="tt-input-label">
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
              className="tt-textarea"
              placeholder="Anything to flag for your admin? Materials used, blockers…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="tt-modal-foot">
          <button className="tt-btn ghost" onClick={props.onCancel}>
            Keep running
          </button>
          <button
            className="tt-btn danger lg"
            disabled={props.pending}
            onClick={() => props.onConfirm(notes.trim() || null)}
          >
            {TtIcons.stop} Clock out · {minsToHM(elapsedMinutes)}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmitWeekModal(props: {
  draftCount: number;
  totalMinutes: number;
  weekDays: WorkerWeekView["weekDays"];
  hasRunning: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="tt-modal-bg" onClick={props.onCancel}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Submit week for approval</h3>
        <div className="tt-modal-sub">
          Once submitted, you can&apos;t edit these entries. Your sub admin
          can amend with audit trail if anything&apos;s wrong.
        </div>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 14,
          }}
        >
          <Row label="Week" value={`${props.weekDays[0].display}–${props.weekDays[6].display}`} />
          <Row
            label="Entries to submit"
            value={`${props.draftCount} draft${props.draftCount === 1 ? "" : "s"}`}
          />
          <Row label="Total hours" value={minsToHM(props.totalMinutes)} />
        </div>
        {props.hasRunning && (
          <div className="tt-banner wr" style={{ marginBottom: 14 }}>
            {TtIcons.alert}
            <span style={{ fontSize: 12.5 }}>
              You&apos;re still clocked in. Your running entry won&apos;t be
              included in this submission.
            </span>
          </div>
        )}
        <div className="tt-modal-foot">
          <button className="tt-btn ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className="tt-btn primary lg"
            onClick={props.onConfirm}
            disabled={props.pending || props.draftCount === 0}
          >
            {TtIcons.send} Submit {props.draftCount} entries
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualEntryModal(props: {
  projects: WorkerWeekView["myProjects"];
  onCancel: () => void;
  onConfirm: (input: {
    projectId: string;
    taskLabel: string | null;
    clockInAt: string;
    clockOutAt: string;
    reason: string;
    notes: string | null;
  }) => void;
  pending: boolean;
}) {
  const todayStr = isoDate(new Date());
  const [date, setDate] = useState(todayStr);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("16:00");
  const [projectId, setProjectId] = useState(props.projects[0]?.id ?? "");
  const [taskLabel, setTaskLabel] = useState("");
  const [reason, setReason] = useState("");

  if (props.projects.length === 0) {
    return (
      <div className="tt-modal-bg" onClick={props.onCancel}>
        <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
          <h3>No projects yet</h3>
          <div className="tt-modal-foot">
            <button className="tt-btn ghost" onClick={props.onCancel}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tt-modal-bg" onClick={props.onCancel}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add manual entry</h3>
        <div className="tt-modal-sub">
          Backfill a missed punch. Manual entries are flagged for admin review.
        </div>
        <div className="tt-modal-fields">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <label className="tt-input-label">Date</label>
              <input
                className="tt-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="tt-input-label">Start</label>
              <input
                className="tt-input"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="tt-input-label">End</label>
              <input
                className="tt-input"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="tt-input-label">Project</label>
            <select
              className="tt-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {props.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tt-input-label">
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
              className="tt-input"
              type="text"
              value={taskLabel}
              onChange={(e) => setTaskLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="tt-input-label">
              Reason for manual entry{" "}
              <span style={{ color: "var(--er)", textTransform: "none" }}>
                (required)
              </span>
            </label>
            <textarea
              className="tt-textarea"
              placeholder="e.g., 'Phone died, forgot to clock in.'"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="tt-modal-foot">
          <button className="tt-btn ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className="tt-btn primary lg"
            disabled={
              props.pending ||
              !projectId ||
              !reason.trim() ||
              !date ||
              !start ||
              !end
            }
            onClick={() => {
              const clockInAt = new Date(`${date}T${start}:00`).toISOString();
              const clockOutAt = new Date(`${date}T${end}:00`).toISOString();
              props.onConfirm({
                projectId,
                taskLabel: taskLabel.trim() || null,
                clockInAt,
                clockOutAt,
                reason,
                notes: null,
              });
            }}
          >
            {TtIcons.plus} Save entry
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Misc helpers / components
// ─────────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 6,
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>
        {value}
      </span>
    </div>
  );
}

function RunningTimer({
  startMs,
  serverNowMs,
}: {
  startMs: number;
  serverNowMs: number;
}) {
  // The server delivered "right now" as `serverNowMs`. We anchor the
  // ticking clock to it (rather than client wall time) so workers in
  // different timezones see the same elapsed display the server thinks they
  // should — and skewed laptop clocks don't lie. We tick a local second
  // counter independently of the server stamp.
  const baseDeltaRef = useRef(serverNowMs - startMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = baseDeltaRef.current + (now - performance.timeOrigin - (serverNowMs - performance.timeOrigin));
  // Above is a fancy way to say: use the server's "now" as a reference and
  // tick from there. Simpler equivalent: serverNowMs + (Date.now() -
  // mountedAt). Use a plain mounted-at anchor to avoid edge cases.
  const mountedAtRef = useRef<number | null>(null);
  if (mountedAtRef.current === null) mountedAtRef.current = Date.now();
  const totalSec = Math.max(
    0,
    Math.floor(
      (serverNowMs - startMs + (now - mountedAtRef.current)) / 1000,
    ),
  );
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  // suppress unused warning by referencing elapsedMs via void
  void elapsedMs;
  return (
    <span className="tt-running-timer">
      {String(h).padStart(2, "0")}
      <span className="tt-running-colon">:</span>
      {String(m).padStart(2, "0")}
      <span className="tt-running-colon">:</span>
      {String(s).padStart(2, "0")}
    </span>
  );
}

function todayEntries(
  entries: TimeEntryRow[],
  view: WorkerWeekView,
): TimeEntryRow[] {
  const todayIso = isoDate(new Date(view.serverNow));
  return entries.filter((e) => e.isoDate === todayIso);
}

function sumByDayLive(
  entries: TimeEntryRow[],
  serverNowIso: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  const now = new Date(serverNowIso);
  for (const e of entries) {
    const minutes =
      e.status === "running"
        ? Math.max(0, Math.round((now.getTime() - new Date(e.clockInAt).getTime()) / 60000))
        : (e.minutes ?? 0);
    out[e.isoDate] = (out[e.isoDate] ?? 0) + minutes;
  }
  return out;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(
  weekDays: WorkerWeekView["weekDays"],
  iso: string,
): string {
  return weekDays.find((d) => d.iso === iso)?.label ?? "";
}

function formatLongDate(d: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
