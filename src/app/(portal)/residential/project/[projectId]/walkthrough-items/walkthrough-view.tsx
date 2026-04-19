"use client";

import { useEffect, useState } from "react";

import type {
  PunchItemPhotoRow,
  PunchItemResidentialRow,
  ResidentialWalkthroughView,
} from "@/domain/loaders/punch-list";
import { RESIDENTIAL_FRIENDLY, type PunchStatus } from "@/lib/punch-list/config";

// Residential-only "Walkthrough Items" view. Read-only. Phase-gated:
// shows the empty-state help card when project.currentPhase !== 'closeout'.
// Friendly status labels ONLY — raw enum names must never appear.
// Void items are excluded entirely (loader already filters).

const I = {
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  clock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  home: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" />
    </svg>
  ),
};

export function WalkthroughItemsView({
  view,
}: {
  view: ResidentialWalkthroughView;
}) {
  const [lightbox, setLightbox] = useState<PunchItemPhotoRow | null>(null);
  return (
    <div className="wi-root">
      <style>{CSS}</style>

      {!view.project.inCloseout ? (
        <PreCloseoutEmpty />
      ) : (
        <PopulatedView
          items={view.items}
          onOpenPhoto={(p) => setLightbox(p)}
        />
      )}

      {lightbox && (
        <PhotoLightbox
          photo={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function PreCloseoutEmpty() {
  return (
    <>
      <div className="wi-page-h">
        <h1>Walkthrough Items</h1>
        <p>
          This is where your final punch list will live once your home is
          nearly complete. You&apos;ll see it pop up naturally when we enter
          the walkthrough phase.
        </p>
      </div>
      <div className="wi-empty">
        <div className="wi-empty-ico">{I.home}</div>
        <h3>Your walkthrough list will appear here</h3>
        <p>
          Toward the end of your project, your builder will create a list of
          small final touches. You&apos;ll be able to see each item, photos of
          the fix, and mark them off together during your walkthrough.
        </p>
      </div>
      <div className="wi-help">
        <div className="wi-help-ico">{I.info}</div>
        <div>
          <h4>What&apos;s a walkthrough?</h4>
          <p>
            Near the end of construction, you&apos;ll walk through your home
            with your builder to note any small finishing touches — a paint
            scuff, a missing door stop, a caulk line that needs a redo. Those
            items land here so you can follow along as they&apos;re fixed.
          </p>
        </div>
      </div>
    </>
  );
}

function PopulatedView({
  items,
  onOpenPhoto,
}: {
  items: PunchItemResidentialRow[];
  onOpenPhoto: (p: PunchItemPhotoRow) => void;
}) {
  // Group by the three residential buckets per the spec:
  //   Ready to check = status ready_to_verify
  //   Being worked on = open + in_progress + rejected
  //   All done = verified
  const readyToCheck = items.filter((it) => it.status === "ready_to_verify");
  const beingWorked = items.filter((it) =>
    ["open", "in_progress", "rejected"].includes(it.status),
  );
  const done = items.filter((it) => it.status === "verified");

  return (
    <>
      <div className="wi-page-h">
        <h1>Walkthrough Items</h1>
        <p>
          Here&apos;s the running list of final touches your builder is
          working through. You&apos;ll see each item&apos;s status update as
          work is completed. Nothing to do from your end until your walkthrough
          — just browse along.
        </p>
      </div>

      <div className="wi-ss">
        <SummaryCard
          label="Ready to check"
          value={readyToCheck.length}
          meta="Done — take a look"
          highlight
        />
        <SummaryCard
          label="Being worked on"
          value={beingWorked.length}
          meta="In progress with your trades"
        />
        <SummaryCard
          label="All done"
          value={done.length}
          meta="You've signed off"
        />
      </div>

      {readyToCheck.length > 0 && (
        <>
          <div className="wi-sec-h">
            <h3>Ready for your walkthrough</h3>
            <span className="sub">
              Completed — take a look when you&apos;re on-site
            </span>
          </div>
          {readyToCheck.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              highlight
              onOpenPhoto={onOpenPhoto}
            />
          ))}
        </>
      )}

      {beingWorked.length > 0 && (
        <>
          <div className="wi-sec-h">
            <h3>Being worked on</h3>
            <span className="sub">Your builder is addressing these now</span>
          </div>
          {beingWorked.map((it) => (
            <ItemCard key={it.id} item={it} onOpenPhoto={onOpenPhoto} />
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="wi-sec-h">
            <h3>All done</h3>
            <span className="sub">You&apos;ve signed off on these</span>
          </div>
          {done.map((it) => (
            <DoneCard key={it.id} item={it} />
          ))}
        </>
      )}

      {readyToCheck.length === 0 &&
        beingWorked.length === 0 &&
        done.length === 0 && (
          <div className="wi-empty">
            <h3>No items yet</h3>
            <p>
              Your builder hasn&apos;t added any walkthrough items yet. Check
              back as you approach the final walk-through.
            </p>
          </div>
        )}

      <div className="wi-help">
        <div className="wi-help-ico">{I.info}</div>
        <div>
          <h4>How this works</h4>
          <p>
            Your builder adds items as they come up, then updates each one as
            work progresses. When something&apos;s ready for you to see, it
            moves up to the top section. During your walkthrough, you&apos;ll
            go through them together — no action needed from you before then.
            Questions? Reach out through the Messages tab.
          </p>
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  meta,
  highlight,
}: {
  label: string;
  value: number;
  meta: string;
  highlight?: boolean;
}) {
  return (
    <div className={`wi-sc${highlight ? " highlight" : ""}`}>
      <div className="sc-label">{label}</div>
      <div className="sc-value">{value}</div>
      <div className="sc-meta">{meta}</div>
    </div>
  );
}

function statusPill(status: PunchStatus) {
  const f = RESIDENTIAL_FRIENDLY[status];
  return <span className={`wi-pl ${f.pill}`}>{f.label}</span>;
}

function ItemCard({
  item,
  highlight,
  onOpenPhoto,
}: {
  item: PunchItemResidentialRow;
  highlight?: boolean;
  onOpenPhoto: (p: PunchItemPhotoRow) => void;
}) {
  return (
    <div className={`wic${highlight ? " highlight" : ""}`}>
      <div className="wic-top">
        <div>
          <h4>{item.title}</h4>
          {item.location && (
            <div className="wic-loc">
              {I.pin}
              <span>{item.location}</span>
            </div>
          )}
        </div>
        {statusPill(item.status)}
      </div>
      <div className="wic-desc">{item.description}</div>
      {item.clientFacingNote && (
        <div className="wic-note">
          <div>
            <div className="k">From your builder</div>
            <div className="v">{item.clientFacingNote}</div>
          </div>
        </div>
      )}
      {item.photos.length > 0 && (
        <div className="wi-gal">
          {item.photos.map((p) => {
            const clickable = !!p.url;
            return (
              <div
                key={p.id}
                className={`wi-ph${clickable ? " clickable" : ""}`}
                onClick={() => clickable && onOpenPhoto(p)}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : -1}
                onKeyDown={(e) => {
                  if (clickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onOpenPhoto(p);
                  }
                }}
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={p.caption ?? p.title} loading="lazy" />
                ) : (
                  <div className="wi-phbg" />
                )}
                {p.caption && <div className="wi-ph-cap">{p.caption}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div className="wic-foot">
        <span>
          {I.clock}
          <span style={{ marginLeft: 4 }}>
            Added {formatShort(item.addedOnIso)}
          </span>
        </span>
        {item.updatedOnIso && (
          <span>Last update {formatShort(item.updatedOnIso)}</span>
        )}
      </div>
    </div>
  );
}

function DoneCard({ item }: { item: PunchItemResidentialRow }) {
  return (
    <div className="wic" style={{ opacity: 0.82 }}>
      <div className="wic-top">
        <div>
          <h4 style={{ fontSize: 15 }}>{item.title}</h4>
          {item.location && (
            <div className="wic-loc">
              {I.pin}
              <span>{item.location}</span>
            </div>
          )}
        </div>
        {statusPill(item.status)}
      </div>
      <div className="wic-foot" style={{ marginTop: 10, paddingTop: 0, borderTop: "none" }}>
        <span>
          {I.check}
          <span style={{ marginLeft: 4 }}>
            Signed off{" "}
            {item.updatedOnIso ? formatShort(item.updatedOnIso) : "recently"}
          </span>
        </span>
      </div>
    </div>
  );
}

// Full-screen photo viewer. Click anywhere or press Escape to close.
// Keeps the same UX as the contractor/sub lightbox but with the
// residential teal accent on the close-button hover.
function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: PunchItemPhotoRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="wi-lb-ov"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button className="wi-lb-close" onClick={onClose} aria-label="Close photo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="wi-lb-body" onClick={(e) => e.stopPropagation()}>
        {photo.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.caption ?? photo.title}
            className="wi-lb-img"
          />
        )}
        {photo.caption && <div className="wi-lb-cap">{photo.caption}</div>}
      </div>
    </div>
  );
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Residential teal accent. Prefixed `wi-` to avoid collisions with the
// contractor/sub workspace classes.
const CSS = `
.wi-root{
  --s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#2a7f6f;--ac-h:#237060;--ac-s:#e6f5f1;--ac-t:#1f6b5c;--ac-m:#b0d9cf;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;
  --r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  font-family:var(--fb);color:var(--t1);line-height:1.55;font-size:14px;
  padding:28px 32px;max-width:960px;margin:0 auto;
}
.wi-root *{box-sizing:border-box}

.wi-page-h{margin-bottom:20px}
.wi-page-h h1{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;margin:0}
.wi-page-h p{margin-top:6px;font-size:14px;color:var(--t2);max-width:620px;line-height:1.6;font-weight:520}

.wi-ss{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.wi-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;box-shadow:var(--shsm)}
.wi-sc.highlight{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 40%,var(--s1))}
.wi-sc .sc-label{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.wi-sc .sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.wi-sc .sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

.wi-sec-h{display:flex;align-items:baseline;gap:10px;margin:22px 0 12px}
.wi-sec-h h3{font-family:var(--fd);font-size:16px;font-weight:720;margin:0}
.wi-sec-h .sub{font-size:12.5px;color:var(--t3)}

.wi-pl{height:22px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:720;display:inline-flex;align-items:center;font-family:var(--fd);border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap}
.wi-pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.wi-pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.wi-pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.wi-pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.wi-pl.gray{background:var(--s2);color:var(--t3)}

.wic{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:18px 20px;margin-bottom:12px;box-shadow:var(--shsm)}
.wic.highlight{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1))}
.wic-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
.wic-top h4{font-family:var(--fd);font-size:16px;font-weight:720;line-height:1.3;margin:0}
.wic-loc{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t3);margin-top:4px}
.wic-loc svg{color:var(--t3);flex-shrink:0}
.wic-desc{font-size:13.5px;color:var(--t2);line-height:1.6;margin-bottom:12px}
.wic-note{background:var(--si);border-left:3px solid var(--ac);padding:10px 14px;border-radius:0 var(--r-m) var(--r-m) 0;margin-bottom:12px}
.wic-note .k{font-family:var(--fd);font-size:10.5px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--ac-t);margin-bottom:3px}
.wic-note .v{font-size:13px;color:var(--t1);line-height:1.5;font-style:italic}
.wic-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--s2);font-size:12px;color:var(--t3)}
.wic-foot svg{color:var(--t3)}

.wi-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:12px}
.wi-ph{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;position:relative;border:1px solid var(--s3);background:var(--s2)}
.wi-ph.clickable{cursor:zoom-in;transition:transform 120ms cubic-bezier(.16,1,.3,1)}
.wi-ph.clickable:hover{transform:scale(1.02);border-color:var(--ac-m)}
.wi-ph img{width:100%;height:100%;object-fit:cover;display:block}
.wi-phbg{position:absolute;inset:0;background:var(--s2)}
.wi-ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.6));color:white;font-size:11px;font-weight:620}

/* Lightbox */
.wi-lb-ov{position:fixed;inset:0;background:rgba(12,10,8,.88);z-index:1000;display:flex;align-items:center;justify-content:center;padding:40px;cursor:zoom-out;animation:wi-lb-fade 160ms cubic-bezier(.16,1,.3,1)}
.wi-lb-close{position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.12);color:white;border:none;display:grid;place-items:center;cursor:pointer;transition:background 120ms}
.wi-lb-close:hover{background:var(--ac-s);color:var(--ac-t)}
.wi-lb-body{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:100%;max-height:100%;cursor:default}
.wi-lb-img{max-width:min(92vw,1400px);max-height:calc(100vh - 120px);object-fit:contain;border-radius:var(--r-m);box-shadow:0 16px 48px rgba(0,0,0,.5)}
.wi-lb-cap{color:white;font-size:14px;font-weight:560;max-width:80ch;text-align:center;line-height:1.5}
@keyframes wi-lb-fade{from{opacity:0}to{opacity:1}}

.wi-empty{background:var(--s1);border:1px dashed var(--s3);border-radius:var(--r-xl);padding:40px 24px;text-align:center}
.wi-empty-ico{color:var(--ac);display:flex;justify-content:center;margin-bottom:12px}
.wi-empty h3{font-family:var(--fd);font-size:17px;font-weight:740;margin:0}
.wi-empty p{font-size:13.5px;color:var(--t2);margin-top:8px;line-height:1.6;max-width:440px;margin-left:auto;margin-right:auto}

.wi-help{display:flex;gap:14px;background:var(--si);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px 20px;margin-top:20px}
.wi-help-ico{color:var(--ac-t);flex-shrink:0;margin-top:3px}
.wi-help h4{font-family:var(--fd);font-size:14px;font-weight:720;margin:0}
.wi-help p{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.6}

@media(max-width:720px){
  .wi-ss{grid-template-columns:1fr}
}
`;
