import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  chev: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  plus: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  camera: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  cloud: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  cloudRain: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  users: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  file: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
};

// ── Logo Mark ───────────────────────────────────────────────────
const Logo = ({ s = 30 }) => (
  <div style={{ width: s, height: s, borderRadius: s * 0.27, background: "linear-gradient(135deg,#3d348b,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
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
    { label: "Dashboard" },
    { label: "Projects" },
  ]},
  { title: "Field", items: [
    { label: "Daily Logs", active: true },
    { label: "Punch List", badge: 7 },
    { label: "Submittals", badge: 3, badgeType: "warn" },
    { label: "Photos" },
  ]},
  { title: "Workflow", items: [
    { label: "RFIs", badge: 4, badgeType: "warn" },
    { label: "Change Orders", badge: 2 },
    { label: "Approvals" },
  ]},
  { title: "Money", items: [
    { label: "Billing & Draws" },
    { label: "Payments" },
  ]},
  { title: "People", items: [
    { label: "Team" },
    { label: "Subs & Vendors" },
  ]},
];

const sidebarProjects = [
  { name: "Riverside Tower", trade: "GC", color: "var(--ac)", active: true },
  { name: "West End Medical", trade: "GC", color: "var(--ok)" },
  { name: "Northline Office", trade: "GC", color: "var(--ok)" },
  { name: "Harbor Point Phase 2", trade: "GC", color: "var(--wr)" },
];

// ── Page Data ───────────────────────────────────────────────────
const project = { name: "Riverside Tower Fit-Out", id: "PRJ-0042" };

const kpis = [
  { label: "Logs this week", value: "5", meta: "Of 5 work days", metaType: "ok" },
  { label: "Delay hours", value: "6.5", meta: "2 delays logged", metaType: "warn" },
  { label: "Missing logs", value: "0", meta: "Last 30 days", metaType: "ok" },
  { label: "Photos captured", value: "47", meta: "This week" },
  { label: "Pending amend.", value: "1", meta: "Requires approval", metaType: "warn", alert: true },
];

// Today's status
const today = { date: "Thursday, Apr 18", logged: false, weather: "Partly cloudy · 14° / 8° · 10% precip", crewScheduled: 18, orgsOnSite: 4 };

// Month calendar — April 2026. 0 = no work (weekend), 1 = logged, 2 = missed, 3 = today (unlogged)
const calendarDays = [
  { d: 29, m: "prev" }, { d: 30, m: "prev" }, { d: 31, m: "prev" },
  { d: 1, st: 1 }, { d: 2, st: 1 }, { d: 3, st: 1 }, { d: 4, st: 0 },
  { d: 5, st: 0 }, { d: 6, st: 1 }, { d: 7, st: 1 }, { d: 8, st: 1 }, { d: 9, st: 1 }, { d: 10, st: 1 }, { d: 11, st: 0 },
  { d: 12, st: 0 }, { d: 13, st: 1 }, { d: 14, st: 1 }, { d: 15, st: 1 }, { d: 16, st: 1 }, { d: 17, st: 1 }, { d: 18, st: 0 },
  { d: 19, st: 0 }, { d: 20, st: 1 }, { d: 21, st: 1 }, { d: 22, st: 1 }, { d: 23, st: 1 }, { d: 24, st: 1 }, { d: 25, st: 0 },
  { d: 26, st: 0 }, { d: 27, st: 1 }, { d: 28, st: 1 }, { d: 29, st: 1 }, { d: 30, st: 1 },
];
// Make today Apr 18 — mark as 3 (today, unlogged)
calendarDays[calendarDays.findIndex(x => x.d === 18 && !x.m)] = { d: 18, st: 3 };

const recentLogs = [
  { id: "DL-0078", dateLabel: "Wed, Apr 17", dateShort: "Apr 17", weather: "Sunny · 16°/9°", crewTotal: 22, orgs: 5, summary: "East corridor electrical rough-in wrapped. Plumbing crew started riser installation on floors 3 and 4. HVAC trunk lines set in corridor.", delays: 0, photos: 8, author: "Daniel Chen", editable: true, hoursLeft: 18 },
  { id: "DL-0077", dateLabel: "Tue, Apr 16", dateShort: "Apr 16", weather: "Overcast · 12°/7°", crewTotal: 20, orgs: 5, summary: "Electrical rough-in continues east corridor. Drywall delivery received 10 AM. Minor rain delay 2 PM–3:30 PM on exterior caulking.", delays: 1, photos: 6, author: "Daniel Chen", amended: true },
  { id: "DL-0076", dateLabel: "Mon, Apr 15", dateShort: "Apr 15", weather: "Light rain · 10°/6°", crewTotal: 18, orgs: 4, summary: "Interior work only due to rain. Panel room electrical completed final termination. Drywall hanging west wing levels 2–3.", delays: 1, photos: 5, author: "Sarah Kim" },
  { id: "DL-0075", dateLabel: "Fri, Apr 12", dateShort: "Apr 12", weather: "Sunny · 18°/11°", crewTotal: 24, orgs: 6, summary: "Full crew on site. Electrical, HVAC, and plumbing all progressing east corridor. Inspector visit 11 AM passed panel room pre-inspection.", delays: 0, photos: 12, author: "Daniel Chen" },
  { id: "DL-0074", dateLabel: "Thu, Apr 11", dateShort: "Apr 11", weather: "Partly cloudy · 15°/8°", crewTotal: 19, orgs: 5, summary: "Concrete cure completed overnight on slab repair area. Framing continuation west wing. GC walkthrough 3 PM — 4 items flagged to punch.", delays: 0, photos: 9, author: "Daniel Chen" },
];

