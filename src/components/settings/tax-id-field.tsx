"use client";

import { useState } from "react";

// Tax-ID input that defaults to the masked value the loader provides
// and adds a Reveal/Hide affordance. Reveal calls
// POST /api/org/tax-id/reveal which writes a tax_id.revealed audit
// event server-side; the plaintext never crosses the wire on regular
// page loads.
//
// See docs/specs/tax_id_encryption_plan.md.

type Props = {
  value: string;
  hasValue: boolean;
  onChange: (next: string) => void;
  readOnly?: boolean;
  fieldStyle: React.CSSProperties;
};

export function TaxIdField({
  value,
  hasValue,
  onChange,
  readOnly,
  fieldStyle,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalMask] = useState<string>(value);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/tax-id/reveal", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (res.status === 429) {
          setError("Too many reveals — try again in a minute.");
        } else if (res.status === 403) {
          setError("Only org admins can reveal the tax ID.");
        } else {
          setError(body.message ?? "Could not reveal tax ID.");
        }
        return;
      }
      const data = (await res.json()) as { taxId: string | null };
      if (data.taxId) {
        onChange(data.taxId);
        setRevealed(true);
      } else {
        setError("No tax ID stored for this organization.");
      }
    } catch {
      setError("Network error revealing tax ID.");
    } finally {
      setBusy(false);
    }
  }

  function hide() {
    onChange(originalMask);
    setRevealed(false);
    setError(null);
  }

  const showButton = hasValue && !readOnly;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      <input
        style={{
          ...fieldStyle,
          flex: 1,
          fontFamily: "'JetBrains Mono',monospace",
          letterSpacing: ".02em",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        aria-label="Tax ID"
      />
      {showButton ? (
        revealed ? (
          <button
            type="button"
            onClick={hide}
            disabled={busy}
            style={revealButtonStyle}
          >
            Hide
          </button>
        ) : (
          <button
            type="button"
            onClick={reveal}
            disabled={busy}
            style={revealButtonStyle}
          >
            {busy ? "…" : "Reveal"}
          </button>
        )
      ) : null}
      {error ? (
        <div
          style={{
            position: "absolute",
            marginTop: 38,
            color: "var(--wr)",
            fontSize: 11,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

const revealButtonStyle: React.CSSProperties = {
  padding: "0 12px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
