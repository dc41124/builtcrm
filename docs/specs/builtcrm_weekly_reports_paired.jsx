import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>,
  pencil: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  clock: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  send: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  image: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  chevron: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
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

// ── Nav (per portal) ────────────────────────────────────────────
const contractorNav = [
  { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Inbox", badge: 8, bt: "blue" }] },
  { section: "Riverside Tower Fit-Out", items: [
    { label: "Project Home" },
    { label: "Weekly Reports", active: true, badge: 1, bt: "blue" },
    { label: "RFIs / Issues", badge: 9, bt: "danger" },
    { label: "Approvals", badge: 5, bt: "blue" },
    { label: "Change Orders", badge: 2, bt: "blue" },
    { label: "Billing / Draws" },
    { label: "Daily Logs" },
    { label: "Documents" },
    { label: "Schedule" },
    { label: "Team" },
  ]},
];

const commercialNav = [
  { section: "Workspace", items: [{ label: "Dashboard" }] },
  { section: "Riverside Tower Fit-Out", items: [
    { label: "Project Home" },
    { label: "Weekly Reports", active: true, badge: 1, bt: "blue" },
    { label: "Approvals", badge: 3, bt: "blue" },
    { label: "Change Orders" },
    { label: "Draw Reviews" },
    { label: "Documents" },
    { label: "Schedule" },
    { label: "Messages" },
  ]},
];

const residentialNav = [
  { section: "Your home", items: [{ label: "Overview" }] },
  { section: "Harbour Crescent Residence", items: [
    { label: "This week", active: true, badge: 1, bt: "warm" },
    { label: "Your selections" },
    { label: "Approvals", badge: 2, bt: "warm" },
    { label: "Billing" },
    { label: "Photos" },
    { label: "Schedule" },
    { label: "Messages" },
    { label: "Documents" },
  ]},
];

// ── Contractor report list (commercial project) ─────────────────
const contractorReports = [
  {
    id: "wr-apr12",
    weekLabel: "Week of Apr 12 – Apr 18",
    weekShort: "Apr 12",
    status: "Auto-draft",
    statusType: "orange",
    teaser: "Steel coordination milestone hit. 3 RFIs opened, 2 closed. First concrete pour on level 4 complete.",
    sectionCount: 6,
    generated: "Generated Mon 6:02am",
    active: true,
  },
  {
    id: "wr-apr5",
    weekLabel: "Week of Apr 5 – Apr 11",
    weekShort: "Apr 5",
    status: "Sent",
    statusType: "green",
    teaser: "Interior framing on levels 2–3 wrapped ahead of schedule. Owner walked site Thursday.",
    sectionCount: 5,
    generated: "Sent Mon Apr 12 · 9:14am",
  },
  {
    id: "wr-mar29",
    weekLabel: "Week of Mar 29 – Apr 4",
    weekShort: "Mar 29",
    status: "Sent",
    statusType: "green",
    teaser: "Mechanical rough-in on level 3 started. Permit inspection scheduled for Apr 8.",
    sectionCount: 6,
    generated: "Sent Mon Apr 5 · 8:48am",
  },
  {
    id: "wr-mar22",
    weekLabel: "Week of Mar 22 – Mar 28",
    weekShort: "Mar 22",
    status: "Sent",
    statusType: "green",
    teaser: "First structural steel delivery cleared inspection. Two CO requests submitted for revised MEP layouts.",
    sectionCount: 5,
    generated: "Sent Mon Mar 29 · 10:02am",
  },
  {
    id: "wr-mar15",
    weekLabel: "Week of Mar 15 – Mar 21",
    weekShort: "Mar 15",
    status: "Sent",
    statusType: "green",
    teaser: "Site prep complete. Foundation pour scheduled week of Mar 22.",
    sectionCount: 4,
    generated: "Sent Mon Mar 22 · 9:30am",
  },
];

// ── Active report sections (contractor editing view) ────────────
const activeSections = [
  {
    key: "summary",
    kind: "summary",
    title: "Week summary",
    preview:
      "Steel coordination milestone closed out on Thursday. First concrete pour on level 4 completed Friday — 1 day ahead of schedule. Three RFIs opened early-week, two resolved by Friday. Owner walk-through scheduled for Tuesday next week.",
    auto: true,
  },
  {
    key: "dailyLogs",
    kind: "dailyLogs",
    title: "Daily logs",
    count: "5 logs",
    items: [
      { day: "Mon Apr 12", author: "Marcus Webb, Site Super", summary: "Steel placement on level 4 at 85%. Crew count 14. Weather clear, 12°C." },
      { day: "Tue Apr 13", author: "Marcus Webb, Site Super", summary: "Steel coordination wrapping. Inspection Wed 10am. Crew count 14." },
      { day: "Wed Apr 14", author: "Marcus Webb, Site Super", summary: "Inspection passed at 11:15am. Concrete prep for level 4 pour begins." },
      { day: "Thu Apr 15", author: "Marcus Webb, Site Super", summary: "Formwork complete. Pour scheduled 6am Fri." },
      { day: "Fri Apr 16", author: "Marcus Webb, Site Super", summary: "Concrete pour complete by 10:45am. 80m³ placed. Cure monitoring through weekend." },
    ],
  },
  {
    key: "photos",
    kind: "photos",
    title: "Photos",
    count: "12 photos",
    items: [
      { caption: "Level 4 steel placement — Wed AM", color: "#8a7a5c" },
      { caption: "Concrete pour start, level 4", color: "#6b605a" },
      { caption: "Inspector Holden signoff", color: "#705e48" },
      { caption: "Finished slab, cure in progress", color: "#9a8868" },
    ],
  },
  {
    key: "milestones",
    kind: "milestones",
    title: "Milestones",
    count: "1 closed, 1 upcoming",
    items: [
      { label: "Steel coordination — Level 3/4", status: "closed", detail: "Closed Apr 14 · 1 day ahead of plan" },
      { label: "Concrete pour — Level 4", status: "closed", detail: "Closed Apr 16 · On time" },
      { label: "MEP rough-in — Level 4", status: "upcoming", detail: "Starts Apr 22" },
    ],
  },
  {
    key: "rfis",
    kind: "rfis",
    title: "RFIs & issues",
    count: "3 opened, 2 closed",
    items: [
      { id: "RFI-018", title: "Beam offset conflict", status: "Open", statusType: "red", note: "Blocking — formal response pending from Apex" },
      { id: "RFI-017", title: "Fire damper access clearance", status: "Closed", statusType: "green", note: "Answered Apr 14" },
      { id: "ISS-042", title: "Ceiling grid mismatch", status: "Open", statusType: "orange", note: "Needs response from BrightWorks" },
      { id: "ISS-041", title: "Conduit path conflict", status: "Closed", statusType: "green", note: "Resolved on-site Apr 15" },
    ],
  },
  {
    key: "cos",
    kind: "cos",
    title: "Change orders",
    count: "1 submitted, 0 approved",
    items: [
      { id: "CO-011", title: "Added insulation package, levels 2–4", amount: "+$18,400", status: "Submitted", statusType: "accent", note: "Under owner review" },
    ],
  },
];

// ── Commercial client view (same project, read-only) ────────────
const commercialReportHeader = {
  weekLabel: "Week of Apr 12 – Apr 18, 2026",
  statusNote: "Sent by Daniel Chen, Northstar Construction · Mon Apr 19 · 9:14am",
  project: "Riverside Tower Fit-Out · 245 Harbourfront Ave",
};

// Commercial uses the same sections as contractor's final "sent" version —
// pulled from activeSections but rendered read-only.

// ── Residential project (different, warmer framing) ─────────────
const residentialHeader = {
  homeName: "Harbour Crescent Residence",
  weekLabel: "Apr 12 – Apr 18",
  statusNote: "From Sarah at Northstar — sent Monday morning",
};

const residentialSections = [
  {
    kind: "summary",
    title: "What happened this week",
    text:
      "Great week. The framing crew wrapped up the second-floor walls on Wednesday and the plumber was on-site Thursday for the rough-in. The rough electrical is scheduled to start next Monday, and we're on track for drywall inspection in early May. Your pantry window swap came in — see decisions below.",
  },
  {
    kind: "progress",
    title: "On site this week",
    items: [
      { label: "Framing — second floor", status: "Done", statusType: "green" },
      { label: "Plumbing rough-in", status: "In progress", statusType: "orange" },
      { label: "Window delivery (pantry swap)", status: "Arrived", statusType: "green" },
    ],
  },
  {
    kind: "photos",
    title: "Photos from your home",
    items: [
      { caption: "Second-floor framing Wednesday", color: "#c9a76e" },
      { caption: "Your new pantry window on site", color: "#b89a72" },
      { caption: "Rough plumbing in progress", color: "#8f7a5c" },
      { caption: "View from the back kitchen", color: "#a48968" },
    ],
  },
  {
    kind: "decisions",
    title: "Decisions & updates",
    items: [
      { title: "Pantry window swap approved", detail: "You approved the black-frame option last week and it arrived Friday. No cost change." },
      { title: "Paint review scheduled", detail: "Sarah scheduled your paint sample review for Wed Apr 24 at 10am. Let her know if that doesn't work." },
    ],
  },
  {
    kind: "upcoming",
    title: "Coming up next week",
    items: [
      "Electrical rough-in starts Monday",
      "Drywall delivery Wednesday",
      "Paint sample review with you on Apr 24",
    ],
  },
  {
    kind: "questions",
    title: "Anything for you to do?",
    text: "Just the paint review Apr 24 — we'll send a reminder the day before. No other action needed from you this week.",
  },
];

// ═══════════════════════════════════════════════════════════════════
// ── Main Component ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
export default function WeeklyReportsPaired() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [activeReport, setActiveReport] = useState("wr-apr12");
  const [editing, setEditing] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(activeSections[0].preview);

  const isComm = portal === "commercial";
  const isResi = portal === "residential";
  const nav = isResi ? residentialNav : isComm ? commercialNav : contractorNav;

  let portalLabel = "Contractor Portal";
  let userInit = "DC";
  if (isComm) { portalLabel = "Commercial Client"; userInit = "LT"; }
  if (isResi) { portalLabel = "Residential Client"; userInit = "EM"; }

  const themeClass = isResi ? "resi" : isComm ? "comm" : "";
  const projectLabel = isResi ? "Harbour Crescent Residence" : "Riverside Tower Fit-Out";
  const pageLabel = isResi ? "This week at your home" : "Weekly Reports";

  return (
    <div className={`rw ${dark ? "dk" : ""} ${themeClass}`}>
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
  --warm-t:#8a5a2b;--warm-s:#fbf0e2;--warm-m:#ecd5b4;
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
.rw.comm{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15);}
.rw.resi{--ac:#a86b2f;--ac-h:#8f5a26;--ac-s:#f7ecd9;--ac-t:#7a4a22;--ac-m:#e6c79a;--shri:0 0 0 3px rgba(168,107,47,.15);}
.rw.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --warm-t:#e8b673;--warm-s:#2a1f10;--warm-m:#5a4420;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);--shlg:0 8px 32px rgba(0,0,0,.35);
}
.rw.dk.comm{--ac:#5a9cc4;--ac-h:#4a8ab4;--ac-s:#142030;--ac-t:#7eb8dc;--ac-m:#2a4050;--shri:0 0 0 3px rgba(90,156,196,.2);}
.rw.dk.resi{--ac:#d49260;--ac-h:#b97b48;--ac-s:#2a1e10;--ac-t:#e8b077;--ac-m:#4a3a20;--shri:0 0 0 3px rgba(212,146,96,.2);}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}
input,select,textarea{font-family:inherit}

/* ── Sidebar ───────────────────────────────────────── */
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
.ni-b.warm{background:var(--warm-s);color:var(--warm-t)}

/* ── Main ──────────────────────────────────────────── */
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

/* Portal switcher */
.psw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.psw button{height:36px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e)}
.psw button:hover{color:var(--t1)}
.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Page header */
.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:620px;line-height:1.5}
.pg-h-acts{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

/* Summary strip */
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.ss.s3{grid-template-columns:repeat(3,1fr)}
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
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd);letter-spacing:.02em}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.mt{height:20px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--s3);background:var(--s2);color:var(--t3);display:inline-flex;align-items:center;white-space:nowrap;font-family:var(--fd)}

