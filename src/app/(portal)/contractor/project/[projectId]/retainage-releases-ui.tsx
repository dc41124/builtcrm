"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RetainageRelease = {
  id: string;
  sovLineItemId: string | null;
  releaseStatus: "held" | "release_requested" | "released" | "forfeited";
  releaseAmountCents: number;
  totalRetainageHeldCents: number;
  approvalNote: string | null;
  requestedAt: Date | null;
  approvedAt: Date | null;
  consumedByDrawRequestId: string | null;
  consumedAt: Date | null;
  createdAt: Date;
};

export type SovLineOption = {
  id: string;
  itemNumber: string;
  description: string;
};

function formatCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

function statusLabel(s: RetainageRelease["releaseStatus"]): string {
  switch (s) {
    case "held":
      return "Draft";
    case "release_requested":
      return "Awaiting client";
    case "released":
      return "Approved";
    case "forfeited":
      return "Forfeited";
  }
}

export function ContractorRetainagePanel({
  projectId,
  releases,
  sovLines,
}: {
  projectId: string;
  releases: RetainageRelease[];
  sovLines: SovLineOption[];
}) {
  return (
    <>
      <CreateReleaseForm projectId={projectId} sovLines={sovLines} />
      {releases.length === 0 ? (
        <p>No retainage release requests yet.</p>
      ) : (
        releases.map((r) => (
          <ContractorReleaseRow key={r.id} release={r} sovLines={sovLines} />
        ))
      )}
    </>
  );
}

function CreateReleaseForm({
  projectId,
  sovLines,
}: {
  projectId: string;
  sovLines: SovLineOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"project" | "line">("project");
  const [sovLineItemId, setSovLineItemId] = useState<string>("");
  const [amount, setAmount] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("invalid_amount");
      return;
    }
    if (scope === "line" && !sovLineItemId) {
      setError("select_a_line");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/retainage-releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        releaseAmountCents: cents,
        sovLineItemId: scope === "line" ? sovLineItemId : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setAmount("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: 6, maxWidth: 520, marginBottom: 8 }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <label>
          <input
            type="radio"
            checked={scope === "project"}
            onChange={() => setScope("project")}
          />{" "}
          Project-wide
        </label>
        <label>
          <input
            type="radio"
            checked={scope === "line"}
            onChange={() => setScope("line")}
          />{" "}
          Per SOV line
        </label>
      </div>
      {scope === "line" && (
        <select
          value={sovLineItemId}
          onChange={(e) => setSovLineItemId(e.target.value)}
        >
          <option value="">— select a line —</option>
          {sovLines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.itemNumber} — {l.description}
            </option>
          ))}
        </select>
      )}
      <label>
        Release amount (USD){" "}
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create release request"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}

function ContractorReleaseRow({
  release,
  sovLines,
}: {
  release: RetainageRelease;
  sovLines: SovLineOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeLabel = release.sovLineItemId
    ? sovLines.find((l) => l.id === release.sovLineItemId)?.itemNumber ??
      "SOV line"
    : "Project-wide";

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/retainage-releases/${release.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "submit_failed");
      return;
    }
    router.refresh();
  }

  return (
    <section
      style={{
        border: "1px solid var(--s3)",
        padding: 8,
        marginTop: 6,
        display: "grid",
        gap: 4,
      }}
    >
      <div>
        <strong>{scopeLabel}</strong> · {formatCents(release.releaseAmountCents)} ·{" "}
        {statusLabel(release.releaseStatus)}
      </div>
      <div>
        Held at request time: {formatCents(release.totalRetainageHeldCents)}
      </div>
      {release.approvalNote && <p>Client note: "{release.approvalNote}"</p>}
      {release.releaseStatus === "held" && (
        <button type="button" disabled={pending} onClick={submit}>
          {pending ? "Submitting…" : "Submit to client"}
        </button>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </section>
  );
}
