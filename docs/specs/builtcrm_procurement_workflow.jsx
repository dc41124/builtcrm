import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>,
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  send: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  truck: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  invoice: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  chevron: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  building: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 12h1M9 15h1M14 9h1M14 12h1M14 15h1"/></svg>,
};

// ── Logo Mark (Option F) ────────────────────────────────────────
const Logo = ({ s = 32 }) => (
  <div style={{ width: s, height: s, borderRadius: 10, background: "linear-gradient(135deg,#1a1714,#3d3830)", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.55} height={s * 0.55}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="#faf9f7" opacity=".95"/>
    </svg>
  </div>
);

// ── Contractor sidebar nav ──────────────────────────────────────
const contractorNav = [
  { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Inbox", badge: 8, bt: "blue" }] },
  { section: "Riverside Tower Fit-Out", items: [
    { label: "Project Home" },
    { label: "RFIs / Issues", badge: 9, bt: "danger" },
    { label: "Approvals", badge: 5, bt: "blue" },
    { label: "Change Orders", badge: 2, bt: "blue" },
    { label: "Billing / Draws" },
    { label: "Procurement / POs", active: true, badge: 3, bt: "blue" },
    { label: "Compliance", badge: 3, bt: "warn" },
    { label: "Documents" },
    { label: "Schedule" },
    { label: "Team" },
  ]},
];

// ── Vendor catalog ──────────────────────────────────────────────
const vendors = [
  { id: "v-acme", name: "Acme Structural Steel", contact: "Reg Halvorson", email: "orders@acmesteel.com", terms: "Net 30", activePOs: 2, totalYTD: 284500, rating: "preferred" },
  { id: "v-brdg", name: "Bridgewater MEP Supply", contact: "Mina Chen", email: "po@bridgewatermep.com", terms: "Net 45", activePOs: 1, totalYTD: 118300, rating: "preferred" },
  { id: "v-horz", name: "Horizon Glass & Glazing", contact: "Paul Kimmel", email: "quotes@horizonglass.ca", terms: "50% deposit", activePOs: 0, totalYTD: 62100, rating: "standard" },
  { id: "v-lkn", name: "Lakeside Concrete", contact: "Derek Moss", email: "dispatch@lakesideconcrete.com", terms: "Net 15", activePOs: 1, totalYTD: 156200, rating: "standard" },
  { id: "v-prm", name: "Prime Hardware & Fasteners", contact: "Orders desk", email: "orders@primehw.com", terms: "Net 30", activePOs: 0, totalYTD: 28400, rating: "standard" },
  { id: "v-sig", name: "Signal Electrical Supply", contact: "Amar Patel", email: "counter@signalelec.com", terms: "Net 30", activePOs: 2, totalYTD: 94800, rating: "preferred" },
];

// ── PO list (realistic mix of statuses) ─────────────────────────
const purchaseOrders = [
  {
    id: "po-1048",
    number: "PO-1048",
    vendor: "Acme Structural Steel",
    vendorId: "v-acme",
    ordered: "Apr 14, 2026",
    delivery: "Apr 29",
    status: "partially_received",
    statusLabel: "Partially received",
    st: "orange",
    total: 184500,
    lines: 4,
    linesReceived: "2 of 4",
    costCode: "05-12 Structural Steel",
    active: true,
  },
  {
    id: "po-1047",
    number: "PO-1047",
    vendor: "Signal Electrical Supply",
    vendorId: "v-sig",
    ordered: "Apr 12, 2026",
    delivery: "Apr 22",
    status: "issued",
    statusLabel: "Issued",
    st: "blue",
    total: 48200,
    lines: 6,
    linesReceived: "0 of 6",
    costCode: "26-05 Common Work Electrical",
  },
  {
    id: "po-1046",
    number: "PO-1046",
    vendor: "Bridgewater MEP Supply",
    vendorId: "v-brdg",
    ordered: "Apr 10, 2026",
    delivery: "Apr 18",
    status: "fully_received",
    statusLabel: "Fully received",
    st: "green",
    total: 68300,
    lines: 3,
    linesReceived: "3 of 3",
    costCode: "23-05 HVAC General",
  },
  {
    id: "po-1045",
    number: "PO-1045",
    vendor: "Lakeside Concrete",
    vendorId: "v-lkn",
    ordered: "Apr 8, 2026",
    delivery: "Apr 16",
    status: "invoiced",
    statusLabel: "Invoiced",
    st: "accent",
    total: 42800,
    lines: 2,
    linesReceived: "2 of 2",
    costCode: "03-30 Cast-in-Place Concrete",
  },
  {
    id: "po-1044",
    number: "PO-1044",
    vendor: "Acme Structural Steel",
    vendorId: "v-acme",
    ordered: "Apr 3, 2026",
    delivery: "Apr 10",
    status: "closed",
    statusLabel: "Closed",
    st: "neutral",
    total: 99800,
    lines: 5,
    linesReceived: "5 of 5",
    costCode: "05-12 Structural Steel",
  },
  {
    id: "po-1043",
    number: "PO-1043",
    vendor: "Signal Electrical Supply",
    vendorId: "v-sig",
    ordered: null,
    delivery: null,
    status: "draft",
    statusLabel: "Draft",
    st: "neutral",
    total: 12400,
    lines: 3,
    linesReceived: "—",
    costCode: "26-27 Low-Voltage Distribution",
  },
];

// ── Tabs & status filter chips ──────────────────────────────────
const statusTabs = [
  { key: "all", label: "All", count: 6 },
  { key: "open", label: "Open", count: 3 },
  { key: "receiving", label: "Receiving", count: 2 },
  { key: "invoiced", label: "To invoice / close", count: 2 },
  { key: "closed", label: "Closed", count: 1 },
  { key: "drafts", label: "Drafts", count: 1 },
];

// ── PO-1048 detail (active record) — full line items + receiving checklist ──
const activePO = {
  number: "PO-1048",
  vendor: "Acme Structural Steel",
  vendorContact: "Reg Halvorson · orders@acmesteel.com",
  project: "Riverside Tower Fit-Out",
  projectRef: "RT-2026",
  costCode: "05-12 Structural Steel",
  orderedAt: "Apr 14, 2026 · 11:42am",
  orderedBy: "Daniel Chen",
  delivery: "Apr 29, 2026 (expected)",
  status: "partially_received",
  statusLabel: "Partially received",
  st: "orange",
  terms: "Net 30",
  total: 184500,
  subtotal: 174000,
  tax: 10500,
  notes: "Phased delivery — steel for levels 4 and 5 this drop; level 6 ships the week of Apr 28. Coordinate crane window with site super Marcus Webb.",
  documents: [
    { name: "Acme Quote Q-8823.pdf", kind: "Quote", size: "124 KB", role: "input" },
    { name: "PO-1048 issued.pdf", kind: "PO", size: "86 KB", role: "output" },
    { name: "Delivery ticket DT-4471.pdf", kind: "Receiving", size: "42 KB", role: "receiving" },
  ],
  lines: [
    { id: "l1", desc: "W14x30 structural beam, 20' lengths", qty: 12, unit: "ea", unitCost: 1840, total: 22080, received: 12, status: "received" },
    { id: "l2", desc: "W10x22 structural beam, 16' lengths", qty: 8, unit: "ea", unitCost: 1420, total: 11360, received: 8, status: "received" },
    { id: "l3", desc: "HSS 8x8x3/8 column, 14' lengths", qty: 16, unit: "ea", unitCost: 2180, total: 34880, received: 0, status: "pending" },
    { id: "l4", desc: "Base plates, anchor sets, splice plates (assembly #SP-4)", qty: 1, unit: "lot", unitCost: 105680, total: 105680, received: 0, status: "pending" },
  ],
  timeline: [
    { label: "Draft created", by: "Daniel Chen", when: "Apr 13 · 3:14pm", kind: "action" },
    { label: "Issued to vendor · sent by email", by: "Daniel Chen", when: "Apr 14 · 11:42am", kind: "action" },
    { label: "Vendor acknowledged", by: "Acme Structural Steel", when: "Apr 14 · 2:10pm", kind: "sys" },
    { label: "Partial delivery received · lines 1, 2", by: "Marcus Webb", when: "Apr 21 · 8:22am", kind: "action" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// ── Component ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
export default function ProcurementWorkflow() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("procurement"); // procurement | vendors
  const [activeTab, setActiveTab] = useState(0);
  const [activePOId, setActivePOId] = useState("po-1048");
  const [showCreate, setShowCreate] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardVendor, setWizardVendor] = useState("");
  const [wizardLines, setWizardLines] = useState([
    { id: 1, desc: "", qty: "", unit: "ea", unitCost: "" },
  ]);
  const [sendCopy, setSendCopy] = useState(true);

  const active = purchaseOrders.find((p) => p.id === activePOId) || purchaseOrders[0];

  const addLine = () => setWizardLines((ls) => [...ls, { id: Date.now(), desc: "", qty: "", unit: "ea", unitCost: "" }]);
  const rmLine = (id) => setWizardLines((ls) => ls.filter((l) => l.id !== id));

  return (
    <div className={`rw ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.rw{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 8px 32px rgba(26,23,20,.1);--shri:0 0 0 3px rgba(91,79,199,.15);
  --sbw:272px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.rw.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);--shlg:0 8px 32px rgba(0,0,0,.35);
}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}
input,select,textarea{font-family:inherit}

/* ── Sidebar ─────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.sb-srch{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
.sb-srch input{width:100%;height:36px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none;transition:border-color var(--df)}
.sb-srch input:focus{border-color:var(--ac)}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}
.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}
.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}

/* ── Main ─────────────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.rw.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}
.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}
.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px;flex:1}

/* View switcher (POs vs Vendors) */
.vsw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.vsw button{height:36px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e)}
.vsw button:hover{color:var(--t1)}
.vsw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}

/* Page header */
.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:620px;line-height:1.5}
.pg-h-acts{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

/* Summary strip */
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.sc.alert{border-color:#f5d5a0}.rw.dk .sc.alert{border-color:#5a4420}
.sc.danger{border-color:#f5baba}.rw.dk .sc.danger{border-color:#5a2020}
.sc.strong{border-color:var(--ac-m)}
.sc-label{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

/* Buttons */
.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--df) var(--e);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.sm{height:32px;padding:0 12px;font-size:12px}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2);color:var(--t1)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd);letter-spacing:.02em}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.pl.neutral{background:var(--s2);color:var(--t2);border-color:var(--s3)}
.mt{height:20px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--s3);background:var(--s2);color:var(--t3);display:inline-flex;align-items:center;white-space:nowrap;font-family:var(--fd)}

.mono{font-family:var(--fm);font-size:12px;color:var(--t1);letter-spacing:.01em}

/* ── Main grid ───────────────────────────────────── */
.pg-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}

/* Workspace card */
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid var(--s3)}
.ws-head h3{font-family:var(--fd);font-size:14px;font-weight:700}
.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}

.ws-tabs{display:flex;gap:6px;padding:12px 20px;border-bottom:1px solid var(--s3);flex-wrap:wrap;align-items:center}
.wtab{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all var(--df)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}
.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.wtab .c{font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);padding:1px 6px;background:var(--s2);border-radius:999px}
.wtab.on .c{background:var(--s1);color:var(--ac-t)}

/* Toolbar row above the table */
.q-tb{display:flex;gap:8px;padding:10px 20px;background:var(--si);border-bottom:1px solid var(--s3);align-items:center;flex-wrap:wrap}
.q-sel,.q-in{height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);padding:0 10px;font-size:12px;font-family:var(--fb);outline:none}
.q-sel:hover,.q-in:hover{border-color:var(--s4)}
.q-in{flex:1;min-width:200px;max-width:280px}

/* Table */
.po-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.po-tbl thead th{position:sticky;top:0;background:var(--sh);font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:10px 14px;text-align:left;border-bottom:1px solid var(--s3);white-space:nowrap}
.po-tbl thead th.r{text-align:right}
.po-tbl tbody td{padding:12px 14px;border-bottom:1px solid var(--s3);color:var(--t1);vertical-align:middle}
.po-tbl tbody td.r{text-align:right;font-family:var(--fm)}
.po-tbl tbody tr{cursor:pointer;transition:background var(--df)}
.po-tbl tbody tr:hover{background:var(--sh)}
.po-tbl tbody tr.on{background:var(--ac-s)}
.po-tbl tbody tr.on td{color:var(--ac-t)}
.po-tbl tbody tr.on .po-num{color:var(--ac-t)}
.po-num{font-family:var(--fm);font-weight:600;color:var(--t1);letter-spacing:.02em}
.po-vendor{font-family:var(--fd);font-weight:650}
.po-sub{font-size:11px;color:var(--t3);margin-top:2px}

/* Empty state / overflow area */
.ws-body{max-height:560px;overflow:auto}
.ws-body::-webkit-scrollbar{width:6px}
.ws-body::-webkit-scrollbar-thumb{background:var(--s4);border-radius:3px}

/* ── Detail drawer (right rail area replaces rail when PO selected) ── */
.detail{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;display:flex;flex-direction:column}
.det-h{padding:16px 18px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.det-h-t{font-family:var(--fm);font-size:13px;font-weight:700;color:var(--t1);letter-spacing:.01em}
.det-h-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:2px}
.det-h-m{font-size:11px;color:var(--t3);margin-top:3px}
.det-body{padding:0;overflow-y:auto;max-height:760px}
.det-body::-webkit-scrollbar{width:4px}
.det-body::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

/* Detail meta grid */
.dg{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--s3)}
.dg-i{background:var(--s1);padding:10px 14px}
.dg-i .k{font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:13px;font-weight:650;margin-top:3px}
.dg-i .m{font-size:11px;color:var(--t3);margin-top:2px}

/* Section inside detail */
.ds{padding:16px 18px;border-bottom:1px solid var(--s3)}
.ds:last-child{border-bottom:none}
.ds-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}
.ds-h h4{font-family:var(--fd);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t2)}

/* Line item receiving row */
.li{padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);margin-bottom:8px;background:var(--si)}
.li.received{background:var(--ok-s);border-color:#b0dfc4}
.rw.dk .li.received{background:rgba(45,138,94,.12);border-color:rgba(45,138,94,.35)}
.li-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
.li-desc{font-family:var(--fd);font-size:12px;font-weight:650;flex:1}
.li-meta{font-size:11px;color:var(--t2);line-height:1.4}
.li-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:10px}
.li-recv{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--t2)}
.li-recv input{width:48px;height:24px;border:1px solid var(--s3);border-radius:var(--r-s);padding:0 6px;font-size:11px;font-family:var(--fm);color:var(--t1);background:var(--s1);text-align:center}
.li-total{font-family:var(--fm);font-size:12px;font-weight:650;color:var(--t1)}

/* Totals footer */
.tot{padding:12px 18px;background:var(--s2);border-top:1px solid var(--s3)}
.tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.tot-row.grand{font-family:var(--fd);font-size:14px;font-weight:750;padding-top:8px;border-top:1px solid var(--s3);margin-top:6px;color:var(--t1)}
.tot-row .k{color:var(--t3)}
.tot-row .v{font-family:var(--fm);color:var(--t1)}

/* Documents list */
.fr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;gap:8px;border-bottom:1px dashed var(--s3)}
.fr:last-child{border-bottom:none}
.fr-l{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1}
.fr-ic{width:28px;height:28px;border-radius:var(--r-s);background:var(--s2);color:var(--t3);display:grid;place-items:center;flex-shrink:0}
.fr h5{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t1);margin-bottom:2px}
.fr p{font-size:11px;color:var(--t3)}
.fc{font-family:var(--fd);font-size:10px;font-weight:700;padding:3px 7px;border-radius:var(--r-s);background:var(--s2);color:var(--t3);white-space:nowrap}

/* Timeline */
.al{display:flex;flex-direction:column;gap:10px}
.ai{display:flex;gap:10px;font-size:12px;color:var(--t1);align-items:flex-start}
.a-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0}
.a-dot.action{background:var(--ac)}
.a-dot.sys{background:var(--t4,#9c958a)}
.a-text{flex:1;line-height:1.5}
.a-text strong{font-family:var(--fd);font-weight:700}
.a-time{color:var(--t3);font-size:11px;white-space:nowrap;font-family:var(--fd)}

/* State machine pill strip */
.sm-strip{display:flex;align-items:center;gap:4px;padding:12px 18px;background:var(--si);border-bottom:1px solid var(--s3);overflow-x:auto;scrollbar-width:none}
.sm-strip::-webkit-scrollbar{display:none}
.sm-s{padding:5px 10px;border-radius:999px;font-size:11px;font-weight:650;color:var(--t3);background:var(--s1);border:1px solid var(--s3);white-space:nowrap;font-family:var(--fd);display:inline-flex;align-items:center;gap:4px}
.sm-s.done{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.sm-s.cur{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.sm-arrow{color:var(--t3);flex-shrink:0}

/* ── Modal ──────────────────────────────────────── */
.mdl{position:fixed;inset:0;background:rgba(12,14,20,.55);backdrop-filter:blur(3px);z-index:100;display:grid;place-items:center;padding:20px;animation:fu var(--dn) var(--e) both}
.mdl-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shlg);width:min(780px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
.mdl-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.mdl-h h3{font-family:var(--fd);font-size:17px;font-weight:720;letter-spacing:-.02em}
.mdl-h .sub{font-size:12px;color:var(--t3);margin-top:2px}

/* Wizard stepper */
.wz-steps{display:flex;gap:0;padding:14px 22px;background:var(--si);border-bottom:1px solid var(--s3);align-items:center}
.wz-step{display:flex;align-items:center;gap:8px;font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t3)}
.wz-step .n{width:22px;height:22px;border-radius:50%;background:var(--s2);color:var(--t3);display:grid;place-items:center;font-size:11px;font-weight:700;border:1px solid var(--s3)}
.wz-step.cur{color:var(--ac-t)}
.wz-step.cur .n{background:var(--ac);color:white;border-color:var(--ac)}
.wz-step.done{color:var(--ok-t)}
.wz-step.done .n{background:var(--ok);color:white;border-color:var(--ok)}
.wz-sep{flex:1;height:1px;background:var(--s3);margin:0 10px}

.mdl-body{padding:22px;overflow-y:auto;flex:1}
.mdl-body h4{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:10px}

.fld{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.fld label{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.05em}
.fld input,.fld select,.fld textarea{height:38px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);color:var(--t1);padding:0 12px;font-size:13px;font-family:var(--fb);outline:none;transition:border-color var(--df)}
.fld textarea{min-height:72px;padding:10px 12px;resize:vertical}
.fld input:focus,.fld select:focus,.fld textarea:focus{border-color:var(--ac);box-shadow:var(--shri)}
.fld-row{display:grid;grid-template-columns:2fr 1fr;gap:10px}

/* Line items editor (wizard step 2) */
.wz-lines{border:1px solid var(--s3);border-radius:var(--r-m);overflow:hidden;margin-bottom:12px;background:var(--si)}
.wz-li-h{display:grid;grid-template-columns:1fr 80px 70px 110px 110px 36px;gap:8px;padding:8px 12px;background:var(--sh);font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--s3)}
.wz-li-row{display:grid;grid-template-columns:1fr 80px 70px 110px 110px 36px;gap:8px;padding:10px 12px;border-bottom:1px solid var(--s3);align-items:center}
.wz-li-row:last-child{border-bottom:none}
.wz-li-row input,.wz-li-row select{height:32px;border:1px solid var(--s3);border-radius:var(--r-s);background:var(--s1);color:var(--t1);padding:0 8px;font-size:12px;font-family:var(--fb);outline:none}
.wz-li-row input:focus,.wz-li-row select:focus{border-color:var(--ac)}
.wz-li-row .tot{font-family:var(--fm);font-size:12px;color:var(--t2);padding:0;background:transparent;border:none;text-align:right}
.wz-li-rm{width:28px;height:28px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer}
.wz-li-rm:hover{color:var(--dg-t);border-color:#f5baba;background:var(--dg-s)}

.cx{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--si);cursor:pointer;transition:all var(--df)}
.cx:hover{border-color:var(--s4)}
.cx input{accent-color:var(--ac);width:14px;height:14px}
.cx-l{font-size:12px;color:var(--t1);font-family:var(--fd);font-weight:600}
.cx-s{font-size:11px;color:var(--t3);margin-top:2px}

.rev-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.rev-grid .fld{margin-bottom:0;gap:3px}
.rev-grid .v{font-family:var(--fd);font-size:13px;font-weight:650}

/* Modal footer */
.mdl-foot{padding:14px 22px;background:var(--s2);border-top:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;gap:8px}
.mdl-foot-meta{font-size:11px;color:var(--t3)}
.mdl-foot-acts{display:flex;gap:6px}

/* ── Vendors view ────────────────────────────────── */
.ven-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.vcard{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px 18px;box-shadow:var(--shsm);transition:all var(--df);cursor:pointer}
.vcard:hover{border-color:var(--s4);box-shadow:var(--shmd)}
.vc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
.vc-name{font-family:var(--fd);font-size:15px;font-weight:700;letter-spacing:-.02em}
.vc-contact{font-size:12px;color:var(--t2);margin-top:4px;line-height:1.4}
.vc-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:12px;margin-top:12px;border-top:1px solid var(--s3)}
.vc-stat .k{font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.vc-stat .v{font-family:var(--fm);font-size:14px;font-weight:700;color:var(--t1);margin-top:3px}

/* Animations */
.fade-up{animation:fu var(--dn) var(--e) both}
@keyframes fu{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo s={32}/>
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">Riverside Tower Fit-Out</div>
          </div>
        </div>
        <div className="sb-srch">
          <input placeholder="Search POs, vendors, materials…"/>
        </div>
        <nav className="s-nav">
          {contractorNav.map((section) => (
            <div key={section.section}>
              <div className="ns-lbl">{section.section}</div>
              {section.items.map((item) => (
                <div key={item.label} className={`ni${item.active ? " on" : ""}`}>
                  <span>{item.label}</span>
                  {item.badge && <span className={`ni-b ${item.bt || ""}`}>{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>Contractor Portal</span><span className="sep">›</span>
            <span>Riverside Tower Fit-Out</span><span className="sep">›</span>
            <span className="cur">{view === "procurement" ? "Procurement / POs" : "Vendors"}</span>
          </div>
          <div className="tb-acts">
            <div className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</div>
            <div className="ib">{I.bell}</div>
            <div className="av">DC</div>
          </div>
        </div>

        <div className="ct">
          {/* View switcher */}
          <div className="vsw">
            <button className={view === "procurement" ? "on" : ""} onClick={() => setView("procurement")}>
              {I.file} Purchase orders
            </button>
            <button className={view === "vendors" ? "on" : ""} onClick={() => setView("vendors")}>
              {I.building} Vendors
            </button>
          </div>

          {/* ═══════════════════ PROCUREMENT VIEW ═══════════════════ */}
          {view === "procurement" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Procurement / POs</h2>
                  <p>Issue, track, receive, and close purchase orders for materials and equipment. Each PO has line items, a state machine, linked documents, and an audit trail.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn sm">{I.download} Export CSV</button>
                  <button className="btn sm pri" onClick={() => { setShowCreate(true); setWizardStep(1); }}>{I.plus} New PO</button>
                </div>
              </div>

              <div className="ss">
                <div className="sc">
                  <div className="sc-label">Open POs</div>
                  <div className="sc-value">3</div>
                  <div className="sc-meta">Issued or receiving</div>
                </div>
                <div className="sc alert">
                  <div className="sc-label">Committed (open)</div>
                  <div className="sc-value">$301k</div>
                  <div className="sc-meta">Across 3 vendors</div>
                </div>
                <div className="sc strong">
                  <div className="sc-label">Awaiting invoice</div>
                  <div className="sc-value">2</div>
                  <div className="sc-meta">Fully received, not closed</div>
                </div>
                <div className="sc">
                  <div className="sc-label">Spent YTD</div>
                  <div className="sc-value">$748k</div>
                  <div className="sc-meta">14 POs closed this year</div>
                </div>
              </div>

              <div className="pg-grid">
                {/* ── List workspace ── */}
                <div className="ws">
                  <div className="ws-head">
                    <div><h3>All purchase orders</h3><div className="sub">Tap a row to open in the detail pane.</div></div>
                  </div>

                  <div className="ws-tabs">
                    {statusTabs.map((t, i) => (
                      <button key={t.key} className={`wtab${activeTab === i ? " on" : ""}`} onClick={() => setActiveTab(i)}>
                        {t.label}
                        <span className="c">{t.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="q-tb">
                    <input className="q-in" placeholder="Filter by PO, vendor, cost code, description…" />
                    <select className="q-sel">
                      <option>All vendors</option>
                      {vendors.map((v) => <option key={v.id}>{v.name}</option>)}
                    </select>
                    <select className="q-sel">
                      <option>All cost codes</option>
                      <option>05 Metals</option>
                      <option>23 HVAC</option>
                      <option>26 Electrical</option>
                    </select>
                    <select className="q-sel">
                      <option>Sort: Newest first</option>
                      <option>Sort: Oldest first</option>
                      <option>Sort: Highest amount</option>
                    </select>
                  </div>

                  <div className="ws-body">
                    <table className="po-tbl">
                      <thead>
                        <tr>
                          <th>PO #</th>
                          <th>Vendor / cost code</th>
                          <th>Lines</th>
                          <th>Status</th>
                          <th>Ordered / ETA</th>
                          <th className="r">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseOrders.map((p) => (
                          <tr
                            key={p.id}
                            className={p.id === activePOId ? "on" : ""}
                            onClick={() => setActivePOId(p.id)}
                          >
                            <td>
                              <div className="po-num">{p.number}</div>
                            </td>
                            <td>
                              <div className="po-vendor">{p.vendor}</div>
                              <div className="po-sub">{p.costCode}</div>
                            </td>
                            <td>
                              <span className="mono">{p.linesReceived}</span>
                            </td>
                            <td>
                              <span className={`pl ${p.st}`}>{p.statusLabel}</span>
                            </td>
                            <td>
                              <div style={{ fontSize: 12, color: "var(--t2)" }}>
                                {p.ordered || "—"}
                              </div>
                              <div className="po-sub">{p.delivery ? `ETA ${p.delivery}` : ""}</div>
                            </td>
                            <td className="r">
                              ${p.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Detail drawer ── */}
                <div className="detail">
                  <div className="det-h">
                    <div>
                      <div className="det-h-t">{activePO.number}</div>
                      <div className="det-h-v">{activePO.vendor}</div>
                      <div className="det-h-m">{activePO.project} · {activePO.costCode}</div>
                    </div>
                    <span className={`pl ${activePO.st}`}>{activePO.statusLabel}</span>
                  </div>

                  {/* State machine strip */}
                  <div className="sm-strip">
                    <span className="sm-s done">{I.check} Draft</span>
                    <span className="sm-arrow">›</span>
                    <span className="sm-s done">{I.check} Issued</span>
                    <span className="sm-arrow">›</span>
                    <span className="sm-s cur">{I.truck} Partially received</span>
                    <span className="sm-arrow">›</span>
                    <span className="sm-s">Fully received</span>
                    <span className="sm-arrow">›</span>
                    <span className="sm-s">Invoiced</span>
                    <span className="sm-arrow">›</span>
                    <span className="sm-s">Closed</span>
                  </div>

                  <div className="det-body">
                    <div className="dg">
                      <div className="dg-i"><div className="k">Ordered</div><div className="v">{activePO.orderedAt}</div><div className="m">by {activePO.orderedBy}</div></div>
                      <div className="dg-i"><div className="k">Delivery</div><div className="v">{activePO.delivery}</div><div className="m">Phased — see notes</div></div>
                      <div className="dg-i"><div className="k">Vendor contact</div><div className="v">Reg Halvorson</div><div className="m">orders@acmesteel.com</div></div>
                      <div className="dg-i"><div className="k">Payment terms</div><div className="v">{activePO.terms}</div><div className="m">Ref {activePO.projectRef}</div></div>
                    </div>

                    <div className="ds">
                      <div className="ds-h">
                        <h4>Line items & receiving</h4>
                        <button className="btn sm">{I.truck} Mark all received</button>
                      </div>
                      {activePO.lines.map((l) => (
                        <div key={l.id} className={`li${l.received === l.qty ? " received" : ""}`}>
                          <div className="li-top">
                            <div>
                              <div className="li-desc">{l.desc}</div>
                              <div className="li-meta">{l.qty} {l.unit} × ${l.unitCost.toLocaleString()} / {l.unit}</div>
                            </div>
                            <span className={`pl ${l.status === "received" ? "green" : "neutral"}`}>
                              {l.status === "received" ? "Received" : "Pending"}
                            </span>
                          </div>
                          <div className="li-foot">
                            <div className="li-recv">
                              Received: <input defaultValue={l.received} /> / {l.qty}
                            </div>
                            <div className="li-total">${l.total.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="ds">
                      <div className="ds-h"><h4>Notes</h4></div>
                      <div style={{ fontSize: 12, color: "var(--t1)", lineHeight: 1.55 }}>
                        {activePO.notes}
                      </div>
                    </div>

                    <div className="ds">
                      <div className="ds-h">
                        <h4>Linked documents</h4>
                        <button className="btn sm ghost">{I.plus} Attach</button>
                      </div>
                      {activePO.documents.map((d) => (
                        <div key={d.name} className="fr">
                          <div className="fr-l">
                            <div className="fr-ic">{I.file}</div>
                            <div>
                              <h5>{d.name}</h5>
                              <p>{d.size}</p>
                            </div>
                          </div>
                          <span className="fc">{d.kind}</span>
                        </div>
                      ))}
                    </div>

                    <div className="ds">
                      <div className="ds-h"><h4>Activity</h4></div>
                      <div className="al">
                        {activePO.timeline.map((a, i) => (
                          <div key={i} className="ai">
                            <div className={`a-dot ${a.kind}`}/>
                            <div className="a-text">
                              <strong>{a.by}</strong> — {a.label}
                            </div>
                            <div className="a-time">{a.when}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Totals footer */}
                  <div className="tot">
                    <div className="tot-row"><span className="k">Subtotal</span><span className="v">${activePO.subtotal.toLocaleString()}</span></div>
                    <div className="tot-row"><span className="k">Tax (HST)</span><span className="v">${activePO.tax.toLocaleString()}</span></div>
                    <div className="tot-row grand"><span>Total</span><span className="v">${activePO.total.toLocaleString()}</span></div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button className="btn sm" style={{ flex: 1 }}>{I.download} PDF</button>
                      <button className="btn sm" style={{ flex: 1 }}>{I.invoice} Log invoice</button>
                      <button className="btn sm pri" style={{ flex: 1 }}>{I.check} Close PO</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ VENDORS VIEW ═══════════════════ */}
          {view === "vendors" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Vendors</h2>
                  <p>Suppliers, fabricators, and equipment rental partners. Track contact, payment terms, and year-to-date spend.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn sm pri">{I.plus} Add vendor</button>
                </div>
              </div>

              <div className="ss">
                <div className="sc">
                  <div className="sc-label">Total vendors</div>
                  <div className="sc-value">{vendors.length}</div>
                  <div className="sc-meta">{vendors.filter(v => v.rating === "preferred").length} preferred</div>
                </div>
                <div className="sc strong">
                  <div className="sc-label">Active POs</div>
                  <div className="sc-value">{vendors.reduce((a, v) => a + v.activePOs, 0)}</div>
                  <div className="sc-meta">Across all vendors</div>
                </div>
                <div className="sc">
                  <div className="sc-label">Spend YTD (all vendors)</div>
                  <div className="sc-value">${(vendors.reduce((a, v) => a + v.totalYTD, 0) / 1000).toFixed(0)}k</div>
                  <div className="sc-meta">2026 year-to-date</div>
                </div>
                <div className="sc alert">
                  <div className="sc-label">Top vendor</div>
                  <div className="sc-value" style={{ fontSize: 15 }}>Acme Steel</div>
                  <div className="sc-meta">$284,500 YTD · preferred</div>
                </div>
              </div>

              <div className="ven-grid">
                {vendors.map((v) => (
                  <div key={v.id} className="vcard">
                    <div className="vc-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="vc-name">{v.name}</div>
                        <div className="vc-contact">
                          {v.contact}<br/>
                          <span style={{ color: "var(--t3)" }}>{v.email}</span>
                        </div>
                      </div>
                      {v.rating === "preferred" && <span className="pl accent">Preferred</span>}
                    </div>
                    <div className="vc-stats">
                      <div className="vc-stat">
                        <div className="k">Payment terms</div>
                        <div className="v" style={{ fontFamily: "var(--fd)", fontSize: 13 }}>{v.terms}</div>
                      </div>
                      <div className="vc-stat">
                        <div className="k">Active POs</div>
                        <div className="v">{v.activePOs}</div>
                      </div>
                      <div className="vc-stat">
                        <div className="k">Spend YTD</div>
                        <div className="v">${v.totalYTD.toLocaleString()}</div>
                      </div>
                      <div className="vc-stat">
                        <div className="k">Status</div>
                        <div className="v" style={{ fontFamily: "var(--fd)", fontSize: 13 }}>
                          <span className={`pl ${v.rating === "preferred" ? "accent" : "neutral"}`}>
                            {v.rating === "preferred" ? "Preferred" : "Standard"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════ CREATE PO WIZARD ═══════════════════ */}
      {showCreate && (
        <div className="mdl" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="mdl-card">
            <div className="mdl-h">
              <div>
                <h3>New purchase order</h3>
                <div className="sub">Step {wizardStep} of 3 · {wizardStep === 1 ? "Vendor & header" : wizardStep === 2 ? "Line items" : "Review & issue"}</div>
              </div>
              <button className="ib" onClick={() => setShowCreate(false)}>{I.x}</button>
            </div>

            <div className="wz-steps">
              <div className={`wz-step ${wizardStep === 1 ? "cur" : wizardStep > 1 ? "done" : ""}`}>
                <span className="n">{wizardStep > 1 ? I.check : "1"}</span>
                <span>Vendor & header</span>
              </div>
              <div className="wz-sep"/>
              <div className={`wz-step ${wizardStep === 2 ? "cur" : wizardStep > 2 ? "done" : ""}`}>
                <span className="n">{wizardStep > 2 ? I.check : "2"}</span>
                <span>Line items</span>
              </div>
              <div className="wz-sep"/>
              <div className={`wz-step ${wizardStep === 3 ? "cur" : ""}`}>
                <span className="n">3</span>
                <span>Review & issue</span>
              </div>
            </div>

            <div className="mdl-body">
              {/* ── Step 1: Vendor & header ── */}
              {wizardStep === 1 && (
                <div className="fade-up">
                  <h4>Who is this PO to?</h4>
                  <div className="fld">
                    <label>Vendor</label>
                    <select value={wizardVendor} onChange={(e) => setWizardVendor(e.target.value)}>
                      <option value="">Select an existing vendor…</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.terms}</option>)}
                      <option value="__new">+ Create a new vendor</option>
                    </select>
                  </div>

                  <h4 style={{ marginTop: 20 }}>PO header</h4>
                  <div className="fld-row">
                    <div className="fld">
                      <label>PO number</label>
                      <input defaultValue="PO-1049" readOnly style={{ background: "var(--s2)", color: "var(--t3)" }} />
                    </div>
                    <div className="fld">
                      <label>Expected delivery</label>
                      <input type="date" defaultValue="2026-05-05" />
                    </div>
                  </div>
                  <div className="fld-row">
                    <div className="fld">
                      <label>Project</label>
                      <select><option>Riverside Tower Fit-Out</option><option>Harbour Crescent Residence</option><option>Eastlake Commercial Block</option></select>
                    </div>
                    <div className="fld">
                      <label>Cost code</label>
                      <select><option>05-12 Structural Steel</option><option>23-05 HVAC General</option><option>26-05 Common Work Electrical</option></select>
                    </div>
                  </div>
                  <div className="fld">
                    <label>Notes for vendor (appears on issued PO)</label>
                    <textarea placeholder="Delivery instructions, site contact, special handling…" />
                  </div>
                </div>
              )}

              {/* ── Step 2: Line items ── */}
              {wizardStep === 2 && (
                <div className="fade-up">
                  <h4>Line items</h4>
                  <div className="wz-lines">
                    <div className="wz-li-h">
                      <div>Description</div>
                      <div>Qty</div>
                      <div>Unit</div>
                      <div>Unit cost</div>
                      <div style={{ textAlign: "right" }}>Line total</div>
                      <div/>
                    </div>
                    {wizardLines.map((l) => (
                      <div key={l.id} className="wz-li-row">
                        <input placeholder="e.g. W14x30 beam, 20' lengths" />
                        <input type="number" placeholder="0" />
                        <select>
                          <option>ea</option><option>lot</option><option>lf</option><option>sf</option><option>cy</option><option>ton</option>
                        </select>
                        <input type="number" placeholder="$0.00" />
                        <div className="tot">$0.00</div>
                        <button
                          className="wz-li-rm"
                          onClick={() => rmLine(l.id)}
                          disabled={wizardLines.length === 1}
                        >{I.trash}</button>
                      </div>
                    ))}
                  </div>
                  <button className="btn sm" onClick={addLine}>{I.plus} Add line</button>

                  <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--si)", borderRadius: "var(--r-m)", border: "1px solid var(--s3)" }}>
                    <div className="tot-row"><span className="k">Subtotal</span><span className="v">$0.00</span></div>
                    <div className="tot-row"><span className="k">Tax (HST 13%)</span><span className="v">$0.00</span></div>
                    <div className="tot-row grand"><span>Total</span><span className="v">$0.00</span></div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Review & issue ── */}
              {wizardStep === 3 && (
                <div className="fade-up">
                  <h4>Review before issuing</h4>
                  <div className="rev-grid">
                    <div className="fld"><label>PO number</label><div className="v mono">PO-1049</div></div>
                    <div className="fld"><label>Vendor</label><div className="v">{wizardVendor ? (vendors.find(v => v.id === wizardVendor)?.name || "New vendor") : "—"}</div></div>
                    <div className="fld"><label>Project</label><div className="v">Riverside Tower Fit-Out</div></div>
                    <div className="fld"><label>Expected delivery</label><div className="v">May 5, 2026</div></div>
                    <div className="fld"><label>Cost code</label><div className="v">05-12 Structural Steel</div></div>
                    <div className="fld"><label>Line items</label><div className="v">{wizardLines.length}</div></div>
                  </div>

                  <h4>Send & post</h4>
                  <label className="cx" style={{ marginBottom: 8 }}>
                    <input type="checkbox" checked={sendCopy} onChange={(e) => setSendCopy(e.target.checked)} />
                    <div>
                      <div className="cx-l">Email PO PDF to vendor on issue</div>
                      <div className="cx-s">Sends to the vendor contact email on file</div>
                    </div>
                  </label>
                  <label className="cx" style={{ marginBottom: 8 }}>
                    <input type="checkbox" defaultChecked />
                    <div>
                      <div className="cx-l">Save to project Documents</div>
                      <div className="cx-s">PDF is attached to the project's document library</div>
                    </div>
                  </label>
                  <label className="cx">
                    <input type="checkbox" />
                    <div>
                      <div className="cx-l">Notify project manager</div>
                      <div className="cx-s">In-app notification when PO is issued</div>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="mdl-foot">
              <div className="mdl-foot-meta">
                {wizardStep < 3
                  ? "You can save as draft and return later. POs are only sent when you click Issue."
                  : "Issuing a PO flips its state to Issued and starts the audit trail."}
              </div>
              <div className="mdl-foot-acts">
                <button className="btn sm" onClick={() => setShowCreate(false)}>Save draft & close</button>
                {wizardStep > 1 && <button className="btn sm" onClick={() => setWizardStep(wizardStep - 1)}>Back</button>}
                {wizardStep < 3 && <button className="btn sm pri" onClick={() => setWizardStep(wizardStep + 1)}>Next {I.chevron}</button>}
                {wizardStep === 3 && <button className="btn sm pri" onClick={() => setShowCreate(false)}>{I.send} Issue PO</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
