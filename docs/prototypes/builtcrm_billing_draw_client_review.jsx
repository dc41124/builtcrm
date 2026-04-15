import { useState } from "react";

// BuiltCRM — Billing / Draw Review (Commercial Client Portal)
// File #14 of 24 — Phase 2 conversion from billing_draw_client_review.html
// Commercial client blue accent (#3178b9), master-detail billing workspace with decision workflow
// Font audit: DM Sans display/values/labels, Instrument Sans body, JetBrains Mono data tables only

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Draw Queue Data ─────────────────────────────────────────────
const draws = [
  { id: "draw-06", num: "Draw 06", desc: "Released by contractor for billing review with invoice backup and milestone support.", status: "Needs my review", pill: "accent", tab: "pending", value: "$162,900", period: "Mar 1–31", tags: ["Under review", "$162,900", "3 days waiting", "4 support docs"], time: "Released 3d ago" },
  { id: "draw-05", num: "Draw 05", desc: "Approved and cleared in the prior review cycle.", status: "Approved", pill: "green", tab: "approved", value: "$151,400", period: "Feb 1–28", tags: ["Approved", "$151,400", "Closed Feb 28"], time: "Approved Feb 28" },
  { id: "draw-04", num: "Draw 04", desc: "Initially returned for clarification, then resubmitted and approved.", status: "Approved", pill: "green", tab: "approved", value: "$148,200", period: "Jan 1–31", tags: ["Returned then approved", "$148,200"], time: "Approved Feb 20" },
  { id: "draw-03", num: "Draw 03", desc: "Approved in standard review cycle.", status: "Approved", pill: "green", tab: "approved", value: "$139,800", period: "Dec 1–31", tags: ["Approved", "$139,800"], time: "Approved Jan 5" },
];

const drawDetails = {
  "draw-06": {
    num: "Draw 06", sub: "Application for payment — current billing period",
    desc: "This draw package groups current-cycle invoices, support documentation, and milestone backup into one review object. Your decision determines whether it moves forward or returns for clarification.",
    pills: [{ t: "Needs my review", c: "accent" }, { t: "Payment timing", c: "orange" }],
    g702: { contractSum: "$2,427,200", workComplete: "$1,482,300", retainage: "$148,230", currentDue: "$162,900" },
    sov: [
      { item: "General conditions", scheduled: "$340,000", thisPeriod: "$34,000", totalComplete: "$306,000", pct: "90%" },
      { item: "Structural steel", scheduled: "$520,000", thisPeriod: "$41,600", totalComplete: "$457,600", pct: "88%" },
      { item: "Mechanical systems", scheduled: "$410,000", thisPeriod: "$45,100", totalComplete: "$332,100", pct: "81%" },
      { item: "Electrical", scheduled: "$380,000", thisPeriod: "$30,400", totalComplete: "$296,400", pct: "78%" },
      { item: "Interior finishes", scheduled: "$290,000", thisPeriod: "$11,800", totalComplete: "$90,100", pct: "31%" },
    ],
    liens: [
      { org: "Apex Mechanical", status: "received", label: "Conditional waiver received" },
      { org: "Northline Electrical", status: "pending", label: "Waiver requested — not yet received" },
      { org: "Capital Plumbing", status: "received", label: "Conditional waiver received" },
    ],
    files: [
      { name: "draw_06_g702_summary.pdf", desc: "G702 application for payment summary", type: "Primary" },
      { name: "draw_06_g703_continuation.pdf", desc: "G703 continuation sheet with line-item detail", type: "Backup" },
      { name: "invoice_backup_packet.pdf", desc: "Invoice support for billed amounts", type: "Backup" },
      { name: "milestone_support_note.pdf", desc: "Milestone allocation and payment timing context", type: "Context" },
    ],
    showDecision: true,
  },
  "draw-05": {
    num: "Draw 05", sub: "Approved — Feb billing period",
    desc: "This package was approved on Feb 28 and has been closed for the billing cycle.",
    pills: [{ t: "Approved", c: "green" }],
    g702: { contractSum: "$2,427,200", workComplete: "$1,319,400", retainage: "$131,940", currentDue: "$151,400" },
    sov: [
      { item: "General conditions", scheduled: "$340,000", thisPeriod: "$34,000", totalComplete: "$272,000", pct: "80%" },
      { item: "Structural steel", scheduled: "$520,000", thisPeriod: "$41,600", totalComplete: "$416,000", pct: "80%" },
      { item: "Mechanical systems", scheduled: "$410,000", thisPeriod: "$41,000", totalComplete: "$287,000", pct: "70%" },
      { item: "Electrical", scheduled: "$380,000", thisPeriod: "$34,200", totalComplete: "$266,000", pct: "70%" },
    ],
    liens: [
      { org: "Apex Mechanical", status: "received", label: "Unconditional waiver on file" },
      { org: "Northline Electrical", status: "received", label: "Unconditional waiver on file" },
      { org: "Capital Plumbing", status: "received", label: "Unconditional waiver on file" },
    ],
    files: [
      { name: "draw_05_g702_summary.pdf", desc: "G702 application", type: "Primary" },
      { name: "draw_05_g703_continuation.pdf", desc: "G703 continuation sheet", type: "Backup" },
    ],
    showDecision: false,
  },
  "draw-04": {
    num: "Draw 04", sub: "Returned then approved — Jan billing period",
    desc: "Initially returned for milestone allocation clarification. Resubmitted with updated backup and approved Feb 20.",
    pills: [{ t: "Approved", c: "green" }, { t: "Was returned", c: "orange" }],
    g702: { contractSum: "$2,340,000", workComplete: "$1,168,000", retainage: "$116,800", currentDue: "$148,200" },
    sov: [{ item: "General conditions", scheduled: "$340,000", thisPeriod: "$34,000", totalComplete: "$238,000", pct: "70%" }],
    liens: [{ org: "All subcontractors", status: "received", label: "Unconditional waivers on file" }],
    files: [{ name: "draw_04_resubmission.pdf", desc: "Resubmitted package with clarification", type: "Primary" }],
    showDecision: false,
  },
  "draw-03": {
    num: "Draw 03", sub: "Approved — Dec billing period",
    desc: "Standard review cycle. Approved Jan 5.",
    pills: [{ t: "Approved", c: "green" }],
    g702: { contractSum: "$2,340,000", workComplete: "$1,019,800", retainage: "$101,980", currentDue: "$139,800" },
    sov: [], liens: [],
    files: [{ name: "draw_03_package.pdf", desc: "Complete draw package", type: "Primary" }],
    showDecision: false,
  },
};

