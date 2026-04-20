"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  MilestoneOption,
  RetainageReleaseRow,
  SovLineOption,
} from "@/domain/loaders/financial";

// Backwards-compatible local alias — many prior call sites reference
// `RetainageRelease` by that name. The authoritative shape lives on the
// financial loader (RetainageReleaseRow) so the UI and loader never
// drift.
export type RetainageRelease = RetainageReleaseRow;
export type { MilestoneOption, SovLineOption } from "@/domain/loaders/financial";

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
  milestones = [],
}: {
  projectId: string;
  releases: RetainageRelease[];
  sovLines: SovLineOption[];
  milestones?: MilestoneOption[];
}) {
  return (
    <>
      <CreateReleaseForm
        projectId={projectId}
        sovLines={sovLines}
        milestones={milestones}
      />
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
  milestones,
}: {
  projectId: string;
  sovLines: SovLineOption[];
  milestones: MilestoneOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"project" | "line">("project");
  const [sovLineItemId, setSovLineItemId] = useState<string>("");
  const [amount, setAmount] = useState("");
  // Step 43 trigger mode: milestone-tied (release date auto-derived from
  // the milestone's scheduledDate), or a free-form calendar date, or
  // neither (release date is TBD and the row stays invisible to the
  // "<30 days" card until filled in later).
  const [triggerMode, setTriggerMode] = useState<"none" | "date" | "milestone">(
    "none",
  );
  const [scheduledDate, setScheduledDate] = useState<string>(""); // yyyy-mm-dd
  const [triggerMilestoneId, setTriggerMilestoneId] = useState<string>("");

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
    if (triggerMode === "date" && !scheduledDate) {
      setError("pick_a_date");
      return;
    }
    if (triggerMode === "milestone" && !triggerMilestoneId) {
      setError("pick_a_milestone");
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
        scheduledReleaseAt:
          triggerMode === "date" && scheduledDate
            ? new Date(scheduledDate).toISOString()
            : undefined,
        releaseTriggerMilestoneId:
          triggerMode === "milestone" ? triggerMilestoneId : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setAmount("");
    setScheduledDate("");
    setTriggerMilestoneId("");
    setTriggerMode("none");
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

      {/* Step 43 trigger — optional, but pick one if set. Drives the
          "<30 days" card metric once the release is logged. */}
      <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
        <legend style={{ fontSize: 12 }}>
          When is this expected to release? (optional)
        </legend>
        <label style={{ display: "block" }}>
          <input
            type="radio"
            checked={triggerMode === "none"}
            onChange={() => setTriggerMode("none")}
          />{" "}
          TBD — set later
        </label>
        <label style={{ display: "block" }}>
          <input
            type="radio"
            checked={triggerMode === "date"}
            onChange={() => setTriggerMode("date")}
          />{" "}
          Specific date
          {triggerMode === "date" && (
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          )}
        </label>
        <label style={{ display: "block" }}>
          <input
            type="radio"
            checked={triggerMode === "milestone"}
            onChange={() => setTriggerMode("milestone")}
            disabled={milestones.length === 0}
          />{" "}
          Tied to a milestone
          {triggerMode === "milestone" && (
            <select
              value={triggerMilestoneId}
              onChange={(e) => setTriggerMilestoneId(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="">— select —</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({new Date(m.scheduledDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
          {milestones.length === 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: "#888",
              }}
            >
              (no milestones on this project)
            </span>
          )}
        </label>
      </fieldset>

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
      {release.approvalNote && <p>Client note: &ldquo;{release.approvalNote}&rdquo;</p>}
      {release.releaseStatus === "held" && (
        <button type="button" disabled={pending} onClick={submit}>
          {pending ? "Submitting…" : "Submit to client"}
        </button>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </section>
  );
}
