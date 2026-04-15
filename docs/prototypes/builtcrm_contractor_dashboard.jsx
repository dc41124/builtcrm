import { useState, useEffect, useRef } from "react";

// ── Inline SVG Icons ──────────────────────────────────────────
const Icons = {
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
  ),
  search: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>
  ),
  building: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="14" rx="2" fill="currentColor" opacity=".15"/><path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8"/><path d="M9 10h2m-2 4h2m4-4h-1m1 4h-1" stroke="currentColor" strokeWidth="1.8"/><path d="M10 20v-3h4v3" stroke="currentColor" strokeWidth="1.8"/></svg>
  ),
  checkSquare: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" opacity=".15"/><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8"/><path d="m8 12 3 3 5-5" stroke="currentColor" strokeWidth="2.2"/></svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
  ),
  sun: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
  ),
  dollar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="13" rx="3" fill="currentColor" opacity=".15"/><rect x="2" y="6" width="20" height="13" rx="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8"/></svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" opacity=".15"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8"/><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  fileText: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="currentColor" opacity=".15"/><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.8"/><path d="M9 13h6m-6 3h4" stroke="currentColor" strokeWidth="1.8"/></svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
  ),
  folderOpen: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2l1-5a2 2 0 00-2-2H7a2 2 0 00-2 2l-1 5z"/></svg>
  ),
  creditCard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity=".15"/><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/></svg>
  ),
  chatBubble: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v3"/><circle cx="12" cy="14" r=".5" fill="currentColor"/></svg>
  ),
};

// ── Nav Data ───────────────────────────────────────────────────
const navModules = [
  {
    label: "Core", items: [
      { label: "Dashboard", active: true },
      { label: "Approvals", badge: 4 },
      { label: "Messages", badge: 8 },
    ],
  },
  {
    label: "Workflows", items: [
      { label: "Billing & Draws", badge: 2, badgeType: "warn" },
      { label: "RFIs", badge: 6 },
      { label: "Change Orders" },
      { label: "Compliance", badge: 1, badgeType: "danger" },
      { label: "Upload Requests" },
      { label: "Documents" },
    ],
  },
  {
    label: "Financials", items: [
      { label: "Budget Overview" },
      { label: "Payment Tracking" },
      { label: "Retainage" },
    ],
  },
  {
    label: "Projects", isProjects: true, items: [
      { name: "Riverside Tower Fit-Out", phase: "PH 3", dot: "amber", active: true },
      { name: "West End Medical", phase: "PH 2", dot: "green" },
      { name: "Lot 7 Redevelopment", phase: "Precon", dot: "gray" },
      { name: "Northline Office Park", phase: "PH 1", dot: "green" },
    ],
  },
  {
    label: "Settings", items: [
      { label: "Organization" },
      { label: "Team & Roles" },
      { label: "Integrations" },
    ],
  },
];

// ── Dashboard Data ─────────────────────────────────────────────
const kpiData = [
  { label: "Active projects", value: "4", meta: "3 in construction", trend: "1 precon", trendType: "up", icon: "building", color: "blue" },
  { label: "Approvals queue", value: "4", meta: "", trend: "1 overdue", trendType: "warn", meta2: "2 this week", icon: "checkSquare", color: "purple" },
  { label: "Open payments", value: "C$188K", meta: "2 draws awaiting collection", icon: "dollar", color: "green" },
  { label: "Open RFIs", value: "6", meta: "", trend: "2 overdue", trendType: "down", meta2: "avg 4.2d response", icon: "chatBubble", color: "amber" },
  { label: "Compliance", value: "1", meta: "", trend: "Insurance expiring today", trendType: "warn", icon: "shield", color: "red", alert: true },
];

const finHealthData = {
  totalContract: "C$2.34M",
  segments: [
    { label: "Paid", value: "C$1.12M", width: "48%", color: "ok" },
    { label: "Unpaid", value: "C$328K", width: "14%", color: "ac" },
    { label: "Retainage", value: "C$140K", width: "6%", color: "wr" },
    { label: "Remaining", value: "C$752K", width: "32%", color: "s4" },
  ],
};

const prioritiesData = [
  { title: "Resolve CO-14 client approval block", desc: "Mechanical reroute waiting on owner signoff — now affecting procurement timing on Riverside.", pill: "Urgent", pillColor: "red", time: "3d open", urgent: true },
  { title: "Review Northline electrical submittal", desc: "Revised package uploaded this morning. PM review needed before end of day.", pill: "Review", pillColor: "blue", time: "Today" },
  { title: "Release weekly owner summary — Riverside", desc: "Progress photos and milestone notes ready. Approval language still needs review.", pill: "Comms", pillColor: "amber", time: "Draft ready" },
  { title: "Follow up on West End bid responses", desc: "Two subcontractor bids still outstanding past 48-hour response window.", pill: "Follow up", pillColor: "gray", time: "Overdue" },
];

