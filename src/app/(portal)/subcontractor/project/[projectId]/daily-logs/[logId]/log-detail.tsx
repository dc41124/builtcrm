"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DailyLogDetailFull } from "@/domain/loaders/daily-logs";

// Sub-portal view of a GC daily log. Shows the GC's full narrative +
// crew table with the sub's own row highlighted + a reconciliation
// review banner if their submitted values were adjusted.
//
// Subs can acknowledge reconciliation here (POSTs to the existing
// /api/daily-log-crew-entries/[id]/ack endpoint). They cannot edit the
// log — that's contractor-only.

export function SubDailyLogDetail({
  projectId,
  log,
}: {
  projectId: string;
  log: DailyLogDetailFull;
}) {
  const router = useRouter();

  // Find the sub's own crew row. Since this component runs in the sub
  // portal context we know getDailyLog returned the full shape, but we
  // don't know the sub's orgId from the log alone — pull it via the
  // rows that have requiresAck set OR submittedByRole='sub'. For a
  // multi-sub project the ack buttons below only act on rows that match
  // the caller's org server-side, so rendering all-sub rows with
  // acknowledge affordances is safe.
  const myRows = log.crew.filter(
    (c) => c.submittedByRole === "sub" || c.requiresAck,
  );

  return (
    <div className="sdl-detail-root">
      <style>{SUB_DETAIL_CSS}</style>

      <div className="sd-back">
        <Link
          href="/subcontractor/daily-logs"
          className="sd-btn ghost"
        >
          ← Back to daily logs
        </Link>
      </div>

      <header className="sd-head">
        <div>
          <h1 className="sd-title">{formatDateLong(log.logDate)}</h1>
          <div className="sd-meta">
            <span className="mono">{log.id.slice(0, 8)}</span>
            <span>·</span>
            <span>{log.projectName}</span>
            <span>·</span>
            <span>GC: {log.reportedByName ?? "—"}</span>
            <span
              className={`sd-pl ${log.status === "submitted" ? "green" : "amber"}`}
            >
              {log.status === "submitted" ? "Submitted" : "Draft"}
            </span>
          </div>
        </div>
        <div>
          <a
            className="sd-btn"
            href={`/api/daily-logs/${log.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download PDF
          </a>
        </div>
      </header>

      {myRows.some((r) => r.requiresAck) && (
        <div className="sd-reco-banner">
          <div>
            <h3>Reconciliation requires your review</h3>
            <p>
              The GC adjusted one or more of your crew-entry values. Review the
              updated numbers in the crew table below and acknowledge.
            </p>
          </div>
        </div>
      )}

      <section className="sd-sec-card">
        <h3>Weather</h3>
        <div className="sd-wx-grid">
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
          <WxCell
            label="Wind"
            value={
              log.weather.windKmh != null ? `${log.weather.windKmh} km/h` : "—"
            }
          />
        </div>
      </section>

      <section className="sd-sec-card">
        <h3>Crew on site</h3>
        {log.crew.length === 0 ? (
          <p className="sd-empty">No crew entries for this log yet.</p>
        ) : (
          <table className="sd-crew-tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Trade</th>
                <th>Headcount</th>
                <th>Hours</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {log.crew.map((c) => {
                const isMine = myRows.some((r) => r.id === c.id);
                const hc = c.reconciledHeadcount ?? c.headcount;
                const hr = c.reconciledHours ?? c.hours;
                return (
                  <tr key={c.id} className={isMine ? "mine" : ""}>
                    <td className="org">
                      {c.orgName}
                      {isMine && <span className="sd-you">YOU</span>}
                    </td>
                    <td className="trade">{c.trade ?? "—"}</td>
                    <td className="num">{hc}</td>
                    <td className="num">{hr}</td>
                    <td className="num">
                      {c.requiresAck ? (
                        <AckButton entryId={c.id} onAcked={() => router.refresh()} />
                      ) : c.reconciledAt && c.subAckedReconciliationAt ? (
                        <span className="sd-pl gray">Acked</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {log.notes && (
        <section className="sd-sec-card">
          <h3>GC&apos;s work summary</h3>
          <div className="sd-notes-body">{log.notes}</div>
        </section>
      )}

      {myRows.some((r) => r.submittedNote) && (
        <section className="sd-sec-card">
          <h3>Your notes for this day</h3>
          {myRows
            .filter((r) => r.submittedNote)
            .map((r) => (
              <div key={r.id} className="sd-notes-body own">
                {r.submittedNote}
              </div>
            ))}
        </section>
      )}

      {(log.delays.length > 0 || log.issues.length > 0) && (
        <section className="sd-sec-card">
          <h3>Delays &amp; issues</h3>
          {log.delays.map((d) => (
            <div key={d.id} className="sd-issue-row">
              <h5>
                {pretty(d.delayType)}{" "}
                <span className="sd-issue-hours">{d.hoursLost}h lost</span>
              </h5>
              <p>{d.description}</p>
              {d.impactedActivity && (
                <p className="sd-issue-sub">Impacted: {d.impactedActivity}</p>
              )}
            </div>
          ))}
          {log.issues.map((i) => (
            <div key={i.id} className="sd-issue-row warn">
              <h5>{pretty(i.issueType)}</h5>
              <p>{i.description}</p>
            </div>
          ))}
        </section>
      )}

      {log.photos.length > 0 && (
        <section className="sd-sec-card">
          <h3>Photos ({log.photos.length})</h3>
          <div className="sd-ph-grid">
            {log.photos.map((p) => (
              <div key={p.id} className="sd-ph-tile">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.caption ?? p.title}
                    className="sd-ph-img"
                    loading="lazy"
                  />
                ) : (
                  <span className="sd-ph-fallback">{p.title}</span>
                )}
                {p.caption && <div className="sd-ph-cap">{p.caption}</div>}
              </div>
            ))}
          </div>
          <p className="sd-hint" style={{ marginTop: 8 }}>
            <Link href={`/subcontractor/project/${projectId}/documents`}>
              View all in project documents →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}

function WxCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="sd-wx-cell">
      <div className="wxl">{label}</div>
      <div className="wxv">{value}</div>
    </div>
  );
}

function AckButton({
  entryId,
  onAcked,
}: {
  entryId: string;
  onAcked: () => void;
}) {
  const [acking, setAcking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ack = async () => {
    setAcking(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-log-crew-entries/${entryId}/ack`, {
        method: "POST",
      });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button className="sd-btn sm pri" onClick={ack} disabled={acking}>
        {acking ? "Acking…" : "Acknowledge"}
      </button>
      {error && <span className="sd-error">{error}</span>}
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

const SUB_DETAIL_CSS = `
.sdl-detail-root{padding:24px;
  --sd-s1:#fff;--sd-s2:#f3f4f6;--sd-s3:#e2e5e9;--sd-s4:#d1d5db;
  --sd-sh:#f5f6f8;--sd-sic:#f8f9fa;
  --sd-t1:#1a1714;--sd-t2:#6b655b;--sd-t3:#9c958a;--sd-ti:#faf9f7;
  --sd-ac:#3d6b8e;--sd-ac-s:#e6eff5;--sd-ac-t:#2d5577;--sd-ac-m:#b3cede;
  --sd-ok:#2d8a5e;--sd-ok-s:#edf7f1;--sd-ok-t:#1e6b46;
  --sd-wr:#c17a1a;--sd-wr-s:#fdf4e6;--sd-wr-t:#96600f;
  --sd-dg:#c93b3b;--sd-dg-s:#fdeaea;--sd-dg-t:#a52e2e;
  --sd-fd:'DM Sans',system-ui,sans-serif;
  --sd-fb:'Instrument Sans',system-ui,sans-serif;
  --sd-fm:'JetBrains Mono',monospace;
  font-family:var(--sd-fb);color:var(--sd-t1);font-size:14px;line-height:1.5;
}
.sdl-detail-root *{box-sizing:border-box}
.sd-back{margin-bottom:12px}
.sd-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:10px;border:1px solid var(--sd-s3);background:var(--sd-s1);color:var(--sd-t1);font-size:13px;font-weight:650;font-family:var(--sd-fb);cursor:pointer;text-decoration:none}
.sd-btn.ghost{background:transparent;border-color:transparent;color:var(--sd-t2)}
.sd-btn.ghost:hover{background:var(--sd-sh);color:var(--sd-t1)}
.sd-btn.pri{background:var(--sd-ac);color:var(--sd-ti);border-color:var(--sd-ac)}
.sd-btn.pri:hover{background:#345d7c}
.sd-btn:disabled{opacity:.55;cursor:not-allowed}
.sd-btn.sm{height:28px;font-size:11.5px;padding:0 10px}

.sd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:18px}
.sd-title{font-family:var(--sd-fd);font-size:26px;font-weight:820;letter-spacing:-.03em;margin:0}
.sd-meta{font-size:12.5px;color:var(--sd-t2);margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sd-meta .mono{font-family:var(--sd-fm);font-size:11.5px}

.sd-pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--sd-fd)}
.sd-pl.green{background:var(--sd-ok-s);color:var(--sd-ok-t)}
.sd-pl.amber{background:var(--sd-wr-s);color:var(--sd-wr-t)}
.sd-pl.gray{background:var(--sd-s2);color:var(--sd-t2)}

.sd-reco-banner{background:var(--sd-wr-s);border:1.5px solid rgba(193,122,26,.25);border-radius:14px;padding:14px 18px;margin-bottom:14px}
.sd-reco-banner h3{font-family:var(--sd-fd);font-size:14px;font-weight:740;color:var(--sd-wr-t);margin:0}
.sd-reco-banner p{font-size:12.5px;color:var(--sd-t2);margin:4px 0 0}

.sd-sec-card{background:var(--sd-s1);border:1px solid var(--sd-s3);border-radius:18px;padding:18px 22px;margin-bottom:14px}
.sd-sec-card h3{font-family:var(--sd-fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0 0 14px}
.sd-wx-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.sd-wx-cell{background:var(--sd-sic);border:1px solid var(--sd-s3);border-radius:10px;padding:10px 12px}
.sd-wx-cell .wxl{font-size:10.5px;color:var(--sd-t3);font-weight:620;text-transform:uppercase;letter-spacing:.04em}
.sd-wx-cell .wxv{font-family:var(--sd-fd);font-size:14px;font-weight:700;margin-top:3px}

.sd-crew-tbl{width:100%;border-collapse:collapse}
.sd-crew-tbl th{font-family:var(--sd-fd);font-size:11px;font-weight:700;color:var(--sd-t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:8px 12px;background:var(--sd-sic);border-bottom:1px solid var(--sd-s3)}
.sd-crew-tbl th:nth-child(3),.sd-crew-tbl th:nth-child(4),.sd-crew-tbl th:nth-child(5),.sd-crew-tbl td.num{text-align:right}
.sd-crew-tbl td{padding:10px 12px;border-bottom:1px solid var(--sd-s3);font-size:13px}
.sd-crew-tbl tr:last-child td{border-bottom:none}
.sd-crew-tbl tr.mine td{background:var(--sd-ac-s)}
.sd-crew-tbl td.org{font-weight:600;font-family:var(--sd-fm);font-size:12.5px}
.sd-crew-tbl td.trade{color:var(--sd-t2);font-size:12px}
.sd-crew-tbl td.num{font-family:var(--sd-fd);font-weight:680}
.sd-you{margin-left:8px;font-size:10px;color:var(--sd-ac-t);font-family:var(--sd-fd);font-weight:700;letter-spacing:.04em}

.sd-notes-body{font-size:13.5px;line-height:1.6;padding:12px 14px;background:var(--sd-sic);border-left:3px solid var(--sd-ac);border-radius:0 10px 10px 0;white-space:pre-wrap}
.sd-notes-body.own{border-left-color:var(--sd-ok);margin-bottom:8px}
.sd-issue-row{padding:10px 12px;background:var(--sd-wr-s);border:1px solid rgba(193,122,26,.2);border-radius:10px;margin-bottom:8px}
.sd-issue-row.warn{background:var(--sd-dg-s);border-color:rgba(201,59,59,.2)}
.sd-issue-row h5{font-family:var(--sd-fd);font-size:12.5px;font-weight:680;color:var(--sd-wr-t);margin:0}
.sd-issue-row.warn h5{color:var(--sd-dg-t)}
.sd-issue-row p{font-size:12.5px;color:var(--sd-t2);line-height:1.5;margin:4px 0 0}
.sd-issue-hours{font-weight:560;font-family:var(--sd-fm);font-size:11.5px}
.sd-issue-sub{font-size:11.5px;color:var(--sd-t3)}

.sd-ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.sd-ph-tile{aspect-ratio:1;background:linear-gradient(135deg,var(--sd-s2),var(--sd-s3));border-radius:10px;position:relative;overflow:hidden;display:grid;place-items:center;color:var(--sd-t3);border:1px solid var(--sd-s3)}
.sd-ph-img{width:100%;height:100%;object-fit:cover;display:block}
.sd-ph-fallback{font-size:11px;text-align:center;padding:8px}
.sd-ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(20,18,14,.7));color:white;font-size:10.5px;font-weight:570;line-height:1.2}

.sd-empty{font-size:13px;color:var(--sd-t2);padding:12px 0;text-align:center}
.sd-hint{font-size:11.5px;color:var(--sd-t3)}
.sd-error{color:var(--sd-dg-t);font-size:11px}

@media (max-width:960px){
  .sd-wx-grid{grid-template-columns:repeat(2,1fr)}
  .sd-ph-grid{grid-template-columns:repeat(2,1fr)}
}
`;
