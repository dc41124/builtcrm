"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { PrequalFormRenderer } from "@/components/prequal/PrequalFormRenderer";
import type {
  PrequalSubmissionDetail,
  PrequalSubmissionListRow,
  PrequalQueueView,
} from "@/domain/loaders/prequal";
import type { PrequalQuestion } from "@/domain/loaders/prequal";

type Tab = "review" | "under_review" | "approved" | "expiring" | "rejected";

const TABS: Array<{ key: Tab; label: string; countKey: keyof PrequalQueueView["counts"] }> = [
  { key: "review", label: "Needs review", countKey: "review" },
  { key: "under_review", label: "Under review", countKey: "under_review" },
  { key: "approved", label: "Approved", countKey: "approved" },
  { key: "expiring", label: "Expiring soon", countKey: "expiring" },
  { key: "rejected", label: "Rejected", countKey: "rejected" },
];

export function ContractorQueueWorkspace({
  rows,
  counts,
  tab,
  selectedId,
  selectedDetail,
  tradeFilter,
}: {
  rows: PrequalSubmissionListRow[];
  counts: PrequalQueueView["counts"];
  tab: string;
  selectedId: string | null;
  selectedDetail: PrequalSubmissionDetail | null;
  tradeFilter: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", next);
    params.delete("selected");
    router.push(`/contractor/prequalification?${params.toString()}`);
  };
  const setSelected = (id: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("selected", id);
    router.push(`/contractor/prequalification?${params.toString()}`);
  };
  const setTrade = (trade: string) => {
    const params = new URLSearchParams(sp.toString());
    if (trade === "all") params.delete("trade");
    else params.set("trade", trade);
    router.push(`/contractor/prequalification?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    const cutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
    let out = rows;
    if (tab === "review") out = out.filter((r) => r.status === "submitted");
    else if (tab === "under_review")
      out = out.filter((r) => r.status === "under_review");
    else if (tab === "approved")
      out = out.filter((r) => r.status === "approved");
    else if (tab === "expiring")
      out = out.filter(
        (r) =>
          r.status === "approved" &&
          r.expiresAt != null &&
          new Date(r.expiresAt).getTime() <= cutoff,
      );
    else if (tab === "rejected")
      out = out.filter((r) => r.status === "rejected");
    if (tradeFilter !== "all") {
      out = out.filter((r) => (r.tradeCategory ?? "General") === tradeFilter);
    }
    return out;
  }, [rows, tab, tradeFilter]);

  const trades = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.tradeCategory ?? "General");
    return Array.from(set).sort();
  }, [rows]);

  return (
    <>
      <div className="pq-page-hdr">
        <div>
          <h1 className="pq-page-title">Prequalification</h1>
          <p className="pq-page-sub">
            Review subcontractor submissions, score against your templates,
            and approve or reject before awarding work. Approved status flows
            to the compliance workspace and gates assignment.
          </p>
        </div>
        <div className="pq-page-acts">
          <Link
            className="pq-btn"
            href="/contractor/settings/prequalification/templates"
          >
            Manage templates
          </Link>
          <InviteSubButton />
        </div>
      </div>

      <div className="pq-stat-strip">
        <button
          type="button"
          className={`pq-stat alert clickable${tab === "review" ? " on" : ""}`}
          onClick={() => setTab("review")}
        >
          <div className="pq-stat-label">Awaiting your review</div>
          <div className="pq-stat-value">{counts.review}</div>
          <div className="pq-stat-meta">submitted, awaiting decision</div>
        </button>
        <button
          type="button"
          className={`pq-stat alert clickable${tab === "expiring" ? " on" : ""}`}
          onClick={() => setTab("expiring")}
        >
          <div className="pq-stat-label">Expiring in 30 days</div>
          <div className="pq-stat-value">{counts.expiring}</div>
          <div className="pq-stat-meta">renew before lapse</div>
        </button>
        <button
          type="button"
          className={`pq-stat success clickable${tab === "approved" ? " on" : ""}`}
          onClick={() => setTab("approved")}
        >
          <div className="pq-stat-label">Approved subs</div>
          <div className="pq-stat-value">{counts.approved}</div>
          <div className="pq-stat-meta">currently in good standing</div>
        </button>
        <Link
          className="pq-stat danger clickable"
          href="/contractor/settings/prequalification"
          style={{ textDecoration: "none" }}
        >
          <div className="pq-stat-label">Block-mode overrides</div>
          <div className="pq-stat-value">{counts.overrides}</div>
          <div className="pq-stat-meta">active project exemptions</div>
        </Link>
      </div>

      <div className="pq-ws">
        <div className="pq-ws-head">
          <div>
            <h3>Prequalification submissions</h3>
            <div className="pq-ws-sub">
              All trades · Cross-project review queue
            </div>
          </div>
        </div>
        <div className="pq-ws-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`pq-tab${tab === t.key ? " on" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="pq-tab-c">{counts[t.countKey]}</span>
            </button>
          ))}
        </div>
        <div className="pq-md">
          <div>
            <div className="pq-q-bar">
              <select
                className="pq-q-filt"
                value={tradeFilter}
                onChange={(e) => setTrade(e.target.value)}
              >
                <option value="all">All trades</option>
                {trades.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {filtered.length} {filtered.length === 1 ? "row" : "rows"}
              </span>
            </div>
            <div className="pq-tl">
              {filtered.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-tertiary)",
                    padding: 20,
                    fontSize: 13,
                  }}
                >
                  No submissions in this view.
                </p>
              ) : null}
              {filtered.map((r) => {
                const hot =
                  r.hasGatingFailures ||
                  (r.status === "approved" &&
                    r.expiresAt != null &&
                    new Date(r.expiresAt).getTime() - Date.now() <
                      14 * 24 * 60 * 60 * 1000);
                return (
                  <button
                    key={r.id}
                    className={`pq-rcd${selectedId === r.id ? " on" : ""}${
                      hot ? " hot" : ""
                    }`}
                    onClick={() => setSelected(r.id)}
                  >
                    <div className="pq-rcd-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pq-rcd-org">
                          {r.submittedByOrgName}
                        </div>
                        <div className="pq-rcd-title">
                          {r.tradeCategory ?? "General"} · {r.templateName}
                        </div>
                        <div className="pq-rcd-desc">
                          {describe(r)}
                        </div>
                      </div>
                      <span className={`pq-pill ${pillFor(r.status)}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="pq-rcd-tags">
                      {r.hasGatingFailures ? (
                        <span className="pq-pill red">Gating</span>
                      ) : null}
                      <span className="pq-pill">{r.tradeCategory ?? "General"}</span>
                      <span className="pq-pill">
                        {r.scoreTotal == null
                          ? "—"
                          : `Score ${r.scoreTotal}/${r.passThreshold}`}
                      </span>
                    </div>
                    <div className="pq-rcd-foot">
                      <span className="pq-rcd-score">
                        Score · {r.scoreTotal ?? "—"}
                      </span>
                      <span>{relTime(r.submittedAt ?? r.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDetail ? (
            <DetailPane detail={selectedDetail} />
          ) : (
            <div className="pq-empty">
              <div className="pq-empty-title">No submission selected</div>
              <div className="pq-empty-sub">
                Pick a row on the left to review.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function describe(r: PrequalSubmissionListRow): string {
  if (r.status === "submitted") {
    return `Submitted ${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "recently"} · awaiting your review${r.hasGatingFailures ? " · gating flagged" : ""}`;
  }
  if (r.status === "under_review") {
    return `Reviewer assigned · score ${r.scoreTotal ?? "—"}/${r.passThreshold}`;
  }
  if (r.status === "approved") {
    return r.expiresAt
      ? `Approved · expires ${new Date(r.expiresAt).toLocaleDateString()}`
      : "Approved · no expiry";
  }
  if (r.status === "rejected") {
    return `Rejected ${r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : ""} · sub may resubmit`;
  }
  return r.status;
}

function pillFor(status: string): string {
  return (
    {
      draft: "",
      submitted: "orange",
      under_review: "blue",
      approved: "green",
      rejected: "red",
      expired: "red",
    }[status] ?? ""
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

// ─── Detail pane ──────────────────────────────────────────────────

function DetailPane({ detail }: { detail: PrequalSubmissionDetail }) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [notes, setNotes] = useState(detail.reviewerNotes ?? "");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const decided =
    detail.status === "approved" || detail.status === "rejected";
  const hasGating = detail.gatingFailures.length > 0;
  const passes =
    detail.scoreTotal != null && detail.scoreTotal >= detail.passThreshold;
  const totalMax = detail.template.questions.reduce(
    (s, q) => s + maxPointsFor(q),
    0,
  );

  const send = (
    body:
      | { action: "decide"; decision: "approve" | "reject"; reviewerNotes: string | null; overrideGating?: boolean }
      | { action: "move_under_review" },
  ) => {
    setActionError(null);
    startTx(async () => {
      const res = await fetch(
        `/api/prequal/submissions/${detail.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        setActionError(text || `Action failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="pq-dp">
      <div className="pq-dh">
        <div>
          <h3>
            {detail.submittedByOrgName} ·{" "}
            {detail.tradeCategory ?? "General"} prequalification
          </h3>
          <div className="pq-dh-org">
            Submission · {detail.id.slice(0, 8)}…{detail.id.slice(-4)} ·
            Template: {detail.templateName}
          </div>
          <div className="pq-dh-desc">
            {detail.status === "submitted" || detail.status === "under_review"
              ? `Submitted ${detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "recently"}. Score ${detail.scoreTotal ?? "—"}/${detail.passThreshold} · ${detail.documents.length}/5 documents${hasGating ? " · gating flagged" : ""}.`
              : detail.status === "approved"
                ? `Approved ${detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleDateString() : ""}${detail.expiresAt ? `, expires ${new Date(detail.expiresAt).toLocaleDateString()}` : ""}.`
                : detail.status === "rejected"
                  ? `Rejected ${detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleDateString() : ""}. Sub may resubmit.`
                  : ""}
          </div>
        </div>
        <div className="pq-dh-pills">
          <span className={`pq-pill ${pillFor(detail.status)}`}>
            {detail.status.replace("_", " ")}
          </span>
          {detail.scoreTotal != null ? (
            <span className="pq-pill accent">
              Score {detail.scoreTotal}
            </span>
          ) : null}
          {hasGating ? (
            <span className="pq-pill red">
              {detail.gatingFailures.length} gating
            </span>
          ) : null}
          <span
            className={`pq-pill ${detail.documents.length === 5 ? "green" : "orange"}`}
          >
            {detail.documents.length}/5 docs
          </span>
        </div>
      </div>

      <div className="pq-dg">
        <div className="pq-dg-i">
          <div className="k">Sub org</div>
          <div className="v">{detail.submittedByOrgName}</div>
          <div className="m">{detail.submittedByOrgId.slice(0, 8)}…</div>
        </div>
        <div className="pq-dg-i">
          <div className="k">Trade</div>
          <div className="v">{detail.tradeCategory ?? "General"}</div>
          <div className="m">{detail.templateName}</div>
        </div>
        <div className="pq-dg-i">
          <div className="k">Submitted</div>
          <div className="v">
            {detail.submittedAt
              ? new Date(detail.submittedAt).toLocaleDateString()
              : "—"}
          </div>
          <div className="m">{relTime(detail.submittedAt)}</div>
        </div>
        <div className="pq-dg-i">
          <div className="k">Score</div>
          <div className="v">
            {detail.scoreTotal ?? "—"} / {detail.passThreshold}
          </div>
          <div className="m">
            {detail.scoreTotal == null
              ? "Pending"
              : passes
                ? `Passes by ${detail.scoreTotal - detail.passThreshold}`
                : `Below by ${detail.passThreshold - detail.scoreTotal}`}
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      {detail.template.questions.length > 0 ? (
        <div className="pq-ds">
          <div className="pq-ds-h">
            <h4>Score breakdown</h4>
            <div className="pq-ds-acts">
              <span className="pq-pill">Internal · sub doesn&apos;t see</span>
            </div>
          </div>
          <div className="pq-ds-b">
            {detail.template.questions.map((q) => {
              const ans = detail.answers[q.key];
              const earned = pointsFor(q, ans);
              const max = maxPointsFor(q);
              const isGating = q.gating === true;
              const failed = isGating && detail.gatingFailures.includes(q.key);
              return (
                <div
                  key={q.key}
                  className={`pq-sr${failed ? " gating" : ""}`}
                >
                  <div className="pq-sr-q">
                    {q.label}
                    <span>{isGating ? `Gating · ${failed ? "FAILED" : "passed"}` : `Type: ${q.type}`}</span>
                  </div>
                  <div className="pq-sr-a">{fmtAnswer(q, ans)}</div>
                  <div className="pq-sr-w">
                    {isGating ? "gating" : max > 0 ? `${max} max` : "—"}
                  </div>
                  <div className="pq-sr-pts">
                    {isGating ? (failed ? "fail" : "pass") : earned}
                  </div>
                </div>
              );
            })}
            <div className="pq-st">
              <div className="pq-st-label">Total score</div>
              <div>
                <div className="pq-st-value">
                  {detail.scoreTotal ?? 0} / {totalMax || 100}
                </div>
                <div className="pq-st-thr">
                  Threshold {detail.passThreshold} ·{" "}
                  {detail.scoreTotal == null
                    ? "—"
                    : passes
                      ? `Passes by ${detail.scoreTotal - detail.passThreshold}`
                      : `Below by ${detail.passThreshold - detail.scoreTotal}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Documents */}
      {detail.documents.length > 0 ? (
        <div className="pq-ds">
          <div className="pq-ds-h">
            <h4>Supporting documents</h4>
            <div className="pq-ds-acts">
              <span
                className={`pq-pill ${detail.documents.length === 5 ? "green" : "orange"}`}
              >
                {detail.documents.length}/5 types
              </span>
            </div>
          </div>
          <div className="pq-ds-b">
            {detail.documents.map((d) => {
              const sizeMb = d.fileSizeBytes / (1024 * 1024);
              const sizeStr =
                sizeMb >= 1
                  ? `${sizeMb.toFixed(1)} MB`
                  : `${Math.round(d.fileSizeBytes / 1024)} KB`;
              return (
                <div key={d.id} className="pq-dr">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h5>
                      <span className="pq-dt-tag">
                        {d.documentType.replace("_", " ")}
                      </span>
                      <span className="name">{d.title}</span>
                    </h5>
                    <p>
                      {sizeStr} · {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="pq-dr-acts">
                    <a
                      className="pq-btn sm"
                      href={`/api/prequal/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                    <a
                      className="pq-btn sm"
                      href={`/api/prequal/documents/${d.id}`}
                      download
                    >
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Reviewer attention — gating */}
      {hasGating && !decided ? (
        <div className="pq-ds gate">
          <div className="pq-ds-h">
            <h4>Reviewer attention</h4>
            <div className="pq-ds-acts">
              <span className="pq-pill red">
                {detail.gatingFailures.length} gating
              </span>
            </div>
          </div>
          <div className="pq-ds-b">
            {detail.gatingFailures.map((k) => {
              const q = detail.template.questions.find((x) => x.key === k);
              return (
                <div key={k} className="pq-gc">
                  <div>
                    <h5>{q?.label ?? k}</h5>
                    <p>
                      Sub answered in a way that triggers gating. Approve
                      anyway with override + audit-logged reason, or reject
                      with a clear note.
                    </p>
                  </div>
                  <span className="pq-gc-a">Gating fail</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Decision panel */}
      {!decided ? (
        <div className="pq-ds dec">
          <div className="pq-ds-h">
            <h4>Decision</h4>
            <div className="pq-ds-acts">
              <span className="pq-pill">
                Approve · Reject · Override · Under review
              </span>
            </div>
          </div>
          <div className="pq-ds-b">
            <p
              style={{
                marginBottom: 10,
                color: "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              Reviewer notes{" "}
              <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>
                (visible to sub on decision)
              </span>
            </p>
            <textarea
              className="pq-ntx"
              placeholder="Optional. Notes appear on the sub's decision notification."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
            <p className="pq-ntx-h">
              Approval sets expiry to today + 12 months (template default).
              Rejection requires a reason.
            </p>

            {hasGating && !overrideConfirmed ? (
              <div className="pq-ov-ban">
                <strong>Override available.</strong> Approve anyway with an
                explicit reason. Override is audit-logged and visible on the
                sub&apos;s history.
              </div>
            ) : null}

            {actionError ? (
              <div className="pq-ov-ban" style={{ marginTop: 10 }}>
                {actionError}
              </div>
            ) : null}

            <div className="pq-dec-acts">
              <button
                className="pq-btn primary"
                onClick={() =>
                  send({
                    action: "decide",
                    decision: "approve",
                    reviewerNotes: notes || null,
                  })
                }
                disabled={pending || hasGating}
                title={hasGating ? "Use Override below" : ""}
              >
                Approve · 12-month validity
              </button>
              <button
                className="pq-btn"
                onClick={() =>
                  setNotes(
                    (notes ? notes + "\n" : "") + "Requesting correction: ",
                  )
                }
                disabled={pending}
              >
                Request correction
              </button>
              <button
                className="pq-btn danger-outline"
                onClick={() => {
                  if (!notes.trim()) {
                    setActionError("Reject requires reviewer notes.");
                    return;
                  }
                  send({
                    action: "decide",
                    decision: "reject",
                    reviewerNotes: notes,
                  });
                }}
                disabled={pending}
              >
                Reject with note
              </button>
              {hasGating ? (
                <>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={overrideConfirmed}
                      onChange={(e) =>
                        setOverrideConfirmed(e.target.checked)
                      }
                      style={{ accentColor: "var(--accent)" }}
                    />
                    Confirm override
                  </label>
                  <button
                    className="pq-btn ok"
                    onClick={() =>
                      send({
                        action: "decide",
                        decision: "approve",
                        reviewerNotes: notes || null,
                        overrideGating: true,
                      })
                    }
                    disabled={pending || !overrideConfirmed}
                  >
                    Override &amp; approve
                  </button>
                </>
              ) : null}
              <span className="pq-spc" />
              {detail.status === "submitted" ? (
                <button
                  className="pq-btn ghost"
                  onClick={() => send({ action: "move_under_review" })}
                  disabled={pending}
                >
                  Move to under review
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="pq-ds">
          <div className="pq-ds-h">
            <h4>Decision recorded</h4>
            <div className="pq-ds-acts">
              <span className={`pq-pill ${pillFor(detail.status)}`}>
                {detail.status.replace("_", " ")}
              </span>
            </div>
          </div>
          <div className="pq-ds-b">
            <div
              className={`pq-dec-note${detail.status === "rejected" ? " reject" : ""}`}
            >
              <strong>
                {detail.status === "approved" ? "✓ Approved." : "✗ Rejected."}
              </strong>{" "}
              {detail.status === "approved"
                ? `Expires ${detail.expiresAt ? new Date(detail.expiresAt).toLocaleDateString() : "—"}.`
                : "Sub has been notified with your note. They may resubmit a fresh application."}
              {detail.reviewedByName ? ` By ${detail.reviewedByName}.` : ""}
            </div>
            {detail.reviewerNotes ? (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                }}
              >
                Reviewer note: &ldquo;{detail.reviewerNotes}&rdquo;
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Answers (read-only) */}
      <div className="pq-ds">
        <div className="pq-ds-h">
          <h4>Answers</h4>
          <div className="pq-ds-acts">
            <span className="pq-pill">read-only</span>
          </div>
        </div>
        <div className="pq-ds-b">
          <PrequalFormRenderer
            questions={detail.template.questions}
            answers={detail.answers}
            mode="review"
          />
        </div>
      </div>
    </div>
  );
}

function InviteSubButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subOrgId, setSubOrgId] = useState("");
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handle = () => {
    setError(null);
    startTx(async () => {
      const res = await fetch("/api/prequal/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subOrgId }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to invite");
        return;
      }
      const json = (await res.json()) as { submissionId: string };
      setOpen(false);
      setSubOrgId("");
      router.push(`/contractor/prequalification?selected=${json.submissionId}`);
      router.refresh();
    });
  };

  return (
    <>
      <button className="pq-btn primary" onClick={() => setOpen(true)}>
        Invite a sub
      </button>
      {open ? (
        <div
          className="pq-modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 100,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="pq-content"
            style={{
              background: "var(--surface-1)",
              borderRadius: 14,
              padding: 24,
              width: 480,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 720,
                fontSize: 18,
                margin: "0 0 8px",
              }}
            >
              Invite a sub to prequalify
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px" }}>
              Paste the sub org&apos;s UUID. Once you create the invitation, a
              draft lands in their portal. The default template for the
              sub&apos;s trade is auto-selected; if no trade match, the
              general default is used.
            </p>
            <label className="pq-field">
              <span className="pq-field-label required">Subcontractor org id</span>
              <input
                className="pq-input"
                placeholder="11111111-…"
                value={subOrgId}
                onChange={(e) => setSubOrgId(e.target.value)}
              />
              <span className="pq-field-hint">
                Find IDs from the compliance scorecard or the sub&apos;s
                profile. A sub-org picker UI will replace this in a follow-up
                step.
              </span>
            </label>
            {error ? (
              <div className="pq-warn-banner" style={{ marginTop: 12 }}>
                {error}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 14,
              }}
            >
              <button
                className="pq-btn ghost"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                className="pq-btn primary"
                onClick={handle}
                disabled={pending || !subOrgId.trim()}
              >
                {pending ? "Inviting…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─── Pure helpers ────────────────────────────────────────────────────

function pointsFor(q: PrequalQuestion, ans: unknown): number {
  switch (q.type) {
    case "yes_no":
      return ans === true ? q.weight ?? 0 : 0;
    case "number": {
      if (typeof ans !== "number") return 0;
      const band = q.scoreBands?.find((b) => ans >= b.min && ans <= b.max);
      return band?.points ?? 0;
    }
    case "select_one":
      return q.options?.find((o) => o.key === ans)?.points ?? 0;
    case "multi_select": {
      if (!Array.isArray(ans)) return 0;
      return (q.options ?? [])
        .filter((o) => (ans as string[]).includes(o.key))
        .reduce((s, o) => s + (o.points ?? 0), 0);
    }
    case "short_text":
    case "long_text":
      return 0;
  }
}

function maxPointsFor(q: PrequalQuestion): number {
  switch (q.type) {
    case "yes_no":
      return q.weight ?? 0;
    case "number":
      return q.scoreBands?.reduce((m, b) => Math.max(m, b.points), 0) ?? 0;
    case "select_one":
      return q.options?.reduce((m, o) => Math.max(m, o.points ?? 0), 0) ?? 0;
    case "multi_select":
      return q.options?.reduce((s, o) => s + (o.points ?? 0), 0) ?? 0;
    case "short_text":
    case "long_text":
      return 0;
  }
}

function fmtAnswer(q: PrequalQuestion, ans: unknown): string {
  if (ans == null) return "—";
  if (q.type === "yes_no") return ans === true ? "Yes" : "No";
  if (q.type === "select_one") {
    return q.options?.find((o) => o.key === ans)?.label ?? String(ans);
  }
  if (q.type === "multi_select" && Array.isArray(ans)) {
    return (ans as string[])
      .map((k) => q.options?.find((o) => o.key === k)?.label ?? k)
      .join(", ");
  }
  if (q.type === "number") return typeof ans === "number" ? String(ans) : "—";
  return String(ans).slice(0, 40);
}
