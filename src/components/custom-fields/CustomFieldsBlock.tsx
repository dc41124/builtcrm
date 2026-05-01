"use client";

// Step 61 — Drop-in form block for rendering all active custom fields
// for a given (entityType, entityId).
//
// Usage from any entity edit form (project, sub, document, RFI):
//
//   <CustomFieldsBlock
//     entityType="project"
//     entityId={project.id}
//     definitions={defs}        // listActiveDefinitionsForEntityType()
//     initialValues={values}    // loadValuesForEntity()
//     onSaved={() => refresh()} // optional refresh hook
//   />
//
// The block renders its own "Save custom fields" button and POSTs to
// /api/contractor/custom-fields/values. The host form keeps owning
// the entity's core fields; custom fields write independently. This
// is intentional — entity forms vary across the codebase, and a
// shared component that has to participate in each form's submit
// pipeline would be much more invasive.

import { useMemo, useState } from "react";

import { type CustomFieldEntityType } from "@/lib/custom-fields/registry";
import { optionLabels } from "@/lib/custom-fields/normalize";

type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "boolean";

export type DefinitionForBlock = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  optionsJson: unknown;
  isRequired: boolean;
};

export type ValueForBlock = {
  definitionId: string;
  valueJson: unknown;
};

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
};

export function CustomFieldsBlock({
  entityType,
  entityId,
  definitions,
  initialValues,
  onSaved,
  /** When true, the host form is responsible for saving — we only render
   *  the inputs and emit values via `onValueChange`. */
  controlled = false,
  onValueChange,
}: {
  entityType: CustomFieldEntityType;
  entityId: string;
  definitions: DefinitionForBlock[];
  initialValues: ValueForBlock[];
  onSaved?: () => void;
  controlled?: boolean;
  onValueChange?: (
    values: { definitionId: string; value: unknown }[],
  ) => void;
}) {
  const initialMap = useMemo(() => {
    const m = new Map<string, unknown>();
    for (const v of initialValues) m.set(v.definitionId, v.valueJson);
    return m;
  }, [initialValues]);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const obj: Record<string, unknown> = {};
    for (const d of definitions) {
      const existing = initialMap.get(d.id);
      obj[d.id] = existing !== undefined ? existing : defaultFor(d.fieldType);
    }
    return obj;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const setValue = (defId: string, next: unknown) => {
    setValues((prev) => {
      const updated = { ...prev, [defId]: next };
      if (controlled && onValueChange) {
        onValueChange(
          Object.entries(updated).map(([definitionId, value]) => ({
            definitionId,
            value,
          })),
        );
      }
      return updated;
    });
  };

  const onSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = Object.entries(values).map(([definitionId, value]) => ({
        definitionId,
        value,
      }));
      const res = await fetch("/api/contractor/custom-fields/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, values: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.error === "validation_failed" && Array.isArray(body.errors)) {
          setError(
            body.errors
              .map(
                (e: { definitionId: string; error: string }) =>
                  e.error ?? "Invalid value",
              )
              .join(" · "),
          );
        } else {
          setError(body.message ?? body.error ?? "Failed to save.");
        }
        return;
      }
      setSavedAt(Date.now());
      onSaved?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (definitions.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--surface-1, #ffffff)",
        border: "1px solid var(--surface-3, #e2e5e9)",
        borderRadius: 14,
        padding: 18,
        marginTop: 18,
        fontFamily: F.body,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 14,
              fontWeight: 720,
              letterSpacing: "-.01em",
              color: "var(--text-primary, #1a1714)",
            }}
          >
            Custom fields
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary, #9c958a)",
              fontWeight: 520,
              marginTop: 2,
            }}
          >
            Defined for this {entityType.replace("_", " ")} by your org admin.
          </div>
        </div>
        {!controlled && savedAt !== null && (
          <div
            style={{
              fontSize: 11,
              color: "var(--success-text, #1e6b46)",
              fontWeight: 600,
            }}
          >
            Saved
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {definitions.map((d) => (
          <CustomFieldInput
            key={d.id}
            definition={d}
            value={values[d.id]}
            onChange={(next) => setValue(d.id, next)}
          />
        ))}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--danger-text, #a52e2e)",
            fontWeight: 580,
          }}
        >
          {error}
        </div>
      )}

      {!controlled && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 10,
              background: "#5b4fc7",
              color: "white",
              fontSize: 12.5,
              fontWeight: 650,
              fontFamily: F.display,
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Saving…" : "Save custom fields"}
          </button>
        </div>
      )}
    </div>
  );
}

