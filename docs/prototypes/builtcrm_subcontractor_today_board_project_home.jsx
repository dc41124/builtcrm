import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  upload: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  msg: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>,
};

// ── Logo Mark (Option F) ────────────────────────────────────────
const Logo = ({ s = 32 }) => (
  <div style={{ width: s, height: s, borderRadius: s * 0.3, background: "linear-gradient(135deg,#1a2e3e,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.65} height={s * 0.65}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Sidebar Nav Data ────────────────────────────────────────────
const workspaceNav = [
  { label: "Today Board", id: "today" },
  { label: "Assigned Projects", badge: 3 },
  { label: "Messages", badge: 5 },
  { label: "Notifications", badge: 2, badgeType: "warn" },
];
const projects = [
  { name: "Riverside Tower Fit-Out", color: "var(--ac)", active: true },
  { name: "West End Medical", color: "var(--ok)" },
  { name: "Northline Office", color: "var(--wr)" },
];
const scopeNav = [
  { label: "Project Home", id: "project" },
  { label: "RFIs / Questions", badge: 3 },
  { label: "Compliance", badge: 1, badgeType: "danger" },
  { label: "Upload Responses", badge: 2 },
  { label: "Documents" },
  { label: "Schedule" },
  { label: "Financials" },
];

// ── Today Board Data ────────────────────────────────────────────
const todaySummary = [
  { label: "Assigned today", value: "7", meta: "Across 3 projects" },
  { label: "GC requests", value: "3", meta: "2 projects need response", type: "accent" },
  { label: "Payments", value: "2 open", meta: "$42K expected · 1 pending revision" },
  { label: "Compliance", value: "1 due", meta: "Insurance renewal today", type: "danger" },
];

const todayTabs = [
  { id: "work", label: "My Work" },
  { id: "rfis", label: "RFIs", badge: 3 },
  { id: "uploads", label: "Upload Responses", badge: 2 },
  { id: "compliance", label: "Compliance", badge: 1, badgeType: "danger" },
  { id: "docs", label: "Documents" },
  { id: "messages", label: "Messages", badge: 5 },
  { id: "payments", label: "Payments" },
];

const todayAttention = [
  { title: "Upload revised switch schedule · Riverside Tower", desc: "GC requested updated schedule before internal review window closes this afternoon.", pill: "Due soon", pillType: "red", time: "2 PM", hot: true },
  { title: "Respond to RFI-012 · West End Medical", desc: "Clarify conduit routing after yesterday's field coordination note.", pill: "Need reply", pillType: "orange", time: "Today" },
  { title: "Upload progress photos · Northline Office", desc: "Owner update needs level 2 electrical room and corridor completion shots.", pill: "Upload", pillType: "blue", time: "Open" },
  { title: "Review message from GC PM · Riverside", desc: "David Cardona sent a message about the east corridor coordination status.", pill: "Message", pillType: "steel", time: "1 hr ago" },
];

const todayAcross = [
  { title: "Riverside Tower · East corridor rough-in closeout", desc: "Final device placement verification and photo submission.", pill: "On track", pillType: "green" },
  { title: "West End Medical · Panel room label revision", desc: "Updated naming set tied to latest drawing revision.", pill: "Watch", pillType: "orange" },
  { title: "Northline Office · Owner photo request", desc: "Upload package needed before tomorrow morning's client summary.", pill: "Open", pillType: "blue" },
];

const gcRequests = [
  { title: "Insurance renewal upload", desc: "Required for continued full project participation after today.", pill: "Required", pillType: "red", hot: true },
  { title: "Riverside · Switch schedule PDF", desc: "GC PM asked for updated revision before internal release.", pill: "Upload", pillType: "blue" },
  { title: "Northline · Progress photo request", desc: "Needed for owner-facing weekly summary.", pill: "Open", pillType: "orange" },
];

const todayPayments = [
  { title: "Riverside · PO-244 revision", desc: "Updated amount approved, waiting for revised issue copy.", pill: "Pending", pillType: "blue" },
  { title: "West End · Progress payment", desc: "$42K expected after current review cycle closes.", pill: "On track", pillType: "green" },
];

// ── Project Home Data ───────────────────────────────────────────
const projSummary = [
  { label: "Your scope", value: "Electrical", meta: "Phase 3 — interior rough-in" },
  { label: "Open RFIs", value: "2", meta: "1 needs your response", type: "accent" },
  { label: "GC requests", value: "2", meta: "Switch schedule + photos", type: "warn" },
  { label: "Compliance", value: "Current", meta: "COI renewal due today", type: "success" },
  { label: "Payment", value: "$42K", meta: "PO-244 revision pending" },
];

const projTabs = [
  { id: "work", label: "My Work" },
  { id: "rfis", label: "RFIs", badge: 2 },
  { id: "uploads", label: "Upload Responses", badge: 2 },
  { id: "compliance", label: "Compliance" },
  { id: "docs", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "schedule", label: "Schedule" },
];

const projTasks = [
  { title: "Upload revised switch schedule", desc: "GC requested updated schedule before internal review window closes this afternoon.", pill: "Due soon", pillType: "red", time: "2 PM", hot: true },
  { title: "Respond to RFI-019 field question", desc: "Clarify conduit routing in east corridor after field coordination note.", pill: "Need reply", pillType: "orange", time: "Today" },
  { title: "Upload progress photos", desc: "Level 4 electrical room and corridor completion shots for owner update.", pill: "Upload", pillType: "blue", time: "Open" },
];

const projMovement = [
  { title: "Approved submittal released", desc: "Lighting controls package cleared for field use.", time: "47 min ago" },
  { title: "Field coordination note added", desc: "East corridor routing issue logged after walkthrough with GC superintendent.", time: "1 hr ago" },
  { title: "Message from GC PM", desc: "David Cardona shared coordination status update in project thread.", time: "1 hr ago" },
  { title: "Owner photo request received", desc: "Electrical room progress imagery needed for weekly summary.", time: "2 hrs ago" },
];

const projGcRequests = [
  { title: "Switch schedule PDF", desc: "GC PM asked for updated revision before internal release.", pill: "Upload", pillType: "blue" },
  { title: "Progress photo request", desc: "Needed for owner-facing weekly summary.", pill: "Open", pillType: "orange" },
];

const projPayments = [
  { title: "PO-244 revision", desc: "Updated amount approved, waiting for revised issue copy.", pill: "Pending", pillType: "blue" },
  { title: "Progress payment", desc: "$42K expected after current review cycle closes.", pill: "On track", pillType: "green" },
];

const milestones = [
  { day: "16", month: "Apr", title: "Electrical signoff", desc: "Depends on field coordination closeout", countdown: "4 days", soon: true },
  { day: "22", month: "Apr", title: "GC internal release", desc: "Follows switch schedule upload", countdown: "10 days" },
];

const projQuickLinks = [
  { label: "Messages", count: "1 unread" },
  { label: "Documents", count: "4 files" },
  { label: "Schedule" },
  { label: "Financials", count: "$42K pending" },
];

const gcContacts = [
  { initials: "DC", name: "David Cardona", role: "Project Manager", color: "var(--ac)" },
  { initials: "MS", name: "Marco Silva", role: "Superintendent", color: "var(--ok)" },
];

// ── Component ───────────────────────────────────────────────────
export default function SubcontractorTodayProjectHome() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("today"); // "today" | "project"
  const [todayTab, setTodayTab] = useState("work");
  const [projTab, setProjTab] = useState("work");

  // Helper sub-components
  const NavItem = ({ label, badge, badgeType, active }) => (
    <div className={`n-item${active ? " on" : ""}`}>
      <span>{label}</span>
      <div className="n-right">
        {badge && <span className={`n-badge${badgeType === "warn" ? " warn" : badgeType === "danger" ? " danger" : ""}`}>{badge}</span>}
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

  const SummaryCard = ({ label, value, meta, type }) => (
    <div className={`sc${type ? ` ${type}-c` : ""}`}>
      <div className="sc-l">{label}</div>
      <div className="sc-v">{value}</div>
      <div className="sc-m">{meta}</div>
    </div>
  );

  return (
    <div className={`sb ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.sb{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;--ti:#faf9f7;
  --ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 10px 32px rgba(26,23,20,.08);--shri:0 0 0 3px rgba(61,107,142,.15);
  --sbw:272px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.sb.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#5a8db5;--ac-h:#4e7ea3;--ac-s:#182838;--ac-t:#7eafd4;--ac-m:#2e4a60;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 10px 32px rgba(0,0,0,.35);--shri:0 0 0 3px rgba(90,141,181,.2);
}

/* ── Reset ─────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0}

/* ── Sidebar ───────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand p{font-size:11px;color:var(--t3);margin-top:1px}
.s-search{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
.s-input{width:100%;height:34px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px 0 34px;background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.s-input:focus{border-color:var(--ac);box-shadow:var(--shri)}
.s-input::placeholder{color:var(--t3)}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

/* Compliance banner */
.cb{margin:0 0 4px;padding:10px 12px;border-radius:var(--r-m);background:var(--wr-s);border:1px solid #f0d5a3;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--wr-t)}
.cb-dot{width:8px;height:8px;border-radius:50%;background:var(--wr);flex-shrink:0}

.ns{margin-bottom:4px}
.ns-l{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.n-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df) var(--e);margin-bottom:2px;cursor:pointer;position:relative}
.n-item:hover{background:var(--sh);color:var(--t1)}
.n-item.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.n-item.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--ac)}
.n-right{display:flex;align-items:center;gap:6px;flex-shrink:0}
.n-badge{min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.n-badge.warn{background:var(--wr-s);color:var(--wr-t)}
.n-badge.danger{background:var(--dg-s);color:var(--dg-t)}

.n-proj{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;margin-bottom:2px;transition:all var(--df) var(--e)}
.n-proj:hover{background:var(--sh);color:var(--t1)}
.n-proj.on{background:var(--s1);color:var(--t1);font-weight:580;border:1px solid var(--s3)}
.n-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px}
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:640;color:var(--t1)}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

/* ── Main ──────────────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:var(--s1);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.sb.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3);letter-spacing:-.01em}
.bc .sep{color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;transition:all var(--df) var(--e);cursor:pointer}
.ib:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.nd{position:relative}.nd::after{content:'';position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:var(--dg);border:2px solid var(--s1)}

/* ── Content ───────────────────────────────────────── */
.ct{padding:24px;flex:1}

/* View switch */
.vs{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.vt{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e);white-space:nowrap;flex-shrink:0;cursor:pointer;background:none;border:none;font-family:var(--fd)}
.vt:hover{color:var(--t1)}
.vt.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}

/* Page header */
.ph-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:6px}
.ph-hdr h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em}
.ph-sub{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5}
.ph-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ph-acts{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0;align-items:flex-start}

/* Pills */
.pl{height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--s3);display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.steel{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d6a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5c0c0}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#a7d9be}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d4ee}

/* Buttons */
.btn{height:36px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:13px;font-weight:620;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);color:var(--ti);border-color:var(--ac)}
.btn.pri:hover{background:var(--ac-h)}
.btn svg{width:15px;height:15px;flex-shrink:0}

/* Summary cards */
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 20px}
.ss-5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0 20px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;transition:border-color var(--df) var(--e)}
.sc:hover{border-color:var(--s4)}
.sc-l{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--t3);font-weight:560;font-family:var(--fb)}
.sc-v{font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
.sc-m{font-size:12px;color:var(--t2);margin-top:3px}
.accent-c{background:linear-gradient(180deg,var(--s1) 0%,#edf3f8 100%);border-color:var(--ac-m)}
.accent-c .sc-v{color:var(--ac-t)}
.warn-c{background:linear-gradient(180deg,var(--s1) 0%,#fef8ee 100%);border-color:#f0d5a3}
.warn-c .sc-v{color:var(--wr-t)}
.danger-c{background:linear-gradient(180deg,var(--s1) 0%,#fef1f1 100%);border-color:#f0b8b8}
.danger-c .sc-v{color:var(--dg-t)}
.success-c{background:linear-gradient(180deg,var(--s1) 0%,#f1faf4 100%);border-color:#a7d9be}
.success-c .sc-v{color:var(--ok-t)}
.sb.dk .accent-c{background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%)}
.sb.dk .warn-c{background:linear-gradient(180deg,var(--s1) 0%,var(--wr-s) 100%)}
.sb.dk .danger-c{background:linear-gradient(180deg,var(--s1) 0%,var(--dg-s) 100%)}
.sb.dk .success-c{background:linear-gradient(180deg,var(--s1) 0%,var(--ok-s) 100%)}

/* Board grid */
.bg{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}

/* Card */
.cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);min-width:0}
.cd-h{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px 0}
.cd-h h3{font-family:var(--fd);font-size:15px;font-weight:720;letter-spacing:-.01em}
.cd-h .sub{font-size:12px;color:var(--t2);margin-top:4px}
.cd-badge{height:26px;padding:0 10px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:11px;font-weight:700;font-family:var(--fd);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}

/* Workspace tabs */
.wt-bar{display:flex;gap:4px;flex-wrap:wrap;margin:14px 20px 0;background:var(--s2);border-radius:var(--r-l);padding:4px}
.wt{height:34px;padding:0 12px;border-radius:var(--r-m);font-size:12px;font-weight:620;color:var(--t2);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;flex-shrink:0;cursor:pointer;background:none;border:none;font-family:var(--fb)}
.wt:hover{color:var(--t1);background:var(--sh)}
.wt.on{background:var(--s1);color:var(--t1);font-weight:650;box-shadow:var(--shsm)}
.wt .tb-b{min-width:16px;height:16px;padding:0 5px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd)}
.wt .tb-b.warn{background:var(--wr-s);color:var(--wr-t)}
.wt .tb-b.danger{background:var(--dg-s);color:var(--dg-t)}
.ws-note{padding:0 20px;margin-top:6px;font-size:12px;color:var(--t3)}
.cd-body{padding:16px 20px 20px}

/* Main layout */
.ml{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;align-items:start}
.stk{display:flex;flex-direction:column;gap:14px}

/* Soft blocks */
.sfb{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px}
.sfb h4{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:10px;color:var(--t1)}
.dom{background:linear-gradient(180deg,var(--s1) 0%,#edf3f8 100%);border-color:var(--ac-m)}
.dom h4{font-size:14px;margin-bottom:12px;color:var(--ac-t)}
.alrt{background:linear-gradient(180deg,var(--s1) 0%,#fdf6ea 100%);border-color:#f0d5a3}
.alrt h4{color:var(--wr-t)}
.sb.dk .dom{background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%)}
.sb.dk .alrt{background:linear-gradient(180deg,var(--s1) 0%,var(--wr-s) 100%)}

/* List rows */
.lst{display:flex;flex-direction:column;gap:8px}
.lr{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;transition:border-color var(--df) var(--e)}
.lr:hover{border-color:var(--s4)}
.lr.hot{border-color:#f0b8b8;background:#fef8f8}
.sb.dk .lr.hot{border-color:var(--dg-s);background:var(--dg-s)}
.lr-main h5{font-family:var(--fd);font-size:13px;font-weight:650;margin-bottom:3px;color:var(--t1);letter-spacing:-.01em}
.lr-main p{font-size:12px;color:var(--t2);line-height:1.45}
.lr-side{display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0}
.tm{font-size:11px;color:var(--t3);font-family:var(--fd);font-weight:600}

/* Right rail */
.rl{display:flex;flex-direction:column;gap:12px}
.rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rc-h{padding:14px 16px 0}
.rc-h h3{font-family:var(--fd);font-size:14px;font-weight:700}
.rc-h .sub{font-size:11px;color:var(--t2);margin-top:3px}
.rc-body{padding:12px 16px 16px}
.rc-alert{background:linear-gradient(180deg,#fffbf5 0%,#fef4e3 100%);border-color:#f0d5a3}
.sb.dk .rc-alert{background:linear-gradient(180deg,var(--s1) 0%,var(--wr-s) 100%)}

/* Module links */
.mod-links{display:flex;flex-direction:column;gap:6px}
.mod-link{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:13px;font-weight:550;color:var(--t1);transition:all var(--df) var(--e);cursor:pointer}
.mod-link:hover{border-color:var(--ac-m);background:var(--ac-s)}
.ml-r{display:flex;align-items:center;gap:6px}
.ml-c{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--ac-t)}
.ml-a{color:var(--t3);font-size:14px}

/* Milestone items */
.ms-item{display:flex;align-items:center;gap:12px;padding:8px 0}
.ms-item+.ms-item{border-top:1px solid var(--s3)}
.ms-date{width:44px;text-align:center;flex-shrink:0}
.ms-day{font-family:var(--fd);font-size:16px;font-weight:750;color:var(--t1);letter-spacing:-.02em}
.ms-month{font-family:var(--fd);font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.ms-info{flex:1;min-width:0}
.ms-info h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin-bottom:2px;letter-spacing:-.01em}
.ms-info p{font-size:11px;color:var(--t2)}
.ms-cd{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);white-space:nowrap;flex-shrink:0}
.ms-cd.soon{color:var(--wr-t)}

/* GC contacts */
.gc-ct{display:flex;align-items:center;gap:10px;padding:10px 0}
.gc-ct+.gc-ct{border-top:1px solid var(--s3)}
.gc-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;color:white;flex-shrink:0}
.gc-nm{font-family:var(--fd);font-size:13px;font-weight:640;color:var(--t1);letter-spacing:-.01em}
.gc-rl{font-family:var(--fd);font-size:11px;color:var(--t3);font-weight:520}

/* Current project focus card */
.focus-name{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:4px}
.focus-desc{font-size:12px;color:var(--t2);line-height:1.5}

/* ── Responsive ────────────────────────────────────── */
@media(max-width:1280px){.ss-5{grid-template-columns:repeat(3,1fr)}}
@media(max-width:1100px){.bg{grid-template-columns:1fr}.ml{grid-template-columns:1fr}}
@media(max-width:900px){.sb{grid-template-columns:1fr}.side{display:none}.ss,.ss-5{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div>
            <h1>BuiltCRM</h1>
            <p>Subcontractor portal</p>
          </div>
        </div>

        <div className="s-search">
          <input className="s-input" placeholder="Search projects, files, requests…" />
        </div>

        <nav className="s-nav">
          {/* Compliance banner */}
          <div className="cb">
            <span className="cb-dot" />
            <span>1 compliance item due today</span>
          </div>

          {/* Workspace */}
          <div className="ns">
            <div className="ns-l">Workspace</div>
            {workspaceNav.map((n) => (
              <div
                key={n.label}
                className={`n-item${n.id === view ? " on" : ""}`}
                onClick={() => n.id && setView(n.id)}
              >
                <span>{n.label}</span>
                <div className="n-right">
                  {n.badge && <span className={`n-badge${n.badgeType === "warn" ? " warn" : ""}`}>{n.badge}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Projects */}
          <div className="ns">
            <div className="ns-l">Projects</div>
            {projects.map((p) => (
              <div key={p.name} className={`n-proj${p.active ? " on" : ""}`}>
                <span className="n-dot" style={{ background: p.color }} />
                <span>{p.name}</span>
              </div>
            ))}
          </div>

          {/* Project Scope */}
          <div className="ns">
            <div className="ns-l">Project Scope</div>
            {scopeNav.map((n) => (
              <div
                key={n.label}
                className={`n-item${n.id === view ? " on" : ""}`}
                onClick={() => n.id && setView(n.id)}
              >
                <span>{n.label}</span>
                <div className="n-right">
                  {n.badge && <span className={`n-badge${n.badgeType === "danger" ? " danger" : ""}`}>{n.badge}</span>}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="s-foot">
          <div className="s-user">
            <div className="u-av">NE</div>
            <div>
              <div className="u-name">Northline Electrical</div>
              <div className="u-role">Electrical subcontractor</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            {view === "today" ? (
              <>
                <span>Subcontractor</span>
                <span className="sep">›</span>
                <span className="cur">Today Board</span>
              </>
            ) : (
              <>
                <span>Subcontractor</span>
                <span className="sep">›</span>
                <span>Riverside Tower Fit-Out</span>
                <span className="sep">›</span>
                <span className="cur">Project Home</span>
              </>
            )}
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Toggle theme">
              {dark ? I.sun : I.moon}
            </button>
            <button className="ib nd" aria-label="Notifications">{I.bell}</button>
            <div className="av">NE</div>
          </div>
        </div>

        <div className="ct">
          {/* View switch */}
          <div className="vs">
            <button className={`vt${view === "today" ? " on" : ""}`} onClick={() => setView("today")}>Today Board</button>
            <button className={`vt${view === "project" ? " on" : ""}`} onClick={() => setView("project")}>Project Home · Riverside</button>
          </div>

          {/* ═══════ TODAY BOARD ═══════ */}
          {view === "today" && (
            <div>
              <div className="ph-hdr">
                <div>
                  <h2>Today Board</h2>
                  <div className="ph-pills">
                    <span className="pl steel">Electrical scope</span>
                    <span className="pl orange">3 GC requests open</span>
                    <span className="pl red">1 required upload today</span>
                  </div>
                  <p className="ph-sub">What to do, what to send, and what the GC needs from you — across all your assigned projects.</p>
                </div>
                <div className="ph-acts">
                  <button className="btn">{I.upload} Upload File</button>
                  <button className="btn">{I.msg} Message GC</button>
                  <button className="btn pri">Open My Tasks</button>
                </div>
              </div>

              <div className="ss">
                {todaySummary.map((c) => <SummaryCard key={c.label} {...c} />)}
              </div>

              <section className="bg">
                <div className="cd">
                  <div className="cd-h">
                    <div>
                      <h3>Execution workspace</h3>
                      <div className="sub">Work and response surface across your assigned projects.</div>
                    </div>
                    <div className="cd-badge">Cross-project</div>
                  </div>

                  <div className="wt-bar">
                    {todayTabs.map((t) => (
                      <button key={t.id} className={`wt${todayTab === t.id ? " on" : ""}`} onClick={() => setTodayTab(t.id)}>
                        {t.label}
                        {t.badge && <span className={`tb-b${t.badgeType === "danger" ? " danger" : t.badgeType === "warn" ? " warn" : ""}`}>{t.badge}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="ws-note">Switch between assigned work, response workflows, compliance, scoped files, and payment visibility.</div>

                  <div className="cd-body">
                    <div className="ml">
                      <div className="stk">
                        <div className="sfb dom">
                          <h4>What needs attention now</h4>
                          <div className="lst">
                            {todayAttention.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                        <div className="sfb">
                          <h4>Today across projects</h4>
                          <div className="lst">
                            {todayAcross.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                      </div>
                      <div className="stk">
                        <div className="sfb alrt">
                          <h4>GC requests waiting on you</h4>
                          <div className="lst">
                            {gcRequests.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                        <div className="sfb">
                          <h4>Payment status</h4>
                          <div className="lst">
                            {todayPayments.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Today rail */}
                <div className="rl">
                  <div className="rc rc-alert">
                    <div className="rc-h">
                      <h3>Compliance state</h3>
                      <div className="sub">Operational gate for project access</div>
                    </div>
                    <div className="rc-body">
                      <div className="lst">
                        <ListRow title="Insurance certificate renewal" desc="Due today — some actions may be restricted if not uploaded" pill="Due" pillType="red" hot />
                      </div>
                    </div>
                  </div>

                  <div className="rc">
                    <div className="rc-h">
                      <h3>Quick access</h3>
                      <div className="sub">Jump into modules</div>
                    </div>
                    <div className="rc-body">
                      <div className="mod-links">
                        {[{ label: "Messages", count: "5 unread" }, { label: "Documents" }, { label: "Schedule" }, { label: "Financials", count: "$42K pending" }].map((q) => (
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

                  <div className="rc">
                    <div className="rc-h">
                      <h3>Current project focus</h3>
                      <div className="sub">Where most of today's work is</div>
                    </div>
                    <div className="rc-body">
                      <div className="focus-name">Riverside Tower Fit-Out</div>
                      <p className="focus-desc">2 of today's active items are tied to Riverside. East corridor rough-in closeout is the main field focus.</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ═══════ PROJECT HOME ═══════ */}
          {view === "project" && (
            <div>
              <div className="ph-hdr">
                <div>
                  <h2>Riverside Tower Fit-Out</h2>
                  <div className="ph-pills">
                    <span className="pl steel">Electrical scope · Your work</span>
                    <span className="pl orange">2 open requests</span>
                    <span className="pl green">Schedule on track</span>
                  </div>
                  <p className="ph-sub">Your scope, tasks, open requests, and project context for this project — scoped to what's relevant to your work.</p>
                </div>
                <div className="ph-acts">
                  <button className="btn">{I.upload} Upload File</button>
                  <button className="btn pri">{I.msg} Message GC</button>
                </div>
              </div>

              <div className="ss-5">
                {projSummary.map((c) => <SummaryCard key={c.label} {...c} />)}
              </div>

              <section className="bg">
                <div className="cd">
                  <div className="cd-h">
                    <div>
                      <h3>Your workspace</h3>
                      <div className="sub">Tasks, requests, and workflows scoped to your work on this project.</div>
                    </div>
                    <div className="cd-badge">Riverside Tower</div>
                  </div>

                  <div className="wt-bar">
                    {projTabs.map((t) => (
                      <button key={t.id} className={`wt${projTab === t.id ? " on" : ""}`} onClick={() => setProjTab(t.id)}>
                        {t.label}
                        {t.badge && <span className={`tb-b${t.badgeType === "danger" ? " danger" : t.badgeType === "warn" ? " warn" : ""}`}>{t.badge}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="ws-note">Everything here is scoped to your electrical work on this project.</div>

                  <div className="cd-body">
                    <div className="ml">
                      <div className="stk">
                        <div className="sfb dom">
                          <h4>Active tasks</h4>
                          <div className="lst">
                            {projTasks.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                        <div className="sfb">
                          <h4>Recent movement on this project</h4>
                          <div className="lst">
                            {projMovement.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                      </div>
                      <div className="stk">
                        <div className="sfb alrt">
                          <h4>GC requests waiting on you</h4>
                          <div className="lst">
                            {projGcRequests.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                        <div className="sfb">
                          <h4>Payment status</h4>
                          <div className="lst">
                            {projPayments.map((r) => <ListRow key={r.title} {...r} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Home rail */}
                <div className="rl">
                  <div className="rc">
                    <div className="rc-h">
                      <h3>Upcoming milestones</h3>
                      <div className="sub">What this project is moving toward</div>
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

                  <div className="rc">
                    <div className="rc-h">
                      <h3>Quick access</h3>
                      <div className="sub">Project-scoped modules</div>
                    </div>
                    <div className="rc-body">
                      <div className="mod-links">
                        {projQuickLinks.map((q) => (
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

                  <div className="rc">
                    <div className="rc-h">
                      <h3>GC contacts</h3>
                      <div className="sub">Your points of contact on this project</div>
                    </div>
                    <div className="rc-body">
                      {gcContacts.map((c) => (
                        <div key={c.name} className="gc-ct">
                          <div className="gc-av" style={{ background: c.color }}>{c.initials}</div>
                          <div>
                            <div className="gc-nm">{c.name}</div>
                            <div className="gc-rl">{c.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
