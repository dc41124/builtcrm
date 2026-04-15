import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  upload: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 4.5v5c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12v-5L12 2z"/><path d="M12 8v4"/><circle cx="12" cy="15" r=".5" fill="currentColor"/></svg>,
  chev: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  msg: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
};

// ── Logo Mark (Option F — three overlapping rects) ─────────────
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
    { label: "Today Board", active: true },
    { label: "RFIs & Questions", badge: 3 },
    { label: "Upload Requests", badge: 2, badgeType: "warn" },
    { label: "Schedule" },
    { label: "Documents" },
  ]},
  { title: "Money", items: [
    { label: "POs & Payments" },
  ]},
  { title: "Compliance", items: [
    { label: "Insurance & Certs", badge: 1, badgeType: "danger" },
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
  { name: "Riverside Tower", trade: "Elec", color: "var(--wr)", active: true },
  { name: "West End Medical", trade: "Elec", color: "var(--ok)" },
  { name: "Northline Office", trade: "Elec", color: "var(--ok)" },
];

// ── Page Data ───────────────────────────────────────────────────
const kpis = [
  { label: "Active projects", value: "3", meta: "All electrical scope" },
  { label: "GC requests open", value: "3", meta: "1 due today", metaType: "warn" },
  { label: "RFIs needing reply", value: "2", meta: "1 overdue", metaType: "danger" },
  { label: "Payments pending", value: "C$84K", meta: "Across 2 projects", mono: false },
  { label: "Compliance", value: "1", meta: "Insurance expiring today", metaType: "danger", alert: true },
];

const attentionTabs = ["All", "Riverside", "West End", "Northline"];

const attentionItems = [
  { title: "Upload revised switch schedule", desc: "GC requested before internal review window closes this afternoon.", project: "Riverside", pill: "Due 2 PM", pillType: "red", urgent: true },
  { title: "Respond to RFI-012 — conduit routing", desc: "Clarify east corridor routing after yesterday's field coordination note.", project: "West End", pill: "Today", pillType: "amber" },
  { title: "Upload progress photos — electrical room", desc: "Level 4 electrical room and corridor completion shots for owner update pack.", project: "Northline", pill: "Open", pillType: "blue" },
  { title: "Respond to RFI-019 — panel labeling", desc: "Updated naming convention tied to latest drawing revision.", project: "West End", pill: "Overdue", pillType: "amber" },
  { title: "Submit lien waiver — Draw #7", desc: "Conditional progress waiver for $44,400 electrical scope.", project: "Riverside", pill: "Requested", pillType: "blue" },
];

const projectStatus = [
  { name: "Riverside Tower Fit-Out", desc: "East corridor rough-in closeout. Switch schedule upload blocking GC release.", pill: "1 blocker", pillType: "amber", phase: "Phase 3" },
  { name: "West End Medical", desc: "Panel room work active. 2 RFIs need response.", pill: "2 RFIs", pillType: "amber", phase: "Phase 2" },
  { name: "Northline Office Park", desc: "On track — structural framing area ready for electrical rough-in next week.", pill: "On track", pillType: "green", phase: "Phase 1" },
];

const complianceItems = [
  { label: "General liability insurance", detail: "Expires today · renewal upload required", status: "Expiring", statusType: "red" },
  { label: "Workers compensation", detail: "Valid through Dec 2026", status: "Active", statusType: "green" },
  { label: "W-9", detail: "On file", status: "Active", statusType: "green" },
];

const payments = [
  { label: "Riverside · PO-244", amount: "C$42,000", status: "revision pending", statusPill: "Pending", statusType: "amber" },
  { label: "West End · progress payment", amount: "C$42,000", status: "Expected after review cycle closes", statusPill: "On track", statusType: "green" },
];

const gcContacts = [
  { initials: "DC", name: "Daniel Chen", role: "PM · Riverside & West End", gradient: "linear-gradient(135deg,#5b4fc7,#7c6fe0)" },
  { initials: "SK", name: "Sarah Kim", role: "Super · Northline", gradient: "linear-gradient(135deg,#2d8a5e,#4caf7a)" },
];

// ── Component ───────────────────────────────────────────────────
export default function SubcontractorTodayBoard() {
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [collapsed, setCollapsed] = useState({});

  const toggleSection = (title) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));

  const filteredItems = activeTab === "All"
    ? attentionItems
    : attentionItems.filter((i) => i.project === activeTab);

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
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
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
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
}

