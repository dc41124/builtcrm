"use client";

import { useMemo, useState } from "react";

import {
  REVIEWER_RESPONSE_STATUSES,
  STATUS_LABEL,
  type SubmittalStatus,
  type SubmittalType,
} from "@/lib/submittals/config";

// External reviewer workspace. Single-page; no sidebar, no project
// context, no cross-submittal nav. The reviewer sees:
//   - Submittal metadata header (number, spec section, title, type)
//   - Sender context block ("Sent by [GC] on [date], due [date], notes")
//   - Package documents (download-only; the reviewer opens each in
//     their usual PDF viewer to mark it up offline)
//   - Decision picker (4 radios) + rejection-reason textarea (when
//     rejected) + notes textarea
//   - Stamp page upload + reviewer comments doc upload (dropzones)
//   - Submit button — irreversible
//
// On submit the token is consumed. The success screen confirms + lists
// what was recorded. There is no edit-after-submit path in Step 20.5;
// that decision was locked with the GC (re-invitation is the escape
// hatch).

const ACCENT = "#5b4fc7";

export type ReviewerPackageDoc = {
  id: string;
  documentId: string;
  title: string;
  url: string;
  fileSizeBytes: number | null;
};

export type ReviewerSubmittalHeader = {
  id: string;
  number: string;
  specSection: string;
  title: string;
  submittalType: SubmittalType;
  submittalTypeLabel: string;
  dueDate: string | null;
};

export type ReviewerSenderContext = {
  name: string;
  email: string | null;
  sentAt: string | null;
  notes: string | null;
  coverDocTitle: string | null;
  coverDocUrl: string | null;
};

export type ReviewerSelfContext = {
  email: string;
  expiresAt: string;
};

type Decision = (typeof REVIEWER_RESPONSE_STATUSES)[number];

const DECISION_OPTIONS: Array<{
  value: Decision;
  label: string;
  blurb: string;
}> = [
  {
    value: "returned_approved",
    label: STATUS_LABEL.returned_approved,
    blurb: "No changes required. Sub can proceed.",
  },
  {
    value: "returned_as_noted",
    label: STATUS_LABEL.returned_as_noted,
    blurb: "Approved with markups. Sub must follow your notes.",
  },
  {
    value: "revise_resubmit",
    label: STATUS_LABEL.revise_resubmit,
    blurb: "Not approved. Sub needs to revise and submit a new version.",
  },
  {
    value: "rejected",
    label: STATUS_LABEL.rejected,
    blurb: "Not approved and not suitable for resubmission as-is.",
  },
];

const I = {
  file: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  upload: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  x: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  check: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
};

