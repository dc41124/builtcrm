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

function formatCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

export function ClientRetainagePanel({
  releases,
}: {
  releases: RetainageRelease[];
}) {
  const visible = releases.filter((r) => r.releaseStatus !== "held");
  if (visible.length === 0) {
    return <p>No retainage release requests have been submitted.</p>;
  }
  return (
    <>
      {visible.map((r) => (
        <ClientReleaseRow key={r.id} release={r} />
      ))}
    </>
  );
}

function ClientReleaseRow({ release }: { release: RetainageRelease }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const canDecide = release.releaseStatus === "release_requested";

  async function submit() {
    if (!decision) return;
    if (decision === "reject" && note.trim().length === 0) {
      setError("note_required");
      return;
    }
    setPending(true);
    setError(null);
    const body =
      decision === "reject"
        ? { note: note.trim() }
        : note.trim().length > 0
          ? { note: note.trim() }
          : {};
    const res = await fetch(
      `/api/retainage-releases/${release.id}/${decision}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `${decision}_failed`);
      return;
    }
    setDecision(null);
    setNote("");
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
        <strong>
          {release.sovLineItemId ? "Per SOV line" : "Project-wide"}
        </strong>{" "}
        · {formatCents(release.releaseAmountCents)} · {release.releaseStatus}
      </div>
      <div>
        Held at request time: {formatCents(release.totalRetainageHeldCents)}
      </div>
      {release.approvalNote && <p>Note: "{release.approvalNote}"</p>}
      {canDecide && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDecision("approve")}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDecision("reject")}
            >
              Reject
            </button>
          </div>
          {decision && (
            <>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  decision === "reject"
                    ? "Required: explain the rejection…"
                    : "Optional approval note…"
                }
                style={{ width: "100%", maxWidth: 480 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" disabled={pending} onClick={submit}>
                  {pending ? "Submitting…" : `Submit ${decision}`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDecision(null);
                    setNote("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {release.releaseStatus === "released" && release.approvedAt && (
        <p>Approved {new Date(release.approvedAt).toISOString().slice(0, 10)}</p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </section>
  );
}