/* ── Contractor grid: list | editor | rail ────────── */
.wr-grid{display:grid;grid-template-columns:300px minmax(0,1fr) 280px;gap:14px;align-items:start}

/* Report list (left) */
.rlist{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rl-h{padding:14px 16px 10px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.rl-h h3{font-family:var(--fd);font-size:13px;font-weight:700}
.rl-h .cnt{font-size:11px;color:var(--t3);font-family:var(--fd);font-weight:600}
.rl-body{max-height:720px;overflow-y:auto}
.rl-body::-webkit-scrollbar{width:4px}
.rl-body::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.rcard{padding:12px 14px;border-bottom:1px solid var(--s3);cursor:pointer;transition:all var(--df);border-left:3px solid transparent}
.rcard:hover{background:var(--sh)}
.rcard.on{background:var(--ac-s);border-left-color:var(--ac)}
.rcard.on .rcard-wk{color:var(--ac-t)}
.rcard-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px}
.rcard-wk{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--t1);letter-spacing:-.01em}
.rcard-teaser{font-size:12px;color:var(--t2);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rcard-foot{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--t3);font-family:var(--fd)}

/* Editor (center) */
.ed{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ed-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ed-h-title{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.ed-h h3{font-family:var(--fd);font-size:18px;font-weight:720;letter-spacing:-.02em}
.ed-h .sub{font-size:12px;color:var(--t3);font-family:var(--fd)}
.ed-h-acts{display:flex;gap:6px;flex-shrink:0}
.ed-body{padding:18px 22px 22px}

/* Section card (in editor) */
.sec{border:1px solid var(--s3);border-radius:var(--r-l);margin-bottom:12px;overflow:hidden;background:var(--si)}
.sec.summary{border-color:var(--ac-m);background:var(--ac-s)}
.rw.dk .sec.summary{background:var(--s2)}
.sec-h{padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--s1);border-bottom:1px solid var(--s3)}
.sec.summary .sec-h{background:transparent;border-bottom-color:var(--ac-m)}
.sec-h-left{display:flex;align-items:center;gap:10px}
.sec-h h4{font-family:var(--fd);font-size:13px;font-weight:700;letter-spacing:-.01em}
.sec-h .kind{font-size:11px;font-weight:650;color:var(--t3);font-family:var(--fd);text-transform:uppercase;letter-spacing:.05em}
.sec-h-acts{display:flex;gap:4px;align-items:center}
.sec-body{padding:14px 16px}
.sec-body p{font-size:13px;color:var(--t1);line-height:1.6}
.sec-body .auto-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--ac-t);font-family:var(--fd);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.sum-ta{width:100%;min-height:80px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;background:var(--s1);color:var(--t1);font-size:13px;line-height:1.55;resize:vertical;outline:none;transition:border-color var(--df)}
.sum-ta:focus{border-color:var(--ac);box-shadow:var(--shri)}