// Detail log for the drawer (opened by default on DL-0078 for prototype display)
const detailLog = {
  ...recentLogs[0],
  dateFull: "Wednesday, April 17, 2026",
  weatherDetail: { conditions: "Sunny", high: "16°C", low: "9°C", precip: "0%", wind: "12 km/h SW" },
  crewBreakdown: [
    { org: "Summit Electrical", trade: "Electrical", headcount: 6, hours: 48 },
    { org: "Peak Plumbing", trade: "Plumbing", headcount: 4, hours: 32 },
    { org: "Northwind HVAC", trade: "Mechanical", headcount: 5, hours: 40 },
    { org: "Orbit Drywall", trade: "Drywall", headcount: 4, hours: 32 },
    { org: "Self-perform (GC)", trade: "General", headcount: 3, hours: 24 },
  ],
  notes: "East corridor electrical rough-in completed on schedule — all branch circuits terminated into Panel EC-04 and EC-05, ready for inspection Friday. Plumbing crew began riser installation on floors 3 and 4; no conflicts with the revised routing per CO-14. HVAC mechanical trunk lines were set in corridor ceiling; duct insulation to follow Monday. Drywall delivery of 280 sheets arrived 10:15 AM, staged on floor 2. Minor coordination issue between plumbing and HVAC over east mechanical room clearance — resolved on site with field team.",
  delaysList: [],
  issuesList: [
    { type: "Safety near-miss", desc: "Cord-management issue on floor 3 — resolved, crew briefed at end-of-day huddle.", hours: 0 },
  ],
  photosList: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, caption: ["East corridor — panel room complete", "Plumbing riser F3", "HVAC trunk corridor ceiling", "Drywall delivery staging F2", "Panel EC-04 terminations", "F3 plumbing rough-in overview", "F4 mechanical trunk", "End-of-day site condition"][i] })),
  audit: [
    { at: "Apr 17 · 5:42 PM", by: "Daniel Chen", action: "Submitted daily log" },
    { at: "Apr 17 · 5:38 PM", by: "Daniel Chen", action: "Added 8 photos" },
    { at: "Apr 17 · 5:22 PM", by: "Daniel Chen", action: "Created draft" },
  ],
};

// ── Component ───────────────────────────────────────────────────
export default function ContractorDailyLogs() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("calendar"); // calendar | list
  const [drawer, setDrawer] = useState(null); // null | 'detail' | 'create' | 'amend'
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
  --ac:#5b4fc7;--ac-h:#4a3fb0;--ac-s:#ece9fb;--ac-t:#4337a0;--ac-m:#c5bef0;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);--shlg:0 16px 48px rgba(26,23,20,.14);
  --sbw:264px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.root.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sic:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#8478de;--ac-h:#9689e6;--ac-s:#1e1a36;--ac-t:#ada3ec;--ac-m:#4a3f8c;
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
.s-input:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(91,79,199,.15)}
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

.np{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 12px;border-radius:var(--r-m);font-size:13px;font-weight:460;color:var(--t2);cursor:pointer;margin-bottom:1px;transition:all var(--df) var(--e)}
.np:hover{background:var(--sh);color:var(--t1)}
.np.on{background:var(--s1);color:var(--t1);font-weight:580;border:1px solid var(--s3);box-shadow:var(--shsm)}
.np-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.np-trade{font-size:10.5px;color:var(--t3);font-weight:550;letter-spacing:.02em;margin-left:auto;flex-shrink:0}

.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--r-m);cursor:pointer}
.s-user:hover{background:var(--sh)}
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#7c6fe0);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:580}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

/* ── Main area ───────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.topbar{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(238,240,243,.85);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.root.dk .topbar{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:580;color:var(--t3)}
.bc .sep{color:var(--s4)}.bc .cur{color:var(--t1);font-weight:720}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;transition:all var(--df) var(--e);cursor:pointer}
.ib:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.ib.nd{position:relative}
.ib.nd::after{content:'';position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--dg);border:2px solid var(--s1)}
.tb-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#7c6fe0);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;cursor:pointer;margin-left:4px}

/* ── Content ─────────────────────────────────────── */
.ct{padding:24px;flex:1}

.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px}
.pg-t{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;line-height:1.15}
.pg-sub{margin-top:6px;font-size:14px;font-weight:520;color:var(--t2);max-width:640px}
.pg-acts{display:flex;gap:8px;flex-shrink:0;padding-top:2px}

/* Buttons */
.btn{height:38px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:13px;font-weight:650;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);color:var(--ti);border-color:var(--ac)}
.btn.pri:hover{background:var(--ac-h)}
.btn svg{width:15px;height:15px;flex-shrink:0}
.btn.sm{height:32px;font-size:12px;padding:0 12px}
.btn.ghost{background:transparent;border-color:transparent;color:var(--t2);font-weight:560}
.btn.ghost:hover{background:var(--sh);color:var(--t1)}
.btn.full{width:100%;justify-content:center}

