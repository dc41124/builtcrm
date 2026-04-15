"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type { ClientProjectView } from "@/domain/loaders/project-home";

type Draw = ClientProjectView["drawRequests"][number];

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

function statusView(
  status: string,
): { color: PillColor; label: string } {
  switch (status) {
    case "under_review":
      return { color: "amber", label: "Waiting for your review" };
    case "submitted":
      return { color: "blue", label: "Submitted" };
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
        <ResidentialStyles />
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
            <Pill color="amber">
              {pendingCount} payment{pendingCount === 1 ? "" : "s"} waiting for you
            </Pill>
          )}
          <Pill color="green">
            Draw #{current.drawNumber} · {monthLabel(current.periodFrom)}
          </Pill>
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
          <Pill color={status.color}>{status.label}</Pill>
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
            </div>
            <div className="rbr-card-b">
              <p className="rbr-empty">
                Your builder will attach invoices, receipts, and photos here
                when they&apos;re available.
              </p>
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

      <ResidentialStyles />
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
          or something doesn&apos;t look right, send a question to your builder
          and they&apos;ll sort it out.
        </p>
      </div>
      <div className="rbr-dec-b">
        <div className="rbr-dec-acts">
          <button
            type="button"
            className="rbr-btn pri lg"
            onClick={approve}
            disabled={pending != null || approved}
          >
            {approved
              ? "✓ Approved"
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
            {pending === "question" ? "Sending…" : "Ask a question first"}
          </button>
        </div>
        <textarea
          className="rbr-dec-ta"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — add a note for your builder (e.g., 'Looks good, thanks!' or 'Can you clarify the material cost?')"
          disabled={pending != null || approved}
        />
        {error && <p className="rbr-err">{error}</p>}
        <div className="rbr-explainer">
          <h5>What happens when you approve?</h5>
          <p>
            Your builder receives your approval and the payment moves forward
            according to your contract terms. You&apos;ll see this show up
            under &ldquo;Past payments&rdquo; once it&apos;s processed. If you
            have questions, use the Ask a question button — nothing moves
            forward until you say it&apos;s OK.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResidentialStyles() {
  return (
    <style>{`
      .rbr{display:flex;flex-direction:column;gap:20px}
      .rbr-head{display:flex;flex-direction:column;gap:6px}
      .rbr-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
      .rbr-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:640px;margin:0}
      .rbr-head-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}

      .rbr-hero{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;display:flex;justify-content:space-between;align-items:center;gap:20px;box-shadow:var(--shsm);flex-wrap:wrap}
      .rbr-hero-main{flex:1;min-width:0}
      .rbr-hero-lbl{font-family:var(--fb);font-size:12.5px;font-weight:580;color:var(--t2);margin-bottom:4px}
      .rbr-hero-val{font-family:var(--fd);font-size:38px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.1}
      .rbr-hero-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin-top:8px;max-width:460px;line-height:1.5}
      .rbr-hero-status{text-align:right;flex-shrink:0;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
      .rbr-hero-status-lbl{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}

      .rbr-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start}
      @media(max-width:1200px){.rbr-layout{grid-template-columns:1fr}}
      .rbr-main{display:grid;gap:20px;min-width:0}
      .rbr-rail{display:grid;gap:20px;min-width:0;align-content:start}

      .rbr-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shsm)}
      .rbr-card-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
      .rbr-card-h h3{font-family:var(--fd);font-size:15px;font-weight:720;letter-spacing:-.01em;color:var(--t1);margin:0}
      .rbr-card-h .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin:2px 0 0}
      .rbr-card-b{padding:16px 20px}

      .rbr-empty{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t3);margin:0;line-height:1.55}

      .rbr-work{display:grid;gap:8px}
      .rbr-work-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border:1px solid var(--s3);border-radius:var(--r-l);background:var(--sh);gap:12px}
      .rbr-work-info{min-width:0;flex:1}
      .rbr-work-desc{font-family:var(--fb);font-size:13px;font-weight:620;color:var(--t1)}
      .rbr-work-detail{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
      .rbr-work-amt{font-family:var(--fd);font-size:14px;font-weight:740;color:var(--t1);flex-shrink:0}
      .rbr-work-total{display:flex;justify-content:space-between;align-items:center;padding-top:14px;margin-top:12px;border-top:1px solid var(--s3);font-family:var(--fb);font-size:14px;font-weight:620;color:var(--t1)}
      .rbr-work-total .v{font-family:var(--fd);font-size:18px;font-weight:820}

      .rbr-dec{background:var(--s1);border:2px solid color-mix(in srgb,var(--ac) 45%,var(--s3));border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shsm)}
      .rbr-dec-h{padding:20px;background:linear-gradient(180deg,var(--ac-s),var(--s1));border-bottom:1px solid var(--s3)}
      .rbr-dec-h h3{font-family:var(--fd);font-size:16px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
      .rbr-dec-h p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:6px 0 0;line-height:1.55}
      .rbr-dec-b{padding:20px;display:grid;gap:16px}
      .rbr-dec-acts{display:flex;gap:8px;flex-wrap:wrap}
      .rbr-dec-ta{width:100%;min-height:80px;border:1px solid var(--s3);border-radius:var(--r-m);padding:12px;font-family:var(--fb);font-size:13px;resize:vertical;outline:none;transition:all var(--df) var(--e);background:var(--s1);color:var(--t1)}
      .rbr-dec-ta:focus{border-color:var(--ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
      .rbr-dec-ta:disabled{opacity:.6;cursor:not-allowed}
      .rbr-err{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--dg-t);margin:0}

      .rbr-explainer{background:var(--ac-s);border:1px solid color-mix(in srgb,var(--ac) 30%,var(--s3));border-radius:var(--r-l);padding:14px 16px}
      .rbr-explainer h5{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--ac-t);margin:0 0 4px}
      .rbr-explainer p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

      .rbr-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      .rbr-btn:hover:not(:disabled){border-color:var(--s4);background:var(--sh)}
      .rbr-btn:disabled{opacity:.6;cursor:not-allowed}
      .rbr-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
      .rbr-btn.pri:hover:not(:disabled){background:var(--ac-h);border-color:var(--ac-h)}
      .rbr-btn.lg{height:40px;padding:0 20px;font-size:13.5px;font-weight:660}
      .rbr-btn.sm{height:30px;padding:0 12px;font-size:12px}

      .rbr-budget-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
      .rbr-budget-head .k{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
      .rbr-budget-head .v{font-family:var(--fd);font-size:16px;font-weight:820;color:var(--t1)}
      .rbr-bar{height:8px;background:var(--s3);border-radius:999px;overflow:hidden;display:flex}
      .rbr-bar-paid{height:100%;background:var(--ac)}
      .rbr-bar-this{height:100%;background:var(--wr);opacity:.75}
      .rbr-bar-legend{display:flex;gap:16px;margin-top:8px}
      .rbr-bar-legend>span{display:flex;align-items:center;gap:4px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3)}
      .rbr-bar-legend .dot{width:8px;height:8px;border-radius:50%}
      .rbr-bar-legend .dot.paid{background:var(--ac)}
      .rbr-bar-legend .dot.this{background:var(--wr);opacity:.75}
      .rbr-budget-rows{display:grid;gap:8px;border-top:1px solid var(--s3);padding-top:12px;margin-top:12px}
      .rbr-budget-row{display:flex;justify-content:space-between;align-items:center;font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
      .rbr-budget-row .v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1)}
      .rbr-budget-row .v.ok{color:var(--ok-t)}
      .rbr-budget-row .v.warn{color:var(--wr-t)}

      .rbr-past-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--s3);gap:12px}
      .rbr-past-row:first-child{padding-top:0}
      .rbr-past-row:last-child{border-bottom:none;padding-bottom:0}
      .rbr-past-info{min-width:0;flex:1}
      .rbr-past-title{font-family:var(--fb);font-size:13px;font-weight:620;color:var(--t1)}
      .rbr-past-detail{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
      .rbr-past-amt{font-family:var(--fd);font-size:14px;font-weight:740;color:var(--ok-t);flex-shrink:0}

      .rbr-pm{display:flex;align-items:center;gap:12px}
      .rbr-pm-av{width:36px;height:36px;border-radius:50%;background:var(--ac);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700;flex-shrink:0}
      .rbr-pm-info{flex:1;min-width:0}
      .rbr-pm-name{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
      .rbr-pm-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:1px}
    `}</style>
  );
}
