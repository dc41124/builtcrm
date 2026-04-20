"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  DrawingSetSummary,
  DrawingsPortal,
  SheetSummary,
} from "@/domain/loaders/drawings";

const DISCIPLINE_LABELS: Record<string, string> = {
  A: "Architectural",
  S: "Structural",
  E: "Electrical",
  M: "Mechanical",
  P: "Plumbing",
  C: "Civil",
  L: "Landscape",
  I: "Interiors",
  G: "General",
  T: "Telecom",
  F: "Fire Protection",
};

function portalBase(portal: DrawingsPortal, projectId: string): string {
  if (portal === "contractor") return `/contractor/project/${projectId}`;
  if (portal === "subcontractor") return `/subcontractor/project/${projectId}`;
  return `/${portal}/project/${projectId}`;
}

export function SheetIndexWorkspace(props: {
  projectId: string;
  set: DrawingSetSummary;
  versionChain: DrawingSetSummary[];
  sheets: SheetSummary[];
  disciplineCounts: Record<string, number>;
  scopeDiscipline: string | null;
  portal: DrawingsPortal;
  canEditSheets?: boolean;
}) {
  const {
    projectId,
    set,
    versionChain,
    sheets,
    disciplineCounts,
    scopeDiscipline,
    portal,
    canEditSheets = false,
  } = props;

  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [editing, setEditing] = useState<SheetSummary | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDiscipline, setEditDiscipline] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(s: SheetSummary) {
    setEditing(s);
    setEditNumber(s.sheetNumber);
    setEditTitle(s.sheetTitle);
    setEditDiscipline(s.discipline ?? "");
    setEditError(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editNumber.trim() || !editTitle.trim()) {
      setEditError("Sheet number and title are required.");
      return;
    }
    const discipline = editDiscipline.trim().toUpperCase();
    if (discipline && !/^[A-Z]$/.test(discipline)) {
      setEditError("Discipline must be a single letter (A/S/E/M/P/…) or blank.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/drawings/sheets/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetNumber: editNumber.trim(),
          sheetTitle: editTitle.trim(),
          discipline: discipline || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `${res.status}`);
      }
      closeEdit();
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditSaving(false);
    }
  }

  const disciplines = useMemo(() => {
    const codes = Object.keys(disciplineCounts).filter((k) => k !== "all");
    codes.sort();
    return codes;
  }, [disciplineCounts]);

  const filteredSheets = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return sheets.filter((s) => {
      if (filter !== "all" && s.discipline !== filter) return false;
      if (
        lower &&
        !s.sheetNumber.toLowerCase().includes(lower) &&
        !s.sheetTitle.toLowerCase().includes(lower)
      ) {
        return false;
      }
      return true;
    });
  }, [sheets, filter, search]);

  const base = portalBase(portal, projectId);

  return (
    <div className="dr-page">
      <div className="dr-page-hdr">
        <div>
          <div className="dr-bc" style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
            <Link href={`${base}/drawings`} style={{ color: "inherit" }}>
              Drawings
            </Link>{" "}
            / {set.name} v{set.version}
          </div>
          <h1 className="dr-page-title">Sheet index</h1>
          <p className="dr-page-desc">
            {set.name} v{set.version} — {set.sheetCount} sheets
            {scopeDiscipline
              ? ` · scoped to ${DISCIPLINE_LABELS[scopeDiscipline] ?? scopeDiscipline}`
              : ""}
            . Click a thumbnail to open the sheet.
          </p>
        </div>
        <div className="dr-page-actions">
          {versionChain.length > 1 ? (
            <select
              className="dr-btn sm"
              value={set.id}
              onChange={(e) => {
                const next = e.target.value;
                if (next !== set.id) {
                  window.location.href = `${base}/drawings/${next}`;
                }
              }}
              style={{ minWidth: 180 }}
            >
              {versionChain.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} v{v.version}
                  {v.status === "current" ? " · current" : ""}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="dr-index-hdr">
        <div className="dr-index-filters">
          <button
            className={`dr-index-filter ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All <span className="dr-index-filter-count">{disciplineCounts.all}</span>
          </button>
          {disciplines.map((code) => (
            <button
              key={code}
              className={`dr-index-filter ${filter === code ? "active" : ""}`}
              onClick={() => setFilter(code)}
            >
              {DISCIPLINE_LABELS[code] ?? code}{" "}
              <span className="dr-index-filter-count">{disciplineCounts[code]}</span>
            </button>
          ))}
        </div>

        <div className="dr-index-tools">
          <div className="dr-index-search">
            <span className="dr-index-search-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search sheet number or title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredSheets.length === 0 ? (
        <div className="dr-empty">
          <h3>No sheets match</h3>
          <p>
            {sheets.length === 0
              ? "This set has no sheets yet. Extraction may still be in progress."
              : "Try a different discipline or clear the search."}
          </p>
        </div>
      ) : (
        <div className="dr-thumb-grid">
          {filteredSheets.map((s) => (
            <div key={s.id} style={{ position: "relative" }}>
              <Link
                className="dr-thumb"
                href={`${base}/drawings/${set.id}/sheet/${s.id}`}
              >
                <div
                  className={
                    s.thumbnailUrl
                      ? "dr-thumb-preview"
                      : "dr-thumb-preview placeholder"
                  }
                >
                  {s.thumbnailUrl ? (
                    // Thumbnails are rendered client-side (ThumbnailMinter)
                    // and posted back to R2 on first visit; subsequent
                    // loads read straight from the presigned URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnailUrl} alt={s.sheetNumber} />
                  ) : (
                    <span>{s.sheetNumber}</span>
                  )}
                </div>
                <div className="dr-thumb-meta">
                  <div className="dr-thumb-num">
                    {s.sheetNumber}
                    {!s.autoDetected ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--text-tertiary)",
                          fontFamily: "DM Sans, system-ui",
                          textTransform: "uppercase",
                          letterSpacing: ".04em",
                        }}
                        title="Sheet metadata was edited manually"
                      >
                        edited
                      </span>
                    ) : null}
                  </div>
                  <div className="dr-thumb-title">{s.sheetTitle}</div>
                </div>
                {s.changedFromPriorVersion ? (
                  <div className="dr-thumb-changed">Changed</div>
                ) : null}
                {s.markupCount > 0 || s.commentCount > 0 ? (
                  <div className="dr-thumb-badges">
                    {s.markupCount > 0 ? (
                      <span className="dr-thumb-badge mk">
                        {s.markupCount} mk
                      </span>
                    ) : null}
                    {s.commentCount > 0 ? (
                      <span className="dr-thumb-badge cm">
                        {s.commentCount} cm
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Link>
              {canEditSheets ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openEdit(s);
                  }}
                  title="Edit sheet metadata"
                  aria-label={`Edit ${s.sheetNumber}`}
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    border: "1px solid var(--surface-3)",
                    background: "var(--surface-1)",
                    color: "var(--text-secondary)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    zIndex: 2,
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Edit drawer — contractor-only, shown when `editing` is set. */}
      {editing ? (
        <div
          onClick={closeEdit}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,23,20,.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-1)",
              borderRadius: 14,
              padding: 20,
              width: 420,
              maxWidth: "calc(100vw - 32px)",
              boxShadow: "0 20px 48px rgba(0,0,0,.2)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: "DM Sans, system-ui",
                fontSize: 16,
                fontWeight: 750,
              }}
            >
              Edit sheet
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: -8,
              }}
            >
              Correcting an auto-extraction miss or relabeling a sheet. Saved
              edits flip auto-detected off.
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{ fontSize: 11, fontWeight: 650, color: "var(--text-secondary)" }}
              >
                Sheet number
              </span>
              <input
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                placeholder="A-101"
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid var(--surface-3)",
                  padding: "0 10px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{ fontSize: 11, fontWeight: 650, color: "var(--text-secondary)" }}
              >
                Title
              </span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="First Floor Plan"
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid var(--surface-3)",
                  padding: "0 10px",
                  fontFamily: "Instrument Sans, system-ui",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{ fontSize: 11, fontWeight: 650, color: "var(--text-secondary)" }}
              >
                Discipline (single letter, blank to clear)
              </span>
              <input
                value={editDiscipline}
                onChange={(e) =>
                  setEditDiscipline(e.target.value.toUpperCase().slice(0, 1))
                }
                placeholder="A / S / E / M / P / C / L / …"
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid var(--surface-3)",
                  padding: "0 10px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 13,
                  outline: "none",
                  textTransform: "uppercase",
                }}
              />
            </label>
            {editError ? (
              <div
                style={{
                  background: "#fdeaea",
                  border: "1px solid #c93b3b",
                  color: "#a52e2e",
                  padding: 8,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                {editError}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 4,
              }}
            >
              <button className="dr-btn sm" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </button>
              <button
                className="dr-btn sm primary"
                onClick={saveEdit}
                disabled={editSaving || !editNumber.trim() || !editTitle.trim()}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
