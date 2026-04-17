import { useState } from "react";

/*
 * SUBCONTRACTOR PORTAL-SPECIFIC SETTINGS
 * ──────────────────────────────────────
 * Covers subcontractor settings that do NOT live in the shared shell.
 *
 * Shared (see builtcrm_settings_shared_shell.jsx):
 *   - Profile, Security, Notifications, Appearance
 *
 * Lives elsewhere in the sub portal:
 *   - Team (at /subcontractor/(global)/team/ — Phase 4+ Step 11)
 *   - Compliance uploads (at /subcontractor/(project)/compliance/ — not here)
 *
 * This file:
 *   - Organization (company info, trade, logo, licensing)
 *   - Trade & Compliance (read-only compliance snapshot + self-managed certifications)
 *
 * Subs don't get Plan/Billing (free), SSO, or org-level audit logs.
 * Smaller surface than contractor — subs land here, glance, and leave.
 */

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  building: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h0M9 13h0M9 17h0"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ext: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  award: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  warn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ── Nav (sub portal, Settings active) ──────────────────────────
const nav = [
  { section: "Workspace", items: [
    { label: "Today Board" },
    { label: "Assigned Projects", badge: 3 },
    { label: "Messages", badge: 5 },
    { label: "Notifications", badge: 2, bt: "warn" },
  ]},
  { section: "Riverside Tower Fit-Out", items: [
    { label: "Project Home" },
    { label: "RFIs / Questions", badge: 2 },
    { label: "Compliance", badge: 1, bt: "danger" },
    { label: "Upload Responses", badge: 2 },
    { label: "Documents" },
    { label: "Schedule" },
    { label: "Financials" },
  ]},
  { section: "Account", items: [
    { label: "Team" },
    { label: "Settings", active: true },
  ]},
];

const user = { avatar: "AM", name: "Alex Morales", role: "Owner · Northline Electrical" };

// ── Settings tabs (sub-specific only) ──────────────────────────
const settingsTabs = [
  { id: "organization", label: "Organization", icon: I.building, desc: "Company profile, trade, and licensing" },
  { id: "compliance", label: "Trade & compliance", icon: I.shield, desc: "Insurance, W-9, bonding, and certifications" },
];

// Cross-refs (for the nav-strip at the top of the settings page)
const crossRefs = [
  { id: "profile", label: "Profile", note: "Shared shell" },
  { id: "security", label: "Security", note: "Shared shell" },
  { id: "notifications", label: "Notifications", note: "Shared shell" },
  { id: "team", label: "Team", note: "Account · Team page" },
];

// ── Trade catalog ──────────────────────────────────────────────
const tradeOptions = [
  "Electrical", "Plumbing", "HVAC / Mechanical", "Framing / Carpentry",
  "Concrete / Foundations", "Roofing", "Drywall", "Flooring",
  "Painting", "Masonry", "Landscaping", "Low Voltage / Data", "General MEP", "Other",
];

const regionOptions = [
  "San Francisco Bay Area", "East Bay", "Peninsula / South Bay",
  "Sacramento Metro", "Central Valley", "Northern California (other)",
];

// ── Organization defaults ──────────────────────────────────────
const orgDefaults = {
  legalName: "Northline Electrical LLC",
  displayName: "Northline Electrical",
  primaryTrade: "Electrical",
  secondaryTrades: ["Low Voltage / Data"],
  yearsInBusiness: "12",
  ein: "46-3987210",
  website: "https://northline-electric.com",
  phone: "+1 (415) 555-0184",
  addr1: "889 McAllister Street",
  addr2: "",
  city: "San Francisco",
  state: "CA",
  zip: "94102",
  country: "United States",
  crewSize: "8–15",
  regions: ["San Francisco Bay Area", "Peninsula / South Bay"],
  primaryContactName: "Alex Morales",
  primaryContactTitle: "Owner / Principal",
  primaryContactEmail: "alex@northline-electric.com",
  primaryContactPhone: "+1 (415) 555-0185",
  licenses: [
    { id: 1, kind: "C-10 Electrical Contractor (CSLB)", number: "C10-1048221", state: "CA", expires: "2027-06-30" },
    { id: 2, kind: "Low Voltage C-7 Endorsement", number: "C7-4401991", state: "CA", expires: "2026-11-15" },
  ],
};

