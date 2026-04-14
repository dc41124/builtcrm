"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DrawLineItem = {
  id: string;
  itemNumber: string;
  description: string;
  scheduledValueCents: number;
  workCompletedPreviousCents: number;
  workCompletedThisPeriodCents: number;
  materialsPresentlyStoredCents: number;
  totalCompletedStoredToDateCents: number;
  percentCompleteBasisPoints: number;
  balanceToFinishCents: number;
  retainageCents: number;
  retainagePercentApplied: number;
};

type DrawRequest = {
  id: string;
  drawNumber: number;
  drawRequestStatus: string;
  periodFrom: Date;
  periodTo: Date;
  originalContractSumCents: number;
  netChangeOrdersCents: number;
  contractSumToDateCents: number;
  totalCompletedToDateCents: number;
  totalRetainageCents: number;
  totalEarnedLessRetainageCents: number;
  previousCertificatesCents: number;
  currentPaymentDueCents: number;
  balanceToFinishCents: number;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  returnedAt: Date | null;
  returnReason: string | null;
  paidAt: Date | null;
  paymentReferenceName: string | null;
  lineItems: DrawLineItem[];
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function toIsoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function ClientDrawReviewPanel({
  draws,
  isResidential,
}: {
  draws: DrawRequest[];
  isResidential: boolean;
}) {
  if (draws.length === 0) {
    return (
      <p>
        No {isResidential ? "progress billings" : "draw requests"} have been
        released for review yet.
      </p>
    );
  }
  return (
    <>
      {draws.map((d) => (
        <DrawReviewCard key={d.id} draw={d} />
      ))}
    </>
  );
}

type Decision = "approve" | "approve-with-note" | "return";

function DrawReviewCard({ draw }: { draw: DrawRequest }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDecide = draw.drawRequestStatus === "under_review";

  async function submit() {
    if (!decision) return;
    if (decision !== "approve" && note.trim().length === 0) {
      setError("note_required");
      return;
    }
    setPending(true);
    setError(null);
    const body =
      decision === "approve-with-note"
        ? { note: note.trim() }
        : decision === "return"
          ? { reason: note.trim() }
          : {};
    const res = await fetch(`/api/draw-requests/${draw.id}/${decision}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "decision_failed");
      return;
    }
    setDecision(null);
    setNote("");
    router.refresh();
  }

  return (
    <section style={{ border: "1px solid #ccc", padding: 12, marginTop: 12 }}>
      <h3>
        Draw #{draw.drawNumber} [{draw.drawRequestStatus}]
      </h3>
      <p>
        Period {toIsoDate(draw.periodFrom)} → {toIsoDate(draw.periodTo)}
        {draw.submittedAt
          ? ` · Submitted ${toIsoDate(draw.submittedAt)}`
          : ""}
      </p>
      <p>
        Contract sum to date: {formatCents(draw.contractSumToDateCents)} ·
        Completed to date: {formatCents(draw.totalCompletedToDateCents)} ·
        Retainage: {formatCents(draw.totalRetainageCents)} · Earned less
        retainage: {formatCents(draw.totalEarnedLessRetainageCents)} ·
        Previous certificates: {formatCents(draw.previousCertificatesCents)} ·{" "}
        <strong>
          Current payment due: {formatCents(draw.currentPaymentDueCents)}
        </strong>{" "}
        · Balance to finish: {formatCents(draw.balanceToFinishCents)}
      </p>

      {draw.reviewedAt && (
        <p>
          Reviewed {toIsoDate(draw.reviewedAt)}
          {draw.reviewNote ? ` — "${draw.reviewNote}"` : ""}
        </p>
      )}
      {draw.returnedAt && draw.returnReason && (
        <p>
          Returned {toIsoDate(draw.returnedAt)} — "{draw.returnReason}"
        </p>
      )}
      {draw.paidAt && (
        <p>
          Paid {toIsoDate(draw.paidAt)}
          {draw.paymentReferenceName
            ? ` · Ref: ${draw.paymentReferenceName}`
            : ""}
        </p>
      )}

      {draw.lineItems.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Scheduled</th>
              <th>From previous</th>
              <th>This period</th>
              <th>Stored</th>
              <th>Total to date</th>
              <th>%</th>
              <th>Balance</th>
              <th>Retainage</th>
            </tr>
          </thead>
          <tbody>
            {draw.lineItems.map((l) => (
              <tr key={l.id}>
                <td>{l.itemNumber}</td>
                <td>{l.description}</td>
                <td>{formatCents(l.scheduledValueCents)}</td>
                <td>{formatCents(l.workCompletedPreviousCents)}</td>
                <td>{formatCents(l.workCompletedThisPeriodCents)}</td>
                <td>{formatCents(l.materialsPresentlyStoredCents)}</td>
                <td>{formatCents(l.totalCompletedStoredToDateCents)}</td>
                <td>{(l.percentCompleteBasisPoints / 100).toFixed(1)}%</td>
                <td>{formatCents(l.balanceToFinishCents)}</td>
                <td>
                  {formatCents(l.retainageCents)} ({l.retainagePercentApplied}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canDecide && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDecision("approve")}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDecision("approve-with-note")}
            >
              Approve with note
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDecision("return")}
            >
              Return for clarification
            </button>
          </div>
          {decision && (
            <div style={{ marginTop: 8 }}>
              {decision !== "approve" && (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    decision === "return"
                      ? "Describe what needs clarification…"
                      : "Add your billing note…"
                  }
                  rows={3}
                  style={{ width: "100%", maxWidth: 480 }}
                />
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button type="button" disabled={pending} onClick={submit}>
                  {pending ? "Submitting…" : `Submit ${decision}`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDecision(null);
                    setNote("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        </div>
      )}
    </section>
  );
}