*,*::before,*::after{box-sizing:border-box;margin:0}

/* ── Sidebar ─────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-txt h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.brand-txt p{font-size:11.5px;color:var(--t3);line-height:1.2;margin-top:1px}

/* Compliance banner */
.sb-comp{margin:12px 12px 0;padding:10px 14px;border-radius:var(--r-l);display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--wr-s);border:1px solid rgba(193,122,26,.25)}
.sb-comp-icon{width:28px;height:28px;border-radius:var(--r-s);background:rgba(193,122,26,.15);color:var(--wr-t);display:grid;place-items:center;flex-shrink:0}
.sb-comp-txt h4{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--wr-t)}
.sb-comp-txt p{font-size:11px;color:var(--t2)}

.s-search{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
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

.np{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 12px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;margin-bottom:1px;transition:all var(--df) var(--e)}
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
.tb-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#5a8ab0);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;cursor:pointer;margin-left:4px}

/* ── Content ─────────────────────────────────────── */
.ct{padding:24px;flex:1}

/* Page header */
.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px}
.pg-t{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;line-height:1.15}
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
.pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;white-space:nowrap;font-family:var(--fd)}
.pl.red{background:var(--dg-s);color:var(--dg-t)}
.pl.amber{background:var(--wr-s);color:var(--wr-t)}
.pl.green{background:var(--ok-s);color:var(--ok-t)}
.pl.blue{background:var(--ac-s);color:var(--ac-t)}
.pl.gray{background:var(--s2);color:var(--t2)}

/* KPI strip */
.kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.kpi{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;transition:all var(--dn) var(--e)}
.kpi:hover{box-shadow:var(--shmd)}
.kpi.alert{border-color:var(--dg);border-width:1.5px}
.kpi-label{font-family:var(--fb);font-size:12px;font-weight:560;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.kpi-val{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.kpi-meta{font-family:var(--fb);font-size:12px;font-weight:580;color:var(--t2);margin-top:4px}
.kpi-trend{font-weight:720;font-size:11.5px}
.kpi-trend.warn{color:var(--wr-t)}
.kpi-trend.danger{color:var(--dg-t)}

/* Dashboard grid */
.dash{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.dash-main{display:flex;flex-direction:column;gap:16px}
.dash-rail{display:flex;flex-direction:column;gap:16px}

/* Card */
.cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.cd-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
.cd-title{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em}
.cd-sub{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin-top:2px}
.cd-body{padding:16px 20px}

/* Card tabs */
.cd-tabs{display:flex;padding:0 20px;border-bottom:1px solid var(--s3);background:var(--sic)}
.cd-tab{padding:10px 14px;font-size:13px;font-weight:620;color:var(--t3);cursor:pointer;border:none;border-bottom:2px solid transparent;transition:all var(--df);margin-bottom:-1px;white-space:nowrap;background:none;font-family:var(--fb)}
.cd-tab:hover{color:var(--t2)}
.cd-tab.on{color:var(--t1);font-weight:720;border-bottom-color:var(--ac)}

/* List rows */
.lr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 16px;border-radius:var(--r-m);cursor:pointer;transition:background var(--df)}
.lr:hover{background:var(--sic)}
.lr+.lr{border-top:1px solid var(--s3)}
.lr.urg{border-left:3px solid var(--dg);padding-left:13px}
.lr h5{font-family:var(--fd);font-size:13.5px;font-weight:600;letter-spacing:-.01em;line-height:1.3}
.lr p{font-size:12.5px;color:var(--t2);margin-top:2px;line-height:1.4}
.lr-meta{display:flex;align-items:center;gap:8px;flex-shrink:0}
.proj-tag{font-size:10.5px;font-weight:620;color:var(--ac-t);background:var(--ac-s);padding:2px 7px;border-radius:4px;white-space:nowrap;font-family:var(--fd)}

/* Compliance card */
.cd.comp-warn{border-color:var(--wr);border-width:1.5px}
.cd.comp-warn .cd-h{border-bottom-color:rgba(193,122,26,.15)}
.comp-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0}
.comp-row+.comp-row{border-top:1px solid var(--s3)}
.comp-info h5{font-family:var(--fd);font-size:13px;font-weight:600}
.comp-info p{font-size:12px;color:var(--t2)}

/* Payment rows */
.pay-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0}
.pay-row+.pay-row{border-top:1px solid var(--s3)}
.pay-label{font-size:13px;color:var(--t2)}
.pay-val{font-family:var(--fd);font-size:14px;font-weight:700}
.pay-row.total .pay-label{font-weight:650;color:var(--t1)}
.pay-row.total .pay-val{font-family:var(--fd);font-size:15px;font-weight:820}
.pay-status{font-size:11.5px;color:var(--t3)}
.time-label{font-size:11.5px;color:var(--t3);font-weight:530;white-space:nowrap}

