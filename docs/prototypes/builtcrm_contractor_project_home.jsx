import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  plus: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  upload: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>,
  download: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>,
};

// ── Logo Mark ───────────────────────────────────────────────────
const Logo = ({ s = 32 }) => (
  <div style={{ width: s, height: s, borderRadius: s * 0.3, background: "linear-gradient(135deg,#2c2541,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.65} height={s * 0.65}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Nav Data ────────────────────────────────────────────────────
const workspaceNav = [
  { label: "Dashboard" },
  { label: "Project Directory", badge: 24 },
  { label: "Messages", badge: 5 },
  { label: "Notifications", badge: 3, badgeType: "warn" },
];
const projects = [
  { name: "Riverside Tower Fit-Out", color: "var(--ac)", active: true },
  { name: "West End Medical", color: "var(--ok)" },
  { name: "Lot 7 Redevelopment", color: "var(--wr)" },
];
const opsNav = [
  { label: "Project Home", active: true, tag: "Live" },
  { label: "RFIs", badge: 6 },
  { label: "Change Orders", badge: 3, badgeType: "warn" },
  { label: "Approvals", badge: 4, badgeType: "danger" },
  { label: "Compliance", badge: 2 },
  { label: "Selections" },
  { label: "Upload Requests", badge: 1 },
];
const resourceNav = [
  { label: "Documents", badge: 12 },
  { label: "Schedule" },
  { label: "Financials" },
  { label: "Billing / Draws" },
];
const adminNav = [{ label: "Team" }, { label: "Settings" }];

// ── Summary Cards ───────────────────────────────────────────────
const summaryCards = [
  { label: "Current phase", value: "Phase 3", meta: "Interior rough-in", type: "" },
  { label: "Approvals waiting", value: "4", meta: "1 overdue · 1 blocked", type: "accent" },
  { label: "Open RFIs", value: "6", meta: "2 need subcontractor response", type: "warn" },
  { label: "Compliance", value: "92%", meta: "2 items expiring this month", type: "success" },
  { label: "Billing progress", value: "$1.24M", meta: "of $3.8M contract · Draw #4 pending", type: "" },
];

// ── Workspace Tab Data ──────────────────────────────────────────
const wsTabs = [
  { id: "today", label: "Today" },
  { id: "rfis", label: "RFIs", badge: 6 },
  { id: "cos", label: "Change Orders", badge: 3, badgeType: "warn" },
  { id: "approvals", label: "Approvals", badge: 4, badgeType: "danger" },
  { id: "compliance", label: "Compliance" },
  { id: "selections", label: "Selections" },
  { id: "documents", label: "Documents" },
  { id: "billing", label: "Billing" },
  { id: "schedule", label: "Schedule" },
];

const priorities = [
  { title: "Resolve CO-14 owner approval block", desc: "Mechanical reroute still waiting on client signoff — affecting procurement timing.", pill: "Urgent", pillType: "red", time: "3 days", hot: true },
  { title: "Review Northline electrical submittal", desc: "Revised package needs PM review before internal release.", pill: "Review", pillType: "blue", time: "Today" },
  { title: "Respond to RFI-22 (HVAC routing)", desc: "Mechanical sub waiting on contractor clarification for zone 3 ductwork.", pill: "RFI", pillType: "purple", time: "1 day" },
  { title: "Review compliance submission from Apex Elec.", desc: "Updated COI and W-9 uploaded — needs verification before next draw.", pill: "Compliance", pillType: "green", time: "New" },
];

const movements = [
  { title: "Selection packet sent to client", desc: "Lighting and flooring options now live in the client portal.", time: "44 min ago" },
  { title: "Draw #3 approved by client", desc: "$312K released — retainage $28K held. Payment processing started.", time: "2 hrs ago" },
  { title: "Electrical rough-in zone closed", desc: "Trade lead confirmed completion for east corridor package.", time: "3 hrs ago" },
  { title: "Upload request completed by M&R Plumbing", desc: "Closeout photos for zones 1–3 accepted and filed.", time: "Yesterday" },
];

const approvalsWaiting = [
  { title: "CO-14 owner signoff", desc: "Mechanical reroute package · +$18,400", pill: "Blocked", pillType: "red", hot: true },
  { title: "Lighting package review", desc: "Commercial client decision pending for meeting rooms.", pill: "Open", pillType: "orange" },
  { title: "Electrical PO revision", desc: "Internal PM release needed before updated order.", pill: "Internal", pillType: "blue" },
];

const risks = [
  { title: "Client decision dependency", desc: "CO-14 signoff is the primary blocker affecting procurement timing.", pill: "Critical", pillType: "red", hot: true },
  { title: "Upcoming milestone pressure", desc: "Electrical signoff depends on closing two open field items.", pill: "Watch", pillType: "orange" },
  { title: "Compliance gap risk", desc: "Apex Electrical COI expires in 12 days — renewal uploaded, needs review.", pill: "Expiring", pillType: "orange" },
];

const blockers = [
  { title: "CO-14 owner approval", desc: "Mechanical reroute — 3 days outstanding", hot: true },
  { title: "Field coordination gap", desc: "Mech + elec routing needs final reviewed decision" },
];

const milestones = [
  { day: "16", month: "Apr", title: "Electrical signoff", desc: "Depends on field coordination closeout", countdown: "4 days", soon: true },
  { day: "18", month: "Apr", title: "Selections lock-in", desc: "Client decision window closes", countdown: "6 days", soon: true },
  { day: "28", month: "Apr", title: "Draw #4 submission", desc: "Billing package assembly begins Apr 22", countdown: "16 days" },
];

const quickLinks = [
  { label: "Messages", count: "3 unread" },
  { label: "Documents", count: "12 new" },
  { label: "Schedule" },
  { label: "Financials", count: "$1.24M billed" },
  { label: "Upload Requests", count: "1 open" },
];

const contacts = [
  { initials: "DC", name: "David Cardona", role: "PM", color: "var(--ac)" },
  { initials: "MS", name: "Marco Silva", role: "Superintendent", color: "#3d6b8e" },
  { initials: "RG", name: "Rachel Gupta", role: "Client Approver", color: "var(--in)" },
  { initials: "JT", name: "James Torres", role: "Apex Electrical", color: "var(--wr)" },
];

const snapshots = [
  { label: "Current blocker", value: "CO-14 approval", meta: "Holding mechanical reroute release", type: "danger" },
  { label: "Next milestone", value: "Apr 16", meta: "Electrical signoff", type: "warn" },
  { label: "Decision queue", value: "2 open", meta: "Lighting package + CO-14" },
  { label: "Unread messages", value: "3 threads", meta: "1 linked to RFI-22" },
];

// ── Component ───────────────────────────────────────────────────
export default function ContractorProjectHome() {
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState("today");

  const NavItem = ({ label, badge, badgeType, active, tag }) => (
    <div className={`n-item${active ? " on" : ""}`}>
      <span>{label}</span>
      <div className="n-right">
        {badge && <span className={`n-badge${badgeType === "warn" ? " warn" : badgeType === "danger" ? " danger" : ""}`}>{badge}</span>}
        {tag && <span className="n-tag">{tag}</span>}
      </div>
    </div>
  );

  const ListRow = ({ title, desc, pill, pillType, time, hot }) => (
    <div className={`lr${hot ? " hot" : ""}`}>
      <div className="lr-main">
        <h5>{title}</h5>
        <p>{desc}</p>
      </div>
      <div className="lr-side">
        {pill && <span className={`pl ${pillType || ""}`}>{pill}</span>}
        {time && <span className="tm">{time}</span>}
      </div>
    </div>
  );

  return (
    <div className={`ph ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.ph{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
  --t1:#111318;--t2:#4a4f5c;--t3:#7d8290;--ti:#faf9f7;
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
  --shlg:0 10px 32px rgba(26,23,20,.08);--shri:0 0 0 3px rgba(91,79,199,.15);
  --sbw:272px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.ph.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#7b6ff0;--ac-h:#6e62e0;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#4a4578;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 10px 32px rgba(0,0,0,.35);--shri:0 0 0 3px rgba(123,111,240,.2);
}

/* ── SIDEBAR ────────────────────────────────── */
.sb{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.sb-brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.sb-brand h1{font-family:var(--fd);font-size:14px;font-weight:740;letter-spacing:-.02em;color:var(--t1)}
.sb-brand p{font-size:11px;color:var(--t3);margin-top:1px;font-weight:520}
.sb-search{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
.sb-si{width:100%;height:34px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px 0 34px;background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%237d8290' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:10px center}
.sb-si::placeholder{color:var(--t3)}
.sb-si:focus{border-color:var(--ac);box-shadow:var(--shri)}
.sb-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.sb-nav::-webkit-scrollbar{width:4px}.sb-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.n-sec{margin-bottom:4px}
.n-sec-label{font-family:var(--fd);font-size:11px;font-weight:720;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.n-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:540;transition:all var(--df) var(--e);margin-bottom:2px;cursor:default;position:relative}
.n-item:hover{background:var(--sh);color:var(--t1)}
.n-item.on{background:var(--ac-s);color:var(--ac-t);font-weight:680}
.n-item.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--ac)}
.n-right{display:flex;align-items:center;gap:6px;flex-shrink:0}
.n-badge{min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:11px;font-weight:720;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.n-badge.warn{background:var(--wr-s);color:var(--wr-t)}
.n-badge.danger{background:var(--dg-s);color:var(--dg-t)}
.n-tag{font-family:var(--fd);font-size:10px;font-weight:680;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;flex-shrink:0}
.n-proj{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:default;margin-bottom:2px;transition:all var(--df) var(--e)}
.n-proj:hover{background:var(--sh);color:var(--t1)}
.n-proj.on{background:var(--s1);color:var(--t1);font-weight:620;border:1px solid var(--s3)}
.n-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sb-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.sb-user{display:flex;align-items:center;gap:10px;padding:6px}
.sb-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:720;flex-shrink:0}
.sb-uname{font-family:var(--fd);font-size:13px;font-weight:640;color:var(--t1)}
.sb-urole{font-size:11px;color:var(--t3);margin-top:1px;font-weight:520}

/* ── TOPBAR ─────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:color-mix(in srgb,var(--s1) 88%,transparent);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;color:var(--t3);font-weight:540}
.bc .sep{color:var(--s4)}.bc .cur{color:var(--t1);font-weight:680}
.tb-actions{display:flex;align-items:center;gap:8px}
.ib{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;transition:all var(--df) var(--e);cursor:pointer}
.ib:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:720}
.notif{position:relative}.notif::after{content:'';position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:var(--dg);border:2px solid var(--s1)}

/* ── CONTENT ────────────────────────────────── */
.ct{padding:24px;flex:1}

/* HERO */
.hero{display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start;margin-bottom:20px}
.hero-main{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shmd);padding:20px 22px}
.hero-main h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);margin:0}
.hero-desc{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5;max-width:680px;font-weight:520}
.hero-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.pl{height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--s3);display:inline-flex;align-items:center;font-size:10px;font-weight:720;background:var(--s1);color:var(--t3);white-space:nowrap;font-family:var(--fd)}
.pl.purple{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:color-mix(in srgb,var(--wr) 25%,var(--s3))}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:color-mix(in srgb,var(--dg) 25%,var(--s3))}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:color-mix(in srgb,var(--ok) 25%,var(--s3))}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:color-mix(in srgb,var(--in) 25%,var(--s3))}
.meta-strip{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.meta-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:12px;color:var(--t2);font-weight:520}
.meta-chip strong{color:var(--t1);font-weight:660}
.hero-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.btn{height:36px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:13px;font-weight:640;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);color:var(--ti);border-color:var(--ac)}
.btn.pri:hover{background:var(--ac-h)}
.btn svg{width:15px;height:15px;flex-shrink:0}

/* HERO SIDE */
.hero-side{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shmd);padding:16px}
.hero-side h4{font-family:var(--fd);font-size:13px;font-weight:720;margin:0 0 12px;color:var(--t1)}
.snap-stack{display:flex;flex-direction:column;gap:10px}
.snap{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:10px 12px}
.snap .sk{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:720;font-family:var(--fd)}
.snap .sv{margin-top:3px;font-size:15px;font-weight:820;font-family:var(--fd);color:var(--t1);letter-spacing:-.02em}
.snap .sm{margin-top:3px;font-size:12px;color:var(--t2);font-weight:520}
.snap.warn{background:var(--wr-s);border-color:color-mix(in srgb,var(--wr) 20%,var(--s3))}
.snap.danger{background:var(--dg-s);border-color:color-mix(in srgb,var(--dg) 20%,var(--s3))}

/* CONTACTS */
.contacts{display:flex;align-items:center;gap:16px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:10px 16px;margin-bottom:14px}
.contacts-label{font-family:var(--fd);font-size:11px;font-weight:720;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;flex-shrink:0}
.contacts-list{display:flex;gap:16px;flex-wrap:wrap;flex:1;min-width:0}
.cc{display:flex;align-items:center;gap:8px}
.cc-av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:9px;font-weight:720;color:white;flex-shrink:0}
.cc-text{display:flex;align-items:baseline;gap:6px}
.cc-name{font-family:var(--fd);font-size:13px;font-weight:640;color:var(--t1);white-space:nowrap;letter-spacing:-.01em}
.cc-role{font-family:var(--fd);font-size:11px;color:var(--t3);white-space:nowrap;font-weight:620}

/* SUMMARY STRIP */
.sum-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
.sum-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;transition:border-color var(--df) var(--e)}
.sum-card:hover{border-color:var(--s4)}
.sum-card .sl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);font-weight:720;font-family:var(--fd)}
.sum-card .sv{font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
.sum-card .sm{font-size:12px;color:var(--t2);margin-top:3px;font-weight:520}
.sum-card.accent{background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%);border-color:var(--ac-m)}
.sum-card.accent .sv{color:var(--ac-t)}
.sum-card.warn{background:linear-gradient(180deg,var(--s1) 0%,var(--wr-s) 100%);border-color:color-mix(in srgb,var(--wr) 25%,var(--s3))}
.sum-card.warn .sv{color:var(--wr-t)}
.sum-card.danger{background:linear-gradient(180deg,var(--s1) 0%,var(--dg-s) 100%);border-color:color-mix(in srgb,var(--dg) 25%,var(--s3))}
.sum-card.danger .sv{color:var(--dg-t)}
.sum-card.success{background:linear-gradient(180deg,var(--s1) 0%,var(--ok-s) 100%);border-color:color-mix(in srgb,var(--ok) 25%,var(--s3))}
.sum-card.success .sv{color:var(--ok-t)}

/* PROJECT GRID */
.pg{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
.card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);min-width:0}
.ph-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px 0}
.ph-head h3{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0}
.ph-head .sub{font-size:12px;color:var(--t2);margin-top:4px;font-weight:520}
.ph-badge{height:26px;padding:0 10px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:11px;font-weight:720;font-family:var(--fd);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}

/* WORKSPACE TABS */
.ws-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:14px 20px 0;background:var(--s2);border-radius:var(--r-l);padding:4px}
.ws-tab{height:34px;padding:0 12px;border-radius:var(--r-m);font-size:12px;font-weight:640;color:var(--t2);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;font-family:var(--fb);background:none;border:none;cursor:pointer}
.ws-tab:hover{color:var(--t1);background:var(--sh)}
.ws-tab.on{background:var(--s1);color:var(--t1);font-weight:680;box-shadow:var(--shsm)}
.ws-tab .tb-b{min-width:16px;height:16px;padding:0 5px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:9px;font-weight:720;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd)}
.ws-tab .tb-b.warn{background:var(--wr-s);color:var(--wr-t)}
.ws-tab .tb-b.danger{background:var(--dg-s);color:var(--dg-t)}
.ws-note{padding:0 20px;margin-top:6px;font-size:12px;color:var(--t3);font-weight:520}
.ws-body{padding:16px 20px 20px}

/* MAIN 2-COL */
.ml{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;align-items:start}
.stk{display:flex;flex-direction:column;gap:14px}

/* SOFT BLOCKS */
.sb-blk{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px}
.sb-blk h4{font-family:var(--fd);font-size:13px;font-weight:720;margin:0 0 10px;color:var(--t1)}
.dom-blk{background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%);border-color:var(--ac-m)}
.dom-blk h4{font-size:14px;margin-bottom:12px;color:var(--ac-t)}
.alert-blk{background:linear-gradient(180deg,var(--s1) 0%,var(--wr-s) 100%);border-color:color-mix(in srgb,var(--wr) 25%,var(--s3))}
.alert-blk h4{color:var(--wr-t)}

/* LIST ROWS */
.lst{display:flex;flex-direction:column;gap:8px}
.lr{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;transition:border-color var(--df) var(--e)}
.lr:hover{border-color:var(--s4)}
.lr.hot{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3));background:color-mix(in srgb,var(--dg-s) 50%,var(--s1))}
.lr-main{min-width:0;flex:1}
.lr h5{font-family:var(--fd);font-size:13px;font-weight:680;margin:0 0 3px;color:var(--t1);letter-spacing:-.01em}
.lr p{font-size:12px;color:var(--t2);line-height:1.45;margin:0;font-weight:520}
.lr-side{display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0}
.tm{font-size:11px;color:var(--t3);font-family:var(--fd);font-weight:640}

/* RIGHT RAIL */
.rail{display:flex;flex-direction:column;gap:12px}
.rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rc-head{padding:14px 16px 0}
.rc-head h3{font-family:var(--fd);font-size:14px;font-weight:720;margin:0}
.rc-head .sub{font-size:11px;color:var(--t2);margin-top:3px;font-weight:520}
.rc-body{padding:12px 16px 16px}
.rc.rc-danger{background:linear-gradient(180deg,var(--s1) 0%,var(--dg-s) 100%);border-color:color-mix(in srgb,var(--dg) 20%,var(--s3))}

/* MILESTONES */
.ms-item{display:flex;align-items:center;gap:12px;padding:8px 0}
.ms-item+.ms-item{border-top:1px solid var(--s3)}
.ms-date{width:44px;text-align:center;flex-shrink:0}
.ms-day{font-family:var(--fd);font-size:16px;font-weight:780;color:var(--t1);letter-spacing:-.02em}
.ms-month{font-family:var(--fd);font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;font-weight:640}
.ms-info{flex:1;min-width:0}
.ms-info h5{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);margin:0 0 2px;letter-spacing:-.01em}
.ms-info p{font-size:11px;color:var(--t2);margin:0;font-weight:520}
.ms-cd{font-family:var(--fd);font-size:11px;font-weight:720;color:var(--t3);white-space:nowrap;flex-shrink:0}
.ms-cd.soon{color:var(--wr-t)}

/* MODULE LINKS */
.mod-links{display:flex;flex-direction:column;gap:6px}
.mod-link{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:13px;font-weight:580;color:var(--t1);transition:all var(--df) var(--e);cursor:default}
.mod-link:hover{border-color:var(--ac-m);background:var(--ac-s)}
.mod-link .ml-r{display:flex;align-items:center;gap:6px}
.mod-link .ml-c{font-family:var(--fd);font-size:12px;font-weight:720;color:var(--ac-t)}
.mod-link .ml-a{color:var(--t3);font-size:14px}

/* DARK MODE TOGGLE */
.dk-toggle{position:fixed;top:14px;right:14px;width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;z-index:100;transition:all var(--df) var(--e)}
.dk-toggle:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}

/* RESPONSIVE */
@media(max-width:1280px){
  .hero{grid-template-columns:1fr}.hero-side{display:none}
  .sum-strip{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:1100px){
  .pg{grid-template-columns:1fr}
  .ml{grid-template-columns:1fr}
}
@media(max-width:900px){
  .ph{grid-template-columns:1fr}
  .sb{display:none}
  .sum-strip{grid-template-columns:repeat(2,1fr)}
}
      `}</style>

      {/* Dark mode toggle */}
      <button className="dk-toggle" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}>
        {dark ? I.sun : I.moon}
      </button>

      {/* ── SIDEBAR ──────────────────────────── */}
      <aside className="sb">
        <div className="sb-brand">
          <Logo />
          <div><h1>BuiltCRM</h1><p>Contractor portal</p></div>
        </div>
        <div className="sb-search">
          <input className="sb-si" placeholder="Search projects, people, files…" />
        </div>
        <nav className="sb-nav">
          <div className="n-sec">
            <div className="n-sec-label">Workspace</div>
            {workspaceNav.map((n) => <NavItem key={n.label} {...n} />)}
          </div>
          <div className="n-sec">
            <div className="n-sec-label">Projects</div>
            {projects.map((p) => (
              <div key={p.name} className={`n-proj${p.active ? " on" : ""}`}>
                <span className="n-dot" style={{ background: p.color }} />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
          <div className="n-sec">
            <div className="n-sec-label">Operations</div>
            {opsNav.map((n) => <NavItem key={n.label} {...n} />)}
          </div>
          <div className="n-sec">
            <div className="n-sec-label">Resources</div>
            {resourceNav.map((n) => <NavItem key={n.label} {...n} />)}
          </div>
          <div className="n-sec">
            <div className="n-sec-label">Admin</div>
            {adminNav.map((n) => <NavItem key={n.label} {...n} />)}
          </div>
        </nav>
        <div className="sb-foot">
          <div className="sb-user">
            <div className="sb-av">DC</div>
            <div><div className="sb-uname">David Cardona</div><div className="sb-urole">Project Manager</div></div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>Contractor</span><span className="sep">›</span>
            <span>Riverside Tower Fit-Out</span><span className="sep">›</span>
            <span className="cur">Project Home</span>
          </div>
          <div className="tb-actions">
            <button className="ib notif" aria-label="Notifications">{I.bell}</button>
            <button className="ib" aria-label="Settings">{I.gear}</button>
            <div className="av">DC</div>
          </div>
        </div>

        <div className="ct">
          {/* ── HERO ─────────────────────── */}
          <section className="hero">
            <div className="hero-main">
              <h2>Riverside Tower Fit-Out</h2>
              <div className="hero-pills">
                <span className="pl purple">Active project</span>
                <span className="pl orange">4 items need action</span>
                <span className="pl red">1 blocker affecting release</span>
                <span className="pl green">Compliance current</span>
              </div>
              <p className="hero-desc">Live operating surface for this project — current priorities, blockers, approvals, movement, and quick-access to every workspace module.</p>
              <div className="meta-strip">
                <div className="meta-chip"><strong>Client:</strong> Riverside Commercial Group</div>
                <div className="meta-chip"><strong>PM:</strong> David Cardona</div>
                <div className="meta-chip"><strong>Target:</strong> Aug 30, 2026</div>
                <div className="meta-chip"><strong>Portals:</strong> Client + subcontractor live</div>
              </div>
              <div className="hero-btns">
                <button className="btn pri">{I.plus} New RFI</button>
                <button className="btn">{I.upload} Upload Document</button>
                <button className="btn">{I.download} Create Draw</button>
                <button className="btn">Send Message</button>
              </div>
            </div>

            <div className="hero-side">
              <h4>Project snapshot</h4>
              <div className="snap-stack">
                {snapshots.map((s) => (
                  <div key={s.label} className={`snap${s.type ? ` ${s.type}` : ""}`}>
                    <div className="sk">{s.label}</div>
                    <div className="sv">{s.value}</div>
                    <div className="sm">{s.meta}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CONTACTS ─────────────────── */}
          <section className="contacts">
            <div className="contacts-label">Key contacts</div>
            <div className="contacts-list">
              {contacts.map((c) => (
                <div key={c.initials} className="cc">
                  <div className="cc-av" style={{ background: c.color }}>{c.initials}</div>
                  <div className="cc-text">
                    <span className="cc-name">{c.name}</span>
                    <span className="cc-role">{c.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SUMMARY STRIP ────────────── */}
          <section className="sum-strip">
            {summaryCards.map((c) => (
              <div key={c.label} className={`sum-card${c.type ? ` ${c.type}` : ""}`}>
                <div className="sl">{c.label}</div>
                <div className="sv">{c.value}</div>
                <div className="sm">{c.meta}</div>
              </div>
            ))}
          </section>

          {/* ── PROJECT GRID ─────────────── */}
          <section className="pg">
            {/* LEFT: Workspace */}
            <div className="card">
              <div className="ph-head">
                <div>
                  <h3>Project workspace</h3>
                  <div className="sub">Primary entry points into this project's live operating surface.</div>
                </div>
                <div className="ph-badge">Live workspace</div>
              </div>

              <div className="ws-tabs">
                {wsTabs.map((t) => (
                  <button key={t.id} className={`ws-tab${activeTab === t.id ? " on" : ""}`} onClick={() => setActiveTab(t.id)}>
                    {t.label}
                    {t.badge && <span className={`tb-b${t.badgeType ? ` ${t.badgeType}` : ""}`}>{t.badge}</span>}
                  </button>
                ))}
              </div>
              <div className="ws-note">Switch between current action, workflows, and project records without leaving this surface.</div>

              <div className="ws-body">
                <div className="ml">
                  <div className="stk">
                    <div className="sb-blk dom-blk">
                      <h4>Today's priorities</h4>
                      <div className="lst">
                        {priorities.map((p) => <ListRow key={p.title} {...p} />)}
                      </div>
                    </div>
                    <div className="sb-blk">
                      <h4>Recent project movement</h4>
                      <div className="lst">
                        {movements.map((m) => <ListRow key={m.title} {...m} />)}
                      </div>
                    </div>
                  </div>
                  <div className="stk">
                    <div className="sb-blk alert-blk">
                      <h4>Approvals waiting</h4>
                      <div className="lst">
                        {approvalsWaiting.map((a) => <ListRow key={a.title} {...a} />)}
                      </div>
                    </div>
                    <div className="sb-blk">
                      <h4>Open risks &amp; dependencies</h4>
                      <div className="lst">
                        {risks.map((r) => <ListRow key={r.title} {...r} />)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT RAIL */}
            <div className="rail">
              {/* Blockers */}
              <div className="rc rc-danger">
                <div className="rc-head">
                  <h3>Current blockers</h3>
                  <div className="sub">Issues actively delaying project progress</div>
                </div>
                <div className="rc-body">
                  <div className="lst">
                    {blockers.map((b) => <ListRow key={b.title} {...b} />)}
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div className="rc">
                <div className="rc-head">
                  <h3>Upcoming milestones</h3>
                  <div className="sub">What's next for this project</div>
                </div>
                <div className="rc-body">
                  {milestones.map((m) => (
                    <div key={m.title} className="ms-item">
                      <div className="ms-date">
                        <div className="ms-day">{m.day}</div>
                        <div className="ms-month">{m.month}</div>
                      </div>
                      <div className="ms-info">
                        <h5>{m.title}</h5>
                        <p>{m.desc}</p>
                      </div>
                      <div className={`ms-cd${m.soon ? " soon" : ""}`}>{m.countdown}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Access */}
              <div className="rc">
                <div className="rc-head">
                  <h3>Quick access</h3>
                  <div className="sub">Jump into project modules</div>
                </div>
                <div className="rc-body">
                  <div className="mod-links">
                    {quickLinks.map((q) => (
                      <div key={q.label} className="mod-link">
                        <span>{q.label}</span>
                        <div className="ml-r">
                          {q.count && <span className="ml-c">{q.count}</span>}
                          <span className="ml-a">→</span>
                        </div>
                      </div>
                    ))}
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
