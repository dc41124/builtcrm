"use client";

import { useEffect, useMemo, useState } from "react";

import type { ClientActivityEvent, ClientProjectView } from "@/domain/loaders/project-home";
import type { CommercialPhotosData, PhotoRow } from "@/domain/loaders/commercial-photos";

type Props = {
  contractorName: string;
  currentPhase: string;
  activityTrail: ClientActivityEvent[];
  milestones: ClientProjectView["milestones"];
  photoData: CommercialPhotosData;
};

// ── Phase timeline ──────────────────────────────────────────────
const PHASES = [
  { key: "preconstruction", label: "Demo" },
  { key: "phase_1", label: "Framing" },
  { key: "phase_2", label: "Rough-in" },
  { key: "phase_3", label: "Interior finishes" },
  { key: "closeout_prep", label: "Final details" },
  { key: "closeout", label: "Walkthrough" },
];

function phaseStatus(key: string, currentPhase: string): "done" | "current" | "upcoming" {
  const order = PHASES.map((p) => p.key);
  const currentIdx = order.indexOf(currentPhase);
  const idx = order.indexOf(key);
  if (currentIdx < 0) return idx === 0 ? "current" : "upcoming";
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return "current";
  return "upcoming";
}

// ── Update feed helpers ─────────────────────────────────────────
type UpdateItem = {
  id: string;
  date: string;
  type: string;
  typePill: "teal" | "green" | "blue" | "amber" | "gray";
  title: string;
  titleIcon: boolean;
  body: string[];
  photos: ClientActivityEvent["photoAttachments"];
};

function categorizeForResidential(a: ClientActivityEvent): {
  type: string;
  pill: UpdateItem["typePill"];
  titleIcon: boolean;
} {
  const at = a.activityType;
  const rt = a.relatedObjectType;
  if (at === "milestone_update" || rt === "milestone") {
    return { type: "Milestone reached", pill: "green", titleIcon: true };
  }
  if (at === "file_uploaded" && a.title.toLowerCase().includes("photo")) {
    return { type: "Photo set", pill: "blue", titleIcon: false };
  }
  if (at === "message_posted" || rt === "conversation") {
    return { type: "Message", pill: "blue", titleIcon: false };
  }
  return { type: "Builder update", pill: "teal", titleIcon: false };
}

function weekMondayOf(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function fmtWeekRange(d: Date): string {
  const now = new Date();
  const thisMonday = weekMondayOf(now);
  const itemMonday = weekMondayOf(d);

  const monFmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const dayOnly = (dt: Date) => String(dt.getDate());

  if (itemMonday.getTime() === thisMonday.getTime()) {
    const friday = new Date(itemMonday);
    friday.setDate(friday.getDate() + 4);
    return `This week · ${monFmt(itemMonday)}–${dayOnly(friday)}`;
  }

  const friday = new Date(itemMonday);
  friday.setDate(friday.getDate() + 4);
  if (itemMonday.getMonth() === friday.getMonth()) {
    return `${monFmt(itemMonday)}–${dayOnly(friday)}`;
  }
  return `${monFmt(itemMonday)} – ${monFmt(friday)}`;
}

function fmtFeedDate(d: Date, isSingleDay: boolean): string {
  if (isSingleDay) {
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }
  return fmtWeekRange(d);
}

function buildFeed(
  activityTrail: ClientActivityEvent[],
  contractorName: string,
): UpdateItem[] {
  if (activityTrail.length === 0) return [];
  return activityTrail.map((a) => {
    const cat = categorizeForResidential(a);
    const isSingleDay = cat.type === "Milestone reached";
    return {
      id: a.id,
      date: fmtFeedDate(a.createdAt, isSingleDay),
      type: cat.type,
      typePill: cat.pill,
      title: a.title,
      titleIcon: cat.titleIcon,
      body: a.body ? [a.body] : [],
      photos: a.photoAttachments,
    };
  });
}

// ── Photo tile helpers ──────────────────────────────────────────
const TILE_BGS = [
  "linear-gradient(135deg,#d4c5a9,#8b7a65)",
  "linear-gradient(135deg,#b0a090,#7a6a5a)",
  "linear-gradient(135deg,#8a9a8a,#5a6a5a)",
  "linear-gradient(135deg,#a09080,#706050)",
  "linear-gradient(135deg,#7a8b9a,#4a5a6a)",
  "linear-gradient(135deg,#9a8b7a,#6a5b4a)",
  "linear-gradient(135deg,#8b9a80,#5a6950)",
  "linear-gradient(135deg,#c0b0a0,#8a7a6a)",
];

const FILTER_CHIPS = [
  "All rooms", "Kitchen", "Living room", "Master suite", "Bathrooms", "Exterior",
];

function PhotoTile({ photo, index, onClick }: { photo: PhotoRow; index: number; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  const showImg = photo.url && !failed;
  return (
    <div className="rpp-ph-cell" onClick={onClick}>
      <div
        className="rpp-ph-cell-inner"
        style={showImg ? undefined : { background: TILE_BGS[index % TILE_BGS.length] }}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url!} alt={photo.title} className="rpp-ph-img" loading="lazy" onError={() => setFailed(true)} />
        ) : null}
        <span className="rpp-ph-cell-lbl">{photo.title}</span>
      </div>
    </div>
  );
}

