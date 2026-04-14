"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ComplianceRow = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  complianceType: string;
  complianceStatus: string;
  expiresAt: Date | null;
  documentId: string | null;
};

export function ContractorComplianceList({
  records,
}: {
  records: ComplianceRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "reject" | "waive") {
    setPendingId(id);
    setError(null);
    const res = await fetch(`/api/compliance/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setPendingId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `${action}_failed`);
      return;
    }
    router.refresh();
  }

  if (records.length === 0) {
    return <p>No compliance records yet.</p>;
  }

  return (
    <>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      <ul>
        {records.map((r) => (
          <li key={r.id}>
            {r.organizationName ?? r.organizationId} — {r.complianceType} [
            {r.complianceStatus}]
            {r.expiresAt && (
              <> · expires {r.expiresAt.toISOString().slice(0, 10)}</>
            )}
            {r.documentId && <> · doc attached</>}
            {r.complianceStatus === "pending" && (
              <>
                {" "}
                <button
                  type="button"
                  disabled={pendingId === r.id}
                  onClick={() => act(r.id, "accept")}
                >
                  Accept
                </button>{" "}
                <button
                  type="button"
                  disabled={pendingId === r.id}
                  onClick={() => act(r.id, "reject")}
                >
                  Reject
                </button>{" "}
                <button
                  type="button"
                  disabled={pendingId === r.id}
                  onClick={() => act(r.id, "waive")}
                >
                  Waive
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CreateComplianceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [complianceType, setComplianceType] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        organizationId,
        complianceType,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setOrganizationId("");
    setComplianceType("");
    setExpiresAt("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 6, maxWidth: 480 }}>
      <input
        required
        placeholder="Subcontractor organization id"
        value={organizationId}
        onChange={(e) => setOrganizationId(e.target.value)}
      />
      <input
        required
        placeholder="Compliance type (e.g. COI, WSIB)"
        value={complianceType}
        onChange={(e) => setComplianceType(e.target.value)}
      />
      <input
        type="date"
        placeholder="Expires at"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create compliance requirement"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}
