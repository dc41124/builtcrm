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

type LienWaiver = {
  id: string;
  drawRequestId: string;
  organizationId: string;
  lienWaiverType:
    | "conditional_progress"
    | "unconditional_progress"
    | "conditional_final"
    | "unconditional_final";
  lienWaiverStatus:
    | "requested"
    | "submitted"
    | "accepted"
    | "rejected"
    | "waived";
  amountCents: number;
  throughDate: Date | null;
  documentId: string | null;
  requestedAt: Date | null;
  submittedAt: Date | null;
  acceptedAt: Date | null;
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
  retainageReleasedCents: number;
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
  lienWaivers: LienWaiver[];
};

function waiverTypeLabel(t: LienWaiver["lienWaiverType"]): string {
  switch (t) {
    case "conditional_progress":
      return "Conditional progress";
    case "unconditional_progress":
      return "Unconditional progress";
    case "conditional_final":
      return "Conditional final";
    case "unconditional_final":
      return "Unconditional final";
  }
}

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
        draws.map((d) => <DrawCard key={d.id} draw={d} projectId={projectId} />)
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

function DrawCard({ draw, projectId }: { draw: DrawRequest; projectId: string }) {
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
    <section style={{ border: "1px solid var(--s3)", padding: 12, marginTop: 12 }}>
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
          {draw.retainageReleasedCents > 0 && (
            <>
              Retainage release credit:{" "}
              {formatCents(draw.retainageReleasedCents)} ·{" "}
            </>
          )}
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
      {draw.lienWaivers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: "8px 0 4px" }}>Lien waivers</h4>
          {draw.lienWaivers.map((w) => (
            <ContractorLienWaiverRow
              key={w.id}
              waiver={w}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </section>
  );
}

function ContractorLienWaiverRow({
  waiver,
  projectId,
}: {
  waiver: LienWaiver;
  projectId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const status = waiver.lienWaiverStatus;
  const canSubmit = status === "requested" || status === "rejected";

  async function uploadAndSubmit() {
    if (!file) {
      setError("file_required");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const presignRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/pdf",
          documentType: "lien_waiver",
        }),
      });
      if (!presignRes.ok) throw new Error("presign_failed");
      const presign = await presignRes.json();

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      if (!putRes.ok) throw new Error("put_failed");

      const finalizeRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey: presign.storageKey,
          title: file.name,
          documentType: "lien_waiver",
          visibilityScope: "project_wide",
          audienceScope: "client",
          sourceObject: {
            type: "lien_waiver",
            id: waiver.id,
            linkRole: "submission",
          },
        }),
      });
      if (!finalizeRes.ok) throw new Error("finalize_failed");
      const { documentId } = await finalizeRes.json();

      const submitRes = await fetch(`/api/lien-waivers/${waiver.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!submitRes.ok) {
        const b = await submitRes.json().catch(() => ({}));
        throw new Error(b.error ?? "submit_failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        border: "1px dashed var(--s4)",
        padding: 8,
        marginTop: 6,
        display: "grid",
        gap: 4,
      }}
    >
      <div>
        <strong>{waiverTypeLabel(waiver.lienWaiverType)}</strong> — {status} ·
        {" "}
        {formatCents(waiver.amountCents)}
        {waiver.throughDate
          ? ` · through ${toIsoDate(waiver.throughDate)}`
          : ""}
      </div>
      {canSubmit && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={pending}
          />
          <button type="button" disabled={pending || !file} onClick={uploadAndSubmit}>
            {pending ? "Uploading…" : "Upload & submit"}
          </button>
        </div>
      )}
      {status === "submitted" && <p>Awaiting client review.</p>}
      {status === "accepted" && <p>Accepted by client.</p>}
      {status === "waived" && <p>Waived by client.</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
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
