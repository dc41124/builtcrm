import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  chev: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  chevL: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevR: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  cloud: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  cloudRain: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25"/></svg>,
  cloudSun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2M5.64 5.64l1.41 1.41M2 12h2M20 12h2M17 5.64l-1.41 1.41M5 16a5 5 0 108-4"/></svg>,
  camera: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

// ── Logo Mark ───────────────────────────────────────────────────
const Logo = ({ s = 30 }) => (
  <div style={{ width: s, height: s, borderRadius: s * 0.27, background: "linear-gradient(135deg,#1f4d73,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.6} height={s * 0.6}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Sidebar Nav Data ────────────────────────────────────────────
const navSections = [
  { title: "Overview", items: [
    { label: "Project Home" },
    { label: "Progress & Milestones" },
  ]},
  { title: "Records", items: [
    { label: "Project Log", active: true },
    { label: "Documents" },
    { label: "Photos" },
  ]},
  { title: "Decisions", items: [
    { label: "Approvals", badge: 2, badgeType: "warn" },
    { label: "Change Orders", badge: 1 },
  ]},
  { title: "Financial", items: [
    { label: "Billing & Draws" },
    { label: "Payments" },
  ]},
  { title: "Communication", items: [
    { label: "Messages", badge: 3 },
  ]},
];

// ── Page Data ───────────────────────────────────────────────────
const project = { name: "Riverside Tower Fit-Out", id: "PRJ-0042", phase: "Phase 3 — Interior Rough-in", startDate: "Jan 8, 2026", targetComplete: "Sep 30, 2026" };

// Current month calendar — Apr 2026. st: 0 = no work day, 1 = logged, 2 = no log posted, 3 = today
const calendarDays = [
  { d: 29, m: "prev" }, { d: 30, m: "prev" }, { d: 31, m: "prev" },
  { d: 1, st: 1 }, { d: 2, st: 1 }, { d: 3, st: 1 }, { d: 4, st: 0 },
  { d: 5, st: 0 }, { d: 6, st: 1 }, { d: 7, st: 1 }, { d: 8, st: 1 }, { d: 9, st: 1 }, { d: 10, st: 1 }, { d: 11, st: 0 },
  { d: 12, st: 0 }, { d: 13, st: 1 }, { d: 14, st: 1 }, { d: 15, st: 1 }, { d: 16, st: 1 }, { d: 17, st: 1 }, { d: 18, st: 3 },
  { d: 19, st: 0 }, { d: 20, st: 0 }, { d: 21, st: 0 }, { d: 22, st: 0 }, { d: 23, st: 0 }, { d: 24, st: 0 }, { d: 25, st: 0 },
  { d: 26, st: 0 }, { d: 27, st: 0 }, { d: 28, st: 0 }, { d: 29, st: 0 }, { d: 30, st: 0 },
];

// Redacted client-view logs — no crew hours, no org details. Just date, weather, work narrative, photos.
const recentLogs = [
  {
    id: "DL-0078",
    dateLabel: "Wed, Apr 17",
    dateFull: "Wednesday, April 17, 2026",
    weather: { icon: "sun", conditions: "Sunny", high: "16°C", low: "9°C", precip: "0%" },
    summary: "East corridor electrical rough-in was completed on schedule, with all branch circuits terminated and ready for inspection Friday. Plumbing installation began on floors 3 and 4 following the approved revised routing. Mechanical trunk lines were set in the corridor ceiling, with insulation to follow next week. Drywall delivery was received and staged on floor 2.",
    milestone: "Electrical pre-inspection prepared",
    milestoneType: "ok",
    photos: 8,
    highlights: ["East corridor electrical complete", "Floors 3 & 4 plumbing started", "Mechanical trunk lines set"],
  },
  {
    id: "DL-0077",
    dateLabel: "Tue, Apr 16",
    dateFull: "Tuesday, April 16, 2026",
    weather: { icon: "cloud", conditions: "Overcast", high: "12°C", low: "7°C", precip: "15%" },
    summary: "Electrical rough-in continued in the east corridor. Drywall delivery was received mid-morning and staged. A brief weather delay occurred on exterior caulking work during afternoon rainfall; work resumed the same day with no schedule impact.",
    milestone: null,
    photos: 6,
    highlights: ["Electrical rough-in progress", "Weather delay: 1.5 hrs exterior caulking"],
    weatherNote: true,
  },
  {
    id: "DL-0076",
    dateLabel: "Mon, Apr 15",
    dateFull: "Monday, April 15, 2026",
    weather: { icon: "rain", conditions: "Light rain", high: "10°C", low: "6°C", precip: "85%" },
    summary: "Interior-only work day due to rainfall. The panel room electrical installation reached final termination. Drywall hanging progressed on the west wing, levels 2 and 3.",
    milestone: "Panel room electrical complete",
    milestoneType: "ok",
    photos: 5,
    highlights: ["Panel room electrical complete", "Drywall west wing L2–3"],
  },
  {
    id: "DL-0075",
    dateLabel: "Fri, Apr 12",
    dateFull: "Friday, April 12, 2026",
    weather: { icon: "sun", conditions: "Sunny", high: "18°C", low: "11°C", precip: "0%" },
    summary: "Full crew day across all trades. An inspector visit at 11 AM resulted in a passed panel room pre-inspection — a key milestone supporting Friday's planned formal inspection.",
    milestone: "Passed panel room pre-inspection",
    milestoneType: "ok",
    photos: 12,
    highlights: ["Inspector pre-inspection passed", "Full crew day — all trades active"],
  },
  {
    id: "DL-0074",
    dateLabel: "Thu, Apr 11",
    dateFull: "Thursday, April 11, 2026",
    weather: { icon: "cloudSun", conditions: "Partly cloudy", high: "15°C", low: "8°C", precip: "10%" },
    summary: "Concrete cure on the slab repair area completed overnight. Framing work continued on the west wing. A GC walkthrough in the afternoon identified 4 items for the project punch list — none affect the current schedule.",
    milestone: null,
    photos: 9,
    highlights: ["Slab repair cure complete", "West wing framing", "4 items added to punch list"],
  },
  {
    id: "DL-0073",
    dateLabel: "Wed, Apr 10",
    dateFull: "Wednesday, April 10, 2026",
    weather: { icon: "sun", conditions: "Sunny", high: "17°C", low: "10°C", precip: "0%" },
    summary: "Electrical rough-in began in the east corridor. HVAC coordination meeting concluded mid-morning, clearing the way for trunk line installation early next week.",
    milestone: null,
    photos: 7,
    highlights: ["East corridor electrical started", "HVAC coordination closed"],
  },
];

// Detail log opened by default in prototype
const detailLog = recentLogs[0];

// Weather icon helper
const weatherIcon = (k) => k === "rain" ? I.cloudRain : k === "cloud" ? I.cloud : k === "cloudSun" ? I.cloudSun : I.sun;

// ── Component ───────────────────────────────────────────────────
export default function CommercialClientDailyLogs() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("calendar"); // calendar | list
  const [selected, setSelected] = useState(detailLog);
  const [photoModal, setPhotoModal] = useState(null); // null | photo index
  const [collapsed, setCollapsed] = useState({});

  const toggleSection = (title) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));

  return (
    <div className={`root ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.root{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sic:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;--ti:#faf9f7;
  --ac:#3178b9;--ac-h:#286399;--ac-s:#e5f0f9;--ac-t:#215489;--ac-m:#a7c5e0;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);--shlg:0 16px 48px rgba(26,23,20,.14);
  --sbw:260px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.root.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sic:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#5a9fd4;--ac-h:#6cb0e4;--ac-s:#162736;--ac-t:#8ac0e8;--ac-m:#2e4a66;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);--shlg:0 16px 48px rgba(0,0,0,.5);
}
*,*::before,*::after{box-sizing:border-box;margin:0}

/* ── Sidebar ─────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-txt h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.brand-txt p{font-size:11.5px;color:var(--t3);line-height:1.2;margin-top:1px}

.s-search{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0;position:relative}
.s-search svg{position:absolute;left:28px;top:50%;transform:translateY(-50%);color:var(--t3)}
.s-input{width:100%;height:34px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px 0 34px;background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.s-input:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(49,120,185,.15)}
.s-input::placeholder{color:var(--t3)}

.s-nav{flex:1;overflow-y:auto;padding:8px 12px 24px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

.ns{margin-bottom:4px}
.ns-h{display:flex;align-items:center;gap:6px;padding:8px;font-family:var(--fd);font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;cursor:pointer;border-radius:var(--r-s);user-select:none}
.ns-h:hover{background:var(--sh)}
.ns-chv{transition:transform var(--dn) var(--e)}
.ns-chv.closed{transform:rotate(-90deg)}

.ni{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px 6px 12px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;transition:all var(--df) var(--e);margin-bottom:1px;position:relative}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--s0);color:var(--t1);font-weight:620}
.ni.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--ac)}
.ni-badge{min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0;background:var(--ac-s);color:var(--ac-t)}
.ni-badge.warn{background:var(--wr-s);color:var(--wr-t)}
.ni-badge.danger{background:var(--dg-s);color:var(--dg-t)}

.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--r-m);cursor:pointer}
.s-user:hover{background:var(--sh)}
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#1f4d73);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:580}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

/* ── Main area ───────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.topbar{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(238,240,243,.85);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.root.dk .topbar{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:580;color:var(--t3)}
.bc .sep{color:var(--s4)}.bc .cur{color:var(--t1);font-weight:720}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;transition:all var(--df) var(--e);cursor:pointer}
.ib:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:720}

/* ── Content ─────────────────────────────────────── */
.ct{padding:24px;flex:1;overflow-y:auto}

/* Page header */
.ph-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:6px}
.ph-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;color:var(--t1)}
.ph-desc{font-size:13px;color:var(--t2);margin-top:4px;max-width:640px;font-weight:520;line-height:1.55}
.ph-actions{display:flex;gap:8px;flex-shrink:0}

.info-banner{display:flex;align-items:flex-start;gap:10px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-m);padding:10px 14px;margin:12px 0 20px;color:var(--ac-t);font-size:12.5px;font-weight:540;line-height:1.55}
.info-banner svg{flex-shrink:0;margin-top:2px}
.info-banner b{font-weight:680}

.btn{height:34px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:12.5px;font-weight:640;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);color:white;border-color:var(--ac)}
.btn.pri:hover{background:var(--ac-h)}
.btn.ghost{background:transparent;border-color:transparent;color:var(--t2)}
.btn.ghost:hover{background:var(--sh);color:var(--t1)}
.btn svg{width:14px;height:14px;flex-shrink:0}

/* View toggle */
.v-toggle{display:inline-flex;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:3px;gap:2px}
.v-btn{height:28px;padding:0 10px;border:none;background:none;font-family:var(--fb);font-size:12px;font-weight:600;color:var(--t2);display:inline-flex;align-items:center;gap:6px;border-radius:7px;cursor:pointer;transition:all var(--df) var(--e)}
.v-btn:hover{color:var(--t1)}
.v-btn.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.v-btn svg{width:13px;height:13px}

/* Project meta strip */
.meta-strip{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.meta-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:12px;color:var(--t2);font-weight:540}
.meta-chip strong{color:var(--t1);font-weight:660}
.meta-chip.phase{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}

/* Two-col layout */
.g{display:grid;grid-template-columns:1fr 380px;gap:16px;align-items:start}
.card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm)}
.card-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid var(--s3)}
.card-h h3{font-family:var(--fd);font-size:14px;font-weight:720;letter-spacing:-.005em;color:var(--t1)}
.card-h .card-sub{font-size:12px;color:var(--t3);margin-top:2px;font-weight:540}
.card-b{padding:16px 18px}

/* Calendar */
.cal{padding:14px 16px 16px}
.cal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.cal-month{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);letter-spacing:-.01em}
.cal-nav{display:flex;gap:4px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal-dow{font-family:var(--fd);font-size:10.5px;font-weight:720;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;text-align:center;padding:6px 0 2px}
.cal-cell{aspect-ratio:1/1;border:1px solid var(--s3);border-radius:var(--r-s);display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:5px 6px;font-size:12px;color:var(--t2);cursor:pointer;transition:all var(--df) var(--e);background:var(--s1);min-height:44px;position:relative;overflow:hidden}
.cal-cell .cd{font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t1)}
.cal-cell.prev{background:var(--sh);opacity:.35}
.cal-cell.prev .cd{color:var(--t3)}
.cal-cell.st-0{background:var(--sh)}
.cal-cell.st-0 .cd{color:var(--t3)}
.cal-cell.st-1{background:color-mix(in srgb,var(--ok) 10%,var(--s1));border-color:color-mix(in srgb,var(--ok) 30%,var(--s3))}
.cal-cell.st-1:hover{border-color:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 15%,transparent)}
.cal-cell.st-1 .dot{width:6px;height:6px;border-radius:50%;background:var(--ok)}
.cal-cell.st-1.on{border-color:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 25%,transparent);background:color-mix(in srgb,var(--ok) 16%,var(--s1))}
.cal-cell.st-2{background:color-mix(in srgb,var(--dg) 8%,var(--s1));border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
.cal-cell.st-2 .dot{width:6px;height:6px;border-radius:50%;background:var(--dg)}
.cal-cell.st-3{background:var(--ac-s);border-color:var(--ac);box-shadow:0 0 0 2px color-mix(in srgb,var(--ac) 25%,transparent)}
.cal-cell.st-3 .cd{color:var(--ac-t);font-weight:720}
.cal-cell.st-3 .today-tag{font-family:var(--fd);font-size:9px;font-weight:720;color:var(--ac-t);text-transform:uppercase;letter-spacing:.04em;line-height:1}

.cal-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--s3);font-size:11.5px;color:var(--t2);font-weight:540}
.cal-legend-item{display:flex;align-items:center;gap:6px}
.cal-legend-sq{width:12px;height:12px;border-radius:3px;border:1px solid var(--s3)}
.cal-legend-sq.ok{background:color-mix(in srgb,var(--ok) 35%,var(--s1));border-color:var(--ok)}
.cal-legend-sq.none{background:var(--sh)}
.cal-legend-sq.today{background:var(--ac-s);border-color:var(--ac)}

/* Log list (list view) */
.log-list{display:flex;flex-direction:column}
.log-row{display:grid;grid-template-columns:80px 1fr auto;gap:16px;padding:14px 18px;border-bottom:1px solid var(--s3);cursor:pointer;transition:all var(--df) var(--e);align-items:flex-start}
.log-row:last-child{border-bottom:none}
.log-row:hover{background:var(--sh)}
.log-row.on{background:var(--ac-s)}
.log-row.on .lr-date-d{color:var(--ac-t)}
.lr-date{display:flex;flex-direction:column;align-items:flex-start}
.lr-date-d{font-family:var(--fd);font-size:20px;font-weight:780;color:var(--t1);letter-spacing:-.02em;line-height:1}
.lr-date-m{font-family:var(--fd);font-size:11px;font-weight:640;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-top:3px}
.lr-body{min-width:0}
.lr-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.lr-weather{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--t2);font-weight:540}
.lr-summary{font-size:13px;color:var(--t2);line-height:1.55;font-weight:520;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lr-hl{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.lr-meta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
.lr-ph{font-size:11.5px;color:var(--t3);font-weight:540;display:inline-flex;align-items:center;gap:4px}

.pl{height:22px;padding:0 9px;border-radius:999px;border:1px solid var(--s3);display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;background:var(--s1);color:var(--t3);white-space:nowrap;font-family:var(--fd)}
.pl.ok{background:var(--ok-s);color:var(--ok-t);border-color:color-mix(in srgb,var(--ok) 25%,var(--s3))}
.pl.warn{background:var(--wr-s);color:var(--wr-t);border-color:color-mix(in srgb,var(--wr) 25%,var(--s3))}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl svg{width:11px;height:11px}

/* Detail panel */
.dp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);position:sticky;top:calc(var(--tbh) + 16px)}
.dp-h{padding:16px 18px;border-bottom:1px solid var(--s3)}
.dp-date{font-family:var(--fd);font-size:11px;font-weight:720;color:var(--ac-t);text-transform:uppercase;letter-spacing:.06em}
.dp-title{font-family:var(--fd);font-size:18px;font-weight:780;color:var(--t1);letter-spacing:-.02em;margin-top:4px}
.dp-sub{font-size:12.5px;color:var(--t2);margin-top:5px;font-weight:540}

/* Weather block */
.wx{display:grid;grid-template-columns:auto 1fr;gap:12px;padding:12px 14px;margin:14px 18px 0;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);align-items:center}
.wx-icon{width:44px;height:44px;border-radius:50%;background:var(--s1);border:1px solid var(--s3);color:var(--ac);display:grid;place-items:center;flex-shrink:0}
.wx-icon svg{width:22px;height:22px}
.wx-body{display:flex;flex-direction:column;gap:2px}
.wx-cond{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
.wx-meta{font-size:11.5px;color:var(--t2);font-weight:540}

.dp-section{padding:14px 18px;border-bottom:1px solid var(--s3)}
.dp-section:last-child{border-bottom:none}
.dp-section-h{font-family:var(--fd);font-size:10.5px;font-weight:720;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.dp-notes{font-size:13px;color:var(--t2);line-height:1.6;font-weight:520}
.dp-ms{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:var(--r-m);background:var(--ok-s);border:1px solid color-mix(in srgb,var(--ok) 25%,var(--s3));color:var(--ok-t);font-size:12.5px;font-weight:640}
.dp-ms svg{flex-shrink:0}

.dp-hl{display:flex;flex-direction:column;gap:6px}
.dp-hl-item{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--t1);font-weight:540;line-height:1.5}
.dp-hl-item::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);margin-top:8px;flex-shrink:0}

/* Photo grid */
.ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ph-tile{aspect-ratio:1/1;background:linear-gradient(135deg,var(--s2),var(--s3));border-radius:var(--r-m);border:1px solid var(--s3);display:grid;place-items:center;color:var(--t3);cursor:pointer;transition:all var(--df) var(--e);overflow:hidden;position:relative}
.ph-tile:hover{border-color:var(--ac);box-shadow:var(--shsm)}
.ph-tile svg{width:22px;height:22px}
.ph-tile .ph-num{position:absolute;bottom:4px;right:6px;font-family:var(--fd);font-size:9.5px;font-weight:700;color:var(--t3);background:rgba(255,255,255,.8);padding:1px 5px;border-radius:4px}
.root.dk .ph-tile .ph-num{background:rgba(0,0,0,.5);color:var(--t2)}

/* Empty state */
.empty{padding:40px 24px;text-align:center;color:var(--t3)}
.empty-icon{width:48px;height:48px;border-radius:50%;background:var(--s2);margin:0 auto 12px;display:grid;place-items:center;color:var(--t3)}
.empty-t{font-family:var(--fd);font-size:14px;font-weight:680;color:var(--t1);margin-bottom:4px}
.empty-d{font-size:12.5px;color:var(--t2);max-width:320px;margin:0 auto;font-weight:520}

/* Photo lightbox */
.lb-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100;display:grid;place-items:center;padding:32px}
.lb{background:var(--s1);border-radius:var(--r-xl);max-width:900px;width:100%;max-height:calc(100vh - 64px);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shlg)}
.lb-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--s3)}
.lb-t{font-family:var(--fd);font-size:14px;font-weight:700}
.lb-c{font-size:12px;color:var(--t3);font-weight:540}
.lb-img{aspect-ratio:16/10;background:linear-gradient(135deg,var(--s2),var(--s3));display:grid;place-items:center;color:var(--t3);font-size:13px;font-weight:540}
.lb-f{padding:12px 18px;display:flex;gap:8px;border-top:1px solid var(--s3)}

/* Responsive */
@media (max-width: 1100px){
  .g{grid-template-columns:1fr}
  .dp{position:static}
}
      `}</style>

      {/* ── Sidebar ────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo s={30}/>
          <div className="brand-txt">
            <h1>BuiltCRM</h1>
            <p>Owner Portal</p>
          </div>
        </div>
        <div className="s-search">
          {I.search}
          <input className="s-input" placeholder="Search project..." />
        </div>
        <nav className="s-nav">
          {navSections.map((sec) => {
            const isClosed = !!collapsed[sec.title];
            return (
              <div key={sec.title} className="ns">
                <div className="ns-h" onClick={() => toggleSection(sec.title)}>
                  <span className={`ns-chv ${isClosed ? "closed" : ""}`}>{I.chev}</span>
                  {sec.title}
                </div>
                {!isClosed && sec.items.map((it) => (
                  <div key={it.label} className={`ni ${it.active ? "on" : ""}`}>
                    <span>{it.label}</span>
                    {it.badge && <span className={`ni-badge ${it.badgeType || ""}`}>{it.badge}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="s-foot">
          <div className="s-user">
            <div className="u-av">MR</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="u-name">Morgan Reese</div>
              <div className="u-role">Hudson Equity · Owner Rep</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────── */}
      <div className="mn">
        <header className="topbar">
          <div className="bc">
            <span>Projects</span><span className="sep">/</span>
            <span>Riverside Tower</span><span className="sep">/</span>
            <span className="cur">Project Log</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}>{dark ? I.sun : I.moon}</button>
            <button className="ib" title="Notifications">{I.bell}</button>
            <div className="av">MR</div>
          </div>
        </header>

        <main className="ct">
          {/* Page header */}
          <div className="ph-head">
            <div>
              <h1 className="ph-title">Project Log</h1>
              <p className="ph-desc">
                A record of daily on-site activity from the contractor. Each entry includes weather conditions,
                work completed, progress photos, and notable events affecting the project.
              </p>
            </div>
            <div className="ph-actions">
              <div className="v-toggle">
                <button className={`v-btn ${view === "calendar" ? "on" : ""}`} onClick={() => setView("calendar")}>{I.grid} Calendar</button>
                <button className={`v-btn ${view === "list" ? "on" : ""}`} onClick={() => setView("list")}>{I.list} List</button>
              </div>
              <button className="btn">{I.download} Export</button>
            </div>
          </div>

          <div className="meta-strip">
            <span className="meta-chip phase"><strong>{project.phase}</strong></span>
            <span className="meta-chip">Started <strong>{project.startDate}</strong></span>
            <span className="meta-chip">Target completion <strong>{project.targetComplete}</strong></span>
            <span className="meta-chip"><strong>28</strong> logs posted this month</span>
          </div>

          <div className="info-banner">
            {I.info}
            <div>
              <b>What you see here.</b> Daily logs are posted by the contractor at the end of each work day.
              They capture on-site activity and progress. Internal operational details (crew-specific assignments,
              subcontractor rates) are not included in this view.
            </div>
          </div>

          <div className="g">
            {/* ── Left: calendar or list ───────── */}
            <div className="card">
              <div className="card-h">
                <div>
                  <h3>{view === "calendar" ? "April 2026" : "Recent logs"}</h3>
                  <div className="card-sub">{view === "calendar" ? "Click a logged day to open its record" : "Showing most recent 6 logs"}</div>
                </div>
                {view === "list" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn ghost">Prev week</button>
                    <button className="btn ghost">Next week</button>
                  </div>
                )}
              </div>

              {view === "calendar" ? (
                <div className="cal">
                  <div className="cal-head">
                    <div className="cal-nav">
                      <button className="ib">{I.chevL}</button>
                    </div>
                    <div className="cal-month">April 2026</div>
                    <div className="cal-nav">
                      <button className="ib">{I.chevR}</button>
                    </div>
                  </div>
                  <div className="cal-grid">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d} className="cal-dow">{d}</div>
                    ))}
                    {calendarDays.map((c, i) => {
                      const cls = c.m === "prev" ? "prev" : `st-${c.st}`;
                      const isSelected = c.st === 1 && selected && selected.dateLabel && selected.dateLabel.includes(`Apr ${c.d}`);
                      return (
                        <div
                          key={i}
                          className={`cal-cell ${cls}${isSelected ? " on" : ""}`}
                          onClick={() => {
                            if (c.st === 1) {
                              const match = recentLogs.find((l) => l.dateLabel.includes(`Apr ${c.d}`));
                              if (match) setSelected(match);
                            }
                          }}
                        >
                          <span className="cd">{c.d}</span>
                          {c.st === 1 && <span className="dot"/>}
                          {c.st === 3 && <span className="today-tag">Today</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="cal-legend">
                    <div className="cal-legend-item"><span className="cal-legend-sq ok"/> Log posted</div>
                    <div className="cal-legend-item"><span className="cal-legend-sq none"/> Non-work day</div>
                    <div className="cal-legend-item"><span className="cal-legend-sq today"/> Today</div>
                  </div>
                </div>
              ) : (
                <div className="log-list">
                  {recentLogs.map((l) => {
                    const [dayMonth] = l.dateLabel.split(",").slice(-1);
                    const dayNum = dayMonth.trim().split(" ")[1];
                    const monthAbbr = dayMonth.trim().split(" ")[0];
                    return (
                      <div
                        key={l.id}
                        className={`log-row ${selected.id === l.id ? "on" : ""}`}
                        onClick={() => setSelected(l)}
                      >
                        <div className="lr-date">
                          <span className="lr-date-d">{dayNum}</span>
                          <span className="lr-date-m">{monthAbbr}</span>
                        </div>
                        <div className="lr-body">
                          <div className="lr-head">
                            <span className="lr-weather">{weatherIcon(l.weather.icon)} {l.weather.conditions} · {l.weather.high}</span>
                            {l.milestone && <span className="pl ok">{I.check} Milestone</span>}
                            {l.weatherNote && <span className="pl warn">Weather note</span>}
                          </div>
                          <div className="lr-summary">{l.summary}</div>
                          <div className="lr-hl">
                            {l.highlights.slice(0, 2).map((h, i) => (
                              <span key={i} className="pl">{h}</span>
                            ))}
                            {l.highlights.length > 2 && <span className="pl">+{l.highlights.length - 2} more</span>}
                          </div>
                        </div>
                        <div className="lr-meta">
                          <span className="lr-ph">{I.camera} {l.photos}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Right: detail panel ───────────── */}
            <div className="dp">
              <div className="dp-h">
                <div className="dp-date">{selected.dateFull || selected.dateLabel}</div>
                <div className="dp-title">On-site progress</div>
                <div className="dp-sub">
                  Log ID <span style={{ fontFamily: "var(--fm)", fontWeight: 500 }}>{selected.id}</span> · posted by contractor
                </div>
              </div>

              <div className="wx">
                <div className="wx-icon">{weatherIcon(selected.weather.icon)}</div>
                <div className="wx-body">
                  <div className="wx-cond">{selected.weather.conditions}</div>
                  <div className="wx-meta">
                    High {selected.weather.high} · Low {selected.weather.low} · Precip {selected.weather.precip}
                  </div>
                </div>
              </div>

              {selected.milestone && (
                <div className="dp-section">
                  <div className="dp-section-h">Milestone</div>
                  <div className="dp-ms">{I.check} {selected.milestone}</div>
                </div>
              )}

              <div className="dp-section">
                <div className="dp-section-h">Day summary</div>
                <p className="dp-notes">{selected.summary}</p>
              </div>

              <div className="dp-section">
                <div className="dp-section-h">Key activity</div>
                <div className="dp-hl">
                  {selected.highlights.map((h, i) => (
                    <div key={i} className="dp-hl-item">{h}</div>
                  ))}
                </div>
              </div>

              <div className="dp-section">
                <div className="dp-section-h">Photos ({selected.photos})</div>
                <div className="ph-grid">
                  {Array.from({ length: Math.min(selected.photos, 9) }, (_, i) => (
                    <div key={i} className="ph-tile" onClick={() => setPhotoModal(i)}>
                      {I.camera}
                      <span className="ph-num">{i + 1}</span>
                    </div>
                  ))}
                </div>
                {selected.photos > 9 && (
                  <button className="btn ghost" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>
                    View all {selected.photos} photos
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Photo lightbox ──────────────────────── */}
      {photoModal !== null && (
        <div className="lb-backdrop" onClick={() => setPhotoModal(null)}>
          <div className="lb" onClick={(e) => e.stopPropagation()}>
            <div className="lb-h">
              <div>
                <div className="lb-t">Photo {photoModal + 1} of {selected.photos}</div>
                <div className="lb-c">{selected.dateLabel} · Riverside Tower Fit-Out</div>
              </div>
              <button className="ib" onClick={() => setPhotoModal(null)}>{I.x}</button>
            </div>
            <div className="lb-img">
              {I.camera}&nbsp;&nbsp;Photo preview placeholder
            </div>
            <div className="lb-f">
              <button className="btn" onClick={() => setPhotoModal(Math.max(0, photoModal - 1))} disabled={photoModal === 0}>{I.chevL} Previous</button>
              <button className="btn" onClick={() => setPhotoModal(Math.min(selected.photos - 1, photoModal + 1))} disabled={photoModal === selected.photos - 1}>Next {I.chevR}</button>
              <div style={{ flex: 1 }}/>
              <button className="btn">{I.download} Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
