"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SovLineItem = {
  id: string;
  itemNumber: string;
  costCode: string | null;
  description: string;
  lineItemType: string;
  scheduledValueCents: number;
  retainagePercentOverride: number | null;
  sortOrder: number;
  isActive: boolean;
};

type Sov = {
  id: string;
  version: number;
  sovStatus: string;
  totalScheduledValueCents: number;
  totalOriginalContractCents: number;
  totalChangeOrdersCents: number;
  defaultRetainagePercent: number;
  lineItems: SovLineItem[];
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ContractorSovPanel({
  projectId,
  sov,
}: {
  projectId: string;
  sov: Sov | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createSov() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/sov", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    router.refresh();
  }

  async function transition(kind: "activate" | "lock") {
    if (!sov) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/sov/${sov.id}/${kind}`, {
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

  async function deactivateLine(lineId: string) {
    if (!sov) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/sov/${sov.id}/line-items/${lineId}`, {
      method: "DELETE",
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "deactivate_failed");
      return;
    }
    router.refresh();
  }

  if (!sov) {
    return (
      <>
        <p>No Schedule of Values yet.</p>
        <button type="button" disabled={pending} onClick={createSov}>
          {pending ? "Creating…" : "Create Schedule of Values"}
        </button>
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      </>
    );
  }

  const activeLines = sov.lineItems.filter((l) => l.isActive);

  return (
    <>
      <p>
        SOV v{sov.version} [{sov.sovStatus}] · default retainage{" "}
        {sov.defaultRetainagePercent}% · total{" "}
        {formatCents(sov.totalScheduledValueCents)} (original{" "}
        {formatCents(sov.totalOriginalContractCents)} + change orders{" "}
        {formatCents(sov.totalChangeOrdersCents)})
      </p>

      {activeLines.length === 0 ? (
        <p>No line items yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cost code</th>
              <th>Description</th>
              <th>Type</th>
              <th>Scheduled value</th>
              <th>Retainage %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activeLines.map((l) => (
              <tr key={l.id}>
                <td>{l.itemNumber}</td>
                <td>{l.costCode ?? ""}</td>
                <td>{l.description}</td>
                <td>{l.lineItemType}</td>
                <td>{formatCents(l.scheduledValueCents)}</td>
                <td>
                  {l.retainagePercentOverride ?? sov.defaultRetainagePercent}%
                </td>
                <td>
                  {sov.sovStatus === "draft" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => deactivateLine(l.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sov.sovStatus === "draft" && (
        <>
          <CreateSovLineItemForm sovId={sov.id} />
          <button
            type="button"
            disabled={pending || activeLines.length === 0}
            onClick={() => transition("activate")}
          >
            Activate SOV
          </button>
        </>
      )}
      {sov.sovStatus === "active" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => transition("lock")}
        >
          Lock SOV
        </button>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </>
  );
}

function CreateSovLineItemForm({ sovId }: { sovId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemNumber, setItemNumber] = useState("");
  const [costCode, setCostCode] = useState("");
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const parsedAmount = Number.parseFloat(amountDollars);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setPending(false);
      setError("invalid_amount");
      return;
    }
    const res = await fetch(`/api/sov/${sovId}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemNumber,
        costCode: costCode || undefined,
        description,
        scheduledValueCents: Math.round(parsedAmount * 100),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setItemNumber("");
    setCostCode("");
    setDescription("");
    setAmountDollars("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 6, maxWidth: 480 }}>
      <input
        required
        placeholder="Item number (e.g. 01000)"
        value={itemNumber}
        onChange={(e) => setItemNumber(e.target.value)}
      />
      <input
        placeholder="Cost code (optional)"
        value={costCode}
        onChange={(e) => setCostCode(e.target.value)}
      />
      <input
        required
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        required
        type="number"
        step="0.01"
        min="0"
        placeholder="Scheduled value ($)"
        value={amountDollars}
        onChange={(e) => setAmountDollars(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add line item"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}
