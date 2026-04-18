"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CommercialDailyLogsPageView } from "@/domain/loaders/commercial-daily-logs-page";
import type { DailyLogListRow } from "@/domain/loaders/daily-logs";

// Commercial client accent: blue (#3178b9). Read-only redacted view.
// No crew, no delays list, no amendments — `getDailyLogs` already
// zeroed those fields for the client role at the loader layer.

const I = {
  cloud: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
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
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  camera: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
};

type ViewMode = "calendar" | "list";

export function CommercialDailyLogsWorkspace({
  view,
}: {
  view: CommercialDailyLogsPageView;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selected, setSelected] = useState<DailyLogListRow | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => view.today.slice(0, 7));

  const calendarDays = useMemo(
    () => buildMonthGrid(monthCursor, view.monthLogs, view.today),
    [monthCursor, view.monthLogs, view.today],
  );

  const onOpen = (logId: string) => {
    const log = view.monthLogs.find((l) => l.id === logId);
    if (log) setSelected(log);
  };

  return (
    <div className="cdl-root">
      <style>{COMMERCIAL_CSS}</style>

      <header className="cdl-page-h">
        <div>
          <h1 className="cdl-page-t">Daily Logs</h1>
          <p className="cdl-page-sub">
            Your contractor&apos;s record of on-site activity, weather, and
            progress on {view.project.name}.
          </p>
        </div>
      </header>

      <section className="cdl-kpi-strip">
        <Kpi
          label="Recent updates"
          value={String(view.kpis.updatesThisWeek)}
          meta="This week"
        />
        <Kpi
          label="Milestones"
          value={String(view.kpis.milestonesThisMonth)}
          meta="This month"
          metaType={view.kpis.milestonesThisMonth > 0 ? "ok" : undefined}
        />
        <Kpi
          label="Weather days"
          value={String(view.kpis.weatherDays)}
          meta="Rain or snow"
          metaType={view.kpis.weatherDays > 0 ? "warn" : undefined}
        />
        <Kpi
          label="Photos"
          value={String(view.kpis.photosThisMonth)}
          meta="This month"
        />
      </section>

      <section className="cdl-cd">
        <div className="cdl-cd-h">
          <div>
            <div className="cdl-cd-title">Log history</div>
            <div className="cdl-cd-sub">
              Click a day to read the full update.
            </div>
          </div>
          <div className="cdl-vt">
            <button
              className={`cdl-vt-btn${viewMode === "calendar" ? " on" : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              {I.grid} Calendar
            </button>
            <button
              className={`cdl-vt-btn${viewMode === "list" ? " on" : ""}`}
              onClick={() => setViewMode("list")}
            >
              {I.list} List
            </button>
          </div>
        </div>
        <div className="cdl-cd-body">
          {viewMode === "calendar" ? (
            <CalendarGrid
              monthCursor={monthCursor}
              onChangeCursor={setMonthCursor}
              days={calendarDays}
              onOpen={onOpen}
            />
          ) : (
            <LogList logs={view.recentLogs} onOpen={onOpen} />
          )}
        </div>
      </section>

      {viewMode === "calendar" && view.recentLogs.length > 0 && (
        <section className="cdl-cd">
          <div className="cdl-cd-h">
            <div>
              <div className="cdl-cd-title">Recent updates</div>
              <div className="cdl-cd-sub">
                Last {view.recentLogs.length} days reported
              </div>
            </div>
            <button className="cdl-btn ghost sm" onClick={() => setViewMode("list")}>
              View all
            </button>
          </div>
          <div className="cdl-cd-body">
            <LogList logs={view.recentLogs.slice(0, 5)} onOpen={onOpen} dense />
          </div>
        </section>
      )}

      {selected && (
        <DetailDrawer
          projectId={view.project.id}
          log={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  meta,
  metaType,
}: {
  label: string;
  value: string;
  meta: string;
  metaType?: "ok" | "warn";
}) {
  return (
    <div className="cdl-kpi">
      <div className="cdl-kpi-label">{label}</div>
      <div className="cdl-kpi-val">{value}</div>
      <div className="cdl-kpi-meta">
        {metaType ? (
          <span className={`cdl-kpi-trend ${metaType}`}>{meta}</span>
        ) : (
          meta
        )}
      </div>
    </div>
  );
}

type CalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  state: "logged" | "missed" | "weekend" | "future" | "today";
  logId: string | null;
};

function CalendarGrid({
  monthCursor,
  onChangeCursor,
  days,
  onOpen,
}: {
  monthCursor: string;
  onChangeCursor: (next: string) => void;
  days: CalendarCell[];
  onOpen: (id: string) => void;
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
      <div className="cdl-cal-head">
        <div className="cdl-cal-nav">
          <button
            className="cdl-cal-arrow"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="cdl-cal-month">{monthLabel}</div>
          <button
            className="cdl-cal-arrow"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="cdl-cal-legend">
          <span>
            <span
              className="sw"
              style={{
                background: "var(--cdl-ok-s)",
                border: "1px solid rgba(45,138,94,.3)",
              }}
            />
            Update
          </span>
          <span>
            <span className="sw" style={{ background: "var(--cdl-s2)" }} />
            Non-work
          </span>
          <span>
            <span
              className="sw"
              style={{
                background: "var(--cdl-ac-s)",
                border: "1.5px solid var(--cdl-ac)",
              }}
            />
            Today
          </span>
        </div>
      </div>
      <div className="cdl-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="cdl-cal-dow">
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
                : c.state === "today"
                  ? "today"
                  : c.state === "missed"
                    ? "quiet"
                    : "future";
          const foot =
            c.state === "logged"
              ? "Update"
              : c.state === "today"
                ? "Today"
                : "";
          const clickable = c.state === "logged" && c.logId;
          return (
            <div
              key={c.key}
              className={`cdl-cal-day ${cls}`}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              onClick={() => clickable && c.logId && onOpen(c.logId)}
              onKeyDown={(e) => {
                if (
                  clickable &&
                  c.logId &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  onOpen(c.logId);
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
  onOpen,
  dense = false,
}: {
  logs: DailyLogListRow[];
  onOpen: (id: string) => void;
  dense?: boolean;
}) {
  if (logs.length === 0) {
    return <p className="cdl-empty">No updates posted yet.</p>;
  }
  return (
    <div style={{ margin: "-4px 0" }}>
      {logs.map((log) => (
        <div
          key={log.id}
          className="cdl-log-row"
          onClick={() => onOpen(log.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(log.id);
            }
          }}
        >
          <div className="cdl-log-date">
            {dense ? formatDateShort(log.logDate) : formatDateLong(log.logDate)}
          </div>
          <div className="cdl-log-body">
            <h5>
              {log.clientSummary?.split(".")[0]?.trim() ||
                log.milestone ||
                "Site update"}
              .
            </h5>
            {!dense && log.clientSummary && <p>{log.clientSummary}</p>}
            <div className="cdl-log-meta-row">
              <span className="cdl-log-mi">
                {I.cloud} {weatherLabel(log)}
              </span>
              {log.milestone && (
                <span
                  className={`cdl-pl ${
                    log.milestoneType === "warn"
                      ? "amber"
                      : log.milestoneType === "info"
                        ? "blue"
                        : "green"
                  }`}
                >
                  {log.milestone}
                </span>
              )}
              {log.photoCount > 0 && (
                <span className="cdl-log-mi">
                  {I.camera} {log.photoCount} photo
                  {log.photoCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailDrawer({
  projectId,
  log,
  onClose,
}: {
  projectId: string;
  log: DailyLogListRow;
  onClose: () => void;
}) {
  return (
    <>
      <div className="cdl-drawer-ovl" onClick={onClose} />
      <aside className="cdl-drawer" role="dialog" aria-modal="true">
        <div className="cdl-dr-head">
          <div className="cdl-dr-head-l">
            <h2>{formatDateLong(log.logDate)}</h2>
            {log.milestone && (
              <div className="cdl-dh-meta">
                <span
                  className={`cdl-pl ${
                    log.milestoneType === "warn"
                      ? "amber"
                      : log.milestoneType === "info"
                        ? "blue"
                        : "green"
                  }`}
                >
                  {log.milestone}
                </span>
              </div>
            )}
          </div>
          <button className="cdl-dr-close" onClick={onClose} aria-label="Close">
            {I.x}
          </button>
        </div>
        <div className="cdl-dr-body">
          <div className="cdl-sec">
            <div className="cdl-sec-h">Weather</div>
            <div className="cdl-wx-grid">
              <WxCell
                label="Conditions"
                value={
                  log.weather.conditions
                    ? pretty(log.weather.conditions)
                    : "—"
                }
              />
              <WxCell
                label="High"
                value={
                  log.weather.highC != null ? `${log.weather.highC}°C` : "—"
                }
              />
              <WxCell
                label="Low"
                value={
                  log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"
                }
              />
              <WxCell
                label="Precip"
                value={
                  log.weather.precipPct != null
                    ? `${log.weather.precipPct}%`
                    : "—"
                }
              />
            </div>
          </div>

          {log.clientSummary && (
            <div className="cdl-sec">
              <div className="cdl-sec-h">Summary</div>
              <div className="cdl-notes">{log.clientSummary}</div>
            </div>
          )}

          {log.clientHighlights && log.clientHighlights.length > 0 && (
            <div className="cdl-sec">
              <div className="cdl-sec-h">Highlights</div>
              <ul className="cdl-hl">
                {log.clientHighlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {log.photoCount > 0 && (
            <div className="cdl-sec">
              <div className="cdl-sec-h">Photos ({log.photoCount})</div>
              <p className="cdl-hint">
                <Link
                  href={`/commercial/project/${projectId}/daily-logs/${log.id}`}
                >
                  Open the full update to see photos →
                </Link>
              </p>
            </div>
          )}
        </div>
        <div className="cdl-dr-foot">
          <button className="cdl-btn ghost" onClick={onClose}>
            Close
          </button>
          <Link
            className="cdl-btn pri"
            href={`/commercial/project/${projectId}/daily-logs/${log.id}`}
          >
            Open full update
          </Link>
        </div>
      </aside>
    </>
  );
}

function WxCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="cdl-wx-cell">
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
  const startDow = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];

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
    const isWeekend = dow === 0 || dow === 6;

    let state: CalendarCell["state"];
    let logId: string | null = null;
    if (log) {
      logId = log.id;
      state = "logged";
    } else if (isToday) {
      state = "today";
    } else if (isWeekend) {
      state = "weekend";
    } else if (iso < today) {
      state = "missed";
    } else {
      state = "future";
    }
    cells.push({ key: iso, day: d, inMonth: true, state, logId });
  }

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
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function weatherLabel(log: DailyLogListRow): string {
  const c = log.weather.conditions;
  const temp =
    log.weather.highC != null
      ? ` · ${log.weather.highC}°${log.weather.lowC != null ? `/${log.weather.lowC}°` : ""}`
      : "";
  return c ? `${pretty(c)}${temp}` : "Weather not recorded";
}

function pretty(s: string): string {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Commercial client accent: blue. Prefix `cdl-` to avoid collisions.
const COMMERCIAL_CSS = `
.cdl-root{
  --cdl-s1:#fff;--cdl-s2:#f3f4f6;--cdl-s3:#e2e5e9;--cdl-s4:#d1d5db;
  --cdl-sh:#f5f6f8;--cdl-sic:#f8f9fa;
  --cdl-t1:#1a1714;--cdl-t2:#6b655b;--cdl-t3:#9c958a;--cdl-ti:#faf9f7;
  --cdl-ac:#3178b9;--cdl-ac-h:#286399;--cdl-ac-s:#e5f0f9;--cdl-ac-t:#215489;--cdl-ac-m:#a7c5e0;
  --cdl-ok:#2d8a5e;--cdl-ok-s:#edf7f1;--cdl-ok-t:#1e6b46;
  --cdl-wr:#c17a1a;--cdl-wr-s:#fdf4e6;--cdl-wr-t:#96600f;
  --cdl-fd:'DM Sans',system-ui,sans-serif;
  --cdl-fb:'Instrument Sans',system-ui,sans-serif;
  --cdl-fm:'JetBrains Mono',monospace;
  font-family:var(--cdl-fb);color:var(--cdl-t1);line-height:1.5;font-size:14px;padding:24px;
}
.cdl-root *{box-sizing:border-box}

.cdl-page-h{margin-bottom:20px}
.cdl-page-t{font-family:var(--cdl-fd);font-size:24px;font-weight:820;letter-spacing:-.03em;line-height:1.15;margin:0}
.cdl-page-sub{margin-top:6px;font-size:14px;font-weight:520;color:var(--cdl-t2);max-width:640px}

.cdl-btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--cdl-s3);background:var(--cdl-s1);color:var(--cdl-t1);font-size:13px;font-weight:650;font-family:var(--cdl-fb);cursor:pointer;text-decoration:none;white-space:nowrap}
.cdl-btn:hover{background:var(--cdl-sh);border-color:var(--cdl-s4)}
.cdl-btn.pri{background:var(--cdl-ac);color:var(--cdl-ti);border-color:var(--cdl-ac)}
.cdl-btn.pri:hover{background:var(--cdl-ac-h)}
.cdl-btn.sm{height:30px;font-size:12px;padding:0 10px}
.cdl-btn.ghost{background:transparent;border-color:transparent;color:var(--cdl-t2);font-weight:560}
.cdl-btn.ghost:hover{background:var(--cdl-sh);color:var(--cdl-t1)}
.cdl-btn svg{width:14px;height:14px;flex-shrink:0}

