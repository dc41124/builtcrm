"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ComplianceRow = {
  id: string;
  complianceType: string;
  complianceStatus: string;
  expiresAt: Date | null;
  documentId: string | null;
};

export function SubComplianceList({
  projectId,
  records,
}: {
  projectId: string;
  records: ComplianceRow[];
}) {
  if (records.length === 0) {
    return <p>No compliance requirements assigned.</p>;
  }
  return (
    <ul>
      {records.map((r) => (
        <li key={r.id} style={{ marginBottom: 16 }}>
          <strong>{r.complianceType}</strong> [{r.complianceStatus}]
          {r.expiresAt && (
            <> · expires {new Date(r.expiresAt).toISOString().slice(0, 10)}</>
          )}
          {r.documentId && <> · doc on file</>}
          <SubmitComplianceDoc projectId={projectId} recordId={r.id} />
        </li>
      ))}
    </ul>
  );
}

function SubmitComplianceDoc({
  projectId,
  recordId,
}: {
  projectId: string;
  recordId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const presignRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          documentType: "compliance",
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
          documentType: "compliance",
          visibilityScope: "subcontractor_scoped",
          audienceScope: "contractor",
          sourceObject: {
            type: "compliance_record",
            id: recordId,
            linkRole: "submission",
          },
        }),
      });
      if (!finalizeRes.ok) throw new Error("finalize_failed");
      const { documentId } = await finalizeRes.json();

      const submitRes = await fetch(`/api/compliance/${recordId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!submitRes.ok) throw new Error("submit_failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ marginTop: 4 }}>
      <input type="file" onChange={onChange} disabled={pending} />
      {pending && <span> Uploading...</span>}
      {error && <span style={{ color: "crimson" }}> Error: {error}</span>}
    </div>
  );
}
