import { useState } from "react";

// BuiltCRM — Draw Request Workspace (Contractor)
// File #13 of 24 — Phase 2 conversion from phase_3_billing_draw_workspace.html
// Single-portal contractor view: AIA G702/G703 billing draw workspace
// Font audit: DM Sans for all display/values/labels, JetBrains Mono only in G703 data table,
//   Instrument Sans for body text. 520 weight floor. No mono on currency outside tables.

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── G702 Summary Data ───────────────────────────────────────────
const g702Items = [
  { label: "1. Original contract sum", value: "$1,420,000" },
  { label: "2. Net change orders", value: "+$62,500", hint: "3 approved COs" },
  { label: "3. Contract sum to date", value: "$1,482,500" },
  { label: "4. Total completed & stored", value: "$921,350", hint: "62.1% of contract" },
  { label: "5. Total retainage", value: "$92,135", hint: "10% retainage rate" },
  { label: "6. Total earned less retainage", value: "$829,215" },
  { label: "7. Less previous certificates", value: "$644,815", hint: "Draws #1–6 approved" },
  { label: "8. Current payment due", value: "$184,400", highlight: true },
  { label: "9. Balance to finish + retainage", value: "$653,285" },
];

// ─── G703 Line Items ─────────────────────────────────────────────
const g703Lines = [
  { item: 1, desc: "General conditions", sched: "$142,000", prev: "$92,300", period: "$14,200", stored: "$0", total: "$106,500", pct: "75.0%", balance: "$35,500", ret: "$10,650" },
  { item: 2, desc: "Sitework & excavation", sched: "$186,000", prev: "$186,000", period: "$0", stored: "$0", total: "$186,000", pct: "100.0%", balance: "$0", ret: "$18,600" },
  { item: 3, desc: "Concrete & foundations", sched: "$224,000", prev: "$224,000", period: "$0", stored: "$0", total: "$224,000", pct: "100.0%", balance: "$0", ret: "$22,400" },
  { item: 4, desc: "Structural steel", sched: "$198,000", prev: "$138,600", period: "$29,700", stored: "$0", total: "$168,300", pct: "85.0%", balance: "$29,700", ret: "$16,830" },
  { item: 5, desc: "Mechanical / HVAC", sched: "$165,000", prev: "$49,500", period: "$41,250", stored: "$12,000", total: "$102,750", pct: "62.3%", balance: "$62,250", ret: "$10,275" },
  { item: 6, desc: "Electrical", sched: "$148,000", prev: "$37,000", period: "$44,400", stored: "$8,200", total: "$89,600", pct: "60.5%", balance: "$58,400", ret: "$8,960" },
  { item: 7, desc: "Interior finishes", sched: "$195,000", prev: "$0", period: "$24,000", stored: "$6,200", total: "$30,200", pct: "15.5%", balance: "$164,800", ret: "$3,020" },
  { item: 8, desc: "Plumbing", sched: "$100,000", prev: "$20,000", period: "$14,000", stored: "$0", total: "$34,000", pct: "34.0%", balance: "$66,000", ret: "$3,400" },
  { item: 9, desc: "Mechanical reroute", sched: "$42,500", prev: "$0", period: "$0", stored: "$0", total: "$0", pct: "0.0%", balance: "$42,500", ret: "$0", co: "CO-14" },
  { item: 10, desc: "Curtain wall upgrade", sched: "$62,000", prev: "$30,000", period: "$12,000", stored: "$0", total: "$42,000", pct: "67.7%", balance: "$20,000", ret: "$4,200", co: "CO-08" },
];

const g703Totals = { sched: "$1,462,500", prev: "$777,400", period: "$179,550", stored: "$26,400", total: "$983,350", pct: "67.2%", balance: "$479,150", ret: "$98,335" };

// ─── Lien Waivers ────────────────────────────────────────────────
const lienWaivers = [
  { name: "ProVolt Electric", type: "Conditional progress", amount: "$44,400", status: "Received" },
  { name: "Summit Mechanical", type: "Conditional progress", amount: "$41,250", status: "Requested" },
  { name: "Apex Interiors", type: "Conditional progress", amount: "$24,000", status: "Requested" },
  { name: "CoreForm Concrete", type: "Unconditional progress", amount: "$0", status: "Received" },
];

