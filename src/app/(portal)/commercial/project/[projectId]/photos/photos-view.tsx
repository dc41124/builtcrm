"use client";

import { useEffect, useMemo, useState } from "react";

import type { CommercialPhotosData, PhotoRow } from "@/domain/loaders/commercial-photos";

function PhotoTile({
  url,
  title,
  bgIndex,
}: {
  url: string | null;
  title: string;
  bgIndex: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = url && !failed;
  return (
    <>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="cpp-tile-img"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="cpp-tile-ph"
          style={{ background: TILE_BGS[bgIndex % TILE_BGS.length] }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="cpp-tile-label">{title}</span>
        </div>
      )}
    </>
  );
}

type Props = {
  projectId: string;
  data: CommercialPhotosData;
};

const FILTER_CHIPS = [
  { id: "all", label: "All photos" },
  { id: "siteprogress", label: "Site progress" },
  { id: "inspections", label: "Inspections" },
  { id: "electrical", label: "Electrical" },
  { id: "mechanical", label: "Mechanical" },
  { id: "structural", label: "Structural" },
] as const;

type FilterId = (typeof FILTER_CHIPS)[number]["id"];

// Rotating background gradients for tile placeholders, matching the prototype's
// phBgs palette (8 variants). Real thumbnails replace these in Commit 2.
const TILE_BGS = [
  "linear-gradient(135deg,#d4c5b0,#a89b7f)",
  "linear-gradient(135deg,#bfcdd9,#8fa5b8)",
  "linear-gradient(135deg,#c4b7a0,#9d8b70)",
  "linear-gradient(135deg,#d0c4a8,#a89a7a)",
  "linear-gradient(135deg,#bac4d2,#8a97ab)",
  "linear-gradient(135deg,#c9bca5,#a09178)",
  "linear-gradient(135deg,#d8cfb8,#b0a285)",
  "linear-gradient(135deg,#b5c2cf,#859aaf)",
];

function titleMatchesFilter(title: string, filter: FilterId): boolean {
  if (filter === "all") return true;
  const t = title.toLowerCase();
  switch (filter) {
    case "siteprogress":
      return /\b(progress|site|walkthrough|overall)\b/.test(t);
    case "inspections":
      return /\b(inspect|passed|sign[- ]?off)\b/.test(t);
    case "electrical":
      return /\b(electric|panel|conduit|wiring|circuit)\b/.test(t);
    case "mechanical":
      return /\b(mechanical|hvac|plumb|duct|pipe|suppression)\b/.test(t);
    case "structural":
      return /\b(structural|steel|concrete|slab|framing|foundation)\b/.test(t);
    default:
      return true;
  }
}

export function CommercialPhotosView({
  projectId,
  data,
  nowMs,
}: Props & { nowMs: number }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [lightbox, setLightbox] = useState<PhotoRow | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const visibleSets = useMemo(() => {
    if (filter === "all") return data.sets;
    return data.sets
      .map((s) => ({
        ...s,
        photos: s.photos.filter((p) => titleMatchesFilter(p.title, filter)),
      }))
      .filter((s) => s.photos.length > 0);
  }, [data.sets, filter]);

  const lastUpload = (() => {
    if (!data.lastUploadedAt) return "—";
    const d = data.lastUploadedAt;
    const diffDays = Math.floor(
      (nowMs - d.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })();

  return (
    <div className="cpp">
      <div className="cpp-head">
        <h1 className="cpp-title">Project Photos</h1>
        <div className="cpp-sub">
          Progress documentation from your contractor&apos;s site team.
        </div>
      </div>

      <div className="cpp-stat-row">
        <div className="cpp-ph-stats">
          <span>
            <strong>{data.totalCount}</strong> total photos
          </span>
          <span>
            <strong>{data.setCount}</strong> photo sets
          </span>
          <span>
            Last upload: <strong>{lastUpload}</strong>
          </span>
        </div>
        <button
          type="button"
          className="cpp-btn"
          disabled={data.totalCount === 0 || downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              window.location.href = `/api/export/photos/${projectId}`;
            } finally {
              setTimeout(() => setDownloading(false), 1500);
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? "Preparing…" : "Download all"}
        </button>
      </div>

      <div className="cpp-fb">
        {FILTER_CHIPS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`cpp-fp${filter === f.id ? " on" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleSets.length === 0 ? (
        <div className="cpp-empty">
          {data.totalCount === 0
            ? "No photos have been uploaded to this project yet."
            : "No photos match this filter."}
        </div>
      ) : (
        visibleSets.map((set) => (
          <div key={set.id} className="cpp-pg">
            <div className="cpp-pg-hdr">
              <div>
                <div className="cpp-pg-title">{set.title}</div>
                <div className="cpp-pg-meta">
                  Uploaded by {set.uploaderName} · {set.count}{" "}
                  {set.count === 1 ? "photo" : "photos"}
                </div>
              </div>
              <div className="cpp-pg-date">{set.dateLabel}</div>
            </div>
            <div className="cpp-pg-grid">
              {set.photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className="cpp-tile"
                  onClick={() => setLightbox(p)}
                  aria-label={`Open ${p.title}`}
                >
                  <PhotoTile url={p.url} title={p.title} bgIndex={i} />
                  <div className="cpp-tile-ov">
                    <span>{p.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {lightbox ? (
        <div
          className="cpp-lb"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="cpp-lb-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="cpp-lb-close"
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            {lightbox.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt={lightbox.title}
                className="cpp-lb-img"
              />
            ) : (
              <div className="cpp-lb-ph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>Image unavailable</span>
              </div>
            )}
            <div className="cpp-lb-caption">
              {lightbox.title}
              {lightbox.uploaderName
                ? ` · Uploaded by ${lightbox.uploaderName}`
                : null}
            </div>
          </div>
        </div>
      ) : null}

      
    </div>
  );
}
