"use client";

import Link from "next/link";

import type { DailyLogDetailRedacted } from "@/domain/loaders/daily-logs";

// Redacted full detail for the commercial client portal. Shows only:
// - Weather
// - Client-facing summary narrative
// - Highlights
// - Milestone
// - Photos (count + grid)
// No crew, no delays, no issues, no amendments — those are stripped
// out by the getDailyLog loader when role is commercial_client.

export function CommercialDailyLogDetail({
  projectId,
  log,
}: {
  projectId: string;
  log: DailyLogDetailRedacted;
}) {
  return (
    <div className="cdld-root">
      <style>{CSS}</style>

      <div className="cdld-back">
        <Link
          href={`/commercial/project/${projectId}/daily-logs`}
          className="cdld-btn ghost"
        >
          ← Back to daily logs
        </Link>
      </div>

      <header className="cdld-head">
        <div className="cdld-head-row">
          <div>
            <h1 className="cdld-title">{formatDateLong(log.logDate)}</h1>
            <div className="cdld-meta">
              <span>{log.projectName}</span>
              {log.milestone && (
                <span
                  className={`cdld-pl ${
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
            </div>
          </div>
          <a
            className="cdld-btn"
            href={`/api/daily-logs/${log.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download PDF
          </a>
        </div>
      </header>

      <section className="cdld-sec-card">
        <h3>Weather</h3>
        <div className="cdld-wx-grid">
          <WxCell
            label="Conditions"
            value={log.weather.conditions ? pretty(log.weather.conditions) : "—"}
          />
          <WxCell
            label="High"
            value={log.weather.highC != null ? `${log.weather.highC}°C` : "—"}
          />
          <WxCell
            label="Low"
            value={log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"}
          />
          <WxCell
            label="Precip"
            value={
              log.weather.precipPct != null ? `${log.weather.precipPct}%` : "—"
            }
          />
        </div>
        {log.hadWeatherDelay && (
          <p className="cdld-wx-note">
            Site work was slowed by weather conditions on this day.
          </p>
        )}
      </section>

      {log.clientSummary && (
        <section className="cdld-sec-card">
          <h3>Summary</h3>
          <div className="cdld-notes">{log.clientSummary}</div>
        </section>
      )}

      {log.clientHighlights && log.clientHighlights.length > 0 && (
        <section className="cdld-sec-card">
          <h3>Highlights</h3>
          <ul className="cdld-hl">
            {log.clientHighlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {log.photos.length > 0 && (
        <section className="cdld-sec-card">
          <h3>Photos ({log.photos.length})</h3>
          <div className="cdld-ph-grid">
            {log.photos.map((p) => (
              <div key={p.id} className="cdld-ph-tile">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.caption ?? p.title}
                    className="cdld-ph-img"
                    loading="lazy"
                  />
                ) : (
                  <span className="cdld-ph-fallback">{p.title}</span>
                )}
                {p.caption && <div className="cdld-ph-cap">{p.caption}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {!log.clientSummary &&
        (!log.clientHighlights || log.clientHighlights.length === 0) &&
        log.photos.length === 0 && (
          <section className="cdld-sec-card">
            <p className="cdld-empty">
              No written update for this day — check back later.
            </p>
          </section>
        )}
    </div>
  );
}

function WxCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="cdld-wx-cell">
      <div className="wxl">{label}</div>
      <div className="wxv">{value}</div>
    </div>
  );
}

function pretty(s: string): string {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
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

const CSS = `
.cdld-root{padding:24px;
  --cdld-s1:#fff;--cdld-s2:#f3f4f6;--cdld-s3:#e2e5e9;--cdld-s4:#d1d5db;
  --cdld-sh:#f5f6f8;--cdld-sic:#f8f9fa;
  --cdld-t1:#1a1714;--cdld-t2:#6b655b;--cdld-t3:#9c958a;--cdld-ti:#faf9f7;
  --cdld-ac:#3178b9;--cdld-ac-s:#e5f0f9;--cdld-ac-t:#215489;
  --cdld-ok:#2d8a5e;--cdld-ok-s:#edf7f1;--cdld-ok-t:#1e6b46;
  --cdld-wr:#c17a1a;--cdld-wr-s:#fdf4e6;--cdld-wr-t:#96600f;
  --cdld-fd:'DM Sans',system-ui,sans-serif;
  --cdld-fb:'Instrument Sans',system-ui,sans-serif;
  font-family:var(--cdld-fb);color:var(--cdld-t1);font-size:14px;line-height:1.5;
}
.cdld-root *{box-sizing:border-box}
.cdld-back{margin-bottom:12px}
.cdld-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:10px;border:1px solid var(--cdld-s3);background:var(--cdld-s1);color:var(--cdld-t1);font-size:13px;font-weight:650;font-family:var(--cdld-fb);cursor:pointer;text-decoration:none}
.cdld-btn.ghost{background:transparent;border-color:transparent;color:var(--cdld-t2)}
.cdld-btn.ghost:hover{background:var(--cdld-sh);color:var(--cdld-t1)}

.cdld-head{margin-bottom:18px}
.cdld-head-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.cdld-title{font-family:var(--cdld-fd);font-size:24px;font-weight:820;letter-spacing:-.03em;margin:0}
.cdld-meta{font-size:13px;color:var(--cdld-t2);margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}

.cdld-pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--cdld-fd)}
.cdld-pl.green{background:var(--cdld-ok-s);color:var(--cdld-ok-t)}
.cdld-pl.amber{background:var(--cdld-wr-s);color:var(--cdld-wr-t)}
.cdld-pl.blue{background:var(--cdld-ac-s);color:var(--cdld-ac-t)}

.cdld-sec-card{background:var(--cdld-s1);border:1px solid var(--cdld-s3);border-radius:18px;padding:18px 22px;margin-bottom:14px}
.cdld-sec-card h3{font-family:var(--cdld-fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0 0 14px}

.cdld-wx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cdld-wx-cell{background:var(--cdld-sic);border:1px solid var(--cdld-s3);border-radius:10px;padding:10px 12px}
.cdld-wx-cell .wxl{font-size:10.5px;color:var(--cdld-t3);font-weight:620;text-transform:uppercase;letter-spacing:.04em}
.cdld-wx-cell .wxv{font-family:var(--cdld-fd);font-size:14px;font-weight:700;margin-top:3px}
.cdld-wx-note{font-size:12px;color:var(--cdld-wr-t);margin:10px 0 0;font-weight:560}

.cdld-notes{font-size:14px;line-height:1.65;color:var(--cdld-t1);padding:12px 14px;background:var(--cdld-sic);border-left:3px solid var(--cdld-ac);border-radius:0 10px 10px 0;white-space:pre-wrap}
.cdld-hl{margin:0 0 0 20px;padding:0;font-size:13.5px;line-height:1.7;color:var(--cdld-t1)}
.cdld-hl li{margin-bottom:4px}

.cdld-ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cdld-ph-tile{aspect-ratio:1;background:linear-gradient(135deg,var(--cdld-s2),var(--cdld-s3));border-radius:10px;position:relative;overflow:hidden;display:grid;place-items:center;color:var(--cdld-t3);border:1px solid var(--cdld-s3)}
.cdld-ph-img{width:100%;height:100%;object-fit:cover;display:block}
.cdld-ph-fallback{font-size:11px;text-align:center;padding:8px}
.cdld-ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(20,18,14,.7));color:white;font-size:10.5px;font-weight:570;line-height:1.2}

.cdld-empty{font-size:13px;color:var(--cdld-t2);padding:8px 0;text-align:center}

@media (max-width:960px){
  .cdld-wx-grid{grid-template-columns:repeat(2,1fr)}
  .cdld-ph-grid{grid-template-columns:repeat(2,1fr)}
}
`;
