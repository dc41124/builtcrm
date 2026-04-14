"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientApprovalRow = {
  id: string;
  approvalNumber: number;
  title: string;
  category: string;
  approvalStatus: string;
  impactCostCents: number;
  impactScheduleDays: number;
  description: string | null;
  decisionNote: string | null;
};

export function ClientApprovalsList({
  approvals,
  isResidential,
}: {
  approvals: ClientApprovalRow[];
  isResidential: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(
    id: string,
    action: "approve" | "reject" | "revise",
    note?: string,
  ) {
    setPendingId(id);
    setError(null);
    const res = await fetch(`/api/approvals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note ? { note } : {}),
    });
    setPendingId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "action_failed");
      return;
    }
    router.refresh();
  }

  if (approvals.length === 0) {
    return <p>No {isResidential ? "decisions" : "approvals"} yet.</p>;
  }

  return (
    <>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      <ul>
        {approvals.map((a) => (
          <li key={a.id} style={{ marginBottom: 12 }}>
            <strong>
              APV-{String(a.approvalNumber).padStart(3, "0")} · {a.title}
            </strong>{" "}
            [{a.category}] [{a.approvalStatus}]
            <div>
              Cost impact: ${(a.impactCostCents / 100).toFixed(2)} · Schedule:{" "}
              {a.impactScheduleDays}d
            </div>
            {a.description && <div>{a.description}</div>}
            {a.decisionNote && <div>Note: {a.decisionNote}</div>}
            {a.approvalStatus === "pending_review" && (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  disabled={pendingId === a.id}
                  onClick={() => act(a.id, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pendingId === a.id}
                  onClick={() => {
                    const note = window.prompt("Approve with note:");
                    if (note) act(a.id, "approve", note);
                  }}
                >
                  Approve with note
                </button>
                <button
                  type="button"
                  disabled={pendingId === a.id}
                  onClick={() => {
                    const note = window.prompt(
                      "Return for revision — note required:",
                    );
                    if (note) act(a.id, "revise", note);
                  }}
                >
                  Return for revision
                </button>
                <button
                  type="button"
                  disabled={pendingId === a.id}
                  onClick={() => {
                    const note = window.prompt("Reject — reason required:");
                    if (note) act(a.id, "reject", note);
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