// ── Compliance snapshot (READ-ONLY — managed in compliance workspace) ──
const complianceDocs = [
  { id: "gl", kind: "General Liability Insurance", status: "current", expires: "Jun 14, 2027", detail: "$2M per occurrence · $4M aggregate", carrier: "Travelers" },
  { id: "wc", kind: "Workers' Compensation", status: "current", expires: "Feb 28, 2027", detail: "Coverage: California statutory", carrier: "State Fund" },
  { id: "al", kind: "Auto Liability", status: "expiring", expires: "Sep 3, 2026", detail: "$1M combined single limit · 4 vehicles listed", carrier: "Progressive Commercial" },
  { id: "w9", kind: "W-9 Tax Form", status: "current", expires: "—", detail: "Filed Jan 8, 2025 · On file with Summit Contracting" },
  { id: "ein", kind: "EIN Verification", status: "current", expires: "—", detail: "IRS CP-575 on file" },
  { id: "bond", kind: "Surety Bond", status: "na", expires: "—", detail: "Not required for current assigned projects" },
  { id: "msa", kind: "Master Services Agreement", status: "current", expires: "Dec 31, 2026", detail: "Signed with Summit Contracting · Jan 2024" },
];

const statusMap = {
  current: { label: "Current", cls: "ok" },
  expiring: { label: "Expiring soon", cls: "warn" },
  expired: { label: "Expired", cls: "dg" },
  missing: { label: "Missing", cls: "dg" },
  na: { label: "Not applicable", cls: "off" },
};

// ── Self-managed certifications ────────────────────────────────
const certDefaults = [
  { id: 1, kind: "OSHA-30 Construction", holder: "Alex Morales", issued: "Mar 2024", expires: "Mar 2029" },
  { id: 2, kind: "OSHA-10 Construction", holder: "4 crew members", issued: "Various", expires: "Multiple" },
  { id: 3, kind: "NFPA 70E Arc Flash", holder: "Alex Morales, R. Chen", issued: "Aug 2025", expires: "Aug 2028" },
  { id: 4, kind: "NECA Member (Northern CA)", holder: "Northline Electrical", issued: "2018", expires: "Annual renewal" },
];

