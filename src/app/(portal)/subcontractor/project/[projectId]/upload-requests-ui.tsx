"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingRequest = {
  id: string;
  title: string;
  description: string | null;
  requestStatus: string;
  expectedFileType: string | null;
  dueAt: Date | null;
  revisionNote: string | null;
};

export function PendingUploadRequestsList({
  projectId,
  requests,
}: {
  projectId: string;
  requests: PendingRequest[];
}) {
  if (requests.length === 0) {
    return <p>No pending upload requests.</p>;
  }
  return (
    <ul>
      {requests.map((r) => (
        <li key={r.id} style={{ marginBottom: 16 }}>
          <strong>{r.title}</strong> [{r.requestStatus}]{" "}
          {r.expectedFileType && <span>· {r.expectedFileType}</span>}{" "}
          {r.dueAt && <span>· due {new Date(r.dueAt).toISOString().slice(0, 10)}</span>}
          {r.description && <div>{r.description}</div>}
          {r.requestStatus === "revision_requested" && r.revisionNote && (
            <div style={{ color: "darkorange" }}>Revision: {r.revisionNote}</div>
          )}
          <SubmitUploadButton projectId={projectId} requestId={r.id} />
        </li>
      ))}
    </ul>
  );
}

function SubmitUploadButton({
  projectId,
  requestId,
}: {
  projectId: string;
  requestId: string;
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
          documentType: "upload_request",
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
          documentType: "upload_request",
          visibilityScope: "subcontractor_scoped",
          audienceScope: "contractor",
          sourceObject: {
            type: "upload_request",
            id: requestId,
            linkRole: "submission",
          },
        }),
      });
      if (!finalizeRes.ok) throw new Error("finalize_failed");
      const { documentId } = await finalizeRes.json();

      const submitRes = await fetch(`/api/upload-requests/${requestId}/submit`, {
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
