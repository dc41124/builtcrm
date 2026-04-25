"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PrequalEnforcementMode } from "@/domain/loaders/prequal";

const MODES: Array<{
  key: PrequalEnforcementMode;
  name: string;
  desc: string;
}> = [
  {
    key: "off",
    name: "Off",
    desc: "Prequalification is available but never checked at sub-assignment time. Useful when you want templates and intake without enforcement yet.",
  },
  {
    key: "warn",
    name: "Warn",
    desc: "When inviting a sub without an active approved prequal, we surface a warning. The inviter can proceed, and the override is captured in the audit log.",
  },
  {
    key: "block",
    name: "Block",
    desc: "Hard block. Subs without an active approved prequal cannot be invited to a project. Grant a per-project exemption when you need an escape.",
  },
];

export function EnforcementModeForm({
  initialMode,
}: {
  initialMode: PrequalEnforcementMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PrequalEnforcementMode>(initialMode);
  const [pending, startTx] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = mode !== initialMode;

  const save = () => {
    setError(null);
    startTx(async () => {
      const res = await fetch("/api/prequal/enforcement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_mode", mode }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || `Save failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="pq-setting-card">
      <h3>Enforcement mode</h3>
      <p className="pq-setting-sub">
        Controls what happens when you invite a sub to a project who
        doesn&apos;t have an active approved prequalification with your org.
      </p>
      <div className="pq-mode-options">
        {MODES.map((m) => (
          <label
            key={m.key}
            className={`pq-mode-option${mode === m.key ? " on" : ""}`}
          >
            <input
              type="radio"
              name="mode"
              checked={mode === m.key}
              onChange={() => setMode(m.key)}
            />
            <div>
              <div className="pq-mode-option-name">{m.name}</div>
              <div className="pq-mode-option-desc">{m.desc}</div>
            </div>
          </label>
        ))}
      </div>
      {error ? (
        <div className="pq-warn-banner" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button
          className="pq-btn primary"
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          className="pq-btn ghost"
          onClick={() => setMode(initialMode)}
          disabled={!dirty || pending}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
