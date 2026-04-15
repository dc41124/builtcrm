import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

// ── Logo ────────────────────────────────────────────────────────
const Logo = ({ s = 32 }) => (
  <div style={{ width: s, height: s, borderRadius: 10, background: "linear-gradient(135deg,#1a1714,#3d3830)", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.55} height={s * 0.55}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="#faf9f7" opacity=".95"/>
    </svg>
  </div>
);

// ── Nav data ────────────────────────────────────────────────────
const navData = {
  contractor: [
    { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Project Directory", badge: 24, bt: "blue" }, { label: "Inbox", badge: 8, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "Compliance", active: true, badge: 4, bt: "danger" },
      { label: "RFIs / Issues", badge: 3, bt: "blue" }, { label: "Change Orders", badge: 2, bt: "blue" },
      { label: "Approvals", badge: 5, bt: "blue" }, { label: "Upload Requests", badge: 7, bt: "blue" },
      { label: "Billing / Draw" }, { label: "Schedule" }, { label: "Documents" }, { label: "Messages" },
    ]},
  ],
  sub: [
    { section: "Workspace", items: [{ label: "Today Board" }, { label: "Inbox", badge: 5, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "Compliance", active: true, badge: 2, bt: "danger" },
      { label: "RFIs / Issues", badge: 1, bt: "blue" }, { label: "Upload Requests", badge: 3, bt: "blue" },
      { label: "Schedule" }, { label: "Documents" }, { label: "Messages" },
    ]},
  ],
};

const portalMeta = {
  contractor: { label: "Contractor Portal", project: "Riverside Tower Fit-Out", page: "Compliance", user: "DC" },
  sub: { label: "Subcontractor Portal", project: "Riverside Tower Fit-Out", page: "Compliance", user: "JR" },
};

// ── GC Records data ─────────────────────────────────────────────
const gcRecords = [
  { id: "wsib-apex", org: "Apex Mechanical", title: "WSIB clearance renewal", desc: "Renewal submitted, waiting on review before current record lapses.", status: "Needs review", pill: "orange", tab: "review", tags: ["Submitted", "Until Apr 17", "6d to threshold"], access: "Active", time: "23m ago", hot: true },
  { id: "ins-apex", org: "Apex Mechanical", title: "Insurance certificate", desc: "Still missing. Restriction threshold approaching.", status: "At risk", pill: "red", tab: "atrisk", tags: ["Missing", "2d to threshold", "Not submitted"], access: "At risk", time: "Flagged 5d ago", hot: true },
  { id: "orient-north", org: "Northline Electrical", title: "Site orientation roster", desc: "Restriction applied. Awaiting updated roster submission.", status: "Restricted", pill: "red", tab: "restricted", tags: ["Restricted", "Access limited", "Not resubmitted"], access: "Restricted", time: "Apr 3", hot: false },
  { id: "safety-capital", org: "Capital Plumbing", title: "Safety training roster", desc: "Accepted and active through the current project period.", status: "Active", pill: "green", tab: "accepted", tags: ["Accepted", "Until Jun 30"], access: "Active", time: "Today", hot: false },
];