// ── Check icon ──────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// ── Main component ──────────────────────────────────────────────
export function ResidentialProgressView({
  contractorName,
  currentPhase,
  activityTrail,
  milestones,
  photoData,
}: Props) {
  const feed = useMemo(
    () => buildFeed(activityTrail, contractorName),
    [activityTrail, contractorName],
  );

  const [photoFilter, setPhotoFilter] = useState("All rooms");
  const [lightbox, setLightbox] = useState<PhotoRow | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  const lastUpload = photoData.lastUploadedAt
    ? photoData.lastUploadedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  // Re-group photos by week instead of day+uploader
  const weeklyPhotoSets = useMemo(() => {
    const allPhotos = photoData.sets.flatMap((s) => s.photos);
    const grouped = new Map<string, { monday: Date; photos: PhotoRow[] }>();
    for (const p of allPhotos) {
      const monday = weekMondayOf(p.createdAt);
      const key = monday.toISOString().slice(0, 10);
      let group = grouped.get(key);
      if (!group) {
        group = { monday, photos: [] };
        grouped.set(key, group);
      }
      group.photos.push(p);
    }
    return Array.from(grouped.values())
      .sort((a, b) => b.monday.getTime() - a.monday.getTime())
      .map((g) => ({
        header: fmtWeekRange(g.monday),
        count: g.photos.length,
        photos: g.photos,
      }));
  }, [photoData.sets]);

  return (
    <div className="rpp">
      <div className="rpp-head">
        <div className="rpp-title">Progress &amp; Photos</div>
        <div className="rpp-sub">
          See what&apos;s been happening at your home this week and browse all your
          project photos.
        </div>
      </div>

      {/* ── Phase timeline hero ── */}
      <div className="rpp-phase-hero">
        <div className="rpp-phase-lbl">Where your project stands</div>
        <div className="rpp-phase-track">
          {PHASES.map((ph) => {
            const s = phaseStatus(ph.key, currentPhase);
            return (
              <div key={ph.key} className={`rpp-ph-i ${s}`}>
                <div className="rpp-ph-bar" />
                <div className="rpp-ph-nm">{ph.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Update stream ── */}
      {feed.length === 0 ? (
        <div className="rpp-empty">
          Updates from {contractorName} will appear here as work progresses.
        </div>
      ) : (
        <div className="rpp-us">
          {feed.map((u) => (
            <div key={u.id} className="rpp-uc">
              <div className="rpp-uc-head">
                <div className="rpp-uc-date">{u.date}</div>
                <span className={`rpp-pl ${u.typePill}`}>{u.type}</span>
              </div>
              <div className="rpp-uc-body">
                <div className="rpp-uc-title">
                  {u.title}
                  {u.titleIcon ? (
                    <span style={{ display: "inline-flex", marginLeft: 6 }}>
                      <CheckIcon />
                    </span>
                  ) : null}
                </div>
                {u.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {u.photos.length > 0 ? (
                  <div className="rpp-uc-photos">
                    {u.photos.slice(0, 3).map((ph, k) => (
                      <PhotoTile
                        key={ph.id}
                        photo={ph as unknown as PhotoRow}
                        index={k}
                        onClick={() => setLightbox(ph as unknown as PhotoRow)}
                      />
                    ))}
                    {u.photos.length > 3 ? (
                      <div
                        className="rpp-uc-more"
                        onClick={() =>
                          setLightbox(u.photos[3] as unknown as PhotoRow)
                        }
                      >
                        +{u.photos.length - 3} more
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Full photo gallery ── */}
      <div className="rpp-gallery">
        <div className="rpp-gal-head">
          <div>
            <div className="rpp-gal-title">All project photos</div>
            <div className="rpp-gal-stats">
              <span>
                <strong>{photoData.totalCount}</strong> photos
              </span>
              <span>
                <strong>{photoData.setCount}</strong> sets
              </span>
              <span>
                Last upload: <strong>{lastUpload}</strong>
              </span>
            </div>
          </div>
          <button type="button" className="rpp-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download all
          </button>
        </div>

        <div className="rpp-pf-bar">
          {FILTER_CHIPS.map((f) => (
            <button
              key={f}
              type="button"
              className={`rpp-pf${photoFilter === f ? " on" : ""}`}
              onClick={() => setPhotoFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {weeklyPhotoSets.length === 0 ? (
          <div className="rpp-empty">No photos uploaded yet.</div>
        ) : (
          weeklyPhotoSets.map((set) => (
            <div key={set.header} className="rpp-ps-section">
              <div className="rpp-ps-head">
                {set.header}{" "}
                <span className="rpp-ps-cnt">
                  {set.count} {set.count === 1 ? "photo" : "photos"}
                </span>
              </div>
              <div className="rpp-ph-grid">
                {set.photos.map((ph, j) => (
                  <PhotoTile
                    key={ph.id}
                    photo={ph}
                    index={j}
                    onClick={() => setLightbox(ph)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox ? (
        <div
          className="rpp-lb"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="rpp-lb-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rpp-lb-close"
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {lightbox.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.title} className="rpp-lb-img" />
            ) : (
              <div className="rpp-lb-ph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>Image unavailable</span>
              </div>
            )}
            <div className="rpp-lb-caption">{lightbox.title}</div>
          </div>
        </div>
      ) : null}

      <style dangerouslySetInnerHTML={{ __html: rppCss }} />
    </div>
  );
}

const rppCss = `
.rpp{display:flex;flex-direction:column}
.rpp-head{margin-bottom:20px}
.rpp-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.rpp-sub{font-family:var(--fb);font-size:13.5px;color:var(--t2);margin-top:4px}

.rpp-phase-hero{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px;margin-bottom:20px}
.rpp-phase-lbl{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:16px}
.rpp-phase-track{display:flex;gap:6px}
.rpp-ph-i{flex:1;text-align:center}
.rpp-ph-bar{height:6px;border-radius:3px;margin-bottom:8px}
.rpp-ph-i.done .rpp-ph-bar{background:var(--ac)}
.rpp-ph-i.current .rpp-ph-bar{background:linear-gradient(90deg,var(--ac) 65%,var(--s3) 65%)}
.rpp-ph-i.upcoming .rpp-ph-bar{background:var(--s3)}
.rpp-ph-nm{font-family:var(--fd);font-size:12px;font-weight:580;color:var(--t2)}
.rpp-ph-i.current .rpp-ph-nm{color:var(--t1);font-weight:680}
.rpp-ph-i.done .rpp-ph-nm{color:var(--ac-t)}

.rpp-us{display:flex;flex-direction:column;gap:16px;margin-bottom:24px}
.rpp-uc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;transition:box-shadow 200ms ease}
.rpp-uc:hover{box-shadow:var(--shmd)}
.rpp-uc-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
.rpp-uc-date{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t1)}
.rpp-uc-body{padding:20px}
.rpp-uc-title{font-family:var(--fd);font-size:16px;font-weight:700;letter-spacing:-.01em;margin-bottom:8px;display:flex;align-items:center;color:var(--t1)}
.rpp-uc-body p{font-family:var(--fb);color:var(--t2);line-height:1.6;margin:0 0 12px}
.rpp-uc-body p:last-of-type{margin-bottom:0}

.rpp-uc-photos{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}
.rpp-uc-more{aspect-ratio:4/3;border-radius:var(--r-m);background:var(--s2);display:grid;place-items:center;font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t2);cursor:pointer;transition:background 120ms ease}
.rpp-uc-more:hover{background:var(--s3)}

.rpp-pl{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-family:var(--fd);font-size:10.5px;font-weight:700;white-space:nowrap}
.rpp-pl.teal{background:var(--ac-s);color:var(--ac-t)}
.rpp-pl.green{background:var(--ok-s);color:var(--ok-t)}
.rpp-pl.blue{background:var(--in-s);color:var(--in-t)}
.rpp-pl.amber{background:var(--wr-s);color:var(--wr-t)}
.rpp-pl.gray{background:var(--s2);color:var(--t3)}

.rpp-gallery{margin-top:24px}
.rpp-gal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:16px;flex-wrap:wrap}
.rpp-gal-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em;color:var(--t1);margin-bottom:4px}
.rpp-gal-stats{display:flex;gap:20px;font-family:var(--fb);font-size:13px;color:var(--t2)}
.rpp-gal-stats strong{font-family:var(--fd);font-weight:650;color:var(--t1)}
.rpp-btn{height:32px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:620;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all 120ms ease;white-space:nowrap;flex-shrink:0}
.rpp-btn:hover{background:var(--s2);border-color:var(--s4)}
.rpp-btn svg{width:14px;height:14px;flex-shrink:0}

.rpp-pf-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.rpp-pf{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12px;font-weight:560;color:var(--t2);cursor:pointer;transition:all 120ms ease;display:inline-flex;align-items:center}
.rpp-pf:hover{border-color:var(--s4);color:var(--t1)}
.rpp-pf.on{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}

.rpp-ps-section{margin-bottom:20px}
.rpp-ps-head{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t2);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.rpp-ps-cnt{font-size:11px;color:var(--t3);font-weight:520}

.rpp-ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.rpp-ph-cell{aspect-ratio:4/3;border-radius:var(--r-l);overflow:hidden;cursor:pointer;transition:transform 120ms ease}
.rpp-ph-cell:hover{transform:scale(1.02)}
.rpp-ph-cell-inner{width:100%;height:100%;display:flex;align-items:flex-end;padding:12px;position:relative}
.rpp-ph-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rpp-ph-cell-lbl{font-family:var(--fb);font-size:11.5px;font-weight:600;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5);background:rgba(0,0,0,.25);padding:3px 10px;border-radius:var(--r-s);position:relative;z-index:1}

.rpp-empty{background:var(--s1);border:1px dashed var(--s3);border-radius:var(--r-l);padding:32px;font-family:var(--fb);font-size:13px;color:var(--t3);text-align:center;margin-bottom:20px}

.rpp-lb{position:fixed;inset:0;background:rgba(12,14,20,.88);z-index:1000;display:flex;align-items:center;justify-content:center;padding:32px;animation:rpp-lb-fade 160ms ease-out}
@keyframes rpp-lb-fade{from{opacity:0}to{opacity:1}}
.rpp-lb-inner{position:relative;width:min(1400px,92vw);display:flex;flex-direction:column;align-items:center;gap:14px}
.rpp-lb-img{width:100%;height:auto;max-height:84vh;object-fit:contain;border-radius:var(--r-l);box-shadow:0 20px 60px rgba(0,0,0,.5);background:var(--s2);display:block}
.rpp-lb-ph{width:100%;aspect-ratio:4/3;max-height:84vh;border-radius:var(--r-l);background:linear-gradient(135deg,#2a2e3c,#1a1d28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,.7);font-family:var(--fb);font-size:13px}
.rpp-lb-caption{font-family:var(--fb);font-size:13px;color:rgba(255,255,255,.88);text-align:center;max-width:80vw;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.rpp-lb-close{position:absolute;top:-8px;right:-8px;width:36px;height:36px;border-radius:50%;border:none;background:var(--s1);color:var(--t1);display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:all 120ms ease;z-index:1}
.rpp-lb-close:hover{background:var(--s2);transform:scale(1.05)}

@media(max-width:1280px){.rpp-ph-grid{grid-template-columns:repeat(3,1fr)}.rpp-uc-photos{grid-template-columns:repeat(3,1fr)}}
@media(max-width:720px){.rpp-title{font-size:22px}.rpp-ph-grid{grid-template-columns:repeat(2,1fr)}.rpp-uc-photos{grid-template-columns:repeat(2,1fr)}.rpp-phase-track{flex-wrap:wrap}}
`;