// ── Component ──────────────────────────────────────────────────
export default function SubcontractorSettings() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("organization");

  // Organization
  const [org, setOrg] = useState(orgDefaults);
  const [orgDirty, setOrgDirty] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const updateOrg = (k, v) => { setOrg({ ...org, [k]: v }); setOrgDirty(true); setOrgSaved(false); };
  const saveOrg = () => { setOrgDirty(false); setOrgSaved(true); setTimeout(() => setOrgSaved(false), 2400); };
  const discardOrg = () => { setOrg(orgDefaults); setOrgDirty(false); };

  const toggleSecondary = (t) => {
    const has = org.secondaryTrades.includes(t);
    updateOrg("secondaryTrades", has ? org.secondaryTrades.filter(x => x !== t) : [...org.secondaryTrades, t]);
  };
  const toggleRegion = (r) => {
    const has = org.regions.includes(r);
    updateOrg("regions", has ? org.regions.filter(x => x !== r) : [...org.regions, r]);
  };
  const removeLicense = (id) => updateOrg("licenses", org.licenses.filter(l => l.id !== id));

  // Certifications
  const [certs, setCerts] = useState(certDefaults);
  const [showAddCert, setShowAddCert] = useState(false);
  const [certForm, setCertForm] = useState({ kind: "", holder: "", issued: "", expires: "" });

  const addCert = () => {
    if (!certForm.kind) return;
    setCerts([...certs, { id: Date.now(), ...certForm }]);
    setCertForm({ kind: "", holder: "", issued: "", expires: "" });
    setShowAddCert(false);
  };
  const removeCert = (id) => setCerts(certs.filter(c => c.id !== id));

  const activeTab = settingsTabs.find(t => t.id === tab);

  return (
    <div className={`ss ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.ss{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(61,107,142,.15);
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.ss.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#5a8db5;--ac-h:#4e7ea3;--ac-s:#182838;--ac-t:#7eafd4;--ac-m:#2e4a60;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shri:0 0 0 3px rgba(90,141,181,.2);
}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none;color:inherit}
input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1a2e3e,var(--ac));display:grid;place-items:center;flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px}
.s-user-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.s-user-name{font-size:13px;font-weight:580;color:var(--t1)}.s-user-role{font-size:11px;color:var(--t3);margin-top:1px}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.ss.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px 32px 40px;flex:1;max-width:1200px;width:100%}

/* Page header */
.pg-hdr{margin-bottom:22px}
.pg-hdr h2{font-family:var(--fd);font-size:26px;font-weight:750;letter-spacing:-.03em}
.pg-sub{font-size:13.5px;color:var(--t2);margin-top:4px;font-weight:520}

/* Cross-ref strip */
.xrefs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px;padding:10px 12px;background:var(--s1);border:1px dashed var(--s3);border-radius:var(--r-l)}
.xrefs-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:4px 6px 4px 0;margin-right:4px}
.xref{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--s2);color:var(--t2);display:inline-flex;align-items:center;gap:5px}
.xref-note{font-size:10px;color:var(--t3);font-weight:500}

/* Settings layout */
.slt{display:grid;grid-template-columns:248px 1fr;gap:28px;align-items:start}
@media(max-width:960px){.slt{grid-template-columns:1fr}}

.snv{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:8px;display:flex;flex-direction:column;gap:2px;position:sticky;top:calc(var(--tbh) + 16px)}
.st-tab{display:flex;align-items:flex-start;gap:12px;padding:11px 12px;border-radius:var(--r-m);text-align:left;transition:all var(--df);color:var(--t2);cursor:pointer;width:100%}
.st-tab:hover{background:var(--sh);color:var(--t1)}
.st-tab.on{background:var(--ac-s);color:var(--ac-t)}
.st-tab-ic{width:28px;height:28px;border-radius:var(--r-s);background:var(--s2);display:grid;place-items:center;flex-shrink:0;color:var(--t2);margin-top:1px;transition:all var(--df)}
.st-tab.on .st-tab-ic{background:var(--ac);color:white}
.st-tab-body{flex:1;min-width:0}
.st-tab-lbl{font-family:var(--fd);font-size:13px;font-weight:650;letter-spacing:-.01em}
.st-tab-ds{font-size:11.5px;color:var(--t3);margin-top:2px;line-height:1.35;font-weight:500}

/* Panel */
.panel{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;margin-bottom:16px}
.panel-hdr{margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.panel-hdr .h-body h3{font-family:var(--fd);font-size:17px;font-weight:700;letter-spacing:-.02em}
.panel-hdr .h-body p{font-size:13px;color:var(--t2);margin-top:3px;font-weight:520}

/* Fields */
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.field:last-child{margin-bottom:0}
.field label{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t2);letter-spacing:.01em}
.fld{height:40px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:13.5px;color:var(--t1);outline:none;transition:all var(--df);font-family:var(--fb);width:100%}
.fld:focus{border-color:var(--ac);box-shadow:var(--shri)}
.fld.mono{font-family:var(--fm);font-size:13px;letter-spacing:.02em}
.fld-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fld-row-3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px}
@media(max-width:620px){.fld-row,.fld-row-3{grid-template-columns:1fr}}
.field-help{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:500}

/* Chip list (for multi-select trades, regions) */
.chip-list{display:flex;flex-wrap:wrap;gap:6px;padding:10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s2);min-height:44px;align-items:center}
.chip{padding:5px 10px 5px 12px;border-radius:999px;background:var(--s1);border:1px solid var(--s3);font-size:12px;font-weight:600;color:var(--t2);display:inline-flex;align-items:center;gap:6px;transition:all var(--df);cursor:pointer}
.chip:hover{border-color:var(--s4);color:var(--t1)}
.chip.on{background:var(--ac-s);border-color:var(--ac-m);color:var(--ac-t)}
.chip .x{display:inline-flex;opacity:.7}
.chip.on:hover .x{opacity:1}

/* Buttons */
.btn{height:38px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all var(--dn) var(--e);font-family:var(--fb)}
.btn.primary{background:var(--ac);color:white;border:none}.btn.primary:hover{background:var(--ac-h);box-shadow:var(--shmd)}
.btn.primary:disabled{background:var(--s3);color:var(--t3);cursor:not-allowed;box-shadow:none}
.btn.ghost{border:1px solid var(--s3);background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--sh);border-color:var(--s4);color:var(--t1)}
.btn.danger{border:1px solid var(--dg);background:transparent;color:var(--dg)}.btn.danger:hover{background:var(--dg-s)}
.btn.sm{height:32px;padding:0 14px;font-size:12px}
.btn.link{height:auto;padding:0;background:none;color:var(--ac-t);font-weight:650;font-size:12.5px;border:none}
.btn.link:hover{color:var(--ac-h);text-decoration:underline}

/* Pill */
.pill{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;font-family:var(--fd);letter-spacing:.02em;flex-shrink:0;display:inline-flex;align-items:center;gap:4px}
.pill.ok{background:var(--ok-s);color:var(--ok-t)}
.pill.off{background:var(--s3);color:var(--t2)}
.pill.warn{background:var(--wr-s);color:var(--wr-t)}
.pill.dg{background:var(--dg-s);color:var(--dg-t)}
.pill.info{background:var(--in-s);color:var(--in-t)}
.pill.ac{background:var(--ac-s);color:var(--ac-t)}

/* Save bar */
.save-bar{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);margin-top:12px}
.save-bar.dirty{background:var(--wr-s);border-color:var(--wr)}
.save-bar.success{background:var(--ok-s);border-color:var(--ok)}
.save-bar-l{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:580}
.save-bar.dirty .save-bar-l{color:var(--wr-t)}
.save-bar.success .save-bar-l{color:var(--ok-t)}
.save-dot{width:8px;height:8px;border-radius:50%;background:var(--wr)}
.save-bar.success .save-dot{background:var(--ok)}
.save-actions{display:flex;gap:8px}

/* Logo uploader */
.logo-up{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.logo-sq{width:88px;height:88px;border-radius:var(--r-l);background:linear-gradient(135deg,#1a2e3e,var(--ac));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:34px;font-weight:800;letter-spacing:-.04em;flex-shrink:0}

/* License / Compliance / Cert rows */
.row-card{display:flex;align-items:flex-start;gap:14px;padding:14px;border:1px solid var(--s3);border-radius:var(--r-l);margin-bottom:8px;background:var(--s1)}
.row-card:last-child{margin-bottom:0}
.row-body{flex:1;min-width:0}
.row-ttl{font-family:var(--fd);font-size:13.5px;font-weight:650;letter-spacing:-.01em;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.row-meta{font-size:12px;color:var(--t3);margin-top:3px;font-weight:500;line-height:1.45}
.row-meta.mono{font-family:var(--fm)}
.row-acts{display:flex;gap:6px;flex-shrink:0}

/* Compliance snapshot banner */
.cb-banner{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cb-banner-ic{width:34px;height:34px;border-radius:var(--r-m);background:var(--ac);color:white;display:grid;place-items:center;flex-shrink:0}
.cb-banner-body{flex:1;min-width:240px}
.cb-banner-ttl{font-family:var(--fd);font-size:13.5px;font-weight:650;color:var(--ac-t)}
.cb-banner-ds{font-size:12px;color:var(--ac-t);margin-top:2px;font-weight:520;opacity:.9}

/* Add-cert inline panel */
.add-panel{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:18px;margin-bottom:12px}
.add-grid{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px;align-items:end}
@media(max-width:820px){.add-grid{grid-template-columns:1fr 1fr;gap:12px}}
@media(max-width:520px){.add-grid{grid-template-columns:1fr}}

/* Read-only summary grid */
.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:-4px}
@media(max-width:620px){.summary-grid{grid-template-columns:1fr}}
.summary-item{padding:12px 14px;background:var(--s2);border-radius:var(--r-m)}
.summary-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.summary-val{font-size:13.5px;font-weight:600;color:var(--t1);font-family:var(--fd);letter-spacing:-.01em}

.page-anim{animation:fadeIn .24s var(--e)}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Sidebar ───────────────────────── */}
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 80 80" width="16" height="16">
              <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
              <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
              <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
            </svg>
          </div>
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">Subcontractor Portal</div>
          </div>
        </div>

        <nav className="s-nav">
          {nav.map(sec => (
            <div key={sec.section}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map(it => (
                <div key={it.label} className={`ni ${it.active ? "on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge != null && <span className={`ni-b ${it.bt || "blue"}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="s-foot">
          <div className="s-user">
            <div className="s-user-av">{user.avatar}</div>
            <div style={{ minWidth: 0 }}>
              <div className="s-user-name">{user.name}</div>
              <div className="s-user-role">{user.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>Subcontractor Portal</span>
            <span className="sep">/</span>
            <span className="cur">Settings</span>
            <span className="sep">/</span>
            <span className="cur">{activeTab.label}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</button>
            <button className="ib">{I.bell}</button>
            <div className="av">{user.avatar}</div>
          </div>
        </div>

        <div className="ct">
          <div className="pg-hdr">
            <h2>Company settings</h2>
            <div className="pg-sub">Manage your company profile, trade, and compliance snapshot.</div>
          </div>

          {/* Cross-refs strip */}
          <div className="xrefs">
            <span className="xrefs-lbl">Also available:</span>
            {crossRefs.map(r => (
              <span key={r.id} className="xref">
                {r.label}
                <span className="xref-note">· {r.note}</span>
              </span>
            ))}
          </div>

          <div className="slt">
            <nav className="snv">
              {settingsTabs.map(t => (
                <button key={t.id} className={`st-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                  <div className="st-tab-ic">{t.icon}</div>
                  <div className="st-tab-body">
                    <div className="st-tab-lbl">{t.label}</div>
                    <div className="st-tab-ds">{t.desc}</div>
                  </div>
                </button>
              ))}
            </nav>

            <div className="page-anim" key={tab}>

              {/* ═══════ ORGANIZATION ═══════ */}
              {tab === "organization" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Company logo</h3>
                        <p>Shown on certificates of insurance, pay applications, and in your GC's view.</p>
                      </div>
                    </div>
                    <div className="logo-up">
                      <div className="logo-sq">NE</div>
                      <div>
                        <div className="field-help" style={{ marginBottom: 8 }}>PNG or SVG · square, up to 2 MB · 512×512 recommended</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn ghost sm">{I.upload} Upload logo</button>
                          <button className="btn ghost sm">Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Company information</h3>
                        <p>How your company appears to GCs and on official documents.</p>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Display name</label>
                        <input className="fld" value={org.displayName} onChange={e => updateOrg("displayName", e.target.value)} />
                        <div className="field-help">What GCs see in lists and assignments</div>
                      </div>
                      <div className="field">
                        <label>Legal name</label>
                        <input className="fld" value={org.legalName} onChange={e => updateOrg("legalName", e.target.value)} />
                        <div className="field-help">Used on invoices, W-9s, and contracts</div>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Primary trade</label>
                        <select className="fld" value={org.primaryTrade} onChange={e => updateOrg("primaryTrade", e.target.value)}>
                          {tradeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="field-help">Your main scope — sets notification defaults</div>
                      </div>
                      <div className="field">
                        <label>Years in business</label>
                        <input className="fld mono" value={org.yearsInBusiness} onChange={e => updateOrg("yearsInBusiness", e.target.value)} />
                      </div>
                    </div>

                    <div className="field">
                      <label>Secondary trades (optional)</label>
                      <div className="chip-list">
                        {tradeOptions.filter(t => t !== org.primaryTrade).map(t => {
                          const on = org.secondaryTrades.includes(t);
                          return (
                            <button key={t} className={`chip ${on ? "on" : ""}`} onClick={() => toggleSecondary(t)} type="button">
                              {t}
                              {on && <span className="x">{I.x}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="field-help">Trades you can also self-perform — used when GCs search for subs</div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Tax ID (EIN)</label>
                        <input className="fld mono" value={org.ein} onChange={e => updateOrg("ein", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Website</label>
                        <input className="fld" type="url" value={org.website} onChange={e => updateOrg("website", e.target.value)} />
                      </div>
                    </div>

                    <div className="field">
                      <label>Main phone</label>
                      <input className="fld" type="tel" value={org.phone} onChange={e => updateOrg("phone", e.target.value)} />
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Business address</h3>
                        <p>Used on W-9s, certificates of insurance, and official correspondence.</p>
                      </div>
                    </div>
                    <div className="field">
                      <label>Street address</label>
                      <input className="fld" value={org.addr1} onChange={e => updateOrg("addr1", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Suite / unit (optional)</label>
                      <input className="fld" value={org.addr2} onChange={e => updateOrg("addr2", e.target.value)} />
                    </div>
                    <div className="fld-row-3">
                      <div className="field">
                        <label>City</label>
                        <input className="fld" value={org.city} onChange={e => updateOrg("city", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>State / province</label>
                        <input className="fld" value={org.state} onChange={e => updateOrg("state", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>ZIP / postal</label>
                        <input className="fld mono" value={org.zip} onChange={e => updateOrg("zip", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Country</label>
                      <select className="fld" value={org.country} onChange={e => updateOrg("country", e.target.value)}>
                        <option>United States</option>
                        <option>Canada</option>
                        <option>Mexico</option>
                      </select>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Service regions</h3>
                        <p>Where you're available for work. Helps GCs match you to new projects.</p>
                      </div>
                    </div>
                    <div className="field">
                      <label>Regions served</label>
                      <div className="chip-list">
                        {regionOptions.map(r => {
                          const on = org.regions.includes(r);
                          return (
                            <button key={r} className={`chip ${on ? "on" : ""}`} onClick={() => toggleRegion(r)} type="button">
                              {r}
                              {on && <span className="x">{I.x}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="fld-row">
                      <div className="field">
                        <label>Typical crew size</label>
                        <select className="fld" value={org.crewSize} onChange={e => updateOrg("crewSize", e.target.value)}>
                          <option>1–3</option>
                          <option>4–7</option>
                          <option>8–15</option>
                          <option>16–30</option>
                          <option>30+</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Primary contact</h3>
                        <p>The person GCs reach when they have questions or want to assign new work.</p>
                      </div>
                    </div>
                    <div className="fld-row">
                      <div className="field">
                        <label>Contact name</label>
                        <input className="fld" value={org.primaryContactName} onChange={e => updateOrg("primaryContactName", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Title / role</label>
                        <input className="fld" value={org.primaryContactTitle} onChange={e => updateOrg("primaryContactTitle", e.target.value)} />
                      </div>
                    </div>
                    <div className="fld-row">
                      <div className="field">
                        <label>Email</label>
                        <input className="fld" type="email" value={org.primaryContactEmail} onChange={e => updateOrg("primaryContactEmail", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Phone</label>
                        <input className="fld" type="tel" value={org.primaryContactPhone} onChange={e => updateOrg("primaryContactPhone", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Licenses & credentials</h3>
                        <p>Trade licenses and state endorsements. GCs see these in your profile card.</p>
                      </div>
                      <button className="btn ghost sm">{I.plus} Add license</button>
                    </div>
                    {org.licenses.map(l => (
                      <div key={l.id} className="row-card">
                        <div className="row-body">
                          <div className="row-ttl">
                            {l.kind}
                            <span className="pill ac">{l.state}</span>
                          </div>
                          <div className="row-meta mono">{l.number} · Expires {l.expires}</div>
                        </div>
                        <div className="row-acts">
                          <button className="btn ghost sm">Edit</button>
                          <button className="btn ghost sm" onClick={() => removeLicense(l.id)} title="Remove license">{I.x}</button>
                        </div>
                      </div>
                    ))}
                    {org.licenses.length === 0 && (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
                        No licenses added yet. GCs may ask for these when assigning work.
                      </div>
                    )}
                  </div>

                  {(orgDirty || orgSaved) && (
                    <div className={`save-bar ${orgSaved ? "success" : "dirty"}`}>
                      <div className="save-bar-l">
                        <span className="save-dot" />
                        {orgSaved ? "Company info saved" : "You have unsaved changes"}
                      </div>
                      {!orgSaved && (
                        <div className="save-actions">
                          <button className="btn ghost sm" onClick={discardOrg}>Discard</button>
                          <button className="btn primary sm" onClick={saveOrg}>{I.check} Save changes</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══════ TRADE & COMPLIANCE ═══════ */}
              {tab === "compliance" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Trade summary</h3>
                        <p>Snapshot of your trade profile. Edit details in the Organization tab.</p>
                      </div>
                    </div>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <div className="summary-lbl">Primary trade</div>
                        <div className="summary-val">{org.primaryTrade}</div>
                      </div>
                      <div className="summary-item">
                        <div className="summary-lbl">Crew size</div>
                        <div className="summary-val">{org.crewSize} on typical job</div>
                      </div>
                      <div className="summary-item" style={{ gridColumn: "1 / -1" }}>
                        <div className="summary-lbl">Secondary trades</div>
                        <div className="summary-val" style={{ fontWeight: 550, fontFamily: "var(--fb)", fontSize: 13 }}>
                          {org.secondaryTrades.length > 0 ? org.secondaryTrades.join(" · ") : "None"}
                        </div>
                      </div>
                      <div className="summary-item" style={{ gridColumn: "1 / -1" }}>
                        <div className="summary-lbl">Service regions</div>
                        <div className="summary-val" style={{ fontWeight: 550, fontFamily: "var(--fb)", fontSize: 13 }}>
                          {org.regions.length > 0 ? org.regions.join(" · ") : "None"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Compliance snapshot</h3>
                        <p>Live status of your compliance documents. Uploads and renewals happen in the Compliance workspace.</p>
                      </div>
                      <button className="btn ghost sm">Open Compliance {I.ext}</button>
                    </div>

                    <div className="cb-banner">
                      <div className="cb-banner-ic">{I.shield}</div>
                      <div className="cb-banner-body">
                        <div className="cb-banner-ttl">Read-only view</div>
                        <div className="cb-banner-ds">This snapshot mirrors your compliance record. To upload new documents or renew expiring ones, open the Compliance workspace.</div>
                      </div>
                    </div>

                    {complianceDocs.map(d => {
                      const s = statusMap[d.status];
                      return (
                        <div key={d.id} className="row-card">
                          <div className="row-body">
                            <div className="row-ttl">
                              {d.kind}
                              <span className={`pill ${s.cls}`}>{s.label}</span>
                            </div>
                            <div className="row-meta">
                              {d.detail}
                              {d.carrier && <> · <span style={{ fontFamily: "var(--fd)", fontWeight: 600, color: "var(--t2)" }}>{d.carrier}</span></>}
                              {d.expires !== "—" && <> · Expires {d.expires}</>}
                            </div>
                          </div>
                          <div className="row-acts">
                            <button className="btn ghost sm">View</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Certifications</h3>
                        <p>Self-managed — training, industry memberships, and endorsements. Not required for GC onboarding, but shown in your profile.</p>
                      </div>
                      <button className="btn primary sm" onClick={() => setShowAddCert(!showAddCert)}>
                        {showAddCert ? "Cancel" : <>{I.plus} Add certification</>}
                      </button>
                    </div>

                    {showAddCert && (
                      <div className="add-panel page-anim">
                        <div className="add-grid">
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Certification / credential</label>
                            <input className="fld" placeholder="e.g. OSHA-30 Construction" value={certForm.kind} onChange={e => setCertForm({ ...certForm, kind: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Holder</label>
                            <input className="fld" placeholder="Name or 'Company'" value={certForm.holder} onChange={e => setCertForm({ ...certForm, holder: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Expires</label>
                            <input className="fld" placeholder="Month YYYY" value={certForm.expires} onChange={e => setCertForm({ ...certForm, expires: e.target.value })} />
                          </div>
                          <button className="btn primary sm" onClick={addCert} disabled={!certForm.kind}>Add</button>
                        </div>
                      </div>
                    )}

                    {certs.map(c => (
                      <div key={c.id} className="row-card">
                        <div style={{ width: 34, height: 34, borderRadius: "var(--r-m)", background: "var(--ac-s)", color: "var(--ac-t)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          {I.award}
                        </div>
                        <div className="row-body">
                          <div className="row-ttl">{c.kind}</div>
                          <div className="row-meta">
                            {c.holder}
                            {c.issued && <> · Issued {c.issued}</>}
                            {c.expires && <> · Expires {c.expires}</>}
                          </div>
                        </div>
                        <div className="row-acts">
                          <button className="btn ghost sm" onClick={() => removeCert(c.id)} title="Remove">{I.x}</button>
                        </div>
                      </div>
                    ))}
                    {certs.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
                        No certifications added yet.
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
