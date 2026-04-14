"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApprovalRow = {
  id: string;
  approvalNumber: number;
  title: string;
  category: string;
  approvalStatus: string;
  impactCostCents: number;
  impactScheduleDays: number;
  decisionNote: string | null;
};

export function ContractorApprovalsList({
  approvals,
}: {
  approvals: ApprovalRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(id: string) {
    setPendingId(id);
    setError(null);
    const res = await fetch(`/api/approvals/${id}/submit`, { method: "POST" });
    setPendingId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "submit_failed");
      return;
    }
    router.refresh();
  }

  if (approvals.length === 0) {
    return <p>No approvals yet.</p>;
  }

  return (
    <>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      <ul>
        {approvals.map((a) => (
          <li key={a.id}>
            APV-{String(a.approvalNumber).padStart(3, "0")} · {a.title} [
            {a.category}] [{a.approvalStatus}] · cost{" "}
            ${(a.impactCostCents / 100).toFixed(2)} · sched {a.impactScheduleDays}d
            {a.decisionNote && <div>Note: {a.decisionNote}</div>}
            {(a.approvalStatus === "draft" ||
              a.approvalStatus === "needs_revision") && (
              <button
                type="button"
                disabled={pendingId === a.id}
                onClick={() => submit(a.id)}
              >
                {a.approvalStatus === "needs_revision" ? "Resubmit" : "Submit"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CreateApprovalForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [impactCost, setImpactCost] = useState("0");
  const [impactDays, setImpactDays] = useState("0");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description: description || undefined,
        category,
        impactCostCents: Math.round(Number(impactCost) * 100),
        impactScheduleDays: Number(impactDays),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setTitle("");
    setDescription("");
    setImpactCost("0");
    setImpactDays("0");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 6, maxWidth: 480 }}>
      <input
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="general">General</option>
        <option value="design">Design</option>
        <option value="procurement">Procurement</option>
        <option value="change_order">Change order</option>
        <option value="other">Other</option>
      </select>
      <input
        type="number"
        step="0.01"
        placeholder="Impact cost ($)"
        value={impactCost}
        onChange={(e) => setImpactCost(e.target.value)}
      />
      <input
        type="number"
        placeholder="Schedule impact (days)"
        value={impactDays}
        onChange={(e) => setImpactDays(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create approval"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}
