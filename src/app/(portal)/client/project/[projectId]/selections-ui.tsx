"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  SelectionCategoryRow,
  SelectionItemRow,
  SelectionOptionRow,
} from "@/domain/loaders/project-home";
import { formatMoneyCents } from "@/lib/format/money";

const formatCents = (c: number) => formatMoneyCents(c, { withCents: true });

export function ClientSelectionsPanel({
  categories,
}: {
  categories: SelectionCategoryRow[];
}) {
  if (categories.length === 0) {
    return <p>No selections ready yet.</p>;
  }
  const items = categories.flatMap((c) =>
    c.items.map((i) => ({ category: c, item: i })),
  );
  if (items.length === 0) {
    return <p>No selections ready yet.</p>;
  }
  return (
    <div>
      {categories.map((c) => (
        <section key={c.id} style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 4px 0" }}>{c.name}</h3>
          {c.items.length === 0 ? (
            <p style={{ margin: 0 }}>No items yet.</p>
          ) : (
            c.items.map((i) => <ClientItemCard key={i.id} item={i} />)
          )}
        </section>
      ))}
    </div>
  );
}

function statusLabel(s: SelectionItemRow["selectionItemStatus"]): string {
  switch (s) {
    case "exploring":
      return "Exploring";
    case "provisional":
      return "Provisional";
    case "confirmed":
      return "Confirmed";
    case "revision_open":
      return "Revision needed";
    case "locked":
      return "Locked";
    default:
      return s;
  }
}

function ClientItemCard({ item }: { item: SelectionItemRow }) {
  const decision = item.currentDecision;
  const selectedId = decision?.selectedOptionId ?? null;
  const canSelect = !decision?.isLocked;
  const canConfirm = decision?.isProvisional && !decision.isConfirmed;

  return (
    <div
      style={{
        border: "1px solid var(--s3)",
        padding: 8,
        marginTop: 6,
        display: "grid",
        gap: 6,
      }}
    >
      <div>
        <strong>{item.title}</strong> · Allowance{" "}
        {formatCents(item.allowanceCents)} · {statusLabel(item.selectionItemStatus)}
        {item.decisionDeadline && (
          <>
            {" "}
            · due {item.decisionDeadline.toISOString().slice(0, 10)}
          </>
        )}
      </div>
      {item.description && <p style={{ margin: 0 }}>{item.description}</p>}
      {item.selectionItemStatus === "revision_open" && item.urgencyNote && (
        <p style={{ margin: 0, color: "crimson" }}>
          Reopened: {item.urgencyNote}
        </p>
      )}
      <div style={{ display: "grid", gap: 4 }}>
        {item.options.map((o) => (
          <ClientOptionRow
            key={o.id}
            item={item}
            option={o}
            isSelected={o.id === selectedId}
            canSelect={canSelect}
            allowanceCents={item.allowanceCents}
          />
        ))}
      </div>
      {decision && (
        <ClientDecisionSummary
          decision={decision}
          canConfirm={canConfirm ?? false}
        />
      )}
    </div>
  );
}

function ClientOptionRow({
  item,
  option,
  isSelected,
  canSelect,
  allowanceCents,
}: {
  item: SelectionItemRow;
  option: SelectionOptionRow;
  isSelected: boolean;
  canSelect: boolean;
  allowanceCents: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delta = option.priceCents - allowanceCents;

  async function select() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/selections/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionItemId: item.id,
        selectedOptionId: option.id,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "select_failed");
      return;
    }
    router.refresh();
  }

  return (
    <div
      style={{
        border: isSelected ? "2px solid var(--ac)" : "1px solid var(--s3)",
        padding: 6,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div style={{ flex: 1 }}>
        <strong>{option.name}</strong>{" "}
        <span style={{ opacity: 0.7 }}>({option.optionTier})</span> ·{" "}
        {formatCents(option.priceCents)}
        {delta !== 0 && (
          <>
            {" "}
            · <em>{delta > 0 ? "+" : ""}{formatCents(delta)} vs allowance</em>
          </>
        )}
        {option.leadTimeDays != null && <> · {option.leadTimeDays}d lead</>}
        {!option.isAvailable && <> · unavailable</>}
      </div>
      {canSelect && option.isAvailable && (
        <button type="button" onClick={select} disabled={pending}>
          {isSelected ? "Reselect" : pending ? "…" : "Select"}
        </button>
      )}
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </div>
  );
}

function ClientDecisionSummary({
  decision,
  canConfirm,
}: {
  decision: NonNullable<SelectionItemRow["currentDecision"]>;
  canConfirm: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    const res = await fetch(
      `/api/selections/decisions/${decision.id}/confirm`,
      { method: "POST" },
    );
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "confirm_failed");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ background: "var(--ac-s)", padding: 6 }}>
      <div>
        Your pick · delta {formatCents(decision.priceDeltaCents)}
        {decision.scheduleDeltaDays > 0 &&
          ` · +${decision.scheduleDeltaDays}d schedule`}
      </div>
      {decision.isConfirmed && decision.revisionExpiresAt && (
        <div>
          Confirmed — revision window closes{" "}
          {decision.revisionExpiresAt.toISOString().slice(0, 16).replace("T", " ")}
        </div>
      )}
      {canConfirm && (
        <button type="button" onClick={confirm} disabled={pending}>
          {pending ? "Confirming…" : "Confirm selection"}
        </button>
      )}
      {error && <p style={{ color: "crimson", margin: 0 }}>Error: {error}</p>}
    </div>
  );
}
