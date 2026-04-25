"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  PrequalDocumentType,
  PrequalDocumentRow,
  PrequalQuestion,
  PrequalSubmissionStatus,
  SubPrequalFormView,
} from "@/domain/loaders/prequal";

const DOC_TYPES: Array<{ key: PrequalDocumentType; label: string; desc: string }> = [
  {
    key: "bond",
    label: "Bond",
    desc: "Performance/payment bond letter or capacity statement.",
  },
  {
    key: "insurance",
    label: "Insurance",
    desc: "Certificate of insurance — general liability, auto, workers comp.",
  },
  {
    key: "safety_manual",
    label: "Safety manual",
    desc: "Current written safety program.",
  },
  {
    key: "references",
    label: "References",
    desc: "2–3 references from prior GCs.",
  },
  {
    key: "financial_statements",
    label: "Financial statements",
    desc: "Most recent financial statement.",
  },
];

export function SubFormShell({ view }: { view: SubPrequalFormView }) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submission = view.submission;
  const editable =
    submission &&
    (submission.status === "draft" || submission.status === "rejected");
  const readOnly = !editable;

  const initialAnswers = submission?.answers ?? {};
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);

  const docsByType = useMemo(() => {
    const map = new Map<PrequalDocumentType, PrequalDocumentRow[]>();
    for (const d of submission?.documents ?? []) {
      const arr = map.get(d.documentType) ?? [];
      arr.push(d);
      map.set(d.documentType, arr);
    }
    return map;
  }, [submission?.documents]);

  if (!submission) {
    return (
      <div className="pq-empty">
        <div className="pq-empty-title">Awaiting an invitation</div>
        <div className="pq-empty-sub">
          {view.contractorOrgName} hasn&apos;t invited you to prequalify yet.
        </div>
      </div>
    );
  }

  const saveDraft = () => {
    setError(null);
    startTx(async () => {
      const res = await fetch(`/api/prequal/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_draft", answers }),
      });
      if (!res.ok) {
        setError((await res.text()) || `Save failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  const submitForm = () => {
    setError(null);
    startTx(async () => {
      const res = await fetch(`/api/prequal/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", answers }),
      });
      if (!res.ok) {
        setError((await res.text()) || `Submit failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  // Group questions into named form sections. The JSX layout splits by
  // semantic chunks (Company info, Risk & safety, Notes); we mirror by
  // grouping non-gating non-document questions first, then a separate
  // "Risk & safety" block for gating + qualitative, then text/notes fall
  // last.
  const grouped = groupQuestions(view.template.questions);

  // Progress
  const totalQuestions = view.template.questions.length;
  const answeredCount = view.template.questions.filter((q) =>
    isAnswered(answers[q.key]),
  ).length;
  const docsUploaded = (submission.documents ?? []).length;
  const requiredDocs = DOC_TYPES.length;

  // "Ready to submit" rule: every required question answered + at least
  // 3 of 5 doc types uploaded (per JSX). Sub can still save draft anytime.
  const readyToSubmit =
    answeredCount === totalQuestions && docsUploaded >= 3;

  return (
    <>
      <StatusBanner
        status={submission.status}
        reviewerNotes={submission.reviewerNotes}
      />

      <div className="pq-detail" style={{ marginTop: 12 }}>
        {/* Section: Company information */}
        {grouped.company.length > 0 ? (
          <FormSection
            title="Company information"
            count={countAnsweredFor(grouped.company, answers)}
            total={grouped.company.length}
          >
            {grouped.company.map((q) => (
              <FormQuestion
                key={q.key}
                q={q}
                value={answers[q.key]}
                readOnly={readOnly}
                onChange={(v) =>
                  setAnswers((prev) => ({ ...prev, [q.key]: v }))
                }
              />
            ))}
          </FormSection>
        ) : null}

        {/* Section: Risk & safety (gating + qualitative) */}
        {grouped.risk.length > 0 ? (
          <FormSection
            title="Risk & safety"
            count={countAnsweredFor(grouped.risk, answers)}
            total={grouped.risk.length}
          >
            {grouped.risk.map((q) => (
              <FormQuestion
                key={q.key}
                q={q}
                value={answers[q.key]}
                readOnly={readOnly}
                onChange={(v) =>
                  setAnswers((prev) => ({ ...prev, [q.key]: v }))
                }
              />
            ))}
          </FormSection>
        ) : null}

        {/* Section: Supporting documents */}
        <div className="pq-fs">
          <div className="pq-fs-h">
            <h4>Supporting documents</h4>
            <div className="pq-pg">
              {docsUploaded} of {requiredDocs} uploaded
            </div>
          </div>
          <div className="pq-fs-b">
            {DOC_TYPES.map((dt) => (
              <DocUploadZone
                key={dt.key}
                submissionId={submission.id}
                documentType={dt.key}
                label={dt.label}
                desc={dt.desc}
                docs={docsByType.get(dt.key) ?? []}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>

        {error ? (
          <div className="pq-warn-banner" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}

        {/* Sticky form footer */}
        {!readOnly ? (
          <div className="pq-ff">
            <div className="pq-ff-tx">
              {answeredCount > 0 ? (
                <>
                  <strong>Draft saved automatically.</strong>{" "}
                  {answeredCount} of {totalQuestions} questions answered ·{" "}
                  {docsUploaded} of {requiredDocs} documents uploaded.
                </>
              ) : (
                <>
                  <strong>Nothing answered yet.</strong> Save and return any
                  time. Submission only happens when you click Submit.
                </>
              )}
            </div>
            <div className="pq-ff-acts">
              <button
                className="pq-btn"
                onClick={saveDraft}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save draft"}
              </button>
              <button
                className="pq-btn primary"
                onClick={submitForm}
                disabled={pending || !readyToSubmit}
              >
                {pending ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

// ─── Section + question primitives ────────────────────────────────────

function FormSection({
  title,
  count,
  total,
  children,
}: {
  title: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="pq-fs">
      <div className="pq-fs-h">
        <h4>{title}</h4>
        <div className="pq-pg">
          {count} of {total} answered
        </div>
      </div>
      <div className="pq-fs-b">{children}</div>
    </div>
  );
}

function FormQuestion({
  q,
  value,
  readOnly,
  onChange,
}: {
  q: PrequalQuestion;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  const filled = isAnswered(value);
  return (
    <div className={`pq-q${filled ? " fill" : ""}`}>
      <label>
        {q.label}
        {q.required ? <span className="pq-req">*</span> : null}
        {q.gating ? <span className="pq-gate-tag">Gating</span> : null}
      </label>
      {q.helpText ? <p className="pq-help">{q.helpText}</p> : null}
      <FieldInput q={q} value={value} readOnly={readOnly} onChange={onChange} />
    </div>
  );
}

function FieldInput({
  q,
  value,
  readOnly,
  onChange,
}: {
  q: PrequalQuestion;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  if (readOnly) {
    return <ReadOnlyValue q={q} value={value} />;
  }
  switch (q.type) {
    case "short_text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "long_text":
      return (
        <textarea
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          value={typeof value === "number" ? value : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "yes_no":
      return (
        <div className="pq-rgrp">
          <button
            type="button"
            className={`pq-ropt${value === false ? " sel" : ""}`}
            onClick={() => onChange(false)}
          >
            No
          </button>
          <button
            type="button"
            className={`pq-ropt${value === true ? (q.gating ? " sel no" : " sel") : ""}`}
            onClick={() => onChange(true)}
          >
            Yes
          </button>
        </div>
      );
    case "select_one":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose one</option>
          {(q.options ?? []).map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="pq-cgrp">
          {(q.options ?? []).map((opt) => {
            const checked = arr.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                className={`pq-copt${checked ? " chk" : ""}`}
                onClick={() => {
                  const next = checked
                    ? arr.filter((k) => k !== opt.key)
                    : [...arr, opt.key];
                  onChange(next);
                }}
              >
                <span className="pq-cbm">
                  {checked ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }
  }
}

function ReadOnlyValue({ q, value }: { q: PrequalQuestion; value: unknown }) {
  let display = "—";
  if (q.type === "yes_no") {
    display = value === true ? "Yes" : value === false ? "No" : "—";
  } else if (q.type === "select_one") {
    display = q.options?.find((o) => o.key === value)?.label ?? "—";
  } else if (q.type === "multi_select" && Array.isArray(value)) {
    const arr = value as string[];
    display =
      arr
        .map((k) => q.options?.find((o) => o.key === k)?.label ?? k)
        .join(", ") || "—";
  } else if (q.type === "number") {
    display = typeof value === "number" ? String(value) : "—";
  } else {
    display = typeof value === "string" && value.length > 0 ? value : "—";
  }
  return (
    <input
      type="text"
      value={display}
      readOnly
      style={{
        background: "var(--surface-2)",
        cursor: "default",
      }}
    />
  );
}

// ─── Document upload zone ────────────────────────────────────────────

function DocUploadZone({
  submissionId,
  documentType,
  label,
  desc,
  docs,
  disabled,
}: {
  submissionId: string;
  documentType: PrequalDocumentType;
  label: string;
  desc: string;
  docs: PrequalDocumentRow[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onPick = (file: File | null) => {
    if (!file) return;
    setErr(null);
    startTx(async () => {
      try {
        const presign = await fetch(
          `/api/prequal/submissions/${submissionId}/documents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "request_upload",
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSizeBytes: file.size,
              documentType,
            }),
          },
        );
        if (!presign.ok) throw new Error(await presign.text());
        const { uploadUrl, storageKey } = (await presign.json()) as {
          uploadUrl: string;
          storageKey: string;
        };

        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);

        const attach = await fetch(
          `/api/prequal/submissions/${submissionId}/documents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "attach",
              documentType,
              storageKey,
              title: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSizeBytes: file.size,
            }),
          },
        );
        if (!attach.ok) throw new Error(await attach.text());
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  };

  const removeDoc = (id: string) => {
    startTx(async () => {
      const res = await fetch(`/api/prequal/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      router.refresh();
    });
  };

  const uploaded = docs.length > 0;

  if (uploaded) {
    return (
      <div className="pq-uz done">
        <h5>{label} · uploaded</h5>
        <p>{desc}</p>
        <div className="pq-uz-list">
          {docs.map((d) => {
            const sizeMb = d.fileSizeBytes / (1024 * 1024);
            const sizeStr =
              sizeMb >= 1
                ? `${sizeMb.toFixed(1)} MB`
                : `${Math.round(d.fileSizeBytes / 1024)} KB`;
            return (
              <div key={d.id} className="pq-dr" style={{ margin: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h5>
                    <span className="pq-dt-tag">
                      {documentType.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="name">{d.title}</span>
                  </h5>
                  <p>
                    Uploaded by you · {new Date(d.createdAt).toLocaleString()} ·{" "}
                    {sizeStr}
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
                  {!disabled ? (
                    <label className="pq-btn sm" style={{ cursor: "pointer" }}>
                      Replace
                      <input
                        type="file"
                        style={{ display: "none" }}
                        disabled={disabled || pending}
                        onChange={(e) => {
                          onPick(e.target.files?.[0] ?? null);
                        }}
                      />
                    </label>
                  ) : null}
                  {!disabled ? (
                    <button
                      className="pq-btn sm danger-outline"
                      onClick={() => removeDoc(d.id)}
                      disabled={pending}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {err ? (
          <div style={{ fontSize: 11.5, color: "var(--er-text)", marginTop: 6 }}>
            {err}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pq-uz">
      <h5>{label}</h5>
      <p>{desc}</p>
      <div className="pq-uz-acts">
        <label
          className="pq-btn primary sm"
          style={{
            cursor: disabled || pending ? "not-allowed" : "pointer",
            opacity: disabled || pending ? 0.55 : 1,
          }}
        >
          {pending ? "Uploading…" : "Upload file"}
          <input
            type="file"
            style={{ display: "none" }}
            disabled={disabled || pending}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
        <button className="pq-btn sm" type="button" disabled>
          I don&apos;t have one
        </button>
      </div>
      {err ? (
        <div style={{ fontSize: 11.5, color: "var(--er-text)", marginTop: 6 }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}

// ─── Status banner ───────────────────────────────────────────────────

function StatusBanner({
  status,
  reviewerNotes,
}: {
  status: PrequalSubmissionStatus;
  reviewerNotes: string | null;
}) {
  if (status === "draft") {
    return (
      <div className="pq-warn-banner">
        <strong>Draft.</strong> Your answers save when you click Save draft.
        Submission only happens when you click Submit — you can&apos;t edit
        a submitted form.
      </div>
    );
  }
  if (status === "submitted" || status === "under_review") {
    return (
      <div
        className="pq-warn-banner"
        style={{
          background: "var(--info-soft)",
          borderLeftColor: "var(--info)",
          borderColor: "#b3d1ec",
          color: "var(--info-text)",
        }}
      >
        <strong>
          {status === "submitted" ? "Submitted" : "Under review"}.
        </strong>{" "}
        Your contractor has been notified. You&apos;ll get a notification
        when they decide. The submission is read-only until then.
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div
        className="pq-warn-banner"
        style={{
          background: "var(--ok-soft)",
          borderLeftColor: "var(--ok)",
          borderColor: "#b0dfc4",
          color: "var(--ok-text)",
        }}
      >
        <strong>Approved.</strong> You&apos;re in good standing with this
        contractor.
        {reviewerNotes ? ` Reviewer note: "${reviewerNotes}"` : ""}
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div
        className="pq-warn-banner"
        style={{
          background: "var(--er-soft)",
          borderLeftColor: "var(--er)",
          borderColor: "#f5baba",
          color: "var(--er-text)",
        }}
      >
        <strong>Rejected.</strong>{" "}
        {reviewerNotes ? `Reviewer note: "${reviewerNotes}". ` : ""}
        You can&apos;t edit this submission, but you can resubmit a new one
        from the all-requests page.
      </div>
    );
  }
  return (
    <div className="pq-warn-banner">
      <strong>Expired.</strong> This approval has lapsed. Submit a new
      prequalification to renew.
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function countAnsweredFor(
  qs: PrequalQuestion[],
  answers: Record<string, unknown>,
): number {
  return qs.filter((q) => isAnswered(answers[q.key])).length;
}

// Group questions: gating + safety-style live in "Risk & safety"; everything
// else is "Company information". Long-text questions trail under risk so
// they read naturally with the qualitative section.
function groupQuestions(
  qs: PrequalQuestion[],
): { company: PrequalQuestion[]; risk: PrequalQuestion[] } {
  const isRisk = (q: PrequalQuestion) =>
    q.gating === true ||
    /safety|risk|emr|insurance|bond|compliance|litigation|bankrupt/i.test(
      q.label,
    );
  const company: PrequalQuestion[] = [];
  const risk: PrequalQuestion[] = [];
  for (const q of qs) {
    if (isRisk(q)) risk.push(q);
    else company.push(q);
  }
  return { company, risk };
}
