"use client";

// Small pencil-icon button that sits inside each set card's title row and
// opens a modal for renaming the set + editing its note. Rename is the
// kind of thing you do rarely but need to do in-place when you do — a
// nested Link-button trick keeps the outer card click (→ index view)
// intact while giving the action its own hit target.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SetRenameButton({
  setId,
  initialName,
  initialNote,
}: {
  setId: string;
  initialName: string;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setNote(initialNote ?? "");
    setError(null);
  }, [open, initialName, initialNote]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/drawings/sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          note: note.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `${res.status}`);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Rename set / edit note"
        aria-label={`Rename ${initialName}`}
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--text-tertiary)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          marginLeft: 2,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-2)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-tertiary)";
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>

      {open ? (
        <div
          className="dr-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setOpen(false);
          }}
        >
          <div
            className="dr-modal"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dr-modal-hdr">
              <h3>Rename set</h3>
              <button
                className="dr-btn sm ghost icon"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="dr-modal-body">
              <div className="dr-field">
                <label>Set name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) save();
                  }}
                  disabled={saving}
                />
                <span className="dr-field-hint">
                  The version number stays on the chain — only the display name changes.
                </span>
              </div>
              <div className="dr-field">
                <label>Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={saving}
                  placeholder="e.g. Issued for construction."
                />
              </div>
              {error ? (
                <div
                  style={{
                    background: "var(--danger-soft)",
                    border: "1px solid var(--danger)",
                    color: "var(--danger-text)",
                    padding: 8,
                    borderRadius: 8,
                    fontSize: 12.5,
                  }}
                >
                  {error}
                </div>
              ) : null}
            </div>
            <div className="dr-modal-foot">
              <span />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="dr-btn sm ghost"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="dr-btn sm primary"
                  onClick={save}
                  disabled={saving || !name.trim()}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