// ─── Activity Data ───────────────────────────────────────────────
const activities = [
  { dot: "action", text: "Contractor released <b>Draw 06</b> for review", time: "3d" },
  { dot: "ok", text: "You approved <b>Draw 05</b>", time: "Feb 28" },
  { dot: "warn", text: "You returned <b>Draw 04</b> for clarification", time: "Feb 14" },
  { dot: "ok", text: "<b>Draw 04</b> resubmitted and approved", time: "Feb 20" },
];

// ─── Contract Snapshot ───────────────────────────────────────────
const contractSnapshot = [
  { label: "Original contract", sub: "Base contract value", value: "$2,340,000" },
  { label: "Change orders", sub: "Net approved changes", value: "+$87,200" },
  { label: "Revised contract", sub: "Current contract sum", value: "$2,427,200" },
  { label: "Billed to date", sub: "Total through Draw 06", value: "$1,482,300" },
  { label: "Retainage held", sub: "10% standard", value: "$148,230" },
];

// ─── Icon Helpers ────────────────────────────────────────────────
const ChevronRight = () => <span style={{ fontSize: 11, color: "var(--surface-4)" }}>›</span>;
const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>
);

const LogoMark = () => (
  <div style={{
    width: 32, height: 32, borderRadius: 10, position: "relative",
    background: "linear-gradient(135deg, #1a1714, #3d3830)",
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
export default function BillingDrawClientReview() {
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedDraw, setSelectedDraw] = useState("draw-06");
  const [decisionOption, setDecisionOption] = useState("approve-note");
  const [decisionSubmitted, setDecisionSubmitted] = useState(false);
  const [noteText, setNoteText] = useState("Include the final payment timing memo in the next billing cycle packet.");

  const t = dark ? "dark" : "light";
  const filteredDraws = activeTab === "all" ? draws : draws.filter((d) => d.tab === activeTab);
  const detail = drawDetails[selectedDraw];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const filtered = tab === "all" ? draws : draws.filter((d) => d.tab === tab);
    if (filtered.length) {
      setSelectedDraw(filtered[0].id);
      setDecisionSubmitted(false);
    }
  };

  const handleSelectDraw = (id) => {
    setSelectedDraw(id);
    setDecisionSubmitted(false);
    setDecisionOption("approve-note");
  };

  const decisionLabels = {
    approve: { title: "Approve package", desc: "Your approval confirms the draw is acceptable. No note required.", btn: "Submit approval", showNote: false },
    "approve-note": { title: "Approve with note", desc: "Your approval will move the package forward. The contractor receives your note.", btn: "Submit approval with note", showNote: true },
    return: { title: "Return for clarification", desc: "The package will be sent back. Explain what needs clarification or additional backup.", btn: "Return package", showNote: true },
  };

  const currentDecision = decisionLabels[decisionOption];

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
  --text-primary:#1a1714;--text-secondary:#6b655b;--text-tertiary:#9c958a;--text-inverse:#faf9f7;
  --accent:#3178b9;--accent-hover:#2968a3;--accent-soft:#e8f1fa;--accent-text:#276299;--accent-muted:#b3d1ec;
  --success:#2d8a5e;--success-soft:#edf7f1;--success-text:#1e6b46;
  --warning:#c17a1a;--warning-soft:#fdf4e6;--warning-text:#96600f;
  --danger:#c93b3b;--danger-soft:#fdeaea;--danger-text:#a52e2e;
  --info:#3178b9;--info-soft:#e8f1fa;--info-text:#276299;
  --topbar-bg:rgba(255,255,255,.88);
  --decision-selected-bg:color-mix(in srgb,var(--accent-soft) 40%,#fff);
  --decision-compose-bg:linear-gradient(180deg,#fff,var(--surface-2));
  --sc-strong-bg:linear-gradient(180deg,#fff,color-mix(in srgb,var(--accent-soft) 40%,#fff));
  --sc-alert-bg:linear-gradient(180deg,#fff,#fefaf3);
  --sc-success-bg:linear-gradient(180deg,#fff,#f5fdf8);
  --rail-alert-bg:linear-gradient(180deg,#fefaf3,#fff);
  --rail-info-bg:linear-gradient(180deg,color-mix(in srgb,var(--accent-soft) 40%,#fff),#fff);
  --card-active-bg:color-mix(in srgb,var(--accent-soft) 30%,#fff);
  --g702-accent-bg:color-mix(in srgb,var(--accent-soft) 50%,#fff);
}
[data-theme="dark"] {
  --surface-0:#0e0f11;--surface-1:#18191c;--surface-2:#1e2023;--surface-3:#2a2d31;--surface-4:#3a3e44;
  --surface-hover:#1f2124;--surface-incard:#1c1d20;
  --sidebar-bg:#141517;--sidebar-hover:#1c1d20;--sidebar-active:#1e2023;--sidebar-active-text:#f0ede8;
  --sidebar-section-text:#6b7280;--sidebar-item-text:#9ca3af;--sidebar-border:#232528;
  --text-primary:#f0ede8;--text-secondary:#a09a90;--text-tertiary:#706a60;--text-inverse:#1a1714;
  --accent:#5a9fd4;--accent-hover:#6ab0e0;--accent-soft:#0d1a2a;--accent-text:#80b8e8;--accent-muted:#2a4a6a;
  --success:#3aad72;--success-soft:#0f251a;--success-text:#5dd89a;
  --warning:#daa050;--warning-soft:#271d0b;--warning-text:#eab96e;
  --danger:#e25555;--danger-soft:#2a1010;--danger-text:#f28080;
  --info:#5a9fd4;--info-soft:#0d1a2a;--info-text:#80b8e8;
  --topbar-bg:rgba(14,15,17,.88);
  --decision-selected-bg:color-mix(in srgb,var(--accent-soft) 60%,var(--surface-1));
  --decision-compose-bg:linear-gradient(180deg,var(--surface-1),var(--surface-2));
  --sc-strong-bg:linear-gradient(180deg,var(--surface-1),color-mix(in srgb,var(--accent-soft) 40%,var(--surface-1)));
  --sc-alert-bg:linear-gradient(180deg,var(--surface-1),var(--warning-soft));
  --sc-success-bg:linear-gradient(180deg,var(--surface-1),var(--success-soft));
  --rail-alert-bg:linear-gradient(180deg,var(--warning-soft),var(--surface-1));
  --rail-info-bg:linear-gradient(180deg,var(--accent-soft),var(--surface-1));
  --card-active-bg:color-mix(in srgb,var(--accent-soft) 50%,var(--surface-1));
  --g702-accent-bg:color-mix(in srgb,var(--accent-soft) 50%,var(--surface-1));
}

*,*::before,*::after{box-sizing:border-box;margin:0}

/* ═══ LAYOUT ═════════════════════════════════════════════════ */
.bcr-app{
  display:grid;grid-template-columns:272px 1fr;min-height:100vh;
  font-family:'Instrument Sans',system-ui,sans-serif;background:var(--surface-0);
  color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
}

/* ═══ SIDEBAR ════════════════════════════════════════════════ */
.bcr-sidebar{
  background:var(--sidebar-bg);border-right:1px solid var(--sidebar-border);
  display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden;
}
.bcr-brand{
  height:56px;display:flex;align-items:center;gap:12px;padding:0 20px;
  border-bottom:1px solid var(--sidebar-border);flex-shrink:0;
}
.bcr-brand-name{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:-.02em}
.bcr-brand-ctx{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}
.bcr-sb-search{padding:12px 16px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.bcr-sb-input{
  width:100%;height:36px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);
  padding:0 12px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;
  color:var(--text-primary);outline:none;font-weight:520;
}
.bcr-sb-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(49,120,185,.15)}
.bcr-sb-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.bcr-ns-label{
  font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;
  color:var(--sidebar-section-text);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px;
}
.bcr-ni{
  display:flex;align-items:center;justify-content:space-between;padding:8px 10px;
  border-radius:10px;font-size:13px;color:var(--sidebar-item-text);font-weight:520;
  cursor:pointer;margin-bottom:2px;transition:all .15s;
}
.bcr-ni:hover{background:var(--sidebar-hover);color:var(--sidebar-active-text)}
.bcr-ni.active{background:var(--accent-soft);color:var(--accent-text);font-weight:650}
.bcr-ni.project{background:var(--surface-hover);color:var(--sidebar-active-text);font-weight:600}
.bcr-ni-badge{
  min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:var(--accent-soft);
  color:var(--accent-text);font-size:11px;font-weight:700;display:inline-flex;align-items:center;
  justify-content:center;font-family:'DM Sans',system-ui,sans-serif;
}
.bcr-ni-tag{
  font-size:11px;color:var(--accent-text);font-weight:600;text-transform:uppercase;letter-spacing:.04em;
}
.bcr-sb-foot{border-top:1px solid var(--sidebar-border);padding:12px 16px;flex-shrink:0}
.bcr-u-av{
  width:32px;height:32px;border-radius:50%;background:var(--accent);color:white;
  display:grid;place-items:center;font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700;
}

/* ═══ MAIN AREA ══════════════════════════════════════════════ */
.bcr-main{min-width:0;display:flex;flex-direction:column}
.bcr-topbar{
  height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;
  border-bottom:1px solid var(--surface-3);background:var(--topbar-bg);backdrop-filter:blur(12px);
  position:sticky;top:0;z-index:50;
}
.bcr-bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-tertiary);font-weight:520}
.bcr-bc-cur{color:var(--text-primary);font-weight:650}
.bcr-content{padding:24px;flex:1}

/* ═══ DARK MODE TOGGLE ═══════════════════════════════════════ */
.bcr-dark-toggle{
  position:fixed;bottom:20px;right:20px;z-index:100;width:40px;height:40px;border-radius:50%;
  background:var(--surface-1);border:1px solid var(--surface-3);box-shadow:0 4px 16px rgba(0,0,0,.1);
  display:grid;place-items:center;cursor:pointer;font-size:16px;transition:all .2s;
}
.bcr-dark-toggle:hover{transform:scale(1.1)}

/* ═══ BUTTONS ════════════════════════════════════════════════ */
.bcr-btn{
  height:38px;padding:0 16px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);
  font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;font-weight:650;
  color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  gap:6px;transition:all .15s;white-space:nowrap;
}
.bcr-btn:hover{border-color:var(--surface-4);background:var(--surface-hover)}
.bcr-btn:active{transform:scale(.97)}
.bcr-btn.primary{background:var(--accent);border-color:var(--accent);color:white}
.bcr-btn.primary:hover{background:var(--accent-hover)}
.bcr-btn.sm{height:32px;padding:0 12px;font-size:12px}
.bcr-btn.submitted-state{background:var(--success-soft);border-color:var(--success);color:var(--success-text);pointer-events:none;opacity:.8}

/* ═══ PILLS ══════════════════════════════════════════════════ */
.bcr-pill{
  height:22px;padding:0 9px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;
  font-size:10px;font-weight:700;display:inline-flex;align-items:center;
  border:1px solid var(--surface-3);background:var(--surface-1);color:var(--text-tertiary);
  white-space:nowrap;flex-shrink:0;
}
.bcr-pill.accent{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent-muted)}
.bcr-pill.green{background:var(--success-soft);color:var(--success-text);border-color:var(--success)}
.bcr-pill.orange{background:var(--warning-soft);color:var(--warning-text);border-color:var(--warning)}
.bcr-pill.red{background:var(--danger-soft);color:var(--danger-text);border-color:var(--danger)}
.bcr-pill.blue{background:var(--info-soft);color:var(--info-text);border-color:var(--info)}

/* ─── Mini tags ────────────────────────────────────────────── */
.bcr-mini-tag{
  height:20px;padding:0 7px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;
  font-size:10px;font-weight:700;border:1px solid var(--surface-3);background:var(--surface-2);
  color:var(--text-tertiary);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;
}

/* ═══ PAGE HEADER ════════════════════════════════════════════ */
.bcr-page-header{
  display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px;
}
.bcr-page-title{font-family:'DM Sans',system-ui,sans-serif;font-size:26px;font-weight:820;letter-spacing:-.035em}
.bcr-page-desc{margin-top:4px;font-size:13px;color:var(--text-secondary);max-width:560px;font-weight:520;line-height:1.5}
.bcr-page-pills{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.bcr-page-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

/* ═══ SUMMARY STRIP ══════════════════════════════════════════ */
.bcr-summary-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.bcr-sc{
  background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;
  padding:13px 15px;box-shadow:0 1px 3px rgba(26,23,20,.05);
}
.bcr-sc.strong{border-color:var(--accent-muted);background:var(--sc-strong-bg)}
.bcr-sc.alert{border-color:#f5d5a0;background:var(--sc-alert-bg)}
.bcr-sc.success{border-color:#b0dfc4;background:var(--sc-success-bg)}
.bcr-sc-label{
  font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;font-weight:560;
  text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary);
}
.bcr-sc-value{
  font-family:'DM Sans',system-ui,sans-serif;font-size:22px;font-weight:820;
  letter-spacing:-.03em;margin-top:4px;
}
.bcr-sc-meta{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}

/* ═══ PAGE GRID ══════════════════════════════════════════════ */
.bcr-page-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}

/* ═══ WORKSPACE ══════════════════════════════════════════════ */
.bcr-workspace{
  background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;
  box-shadow:0 1px 3px rgba(26,23,20,.05);overflow:hidden;
}
.bcr-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.bcr-ws-title{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700}
.bcr-ws-sub{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}
.bcr-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.bcr-tab{
  height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--surface-3);background:var(--surface-1);
  color:var(--text-secondary);font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;
  font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all .15s;
}
.bcr-tab:hover{border-color:var(--surface-4);color:var(--text-primary)}
.bcr-tab.active{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent-muted)}

/* ═══ MASTER DETAIL ══════════════════════════════════════════ */
.bcr-master-detail{display:grid;grid-template-columns:340px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
.bcr-queue-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
.bcr-queue-filter{
  height:30px;padding:0 10px;border-radius:10px;border:1px solid var(--surface-3);
  background:var(--surface-1);font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;
  color:var(--text-secondary);outline:none;font-weight:520;
}
.bcr-thread-list{display:flex;flex-direction:column;gap:6px}

/* ─── Draw cards ───────────────────────────────────────────── */
.bcr-draw-card{
  background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;
  padding:12px 14px;cursor:pointer;transition:all .15s;
}
.bcr-draw-card:hover{border-color:var(--surface-4);box-shadow:0 1px 3px rgba(26,23,20,.05)}
.bcr-draw-card.active{border-color:var(--accent-muted);background:var(--card-active-bg);box-shadow:0 0 0 3px rgba(49,120,185,.15)}
.bcr-dc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.bcr-dc-id{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);font-weight:520}
.bcr-dc-title{font-family:'Instrument Sans',system-ui,sans-serif;font-size:12.5px;font-weight:520;margin-top:2px;color:var(--text-secondary);line-height:1.4}
.bcr-dc-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.bcr-dc-footer{
  display:flex;justify-content:space-between;align-items:center;margin-top:8px;
  font-size:11px;color:var(--text-tertiary);font-weight:520;
}

/* ═══ DETAIL PANE ════════════════════════════════════════════ */
.bcr-detail-pane{min-height:400px}
.bcr-detail-header{
  display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
  padding-bottom:14px;border-bottom:1px solid var(--surface-2);
}
.bcr-dh-title{font-family:'DM Sans',system-ui,sans-serif;font-size:18px;font-weight:750;letter-spacing:-.02em}
.bcr-dh-sub{font-size:13px;color:var(--text-secondary);margin-top:6px;line-height:1.5;max-width:480px;font-weight:520}
.bcr-dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px;align-items:flex-start}

/* ─── Detail sections ──────────────────────────────────────── */
.bcr-ds{margin-top:16px;border:1px solid var(--surface-3);border-radius:14px;overflow:hidden}
.bcr-ds-head{
  display:flex;justify-content:space-between;align-items:center;padding:12px 16px;
  background:var(--surface-2);border-bottom:1px solid var(--surface-3);
}
.bcr-ds-head h4{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700}
.bcr-ds-actions{display:flex;gap:6px;align-items:center}
.bcr-ds-body{padding:14px 16px}
.bcr-ds-body>p{font-size:13px;color:var(--text-secondary);line-height:1.55;font-weight:520}

/* ─── G702 strip in detail ─────────────────────────────────── */
.bcr-g702-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
.bcr-g702-item{
  text-align:center;padding:10px 8px;border:1px solid var(--surface-3);border-radius:10px;
  background:var(--surface-1);
}
.bcr-g702-item.accent-bg{background:var(--g702-accent-bg);border-color:var(--accent-muted)}
.bcr-g702-label{
  font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary);
}
.bcr-g702-value{
  font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:820;
  margin-top:4px;letter-spacing:-.02em;
}

/* ─── SOV table ────────────────────────────────────────────── */
.bcr-sov-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
.bcr-sov-table th{
  text-align:left;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary);padding:8px 10px;
  border-bottom:2px solid var(--surface-3);background:var(--surface-2);
}
.bcr-sov-table td{padding:8px 10px;border-bottom:1px solid var(--surface-2);color:var(--text-secondary);font-weight:520}
.bcr-sov-table td:first-child{font-weight:600;color:var(--text-primary)}
.bcr-sov-table td.mono{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:520}
.bcr-sov-table tr:hover{background:var(--surface-hover)}

/* ─── Lien waiver rows ─────────────────────────────────────── */
.bcr-lien-row{
  display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--surface-3);
  border-radius:10px;background:var(--surface-1);margin-top:6px;
}
.bcr-lien-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.bcr-lien-dot.received{background:var(--success)}.bcr-lien-dot.pending{background:var(--warning)}.bcr-lien-dot.missing{background:var(--danger)}
.bcr-lien-name{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700}
.bcr-lien-sub{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}

/* ─── File rows ────────────────────────────────────────────── */
.bcr-file-row{
  display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;
  border-bottom:1px solid var(--surface-2);
}
.bcr-file-row:last-child{border-bottom:none}
.bcr-file-name{font-size:13px;font-weight:600}
.bcr-file-sub{font-size:12px;color:var(--text-secondary);margin-top:1px;font-weight:520}
.bcr-file-chip{
  font-size:11px;font-weight:700;color:var(--text-tertiary);padding:3px 8px;border-radius:6px;
  background:var(--surface-2);white-space:nowrap;
}

/* ═══ DECISION SECTION ═══════════════════════════════════════ */
.bcr-decision-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.bcr-decision-option{
  border:1px solid var(--surface-3);border-radius:14px;padding:14px;cursor:pointer;transition:all .15s;
}
.bcr-decision-option:hover{border-color:var(--accent-muted);box-shadow:0 1px 3px rgba(26,23,20,.05)}
.bcr-decision-option.selected{
  border-color:var(--accent);background:var(--decision-selected-bg);
  box-shadow:0 0 0 3px rgba(49,120,185,.15);
}
.bcr-decision-option h5{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700}
.bcr-decision-option p{font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.4;font-weight:520}
.bcr-decision-compose{
  border:1px solid var(--surface-3);border-radius:14px;padding:14px 16px;
  background:var(--decision-compose-bg);margin-top:12px;
}
.bcr-decision-compose h5{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700}
.bcr-decision-compose>p{font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.5;font-weight:520}
.bcr-note-area{
  width:100%;min-height:80px;border:1px solid var(--surface-3);border-radius:10px;
  padding:10px 12px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;
  color:var(--text-primary);resize:vertical;outline:none;margin-top:10px;background:var(--surface-1);
  font-weight:520;
}
.bcr-note-area:focus{border-color:var(--accent)}
.bcr-decision-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

/* ═══ RIGHT RAIL ═════════════════════════════════════════════ */
.bcr-rail{display:flex;flex-direction:column;gap:12px}
.bcr-rail-card{
  background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;
  box-shadow:0 1px 3px rgba(26,23,20,.05);overflow:hidden;
}
.bcr-rail-card.alert{border-color:#f5d5a0;background:var(--rail-alert-bg)}
.bcr-rail-card.info{border-color:var(--accent-muted);background:var(--rail-info-bg)}
.bcr-rch{padding:14px 16px 0}
.bcr-rch h3{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700}
.bcr-rch-sub{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}
.bcr-rcb{padding:10px 16px 16px}
.bcr-rcb>p{font-size:13px;color:var(--text-secondary);line-height:1.5;font-weight:520}
.bcr-muted-block{
  background:var(--surface-2);border:1px solid var(--surface-3);border-radius:10px;padding:12px;
}
.bcr-muted-block h4{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700;margin-bottom:4px}
.bcr-muted-block p{font-size:12px;font-weight:520}

/* ─── Activity list ────────────────────────────────────────── */
.bcr-activity-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--surface-2)}
.bcr-activity-item:last-child{border-bottom:none}
.bcr-activity-dot{width:7px;height:7px;border-radius:50%;background:var(--surface-4);margin-top:6px;flex-shrink:0}
.bcr-activity-dot.action{background:var(--accent)}.bcr-activity-dot.ok{background:var(--success)}.bcr-activity-dot.warn{background:var(--warning)}
.bcr-activity-text{flex:1;font-size:12px;color:var(--text-secondary);line-height:1.4;font-weight:520}
.bcr-activity-text b{color:var(--text-primary);font-weight:650}
.bcr-activity-time{font-size:10px;color:var(--text-tertiary);flex-shrink:0;padding-top:2px;font-weight:520}

