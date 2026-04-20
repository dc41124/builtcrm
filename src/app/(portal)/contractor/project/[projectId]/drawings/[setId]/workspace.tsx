"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
}) {
  const {
    projectId,
    set,
    versionChain,
    sheets,
    disciplineCounts,
    scopeDiscipline,
    portal,
  } = props;

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

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
            <Link
              key={s.id}
              className="dr-thumb"
              href={`${base}/drawings/${set.id}/sheet/${s.id}`}
            >
              <div
                className={
                  s.thumbnailKey
                    ? "dr-thumb-preview"
                    : "dr-thumb-preview placeholder"
                }
              >
                {s.thumbnailUrl ? (
                  // Thumbnails are rendered client-side (via ThumbnailMinter)
                  // and posted back to R2 on first visit; subsequent loads
                  // read straight from the presigned URL. next/image would
                  // require a remotePatterns entry for the R2 endpoint;
                  // deferred — direct <img> is fine for this small surface.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumbnailUrl} alt={s.sheetNumber} />
                ) : (
                  <span>{s.sheetNumber}</span>
                )}
              </div>
              <div className="dr-thumb-meta">
                <div className="dr-thumb-num">{s.sheetNumber}</div>
                <div className="dr-thumb-title">{s.sheetTitle}</div>
              </div>
              {s.changedFromPriorVersion ? (
                <div className="dr-thumb-changed">Changed</div>
              ) : null}
              {s.markupCount > 0 || s.commentCount > 0 ? (
                <div className="dr-thumb-badges">
                  {s.markupCount > 0 ? (
                    <span className="dr-thumb-badge mk">{s.markupCount} mk</span>
                  ) : null}
                  {s.commentCount > 0 ? (
                    <span className="dr-thumb-badge cm">{s.commentCount} cm</span>
                  ) : null}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
