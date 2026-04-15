import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  chev: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>,
  img: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  dots: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  x: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

// ── Logo Mark (Option F) ────────────────────────────────────────
const Logo = ({ s = 30 }) => (
  <div style={{ width: s, height: s, borderRadius: 8, background: "linear-gradient(135deg,#1a3a5c,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.6} height={s * 0.6}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Sidebar Nav Data ────────────────────────────────────────────
const sidebarSections = [
  { label: "Project", items: [
    { label: "Project Home" },
    { label: "Progress & Updates", page: "progress" },
    { label: "Photos", page: "photos" },
    { label: "Schedule" },
  ]},
  { label: "Decisions", items: [
    { label: "Approvals", badge: 2, badgeType: "blue" },
    { label: "Change Orders", badge: 1, badgeType: "amber" },
  ]},
  { label: "Financial", items: [
    { label: "Billing & Draws", badge: 1, badgeType: "amber" },
    { label: "Payment History", page: "payments" },
  ]},
  { label: "Documents", items: [
    { label: "Project Files", page: "documents" },
    { label: "Contracts" },
  ]},
  { label: "Communication", items: [
    { label: "Messages", badge: 2, badgeType: "blue" },
  ]},
];

// ── Page Data ───────────────────────────────────────────────────
const phases = [
  { name: "Phase 1 · Foundations", pct: 100, done: true, label: "Completed Feb 12" },
  { name: "Phase 2 · Structural", pct: 100, done: true, label: "Completed Mar 18" },
  { name: "Phase 3 · Interior Rough-In", pct: 65, current: true, label: "Target: Apr 28" },
  { name: "Phase 4 · Finishes", pct: 0, label: "Starts May 12" },
];

const updates = [
  {
    author: "Daniel Chen", role: "Project Manager, Summit Contracting", initials: "DC",
    title: "Weekly Report — Week of April 7", date: "Today, 9:15 AM",
    body: ["Good progress this week across the electrical and mechanical rough-in work. The east corridor electrical distribution is now complete, and we've begun pulling wire for the west wing lighting circuits. The main panel room passed inspection on Thursday.", "The HVAC reroute (CO-14) needs your approval before we can proceed with the mechanical work in the south corridor. This is currently on the critical path — the structural conflict we identified last week requires a routing change that affects both schedule and budget."],
    metrics: [{ val: "3", label: "Milestones completed" }, { val: "On track", label: "Schedule status", color: "var(--ok)" }, { val: "12", label: "Photos added" }],
    attachments: ["Weekly_Report_W15.pdf", "12 progress photos"],
    tags: [{ label: "Construction", type: "blue" }, { label: "Action needed", type: "amber" }],
  },
  {
    author: "Daniel Chen", role: "Project Manager, Summit Contracting", initials: "DC",
    title: "Draw #6 payment confirmed", date: "Apr 5",
    body: ["The March progress payment of $162,900 (Draw #6) has been received and confirmed. This brings total payments to date to $644,815, or approximately 43.5% of the current contract value. Thank you for the prompt processing."],
    tags: [{ label: "Financial", type: "green" }],
  },
  {
    author: "Daniel Chen", role: "Project Manager, Summit Contracting", initials: "DC",
    title: "Weekly Report — Week of March 31", date: "Apr 1",
    body: ["Phase 3 interior rough-in work continues on schedule. Plumbing rough-in for the restroom cores is complete and passed inspection. Electrical conduit installation is approximately 60% complete across all floors.", "Fire suppression rough-in started Monday and is progressing well. The sprinkler contractor has completed the first two floors."],
    metrics: [{ val: "2", label: "Milestones completed" }, { val: "On track", label: "Schedule status", color: "var(--ok)" }, { val: "8", label: "Photos added" }],
    attachments: ["Weekly_Report_W14.pdf", "8 progress photos"],
    tags: [{ label: "Construction", type: "blue" }],
  },
  {
    author: "Daniel Chen", role: "Project Manager, Summit Contracting", initials: "DC",
    title: "CO-12 approved — elevator shaft reinforcement complete", date: "Mar 27",
    body: ["Thank you for the quick turnaround on CO-12. The elevator shaft reinforcement work has been completed and the additional structural steel is now in place. The elevator subcontractor has confirmed this resolves the load-bearing concern."],
    tags: [{ label: "Approval", type: "green" }, { label: "Change order", type: "gray" }],
  },
  {
    author: "Daniel Chen", role: "Project Manager, Summit Contracting", initials: "DC",
    title: "Weekly Report — Week of March 24", date: "Mar 25",
    body: ["Phase 2 structural work is now complete. All concrete pours passed final inspection and the structural engineer has signed off on load tests. We've formally transitioned to Phase 3 — interior rough-in.", "Draw #7 billing application is being prepared and will be submitted for your review next week."],
    metrics: [{ val: "4", label: "Milestones completed" }, { val: "On track", label: "Schedule status", color: "var(--ok)" }, { val: "15", label: "Photos added" }],
    attachments: ["Weekly_Report_W13.pdf"],
    tags: [{ label: "Construction", type: "blue" }, { label: "Phase transition", type: "green" }],
  },
];

const photoSets = [
  { title: "Week 15 — Interior Rough-In Progress", uploader: "Daniel Chen", count: 12, date: "Today",
    photos: [
      { label: "Electrical panel", bg: 1 }, { label: "Conduit run", bg: 2 }, { label: "Floor 3 framing", bg: 3 },
      { label: "Panel room", bg: 4 }, { label: "Corridor view", bg: 5 }, { label: "Fire suppression", bg: 6 },
      { label: "Plumbing detail", bg: 7 }, { label: "Aerial view", bg: 8 },
    ]},
  { title: "Week 14 — Plumbing & Electrical Start", uploader: "Daniel Chen", count: 8, date: "Apr 1",
    photos: [
      { label: "Plumbing start", bg: 3 }, { label: "Electrical layout", bg: 1 },
      { label: "Floor 1 overview", bg: 5 }, { label: "Conduit detail", bg: 2 },
    ]},
  { title: "Week 13 — Phase 2 Completion & Phase 3 Transition", uploader: "Daniel Chen", count: 15, date: "Mar 25",
    photos: [
      { label: "Concrete final", bg: 4 }, { label: "Steel inspection", bg: 7 },
      { label: "Load test", bg: 6 }, { label: "Aerial drone", bg: 8 },
    ]},
];

const docCategories = [
  { id: "all", label: "All files", count: 18 },
  { id: "contracts", label: "Contracts", count: 3 },
  { id: "drawings", label: "Drawings & Plans", count: 5 },
  { id: "permits", label: "Permits & Inspections", count: 3 },
  { id: "billing", label: "Billing & Financial", count: 4 },
  { id: "insurance", label: "Insurance & Compliance", count: 2 },
  { id: "owner", label: "Your uploads", count: 1 },
];

const documents = [
  { name: "Master_Construction_Agreement.pdf", meta: "Contract · Signed by both parties", size: "2.4 MB", date: "Jan 8, 2026", color: "var(--dg)" },
  { name: "AIA_A101_Owner_Contractor_Agreement.pdf", meta: "Contract · AIA standard form", size: "1.8 MB", date: "Jan 8, 2026", color: "var(--dg)" },
  { name: "Architectural_Drawings_Rev_D.pdf", meta: "Drawing · Revision D — current", size: "18.6 MB", date: "Feb 14, 2026", color: "var(--in)" },
  { name: "MEP_Engineering_Plans_v3.pdf", meta: "Drawing · Mechanical / Electrical / Plumbing", size: "24.1 MB", date: "Feb 14, 2026", color: "var(--in)" },
  { name: "Building_Permit_Approved.pdf", meta: "Permit · City of Riverside — approved", size: "890 KB", date: "Jan 15, 2026", color: "var(--ok)" },
  { name: "G702_Draw_7_Application.pdf", meta: "Billing · AIA G702 — pending your review", size: "1.2 MB", date: "Apr 8, 2026", color: "var(--wr)" },
  { name: "G703_Draw_7_Continuation_Sheet.pdf", meta: "Billing · Line-item detail — pending your review", size: "3.4 MB", date: "Apr 8, 2026", color: "var(--dg)" },
  { name: "Contractor_COI_2026.pdf", meta: "Insurance · Summit Contracting certificate", size: "440 KB", date: "Jan 5, 2026", color: "var(--ok)" },
  { name: "Owner_Property_Insurance_2026.pdf", meta: "Your upload · Owner's property insurance", size: "520 KB", date: "Jan 12, 2026", color: "var(--ac)", owner: true },
];

const payStats = [
  { label: "Current contract value", value: "$1,482,500", meta: "Original $1,420,000 + $62,500 in COs" },
  { label: "Total paid to date", value: "$644,815", meta: "Across 6 approved draws", color: "var(--ok)", bar: 43.5, barColor: "var(--ok)" },
  { label: "Retainage held", value: "$92,135", meta: "10% retainage on completed work" },
  { label: "Pending payment", value: "$184,400", meta: "Draw #7 · awaiting your review", color: "var(--wr)" },
];

const draws = [
  { num: 7, period: "Mar 2026", submitted: "Apr 8", approved: null, amount: "$184,400", retainage: "$20,490", lw: "8/11", lwPct: 73, running: "—", method: "—", pending: true },
  { num: 6, period: "Feb 2026", submitted: "Mar 5", approved: "Mar 12", amount: "$162,900", retainage: "$18,100", lw: "11/11", lwPct: 100, running: "$644,815", method: "ACH Transfer" },
  { num: 5, period: "Jan 2026", submitted: "Feb 4", approved: "Feb 11", amount: "$148,250", retainage: "$16,470", lw: "11/11", lwPct: 100, running: "$481,915", method: "ACH Transfer" },
  { num: 4, period: "Dec 2025", submitted: "Jan 6", approved: "Jan 14", amount: "$134,680", retainage: "$14,965", lw: "10/10", lwPct: 100, running: "$333,665", method: "ACH Transfer" },
  { num: 3, period: "Nov 2025", submitted: "Dec 3", approved: "Dec 10", amount: "$98,450", retainage: "$10,940", lw: "9/9", lwPct: 100, running: "$198,985", method: "ACH Transfer" },
  { num: 2, period: "Oct 2025", submitted: "Nov 4", approved: "Nov 12", amount: "$72,135", retainage: "$8,015", lw: "8/8", lwPct: 100, running: "$100,535", method: "ACH Transfer" },
  { num: 1, period: "Sep 2025", submitted: "Oct 7", approved: "Oct 15", amount: "$28,400", retainage: "$3,155", lw: "6/6", lwPct: 100, running: "$28,400", method: "Wire Transfer" },
];

const changeOrders = [
  { id: "CO-14", desc: "Mechanical reroute — HVAC conflict", date: null, amount: "+$42,500", impact: "+5 days", status: "Awaiting approval", pending: true },
  { id: "CO-12", desc: "Elevator shaft reinforcement", date: "Mar 25", amount: "+$28,500", impact: "+3 days", status: "Approved" },
  { id: "CO-08", desc: "Additional fire rating — south stairwell", date: "Feb 18", amount: "+$18,750", impact: "No impact", status: "Approved" },
  { id: "CO-03", desc: "Upgraded waterproofing system", date: "Nov 12", amount: "+$15,250", impact: "+2 days", status: "Approved" },
];

// Placeholder backgrounds
const phBgs = {
  1: "linear-gradient(135deg,#d4e3f5,#b8cfe8)", 2: "linear-gradient(135deg,#e2daf0,#c9bdd6)",
  3: "linear-gradient(135deg,#d6ede2,#b3d8c5)", 4: "linear-gradient(135deg,#f0e4d0,#dccbb2)",
  5: "linear-gradient(135deg,#d0dfe8,#b2c9d6)", 6: "linear-gradient(135deg,#e8d8d0,#d6bfb2)",
  7: "linear-gradient(135deg,#c9dfe8,#a8c7d4)", 8: "linear-gradient(135deg,#dfe2c9,#c7cab0)",
};

// ── Component ───────────────────────────────────────────────────
export default function CommercialClientPortal() {
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState("progress");
  const [collapsed, setCollapsed] = useState({});
  const [updateFilter, setUpdateFilter] = useState("all");
  const [photoFilter, setPhotoFilter] = useState("all");
  const [docCat, setDocCat] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  const toggleSection = (s) => setCollapsed(c => ({ ...c, [s]: !c[s] }));

  const pageNames = { progress: "Progress & Updates", photos: "Photos", documents: "Documents", payments: "Payment History" };

  return (
    <div className={`cc ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.cc{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;--ti:#faf9f7;
  --ac:#3178b9;--ac-h:#2968a3;--ac-s:#e8f1fa;--ac-t:#276299;--ac-m:#a3c8e8;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --pu:#5b4fc7;--pu-s:#eeedfb;--pu-t:#4a3fb0;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 8px 32px rgba(26,23,20,.1);--shri:0 0 0 3px rgba(49,120,185,.15);
  --sbw:260px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.cc.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#4a94d4;--ac-h:#3d82c0;--ac-s:#141f2c;--ac-t:#6cb0ee;--ac-m:#2e4a60;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --pu:#7b6ff0;--pu-s:#252040;--pu-t:#a99ff8;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 8px 32px rgba(0,0,0,.35);--shri:0 0 0 3px rgba(74,148,212,.2);
}
*,*::before,*::after{box-sizing:border-box;margin:0}

/* ── Sidebar ───────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 16px 0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.brand-ctx{font-size:11.5px;color:var(--t3);line-height:1.2;margin-top:1px}

.sb-welcome{margin:12px 12px 0;padding:16px;border:1px solid var(--s3);border-radius:var(--r-l);background:linear-gradient(180deg,var(--s1) 0%,var(--si) 100%)}
.sb-welcome h4{font-family:var(--fd);font-size:13px;font-weight:650;margin-bottom:4px}
.sb-welcome p{font-size:12px;color:var(--t2);line-height:1.4}

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
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3178b9,#5a9fd4);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:640}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

/* ── Main ──────────────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(238,240,243,.85);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.cc.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3);letter-spacing:-.01em}
.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;position:relative;transition:all var(--df) var(--e)}
.ib:hover{border-color:var(--s4);color:var(--t2)}
.nd::after{content:'';position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--dg);border:2px solid var(--s1)}
.av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3178b9,#5a9fd4);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700}
.ct{padding:24px;flex:1}

/* Page switcher */
.ps{display:flex;gap:8px;margin-bottom:20px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:4px;width:fit-content}
.ps button{height:34px;padding:0 16px;border:none;border-radius:var(--r-m);font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t2);cursor:pointer;background:transparent;transition:all var(--df) var(--e);white-space:nowrap}
.ps button:hover{color:var(--t1);background:var(--sh)}
.ps button.on{background:var(--ac);color:#fff;font-weight:620;box-shadow:0 1px 4px rgba(49,120,185,.25)}

/* Shared */
.pg-t{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15}
.pg-sub{margin-top:4px;font-size:13.5px;color:var(--t2)}
.pl{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:650;display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.red{background:var(--dg-s);color:var(--dg-t)}.pl.amber{background:var(--wr-s);color:var(--wr-t)}
.pl.green{background:var(--ok-s);color:var(--ok-t)}.pl.blue{background:var(--in-s);color:var(--in-t)}
.pl.purple{background:var(--pu-s);color:var(--pu-t)}.pl.gray{background:var(--s2);color:var(--t2)}
.btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t1);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}
.btn.pri:hover{background:var(--ac-h)}
.btn.sm{height:28px;padding:0 10px;font-size:12px;border-radius:var(--r-s)}
.btn svg{width:14px;height:14px;flex-shrink:0}
.card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.c-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
.c-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em}
.c-sub{font-size:12.5px;color:var(--t3);margin-top:2px}
.c-body{padding:16px 20px}

/* Filter pills */
.fb{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.fp{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12.5px;font-weight:560;color:var(--t2);cursor:pointer;transition:all var(--df);display:inline-flex;align-items:center}
.fp:hover{border-color:var(--s4);color:var(--t1)}
.fp.on{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}
.fp .cnt{font-size:10.5px;margin-left:4px;opacity:.7}

/* ── Progress page ─────────────────────────────────── */
.phase-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.ph-item{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;text-align:center}
.ph-item.cur{border-color:var(--ac);background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%)}
.ph-item h5{font-family:var(--fd);font-size:12px;font-weight:650;letter-spacing:-.01em;margin-bottom:6px}
.ph-bar{height:6px;border-radius:3px;background:var(--s3);overflow:hidden;margin-bottom:4px}
.ph-fill{height:100%;border-radius:3px;transition:width var(--ds) var(--e)}
.ph-pct{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.ph-label{font-size:11px;color:var(--t3);margin-top:2px}

/* Update cards */
.uc{padding:20px;border:1px solid var(--s3);border-radius:var(--r-l);background:var(--s1);transition:all var(--df)}
.uc:hover{box-shadow:var(--shmd)}
.uc+.uc{margin-top:12px}
.uc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px}
.uc-author{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.uc-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;flex-shrink:0;color:#fff;background:linear-gradient(135deg,#5b4fc7,#7c6fe0)}
.uc-info{font-size:12px;color:var(--t2)}.uc-info strong{color:var(--t1);font-weight:620}
.uc-title{font-family:var(--fd);font-size:15px;font-weight:660;letter-spacing:-.01em;line-height:1.3;margin-bottom:8px}
.uc-date{font-size:12px;color:var(--t3);font-weight:560;white-space:nowrap;flex-shrink:0}
.uc-body{font-size:13.5px;color:var(--t2);line-height:1.55}
.uc-body p+p{margin-top:8px}
.wm{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--s3)}
.wm-item{text-align:center}
.wm-v{font-family:var(--fd);font-size:16px;font-weight:720;letter-spacing:-.02em}
.wm-l{font-size:11px;color:var(--t3);margin-top:2px}
.uc-att{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.att{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--s3);border-radius:var(--r-m);font-size:12px;font-weight:550;color:var(--t2);background:var(--si);cursor:pointer;transition:all var(--df)}
.att:hover{border-color:var(--ac);color:var(--ac-t)}
.att svg{width:14px;height:14px;flex-shrink:0}
.uc-tags{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

/* ── Photos page ───────────────────────────────────── */
.ph-stats{display:flex;gap:20px;margin-bottom:16px;font-size:13px;color:var(--t2)}
.ph-stats strong{font-weight:620;color:var(--t1)}
.pg{margin-bottom:20px}
.pg-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.pg-title-sm{font-family:var(--fd);font-size:14px;font-weight:650;letter-spacing:-.01em}
.pg-date{font-size:12px;color:var(--t3)}
.pg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pt{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;cursor:pointer;position:relative;border:1px solid var(--s3);transition:all var(--df)}
.pt:hover{transform:scale(1.02);box-shadow:var(--shlg);border-color:var(--ac)}
.pt-ph{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;color:var(--t3);font-weight:560}
.pt-ph svg{width:24px;height:24px;opacity:.35}
.pt-ov{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,.6));opacity:0;transition:opacity var(--df)}
.pt:hover .pt-ov{opacity:1}
.pt-ov span{font-size:11px;color:#fff;font-weight:560}

/* Lightbox */
.lb{display:none;position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px}
.lb.open{display:flex}
.lb-x{position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer;display:grid;place-items:center;transition:background var(--df)}
.lb-x:hover{background:rgba(255,255,255,.25)}
.lb-img{width:640px;max-width:80vw;aspect-ratio:4/3;border-radius:var(--r-l)}
.lb-cap{color:#fff;text-align:center;max-width:480px}
.lb-cap h4{font-family:var(--fd);font-size:16px;font-weight:650;margin-bottom:4px}
.lb-cap p{font-size:13px;opacity:.7}

/* ── Documents page ────────────────────────────────── */
.uz{border:2px dashed var(--s4);border-radius:var(--r-xl);padding:32px 24px;text-align:center;cursor:pointer;transition:all var(--dn);margin-bottom:16px}
.uz:hover{border-color:var(--ac);background:var(--ac-s)}
.uz svg{width:40px;height:40px;color:var(--t3);margin-bottom:8px}
.uz h4{font-family:var(--fd);font-size:14px;font-weight:640;margin-bottom:4px}
.uz p{font-size:12.5px;color:var(--t3)}
.uz-types{font-size:11px;color:var(--t3);margin-top:8px}
.doc-layout{display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start}
.doc-cats{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:12px}
.dc{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;transition:all var(--df)}
.dc:hover{background:var(--sh);color:var(--t1)}
.dc.on{background:var(--ac-s);color:var(--ac-t);font-weight:620}
.dc-n{font-size:11px;font-weight:600;color:var(--t3);min-width:18px;text-align:right}
.dc.on .dc-n{color:var(--ac-t)}
.doc-hdr{display:grid;grid-template-columns:1fr auto auto auto;gap:16px;padding:0 16px 8px;font-size:11px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
.dr{display:grid;grid-template-columns:1fr auto auto auto;gap:16px;align-items:center;padding:12px 16px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);transition:all var(--df);cursor:pointer;margin-bottom:8px}
.dr:hover{box-shadow:var(--shmd);border-color:var(--s4)}
.dr.owner{border-color:var(--ac);background:linear-gradient(135deg,var(--s1) 0%,var(--ac-s) 100%)}
.dr-name{font-family:var(--fd);font-size:13.5px;font-weight:620;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-meta{font-size:12px;color:var(--t3);margin-top:2px}
.dr-size{font-size:12px;color:var(--t3);font-family:var(--fm);white-space:nowrap}
.dr-date{font-size:12px;color:var(--t3);white-space:nowrap}
.dr-acts{display:flex;gap:4px}
.dr-btn{width:30px;height:30px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}
.dr-btn:hover{border-color:var(--ac);color:var(--ac-t)}

/* ── Payments page ─────────────────────────────────── */
.pay-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.pay-s{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px}
.pay-l{font-size:11px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;font-family:var(--fd)}
.pay-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1}
.pay-m{font-size:12px;color:var(--t2);margin-top:4px}
.bar-track{height:6px;border-radius:3px;background:var(--s3);margin-top:8px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;transition:width var(--ds) var(--e)}

/* Progress bar */
.pp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px;margin-bottom:16px}
.pp-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.pp-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em}
.pp-bar{height:24px;border-radius:12px;background:var(--s3);overflow:hidden;display:flex}
.pp-seg{height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;overflow:hidden;white-space:nowrap}
.pp-paid{background:var(--ok)}.pp-pending{background:var(--wr)}.pp-ret{background:var(--ac)}.pp-rem{background:var(--s4);color:var(--t2)}
.pp-legend{display:flex;gap:20px;margin-top:12px;flex-wrap:wrap}
.lg-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t2)}
.lg-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}

/* Payment table */
.pay-t{width:100%;border-collapse:collapse}
.pay-t thead th{padding:8px 12px;font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;border-bottom:2px solid var(--s3);white-space:nowrap;font-family:var(--fd)}
.pay-t tbody td{padding:12px;font-size:13px;border-bottom:1px solid var(--s3);vertical-align:middle}
.pay-t tbody tr:hover{background:var(--sh)}
.pay-t .amt{font-family:var(--fd);font-weight:700;white-space:nowrap}
.pay-t .running{font-family:var(--fd);font-size:12px;color:var(--t3);white-space:nowrap}
.pay-t .method{font-size:12px;color:var(--t3)}
.pay-t .rlink{font-size:12px;color:var(--ac-t);font-weight:560;cursor:pointer}
.pay-t .rlink:hover{text-decoration:underline}
.lw{display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap}
.lw-bar{width:48px;height:5px;border-radius:3px;background:var(--s3);overflow:hidden;flex-shrink:0}
.lw-fill{height:100%;border-radius:3px}
.lw-fill.done{background:var(--ok)}.lw-fill.part{background:var(--wr)}

/* ── Responsive ────────────────────────────────────── */
@media(max-width:1280px){.phase-grid{grid-template-columns:repeat(2,1fr)}.pay-grid{grid-template-columns:repeat(2,1fr)}.pg-grid{grid-template-columns:repeat(3,1fr)}.doc-layout{grid-template-columns:1fr}}
@media(max-width:900px){.cc{grid-template-columns:1fr}.side{display:none}.pg-grid{grid-template-columns:repeat(2,1fr)}}

/* Animation */
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.page-anim{animation:fadeIn var(--ds) var(--e) both}
      `}</style>

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">Client Portal</div>
          </div>
        </div>

        <div className="sb-welcome">
          <h4>Welcome back, Rachel</h4>
          <p>2 items need your review on Riverside Tower.</p>
        </div>

        <nav className="s-nav">
          {sidebarSections.map((sec) => (
            <div key={sec.label} className={`ns${collapsed[sec.label] ? " closed" : ""}`}>
              <div className="ns-h" onClick={() => toggleSection(sec.label)}>
                <span className="ns-chv">{I.chev}</span>
                {sec.label}
              </div>
              {!collapsed[sec.label] && (
                <div>
                  {sec.items.map((it) => (
                    <div
                      key={it.label}
                      className={`ni${it.page === page ? " on" : ""}`}
                      onClick={() => it.page && setPage(it.page)}
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
            <div className="u-av">RG</div>
            <div>
              <div className="u-name">Rachel Greyson</div>
              <div className="u-role">Project Approver</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>Client Portal</span>
            <span className="sep">›</span>
            <span>Riverside Tower Fit-Out</span>
            <span className="sep">›</span>
            <span className="cur">{pageNames[page]}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? I.sun : I.moon}</button>
            <button className="ib nd" aria-label="Notifications">{I.bell}</button>
            <div className="av">RG</div>
          </div>
        </div>

        <div className="ct">
          {/* Page switcher */}
          <div className="ps">
            {Object.entries(pageNames).map(([k, v]) => (
              <button key={k} className={page === k ? "on" : ""} onClick={() => setPage(k)}>{v}</button>
            ))}
          </div>

          {/* ═══════ PROGRESS & UPDATES ═══════ */}
          {page === "progress" && (
            <div className="page-anim">
              <div style={{ marginBottom: 20 }}>
                <h1 className="pg-t">Progress & Updates</h1>
                <div className="pg-sub">Weekly reports and milestone updates from your contractor, Summit Contracting.</div>
              </div>

              <div className="phase-grid">
                {phases.map((p) => (
                  <div key={p.name} className={`ph-item${p.current ? " cur" : ""}`}>
                    <h5>{p.name}</h5>
                    <div className="ph-bar"><div className="ph-fill" style={{ width: `${p.pct}%`, background: p.done ? "var(--ok)" : p.pct === 0 ? "var(--s4)" : "var(--ac)" }} /></div>
                    <div className="ph-pct" style={{ color: p.done ? "var(--ok)" : p.pct === 0 ? "var(--t3)" : "var(--t1)" }}>{p.pct}%</div>
                    <div className="ph-label">{p.label}</div>
                  </div>
                ))}
              </div>

              <div className="fb">
                {["All updates|12", "Construction|7", "Approvals|3", "Financial|2"].map((f) => {
                  const [label, count] = f.split("|");
                  const id = label.toLowerCase();
                  return <button key={id} className={`fp${updateFilter === id ? " on" : ""}`} onClick={() => setUpdateFilter(id)}>{label}<span className="cnt">{count}</span></button>;
                })}
              </div>

              {updates.map((u, i) => (
                <div key={i} className="uc">
                  <div className="uc-top">
                    <div style={{ flex: 1 }}>
                      <div className="uc-author">
                        <div className="uc-av">{u.initials}</div>
                        <div className="uc-info"><strong>{u.author}</strong> · {u.role}</div>
                      </div>
                      <div className="uc-title">{u.title}</div>
                    </div>
                    <div className="uc-date">{u.date}</div>
                  </div>
                  <div className="uc-body">{u.body.map((p, j) => <p key={j}>{p}</p>)}</div>
                  {u.metrics && (
                    <div className="wm">
                      {u.metrics.map((m) => (
                        <div key={m.label} className="wm-item">
                          <div className="wm-v" style={m.color ? { color: m.color } : {}}>{m.val}</div>
                          <div className="wm-l">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {u.attachments && (
                    <div className="uc-att">
                      {u.attachments.map((a) => (
                        <div key={a} className="att">{a.includes("photo") ? I.img : I.file} {a}</div>
                      ))}
                    </div>
                  )}
                  {u.tags && (
                    <div className="uc-tags">
                      {u.tags.map((t) => <span key={t.label} className={`pl ${t.type}`}>{t.label}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══════ PHOTOS ═══════ */}
          {page === "photos" && (
            <div className="page-anim">
              <div style={{ marginBottom: 20 }}>
                <h1 className="pg-t">Project Photos</h1>
                <div className="pg-sub">Progress documentation from your contractor's site team.</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="ph-stats">
                  <span><strong>84</strong> total photos</span>
                  <span><strong>4</strong> photo sets</span>
                  <span>Last upload: <strong>Today</strong></span>
                </div>
                <button className="btn sm">{I.download} Download all</button>
              </div>

              <div className="fb">
                {["All photos", "Site progress", "Inspections", "Electrical", "Mechanical", "Structural"].map((f) => {
                  const id = f.toLowerCase().replace(/ /g, "");
                  return <button key={id} className={`fp${photoFilter === id || (id === "allphotos" && photoFilter === "all") ? " on" : ""}`} onClick={() => setPhotoFilter(id === "allphotos" ? "all" : id)}>{f}</button>;
                })}
              </div>

              {photoSets.map((set) => (
                <div key={set.title} className="pg">
                  <div className="pg-hdr">
                    <div>
                      <div className="pg-title-sm">{set.title}</div>
                      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Uploaded by {set.uploader} · {set.count} photos</div>
                    </div>
                    <div className="pg-date">{set.date}</div>
                  </div>
                  <div className="pg-grid">
                    {set.photos.map((ph, j) => (
                      <div key={j} className="pt" onClick={() => setLightbox(ph)}>
                        <div className="pt-ph" style={{ background: phBgs[ph.bg] }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                          {ph.label}
                        </div>
                        <div className="pt-ov"><span>{ph.label}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════ DOCUMENTS ═══════ */}
          {page === "documents" && (
            <div className="page-anim">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h1 className="pg-t">Project Documents</h1>
                  <div className="pg-sub">Project files, contracts, and documents shared by your contractor.</div>
                </div>
                <button className="btn pri">{I.upload} Upload document</button>
              </div>

              <div className="uz">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <h4>Upload your documents</h4>
                <p>Drop files here or click to browse. Insurance certificates, signed contracts, tax exemptions, and other owner-provided documents.</p>
                <div className="uz-types">Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG · Max 50MB per file</div>
              </div>

              <div className="doc-layout">
                <div className="doc-cats">
                  {docCategories.map((c) => (
                    <div key={c.id} className={`dc${docCat === c.id ? " on" : ""}`} onClick={() => setDocCat(c.id)}>
                      {c.label} <span className="dc-n">{c.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="doc-hdr"><span>File name</span><span>Size</span><span>Date</span><span /></div>
                  {documents.map((d) => (
                    <div key={d.name} className={`dr${d.owner ? " owner" : ""}`}>
                      <div style={{ minWidth: 0 }}>
                        <div className="dr-name">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={d.color} strokeWidth="2" style={{ verticalAlign: -2, marginRight: 4 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                          {d.name}
                        </div>
                        <div className="dr-meta">{d.meta}</div>
                      </div>
                      <div className="dr-size">{d.size}</div>
                      <div className="dr-date">{d.date}</div>
                      <div className="dr-acts">
                        <button className="dr-btn">{I.download}</button>
                        <button className="dr-btn">{I.dots}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ PAYMENT HISTORY ═══════ */}
          {page === "payments" && (
            <div className="page-anim">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h1 className="pg-t">Payment History</h1>
                  <div className="pg-sub">Complete record of your payments on the Riverside Tower Fit-Out project.</div>
                </div>
                <button className="btn">{I.download} Export payment report</button>
              </div>

              <div className="pay-grid">
                {payStats.map((s) => (
                  <div key={s.label} className="pay-s">
                    <div className="pay-l">{s.label}</div>
                    <div className="pay-v" style={s.color ? { color: s.color } : {}}>{s.value}</div>
                    <div className="pay-m">{s.meta}</div>
                    {s.bar && <div className="bar-track"><div className="bar-fill" style={{ width: `${s.bar}%`, background: s.barColor }} /></div>}
                  </div>
                ))}
              </div>

              <div className="pp">
                <div className="pp-hdr">
                  <div className="pp-title">Contract payment progress</div>
                  <div style={{ fontSize: 13, color: "var(--t2)" }}><strong style={{ color: "var(--t1)" }}>43.5%</strong> paid of total contract</div>
                </div>
                <div className="pp-bar">
                  <div className="pp-seg pp-paid" style={{ width: "43.5%" }}>$644K paid</div>
                  <div className="pp-seg pp-pending" style={{ width: "12.4%" }}>$184K</div>
                  <div className="pp-seg pp-ret" style={{ width: "6.2%" }} />
                  <div className="pp-seg pp-rem" style={{ width: "37.9%" }}>$561K remaining</div>
                </div>
                <div className="pp-legend">
                  {[["var(--ok)", "Paid to date"], ["var(--wr)", "Pending review"], ["var(--ac)", "Retainage held"], ["var(--s4)", "Remaining on contract"]].map(([c, l]) => (
                    <div key={l} className="lg-item"><div className="lg-dot" style={{ background: c }} />{l}</div>
                  ))}
                </div>
              </div>

              {/* Lien waiver status */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="c-head">
                  <div>
                    <div className="c-title">Lien waiver status</div>
                    <div className="c-sub">Unconditional lien waivers collected from subcontractors per draw</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="lw-bar" style={{ width: 60 }}><div className="lw-fill part" style={{ width: "73%" }} /></div>
                    <span style={{ fontSize: 13, fontWeight: 620, color: "var(--wr-t)" }}>Draw #7: 8 of 11 received</span>
                  </div>
                </div>
                <div className="c-body" style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--t2)", flexWrap: "wrap" }}>
                    <div><strong style={{ color: "var(--t1)" }}>3 outstanding:</strong> Meridian MEP · Apex Fire Protection · Hartfield Flooring</div>
                    <div style={{ marginLeft: "auto", color: "var(--t3)" }}>All prior draws: <span style={{ color: "var(--ok-t)", fontWeight: 620 }}>100% collected</span></div>
                  </div>
                </div>
              </div>

              {/* Payment ledger */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="c-head">
                  <div><div className="c-title">Payment ledger</div><div className="c-sub">All payments made on this project</div></div>
                </div>
                <div className="c-body" style={{ padding: 0, overflowX: "auto" }}>
                  <table className="pay-t">
                    <thead>
                      <tr>
                        <th>Draw</th><th>Period</th><th>Submitted</th><th>Approved</th><th>Amount paid</th><th>Retainage</th><th>Lien waivers</th><th>Running total</th><th>Method</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {draws.map((d) => (
                        <tr key={d.num} style={d.pending ? { background: "var(--wr-s)" } : {}}>
                          <td><strong>Draw #{d.num}</strong></td>
                          <td>{d.period}</td>
                          <td>{d.submitted}</td>
                          <td>{d.approved || <span className="pl amber" style={{ height: 20, fontSize: 10 }}>Pending review</span>}</td>
                          <td className="amt">{d.amount}</td>
                          <td className="amt">{d.retainage}</td>
                          <td>
                            <div className="lw">
                              <div className="lw-bar"><div className={`lw-fill ${d.lwPct === 100 ? "done" : "part"}`} style={{ width: `${d.lwPct}%` }} /></div>
                              <span style={{ color: d.lwPct === 100 ? "var(--ok-t)" : "var(--wr-t)" }}>{d.lw}</span>
                            </div>
                          </td>
                          <td className="running">{d.running}</td>
                          <td className="method">{d.method}</td>
                          <td><span className="pay-t rlink">{d.pending ? "Review →" : "Receipt"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Change order summary */}
              <div className="card">
                <div className="c-head">
                  <div><div className="c-title">Change order summary</div><div className="c-sub">Approved scope changes and their financial impact</div></div>
                </div>
                <div className="c-body" style={{ padding: 0, overflowX: "auto" }}>
                  <table className="pay-t">
                    <thead>
                      <tr><th>Change order</th><th>Description</th><th>Date approved</th><th>Amount</th><th>Schedule impact</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {changeOrders.map((co) => (
                        <tr key={co.id} style={co.pending ? { background: "var(--wr-s)" } : {}}>
                          <td><strong>{co.id}</strong></td>
                          <td>{co.desc}</td>
                          <td>{co.date || <span className="pl amber" style={{ height: 20, fontSize: 10 }}>Pending</span>}</td>
                          <td className="amt">{co.amount}</td>
                          <td>{co.impact}</td>
                          <td><span className={`pl ${co.pending ? "amber" : "green"}`}>{co.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div className="lb open" onClick={(e) => e.target === e.currentTarget && setLightbox(null)}>
          <button className="lb-x" onClick={() => setLightbox(null)}>{I.x}</button>
          <div className="lb-img" style={{ background: phBgs[lightbox.bg], display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "var(--t3)", fontSize: 14, fontWeight: 560 }}>{lightbox.label}</div>
          </div>
          <div className="lb-cap">
            <h4>{lightbox.label}</h4>
            <p>Progress photo placeholder</p>
          </div>
        </div>
      )}
    </div>
  );
}