/* ═══ ANIMATIONS ═════════════════════════════════════════════ */
@keyframes bcr-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.bcr-anim{animation:bcr-fadeIn .35s cubic-bezier(.16,1,.3,1) both}
.bcr-anim-d1{animation-delay:0ms}.bcr-anim-d2{animation-delay:60ms}
.bcr-anim-d3{animation-delay:120ms}

/* ═══ RESPONSIVE ═════════════════════════════════════════════ */
@media(max-width:1280px){
  .bcr-page-grid{grid-template-columns:1fr}
  .bcr-master-detail{grid-template-columns:1fr}
  .bcr-g702-strip,.bcr-decision-options{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:900px){
  .bcr-app{grid-template-columns:1fr}
  .bcr-sidebar{display:none}
  .bcr-summary-strip{grid-template-columns:repeat(2,1fr)}
  .bcr-page-header{flex-direction:column}
}
@media(max-width:640px){
  .bcr-summary-strip,.bcr-g702-strip,.bcr-decision-options{grid-template-columns:1fr}
  .bcr-content{padding:16px}
}
      `}</style>

      <div className="bcr-app" data-theme={t}>
        {/* ─── SIDEBAR ──────────────────────────────────────── */}
        <aside className="bcr-sidebar">
          <div className="bcr-brand">
            <LogoMark />
            <div>
              <div className="bcr-brand-name">BuiltCRM</div>
              <div className="bcr-brand-ctx">Commercial Client Portal</div>
            </div>
          </div>
          <div className="bcr-sb-search">
            <input className="bcr-sb-input" placeholder="Search…" />
          </div>
          <nav className="bcr-sb-nav">
            <div className="bcr-ns-label">Workspace</div>
            <div className="bcr-ni">Project Home</div>
            <div className="bcr-ni">Approvals Center <span className="bcr-ni-badge">3</span></div>
            <div className="bcr-ni">Messages <span className="bcr-ni-badge">1</span></div>

            <div className="bcr-ns-label">Project</div>
            <div className="bcr-ni project">
              Riverside Tower Fit-Out
              <span className="bcr-ni-tag">Current</span>
            </div>

            <div className="bcr-ns-label">Project Tools</div>
            <div className="bcr-ni">Progress & Updates</div>
            <div className="bcr-ni">Change Orders <span className="bcr-ni-badge">2</span></div>
            <div className="bcr-ni active">Billing / Draws <span className="bcr-ni-tag">Review</span></div>
            <div className="bcr-ni">Schedule</div>
            <div className="bcr-ni">Documents</div>
          </nav>
          <div className="bcr-sb-foot">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}>
              <div className="bcr-u-av">CR</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 580 }}>Chris Reynolds</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 520 }}>
                  Project Owner
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─────────────────────────────────── */}
        <main className="bcr-main">
          <header className="bcr-topbar">
            <div className="bcr-bc">
              <span>Commercial Client Portal</span>
              <ChevronRight />
              <span>Riverside Tower Fit-Out</span>
              <ChevronRight />
              <span className="bcr-bc-cur">Billing / Draws</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button style={{
                width:34,height:34,borderRadius:10,border:"1px solid var(--surface-3)",
                background:"var(--surface-1)",color:"var(--text-tertiary)",display:"grid",
                placeItems:"center",cursor:"pointer",
              }}><BellIcon /></button>
              <div className="bcr-u-av">CR</div>
            </div>
          </header>

          <div className="bcr-content">
            {/* ── Page Header ───────────────────────────────── */}
            <div className="bcr-page-header bcr-anim bcr-anim-d1">
              <div>
                <h2 className="bcr-page-title">Billing / Draws</h2>
                <p className="bcr-page-desc">
                  Review draw packages released by the contractor, inspect line-item progress, verify
                  lien waivers, and return a formal billing decision.
                </p>
                <div className="bcr-page-pills">
                  <span className="bcr-pill accent">Formal billing review</span>
                  <span className="bcr-pill orange">1 package needs your review</span>
                </div>
              </div>
              <div className="bcr-page-actions">
                <button className="bcr-btn">View all draws</button>
                <button className="bcr-btn primary">Review active draw</button>
              </div>
            </div>

            {/* ── Summary Strip ─────────────────────────────── */}
            <div className="bcr-summary-strip bcr-anim bcr-anim-d2">
              <div className="bcr-sc strong">
                <div className="bcr-sc-label">Pending review</div>
                <div className="bcr-sc-value">1</div>
                <div className="bcr-sc-meta">Awaiting your billing decision</div>
              </div>
              <div className="bcr-sc">
                <div className="bcr-sc-label">Current draw value</div>
                <div className="bcr-sc-value">$162,900</div>
                <div className="bcr-sc-meta">Draw 06 — active package</div>
              </div>
              <div className="bcr-sc alert">
                <div className="bcr-sc-label">Payment impact</div>
                <div className="bcr-sc-value" style={{ fontSize: 18 }}>Payment timing</div>
                <div className="bcr-sc-meta">Decision affects next milestone</div>
              </div>
              <div className="bcr-sc success">
                <div className="bcr-sc-label">Approved this cycle</div>
                <div className="bcr-sc-value">1</div>
                <div className="bcr-sc-meta">Draw 05 cleared</div>
              </div>
            </div>

            {/* ── Main Grid ─────────────────────────────────── */}
            <div className="bcr-page-grid bcr-anim bcr-anim-d3">
              {/* ── Workspace ────────────────────────────────── */}
              <div className="bcr-workspace">
                <div className="bcr-ws-head">
                  <div>
                    <h3 className="bcr-ws-title">Billing review workspace</h3>
                    <div className="bcr-ws-sub">
                      Formal draw-package review. The queue orients you; the detail pane is where the
                      review work happens.
                    </div>
                  </div>
                </div>
                <div className="bcr-ws-tabs">
                  {[
                    { key: "pending", label: "Needs my review" },
                    { key: "approved", label: "Approved" },
                    { key: "returned", label: "Returned" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      className={`bcr-tab${activeTab === tab.key ? " active" : ""}`}
                      onClick={() => handleTabChange(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="bcr-master-detail">
                  {/* Queue */}
                  <div>
                    <div className="bcr-queue-toolbar">
                      <select className="bcr-queue-filter">
                        <option>Sort: Highest value</option>
                        <option>Sort: Newest first</option>
                      </select>
                    </div>
                    <div className="bcr-thread-list">
                      {filteredDraws.length === 0 && (
                        <p style={{ color: "var(--text-tertiary)", padding: 20, fontSize: 13, fontWeight: 520 }}>
                          No draws in this view.
                        </p>
                      )}
                      {filteredDraws.map((d) => (
                        <div
                          key={d.id}
                          className={`bcr-draw-card${selectedDraw === d.id ? " active" : ""}`}
                          onClick={() => handleSelectDraw(d.id)}
                        >
                          <div className="bcr-dc-top">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="bcr-dc-id">{d.num}</div>
                              <div className="bcr-dc-title">{d.desc}</div>
                            </div>
                            <span className={`bcr-pill ${d.pill}`}>{d.status}</span>
                          </div>
                          <div className="bcr-dc-tags">
                            {d.tags.map((tag, i) => (
                              <span key={i} className="bcr-mini-tag">{tag}</span>
                            ))}
                          </div>
                          <div className="bcr-dc-footer">
                            <span>{d.value} · {d.period}</span>
                            <span>{d.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detail Pane */}
                  {detail && (
                    <div className="bcr-detail-pane">
                      <div className="bcr-detail-header">
                        <div>
                          <h3 className="bcr-dh-title">{detail.num}</h3>
                          <div className="bcr-dh-sub">{detail.desc}</div>
                        </div>
                        <div className="bcr-dh-pills">
                          {detail.pills.map((p, i) => (
                            <span key={i} className={`bcr-pill ${p.c}`}>{p.t}</span>
                          ))}
                        </div>
                      </div>

                      {/* G702 Summary */}
                      <div className="bcr-ds">
                        <div className="bcr-ds-head">
                          <h4>G702 — Application for payment</h4>
                          <div className="bcr-ds-actions">
                            <span className="bcr-pill accent">AIA standard</span>
                          </div>
                        </div>
                        <div className="bcr-ds-body">
                          <div className="bcr-g702-strip">
                            <div className="bcr-g702-item">
                              <div className="bcr-g702-label">Contract sum</div>
                              <div className="bcr-g702-value">{detail.g702.contractSum}</div>
                            </div>
                            <div className="bcr-g702-item">
                              <div className="bcr-g702-label">Work complete</div>
                              <div className="bcr-g702-value">{detail.g702.workComplete}</div>
                            </div>
                            <div className="bcr-g702-item">
                              <div className="bcr-g702-label">Retainage</div>
                              <div className="bcr-g702-value">{detail.g702.retainage}</div>
                            </div>
                            <div className="bcr-g702-item accent-bg">
                              <div className="bcr-g702-label">Current due</div>
                              <div className="bcr-g702-value">{detail.g702.currentDue}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* G703 SOV Table */}
                      {detail.sov.length > 0 && (
                        <div className="bcr-ds">
                          <div className="bcr-ds-head">
                            <h4>G703 — Schedule of values</h4>
                            <div className="bcr-ds-actions">
                              <span className="bcr-mini-tag">{detail.sov.length} items</span>
                            </div>
                          </div>
                          <div className="bcr-ds-body">
                            <table className="bcr-sov-table">
                              <thead>
                                <tr>
                                  <th>Description</th>
                                  <th>Scheduled</th>
                                  <th>This period</th>
                                  <th>Total</th>
                                  <th>%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.sov.map((s, i) => (
                                  <tr key={i}>
                                    <td>{s.item}</td>
                                    <td className="mono">{s.scheduled}</td>
                                    <td className="mono">{s.thisPeriod}</td>
                                    <td className="mono">{s.totalComplete}</td>
                                    <td className="mono">{s.pct}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Lien Waivers */}
                      {detail.liens.length > 0 && (
                        <div className="bcr-ds">
                          <div className="bcr-ds-head">
                            <h4>Lien waivers</h4>
                            <div className="bcr-ds-actions">
                              <span className="bcr-mini-tag">
                                {detail.liens.filter((l) => l.status === "received").length}/
                                {detail.liens.length} received
                              </span>
                            </div>
                          </div>
                          <div className="bcr-ds-body">
                            {detail.liens.map((l, i) => (
                              <div key={i} className="bcr-lien-row">
                                <div className={`bcr-lien-dot ${l.status}`} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="bcr-lien-name">{l.org}</div>
                                  <div className="bcr-lien-sub">{l.label}</div>
                                </div>
                                <span
                                  className={`bcr-pill ${
                                    l.status === "received" ? "green" : l.status === "pending" ? "orange" : "red"
                                  }`}
                                >
                                  {l.status === "received" ? "Received" : l.status === "pending" ? "Pending" : "Missing"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Supporting Files */}
                      {detail.files.length > 0 && (
                        <div className="bcr-ds">
                          <div className="bcr-ds-head">
                            <h4>Supporting files</h4>
                            <div className="bcr-ds-actions">
                              <span className="bcr-mini-tag">{detail.files.length} files</span>
                            </div>
                          </div>
                          <div className="bcr-ds-body">
                            {detail.files.map((f, i) => (
                              <div key={i} className="bcr-file-row">
                                <div>
                                  <div className="bcr-file-name">{f.name}</div>
                                  <div className="bcr-file-sub">{f.desc}</div>
                                </div>
                                <div className="bcr-file-chip">{f.type}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Decision Section */}
                      {detail.showDecision && (
                        <div className="bcr-ds">
                          <div className="bcr-ds-head">
                            <h4>Your decision</h4>
                            <div className="bcr-ds-actions">
                              <span className="bcr-pill accent">Action required</span>
                            </div>
                          </div>
                          <div className="bcr-ds-body">
                            <p>
                              Select a billing review outcome. These are formal decisions that return
                              to the contractor.
                            </p>
                            <div className="bcr-decision-options">
                              {[
                                { key: "approve", title: "Approve package", desc: "Confirm the draw is acceptable. Package moves forward as submitted." },
                                { key: "approve-note", title: "Approve with note", desc: "Approve, but include a billing note with the returned review." },
                                { key: "return", title: "Return for clarification", desc: "Do not approve. Send back for revision or additional backup." },
                              ].map((opt) => (
                                <div
                                  key={opt.key}
                                  className={`bcr-decision-option${decisionOption === opt.key ? " selected" : ""}`}
                                  onClick={() => {
                                    setDecisionOption(opt.key);
                                    setDecisionSubmitted(false);
                                  }}
                                >
                                  <h5>{opt.title}</h5>
                                  <p>{opt.desc}</p>
                                </div>
                              ))}
                            </div>
                            <div className="bcr-decision-compose">
                              <h5>{currentDecision.title}</h5>
                              <p>{currentDecision.desc}</p>
                              {currentDecision.showNote && (
                                <textarea
                                  className="bcr-note-area"
                                  placeholder={
                                    decisionOption === "return"
                                      ? "Describe what needs clarification…"
                                      : "Add your billing note here…"
                                  }
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                />
                              )}
                              <div className="bcr-decision-actions">
                                {decisionSubmitted ? (
                                  <button className="bcr-btn submitted-state">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Submitted
                                  </button>
                                ) : (
                                  <button
                                    className="bcr-btn primary"
                                    onClick={() => setDecisionSubmitted(true)}
                                  >
                                    {currentDecision.btn}
                                  </button>
                                )}
                                <button className="bcr-btn">Cancel</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right Rail ───────────────────────────────── */}
              <div className="bcr-rail">
                {/* Decision needed */}
                <div className="bcr-rail-card alert">
                  <div className="bcr-rch">
                    <h3>Decision needed</h3>
                    <div className="bcr-rch-sub">Highest-priority billing action.</div>
                  </div>
                  <div className="bcr-rcb">
                    <div className="bcr-muted-block">
                      <h4>Draw 06 affects payment timing</h4>
                      <p>
                        The contractor is waiting on your returned review outcome to update the next
                        billing milestone. This is the highest-priority package.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contract snapshot */}
                <div className="bcr-rail-card">
                  <div className="bcr-rch">
                    <h3>Contract snapshot</h3>
                    <div className="bcr-rch-sub">Current project financial summary.</div>
                  </div>
                  <div className="bcr-rcb">
                    {contractSnapshot.map((item, i) => (
                      <div key={i} className="bcr-file-row">
                        <div>
                          <div className="bcr-file-name">{item.label}</div>
                          <div className="bcr-file-sub">{item.sub}</div>
                        </div>
                        <div className="bcr-file-chip">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bcr-rail-card">
                  <div className="bcr-rch">
                    <h3>Recent activity</h3>
                    <div className="bcr-rch-sub">Billing events on this project.</div>
                  </div>
                  <div className="bcr-rcb">
                    {activities.map((a, i) => (
                      <div key={i} className="bcr-activity-item">
                        <div className={`bcr-activity-dot ${a.dot}`} />
                        <div
                          className="bcr-activity-text"
                          dangerouslySetInnerHTML={{ __html: a.text }}
                        />
                        <div className="bcr-activity-time">{a.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review principle */}
                <div className="bcr-rail-card info">
                  <div className="bcr-rch">
                    <h3>Review principle</h3>
                  </div>
                  <div className="bcr-rcb">
                    <p>
                      This page is about reviewing one formal package and returning a decision — not
                      browsing invoices. Each draw is a single review object containing value, backup,
                      and a decision return path.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ─── DARK MODE TOGGLE ─────────────────────────────── */}
        <button className="bcr-dark-toggle" onClick={() => setDark(!dark)}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
    </>
  );
}