/* Daily logs */
.dlog{display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed var(--s3);font-size:12px}
.dlog:last-child{border-bottom:none}
.dlog-day{font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t3);width:68px;flex-shrink:0;padding-top:1px}
.dlog-body{flex:1;min-width:0}
.dlog-author{font-family:var(--fd);font-size:11px;font-weight:650;color:var(--t2);margin-bottom:2px}
.dlog-sum{color:var(--t1);line-height:1.5}

/* Photo grid */
.photos{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.photo{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;position:relative;cursor:pointer;transition:transform var(--df)}
.photo:hover{transform:scale(1.02)}
.photo-img{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.9);background-size:cover;background-position:center}
.photo-cap{position:absolute;bottom:0;left:0;right:0;padding:8px 10px 8px;font-size:10px;font-family:var(--fd);font-weight:600;color:white;background:linear-gradient(transparent,rgba(0,0,0,.7))}

/* Milestone/RFI/CO rows */
.mrow{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--s3);gap:10px}
.mrow:last-child{border-bottom:none}
.mrow-left{min-width:0;flex:1}
.mrow-title{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t1);margin-bottom:2px}
.mrow-mono{font-family:var(--fm);font-size:10px;color:var(--t3);margin-right:6px}
.mrow-detail{font-size:11px;color:var(--t2)}