const gcDetails = {
  "wsib-apex": {
    title: "WSIB clearance renewal", org: "Apex Mechanical · Project subcontractor",
    desc: "Renewal file submitted. Current accepted record expires Apr 17 — review needed before lapse triggers restriction and payment hold.",
    pills: [{ t: "Needs review", c: "orange" }, { t: "Restriction risk", c: "red" }, { t: "Payment hold", c: "orange" }],
    grid: [
      { k: "Organization", v: "Apex Mechanical", m: "Project subcontractor" },
      { k: "Requirement", v: "WSIB clearance", m: "Renewal submission" },
      { k: "Accepted-until", v: "Apr 17, 2026", m: "Lapses in 6 days" },
      { k: "State", v: "Submitted, awaiting review", m: "Replacement not yet accepted" },
    ],
    file: { name: "wsib_clearance_renewal_apr2026.pdf", by: "Apex Mechanical", time: "23 minutes ago", size: "PDF · 148 KB" },
    verify: [
      { label: "Named insured", detail: "Matches Apex Mechanical Inc.", pass: true },
      { label: "Coverage dates", detail: "Apr 2026 — Apr 2027", pass: true },
      { label: "Certificate number", detail: "Present on document", pass: true },
      { label: "Liability minimum ($2M)", detail: "Meets project threshold", pass: true },
      { label: "Additional insured endorsement", detail: "Not confirmed — check page 2", pass: false },
    ],
    showReview: true, showRestriction: true, missingNote: null, restrictedNote: null,
  },
  "ins-apex": {
    title: "Insurance certificate", org: "Apex Mechanical · Project subcontractor",
    desc: "No valid insurance on file. Restriction threshold 2 days away. No replacement submitted.",
    pills: [{ t: "Missing", c: "red" }, { t: "Restriction risk", c: "red" }, { t: "Payment hold", c: "orange" }],
    grid: [
      { k: "Organization", v: "Apex Mechanical", m: "Project subcontractor" },
      { k: "Requirement", v: "Insurance COI", m: "Project-level" },
      { k: "Threshold", v: "2 days", m: "Access may be limited after" },
      { k: "Submitted", v: "None", m: "No file uploaded" },
    ],
    file: null, verify: [], showReview: false, showRestriction: true,
    missingNote: "Not submitted. Subcontractor has been notified. Consider applying restriction if no valid certificate arrives before threshold.",
    restrictedNote: null,
  },
  "orient-north": {
    title: "Site orientation roster", org: "Northline Electrical · Project subcontractor",
    desc: "Restriction applied. Project participation limited until updated roster submitted and accepted.",
    pills: [{ t: "Restricted", c: "red" }, { t: "Payment held", c: "orange" }],
    grid: [
      { k: "Organization", v: "Northline Electrical", m: "Project subcontractor" },
      { k: "Requirement", v: "Site orientation", m: "Safety training record" },
      { k: "Restricted", v: "Apr 3, 2026", m: "9 days ago" },
      { k: "Replacement", v: "Not submitted", m: "Awaiting subcontractor" },
    ],
    file: null, verify: [], showReview: false, showRestriction: true,
    missingNote: null,
    restrictedNote: "Restriction active. Northline notified. Payment processing on hold. Clear restriction once valid replacement accepted.",
  },
  "safety-capital": {
    title: "Safety training roster", org: "Capital Plumbing · Project subcontractor",
    desc: "Accepted today. Active through Jun 30. No action needed.",
    pills: [{ t: "Active", c: "green" }],
    grid: [
      { k: "Organization", v: "Capital Plumbing", m: "Project subcontractor" },
      { k: "Requirement", v: "Safety training", m: "Training documentation" },
      { k: "Valid until", v: "Jun 30, 2026", m: "79 days remaining" },
      { k: "Accepted", v: "Today", m: "Reviewed and cleared" },
    ],
    file: { name: "safety_training_q2_2026.pdf", by: "Capital Plumbing", time: "This morning", size: "PDF · 92 KB" },
    verify: [
      { label: "Training provider", detail: "Recognized provider", pass: true },
      { label: "Employee roster", detail: "All active crew listed", pass: true },
      { label: "Certification dates", detail: "Current through Jun 30", pass: true },
    ],
    showReview: false, showRestriction: false, missingNote: null, restrictedNote: null,
  },
};

// ── Sub Requirements data ───────────────────────────────────────
const subReqs = [
  { id: "ins", title: "Insurance certificate", status: "Missing", dot: "red", pill: "red", tab: "missing" },
  { id: "wsib", title: "WSIB clearance", status: "Expiring · Renewal submitted", dot: "orange", pill: "orange", tab: "expiring" },
  { id: "safety", title: "Safety training roster", status: "Active · Until Jun 30", dot: "green", pill: "green", tab: "active" },
  { id: "orient", title: "Site orientation", status: "Active · Until May 15", dot: "green", pill: "green", tab: "active" },
];

const subDetails = {
  ins: {
    title: "Insurance certificate", org: "Required by Riverside Tower Fit-Out",
    desc: "A valid project insurance certificate is required. No record submitted. GC restriction threshold in 2 days.",
    pills: [{ t: "Missing", c: "red" }, { t: "Restriction risk", c: "red" }, { t: "Payment held", c: "orange" }],
    grid: [
      { k: "Requirement", v: "Insurance COI", m: "Project-level compliance record" },
      { k: "Status", v: "Missing", m: "No valid record on file" },
      { k: "Threshold", v: "2 days", m: "GC may restrict access after" },
      { k: "Payment", v: "Draw requests held", m: "Until compliance clears" },
    ],
    showUpload: true, showRestriction: true, submittedFile: null,
  },
  wsib: {
    title: "WSIB clearance", org: "Required by Riverside Tower Fit-Out",
    desc: "Renewal submitted and waiting on GC review. Current record expires Apr 17.",
    pills: [{ t: "Expiring", c: "orange" }, { t: "Submitted", c: "accent" }],
    grid: [
      { k: "Requirement", v: "WSIB clearance", m: "Renewal submission" },
      { k: "Status", v: "Submitted · Waiting on GC", m: "Sent 23 min ago" },
      { k: "Expires", v: "Apr 17, 2026", m: "6 days remaining" },
      { k: "After acceptance", v: "Risk clears", m: "Access + payment holds removed" },
    ],
    showUpload: false, showRestriction: false,
    submittedFile: { name: "wsib_clearance_apr.pdf", time: "23 minutes ago", size: "PDF · 148 KB" },
  },
  safety: {
    title: "Safety training roster", org: "Required by Riverside Tower Fit-Out",
    desc: "Accepted and valid through Jun 30. No action needed.",
    pills: [{ t: "Active", c: "green" }],
    grid: [
      { k: "Requirement", v: "Safety training", m: "Training documentation" },
      { k: "Status", v: "Accepted", m: "Cleared by GC" },
      { k: "Valid until", v: "Jun 30, 2026", m: "79 days remaining" },
      { k: "Payment", v: "No impact", m: "Requirement satisfied" },
    ],
    showUpload: false, showRestriction: false, submittedFile: null,
  },
  orient: {
    title: "Site orientation", org: "Required by Riverside Tower Fit-Out",
    desc: "Accepted. Covers all current crew members.",
    pills: [{ t: "Active", c: "green" }],
    grid: [
      { k: "Requirement", v: "Site orientation", m: "Safety training record" },
      { k: "Status", v: "Accepted", m: "Cleared by GC" },
      { k: "Valid until", v: "May 15, 2026", m: "33 days remaining" },
      { k: "Payment", v: "No impact", m: "Requirement satisfied" },
    ],
    showUpload: false, showRestriction: false, submittedFile: null,
  },
};

