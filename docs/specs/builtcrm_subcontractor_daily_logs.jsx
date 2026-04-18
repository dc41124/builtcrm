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
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  users: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  file: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
};

// ── Logo Mark ───────────────────────────────────────────────────
const Logo = ({ s = 30 }) => (
  <div style={{ width: s, height: s, borderRadius: s * 0.27, background: "linear-gradient(135deg,#2d4a5e,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.6} height={s * 0.6}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Sidebar Nav Data ────────────────────────────────────────────
const navSections = [
  { title: "Work", items: [
    { label: "Today Board" },
    { label: "Daily Logs", active: true },
    { label: "RFIs & Questions", badge: 3 },
    { label: "Upload Requests", badge: 2, badgeType: "warn" },
    { label: "Schedule" },
    { label: "Documents" },
  ]},
  { title: "Money", items: [
    { label: "POs & Payments" },
  ]},
  { title: "Compliance", items: [
    { label: "Insurance & Certs" },
  ]},
  { title: "Messages", items: [
    { label: "Inbox", badge: 5 },
  ]},
  { title: "Company", items: [
    { label: "Team" },
    { label: "Settings" },
  ]},
];

const sidebarProjects = [
  { name: "Riverside Tower", trade: "Elec", color: "var(--ac)", active: true },
  { name: "West End Medical", trade: "Elec", color: "var(--ok)" },
  { name: "Northline Office", trade: "Elec", color: "var(--ok)" },
];

// ── Page Data ───────────────────────────────────────────────────
const myOrg = "Summit Electrical";
const projectTabs = ["All projects", "Riverside Tower", "West End Medical", "Northline Office"];

// Today's crew entry status
const todayEntry = { submitted: false, date: "Thursday, Apr 18", defaultCrew: 6, defaultHours: 48 };

const kpis = [
  { label: "My crew-hours", value: "192", meta: "This week · 3 projects", metaType: "ok" },
  { label: "Entries submitted", value: "5 / 5", meta: "Last 5 work days", metaType: "ok" },
  { label: "Outstanding", value: "1", meta: "Today unsubmitted", metaType: "warn", alert: true },
  { label: "GC logs to review", value: "3", meta: "Posted this week" },
];

// Calendar for "All projects" — reflects my crew's activity
const calendarDays = [
  { d: 29, m: "prev" }, { d: 30, m: "prev" }, { d: 31, m: "prev" },
  { d: 1, st: 1 }, { d: 2, st: 1 }, { d: 3, st: 1 }, { d: 4, st: 0 },
  { d: 5, st: 0 }, { d: 6, st: 1 }, { d: 7, st: 1 }, { d: 8, st: 1 }, { d: 9, st: 1 }, { d: 10, st: 1 }, { d: 11, st: 0 },
  { d: 12, st: 0 }, { d: 13, st: 1 }, { d: 14, st: 1 }, { d: 15, st: 1 }, { d: 16, st: 1 }, { d: 17, st: 1 }, { d: 18, st: 3 },
  { d: 19, st: 0 }, { d: 20, st: 0 }, { d: 21, st: 0 }, { d: 22, st: 0 }, { d: 23, st: 0 }, { d: 24, st: 0 }, { d: 25, st: 0 },
  { d: 26, st: 0 }, { d: 27, st: 0 }, { d: 28, st: 0 }, { d: 29, st: 0 }, { d: 30, st: 0 },
];

// Logs — all with my crew's entry highlighted
const recentLogs = [
  { id: "DL-0078", project: "Riverside Tower", dateLabel: "Wed, Apr 17", dateShort: "Apr 17", weather: "Sunny · 16°", myCrew: 6, myHours: 48, myNote: "East corridor rough-in wrapped.", summary: "East corridor electrical rough-in wrapped. Plumbing crew started riser installation. HVAC trunk lines set in corridor.", mySubmitted: true, gcPosted: true },
  { id: "DL-0077", project: "Riverside Tower", dateLabel: "Tue, Apr 16", dateShort: "Apr 16", weather: "Overcast · 12°", myCrew: 6, myHours: 44, myNote: "Continued rough-in, held 2 hrs on exterior.", summary: "Electrical rough-in continues. Rain delay 2–3:30 PM on exterior.", mySubmitted: true, gcPosted: true, amended: true },
  { id: "DL-0061", project: "West End Medical", dateLabel: "Tue, Apr 16", dateShort: "Apr 16", weather: "Overcast · 12°", myCrew: 4, myHours: 32, myNote: "Panel room terminations.", summary: "Panel room work active — electrical terminations and inspection prep.", mySubmitted: true, gcPosted: true },
  { id: "DL-0076", project: "Riverside Tower", dateLabel: "Mon, Apr 15", dateShort: "Apr 15", weather: "Light rain · 10°", myCrew: 5, myHours: 40, myNote: "Panel room final terminations.", summary: "Interior work only. Panel room electrical completed final termination.", mySubmitted: true, gcPosted: true },
  { id: "DL-0075", project: "Riverside Tower", dateLabel: "Fri, Apr 12", dateShort: "Apr 12", weather: "Sunny · 18°", myCrew: 7, myHours: 56, myNote: "Full crew east corridor + inspection prep.", summary: "Full crew on site. Electrical, HVAC, plumbing progressing. Inspector visit passed pre-inspection.", mySubmitted: true, gcPosted: true },
  { id: "DL-0042", project: "Northline Office", dateLabel: "Thu, Apr 11", dateShort: "Apr 11", weather: "Partly cloudy · 15°", myCrew: 3, myHours: 24, myNote: "Site prep walkthrough.", summary: "Structural framing area ready for electrical rough-in next week.", mySubmitted: true, gcPosted: true },
];

const detailLog = {
  ...recentLogs[0],
  dateFull: "Wednesday, April 17, 2026",
  weatherDetail: { conditions: "Sunny", high: "16°C", low: "9°C", precip: "0%", wind: "12 km/h SW" },
  crewBreakdown: [
    { org: "Summit Electrical", trade: "Electrical", headcount: 6, hours: 48, mine: true },
    { org: "Peak Plumbing", trade: "Plumbing", headcount: 4, hours: 32 },
    { org: "Northwind HVAC", trade: "Mechanical", headcount: 5, hours: 40 },
    { org: "Orbit Drywall", trade: "Drywall", headcount: 4, hours: 32 },
  ],
  gcNotes: "East corridor electrical rough-in completed on schedule — all branch circuits terminated into Panel EC-04 and EC-05, ready for inspection Friday. Plumbing crew began riser installation on floors 3 and 4. HVAC mechanical trunk lines were set in corridor ceiling; duct insulation to follow Monday.",
  myNoteFull: "East corridor rough-in wrapped. Panels EC-04 and EC-05 both terminated and ready for inspection. No material shortages or coordination issues with other trades today.",
  gcPhotos: 8,
};

// ── Component ───────────────────────────────────────────────────
export default function SubcontractorDailyLogs() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("list");
  const [drawer, setDrawer] = useState(null); // null | 'detail' | 'submit'
  const [activeTab, setActiveTab] = useState("All projects");
  const [collapsed, setCollapsed] = useState({});

  const toggleSection = (title) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));
  const filteredLogs = activeTab === "All projects" ? recentLogs : recentLogs.filter((l) => l.project === activeTab);

  return (
    <div className={`root ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.root{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sic:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;--ti:#faf9f7;
  --ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e6eff5;--ac-t:#2d5577;--ac-m:#b3cede;
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
  --ac:#5a8db5;--ac-h:#4e7ea3;--ac-s:#182838;--ac-t:#7eafd4;--ac-m:#2e4a60;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);--shlg:0 16px 48px rgba(0,0,0,.5);
}
*,*::before,*::after{box-sizing:border-box;margin:0}

.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-txt h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.brand-txt p{font-size:11.5px;color:var(--t3);line-height:1.2;margin-top:1px}
.s-search{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0;position:relative}
.s-search svg{position:absolute;left:28px;top:50%;transform:translateY(-50%);color:var(--t3)}
.s-input{width:100%;height:34px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px 0 34px;background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.s-input:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(61,107,142,.15)}
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
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#5a8ab0);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:580}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

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
.tb-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#5a8ab0);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;cursor:pointer;margin-left:4px}

.ct{padding:24px;flex:1}
.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px}
.pg-t{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;line-height:1.15}
.pg-sub{margin-top:6px;font-size:14px;font-weight:520;color:var(--t2);max-width:640px}
.pg-acts{display:flex;gap:8px;flex-shrink:0;padding-top:2px}

.btn{height:38px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:13px;font-weight:650;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);color:var(--ti);border-color:var(--ac)}
.btn.pri:hover{background:var(--ac-h)}
.btn svg{width:15px;height:15px;flex-shrink:0}
.btn.sm{height:32px;font-size:12px;padding:0 12px}
.btn.ghost{background:transparent;border-color:transparent;color:var(--t2);font-weight:560}
.btn.ghost:hover{background:var(--sh);color:var(--t1)}
.btn.full{width:100%;justify-content:center}

.pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:var(--fd)}
.pl.red{background:var(--dg-s);color:var(--dg-t)}
.pl.amber{background:var(--wr-s);color:var(--wr-t)}
.pl.green{background:var(--ok-s);color:var(--ok-t)}
.pl.blue{background:var(--ac-s);color:var(--ac-t)}
.pl.gray{background:var(--s2);color:var(--t2)}
.pl svg{width:11px;height:11px}

/* Submit banner */
.sub-banner{background:linear-gradient(135deg,var(--wr-s),var(--s1));border:1.5px solid rgba(193,122,26,.3);border-radius:var(--r-xl);padding:18px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.sub-banner.ok{background:linear-gradient(135deg,var(--ok-s),var(--s1));border-color:rgba(45,138,94,.3)}
.sb-left{display:flex;align-items:center;gap:16px;flex:1;min-width:0}
.sb-icon{width:44px;height:44px;border-radius:var(--r-m);background:var(--s1);color:var(--wr-t);display:grid;place-items:center;flex-shrink:0;border:1px solid rgba(193,122,26,.3)}
.sub-banner.ok .sb-icon{color:var(--ok-t);border-color:rgba(45,138,94,.3)}
.sb-icon svg{width:22px;height:22px}
.sb-info h3{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.sb-info p{font-size:12.5px;color:var(--t2);margin-top:3px}

.kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
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

.dash{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.dash-main{display:flex;flex-direction:column;gap:16px}
.dash-rail{display:flex;flex-direction:column;gap:16px}

.cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.cd-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3);gap:12px}
.cd-title{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.cd-sub{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin-top:2px}
.cd-body{padding:16px 20px}
.cd-tabs{display:flex;padding:0 20px;border-bottom:1px solid var(--s3);background:var(--sic);overflow-x:auto}
.cd-tab{padding:10px 14px;font-size:13px;font-weight:600;color:var(--t3);cursor:pointer;border:none;border-bottom:2px solid transparent;transition:all var(--df);margin-bottom:-1px;white-space:nowrap;background:none;font-family:var(--fb)}
.cd-tab:hover{color:var(--t2)}
.cd-tab.on{color:var(--t1);font-weight:720;border-bottom-color:var(--ac)}

.vt{display:inline-flex;background:var(--s2);border-radius:var(--r-m);padding:3px;gap:2px}
.vt-btn{height:28px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:600;color:var(--t2);background:transparent;border:none;cursor:pointer;font-family:var(--fb);display:inline-flex;align-items:center;gap:5px}
.vt-btn.on{background:var(--s1);color:var(--t1);font-weight:700;box-shadow:var(--shsm)}

.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 4px}
.cal-nav{display:flex;align-items:center;gap:8px}
.cal-month{font-family:var(--fd);font-size:17px;font-weight:740;letter-spacing:-.02em}
.cal-arrow{width:28px;height:28px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);color:var(--t2);display:grid;place-items:center;cursor:pointer}
.cal-arrow:hover{background:var(--sh);color:var(--t1)}
.cal-arrow svg{width:12px;height:12px}
.cal-legend{display:flex;gap:14px;font-size:11.5px;color:var(--t2);font-weight:550;flex-wrap:wrap}
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
.cal-day.logged:hover{border-color:var(--ok)}
.cal-day.missed{background:var(--dg-s);color:var(--dg-t);border-color:rgba(201,59,59,.2)}
.cal-day.today{background:var(--wr-s);color:var(--wr-t);border:1.5px solid var(--wr);font-weight:820}

.log-row{display:grid;grid-template-columns:90px 1fr auto;gap:16px;padding:14px 0;border-top:1px solid var(--s3);cursor:pointer;transition:background var(--df);align-items:start}
.log-row:first-child{border-top:none}
.log-row:hover{background:var(--sic);margin:0 -20px;padding-left:20px;padding-right:20px}
.log-date{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);line-height:1.3}
.log-date .log-id{display:block;font-family:var(--fm);font-size:10.5px;font-weight:500;color:var(--t3);margin-top:3px}
.log-body h5{font-family:var(--fd);font-size:13.5px;font-weight:620;letter-spacing:-.005em;line-height:1.35;margin-bottom:4px}
.log-body .lb-mine{font-size:12.5px;color:var(--t2);line-height:1.5;margin-bottom:4px;padding:6px 10px;background:var(--ac-s);border-left:3px solid var(--ac);border-radius:0 var(--r-s) var(--r-s) 0}
.log-body .lb-mine strong{color:var(--ac-t);font-weight:700;font-family:var(--fd);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:2px}
.log-body .lb-gc{font-size:12.5px;color:var(--t2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.log-meta-row{display:flex;align-items:center;gap:10px;margin-top:7px;flex-wrap:wrap}
.log-mi{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--t2);font-weight:570}
.log-mi svg{color:var(--t3)}
.log-proj{font-size:10.5px;font-weight:640;color:var(--ac-t);background:var(--ac-s);padding:2px 7px;border-radius:4px;white-space:nowrap;font-family:var(--fd)}
.log-right{text-align:right;font-size:11.5px;color:var(--t3);font-weight:560;white-space:nowrap}
.log-right .lr-hrs{font-family:var(--fd);font-size:14px;font-weight:800;color:var(--t1)}
.log-right .lr-sub{font-size:11px;color:var(--t3);margin-top:2px}

/* Right rail mini-rows */
.mini-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px;border-bottom:1px solid var(--s3)}
.mini-row:last-child{border-bottom:none}
.mini-row .mr-l{color:var(--t2);font-weight:540}
.mini-row .mr-r{font-family:var(--fd);font-weight:680}
.mini-row .mr-r.mono{font-family:var(--fm);font-weight:560}

.proj-mini{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--s3)}
.proj-mini:last-child{border-bottom:none}
.proj-mini h5{font-family:var(--fd);font-size:13px;font-weight:620}
.proj-mini p{font-size:11.5px;color:var(--t3);margin-top:2px}
.proj-mini .pm-val{font-family:var(--fm);font-size:13px;font-weight:600;color:var(--t1)}

/* Drawer */
.drawer-ovl{position:fixed;inset:0;background:rgba(20,18,14,.4);backdrop-filter:blur(3px);z-index:100;display:${drawer ? 'block' : 'none'}}
.drawer{position:fixed;top:0;right:0;width:700px;max-width:100vw;height:100vh;background:var(--s1);z-index:101;display:${drawer ? 'flex' : 'none'};flex-direction:column;box-shadow:var(--shlg);border-left:1px solid var(--s3)}
.dr-head{padding:16px 24px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-shrink:0}
.dr-head-l h2{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.02em;line-height:1.2}
.dr-head-l .dh-meta{font-size:12.5px;color:var(--t2);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
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
.crew-tbl tr.mine td{background:var(--ac-s)}
.crew-tbl tr.mine td:first-child{border-left:3px solid var(--ac);padding-left:10px}
.crew-tbl td.org{font-weight:600;font-family:var(--fm);font-size:12.5px}
.crew-tbl td.trade{color:var(--t2);font-size:12px}
.crew-tbl td.num{font-family:var(--fd);font-weight:680}

.notes-body{font-size:13.5px;line-height:1.6;color:var(--t1);padding:12px 14px;background:var(--sic);border-left:3px solid var(--t3);border-radius:0 var(--r-m) var(--r-m) 0}
.notes-body.mine{border-left-color:var(--ac);background:var(--ac-s)}

.field label{display:block;font-family:var(--fd);font-size:11.5px;font-weight:680;color:var(--t2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
.field input,.field select,.field textarea{width:100%;border:1px solid var(--s3);background:var(--s1);border-radius:var(--r-m);padding:8px 12px;font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(61,107,142,.15)}
.field textarea{min-height:100px;resize:vertical;line-height:1.5}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}

@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.drawer{animation:slideIn .28s var(--e)}
      `}</style>

      <aside className="side">
        <div className="brand">
          <Logo s={30}/>
          <div className="brand-txt">
            <h1>BuiltCRM</h1>
            <p>Subcontractor Portal</p>
          </div>
        </div>
        <div className="s-search">{I.search}<input className="s-input" placeholder="Search…"/></div>
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
                  {it.badge && <span className={`ni-badge${it.badgeType === "warn" ? " warn" : ""}`}>{it.badge}</span>}
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
            <div className="u-av">JT</div>
            <div>
              <div className="u-name">Jamie Torres</div>
              <div className="u-role">{myOrg}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="mn">
        <div className="topbar">
          <div className="bc">
            <span>Work</span><span className="sep">/</span>
            <span className="cur">Daily Logs</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</button>
            <button className="ib nd">{I.bell}</button>
            <div className="tb-av">JT</div>
          </div>
        </div>

        <div className="ct">
          <div className="pg-h">
            <div>
              <h1 className="pg-t">Daily Logs</h1>
              <p className="pg-sub">Your crew's daily entries and the GC's posted logs for projects you're working on.</p>
            </div>
            <div className="pg-acts">
              <button className="btn">{I.file} Export crew hours</button>
              <button className="btn pri" onClick={() => setDrawer("submit")}>{I.plus} Submit today's crew</button>
            </div>
          </div>

          {/* Submit banner */}
          <div className={`sub-banner${todayEntry.submitted ? " ok" : ""}`}>
            <div className="sb-left">
              <div className="sb-icon">{todayEntry.submitted ? I.check : I.alert}</div>
              <div className="sb-info">
                <h3>{todayEntry.date} — {todayEntry.submitted ? "crew entry submitted" : "crew entry not yet submitted"}</h3>
                <p>
                  {todayEntry.submitted
                    ? "The GC will see your crew count and hours in today's daily log."
                    : "Submit your crew count and hours so the GC can include them in today's log. Takes ~1 minute."}
                </p>
              </div>
            </div>
            {!todayEntry.submitted && (
              <button className="btn pri" onClick={() => setDrawer("submit")}>{I.plus} Submit crew entry</button>
            )}
          </div>

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

          <section className="dash">
            <div className="dash-main">
              <div className="cd">
                <div className="cd-h">
                  <div>
                    <div className="cd-title">Log history</div>
                    <div className="cd-sub">Your crew's entries · GC logs for projects you're on</div>
                  </div>
                  <div className="vt">
                    <button className={`vt-btn${view === "calendar" ? " on" : ""}`} onClick={() => setView("calendar")}>{I.grid} Calendar</button>
                    <button className={`vt-btn${view === "list" ? " on" : ""}`} onClick={() => setView("list")}>{I.list} List</button>
                  </div>
                </div>
                <div className="cd-tabs">
                  {projectTabs.map((t) => (
                    <div key={t} className={`cd-tab${activeTab === t ? " on" : ""}`} onClick={() => setActiveTab(t)}>{t}</div>
                  ))}
                </div>
                <div className="cd-body">
                  {view === "calendar" ? (
                    <>
                      <div className="cal-head">
                        <div className="cal-nav">
                          <button className="cal-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg></button>
                          <div className="cal-month">April 2026</div>
                          <button className="cal-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg></button>
                        </div>
                        <div className="cal-legend">
                          <span><span className="sw" style={{ background: "var(--ok-s)", border: "1px solid rgba(45,138,94,.3)" }}/>My crew on site</span>
                          <span><span className="sw" style={{ background: "var(--s2)" }}/>Not scheduled</span>
                          <span><span className="sw" style={{ background: "var(--wr-s)", border: "1.5px solid var(--wr)" }}/>Today</span>
                        </div>
                      </div>
                      <div className="cal-grid">
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
                        {calendarDays.map((c, idx) => {
                          const cls = c.m === "prev" ? "prev" : c.st === 0 ? "weekend" : c.st === 1 ? "logged" : "today";
                          const foot = c.st === 1 ? "6 hrs" : c.st === 3 ? "Today" : "";
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
                      {filteredLogs.map((log) => (
                        <div key={log.id + log.project} className="log-row" onClick={() => setDrawer("detail")}>
                          <div className="log-date">{log.dateLabel}<span className="log-id">{log.id}</span></div>
                          <div className="log-body">
                            <div className="log-meta-row" style={{ marginTop: 0, marginBottom: 8 }}>
                              <span className="log-proj">{log.project}</span>
                              <span className="log-mi">{I.cloud} {log.weather}</span>
                            </div>
                            <div className="lb-mine">
                              <strong>Your crew</strong>
                              {log.myNote}
                            </div>
                            <div className="lb-gc" style={{ marginTop: 6 }}>
                              <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 640, textTransform: "uppercase", letterSpacing: ".04em", marginRight: 6 }}>GC log:</span>
                              {log.summary}
                            </div>
                          </div>
                          <div className="log-right">
                            <div className="lr-hrs">{log.myHours}<span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 550 }}> hrs</span></div>
                            <div className="lr-sub">{log.myCrew} crew</div>
                            {log.mySubmitted && <span className="pl green" style={{ marginTop: 6 }}>{I.check} Submitted</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="dash-rail">
              <div className="cd">
                <div className="cd-h"><div><div className="cd-title">This week</div><div className="cd-sub">{myOrg}</div></div></div>
                <div className="cd-body" style={{ paddingTop: 8 }}>
                  <div className="mini-row"><span className="mr-l">Crew-hours logged</span><span className="mr-r mono">192</span></div>
                  <div className="mini-row"><span className="mr-l">Entries submitted</span><span className="mr-r">5 / 5</span></div>
                  <div className="mini-row"><span className="mr-l">Avg daily crew</span><span className="mr-r">5.4</span></div>
                  <div className="mini-row"><span className="mr-l">GC amendments</span><span className="mr-r">1</span></div>
                </div>
              </div>

              <div className="cd">
                <div className="cd-h"><div><div className="cd-title">By project</div><div className="cd-sub">This week · crew-hours</div></div></div>
                <div className="cd-body" style={{ paddingTop: 8 }}>
                  <div className="proj-mini">
                    <div>
                      <h5>Riverside Tower</h5>
                      <p>3 days on site</p>
                    </div>
                    <span className="pm-val">136 h</span>
                  </div>
                  <div className="proj-mini">
                    <div>
                      <h5>West End Medical</h5>
                      <p>1 day on site</p>
                    </div>
                    <span className="pm-val">32 h</span>
                  </div>
                  <div className="proj-mini">
                    <div>
                      <h5>Northline Office</h5>
                      <p>1 day on site</p>
                    </div>
                    <span className="pm-val">24 h</span>
                  </div>
                </div>
              </div>

              <div className="cd">
                <div className="cd-h"><div><div className="cd-title">Recent from the GC</div></div></div>
                <div className="cd-body" style={{ paddingTop: 8 }}>
                  <div className="mini-row" style={{ display: "block", padding: "10px 0" }}>
                    <div style={{ fontFamily: "var(--fd)", fontWeight: 620, fontSize: 13 }}>DL-0077 amended</div>
                    <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 2, lineHeight: 1.4 }}>Your crew-hours reconciled (+4 hrs) after timesheet review.</div>
                    <span className="pl amber" style={{ marginTop: 6 }}>Review required</span>
                  </div>
                  <div className="mini-row" style={{ display: "block", padding: "10px 0" }}>
                    <div style={{ fontFamily: "var(--fd)", fontWeight: 620, fontSize: 13 }}>DL-0075 photo note</div>
                    <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 2, lineHeight: 1.4 }}>Inspector visit photos added referencing your panel room work.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Drawer */}
      {drawer && <div className="drawer-ovl" onClick={() => setDrawer(null)}/>}
      {drawer === "detail" && (
        <aside className="drawer">
          <div className="dr-head">
            <div className="dr-head-l">
              <h2>{detailLog.dateFull}</h2>
              <div className="dh-meta">
                <span className="log-proj">{detailLog.project}</span>
                <span className="mono">{detailLog.id}</span>
                <span>·</span>
                <span>GC: Daniel Chen</span>
                <span className="pl green" style={{ height: 20 }}>{I.check} Your crew submitted</span>
              </div>
            </div>
            <button className="dr-close" onClick={() => setDrawer(null)}>{I.x}</button>
          </div>
          <div className="dr-body">
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

            <div className="sec">
              <div className="sec-h">{I.users} Crew on site</div>
              <table className="crew-tbl">
                <thead><tr><th>Org</th><th>Trade</th><th>Headcount</th><th>Hours</th></tr></thead>
                <tbody>
                  {detailLog.crewBreakdown.map((c) => (
                    <tr key={c.org} className={c.mine ? "mine" : ""}>
                      <td className="org">{c.org}{c.mine && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--ac-t)", fontFamily: "var(--fd)", fontWeight: 700, letterSpacing: ".04em" }}>YOU</span>}</td>
                      <td className="trade">{c.trade}</td>
                      <td className="num">{c.headcount}</td>
                      <td className="num">{c.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sec">
              <div className="sec-h">Your note for this day</div>
              <div className="notes-body mine">{detailLog.myNoteFull}</div>
            </div>

            <div className="sec">
              <div className="sec-h">GC's work summary</div>
              <div className="notes-body">{detailLog.gcNotes}</div>
              <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 8 }}>{detailLog.gcPhotos} photos attached · view in the project docs.</p>
            </div>
          </div>
          <div className="dr-foot">
            <button className="btn ghost" onClick={() => setDrawer(null)}>Close</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn">{I.file} Download PDF</button>
              <button className="btn pri">Edit my entry</button>
            </div>
          </div>
        </aside>
      )}

      {drawer === "submit" && (
        <aside className="drawer">
          <div className="dr-head">
            <div className="dr-head-l">
              <h2>Submit today's crew entry</h2>
              <div className="dh-meta">
                <span>Thursday, April 18, 2026</span>
                <span>·</span>
                <span>{myOrg}</span>
              </div>
            </div>
            <button className="dr-close" onClick={() => setDrawer(null)}>{I.x}</button>
          </div>
          <div className="dr-body">
            <div className="sec">
              <div className="sec-h">Project</div>
              <div className="field">
                <select defaultValue="Riverside Tower">
                  <option>Riverside Tower</option>
                  <option>West End Medical</option>
                  <option>Northline Office</option>
                </select>
              </div>
            </div>

            <div className="sec">
              <div className="sec-h">{I.users} Crew</div>
              <div className="form-grid">
                <div className="field"><label>Headcount</label><input defaultValue={todayEntry.defaultCrew}/></div>
                <div className="field"><label>Total hours</label><input defaultValue={todayEntry.defaultHours}/></div>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 6 }}>Default pulled from your typical crew size. Adjust if anyone was off or added overtime.</p>
            </div>

            <div className="sec">
              <div className="sec-h">Work performed</div>
              <div className="field">
                <textarea placeholder="Short note for the GC — what your crew got done today. 1–3 sentences."/>
              </div>
            </div>

            <div className="sec">
              <div className="sec-h">{I.alert} Issues encountered</div>
              <p style={{ fontSize: 12.5, color: "var(--t2)", marginBottom: 8 }}>Optional — flag anything the GC should know (delays, material shortages, coordination conflicts).</p>
              <div className="field">
                <textarea style={{ minHeight: 60 }} placeholder="Leave blank if none."/>
              </div>
            </div>
          </div>
          <div className="dr-foot">
            <button className="btn ghost" onClick={() => setDrawer(null)}>Cancel</button>
            <button className="btn pri">{I.check} Submit entry</button>
          </div>
        </aside>
      )}
    </div>
  );
}
