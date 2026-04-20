"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  DrawingSetSummary,
  DrawingsPortal,
  SheetSummary,
} from "@/domain/loaders/drawings";

import {
  DISCIPLINE_COLORS,
  DisciplineTag,
  SheetThumbnailSvg,
} from "../sheet-thumbnail";

function portalBase(portal: DrawingsPortal, projectId: string): string {
  if (portal === "contractor") return `/contractor/project/${projectId}`;
  if (portal === "subcontractor") return `/subcontractor/project/${projectId}`;
  return `/${portal}/project/${projectId}`;
}

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

// Prototype's discipline ordering for filter chips.
const FILTER_ORDER = ["A", "S", "E", "M", "P", "C", "L", "I", "G", "T", "F"];

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
    sheets,
    disciplineCounts,
    scopeDiscipline,
    portal,
    canEditSheets = false,
  } = props;

  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<SheetSummary | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDiscipline, setEditDiscipline] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const disciplinesInSet = useMemo(() => {
    const seen = Object.keys(disciplineCounts).filter((k) => k !== "all");
    return FILTER_ORDER.filter((c) => seen.includes(c)).concat(
      seen.filter((c) => !FILTER_ORDER.includes(c)),
    );
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

  const isSub = portal === "subcontractor";
  const base = portalBase(portal, projectId);

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

  return (
    <div className="dr-content">
      <div className="dr-index-hdr">
        <div className="dr-index-ctx">
          <Link href={`${base}/drawings`} className="dr-btn sm ghost">
            <BackIcon />
            Sets
          </Link>
          <h2>
            {set.name} v{set.version}
          </h2>
          {set.status === "current" ? (
            <span className="dr-pill accent">Current</span>
          ) : set.status === "superseded" ? (
            <span className="dr-pill gray">Superseded</span>
          ) : (
            <span className="dr-pill gray">Historical</span>
          )}
        </div>
        <div className="dr-index-tools">
          <div className="dr-index-search">
            <span className="dr-index-search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search sheets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="dr-layout-toggle" role="tablist" aria-label="Layout">
            <button
              className={`dr-layout-btn ${layout === "grid" ? "active" : ""}`}
              onClick={() => setLayout("grid")}
              aria-label="Grid view"
              aria-pressed={layout === "grid"}
            >
              <GridIcon />
            </button>
            <button
              className={`dr-layout-btn ${layout === "list" ? "active" : ""}`}
              onClick={() => setLayout("list")}
              aria-label="List view"
              aria-pressed={layout === "list"}
            >
              <ListIcon />
            </button>
          </div>
          <button
            className="dr-btn sm"
            onClick={() => alert("Export queued (stub — wired in a follow-up)")}
            title="Export the current set as a ZIP of PDF pages"
          >
            <DownloadIcon />
            Export Set
          </button>
        </div>
      </div>

      {/* Discipline filter tabs — full labels, matching the prototype */}
      <div className="dr-index-filters" style={{ marginBottom: 18 }}>
        <button
          className={`dr-index-filter ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All <span className="dr-index-filter-count">{disciplineCounts.all}</span>
        </button>
        {disciplinesInSet.map((code) => {
          const label = DISCIPLINE_COLORS[code]?.label ?? code;
          return (
            <button
              key={code}
              className={`dr-index-filter ${filter === code ? "active" : ""}`}
              onClick={() => setFilter(code)}
            >
              {label}{" "}
              <span className="dr-index-filter-count">
                {disciplineCounts[code] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {isSub && scopeDiscipline ? (
        <div className="dr-sub-banner" style={{ marginTop: -4 }}>
          <EyeIcon />
          <span>
            Scope filter:{" "}
            <strong>
              {DISCIPLINE_COLORS[scopeDiscipline]?.label ?? scopeDiscipline} only
            </strong>
            . You have read access to all sheets but can only markup your scope.
          </span>
        </div>
      ) : null}

      {filteredSheets.length === 0 ? (
        <div className="dr-empty">
          <h3>No sheets match</h3>
          <p>
            {sheets.length === 0
              ? "This set has no sheets yet. Extraction may still be in progress."
              : "Try a different discipline or clear the search."}
          </p>
        </div>
      ) : layout === "grid" ? (
        <div className="dr-thumb-grid">
          {filteredSheets.map((s) => (
            <div key={s.id} style={{ position: "relative" }}>
              <Link
                className="dr-thumb"
                href={`${base}/drawings/${set.id}/sheet/${s.id}`}
              >
                <div className="dr-thumb-preview">
                  {s.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnailUrl} alt={s.sheetNumber} />
                  ) : (
                    <SheetThumbnailSvg
                      discipline={s.discipline}
                      sheetNumber={s.sheetNumber}
                    />
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
                        {s.markupCount}
                      </span>
                    ) : null}
                    {s.commentCount > 0 ? (
                      <span className="dr-thumb-badge cm">
                        {s.commentCount}
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
                  <EditIcon />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="dr-thumb-list">
          <div className="dr-thumb-row header">
            <div>#</div>
            <div>Number</div>
            <div>Title</div>
            <div>Discipline</div>
            <div>Markups</div>
            <div>Comments</div>
          </div>
          {filteredSheets.map((s, i) => (
            <Link
              key={s.id}
              href={`${base}/drawings/${set.id}/sheet/${s.id}`}
              className="dr-thumb-row"
            >
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="tr-num">{s.sheetNumber}</div>
              <div className="tr-title">
                {s.sheetTitle}
                {s.changedFromPriorVersion ? (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "2px 6px",
                      borderRadius: 5,
                      background: "#fdf4e6",
                      color: "#96600f",
                      border: "1px solid #c17a1a",
                      fontFamily: "DM Sans, system-ui",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    Changed
                  </span>
                ) : null}
              </div>
              <div>
                {s.discipline ? (
                  <DisciplineTag code={s.discipline} />
                ) : (
                  <span
                    className="dr-set-disc-tag"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-tertiary)",
                      border: "1px solid var(--surface-3)",
                    }}
                  >
                    —
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "DM Sans, system-ui",
                  fontSize: 12,
                  fontWeight: 680,
                  color: s.markupCount
                    ? "#4a3fb0"
                    : "var(--text-tertiary)",
                }}
              >
                {s.markupCount || "—"}
              </div>
              <div
                style={{
                  fontFamily: "DM Sans, system-ui",
                  fontSize: 12,
                  fontWeight: 680,
                  color: s.commentCount
                    ? "#96600f"
                    : "var(--text-tertiary)",
                }}
              >
                {s.commentCount || "—"}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Edit drawer */}
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
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  color: "var(--text-secondary)",
                }}
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
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  color: "var(--text-secondary)",
                }}
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
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  color: "var(--text-secondary)",
                }}
              >
                Discipline (single letter, blank to clear)
              </span>
              <input
                value={editDiscipline}
                onChange={(e) =>
                  setEditDiscipline(
                    e.target.value.toUpperCase().slice(0, 1),
                  )
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
              <button
                className="dr-btn sm"
                onClick={closeEdit}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                className="dr-btn sm primary"
                onClick={saveEdit}
                disabled={
                  editSaving || !editNumber.trim() || !editTitle.trim()
                }
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