/* Editor footer — send strip */
.ed-foot{padding:16px 22px;background:var(--s2);border-top:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;gap:12px}
.ed-foot-meta{font-size:12px;color:var(--t2);line-height:1.4}
.ed-foot-meta strong{font-family:var(--fd);font-weight:700;color:var(--t1)}
.ed-foot-acts{display:flex;gap:6px;flex-shrink:0}

/* Right rail */
.rail{display:flex;flex-direction:column;gap:12px}
.rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rc.strong{border-color:var(--ac-m)}
.rc-h{padding:14px 16px 10px;border-bottom:1px solid var(--s3)}
.rc-h h3{font-family:var(--fd);font-size:13px;font-weight:700}
.rc-h .sub{font-size:11px;color:var(--t3);margin-top:2px}
.rc-b{padding:12px 16px}
.fr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;gap:8px;border-bottom:1px dashed var(--s3)}
.fr:last-child{border-bottom:none}
.fr h5{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t1);margin-bottom:2px}
.fr p{font-size:11px;color:var(--t2);line-height:1.4}

/* ── Commercial client view ────────────────────────── */
.cc-grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;align-items:start}
.cc-timeline{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.cc-th{padding:14px 16px 10px;border-bottom:1px solid var(--s3);font-family:var(--fd);font-size:12px;font-weight:700;color:var(--t1)}
.cc-item{padding:12px 16px;border-bottom:1px solid var(--s3);cursor:pointer;transition:background var(--df)}
.cc-item:last-child{border-bottom:none}
.cc-item:hover{background:var(--sh)}
.cc-item.on{background:var(--ac-s)}
.cc-item.on .cc-wk{color:var(--ac-t)}
.cc-wk{font-family:var(--fd);font-size:12px;font-weight:700;margin-bottom:3px}
.cc-st{font-size:11px;color:var(--t3)}

.doc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.doc-h{padding:22px 26px 18px;border-bottom:1px solid var(--s3)}
.doc-h .kicker{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--ac-t);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.doc-h h2{font-family:var(--fd);font-size:22px;font-weight:720;letter-spacing:-.03em;margin-bottom:4px}
.doc-h .meta{font-size:12px;color:var(--t3);font-family:var(--fd)}
.doc-body{padding:22px 26px 26px}
.doc-sec{margin-bottom:22px}
.doc-sec h3{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:10px;letter-spacing:-.01em;padding-bottom:8px;border-bottom:2px solid var(--s3)}
.doc-sec p{font-size:13px;color:var(--t1);line-height:1.65}
.doc-foot{padding:16px 26px;background:var(--s2);border-top:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.doc-foot-meta{font-size:12px;color:var(--t2)}

/* ── Residential warmer view ───────────────────────── */
.rhero{background:linear-gradient(135deg,var(--warm-s),var(--s1));border:1px solid var(--warm-m);border-radius:var(--r-xl);padding:28px 30px;box-shadow:var(--shsm);margin-bottom:18px;position:relative;overflow:hidden}
.rhero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle at 85% 20%,rgba(168,107,47,.12),transparent 50%);pointer-events:none}
.rhero-kicker{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--warm-t);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;position:relative}
.rhero h1{font-family:var(--fd);font-size:30px;font-weight:720;letter-spacing:-.035em;line-height:1.1;margin-bottom:10px;position:relative;max-width:620px}
.rhero p{font-size:14px;color:var(--t2);max-width:560px;line-height:1.6;position:relative}
.rhero-meta{margin-top:14px;display:flex;gap:16px;align-items:center;font-size:12px;color:var(--t3);font-family:var(--fd);position:relative}

