"use client";

import Link from "next/link";

import type {
  DailyLogDetailRedacted,
  DailyLogResidentialMood,
} from "@/domain/loaders/daily-logs";

// Full journal entry page. Friendly residential framing — hero image,
// heroTitle, summary, highlights, milestone, team note with attribution,
// weather strip, photo gallery. No crew, no delays, no amendments
// (getDailyLog strips those for residential_client role).

const MOOD: Record<
  DailyLogResidentialMood,
  { label: string; color: "ok" | "accent" | "warn" }
> = {
  great: { label: "Great day", color: "ok" },
  good: { label: "Good day", color: "accent" },
  slow: { label: "Slow day", color: "warn" },
};

export function ResidentialJournalDetail({
  projectId,
  log,
}: {
  projectId: string;
  log: DailyLogDetailRedacted;
}) {
  const mood = log.residentialMood ? MOOD[log.residentialMood] : null;
  const title =
    log.residentialHeroTitle ??
    log.milestone ??
    log.clientSummary?.split(".")[0]?.trim() ??
    "Site update";
  const body = log.residentialSummary ?? log.clientSummary ?? "";
  const highlights = log.clientHighlights ?? [];
  const teamNote = log.residentialTeamNote;
  const teamBy = log.residentialTeamNoteByName;

  return (
    <div className="rjd-root">
      <style>{CSS}</style>

      <div className="rjd-back-row">
        <Link
          href={`/residential/project/${projectId}/journal`}
          className="rjd-btn ghost"
        >
          ← Back to journal
        </Link>
        <a
          className="rjd-btn"
          href={`/api/daily-logs/${log.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Download PDF
        </a>
      </div>

      <article className="rjd-article">
        <header className="rjd-head">
          <div className="rjd-date">{formatDateLong(log.logDate)}</div>
          <h1 className="rjd-title">{title}</h1>
          <div className="rjd-meta">
            {mood && <span className={`rjd-pl ${mood.color}`}>{mood.label}</span>}
            <span className="rjd-wx">{weatherLabel(log)}</span>
            {log.milestone && (
              <span
                className={`rjd-pl ${
                  log.milestoneType === "warn"
                    ? "warn"
                    : log.milestoneType === "info"
                      ? "accent"
                      : "ok"
                }`}
              >
                Milestone: {log.milestone}
              </span>
            )}
          </div>
        </header>

        {body && <p className="rjd-body">{body}</p>}

        {highlights.length > 0 && (
          <section className="rjd-section">
            <h3>Highlights</h3>
            <ul className="rjd-hl">
              {highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </section>
        )}

        {teamNote && (
          <section className="rjd-note">
            <p>&ldquo;{teamNote}&rdquo;</p>
            {teamBy && <span className="rjd-note-by">— {teamBy}</span>}
          </section>
        )}

        {log.photos.length > 0 && (
          <section className="rjd-section">
            <h3>Photos ({log.photos.length})</h3>
            <div className="rjd-ph-grid">
              {log.photos.map((p) => (
                <div
                  key={p.id}
                  className={`rjd-ph-tile${p.isHero ? " hero" : ""}`}
                >
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.url}
                      alt={p.caption ?? p.title}
                      className="rjd-ph-img"
                      loading="lazy"
                    />
                  ) : (
                    <span className="rjd-ph-fallback">{p.title}</span>
                  )}
                  {p.caption && <div className="rjd-ph-cap">{p.caption}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {!body && highlights.length === 0 && log.photos.length === 0 && (
          <p className="rjd-empty">
            Your builder posted a short log for this day. Check back for photos
            or a longer update.
          </p>
        )}
      </article>
    </div>
  );
}

function weatherLabel(log: DailyLogDetailRedacted): string {
  const c = log.weather.conditions;
  const parts: string[] = [];
  if (c) parts.push(prettyConditions(c));
  if (log.weather.highC != null) parts.push(`${log.weather.highC}°`);
  return parts.join(", ") || "Weather not recorded";
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
    year: "numeric",
    timeZone: "UTC",
  });
}

const CSS = `
.rjd-root{
  --rjd-s1:#fff;--rjd-s2:#f3f5f4;--rjd-s3:#e0e6e3;--rjd-s4:#cfd6d2;
  --rjd-sh:#f5f7f6;--rjd-sic:#f8faf9;
  --rjd-t1:#1a1714;--rjd-t2:#6b655b;--rjd-t3:#9c958a;
  --rjd-ac:#2a7f6f;--rjd-ac-s:#e4f2ee;--rjd-ac-t:#1f5e52;
  --rjd-ok:#2d8a5e;--rjd-ok-s:#edf7f1;--rjd-ok-t:#1e6b46;
  --rjd-wr:#c17a1a;--rjd-wr-s:#fdf4e6;--rjd-wr-t:#96600f;
  --rjd-fd:'DM Sans',system-ui,sans-serif;
  --rjd-fb:'Instrument Sans',system-ui,sans-serif;
  font-family:var(--rjd-fb);color:var(--rjd-t1);font-size:14px;line-height:1.6;
  padding:28px 32px;max-width:780px;margin:0 auto;
}
.rjd-root *{box-sizing:border-box}

.rjd-back-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
.rjd-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:10px;border:1px solid var(--rjd-s3);background:var(--rjd-s1);color:var(--rjd-t1);font-size:13px;font-weight:650;font-family:var(--rjd-fb);cursor:pointer;text-decoration:none}
.rjd-btn.ghost{background:transparent;border-color:transparent;color:var(--rjd-t2)}
.rjd-btn.ghost:hover{background:var(--rjd-sh);color:var(--rjd-t1)}

.rjd-article{background:var(--rjd-s1);border:1px solid var(--rjd-s3);border-radius:22px;padding:32px 34px}

.rjd-head{margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid var(--rjd-s3)}
.rjd-date{font-family:var(--rjd-fd);font-size:11px;font-weight:720;color:var(--rjd-ac-t);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.rjd-title{font-family:var(--rjd-fd);font-size:26px;font-weight:820;letter-spacing:-.03em;margin:0 0 12px;line-height:1.2}
.rjd-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px}
.rjd-wx{font-size:13px;color:var(--rjd-t2);font-weight:540}

.rjd-pl{height:22px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;font-family:var(--rjd-fd);display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.rjd-pl.ok{background:var(--rjd-ok-s);color:var(--rjd-ok-t)}
.rjd-pl.accent{background:var(--rjd-ac-s);color:var(--rjd-ac-t)}
.rjd-pl.warn{background:var(--rjd-wr-s);color:var(--rjd-wr-t)}

.rjd-body{font-size:15px;line-height:1.7;color:var(--rjd-t1);margin:0 0 24px}

.rjd-section{margin-top:24px}
.rjd-section h3{font-family:var(--rjd-fd);font-size:13px;font-weight:720;color:var(--rjd-t2);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px}
.rjd-hl{margin:0 0 0 20px;padding:0;font-size:14px;line-height:1.7;color:var(--rjd-t1)}
.rjd-hl li{margin-bottom:4px}

.rjd-note{background:var(--rjd-ac-s);border-left:3px solid var(--rjd-ac);border-radius:0 12px 12px 0;padding:16px 20px;margin-top:24px;position:relative}
.rjd-note p{font-size:14.5px;line-height:1.65;color:var(--rjd-t1);margin:0;font-style:italic}
.rjd-note-by{display:block;margin-top:8px;font-size:12px;color:var(--rjd-ac-t);font-weight:620;font-family:var(--rjd-fd)}

.rjd-ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.rjd-ph-tile{aspect-ratio:4/3;background:linear-gradient(135deg,var(--rjd-s2),var(--rjd-s3));border-radius:12px;position:relative;overflow:hidden;display:grid;place-items:center;color:var(--rjd-t3);border:1px solid var(--rjd-s3)}
.rjd-ph-tile.hero{grid-column:span 2;grid-row:span 2;aspect-ratio:auto;min-height:240px;border-color:var(--rjd-ac-m)}
.rjd-ph-img{width:100%;height:100%;object-fit:cover;display:block}
.rjd-ph-fallback{font-size:11.5px;text-align:center;padding:8px}
.rjd-ph-cap{position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(20,18,14,.75));color:white;font-size:11px;font-weight:570;line-height:1.2}

.rjd-empty{font-size:13.5px;color:var(--rjd-t2);padding:12px 0;text-align:center;font-style:italic}

@media (max-width:720px){
  .rjd-root{padding:20px}
  .rjd-article{padding:22px 22px}
  .rjd-title{font-size:22px}
  .rjd-ph-grid{grid-template-columns:repeat(2,1fr)}
  .rjd-ph-tile.hero{grid-column:span 2;min-height:200px}
}
`;
