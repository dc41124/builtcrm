"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DailyLogDetailFull } from "@/domain/loaders/daily-logs";

// Amendable fields mirror the server-side AMENDABLE_FIELDS whitelist
// in /api/daily-logs/[id]/amend. Keep in sync.
const AMENDABLE_FIELDS: Array<{
  key:
    | "notes"
    | "clientSummary"
    | "milestone"
    | "weatherHighC"
    | "weatherLowC"
    | "weatherPrecipPct";
  label: string;
  kind: "text" | "number";
  getBefore: (l: DailyLogDetailFull) => string | number | null;
}> = [
  {
    key: "notes",
    label: "Work performed (contractor notes)",
    kind: "text",
    getBefore: (l) => l.notes,
  },
  {
    key: "clientSummary",
    label: "Client-facing summary",
    kind: "text",
    getBefore: (l) => l.clientSummary,
  },
  {
    key: "milestone",
    label: "Milestone",
    kind: "text",
    getBefore: (l) => l.milestone,
  },
  {
    key: "weatherHighC",
    label: "Weather · High (°C)",
    kind: "number",
    getBefore: (l) => l.weather.highC,
  },
  {
    key: "weatherLowC",
    label: "Weather · Low (°C)",
    kind: "number",
    getBefore: (l) => l.weather.lowC,
  },
  {
    key: "weatherPrecipPct",
    label: "Weather · Precip %",
    kind: "number",
    getBefore: (l) => l.weather.precipPct,
  },
];