.res-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.res-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px 22px;box-shadow:var(--shsm)}
.res-card.wide{grid-column:span 2}
.res-card.warm{border-color:var(--warm-m);background:linear-gradient(to bottom right,var(--s1) 40%,var(--warm-s))}
.res-card h3{font-family:var(--fd);font-size:15px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}
.res-card .kicker{font-size:11px;color:var(--warm-t);font-family:var(--fd);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
.res-card p{font-size:13px;color:var(--t1);line-height:1.65}

.res-prog{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.res-prog-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--si);border-radius:var(--r-m);border:1px solid var(--s3)}
.res-prog-lbl{font-family:var(--fd);font-size:13px;font-weight:650}

.res-photos{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}

.res-dec{padding:14px 0;border-bottom:1px dashed var(--s3)}
.res-dec:last-child{border-bottom:none;padding-bottom:0}
.res-dec h4{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:4px}
.res-dec p{font-size:12px;color:var(--t2);line-height:1.55}

.res-list{list-style:none;padding:0;margin-top:10px}
.res-list li{padding:8px 0;font-size:13px;color:var(--t1);display:flex;gap:10px;align-items:center;border-bottom:1px dashed var(--s3)}
.res-list li:last-child{border-bottom:none}
.res-list .bullet{width:6px;height:6px;border-radius:50%;background:var(--warm-t);flex-shrink:0}

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
            <div className="brand-ctx">{projectLabel}</div>
          </div>
        </div>
        <div className="sb-srch">
          <input placeholder={isResi ? "Search your home…" : "Search…"}/>
        </div>
        <nav className="s-nav">
          {nav.map((section) => (
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
            <span>{portalLabel}</span><span className="sep">›</span>
            <span>{projectLabel}</span><span className="sep">›</span>
            <span className="cur">{pageLabel}</span>
          </div>
          <div className="tb-acts">
            <div className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</div>
            <div className="ib">{I.bell}</div>
            <div className="av">{userInit}</div>
          </div>
        </div>

        <div className="ct">
          {/* Portal switcher */}
          <div className="psw">
            <button className={portal === "contractor" ? "on" : ""} onClick={() => setPortal("contractor")}>
              <span className="p-dot" style={{ background: "#5b4fc7" }}/> Contractor
            </button>
            <button className={portal === "commercial" ? "on" : ""} onClick={() => setPortal("commercial")}>
              <span className="p-dot" style={{ background: "#3d6b8e" }}/> Commercial client
            </button>
            <button className={portal === "residential" ? "on" : ""} onClick={() => setPortal("residential")}>
              <span className="p-dot" style={{ background: "#a86b2f" }}/> Residential client
            </button>
          </div>

          {/* ═══════════════════ CONTRACTOR VIEW ═══════════════════ */}
          {portal === "contractor" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Weekly Reports</h2>
                  <p>Auto-generated Monday mornings from the prior week's daily logs, photos, milestones, RFIs, change orders, and issues. Review the draft, edit sections, send to the client.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn sm">{I.refresh} Generate off-cycle</button>
                  <button className="btn sm">{I.download} Export PDF</button>
                </div>
              </div>

              <div className="ss">
                <div className="sc strong">
                  <div className="sc-label">This week's draft</div>
                  <div className="sc-value">1</div>
                  <div className="sc-meta">Auto-generated Mon 6:02am</div>
                </div>
                <div className="sc">
                  <div className="sc-label">Sent this quarter</div>
                  <div className="sc-value">11</div>
                  <div className="sc-meta">Avg send time: Mon 9:30am</div>
                </div>
                <div className="sc">
                  <div className="sc-label">Total this project</div>
                  <div className="sc-value">14</div>
                  <div className="sc-meta">Since project start, Jan 8</div>
                </div>
                <div className="sc alert">
                  <div className="sc-label">Avg client open rate</div>
                  <div className="sc-value">92%</div>
                  <div className="sc-meta">Sent → opened within 48h</div>
                </div>
              </div>

              <div className="wr-grid">
                {/* ── Report list ── */}
                <div className="rlist">
                  <div className="rl-h">
                    <h3>All reports</h3>
                    <span className="cnt">{contractorReports.length}</span>
                  </div>
                  <div className="rl-body">
                    {contractorReports.map((r) => (
                      <div
                        key={r.id}
                        className={`rcard${activeReport === r.id ? " on" : ""}`}
                        onClick={() => setActiveReport(r.id)}
                      >
                        <div className="rcard-top">
                          <div className="rcard-wk">{r.weekLabel}</div>
                          <span className={`pl ${r.statusType}`}>{r.status}</span>
                        </div>
                        <div className="rcard-teaser">{r.teaser}</div>
                        <div className="rcard-foot">
                          <span>{r.sectionCount} sections</span>
                          <span>{r.generated}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Editor ── */}
                <div className="ed">
                  <div className="ed-h">
                    <div>
                      <div className="ed-h-title">
                        <h3>Week of Apr 12 – Apr 18</h3>
                        <span className="pl orange">Auto-draft</span>
                      </div>
                      <div className="sub">Generated Mon Apr 19, 6:02am · Not yet sent</div>
                    </div>
                    <div className="ed-h-acts">
                      <button className="btn sm">{I.eye} Preview</button>
                      <button className="btn sm" onClick={() => setEditing(!editing)}>
                        {I.pencil} {editing ? "Done editing" : "Edit"}
                      </button>
                    </div>
                  </div>

                  <div className="ed-body">
                    {/* Summary section — always editable, specially styled */}
                    <div className="sec summary">
                      <div className="sec-h">
                        <div className="sec-h-left">
                          <h4>Week summary</h4>
                          <span className="kind">Narrative · Editable</span>
                        </div>
                      </div>
                      <div className="sec-body">
                        <div className="auto-tag">{I.refresh} Auto-drafted from activity</div>
                        <textarea
                          className="sum-ta"
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Daily logs */}
                    <div className="sec">
                      <div className="sec-h">
                        <div className="sec-h-left">
                          <h4>Daily logs</h4>
                          <span className="kind">{activeSections[1].count} · auto-pulled</span>
                        </div>
                        <div className="sec-h-acts">
                          <button className="btn sm ghost">{I.pencil}</button>
                        </div>
                      </div>
                      <div className="sec-body">
                        {activeSections[1].items.map((log) => (
                          <div key={log.day} className="dlog">
                            <div className="dlog-day">{log.day}</div>
                            <div className="dlog-body">
                              <div className="dlog-author">{log.author}</div>
                              <div className="dlog-sum">{log.summary}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Photos */}
                    <div className="sec">
                      <div className="sec-h">
                        <div className="sec-h-left">
                          <h4>Photos</h4>
                          <span className="kind">{activeSections[2].count} · tap to reorder</span>
                        </div>
                        <div className="sec-h-acts">
                          <button className="btn sm ghost">{I.plus} Add</button>
                        </div>
                      </div>
                      <div className="sec-body">
                        <div className="photos">
                          {activeSections[2].items.map((p) => (
                            <div key={p.caption} className="photo">
                              <div className="photo-img" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }}>
                                {I.image}
                              </div>
                              <div className="photo-cap">{p.caption}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="sec">
                      <div className="sec-h">
                        <div className="sec-h-left">
                          <h4>Milestones</h4>
                          <span className="kind">{activeSections[3].count}</span>
                        </div>
                      </div>
                      <div className="sec-body">
                        {activeSections[3].items.map((m) => (
                          <div key={m.label} className="mrow">
                            <div className="mrow-left">
                              <div className="mrow-title">{m.label}</div>
                              <div className="mrow-detail">{m.detail}</div>
                            </div>
                            <span className={`pl ${m.status === "closed" ? "green" : "blue"}`}>
                              {m.status === "closed" ? "Closed" : "Upcoming"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RFIs */}
                    <div className="sec">
                      <div className="sec-h">
                        <div className="sec-h-left">
                          <h4>RFIs & issues</h4>
                          <span className="kind">{activeSections[4].count}</span>
                        </div>
                      </div>
                      <div className="sec-body">
                        {activeSections[4].items.map((r) => (
                          <div key={r.id} className="mrow">
                            <div className="mrow-left">
                              <div className="mrow-title">
                                <span className="mrow-mono">{r.id}</span>{r.title}
                              </div>
                              <div className="mrow-detail">{r.note}</div>
                            </div>
                            <span className={`pl ${r.statusType}`}>{r.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Change orders */}
                    <div className="sec">
                      <div className="sec-h">
                        <div className="sec-h-left">
                          <h4>Change orders</h4>
                          <span className="kind">{activeSections[5].count}</span>
                        </div>
                      </div>
                      <div className="sec-body">
                        {activeSections[5].items.map((c) => (
                          <div key={c.id} className="mrow">
                            <div className="mrow-left">
                              <div className="mrow-title">
                                <span className="mrow-mono">{c.id}</span>{c.title} · <strong>{c.amount}</strong>
                              </div>
                              <div className="mrow-detail">{c.note}</div>
                            </div>
                            <span className={`pl ${c.statusType}`}>{c.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ed-foot">
                    <div className="ed-foot-meta">
                      Sending to: <strong>Laura Thorne (Owner Rep)</strong> · email on file<br/>
                      Email notification fires immediately · status flips to Sent
                    </div>
                    <div className="ed-foot-acts">
                      <button className="btn sm">Save draft</button>
                      <button className="btn sm pri">{I.send} Send to client</button>
                    </div>
                  </div>
                </div>

                {/* ── Right rail ── */}
                <div className="rail">
                  <div className="rc strong">
                    <div className="rc-h">
                      <h3>Auto-draft ready</h3>
                      <div className="sub">Sourced from this week's activity.</div>
                    </div>
                    <div className="rc-b">
                      <div className="fr">
                        <div><h5>Daily logs</h5><p>5 logs from Marcus Webb</p></div>
                        <span>{I.check}</span>
                      </div>
                      <div className="fr">
                        <div><h5>Photos</h5><p>12 pulled — top 4 surfaced</p></div>
                        <span>{I.check}</span>
                      </div>
                      <div className="fr">
                        <div><h5>Milestones</h5><p>2 closed, 1 upcoming</p></div>
                        <span>{I.check}</span>
                      </div>
                      <div className="fr">
                        <div><h5>RFIs</h5><p>3 opened, 2 closed</p></div>
                        <span>{I.check}</span>
                      </div>
                      <div className="fr">
                        <div><h5>Change orders</h5><p>1 submitted</p></div>
                        <span>{I.check}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rc">
                    <div className="rc-h">
                      <h3>Recent send activity</h3>
                    </div>
                    <div className="rc-b">
                      <div className="fr">
                        <div><h5>Week of Apr 5</h5><p>Opened by Laura · 11 min after send</p></div>
                      </div>
                      <div className="fr">
                        <div><h5>Week of Mar 29</h5><p>Opened by Laura · 38 min after send</p></div>
                      </div>
                      <div className="fr">
                        <div><h5>Week of Mar 22</h5><p>Opened by Laura · 4h after send</p></div>
                      </div>
                    </div>
                  </div>

                  <div className="rc">
                    <div className="rc-h">
                      <h3>Schedule</h3>
                      <div className="sub">Job default: Mon 6am site-local.</div>
                    </div>
                    <div className="rc-b">
                      <div className="fr">
                        <div><h5>Next auto-draft</h5><p>Mon Apr 26 at 6:00am</p></div>
                        <span className="pl accent">{I.clock}</span>
                      </div>
                      <div className="fr">
                        <div><h5>Off-cycle?</h5><p>Use "Generate off-cycle" at any time</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ COMMERCIAL CLIENT VIEW ═══════════════════ */}
          {portal === "commercial" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Weekly Reports</h2>
                  <p>Each Monday, the contractor sends a summary of the prior week on site. Reports include daily logs, photos, milestone status, and any open RFIs or change orders.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn sm">{I.download} Download PDF</button>
                </div>
              </div>

              <div className="ss s3">
                <div className="sc">
                  <div className="sc-label">Latest report</div>
                  <div className="sc-value" style={{ fontSize: 15 }}>Apr 12 – 18</div>
                  <div className="sc-meta">Sent today, 9:14am</div>
                </div>
                <div className="sc strong">
                  <div className="sc-label">Received</div>
                  <div className="sc-value">11</div>
                  <div className="sc-meta">Since project start</div>
                </div>
                <div className="sc">
                  <div className="sc-label">Unread</div>
                  <div className="sc-value">1</div>
                  <div className="sc-meta">This week's report</div>
                </div>
              </div>

              <div className="cc-grid">
                {/* Timeline */}
                <div className="cc-timeline">
                  <div className="cc-th">Reports timeline</div>
                  {contractorReports.filter(r => r.status === "Sent" || r.id === "wr-apr12").slice(0, 5).map((r, i) => (
                    <div key={r.id} className={`cc-item${i === 0 ? " on" : ""}`}>
                      <div className="cc-wk">{r.weekLabel}</div>
                      <div className="cc-st">
                        {i === 0 ? "New — sent today" : r.generated.replace("Sent ", "")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Read-only report */}
                <div className="doc">
                  <div className="doc-h">
                    <div className="kicker">Weekly Report</div>
                    <h2>{commercialReportHeader.weekLabel}</h2>
                    <div className="meta">
                      {commercialReportHeader.project}<br/>
                      {commercialReportHeader.statusNote}
                    </div>
                  </div>

                  <div className="doc-body">
                    <div className="doc-sec">
                      <h3>Summary</h3>
                      <p>{summaryDraft}</p>
                    </div>

                    <div className="doc-sec">
                      <h3>On site this week</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {activeSections[3].items.map((m) => (
                          <div key={m.label} className="mrow" style={{ borderBottom: "1px dashed var(--s3)", padding: "10px 0" }}>
                            <div className="mrow-left">
                              <div className="mrow-title">{m.label}</div>
                              <div className="mrow-detail">{m.detail}</div>
                            </div>
                            <span className={`pl ${m.status === "closed" ? "green" : "blue"}`}>
                              {m.status === "closed" ? "Closed" : "Upcoming"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="doc-sec">
                      <h3>Photos from site</h3>
                      <div className="photos">
                        {activeSections[2].items.map((p) => (
                          <div key={p.caption} className="photo">
                            <div className="photo-img" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }}>
                              {I.image}
                            </div>
                            <div className="photo-cap">{p.caption}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="doc-sec">
                      <h3>Open items & activity</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {activeSections[4].items.map((r) => (
                          <div key={r.id} className="mrow" style={{ borderBottom: "1px dashed var(--s3)", padding: "8px 0" }}>
                            <div className="mrow-left">
                              <div className="mrow-title">
                                <span className="mrow-mono">{r.id}</span>{r.title}
                              </div>
                              <div className="mrow-detail">{r.note}</div>
                            </div>
                            <span className={`pl ${r.statusType}`}>{r.status}</span>
                          </div>
                        ))}
                        {activeSections[5].items.map((c) => (
                          <div key={c.id} className="mrow" style={{ borderBottom: "1px dashed var(--s3)", padding: "8px 0" }}>
                            <div className="mrow-left">
                              <div className="mrow-title">
                                <span className="mrow-mono">{c.id}</span>{c.title} · <strong>{c.amount}</strong>
                              </div>
                              <div className="mrow-detail">{c.note}</div>
                            </div>
                            <span className={`pl ${c.statusType}`}>{c.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="doc-sec">
                      <h3>Coming next week</h3>
                      <p>MEP rough-in begins on level 4 Monday. Owner walk-through scheduled Tuesday afternoon. Cure checks on level 4 slab through Wednesday.</p>
                    </div>
                  </div>

                  <div className="doc-foot">
                    <div className="doc-foot-meta">Questions or comments? Reply in Messages.</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn sm">{I.download} PDF</button>
                      <button className="btn sm pri">Reply</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ RESIDENTIAL CLIENT VIEW ═══════════════════ */}
          {portal === "residential" && (
            <div className="fade-up">
              <div className="rhero">
                <div className="rhero-kicker">This week at your home · {residentialHeader.weekLabel}</div>
                <h1>Framing wrapped on the second floor, and your pantry window arrived.</h1>
                <p>Here's a warm hello from the team — {residentialSections[0].text}</p>
                <div className="rhero-meta">
                  <span>{residentialHeader.statusNote}</span>
                  <span>·</span>
                  <button className="btn sm">{I.download} Save as PDF</button>
                </div>
              </div>

              <div className="res-grid">
                <div className="res-card">
                  <div className="kicker">{residentialSections[1].title}</div>
                  <h3>Progress this week</h3>
                  <div className="res-prog">
                    {residentialSections[1].items.map((p) => (
                      <div key={p.label} className="res-prog-row">
                        <div className="res-prog-lbl">{p.label}</div>
                        <span className={`pl ${p.statusType}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="res-card warm">
                  <div className="kicker">{residentialSections[5].title}</div>
                  <h3>Anything for you to do?</h3>
                  <p>{residentialSections[5].text}</p>
                  <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
                    <button className="btn sm pri">Confirm Apr 24 at 10am</button>
                    <button className="btn sm">Reschedule</button>
                  </div>
                </div>

                <div className="res-card wide">
                  <div className="kicker">{residentialSections[2].title}</div>
                  <h3>A peek at the week</h3>
                  <div className="res-photos">
                    {residentialSections[2].items.map((p) => (
                      <div key={p.caption} className="photo">
                        <div className="photo-img" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }}>
                          {I.image}
                        </div>
                        <div className="photo-cap">{p.caption}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="res-card">
                  <div className="kicker">{residentialSections[3].title}</div>
                  <h3>What got decided</h3>
                  <div style={{ marginTop: 8 }}>
                    {residentialSections[3].items.map((d) => (
                      <div key={d.title} className="res-dec">
                        <h4>{d.title}</h4>
                        <p>{d.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="res-card">
                  <div className="kicker">{residentialSections[4].title}</div>
                  <h3>Coming up next week</h3>
                  <ul className="res-list">
                    {residentialSections[4].items.map((t) => (
                      <li key={t}><span className="bullet"/>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