.cdl-pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--cdl-fd)}
.cdl-pl.green{background:var(--cdl-ok-s);color:var(--cdl-ok-t)}
.cdl-pl.amber{background:var(--cdl-wr-s);color:var(--cdl-wr-t)}
.cdl-pl.blue{background:var(--cdl-ac-s);color:var(--cdl-ac-t)}

.cdl-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.cdl-kpi{background:var(--cdl-s1);border:1px solid var(--cdl-s3);border-radius:14px;padding:16px}
.cdl-kpi-label{font-family:var(--cdl-fd);font-size:11.5px;font-weight:700;color:var(--cdl-t1);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.cdl-kpi-val{font-family:var(--cdl-fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.cdl-kpi-meta{font-family:var(--cdl-fb);font-size:12px;font-weight:580;color:var(--cdl-t2);margin-top:4px}
.cdl-kpi-trend{font-weight:720;font-size:11.5px}
.cdl-kpi-trend.warn{color:var(--cdl-wr-t)}
.cdl-kpi-trend.ok{color:var(--cdl-ok-t)}

.cdl-cd{background:var(--cdl-s1);border:1px solid var(--cdl-s3);border-radius:18px;overflow:hidden;margin-bottom:16px}
.cdl-cd-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--cdl-s3);gap:12px}
.cdl-cd-title{font-family:var(--cdl-fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.cdl-cd-sub{font-family:var(--cdl-fb);font-size:12.5px;font-weight:540;color:var(--cdl-t2);margin-top:2px}
.cdl-cd-body{padding:16px 20px}

.cdl-vt{display:inline-flex;background:var(--cdl-s2);border-radius:10px;padding:3px;gap:2px}
.cdl-vt-btn{height:28px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:600;color:var(--cdl-t2);background:transparent;border:none;cursor:pointer;font-family:var(--cdl-fb);display:inline-flex;align-items:center;gap:5px}
.cdl-vt-btn.on{background:var(--cdl-s1);color:var(--cdl-t1);font-weight:700;box-shadow:0 1px 3px rgba(26,23,20,.05)}

.cdl-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 4px}
.cdl-cal-nav{display:flex;align-items:center;gap:8px}
.cdl-cal-month{font-family:var(--cdl-fd);font-size:17px;font-weight:740;letter-spacing:-.02em}
.cdl-cal-arrow{width:28px;height:28px;border-radius:6px;border:1px solid var(--cdl-s3);background:var(--cdl-s1);color:var(--cdl-t2);display:grid;place-items:center;cursor:pointer}
.cdl-cal-arrow:hover{background:var(--cdl-sh);color:var(--cdl-t1)}
.cdl-cal-arrow svg{width:12px;height:12px}
.cdl-cal-legend{display:flex;gap:14px;font-size:11.5px;color:var(--cdl-t2);font-weight:550}
.cdl-cal-legend span{display:inline-flex;align-items:center;gap:5px}
.cdl-cal-legend .sw{width:10px;height:10px;border-radius:3px}

.cdl-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cdl-cal-dow{font-family:var(--cdl-fd);font-size:10.5px;font-weight:700;color:var(--cdl-t3);text-transform:uppercase;letter-spacing:.06em;text-align:center;padding:4px 0;margin-bottom:2px}
.cdl-cal-day{aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:8px 10px;transition:all 120ms cubic-bezier(.16,1,.3,1);border:1px solid transparent}
.cdl-cal-day[role="button"]{cursor:pointer}
.cdl-cal-day .d-num{font-family:var(--cdl-fd);font-size:13px;font-weight:700}
.cdl-cal-day .d-foot{font-size:10px;font-weight:600;letter-spacing:.02em}
.cdl-cal-day.prev,.cdl-cal-day.future{color:var(--cdl-t3);opacity:.5}
.cdl-cal-day.weekend,.cdl-cal-day.quiet{background:var(--cdl-s2);color:var(--cdl-t3)}
.cdl-cal-day.logged{background:var(--cdl-ok-s);color:var(--cdl-ok-t);border-color:rgba(45,138,94,.2)}
.cdl-cal-day.logged:hover{border-color:var(--cdl-ok)}
.cdl-cal-day.today{background:var(--cdl-ac-s);color:var(--cdl-ac-t);border:1.5px solid var(--cdl-ac);font-weight:820}

.cdl-log-row{display:grid;grid-template-columns:170px 1fr;gap:16px;padding:14px 0;border-top:1px solid var(--cdl-s3);cursor:pointer;align-items:start}
.cdl-log-row:first-child{border-top:none}
.cdl-log-row:hover{background:var(--cdl-sic);margin:0 -20px;padding-left:20px;padding-right:20px}
.cdl-log-date{font-family:var(--cdl-fd);font-size:13px;font-weight:680;color:var(--cdl-t1);line-height:1.35}
.cdl-log-body h5{font-family:var(--cdl-fd);font-size:14px;font-weight:620;line-height:1.35;margin:0 0 4px}
.cdl-log-body p{font-size:12.5px;color:var(--cdl-t2);line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cdl-log-meta-row{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
.cdl-log-mi{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--cdl-t2);font-weight:570}
.cdl-log-mi svg{color:var(--cdl-t3)}

.cdl-drawer-ovl{position:fixed;inset:0;background:rgba(20,18,14,.4);backdrop-filter:blur(3px);z-index:100}
.cdl-drawer{position:fixed;top:0;right:0;width:620px;max-width:100vw;height:100vh;background:var(--cdl-s1);z-index:101;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(26,23,20,.14);border-left:1px solid var(--cdl-s3);animation:cdl-slide 280ms cubic-bezier(.16,1,.3,1)}
@keyframes cdl-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}
.cdl-dr-head{padding:16px 24px;border-bottom:1px solid var(--cdl-s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-shrink:0}
.cdl-dr-head-l h2{font-family:var(--cdl-fd);font-size:20px;font-weight:780;letter-spacing:-.02em;margin:0}
.cdl-dh-meta{margin-top:6px}
.cdl-dr-close{width:32px;height:32px;border-radius:10px;border:1px solid var(--cdl-s3);background:var(--cdl-s1);color:var(--cdl-t2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.cdl-dr-close:hover{background:var(--cdl-sh);color:var(--cdl-t1)}
.cdl-dr-body{flex:1;overflow-y:auto;padding:20px 24px}
.cdl-dr-foot{padding:14px 24px;border-top:1px solid var(--cdl-s3);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-shrink:0;background:var(--cdl-sic)}

.cdl-sec{margin-bottom:22px}
.cdl-sec-h{font-family:var(--cdl-fd);font-size:11.5px;font-weight:720;color:var(--cdl-t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
.cdl-wx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cdl-wx-cell{background:var(--cdl-sic);border:1px solid var(--cdl-s3);border-radius:10px;padding:10px 12px}
.cdl-wx-cell .wxl{font-size:10.5px;color:var(--cdl-t3);font-weight:620;text-transform:uppercase;letter-spacing:.04em}
.cdl-wx-cell .wxv{font-family:var(--cdl-fd);font-size:14px;font-weight:700;margin-top:3px}
.cdl-notes{font-size:14px;line-height:1.65;color:var(--cdl-t1);padding:12px 14px;background:var(--cdl-sic);border-left:3px solid var(--cdl-ac);border-radius:0 10px 10px 0;white-space:pre-wrap}
.cdl-hl{margin:0 0 0 20px;padding:0;font-size:13.5px;line-height:1.7;color:var(--cdl-t1)}
.cdl-hl li{margin-bottom:4px}
.cdl-hint{font-size:12.5px;color:var(--cdl-t2)}
.cdl-hint a{color:var(--cdl-ac-t);font-weight:620}
.cdl-hint a:hover{color:var(--cdl-ac)}

.cdl-empty{font-size:13px;color:var(--cdl-t2);padding:20px 0;text-align:center}

@media (max-width:960px){
  .cdl-kpi-strip{grid-template-columns:repeat(2,1fr)}
  .cdl-wx-grid{grid-template-columns:repeat(2,1fr)}
  .cdl-drawer{width:100vw}
  .cdl-log-row{grid-template-columns:1fr;gap:6px}
}
`;
