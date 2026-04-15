"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  SelectionCategoryRow,
  SelectionItemRow,
  SelectionOptionRow,
} from "@/domain/loaders/project-home";

function formatCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`;
}

export function ContractorSelectionsPanel({
  projectId,
  categories,
}: {
  projectId: string;
  categories: SelectionCategoryRow[];
}) {
  return (
    <>
      <CreateCategoryForm projectId={projectId} />
      {categories.length === 0 ? (
        <p>No selection categories yet.</p>
      ) : (
        categories.map((c) => (
          <CategoryBlock key={c.id} projectId={projectId} category={c} />
        ))
      )}
    </>
  );
}

function CreateCategoryForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/selections/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", gap: 6, marginBottom: 8 }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New category (e.g. Kitchen)"
      />
      <button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add category"}
      </button>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </form>
  );
}

function CategoryBlock({
  projectId,
  category,
}: {
  projectId: string;
  category: SelectionCategoryRow;
}) {
  return (
    <section
      style={{ border: "1px solid var(--s4)", padding: 8, marginBottom: 8 }}
    >
      <h3 style={{ margin: "0 0 6px 0" }}>{category.name}</h3>
      <CreateItemForm projectId={projectId} categoryId={category.id} />
      {category.items.length === 0 ? (
        <p>No items in this category.</p>
      ) : (
        category.items.map((i) => <ItemBlock key={i.id} item={i} />)
      )}
    </section>
  );
}

function CreateItemForm({
  projectId,
  categoryId,
}: {
  projectId: string;
  categoryId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [allowance, setAllowance] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const cents = allowance
      ? Math.round(Number.parseFloat(allowance) * 100)
      : 0;
    setPending(true);
    setError(null);
    const res = await fetch("/api/selections/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        categoryId,
        title,
        allowanceCents: cents,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setTitle("");
    setAllowance("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title"
      />
      <input
        value={allowance}
        onChange={(e) => setAllowance(e.target.value)}
        placeholder="Allowance (USD)"
        type="number"
        step="0.01"
        min="0"
      />
      <button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add item"}
      </button>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </form>
  );
}

function ItemBlock({ item }: { item: SelectionItemRow }) {
  return (
    <div
      style={{
        border: "1px solid var(--s3)",
        padding: 6,
        marginTop: 6,
        display: "grid",
        gap: 4,
      }}
    >
      <div>
        <strong>{item.title}</strong> · Allowance{" "}
        {formatCents(item.allowanceCents)} · {item.selectionItemStatus}
        {item.isPublished ? " · published" : " · draft"}
      </div>
      {item.currentDecision && (
        <div>
          Current pick:{" "}
          {item.options.find((o) => o.id === item.currentDecision?.selectedOptionId)
            ?.name ?? "?"}{" "}
          · delta {formatCents(item.currentDecision.priceDeltaCents)} ·{" "}
          {item.currentDecision.isConfirmed
            ? "confirmed"
            : item.currentDecision.isProvisional
              ? "provisional"
              : "locked"}
        </div>
      )}
      <details>
        <summary>{item.options.length} option(s)</summary>
        <ul style={{ margin: "4px 0 0 16px" }}>
          {item.options.map((o) => (
            <OptionRow key={o.id} option={o} />
          ))}
        </ul>
      </details>
      <AddOptionForm selectionItemId={item.id} />
      <ItemActions item={item} />
    </div>
  );
}

function OptionRow({ option }: { option: SelectionOptionRow }) {
  return (
    <li>
      <strong>{option.name}</strong> · {option.optionTier} ·{" "}
      {formatCents(option.priceCents)}
      {option.leadTimeDays != null && ` · ${option.leadTimeDays}d lead`}
      {!option.isAvailable && " · unavailable"}
    </li>
  );
}

function AddOptionForm({ selectionItemId }: { selectionItemId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [tier, setTier] = useState<
    "included" | "upgrade" | "premium_upgrade"
  >("included");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const cents = price ? Math.round(Number.parseFloat(price) * 100) : 0;
    setPending(true);
    setError(null);
    const res = await fetch("/api/selections/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionItemId,
        name,
        optionTier: tier,
        priceCents: cents,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setName("");
    setPrice("");
    setTier("included");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Option name"
      />
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price"
        type="number"
        step="0.01"
        min="0"
      />
      <select
        value={tier}
        onChange={(e) =>
          setTier(e.target.value as "included" | "upgrade" | "premium_upgrade")
        }
      >
        <option value="included">Included</option>
        <option value="upgrade">Upgrade</option>
        <option value="premium_upgrade">Premium</option>
      </select>
      <button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add option"}
      </button>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </form>
  );
}

function ItemActions({ item }: { item: SelectionItemRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function publish() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/selections/items/${item.id}/publish`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "publish_failed");
      return;
    }
    router.refresh();
  }

  async function reopen() {
    if (!reason.trim()) {
      setError("reason_required");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/selections/items/${item.id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "reopen_failed");
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {!item.isPublished && (
        <button type="button" onClick={publish} disabled={pending}>
          {pending ? "Publishing…" : "Publish"}
        </button>
      )}
      {item.isPublished && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reopen reason"
          />
          <button type="button" onClick={reopen} disabled={pending}>
            {pending ? "Reopening…" : "Reopen for revision"}
          </button>
        </>
      )}
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </div>
  );
}