// ─── Package Documents ───────────────────────────────────────────
const packageDocs = [
  { name: "G702_Application_Draw7.pdf", type: "Generated · Cover sheet", tag: "Auto" },
  { name: "G703_Continuation_Draw7.pdf", type: "Generated · Line items", tag: "Auto" },
  { name: "progress_photos_mar2026.zip", type: "Uploaded · Milestone backup", tag: "Attached" },
  { name: "schedule_update_mar2026.pdf", type: "Uploaded · Schedule note", tag: "Attached" },
];

// ─── Retainage Data ──────────────────────────────────────────────
const retainageData = {
  onCompleted: "$89,555",
  onStored: "$2,640",
  totalHeld: "$92,195",
  released: "$0",
  netBalance: "$92,195",
};

// ─── Sidebar sections ───────────────────────────────────────────
const sidebarSections = [
  { title: "Core", items: [
    { label: "Dashboard" },
    { label: "Approvals", badge: 4 },
    { label: "Messages" },
  ]},
  { title: "Financials", items: [
    { label: "Budget Overview" },
    { label: "Draws & Billing", active: true, badge: 2, badgeWarn: true },
    { label: "Retainage" },
    { label: "Payment Tracking" },
  ]},
  { title: "Workflows", items: [
    { label: "RFIs" },
    { label: "Change Orders" },
    { label: "Compliance" },
    { label: "Documents" },
  ]},
];

const projects = [
  { name: "Riverside Tower Fit-Out", phase: "PH 3", active: true, dot: "warning" },
  { name: "West End Medical", phase: "PH 2", dot: "success" },
];

// ─── Icon Helpers ────────────────────────────────────────────────
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>
);
const CardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
);
const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
);
const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const AttachIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