/* Pills */
.pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--fd)}
.pl.red{background:var(--dg-s);color:var(--dg-t)}
.pl.amber{background:var(--wr-s);color:var(--wr-t)}
.pl.green{background:var(--ok-s);color:var(--ok-t)}
.pl.blue{background:var(--ac-s);color:var(--ac-t)}
.pl.gray{background:var(--s2);color:var(--t2)}
.pl svg{width:11px;height:11px}

/* Today banner */
.today-banner{background:linear-gradient(135deg,var(--ac-s),var(--s1));border:1.5px solid var(--ac-m);border-radius:var(--r-xl);padding:18px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.tb-left{display:flex;align-items:center;gap:16px;flex:1;min-width:0}
.tb-icon{width:44px;height:44px;border-radius:var(--r-m);background:var(--s1);color:var(--ac);display:grid;place-items:center;flex-shrink:0;border:1px solid var(--ac-m)}
.tb-icon svg{width:22px;height:22px}
.tb-info h3{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.tb-info .tb-status{font-size:12.5px;color:var(--t2);margin-top:3px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tb-info .tb-status .dot{width:4px;height:4px;border-radius:50%;background:var(--t3)}

/* KPI strip */
.kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.kpi{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;transition:all var(--dn) var(--e)}
.kpi:hover{box-shadow:var(--shmd)}
.kpi.alert{border-color:var(--wr);border-width:1.5px}
.kpi-label{font-family:var(--fd);font-size:11.5px;font-weight:700;color:var(--t1);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.kpi-val{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.kpi-meta{font-family:var(--fb);font-size:12px;font-weight:580;color:var(--t2);margin-top:4px}
.kpi-trend{font-weight:720;font-size:11.5px}
.kpi-trend.warn{color:var(--wr-t)}
.kpi-trend.ok{color:var(--ok-t)}
.kpi-trend.danger{color:var(--dg-t)}

/* Dashboard grid */
.dash{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}
.dash-main{display:flex;flex-direction:column;gap:16px}
.dash-rail{display:flex;flex-direction:column;gap:16px}

/* Card */
.cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.cd-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3);gap:12px}
.cd-title{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.cd-sub{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin-top:2px}
.cd-body{padding:16px 20px}

/* View toggle */
.vt{display:inline-flex;background:var(--s2);border-radius:var(--r-m);padding:3px;gap:2px}
.vt-btn{height:28px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:600;color:var(--t2);background:transparent;border:none;cursor:pointer;font-family:var(--fb);display:inline-flex;align-items:center;gap:5px}
.vt-btn.on{background:var(--s1);color:var(--t1);font-weight:700;box-shadow:var(--shsm)}

/* Calendar */
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 4px}
.cal-nav{display:flex;align-items:center;gap:8px}
.cal-month{font-family:var(--fd);font-size:17px;font-weight:740;letter-spacing:-.02em}
.cal-arrow{width:28px;height:28px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);color:var(--t2);display:grid;place-items:center;cursor:pointer}
.cal-arrow:hover{background:var(--sh);color:var(--t1)}
.cal-arrow svg{width:12px;height:12px}
.cal-legend{display:flex;gap:14px;font-size:11.5px;color:var(--t2);font-weight:550}
.cal-legend span{display:inline-flex;align-items:center;gap:5px}
.cal-legend .sw{width:10px;height:10px;border-radius:3px}

.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cal-dow{font-family:var(--fd);font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;text-align:center;padding:4px 0;margin-bottom:2px}
.cal-day{aspect-ratio:1;border-radius:var(--r-m);display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:8px 10px;cursor:pointer;transition:all var(--df) var(--e);border:1px solid transparent;position:relative}
.cal-day .d-num{font-family:var(--fd);font-size:13px;font-weight:700}
.cal-day .d-foot{font-size:10px;font-weight:600;letter-spacing:.02em}
.cal-day.prev{color:var(--t3);opacity:.4;background:transparent;cursor:default}
.cal-day.weekend{background:var(--s2);color:var(--t3)}
.cal-day.logged{background:var(--ok-s);color:var(--ok-t);border-color:rgba(45,138,94,.2)}
.cal-day.logged:hover{border-color:var(--ok);box-shadow:var(--shsm)}
.cal-day.missed{background:var(--dg-s);color:var(--dg-t);border-color:rgba(201,59,59,.2)}
.cal-day.missed:hover{border-color:var(--dg)}
.cal-day.today{background:var(--ac-s);color:var(--ac-t);border:1.5px solid var(--ac);font-weight:820}

/* List view */
.log-row{display:grid;grid-template-columns:90px 1fr auto;gap:16px;padding:14px 0;border-top:1px solid var(--s3);cursor:pointer;transition:background var(--df);align-items:start}
.log-row:first-child{border-top:none}
.log-row:hover{background:var(--sic);margin:0 -20px;padding-left:20px;padding-right:20px}
.log-date{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);line-height:1.3}
.log-date .log-id{display:block;font-family:var(--fm);font-size:10.5px;font-weight:500;color:var(--t3);margin-top:3px}
.log-body h5{font-family:var(--fd);font-size:13.5px;font-weight:620;letter-spacing:-.005em;line-height:1.35;margin-bottom:4px}
.log-body p{font-size:12.5px;color:var(--t2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.log-meta-row{display:flex;align-items:center;gap:10px;margin-top:7px;flex-wrap:wrap}
.log-mi{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--t2);font-weight:570}
.log-mi svg{color:var(--t3)}
.log-author{text-align:right;font-size:11.5px;color:var(--t3);font-weight:560;white-space:nowrap}
.log-author .ed-win{display:inline-flex;align-items:center;gap:3px;color:var(--wr-t);font-weight:650;margin-top:4px;font-size:10.5px}

/* Right rail cards */
.today-card h5{font-family:var(--fd);font-size:13px;font-weight:620;margin-bottom:4px}
.today-card p{font-size:12px;color:var(--t2);line-height:1.45}
.wth-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s3)}
.wth-row:last-child{border-bottom:none}
.wth-ic{width:34px;height:34px;border-radius:var(--r-s);background:var(--ac-s);color:var(--ac-t);display:grid;place-items:center;flex-shrink:0}
.wth-row .wr-body{flex:1;min-width:0}
.wth-row .wr-label{font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.wth-row .wr-val{font-family:var(--fd);font-size:13px;font-weight:620;margin-top:1px}

.mini-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px;border-bottom:1px solid var(--s3)}
.mini-row:last-child{border-bottom:none}
.mini-row .mr-l{color:var(--t2);font-weight:540}
.mini-row .mr-r{font-family:var(--fd);font-weight:680}
.mini-row .mr-r.mono{font-family:var(--fm);font-weight:560}