function defaultFor(t: FieldType): unknown {
  switch (t) {
    case "text":
    case "select":
      return "";
    case "number":
      return "";
    case "date":
      return "";
    case "multi_select":
      return [];
    case "boolean":
      return false;
  }
}

function CustomFieldInput({
  definition,
  value,
  onChange,
}: {
  definition: DefinitionForBlock;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const baseInputStyle = {
    width: "100%",
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--surface-3, #e2e5e9)",
    background: "var(--surface-1, #ffffff)",
    color: "var(--text-primary, #1a1714)",
    fontSize: 13,
    fontFamily: F.body,
    fontWeight: 520,
    boxSizing: "border-box" as const,
    outline: "none",
  };

  const labelEl = (
    <div style={{ marginBottom: 5 }}>
      <span
        style={{
          fontFamily: F.display,
          fontSize: 12,
          fontWeight: 680,
          color: "var(--text-secondary, #6b655b)",
        }}
      >
        {definition.label}
      </span>
      {definition.isRequired && (
        <span
          style={{
            fontSize: 10,
            color: "var(--danger-text, #a52e2e)",
            marginLeft: 6,
            fontWeight: 700,
            fontFamily: F.display,
          }}
        >
          REQUIRED
        </span>
      )}
      {definition.description && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-tertiary, #9c958a)",
            fontWeight: 520,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {definition.description}
        </div>
      )}
    </div>
  );

  switch (definition.fieldType) {
    case "text":
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            style={baseInputStyle}
          />
        </div>
      );
    case "number":
      return (
        <div>
          {labelEl}
          <input
            type="number"
            value={
              typeof value === "number"
                ? value
                : typeof value === "string"
                  ? value
                  : ""
            }
            onChange={(e) => onChange(e.target.value)}
            style={baseInputStyle}
          />
        </div>
      );
    case "date":
      return (
        <div>
          {labelEl}
          <input
            type="date"
            value={typeof value === "string" ? value.slice(0, 10) : ""}
            onChange={(e) => onChange(e.target.value)}
            style={baseInputStyle}
          />
        </div>
      );
    case "select": {
      const opts = optionLabels({
        key: definition.key,
        label: definition.label,
        fieldType: definition.fieldType,
        optionsJson: definition.optionsJson,
        isRequired: definition.isRequired,
      });
      return (
        <div>
          {labelEl}
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            style={baseInputStyle}
          >
            <option value="">— Select —</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    case "multi_select": {
      const opts = optionLabels({
        key: definition.key,
        label: definition.label,
        fieldType: definition.fieldType,
        optionsJson: definition.optionsJson,
        isRequired: definition.isRequired,
      });
      const selected = Array.isArray(value)
        ? (value as unknown[]).map(String)
        : [];
      return (
        <div>
          {labelEl}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {opts.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    const next = on
                      ? selected.filter((s) => s !== o.value)
                      : [...selected, o.value];
                    onChange(next);
                  }}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: `1px solid ${on ? "#c7c2ea" : "#e2e5e9"}`,
                    background: on ? "#eeedfb" : "var(--surface-1, #ffffff)",
                    color: on ? "#4a3fb0" : "var(--text-secondary, #6b655b)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: F.display,
                    cursor: "pointer",
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "boolean":
      return (
        <div>
          {labelEl}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary, #6b655b)",
              fontWeight: 520,
            }}
          >
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
              style={{ accentColor: "#5b4fc7", width: 16, height: 16 }}
            />
            Yes
          </label>
        </div>
      );
  }
}
