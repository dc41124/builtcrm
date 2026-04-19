import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  pin:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  check:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  clock:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  home: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z"/></svg>,
};

// ── Logo ────────────────────────────────────────────────────────
const Logo = ({ s = 32 }) => (
  <div style={{ width: s, height: s, borderRadius: 10, background: "linear-gradient(135deg,#1a1714,#3d3830)", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.55} height={s * 0.55}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="#faf9f7" opacity=".95"/>
    </svg>
  </div>
);

// ── Nav ─────────────────────────────────────────────────────────
const residentialNav = [
  { section: "Your Project", items: [
    { label: "Project Home" },
    { label: "Selections", badge: 2, bt: "blue" },
    { label: "Photos & Updates" },
    { label: "Schedule" },
    { label: "Scope Changes" },
    { label: "Walkthrough Items", active: true, badge: 3, bt: "warn" },
    { label: "Documents" },
    { label: "Messages", badge: 1, bt: "blue" },
    { label: "Payments" },
  ]},
];

// ── Mock walkthrough items (residential-flavored, Harrison Residence) ──
const items = [
  {
    id: "WI-008", title: "Touch up paint — kitchen trim near window",
    location: "Kitchen — crown molding above the south-facing window",
    description: "Small paint scuff on the upper trim. Your painter will sand flush and recoat to match.",
    status: "ready_to_verify",
    addedOn: "Apr 14", updatedOn: "Apr 15",
    photos: [
      { id: 1, caption: "The scuff (before)", color: "#c8b49a" },
      { id: 2, caption: "After touch-up", color: "#d4c4ae" },
    ],
    contractorNote: "Re-coated yesterday afternoon. Dry and ready for your check.",
  },
  {
    id: "WI-007", title: "Caulk around master bath tub",
    location: "Master bathroom — tub surround, back wall seam",
    description: "The caulk bead along the back of the tub has a small gap. Your plumber will redo the bead for a clean seal.",
    status: "ready_to_verify",
    addedOn: "Apr 13", updatedOn: "Apr 15",
    photos: [
      { id: 1, caption: "Fresh bead applied", color: "#b8a590" },
    ],
    contractorNote: "Clean silicone bead applied. 24 hours to fully cure — safe to look at but please don't touch until tomorrow.",
  },
  {
    id: "WI-006", title: "Replace cracked outlet cover — guest bedroom",
    location: "Guest bedroom — outlet behind nightstand wall",
    description: "The cover plate on one outlet has a hairline crack. Your electrician is swapping it for a new plate.",
    status: "in_progress",
    addedOn: "Apr 15",
    photos: [],
    contractorNote: "New plate ordered — should arrive tomorrow.",
  },
  {
    id: "WI-005", title: "Finish fitting in primary closet",
    location: "Primary bedroom closet — west wall shelving",
    description: "One shelf bracket is slightly out of level. Your carpenter will adjust it so the shelves sit flush.",
    status: "open",
    addedOn: "Apr 16",
    photos: [],
    contractorNote: null,
  },
  {
    id: "WI-004", title: "Tile grout line needs redo — mudroom",
    location: "Mudroom floor — near back door threshold",
    description: "A small section of grout pulled away during cure. Your tile installer is coming back to redo that section.",
    status: "rejected", // first attempt wasn't quite right
    addedOn: "Apr 11", updatedOn: "Apr 14",
    photos: [{ id: 1, caption: "Gap in grout line", color: "#8d7a65" }],
    contractorNote: "First fix wasn't clean — scheduled a return visit for Thursday to redo properly.",
  },
  {
    id: "WI-003", title: "Baseboard scuff — hallway outside guest room",
    location: "Upstairs hallway — baseboard, ~3m from guest bedroom door",
    description: "Black scuff on the baseboard, likely from moving equipment. Painter to touch up.",
    status: "verified",
    addedOn: "Apr 9", updatedOn: "Apr 12",
    photos: [{ id: 1, caption: "Before touch-up", color: "#7a6654" }],
    contractorNote: "All done — you confirmed this one during the last walk.",
  },
  {
    id: "WI-002", title: "Door handle alignment — pantry",
    location: "Kitchen pantry — door handle",
    description: "Handle was mounted slightly off-center. Your carpenter repositioned and patched the original holes.",
    status: "verified",
    addedOn: "Apr 7", updatedOn: "Apr 10",
    photos: [],
    contractorNote: "Completed and signed off.",
  },
];

// ── Friendly labels ────────────────────────────────────────────
const FRIENDLY = {
  open:             { label: "Just added",        pill: "gray",   blurb: "On the list — your builder will schedule it in." },
  in_progress:      { label: "Being fixed",        pill: "orange", blurb: "Your builder is working on it now." },
  ready_to_verify:  { label: "Ready to check",     pill: "accent", blurb: "Done — take a look during your walkthrough." },
  verified:         { label: "Done",               pill: "green",  blurb: "You've confirmed this one. All finished." },
  rejected:         { label: "Still needs work",   pill: "red",    blurb: "Your builder is addressing it again." },
};

// ── Component ───────────────────────────────────────────────────
export default function WalkthroughItemsResidential() {
  const [dark, setDark] = useState(false);
  // Phase toggle — in production this is read from project.currentPhase
  const [phase, setPhase] = useState("closeout"); // "closeout" | "other"

  const meta = { label: "Homeowner Portal", project: "The Harrison Residence", page: "Walkthrough Items", user: "SH" };

  // Group items
  const readyToCheck = items.filter(it => it.status === "ready_to_verify");
  const beingWorked  = items.filter(it => ["in_progress", "open", "rejected"].includes(it.status));
  const done         = items.filter(it => it.status === "verified");

  const statusPill = (s) => <span className={`pl ${FRIENDLY[s].pill}`}>{FRIENDLY[s].label}</span>;

  return (
    <div className={`wi-app ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.wi-app{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#2a7f6f;--ac-h:#237060;--ac-s:#e6f5f1;--ac-t:#1f6b5c;--ac-m:#b0d9cf;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(42,127,111,.18);
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.wi-app.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.sb-srch{padding:12px 16px}
.sb-srch input{width:100%;height:32px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:12.5px;background:var(--s2);color:var(--t1);outline:none}
.sb-srch input:focus{border-color:var(--ac);background:var(--s1);box-shadow:var(--shri)}
.s-nav{flex:1;overflow-y:auto;padding:0 10px 16px}
.ns-lbl{font-family:var(--fd);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:10px 10px 6px}
.ni{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r-m);font-size:13px;font-weight:560;color:var(--t2);cursor:pointer;transition:all var(--df)}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:680}
.ni-b{margin-left:auto;min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:720;display:grid;place-items:center;background:var(--s2);color:var(--t3);font-family:var(--fd)}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}
.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}
.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.wi-app.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}
.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}
.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px;flex:1;max-width:920px}

/* Prototype phase toggle */
.phx{display:flex;align-items:center;gap:8px;background:#fff8e1;border:1px dashed #e8c896;border-radius:var(--r-m);padding:8px 12px;margin-bottom:16px;font-size:12px;color:#96600f;font-family:var(--fd);font-weight:600}
.wi-app.dk .phx{background:#2a2010;border-color:#5a4420;color:#e8b44e}
.phx b{font-family:var(--fd);font-weight:700}
.phx-toggle{display:flex;gap:4px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);padding:2px;margin-left:auto}
.phx-toggle button{height:26px;padding:0 10px;border-radius:6px;font-size:11.5px;font-weight:650;color:var(--t3)}
.phx-toggle button.on{background:var(--ac);color:white}

/* Page header */
.pg-h{margin-bottom:20px}
.pg-h h2{font-family:var(--fd);font-size:26px;font-weight:780;letter-spacing:-.03em;line-height:1.15}
.pg-h p{margin-top:8px;font-size:14px;color:var(--t2);max-width:640px;line-height:1.6}

/* Summary strip (friendly — 3 items) */
.ss{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;box-shadow:var(--shsm)}
.sc.highlight{border-color:var(--ac-m);background:linear-gradient(180deg,var(--ac-s),var(--s1))}
.sc-label{font-family:var(--fd);font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

/* Section heading */
.sec-h{display:flex;align-items:baseline;gap:10px;margin:28px 0 12px}
.sec-h h3{font-family:var(--fd);font-size:17px;font-weight:740;letter-spacing:-.02em}
.sec-h .sub{font-size:13px;color:var(--t3)}
.sec-h:first-of-type{margin-top:4px}

/* Item card */
.wic{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:18px 20px;box-shadow:var(--shsm);margin-bottom:12px;transition:all var(--dn) var(--e)}
.wic.highlight{border-color:var(--ac-m);border-width:2px;padding:17px 19px}
.wic-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.wic-top .pl{margin-top:2px}
.wic h4{font-family:var(--fd);font-size:16px;font-weight:720;line-height:1.3}
.wic-loc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--t3);margin-top:6px}
.wic-loc svg{color:var(--t3);flex-shrink:0}
.wic-desc{font-size:13.5px;color:var(--t2);margin-top:12px;line-height:1.6}
.wic-note{margin-top:12px;padding:12px 14px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-m);display:flex;gap:10px}
.wic-note .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ac-t);margin-bottom:3px}
.wic-note .v{font-size:13px;color:var(--t1);line-height:1.5}

/* Gallery (smaller than contractor view) */
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:12px}
.ph{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;position:relative;cursor:pointer;border:1px solid var(--s3);transition:transform var(--df)}
.ph:hover{transform:scale(1.02)}
.ph .phbg{position:absolute;inset:0}
.ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.65));color:white;font-size:10.5px;font-weight:600}

/* Footer meta */
.wic-foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--s2);font-size:12px;color:var(--t3)}
.wic-foot svg{vertical-align:-2px;margin-right:4px}

/* Pills (reuse) */
.pl{height:22px;padding:0 10px;border-radius:999px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.gray{background:var(--s2);color:var(--t3)}

/* Empty state — not in closeout */
.empty{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:56px 32px;text-align:center;box-shadow:var(--shsm)}
.empty-ico{width:64px;height:64px;border-radius:50%;background:var(--ac-s);color:var(--ac-t);display:grid;place-items:center;margin:0 auto 16px}
.empty-ico svg{width:28px;height:28px}
.empty h3{font-family:var(--fd);font-size:18px;font-weight:740;letter-spacing:-.02em;margin-bottom:8px}
.empty p{font-size:14px;color:var(--t2);max-width:420px;margin:0 auto;line-height:1.6}

/* Help card at bottom */
.help{margin-top:32px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px 22px;box-shadow:var(--shsm);display:flex;gap:14px}
.help-ico{width:40px;height:40px;border-radius:var(--r-m);background:var(--ac-s);color:var(--ac-t);display:grid;place-items:center;flex-shrink:0}
.help h4{font-family:var(--fd);font-size:15px;font-weight:720}
.help p{font-size:13.5px;color:var(--t2);margin-top:4px;line-height:1.55}

/* Responsive */
@media(max-width:900px){
  .wi-app{grid-template-columns:1fr}
  .side{display:none}
  .ss{grid-template-columns:1fr}
  .ct{padding:16px}
}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">{meta.label}</div>
          </div>
        </div>
        <div className="sb-srch"><input placeholder="Search…" /></div>
        <nav className="s-nav">
          {residentialNav.map((sec) => (
            <div key={sec.section} style={{ marginBottom: 4 }}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map((it) => (
                <div key={it.label} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge != null && <span className={`ni-b ${it.bt}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>{meta.label}</span><span className="sep">›</span>
            <span>{meta.project}</span><span className="sep">›</span>
            <span className="cur">{meta.page}</span>
          </div>
          <div className="tb-acts">
            <div className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</div>
            <div className="ib">{I.bell}</div>
            <div className="av">{meta.user}</div>
          </div>
        </div>

        <div className="ct fade-up">
          {/* Prototype-only phase toggle. Implementation reads project.currentPhase. */}
          <div className="phx">
            {I.info}
            <span>Prototype: project phase is mocked. In production this page appears only when <b>currentPhase === 'closeout'</b>.</span>
            <div className="phx-toggle">
              <button className={phase === "other" ? "on" : ""} onClick={() => setPhase("other")}>Pre-closeout</button>
              <button className={phase === "closeout" ? "on" : ""} onClick={() => setPhase("closeout")}>In closeout</button>
            </div>
          </div>

          {phase === "other" ? (
            // ── Empty state — project not in closeout yet ──
            <>
              <div className="pg-h">
                <h2>Walkthrough Items</h2>
                <p>This is where your final punch list will live once your home is nearly complete. You'll see it pop up naturally when we enter the walkthrough phase.</p>
              </div>
              <div className="empty">
                <div className="empty-ico">{I.home}</div>
                <h3>Your walkthrough list will appear here</h3>
                <p>Toward the end of your project, your builder will create a list of small final touches. You'll be able to see each item, photos of the fix, and mark them off together during your walkthrough.</p>
              </div>
              <div className="help">
                <div className="help-ico">{I.info}</div>
                <div>
                  <h4>What's a walkthrough?</h4>
                  <p>Near the end of construction, you'll walk through your home with your builder to note any small finishing touches — a paint scuff, a missing door stop, a caulk line that needs a redo. Those items land here so you can follow along as they're fixed.</p>
                </div>
              </div>
            </>
          ) : (
            // ── Populated view ──
            <>
              <div className="pg-h">
                <h2>Walkthrough Items</h2>
                <p>Here's the running list of final touches your builder is working through. You'll see each item's status update as work is completed. Nothing to do from your end until your walkthrough — just browse along.</p>
              </div>

              {/* Summary strip */}
              <div className="ss">
                <div className="sc highlight">
                  <div className="sc-label">Ready to check</div>
                  <div className="sc-value">{readyToCheck.length}</div>
                  <div className="sc-meta">Done — take a look</div>
                </div>
                <div className="sc">
                  <div className="sc-label">Being worked on</div>
                  <div className="sc-value">{beingWorked.length}</div>
                  <div className="sc-meta">In progress with your trades</div>
                </div>
                <div className="sc">
                  <div className="sc-label">All done</div>
                  <div className="sc-value">{done.length}</div>
                  <div className="sc-meta">You've signed off</div>
                </div>
              </div>

              {/* Ready to check — the "hot" section */}
              {readyToCheck.length > 0 && (
                <>
                  <div className="sec-h">
                    <h3>Ready for your walkthrough</h3>
                    <span className="sub">Completed — take a look when you're on-site</span>
                  </div>
                  {readyToCheck.map(it => (
                    <div key={it.id} className="wic highlight">
                      <div className="wic-top">
                        <div>
                          <h4>{it.title}</h4>
                          <div className="wic-loc">{I.pin}<span>{it.location}</span></div>
                        </div>
                        {statusPill(it.status)}
                      </div>
                      <div className="wic-desc">{it.description}</div>
                      {it.contractorNote && (
                        <div className="wic-note">
                          <div>
                            <div className="k">From your builder</div>
                            <div className="v">{it.contractorNote}</div>
                          </div>
                        </div>
                      )}
                      {it.photos.length > 0 && (
                        <div className="gal">
                          {it.photos.map(p => (
                            <div key={p.id} className="ph">
                              <div className="phbg" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }} />
                              <div className="ph-cap">{p.caption}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="wic-foot">
                        <span>{I.clock}Added {it.addedOn}</span>
                        {it.updatedOn && <span>Last update {it.updatedOn}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Being worked on */}
              {beingWorked.length > 0 && (
                <>
                  <div className="sec-h">
                    <h3>Being worked on</h3>
                    <span className="sub">Your builder is addressing these now</span>
                  </div>
                  {beingWorked.map(it => (
                    <div key={it.id} className="wic">
                      <div className="wic-top">
                        <div>
                          <h4>{it.title}</h4>
                          <div className="wic-loc">{I.pin}<span>{it.location}</span></div>
                        </div>
                        {statusPill(it.status)}
                      </div>
                      <div className="wic-desc">{it.description}</div>
                      {it.contractorNote && (
                        <div className="wic-note">
                          <div>
                            <div className="k">From your builder</div>
                            <div className="v">{it.contractorNote}</div>
                          </div>
                        </div>
                      )}
                      {it.photos.length > 0 && (
                        <div className="gal">
                          {it.photos.map(p => (
                            <div key={p.id} className="ph">
                              <div className="phbg" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }} />
                              <div className="ph-cap">{p.caption}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="wic-foot">
                        <span>{I.clock}Added {it.addedOn}</span>
                        {it.updatedOn && <span>Last update {it.updatedOn}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Done */}
              {done.length > 0 && (
                <>
                  <div className="sec-h">
                    <h3>All done</h3>
                    <span className="sub">You've signed off on these</span>
                  </div>
                  {done.map(it => (
                    <div key={it.id} className="wic" style={{ opacity: 0.82 }}>
                      <div className="wic-top">
                        <div>
                          <h4 style={{ fontSize: 15 }}>{it.title}</h4>
                          <div className="wic-loc">{I.pin}<span>{it.location}</span></div>
                        </div>
                        {statusPill(it.status)}
                      </div>
                      <div className="wic-foot" style={{ marginTop: 10, paddingTop: 0, borderTop: "none" }}>
                        <span>{I.check}Signed off {it.updatedOn}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Help card */}
              <div className="help">
                <div className="help-ico">{I.info}</div>
                <div>
                  <h4>How this works</h4>
                  <p>Your builder adds items as they come up, then updates each one as work progresses. When something's ready for you to see, it moves up to the top section. During your walkthrough, you'll go through them together — no action needed from you before then. Questions? Reach out through the Messages tab.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
