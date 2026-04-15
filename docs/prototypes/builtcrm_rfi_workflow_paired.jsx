import { useState, useEffect } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>,
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
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
    { label: "RFIs / Issues", active: true, badge: 9, bt: "danger" },
    { label: "Approvals", badge: 5, bt: "blue" },
    { label: "Change Orders", badge: 2, bt: "blue" },
    { label: "Billing / Draws" },
    { label: "Compliance", badge: 3, bt: "warn" },
    { label: "Upload Requests" },
    { label: "Documents" },
    { label: "Budget" },
    { label: "Schedule" },
    { label: "Team" },
  ]},
];

const subNav = [
  { section: "Your Projects", items: [{ label: "Today Board" }] },
  { section: "Riverside Tower Fit-Out", items: [
    { label: "Project Home" },
    { label: "RFIs / Issues", active: true, badge: 2, bt: "danger" },
    { label: "Upload Requests", badge: 1, bt: "blue" },
    { label: "Compliance", badge: 1, bt: "warn" },
    { label: "Documents" },
    { label: "Payments" },
    { label: "Schedule" },
    { label: "Messages" },
  ]},
];

// ── Contractor thread data ──────────────────────────────────────
const contractorThreads = [
  { id: "RFI-018", title: "Beam offset conflict", desc: "Structural clash needing design clarification. Blocking steel coordination.", status: "Blocked", statusType: "red", tags: ["Formal RFI", "Steel", "Apex Mechanical"], footer: ["4 days waiting", "Milestone affected"], hot: true, detail: "rfi18" },
  { id: "ISS-042", title: "Ceiling grid mismatch", desc: "Reflected ceiling plan vs site-installed condition.", status: "Needs response", statusType: "orange", tags: ["Issue", "Interiors", "BrightWorks Interior"], footer: ["1 day waiting", "No escalation"], detail: "iss42" },
  { id: "RFI-017", title: "Fire damper access clearance", desc: "Need confirmation on access panel dimensions for maintenance compliance.", status: "Answered", statusType: "accent", tags: ["Formal RFI", "Fire protection"], footer: ["Answered 2 days ago", "Review response"] },
  { id: "ISS-041", title: "Conduit path conflict — level 3", desc: "Electrical conduit clashing with HVAC ductwork at column grid E-4.", status: "Needs response", statusType: "orange", tags: ["Issue", "Electrical", "Apex Mechanical"], footer: ["2 days waiting", "May escalate"] },
  { id: "ISS-040", title: "Door hardware submittal note", desc: "Quick clarification on hardware spec sheet — resolved same day.", status: "Closed", statusType: "green", tags: ["Issue", "Resolved"], footer: ["Closed Apr 10", "No escalation needed"] },
];

const contractorTabs = ["All open (9)", "Formal RFIs (4)", "Issues (5)", "Closed"];

// ── Subcontractor thread data ───────────────────────────────────
const subThreads = [
  { id: "RFI-018", title: "Beam offset conflict", desc: "The contractor needs a field condition report, constraint explanation, and markup.", status: "Overdue", statusType: "red", tags: [{ label: "Formal RFI", danger: true }, { label: "Blocking work" }, { label: "Markup needed" }], footer: ["Due Apr 10 · overdue", "Formal answer expected"], hot: true },
  { id: "ISS-041", title: "Conduit path conflict — level 3", desc: "Quick coordination question about electrical conduit vs HVAC duct.", status: "Needs reply", statusType: "orange", tags: [{ label: "Issue" }, { label: "Quick answer OK" }], footer: ["Due Apr 14", "Lighter response"] },
];

const subTabs = ["Needs reply (2)", "All assigned (5)", "Closed (2)"];

