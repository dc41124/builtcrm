"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ContractorDailyLogsPageView } from "@/domain/loaders/contractor-daily-logs-page";
import type {
  DailyLogDetailFull,
  DailyLogListRow,
} from "@/domain/loaders/daily-logs";

// Inline icons — match the spec's icon inventory. See
// docs/specs/builtcrm_contractor_daily_logs.jsx for provenance.
const I = {
  plus: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  file: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  cloud: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  users: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  camera: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  edit: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  grid: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  list: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

type ViewMode = "calendar" | "list";
type DrawerState = null | { kind: "detail"; logId: string } | { kind: "create" };

export function ContractorDailyLogsWorkspace({
  view,
}: {
  view: ContractorDailyLogsPageView;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  // Calendar month cursor — anchored to the month of `view.today`.
  const [monthCursor, setMonthCursor] = useState(() => view.today.slice(0, 7));

  const todayLog = useMemo(
    () => view.monthLogs.find((l) => l.logDate === view.today),
    [view.monthLogs, view.today],
  );

  const calendarDays = useMemo(
    () => buildMonthGrid(monthCursor, view.monthLogs, view.today),
    [monthCursor, view.monthLogs, view.today],
  );

  const kpis = view.kpis;

  const onCreate = () => setDrawer({ kind: "create" });
  const onOpenDetail = (logId: string) => setDrawer({ kind: "detail", logId });

  return (
    <div className="dl-root">
      <style>{DAILY_LOG_CSS}</style>

      <div className="dl-page-h">
        <div>
          <h1 className="dl-page-t">Daily Logs</h1>
          <p className="dl-page-sub">
            Record of on-site conditions, crew, and work performed for{" "}
            {view.project.name}.
          </p>
        </div>
        <div className="dl-page-acts">
          <button className="dl-btn pri" onClick={onCreate}>
            {I.plus} New Log
          </button>
        </div>
      </div>

      <div className="dl-today-banner">
        <div className="dl-tb-left">
          <div className="dl-tb-icon">{I.cloud}</div>
          <div className="dl-tb-info">
            <h3>
              {formatDateLong(view.today)} —{" "}
              {todayLog ? "logged" : "not yet logged"}
            </h3>
            <div className="dl-tb-status">
              {todayLog ? (
                <>
                  <span>
                    {todayLog.weather.conditions
                      ? prettyConditions(todayLog.weather.conditions)
                      : "Weather not recorded"}
                  </span>
                  <span className="dl-dot" />
                  <span>{todayLog.crewCount} orgs on site</span>
                </>
              ) : (
                <>
                  <span>Weather + crew fill in when you log today.</span>
                  <span className="dl-dot" />
                  <span>Log by 6 PM for no-amendment window</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!todayLog && (
          <button className="dl-btn pri" onClick={onCreate}>
            {I.plus} Create today&apos;s log
          </button>
        )}
      </div>

      <section className="dl-kpi-strip">
        <Kpi
          label="Logs this week"
          value={String(kpis.logsThisWeek)}
          meta={`Of ${kpis.workDaysThisWeek} work days`}
          metaType={kpis.logsThisWeek >= kpis.workDaysThisWeek ? "ok" : "warn"}
        />
        <Kpi
          label="Delay hours"
          value={formatNumber(kpis.delayHoursLast30)}
          meta={`${kpis.delayCountLast30} delays · 30 days`}
          metaType={kpis.delayHoursLast30 > 0 ? "warn" : "ok"}
        />
        <Kpi
          label="Missing logs"
          value={String(kpis.missingLogsLast30)}
          meta="Last 30 days"
          metaType={kpis.missingLogsLast30 === 0 ? "ok" : "warn"}
        />
        <Kpi
          label="Photos captured"
          value={String(kpis.photosThisWeek)}
          meta="This week"
        />
        <Kpi
          label="Pending amend."
          value={String(kpis.pendingAmendments)}
          meta="Requires approval"
          metaType={kpis.pendingAmendments > 0 ? "warn" : undefined}
          alert={kpis.pendingAmendments > 0}
        />
      </section>

      <section className="dl-dash">
        <div className="dl-dash-main">
          <div className="dl-cd">
            <div className="dl-cd-h">
              <div>
                <div className="dl-cd-title">Log history</div>
                <div className="dl-cd-sub">Tap any day to view or create its log</div>
              </div>
              <div className="dl-vt">
                <button
                  className={`dl-vt-btn${viewMode === "calendar" ? " on" : ""}`}
                  onClick={() => setViewMode("calendar")}
                >
                  {I.grid} Calendar
                </button>
                <button
                  className={`dl-vt-btn${viewMode === "list" ? " on" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  {I.list} List
                </button>
              </div>
            </div>
            <div className="dl-cd-body">
              {viewMode === "calendar" ? (
                <CalendarGrid
                  monthCursor={monthCursor}
                  onChangeCursor={setMonthCursor}
                  days={calendarDays}
                  onOpenLog={onOpenDetail}
                />
              ) : (
                <LogList logs={view.monthLogs} onOpenLog={onOpenDetail} />
              )}
            </div>
          </div>

          {viewMode === "calendar" && view.recentLogs.length > 0 && (
            <div className="dl-cd">
              <div className="dl-cd-h">
                <div>
                  <div className="dl-cd-title">Recent logs</div>
                  <div className="dl-cd-sub">
                    Last {view.recentLogs.length} entries · click to view
                  </div>
                </div>
                <button
                  className="dl-btn ghost sm"
                  onClick={() => setViewMode("list")}
                >
                  View all
                </button>
              </div>
              <div className="dl-cd-body">
                <LogList logs={view.recentLogs} onOpenLog={onOpenDetail} dense />
              </div>
            </div>
          )}
        </div>

        <div className="dl-dash-rail">
          <div className="dl-cd">
            <div className="dl-cd-h">
              <div>
                <div className="dl-cd-title">Today at a glance</div>
                <div className="dl-cd-sub">
                  {todayLog
                    ? "Logged — review or update"
                    : "Fill when you log today"}
                </div>
              </div>
            </div>
            <div className="dl-cd-body" style={{ paddingTop: 4 }}>
              {todayLog ? (
                <>
                  <MiniRow label="Weather" value={weatherLabel(todayLog)} />
                  <MiniRow
                    label="Crew orgs"
                    value={`${todayLog.crewCount}`}
                  />
                  <MiniRow
                    label="Total crew-hours"
                    value={formatNumber(todayLog.totalCrewHours)}
                    mono
                  />
                  <MiniRow label="Photos" value={`${todayLog.photoCount}`} mono />
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="dl-btn sm full"
                      onClick={() => onOpenDetail(todayLog.id)}
                    >
                      Open today&apos;s log
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 4 }}>
                  <button className="dl-btn pri sm full" onClick={onCreate}>
                    {I.plus} Log today
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="dl-cd">
            <div className="dl-cd-h">
              <div>
                <div className="dl-cd-title">This week</div>
              </div>
            </div>
            <div className="dl-cd-body" style={{ paddingTop: 8 }}>
              <MiniRow
                label="Logs submitted"
                value={`${view.weekSummary.logsSubmitted} / ${view.weekSummary.workDays}`}
              />
              <MiniRow
                label="Total crew-hours"
                value={formatNumber(view.weekSummary.totalCrewHours)}
                mono
              />
              <MiniRow
                label="Delay events"
                value={String(view.weekSummary.delayHours)}
                mono
              />
              <MiniRow
                label="Photos captured"
                value={String(view.weekSummary.photos)}
                mono
              />
            </div>
          </div>

          {view.amendments.length > 0 && (
            <div className="dl-cd">
              <div className="dl-cd-h">
                <div>
                  <div className="dl-cd-title">Recent amendments</div>
                  <div className="dl-cd-sub">Post-24hr edits</div>
                </div>
              </div>
              <div className="dl-cd-body" style={{ paddingTop: 8 }}>
                {view.amendments.map((a) => (
                  <div
                    key={a.id}
                    className="dl-amd-row"
                    onClick={() => onOpenDetail(a.dailyLogId)}
                  >
                    <h5>{formatDateShort(a.logDate)}</h5>
                    <p>{a.changeSummary}</p>
                    <div className="dl-amd-meta">
                      <span
                        className={`dl-pl ${
                          a.status === "pending"
                            ? "amber"
                            : a.status === "approved"
                              ? "green"
                              : "gray"
                        }`}
                      >
                        {a.status === "pending"
                          ? "Pending review"
                          : a.status === "approved"
                            ? "Approved"
                            : "Rejected"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--t3)" }}>
                        {relTime(a.requestedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {drawer?.kind === "create" && (
        <CreateLogDrawer
          projectId={view.project.id}
          logDate={view.today}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            router.refresh();
          }}
        />
      )}

      {drawer?.kind === "detail" && (
        <DetailPlaceholderDrawer
          projectId={view.project.id}
          logId={drawer.logId}
          onClose={() => setDrawer(null)}
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
    <div className={`dl-kpi${alert ? " alert" : ""}`}>
      <div className="dl-kpi-label">{label}</div>
      <div className="dl-kpi-val">{value}</div>
      <div className="dl-kpi-meta">
        {metaType ? (
          <span className={`dl-kpi-trend ${metaType}`}>{meta}</span>
        ) : (
          meta
        )}
      </div>
    </div>
  );
}

function MiniRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="dl-mini-row">
      <span className="mr-l">{label}</span>
      <span className={`mr-r${mono ? " mono" : ""}`}>{value}</span>
    </div>
  );
}

type CalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  state: "logged" | "missed" | "weekend" | "future" | "today" | "today-logged";
  logId: string | null;
};

function CalendarGrid({
  monthCursor,
  onChangeCursor,
  days,
  onOpenLog,
}: {
  monthCursor: string;
  onChangeCursor: (next: string) => void;
  days: CalendarCell[];
  onOpenLog: (logId: string) => void;
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

  return (
    <>
      <div className="dl-cal-head">
        <div className="dl-cal-nav">
          <button
            className="dl-cal-arrow"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="dl-cal-month">{monthLabel}</div>
          <button
            className="dl-cal-arrow"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="dl-cal-legend">
          <span>
            <span
              className="sw"
              style={{
                background: "var(--dl-ok-s)",
                border: "1px solid rgba(45,138,94,.3)",
              }}
            />
            Logged
          </span>
          <span>
            <span
              className="sw"
              style={{
                background: "var(--dl-dg-s)",
                border: "1px solid rgba(201,59,59,.3)",
              }}
            />
            Missed
          </span>
          <span>
            <span className="sw" style={{ background: "var(--dl-s2)" }} />
            Non-work
          </span>
          <span>
            <span
              className="sw"
              style={{
                background: "var(--dl-ac-s)",
                border: "1.5px solid var(--dl-ac)",
              }}
            />
            Today
          </span>
        </div>
      </div>
      <div className="dl-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="dl-cal-dow">
            {d}
          </div>
        ))}
        {days.map((c) => {
          const cls = !c.inMonth
            ? "prev"
            : c.state === "weekend"
              ? "weekend"
              : c.state === "logged"
                ? "logged"
                : c.state === "missed"
                  ? "missed"
                  : c.state === "today-logged"
                    ? "logged today-outline"
                    : c.state === "today"
                      ? "today"
                      : "future";
          const foot =
            c.state === "logged" || c.state === "today-logged"
              ? "Logged"
              : c.state === "missed"
                ? "Missed"
                : c.state === "today"
                  ? "Today"
                  : "";
          const clickable =
            (c.state === "logged" || c.state === "today-logged") && c.logId;
          return (
            <div
              key={c.key}
              className={`dl-cal-day ${cls}`}
              onClick={() => clickable && c.logId && onOpenLog(c.logId)}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              onKeyDown={(e) => {
                if (
                  clickable &&
                  c.logId &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  onOpenLog(c.logId);
                }
              }}
            >
              <span className="d-num">{c.day}</span>
              <span className="d-foot">{foot}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function LogList({
  logs,
  onOpenLog,
  dense = false,
}: {
  logs: DailyLogListRow[];
  onOpenLog: (id: string) => void;
  dense?: boolean;
}) {
  if (logs.length === 0) {
    return <p className="dl-empty">No logs in this range yet.</p>;
  }
  return (
    <div style={{ margin: "-4px 0" }}>
      {logs.map((log) => (
        <div
          key={log.id}
          className="dl-log-row"
          onClick={() => onOpenLog(log.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenLog(log.id);
            }
          }}
        >
          <div className="dl-log-date">
            {dense ? formatDateShort(log.logDate) : formatDateLong(log.logDate)}
            <span className="dl-log-id">
              {new Date(log.logDate + "T00:00:00Z").toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              })}
            </span>
          </div>
          <div className="dl-log-body">
            <h5>
              {log.clientSummary?.split(".")[0]?.trim() ||
                log.notes?.split(".")[0]?.trim() ||
                "Daily log"}
              .
            </h5>
            {!dense && (log.clientSummary || log.notes) && (
              <p>{log.clientSummary || log.notes}</p>
            )}
            <div className="dl-log-meta-row">
              <span className="dl-log-mi">
                {I.cloud} {weatherLabel(log)}
              </span>
              <span className="dl-log-mi">
                {I.users} {log.totalCrewHeadcount} crew · {log.crewCount} orgs
              </span>
              {log.delayCount > 0 && (
                <span className="dl-pl amber">
                  {I.alert} {log.delayCount} delay
                  {log.delayCount === 1 ? "" : "s"}
                </span>
              )}
              <span className="dl-log-mi">
                {I.camera} {log.photoCount} photos
              </span>
              {log.hasAmendments && (
                <span className="dl-pl gray">
                  {I.edit} Amended
                </span>
              )}
            </div>
          </div>
          <div className="dl-log-author">
            {log.reportedByName ?? "—"}
            {isWithinWindow(log.editWindowClosesAt) && (
              <div className="ed-win">
                {I.clock} {hoursLeft(log.editWindowClosesAt)}h edit
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Drawers ─────────────────────────────────────────────────────

function CreateLogDrawer({
  projectId,
  logDate,
  onClose,
  onSaved,
}: {
  projectId: string;
  logDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [clientSummary, setClientSummary] = useState("");
  const [weather, setWeather] = useState<{
    conditions: string;
    highC: number | "";
    lowC: number | "";
    precipPct: number | "";
    windKmh: number | "";
    source: "manual" | "api";
  }>({
    conditions: "partly_cloudy",
    highC: "",
    lowC: "",
    precipPct: "",
    windKmh: "",
    source: "manual",
  });
  const [prefillStatus, setPrefillStatus] = useState<
    "idle" | "loading" | "loaded" | "unavailable"
  >("idle");

  const autofillWeather = async () => {
    setPrefillStatus("loading");
    try {
      const res = await fetch(
        `/api/daily-logs/weather-prefill?projectId=${projectId}&date=${logDate}`,
      );
      if (!res.ok) {
        setPrefillStatus("unavailable");
        return;
      }
      const data = (await res.json()) as {
        weather: {
          conditions: string;
          highC: number | null;
          lowC: number | null;
          precipPct: number | null;
          windKmh: number | null;
          source: "manual" | "api";
        };
      };
      setWeather({
        conditions: data.weather.conditions,
        highC: data.weather.highC ?? "",
        lowC: data.weather.lowC ?? "",
        precipPct: data.weather.precipPct ?? "",
        windKmh: data.weather.windKmh ?? "",
        source: "api",
      });
      setPrefillStatus("loaded");
    } catch {
      setPrefillStatus("unavailable");
    }
  };

  const submit = async (intent: "draft" | "submit") => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          logDate,
          intent,
          weather: {
            conditions: weather.conditions,
            highC: weather.highC === "" ? null : Number(weather.highC),
            lowC: weather.lowC === "" ? null : Number(weather.lowC),
            precipPct:
              weather.precipPct === "" ? null : Number(weather.precipPct),
            windKmh: weather.windKmh === "" ? null : Number(weather.windKmh),
            source: weather.source,
            capturedAt:
              weather.source === "api" ? new Date().toISOString() : null,
          },
          notes: notes || null,
          clientSummary: clientSummary || null,
          delays: [],
          issues: [],
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(data.message ?? data.error ?? "Failed to save");
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dl-drawer-ovl" onClick={onClose} />
      <aside className="dl-drawer" role="dialog" aria-modal="true">
        <div className="dl-dr-head">
          <div className="dl-dr-head-l">
            <h2>New daily log</h2>
            <div className="dl-dh-meta">
              <span>{formatDateLong(logDate)}</span>
            </div>
          </div>
          <button className="dl-dr-close" onClick={onClose} aria-label="Close">
            {I.x}
          </button>
        </div>
        <div className="dl-dr-body">
          <div className="dl-sec">
            <div className="dl-sec-h">
              {I.cloud} Weather
              {prefillStatus === "loaded" && (
                <span className="dl-pl blue" style={{ marginLeft: 10 }}>
                  Auto-filled · Open-Meteo
                </span>
              )}
            </div>
            <div className="dl-form-grid">
              <div className="dl-field">
                <label>Conditions</label>
                <select
                  value={weather.conditions}
                  onChange={(e) =>
                    setWeather((p) => ({
                      ...p,
                      conditions: e.target.value,
                      source: "manual",
                    }))
                  }
                >
                  <option value="clear">Clear</option>
                  <option value="partly_cloudy">Partly cloudy</option>
                  <option value="overcast">Overcast</option>
                  <option value="light_rain">Light rain</option>
                  <option value="heavy_rain">Heavy rain</option>
                  <option value="snow">Snow</option>
                </select>
              </div>
              <div className="dl-field">
                <label>Precipitation %</label>
                <input
                  type="number"
                  value={weather.precipPct}
                  onChange={(e) =>
                    setWeather((p) => ({
                      ...p,
                      precipPct: e.target.value === "" ? "" : Number(e.target.value),
                      source: "manual",
                    }))
                  }
                />
              </div>
              <div className="dl-field">
                <label>High (°C)</label>
                <input
                  type="number"
                  value={weather.highC}
                  onChange={(e) =>
                    setWeather((p) => ({
                      ...p,
                      highC: e.target.value === "" ? "" : Number(e.target.value),
                      source: "manual",
                    }))
                  }
                />
              </div>
              <div className="dl-field">
                <label>Low (°C)</label>
                <input
                  type="number"
                  value={weather.lowC}
                  onChange={(e) =>
                    setWeather((p) => ({
                      ...p,
                      lowC: e.target.value === "" ? "" : Number(e.target.value),
                      source: "manual",
                    }))
                  }
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="dl-btn sm"
                onClick={autofillWeather}
                disabled={prefillStatus === "loading"}
              >
                {prefillStatus === "loading"
                  ? "Fetching…"
                  : "Autofill from weather service"}
              </button>
              {prefillStatus === "unavailable" && (
                <span
                  style={{
                    fontSize: 11.5,
                    marginLeft: 10,
                    color: "var(--dl-t3)",
                  }}
                >
                  Couldn&apos;t reach weather service. Fill manually.
                </span>
              )}
            </div>
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">{I.edit} Work performed (contractor notes)</div>
            <div className="dl-field">
              <textarea
                rows={6}
                placeholder="What was accomplished today. Scope completed, areas worked, materials delivered, coordination items…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">{I.edit} Client-facing summary</div>
            <p
              style={{
                fontSize: 12,
                color: "var(--dl-t2)",
                marginBottom: 8,
              }}
            >
              Shown to client portals. Keep high-level — no crew hours or
              financials.
            </p>
            <div className="dl-field">
              <textarea
                rows={4}
                placeholder="One paragraph the client can read. Leave blank to hide from client view."
                value={clientSummary}
                onChange={(e) => setClientSummary(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div
              className="dl-pl red"
              style={{
                marginTop: 12,
                height: "auto",
                padding: "8px 10px",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>
        <div className="dl-dr-foot">
          <button className="dl-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="dl-btn"
              onClick={() => submit("draft")}
              disabled={submitting}
            >
              Save draft
            </button>
            <button
              className="dl-btn pri"
              onClick={() => submit("submit")}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Submit log"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DetailPlaceholderDrawer({
  projectId,
  logId,
  onClose,
}: {
  projectId: string;
  logId: string;
  onClose: () => void;
}) {
  // Fetches the full log via the role-aware GET endpoint and renders
  // every section — weather grid, crew table (with reconciliation
  // deltas), notes, client-facing copy, delays/issues, photos, audit —
  // inline in the drawer. Same content as the full detail page but in
  // the side panel so the user doesn't lose calendar context.
  const [log, setLog] = useState<DailyLogDetailFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/daily-logs/${logId}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          if (!cancelled)
            setError(data.message ?? `Failed to load (${res.status})`);
          return;
        }
        const data = (await res.json()) as DailyLogDetailFull;
        if (!cancelled) setLog(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logId]);

  const editable = log && isWithinWindow(log.editWindowClosesAt);
  const totalHeadcount = log?.crew.reduce((a, c) => a + c.headcount, 0) ?? 0;
  const totalHours = log?.crew.reduce((a, c) => a + c.hours, 0) ?? 0;

  return (
    <>
      <div className="dl-drawer-ovl" onClick={onClose} />
      <aside className="dl-drawer" role="dialog" aria-modal="true">
        <div className="dl-dr-head">
          <div className="dl-dr-head-l">
            <h2>{log ? formatDateLong(log.logDate) : "Daily log"}</h2>
            <div className="dl-dh-meta">
              <span className="mono">{logId.slice(0, 8)}</span>
              {log && (
                <>
                  <span>·</span>
                  <span>Reported by {log.reportedByName ?? "—"}</span>
                  <span
                    className={`dl-pl ${log.status === "submitted" ? "green" : "amber"}`}
                  >
                    {log.status === "submitted" ? "Submitted" : "Draft"}
                  </span>
                  {editable && (
                    <span className="dl-pl amber">
                      {I.clock} {hoursLeft(log.editWindowClosesAt)}h edit window
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <button className="dl-dr-close" onClick={onClose} aria-label="Close">
            {I.x}
          </button>
        </div>
        <div className="dl-dr-body">
          {error && (
            <p
              className="dl-pl red"
              style={{ height: "auto", padding: "8px 10px" }}
            >
              {error}
            </p>
          )}
          {!log && !error && (
            <p style={{ fontSize: 13, color: "var(--dl-t2)" }}>Loading…</p>
          )}
          {log && (
            <>
              <div className="dl-sec">
                <div className="dl-sec-h">{I.cloud} Weather</div>
                <div className="dl-wx-grid">
                  <DrawerWxCell
                    label="Conditions"
                    value={
                      log.weather.conditions
                        ? prettyConditions(log.weather.conditions)
                        : "—"
                    }
                  />
                  <DrawerWxCell
                    label="High"
                    value={
                      log.weather.highC != null
                        ? `${log.weather.highC}°C`
                        : "—"
                    }
                  />
                  <DrawerWxCell
                    label="Low"
                    value={
                      log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"
                    }
                  />
                  <DrawerWxCell
                    label="Precip"
                    value={
                      log.weather.precipPct != null
                        ? `${log.weather.precipPct}%`
                        : "—"
                    }
                  />
                  <DrawerWxCell
                    label="Wind"
                    value={
                      log.weather.windKmh != null
                        ? `${log.weather.windKmh} km/h`
                        : "—"
                    }
                  />
                </div>
                {log.weather.source === "api" && (
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--dl-t3)",
                      marginTop: 8,
                    }}
                  >
                    Auto-filled from weather service
                  </p>
                )}
              </div>

              <div className="dl-sec">
                <div className="dl-sec-h">{I.users} Crew on site</div>
                {log.crew.length === 0 ? (
                  <p className="dl-empty">No crew entries for this log.</p>
                ) : (
                  <table className="dl-crew-tbl">
                    <thead>
                      <tr>
                        <th>Org</th>
                        <th>Trade</th>
                        <th>Headcount</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.crew.map((c) => (
                        <tr key={c.id}>
                          <td className="org">{c.orgName}</td>
                          <td className="trade">{c.trade ?? "—"}</td>
                          <td className="num">
                            {c.reconciledHeadcount ?? c.headcount}
                          </td>
                          <td className="num">
                            {c.reconciledHours ?? c.hours}
                          </td>
                        </tr>
                      ))}
                      <tr className="total">
                        <td colSpan={2}>Total</td>
                        <td className="num">{totalHeadcount}</td>
                        <td className="num">{totalHours.toFixed(1)} hrs</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {log.notes && (
                <div className="dl-sec">
                  <div className="dl-sec-h">{I.edit} Work performed</div>
                  <div className="dl-notes-body">{log.notes}</div>
                </div>
              )}

              {(log.delays.length > 0 || log.issues.length > 0) && (
                <div className="dl-sec">
                  <div className="dl-sec-h">{I.alert} Delays &amp; issues</div>
                  {log.delays.map((d) => (
                    <div key={d.id} className="dl-issue-row">
                      <span className="ir-ic">{I.alert}</span>
                      <div>
                        <h6>
                          {prettyConditions(d.delayType)} · {d.hoursLost}h lost
                        </h6>
                        <p>{d.description}</p>
                      </div>
                    </div>
                  ))}
                  {log.issues.map((i) => (
                    <div
                      key={i.id}
                      className="dl-issue-row"
                      style={{
                        background: "var(--dl-dg-s)",
                        borderColor: "rgba(201,59,59,.2)",
                      }}
                    >
                      <span className="ir-ic">{I.alert}</span>
                      <div>
                        <h6>{prettyConditions(i.issueType)}</h6>
                        <p>{i.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {log.photos.length > 0 && (
                <div className="dl-sec">
                  <div className="dl-sec-h">
                    {I.camera} Photos ({log.photos.length})
                  </div>
                  <div className="dl-ph-grid-drawer">
                    {log.photos.map((p) => (
                      <div key={p.id} className="dl-ph-tile-drawer">
                        {p.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.url}
                            alt={p.caption ?? p.title}
                            className="dl-ph-img"
                            loading="lazy"
                          />
                        ) : (
                          <span className="dl-ph-fallback">{p.title}</span>
                        )}
                        {p.isHero && (
                          <span
                            className="dl-pl blue"
                            style={{ position: "absolute", top: 6, right: 6 }}
                          >
                            Hero
                          </span>
                        )}
                        {p.caption && (
                          <div className="dl-ph-cap">{p.caption}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.amendments.length > 0 && (
                <div className="dl-sec">
                  <div className="dl-sec-h">{I.edit} Amendments</div>
                  {log.amendments.map((a) => (
                    <div key={a.id} className="dl-amd-row">
                      <h5>{a.changeSummary}</h5>
                      <div className="dl-amd-meta">
                        <span
                          className={`dl-pl ${
                            a.status === "pending"
                              ? "amber"
                              : a.status === "approved"
                                ? "green"
                                : "gray"
                          }`}
                        >
                          {prettyConditions(a.status)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--dl-t3)" }}>
                          {a.requestedByName ?? "—"} ·{" "}
                          {new Date(a.requestedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="dl-dr-foot">
          <button className="dl-btn ghost" onClick={onClose}>
            Close
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              className="dl-btn"
              href={`/api/daily-logs/${logId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {I.file} Download PDF
            </a>
            <a
              className="dl-btn pri"
              href={`/contractor/project/${projectId}/daily-logs/${logId}`}
            >
              Open full page
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerWxCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="dl-wx-cell">
      <div className="wxl">{label}</div>
      <div className="wxv">{value}</div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function buildMonthGrid(
  monthCursor: string,
  logs: DailyLogListRow[],
  today: string,
): CalendarCell[] {
  const [y, m] = monthCursor.split("-").map((s) => parseInt(s, 10));
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const startDow = firstDay.getUTCDay(); // 0-6 (Sun)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const prevMonthDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];

  // Leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({
      key: `prev-${day}`,
      day,
      inMonth: false,
      state: "future",
      logId: null,
    });
  }

  const logByDate = new Map(logs.map((l) => [l.logDate, l]));

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const log = logByDate.get(iso);
    const isToday = iso === today;
    const isPast = iso < today;
    const isWeekend = dow === 0 || dow === 6;

    let state: CalendarCell["state"];
    let logId: string | null = null;
    if (log) {
      logId = log.id;
      state = isToday ? "today-logged" : "logged";
    } else if (isToday) {
      state = "today";
    } else if (isWeekend) {
      state = "weekend";
    } else if (isPast) {
      state = "missed";
    } else {
      state = "future";
    }
    cells.push({ key: iso, day: d, inMonth: true, state, logId });
  }

  // Trailing days to complete the final week row
  while (cells.length % 7 !== 0) {
    const offset = cells.length - (startDow + daysInMonth);
    cells.push({
      key: `next-${offset}`,
      day: offset + 1,
      inMonth: false,
      state: "future",
      logId: null,
    });
  }

  return cells;
}

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
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function prettyConditions(c: string): string {
  return c
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function weatherLabel(log: DailyLogListRow): string {
  const c = log.weather.conditions;
  const temp =
    log.weather.highC != null && log.weather.lowC != null
      ? ` · ${log.weather.highC}°/${log.weather.lowC}°`
      : log.weather.highC != null
        ? ` · ${log.weather.highC}°`
        : "";
  return c ? `${prettyConditions(c)}${temp}` : "Weather not recorded";
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function isWithinWindow(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function hoursLeft(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (60 * 60 * 1000)));
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── CSS — adapted from docs/specs/builtcrm_contractor_daily_logs.jsx,
// stripped of the sidebar/topbar/brand styles since AppShell already
// renders those. Class names prefixed with dl- to avoid collisions
// with other workspaces.
const DAILY_LOG_CSS = `
.dl-root{
  --dl-s0:#eef0f3;--dl-s1:#fff;--dl-s2:#f3f4f6;--dl-s3:#e2e5e9;--dl-s4:#d1d5db;
  --dl-sh:#f5f6f8;--dl-sic:#f8f9fa;
  --dl-t1:#1a1714;--dl-t2:#6b655b;--dl-t3:#9c958a;--dl-ti:#faf9f7;
  --dl-ac:#5b4fc7;--dl-ac-h:#4a3fb0;--dl-ac-s:#ece9fb;--dl-ac-t:#4337a0;--dl-ac-m:#c5bef0;
  --dl-ok:#2d8a5e;--dl-ok-s:#edf7f1;--dl-ok-t:#1e6b46;
  --dl-wr:#c17a1a;--dl-wr-s:#fdf4e6;--dl-wr-t:#96600f;
  --dl-dg:#c93b3b;--dl-dg-s:#fdeaea;--dl-dg-t:#a52e2e;
  --dl-fd:'DM Sans',system-ui,sans-serif;
  --dl-fb:'Instrument Sans',system-ui,sans-serif;
  --dl-fm:'JetBrains Mono',monospace;
  font-family:var(--dl-fb);color:var(--dl-t1);line-height:1.5;font-size:14px;padding:24px;
}
.dl-root *{box-sizing:border-box}
.dl-page-h{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px}
.dl-page-t{font-family:var(--dl-fd);font-size:26px;font-weight:820;letter-spacing:-.03em;line-height:1.15;margin:0}
.dl-page-sub{margin-top:6px;font-size:14px;font-weight:520;color:var(--dl-t2);max-width:640px}
.dl-page-acts{display:flex;gap:8px;flex-shrink:0;padding-top:2px}

.dl-btn{height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--dl-s3);background:var(--dl-s1);color:var(--dl-t1);font-size:13px;font-weight:650;font-family:var(--dl-fb);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;text-decoration:none}
.dl-btn:hover{background:var(--dl-sh);border-color:var(--dl-s4)}
.dl-btn:disabled{opacity:.55;cursor:not-allowed}
.dl-btn.pri{background:var(--dl-ac);color:var(--dl-ti);border-color:var(--dl-ac)}
.dl-btn.pri:hover{background:var(--dl-ac-h)}
.dl-btn.sm{height:32px;font-size:12px;padding:0 12px}
.dl-btn.ghost{background:transparent;border-color:transparent;color:var(--dl-t2);font-weight:560}
.dl-btn.ghost:hover{background:var(--dl-sh);color:var(--dl-t1)}
.dl-btn.full{width:100%;justify-content:center}
.dl-btn svg{width:15px;height:15px;flex-shrink:0}

.dl-pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--dl-fd)}
.dl-pl.red{background:var(--dl-dg-s);color:var(--dl-dg-t)}
.dl-pl.amber{background:var(--dl-wr-s);color:var(--dl-wr-t)}
.dl-pl.green{background:var(--dl-ok-s);color:var(--dl-ok-t)}
.dl-pl.blue{background:var(--dl-ac-s);color:var(--dl-ac-t)}
.dl-pl.gray{background:var(--dl-s2);color:var(--dl-t2)}
.dl-pl svg{width:11px;height:11px}

.dl-today-banner{background:linear-gradient(135deg,var(--dl-ac-s),var(--dl-s1));border:1.5px solid var(--dl-ac-m);border-radius:18px;padding:18px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.dl-tb-left{display:flex;align-items:center;gap:16px;flex:1;min-width:0}
.dl-tb-icon{width:44px;height:44px;border-radius:10px;background:var(--dl-s1);color:var(--dl-ac);display:grid;place-items:center;flex-shrink:0;border:1px solid var(--dl-ac-m)}
.dl-tb-icon svg{width:22px;height:22px}
.dl-tb-info h3{font-family:var(--dl-fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0}
.dl-tb-status{font-size:12.5px;color:var(--dl-t2);margin-top:3px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dl-dot{width:4px;height:4px;border-radius:50%;background:var(--dl-t3)}

.dl-kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.dl-kpi{background:var(--dl-s1);border:1px solid var(--dl-s3);border-radius:14px;padding:16px}
.dl-kpi.alert{border-color:var(--dl-wr);border-width:1.5px}
.dl-kpi-label{font-family:var(--dl-fd);font-size:11.5px;font-weight:700;color:var(--dl-t1);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.dl-kpi-val{font-family:var(--dl-fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.dl-kpi-meta{font-family:var(--dl-fb);font-size:12px;font-weight:580;color:var(--dl-t2);margin-top:4px}
.dl-kpi-trend{font-weight:720;font-size:11.5px}
.dl-kpi-trend.warn{color:var(--dl-wr-t)}
.dl-kpi-trend.ok{color:var(--dl-ok-t)}
.dl-kpi-trend.danger{color:var(--dl-dg-t)}

.dl-dash{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}
.dl-dash-main{display:flex;flex-direction:column;gap:16px}
.dl-dash-rail{display:flex;flex-direction:column;gap:16px}
.dl-cd{background:var(--dl-s1);border:1px solid var(--dl-s3);border-radius:18px;overflow:hidden}
.dl-cd-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--dl-s3);gap:12px}
.dl-cd-title{font-family:var(--dl-fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.dl-cd-sub{font-family:var(--dl-fb);font-size:12.5px;font-weight:540;color:var(--dl-t2);margin-top:2px}
.dl-cd-body{padding:16px 20px}

.dl-vt{display:inline-flex;background:var(--dl-s2);border-radius:10px;padding:3px;gap:2px}
.dl-vt-btn{height:28px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:600;color:var(--dl-t2);background:transparent;border:none;cursor:pointer;font-family:var(--dl-fb);display:inline-flex;align-items:center;gap:5px}
.dl-vt-btn.on{background:var(--dl-s1);color:var(--dl-t1);font-weight:700;box-shadow:0 1px 3px rgba(26,23,20,.05)}

.dl-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 4px}
.dl-cal-nav{display:flex;align-items:center;gap:8px}
.dl-cal-month{font-family:var(--dl-fd);font-size:17px;font-weight:740;letter-spacing:-.02em}
.dl-cal-arrow{width:28px;height:28px;border-radius:6px;border:1px solid var(--dl-s3);background:var(--dl-s1);color:var(--dl-t2);display:grid;place-items:center;cursor:pointer}
.dl-cal-arrow:hover{background:var(--dl-sh);color:var(--dl-t1)}
.dl-cal-arrow svg{width:12px;height:12px}
.dl-cal-legend{display:flex;gap:14px;font-size:11.5px;color:var(--dl-t2);font-weight:550}
.dl-cal-legend span{display:inline-flex;align-items:center;gap:5px}
.dl-cal-legend .sw{width:10px;height:10px;border-radius:3px}

.dl-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.dl-cal-dow{font-family:var(--dl-fd);font-size:10.5px;font-weight:700;color:var(--dl-t3);text-transform:uppercase;letter-spacing:.06em;text-align:center;padding:4px 0;margin-bottom:2px}
.dl-cal-day{aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:8px 10px;transition:all 120ms cubic-bezier(.16,1,.3,1);border:1px solid transparent}
.dl-cal-day[role="button"]{cursor:pointer}
.dl-cal-day .d-num{font-family:var(--dl-fd);font-size:13px;font-weight:700}
.dl-cal-day .d-foot{font-size:10px;font-weight:600;letter-spacing:.02em}
.dl-cal-day.prev,.dl-cal-day.future{color:var(--dl-t3)}
.dl-cal-day.prev{opacity:.4}
.dl-cal-day.future{opacity:.6}
.dl-cal-day.weekend{background:var(--dl-s2);color:var(--dl-t3)}
.dl-cal-day.logged{background:var(--dl-ok-s);color:var(--dl-ok-t);border-color:rgba(45,138,94,.2)}
.dl-cal-day.logged:hover{border-color:var(--dl-ok)}
.dl-cal-day.missed{background:var(--dl-dg-s);color:var(--dl-dg-t);border-color:rgba(201,59,59,.2)}
.dl-cal-day.missed:hover{border-color:var(--dl-dg)}
.dl-cal-day.today{background:var(--dl-ac-s);color:var(--dl-ac-t);border:1.5px solid var(--dl-ac);font-weight:820}
.dl-cal-day.today-outline{border:1.5px solid var(--dl-ac)}

.dl-log-row{display:grid;grid-template-columns:110px 1fr auto;gap:16px;padding:14px 0;border-top:1px solid var(--dl-s3);cursor:pointer;align-items:start}
.dl-log-row:first-child{border-top:none}
.dl-log-row:hover{background:var(--dl-sic);margin:0 -20px;padding-left:20px;padding-right:20px}
.dl-log-date{font-family:var(--dl-fd);font-size:13px;font-weight:680;color:var(--dl-t1);line-height:1.3}
.dl-log-id{display:block;font-family:var(--dl-fm);font-size:10.5px;font-weight:500;color:var(--dl-t3);margin-top:3px}
.dl-log-body h5{font-family:var(--dl-fd);font-size:13.5px;font-weight:620;letter-spacing:-.005em;line-height:1.35;margin:0 0 4px}
.dl-log-body p{font-size:12.5px;color:var(--dl-t2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0}
.dl-log-meta-row{display:flex;align-items:center;gap:10px;margin-top:7px;flex-wrap:wrap}
.dl-log-mi{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--dl-t2);font-weight:570}
.dl-log-mi svg{color:var(--dl-t3)}
.dl-log-author{text-align:right;font-size:11.5px;color:var(--dl-t3);font-weight:560;white-space:nowrap}
.dl-log-author .ed-win{display:inline-flex;align-items:center;gap:3px;color:var(--dl-wr-t);font-weight:650;margin-top:4px;font-size:10.5px}

.dl-mini-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px;border-bottom:1px solid var(--dl-s3)}
.dl-mini-row:last-child{border-bottom:none}
.dl-mini-row .mr-l{color:var(--dl-t2);font-weight:540}
.dl-mini-row .mr-r{font-family:var(--dl-fd);font-weight:680}
.dl-mini-row .mr-r.mono{font-family:var(--dl-fm);font-weight:560}

.dl-amd-row{padding:10px 0;border-bottom:1px solid var(--dl-s3);cursor:pointer}
.dl-amd-row:last-child{border-bottom:none}
.dl-amd-row h5{font-family:var(--dl-fd);font-size:13px;font-weight:620;margin:0}
.dl-amd-row p{font-size:11.5px;color:var(--dl-t2);margin:2px 0 0;line-height:1.4}
.dl-amd-meta{display:flex;align-items:center;gap:8px;margin-top:6px}

.dl-drawer-ovl{position:fixed;inset:0;background:rgba(20,18,14,.4);backdrop-filter:blur(3px);z-index:100}
.dl-drawer{position:fixed;top:0;right:0;width:720px;max-width:100vw;height:100vh;background:var(--dl-s1);z-index:101;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(26,23,20,.14);border-left:1px solid var(--dl-s3);animation:dl-slide 280ms cubic-bezier(.16,1,.3,1)}
@keyframes dl-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}
.dl-dr-head{padding:16px 24px;border-bottom:1px solid var(--dl-s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-shrink:0}
.dl-dr-head-l h2{font-family:var(--dl-fd);font-size:20px;font-weight:780;letter-spacing:-.02em;line-height:1.2;margin:0}
.dl-dh-meta{font-size:12.5px;color:var(--dl-t2);margin-top:4px;display:flex;align-items:center;gap:8px}
.dl-dh-meta .mono{font-family:var(--dl-fm);font-size:11.5px}
.dl-dr-close{width:32px;height:32px;border-radius:10px;border:1px solid var(--dl-s3);background:var(--dl-s1);color:var(--dl-t2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.dl-dr-close:hover{background:var(--dl-sh);color:var(--dl-t1)}
.dl-dr-body{flex:1;overflow-y:auto;padding:20px 24px}
.dl-dr-foot{padding:14px 24px;border-top:1px solid var(--dl-s3);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-shrink:0;background:var(--dl-sic)}

.dl-sec{margin-bottom:22px}
.dl-sec-h{font-family:var(--dl-fd);font-size:11.5px;font-weight:720;color:var(--dl-t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.dl-sec-h svg{color:var(--dl-t3)}

.dl-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dl-field label{display:block;font-family:var(--dl-fd);font-size:11.5px;font-weight:680;color:var(--dl-t2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
.dl-field input,.dl-field select,.dl-field textarea{width:100%;border:1px solid var(--dl-s3);background:var(--dl-s1);border-radius:10px;padding:8px 12px;font-family:var(--dl-fb);font-size:13px;color:var(--dl-t1);outline:none}
.dl-field input:focus,.dl-field select:focus,.dl-field textarea:focus{border-color:var(--dl-ac);box-shadow:0 0 0 3px rgba(91,79,199,.15)}
.dl-field textarea{resize:vertical;line-height:1.5}

.dl-empty{font-size:13px;color:var(--dl-t2);padding:20px 0;text-align:center}

/* Detail drawer sections */
.dl-wx-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.dl-wx-cell{background:var(--dl-sic);border:1px solid var(--dl-s3);border-radius:10px;padding:10px 12px}
.dl-wx-cell .wxl{font-size:10.5px;color:var(--dl-t3);font-weight:620;text-transform:uppercase;letter-spacing:.04em}
.dl-wx-cell .wxv{font-family:var(--dl-fd);font-size:14px;font-weight:700;margin-top:3px}

.dl-crew-tbl{width:100%;border-collapse:collapse}
.dl-crew-tbl th{font-family:var(--dl-fd);font-size:11px;font-weight:700;color:var(--dl-t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:8px 12px;background:var(--dl-sic);border-bottom:1px solid var(--dl-s3)}
.dl-crew-tbl th:nth-child(3),.dl-crew-tbl th:nth-child(4),.dl-crew-tbl td.num{text-align:right}
.dl-crew-tbl td{padding:10px 12px;border-bottom:1px solid var(--dl-s3);font-size:13px}
.dl-crew-tbl tr:last-child td{border-bottom:none}
.dl-crew-tbl td.org{font-weight:600;font-family:var(--dl-fm);font-size:12.5px}
.dl-crew-tbl td.trade{color:var(--dl-t2);font-size:12px}
.dl-crew-tbl td.num{font-family:var(--dl-fd);font-weight:680}
.dl-crew-tbl tr.total td{background:var(--dl-sic);font-weight:740;border-bottom:none}

.dl-notes-body{font-size:13.5px;line-height:1.6;padding:12px 14px;background:var(--dl-sic);border-left:3px solid var(--dl-ac);border-radius:0 10px 10px 0;white-space:pre-wrap;color:var(--dl-t1)}

.dl-issue-row{display:flex;gap:10px;padding:10px 12px;background:var(--dl-wr-s);border:1px solid rgba(193,122,26,.2);border-radius:10px;margin-bottom:8px}
.dl-issue-row .ir-ic{color:var(--dl-wr-t);flex-shrink:0;margin-top:2px}
.dl-issue-row h6{font-family:var(--dl-fd);font-size:12.5px;font-weight:680;color:var(--dl-wr-t);margin:0 0 2px}
.dl-issue-row p{font-size:12.5px;color:var(--dl-t2);line-height:1.5;margin:0}

/* Drawer photo grid — four columns, square tiles with captions */
.dl-ph-grid-drawer{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.dl-ph-tile-drawer{aspect-ratio:1;background:linear-gradient(135deg,var(--dl-s2),var(--dl-s3));border-radius:10px;position:relative;overflow:hidden;display:grid;place-items:center;color:var(--dl-t3);border:1px solid var(--dl-s3)}
.dl-ph-img{width:100%;height:100%;object-fit:cover;display:block}
.dl-ph-fallback{font-size:10.5px;text-align:center;padding:8px}
.dl-ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(20,18,14,.7));color:white;font-size:10.5px;font-weight:570;line-height:1.2}

@media (max-width:960px){
  .dl-kpi-strip{grid-template-columns:repeat(2,1fr)}
  .dl-dash{grid-template-columns:1fr}
  .dl-drawer{width:100vw}
  .dl-wx-grid{grid-template-columns:repeat(2,1fr)}
  .dl-ph-grid-drawer{grid-template-columns:repeat(2,1fr)}
}
`;
