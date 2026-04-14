"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadRequest = {
  id: string;
  title: string;
  requestStatus: string;
  requestedFromOrganizationId: string | null;
  expectedFileType: string | null;
  dueAt: Date | null;
  submittedDocumentId: string | null;
};

export function CreateUploadRequestForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetOrganizationId, setTargetOrganizationId] = useState("");
  const [expectedFileType, setExpectedFileType] = useState("PDF");
  const [dueDate, setDueDate] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/upload-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        targetOrganizationId,
        title,
        description: description || undefined,
        expectedFileType,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "request_failed");
      return;
    }
    setTitle("");
    setDescription("");
    setTargetOrganizationId("");
    setDueDate("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
      <h3>Create Upload Request</h3>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        placeholder="Target subcontractor organization id (uuid)"
        value={targetOrganizationId}
        onChange={(e) => setTargetOrganizationId(e.target.value)}
        required
      />
      <input
        placeholder="Expected file type (e.g. PDF, DWG)"
        value={expectedFileType}
        onChange={(e) => setExpectedFileType(e.target.value)}
        required
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create Upload Request"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}

export function ContractorUploadRequestsList({
  requests,
}: {
  requests: UploadRequest[];
}) {
  if (requests.length === 0) {
    return <p>No upload requests yet.</p>;
  }
  return (
    <ul>
      {requests.map((r) => (
        <li key={r.id}>
          {r.title} [{r.requestStatus}]{" "}
          {r.expectedFileType && <span>· {r.expectedFileType}</span>}{" "}
          {r.dueAt && <span>· due {new Date(r.dueAt).toISOString().slice(0, 10)}</span>}
          {r.requestStatus === "submitted" && <ReviewActions id={r.id} />}
        </li>
      ))}
    </ul>
  );
}

function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function complete() {
    setPending(true);
    await fetch(`/api/upload-requests/${id}/complete`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  async function revise() {
    const note = window.prompt("Revision note:");
    if (!note) return;
    setPending(true);
    await fetch(`/api/upload-requests/${id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <span style={{ marginLeft: 8 }}>
      <button onClick={complete} disabled={pending}>
        Accept & Close
      </button>{" "}
      <button onClick={revise} disabled={pending}>
        Request Revision
      </button>
    </span>
  );
}