// ── Component ───────────────────────────────────────────────────
export default function RFIWorkflowPaired() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [activeThread, setActiveThread] = useState("rfi18");
  const [contractorTab, setContractorTab] = useState(0);
  const [subTab, setSubTab] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const isSub = portal === "sub";
  const nav = isSub ? subNav : contractorNav;
  const portalLabel = isSub ? "Subcontractor Portal" : "Contractor Portal";
  const userInit = isSub ? "AM" : "DC";

  return (
    <div className={`rw ${dark ? "dk" : ""}${isSub ? " sub" : ""}`}>
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
/* Sub theme overrides */
.rw.sub{
  --ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;
  --shri:0 0 0 3px rgba(61,107,142,.15);
}
/* Dark mode */
.rw.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 8px 32px rgba(0,0,0,.35);
}
.rw.dk.sub{
  --ac:#5a9cc4;--ac-h:#4a8ab4;--ac-s:#142030;--ac-t:#7eb8dc;--ac-m:#2a4050;
  --shri:0 0 0 3px rgba(90,156,196,.2);
}
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
.pg-h h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em}
.pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:560px;line-height:1.5}
.pg-h-acts{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

/* Summary strip */
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.sc.alert{border-color:#f5d5a0}.rw.dk .sc.alert{border-color:#5a4420}
.sc.danger{border-color:#f5baba}.rw.dk .sc.danger{border-color:#5a2020}
.sc.strong{border-color:var(--ac-m)}
.sc-label{font-family:var(--fb);font-size:12px;font-weight:560;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

/* Buttons */
.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--df) var(--e);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.sm{height:32px;padding:0 12px;font-size:12px}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2);color:var(--t1)}
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.mt{height:20px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--s3);background:var(--s2);color:var(--t3);display:inline-flex;align-items:center;white-space:nowrap}
.mt.dg{background:var(--dg-s);border-color:#f5baba;color:var(--dg-t)}

/* ── Page grid ────────────────────────────────────── */
.pg-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}

/* Workspace card */
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:700}
.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}
.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}

/* Master-detail */
.md{display:grid;grid-template-columns:360px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}

/* Thread queue */
.q-tb{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
.q-sel{height:30px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:12px;color:var(--t2);outline:none;cursor:pointer}
.tl{display:flex;flex-direction:column;gap:6px;max-height:600px;overflow-y:auto}
.tl::-webkit-scrollbar{width:4px}.tl::-webkit-scrollbar-track{background:transparent}.tl::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.tc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e)}
.tc:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.tc.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.tc.hot{border-color:#f5baba}.tc.hot.on{border-color:var(--dg-t);box-shadow:0 0 0 3px rgba(201,59,59,.12)}
.tc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.tc-id{font-family:var(--fm);font-size:11px;color:var(--t3);font-weight:520}
.tc-title{font-family:var(--fd);font-size:13px;font-weight:700;margin-top:2px}
.tc-desc{font-size:12px;color:var(--t2);margin-top:2px;line-height:1.4}
.tc-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.tc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--t3)}

/* Detail pane */
.dp{min-height:500px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.dh-id{font-family:var(--fm);font-size:12px;color:var(--t3);margin-top:2px}
.dh-desc{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;max-width:480px}
.dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px;align-items:flex-start}

/* Detail grid */
.dg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}
.dg-i{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.dg-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}
.dg-i .m{font-size:12px;color:var(--t2);margin-top:2px}

/* Detail sections */
.ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
.ds-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
.ds-h h4{font-family:var(--fd);font-size:13px;font-weight:700}
.ds-acts{display:flex;gap:6px}
.ds-b{padding:14px 16px}
.ds-b p{font-size:13px;color:var(--t2);line-height:1.55}

