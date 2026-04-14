"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { RfiRow } from "@/domain/loaders/project-home";

export function SubRfisList({ rfis }: { rfis: RfiRow[] }) {
  if (rfis.length === 0) return <p>No RFIs assigned to your organization.</p>;
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
                    {resp.isOfficialResponse && " (official)"}: {resp.body}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(r.rfiStatus === "open" || r.rfiStatus === "pending_response") && (
            <RespondForm id={r.id} />
          )}
        </li>
      ))}
    </ul>
  );
}

function RespondForm({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isOfficialResponse, setIsOfficialResponse] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/rfis/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isOfficialResponse }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setBody("");
    setIsOfficialResponse(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 6, marginTop: 8 }}>
      <textarea
        placeholder="Your response"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        required
      />
      <label style={{ fontSize: 13 }}>
        <input
          type="checkbox"
          checked={isOfficialResponse}
          onChange={(e) => setIsOfficialResponse(e.target.checked)}
        />{" "}
        Mark as official response
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Submitting..." : "Submit response"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </form>
  );
}