// ─── Logo Mark ───────────────────────────────────────────────────
const LogoMark = () => (
  <div style={{
    width: 30, height: 30, borderRadius: 8, position: "relative",
    background: "linear-gradient(135deg, #2c2541, var(--accent))",
    display: "grid", placeItems: "center", flexShrink: 0,
  }}>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="6" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.45)"/>
      <rect x="5" y="3" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.65)"/>
      <rect x="8" y="7" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.95)"/>
    </svg>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function BillingDrawWorkspace() {
  const [dark, setDark] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const toggleSection = (title) =>
    setCollapsedSections((p) => ({ ...p, [title]: !p[title] }));

  const t = dark ? "dark" : "light";

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{`
/* ═══ CSS CUSTOM PROPERTIES ═══════════════════════════════════ */
[data-theme="light"] {
  --surface-0:#eef0f3;--surface-1:#ffffff;--surface-2:#f3f4f6;--surface-3:#e2e5e9;--surface-4:#d1d5db;
  --surface-hover:#f5f6f8;--surface-incard:#f8f9fa;
  --sidebar-bg:#ffffff;--sidebar-hover:#f5f6f8;--sidebar-active:#eef0f3;--sidebar-active-text:#1a1714;
  --sidebar-section-text:#8b919a;--sidebar-item-text:#5a6170;--sidebar-border:#e8eaee;
  --text-primary:#1a1714;--text-secondary:#6b655b;--text-tertiary:#9c958a;
  --accent:#5b4fc7;--accent-hover:#4f44b3;--accent-soft:#eeedfb;--accent-text:#4a3fb0;
  --success:#2d8a5e;--success-soft:#edf7f1;--success-text:#1e6b46;
  --warning:#c17a1a;--warning-soft:#fdf4e6;--warning-text:#96600f;
  --danger:#c93b3b;--danger-soft:#fdeaea;--danger-text:#a52e2e;
  --info:#3178b9;--info-soft:#e8f1fa;--info-text:#276299;
  --co-row-bg:rgba(238,237,251,.35);
  --editable-bg:rgba(91,79,199,.04);
  --topbar-bg:rgba(238,240,243,.85);
}
[data-theme="dark"] {
  --surface-0:#0e0f11;--surface-1:#18191c;--surface-2:#1e2023;--surface-3:#2a2d31;--surface-4:#3a3e44;
  --surface-hover:#1f2124;--surface-incard:#1c1d20;
  --sidebar-bg:#141517;--sidebar-hover:#1c1d20;--sidebar-active:#1e2023;--sidebar-active-text:#f0ede8;
  --sidebar-section-text:#6b7280;--sidebar-item-text:#9ca3af;--sidebar-border:#232528;
  --text-primary:#f0ede8;--text-secondary:#a09a90;--text-tertiary:#706a60;
  --accent:#8b7ff5;--accent-hover:#9d93ff;--accent-soft:#1e1a3a;--accent-text:#b0a6ff;
  --success:#3aad72;--success-soft:#0f251a;--success-text:#5dd89a;
  --warning:#daa050;--warning-soft:#271d0b;--warning-text:#eab96e;
  --danger:#e25555;--danger-soft:#2a1010;--danger-text:#f28080;
  --info:#5a9fd4;--info-soft:#0d1a2a;--info-text:#80b8e8;
  --co-row-bg:rgba(30,26,58,.5);
  --editable-bg:rgba(139,127,245,.06);
  --topbar-bg:rgba(14,15,17,.85);
}

/* ═══ RESET ═══════════════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0}

/* ═══ LAYOUT ═════════════════════════════════════════════════ */
.billing-app{
  display:grid;grid-template-columns:272px 1fr;min-height:100vh;
  font-family:'Instrument Sans',system-ui,sans-serif;background:var(--surface-0);
  color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
}

/* ═══ SIDEBAR ════════════════════════════════════════════════ */
.bl-sidebar{
  background:var(--sidebar-bg);border-right:1px solid var(--sidebar-border);
  display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden;
}
.bl-brand{
  height:56px;display:flex;align-items:center;gap:12px;padding:0 16px 0 20px;
  border-bottom:1px solid var(--sidebar-border);flex-shrink:0;
}
.bl-brand-name{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.bl-brand-ctx{font-size:11.5px;color:var(--text-tertiary);line-height:1.2;margin-top:1px;font-weight:520}
.bl-sb-search{padding:12px 16px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.bl-sb-search-input{
  width:100%;height:34px;border:1px solid var(--surface-3);border-radius:10px;
  padding:0 12px 0 34px;background:var(--surface-1);font-family:'Instrument Sans',system-ui,sans-serif;
  font-size:13px;color:var(--text-primary);outline:none;font-weight:520;
}
.bl-sb-search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.bl-sb-search-wrap{position:relative}
.bl-sb-search-wrap svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}
.bl-sb-nav{flex:1;overflow-y:auto;padding:8px 12px 24px}
.bl-ns{margin-bottom:4px}
.bl-ns-h{
  display:flex;align-items:center;gap:8px;padding:8px;font-family:'DM Sans',system-ui,sans-serif;
  font-size:11px;font-weight:650;color:var(--sidebar-section-text);text-transform:uppercase;
  letter-spacing:.06em;cursor:pointer;border-radius:6px;border:none;background:none;width:100%;
}
.bl-ns-h:hover{background:var(--sidebar-hover)}
.bl-ns-chv{transition:transform .2s cubic-bezier(.16,1,.3,1)}
.bl-ns-chv.closed{transform:rotate(-90deg)}
.bl-ni{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:6px 10px 6px 12px;border-radius:10px;font-size:13px;font-weight:520;
  color:var(--sidebar-item-text);cursor:pointer;transition:all .12s;margin-bottom:1px;position:relative;
}
.bl-ni:hover{background:var(--sidebar-hover);color:var(--text-primary)}
.bl-ni.active{background:var(--sidebar-active);color:var(--sidebar-active-text);font-weight:620}
.bl-ni.active::before{
  content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);
  width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--accent);
}
.bl-ni-badge{
  min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:700;
  display:inline-flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif;
  flex-shrink:0;background:var(--accent-soft);color:var(--accent-text);
}
.bl-ni-badge.warn{background:var(--warning-soft);color:var(--warning-text)}
.bl-np{
  display:flex;align-items:center;gap:8px;padding:5px 10px 5px 12px;border-radius:10px;
  font-size:13px;font-weight:520;color:var(--text-secondary);cursor:pointer;margin-bottom:1px;
}
.bl-np:hover{background:var(--sidebar-hover);color:var(--text-primary)}
.bl-np.active{
  background:var(--surface-1);color:var(--text-primary);font-weight:580;
  border:1px solid var(--surface-3);box-shadow:0 1px 3px rgba(26,23,20,.05);
}
.bl-np-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.bl-np-dot.warning{background:var(--warning)}.bl-np-dot.success{background:var(--success)}
.bl-np-ph{font-size:10.5px;color:var(--text-tertiary);font-weight:550;letter-spacing:.02em;margin-left:auto;flex-shrink:0}
.bl-sb-foot{border-top:1px solid var(--sidebar-border);padding:12px 16px;flex-shrink:0}
.bl-sb-user{display:flex;align-items:center;gap:12px;padding:8px;border-radius:10px;cursor:pointer}
.bl-sb-user:hover{background:var(--sidebar-hover)}
.bl-u-av{
  width:30px;height:30px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent),#7c6fe0);color:#fff;display:grid;place-items:center;
  font-family:'DM Sans',system-ui,sans-serif;font-size:11.5px;font-weight:700;flex-shrink:0;
}

/* ═══ MAIN AREA ══════════════════════════════════════════════ */
.bl-main{min-width:0;display:flex;flex-direction:column}
.bl-topbar{
  height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;
  border-bottom:1px solid var(--surface-3);background:var(--topbar-bg);backdrop-filter:blur(12px);
  position:sticky;top:0;z-index:50;
}
.bl-bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-tertiary);font-weight:520}
.bl-bc-cur{color:var(--text-primary);font-weight:620}
.bl-bc-sep{font-size:11px;color:var(--surface-4)}
.bl-tb-acts{display:flex;align-items:center;gap:8px}
.bl-tb-btn{
  width:34px;height:34px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);
  color:var(--text-tertiary);display:grid;place-items:center;cursor:pointer;
}
.bl-tb-btn:hover{background:var(--surface-hover);border-color:var(--surface-4)}
.bl-tb-av{
  width:32px;height:32px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent),#7c6fe0);color:#fff;display:grid;place-items:center;
  font-family:'DM Sans',system-ui,sans-serif;font-size:11.5px;font-weight:700;cursor:pointer;margin-left:4px;
}
.bl-content{padding:24px;flex:1}

/* ═══ DARK MODE TOGGLE ═══════════════════════════════════════ */
.bl-dark-toggle{
  position:fixed;bottom:20px;right:20px;z-index:100;width:40px;height:40px;border-radius:50%;
  background:var(--surface-1);border:1px solid var(--surface-3);box-shadow:0 4px 16px rgba(0,0,0,.1);
  display:grid;place-items:center;cursor:pointer;font-size:16px;transition:all .2s;
}
.bl-dark-toggle:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(0,0,0,.15)}

/* ═══ BUTTONS ════════════════════════════════════════════════ */
.bl-btn{
  height:38px;padding:0 16px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);
  font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;font-weight:650;
  color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  transition:all .12s cubic-bezier(.16,1,.3,1);white-space:nowrap;
}
.bl-btn:hover{background:var(--surface-hover);border-color:var(--surface-4)}
.bl-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:650}
.bl-btn.primary:hover{background:var(--accent-hover)}
.bl-btn.ghost{background:transparent;border-color:transparent;color:var(--text-secondary)}
.bl-btn.ghost:hover{background:var(--surface-hover);color:var(--text-primary)}
.bl-btn.success{background:var(--success);border-color:var(--success);color:#fff;font-weight:650}
.bl-btn.success:hover{opacity:.9}
.bl-btn.sm{height:32px;padding:0 12px;font-size:12px}
.bl-btn.submitted{background:var(--success-soft);border-color:var(--success);color:var(--success-text);pointer-events:none}

/* ═══ PILLS (workflow: bordered, 10px, 700) ══════════════════ */
.bl-pill{
  height:22px;padding:0 8px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;
  font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap;
  border:1px solid transparent;
}
.bl-pill.red{background:var(--danger-soft);color:var(--danger-text);border-color:var(--danger-text)}
.bl-pill.amber{background:var(--warning-soft);color:var(--warning-text);border-color:var(--warning-text)}
.bl-pill.green{background:var(--success-soft);color:var(--success-text);border-color:var(--success-text)}
.bl-pill.blue{background:var(--info-soft);color:var(--info-text);border-color:var(--info-text)}
.bl-pill.purple{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent-text)}
.bl-pill.gray{background:var(--surface-2);color:var(--text-secondary);border-color:var(--surface-4)}

/* ═══ DRAW HEADER ════════════════════════════════════════════ */
.bl-draw-header{
  display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px;
}
.bl-draw-number{
  font-family:'DM Sans',system-ui,sans-serif;font-size:26px;font-weight:820;letter-spacing:-.035em;
}
.bl-draw-status-row{display:flex;gap:8px;align-items:center;margin-top:6px}
.bl-draw-meta-row{
  display:flex;gap:20px;margin-top:10px;font-size:13px;color:var(--text-secondary);flex-wrap:wrap;font-weight:520;
}
.bl-draw-meta-row strong{font-weight:620;color:var(--text-primary)}
.bl-draw-actions{display:flex;gap:8px;flex-shrink:0;padding-top:2px}

/* ═══ G702 SUMMARY ═══════════════════════════════════════════ */
.bl-g702{
  background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;
  padding:20px;margin-bottom:16px;
}
.bl-g702-title{
  font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:680;color:var(--text-tertiary);
  text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px;display:flex;align-items:center;gap:8px;
}
.bl-g702-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.bl-g702-item{
  padding:12px;border-radius:10px;background:var(--surface-incard);border:1px solid var(--surface-3);
}
.bl-g702-item.highlight{border-color:var(--accent);background:var(--accent-soft)}
.bl-g702-label{
  font-family:'DM Sans',system-ui,sans-serif;font-size:10.5px;font-weight:640;
  color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;
}
.bl-g702-value{
  font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:820;
  color:var(--text-primary);letter-spacing:-.02em;
}
.bl-g702-item.highlight .bl-g702-value{color:var(--accent-text)}
.bl-g702-hint{font-size:11px;color:var(--text-secondary);margin-top:2px;font-weight:520}

/* ═══ G703 TABLE ═════════════════════════════════════════════ */
.bl-g703-card{
  background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;
  overflow:hidden;margin-bottom:16px;
}
.bl-g703-header{
  display:flex;align-items:center;justify-content:space-between;padding:16px 20px;
  border-bottom:1px solid var(--surface-3);
}
.bl-g703-title{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:680;letter-spacing:-.01em}
.bl-g703-sub{font-size:12.5px;color:var(--text-tertiary);margin-top:2px;font-weight:520}
.bl-g703-wrap{overflow-x:auto}
.bl-g703-table{width:100%;border-collapse:collapse;font-size:13px;min-width:1000px}
.bl-g703-table thead{background:var(--surface-incard);position:sticky;top:0;z-index:2}
.bl-g703-table th{
  padding:10px 12px;text-align:left;font-family:'DM Sans',system-ui,sans-serif;
  font-size:10.5px;font-weight:680;color:var(--text-tertiary);text-transform:uppercase;
  letter-spacing:.04em;border-bottom:2px solid var(--surface-3);white-space:nowrap;
}
.bl-g703-table th.right,.bl-g703-table td.right{text-align:right}
.bl-g703-table th.center,.bl-g703-table td.center{text-align:center}
.bl-g703-table th.editable-col{background:var(--editable-bg)}
.bl-g703-table tbody tr{border-bottom:1px solid var(--surface-3);transition:background .12s}
.bl-g703-table tbody tr:hover{background:var(--surface-incard)}
.bl-g703-table tbody tr.co-row{background:var(--co-row-bg)}
.bl-g703-table tbody tr.co-row:hover{background:var(--co-row-bg)}
.bl-g703-table td{
  padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:12.5px;
  color:var(--text-primary);white-space:nowrap;font-weight:520;
}
.bl-g703-table td.desc{
  font-family:'Instrument Sans',system-ui,sans-serif;white-space:normal;max-width:220px;
  min-width:160px;font-weight:520;
}
.bl-g703-table td.editable{
  background:var(--editable-bg);border-left:2px solid var(--accent);font-weight:520;
}
.bl-g703-table td .co-tag{
  font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;
  color:var(--accent-text);background:var(--accent-soft);padding:1px 6px;border-radius:4px;
  margin-left:6px;border:1px solid var(--accent-text);
}
.bl-g703-table tfoot{background:var(--surface-incard);border-top:2px solid var(--surface-4)}
.bl-g703-table tfoot td{
  padding:12px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:520;
  color:var(--text-primary);
}
.bl-g703-table tfoot td.desc{font-family:'DM Sans',system-ui,sans-serif;font-weight:680}

/* ═══ BOTTOM GRID ════════════════════════════════════════════ */
.bl-bottom-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:start}
.bl-card{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;overflow:hidden}
.bl-c-head{
  display:flex;align-items:center;justify-content:space-between;padding:16px 20px;
  border-bottom:1px solid var(--surface-3);
}
.bl-c-title{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:680;letter-spacing:-.01em}
.bl-c-sub{font-size:12.5px;color:var(--text-tertiary);margin-top:2px;font-weight:520}
.bl-c-body{padding:16px 20px}

/* Retainage rows */
.bl-ret-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--surface-3)}
.bl-ret-row:last-child{border-bottom:none}
.bl-ret-label{font-size:13px;color:var(--text-secondary);font-weight:520}
.bl-ret-value{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:820;letter-spacing:-.02em}
.bl-ret-row.total .bl-ret-label{font-weight:650;color:var(--text-primary)}
.bl-ret-row.total .bl-ret-value{font-size:16px;font-weight:820;color:var(--text-primary)}

/* Lien waivers */
.bl-lw-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;
  border-bottom:1px solid var(--surface-3);
}
.bl-lw-row:last-child{border-bottom:none}
.bl-lw-name{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:620;line-height:1.3}
.bl-lw-detail{font-size:12px;color:var(--text-secondary);margin-top:1px;font-weight:520}

/* Document rows */
.bl-doc-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;
  border-bottom:1px solid var(--surface-3);
}
.bl-doc-row:last-child{border-bottom:none}
.bl-doc-name{font-size:13px;font-weight:560}
.bl-doc-type{font-size:11px;color:var(--text-tertiary);font-weight:520}

/* ═══ ANIMATIONS ═════════════════════════════════════════════ */
@keyframes bl-fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.bl-anim-1{animation:bl-fadeInUp .35s cubic-bezier(.16,1,.3,1) both;animation-delay:0ms}
.bl-anim-2{animation:bl-fadeInUp .35s cubic-bezier(.16,1,.3,1) both;animation-delay:60ms}
.bl-anim-3{animation:bl-fadeInUp .35s cubic-bezier(.16,1,.3,1) both;animation-delay:120ms}
.bl-anim-4{animation:bl-fadeInUp .35s cubic-bezier(.16,1,.3,1) both;animation-delay:180ms}

/* ═══ RESPONSIVE ═════════════════════════════════════════════ */
@media(max-width:1280px){
  .bl-g702-grid{grid-template-columns:repeat(2,1fr)}
  .bl-bottom-grid{grid-template-columns:1fr}
}
@media(max-width:900px){
  .billing-app{grid-template-columns:1fr}
  .bl-sidebar{display:none}
  .bl-draw-header{flex-direction:column}
  .bl-draw-actions{width:100%}
  .bl-draw-actions .bl-btn{flex:1;justify-content:center}
}
@media(max-width:640px){
  .bl-g702-grid{grid-template-columns:1fr}
  .bl-content{padding:16px}
}
      `}</style>

      <div className="billing-app" data-theme={t}>
        {/* ─── SIDEBAR ──────────────────────────────────────── */}
        <aside className="bl-sidebar">
          <div className="bl-brand">
            <LogoMark />
            <div>
              <div className="bl-brand-name">BuiltCRM</div>
              <div className="bl-brand-ctx">Summit Contracting</div>
            </div>
          </div>

          <div className="bl-sb-search">
            <div className="bl-sb-search-wrap">
              <SearchIcon />
              <input className="bl-sb-search-input" placeholder="Search projects, people…" />
            </div>
          </div>

          <nav className="bl-sb-nav">
            {sidebarSections.map((sec) => (
              <div className="bl-ns" key={sec.title}>
                <button className="bl-ns-h" onClick={() => toggleSection(sec.title)}>
                  <span className={`bl-ns-chv${collapsedSections[sec.title] ? " closed" : ""}`}>
                    <ChevronIcon />
                  </span>
                  {sec.title}
                </button>
                {!collapsedSections[sec.title] && (
                  <div>
                    {sec.items.map((item) => (
                      <div
                        className={`bl-ni${item.active ? " active" : ""}`}
                        key={item.label}
                      >
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className={`bl-ni-badge${item.badgeWarn ? " warn" : ""}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="bl-ns">
              <button className="bl-ns-h" onClick={() => toggleSection("Projects")}>
                <span className={`bl-ns-chv${collapsedSections["Projects"] ? " closed" : ""}`}>
                  <ChevronIcon />
                </span>
                Projects
              </button>
              {!collapsedSections["Projects"] && (
                <div>
                  {projects.map((p) => (
                    <div className={`bl-np${p.active ? " active" : ""}`} key={p.name}>
                      <span className={`bl-np-dot ${p.dot}`} />
                      <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
                      <span className="bl-np-ph">{p.phase}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="bl-sb-foot">
            <div className="bl-sb-user">
              <div className="bl-u-av">DC</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 580 }}>Daniel Chen</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 520 }}>
                  Project Manager
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─────────────────────────────────── */}
        <main className="bl-main">
          <div className="bl-topbar">
            <div className="bl-bc">
              <span>Contractor Portal</span>
              <span className="bl-bc-sep">›</span>
              <span>Riverside Tower Fit-Out</span>
              <span className="bl-bc-sep">›</span>
              <span>Financials</span>
              <span className="bl-bc-sep">›</span>
              <span className="bl-bc-cur">Draw #7</span>
            </div>
            <div className="bl-tb-acts">
              <button className="bl-tb-btn"><BellIcon /></button>
              <div className="bl-tb-av">DC</div>
            </div>
          </div>

          <div className="bl-content">
            {/* ── Draw Header ───────────────────────────────── */}
            <div className="bl-draw-header bl-anim-1">
              <div>
                <h1 className="bl-draw-number">Draw Request #7</h1>
                <div className="bl-draw-status-row">
                  <span className="bl-pill amber">Draft — Ready for review</span>
                  <span className="bl-pill gray">Application No. 7</span>
                </div>
                <div className="bl-draw-meta-row">
                  <span><strong>Project:</strong> Riverside Tower Fit-Out</span>
                  <span><strong>Period:</strong> Mar 1 – Mar 31, 2026</span>
                  <span><strong>Architect:</strong> Morrison + Partners</span>
                  <span><strong>Contract date:</strong> Sep 15, 2025</span>
                </div>
              </div>
              <div className="bl-draw-actions">
                <button className="bl-btn"><ExportIcon /> Export PDF</button>
                <button className="bl-btn"><SaveIcon /> Save draft</button>
                {submitted ? (
                  <button className="bl-btn submitted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Submitted
                  </button>
                ) : (
                  <button className="bl-btn primary" onClick={() => setSubmitted(true)}>
                    <SendIcon /> Submit for review
                  </button>
                )}
              </div>
            </div>

            {/* ── G702 Summary ──────────────────────────────── */}
            <div className="bl-g702 bl-anim-2">
              <div className="bl-g702-title">
                <CardIcon />
                AIA G702 — Application Summary
              </div>
              <div className="bl-g702-grid">
                {g702Items.map((item, i) => (
                  <div
                    className={`bl-g702-item${item.highlight ? " highlight" : ""}`}
                    key={i}
                  >
                    <div className="bl-g702-label">{item.label}</div>
                    <div className="bl-g702-value">{item.value}</div>
                    {item.hint && <div className="bl-g702-hint">{item.hint}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── G703 Continuation Sheet ───────────────────── */}
            <div className="bl-g703-card bl-anim-3">
              <div className="bl-g703-header">
                <div>
                  <div className="bl-g703-title">G703 — Continuation Sheet</div>
                  <div className="bl-g703-sub">
                    Schedule of values with work completed this period. Purple columns are editable.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="bl-btn ghost sm">Collapse all</button>
                  <button className="bl-btn sm"><PlusIcon /> Add line item</button>
                </div>
              </div>
              <div className="bl-g703-wrap">
                <table className="bl-g703-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Item</th>
                      <th>Description of work</th>
                      <th className="right">Scheduled value</th>
                      <th className="right">Previous</th>
                      <th className="right editable-col">This period</th>
                      <th className="right editable-col">Materials stored</th>
                      <th className="right">Total to date</th>
                      <th className="center">% Complete</th>
                      <th className="right">Balance to finish</th>
                      <th className="right">Retainage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g703Lines.map((line) => (
                      <tr key={line.item} className={line.co ? "co-row" : ""}>
                        <td>{line.item}</td>
                        <td className="desc">
                          {line.desc}
                          {line.co && <span className="co-tag">{line.co}</span>}
                        </td>
                        <td className="right">{line.sched}</td>
                        <td className="right">{line.prev}</td>
                        <td className="right editable">{line.period}</td>
                        <td className="right editable">{line.stored}</td>
                        <td className="right">{line.total}</td>
                        <td className="center">{line.pct}</td>
                        <td className="right">{line.balance}</td>
                        <td className="right">{line.ret}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td>
                      <td className="desc">Totals</td>
                      <td className="right">{g703Totals.sched}</td>
                      <td className="right">{g703Totals.prev}</td>
                      <td className="right" style={{ color: "var(--accent-text)" }}>
                        {g703Totals.period}
                      </td>
                      <td className="right" style={{ color: "var(--accent-text)" }}>
                        {g703Totals.stored}
                      </td>
                      <td className="right">{g703Totals.total}</td>
                      <td className="center">{g703Totals.pct}</td>
                      <td className="right">{g703Totals.balance}</td>
                      <td className="right">{g703Totals.ret}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ── Bottom Grid ──────────────────────────────── */}
            <div className="bl-bottom-grid bl-anim-4">
              {/* Retainage Card */}
              <div className="bl-card">
                <div className="bl-c-head">
                  <div>
                    <div className="bl-c-title">Retainage</div>
                    <div className="bl-c-sub">10% standard rate</div>
                  </div>
                </div>
                <div className="bl-c-body">
                  <div className="bl-ret-row">
                    <span className="bl-ret-label">On completed work</span>
                    <span className="bl-ret-value">{retainageData.onCompleted}</span>
                  </div>
                  <div className="bl-ret-row">
                    <span className="bl-ret-label">On stored materials</span>
                    <span className="bl-ret-value">{retainageData.onStored}</span>
                  </div>
                  <div className="bl-ret-row total">
                    <span className="bl-ret-label">Total retainage held</span>
                    <span className="bl-ret-value">{retainageData.totalHeld}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid var(--surface-3)",
                    }}
                  >
                    <div className="bl-ret-row">
                      <span className="bl-ret-label">Released to date</span>
                      <span className="bl-ret-value" style={{ color: "var(--success)" }}>
                        {retainageData.released}
                      </span>
                    </div>
                    <div className="bl-ret-row total">
                      <span className="bl-ret-label">Net retainage balance</span>
                      <span className="bl-ret-value">{retainageData.netBalance}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lien Waivers Card */}
              <div className="bl-card">
                <div className="bl-c-head">
                  <div>
                    <div className="bl-c-title">Lien waivers</div>
                    <div className="bl-c-sub">Required for draw closeout</div>
                  </div>
                </div>
                <div className="bl-c-body">
                  {lienWaivers.map((lw, i) => (
                    <div className="bl-lw-row" key={i}>
                      <div>
                        <div className="bl-lw-name">{lw.name}</div>
                        <div className="bl-lw-detail">
                          {lw.type} · {lw.amount}
                        </div>
                      </div>
                      <span
                        className={`bl-pill ${
                          lw.status === "Received" ? "green" : "amber"
                        }`}
                      >
                        {lw.status}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      fontWeight: 520,
                    }}
                  >
                    2 of 4 received · 2 outstanding
                  </div>
                </div>
              </div>

              {/* Package Documents Card */}
              <div className="bl-card">
                <div className="bl-c-head">
                  <div>
                    <div className="bl-c-title">Package documents</div>
                    <div className="bl-c-sub">Attachments for this draw</div>
                  </div>
                </div>
                <div className="bl-c-body">
                  {packageDocs.map((doc, i) => (
                    <div className="bl-doc-row" key={i}>
                      <div>
                        <div className="bl-doc-name">{doc.name}</div>
                        <div className="bl-doc-type">{doc.type}</div>
                      </div>
                      <span
                        className={`bl-pill ${
                          doc.tag === "Auto" ? "gray" : "blue"
                        }`}
                      >
                        {doc.tag}
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                    <button className="bl-btn" style={{ flex: 1, justifyContent: "center" }}>
                      <AttachIcon /> Attach file
                    </button>
                    <button
                      className="bl-btn success"
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <SendIcon /> Submit for review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ─── DARK MODE TOGGLE ─────────────────────────────── */}
        <button className="bl-dark-toggle" onClick={() => setDark(!dark)}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
    </>
  );
}