/* GC contacts */
.gc-row{display:flex;align-items:center;gap:12px;padding:6px 0}
.gc-row+.gc-row{border-top:1px solid var(--s3)}
.gc-av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;color:white;flex-shrink:0}
.gc-name{font-size:13px;font-weight:600}
.gc-role{font-size:12px;color:var(--t2)}

/* ── Animations ──────────────────────────────────── */
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.ct>*{animation:fadeUp 350ms var(--e) both}
.ct>*:nth-child(1){animation-delay:0ms}
.ct>*:nth-child(2){animation-delay:60ms}
.ct>*:nth-child(3){animation-delay:120ms}

/* ── Responsive ──────────────────────────────────── */
@media(max-width:1280px){.kpi-strip{grid-template-columns:repeat(3,1fr)}.dash{grid-template-columns:1fr}}
@media(max-width:900px){.root{grid-template-columns:1fr}.side{display:none}.kpi-strip{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div className="brand-txt">
            <h1>BuiltCRM</h1>
            <p>Northline Electrical</p>
          </div>
        </div>

        {/* Compliance banner */}
        <div className="sb-comp">
          <div className="sb-comp-icon">{I.shield}</div>
          <div className="sb-comp-txt">
            <h4>Insurance expiring today</h4>
            <p>Upload renewal to maintain access</p>
          </div>
        </div>

        <div className="s-search">
          <input className="s-input" placeholder="Search across projects…" readOnly />
        </div>

        <nav className="s-nav">
          {navSections.map((sec) => (
            <div className="ns" key={sec.title}>
              <div className="ns-h" onClick={() => toggleSection(sec.title)}>
                <span className={`ns-chv${collapsed[sec.title] ? " closed" : ""}`}>{I.chev}</span>
                {sec.title}
              </div>
              {!collapsed[sec.title] && (
                <div>
                  {sec.items.map((item) => (
                    <div key={item.label} className={`ni${item.active ? " on" : ""}`}>
                      <span>{item.label}</span>
                      {item.badge != null && (
                        <span className={`ni-badge${item.badgeType === "warn" ? " warn" : item.badgeType === "danger" ? " danger" : ""}`}>{item.badge}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Projects section */}
          <div className="ns">
            <div className="ns-h" onClick={() => toggleSection("Projects")}>
              <span className={`ns-chv${collapsed["Projects"] ? " closed" : ""}`}>{I.chev}</span>
              Projects
            </div>
            {!collapsed["Projects"] && (
              <div>
                {sidebarProjects.map((p) => (
                  <div key={p.name} className={`np${p.active ? " on" : ""}`}>
                    <span className="np-dot" style={{ background: p.color }} />
                    <span>{p.name}</span>
                    <span className="np-trade">{p.trade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="s-foot">
          <div className="s-user">
            <div className="u-av">JT</div>
            <div>
              <div className="u-name">Jake Torres</div>
              <div className="u-role">Field Coordinator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────── */}
      <main className="mn">
        <div className="topbar">
          <div className="bc">
            <span>Subcontractor Portal</span>
            <span className="sep">›</span>
            <span className="cur">Today Board</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Toggle theme">
              {dark ? I.sun : I.moon}
            </button>
            <button className="ib nd" aria-label="Notifications">{I.bell}</button>
            <div className="tb-av">JT</div>
          </div>
        </div>

        <div className="ct">
          {/* Page header */}
          <div className="pg-h">
            <div>
              <h1 className="pg-t">Today Board</h1>
              <p className="pg-sub">What the GC needs from you, what's due, and where things stand across your projects.</p>
            </div>
            <div className="pg-acts">
              <button className="btn">{I.upload} Upload File</button>
              <button className="btn pri">Open GC Requests</button>
            </div>
          </div>

          {/* KPI strip */}
          <section className="kpi-strip">
            {kpis.map((k) => (
              <div key={k.label} className={`kpi${k.alert ? " alert" : ""}`}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-val">{k.value}</div>
                <div className="kpi-meta">
                  {k.metaType ? (
                    <span className={`kpi-trend ${k.metaType === "warn" ? "warn" : "danger"}`}>{k.meta}</span>
                  ) : (
                    k.meta
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Dashboard grid */}
          <section className="dash">
            <div className="dash-main">
              {/* What needs your attention */}
              <div className="cd">
                <div className="cd-h">
                  <div>
                    <div className="cd-title">What needs your attention</div>
                    <div className="cd-sub">GC requests and tasks across all projects</div>
                  </div>
                  <button className="btn ghost" style={{ fontSize: 12 }}>View all</button>
                </div>
                <div className="cd-tabs">
                  {attentionTabs.map((tab) => (
                    <div
                      key={tab}
                      className={`cd-tab${activeTab === tab ? " on" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </div>
                  ))}
                </div>
                <div className="cd-body">
                  {filteredItems.map((item) => (
                    <div key={item.title} className={`lr${item.urgent ? " urg" : ""}`}>
                      <div>
                        <h5>{item.title}</h5>
                        <p>{item.desc}</p>
                      </div>
                      <div className="lr-meta">
                        <span className="proj-tag">{item.project}</span>
                        <span className={`pl ${item.pillType}`}>{item.pill}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your projects */}
              <div className="cd">
                <div className="cd-h">
                  <div>
                    <div className="cd-title">Your projects</div>
                    <div className="cd-sub">Status across your active assignments</div>
                  </div>
                </div>
                <div className="cd-body">
                  {projectStatus.map((proj) => (
                    <div key={proj.name} className="lr">
                      <div>
                        <h5>{proj.name}</h5>
                        <p>{proj.desc}</p>
                      </div>
                      <div className="lr-meta">
                        <span className={`pl ${proj.pillType}`}>{proj.pill}</span>
                        <span className="time-label">{proj.phase}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right rail */}
            <div className="dash-rail">
              {/* Compliance */}
              <div className="cd comp-warn">
                <div className="cd-h">
                  <div>
                    <div className="cd-title">Compliance</div>
                    <div className="cd-sub">Required for continued project access</div>
                  </div>
                </div>
                <div className="cd-body">
                  {complianceItems.map((c) => (
                    <div key={c.label} className="comp-row">
                      <div className="comp-info">
                        <h5>{c.label}</h5>
                        <p>{c.detail}</p>
                      </div>
                      <span className={`pl ${c.statusType}`}>{c.status}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <button className="btn pri sm full">Upload insurance renewal</button>
                  </div>
                </div>
              </div>

              {/* Payment status */}
              <div className="cd">
                <div className="cd-h">
                  <div><div className="cd-title">Payment status</div></div>
                </div>
                <div className="cd-body">
                  {payments.map((pay, idx) => (
                    <div key={pay.label}>
                      <div className="pay-row">
                        <span className="pay-label">{pay.label}</span>
                        <span className="pay-val">{pay.amount}</span>
                      </div>
                      <div className="pay-row">
                        <span className="pay-status">{pay.status}</span>
                        <span className={`pl ${pay.statusType}`} style={{ fontSize: 10, height: 20 }}>{pay.statusPill}</span>
                      </div>
                      {idx < payments.length - 1 && <div style={{ height: 12, borderTop: "1px solid var(--s3)", marginTop: 12 }} />}
                    </div>
                  ))}
                  <div style={{ height: 12, borderTop: "1px solid var(--s3)", marginTop: 12 }} />
                  <div className="pay-row total">
                    <span className="pay-label">Total pending</span>
                    <span className="pay-val">C$84,000</span>
                  </div>
                </div>
              </div>

              {/* GC contacts */}
              <div className="cd">
                <div className="cd-h">
                  <div><div className="cd-title">Your GC contacts</div></div>
                </div>
                <div className="cd-body">
                  {gcContacts.map((gc) => (
                    <div key={gc.initials} className="gc-row">
                      <div className="gc-av" style={{ background: gc.gradient }}>{gc.initials}</div>
                      <div>
                        <div className="gc-name">{gc.name}</div>
                        <div className="gc-role">{gc.role}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <button className="btn sm full">{I.msg} Message GC team</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
