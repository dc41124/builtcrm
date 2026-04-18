"use client";

import Link from "next/link";
import { useState } from "react";

import type { ResidentialJournalPageView } from "@/domain/loaders/residential-journal-page";
import type {
  DailyLogListRow,
  DailyLogResidentialMood,
} from "@/domain/loaders/daily-logs";

// Residential "Journal" view. Feed-style, not calendar-style. Uses the
// residential-specific fields (heroTitle, mood, teamNote, summary) when
// they're populated; falls back to clientSummary/milestone when the GC
// authored only the generic client-facing content.

const I = {
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  cloud: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  ),
  rain: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" />
    </svg>
  ),
  snow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M4 6l16 12M4 18 20 6" />
    </svg>
  ),
  sparkle: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  ),
  heart: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  camera: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
};

const MOOD_INFO: Record<
  DailyLogResidentialMood,
  { label: string; color: "ok" | "accent" | "warn"; icon: React.ReactNode }
> = {
  great: { label: "Great day", color: "ok", icon: I.sparkle },
  good: { label: "Good day", color: "accent", icon: I.heart },
  slow: { label: "Slow day", color: "warn", icon: null },
};

export function ResidentialJournalWorkspace({
  view,
}: {
  view: ResidentialJournalPageView;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    view.entries[0]?.id ?? null,
  );

  return (
    <div className="rj-root">
      <style>{CSS}</style>

      <header className="rj-page-h">
        <h1 className="rj-page-t">Journal</h1>
        <p className="rj-page-sub">
          Your builder&apos;s day-by-day updates on the {view.project.name} build
          — photos, progress, and big moments.
        </p>
      </header>

      <section className="rj-prog">
        <div className="rj-prog-l">
          <div className="rj-prog-phase">
            Current phase · {view.project.phaseLabel}
          </div>
          <div className="rj-prog-title">{view.project.name}</div>
          <div className="rj-prog-meta">
            {view.project.targetMoveInLabel
              ? `Target completion: ${view.project.targetMoveInLabel}`
              : "Keep an eye out for new entries below."}
          </div>
          <div className="rj-prog-bar">
            <div
              className="rj-prog-bar-fill"
              style={{ width: `${view.project.pctComplete}%` }}
            />
          </div>
        </div>
        <div>
          <div className="rj-prog-pct">{view.project.pctComplete}%</div>
          <div className="rj-prog-pct-label">of the way there</div>
        </div>
      </section>

      <div className="rj-jh">
        <div>
          <div className="rj-jh-t">Recent updates</div>
          <div className="rj-jh-c">
            {view.entries.length === 0
              ? "No updates yet — your builder will post here as work progresses."
              : `${view.entries.length} update${view.entries.length === 1 ? "" : "s"} in the last 60 days`}
          </div>
        </div>
      </div>

      {view.entries.length === 0 ? (
        <div className="rj-empty-card">
          <h3>No journal entries yet</h3>
          <p>
            Your builder will post updates here as work progresses on site.
            Check back in a few days.
          </p>
        </div>
      ) : (
        <div className="rj-timeline">
          {view.entries.map((entry, idx) => (
            <JournalCard
              key={entry.id}
              entry={entry}
              isFirst={idx === 0}
              isOpen={expandedId === entry.id}
              onToggle={() =>
                setExpandedId((curr) => (curr === entry.id ? null : entry.id))
              }
              projectId={view.project.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JournalCard({
  entry,
  isFirst,
  isOpen,
  onToggle,
  projectId,
}: {
  entry: DailyLogListRow;
  isFirst: boolean;
  isOpen: boolean;
  onToggle: () => void;
  projectId: string;
}) {
  const mood = entry.residentialMood ? MOOD_INFO[entry.residentialMood] : null;
  const heroTitle =
    entry.residentialHeroTitle ??
    entry.milestone ??
    (entry.clientSummary?.split(".")[0]?.trim() ||
      "Site update");
  const body =
    entry.residentialSummary ??
    entry.clientSummary ??
    "Your builder posted an update for this day.";
  const highlights = entry.clientHighlights ?? [];

  return (
    <article
      className={`rj-card${isOpen ? " open" : ""}${isFirst ? " first" : ""}${
        entry.residentialMood === "great" ? " great" : ""
      }`}
    >
      <button
        className="rj-hero"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="rj-hero-body">
          <div className="rj-date-line">
            <span className="rj-date">{formatDateLong(entry.logDate)}</span>
            {mood && (
              <span className={`rj-mood ${mood.color}`}>
                {mood.icon}
                {mood.label}
              </span>
            )}
            <span className="rj-wx">
              {weatherIcon(entry.weather.conditions)} {weatherLabel(entry)}
            </span>
          </div>
          <h2 className="rj-hero-title">{heroTitle}</h2>
          <p className="rj-hero-lead">{body}</p>
        </div>
        <div className="rj-hero-visual">
          <div className="rj-hero-frame">
            {I.camera}
            <span className="rj-hero-count">
              {entry.photoCount > 0
                ? `${entry.photoCount} photo${entry.photoCount === 1 ? "" : "s"}`
                : "No photos today"}
            </span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="rj-body">
          {highlights.length > 0 && (
            <div className="rj-hl-section">
              <h4>Highlights</h4>
              <ul className="rj-hl">
                {highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {entry.milestone && (
            <div className="rj-milestone">
              <span className="rj-pl green">Milestone</span>
              <span>{entry.milestone}</span>
            </div>
          )}

          <Link
            href={`/residential/project/${projectId}/journal/${entry.id}`}
            className="rj-view-full"
          >
            View full update →
          </Link>
        </div>
      )}
    </article>
  );
}

function weatherIcon(c: string | null): React.ReactNode {
  switch (c) {
    case "light_rain":
    case "heavy_rain":
      return I.rain;
    case "snow":
      return I.snow;
    case "overcast":
      return I.cloud;
    default:
      return I.sun;
  }
}

function weatherLabel(log: DailyLogListRow): string {
  const c = log.weather.conditions;
  const t = log.weather.highC != null ? `, ${log.weather.highC}°` : "";
  return c ? `${prettyConditions(c)}${t}` : "Weather not recorded";
}

function prettyConditions(c: string): string {
  switch (c) {
    case "clear":
      return "Sunny";
    case "partly_cloudy":
      return "Partly cloudy";
    case "overcast":
      return "Cloudy";
    case "light_rain":
      return "Light rain";
    case "heavy_rain":
      return "Rain";
    case "snow":
      return "Snow";
    default:
      return c;
  }
}

function formatDateLong(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Residential accent: teal (#2a7f6f). Warmer type scale, more spacious
// layout than the other portals. Prefixed `rj-` to avoid collisions.
const CSS = `
.rj-root{
  --rj-s1:#fff;--rj-s2:#f3f5f4;--rj-s3:#e0e6e3;--rj-s4:#cfd6d2;
  --rj-sh:#f5f7f6;--rj-sic:#f8faf9;
  --rj-t1:#1a1714;--rj-t2:#6b655b;--rj-t3:#9c958a;--rj-ti:#faf9f7;
  --rj-ac:#2a7f6f;--rj-ac-h:#236a5b;--rj-ac-s:#e4f2ee;--rj-ac-t:#1f5e52;--rj-ac-m:#a6cec4;
  --rj-ok:#2d8a5e;--rj-ok-s:#edf7f1;--rj-ok-t:#1e6b46;
  --rj-wr:#c17a1a;--rj-wr-s:#fdf4e6;--rj-wr-t:#96600f;
  --rj-fd:'DM Sans',system-ui,sans-serif;
  --rj-fb:'Instrument Sans',system-ui,sans-serif;
  font-family:var(--rj-fb);color:var(--rj-t1);line-height:1.55;font-size:14px;
  padding:28px 32px;max-width:1060px;margin:0 auto;
}
.rj-root *{box-sizing:border-box}

.rj-page-h{margin-bottom:22px}
.rj-page-t{font-family:var(--rj-fd);font-size:24px;font-weight:820;letter-spacing:-.035em;color:var(--rj-t1);margin:0}
.rj-page-sub{font-size:14px;color:var(--rj-t2);margin-top:6px;max-width:620px;font-weight:520;line-height:1.6}

.rj-prog{display:grid;grid-template-columns:1fr auto;gap:20px;background:var(--rj-s1);border:1px solid var(--rj-s3);border-radius:22px;padding:18px 22px;margin-bottom:26px;box-shadow:0 1px 3px rgba(26,23,20,.05);align-items:center}
.rj-prog-l{display:flex;flex-direction:column;gap:2px}
.rj-prog-phase{font-family:var(--rj-fd);font-size:10.5px;font-weight:720;color:var(--rj-ac-t);text-transform:uppercase;letter-spacing:.06em}
.rj-prog-title{font-family:var(--rj-fd);font-size:17px;font-weight:740;color:var(--rj-t1);letter-spacing:-.01em;margin-top:3px}
.rj-prog-meta{font-size:12.5px;color:var(--rj-t2);margin-top:4px;font-weight:540}
.rj-prog-bar{width:280px;height:8px;background:var(--rj-s2);border-radius:999px;overflow:hidden;position:relative;margin-top:10px}
.rj-prog-bar-fill{height:100%;background:linear-gradient(90deg,var(--rj-ac),#3fa792);border-radius:999px;transition:width 200ms cubic-bezier(.16,1,.3,1)}
.rj-prog-pct{font-family:var(--rj-fd);font-size:36px;font-weight:820;color:var(--rj-ac);letter-spacing:-.04em;line-height:1}
.rj-prog-pct-label{font-size:11.5px;color:var(--rj-t2);font-weight:540;text-align:right;margin-top:4px}

.rj-jh{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
.rj-jh-t{font-family:var(--rj-fd);font-size:17px;font-weight:740;color:var(--rj-t1);letter-spacing:-.01em}
.rj-jh-c{font-size:12.5px;color:var(--rj-t3);margin-top:3px;font-weight:540}

.rj-pl{height:22px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;font-family:var(--rj-fd);display:inline-flex;align-items:center;gap:4px}
.rj-pl.green{background:var(--rj-ok-s);color:var(--rj-ok-t)}
.rj-pl.accent{background:var(--rj-ac-s);color:var(--rj-ac-t)}
.rj-pl.warn{background:var(--rj-wr-s);color:var(--rj-wr-t)}

.rj-empty-card{background:var(--rj-s1);border:1px dashed var(--rj-s3);border-radius:22px;padding:40px 24px;text-align:center}
.rj-empty-card h3{font-family:var(--rj-fd);font-size:15px;font-weight:740;color:var(--rj-t1);margin:0}
.rj-empty-card p{font-size:13.5px;color:var(--rj-t2);margin:8px 0 0;line-height:1.6;max-width:420px;margin-left:auto;margin-right:auto}

.rj-timeline{display:flex;flex-direction:column;gap:16px;position:relative;padding-left:22px}
.rj-timeline::before{content:'';position:absolute;left:8px;top:12px;bottom:12px;width:2px;background:var(--rj-s3);border-radius:2px}

.rj-card{background:var(--rj-s1);border:1px solid var(--rj-s3);border-radius:22px;overflow:hidden;transition:all 200ms cubic-bezier(.16,1,.3,1);position:relative}
.rj-card::before{content:'';position:absolute;left:-22px;top:24px;width:14px;height:14px;border-radius:50%;background:var(--rj-ac);border:3px solid #edf1ef;box-shadow:0 0 0 2px var(--rj-ac-m)}
.rj-card.great::before{background:var(--rj-ok);box-shadow:0 0 0 2px color-mix(in srgb,var(--rj-ok) 40%,transparent)}
.rj-card.first::before{box-shadow:0 0 0 2px var(--rj-ac-m),0 0 0 6px color-mix(in srgb,var(--rj-ac) 20%,transparent)}
.rj-card:hover{box-shadow:0 4px 16px rgba(26,23,20,.06);border-color:var(--rj-s4)}
.rj-card.open{box-shadow:0 4px 16px rgba(26,23,20,.06)}

.rj-hero{display:grid;grid-template-columns:1.2fr 1fr;min-height:180px;cursor:pointer;text-align:left;background:transparent;border:none;font:inherit;color:inherit;width:100%;padding:0}
.rj-hero-body{padding:20px 24px;display:flex;flex-direction:column;justify-content:center;gap:10px}
.rj-date-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rj-date{font-family:var(--rj-fd);font-size:11px;font-weight:720;color:var(--rj-ac-t);text-transform:uppercase;letter-spacing:.06em}
.rj-mood{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:700;font-family:var(--rj-fd)}
.rj-mood.ok{background:var(--rj-ok-s);color:var(--rj-ok-t)}
.rj-mood.accent{background:var(--rj-ac-s);color:var(--rj-ac-t)}
.rj-mood.warn{background:var(--rj-wr-s);color:var(--rj-wr-t)}
.rj-mood svg{width:12px;height:12px}
.rj-wx{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--rj-t2);font-weight:540}
.rj-wx svg{color:var(--rj-t3)}
.rj-hero-title{font-family:var(--rj-fd);font-size:20px;font-weight:740;letter-spacing:-.02em;line-height:1.25;color:var(--rj-t1);margin:0}
.rj-hero-lead{font-size:13.5px;color:var(--rj-t2);line-height:1.6;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

.rj-hero-visual{background:linear-gradient(135deg,var(--rj-ac-s),var(--rj-s2));display:grid;place-items:center;padding:16px}
.rj-hero-frame{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--rj-ac-t);font-size:12px;font-weight:600;font-family:var(--rj-fd)}
.rj-hero-frame svg{width:28px;height:28px}
.rj-hero-count{font-size:11.5px;color:var(--rj-t2);font-weight:540}

.rj-body{padding:0 24px 22px;border-top:1px solid var(--rj-s3)}
.rj-hl-section{margin-top:16px}
.rj-hl-section h4{font-family:var(--rj-fd);font-size:12px;font-weight:720;color:var(--rj-t2);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.rj-hl{margin:0 0 0 20px;padding:0;font-size:13.5px;line-height:1.7;color:var(--rj-t1)}
.rj-hl li{margin-bottom:4px}

.rj-milestone{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:13.5px;color:var(--rj-t1)}

.rj-view-full{display:inline-block;margin-top:18px;font-family:var(--rj-fd);font-size:13px;font-weight:680;color:var(--rj-ac-t)}
.rj-view-full:hover{color:var(--rj-ac)}

@media (max-width:720px){
  .rj-prog{grid-template-columns:1fr}
  .rj-prog-bar{width:100%}
  .rj-hero{grid-template-columns:1fr;min-height:auto}
  .rj-hero-visual{min-height:120px}
}
`;