/* Activity timeline */
.al{display:flex;flex-direction:column}
.ai{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
.ai:last-child{border-bottom:none}
.a-dot{width:8px;height:8px;border-radius:50%;background:var(--s4);margin-top:6px;flex-shrink:0}
.a-dot.action{background:var(--ac)}.a-dot.esc{background:var(--wr)}.a-dot.resp{background:var(--ok)}.a-dot.sys{background:var(--t3)}
.a-text{flex:1;font-size:13px;color:var(--t2)}
.a-text strong{color:var(--t1);font-weight:650}
.a-time{font-size:11px;color:var(--t3);flex-shrink:0;padding-top:2px}

/* File row */
.fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
.fr:last-child{border-bottom:none}
.fr h5{font-size:13px;font-weight:600}.fr p{font-size:12px;color:var(--t2);margin-top:1px}
.fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

/* Right rail */
.rail{display:flex;flex-direction:column;gap:12px}
.rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rc.alert{border-color:#f5d5a0}.rc.danger{border-color:#f5baba}
.rw.dk .rc.alert{border-color:#5a4420}.rw.dk .rc.danger{border-color:#5a2020}
.rc-h{padding:14px 16px 0}
.rc-h h3{font-family:var(--fd);font-size:14px;font-weight:700}
.rc-h .sub{font-size:12px;color:var(--t3);margin-top:2px}
.rc-b{padding:10px 16px 16px}

/* Response composer (sub) */
.resp-c{border:1px solid var(--s3);border-radius:var(--r-l);background:var(--s1);overflow:hidden;margin-top:16px}
.resp-top{padding:14px 16px;border-bottom:1px solid var(--s2);display:flex;justify-content:space-between;align-items:center}
.resp-top h4{font-family:var(--fd);font-size:14px;font-weight:700}
.resp-ta{width:100%;min-height:100px;border:none;padding:14px 16px;font-size:13px;color:var(--t1);resize:vertical;outline:none;background:transparent;line-height:1.55}
.resp-ta::placeholder{color:var(--t3)}
.resp-att{padding:10px 16px;border-top:1px solid var(--s2);display:flex;gap:8px;flex-wrap:wrap}
.att-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);font-size:12px;color:var(--t2);font-weight:560}
.resp-foot{padding:12px 16px;border-top:1px solid var(--s2);display:flex;justify-content:space-between;align-items:center}
.comp{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.comp-dot{width:8px;height:8px;border-radius:50%}
.comp-dot.done{background:var(--ok)}.comp-dot.pend{background:var(--s4)}
.comp-lbl{font-size:12px;color:var(--t2);margin-right:8px}

/* Create panel */
.cp{margin-top:16px}
.cp .ws{border-color:var(--ac-m)}
.cp-form{padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cp-form label{font-size:12px;font-weight:650;color:var(--t2);display:block;margin-bottom:4px}
.cp-form input,.cp-form select,.cp-form textarea{width:100%;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:13px;outline:none;background:var(--s1);color:var(--t1)}
.cp-form input,.cp-form select{height:38px}
.cp-form textarea{min-height:80px;padding:10px 12px;resize:vertical}

/* ── Responsive ───────────────────────────────────── */
@media(max-width:1200px){.pg-grid{grid-template-columns:1fr}.md{grid-template-columns:1fr}}
@media(max-width:900px){.rw{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}

@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">{portalLabel}</div>
          </div>
        </div>
        <div className="sb-srch"><input placeholder="Search…" /></div>
        <nav className="s-nav">
          {nav.map((sec) => (
            <div key={sec.section} style={{ marginBottom: 4 }}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map((it) => (
                <div key={it.label} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge != null && <span className={`ni-b ${it.bt}`}>{it.badge}</span>}
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
            <span>Riverside Tower Fit-Out</span><span className="sep">›</span>
            <span className="cur">RFIs / Issues</span>
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
            <button className={portal === "contractor" ? "on" : ""} onClick={() => { setPortal("contractor"); setActiveThread("rfi18"); }}>
              <span className="p-dot" style={{ background: "#5b4fc7" }} /> Contractor
            </button>
            <button className={portal === "sub" ? "on" : ""} onClick={() => { setPortal("sub"); setActiveThread("rfi18"); }}>
              <span className="p-dot" style={{ background: "#3d6b8e" }} /> Subcontractor
            </button>
          </div>

          {/* ═══════════════════ CONTRACTOR VIEW ═══════════════════ */}
          {portal === "contractor" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>RFIs / Issues</h2>
                  <p>Track coordination questions, formal RFIs, and field issues across trades. Triage lightweight issues and escalate when a response is blocking work.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn sm">Export log</button>
                  <button className="btn sm pri" onClick={() => setShowCreate(!showCreate)}>+ New RFI / Issue</button>
                </div>
              </div>

              <div className="ss">
                <div className="sc"><div className="sc-label">Open threads</div><div className="sc-value">9</div><div className="sc-meta">Across all trades</div></div>
                <div className="sc strong"><div className="sc-label">Awaiting response</div><div className="sc-value">3</div><div className="sc-meta">Pending sub replies</div></div>
                <div className="sc alert"><div className="sc-label">Formal RFIs</div><div className="sc-value">4</div><div className="sc-meta">Tracked as formal requests</div></div>
                <div className="sc danger"><div className="sc-label">Blocking work</div><div className="sc-value">1</div><div className="sc-meta">Affecting milestone delivery</div></div>
              </div>

              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head">
                    <div><h3>Thread workspace</h3><div className="sub">Queue-first triage with detail pane.</div></div>
                  </div>
                  <div className="ws-tabs">
                    {contractorTabs.map((t, i) => (
                      <button key={t} className={`wtab${contractorTab === i ? " on" : ""}`} onClick={() => setContractorTab(i)}>{t}</button>
                    ))}
                  </div>
                  <div className="md">
                    {/* Queue */}
                    <div>
                      <div className="q-tb">
                        <select className="q-sel">
                          <option>Sort: Highest impact</option>
                          <option>Sort: Oldest waiting</option>
                          <option>Sort: Newest</option>
                        </select>
                        <button className="btn sm ghost">Filters</button>
                      </div>
                      <div className="tl">
                        {contractorThreads.map((t) => (
                          <div
                            key={t.id}
                            className={`tc${t.detail === activeThread ? " on" : ""}${t.hot ? " hot" : ""}`}
                            onClick={() => t.detail && setActiveThread(t.detail)}
                          >
                            <div className="tc-top">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="tc-id">{t.id}</div>
                                <div className="tc-title">{t.title}</div>
                                <div className="tc-desc">{t.desc}</div>
                              </div>
                              <span className={`pl ${t.statusType}`}>{t.status}</span>
                            </div>
                            <div className="tc-tags">
                              {t.tags.map((tag) => <span className="mt" key={tag}>{tag}</span>)}
                            </div>
                            <div className="tc-foot">
                              <span>{t.footer[0]}</span><span>{t.footer[1]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detail pane */}
                    <div className="dp">
                      {activeThread === "rfi18" && <ContractorDetailRFI18 />}
                      {activeThread === "iss42" && <ContractorDetailISS42 />}
                    </div>
                  </div>
                </div>

                {/* Right rail */}
                <div className="rail">
                  <div className="rc danger">
                    <div className="rc-h"><h3>Blocking work</h3><div className="sub">Highest-priority thread.</div></div>
                    <div className="rc-b">
                      <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14 }}>RFI-018 beam offset</div>
                      <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>Missing response is holding the steel coordination milestone. 4 days waiting, 2 days overdue.</p>
                      <button className="btn sm pri" style={{ marginTop: 10, width: "100%" }}>Send escalation reminder</button>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Response summary</h3></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>Overdue</h5><p>1 thread past its due date</p></div><span className="pl red" style={{ fontSize: 10 }}>1</span></div>
                      <div className="fr"><div><h5>Due this week</h5><p>2 threads need responses by Friday</p></div><span className="pl orange" style={{ fontSize: 10 }}>2</span></div>
                      <div className="fr"><div><h5>Answered — needs review</h5><p>1 response ready for contractor review</p></div><span className="pl accent" style={{ fontSize: 10 }}>1</span></div>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Trade breakdown</h3></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>Apex Mechanical</h5><p>3 open threads (1 blocked)</p></div><span className="pl red" style={{ fontSize: 10 }}>3</span></div>
                      <div className="fr"><div><h5>BrightWorks Interior</h5><p>2 open threads</p></div><span className="pl orange" style={{ fontSize: 10 }}>2</span></div>
                      <div className="fr"><div><h5>Metro Fire Protection</h5><p>1 answered, pending review</p></div><span className="pl accent" style={{ fontSize: 10 }}>1</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Create panel */}
              {showCreate && (
                <div className="cp fade-up">
                  <div className="ws">
                    <div className="ws-head">
                      <div><h3>Create new RFI / Issue</h3><div className="sub">Start as a lightweight issue. Escalate to formal RFI if needed later.</div></div>
                      <button className="btn sm" onClick={() => setShowCreate(false)}>Cancel</button>
                    </div>
                    <div className="cp-form">
                      <div><label>Subject</label><input placeholder="Brief description of the issue" /></div>
                      <div><label>Assign to</label>
                        <select><option>Select trade / subcontractor</option><option>Apex Mechanical</option><option>BrightWorks Interior</option><option>Metro Fire Protection</option></select>
                      </div>
                      <div style={{ gridColumn: "span 2" }}><label>Description</label><textarea placeholder="Describe the coordination question, field condition, or clarification needed…" /></div>
                      <div><label>Due date</label><input type="date" /></div>
                      <div><label>Drawing / spec reference</label><input placeholder="e.g. S-201, A-304" /></div>
                      <div style={{ gridColumn: "span 2", display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 6 }}>
                        <button className="btn">Attach files</button>
                        <button className="btn pri">Create issue</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════ SUBCONTRACTOR VIEW ═══════════════════ */}
          {portal === "sub" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>RFIs / Issues</h2>
                  <p>Threads that need your response. Answer coordination questions and provide the information your contractor needs to keep work moving.</p>
                </div>
              </div>

              <div className="ss">
                <div className="sc danger"><div className="sc-label">Needs your reply</div><div className="sc-value">2</div><div className="sc-meta">Response expected from you</div></div>
                <div className="sc alert"><div className="sc-label">Formal RFIs</div><div className="sc-value">1</div><div className="sc-meta">Stronger response required</div></div>
                <div className="sc"><div className="sc-label">Issues</div><div className="sc-value">1</div><div className="sc-meta">Lighter coordination questions</div></div>
                <div className="sc"><div className="sc-label">Closed</div><div className="sc-value">2</div><div className="sc-meta">Resolved — no action needed</div></div>
              </div>

              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head">
                    <div><h3>Your response queue</h3><div className="sub">Threads assigned to your trade. Formal RFIs need more complete answers.</div></div>
                  </div>
                  <div className="ws-tabs">
                    {subTabs.map((t, i) => (
                      <button key={t} className={`wtab${subTab === i ? " on" : ""}`} onClick={() => setSubTab(i)}>{t}</button>
                    ))}
                  </div>
                  <div className="md">
                    {/* Sub queue */}
                    <div>
                      <div className="tl">
                        {subThreads.map((t, i) => (
                          <div key={t.id} className={`tc${i === 0 ? " on hot" : ""}`}>
                            <div className="tc-top">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="tc-id">{t.id}</div>
                                <div className="tc-title">{t.title}</div>
                                <div className="tc-desc">{t.desc}</div>
                              </div>
                              <span className={`pl ${t.statusType}`}>{t.status}</span>
                            </div>
                            <div className="tc-tags">
                              {t.tags.map((tag) => (
                                <span className={`mt${tag.danger ? " dg" : ""}`} key={tag.label}>{tag.label}</span>
                              ))}
                            </div>
                            <div className="tc-foot">
                              <span>{t.footer[0]}</span><span>{t.footer[1]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sub detail pane */}
                    <div className="dp">
                      <div className="dh">
                        <div>
                          <div className="dh-id">RFI-018</div>
                          <h3>Beam offset conflict</h3>
                          <div className="dh-desc">The GC needs confirmation of the actual field condition, any trade-specific constraint, and whether your team recommends a revised path or clearance approach.</div>
                        </div>
                        <div className="dh-pills">
                          <span className="pl red">Overdue</span>
                          <span className="pl accent">Formal RFI</span>
                        </div>
                      </div>

                      <div className="dg">
                        <div className="dg-i"><div className="k">What's needed</div><div className="v">Formal response</div><div className="m">Field report + markup + constraint explanation</div></div>
                        <div className="dg-i"><div className="k">Asked by</div><div className="v">Daniel Chen (GC)</div><div className="m">Coordination lead</div></div>
                        <div className="dg-i"><div className="k">What's affected</div><div className="v">Steel coordination milestone</div><div className="m">Blocking layout release</div></div>
                        <div className="dg-i"><div className="k">Response due</div><div className="v" style={{ color: "var(--dg-t)" }}>Apr 10 (overdue)</div><div className="m">This is urgent</div></div>
                      </div>

                      <div className="ds">
                        <div className="ds-h"><h4>What the contractor is asking</h4></div>
                        <div className="ds-b">
                          <p>The field team found a beam offset that doesn't match drawing S-201. The GC needs you to confirm the as-built condition, explain any trade constraint that caused the offset, and provide a markup showing the recommended resolution path. This is a formal RFI — a quick text-only reply won't be sufficient.</p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                            <span className="mt">Field condition report needed</span>
                            <span className="mt">Drawing markup needed</span>
                            <span className="mt">Trade constraint explanation</span>
                          </div>
                        </div>
                      </div>

                      <div className="ds">
                        <div className="ds-h"><h4>Reference files from contractor</h4></div>
                        <div className="ds-b">
                          <div className="fr"><div><h5>S-201 — Structural coordination plan</h5><p>Current revision showing expected beam layout</p></div><span className="fc">DWG</span></div>
                          <div className="fr"><div><h5>Field photo — beam offset</h5><p>Photo showing as-built vs drawing discrepancy</p></div><span className="fc">JPG</span></div>
                        </div>
                      </div>

                      {/* Response composer */}
                      <div className="resp-c">
                        <div className="resp-top">
                          <h4>Your response</h4>
                          <span className="pl accent">Draft</span>
                        </div>
                        <textarea className="resp-ta" defaultValue="The beam offset at grid line E-4 on level 3 was caused by a duct routing conflict that required the beam to shift 4&quot; east of the drawn location. Our team recommends a revised clearance path using a 12&quot; offset bracket at the connection point. See attached markup for the proposed resolution." />
                        <div className="resp-att">
                          <div className="att-chip">{I.file} beam_offset_markup_rev1.pdf</div>
                          <button className="btn sm ghost">+ Attach file</button>
                        </div>
                        <div className="resp-foot">
                          <div className="comp">
                            <div className="comp-dot done" /><span className="comp-lbl">Written response</span>
                            <div className="comp-dot done" /><span className="comp-lbl">Markup attached</span>
                            <div className="comp-dot done" /><span className="comp-lbl">Constraint explained</span>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn sm">Save draft</button>
                            <button className="btn sm pri">Submit response</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub right rail */}
                <div className="rail">
                  <div className="rc danger">
                    <div className="rc-h"><h3>Response pressure</h3><div className="sub">What needs your reply most.</div></div>
                    <div className="rc-b">
                      <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14 }}>RFI-018 is overdue</div>
                      <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>This formal RFI is blocking the steel coordination milestone. The GC has sent a reminder and the thread has been flagged as at-risk.</p>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Response quality</h3><div className="sub">What makes a usable reply.</div></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>Formal RFI</h5><p>Needs markup, field condition description, and recommended path</p></div></div>
                      <div className="fr"><div><h5>Issue</h5><p>Quick written answer is usually sufficient, markup optional</p></div></div>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Your response stats</h3></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>Avg response time</h5><p>Across your last 10 threads</p></div><span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14 }}>1.8 days</span></div>
                      <div className="fr"><div><h5>First-reply resolution</h5><p>Threads closed after your first response</p></div><span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14 }}>72%</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Contractor Detail: RFI-018 ──────────────────────────────────
function ContractorDetailRFI18() {
  return (
    <>
      <div className="dh">
        <div>
          <div className="dh-id">RFI-018</div>
          <h3>Beam offset conflict</h3>
          <div className="dh-desc">Field team identified a beam offset that doesn't match the latest coordination drawing. Elevated to formal RFI because the answer affects layout sequencing and trade coordination.</div>
        </div>
        <div className="dh-pills">
          <span className="pl red">Blocked</span>
          <span className="pl accent">Formal RFI</span>
        </div>
      </div>
      <div className="dg">
        <div className="dg-i"><div className="k">Status</div><div className="v">Pending response</div><div className="m">Waiting on Apex Mechanical</div></div>
        <div className="dg-i"><div className="k">Assigned to</div><div className="v">Apex Mechanical</div><div className="m">Structural steel trade</div></div>
        <div className="dg-i"><div className="k">Due date</div><div className="v" style={{ color: "var(--dg-t)" }}>Apr 10 (overdue)</div><div className="m">2 days past deadline</div></div>
        <div className="dg-i"><div className="k">Blocking</div><div className="v">Steel coordination milestone</div><div className="m">Layout release cannot proceed</div></div>
      </div>
      <div className="ds">
        <div className="ds-h">
          <h4>Escalation context</h4>
          <div className="ds-acts"><button className="btn sm">Send reminder</button><button className="btn sm pri">Add clarification</button></div>
        </div>
        <div className="ds-b">
          <p>This started as an operational issue (ISS-036) but was escalated to a formal RFI after the response stalled for 48 hours and the blocking condition was confirmed. The sub needs to provide a field condition report, trade constraint description, and markup of the proposed resolution path.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <span className="mt dg">Milestone blocked</span>
            <span className="mt">Drawing markup needed</span>
            <span className="mt">Trade constraint explanation needed</span>
            <span className="mt">Field condition report needed</span>
          </div>
        </div>
      </div>
      <div className="ds">
        <div className="ds-h"><h4>Linked references</h4><div className="ds-acts"><button className="btn sm">Link drawing</button></div></div>
        <div className="ds-b">
          <div className="fr"><div><h5>S-201 — Structural coordination plan</h5><p>Current revision showing beam layout at level 3</p></div><span className="fc">DWG</span></div>
          <div className="fr"><div><h5>Field photo — beam offset condition</h5><p>Photo taken Apr 7 showing as-built vs drawing discrepancy</p></div><span className="fc">JPG</span></div>
        </div>
      </div>
      <div className="ds">
        <div className="ds-h"><h4>Thread activity</h4></div>
        <div className="ds-b">
          <div className="al">
            <div className="ai"><div className="a-dot esc" /><div className="a-text"><strong>Daniel Chen</strong> escalated ISS-036 to formal RFI-018</div><div className="a-time">Apr 8</div></div>
            <div className="ai"><div className="a-dot action" /><div className="a-text"><strong>Daniel Chen</strong> linked drawing S-201 and field photo</div><div className="a-time">Apr 8</div></div>
            <div className="ai"><div className="a-dot sys" /><div className="a-text">Reminder sent to <strong>Apex Mechanical</strong> — response overdue</div><div className="a-time">Apr 10</div></div>
            <div className="ai"><div className="a-dot sys" /><div className="a-text">Automated flag: milestone <strong>Steel Coordination</strong> now at risk</div><div className="a-time">Apr 11</div></div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Contractor Detail: ISS-042 ──────────────────────────────────
function ContractorDetailISS42() {
  return (
    <>
      <div className="dh">
        <div>
          <div className="dh-id">ISS-042</div>
          <h3>Ceiling grid mismatch</h3>
          <div className="dh-desc">Reflected ceiling plan doesn't match the site-installed grid condition. Likely resolvable with a quick drawing markup and one reply.</div>
        </div>
        <div className="dh-pills">
          <span className="pl orange">Needs response</span>
          <span className="pl">Issue</span>
        </div>
      </div>
      <div className="dg">
        <div className="dg-i"><div className="k">Status</div><div className="v">Waiting on response</div><div className="m">BrightWorks Interior assigned</div></div>
        <div className="dg-i"><div className="k">Assigned to</div><div className="v">BrightWorks Interior</div><div className="m">Interior finishing trade</div></div>
        <div className="dg-i"><div className="k">Due date</div><div className="v">Apr 14</div><div className="m">2 days remaining</div></div>
        <div className="dg-i"><div className="k">Impact</div><div className="v">No milestone blocked yet</div><div className="m">Could escalate if unresolved</div></div>
      </div>
      <div className="ds">
        <div className="ds-h">
          <h4>Triage decision</h4>
          <div className="ds-acts"><button className="btn sm dg-o">Escalate to RFI</button><button className="btn sm">Send reminder</button></div>
        </div>
        <div className="ds-b">
          <p>This is still a lightweight coordination issue. The sub should be able to resolve it with a drawing markup and written confirmation. If the response stalls past the due date or starts affecting adjacent work, escalate it to a formal RFI.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <span className="mt">Quick resolution expected</span>
            <span className="mt">Drawing markup helpful</span>
            <span className="mt">No downstream block yet</span>
          </div>
        </div>
      </div>
      <div className="ds">
        <div className="ds-h"><h4>Thread activity</h4></div>
        <div className="ds-b">
          <div className="al">
            <div className="ai"><div className="a-dot action" /><div className="a-text"><strong>Daniel Chen</strong> opened issue and assigned to BrightWorks Interior</div><div className="a-time">Apr 11</div></div>
            <div className="ai"><div className="a-dot sys" /><div className="a-text">Due date set to <strong>Apr 14</strong></div><div className="a-time">Apr 11</div></div>
          </div>
        </div>
      </div>
    </>
  );
}