// ── Component ───────────────────────────────────────────────────
export default function ComplianceWorkflow() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [gcTab, setGcTab] = useState("review");
  const [gcSelected, setGcSelected] = useState("wsib-apex");
  const [subSelected, setSubSelected] = useState("ins");
  const [accepted, setAccepted] = useState(false);

  const meta = portalMeta[portal];
  const nav = navData[portal];

  const filteredGc = gcRecords.filter(r => r.tab === gcTab);
  const gcDetail = gcDetails[gcSelected];
  const subDetail = subDetails[subSelected];

  return (
    <div className={`cp ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.cp{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(91,79,199,.15);
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.cp.sub{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15)}
.cp.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
}
.cp.dk.sub{--ac:#5a9abe;--ac-h:#4d87a8;--ac-s:#14202c;--ac-t:#7cb8da;--ac-m:#2a4a60}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}

/* ── Sidebar ── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.sb-srch{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
.sb-srch input{width:100%;height:36px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.comp-banner{margin:8px 10px;padding:10px 12px;border-radius:var(--r-m);border:1px solid #f5baba;background:var(--dg-s);font-size:12px;color:var(--dg-t);font-weight:600}
.cp.dk .comp-banner{border-color:#5a2020}

/* ── Main ── */
.mn{display:flex;flex-direction:column;min-width:0}
.topb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.cp.dk .topb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px;flex:1}

/* Portal switch */
.psw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.psw button{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e)}
.psw button:hover{color:var(--t1)}.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Shared */
.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-h h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em}
.pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:560px;line-height:1.5}
.pg-h-pills{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e)}
.sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
.sc.alert{border-color:#f5d5a0}.sc.danger{border-color:#f5baba}.sc.strong{border-color:var(--ac-m)}.sc.success{border-color:#b0dfc4}
.cp.dk .sc.alert{border-color:#5a4420}.cp.dk .sc.danger{border-color:#5a2020}.cp.dk .sc.success{border-color:#1e4a3c}
.sc-label{font-family:var(--fb);font-size:12px;font-weight:560;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--df) var(--e);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.sm{height:32px;padding:0 12px;font-size:12px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2)}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.btn.dg-f{background:var(--dg);border-color:var(--dg);color:white}.btn.dg-f:hover{background:var(--dg-t)}
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.mtag{height:20px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--s3);background:var(--s2);color:var(--t3);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;font-family:var(--fd)}

/* Page grid */
.pg-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:700}.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.md{display:grid;grid-template-columns:370px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
.q-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
.q-filt{height:30px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:12px;color:var(--t2);outline:none;font-family:var(--fb)}

/* Record cards (GC queue) */
.tl{display:flex;flex-direction:column;gap:6px;max-height:620px;overflow-y:auto}
.tl::-webkit-scrollbar{width:4px}.tl::-webkit-scrollbar-track{background:transparent}.tl::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.rcd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e)}
.rcd:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.rcd.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.rcd.hot{border-color:#f5baba}.rcd.hot.on{border-color:var(--dg-t);box-shadow:0 0 0 3px rgba(201,59,59,.12)}
.cp.dk .rcd.hot{border-color:#5a2020}.cp.dk .rcd.hot.on{border-color:var(--dg-t)}
.rcd-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.rcd-org{font-family:var(--fm);font-size:11px;color:var(--t3);font-weight:520}
.rcd-title{font-family:var(--fd);font-size:13px;font-weight:700;margin-top:2px}
.rcd-desc{font-size:12px;color:var(--t2);margin-top:2px;line-height:1.4}
.rcd-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.rcd-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--t3)}

/* Detail */
.dp{min-height:400px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.dh-org{font-family:var(--fm);font-size:12px;color:var(--t3);margin-top:2px}
.dh-desc{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;max-width:480px}
.dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px}
.dg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}
.dg-i{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.dg-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}.dg-i .m{font-size:12px;color:var(--t2);margin-top:2px}
.ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
.ds.restrict{border-color:#f5baba}.cp.dk .ds.restrict{border-color:#5a2020}
.ds-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
.ds-h h4{font-family:var(--fd);font-size:13px;font-weight:700}.ds-acts{display:flex;gap:6px;align-items:center}
.ds.restrict .ds-h{background:linear-gradient(180deg,#fef5f5,#fdeaea);border-bottom-color:#f5baba}
.ds.restrict .ds-h h4{color:var(--dg-t)}
.cp.dk .ds.restrict .ds-h{background:linear-gradient(180deg,var(--dg-s),#1e1214)}
.ds-b{padding:14px 16px}.ds-b p{font-size:13px;color:var(--t2);line-height:1.55}
.fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}.fr:last-child{border-bottom:none}
.fr h5{font-size:13px;font-weight:600}.fr p{font-size:12px;color:var(--t2);margin-top:1px}
.fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

/* Verify checklist */
.vl{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.vi{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:13px}
.v-chk{width:20px;height:20px;border-radius:6px;border:2px solid var(--s4);display:grid;place-items:center;flex-shrink:0;font-size:11px;font-weight:700;color:white}
.v-chk.pass{background:var(--ok);border-color:var(--ok)}.v-chk.fail{background:var(--dg);border-color:var(--dg)}
.v-lbl{flex:1;font-weight:550}.v-lbl span{display:block;font-size:11px;color:var(--t3);font-weight:520;margin-top:1px}

/* Decision card */
.dec{border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;background:linear-gradient(180deg,var(--s1),var(--s2));margin-top:12px}
.dec h5{font-family:var(--fd);font-size:14px;font-weight:700}.dec p{font-size:12px;color:var(--t2);margin-top:4px;line-height:1.5}
.dec-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

/* Restriction panel */
.rp{border:1px solid #f5baba;border-radius:var(--r-l);padding:14px 16px;background:linear-gradient(180deg,#fef5f5,#fdeaea);margin-top:12px}
.cp.dk .rp{border-color:#5a2020;background:linear-gradient(180deg,var(--dg-s),#1e1214)}
.rp h5{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--dg-t)}.rp p{font-size:12px;color:#7f2d2d;margin-top:4px;line-height:1.5}
.cp.dk .rp p{color:var(--dg-t)}
.rp-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

/* Upload zone */
.uz{border:2px dashed var(--s3);border-radius:var(--r-l);padding:24px 20px;text-align:center;background:var(--s2);transition:all var(--dn) var(--e)}
.uz:hover{border-color:var(--ac);background:var(--ac-s)}
.uz h5{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:4px}.uz p{font-size:12px;color:var(--t2)}
.uz-acts{display:flex;gap:8px;margin-top:12px;justify-content:center}

/* Sub requirement checklist */
.rq-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);cursor:pointer;transition:all var(--dn);margin-bottom:6px}
.rq-row:hover{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 20%,var(--s1))}
.rq-row.on{border-color:var(--ac-m);box-shadow:var(--shri)}
.rq-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.rq-info{flex:1;min-width:0}.rq-info h5{font-family:var(--fd);font-size:13px;font-weight:700}.rq-info p{font-size:11px;color:var(--t3);margin-top:1px}

/* Payment hold banner */
.phb{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #f5d5a0;border-radius:var(--r-m);background:var(--wr-s)}
.cp.dk .phb{border-color:#5a4420}
.phb-text{font-size:12px;color:var(--wr-t);font-weight:600}.phb-text span{display:block;font-weight:520;margin-top:1px;font-size:11px;color:var(--t2)}

/* Org scorecard */
.osc{display:flex;flex-direction:column}
.o-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--s2)}.o-row:last-child{border-bottom:none}
.o-name{font-family:var(--fd);font-size:13px;font-weight:700;flex:1;min-width:0}
.o-dots{display:flex;gap:3px;align-items:center;flex-shrink:0}
.s-dot{width:8px;height:8px;border-radius:50%}.s-dot.filled{background:var(--ok)}.s-dot.empty{background:var(--s3)}.s-dot.danger{background:var(--dg)}
.o-lbl{font-size:11px;color:var(--t3);margin-left:6px;white-space:nowrap}

/* Activity */
.al{display:flex;flex-direction:column}
.ai{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--s2)}.ai:last-child{border-bottom:none}
.a-dot{width:7px;height:7px;border-radius:50%;background:var(--s4);margin-top:6px;flex-shrink:0}
.a-dot.action{background:var(--ac)}.a-dot.ok{background:var(--ok)}.a-dot.err{background:var(--dg)}.a-dot.sys{background:var(--t3)}
.a-text{flex:1;font-size:12px;color:var(--t2);line-height:1.4}.a-text strong{color:var(--t1);font-weight:650}
.a-time{font-size:10px;color:var(--t3);flex-shrink:0;padding-top:2px}

/* Rail */
.rail{display:flex;flex-direction:column;gap:12px}
.rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rc.alert{border-color:#f5d5a0}.rc.danger{border-color:#f5baba}.rc.info{border-color:#b3d1ec}
.cp.dk .rc.alert{border-color:#5a4420}.cp.dk .rc.danger{border-color:#5a2020}.cp.dk .rc.info{border-color:#2a4a60}
.rc-h{padding:14px 16px 0}.rc-h h3{font-family:var(--fd);font-size:14px;font-weight:700}.rc-h .sub{font-size:12px;color:var(--t3);margin-top:2px}
.rc-b{padding:10px 16px 16px}.rc-b>p{font-size:13px;color:var(--t2);line-height:1.5}
.mblk{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:12px}
.mblk h4{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:4px}.mblk p{font-size:12px;color:var(--t2)}

/* Responsive */
@media(max-width:1280px){.pg-grid{grid-template-columns:1fr}.md{grid-template-columns:1fr}}
@media(max-width:900px){.cp{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand"><Logo /><div><h1>BuiltCRM</h1><div className="brand-ctx">{meta.label}</div></div></div>
        <div className="sb-srch"><input placeholder="Search…" /></div>
        <nav className="s-nav">
          {portal === "sub" && <div className="comp-banner">1 item at restriction risk · Payment held</div>}
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

      {/* ── Main ── */}
      <main className="mn">
        <div className="topb">
          <div className="bc">
            <span>{meta.label}</span><span className="sep">›</span>
            <span>{meta.project}</span><span className="sep">›</span>
            <span className="cur">{meta.page}</span>
          </div>
          <div className="tb-acts">
            <div className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</div>
            <div className="ib">{I.bell}</div>
            <div className="av">{meta.user}</div>
          </div>
        </div>

        <div className="ct">
          <div className="psw">
            {[["contractor","#5b4fc7","Contractor"],["sub","#3d6b8e","Subcontractor"]].map(([k,c,l]) => (
              <button key={k} className={portal === k ? "on" : ""} onClick={() => { setPortal(k); setAccepted(false); }}>
                <span className="p-dot" style={{ background: c }} />{l}
              </button>
            ))}
          </div>

          {/* ═══════ CONTRACTOR ═══════ */}
          {portal === "contractor" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Compliance</h2>
                  <p>Review submitted records, track requirements, and control access-state restrictions. Non-compliant subcontractors have payment holds applied automatically.</p>
                  <div className="pg-h-pills">
                    <span className="pl accent">Review + restriction control</span>
                    <span className="pl orange">2 records need review</span>
                    <span className="pl red">1 org at restriction threshold</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 4 }}>
                  <button className="btn sm">Export log</button>
                  <button className="btn sm pri">Review next record</button>
                </div>
              </div>

              <div className="ss">
                <div className="sc strong" onClick={() => { setGcTab("review"); const f = gcRecords.filter(r=>r.tab==="review"); if(f.length) setGcSelected(f[0].id); }}><div className="sc-label">Needs review</div><div className="sc-value">2</div><div className="sc-meta">Submitted records awaiting decision</div></div>
                <div className="sc alert" onClick={() => { setGcTab("atrisk"); const f = gcRecords.filter(r=>r.tab==="atrisk"); if(f.length) setGcSelected(f[0].id); }}><div className="sc-label">At risk</div><div className="sc-value">1 org</div><div className="sc-meta">Restriction threshold approaching</div></div>
                <div className="sc danger" onClick={() => { setGcTab("restricted"); const f = gcRecords.filter(r=>r.tab==="restricted"); if(f.length) setGcSelected(f[0].id); }}><div className="sc-label">Restricted</div><div className="sc-value">1 org</div><div className="sc-meta">Participation limited · Payment held</div></div>
                <div className="sc success" onClick={() => { setGcTab("accepted"); const f = gcRecords.filter(r=>r.tab==="accepted"); if(f.length) setGcSelected(f[0].id); }}><div className="sc-label">Cleared today</div><div className="sc-value">1</div><div className="sc-meta">Compliance issue resolved</div></div>
              </div>

              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head"><div><h3>Compliance review workspace</h3><div className="sub">Queue-first surface for reviewing records, assessing restriction risk, and controlling access consequences.</div></div></div>
                  <div className="ws-tabs">
                    {[["review","Needs review"],["atrisk","At risk"],["restricted","Restricted"],["accepted","Accepted"]].map(([k,l]) => (
                      <button key={k} className={`wtab${gcTab===k?" on":""}`} onClick={() => { setGcTab(k); const f = gcRecords.filter(r=>r.tab===k); if(f.length) setGcSelected(f[0].id); }}>{l}</button>
                    ))}
                  </div>
                  <div className="md">
                    <div>
                      <div className="q-bar">
                        <select className="q-filt"><option>Sort: Highest risk</option><option>Sort: Expiry soonest</option></select>
                        <button className="btn sm ghost">Needs action</button>
                      </div>
                      <div className="tl">
                        {filteredGc.map((r) => (
                          <div key={r.id} className={`rcd${gcSelected===r.id?" on":""}${r.hot?" hot":""}`} onClick={() => setGcSelected(r.id)}>
                            <div className="rcd-top">
                              <div style={{flex:1,minWidth:0}}>
                                <div className="rcd-org">{r.org}</div>
                                <div className="rcd-title">{r.title}</div>
                                <div className="rcd-desc">{r.desc}</div>
                              </div>
                              <span className={`pl ${r.pill}`}>{r.status}</span>
                            </div>
                            <div className="rcd-tags">{r.tags.map((t,j) => <span key={j} className="mtag">{t}</span>)}</div>
                            <div className="rcd-foot"><span>Access: {r.access}</span><span>{r.time}</span></div>
                          </div>
                        ))}
                        {filteredGc.length === 0 && <p style={{color:"var(--t3)",padding:20}}>No records in this view.</p>}
                      </div>
                    </div>

                    {/* Detail pane */}
                    {gcDetail && (
                      <div className="dp">
                        <div className="dh">
                          <div>
                            <h3>{gcDetail.title}</h3>
                            <div className="dh-org">{gcDetail.org}</div>
                            <div className="dh-desc">{gcDetail.desc}</div>
                          </div>
                          <div className="dh-pills">{gcDetail.pills.map((p,i) => <span key={i} className={`pl ${p.c}`}>{p.t}</span>)}</div>
                        </div>
                        <div className="dg">{gcDetail.grid.map((g,i) => (
                          <div key={i} className="dg-i"><div className="k">{g.k}</div><div className="v">{g.v}</div><div className="m">{g.m}</div></div>
                        ))}</div>

                        {/* Submitted file + verify */}
                        {gcDetail.file && (
                          <div className="ds">
                            <div className="ds-h"><h4>Submitted record</h4><div className="ds-acts"><span className="pl accent">1 file</span><button className="btn sm">View file</button></div></div>
                            <div className="ds-b">
                              <div className="fr"><div><h5>{gcDetail.file.name}</h5><p>Uploaded by {gcDetail.file.by} · {gcDetail.file.time}</p></div><div className="fc">{gcDetail.file.size}</div></div>
                              {gcDetail.verify.length > 0 && (
                                <div className="vl">
                                  {gcDetail.verify.map((v,i) => (
                                    <div key={i} className="vi">
                                      <div className={`v-chk ${v.pass?"pass":"fail"}`}>{v.pass ? "✓" : "!"}</div>
                                      <div className="v-lbl">{v.label}<span>{v.detail}</span></div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Missing note */}
                        {gcDetail.missingNote && (
                          <div className="ds">
                            <div className="ds-h"><h4>Submission status</h4><div className="ds-acts"><span className="pl red">Not submitted</span></div></div>
                            <div className="ds-b"><p>{gcDetail.missingNote}</p></div>
                          </div>
                        )}

                        {/* Review decision */}
                        {gcDetail.showReview && (
                          <div className="ds">
                            <div className="ds-h"><h4>Review decision</h4><div className="ds-acts"><span className="mtag">Operational review</span></div></div>
                            <div className="ds-b">
                              <p>The dominant action depends on whether the record satisfies the requirement, needs correction, or is unacceptable.</p>
                              <div className="dec">
                                <h5>Recommended: Accept record</h5>
                                <p>Coverage verification mostly passes. Accepting clears restriction risk and removes the payment hold.</p>
                                <div className="dec-acts">
                                  <button className="btn pri" onClick={() => setAccepted(true)} style={accepted ? {opacity:.6} : {}}>{accepted ? "✓ Accepted" : "Accept record"}</button>
                                  <button className="btn">Request correction</button>
                                  <button className="btn dg-o">Reject record</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Restriction control */}
                        {gcDetail.showRestriction && (
                          <div className="ds restrict">
                            <div className="ds-h"><h4>Restriction control</h4><div className="ds-acts"><span className="pl red">Access consequence</span></div></div>
                            <div className="ds-b">
                              {gcDetail.restrictedNote ? (
                                <div className="rp">
                                  <h5>Restriction active</h5>
                                  <p>{gcDetail.restrictedNote}</p>
                                  <div className="rp-acts"><button className="btn sm">Clear restriction</button></div>
                                </div>
                              ) : (
                                <div className="rp">
                                  <h5>Current: {gcDetail.grid[3]?.v || "At risk"}</h5>
                                  <p>Accepting clears risk + payment hold. Correction keeps vendor at risk. Rejecting may justify restriction.</p>
                                  <div className="dg" style={{marginTop:10}}>
                                    <div className="dg-i" style={{background:"var(--s1)"}}><div className="k">If accepted</div><div className="v">Risk + hold clear</div><div className="m">Payments resume</div></div>
                                    <div className="dg-i" style={{background:"var(--s1)"}}><div className="k">If correction</div><div className="v">Risk stays</div><div className="m">Hold remains</div></div>
                                    <div className="dg-i" style={{background:"var(--s1)"}}><div className="k">If rejected</div><div className="v">May restrict</div><div className="m">Payment blocked</div></div>
                                    <div className="dg-i" style={{background:"var(--s1)"}}><div className="k">Countdown</div><div className="v">{gcDetail.grid[2]?.m || ""}</div><div className="m">Until threshold</div></div>
                                  </div>
                                  <div className="rp-acts"><button className="btn sm">Keep active</button><button className="btn sm dg-f">Apply restriction</button><button className="btn sm">Clear restriction</button></div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right rail */}
                <div className="rail">
                  <div className="rc">
                    <div className="rc-h"><h3>Org compliance scorecard</h3><div className="sub">Per-subcontractor requirement rollup.</div></div>
                    <div className="rc-b">
                      <div className="osc">
                        <div className="o-row"><div className="o-name">Apex Mechanical</div><div className="o-dots"><span className="s-dot danger"/><span className="s-dot filled"/><span className="s-dot empty"/><span className="s-dot empty"/></div><div className="o-lbl">1/4</div></div>
                        <div className="o-row"><div className="o-name">Northline Electrical</div><div className="o-dots"><span className="s-dot filled"/><span className="s-dot filled"/><span className="s-dot danger"/></div><div className="o-lbl">2/3</div></div>
                        <div className="o-row"><div className="o-name">Capital Plumbing</div><div className="o-dots"><span className="s-dot filled"/><span className="s-dot filled"/><span className="s-dot filled"/></div><div className="o-lbl">3/3</div></div>
                      </div>
                    </div>
                  </div>
                  <div className="rc alert">
                    <div className="rc-h"><h3>Payment holds</h3><div className="sub">Compliance-linked payment restrictions.</div></div>
                    <div className="rc-b">
                      <div className="phb"><span style={{color:"var(--wr-t)",flexShrink:0}}>{I.alert}</span><div className="phb-text">2 subs have active payment holds<span>Draws and invoices blocked until compliance clears.</span></div></div>
                      <div style={{marginTop:10}}>
                        <div className="fr"><div><h5>Apex Mechanical</h5><p>Insurance missing · WSIB pending</p></div><div className="fc">Held</div></div>
                        <div className="fr"><div><h5>Northline Electrical</h5><p>Site orientation — restricted</p></div><div className="fc">Held</div></div>
                      </div>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Recent activity</h3><div className="sub">Compliance events on this project.</div></div>
                    <div className="rc-b">
                      <div className="al">
                        <div className="ai"><div className="a-dot action"/><div className="a-text"><strong>Apex</strong> submitted WSIB renewal</div><div className="a-time">23m</div></div>
                        <div className="ai"><div className="a-dot err"/><div className="a-text">System flagged <strong>restriction risk</strong> — Apex insurance</div><div className="a-time">1d</div></div>
                        <div className="ai"><div className="a-dot ok"/><div className="a-text"><strong>Capital Plumbing</strong> safety roster accepted</div><div className="a-time">Today</div></div>
                        <div className="ai"><div className="a-dot sys"/><div className="a-text">Renewal reminder sent to <strong>Apex</strong></div><div className="a-time">5d</div></div>
                        <div className="ai"><div className="a-dot err"/><div className="a-text"><strong>Northline</strong> restricted — orientation lapsed</div><div className="a-time">Apr 3</div></div>
                      </div>
                    </div>
                  </div>
                  <div className="rc info">
                    <div className="rc-h"><h3>Compliance principle</h3><div className="sub">What makes this different from approvals.</div></div>
                    <div className="rc-b"><p>Compliance determines whether a vendor can safely participate. Every review decision has an access-state and payment-hold consequence.</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ SUBCONTRACTOR ═══════ */}
          {portal === "sub" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Compliance</h2>
                  <p>Track what's required, upload records, and submit for GC review. Missing or expired records affect your project access and hold payments.</p>
                  <div className="pg-h-pills">
                    <span className="pl accent">Submission + tracking</span>
                    <span className="pl red">1 missing — restriction risk</span>
                    <span className="pl orange">1 expiring in 6 days</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 4 }}>
                  <button className="btn sm">View accepted</button>
                  <button className="btn sm pri">Upload document</button>
                </div>
              </div>

              <div className="ss">
                <div className="sc danger" onClick={() => setSubSelected("ins")}><div className="sc-label">Missing</div><div className="sc-value">1</div><div className="sc-meta">No valid record on file</div></div>
                <div className="sc alert" onClick={() => setSubSelected("wsib")}><div className="sc-label">Expiring</div><div className="sc-value">1</div><div className="sc-meta">Current record lapses soon</div></div>
                <div className="sc strong" onClick={() => setSubSelected("wsib")}><div className="sc-label">Submitted</div><div className="sc-value">1</div><div className="sc-meta">Waiting on GC review</div></div>
                <div className="sc success" onClick={() => setSubSelected("safety")}><div className="sc-label">Active</div><div className="sc-value">2</div><div className="sc-meta">Accepted and valid</div></div>
              </div>

              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head"><div><h3>Compliance requirements</h3><div className="sub">All requirements for this project. Missing or expiring items need your action.</div></div></div>
                  <div style={{padding:"12px 20px 0"}}>
                    {subReqs.map((r) => (
                      <div key={r.id} className={`rq-row${subSelected===r.id?" on":""}`} onClick={() => setSubSelected(r.id)}>
                        <div className="rq-dot" style={{background: r.dot==="red" ? "var(--dg)" : r.dot==="orange" ? "var(--wr)" : "var(--ok)"}} />
                        <div className="rq-info"><h5>{r.title}</h5><p>{r.status}</p></div>
                        <span className={`pl ${r.pill}`}>{r.status.split("·")[0].trim()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{padding:"16px 20px 20px"}}>
                    {/* Sub detail pane */}
                    {subDetail && (
                      <div className="dp">
                        <div className="dh">
                          <div>
                            <h3>{subDetail.title}</h3>
                            <div className="dh-org">{subDetail.org}</div>
                            <div className="dh-desc">{subDetail.desc}</div>
                          </div>
                          <div className="dh-pills">{subDetail.pills.map((p,i) => <span key={i} className={`pl ${p.c}`}>{p.t}</span>)}</div>
                        </div>
                        <div className="dg">{subDetail.grid.map((g,i) => (
                          <div key={i} className="dg-i"><div className="k">{g.k}</div><div className="v">{g.v}</div><div className="m">{g.m}</div></div>
                        ))}</div>

                        {/* Upload zone */}
                        {subDetail.showUpload && (
                          <div className="ds">
                            <div className="ds-h"><h4>Upload record</h4><div className="ds-acts"><span className="pl red">Required</span></div></div>
                            <div className="ds-b">
                              <div className="uz">
                                <h5>Upload insurance certificate</h5>
                                <p>Drag and drop, or click to browse. PDF, JPG, or PNG.</p>
                                <div className="uz-acts"><button className="btn pri sm">Upload file</button><button className="btn sm">Use project file</button></div>
                              </div>
                              <p style={{marginTop:12,fontSize:12,color:"var(--t3)"}}>Once staged, review before submitting for GC review.</p>
                            </div>
                          </div>
                        )}

                        {/* Submitted file */}
                        {subDetail.submittedFile && (
                          <div className="ds">
                            <div className="ds-h"><h4>Submitted record</h4><div className="ds-acts"><span className="pl accent">Waiting on GC</span></div></div>
                            <div className="ds-b">
                              <div className="fr"><div><h5>{subDetail.submittedFile.name}</h5><p>Submitted {subDetail.submittedFile.time}</p></div><div className="fc">{subDetail.submittedFile.size}</div></div>
                              <p style={{marginTop:10}}>Renewal sent to the GC for review. Restriction risk remains until acceptance.</p>
                            </div>
                          </div>
                        )}

                        {/* Restriction warning */}
                        {subDetail.showRestriction && (
                          <div className="ds restrict">
                            <div className="ds-h"><h4>Why this matters now</h4><div className="ds-acts"><span className="pl red">Access at risk</span></div></div>
                            <div className="ds-b">
                              <div className="rp">
                                <h5>Missing insurance may trigger restricted access</h5>
                                <p>If this record remains missing, the GC may restrict your project participation. Restricted access means limited ability to work and held payments.</p>
                                <div className="rp-acts">
                                  <span className="mtag">Restriction in 2 days</span>
                                  <span className="mtag">Payments held</span>
                                  <span className="mtag">Clear by submitting</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right rail */}
                <div className="rail">
                  <div className="rc danger">
                    <div className="rc-h"><h3>Restriction risk</h3><div className="sub">What could affect your access.</div></div>
                    <div className="rc-b">
                      <div className="mblk"><h4>Insurance certificate — 2 days</h4><p>GC may restrict project participation until a valid certificate is submitted and accepted.</p></div>
                    </div>
                  </div>
                  <div className="rc alert">
                    <div className="rc-h"><h3>Payment hold</h3><div className="sub">Your draws may be affected.</div></div>
                    <div className="rc-b">
                      <div className="phb"><span style={{color:"var(--wr-t)",flexShrink:0}}>{I.alert}</span><div className="phb-text">Payment hold active on your account<span>Draw processing paused until compliance resolves.</span></div></div>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Recent activity</h3><div className="sub">Your compliance events.</div></div>
                    <div className="rc-b">
                      <div className="al">
                        <div className="ai"><div className="a-dot action"/><div className="a-text">You submitted <strong>WSIB renewal</strong></div><div className="a-time">23m</div></div>
                        <div className="ai"><div className="a-dot err"/><div className="a-text">System flagged <strong>restriction risk</strong> — insurance</div><div className="a-time">1d</div></div>
                        <div className="ai"><div className="a-dot sys"/><div className="a-text">Reminder — insurance certificate required</div><div className="a-time">3d</div></div>
                        <div className="ai"><div className="a-dot ok"/><div className="a-text"><strong>Safety roster</strong> accepted by GC</div><div className="a-time">Mar 8</div></div>
                      </div>
                    </div>
                  </div>
                  <div className="rc info">
                    <div className="rc-h"><h3>How compliance works</h3></div>
                    <div className="rc-b"><p>Each record you submit goes to the GC for review. Accepted records clear access and payment holds. Missing or rejected records restrict participation and hold invoices.</p></div>
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
