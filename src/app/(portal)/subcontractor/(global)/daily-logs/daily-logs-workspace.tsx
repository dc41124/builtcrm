"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  SubDailyLogsPageView,
  SubDailyLogsGcLog,
  SubDailyLogsCrewEntry,
  SubDailyLogsProject,
} from "@/domain/loaders/subcontractor-daily-logs-page";

// Sub portal accent: blue-steel (#3d6b8e). Scoped via CSS var on the root.

const I = {
  plus: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  cloud: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  ),
  users: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const ALL_PROJECTS_TAB = "__all__";

type ViewMode = "timeline" | "calendar" | "report";

export function SubcontractorDailyLogsWorkspace({
  view,
}: {
  view: SubDailyLogsPageView;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(ALL_PROJECTS_TAB);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [monthCursor, setMonthCursor] = useState(() => view.today.slice(0, 7));

  const todayEntries = useMemo(
    () => view.crewEntries.filter((c) => c.logDate === view.today),
    [view.crewEntries, view.today],
  );

  const filteredLogs = useMemo(() => {
    if (activeTab === ALL_PROJECTS_TAB) return view.gcLogs;
    return view.gcLogs.filter((g) => g.projectId === activeTab);
  }, [view.gcLogs, activeTab]);

  const filteredEntries = useMemo(() => {
    if (activeTab === ALL_PROJECTS_TAB) return view.crewEntries;
    return view.crewEntries.filter((c) => c.projectId === activeTab);
  }, [view.crewEntries, activeTab]);

  const reconciliationsToReview = view.crewEntries.filter((c) => c.requiresAck);

  const byProject = useMemo(() => {
    const map = new Map<string, { projectName: string; hours: number; days: number }>();
    // Anchor with project names so zero-hour orgs still show.
    for (const p of view.projects) {
      map.set(p.id, { projectName: p.name, hours: 0, days: 0 });
    }
    for (const c of view.crewEntries) {
      const curr = map.get(c.projectId) ?? {
        projectName: c.projectName,
        hours: 0,
        days: 0,
      };
      curr.hours += c.reconciledHours ?? c.hours;
      curr.days += 1;
      map.set(c.projectId, curr);
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      projectId: id,
      projectName: v.projectName,
      hours: v.hours,
      days: v.days,
    }));
  }, [view.crewEntries, view.projects]);

  return (
    <div className="sdl-root">
      <style>{SUB_DAILY_LOG_CSS}</style>

      <header className="sdl-page-h">
        <div>
          <h1 className="sdl-page-t">Daily Logs</h1>
          <p className="sdl-page-sub">
            Your crew activity across all projects and the GC&apos;s field records.
          </p>
        </div>
        <div className="sdl-page-acts">
          <button className="sdl-btn pri" onClick={() => setSubmitOpen(true)}>
            {I.plus} Submit today&apos;s crew
          </button>
        </div>
      </header>

      {todayEntries.length < view.projects.length && view.projects.length > 0 && (
        <div className="sdl-today-banner">
          <div className="sdl-tb-left">
            <div className="sdl-tb-icon">{I.alert}</div>
            <div className="sdl-tb-info">
              <h3>
                {formatDateLong(view.today)} —{" "}
                {todayEntries.length === 0
                  ? "no crew entries submitted"
                  : `${todayEntries.length} of ${view.projects.length} projects submitted`}
              </h3>
              <div className="sdl-tb-status">
                <span>
                  {view.kpis.outstandingToday} project
                  {view.kpis.outstandingToday === 1 ? "" : "s"} awaiting your entry
                </span>
              </div>
            </div>
          </div>
          <button className="sdl-btn pri" onClick={() => setSubmitOpen(true)}>
            {I.plus} Submit crew entry
          </button>
        </div>
      )}

      {reconciliationsToReview.length > 0 && (
        <div className="sdl-reco-banner">
          <div className="sdl-tb-left">
            <div className="sdl-tb-icon warn">{I.alert}</div>
            <div className="sdl-tb-info">
              <h3>
                {reconciliationsToReview.length} crew-hour reconciliation
                {reconciliationsToReview.length === 1 ? "" : "s"} needs your review
              </h3>
              <div className="sdl-tb-status">
                <span>
                  The GC adjusted submitted crew numbers. Confirm the updated values.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="sdl-kpi-strip">
        <Kpi
          label="My crew-hours"
          value={formatNumber(view.kpis.myCrewHoursThisWeek)}
          meta={`This week · ${view.projects.length} project${view.projects.length === 1 ? "" : "s"}`}
          metaType="ok"
        />
        <Kpi
          label="Entries submitted"
          value={`${view.kpis.entriesSubmittedThisWeek} / ${view.kpis.workDaysThisWeek * view.projects.length}`}
          meta="Last 7 days"
          metaType={
            view.kpis.entriesSubmittedThisWeek >=
            view.kpis.workDaysThisWeek * Math.max(view.projects.length, 1) * 0.8
              ? "ok"
              : "warn"
          }
        />
        <Kpi
          label="Outstanding"
          value={String(view.kpis.outstandingToday)}
          meta="Today unsubmitted"
          metaType={view.kpis.outstandingToday > 0 ? "warn" : "ok"}
          alert={view.kpis.outstandingToday > 0}
        />
        <Kpi
          label="GC logs to review"
          value={String(view.kpis.gcLogsThisWeek)}
          meta="Posted this week"
        />
      </section>

      {view.projects.length > 0 && (
        <div className="sdl-proj-tabs">
          <button
            className={`sdl-proj-tab${activeTab === ALL_PROJECTS_TAB ? " on" : ""}`}
            onClick={() => setActiveTab(ALL_PROJECTS_TAB)}
          >
            All projects
          </button>
          {view.projects.map((p) => (
            <button
              key={p.id}
              className={`sdl-proj-tab${activeTab === p.id ? " on" : ""}`}
              onClick={() => setActiveTab(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <section className="sdl-dash">
        <div className="sdl-dash-main">
          <div className="sdl-cd">
            <div className="sdl-cd-h">
              <div>
                <div className="sdl-cd-title">
                  {viewMode === "timeline"
                    ? "Daily logs & your entries"
                    : viewMode === "calendar"
                      ? "Your activity calendar"
                      : "Crew-hours report"}
                </div>
                <div className="sdl-cd-sub">
                  {viewMode === "timeline"
                    ? `${filteredLogs.length} GC log${filteredLogs.length === 1 ? "" : "s"} · ${filteredEntries.length} of your entries in range`
                    : viewMode === "calendar"
                      ? "Days your crew was on site across all projects"
                      : "Per-project rollup · last 30 / 60 / 90 days"}
                </div>
              </div>
              <div className="sdl-vt">
                <button
                  className={`sdl-vt-btn${viewMode === "timeline" ? " on" : ""}`}
                  onClick={() => setViewMode("timeline")}
                >
                  Timeline
                </button>
                <button
                  className={`sdl-vt-btn${viewMode === "calendar" ? " on" : ""}`}
                  onClick={() => setViewMode("calendar")}
                >
                  Calendar
                </button>
                <button
                  className={`sdl-vt-btn${viewMode === "report" ? " on" : ""}`}
                  onClick={() => setViewMode("report")}
                >
                  Report
                </button>
              </div>
            </div>
            <div className="sdl-cd-body">
              {viewMode === "timeline" && (
                <GcLogList
                  logs={filteredLogs}
                  crewEntries={filteredEntries}
                  today={view.today}
                />
              )}
              {viewMode === "calendar" && (
                <SubCalendar
                  monthCursor={monthCursor}
                  onChangeCursor={setMonthCursor}
                  crewEntries={filteredEntries}
                  today={view.today}
                />
              )}
              {viewMode === "report" && (
                <CrewHoursReport crewEntries={view.crewEntries} projects={view.projects} />
              )}
            </div>
          </div>
        </div>

        <div className="sdl-dash-rail">
          <div className="sdl-cd">
            <div className="sdl-cd-h">
              <div>
                <div className="sdl-cd-title">By project</div>
                <div className="sdl-cd-sub">This week · crew-hours</div>
              </div>
            </div>
            <div className="sdl-cd-body" style={{ paddingTop: 8 }}>
              {byProject.length === 0 ? (
                <p className="sdl-empty">No active projects yet.</p>
              ) : (
                byProject.map((p) => (
                  <div key={p.projectId} className="sdl-proj-mini">
                    <div>
                      <h5>{p.projectName}</h5>
                      <p>
                        {p.days} day{p.days === 1 ? "" : "s"} on site
                      </p>
                    </div>
                    <span className="sdl-pm-val">{formatNumber(p.hours)} h</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {reconciliationsToReview.length > 0 && (
            <div className="sdl-cd">
              <div className="sdl-cd-h">
                <div>
                  <div className="sdl-cd-title">Review required</div>
                  <div className="sdl-cd-sub">GC reconciliations waiting on you</div>
                </div>
              </div>
              <div className="sdl-cd-body" style={{ paddingTop: 8 }}>
                {reconciliationsToReview.slice(0, 5).map((entry) => (
                  <ReconciliationRow key={entry.id} entry={entry} onAcked={() => router.refresh()} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {submitOpen && (
        <SubmitCrewDrawer
          projects={view.projects}
          today={view.today}
          orgId={view.organization.id}
          existingEntries={todayEntries}
          onClose={() => setSubmitOpen(false)}
          onSubmitted={() => {
            setSubmitOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Kpi({
  label,
  value,
  meta,
  metaType,
  alert,
}: {
  label: string;
  value: string;
  meta: string;
  metaType?: "ok" | "warn" | "danger";
  alert?: boolean;
}) {
  return (
    <div className={`sdl-kpi${alert ? " alert" : ""}`}>
      <div className="sdl-kpi-label">{label}</div>
      <div className="sdl-kpi-val">{value}</div>
      <div className="sdl-kpi-meta">
        {metaType ? (
          <span className={`sdl-kpi-trend ${metaType}`}>{meta}</span>
        ) : (
          meta
        )}
      </div>
    </div>
  );
}

function GcLogList({
  logs,
  crewEntries,
  today,
}: {
  logs: SubDailyLogsGcLog[];
  crewEntries: SubDailyLogsCrewEntry[];
  today: string;
}) {
  // Build the combined timeline: one row per (projectId, logDate) that
  // has either a GC log or a sub entry. GC logs take visual priority.
  const byKey = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      logDate: string;
      gc: SubDailyLogsGcLog | null;
      entry: SubDailyLogsCrewEntry | null;
    }
  >();
  for (const g of logs) {
    byKey.set(`${g.projectId}::${g.logDate}`, {
      projectId: g.projectId,
      projectName: g.projectName,
      logDate: g.logDate,
      gc: g,
      entry: g.myEntry,
    });
  }
  for (const c of crewEntries) {
    const k = `${c.projectId}::${c.logDate}`;
    const existing = byKey.get(k);
    if (existing) {
      existing.entry = c;
    } else {
      byKey.set(k, {
        projectId: c.projectId,
        projectName: c.projectName,
        logDate: c.logDate,
        gc: null,
        entry: c,
      });
    }
  }
  const rows = Array.from(byKey.values()).sort((a, b) =>
    a.logDate < b.logDate ? 1 : a.logDate > b.logDate ? -1 : 0,
  );

  if (rows.length === 0) {
    return (
      <p className="sdl-empty">
        No crew activity or GC logs in the last 30 days for this selection.
      </p>
    );
  }

  return (
    <div style={{ margin: "-4px 0" }}>
      {rows.map((row) => (
        <div key={`${row.projectId}-${row.logDate}`} className="sdl-log-row">
          <div className="sdl-log-date">
            {formatDateShort(row.logDate)}
            {row.logDate === today && (
              <span className="sdl-pl accent">Today</span>
            )}
            <span className="sdl-log-proj">{row.projectName}</span>
          </div>
          <div className="sdl-log-body">
            {row.gc ? (
              <>
                <h5>
                  {row.gc.clientSummary?.split(".")[0]?.trim() ||
                    row.gc.notes?.split(".")[0]?.trim() ||
                    "GC posted a daily log"}
                  .
                </h5>
                {row.gc.notes && <p>{row.gc.notes}</p>}
                <div className="sdl-log-meta-row">
                  <span className="sdl-log-mi">
                    {I.cloud} {weatherLabel(row.gc.weather)}
                  </span>
                  {row.gc.reportedByName && (
                    <span className="sdl-log-mi">GC: {row.gc.reportedByName}</span>
                  )}
                  {row.gc.photoCount > 0 && (
                    <span className="sdl-log-mi">
                      {row.gc.photoCount} photo{row.gc.photoCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <h5 className="sdl-muted-head">GC log not yet posted.</h5>
            )}
            {row.entry ? (
              <div className="sdl-own-entry">
                <span className="sdl-own-label">
                  {I.check} Your crew
                </span>
                <span>
                  {row.entry.reconciledHeadcount ?? row.entry.headcount} crew ·{" "}
                  {row.entry.reconciledHours ?? row.entry.hours} hrs
                </span>
                {row.entry.requiresAck && (
                  <span className="sdl-pl amber">Review required</span>
                )}
                {row.entry.submittedNote && (
                  <span className="sdl-own-note">“{row.entry.submittedNote}”</span>
                )}
              </div>
            ) : (
              <div className="sdl-own-entry missing">
                <span className="sdl-muted-head">
                  No crew entry submitted for this day.
                </span>
              </div>
            )}
          </div>
          <div className="sdl-log-actions">
            {row.gc && (
              <Link
                href={`/subcontractor/daily-logs/${row.gc.id}`}
                className="sdl-btn sm"
              >
                View log
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReconciliationRow({
  entry,
  onAcked,
}: {
  entry: SubDailyLogsCrewEntry;
  onAcked: () => void;
}) {
  const [acking, setAcking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ack = async () => {
    setAcking(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/daily-log-crew-entries/${entry.id}/ack`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "Ack failed");
        return;
      }
      onAcked();
    } finally {
      setAcking(false);
    }
  };

  const before = `${entry.headcount} crew · ${entry.hours}h`;
  const after = `${entry.reconciledHeadcount ?? entry.headcount} crew · ${entry.reconciledHours ?? entry.hours}h`;

  return (
    <div className="sdl-reco-row">
      <h5>
        {entry.projectName} · {formatDateShort(entry.logDate)}
      </h5>
      <p>
        <span className="sdl-muted-head">Submitted:</span> {before}
      </p>
      <p>
        <span className="sdl-muted-head">Reconciled:</span> {after}
      </p>
      {error && <p className="sdl-error">{error}</p>}
      <div className="sdl-reco-acts">
        <button className="sdl-btn sm pri" onClick={ack} disabled={acking}>
          {acking ? "Acking…" : "Acknowledge"}
        </button>
      </div>
    </div>
  );
}

// ── Calendar view ───────────────────────────────────────────────
//
// Sub-specific calendar: shows days where the sub's crew had an entry
// (green = submitted, amber = reconciliation pending). Missed/non-
// activity days are greyed out — we don't mark weekdays as "missed"
// here because the sub can be on zero projects some days and that's
// a valid state, unlike the contractor's "must log every work day"
// model.

type SubCalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  state: "none" | "submitted" | "pending" | "today" | "weekend" | "future";
  entries: SubDailyLogsCrewEntry[];
};

function SubCalendar({
  monthCursor,
  onChangeCursor,
  crewEntries,
  today,
}: {
  monthCursor: string;
  onChangeCursor: (next: string) => void;
  crewEntries: SubDailyLogsCrewEntry[];
  today: string;
}) {
  const [year, month] = monthCursor.split("-").map((s) => parseInt(s, 10));
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    onChangeCursor(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  };

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startDow = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  const entriesByDate = new Map<string, SubDailyLogsCrewEntry[]>();
  for (const e of crewEntries) {
    const arr = entriesByDate.get(e.logDate) ?? [];
    arr.push(e);
    entriesByDate.set(e.logDate, arr);
  }

  const cells: SubCalendarCell[] = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({
      key: `prev-${day}`,
      day,
      inMonth: false,
      state: "none",
      entries: [],
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    const dayEntries = entriesByDate.get(iso) ?? [];
    let state: SubCalendarCell["state"];
    if (iso === today) {
      state =
        dayEntries.length > 0
          ? dayEntries.some((e) => e.requiresAck)
            ? "pending"
            : "submitted"
          : "today";
    } else if (dayEntries.length > 0) {
      state = dayEntries.some((e) => e.requiresAck) ? "pending" : "submitted";
    } else if (dow === 0 || dow === 6) {
      state = "weekend";
    } else if (iso > today) {
      state = "future";
    } else {
      state = "none";
    }
    cells.push({ key: iso, day: d, inMonth: true, state, entries: dayEntries });
  }
  while (cells.length % 7 !== 0) {
    const offset = cells.length - (startDow + daysInMonth);
    cells.push({
      key: `next-${offset}`,
      day: offset + 1,
      inMonth: false,
      state: "none",
      entries: [],
    });
  }

  return (
    <>
      <div className="sdl-cal-head">
        <div className="sdl-cal-nav">
          <button
            className="sdl-cal-arrow"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="sdl-cal-month">{monthLabel}</div>
          <button
            className="sdl-cal-arrow"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="sdl-cal-legend">
          <span>
            <span
              className="sw"
              style={{
                background: "var(--sdl-ok-s)",
                border: "1px solid rgba(45,138,94,.3)",
              }}
            />
            Submitted
          </span>
          <span>
            <span
              className="sw"
              style={{
                background: "var(--sdl-wr-s)",
                border: "1px solid rgba(193,122,26,.3)",
              }}
            />
            Review required
          </span>
          <span>
            <span
              className="sw"
              style={{
                background: "var(--sdl-ac-s)",
                border: "1.5px solid var(--sdl-ac)",
              }}
            />
            Today
          </span>
        </div>
      </div>
      <div className="sdl-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="sdl-cal-dow">
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const totalHours = c.entries.reduce(
            (a, e) => a + (e.reconciledHours ?? e.hours),
            0,
          );
          const cls = !c.inMonth
            ? "prev"
            : c.state === "weekend"
              ? "weekend"
              : c.state === "submitted"
                ? "submitted"
                : c.state === "pending"
                  ? "pending"
                  : c.state === "today"
                    ? "today"
                    : c.state === "future"
                      ? "future"
                      : "none";
          return (
            <div
              key={c.key}
              className={`sdl-cal-day ${cls}`}
              title={
                c.entries.length > 0
                  ? c.entries
                      .map(
                        (e) =>
                          `${e.projectName}: ${e.reconciledHeadcount ?? e.headcount} × ${e.reconciledHours ?? e.hours}h`,
                      )
                      .join("\n")
                  : undefined
              }
            >
              <span className="d-num">{c.day}</span>
              {c.entries.length > 0 && (
                <span className="d-foot">{formatNumber(totalHours)}h</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Report view ─────────────────────────────────────────────────
//
// Per-project rollup of the sub's crew-hours. Works off the 30-day
// window the loader returns today; slider toggles which subset (7 /
// 30 / 60 — can't exceed what's loaded without extending the loader).
// Provides a one-click CSV export for payroll handoff.

function CrewHoursReport({
  crewEntries,
  projects,
}: {
  crewEntries: SubDailyLogsCrewEntry[];
  projects: SubDailyLogsProject[];
}) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 60>(30);
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (rangeDays - 1));
    return d.toISOString().slice(0, 10);
  }, [rangeDays]);

  const inRange = crewEntries.filter((e) => e.logDate >= cutoff);

  const byProject = useMemo(() => {
    const map = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        daysOnSite: number;
        totalHeadcount: number;
        totalHours: number;
        reconciledCount: number;
      }
    >();
    for (const p of projects) {
      map.set(p.id, {
        projectId: p.id,
        projectName: p.name,
        daysOnSite: 0,
        totalHeadcount: 0,
        totalHours: 0,
        reconciledCount: 0,
      });
    }
    for (const e of inRange) {
      const curr = map.get(e.projectId);
      if (!curr) continue;
      curr.daysOnSite += 1;
      curr.totalHeadcount += e.reconciledHeadcount ?? e.headcount;
      curr.totalHours += e.reconciledHours ?? e.hours;
      if (e.reconciledAt) curr.reconciledCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [inRange, projects]);

  const grandTotal = byProject.reduce(
    (acc, p) => ({
      days: acc.days + p.daysOnSite,
      hours: acc.hours + p.totalHours,
    }),
    { days: 0, hours: 0 },
  );

  const exportCsv = () => {
    const rows: string[] = [
      "Date,Project,Headcount,Hours,Note,Reconciled",
    ];
    for (const e of inRange.slice().sort((a, b) =>
      a.logDate < b.logDate ? -1 : 1,
    )) {
      const note = (e.submittedNote ?? "").replace(/"/g, '""');
      rows.push(
        [
          e.logDate,
          `"${e.projectName.replace(/"/g, '""')}"`,
          e.reconciledHeadcount ?? e.headcount,
          e.reconciledHours ?? e.hours,
          `"${note}"`,
          e.reconciledAt ? "yes" : "no",
        ].join(","),
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crew-hours-${cutoff}-to-today.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="sdl-report-toolbar">
        <div className="sdl-vt">
          <button
            className={`sdl-vt-btn${rangeDays === 7 ? " on" : ""}`}
            onClick={() => setRangeDays(7)}
          >
            Last 7 days
          </button>
          <button
            className={`sdl-vt-btn${rangeDays === 30 ? " on" : ""}`}
            onClick={() => setRangeDays(30)}
          >
            Last 30 days
          </button>
          <button
            className={`sdl-vt-btn${rangeDays === 60 ? " on" : ""}`}
            onClick={() => setRangeDays(60)}
            disabled
            title="Loader currently returns the last 30 days. Widening the range is Phase 6 scope."
          >
            Last 60 days
          </button>
        </div>
        <button
          className="sdl-btn sm"
          onClick={exportCsv}
          disabled={inRange.length === 0}
        >
          Export CSV
        </button>
      </div>

      {byProject.length === 0 || inRange.length === 0 ? (
        <p className="sdl-empty">No crew-hours in this range.</p>
      ) : (
        <table className="sdl-report-tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th>Days on site</th>
              <th>Total crew</th>
              <th>Total hours</th>
              <th>Reconciled</th>
            </tr>
          </thead>
          <tbody>
            {byProject.map((p) => (
              <tr key={p.projectId}>
                <td className="project">{p.projectName}</td>
                <td className="num">{p.daysOnSite}</td>
                <td className="num">{p.totalHeadcount}</td>
                <td className="num">{formatNumber(p.totalHours)}</td>
                <td className="num">
                  {p.reconciledCount > 0 ? (
                    <span className="sdl-pl amber">
                      {p.reconciledCount} reconciled
                    </span>
                  ) : (
                    <span className="sdl-muted-head">none</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="num">{grandTotal.days}</td>
              <td />
              <td className="num">{formatNumber(grandTotal.hours)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function SubmitCrewDrawer({
  projects,
  today,
  orgId,
  existingEntries,
  onClose,
  onSubmitted,
}: {
  projects: SubDailyLogsProject[];
  today: string;
  orgId: string;
  existingEntries: SubDailyLogsCrewEntry[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  // Pre-select the first project they DON'T have an entry for today.
  const alreadySubmittedFor = new Set(existingEntries.map((e) => e.projectId));
  const defaultProjectId =
    projects.find((p) => !alreadySubmittedFor.has(p.id))?.id ?? projects[0]?.id ?? "";

  const [projectId, setProjectId] = useState(defaultProjectId);
  const [headcount, setHeadcount] = useState<number | "">("");
  const [hours, setHours] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!projectId) return;
    if (headcount === "" || hours === "") {
      setError("Headcount and hours are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-log-crew-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          orgId,
          logDate: today,
          headcount: Number(headcount),
          hours: Number(hours),
          submittedNote: note || null,
          submittedIssues: issues || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(data.message ?? data.error ?? "Failed to submit");
        return;
      }
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="sdl-drawer-ovl" onClick={onClose} />
      <aside className="sdl-drawer" role="dialog" aria-modal="true">
        <div className="sdl-dr-head">
          <div className="sdl-dr-head-l">
            <h2>Submit today&apos;s crew entry</h2>
            <div className="sdl-dh-meta">
              <span>{formatDateLong(today)}</span>
            </div>
          </div>
          <button className="sdl-dr-close" onClick={onClose} aria-label="Close">
            {I.x}
          </button>
        </div>
        <div className="sdl-dr-body">
          <div className="sdl-sec">
            <div className="sdl-sec-h">Project</div>
            <div className="sdl-field">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {alreadySubmittedFor.has(p.id) ? " (already submitted)" : ""}
                  </option>
                ))}
              </select>
              {alreadySubmittedFor.has(projectId) && (
                <p className="sdl-hint">
                  You already have an entry for today on this project —
                  submitting again will update it.
                </p>
              )}
            </div>
          </div>

          <div className="sdl-sec">
            <div className="sdl-sec-h">{I.users} Crew</div>
            <div className="sdl-form-grid">
              <div className="sdl-field">
                <label>Headcount</label>
                <input
                  type="number"
                  value={headcount}
                  onChange={(e) =>
                    setHeadcount(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="sdl-field">
                <label>Total hours</label>
                <input
                  type="number"
                  value={hours}
                  onChange={(e) =>
                    setHours(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>
            </div>
          </div>

          <div className="sdl-sec">
            <div className="sdl-sec-h">Work performed</div>
            <div className="sdl-field">
              <textarea
                rows={4}
                placeholder="Short note for the GC — what your crew got done today. 1-3 sentences."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="sdl-sec">
            <div className="sdl-sec-h">{I.alert} Issues encountered</div>
            <p className="sdl-hint">
              Optional — flag anything the GC should know (delays, material
              shortages, coordination conflicts).
            </p>
            <div className="sdl-field">
              <textarea
                rows={3}
                placeholder="Leave blank if none."
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="sdl-pl red sdl-inline-err">{error}</div>
          )}
        </div>
        <div className="sdl-dr-foot">
          <button className="sdl-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="sdl-btn pri"
            onClick={submit}
            disabled={submitting || !projectId}
          >
            {submitting ? "Submitting…" : "Submit crew entry"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function weatherLabel(w: {
  conditions: string | null;
  highC: number | null;
  lowC: number | null;
}): string {
  if (!w.conditions && w.highC == null) return "Weather not recorded";
  const c = w.conditions ? pretty(w.conditions) : "";
  const t =
    w.highC != null && w.lowC != null ? ` · ${w.highC}°/${w.lowC}°` : "";
  return `${c}${t}`.trim();
}

function pretty(s: string): string {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// CSS — mirrors the contractor workspace but with the sub portal's
// blue-steel accent. Prefix `sdl-` (sub daily logs) to avoid colliding
// with `.dl-` classes on the contractor workspace.
const SUB_DAILY_LOG_CSS = `
.sdl-root{
  --sdl-s1:#fff;--sdl-s2:#f3f4f6;--sdl-s3:#e2e5e9;--sdl-s4:#d1d5db;
  --sdl-sh:#f5f6f8;--sdl-sic:#f8f9fa;
  --sdl-t1:#1a1714;--sdl-t2:#6b655b;--sdl-t3:#9c958a;--sdl-ti:#faf9f7;
  --sdl-ac:#3d6b8e;--sdl-ac-h:#345d7c;--sdl-ac-s:#e6eff5;--sdl-ac-t:#2d5577;--sdl-ac-m:#b3cede;
  --sdl-ok:#2d8a5e;--sdl-ok-s:#edf7f1;--sdl-ok-t:#1e6b46;
  --sdl-wr:#c17a1a;--sdl-wr-s:#fdf4e6;--sdl-wr-t:#96600f;
  --sdl-dg:#c93b3b;--sdl-dg-s:#fdeaea;--sdl-dg-t:#a52e2e;
  --sdl-fd:'DM Sans',system-ui,sans-serif;
  --sdl-fb:'Instrument Sans',system-ui,sans-serif;
  --sdl-fm:'JetBrains Mono',monospace;
  font-family:var(--sdl-fb);color:var(--sdl-t1);line-height:1.5;font-size:14px;padding:24px;
}
.sdl-root *{box-sizing:border-box}

.sdl-page-h{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px}
.sdl-page-t{font-family:var(--sdl-fd);font-size:26px;font-weight:820;letter-spacing:-.03em;line-height:1.15;margin:0}
.sdl-page-sub{margin-top:6px;font-size:14px;font-weight:520;color:var(--sdl-t2);max-width:640px}
.sdl-page-acts{display:flex;gap:8px;flex-shrink:0;padding-top:2px}

.sdl-btn{height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--sdl-s3);background:var(--sdl-s1);color:var(--sdl-t1);font-size:13px;font-weight:650;font-family:var(--sdl-fb);display:inline-flex;align-items:center;gap:6px;cursor:pointer;text-decoration:none;white-space:nowrap}
.sdl-btn:hover{background:var(--sdl-sh);border-color:var(--sdl-s4)}
.sdl-btn:disabled{opacity:.55;cursor:not-allowed}
.sdl-btn.pri{background:var(--sdl-ac);color:var(--sdl-ti);border-color:var(--sdl-ac)}
.sdl-btn.pri:hover{background:var(--sdl-ac-h)}
.sdl-btn.sm{height:30px;font-size:12px;padding:0 10px}
.sdl-btn.ghost{background:transparent;border-color:transparent;color:var(--sdl-t2);font-weight:560}
.sdl-btn.ghost:hover{background:var(--sdl-sh);color:var(--sdl-t1)}
.sdl-btn svg{width:14px;height:14px;flex-shrink:0}

.sdl-pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--sdl-fd)}
.sdl-pl.amber{background:var(--sdl-wr-s);color:var(--sdl-wr-t)}
.sdl-pl.green{background:var(--sdl-ok-s);color:var(--sdl-ok-t)}
.sdl-pl.red{background:var(--sdl-dg-s);color:var(--sdl-dg-t)}
.sdl-pl.accent{background:var(--sdl-ac-s);color:var(--sdl-ac-t)}
.sdl-pl.gray{background:var(--sdl-s2);color:var(--sdl-t2)}

.sdl-today-banner{background:linear-gradient(135deg,var(--sdl-ac-s),var(--sdl-s1));border:1.5px solid var(--sdl-ac-m);border-radius:18px;padding:18px 20px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.sdl-reco-banner{background:var(--sdl-wr-s);border:1.5px solid rgba(193,122,26,.25);border-radius:18px;padding:16px 20px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.sdl-tb-left{display:flex;align-items:center;gap:16px;flex:1;min-width:0}
.sdl-tb-icon{width:44px;height:44px;border-radius:10px;background:var(--sdl-s1);color:var(--sdl-ac);display:grid;place-items:center;flex-shrink:0;border:1px solid var(--sdl-ac-m)}
.sdl-tb-icon.warn{color:var(--sdl-wr-t);border-color:rgba(193,122,26,.3)}
.sdl-tb-icon svg{width:22px;height:22px}
.sdl-tb-info h3{font-family:var(--sdl-fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0}
.sdl-tb-status{font-size:12.5px;color:var(--sdl-t2);margin-top:3px}

.sdl-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.sdl-kpi{background:var(--sdl-s1);border:1px solid var(--sdl-s3);border-radius:14px;padding:16px}
.sdl-kpi.alert{border-color:var(--sdl-wr);border-width:1.5px}
.sdl-kpi-label{font-family:var(--sdl-fd);font-size:11.5px;font-weight:700;color:var(--sdl-t1);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.sdl-kpi-val{font-family:var(--sdl-fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.sdl-kpi-meta{font-family:var(--sdl-fb);font-size:12px;font-weight:580;color:var(--sdl-t2);margin-top:4px}
.sdl-kpi-trend{font-weight:720;font-size:11.5px}
.sdl-kpi-trend.warn{color:var(--sdl-wr-t)}
.sdl-kpi-trend.ok{color:var(--sdl-ok-t)}

.sdl-proj-tabs{display:flex;gap:4px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px}
.sdl-proj-tab{background:transparent;border:1px solid var(--sdl-s3);border-radius:999px;height:32px;padding:0 14px;font-size:12.5px;font-weight:600;color:var(--sdl-t2);font-family:var(--sdl-fb);cursor:pointer;white-space:nowrap}
.sdl-proj-tab:hover{background:var(--sdl-sh);color:var(--sdl-t1)}
.sdl-proj-tab.on{background:var(--sdl-ac);color:var(--sdl-ti);border-color:var(--sdl-ac);font-weight:700}

.sdl-dash{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}
.sdl-dash-main,.sdl-dash-rail{display:flex;flex-direction:column;gap:16px}
.sdl-cd{background:var(--sdl-s1);border:1px solid var(--sdl-s3);border-radius:18px;overflow:hidden}
.sdl-cd-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--sdl-s3);gap:12px}
.sdl-cd-title{font-family:var(--sdl-fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.sdl-cd-sub{font-family:var(--sdl-fb);font-size:12.5px;font-weight:540;color:var(--sdl-t2);margin-top:2px}
.sdl-cd-body{padding:16px 20px}

.sdl-log-row{display:grid;grid-template-columns:140px 1fr auto;gap:16px;padding:14px 0;border-top:1px solid var(--sdl-s3);align-items:start}
.sdl-log-row:first-child{border-top:none}
.sdl-log-date{font-family:var(--sdl-fd);font-size:13px;font-weight:680;color:var(--sdl-t1);line-height:1.35;display:flex;flex-direction:column;gap:4px}
.sdl-log-proj{font-family:var(--sdl-fm);font-size:10.5px;color:var(--sdl-t3);font-weight:500}
.sdl-log-body h5{font-family:var(--sdl-fd);font-size:13.5px;font-weight:620;line-height:1.35;margin:0 0 4px}
.sdl-log-body p{font-size:12.5px;color:var(--sdl-t2);line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sdl-log-meta-row{display:flex;align-items:center;gap:10px;margin-top:7px;flex-wrap:wrap}
.sdl-log-mi{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--sdl-t2);font-weight:570}
.sdl-log-mi svg{color:var(--sdl-t3)}
.sdl-log-actions{display:flex;flex-direction:column;gap:6px}

.sdl-muted-head{color:var(--sdl-t3);font-weight:560;font-style:italic;font-size:12.5px}

.sdl-own-entry{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 10px;background:var(--sdl-ac-s);border:1px solid var(--sdl-ac-m);border-radius:8px;flex-wrap:wrap;font-size:12.5px}
.sdl-own-entry.missing{background:var(--sdl-s2);border-color:var(--sdl-s3)}
.sdl-own-label{display:inline-flex;align-items:center;gap:4px;font-family:var(--sdl-fd);font-weight:720;color:var(--sdl-ac-t);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.sdl-own-label svg{color:var(--sdl-ac-t)}
.sdl-own-note{color:var(--sdl-t2);font-style:italic}

.sdl-proj-mini{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--sdl-s3)}
.sdl-proj-mini:last-child{border-bottom:none}
.sdl-proj-mini h5{font-family:var(--sdl-fd);font-size:13px;font-weight:620;margin:0}
.sdl-proj-mini p{font-size:11.5px;color:var(--sdl-t3);margin:2px 0 0}
.sdl-pm-val{font-family:var(--sdl-fm);font-size:13px;font-weight:600;color:var(--sdl-t1)}

.sdl-reco-row{padding:12px 0;border-bottom:1px solid var(--sdl-s3)}
.sdl-reco-row:last-child{border-bottom:none}
.sdl-reco-row h5{font-family:var(--sdl-fd);font-size:13px;font-weight:620;margin:0 0 6px}
.sdl-reco-row p{font-size:11.5px;color:var(--sdl-t2);margin:0}
.sdl-reco-acts{margin-top:8px}
.sdl-error{color:var(--sdl-dg-t);font-size:11.5px;margin-top:6px}

.sdl-empty{font-size:13px;color:var(--sdl-t2);padding:20px 0;text-align:center}

/* View toggle (Timeline / Calendar / Report) */
.sdl-vt{display:inline-flex;background:var(--sdl-s2);border-radius:10px;padding:3px;gap:2px}
.sdl-vt-btn{height:28px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:600;color:var(--sdl-t2);background:transparent;border:none;cursor:pointer;font-family:var(--sdl-fb);display:inline-flex;align-items:center;gap:5px}
.sdl-vt-btn:disabled{opacity:.4;cursor:not-allowed}
.sdl-vt-btn.on{background:var(--sdl-s1);color:var(--sdl-t1);font-weight:700;box-shadow:0 1px 3px rgba(26,23,20,.05)}

/* Calendar view */
.sdl-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 4px}
.sdl-cal-nav{display:flex;align-items:center;gap:8px}
.sdl-cal-month{font-family:var(--sdl-fd);font-size:17px;font-weight:740;letter-spacing:-.02em}
.sdl-cal-arrow{width:28px;height:28px;border-radius:6px;border:1px solid var(--sdl-s3);background:var(--sdl-s1);color:var(--sdl-t2);display:grid;place-items:center;cursor:pointer}
.sdl-cal-arrow:hover{background:var(--sdl-sh);color:var(--sdl-t1)}
.sdl-cal-arrow svg{width:12px;height:12px}
.sdl-cal-legend{display:flex;gap:14px;font-size:11.5px;color:var(--sdl-t2);font-weight:550}
.sdl-cal-legend span{display:inline-flex;align-items:center;gap:5px}
.sdl-cal-legend .sw{width:10px;height:10px;border-radius:3px}

.sdl-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.sdl-cal-dow{font-family:var(--sdl-fd);font-size:10.5px;font-weight:700;color:var(--sdl-t3);text-transform:uppercase;letter-spacing:.06em;text-align:center;padding:4px 0;margin-bottom:2px}
.sdl-cal-day{aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:8px 10px;transition:all 120ms cubic-bezier(.16,1,.3,1);border:1px solid transparent}
.sdl-cal-day .d-num{font-family:var(--sdl-fd);font-size:13px;font-weight:700}
.sdl-cal-day .d-foot{font-size:10px;font-weight:700;letter-spacing:.02em;font-family:var(--sdl-fm)}
.sdl-cal-day.prev,.sdl-cal-day.none,.sdl-cal-day.future{color:var(--sdl-t3);opacity:.5}
.sdl-cal-day.weekend{background:var(--sdl-s2);color:var(--sdl-t3)}
.sdl-cal-day.submitted{background:var(--sdl-ok-s);color:var(--sdl-ok-t);border-color:rgba(45,138,94,.2)}
.sdl-cal-day.pending{background:var(--sdl-wr-s);color:var(--sdl-wr-t);border-color:rgba(193,122,26,.25)}
.sdl-cal-day.today{background:var(--sdl-ac-s);color:var(--sdl-ac-t);border:1.5px solid var(--sdl-ac);font-weight:820}

/* Report view */
.sdl-report-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;flex-wrap:wrap}
.sdl-report-tbl{width:100%;border-collapse:collapse}
.sdl-report-tbl th{font-family:var(--sdl-fd);font-size:11px;font-weight:700;color:var(--sdl-t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:10px 12px;background:var(--sdl-sic);border-bottom:1px solid var(--sdl-s3)}
.sdl-report-tbl th:nth-child(n+2),.sdl-report-tbl td.num{text-align:right}
.sdl-report-tbl td{padding:12px;border-bottom:1px solid var(--sdl-s3);font-size:13px}
.sdl-report-tbl tr:last-child td{border-bottom:none}
.sdl-report-tbl td.project{font-family:var(--sdl-fd);font-weight:620}
.sdl-report-tbl td.num{font-family:var(--sdl-fm);font-weight:600}
.sdl-report-tbl tr.total td{background:var(--sdl-sic);font-weight:740;border-bottom:none}

.sdl-drawer-ovl{position:fixed;inset:0;background:rgba(20,18,14,.4);backdrop-filter:blur(3px);z-index:100}
.sdl-drawer{position:fixed;top:0;right:0;width:560px;max-width:100vw;height:100vh;background:var(--sdl-s1);z-index:101;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(26,23,20,.14);border-left:1px solid var(--sdl-s3);animation:sdl-slide 280ms cubic-bezier(.16,1,.3,1)}
@keyframes sdl-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}
.sdl-dr-head{padding:16px 24px;border-bottom:1px solid var(--sdl-s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-shrink:0}
.sdl-dr-head-l h2{font-family:var(--sdl-fd);font-size:20px;font-weight:780;letter-spacing:-.02em;margin:0}
.sdl-dh-meta{font-size:12.5px;color:var(--sdl-t2);margin-top:4px}
.sdl-dr-close{width:32px;height:32px;border-radius:10px;border:1px solid var(--sdl-s3);background:var(--sdl-s1);color:var(--sdl-t2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.sdl-dr-close:hover{background:var(--sdl-sh);color:var(--sdl-t1)}
.sdl-dr-body{flex:1;overflow-y:auto;padding:20px 24px}
.sdl-dr-foot{padding:14px 24px;border-top:1px solid var(--sdl-s3);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-shrink:0;background:var(--sdl-sic)}

.sdl-sec{margin-bottom:22px}
.sdl-sec-h{font-family:var(--sdl-fd);font-size:11.5px;font-weight:720;color:var(--sdl-t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.sdl-sec-h svg{color:var(--sdl-t3)}

.sdl-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sdl-field label{display:block;font-family:var(--sdl-fd);font-size:11.5px;font-weight:680;color:var(--sdl-t2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
.sdl-field input,.sdl-field select,.sdl-field textarea{width:100%;border:1px solid var(--sdl-s3);background:var(--sdl-s1);border-radius:10px;padding:8px 12px;font-family:var(--sdl-fb);font-size:13px;color:var(--sdl-t1);outline:none}
.sdl-field input:focus,.sdl-field select:focus,.sdl-field textarea:focus{border-color:var(--sdl-ac);box-shadow:0 0 0 3px rgba(61,107,142,.15)}
.sdl-field textarea{resize:vertical;line-height:1.5}
.sdl-hint{font-size:11.5px;color:var(--sdl-t3);margin:6px 0 0}
.sdl-inline-err{margin-top:12px;height:auto;padding:8px 10px;font-size:12}

@media (max-width:960px){
  .sdl-kpi-strip{grid-template-columns:repeat(2,1fr)}
  .sdl-dash{grid-template-columns:1fr}
  .sdl-drawer{width:100vw}
  .sdl-log-row{grid-template-columns:1fr;gap:8px}
}
`;
