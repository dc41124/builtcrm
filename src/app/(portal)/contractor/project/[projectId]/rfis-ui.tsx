"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { RfiRow } from "@/domain/loaders/project-home";

export function CreateRfiForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [assignedToOrganizationId, setAssignedToOrganizationId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [drawingReference, setDrawingReference] = useState("");
  const [specificationReference, setSpecificationReference] = useState("");
  const [locationDescription, setLocationDescription] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/rfis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        subject,
        body: body || undefined,
        assignedToOrganizationId: assignedToOrganizationId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        drawingReference: drawingReference || undefined,
        specificationReference: specificationReference || undefined,
        locationDescription: locationDescription || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setSubject("");
    setBody("");
    setAssignedToOrganizationId("");
    setDueDate("");
    setDrawingReference("");
    setSpecificationReference("");
    setLocationDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <h3>Create RFI</h3>
      <input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      <textarea
        placeholder="Question / body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <input
        placeholder="Assigned subcontractor organization id (uuid)"
        value={assignedToOrganizationId}
        onChange={(e) => setAssignedToOrganizationId(e.target.value)}
        required
      />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <input
        placeholder="Drawing reference (e.g. A-301)"
        value={drawingReference}
        onChange={(e) => setDrawingReference(e.target.value)}
      />
      <input
        placeholder="Spec reference (e.g. 09 91 23)"
        value={specificationReference}
        onChange={(e) => setSpecificationReference(e.target.value)}
      />
      <input
        placeholder="Location description"
        value={locationDescription}
        onChange={(e) => setLocationDescription(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create RFI"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}

export function ContractorRfisList({ rfis }: { rfis: RfiRow[] }) {
  if (rfis.length === 0) return <p>No RFIs yet.</p>;
  return (
    <ul style={{ display: "grid", gap: 12, listStyle: "none", padding: 0 }}>
      {rfis.map((r) => (
        <li
          key={r.id}
          style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}
        >
          <strong>
            RFI-{String(r.sequentialNumber).padStart(3, "0")} · {r.subject}
          </strong>{" "}
          [{r.rfiStatus}]
          {r.dueAt && (
            <span> · due {new Date(r.dueAt).toISOString().slice(0, 10)}</span>
          )}
          {r.body && <p style={{ margin: "6px 0" }}>{r.body}</p>}
          {(r.drawingReference || r.specificationReference || r.locationDescription) && (
            <p style={{ margin: "6px 0", color: "#555", fontSize: 13 }}>
              {r.drawingReference && <>Drawing: {r.drawingReference} · </>}
              {r.specificationReference && <>Spec: {r.specificationReference} · </>}
              {r.locationDescription && <>Location: {r.locationDescription}</>}
            </p>
          )}
          {r.responses.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <em>Responses:</em>
              <ul>
                {r.responses.map((resp) => (
                  <li key={resp.id}>
                    {resp.respondedByName ?? "Unknown"}
                    {resp.isOfficialResponse && " (official)"}:{" "}
                    {resp.body}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ContractorRfiActions id={r.id} status={r.rfiStatus} />
        </li>
      ))}
    </ul>
  );
}

function ContractorRfiActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function close() {
    setPending(true);
    await fetch(`/api/rfis/${id}/close`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  async function reopen() {
    const reason = window.prompt("Reason for reopening (optional):") ?? "";
    setPending(true);
    await fetch(`/api/rfis/${id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || undefined }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div style={{ marginTop: 8 }}>
      {(status === "open" || status === "answered") && (
        <button onClick={close} disabled={pending}>
          Close RFI
        </button>
      )}{" "}
      {(status === "answered" || status === "closed") && (
        <button onClick={reopen} disabled={pending}>
          Reopen / Escalate
        </button>
      )}
    </div>
  );
}
