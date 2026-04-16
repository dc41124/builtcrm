"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import type { ClientProjectView } from "@/domain/loaders/project-home";

type Draw = ClientProjectView["drawRequests"][number];
type PillClass = "teal" | "amber" | "green" | "red" | "gray";

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const v = cents / 100;
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function statusView(status: string): { color: PillClass; label: string } {
  switch (status) {
    case "under_review":
      return { color: "amber", label: "Waiting for your review" };
    case "submitted":
      return { color: "teal", label: "Submitted" };
    case "approved":
    case "approved_with_note":
      return { color: "green", label: "Approved" };
    case "paid":
      return { color: "green", label: "Paid" };
    case "returned":
      return { color: "red", label: "Sent back" };
    default:
      return { color: "gray", label: status.replace(/_/g, " ") };
  }
}

function fileIconFor(documentType: string): {
  label: string;
  variant: "pdf" | "img" | "doc";
} {
  const t = documentType.toLowerCase();
  if (t.includes("image") || t.includes("photo") || t.includes("img"))
    return { label: "IMG", variant: "img" };
  if (t.includes("pdf")) return { label: "PDF", variant: "pdf" };
  return {
    label: documentType.slice(0, 3).toUpperCase() || "DOC",
    variant: "doc",
  };
}

const ClockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    width="14"
    height="14"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="M22 4 12 14.01l-3-3" />
  </svg>
);

const MessageIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export function ResidentialBillingReview({ draws }: { projectName: string; draws: Draw[] }) {
  const current = useMemo(
    () =>
      draws.find((d) => d.drawRequestStatus === "under_review") ??
      draws.find((d) => d.drawRequestStatus === "submitted") ??
      draws[0] ??
      null,
    [draws],
  );

  const past = useMemo(
    () =>
      draws.filter((d) =>
        ["approved", "approved_with_note", "paid"].includes(d.drawRequestStatus),
      ),
    [draws],
  );

  const pendingCount = useMemo(
    () =>
      draws.filter((d) => d.drawRequestStatus === "under_review").length,
    [draws],
  );

  if (!current) {
    return (
      <div className="rbr">
        <header className="rbr-head">
          <h1 className="rbr-title">Payment Review</h1>
          <p className="rbr-desc">
            Your builder hasn&apos;t submitted a payment request yet. When they
            do, you&apos;ll see it here for review.
          </p>
        </header>
        <div className="rbr-card">
          <EmptyState
            title="No payments to review"
            description="You're all caught up. Your builder will let you know when the next milestone is ready."
          />
        </div>

      </div>
    );
  }

  const status = statusView(current.drawRequestStatus);
  const budgetTotal = current.contractSumToDateCents;
  const paidToDate = past.reduce(
    (acc, d) => acc + d.currentPaymentDueCents,
    0,
  );
  const thisPayment = current.currentPaymentDueCents;
  const afterThis = paidToDate + thisPayment;
  const remaining = Math.max(budgetTotal - afterThis, 0);
  const paidPct = budgetTotal > 0 ? (paidToDate / budgetTotal) * 100 : 0;
  const thisPct = budgetTotal > 0 ? (thisPayment / budgetTotal) * 100 : 0;

  return (
    <div className="rbr">
      <header className="rbr-head">
        <h1 className="rbr-title">Payment Review</h1>
        <p className="rbr-desc">
          Your builder has submitted a payment request for recent work. Review
          what was done and approve when you&apos;re ready.
        </p>
        <div className="rbr-head-pills">
          {pendingCount > 0 && (
            <span className="rbr-pl amber">
              {pendingCount} payment{pendingCount === 1 ? "" : "s"} waiting for you
            </span>
          )}
          <span className="rbr-pl teal">
            Draw #{current.drawNumber} · {monthLabel(current.periodFrom)}
          </span>
        </div>
      </header>

      <div className="rbr-hero">
        <div className="rbr-hero-main">
          <div className="rbr-hero-lbl">Payment requested</div>
          <div className="rbr-hero-val">{fmtMoney(thisPayment)}</div>
          <div className="rbr-hero-desc">
            This covers work completed during{" "}
            {monthLabel(current.periodFrom)}.
            {current.submittedAt
              ? ` Your builder submitted this on ${fmtDate(current.submittedAt)}.`
              : ""}
          </div>
        </div>
        <div className="rbr-hero-status">
          <div className="rbr-hero-status-lbl">Status</div>
          <div className={`rbr-status-pill ${status.color}`}>
            <ClockIcon />
            {status.label}
          </div>
        </div>
      </div>

      <div className="rbr-layout">
        <div className="rbr-main">
          <div className="rbr-card">
            <div className="rbr-card-h">
              <div>
                <h3>What this payment covers</h3>
                <p className="sub">Work completed during this billing period</p>
              </div>
            </div>
            <div className="rbr-card-b">
              {current.lineItems.length === 0 ? (
                <p className="rbr-empty">
                  Line-item details aren&apos;t available for this payment.
                </p>
              ) : (
                <div className="rbr-work">
                  {current.lineItems
                    .filter((l) => l.workCompletedThisPeriodCents > 0)
                    .map((l) => (
                      <div key={l.id} className="rbr-work-row">
                        <div className="rbr-work-info">
                          <div className="rbr-work-desc">{l.description}</div>
                          <div className="rbr-work-detail">
                            Item {l.itemNumber} ·{" "}
                            {(l.percentCompleteBasisPoints / 100).toFixed(0)}%
                            complete
                          </div>
                        </div>
                        <div className="rbr-work-amt">
                          {fmtMoney(l.workCompletedThisPeriodCents)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              <div className="rbr-work-total">
                <span>Total this payment</span>
                <span className="v">{fmtMoney(thisPayment)}</span>
              </div>
            </div>
          </div>

          <DecisionCard draw={current} />

          <div className="rbr-card">
            <div className="rbr-card-h">
              <div>
                <h3>Supporting documents</h3>
                <p className="sub">Files attached to this payment request</p>
              </div>
              {current.supportingFiles.length > 0 && (
                <span className="rbr-pl gray">
                  {current.supportingFiles.length} file
                  {current.supportingFiles.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="rbr-card-b">
              {current.supportingFiles.length === 0 ? (
                <p className="rbr-empty">
                  Your builder will attach invoices, receipts, and photos here
                  when they&apos;re available.
                </p>
              ) : (
                <div className="rbr-files">
                  {current.supportingFiles.map((f) => {
                    const icon = fileIconFor(f.documentType);
                    return (
                      <div key={f.id} className="rbr-file">
                        <div className="rbr-file-left">
                          <div className={`rbr-file-icon ${icon.variant}`}>
                            {icon.label}
                          </div>
                          <div className="rbr-file-info">
                            <div className="rbr-file-name">{f.title}</div>
                            <div className="rbr-file-meta">
                              {f.linkRole.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                        <button type="button" className="rbr-btn xs">
                          Download
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="rbr-rail">
          <div className="rbr-card">
            <div className="rbr-card-h">
              <div>
                <h3>Budget context</h3>
                <p className="sub">Where this payment fits</p>
              </div>
            </div>
            <div className="rbr-card-b">
              <div className="rbr-budget-head">
                <span className="k">Total budget</span>
                <span className="v">{fmtMoney(budgetTotal)}</span>
              </div>
              <div className="rbr-bar">
                <div
                  className="rbr-bar-paid"
                  style={{ width: `${Math.min(paidPct, 100)}%` }}
                />
                <div
                  className="rbr-bar-this"
                  style={{ width: `${Math.min(thisPct, 100)}%` }}
                />
              </div>
              <div className="rbr-bar-legend">
                <span>
                  <span className="dot paid" /> Paid {fmtMoney(paidToDate)}
                </span>
                <span>
                  <span className="dot this" /> This draw {fmtMoney(thisPayment)}
                </span>
              </div>
              <div className="rbr-budget-rows">
                <div className="rbr-budget-row">
                  <span>Paid so far</span>
                  <span className="v ok">{fmtMoney(paidToDate)}</span>
                </div>
                <div className="rbr-budget-row">
                  <span>This payment</span>
                  <span className="v warn">{fmtMoney(thisPayment)}</span>
                </div>
                <div className="rbr-budget-row">
                  <span>After this draw</span>
                  <span className="v">{fmtMoney(afterThis)}</span>
                </div>
                <div className="rbr-budget-row">
                  <span>Remaining</span>
                  <span className="v">{fmtMoney(remaining)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rbr-card">
            <div className="rbr-card-h">
              <div>
                <h3>Past payments</h3>
                <p className="sub">Your payment history</p>
              </div>
            </div>
            <div className="rbr-card-b">
              {past.length === 0 ? (
                <p className="rbr-empty">No past payments yet.</p>
              ) : (
                past.map((d) => (
                  <div key={d.id} className="rbr-past-row">
                    <div className="rbr-past-info">
                      <div className="rbr-past-title">
                        Draw #{d.drawNumber} · {monthLabel(d.periodFrom)}
                      </div>
                      <div className="rbr-past-detail">
                        {d.reviewedAt && `Approved ${fmtDate(d.reviewedAt)}`}
                        {d.paidAt && ` · Paid ${fmtDate(d.paidAt)}`}
                      </div>
                    </div>
                    <div className="rbr-past-amt">
                      {fmtMoney(d.currentPaymentDueCents)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rbr-card">
            <div className="rbr-card-h">
              <div>
                <h3>Questions?</h3>
              </div>
            </div>
            <div className="rbr-card-b">
              <div className="rbr-pm">
                <div className="rbr-pm-av">PM</div>
                <div className="rbr-pm-info">
                  <div className="rbr-pm-name">Your project manager</div>
                  <div className="rbr-pm-sub">
                    Ask before approving if anything looks off
                  </div>
                </div>
                <button type="button" className="rbr-btn sm">
                  Message
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DecisionCard({ draw }: { draw: Draw }) {
  const router = useRouter();
  const canDecide = draw.drawRequestStatus === "under_review";
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<null | "approve" | "question">(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  async function approve() {
    setPending("approve");
    setError(null);
    const body = note.trim()
      ? { note: note.trim() }
      : {};
    const endpoint = note.trim() ? "approve-with-note" : "approve";
    const res = await fetch(`/api/draw-requests/${draw.id}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? b.error ?? "Unable to approve");
      return;
    }
    setApproved(true);
    router.refresh();
  }

  async function askQuestion() {
    if (!note.trim()) {
      setError("Add a note so your builder knows what to clarify.");
      return;
    }
    setPending("question");
    setError(null);
    const res = await fetch(`/api/draw-requests/${draw.id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: note.trim() }),
    });
    setPending(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? b.error ?? "Unable to send question");
      return;
    }
    router.refresh();
  }

  if (!canDecide) {
    return (
      <div className="rbr-card">
        <div className="rbr-card-h">
          <div>
            <h3>Decision</h3>
            <p className="sub">
              This payment is{" "}
              {statusView(draw.drawRequestStatus).label.toLowerCase()}.
            </p>
          </div>
        </div>
        <div className="rbr-card-b">
          <p className="rbr-empty">
            {draw.drawRequestStatus === "paid"
              ? "This payment has been sent."
              : draw.drawRequestStatus === "approved" ||
                  draw.drawRequestStatus === "approved_with_note"
                ? "You've already approved this payment. It will be processed according to your contract."
                : "Waiting on your builder."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rbr-dec">
      <div className="rbr-dec-h">
        <h3>Your decision</h3>
        <p>
          If everything looks right, approve the payment. If you have questions
          or something doesn&apos;t look right, send a message to your builder
          and they&apos;ll sort it out.
        </p>
      </div>
      <div className="rbr-dec-b">
        <div className="rbr-dec-acts">
          <button
            type="button"
            className={`rbr-btn lg ${approved ? "done" : "pri"}`}
            onClick={approve}
            disabled={pending != null || approved}
          >
            <CheckIcon />
            {approved
              ? "Approved"
              : pending === "approve"
                ? "Approving…"
                : "Approve this payment"}
          </button>
          <button
            type="button"
            className="rbr-btn lg"
            onClick={askQuestion}
            disabled={pending != null || approved}
          >
            <MessageIcon />
            {pending === "question" ? "Sending…" : "Ask a question first"}
          </button>
        </div>
        <div>
          <textarea
            className="rbr-dec-ta"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional — add a note for your builder (e.g., 'Looks good, thanks!' or 'Can you clarify the material cost?')"
            disabled={pending != null || approved}
          />
        </div>
        {error && <p className="rbr-err">{error}</p>}
        <div className="rbr-explainer">
          <h5>What happens when you approve?</h5>
          <p>
            Your builder receives your approval and the payment moves forward
            according to your contract terms. You&apos;ll see this show up
            under &ldquo;Past payments&rdquo; once it&apos;s processed. If you
            have questions, use the message button — nothing moves forward
            until you say it&apos;s OK.
          </p>
        </div>
      </div>
    </div>
  );
}