.amd-row{padding:10px 0;border-bottom:1px solid var(--s3);cursor:pointer}
.amd-row:last-child{border-bottom:none}
.amd-row h5{font-family:var(--fd);font-size:13px;font-weight:620}
.amd-row p{font-size:11.5px;color:var(--t2);margin-top:2px;line-height:1.4}
.amd-row .amd-meta{display:flex;align-items:center;gap:8px;margin-top:6px}

/* ── Drawer ──────────────────────────────────────── */
.drawer-ovl{position:fixed;inset:0;background:rgba(20,18,14,.4);backdrop-filter:blur(3px);z-index:100;display:${drawer ? 'block' : 'none'}}
.drawer{position:fixed;top:0;right:0;width:720px;max-width:100vw;height:100vh;background:var(--s1);z-index:101;display:${drawer ? 'flex' : 'none'};flex-direction:column;box-shadow:var(--shlg);border-left:1px solid var(--s3)}
.dr-head{padding:16px 24px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-shrink:0}
.dr-head-l h2{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.02em;line-height:1.2}
.dr-head-l .dh-meta{font-size:12.5px;color:var(--t2);margin-top:4px;display:flex;align-items:center;gap:8px}
.dr-head-l .dh-meta .mono{font-family:var(--fm);font-size:11.5px}
.dr-close{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t2);display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.dr-close:hover{background:var(--sh);color:var(--t1)}
.dr-body{flex:1;overflow-y:auto;padding:20px 24px}
.dr-foot{padding:14px 24px;border-top:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-shrink:0;background:var(--sic)}

.sec{margin-bottom:22px}
.sec-h{font-family:var(--fd);font-size:11.5px;font-weight:720;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.sec-h svg{color:var(--t3)}

.wx-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.wx-cell{background:var(--sic);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.wx-cell .wxl{font-size:10.5px;color:var(--t3);font-weight:620;text-transform:uppercase;letter-spacing:.04em}
.wx-cell .wxv{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}

.crew-tbl{width:100%;border-collapse:collapse}
.crew-tbl th{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:8px 12px;background:var(--sic);border-bottom:1px solid var(--s3)}
.crew-tbl th:last-child,.crew-tbl td:last-child{text-align:right}
.crew-tbl td{padding:10px 12px;border-bottom:1px solid var(--s3);font-size:13px}
.crew-tbl tr:last-child td{border-bottom:none}
.crew-tbl td.org{font-weight:600;font-family:var(--fm);font-size:12.5px}
.crew-tbl td.trade{color:var(--t2);font-size:12px}
.crew-tbl td.num{font-family:var(--fd);font-weight:680}
.crew-tbl tr.total td{background:var(--sic);font-weight:740;border-bottom:none}

.notes-body{font-size:13.5px;line-height:1.6;color:var(--t1);padding:12px 14px;background:var(--sic);border-left:3px solid var(--ac);border-radius:0 var(--r-m) var(--r-m) 0}

.issue-row{display:flex;gap:10px;padding:10px 12px;background:var(--wr-s);border:1px solid rgba(193,122,26,.2);border-radius:var(--r-m);margin-bottom:8px}
.issue-row .ir-ic{color:var(--wr-t);flex-shrink:0;margin-top:2px}
.issue-row h6{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--wr-t);margin-bottom:2px}
.issue-row p{font-size:12.5px;color:var(--t2);line-height:1.5}

.ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ph-tile{aspect-ratio:1;background:linear-gradient(135deg,var(--s2),var(--s3));border-radius:var(--r-m);position:relative;overflow:hidden;cursor:pointer;display:grid;place-items:center;color:var(--t3);border:1px solid var(--s3)}
.ph-tile:hover{border-color:var(--ac-m)}
.ph-tile .ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(20,18,14,.7));color:white;font-size:10.5px;font-weight:570;line-height:1.2}