export function ContractorDailyLogDetail({
  projectId,
  log,
}: {
  projectId: string;
  log: DailyLogDetailFull;
}) {
  const totalHeadcount = log.crew.reduce((a, c) => a + c.headcount, 0);
  const totalHours = log.crew.reduce((a, c) => a + c.hours, 0);
  const editable = isEditable(log.editWindowClosesAt);
  const [mode, setMode] = useState<null | "edit" | "amend" | "photo">(null);

  return (
    <div className="dl-root dl-detail">
      <style>{DETAIL_CSS}</style>

      <div className="dl-back">
        <Link
          href={`/contractor/project/${projectId}/daily-logs`}
          className="dl-btn ghost"
        >
          ← Back to daily logs
        </Link>
      </div>

      <header className="dl-d-head">
        <div>
          <h1 className="dl-d-title">{formatDateLong(log.logDate)}</h1>
          <div className="dl-d-meta">
            <span className="mono">{log.id.slice(0, 8)}</span>
            <span>·</span>
            <span>Reported by {log.reportedByName ?? "—"}</span>
            <span>·</span>
            <span
              className={`dl-pl ${log.status === "submitted" ? "green" : "amber"}`}
            >
              {log.status === "submitted" ? "Submitted" : "Draft"}
            </span>
            {editable && (
              <span className="dl-pl amber">
                {hoursLeft(log.editWindowClosesAt)}h edit window
              </span>
            )}
          </div>
        </div>
        <div className="dl-d-acts">
          <a
            className="dl-btn"
            href={`/api/daily-logs/${log.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download PDF
          </a>
          {editable ? (
            <button className="dl-btn pri" onClick={() => setMode("edit")}>
              Edit log
            </button>
          ) : (
            <button className="dl-btn pri" onClick={() => setMode("amend")}>
              Request amendment
            </button>
          )}
        </div>
      </header>

      <section className="dl-sec-card">
        <h3>Weather</h3>
        <div className="dl-wx-grid">
          <Cell
            label="Conditions"
            value={
              log.weather.conditions ? pretty(log.weather.conditions) : "—"
            }
          />
          <Cell
            label="High"
            value={log.weather.highC != null ? `${log.weather.highC}°C` : "—"}
          />
          <Cell
            label="Low"
            value={log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"}
          />
          <Cell
            label="Precip"
            value={
              log.weather.precipPct != null ? `${log.weather.precipPct}%` : "—"
            }
          />
          <Cell
            label="Wind"
            value={
              log.weather.windKmh != null ? `${log.weather.windKmh} km/h` : "—"
            }
          />
        </div>
        {log.weather.source === "api" && (
          <p className="dl-wx-source">
            Auto-filled via weather service
            {log.weather.capturedAt
              ? ` · ${new Date(log.weather.capturedAt).toLocaleString()}`
              : ""}
          </p>
        )}
      </section>

      <section className="dl-sec-card">
        <h3>Crew on site</h3>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {log.crew.map((c) => (
                <tr key={c.id}>
                  <td className="org">{c.orgName}</td>
                  <td className="trade">{c.trade ?? "—"}</td>
                  <td className="num">
                    {c.reconciledHeadcount ?? c.headcount}
                    {c.reconciledHeadcount != null &&
                      c.reconciledHeadcount !== c.headcount && (
                        <span className="dl-reco-from">
                          {" "}
                          (from {c.headcount})
                        </span>
                      )}
                  </td>
                  <td className="num">
                    {c.reconciledHours ?? c.hours}
                    {c.reconciledHours != null && c.reconciledHours !== c.hours && (
                      <span className="dl-reco-from"> (from {c.hours})</span>
                    )}
                  </td>
                  <td className="num">
                    {c.requiresAck && (
                      <span className="dl-pl amber">Unacked</span>
                    )}
                    {c.submittedByRole === "contractor" && !c.requiresAck && (
                      <span className="dl-pl gray">GC-entered</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Total</td>
                <td className="num">{totalHeadcount}</td>
                <td className="num">{totalHours.toFixed(1)} hrs</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {log.notes && (
        <section className="dl-sec-card">
          <h3>Work performed</h3>
          <div className="dl-notes-body">{log.notes}</div>
        </section>
      )}

      {log.clientSummary && (
        <section className="dl-sec-card">
          <h3>Client-facing summary</h3>
          <div className="dl-notes-body client">{log.clientSummary}</div>
          {log.clientHighlights && log.clientHighlights.length > 0 && (
            <ul className="dl-highlights">
              {log.clientHighlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          {log.milestone && (
            <div className="dl-milestone">
              <span
                className={`dl-pl ${
                  log.milestoneType === "warn"
                    ? "amber"
                    : log.milestoneType === "info"
                      ? "blue"
                      : "green"
                }`}
              >
                Milestone
              </span>
              <span>{log.milestone}</span>
            </div>
          )}
        </section>
      )}

      {(log.delays.length > 0 || log.issues.length > 0) && (
        <section className="dl-sec-card">
          <h3>Delays &amp; issues</h3>
          {log.delays.map((d) => (
            <div key={d.id} className="dl-issue-row">
              <h5>
                {pretty(d.delayType)}{" "}
                <span className="dl-issue-hours">
                  {d.hoursLost}h lost
                </span>
              </h5>
              <p>{d.description}</p>
              {d.impactedActivity && (
                <p className="dl-issue-sub">Impacted: {d.impactedActivity}</p>
              )}
            </div>
          ))}
          {log.issues.map((i) => (
            <div key={i.id} className="dl-issue-row warn">
              <h5>{pretty(i.issueType)}</h5>
              <p>{i.description}</p>
            </div>
          ))}
        </section>
      )}

      <section className="dl-sec-card">
        <div className="dl-ph-header">
          <h3>Photos ({log.photos.length})</h3>
          <button className="dl-btn sm" onClick={() => setMode("photo")}>
            + Attach photos
          </button>
        </div>
        {log.photos.length === 0 ? (
          <p className="dl-empty">No photos attached yet.</p>
        ) : (
          <div className="dl-ph-grid">
            {log.photos.map((p) => (
              <div key={p.id} className="dl-ph-tile">
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
                {p.isHero && <span className="dl-pl blue dl-ph-hero">Hero</span>}
                {p.caption && <div className="dl-ph-cap">{p.caption}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {log.amendments.length > 0 && (
        <section className="dl-sec-card">
          <h3>Amendments</h3>
          {log.amendments.map((a) => (
            <AmendmentItem key={a.id} amendment={a} />
          ))}
        </section>
      )}

      {mode === "edit" && (
        <EditLogDrawer log={log} onClose={() => setMode(null)} />
      )}
      {mode === "amend" && (
        <AmendLogDrawer log={log} onClose={() => setMode(null)} />
      )}
      {mode === "photo" && (
        <PhotoUploadDrawer
          log={log}
          projectId={projectId}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

function EditLogDrawer({
  log,
  onClose,
}: {
  log: DailyLogDetailFull;
  onClose: () => void;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(log.notes ?? "");
  const [clientSummary, setClientSummary] = useState(log.clientSummary ?? "");
  const [highC, setHighC] = useState<number | "">(log.weather.highC ?? "");
  const [lowC, setLowC] = useState<number | "">(log.weather.lowC ?? "");
  const [precipPct, setPrecipPct] = useState<number | "">(
    log.weather.precipPct ?? "",
  );
  const [milestone, setMilestone] = useState(log.milestone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const refreshWeather = async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch(
        `/api/daily-logs/weather-prefill?projectId=${log.projectId}&date=${log.logDate}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setRefreshMsg(
          data.message ??
            "Weather service returned no data for that date. Enter manually.",
        );
        return;
      }
      const data = (await res.json()) as {
        weather: {
          conditions: string;
          highC: number | null;
          lowC: number | null;
          precipPct: number | null;
          windKmh: number | null;
        };
      };
      setHighC(data.weather.highC ?? "");
      setLowC(data.weather.lowC ?? "");
      setPrecipPct(data.weather.precipPct ?? "");
      setRefreshMsg("Refreshed from Open-Meteo. Save to apply.");
    } finally {
      setRefreshing(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || null,
          clientSummary: clientSummary || null,
          milestone: milestone || null,
          weather: {
            highC: highC === "" ? null : Number(highC),
            lowC: lowC === "" ? null : Number(lowC),
            precipPct: precipPct === "" ? null : Number(precipPct),
          },
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
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dl-drawer-ovl" onClick={onClose} />
      <aside className="dl-drawer dl-edit-drawer" role="dialog" aria-modal="true">
        <div className="dl-dr-head">
          <div className="dl-dr-head-l">
            <h2>Edit daily log</h2>
            <div className="dl-dh-meta">
              <span>Within the 24-hour edit window — changes save in place.</span>
            </div>
          </div>
          <button className="dl-dr-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dl-dr-body">
          <div className="dl-sec">
            <div className="dl-sec-h">Work performed</div>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="dl-edit-input"
            />
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">Client summary</div>
            <textarea
              rows={4}
              value={clientSummary}
              onChange={(e) => setClientSummary(e.target.value)}
              className="dl-edit-input"
            />
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">Milestone</div>
            <input
              type="text"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              placeholder="Optional"
              className="dl-edit-input"
            />
          </div>

          <div className="dl-sec">
            <div
              className="dl-sec-h"
              style={{ justifyContent: "space-between", display: "flex" }}
            >
              <span>Weather corrections</span>
              <button
                type="button"
                className="dl-btn sm"
                onClick={refreshWeather}
                disabled={refreshing}
                style={{ textTransform: "none", letterSpacing: 0 }}
              >
                {refreshing ? "Refreshing…" : "Refresh from service"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label className="dl-edit-field">
                <span>High (°C)</span>
                <input
                  type="number"
                  value={highC}
                  onChange={(e) =>
                    setHighC(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="dl-edit-input"
                />
              </label>
              <label className="dl-edit-field">
                <span>Low (°C)</span>
                <input
                  type="number"
                  value={lowC}
                  onChange={(e) =>
                    setLowC(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="dl-edit-input"
                />
              </label>
              <label className="dl-edit-field">
                <span>Precip %</span>
                <input
                  type="number"
                  value={precipPct}
                  onChange={(e) =>
                    setPrecipPct(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="dl-edit-input"
                />
              </label>
            </div>
            {refreshMsg && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--dl-t3)",
                  marginTop: 8,
                }}
              >
                {refreshMsg}
              </p>
            )}
          </div>

          {error && <div className="dl-edit-err">{error}</div>}
        </div>
        <div className="dl-dr-foot">
          <button className="dl-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="dl-btn pri" onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </aside>
    </>
  );
}

function AmendLogDrawer({
  log,
  onClose,
}: {
  log: DailyLogDetailFull;
  onClose: () => void;
}) {
  const router = useRouter();
  const [field, setField] = useState<(typeof AMENDABLE_FIELDS)[number]["key"]>(
    "notes",
  );
  const current = AMENDABLE_FIELDS.find((f) => f.key === field) ?? AMENDABLE_FIELDS[0];
  const beforeValue = current.getBefore(log);
  const [after, setAfter] = useState<string>(
    beforeValue == null ? "" : String(beforeValue),
  );
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFieldChange = (nextKey: typeof field) => {
    setField(nextKey);
    const next = AMENDABLE_FIELDS.find((f) => f.key === nextKey);
    const nextBefore = next ? next.getBefore(log) : null;
    setAfter(nextBefore == null ? "" : String(nextBefore));
  };

  const submit = async () => {
    if (!summary.trim()) {
      setError("Add a short reason for the amendment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const afterValue: string | number | null =
        current.kind === "number"
          ? after === ""
            ? null
            : Number(after)
          : after === ""
            ? null
            : after;
      const res = await fetch(`/api/daily-logs/${log.id}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeSummary: summary,
          changedFields: {
            [field]: {
              before: beforeValue,
              after: afterValue,
            },
          },
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
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dl-drawer-ovl" onClick={onClose} />
      <aside className="dl-drawer dl-edit-drawer" role="dialog" aria-modal="true">
        <div className="dl-dr-head">
          <div className="dl-dr-head-l">
            <h2>Request amendment</h2>
            <div className="dl-dh-meta">
              <span>
                The 24-hour edit window has closed. Amendments go through review.
              </span>
            </div>
          </div>
          <button className="dl-dr-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dl-dr-body">
          <div className="dl-sec">
            <div className="dl-sec-h">Field to amend</div>
            <select
              value={field}
              onChange={(e) =>
                onFieldChange(e.target.value as typeof field)
              }
              className="dl-edit-input"
            >
              {AMENDABLE_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">Current value</div>
            <div className="dl-notes-body">
              {beforeValue == null || beforeValue === ""
                ? "(empty)"
                : String(beforeValue)}
            </div>
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">Proposed value</div>
            {current.kind === "text" ? (
              <textarea
                rows={4}
                value={after}
                onChange={(e) => setAfter(e.target.value)}
                className="dl-edit-input"
              />
            ) : (
              <input
                type="number"
                value={after}
                onChange={(e) => setAfter(e.target.value)}
                className="dl-edit-input"
              />
            )}
          </div>

          <div className="dl-sec">
            <div className="dl-sec-h">Reason for amendment</div>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Why this needs to change (e.g. timesheet reconciliation, corrected weather source)."
              className="dl-edit-input"
            />
          </div>

          {error && <div className="dl-edit-err">{error}</div>}
        </div>
        <div className="dl-dr-foot">
          <button className="dl-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="dl-btn pri" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit amendment"}
          </button>
        </div>
      </aside>
    </>
  );
}

type StagedPhoto = {
  id: string; // local uuid
  file: File;
  previewUrl: string;
  caption: string;
  isHero: boolean;
  status: "staged" | "uploading" | "linking" | "done" | "error";
  error?: string;
};

function PhotoUploadDrawer({
  log,
  projectId,
  onClose,
}: {
  log: DailyLogDetailFull;
  projectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: StagedPhoto[] = [];
    for (const file of Array.from(files)) {
      next.push({
        id: cryptoRandom(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        isHero: false,
        status: "staged",
      });
    }
    setStaged((p) => [...p, ...next]);
  };

  const setHero = (id: string) => {
    setStaged((p) =>
      p.map((s) => ({ ...s, isHero: s.id === id ? !s.isHero : false })),
    );
  };

  const updateCaption = (id: string, caption: string) => {
    setStaged((p) => p.map((s) => (s.id === id ? { ...s, caption } : s)));
  };

  const remove = (id: string) => {
    setStaged((p) => {
      const match = p.find((s) => s.id === id);
      if (match) URL.revokeObjectURL(match.previewUrl);
      return p.filter((s) => s.id !== id);
    });
  };

  const uploadAll = async () => {
    if (staged.length === 0) {
      setGlobalError("Pick at least one photo to upload.");
      return;
    }
    setSubmitting(true);
    setGlobalError(null);

    // Sequential upload — keeps the UI status updates readable and
    // sidesteps the unlikely-but-possible R2 rate limit. Portfolio scope.
    for (const item of staged) {
      if (item.status === "done") continue;
      try {
        setStaged((p) =>
          p.map((s) => (s.id === item.id ? { ...s, status: "uploading", error: undefined } : s)),
        );

        // 1. Presign
        const reqRes = await fetch("/api/upload/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            filename: item.file.name,
            contentType: item.file.type || "application/octet-stream",
            documentType: "daily_log_photo",
          }),
        });
        if (!reqRes.ok) throw new Error("Presign failed");
        const { uploadUrl, storageKey } = (await reqRes.json()) as {
          uploadUrl: string;
          storageKey: string;
        };

        // 2. PUT to R2
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": item.file.type || "application/octet-stream",
          },
          body: item.file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        // 3. Finalize document
        const finRes = await fetch("/api/upload/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            storageKey,
            title: item.file.name,
            documentType: "daily_log_photo",
            visibilityScope: "project_wide",
            audienceScope: "internal",
          }),
        });
        if (!finRes.ok) throw new Error("Finalize failed");
        const { documentId } = (await finRes.json()) as { documentId: string };

        // 4. Link to the daily log
        setStaged((p) =>
          p.map((s) => (s.id === item.id ? { ...s, status: "linking" } : s)),
        );
        const linkRes = await fetch("/api/daily-log-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailyLogId: log.id,
            documentId,
            caption: item.caption || null,
            isHero: item.isHero,
            sortOrder: staged.findIndex((s) => s.id === item.id),
          }),
        });
        if (!linkRes.ok) {
          const data = (await linkRes.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(data.message ?? "Link to log failed");
        }

        setStaged((p) =>
          p.map((s) => (s.id === item.id ? { ...s, status: "done" } : s)),
        );
      } catch (err) {
        setStaged((p) =>
          p.map((s) =>
            s.id === item.id
              ? {
                  ...s,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : s,
          ),
        );
      }
    }

    setSubmitting(false);
    // If every file is done, close and refresh. Otherwise leave the
    // drawer open so the user can see which failed and retry.
    const latest = await new Promise<StagedPhoto[]>((resolve) => {
      setStaged((p) => {
        resolve(p);
        return p;
      });
    });
    if (latest.every((s) => s.status === "done")) {
      onClose();
      router.refresh();
    }
  };

  return (
    <>
      <div className="dl-drawer-ovl" onClick={onClose} />
      <aside
        className="dl-drawer dl-edit-drawer"
        role="dialog"
        aria-modal="true"
      >
        <div className="dl-dr-head">
          <div className="dl-dr-head-l">
            <h2>Attach photos</h2>
            <div className="dl-dh-meta">
              <span>Upload jobsite photos for this daily log.</span>
            </div>
          </div>
          <button className="dl-dr-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dl-dr-body">
          <label className="dl-photo-picker">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              disabled={submitting}
              style={{ display: "none" }}
            />
            <span className="dl-photo-picker-inner">
              <span className="dl-photo-picker-plus">+</span>
              <span>Click to pick photos</span>
              <span className="dl-photo-picker-hint">
                JPG / PNG / HEIC · multi-select allowed
              </span>
            </span>
          </label>

          {staged.length > 0 && (
            <div className="dl-photo-list">
              {staged.map((s) => (
                <div key={s.id} className="dl-photo-row">
                  <div className="dl-photo-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.previewUrl} alt={s.file.name} />
                    {s.isHero && (
                      <span className="dl-pl blue dl-photo-thumb-hero">
                        Hero
                      </span>
                    )}
                  </div>
                  <div className="dl-photo-fields">
                    <input
                      type="text"
                      placeholder="Caption (optional)"
                      value={s.caption}
                      onChange={(e) => updateCaption(s.id, e.target.value)}
                      className="dl-edit-input"
                      disabled={submitting}
                    />
                    <div className="dl-photo-row-acts">
                      <label className="dl-photo-hero-toggle">
                        <input
                          type="checkbox"
                          checked={s.isHero}
                          onChange={() => setHero(s.id)}
                          disabled={submitting}
                        />
                        <span>Hero photo</span>
                      </label>
                      <span className={`dl-photo-status ${s.status}`}>
                        {s.status === "staged"
                          ? "Ready"
                          : s.status === "uploading"
                            ? "Uploading…"
                            : s.status === "linking"
                              ? "Linking…"
                              : s.status === "done"
                                ? "✓ Done"
                                : s.error ?? "Failed"}
                      </span>
                      {s.status !== "done" && (
                        <button
                          className="dl-btn sm ghost"
                          onClick={() => remove(s.id)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {globalError && <div className="dl-edit-err">{globalError}</div>}
        </div>
        <div className="dl-dr-foot">
          <button className="dl-btn ghost" onClick={onClose}>
            {staged.some((s) => s.status === "done") ? "Close" : "Cancel"}
          </button>
          <button
            className="dl-btn pri"
            onClick={uploadAll}
            disabled={submitting || staged.length === 0}
          >
            {submitting ? "Uploading…" : `Upload ${staged.length || ""}`.trim()}
          </button>
        </div>
      </aside>
    </>
  );
}

function cryptoRandom(): string {
  // Node + browser crypto both have randomUUID() now. Safe everywhere
  // we run this client component.
  return (
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );
}

// Inline review panel for a single amendment. Pending rows get
// Approve / Reject buttons with an optional review note; reviewed
// rows just show the final state + any note the reviewer left.
function AmendmentItem({
  amendment,
}: {
  amendment: DailyLogDetailFull["amendments"][number];
}) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState<null | "approved" | "rejected">(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const isPending = amendment.status === "pending";

  const decide = async (status: "approved" | "rejected") => {
    setSubmitting(status);
    setError(null);
    try {
      const res = await fetch(`/api/daily-log-amendments/${amendment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote: reviewNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(data.message ?? data.error ?? "Review failed");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="dl-amd-item">
      <div className="dl-amd-top">
        <span
          className={`dl-pl ${
            amendment.status === "pending"
              ? "amber"
              : amendment.status === "approved"
                ? "green"
                : "gray"
          }`}
        >
          {pretty(amendment.status)}
        </span>
        <span>{amendment.requestedByName ?? "—"}</span>
        <span className="dl-amd-time">
          {new Date(amendment.requestedAt).toLocaleString()}
        </span>
      </div>
      <p>{amendment.changeSummary}</p>
      <div className="dl-amd-fields">
        {Object.entries(amendment.changedFields).map(([field, diff]) => {
          const d = diff as { before: unknown; after: unknown };
          return (
            <span key={field} className="dl-amd-diff">
              <strong>{field}:</strong>{" "}
              <span className="dl-amd-before">{formatDiffValue(d.before)}</span>
              {" → "}
              <span className="dl-amd-after">{formatDiffValue(d.after)}</span>
            </span>
          );
        })}
      </div>
      {amendment.reviewNote && (
        <p className="dl-amd-review">Review note: {amendment.reviewNote}</p>
      )}
      {isPending && (
        <div className="dl-amd-review-panel">
          <textarea
            rows={2}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional review note…"
            className="dl-edit-input"
          />
          {error && <div className="dl-edit-err">{error}</div>}
          <div className="dl-amd-review-acts">
            <button
              className="dl-btn sm"
              onClick={() => decide("rejected")}
              disabled={submitting !== null}
            >
              {submitting === "rejected" ? "Rejecting…" : "Reject"}
            </button>
            <button
              className="dl-btn sm pri"
              onClick={() => decide("approved")}
              disabled={submitting !== null}
            >
              {submitting === "approved" ? "Approving…" : "Approve"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDiffValue(v: unknown): string {
  if (v == null || v === "") return "(empty)";
  if (typeof v === "string") {
    const s = v.length > 80 ? v.slice(0, 77) + "…" : v;
    return `"${s}"`;
  }
  return String(v);
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="dl-wx-cell">
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

function isEditable(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function hoursLeft(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (60 * 60 * 1000)));
}

const DETAIL_CSS = `
.dl-detail{padding:24px;--dl-s1:#fff;--dl-s2:#f3f4f6;--dl-s3:#e2e5e9;--dl-s4:#d1d5db;
  --dl-sh:#f5f6f8;--dl-sic:#f8f9fa;
  --dl-t1:#1a1714;--dl-t2:#6b655b;--dl-t3:#9c958a;--dl-ti:#faf9f7;
  --dl-ac:#5b4fc7;--dl-ac-s:#ece9fb;--dl-ac-t:#4337a0;--dl-ac-m:#c5bef0;
  --dl-ok:#2d8a5e;--dl-ok-s:#edf7f1;--dl-ok-t:#1e6b46;
  --dl-wr:#c17a1a;--dl-wr-s:#fdf4e6;--dl-wr-t:#96600f;
  --dl-dg:#c93b3b;--dl-dg-s:#fdeaea;--dl-dg-t:#a52e2e;
  --dl-fd:'DM Sans',system-ui,sans-serif;
  --dl-fb:'Instrument Sans',system-ui,sans-serif;
  --dl-fm:'JetBrains Mono',monospace;
  font-family:var(--dl-fb);color:var(--dl-t1);font-size:14px;line-height:1.5;
}
.dl-detail *{box-sizing:border-box}
.dl-detail .dl-back{margin-bottom:12px}
.dl-detail .dl-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:10px;border:1px solid var(--dl-s3);background:var(--dl-s1);color:var(--dl-t1);font-size:13px;font-weight:650;font-family:var(--dl-fb);cursor:pointer;text-decoration:none}
.dl-detail .dl-btn.ghost{background:transparent;border-color:transparent;color:var(--dl-t2)}
.dl-detail .dl-btn.ghost:hover{background:var(--dl-sh);color:var(--dl-t1)}
.dl-detail .dl-btn.pri{background:var(--dl-ac);color:var(--dl-ti);border-color:var(--dl-ac)}
.dl-detail .dl-btn:disabled{opacity:.55;cursor:not-allowed}
.dl-d-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:24px}
.dl-d-title{font-family:var(--dl-fd);font-size:26px;font-weight:820;letter-spacing:-.03em;margin:0}
.dl-d-meta{font-size:12.5px;color:var(--dl-t2);margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dl-d-meta .mono{font-family:var(--dl-fm);font-size:11.5px}
.dl-detail .dl-pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--dl-fd)}
.dl-detail .dl-pl.amber{background:var(--dl-wr-s);color:var(--dl-wr-t)}
.dl-detail .dl-pl.green{background:var(--dl-ok-s);color:var(--dl-ok-t)}
.dl-detail .dl-pl.blue{background:var(--dl-ac-s);color:var(--dl-ac-t)}
.dl-detail .dl-pl.gray{background:var(--dl-s2);color:var(--dl-t2)}
.dl-detail .dl-pl.red{background:var(--dl-dg-s);color:var(--dl-dg-t)}

.dl-sec-card{background:var(--dl-s1);border:1px solid var(--dl-s3);border-radius:18px;padding:18px 22px;margin-bottom:16px}
.dl-sec-card h3{font-family:var(--dl-fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0 0 14px}
.dl-wx-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.dl-wx-cell{background:var(--dl-sic);border:1px solid var(--dl-s3);border-radius:10px;padding:10px 12px}
.dl-wx-cell .wxl{font-size:10.5px;color:var(--dl-t3);font-weight:620;text-transform:uppercase;letter-spacing:.04em}
.dl-wx-cell .wxv{font-family:var(--dl-fd);font-size:14px;font-weight:700;margin-top:3px}
.dl-wx-source{font-size:11.5px;color:var(--dl-t3);margin:8px 0 0}

.dl-crew-tbl{width:100%;border-collapse:collapse}
.dl-crew-tbl th{font-family:var(--dl-fd);font-size:11px;font-weight:700;color:var(--dl-t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:8px 12px;background:var(--dl-sic);border-bottom:1px solid var(--dl-s3)}
.dl-crew-tbl th:nth-child(3),.dl-crew-tbl th:nth-child(4),.dl-crew-tbl td.num{text-align:right}
.dl-crew-tbl td{padding:10px 12px;border-bottom:1px solid var(--dl-s3);font-size:13px}
.dl-crew-tbl tr:last-child td{border-bottom:none}
.dl-crew-tbl td.org{font-weight:600;font-family:var(--dl-fm);font-size:12.5px}
.dl-crew-tbl td.trade{color:var(--dl-t2);font-size:12px}
.dl-crew-tbl td.num{font-family:var(--dl-fd);font-weight:680}
.dl-crew-tbl tr.total td{background:var(--dl-sic);font-weight:740;border-bottom:none}
.dl-reco-from{color:var(--dl-wr-t);font-weight:540;font-size:11.5px;margin-left:4px;font-family:var(--dl-fb)}

.dl-notes-body{font-size:13.5px;line-height:1.6;padding:12px 14px;background:var(--dl-sic);border-left:3px solid var(--dl-ac);border-radius:0 10px 10px 0;white-space:pre-wrap}
.dl-notes-body.client{border-left-color:var(--dl-ok)}
.dl-highlights{margin:12px 0 0 18px;padding:0;font-size:13px;color:var(--dl-t2);line-height:1.7}
.dl-milestone{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px}

.dl-issue-row{padding:10px 12px;background:var(--dl-wr-s);border:1px solid rgba(193,122,26,.2);border-radius:10px;margin-bottom:8px}
.dl-issue-row.warn{background:var(--dl-dg-s);border-color:rgba(201,59,59,.2)}
.dl-issue-row h5{font-family:var(--dl-fd);font-size:12.5px;font-weight:680;color:var(--dl-wr-t);margin:0}
.dl-issue-row.warn h5{color:var(--dl-dg-t)}
.dl-issue-row p{font-size:12.5px;color:var(--dl-t2);line-height:1.5;margin:4px 0 0}
.dl-issue-hours{font-weight:560;font-family:var(--dl-fm);font-size:11.5px}
.dl-issue-sub{font-size:11.5px;color:var(--dl-t3)}

.dl-ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.dl-ph-tile{aspect-ratio:1;background:linear-gradient(135deg,var(--dl-s2),var(--dl-s3));border-radius:10px;position:relative;overflow:hidden;display:grid;place-items:center;color:var(--dl-t3);border:1px solid var(--dl-s3)}
.dl-ph-img{width:100%;height:100%;object-fit:cover;display:block}
.dl-ph-fallback{font-size:11px;text-align:center;padding:8px}
.dl-ph-hero{position:absolute;top:6px;right:6px}
.dl-ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(20,18,14,.7));color:white;font-size:10.5px;font-weight:570;line-height:1.2}

.dl-amd-item{padding:12px;border:1px solid var(--dl-s3);border-radius:10px;margin-bottom:10px}
.dl-amd-top{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--dl-t2);font-weight:560;margin-bottom:6px}
.dl-amd-top .dl-amd-time{margin-left:auto;color:var(--dl-t3);font-family:var(--dl-fm);font-size:11px}
.dl-amd-item p{font-size:13px;margin:0 0 8px}
.dl-amd-fields{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}
.dl-amd-diff{font-size:12px;color:var(--dl-t2);font-family:var(--dl-fb);background:var(--dl-sic);padding:6px 10px;border-radius:8px}
.dl-amd-diff strong{font-family:var(--dl-fd);color:var(--dl-t1);font-weight:720;margin-right:4px}
.dl-amd-before{color:var(--dl-t3);text-decoration:line-through}
.dl-amd-after{color:var(--dl-ok-t);font-weight:620}
.dl-amd-review{font-size:12px;color:var(--dl-t2);margin-top:6px}
.dl-amd-review-panel{margin-top:10px;padding-top:10px;border-top:1px dashed var(--dl-s3);display:flex;flex-direction:column;gap:8px}
.dl-amd-review-acts{display:flex;justify-content:flex-end;gap:8px}

/* Photo upload drawer */
.dl-ph-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.dl-ph-header h3{margin:0}
.dl-photo-picker{display:block;border:2px dashed var(--dl-s3);border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:all 120ms cubic-bezier(.16,1,.3,1);background:var(--dl-sic);margin-bottom:16px}
.dl-photo-picker:hover{border-color:var(--dl-ac);background:var(--dl-ac-s)}
.dl-photo-picker-inner{display:flex;flex-direction:column;align-items:center;gap:4px}
.dl-photo-picker-plus{width:40px;height:40px;border-radius:50%;background:var(--dl-ac-s);color:var(--dl-ac-t);display:grid;place-items:center;font-size:22px;font-weight:700;margin-bottom:6px}
.dl-photo-picker-hint{font-size:11.5px;color:var(--dl-t3)}
.dl-photo-list{display:flex;flex-direction:column;gap:12px}
.dl-photo-row{display:flex;gap:12px;border:1px solid var(--dl-s3);border-radius:12px;padding:10px}
.dl-photo-thumb{width:88px;height:88px;border-radius:10px;overflow:hidden;flex-shrink:0;position:relative;background:var(--dl-s2)}
.dl-photo-thumb img{width:100%;height:100%;object-fit:cover}
.dl-photo-thumb-hero{position:absolute;top:4px;right:4px;font-size:9px;height:18px;padding:0 6px}
.dl-photo-fields{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.dl-photo-row-acts{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.dl-photo-hero-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dl-t2);cursor:pointer}
.dl-photo-status{font-size:11.5px;font-weight:620;font-family:var(--dl-fd);color:var(--dl-t2);margin-left:auto}
.dl-photo-status.uploading,.dl-photo-status.linking{color:var(--dl-wr-t)}
.dl-photo-status.done{color:var(--dl-ok-t)}
.dl-photo-status.error{color:var(--dl-dg-t)}

.dl-empty{font-size:13px;color:var(--dl-t2);padding:12px 0;text-align:center}

/* Edit / amend drawers — shared shape with the list workspace drawer. */
.dl-drawer-ovl{position:fixed;inset:0;background:rgba(20,18,14,.4);backdrop-filter:blur(3px);z-index:100}
.dl-drawer{position:fixed;top:0;right:0;width:560px;max-width:100vw;height:100vh;background:var(--dl-s1);z-index:101;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(26,23,20,.14);border-left:1px solid var(--dl-s3);animation:dl-drawer-in 240ms cubic-bezier(.16,1,.3,1)}
@keyframes dl-drawer-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
.dl-dr-head{padding:16px 24px;border-bottom:1px solid var(--dl-s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.dl-dr-head-l h2{font-family:var(--dl-fd);font-size:20px;font-weight:780;letter-spacing:-.02em;margin:0}
.dl-dh-meta{font-size:12.5px;color:var(--dl-t2);margin-top:4px}
.dl-dr-close{width:32px;height:32px;border-radius:10px;border:1px solid var(--dl-s3);background:var(--dl-s1);color:var(--dl-t2);display:grid;place-items:center;cursor:pointer;font-size:18px;line-height:1}
.dl-dr-close:hover{background:var(--dl-sh);color:var(--dl-t1)}
.dl-dr-body{flex:1;overflow-y:auto;padding:20px 24px}
.dl-dr-foot{padding:14px 24px;border-top:1px solid var(--dl-s3);display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--dl-sic)}
.dl-sec{margin-bottom:20px}
.dl-sec-h{font-family:var(--dl-fd);font-size:11.5px;font-weight:720;color:var(--dl-t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.dl-edit-field{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--dl-t2);font-family:var(--dl-fd);font-weight:680;text-transform:uppercase;letter-spacing:.04em}
.dl-edit-input{width:100%;border:1px solid var(--dl-s3);background:var(--dl-s1);border-radius:10px;padding:8px 12px;font-family:var(--dl-fb);font-size:13px;color:var(--dl-t1);outline:none}
.dl-edit-input:focus{border-color:var(--dl-ac);box-shadow:0 0 0 3px rgba(91,79,199,.15)}
textarea.dl-edit-input{resize:vertical;line-height:1.5}
.dl-edit-err{background:var(--dl-dg-s);color:var(--dl-dg-t);padding:8px 12px;border-radius:8px;font-size:12.5px;margin-top:12px}

@media (max-width:960px){
  .dl-wx-grid{grid-template-columns:repeat(2,1fr)}
  .dl-ph-grid{grid-template-columns:repeat(2,1fr)}
  .dl-drawer{width:100vw}
}
`;