export function ReviewerWorkspace({
  token,
  submittal,
  sender,
  reviewer,
  packageDocs,
}: {
  token: string;
  submittal: ReviewerSubmittalHeader;
  sender: ReviewerSenderContext;
  reviewer: ReviewerSelfContext;
  packageDocs: ReviewerPackageDoc[];
}) {
  const [decision, setDecision] = useState<Decision | "">("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const [stampFiles, setStampFiles] = useState<File[]>([]);
  const [commentsFiles, setCommentsFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Decision | null>(null);

  const dueText = useMemo(() => {
    if (!submittal.dueDate) return null;
    const d = new Date(submittal.dueDate);
    if (Number.isNaN(d.getTime())) return submittal.dueDate;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [submittal.dueDate]);

  const sentText = useMemo(() => {
    if (!sender.sentAt) return null;
    return new Date(sender.sentAt).toLocaleString();
  }, [sender.sentAt]);

  const expiresText = useMemo(() => {
    const d = new Date(reviewer.expiresAt);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [reviewer.expiresAt]);

  if (done) {
    return <SuccessScreen decision={done} />;
  }

  const submit = async () => {
    if (!decision) {
      setErr("Pick a decision first");
      return;
    }
    if (decision === "rejected" && !rejectionReason.trim()) {
      setErr("A rejection reason is required");
      return;
    }
    setBusy(true);
    setErr(null);

    try {
      // Upload + attach stamp / comments docs first. Failures here
      // don't block the decision from being recorded — we keep what
      // succeeded and continue, and the sub/GC can follow up by email
      // if a file didn't land. This is the same pragmatic pattern as
      // the Step 20 polish commit.
      await Promise.all([
        uploadAndAttach({
          token,
          files: stampFiles,
          role: "stamp_page",
        }),
        uploadAndAttach({
          token,
          files: commentsFiles,
          role: "reviewer_comments",
        }),
      ]);

      const res = await fetch(`/api/reviewer/${token}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: notes.trim() || null,
          rejectionReason:
            decision === "rejected" ? rejectionReason.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setErr((j?.message as string) || "Could not submit your response");
        setBusy(false);
        return;
      }
      setDone(decision);
    } catch {
      setErr("Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6fa",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Brand bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: ACCENT,
            }}
          >
            <Logo />
            <span
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 740,
                fontSize: 14,
                color: "#2b2f3d",
                letterSpacing: "-0.01em",
              }}
            >
              BuiltCRM — Reviewer access
            </span>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#64687a",
            }}
          >
            Link expires {expiresText}
          </div>
        </div>

        {/* Submittal metadata header */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #e6e9ef",
            borderRadius: 14,
            padding: "22px 26px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 620,
                color: "#4a4f60",
              }}
            >
              {submittal.number}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "#64687a",
              }}
            >
              {submittal.specSection}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#64687a",
                fontWeight: 520,
              }}
            >
              ·
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#64687a",
                fontWeight: 520,
              }}
            >
              {submittal.submittalTypeLabel}
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 820,
              letterSpacing: "-0.01em",
              margin: "0 0 14px",
              color: "#12141b",
            }}
          >
            {submittal.title}
          </h1>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 16,
              rowGap: 6,
              fontSize: 13,
            }}
          >
            <Meta label="Sent by">{sender.name}</Meta>
            {sentText ? <Meta label="Sent on">{sentText}</Meta> : null}
            {dueText ? <Meta label="Due">{dueText}</Meta> : null}
            <Meta label="Your login">{reviewer.email}</Meta>
          </div>
          {sender.notes ? (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                background: "#f4f6fa",
                border: "1px solid #e6e9ef",
                borderRadius: 10,
                fontSize: 13,
                color: "#12141b",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#64687a",
                  marginBottom: 6,
                }}
              >
                Notes from {sender.name}
              </div>
              {sender.notes}
            </div>
          ) : null}
          {sender.coverDocUrl && sender.coverDocTitle ? (
            <div style={{ marginTop: 10 }}>
              <DocLink title={sender.coverDocTitle} url={sender.coverDocUrl} />
            </div>
          ) : null}
        </section>

        {/* Package documents */}
        <Section title="Package to review">
          {packageDocs.length === 0 ? (
            <div style={{ fontSize: 13, color: "#64687a" }}>
              No package documents attached. Reach out to {sender.name}
              {sender.email ? ` at ${sender.email}` : ""} if this looks wrong.
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {packageDocs.map((d) => (
                <li key={d.id} style={{ marginBottom: 8 }}>
                  <DocLink
                    title={d.title}
                    url={d.url}
                    sizeBytes={d.fileSizeBytes}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Decision */}
        <Section title="Your decision">
          <div style={{ display: "grid", gap: 8 }}>
            {DECISION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  border: `1.5px solid ${decision === opt.value ? ACCENT : "#e6e9ef"}`,
                  borderRadius: 10,
                  background: decision === opt.value ? `${ACCENT}0d` : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="decision"
                  value={opt.value}
                  checked={decision === opt.value}
                  onChange={() => setDecision(opt.value)}
                  style={{ marginTop: 2, accentColor: ACCENT }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      fontWeight: 680,
                      fontSize: 14,
                      color: "#12141b",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 13,
                      color: "#4a4f60",
                    }}
                  >
                    {opt.blurb}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {decision === "rejected" ? (
            <Field label="Reason for rejection">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="What's wrong with the package?"
                style={{
                  ...inputStyle,
                  height: 88,
                  padding: 12,
                  resize: "vertical",
                }}
              />
            </Field>
          ) : null}
          <Field label="Notes to the contractor (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                height: 88,
                padding: 12,
                resize: "vertical",
              }}
            />
          </Field>
        </Section>

        {/* Uploads */}
        <Section title="Stamp + markups">
          <Field label="Stamp page (optional — the PDF you stamped)">
            <Dropzone
              files={stampFiles}
              onChange={setStampFiles}
              accept="application/pdf,image/*"
              accent={ACCENT}
            />
          </Field>
          <Field label="Reviewer comments doc (optional)">
            <Dropzone
              files={commentsFiles}
              onChange={setCommentsFiles}
              accept="application/pdf,image/*"
              accent={ACCENT}
            />
          </Field>
        </Section>

        {err ? (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              background: "#fce5e1",
              border: "1px solid #f1bbb3",
              color: "#a93930",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={submit}
            disabled={busy || !decision}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 44,
              padding: "0 22px",
              background: busy || !decision ? "#c3c8d4" : ACCENT,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 680,
              fontSize: 14,
              cursor: busy || !decision ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Submitting…" : "Submit decision"}
          </button>
        </div>
        <p
          style={{
            marginTop: 12,
            fontSize: 11,
            color: "#8a8f9e",
            textAlign: "right",
          }}
        >
          Submissions are final. Contact {sender.name} if you need to change
          your decision after submitting.
        </p>
      </div>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 620,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#64687a",
          margin: 0,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 13,
          color: "#12141b",
          fontWeight: 520,
        }}
      >
        {children}
      </dd>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e6e9ef",
        borderRadius: 14,
        padding: "20px 26px",
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#64687a",
          margin: "0 0 14px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginTop: 14 }}>
      <div
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 620,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#64687a",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #dfe2eb",
  borderRadius: 8,
  fontFamily: "'Instrument Sans', system-ui, sans-serif",
  fontSize: 13,
  color: "#12141b",
  boxSizing: "border-box",
};

function DocLink({
  title,
  url,
  sizeBytes,
}: {
  title: string;
  url: string;
  sizeBytes?: number | null;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        background: "#f4f6fa",
        border: "1px solid #e6e9ef",
        borderRadius: 10,
        textDecoration: "none",
        color: "#12141b",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#64687a" }}>{I.file}</span>
      <span style={{ fontWeight: 620 }}>{title}</span>
      {sizeBytes ? (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#8a8f9e",
          }}
        >
          {Math.round(sizeBytes / 1024)} KB
        </span>
      ) : null}
    </a>
  );
}

function Dropzone({
  files,
  onChange,
  accept,
  accent,
}: {
  files: File[];
  onChange: (f: File[]) => void;
  accept?: string;
  accent: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const id = useMemo(
    () => `rdz-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const handle = (list: FileList | null) => {
    if (!list) return;
    onChange(Array.from(list).slice(0, 1));
  };
  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handle(e.dataTransfer.files);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "22px 16px",
          border: `1.5px dashed ${dragOver ? accent : "#c3c8d4"}`,
          borderRadius: 10,
          background: dragOver ? `${accent}0d` : "#fafbfd",
          cursor: "pointer",
          textAlign: "center",
          transition: "all 0.12s ease",
        }}
      >
        <div style={{ color: accent, marginBottom: 6 }}>{I.upload}</div>
        <div
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 620,
            color: "#2b2f3d",
          }}
        >
          Drop a file here or click to choose
        </div>
        <input
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => handle(e.target.files)}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "10px 0 0",
          }}
        >
          {files.map((f, i) => (
            <li
              key={`${f.name}:${f.size}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "#fff",
                border: "1px solid #e6e9ef",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span style={{ color: "#64687a", flexShrink: 0 }}>
                  {I.file}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#2b2f3d",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, ix) => ix !== i))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64687a",
                  cursor: "pointer",
                }}
                aria-label={`Remove ${f.name}`}
              >
                {I.x}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SuccessScreen({ decision }: { decision: Decision }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f4f6fa",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#fff",
          border: "1px solid #e6e9ef",
          borderRadius: 14,
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 8px 30px rgba(20,22,30,0.06)",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            margin: "0 auto 18px",
            borderRadius: "50%",
            background: "#e0f2e6",
            color: "#2f7d48",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {I.check}
        </div>
        <h1
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 820,
            letterSpacing: "-0.01em",
            margin: "0 0 10px",
            color: "#12141b",
          }}
        >
          Decision submitted
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "#4a4f60",
            margin: "0 0 14px",
          }}
        >
          You recorded <strong>{STATUS_LABEL[decision as SubmittalStatus]}</strong>
          . The contractor has been notified and will forward the result to the
          sub.
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#8a8f9e",
            margin: 0,
          }}
        >
          This link is now inactive. You can safely close this tab.
        </p>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="4"
        width="14"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="4"
        rx="1"
        fill="currentColor"
      />
      <rect
        x="8"
        y="16"
        width="14"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Upload helper — token-scoped variant of uploadToProject. Runs
// sequentially to keep the flow simple; reviewer uploads are almost
// always <= 2 files so parallel doesn't buy much.
// ─────────────────────────────────────────────────────────────────

async function uploadAndAttach(input: {
  token: string;
  files: File[];
  role: "stamp_page" | "reviewer_comments";
}): Promise<void> {
  for (const f of input.files) {
    const req = await fetch(`/api/reviewer/${input.token}/upload-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: f.name,
        contentType: f.type || "application/octet-stream",
      }),
    });
    if (!req.ok) continue;
    const { uploadUrl, storageKey } = (await req.json()) as {
      uploadUrl: string;
      storageKey: string;
    };
    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: f,
      headers: {
        "content-type": f.type || "application/octet-stream",
      },
    });
    if (!put.ok) continue;
    await fetch(`/api/reviewer/${input.token}/attach-document`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storageKey,
        title: f.name,
        role: input.role,
      }),
    });
  }
}