.aud-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--s3);font-size:12.5px}
.aud-row:last-child{border-bottom:none}
.aud-row .au-at{font-family:var(--fm);font-size:11px;color:var(--t3);width:130px;flex-shrink:0;padding-top:2px}
.aud-row .au-by{font-weight:620;color:var(--t1)}
.aud-row .au-ac{color:var(--t2);margin-top:1px}

/* Create form */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-grid.full{grid-template-columns:1fr}
.field label{display:block;font-family:var(--fd);font-size:11.5px;font-weight:680;color:var(--t2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
.field input,.field select,.field textarea{width:100%;border:1px solid var(--s3);background:var(--s1);border-radius:var(--r-m);padding:8px 12px;font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(91,79,199,.15)}
.field textarea{min-height:100px;resize:vertical;line-height:1.5}

.add-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:640;color:var(--ac-t);background:var(--ac-s);padding:6px 10px;border-radius:var(--r-s);cursor:pointer;border:1px dashed var(--ac-m)}
.add-chip:hover{background:var(--ac-m);color:var(--ti)}

@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.drawer{animation:slideIn .28s var(--e)}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand">
          <Logo s={30}/>
          <div className="brand-txt">
            <h1>BuiltCRM</h1>
            <p>Contractor Portal</p>
          </div>
        </div>
        <div className="s-search">
          {I.search}
          <input className="s-input" placeholder="Search logs, projects…"/>
        </div>
        <div className="s-nav">
          {navSections.map((sec) => (
            <div key={sec.title} className="ns">
              <div className="ns-h" onClick={() => toggleSection(sec.title)}>
                <span style={{ flex: 1 }}>{sec.title}</span>
                <span className={`ns-chv ${collapsed[sec.title] ? "closed" : ""}`}>{I.chev}</span>
              </div>
              {!collapsed[sec.title] && sec.items.map((it) => (
                <div key={it.label} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge && <span className={`ni-badge${it.badgeType === "warn" ? " warn" : it.badgeType === "danger" ? " danger" : ""}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
          <div className="ns" style={{ marginTop: 8 }}>
            <div className="ns-h">Your projects</div>
            {sidebarProjects.map((p) => (
              <div key={p.name} className={`np${p.active ? " on" : ""}`}>
                <span className="np-dot" style={{ background: p.color }}/>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <span className="np-trade">{p.trade}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="s-foot">
          <div className="s-user">
            <div className="u-av">DC</div>
            <div>
              <div className="u-name">Daniel Chen</div>
              <div className="u-role">Summit Contracting</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="mn">
        <div className="topbar">
          <div className="bc">
            <span>{project.name}</span><span className="sep">/</span>
            <span>Field</span><span className="sep">/</span>
            <span className="cur">Daily Logs</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? I.sun : I.moon}</button>
            <button className="ib nd" aria-label="Notifications">{I.bell}</button>
            <div className="tb-av">DC</div>
          </div>
        </div>

        <div className="ct">
          {/* Page header */}
          <div className="pg-h">
            <div>
              <h1 className="pg-t">Daily Logs</h1>
              <p className="pg-sub">Record of on-site conditions, crew, and work performed for {project.name}.</p>
            </div>
            <div className="pg-acts">
              <button className="btn">{I.file} Export PDF</button>
              <button className="btn pri" onClick={() => setDrawer("create")}>{I.plus} New Log</button>
            </div>
          </div>

          {/* Today banner */}
          <div className="today-banner">
            <div className="tb-left">
              <div className="tb-icon">{I.cloud}</div>
              <div className="tb-info">
                <h3>{today.date} — not yet logged</h3>
                <div className="tb-status">
                  <span>{today.weather}</span>
                  <span className="dot"/>
                  <span>{today.crewScheduled} crew scheduled across {today.orgsOnSite} orgs</span>
                  <span className="dot"/>
                  <span>Log by 6 PM for no-amendment window</span>
                </div>
              </div>
            </div>
            <button className="btn pri" onClick={() => setDrawer("create")}>{I.plus} Create today's log</button>
          </div>

          {/* KPI strip */}
          <section className="kpi-strip">
            {kpis.map((k) => (
              <div key={k.label} className={`kpi${k.alert ? " alert" : ""}`}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-val">{k.value}</div>
                <div className="kpi-meta">
                  {k.metaType ? <span className={`kpi-trend ${k.metaType}`}>{k.meta}</span> : k.meta}
                </div>
              </div>
            ))}
          </section>

          {/* Grid */}
          <section className="dash">
            <div className="dash-main">
              {/* Calendar or list */}
              <div className="cd">
                <div className="cd-h">
                  <div>
                    <div className="cd-title">Log history</div>
                    <div className="cd-sub">Tap any day to view or create its log</div>
                  </div>
                  <div className="vt">
                    <button className={`vt-btn${view === "calendar" ? " on" : ""}`} onClick={() => setView("calendar")}>{I.grid} Calendar</button>
                    <button className={`vt-btn${view === "list" ? " on" : ""}`} onClick={() => setView("list")}>{I.list} List</button>
                  </div>
                </div>
                <div className="cd-body">
                  {view === "calendar" ? (
                    <>
                      <div className="cal-head">
                        <div className="cal-nav">
                          <button className="cal-arrow" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg></button>
                          <div className="cal-month">April 2026</div>
                          <button className="cal-arrow" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg></button>
                        </div>
                        <div className="cal-legend">
                          <span><span className="sw" style={{ background: "var(--ok-s)", border: "1px solid rgba(45,138,94,.3)" }}/>Logged</span>
                          <span><span className="sw" style={{ background: "var(--dg-s)", border: "1px solid rgba(201,59,59,.3)" }}/>Missed</span>
                          <span><span className="sw" style={{ background: "var(--s2)" }}/>Non-work</span>
                          <span><span className="sw" style={{ background: "var(--ac-s)", border: "1.5px solid var(--ac)" }}/>Today</span>
                        </div>
                      </div>
                      <div className="cal-grid">
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
                        {calendarDays.map((c, idx) => {
                          const cls = c.m === "prev" ? "prev" : c.st === 0 ? "weekend" : c.st === 1 ? "logged" : c.st === 2 ? "missed" : "today";
                          const foot = c.st === 1 ? "Logged" : c.st === 2 ? "Missed" : c.st === 3 ? "Today" : "";
                          return (
                            <div key={idx} className={`cal-day ${cls}`} onClick={() => c.st === 1 && setDrawer("detail")}>
                              <span className="d-num">{c.d}</span>
                              <span className="d-foot">{foot}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ margin: "-4px 0" }}>
                      {recentLogs.map((log) => (
                        <div key={log.id} className="log-row" onClick={() => setDrawer("detail")}>
                          <div className="log-date">{log.dateLabel}<span className="log-id">{log.id}</span></div>
                          <div className="log-body">
                            <h5>{log.summary.split(".")[0]}.</h5>
                            <p>{log.summary}</p>
                            <div className="log-meta-row">
                              <span className="log-mi">{I.cloud} {log.weather}</span>
                              <span className="log-mi">{I.users} {log.crewTotal} crew · {log.orgs} orgs</span>
                              {log.delays > 0 && <span className="pl amber">{I.alert} {log.delays} delay</span>}
                              <span className="log-mi">{I.camera} {log.photos} photos</span>
                              {log.amended && <span className="pl gray">{I.edit} Amended</span>}
                            </div>
                          </div>
                          <div className="log-author">
                            {log.author}
                            {log.editable && <div className="ed-win">{I.clock} {log.hoursLeft}h edit</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent logs (always shown below calendar) */}
              {view === "calendar" && (
                <div className="cd">
                  <div className="cd-h">
                    <div>
                      <div className="cd-title">Recent logs</div>
                      <div className="cd-sub">Last 5 entries · click to view</div>
                    </div>
                    <button className="btn ghost sm" onClick={() => setView("list")}>View all</button>
                  </div>
                  <div className="cd-body">
                    {recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="log-row" onClick={() => setDrawer("detail")}>
                        <div className="log-date">{log.dateShort}<span className="log-id">{log.id}</span></div>
                        <div className="log-body">
                          <h5>{log.summary.split(".")[0]}.</h5>
                          <div className="log-meta-row">
                            <span className="log-mi">{I.cloud} {log.weather}</span>
                            <span className="log-mi">{I.users} {log.crewTotal}</span>
                            {log.delays > 0 && <span className="pl amber">{log.delays} delay</span>}
                            <span className="log-mi">{I.camera} {log.photos}</span>
                            {log.amended && <span className="pl gray">Amended</span>}
                          </div>
                        </div>
                        <div className="log-author">
                          {log.author}
                          {log.editable && <div className="ed-win">{I.clock} {log.hoursLeft}h edit</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right rail */}
            <div className="dash-rail">
              {/* Today at a glance */}
              <div className="cd">
                <div className="cd-h"><div><div className="cd-title">Today at a glance</div><div className="cd-sub">Forecast · crew · open items</div></div></div>
                <div className="cd-body" style={{ paddingTop: 4 }}>
                  <div className="wth-row">
                    <div className="wth-ic">{I.cloud}</div>
                    <div className="wr-body">
                      <div className="wr-label">Weather</div>
                      <div className="wr-val">14° / 8° · Partly cloudy</div>
                    </div>
                  </div>
                  <div className="wth-row">
                    <div className="wth-ic">{I.users}</div>
                    <div className="wr-body">
                      <div className="wr-label">Crew expected</div>
                      <div className="wr-val">18 across 4 subs</div>
                    </div>
                  </div>
                  <div className="wth-row">
                    <div className="wth-ic">{I.alert}</div>
                    <div className="wr-body">
                      <div className="wr-label">Open RFIs on today's work</div>
                      <div className="wr-val">2 — both East corridor</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn pri sm full" onClick={() => setDrawer("create")}>{I.plus} Log today</button>
                  </div>
                </div>
              </div>

              {/* Week summary */}
              <div className="cd">
                <div className="cd-h"><div><div className="cd-title">This week</div></div></div>
                <div className="cd-body" style={{ paddingTop: 8 }}>
                  <div className="mini-row"><span className="mr-l">Logs submitted</span><span className="mr-r">5 / 5</span></div>
                  <div className="mini-row"><span className="mr-l">Total crew-hours</span><span className="mr-r mono">892</span></div>
                  <div className="mini-row"><span className="mr-l">Delay hours</span><span className="mr-r mono">6.5</span></div>
                  <div className="mini-row"><span className="mr-l">Photos captured</span><span className="mr-r mono">47</span></div>
                  <div className="mini-row"><span className="mr-l">Inspections</span><span className="mr-r">1 passed</span></div>
                </div>
              </div>

              {/* Amendments */}
              <div className="cd">
                <div className="cd-h"><div><div className="cd-title">Recent amendments</div><div className="cd-sub">Post-24hr edits</div></div></div>
                <div className="cd-body" style={{ paddingTop: 8 }}>
                  <div className="amd-row" onClick={() => setDrawer("detail")}>
                    <h5>DL-0077 · Tue Apr 16</h5>
                    <p>Crew-hours breakdown updated for Peak Plumbing (+4 hrs after timesheet reconciliation).</p>
                    <div className="amd-meta">
                      <span className="pl amber">Pending review</span>
                      <span style={{ fontSize: 11, color: "var(--t3)" }}>Amended 2h ago</span>
                    </div>
                  </div>
                  <div className="amd-row">
                    <h5>DL-0071 · Mon Apr 8</h5>
                    <p>Delay category corrected — was logged as weather, actually subcontractor no-show.</p>
                    <div className="amd-meta">
                      <span className="pl green">Approved</span>
                      <span style={{ fontSize: 11, color: "var(--t3)" }}>Apr 10</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Drawer ── */}
      {drawer && <div className="drawer-ovl" onClick={() => setDrawer(null)}/>}
      {drawer === "detail" && (
        <aside className="drawer">
          <div className="dr-head">
            <div className="dr-head-l">
              <h2>{detailLog.dateFull}</h2>
              <div className="dh-meta">
                <span className="mono">{detailLog.id}</span>
                <span>·</span>
                <span>Reported by {detailLog.author}</span>
                <span>·</span>
                <span className="pl green" style={{ height: 20 }}>Submitted</span>
                {detailLog.editable && <span className="pl amber" style={{ height: 20 }}>{I.clock} {detailLog.hoursLeft}h edit window</span>}
              </div>
            </div>
            <button className="dr-close" onClick={() => setDrawer(null)}>{I.x}</button>
          </div>
          <div className="dr-body">
            {/* Weather */}
            <div className="sec">
              <div className="sec-h">{I.cloud} Weather</div>
              <div className="wx-grid">
                <div className="wx-cell"><div className="wxl">Conditions</div><div className="wxv">{detailLog.weatherDetail.conditions}</div></div>
                <div className="wx-cell"><div className="wxl">High</div><div className="wxv">{detailLog.weatherDetail.high}</div></div>
                <div className="wx-cell"><div className="wxl">Low</div><div className="wxv">{detailLog.weatherDetail.low}</div></div>
                <div className="wx-cell"><div className="wxl">Precip</div><div className="wxv">{detailLog.weatherDetail.precip}</div></div>
                <div className="wx-cell"><div className="wxl">Wind</div><div className="wxv">{detailLog.weatherDetail.wind}</div></div>
              </div>
            </div>

            {/* Crew */}
            <div className="sec">
              <div className="sec-h">{I.users} Crew on site</div>
              <table className="crew-tbl">
                <thead><tr><th>Org</th><th>Trade</th><th>Headcount</th><th>Hours</th></tr></thead>
                <tbody>
                  {detailLog.crewBreakdown.map((c) => (
                    <tr key={c.org}>
                      <td className="org">{c.org}</td>
                      <td className="trade">{c.trade}</td>
                      <td className="num">{c.headcount}</td>
                      <td className="num">{c.hours}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={2}>Total</td>
                    <td className="num">{detailLog.crewBreakdown.reduce((a, c) => a + c.headcount, 0)}</td>
                    <td className="num">{detailLog.crewBreakdown.reduce((a, c) => a + c.hours, 0)} hrs</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div className="sec">
              <div className="sec-h">{I.edit} Work performed</div>
              <div className="notes-body">{detailLog.notes}</div>
            </div>

            {/* Delays + issues */}
            <div className="sec">
              <div className="sec-h">{I.alert} Delays &amp; issues</div>
              {detailLog.delaysList.length === 0 && detailLog.issuesList.length === 0 && (
                <p style={{ fontSize: 12.5, color: "var(--t2)" }}>None logged.</p>
              )}
              {detailLog.issuesList.map((x, i) => (
                <div key={i} className="issue-row">
                  <span className="ir-ic">{I.alert}</span>
                  <div>
                    <h6>{x.type}</h6>
                    <p>{x.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Photos */}
            <div className="sec">
              <div className="sec-h">{I.camera} Photos ({detailLog.photosList.length})</div>
              <div className="ph-grid">
                {detailLog.photosList.map((p) => (
                  <div key={p.id} className="ph-tile">
                    {I.camera}
                    <div className="ph-cap">{p.caption}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit */}
            <div className="sec">
              <div className="sec-h">{I.clock} Activity</div>
              {detailLog.audit.map((a, i) => (
                <div key={i} className="aud-row">
                  <div className="au-at">{a.at}</div>
                  <div>
                    <div className="au-by">{a.by}</div>
                    <div className="au-ac">{a.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="dr-foot">
            <button className="btn ghost" onClick={() => setDrawer(null)}>Close</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn">{I.file} Download PDF</button>
              {detailLog.editable ? (
                <button className="btn pri">{I.edit} Edit log</button>
              ) : (
                <button className="btn pri" onClick={() => setDrawer("amend")}>{I.edit} Request amendment</button>
              )}
            </div>
          </div>
        </aside>
      )}

      {drawer === "create" && (
        <aside className="drawer">
          <div className="dr-head">
            <div className="dr-head-l">
              <h2>New daily log</h2>
              <div className="dh-meta">
                <span>{project.name}</span>
                <span>·</span>
                <span>Thursday, April 18, 2026</span>
              </div>
            </div>
            <button className="dr-close" onClick={() => setDrawer(null)}>{I.x}</button>
          </div>
          <div className="dr-body">
            <div className="sec">
              <div className="sec-h">{I.cloud} Weather</div>
              <div className="form-grid">
                <div className="field"><label>Conditions</label><select defaultValue="Partly cloudy"><option>Clear</option><option>Partly cloudy</option><option>Overcast</option><option>Light rain</option><option>Heavy rain</option><option>Snow</option></select></div>
                <div className="field"><label>Precipitation %</label><input defaultValue="10"/></div>
                <div className="field"><label>High (°C)</label><input defaultValue="14"/></div>
                <div className="field"><label>Low (°C)</label><input defaultValue="8"/></div>
              </div>
            </div>

            <div className="sec">
              <div className="sec-h">{I.users} Crew on site</div>
              <table className="crew-tbl">
                <thead><tr><th>Org</th><th>Trade</th><th>Headcount</th><th>Hours</th></tr></thead>
                <tbody>
                  <tr><td className="org">Summit Electrical</td><td className="trade">Electrical</td><td><input defaultValue="6" style={{ width: 60, padding: "4px 8px", border: "1px solid var(--s3)", borderRadius: 6, fontFamily: "var(--fd)", fontSize: 13, textAlign: "right" }}/></td><td><input defaultValue="48" style={{ width: 60, padding: "4px 8px", border: "1px solid var(--s3)", borderRadius: 6, fontFamily: "var(--fd)", fontSize: 13, textAlign: "right" }}/></td></tr>
                  <tr><td className="org">Peak Plumbing</td><td className="trade">Plumbing</td><td><input defaultValue="4" style={{ width: 60, padding: "4px 8px", border: "1px solid var(--s3)", borderRadius: 6, fontFamily: "var(--fd)", fontSize: 13, textAlign: "right" }}/></td><td><input defaultValue="32" style={{ width: 60, padding: "4px 8px", border: "1px solid var(--s3)", borderRadius: 6, fontFamily: "var(--fd)", fontSize: 13, textAlign: "right" }}/></td></tr>
                  <tr><td className="org">Northwind HVAC</td><td className="trade">Mechanical</td><td><input defaultValue="5" style={{ width: 60, padding: "4px 8px", border: "1px solid var(--s3)", borderRadius: 6, fontFamily: "var(--fd)", fontSize: 13, textAlign: "right" }}/></td><td><input defaultValue="40" style={{ width: 60, padding: "4px 8px", border: "1px solid var(--s3)", borderRadius: 6, fontFamily: "var(--fd)", fontSize: 13, textAlign: "right" }}/></td></tr>
                  <tr><td colSpan={4}><span className="add-chip">{I.plus} Add sub org</span></td></tr>
                </tbody>
              </table>
            </div>

            <div className="sec">
              <div className="sec-h">{I.edit} Work performed</div>
              <div className="field"><textarea placeholder="What was accomplished today. Include scope completed, areas worked, materials delivered, and any coordination items…"/></div>
            </div>

            <div className="sec">
              <div className="sec-h">{I.alert} Delays &amp; issues</div>
              <p style={{ fontSize: 12.5, color: "var(--t2)", marginBottom: 10 }}>None yet.</p>
              <span className="add-chip">{I.plus} Log a delay or issue</span>
            </div>

            <div className="sec">
              <div className="sec-h">{I.camera} Photos</div>
              <div className="ph-grid">
                <div className="ph-tile" style={{ borderStyle: "dashed", background: "var(--sic)" }}>
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--t2)", padding: "0 8px" }}>
                    {I.plus}<div style={{ marginTop: 4 }}>Add photos</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="dr-foot">
            <button className="btn ghost" onClick={() => setDrawer(null)}>Save draft</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setDrawer(null)}>Cancel</button>
              <button className="btn pri">Submit log</button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