const approvalsTabData = [
  { title: "CO-14 mechanical reroute", desc: "Owner signoff required — blocking procurement schedule.", pill: "Blocked", pillColor: "red", time: "3d" },
  { title: "Lighting package selection", desc: "Client decision pending on Riverside fit-out selections.", pill: "Open", pillColor: "amber", time: "5d" },
  { title: "Draw #3 — West End Medical", desc: "Submitted Apr 8, currently under GC review.", pill: "In review", pillColor: "purple", time: "6d" },
  { title: "Drywall sub scope change", desc: "Additional partition requested for Northline — PM sign-off needed.", pill: "Pending", pillColor: "blue", time: "1d" },
];

const projectsTabData = [
  { title: "Riverside Tower Fit-Out", desc: "Phase 3 — Client decision lag affecting two connected workstreams.", pill: "Watch", pillColor: "amber", time: "62%" },
  { title: "West End Medical", desc: "Phase 2 — Stable progress, no major escalation in 48h.", pill: "Healthy", pillColor: "green", time: "41%" },
  { title: "Lot 7 Redevelopment", desc: "Precon — Bid responses slower than expected.", pill: "Monitor", pillColor: "amber", time: "8%" },
  { title: "Northline Office Park", desc: "Phase 1 — On schedule, structural framing completing this week.", pill: "On track", pillColor: "green", time: "24%" },
];

const financialsTabData = [
  { title: "Draw #3 — West End Medical", desc: "C$84K submitted, 3 line items. Awaiting GC review.", pill: "Submitted", pillColor: "blue", time: "Apr 8" },
  { title: "Draw #4 — Riverside Tower", desc: "C$142K draft in progress. Submission deadline Apr 17.", pill: "Draft", pillColor: "gray", time: "Due Apr 17" },
  { title: "Retainage release — Northline", desc: "C$18K retainage eligible for release at Phase 1 completion.", pill: "Eligible", pillColor: "green", time: "Pending" },
  { title: "Insurance premium — ProVolt Electric", desc: "Compliance-linked. Renewed today, certificate uploaded.", pill: "Resolved", pillColor: "green", time: "Today" },
];

const projectHealthData = [
  { name: "Riverside Tower Fit-Out", desc: "Client decision lag on two connected workstreams", pct: 62, barColor: "amber", phase: "Phase 3", pill: "Watch", pillColor: "amber" },
  { name: "West End Medical", desc: "Stable progress, no escalation in 48h", pct: 41, barColor: "green", phase: "Phase 2", pill: "Healthy", pillColor: "green" },
  { name: "Lot 7 Redevelopment", desc: "Bid responses slower than expected", pct: 8, barColor: "gray", phase: "Precon", pill: "Monitor", pillColor: "amber" },
  { name: "Northline Office Park", desc: "On schedule — structural framing completing this week", pct: 24, barColor: "green", phase: "Phase 1", pill: "On track", pillColor: "green" },
];

const activityFeed = [
  { text: "Draw #3 submitted", detail: "for West End Medical — C$84K, 3 line items", actor: "Daniel Chen", time: "45 min ago", color: "ok" },
  { text: "Revised submittal uploaded", detail: "by Northline Electrical — switch schedule rev 3", actor: "Jake Torres", time: "1h ago", color: "in" },
  { text: "RFI-012 response overdue", detail: "on West End Medical — conduit routing clarification", actor: "System", time: "2h ago", color: "wr" },
  { text: "Approval requested", detail: "on CO-14 mechanical reroute — Riverside Tower", actor: "Sarah Kim", time: "3h ago", color: "ac" },
  { text: "Insurance certificate renewed", detail: "by ProVolt Electric — expires Dec 2026", actor: "Compliance", time: "5h ago", color: "ok" },
  { text: "Progress photos uploaded", detail: "for Northline Office — structural framing, 12 photos", actor: "Marcus Lee", time: "6h ago", color: "in" },
];

const approvalsWaiting = [
  { title: "CO-14 owner signoff", desc: "Mechanical reroute — Riverside", pill: "Blocked", pillColor: "red" },
  { title: "Lighting package review", desc: "Client decision pending — Riverside", pill: "Open", pillColor: "amber" },
  { title: "Draw #3 — West End", desc: "Submitted Apr 8, under review", pill: "In review", pillColor: "purple" },
];

const upcomingWeek = [
  { day: "16", mon: "Apr", title: "Electrical rough-in inspection", desc: "Riverside Tower · City inspector" },
  { day: "17", mon: "Apr", title: "Draw #4 submission deadline", desc: "Riverside Tower · AIA G702" },
  { day: "18", mon: "Apr", title: "Selections lock-in deadline", desc: "Riverside Tower · Lighting + flooring" },
  { day: "19", mon: "Apr", title: "Structural framing walkthrough", desc: "Northline Office · PM + structural eng" },
];

const recentMessages = [
  { from: "Client approver", text: "Asked for clarification on CO-14 cost summary.", time: "22m" },
  { from: "Northline Electrical", text: "Uploaded revised submittal, requested same-day review.", time: "1h" },
  { from: "West End PM", text: "Flagged two outstanding bid responses past window.", time: "3h" },
];

const quickHealth = [
  { label: "Delay risk", value: "68%", hint: "Approval driven" },
  { label: "Open RFIs", value: "6", hint: "2 overdue" },
  { label: "Unread msgs", value: "8", hint: "3 threads" },
  { label: "Open invoices", value: "2", hint: "C$188K out" },
];

