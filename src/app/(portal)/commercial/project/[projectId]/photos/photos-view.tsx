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

export function CommercialPhotosView({ data }: Props) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [lightbox, setLightbox] = useState<PhotoRow | null>(null);

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
      (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000),
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
        <button type="button" className="cpp-btn" disabled={data.totalCount === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download all
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

      <style>{`
.cpp{display:flex;flex-direction:column}
.cpp-head{margin-bottom:20px}
.cpp-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.cpp-sub{font-family:var(--fb);margin-top:4px;font-size:13.5px;color:var(--t2)}

.cpp-stat-row{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.cpp-ph-stats{display:flex;gap:20px;font-family:var(--fb);font-size:13px;color:var(--t2);flex-wrap:wrap}
.cpp-ph-stats strong{font-family:var(--fd);font-weight:720;color:var(--t1)}

.cpp-btn{height:32px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:620;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all 120ms ease;white-space:nowrap;flex-shrink:0}
.cpp-btn:hover:not(:disabled){background:var(--s2);border-color:var(--s4)}
.cpp-btn:disabled{opacity:.5;cursor:not-allowed}
.cpp-btn svg{width:14px;height:14px;flex-shrink:0}

.cpp-fb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.cpp-fp{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12.5px;font-weight:560;color:var(--t2);cursor:pointer;transition:all 120ms ease;display:inline-flex;align-items:center}
.cpp-fp:hover{border-color:var(--s4);color:var(--t1)}
.cpp-fp.on{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}

.cpp-pg{margin-bottom:20px}
.cpp-pg-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:16px}
.cpp-pg-title{font-family:var(--fd);font-size:14px;font-weight:650;letter-spacing:-.01em;color:var(--t1)}
.cpp-pg-meta{font-family:var(--fb);font-size:12px;color:var(--t3);margin-top:2px}
.cpp-pg-date{font-family:var(--fd);font-size:12px;font-weight:560;color:var(--t3);white-space:nowrap;flex-shrink:0}

.cpp-pg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cpp-tile{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;cursor:pointer;position:relative;border:1px solid var(--s3);transition:all 120ms ease;font-size:0;padding:0;background:var(--s2);display:block;width:100%}
.cpp-tile:hover{transform:scale(1.02);box-shadow:var(--shlg);border-color:var(--ac)}
.cpp-tile:focus-visible{outline:none;border-color:var(--ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 25%,transparent)}
.cpp-tile-img{width:100%;height:100%;object-fit:cover;display:block}
.cpp-tile-ph{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;font-family:var(--fb);font-size:11px;color:rgba(255,255,255,.88);font-weight:560;text-align:center}
.cpp-tile-ph svg{width:26px;height:26px;opacity:.55;color:#fff}
.cpp-tile-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;text-shadow:0 1px 2px rgba(0,0,0,.35)}
.cpp-tile-ov{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,.6));opacity:0;transition:opacity 120ms ease}
.cpp-tile:hover .cpp-tile-ov{opacity:1}
.cpp-tile-ov span{font-family:var(--fb);font-size:11px;color:#fff;font-weight:560;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.cpp-empty{padding:32px;border:1px dashed var(--s3);border-radius:var(--r-l);font-family:var(--fb);font-size:13px;color:var(--t3);text-align:center;background:var(--s1)}

.cpp-lb{position:fixed;inset:0;background:rgba(12,14,20,.88);z-index:1000;display:flex;align-items:center;justify-content:center;padding:32px;animation:cpp-lb-fade 160ms ease-out}
@keyframes cpp-lb-fade{from{opacity:0}to{opacity:1}}
.cpp-lb-inner{position:relative;width:min(1400px,92vw);display:flex;flex-direction:column;align-items:center;gap:14px}
.cpp-lb-img{width:100%;height:auto;max-height:84vh;object-fit:contain;border-radius:var(--r-l);box-shadow:0 20px 60px rgba(0,0,0,.5);background:var(--s2);display:block}
.cpp-lb-ph{width:100%;aspect-ratio:4/3;max-height:84vh;border-radius:var(--r-l);background:linear-gradient(135deg,#2a2e3c,#1a1d28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,.7);font-family:var(--fb);font-size:13px}
.cpp-lb-ph svg{width:48px;height:48px;opacity:.4}
.cpp-lb-caption{font-family:var(--fb);font-size:13px;color:rgba(255,255,255,.88);text-align:center;max-width:80vw;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.cpp-lb-close{position:absolute;top:-8px;right:-8px;width:36px;height:36px;border-radius:50%;border:none;background:var(--s1);color:var(--t1);display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:all 120ms ease;z-index:1}
.cpp-lb-close:hover{background:var(--s2);transform:scale(1.05)}

@media(max-width:1280px){.cpp-pg-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.cpp-pg-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </div>
  );
}
