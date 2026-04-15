import { useState, useEffect } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  chev: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  upload: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  uploadSm: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  file: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>,
  bulb: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>,
  warn: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

// ── Logo Mark (Option F) ────────────────────────────────────────
const Logo = ({ s = 30 }) => (
  <div style={{ width: s, height: s, borderRadius: 8, background: "linear-gradient(135deg,#1d6b5d,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.6} height={s * 0.6}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Sidebar Nav Data ────────────────────────────────────────────
const sidebarSections = [
  { label: "Your project", items: [
    { label: "Project Home", page: "home" },
    { label: "Progress & Photos", page: "progress" },
    { label: "Selections", badge: 3, badgeType: "amber" },
    { label: "Schedule" },
  ]},
  { label: "Decisions", items: [
    { label: "Scope changes", badge: 1, badgeType: "amber" },
    { label: "Confirmed choices" },
  ]},
  { label: "Payments & docs", items: [
    { label: "Budget", page: "budget" },
    { label: "Documents", page: "documents" },
  ]},
  { label: "Messages", items: [
    { label: "Inbox", badge: 1, badgeType: "blue" },
  ]},
];

// ── Phase Timeline Data ─────────────────────────────────────────
const phases = [
  { name: "Demo", status: "done" },
  { name: "Framing", status: "done" },
  { name: "Rough-in", status: "done" },
  { name: "Interior finishes", status: "current" },
  { name: "Final details", status: "upcoming" },
  { name: "Walkthrough", status: "upcoming" },
];

// ── Update Stream Data ──────────────────────────────────────────
const updates = [
  {
    date: "This week · April 7–11", type: "Builder update", typePill: "teal",
    title: "Drywall is going up and things are starting to look like rooms!",
    body: [
      "Great week at Maple Lane. The drywall crew finished hanging in the main living area, kitchen, and master bedroom. Taping and mudding starts Monday, which means primer by end of next week. You'll really start to see the spaces come together now.",
      "We also got the rough plumbing inspection passed on Thursday — everything is behind the walls and signed off. One less thing to think about.",
    ],
    photos: [
      { label: "Living room drywall", bg: "linear-gradient(135deg,#d4c5a9,#8b7a65)" },
      { label: "Kitchen framing + drywall", bg: "linear-gradient(135deg,#b0a090,#7a6a5a)" },
      { label: "Master bedroom walls", bg: "linear-gradient(135deg,#8a9a8a,#5a6a5a)" },
    ],
    morePhotos: 5,
  },
  {
    date: "April 3", type: "Milestone reached", typePill: "green",
    title: "Rough plumbing inspection passed",
    titleIcon: true,
    body: [
      "The city inspector signed off on all rough plumbing work. This means the water lines, drain connections, and gas piping behind your walls are officially approved. This was a key checkpoint before drywall could begin.",
    ],
  },
  {
    date: "March 31 – April 4", type: "Photo set", typePill: "blue",
    title: "Electrical rough-in and bathroom plumbing",
    body: [
      "Your builder shared 12 photos from this week's work — mostly electrical panel and bathroom plumbing progress.",
    ],
    photos: [
      { label: "Electrical panel", bg: "linear-gradient(135deg,#7a8b9a,#4a5a6a)" },
      { label: "Master bath plumbing", bg: "linear-gradient(135deg,#9a8b7a,#6a5b4a)" },
      { label: "Guest bath rough-in", bg: "linear-gradient(135deg,#8b9a80,#5a6950)" },
    ],
    morePhotos: 9,
  },
  {
    date: "March 24–28", type: "Builder update", typePill: "teal",
    title: "Framing complete — ready for rough-in trades",
    body: [
      "All structural framing has been completed and passed inspection. The plumber and electrician are starting next week. We've also confirmed your countertop selection with the fabricator — lead time is 3 weeks, so we're right on schedule for install after drywall.",
    ],
    photos: [
      { label: "Full kitchen framing", bg: "linear-gradient(135deg,#c0b0a0,#8a7a6a)" },
      { label: "Hallway framing", bg: "linear-gradient(135deg,#a09888,#706858)" },
      { label: "Bathroom framing", bg: "linear-gradient(135deg,#90a090,#607060)" },
    ],
    morePhotos: 4,
  },
];

// ── Photo Gallery Data ──────────────────────────────────────────
const photoFilters = ["All rooms", "Kitchen", "Living room", "Master suite", "Bathrooms", "Exterior"];
const photoSets = [
  { header: "This week · April 7–11", count: 8, photos: [
    { label: "Living room drywall", bg: "linear-gradient(135deg,#d4c5a9,#8b7a65)" },
    { label: "Kitchen drywall", bg: "linear-gradient(135deg,#b0a090,#7a6a5a)" },
    { label: "Master bedroom", bg: "linear-gradient(135deg,#8a9a8a,#5a6a5a)" },
    { label: "Hallway progress", bg: "linear-gradient(135deg,#a09080,#706050)" },
  ]},
  { header: "March 31 – April 4", count: 12, photos: [
    { label: "Electrical panel", bg: "linear-gradient(135deg,#7a8b9a,#4a5a6a)" },
    { label: "Master bath plumbing", bg: "linear-gradient(135deg,#9a8b7a,#6a5b4a)" },
    { label: "Guest bath rough-in", bg: "linear-gradient(135deg,#8b9a80,#5a6950)" },
    { label: "Laundry room wiring", bg: "linear-gradient(135deg,#7a8a7a,#4a5a4a)" },
  ]},
];

// ── Document Data ───────────────────────────────────────────────
const docCategories = [
  { id: "all", label: "All files", count: 14 },
  { id: "contract", label: "Contract & agreement", count: 3 },
  { id: "drawings", label: "Drawings & plans", count: 4 },
  { id: "permits", label: "Permits", count: 2 },
  { id: "selections", label: "Selections", count: 2 },
  { id: "yours", label: "Your uploads", count: 3 },
];

const builderDocs = [
  { name: "Renovation Contract — 14 Maple Lane.pdf", cat: "Contract & agreement", date: "Shared Feb 8", size: "2.4 MB", icon: "pdf" },
  { name: "Scope of Work — Full Interior Renovation.pdf", cat: "Contract & agreement", date: "Shared Feb 8", size: "1.8 MB", icon: "pdf" },
  { name: "Floor Plan — Proposed Layout (Rev 3).pdf", cat: "Drawings & plans", date: "Shared Feb 12", size: "5.1 MB", icon: "dwg" },
  { name: "Electrical Plan — Kitchen & Living Room.pdf", cat: "Drawings & plans", date: "Shared Mar 1", size: "3.2 MB", icon: "dwg" },
  { name: "Plumbing Layout — Master & Guest Baths.pdf", cat: "Drawings & plans", date: "Shared Mar 1", size: "2.7 MB", icon: "dwg" },
  { name: "Kitchen Cabinet Elevations — Final.pdf", cat: "Drawings & plans", date: "Shared Mar 15", size: "4.0 MB", icon: "dwg" },
  { name: "Building Permit — Residential Interior Renovation.pdf", cat: "Permits", date: "Shared Feb 20", size: "890 KB", icon: "pdf" },
  { name: "Electrical Permit — Panel Upgrade.pdf", cat: "Permits", date: "Shared Mar 4", size: "640 KB", icon: "pdf" },
  { name: "Countertop Selection Confirmation — Carrara Quartz.pdf", cat: "Selections", date: "Shared Apr 5", size: "320 KB", icon: "pdf" },
  { name: "Change Order Agreement — Scope Change SC-001.pdf", cat: "Contract & agreement", date: "Shared Mar 20", size: "180 KB", icon: "pdf" },
  { name: "Tile Selection Confirmation — Master Bath.pdf", cat: "Selections", date: "Shared Apr 8", size: "450 KB", icon: "pdf" },
];

const ownerDocs = [
  { name: "Homeowner Insurance Certificate — State Farm.pdf", date: "Uploaded Mar 2", size: "1.1 MB", status: "Accepted" },
  { name: "HOA Approval Letter — Renovation Permit.pdf", date: "Uploaded Feb 15", size: "540 KB", status: "Accepted" },
  { name: "Construction Loan Pre-Approval — First National.pdf", date: "Uploaded Feb 10", size: "780 KB", status: "Accepted" },
];

// ── Budget Data ─────────────────────────────────────────────────
const budgetStats = [
  { label: "Base contract", value: "$285,000" },
  { label: "Selection upgrades", value: "+$3,200", color: "var(--wr-t)" },
  { label: "Scope changes approved", value: "$0" },
  { label: "Paid to date", value: "$171,000", color: "var(--ok-t)" },
  { label: "Remaining balance", value: "$117,200" },
];

const paymentTimeline = [
  { date: "Feb 8", title: "Contract signing deposit", desc: "Initial deposit upon contract execution", amount: "$28,500", paid: true },
  { date: "Feb 22", title: "Demo completion", desc: "All demolition and debris removal complete", amount: "$28,500", paid: true },
  { date: "Mar 8", title: "Framing completion", desc: "Structural framing passed inspection", amount: "$57,000", paid: true },
  { date: "Mar 28", title: "Rough-in completion", desc: "Plumbing, electrical, and HVAC rough-in inspected", amount: "$57,000", paid: true },
  { date: "~Apr 22", title: "Drywall completion", desc: "Hang, tape, mud, and primer complete", amount: "$42,800", paid: false, opacity: 0.6 },
  { date: "~May 15", title: "Cabinet & tile install", desc: "Kitchen cabinets and bathroom tile complete", amount: "$42,800", paid: false, opacity: 0.4 },
  { date: "~Jun 5", title: "Final walkthrough", desc: "Punch list items addressed, project handover", amount: "$31,600", paid: false, opacity: 0.3 },
];

const selectionsImpact = [
  { name: "Countertops", status: "Confirmed", statusType: "green", amount: "+$1,800", type: "over" },
  { name: "Master bath tile", status: "Confirmed", statusType: "green", amount: "+$950", type: "over" },
  { name: "Cabinet hardware", status: "Confirmed", statusType: "green", amount: "+$450", type: "over" },
  { name: "Flooring", status: "Pending", statusType: "amber", amount: "TBD", type: "even" },
  { name: "Light fixtures", status: "Pending", statusType: "amber", amount: "TBD", type: "even" },
  { name: "Paint colors", status: "Pending", statusType: "amber", amount: "No cost impact", type: "under" },
];

// ── Component ───────────────────────────────────────────────────
export default function ResidentialClientPortal() {
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState("progress");
  const [collapsed, setCollapsed] = useState({});
  const [photoFilter, setPhotoFilter] = useState("All rooms");
  const [docCat, setDocCat] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  const toggleSection = (s) => setCollapsed((c) => ({ ...c, [s]: !c[s] }));
  const pageNames = { progress: "Progress & Photos", documents: "Documents", budget: "Budget" };

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={`rc ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.rc{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;--ti:#faf9f7;
  --ac:#2a7f6f;--ac-h:#1d6b5d;--ac-s:#e6f5f2;--ac-t:#1d6b5d;--ac-m:#8ac4b4;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 8px 32px rgba(26,23,20,.1);--shri:0 0 0 3px rgba(42,127,111,.15);
  --sbw:256px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.rc.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 8px 32px rgba(0,0,0,.35);--shri:0 0 0 3px rgba(61,168,142,.2);
}
*,*::before,*::after{box-sizing:border-box;margin:0}

/* ── Sidebar ───────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 16px 0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.brand-ctx{font-size:11.5px;color:var(--t3);line-height:1.2;margin-top:1px}

.sb-wc{margin:12px 12px 0;padding:16px;border:1px solid var(--s3);border-radius:var(--r-l);background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%)}
.sb-wc h4{font-family:var(--fd);font-size:13px;font-weight:650;margin-bottom:4px}
.sb-wc p{font-size:12px;color:var(--t2);line-height:1.4}

.s-nav{flex:1;overflow-y:auto;padding:12px 12px 24px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns{margin-bottom:4px}
.ns-h{display:flex;align-items:center;gap:8px;padding:8px;font-family:var(--fd);font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;cursor:pointer;border-radius:var(--r-s);user-select:none}
.ns-h:hover{background:var(--sh)}
.ns-chv{width:14px;height:14px;transition:transform var(--dn) var(--e);flex-shrink:0}
.ns.closed .ns-chv{transform:rotate(-90deg)}
.ni{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px 6px 12px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;transition:all var(--df) var(--e);margin-bottom:1px;position:relative}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--sa);color:var(--t1);font-weight:620}
.ni.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--ac)}
.ni-b{min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}
.ni-b.amber{background:var(--wr-s);color:var(--wr-t)}

.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:12px;padding:8px}
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#2a7f6f,#4caf7a);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:640}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

/* ── Main ──────────────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(238,240,243,.85);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.rc.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3);letter-spacing:-.01em}
.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;position:relative;transition:all var(--df) var(--e)}
.ib:hover{border-color:var(--s4);color:var(--t2)}
.nd::after{content:'';position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--ac);border:2px solid var(--s1)}
.av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2a7f6f,#4caf7a);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700}
.ct{padding:24px;flex:1}

/* Page switcher */
.ps{display:flex;gap:8px;margin-bottom:20px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:4px;width:fit-content}
.ps button{height:34px;padding:0 16px;border:none;border-radius:var(--r-m);font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t2);cursor:pointer;background:transparent;transition:all var(--df) var(--e);white-space:nowrap}
.ps button:hover{color:var(--t1);background:var(--sh)}
.ps button.on{background:var(--ac);color:#fff;font-weight:620;box-shadow:0 1px 4px rgba(42,127,111,.25)}

/* Shared */
.pg-t{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15}
.pg-sub{margin-top:4px;font-size:13.5px;color:var(--t2);line-height:1.5}
.pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.red{background:var(--dg-s);color:var(--dg-t)}.pl.amber{background:var(--wr-s);color:var(--wr-t)}
.pl.green{background:var(--ok-s);color:var(--ok-t)}.pl.blue{background:var(--in-s);color:var(--in-t)}
.pl.teal{background:var(--ac-s);color:var(--ac-t)}.pl.gray{background:var(--s2);color:var(--t2)}
.pl.mini{height:18px;font-size:10px;padding:0 6px}
.btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t1);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}
.btn.pri:hover{background:var(--ac-h)}
.btn.sm{height:28px;padding:0 10px;font-size:12px;border-radius:var(--r-s)}
.btn svg{width:14px;height:14px;flex-shrink:0}
.card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.c-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
.c-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em}
.c-sub{font-size:12.5px;color:var(--t2);margin-top:2px}
.c-body{padding:16px 20px}

/* ── Progress Page ────────────────────────────────── */
.phase-hero{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px;margin-bottom:20px}
.phase-lbl{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:16px}
.phase-track{display:flex;gap:6px}
.ph-i{flex:1;text-align:center}
.ph-bar{height:6px;border-radius:3px;margin-bottom:8px}
.ph-i.done .ph-bar{background:var(--ac)}
.ph-i.current .ph-bar{background:linear-gradient(90deg,var(--ac) 65%,var(--s3) 65%)}
.ph-i.upcoming .ph-bar{background:var(--s3)}
.ph-nm{font-family:var(--fd);font-size:12px;font-weight:580;color:var(--t2)}
.ph-i.current .ph-nm{color:var(--t1);font-weight:680}
.ph-i.done .ph-nm{color:var(--ac-t)}

/* Update stream */
.us{display:flex;flex-direction:column;gap:16px}
.uc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;transition:box-shadow var(--dn)}
.uc:hover{box-shadow:var(--shmd)}
.uc-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
.uc-date{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t1)}
.uc-body{padding:20px}
.uc-title{font-family:var(--fd);font-size:16px;font-weight:700;letter-spacing:-.01em;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.uc-body p{color:var(--t2);line-height:1.6;margin-bottom:12px}
.uc-body p:last-of-type{margin-bottom:0}

/* Update photos */
.uc-photos{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}
.uc-ph{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;cursor:pointer;transition:transform var(--df) var(--e)}
.uc-ph:hover{transform:scale(1.02)}
.uc-ph-inner{width:100%;height:100%;display:flex;align-items:flex-end;padding:8px}
.uc-ph-lbl{font-size:11px;font-weight:600;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5);background:rgba(0,0,0,.3);padding:2px 8px;border-radius:var(--r-s)}
.uc-more{aspect-ratio:4/3;border-radius:var(--r-m);background:var(--s2);display:grid;place-items:center;font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t2);cursor:pointer;transition:background var(--df)}
.uc-more:hover{background:var(--s3)}

/* Photo gallery */
.pg-gallery{margin-top:24px}
.pg-gal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.pg-stats{display:flex;gap:20px;font-size:13px;color:var(--t2);margin-top:4px}
.pg-stats strong{color:var(--t1);font-weight:650}
.pf-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.pf{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12px;font-weight:560;color:var(--t2);cursor:pointer;transition:all var(--df);display:inline-flex;align-items:center}
.pf:hover{border-color:var(--s4);color:var(--t1)}
.pf.on{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}
.ps-section{margin-bottom:20px}
.ps-head{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t2);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.ps-cnt{font-size:11px;color:var(--t3);font-weight:520}
.ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ph-cell{aspect-ratio:4/3;border-radius:var(--r-l);overflow:hidden;cursor:pointer;transition:transform var(--df) var(--e)}
.ph-cell:hover{transform:scale(1.02)}
.ph-cell-inner{width:100%;height:100%;display:flex;align-items:flex-end;padding:12px}
.ph-cell-lbl{font-size:11.5px;font-weight:600;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5);background:rgba(0,0,0,.25);backdrop-filter:blur(4px);padding:3px 10px;border-radius:var(--r-s)}

/* ── Documents Page ───────────────────────────────── */
.upz{border:2px dashed var(--s3);border-radius:var(--r-xl);padding:32px 20px;text-align:center;background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%);cursor:pointer;transition:all var(--dn) var(--e);margin-bottom:20px}
.upz:hover{border-color:var(--ac);background:var(--ac-s)}
.upz-icon{width:48px;height:48px;border-radius:50%;background:var(--ac-s);display:grid;place-items:center;margin:0 auto 12px;color:var(--ac)}
.upz h4{font-family:var(--fd);font-size:15px;font-weight:680;margin-bottom:4px}
.upz p{font-size:13px;color:var(--t2)}
.upz-hints{display:flex;gap:16px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.upz-hints span{font-size:11.5px;color:var(--t3);display:flex;align-items:center;gap:4px}

.doc-lay{display:grid;grid-template-columns:220px 1fr;gap:20px}
.doc-cats{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px;align-self:start;position:sticky;top:calc(var(--tbh) + 24px)}
.dc-title{font-family:var(--fd);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:8px;margin-bottom:4px}
.dc{padding:8px 12px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:all var(--df);margin-bottom:1px}
.dc:hover{background:var(--sh);color:var(--t1)}
.dc.on{background:var(--sa);color:var(--t1);font-weight:620}
.dc .cnt{font-size:11px;color:var(--t3);font-weight:600;font-family:var(--fd)}

.doc-list{display:flex;flex-direction:column;gap:8px}
.dr{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);transition:all var(--df);cursor:pointer}
.dr:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.dr.owner{border-color:var(--ac-s);background:linear-gradient(90deg,var(--ac-s) 0%,var(--s1) 40%)}
.di{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0;font-size:11px;font-weight:700;font-family:var(--fd)}
.di.pdf{background:var(--dg-s);color:var(--dg-t)}
.di.dwg{background:var(--in-s);color:var(--in-t)}
.d-info{flex:1;min-width:0}
.d-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.d-meta{font-size:11.5px;color:var(--t3);margin-top:1px;display:flex;gap:12px;align-items:center}
.d-acts{display:flex;gap:8px;flex-shrink:0;align-items:center}

.you-up{margin-top:20px;padding-top:20px;border-top:2px solid var(--ac-s)}
.you-up-lbl{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--ac-t);margin-bottom:12px;display:flex;align-items:center;gap:8px}

.doc-req{margin-top:20px;padding:16px;background:var(--wr-s);border:1px solid rgba(193,122,26,.15);border-radius:var(--r-l)}
.doc-req-title{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--wr-t);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.doc-req-row{display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--s1);border-radius:var(--r-m);gap:16px}

/* ── Budget Page ──────────────────────────────────── */
.bh{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
.bh-main{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px}
.bh-big{font-family:var(--fd);font-size:36px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.bh-lbl{font-size:14px;color:var(--t2);margin-top:4px}
.bp-bar{height:10px;background:var(--s3);border-radius:5px;overflow:hidden;display:flex;margin-top:20px}
.bp-seg{height:100%;transition:width var(--ds) var(--e)}
.bp-paid{background:var(--ac)}
.bp-next{background:var(--wr);opacity:.7}
.bp-leg{display:flex;gap:20px;margin-top:12px}
.bp-leg-i{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t2)}
.bp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

.bh-info{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;display:flex;flex-direction:column;justify-content:space-between}
.bh-info-title{font-family:var(--fd);font-size:15px;font-weight:680;margin-bottom:12px}
.bs-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--s3)}
.bs-row:last-child{border-bottom:none}
.bs-lbl{font-size:13px;color:var(--t2)}
.bs-val{font-family:var(--fd);font-size:14px;font-weight:700}

.np{background:linear-gradient(135deg,var(--ac-s) 0%,var(--s1) 60%);border:1px solid rgba(42,127,111,.2);border-radius:var(--r-xl);padding:20px;margin-bottom:20px}
.np-lbl{font-family:var(--fd);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--ac-t);margin-bottom:8px}
.np-amt{font-family:var(--fd);font-size:28px;font-weight:820;letter-spacing:-.02em}
.np-detail{font-size:13px;color:var(--t2);margin-top:8px;line-height:1.5}
.np-milestone{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:6px 12px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);font-size:12px;font-weight:580;color:var(--ac-t)}

.bud-grid{display:grid;grid-template-columns:1fr 380px;gap:20px}

/* Payment timeline */
.pt-row{display:grid;grid-template-columns:80px 1fr auto;gap:16px;padding:16px 0;border-bottom:1px solid var(--s3);align-items:center}
.pt-row:last-child{border-bottom:none}
.pt-date{font-family:var(--fd);font-size:12px;font-weight:600;color:var(--t2)}
.pt-desc h5{font-family:var(--fd);font-size:13px;font-weight:620;margin-bottom:2px}
.pt-desc p{font-size:12px;color:var(--t2)}
.pt-amt{font-family:var(--fd);font-size:14px;font-weight:700;text-align:right}
.pt-amt.paid{color:var(--ok-t)}
.pt-amt.up{color:var(--t2)}

/* Selections impact */
.si-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--s3)}
.si-row:last-child{border-bottom:none}
.si-name{font-size:13px;display:flex;align-items:center;gap:8px}
.si-amt{font-family:var(--fd);font-size:13px;font-weight:700}
.si-amt.over{color:var(--wr-t)}.si-amt.under{color:var(--ok-t)}.si-amt.even{color:var(--t3)}
.si-total{margin-top:0;padding:16px 16px 0;border-top:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between}
.si-total-lbl{font-family:var(--fd);font-size:13px;font-weight:680}
.si-total-val{font-family:var(--fd);font-size:15px;font-weight:700;color:var(--wr-t)}

.bud-tip{margin-top:16px;padding:16px;background:var(--ac-s);border:1px solid rgba(42,127,111,.15);border-radius:var(--r-l)}
.bud-tip-title{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--ac-t);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.bud-tip p{font-size:12.5px;color:var(--t2);line-height:1.55}

/* ── Lightbox ─────────────────────────────────────── */
.lb{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:rgba(0,0,0,.85);backdrop-filter:blur(8px)}
.lb-close{position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.12);border:none;cursor:pointer;display:grid;place-items:center;color:#fff;transition:background var(--df)}
.lb-close:hover{background:rgba(255,255,255,.25)}
.lb-img{max-width:85vw;max-height:80vh;border-radius:var(--r-l);overflow:hidden}
.lb-img-inner{width:100%;height:100%;min-width:500px;min-height:360px;display:flex;align-items:flex-end;padding:20px}
.lb-lbl{font-size:14px;font-weight:600;color:#fff;background:rgba(0,0,0,.4);backdrop-filter:blur(6px);padding:6px 16px;border-radius:var(--r-m)}

/* ── Responsive ───────────────────────────────────── */
@media(max-width:1280px){
  .bh{grid-template-columns:1fr}
  .ph-grid{grid-template-columns:repeat(3,1fr)}
  .uc-photos{grid-template-columns:repeat(3,1fr)}
  .doc-lay{grid-template-columns:1fr}
  .bud-grid{grid-template-columns:1fr}
}
@media(max-width:900px){
  .rc{grid-template-columns:1fr}
  .side{display:none}
  .ph-grid{grid-template-columns:repeat(2,1fr)}
  .uc-photos{grid-template-columns:repeat(2,1fr)}
}

/* ── Fade in ──────────────────────────────────────── */
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">Your Home</div>
          </div>
        </div>

        <div className="sb-wc">
          <h4>Hi Jennifer</h4>
          <p>3 selections ready for you and a new photo set from this week.</p>
        </div>

        <nav className="s-nav">
          {sidebarSections.map((sec) => (
            <div className={`ns${collapsed[sec.label] ? " closed" : ""}`} key={sec.label}>
              <div className="ns-h" onClick={() => toggleSection(sec.label)}>
                <span className="ns-chv">{I.chev}</span>{sec.label}
              </div>
              {!collapsed[sec.label] && (
                <div>
                  {sec.items.map((it) => (
                    <div
                      key={it.label}
                      className={`ni${it.page && it.page === page ? " on" : ""}`}
                      onClick={() => it.page && it.page !== "home" && setPage(it.page)}
                    >
                      <span>{it.label}</span>
                      {it.badge && <span className={`ni-b ${it.badgeType}`}>{it.badge}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="s-foot">
          <div className="s-user">
            <div className="u-av">JC</div>
            <div>
              <div className="u-name">Jennifer Chen</div>
              <div className="u-role">Homeowner</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>Your Home</span><span className="sep">›</span>
            <span>14 Maple Lane</span><span className="sep">›</span>
            <span className="cur">{pageNames[page]}</span>
          </div>
          <div className="tb-acts">
            <div className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</div>
            <div className="ib nd">{I.bell}</div>
            <div className="av" style={{ marginLeft: 4 }}>JC</div>
          </div>
        </div>

        <div className="ct">
          {/* Page switcher */}
          <div className="ps">
            {Object.entries(pageNames).map(([k, v]) => (
              <button key={k} className={page === k ? "on" : ""} onClick={() => setPage(k)}>{v}</button>
            ))}
          </div>

          {/* ═══════════════════ PROGRESS & PHOTOS ═══════════════════ */}
          {page === "progress" && (
            <div className="fade-up">
              <div style={{ marginBottom: 20 }}>
                <div className="pg-t">Progress & Photos</div>
                <div className="pg-sub">See what's been happening at your home this week and browse all your project photos.</div>
              </div>

              {/* Phase timeline hero */}
              <div className="phase-hero">
                <div className="phase-lbl">Where your project stands</div>
                <div className="phase-track">
                  {phases.map((ph) => (
                    <div className={`ph-i ${ph.status}`} key={ph.name}>
                      <div className="ph-bar" />
                      <div className="ph-nm">{ph.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Update stream */}
              <div className="us">
                {updates.map((u, i) => (
                  <div className="uc" key={i}>
                    <div className="uc-head">
                      <div className="uc-date">{u.date}</div>
                      <span className={`pl ${u.typePill}`}>{u.type}</span>
                    </div>
                    <div className="uc-body">
                      <div className="uc-title">
                        {u.title}
                        {u.titleIcon && <span style={{ display: "inline-flex" }}>{I.check}</span>}
                      </div>
                      {u.body.map((p, j) => <p key={j}>{p}</p>)}
                      {u.photos && (
                        <div className="uc-photos">
                          {u.photos.map((ph, k) => (
                            <div className="uc-ph" key={k} onClick={() => setLightbox(ph)}>
                              <div className="uc-ph-inner" style={{ background: ph.bg }}>
                                <span className="uc-ph-lbl">{ph.label}</span>
                              </div>
                            </div>
                          ))}
                          {u.morePhotos && (
                            <div className="uc-more">+{u.morePhotos} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Full photo gallery */}
              <div className="pg-gallery">
                <div className="pg-gal-head">
                  <div>
                    <div className="c-title" style={{ marginBottom: 4 }}>All project photos</div>
                    <div className="pg-stats">
                      <span><strong>47</strong> photos</span>
                      <span><strong>6</strong> sets</span>
                      <span>Since <strong>Feb 12</strong></span>
                    </div>
                  </div>
                  <button className="btn sm">{I.download} Download all</button>
                </div>

                <div className="pf-bar">
                  {photoFilters.map((f) => (
                    <button key={f} className={`pf${photoFilter === f ? " on" : ""}`} onClick={() => setPhotoFilter(f)}>{f}</button>
                  ))}
                </div>

                {photoSets.map((set, i) => (
                  <div className="ps-section" key={i}>
                    <div className="ps-head">{set.header} <span className="ps-cnt">{set.count} photos</span></div>
                    <div className="ph-grid">
                      {set.photos.map((ph, j) => (
                        <div className="ph-cell" key={j} onClick={() => setLightbox(ph)}>
                          <div className="ph-cell-inner" style={{ background: ph.bg }}>
                            <span className="ph-cell-lbl">{ph.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════ DOCUMENTS ═══════════════════ */}
          {page === "documents" && (
            <div className="fade-up">
              <div style={{ marginBottom: 20 }}>
                <div className="pg-t">Documents</div>
                <div className="pg-sub">Important files for your project. Your builder shares key documents here, and you can upload things they've asked for too.</div>
              </div>

              {/* Upload zone */}
              <div className="upz">
                <div className="upz-icon">{I.upload}</div>
                <h4>Upload your documents</h4>
                <p>Drag and drop files here, or click to browse</p>
                <div className="upz-hints">
                  <span>{I.file} PDF, JPG, PNG</span>
                  <span>Max 25 MB per file</span>
                </div>
              </div>

              <div className="doc-lay">
                {/* Category sidebar */}
                <div className="doc-cats">
                  <div className="dc-title">Categories</div>
                  {docCategories.map((c) => (
                    <div key={c.id} className={`dc${docCat === c.id ? " on" : ""}`} onClick={() => setDocCat(c.id)}>
                      {c.label} <span className="cnt">{c.count}</span>
                    </div>
                  ))}
                </div>

                {/* File list */}
                <div>
                  <div style={{ fontFamily: "var(--fd)", fontSize: 13, fontWeight: 650, color: "var(--t2)", marginBottom: 12 }}>Shared by your builder</div>
                  <div className="doc-list">
                    {builderDocs.map((d, i) => (
                      <div className="dr" key={i}>
                        <div className={`di ${d.icon}`}>{d.icon === "pdf" ? "PDF" : "DWG"}</div>
                        <div className="d-info">
                          <div className="d-name">{d.name}</div>
                          <div className="d-meta">
                            <span>{d.cat}</span><span>·</span><span>{d.date}</span><span>·</span><span>{d.size}</span>
                          </div>
                        </div>
                        <div className="d-acts"><button className="btn sm">View</button></div>
                      </div>
                    ))}
                  </div>

                  {/* Your uploads */}
                  <div className="you-up">
                    <div className="you-up-lbl">{I.uploadSm} Uploaded by you</div>
                    <div className="doc-list">
                      {ownerDocs.map((d, i) => (
                        <div className="dr owner" key={i}>
                          <div className="di pdf">PDF</div>
                          <div className="d-info">
                            <div className="d-name">{d.name}</div>
                            <div className="d-meta">
                              <span>Your uploads</span><span>·</span><span>{d.date}</span><span>·</span><span>{d.size}</span>
                            </div>
                          </div>
                          <div className="d-acts"><span className="pl green">{d.status}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requested uploads callout */}
                  <div className="doc-req">
                    <div className="doc-req-title">{I.warn} Your builder is waiting for 1 document</div>
                    <div className="doc-req-row">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Updated insurance certificate</div>
                        <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}>Your current policy expires April 30 — please upload the renewal</div>
                      </div>
                      <button className="btn pri sm">Upload now</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ BUDGET ═══════════════════ */}
          {page === "budget" && (
            <div className="fade-up">
              <div style={{ marginBottom: 20 }}>
                <div className="pg-t">Your Budget</div>
                <div className="pg-sub">Here's a clear picture of what your project costs, what you've paid, and what's coming up next.</div>
              </div>

              {/* Budget hero */}
              <div className="bh">
                <div className="bh-main">
                  <div className="bh-lbl" style={{ fontSize: 14, color: "var(--t2)" }}>Current project total</div>
                  <div className="bh-big">$288,200</div>
                  <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 8 }}>Base contract $285,000 + $3,200 in selection upgrades</div>
                  <div style={{ marginTop: 20 }}>
                    <div className="bp-bar">
                      <div className="bp-seg bp-paid" style={{ width: "59%" }} />
                      <div className="bp-seg bp-next" style={{ width: "15%" }} />
                    </div>
                    <div className="bp-leg">
                      <div className="bp-leg-i"><div className="bp-dot" style={{ background: "var(--ac)" }} />Paid · $171,000</div>
                      <div className="bp-leg-i"><div className="bp-dot" style={{ background: "var(--wr)", opacity: .7 }} />Next payment · $42,800</div>
                      <div className="bp-leg-i"><div className="bp-dot" style={{ background: "var(--s3)" }} />Remaining · $74,400</div>
                    </div>
                  </div>
                </div>

                <div className="bh-info">
                  <div className="bh-info-title">Quick numbers</div>
                  {budgetStats.map((s, i) => (
                    <div className="bs-row" key={i}>
                      <span className="bs-lbl">{s.label}</span>
                      <span className="bs-val" style={s.color ? { color: s.color } : {}}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next payment callout */}
              <div className="np">
                <div className="np-lbl">Your next payment</div>
                <div className="np-amt">$42,800</div>
                <div className="np-detail">This payment is tied to the <strong>drywall completion</strong> milestone. Once your builder confirms the milestone is complete, you'll receive a notification to review and approve the payment.</div>
                <div className="np-milestone">{I.check} Estimated: April 21–25</div>
              </div>

              {/* Payment history + Selections impact */}
              <div className="bud-grid">
                {/* Payment history */}
                <div className="card">
                  <div className="c-head">
                    <div>
                      <div className="c-title">Payment history</div>
                      <div className="c-sub">Milestone-based payments you've made so far</div>
                    </div>
                  </div>
                  <div className="c-body">
                    {paymentTimeline.map((pt, i) => (
                      <div className="pt-row" key={i} style={pt.opacity ? { opacity: pt.opacity } : {}}>
                        <div className="pt-date">{pt.date}</div>
                        <div className="pt-desc">
                          <h5>{pt.title}</h5>
                          <p>{pt.desc}</p>
                        </div>
                        <div className={`pt-amt ${pt.paid ? "paid" : "up"}`}>{pt.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selections & budget */}
                <div>
                  <div className="card">
                    <div className="c-head">
                      <div>
                        <div className="c-title">Selections & your budget</div>
                        <div className="c-sub">How your choices compare to allowances</div>
                      </div>
                    </div>
                    <div className="c-body">
                      <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16, lineHeight: 1.5 }}>
                        Your contract includes allowances for certain items. When you pick something above or below the allowance, the difference shows up here.
                      </div>
                      <div>
                        {selectionsImpact.map((s, i) => (
                          <div className="si-row" key={i}>
                            <div className="si-name">
                              <span className={`pl mini ${s.statusType}`}>{s.status}</span>
                              {s.name}
                            </div>
                            <div className={`si-amt ${s.type}`}>{s.amount}</div>
                          </div>
                        ))}
                      </div>
                      <div className="si-total">
                        <span className="si-total-lbl">Net selections impact</span>
                        <span className="si-total-val">+$3,200</span>
                      </div>
                    </div>
                  </div>

                  {/* Budget tip */}
                  <div className="bud-tip">
                    <div className="bud-tip-title">{I.bulb} How payments work</div>
                    <p>Your payments are tied to project milestones — not a fixed schedule. When your builder completes a milestone, they'll submit a payment request. You'll be notified to review and approve it before any money moves.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Lightbox ────────────────────────────────── */}
      {lightbox && (
        <div className="lb" onClick={() => setLightbox(null)}>
          <button className="lb-close" onClick={() => setLightbox(null)}>{I.x}</button>
          <div className="lb-img" onClick={(e) => e.stopPropagation()}>
            <div className="lb-img-inner" style={{ background: lightbox.bg }}>
              <span className="lb-lbl">{lightbox.label}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
