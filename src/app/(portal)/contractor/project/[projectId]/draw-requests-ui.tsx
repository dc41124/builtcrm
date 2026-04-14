"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DrawLineItem = {
  id: string;
  sovLineItemId: string;
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
  sovId: string;
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
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  returnedAt?: Date | null;
  returnReason?: string | null;
  paidAt?: Date | null;
  paymentReferenceName?: string | null;
  lineItems: DrawLineItem[];
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function toIsoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function ContractorDrawRequestsPanel({
  projectId,
  sovId,
  sovStatus,
  draws,
}: {
  projectId: string;
  sovId: string | null;
  sovStatus: string | null;
  draws: DrawRequest[];
}) {
  const canCreate = sovId != null && (sovStatus === "active" || sovStatus === "locked");

  return (
    <>
      {canCreate ? (
        <CreateDrawForm projectId={projectId} sovId={sovId!} />
      ) : (
        <p>Activate a Schedule of Values before creating a draw request.</p>
      )}

      {draws.length === 0 ? (
        <p>No draw requests yet.</p>
      ) : (
        draws.map((d) => <DrawCard key={d.id} draw={d} />)
      )}
    </>
  );
}

function CreateDrawForm({
  projectId,
  sovId,
}: {
  projectId: string;
  sovId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [periodFrom, setPeriodFrom] = useState(today);
  const [periodTo, setPeriodTo] = useState(today);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/draw-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        sovId,
        periodFrom: new Date(periodFrom).toISOString(),
        periodTo: new Date(periodTo).toISOString(),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 6, maxWidth: 360 }}>
      <label>
        Period from{" "}
        <input
          type="date"
          required
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
        />
      </label>
      <label>
        Period to{" "}
        <input
          type="date"
          required
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create draw request"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}

function DrawCard({ draw }: { draw: DrawRequest }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDraft = draw.drawRequestStatus === "draft";
  const isRevised = draw.drawRequestStatus === "revised";
  const isEditable = isDraft || isRevised;
  const isSubmitted = draw.drawRequestStatus === "submitted";
  const isReturned = draw.drawRequestStatus === "returned";
  const isPayable =
    draw.drawRequestStatus === "approved" ||
    draw.drawRequestStatus === "approved_with_note";
  const [paymentRef, setPaymentRef] = useState("");

  async function transition(kind: "submit" | "revise" | "start-review") {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/draw-requests/${draw.id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `${kind}_failed`);
      return;
    }
    router.refresh();
  }

  async function markPaid() {
    if (paymentRef.trim().length === 0) {
      setError("payment_reference_required");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/draw-requests/${draw.id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentReferenceName: paymentRef.trim() }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "mark_paid_failed");
      return;
    }
    router.refresh();
  }

  return (
    <section style={{ border: "1px solid #ccc", padding: 12, marginTop: 12 }}>
      <h3>
        Draw #{draw.drawNumber} [{draw.drawRequestStatus}]
      </h3>
      <p>
        Period {toIsoDate(draw.periodFrom)} → {toIsoDate(draw.periodTo)}
      </p>
      <p>
        Contract sum to date: {formatCents(draw.contractSumToDateCents)} (original{" "}
        {formatCents(draw.originalContractSumCents)} + change orders{" "}
        {formatCents(draw.netChangeOrdersCents)})
      </p>
      {!isDraft && (
        <p>
          Completed to date: {formatCents(draw.totalCompletedToDateCents)} ·
          Retainage: {formatCents(draw.totalRetainageCents)} · Earned less
          retainage: {formatCents(draw.totalEarnedLessRetainageCents)} · Previous
          certificates: {formatCents(draw.previousCertificatesCents)} ·{" "}
          <strong>Current payment due: {formatCents(draw.currentPaymentDueCents)}</strong>{" "}
          · Balance to finish: {formatCents(draw.balanceToFinishCents)}
        </p>
      )}

      {draw.lineItems.length === 0 ? (
        <p>No line items (SOV had no active lines at draw creation).</p>
      ) : (
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
              <DrawLineRow
                key={l.id}
                drawId={draw.id}
                line={l}
                editable={isEditable}
              />
            ))}
          </tbody>
        </table>
      )}

      {isEditable && (
        <button
          type="button"
          disabled={pending}
          onClick={() => transition("submit")}
        >
          {isRevised ? "Resubmit draw" : "Submit draw"}
        </button>
      )}
      {isReturned && (
        <button
          type="button"
          disabled={pending}
          onClick={() => transition("revise")}
        >
          Reopen for revision
        </button>
      )}
      {isSubmitted && (
        <button
          type="button"
          disabled={pending}
          onClick={() => transition("start-review")}
        >
          Start review
        </button>
      )}
      {isPayable && (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Payment reference (e.g., ACH #4821)"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />
          <button type="button" disabled={pending} onClick={markPaid}>
            {pending ? "Saving…" : "Mark paid"}
          </button>
        </div>
      )}
      {draw.reviewNote && (
        <p>
          Client note: "{draw.reviewNote}"
        </p>
      )}
      {draw.returnReason && (
        <p>
          Returned: "{draw.returnReason}"
        </p>
      )}
      {draw.paidAt && draw.paymentReferenceName && (
        <p>
          Paid — ref {draw.paymentReferenceName}
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </section>
  );
}

function DrawLineRow({
  drawId,
  line,
  editable,
}: {
  drawId: string;
  line: DrawLineItem;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thisPeriod, setThisPeriod] = useState(
    (line.workCompletedThisPeriodCents / 100).toFixed(2),
  );
  const [stored, setStored] = useState(
    (line.materialsPresentlyStoredCents / 100).toFixed(2),
  );

  async function save() {
    setPending(true);
    setError(null);
    const thisCents = Math.round(Number.parseFloat(thisPeriod) * 100);
    const storedCents = Math.round(Number.parseFloat(stored) * 100);
    if (!Number.isFinite(thisCents) || !Number.isFinite(storedCents)) {
      setPending(false);
      setError("invalid_amount");
      return;
    }
    const res = await fetch(`/api/draw-requests/${drawId}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sovLineItemId: line.sovLineItemId,
        workCompletedThisPeriodCents: thisCents,
        materialsPresentlyStoredCents: storedCents,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "save_failed");
      return;
    }
    router.refresh();
  }

  return (
    <tr>
      <td>{line.itemNumber}</td>
      <td>{line.description}</td>
      <td>{formatCents(line.scheduledValueCents)}</td>
      <td>{formatCents(line.workCompletedPreviousCents)}</td>
      <td>
        {editable ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={thisPeriod}
            onChange={(e) => setThisPeriod(e.target.value)}
            style={{ width: 90 }}
          />
        ) : (
          formatCents(line.workCompletedThisPeriodCents)
        )}
      </td>
      <td>
        {editable ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={stored}
            onChange={(e) => setStored(e.target.value)}
            style={{ width: 90 }}
          />
        ) : (
          formatCents(line.materialsPresentlyStoredCents)
        )}
      </td>
      <td>{formatCents(line.totalCompletedStoredToDateCents)}</td>
      <td>{(line.percentCompleteBasisPoints / 100).toFixed(1)}%</td>
      <td>{formatCents(line.balanceToFinishCents)}</td>
      <td>
        {formatCents(line.retainageCents)} ({line.retainagePercentApplied}%)
      </td>
      {editable && (
        <td>
          <button type="button" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
          {error && <span style={{ color: "crimson" }}> {error}</span>}
        </td>
      )}
    </tr>
  );
}