// ── Main Component ─────────────────────────────────────────────
export default function ContractorDashboard() {
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState({ Core: true, Workflows: true, Projects: true });
  const [activeTab, setActiveTab] = useState("Priorities");
  const sidebarRef = useRef(null);

  const toggleModule = (label) => setExpanded((p) => ({ ...p, [label]: !p[label] }));

  useEffect(() => {
    const h = (e) => { if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) setSidebarOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [sidebarOpen]);

  const tabs = ["Priorities", "Approvals", "Projects", "Financials"];

  const getTabContent = () => {
    switch (activeTab) {
      case "Approvals": return approvalsTabData;
      case "Projects": return projectsTabData;
      case "Financials": return financialsTabData;
      default: return prioritiesData;
    }
  };

  return (
    <div className={`bcrm ${dark ? "dark" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.bcrm {
  --s0:#f0f1f4;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --sb-bg:#fafbfc;--sb-h:#eff0f4;--sb-a:#e8e9f0;
  --sb-bdr:#e4e6eb;--sb-mbg:#fff;--sb-mbdr:#e0e3e8;
  --t1:#111318;--t2:#4a4f5c;--t3:#7d8290;--ti:#faf9f7;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 10px 32px rgba(26,23,20,.08);--shri:0 0 0 3px rgba(91,79,199,.15);
  --sw:268px;--th:52px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  --tb-bg:rgba(255,255,255,.88);--tab-bg:#f8f9fa;--rh:#f8f9fa;--mb:#f8f9fa;
  --tl:#dde0e5;
  font-family:var(--fb);color:var(--t1);
  -webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);min-height:100vh;
}

.bcrm.dark {
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --sb-bg:#10121a;--sb-h:#1a1d2a;--sb-a:#222536;
  --sb-bdr:#222536;--sb-mbg:#151820;--sb-mbdr:#272b3a;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#7b6ff0;--ac-h:#6e62e0;--ac-s:#252040;--ac-t:#a99ff8;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 10px 32px rgba(0,0,0,.35);--shri:0 0 0 3px rgba(123,111,240,.2);
  --tb-bg:rgba(16,18,26,.88);--tab-bg:#1a1d2a;--rh:#1a1d2a;--mb:#1a1d2a;
  --tl:#2e3240;
}

/* ── Layout ─────────────────────────────────────── */
.b-app{display:grid;grid-template-columns:var(--sw) 1fr;min-height:100vh}

/* ── Sidebar ────────────────────────────────────── */
.b-sb{background:var(--sb-bg);border-right:1px solid var(--sb-bdr);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden;z-index:100;transition:transform var(--ds) var(--e)}
.b-hdr{padding:0 14px;height:var(--th);display:flex;align-items:center;border-bottom:1px solid var(--sb-bdr);flex-shrink:0}
.b-hdr-row{display:flex;align-items:center;gap:8px;min-width:0;width:100%}
.b-logo{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#2c2541 0%,var(--ac) 100%);display:grid;place-items:center;flex-shrink:0;overflow:hidden;position:relative}
.b-logo svg{width:24px;height:24px}
.b-appn{font-family:var(--fd);font-size:14px;font-weight:750;color:var(--t1);letter-spacing:-.02em;line-height:1;flex-shrink:0}
.b-slash{font-size:16px;font-weight:300;color:var(--s4);line-height:1;flex-shrink:0;margin:0 -2px}
.b-orgn{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t2);letter-spacing:-.01em;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.b-sw{width:20px;height:20px;border-radius:4px;border:1px solid var(--s3);background:var(--sb-mbg);color:var(--t3);display:grid;place-items:center;cursor:pointer;flex-shrink:0;margin-left:auto;transition:all var(--df) var(--e)}
.b-sw:hover{border-color:var(--s4);color:var(--t2);background:var(--sb-h)}

.b-srch{padding:10px 14px;flex-shrink:0}
.b-srch-w{position:relative}
.b-srch-ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--t3);display:flex;pointer-events:none}
.b-srch-k{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-family:var(--fm);font-size:10px;font-weight:520;color:var(--t3);background:var(--s2);padding:2px 5px;border-radius:4px;border:1px solid var(--s3)}
.b-srch input{width:100%;height:32px;border:1px solid var(--sb-mbdr);border-radius:var(--r-m);padding:0 54px 0 32px;background:var(--sb-mbg);font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.b-srch input::placeholder{color:var(--t3)}
.b-srch input:focus{border-color:var(--ac);box-shadow:var(--shri)}

.b-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px 10px 24px}
.b-nav::-webkit-scrollbar{width:3px}
.b-nav::-webkit-scrollbar-track{background:transparent}
.b-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

.b-mod{background:var(--sb-mbg);border:1px solid var(--sb-mbdr);border-radius:var(--r-l);margin-bottom:6px;overflow:hidden;transition:border-color var(--dn) var(--e),box-shadow var(--dn) var(--e)}
.b-mod:hover{border-color:var(--s4)}
.b-mod.exp{box-shadow:var(--shsm)}
.b-mod-h{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;user-select:none;background:none;border:none;width:100%;font-family:var(--fd);font-size:12.5px;font-weight:720;color:var(--t1);letter-spacing:-.01em;transition:background var(--df) var(--e)}
.b-mod-h:hover{background:var(--sb-h)}
.b-mod-ico{width:16px;height:16px;display:flex;align-items:center;justify-content:center;color:var(--t3);flex-shrink:0}
.b-mod-chev{width:12px;height:12px;margin-left:auto;flex-shrink:0;color:var(--t3);transition:transform var(--dn) var(--e)}
.b-mod-chev.open{transform:rotate(90deg)}

.b-tree{padding:0 6px 6px}

.b-ti{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 14px;margin-left:10px;border-left:1.5px solid var(--tl);font-size:13px;font-weight:600;color:var(--t2);cursor:pointer;border-radius:0 var(--r-s) var(--r-s) 0;transition:all var(--df) var(--e);position:relative}
.b-ti::before{content:'';position:absolute;left:-1.5px;top:50%;width:10px;height:1.5px;background:var(--tl)}
.b-ti:last-child{border-left-color:transparent}
.b-ti:last-child::after{content:'';position:absolute;left:-1.5px;top:0;width:1.5px;height:50%;background:var(--tl)}
.b-ti:hover{background:var(--sb-h);color:var(--t1)}
.b-ti.on{background:var(--sb-a);color:var(--t1);font-weight:700}
.b-ti.on .b-dot-ac{display:block}
.b-dot-ac{display:none;width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0;margin-left:auto}
.b-ti .b-dot-ac{margin-left:auto}
.b-tbdg{min-width:16px;height:16px;padding:0 5px;border-radius:999px;font-size:10px;font-weight:750;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0;margin-left:auto;background:var(--ac-s);color:var(--ac-t)}
.b-tbdg.warn{background:var(--wr-s);color:var(--wr-t)}
.b-tbdg.danger{background:var(--dg-s);color:var(--dg-t)}

.b-tp{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;margin-left:10px;border-left:1.5px solid var(--tl);font-size:13px;font-weight:580;color:var(--t2);cursor:pointer;border-radius:0 var(--r-s) var(--r-s) 0;transition:all var(--df) var(--e);position:relative}
.b-tp::before{content:'';position:absolute;left:-1.5px;top:50%;width:10px;height:1.5px;background:var(--tl)}
.b-tp:last-child{border-left-color:transparent}
.b-tp:last-child::after{content:'';position:absolute;left:-1.5px;top:0;width:1.5px;height:50%;background:var(--tl)}
.b-tp:hover{background:var(--sb-h);color:var(--t1)}
.b-tp.on{background:var(--sb-a);color:var(--t1);font-weight:680}
.b-pd{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.b-pd.green{background:var(--ok)}.b-pd.amber{background:var(--wr)}.b-pd.red{background:var(--dg)}.b-pd.gray{background:var(--s4)}
.b-pp{font-family:var(--fd);font-size:10.5px;font-weight:680;color:var(--t2);letter-spacing:.01em;margin-left:auto;flex-shrink:0}

.b-foot{border-top:1px solid var(--sb-bdr);padding:10px 14px;flex-shrink:0}
.b-user{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--r-m);cursor:pointer;transition:background var(--df) var(--e)}
.b-user:hover{background:var(--sb-h)}
.b-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--ac) 0%,#7c6fe0 100%);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:10.5px;font-weight:800;flex-shrink:0}
.b-un{font-size:13px;font-weight:660;color:var(--t1);line-height:1.2}
.b-ur{font-size:11px;font-weight:520;color:var(--t3);line-height:1.2;margin-top:1px}

/* ── Main ───────────────────────────────────────── */
.b-main{min-width:0;display:flex;flex-direction:column}
.b-top{height:var(--th);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:var(--tb-bg);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);position:sticky;top:0;z-index:50}
.b-bc{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:580;color:var(--t3)}
.b-bc-lnk{cursor:pointer;transition:color var(--df)}.b-bc-lnk:hover{color:var(--t2)}
.b-bc-sep{font-size:10px;color:var(--s4)}.b-bc-cur{color:var(--t1);font-weight:720}

.b-tr{display:flex;align-items:center;gap:6px}
.b-tbb{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df) var(--e);position:relative}
.b-tbb:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.b-nd{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--dg);border:2px solid var(--s1)}
.b-tav{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac) 0%,#7c6fe0 100%);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:10.5px;font-weight:800;cursor:pointer;margin-left:2px}
.b-menu{display:none;width:34px;height:34px;border:none;background:none;color:var(--t1);cursor:pointer;place-items:center;border-radius:var(--r-m);transition:background var(--df)}
.b-menu:hover{background:var(--sh)}

/* ── Content ────────────────────────────────────── */
.b-cnt{padding:24px;flex:1}
.b-ph{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px}
.b-pt{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;line-height:1.1;color:var(--t1);margin:0}
.b-pst{margin-top:6px;font-size:14px;font-weight:520;color:var(--t2);max-width:640px;line-height:1.5}
.b-pa{display:flex;gap:8px;flex-shrink:0;padding-top:2px}

/* ── Buttons ────────────────────────────────────── */
.b-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:620;color:var(--t1);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap}
.b-btn:hover{background:var(--sh);border-color:var(--s4)}
.b-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:680}
.b-btn.pri:hover{background:var(--ac-h);border-color:var(--ac-h)}
.b-btn.gh{background:transparent;border-color:transparent;color:var(--t2)}
.b-btn.gh:hover{background:var(--sh);color:var(--t1)}

/* ── KPI Strip ──────────────────────────────────── */
.b-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.b-kpi{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;transition:all var(--dn) var(--e)}
.b-kpi:hover{box-shadow:var(--shmd);border-color:var(--s4)}
.b-kpi.alert{border-color:var(--wr);border-width:1.5px}
.b-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.b-kpi-l{font-family:var(--fb);font-size:12px;font-weight:560;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
.b-kpi-ico{width:28px;height:28px;border-radius:var(--r-s);display:grid;place-items:center}
.b-kpi-ico.blue{background:var(--in-s);color:var(--in-t)}
.b-kpi-ico.purple{background:var(--ac-s);color:var(--ac-t)}
.b-kpi-ico.green{background:var(--ok-s);color:var(--ok-t)}
.b-kpi-ico.amber{background:var(--wr-s);color:var(--wr-t)}
.b-kpi-ico.red{background:var(--dg-s);color:var(--dg-t)}
.b-kpi-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.1}
.b-kpi-m{font-family:var(--fb);font-size:12px;font-weight:580;color:var(--t2);margin-top:4px}
.b-trend{font-weight:720}
.b-trend.up{color:var(--ok-t)}.b-trend.warn{color:var(--wr-t)}.b-trend.down{color:var(--dg-t)}

/* ── Financial Health Strip ─────────────────────── */
.b-fin{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px 20px;display:flex;align-items:center;gap:24px;margin-bottom:20px;transition:box-shadow var(--dn) var(--e)}
.b-fin:hover{box-shadow:var(--shmd)}
.b-fin-left{flex-shrink:0;min-width:170px}
.b-fin-title{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:11.5px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.b-fin-total{display:flex;align-items:baseline;gap:6px}
.b-fin-val{font-family:var(--fd);font-size:22px;font-weight:820;color:var(--t1);letter-spacing:-.03em;line-height:1.1}
.b-fin-label{font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t2)}
.b-fin-center{flex:1;min-width:0}
.b-fin-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--s3)}
.b-fin-seg{height:100%;transition:width var(--ds) var(--e)}
.b-fin-legend{display:flex;gap:16px;margin-top:8px;flex-wrap:wrap}
.b-fin-leg{display:flex;align-items:center;gap:4px;font-family:var(--fb);font-size:11.5px;font-weight:560;color:var(--t2)}
.b-fin-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.b-fin-right{flex-shrink:0}
.b-fin-link{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--ac-t);text-decoration:none;white-space:nowrap;padding:6px 12px;border-radius:var(--r-m);transition:all var(--df) var(--e);cursor:pointer;display:inline-block}
.b-fin-link:hover{background:var(--ac-s)}

/* ── Dash Grid ──────────────────────────────────── */
.b-dg{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.b-dm{display:flex;flex-direction:column;gap:16px}
.b-drl{display:flex;flex-direction:column;gap:16px}

/* ── Cards ──────────────────────────────────────── */
.b-c{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;transition:box-shadow var(--dn) var(--e)}
.b-c:hover{box-shadow:var(--shsm)}
.b-c.alert{border-color:var(--wr);border-width:1.5px}
.b-c.alert .b-ch{border-bottom-color:rgba(193,122,26,.15)}
.b-ch{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3)}
.b-ctt{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);letter-spacing:-.01em}
.b-cst{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin-top:2px}
.b-ctabs{display:flex;padding:0 20px;border-bottom:1px solid var(--s3);background:var(--tab-bg)}
.b-ctab{padding:10px 14px;font-size:13px;font-weight:600;color:var(--t3);cursor:pointer;border:none;border-bottom:2px solid transparent;transition:all var(--df) var(--e);white-space:nowrap;background:none;font-family:var(--fb);margin-bottom:-1px}
.b-ctab:hover{color:var(--t2)}
.b-ctab.on{color:var(--t1);font-weight:720;border-bottom-color:var(--ac)}
.b-cb{padding:16px 20px}

/* ── Rows ───────────────────────────────────────── */
.b-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 16px;border-radius:var(--r-m);transition:background var(--df) var(--e);cursor:pointer}
.b-row:hover{background:var(--rh)}.b-row+.b-row{border-top:1px solid var(--s3)}
.b-row.urg{border-left:3px solid var(--dg);padding-left:13px}
.b-row h5{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.01em;line-height:1.3;margin:0}
.b-row p{font-size:12.5px;font-weight:520;color:var(--t2);margin:2px 0 0;line-height:1.4}
.b-rm{display:flex;align-items:center;gap:8px;flex-shrink:0;padding-top:1px}

/* ── Pills ──────────────────────────────────────── */
.b-pill{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap;font-family:var(--fd)}
.b-pill.red{background:var(--dg-s);color:var(--dg-t)}
.b-pill.amber{background:var(--wr-s);color:var(--wr-t)}
.b-pill.green{background:var(--ok-s);color:var(--ok-t)}
.b-pill.blue{background:var(--in-s);color:var(--in-t)}
.b-pill.purple{background:var(--ac-s);color:var(--ac-t)}
.b-pill.gray{background:var(--s2);color:var(--t2)}
.b-time{font-family:var(--fd);font-size:11.5px;color:var(--t2);font-weight:620;white-space:nowrap}

/* ── Project Health with Progress Bars ──────────── */
.b-ph-row{display:grid;grid-template-columns:1fr 100px 70px 72px;gap:12px;align-items:center;padding:12px 16px;border-radius:var(--r-m);cursor:pointer;transition:background var(--df) var(--e)}
.b-ph-row:hover{background:var(--rh)}
.b-ph-row+.b-ph-row{border-top:1px solid var(--s3)}
.b-ph-row h5{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.01em;line-height:1.3;margin:0}
.b-ph-row p{font-size:12px;font-weight:520;color:var(--t2);margin:1px 0 0;line-height:1.4}
.b-pbar-wrap{display:flex;flex-direction:column;gap:3px}
.b-pbar{height:6px;background:var(--s3);border-radius:3px;overflow:hidden}
.b-pfill{height:100%;border-radius:3px;transition:width var(--ds) var(--e)}
.b-pfill.green{background:var(--ok)}
.b-pfill.amber{background:var(--wr)}
.b-pfill.blue{background:var(--ac)}
.b-pfill.gray{background:var(--s4)}
.b-pbar-pct{font-family:var(--fd);font-size:11px;font-weight:520;color:var(--t2)}
.b-ph-phase{font-family:var(--fd);font-size:11px;font-weight:680;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;text-align:center}

/* ── Activity Feed ──────────────────────────────── */
.b-act{display:flex;flex-direction:column;gap:0}
.b-act-item{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--s3)}
.b-act-item:last-child{border-bottom:none;padding-bottom:0}
.b-act-item:first-child{padding-top:0}
.b-act-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:6px}
.b-act-dot.ok{background:var(--ok)}.b-act-dot.wr{background:var(--wr)}.b-act-dot.dg{background:var(--dg)}.b-act-dot.ac{background:var(--ac)}.b-act-dot.in{background:var(--in)}
.b-act-body{flex:1;min-width:0}
.b-act-text{font-size:13px;color:var(--t1);line-height:1.45}
.b-act-text strong{font-weight:680}
.b-act-meta{font-size:11.5px;font-weight:520;color:var(--t3);margin-top:2px}

/* ── Timeline (Upcoming) ───────────────────────── */
.b-tl{display:flex;flex-direction:column;gap:0}
.b-tl-item{display:flex;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--s3)}
.b-tl-item:last-child{border-bottom:none;padding-bottom:0}
.b-tl-item:first-child{padding-top:0}
.b-tl-date{width:38px;flex-shrink:0;text-align:center;padding-top:1px}
.b-tl-day{font-family:var(--fd);font-size:17px;font-weight:780;color:var(--t1);line-height:1.1;letter-spacing:-.02em}
.b-tl-mon{font-family:var(--fd);font-size:10.5px;font-weight:680;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
.b-tl-content{flex:1;min-width:0}
.b-tl-content h5{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);line-height:1.3;letter-spacing:-.01em;margin:0}
.b-tl-content p{font-size:12px;font-weight:520;color:var(--t2);margin:1px 0 0}

/* ── Metrics Grid ───────────────────────────────── */
.b-mets{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.b-met{padding:12px;border-radius:var(--r-m);background:var(--mb);border:1px solid var(--s3)}
.b-met-l{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t2);letter-spacing:.02em;text-transform:uppercase}
.b-met-v{font-family:var(--fd);font-size:18px;font-weight:820;color:var(--t1);margin-top:2px;letter-spacing:-.02em}
.b-met-h{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t2);margin-top:2px}

/* ── Animations ─────────────────────────────────── */
@keyframes bf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.b-cnt>*{animation:bf var(--ds) var(--e) both}
.b-cnt>*:nth-child(1){animation-delay:0ms}
.b-cnt>*:nth-child(2){animation-delay:50ms}
.b-cnt>*:nth-child(3){animation-delay:100ms}
.b-cnt>*:nth-child(4){animation-delay:150ms}
@keyframes bt{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
.b-ti,.b-tp{animation:bt var(--dn) var(--e) both}

.b-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:90;opacity:0;transition:opacity var(--dn)}
.b-ov.vis{opacity:1}

/* ── Responsive ─────────────────────────────────── */
@media(max-width:1280px){
  .b-kpis{grid-template-columns:repeat(3,1fr)}
  .b-dg{grid-template-columns:1fr}
  .b-drl{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
  .b-fin{flex-wrap:wrap}
  .b-ph-row{grid-template-columns:1fr 90px 60px 68px}
}
@media(max-width:768px){
  .b-app{grid-template-columns:1fr}
  .b-sb{position:fixed;top:0;left:0;bottom:0;width:var(--sw);transform:translateX(-100%);box-shadow:var(--shlg)}
  .b-sb.open{transform:translateX(0)}
  .b-ov{display:block}
  .b-menu{display:grid}
  .b-top{padding:0 16px}
  .b-cnt{padding:16px}
  .b-kpis{grid-template-columns:repeat(2,1fr)}
  .b-ph{flex-direction:column;gap:12px}
  .b-pa{width:100%}.b-pa .b-btn{flex:1;justify-content:center}
  .b-pt{font-size:22px}
  .b-fin{flex-direction:column;align-items:stretch}
  .b-fin-left{min-width:auto}
  .b-ph-row{grid-template-columns:1fr;gap:8px}
  .b-ph-row .b-pbar-wrap{order:2}
  .b-ph-row .b-ph-phase{text-align:left;order:3}
}
@media(max-width:480px){
  .b-kpis{grid-template-columns:1fr}
  .b-drl{grid-template-columns:1fr}
}
      `}</style>

      <div className="b-app">
        <div className={`b-ov ${sidebarOpen?"vis":""}`} onClick={()=>setSidebarOpen(false)}/>

        {/* ── SIDEBAR ─────────────────────────── */}
        <aside ref={sidebarRef} className={`b-sb ${sidebarOpen?"open":""}`}>
          <div className="b-hdr">
            <div className="b-hdr-row">
              <div className="b-logo"><svg viewBox="0 0 80 80"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/></svg></div>
              <span className="b-appn">BuiltCRM</span>
              <span className="b-slash">/</span>
              <span className="b-orgn">Summit Contracting</span>
              <button className="b-sw" aria-label="Switch workspace">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </div>
          <div className="b-srch"><div className="b-srch-w"><span className="b-srch-ico">{Icons.search}</span><input type="text" placeholder="Search..."/><span className="b-srch-k">/</span></div></div>
          <nav className="b-nav">
            {navModules.map((mod)=>{
              const isOpen=!!expanded[mod.label];
              return(
                <div className={`b-mod ${isOpen?"exp":""}`} key={mod.label}>
                  <button className="b-mod-h" onClick={()=>toggleModule(mod.label)}>
                    <span className="b-mod-ico">{isOpen?Icons.folderOpen:Icons.folder}</span>
                    {mod.label}
                    <span className={`b-mod-chev ${isOpen?"open":""}`}>{Icons.chevronRight}</span>
                  </button>
                  {isOpen&&(
                    <div className="b-tree">
                      {mod.isProjects
                        ? mod.items.map((p,i)=>(
                            <div key={i} className={`b-tp ${p.active?"on":""}`} style={{animationDelay:`${i*30}ms`}}>
                              <span className={`b-pd ${p.dot}`}/><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span><span className="b-pp">{p.phase}</span>
                            </div>
                          ))
                        : mod.items.map((item,i)=>(
                            <div key={item.label} className={`b-ti ${item.active?"on":""}`} style={{animationDelay:`${i*30}ms`}}>
                              <span style={{flex:1}}>{item.label}</span>
                              {item.badge!=null&&<span className={`b-tbdg ${item.badgeType||""}`}>{item.badge}</span>}
                              {item.active&&<span className="b-dot-ac"/>}
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="b-foot"><div className="b-user"><div className="b-av">DC</div><div><div className="b-un">Daniel Chen</div><div className="b-ur">Project Manager</div></div></div></div>
        </aside>

        {/* ── MAIN ────────────────────────────── */}
        <main className="b-main">
          <div className="b-top">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button className="b-menu" onClick={()=>setSidebarOpen(!sidebarOpen)}>{sidebarOpen?Icons.x:Icons.menu}</button>
              <div className="b-bc"><span className="b-bc-lnk">Contractor Portal</span><span className="b-bc-sep">/</span><span className="b-bc-cur">Dashboard</span></div>
            </div>
            <div className="b-tr">
              <button className="b-tbb" onClick={()=>setDark(!dark)} title={dark?"Light mode":"Dark mode"}>{dark?Icons.sun:Icons.moon}</button>
              <div className="b-tbb">{Icons.bell}<div className="b-nd"/></div>
              <div className="b-tav">DC</div>
            </div>
          </div>

          <div className="b-cnt">
            {/* Page Header */}
            <div className="b-ph">
              <div><h1 className="b-pt">Dashboard</h1><p className="b-pst">What needs attention across your active projects today.</p></div>
              <div className="b-pa"><button className="b-btn">New Project</button><button className="b-btn pri">Open Approvals</button></div>
            </div>

            {/* KPI Strip */}
            <section className="b-kpis">
              {kpiData.map((k)=>(
                <div key={k.label} className={`b-kpi ${k.alert?"alert":""}`}>
                  <div className="b-kpi-top"><div className="b-kpi-l">{k.label}</div><div className={`b-kpi-ico ${k.color}`}>{Icons[k.icon]}</div></div>
                  <div className="b-kpi-v">{k.value}</div>
                  <div className="b-kpi-m">{k.meta}{k.trend&&<>{k.meta?" ":""}<span className={`b-trend ${k.trendType}`}>{k.meta?"· ":""}{k.trend}</span></>}{k.meta2&&<> · {k.meta2}</>}</div>
                </div>
              ))}
            </section>

            {/* Financial Health Strip */}
            <section className="b-fin">
              <div className="b-fin-left">
                <div className="b-fin-title">
                  {Icons.creditCard}
                  Financial health
                </div>
                <div className="b-fin-total">
                  <span className="b-fin-val">{finHealthData.totalContract}</span>
                  <span className="b-fin-label">total contract value</span>
                </div>
              </div>
              <div className="b-fin-center">
                <div className="b-fin-bar">
                  {finHealthData.segments.map((seg)=>(
                    <div key={seg.label} className="b-fin-seg" style={{width:seg.width, background:`var(--${seg.color})`}}/>
                  ))}
                </div>
                <div className="b-fin-legend">
                  {finHealthData.segments.map((seg)=>(
                    <div key={seg.label} className="b-fin-leg">
                      <div className="b-fin-dot" style={{background:`var(--${seg.color})`}}/>
                      {seg.label} · {seg.value}
                    </div>
                  ))}
                </div>
              </div>
              <div className="b-fin-right">
                <span className="b-fin-link">View financials →</span>
              </div>
            </section>

            {/* Main Dashboard Grid */}
            <section className="b-dg">
              {/* LEFT COLUMN */}
              <div className="b-dm">

                {/* Today's Priorities (tabbed) */}
                <div className="b-c">
                  <div className="b-ch"><div><div className="b-ctt">Today's priorities</div><div className="b-cst">Work that needs action now across all projects</div></div><button className="b-btn gh" style={{fontSize:12}}>View all</button></div>
                  <div className="b-ctabs">{tabs.map((t)=>(<button key={t} className={`b-ctab ${activeTab===t?"on":""}`} onClick={()=>setActiveTab(t)}>{t}</button>))}</div>
                  <div className="b-cb">
                    {getTabContent().map((p,i)=>(
                      <div key={i} className={`b-row ${p.urgent?"urg":""}`}>
                        <div><h5>{p.title}</h5><p>{p.desc}</p></div>
                        <div className="b-rm"><span className={`b-pill ${p.pillColor}`}>{p.pill}</span><span className="b-time">{p.time}</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project Health with Progress Bars */}
                <div className="b-c">
                  <div className="b-ch"><div><div className="b-ctt">Project health</div><div className="b-cst">Completion and status across active projects</div></div></div>
                  <div className="b-cb" style={{paddingTop:8}}>
                    {projectHealthData.map((p,i)=>(
                      <div key={i} className="b-ph-row">
                        <div><h5>{p.name}</h5><p>{p.desc}</p></div>
                        <div className="b-pbar-wrap">
                          <div className="b-pbar"><div className={`b-pfill ${p.barColor}`} style={{width:`${p.pct}%`}}/></div>
                          <div className="b-pbar-pct">{p.pct}%</div>
                        </div>
                        <div className="b-ph-phase">{p.phase}</div>
                        <span className={`b-pill ${p.pillColor}`}>{p.pill}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="b-c">
                  <div className="b-ch"><div><div className="b-ctt">Recent activity</div><div className="b-cst">What happened across your projects</div></div><button className="b-btn gh" style={{fontSize:12}}>View all</button></div>
                  <div className="b-cb">
                    <div className="b-act">
                      {activityFeed.map((a,i)=>(
                        <div key={i} className="b-act-item">
                          <div className={`b-act-dot ${a.color}`}/>
                          <div className="b-act-body">
                            <div className="b-act-text"><strong>{a.text}</strong> {a.detail}</div>
                            <div className="b-act-meta">{a.actor} · {a.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT RAIL */}
              <div className="b-drl">

                {/* Approvals Waiting */}
                <div className="b-c alert">
                  <div className="b-ch"><div><div className="b-ctt">Approvals waiting</div><div className="b-cst">Blocking release steps</div></div></div>
                  <div className="b-cb">
                    {approvalsWaiting.map((a,i)=>(
                      <div key={i} className="b-row">
                        <div><h5>{a.title}</h5><p>{a.desc}</p></div>
                        <div className="b-rm"><span className={`b-pill ${a.pillColor}`}>{a.pill}</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming This Week */}
                <div className="b-c">
                  <div className="b-ch"><div><div className="b-ctt">Upcoming this week</div></div><button className="b-btn gh" style={{fontSize:12}}>Schedule</button></div>
                  <div className="b-cb">
                    <div className="b-tl">
                      {upcomingWeek.map((u,i)=>(
                        <div key={i} className="b-tl-item">
                          <div className="b-tl-date">
                            <div className="b-tl-day">{u.day}</div>
                            <div className="b-tl-mon">{u.mon}</div>
                          </div>
                          <div className="b-tl-content">
                            <h5>{u.title}</h5>
                            <p>{u.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Health Metrics */}
                <div className="b-c">
                  <div className="b-ch"><div><div className="b-ctt">Quick health</div></div></div>
                  <div className="b-cb">
                    <div className="b-mets">
                      {quickHealth.map((m,i)=>(
                        <div key={i} className="b-met">
                          <div className="b-met-l">{m.label}</div>
                          <div className="b-met-v">{m.value}</div>
                          <div className="b-met-h">{m.hint}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Messages */}
                <div className="b-c">
                  <div className="b-ch"><div><div className="b-ctt">Recent messages</div></div><button className="b-btn gh" style={{fontSize:12}}>View all</button></div>
                  <div className="b-cb">
                    {recentMessages.map((m,i)=>(
                      <div key={i} className="b-row">
                        <div><h5>{m.from}</h5><p>{m.text}</p></div>
                        <div className="b-rm"><span className="b-time">{m.time}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
