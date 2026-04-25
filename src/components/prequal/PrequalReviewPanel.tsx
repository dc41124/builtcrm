"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  PrequalQuestion,
  PrequalScoringRules,
  PrequalSubmissionDetail,
} from "@/domain/loaders/prequal";

// Review-side panel: per-question score breakdown, gating list, reviewer
// notes input, decision buttons. Internal to the contractor — never
// exposed on the sub side.

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

export function PrequalReviewPanel({
  submission,
}: {
  submission: PrequalSubmissionDetail;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [notes, setNotes] = useState(submission.reviewerNotes ?? "");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const questions = submission.template.questions;
  const scoring: PrequalScoringRules = submission.template.scoringRules;
  const totalMax = questions.reduce((s, q) => s + maxPointsFor(q), 0);

  const decided =
    submission.status === "approved" || submission.status === "rejected";
  const hasGating = submission.gatingFailures.length > 0;

  const sendDecision = (decision: "approve" | "reject", overrideGating: boolean) => {
    setActionError(null);
    if (decision === "reject" && !notes.trim()) {
      setActionError("Reject requires reviewer notes.");
      return;
    }
    startTx(async () => {
      const res = await fetch(
        `/api/prequal/submissions/${submission.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "decide",
            decision,
            reviewerNotes: notes || null,
            overrideGating,
          }),
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
    <div>
      {/* Score breakdown */}
      <div>
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: 12.5,
            fontWeight: 720,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-tertiary)",
            margin: "12px 0 8px",
          }}
        >
          Score breakdown — internal
        </div>
        <div className="pq-score-table">
          <div className="pq-score-row head">
            <div className="pq-score-q">Question</div>
            <div className="pq-score-num">Answer</div>
            <div className="pq-score-num">Weight</div>
            <div className="pq-score-num">Points</div>
          </div>
          {questions.map((q) => {
            const ans = submission.answers[q.key];
            const earned = pointsFor(q, ans);
            const max = maxPointsFor(q);
            const isGating = q.gating === true;
            const failed =
              isGating && submission.gatingFailures.includes(q.key);
            return (
              <div
                key={q.key}
                className={`pq-score-row${
                  failed ? " gating" : isGating ? " gating-pass" : ""
                }`}
              >
                <div>
                  <div className="pq-score-q">{q.label}</div>
                  {isGating ? (
                    <div className="pq-score-sub">
                      Gating · {failed ? "FAILED" : "passed"}
                    </div>
                  ) : null}
                </div>
                <div className="pq-score-num">
                  {fmtAnswer(q, ans)}
                </div>
                <div className="pq-score-num">
                  {isGating ? "gating" : max > 0 ? max : "—"}
                </div>
                <div className="pq-score-num">
                  {isGating ? (failed ? "fail" : "pass") : earned}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pq-score-total">
          <div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Total / threshold
            </div>
            <div className="pq-score-total-num">
              {submission.scoreTotal ?? 0} / {scoring.passThreshold}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
              Max possible
            </div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 600 }}>
              {totalMax}
            </div>
          </div>
        </div>
      </div>

      {hasGating ? (
        <div className="pq-warn-banner">
          <strong>{submission.gatingFailures.length} gating failure
            {submission.gatingFailures.length === 1 ? "" : "s"}.</strong>{" "}
          Approving this submission requires an override (audit-logged).
        </div>
      ) : null}

      {/* Reviewer notes */}
      <label className="pq-field" style={{ marginTop: 14 }}>
        <span className="pq-field-label">
          Reviewer notes {decided ? "(read-only)" : "(visible to sub on decision)"}
        </span>
        <textarea
          className="pq-textarea"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={decided || pending}
          placeholder="Optional. Required when rejecting."
        />
      </label>

      {/* Decision buttons */}
      {!decided ? (
        <div className="pq-decide-panel">
          <div className="pq-decide-hdr">Decide</div>
          {actionError ? (
            <div className="pq-warn-banner" style={{ marginTop: 0 }}>
              {actionError}
            </div>
          ) : null}
          <div className="pq-decide-actions">
            <button
              className="pq-btn ok"
              onClick={() => sendDecision("approve", false)}
              disabled={pending || hasGating}
              title={hasGating ? "Use override below to approve despite gating failures" : ""}
            >
              Approve
            </button>
            <button
              className="pq-btn danger-outline"
              onClick={() => sendDecision("reject", false)}
              disabled={pending}
            >
              Reject
            </button>
          </div>
          {hasGating ? (
            <div style={{ marginTop: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={overrideConfirmed}
                  onChange={(e) => setOverrideConfirmed(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span>
                  I&apos;m overriding {submission.gatingFailures.length}{" "}
                  gating failure
                  {submission.gatingFailures.length === 1 ? "" : "s"}. The
                  override will be recorded in the audit log.
                </span>
              </label>
              <button
                className="pq-btn danger"
                style={{ marginTop: 10 }}
                onClick={() => sendDecision("approve", true)}
                disabled={pending || !overrideConfirmed}
              >
                Override gating &amp; approve
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="pq-warn-banner"
          style={{
            background:
              submission.status === "approved"
                ? "var(--ok-soft)"
                : "var(--er-soft)",
            borderLeftColor:
              submission.status === "approved" ? "var(--ok)" : "var(--er)",
            color:
              submission.status === "approved"
                ? "var(--ok-text)"
                : "var(--er-text)",
            borderColor:
              submission.status === "approved" ? "#b0dfc4" : "#f5baba",
          }}
        >
          <strong>
            {submission.status === "approved" ? "Approved" : "Rejected"}
          </strong>{" "}
          on{" "}
          {submission.reviewedAt
            ? new Date(submission.reviewedAt).toLocaleDateString()
            : "—"}
          {submission.reviewedByName ? ` by ${submission.reviewedByName}` : ""}.
          {submission.expiresAt
            ? ` Expires ${new Date(submission.expiresAt).toLocaleDateString()}.`
            : ""}
        </div>
      )}
    </div>
  );
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
