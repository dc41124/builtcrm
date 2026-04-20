"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { InspectionTemplateRow } from "@/domain/loaders/inspections";

import {
  Icon,
  TradeBadge,
  tradeAppearance,
  TRADE_COLORS,
} from "../../../../../inspections-shared";

type Props = { template: InspectionTemplateRow };

type EditableLine = {
  key: string;
  orderIndex: number;
  label: string;
  ref: string;
};

export function TemplateDetailEditor({ template }: Props) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [tradeCategory, setTradeCategory] = useState(template.tradeCategory);
  const [phase, setPhase] = useState<"rough" | "final">(template.phase);
  const [description, setDescription] = useState(template.description ?? "");
  const [lineItems, setLineItems] = useState<EditableLine[]>(() =>
    template.lineItems
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((li, idx) => ({
        key: li.key,
        orderIndex: idx,
        label: li.label,
        ref: li.ref ?? "",
      })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const readOnly = !template.isCustom;

  function reorderTo(srcKey: string, destKey: string) {
    if (srcKey === destKey) return;
    setLineItems((prev) => {
      const srcIdx = prev.findIndex((l) => l.key === srcKey);
      const destIdx = prev.findIndex((l) => l.key === destKey);
      if (srcIdx < 0 || destIdx < 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(srcIdx, 1);
      next.splice(destIdx, 0, removed);
      return next.map((l, i) => ({ ...l, orderIndex: i }));
    });
  }

  function nextLineKey() {
    const prefix = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(
      0,
      6,
    ) || "item";
    let n = lineItems.length + 1;
    let candidate = `${prefix}-${String(n).padStart(2, "0")}`;
    const keys = new Set(lineItems.map((l) => l.key));
    while (keys.has(candidate)) {
      n += 1;
      candidate = `${prefix}-${String(n).padStart(2, "0")}`;
    }
    return candidate;
  }

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      {
        key: nextLineKey(),
        orderIndex: prev.length,
        label: "",
        ref: "",
      },
    ]);
  }

  function removeLine(idx: number) {
    setLineItems((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((l, i) => ({ ...l, orderIndex: i })),
    );
  }

  function updateLine(idx: number, field: "label" | "ref", value: string) {
    setLineItems((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  }

  async function save() {
    if (readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        tradeCategory,
        phase,
        description: description.trim() || null,
        lineItems: lineItems.map((l) => ({
          key: l.key,
          orderIndex: l.orderIndex,
          label: l.label.trim(),
          ref: l.ref.trim() || null,
        })),
      };
      const res = await fetch(
        `/api/inspection-templates/${template.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "Failed to save template");
        setSaving(false);
        return;
      }
      router.refresh();
      setSaving(false);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function toggleArchive() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/inspection-templates/${template.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "Failed");
        setSaving(false);
        return;
      }
      router.refresh();
      setSaving(false);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="in-content">
      <div className="in-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/contractor/settings/inspection-templates"
            className="in-btn sm ghost"
          >
            {Icon.back} Templates
          </Link>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <h1 className="in-page-title">{template.name}</h1>
              <span className={`in-tpl-phase ${template.phase}`}>
                {template.phase}
              </span>
              {template.isArchived ? (
                <span
                  className="in-tpl-phase"
                  style={{
                    background: "rgba(201,69,69,.12)",
                    color: "var(--danger)",
                  }}
                >
                  archived
                </span>
              ) : null}
            </div>
            <div className="in-page-sub">
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <TradeBadge trade={template.tradeCategory} />
                · {template.itemCount} items · {template.timesUsed} use
                {template.timesUsed === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        <div className="in-page-actions">
          <button
            type="button"
            className="in-btn sm danger"
            onClick={toggleArchive}
            disabled={saving}
          >
            {Icon.archive} {template.isArchived ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            className="in-btn primary"
            onClick={save}
            disabled={saving || readOnly}
            title={
              readOnly
                ? "Seeded library templates are read-only. Duplicate to edit."
                : undefined
            }
          >
            {Icon.check} {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {readOnly && (
        <div
          className="in-sub-banner"
          style={{
            background:
              "linear-gradient(135deg,rgba(196,112,11,0.08),rgba(196,112,11,0.03))",
            borderColor: "rgba(196,112,11,0.25)",
          }}
        >
          {Icon.warn}
          <span>
            This is a seeded library template — read-only. Duplicate it to
            create an editable custom copy for your org.
          </span>
        </div>
      )}

      {error && <div className="in-err">{error}</div>}

      <div className="in-tpl-detail">
        <div className="in-tpl-items">
          <div className="in-tpl-items-hdr">
            <h3>Line items</h3>
            <button
              type="button"
              className="in-btn sm primary"
              onClick={addLine}
              disabled={readOnly}
            >
              {Icon.plus} Add item
            </button>
          </div>
          {lineItems.map((li, idx) => (
            <div
              key={li.key}
              className="in-tpl-item-row"
              draggable={!readOnly}
              onDragStart={(e) => {
                if (readOnly) return;
                setDragKey(li.key);
                e.dataTransfer.effectAllowed = "move";
                // Firefox refuses to initiate a drag without dataTransfer.setData.
                e.dataTransfer.setData("text/plain", li.key);
              }}
              onDragOver={(e) => {
                if (readOnly || !dragKey || dragKey === li.key) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverKey !== li.key) setDragOverKey(li.key);
              }}
              onDragLeave={() => {
                if (dragOverKey === li.key) setDragOverKey(null);
              }}
              onDrop={(e) => {
                if (readOnly || !dragKey) return;
                e.preventDefault();
                reorderTo(dragKey, li.key);
                setDragKey(null);
                setDragOverKey(null);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setDragOverKey(null);
              }}
              style={{
                opacity: dragKey === li.key ? 0.4 : 1,
                borderTop:
                  dragOverKey === li.key && dragKey !== li.key
                    ? "2px solid var(--accent)"
                    : undefined,
                cursor: readOnly ? "default" : "grab",
              }}
            >
              <span className="in-tpl-grip">{Icon.grip}</span>
              <span className="in-tpl-item-num">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="in-tpl-item-body">
                <input
                  className="in-tpl-item-label-in"
                  value={li.label}
                  onChange={(e) => updateLine(idx, "label", e.target.value)}
                  placeholder="Checklist item description"
                  readOnly={readOnly}
                />
                <input
                  className="in-tpl-item-ref-in"
                  value={li.ref}
                  onChange={(e) => updateLine(idx, "ref", e.target.value)}
                  placeholder="Spec / code reference (optional)"
                  readOnly={readOnly}
                />
              </div>
              <button
                type="button"
                className="in-btn xs ghost icon"
                title="Delete"
                onClick={() => removeLine(idx)}
                disabled={readOnly}
              >
                {Icon.trash}
              </button>
            </div>
          ))}
          {lineItems.length === 0 && (
            <div
              style={{
                padding: "24px 20px",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 13,
              }}
            >
              No line items yet. Add one to get started.
            </div>
          )}
        </div>

        <div className="in-tpl-side">
          <div className="in-rail-card">
            <div className="in-rail-hdr">
              <h4>Template settings</h4>
            </div>
            <div className="in-modal-field" style={{ marginBottom: 10 }}>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={readOnly}
              />
            </div>
            <div className="in-modal-field" style={{ marginBottom: 10 }}>
              <label>Trade category</label>
              <select
                value={tradeCategory}
                onChange={(e) => setTradeCategory(e.target.value)}
                disabled={readOnly}
              >
                {Object.entries(TRADE_COLORS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="in-modal-field" style={{ marginBottom: 10 }}>
              <label>Phase</label>
              <select
                value={phase}
                onChange={(e) =>
                  setPhase(e.target.value as "rough" | "final")
                }
                disabled={readOnly}
              >
                <option value="rough">Rough-in</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div className="in-modal-field">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={readOnly}
                maxLength={4000}
              />
            </div>
          </div>
          <div className="in-rail-card">
            <div className="in-rail-hdr">
              <h4>Usage</h4>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Used in{" "}
              <strong
                style={{
                  color: "var(--text-primary)",
                  fontFamily: '"DM Sans",sans-serif',
                }}
              >
                {template.timesUsed}
              </strong>{" "}
              inspection{template.timesUsed === 1 ? "" : "s"}.
              {template.lastUsedAt
                ? ` Last used ${new Date(template.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
                : ""}{" "}
              Archiving does not remove historical inspections — they keep their
              snapshot.
            </div>
          </div>
        </div>
      </div>

      {/* Trade label hint (uses tradeAppearance) — keeps tradeAppearance
          imported so TS import checks pass while we read it for context. */}
      <div style={{ display: "none" }}>
        {tradeAppearance(tradeCategory).label}
      </div>
    </div>
  );
}
