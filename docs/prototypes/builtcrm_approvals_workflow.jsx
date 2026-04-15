import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
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

// ── Nav data per portal ─────────────────────────────────────────
const navData = {
  contractor: [
    { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Inbox", badge: 8, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 9, bt: "danger" },
      { label: "Approvals", active: true, badge: 5, bt: "warn" }, { label: "Change Orders", badge: 2, bt: "blue" },
      { label: "Billing / Draws" }, { label: "Compliance" }, { label: "Documents" }, { label: "Budget" }, { label: "Schedule" },
    ]},
  ],
  commercial: [
    { section: "Your Project", items: [
      { label: "Project Home" }, { label: "Approvals", active: true, badge: 5, bt: "danger" },
      { label: "Change Orders", badge: 2, bt: "blue" }, { label: "Billing / Draws" },
      { label: "Schedule" }, { label: "Documents" }, { label: "Messages" }, { label: "Payments" },
    ]},
  ],
  residential: [
    { section: "Your Project", items: [
      { label: "Project Home" }, { label: "Selections", badge: 5, bt: "blue" },
      { label: "Photos & Updates" }, { label: "Schedule" },
      { label: "Scope Changes" }, { label: "Decisions", active: true, badge: 1, bt: "warn" },
      { label: "Documents" }, { label: "Messages" }, { label: "Payments" },
    ]},
  ],
};

const portalMeta = {
  contractor: { label: "Contractor Portal", project: "Riverside Tower Fit-Out", page: "Approvals", user: "DC" },
  commercial: { label: "Commercial Client", project: "Riverside Tower Fit-Out", page: "Approvals Center", user: "RH" },
  residential: { label: "Homeowner Portal", project: "The Harrison Residence", page: "Decisions", user: "SH" },
};

// ── Contractor approval data ────────────────────────────────────
const contractorApprovals = [
  { id: "CO-014", type: "co", typeLabel: "Change Order", title: "CO-014 reroute package", desc: "Mechanical reroute needing formal client approval.", status: "Overdue", st: "red", footer: ["+$18,400 · Sent Apr 8", "4 days waiting"] },
  { id: null, type: "procurement", typeLabel: "Procurement", title: "Lobby signage fabrication release", desc: "Final confirmation before fabrication begins.", status: "Due today", st: "orange", footer: ["$12,600 commitment · Sent Apr 10", "2 days"] },
  { id: "CO-013", type: "co", typeLabel: "Change Order", title: "CO-013 electrical panel relocation", desc: "Panel relocation for code compliance.", status: "Pending", st: "accent", footer: ["+$7,200 · Sent Apr 6", "6 days"] },
  { id: null, type: "design", typeLabel: "Design", title: "Reception area finish package", desc: "Material and finish selections for main reception.", status: "Pending", st: "accent", footer: ["No cost impact · Sent Apr 9", "3 days"] },
  { id: null, type: "general", typeLabel: "General", title: "After-hours work authorization", desc: "Weekend work for concrete pour — needs owner OK.", status: "Pending", st: "accent", footer: ["No cost impact · Sent Apr 11", "1 day"] },
];

const commercialApprovals = [
  { id: "CO-014", type: "co", typeLabel: "Change Order", title: "CO-014 mechanical reroute", desc: "HVAC duct path change · +$18,400", status: "Overdue", st: "red", footer: ["High impact · Blocks procurement"] },
  { id: null, type: "procurement", typeLabel: "Procurement", title: "Lobby signage fabrication", desc: "Confirm before fabrication · $12,600", status: "Due today", st: "orange", footer: ["Fabrication timeline affected"] },
  { id: "CO-013", type: "co", typeLabel: "Change Order", title: "CO-013 electrical panel", desc: "Panel relocation · +$7,200", status: "Pending", st: "accent", footer: ["Code compliance required"] },
  { id: null, type: "design", typeLabel: "Design", title: "Reception finish package", desc: "Material and color selections", status: "Pending", st: "accent", footer: ["No cost impact"] },
  { id: null, type: "general", typeLabel: "General", title: "Weekend work authorization", desc: "After-hours concrete pour", status: "Pending", st: "accent", footer: ["Schedule benefit"] },
];

// ── Component ───────────────────────────────────────────────────
export default function ApprovalsWorkflow() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [activeTab, setActiveTab] = useState(0);
  const [selectedDecision, setSelectedDecision] = useState(1);

  const meta = portalMeta[portal];
  const nav = navData[portal];

  return (
    <div className={`ap ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.ap{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
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
.ap.commercial{--ac:#3178b9;--ac-h:#2a6aa3;--ac-s:#e8f1fa;--ac-t:#276299;--ac-m:#b3cede;--shri:0 0 0 3px rgba(49,120,185,.15)}
.ap.residential{--ac:#2a7f6f;--ac-h:#237060;--ac-s:#e6f5f1;--ac-t:#1f6b5c;--ac-m:#b0d9cf;--shri:0 0 0 3px rgba(42,127,111,.18)}
.ap.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
}
.ap.dk.commercial{--ac:#4a94d4;--ac-h:#3d82c0;--ac-s:#141f2c;--ac-t:#6cb0ee;--ac-m:#2a4a60}
.ap.dk.residential{--ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c}
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

/* ── Main ── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.ap.dk .tb{background:rgba(23,26,36,.88)}
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
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.ss.tri{grid-template-columns:repeat(3,1fr)}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.sc.alert{border-color:#f5d5a0}.sc.danger{border-color:#f5baba}.sc.strong{border-color:var(--ac-m)}
.ap.dk .sc.alert{border-color:#5a4420}.ap.dk .sc.danger{border-color:#5a2020}
.sc-label{font-family:var(--fb);font-size:12px;font-weight:560;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--df) var(--e);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.ok{background:var(--ok);border-color:var(--ok);color:white}.btn.ok:hover{background:var(--ok-t)}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.btn.sm{height:32px;padding:0 12px;font-size:12px}.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2)}
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.gray{background:var(--s2);color:var(--t3)}

/* Type badges */
.tb-type{font-family:var(--fd);font-size:10px;font-weight:700;padding:2px 7px;border-radius:var(--r-s);display:inline-flex;align-items:center;white-space:nowrap}
.tb-type.co{background:#f3f0ff;color:#6b5dd3;border:1px solid #d8d0f5}
.tb-type.procurement{background:#e8f5ee;color:#2d7a52;border:1px solid #b5dfca}
.tb-type.design{background:#eef4fa;color:#3d6b8e;border:1px solid #b3cede}
.tb-type.general{background:var(--s2);color:var(--t3);border:1px solid var(--s3)}
.ap.dk .tb-type.co{background:#2a2540;color:#a99ff8;border-color:#3d3660}
.ap.dk .tb-type.procurement{background:#162a1f;color:#5ec494;border-color:#1e4a3c}
.ap.dk .tb-type.design{background:#141f2c;color:#6cb0ee;border-color:#2a4a60}
.ap.dk .tb-type.general{background:var(--s2);color:var(--t3);border-color:var(--s3)}

/* Page grid */
.pg-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:700}.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.md{display:grid;grid-template-columns:360px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}

/* Approval cards */
.tl{display:flex;flex-direction:column;gap:6px;max-height:620px;overflow-y:auto}
.tl::-webkit-scrollbar{width:4px}.tl::-webkit-scrollbar-track{background:transparent}.tl::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ac{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e)}
.ac:hover{border-color:var(--s4);box-shadow:var(--shsm)}.ac.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.ac-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.ac-title{font-family:var(--fd);font-size:13px;font-weight:700;margin-top:2px}
.ac-desc{font-size:12px;color:var(--t2);margin-top:2px;line-height:1.4}
.ac-meta{display:flex;gap:4px;flex-wrap:wrap}
.ac-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;color:var(--t3)}

/* Detail */
.dp{min-height:400px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.dh-desc{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;max-width:480px}
.dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px}
.dg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}
.dg-i{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.dg-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}.dg-i .m{font-size:12px;color:var(--t2);margin-top:2px}
.ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
.ds-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
.ds-h h4{font-family:var(--fd);font-size:13px;font-weight:700}.ds-acts{display:flex;gap:6px}
.ds-b{padding:14px 16px}.ds-b p{font-size:13px;color:var(--t2);line-height:1.55}
.fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}.fr:last-child{border-bottom:none}
.fr h5{font-size:13px;font-weight:600}.fr p{font-size:12px;color:var(--t2);margin-top:1px}
.fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

/* Decision card */
.dec{border:2px solid var(--ac-m);border-radius:var(--r-l);padding:18px;margin-top:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1))}
.dec h4{font-family:var(--fd);font-size:15px;font-weight:750}.dec>p{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5}
.dec-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.d-opt{border:2px solid var(--s3);border-radius:var(--r-m);padding:12px;cursor:pointer;transition:all var(--dn) var(--e);text-align:center}
.d-opt:hover{border-color:var(--s4)}.d-opt.on{border-color:var(--ac);background:var(--ac-s)}
.d-opt h5{font-family:var(--fd);font-size:13px;font-weight:700}.d-opt p{font-size:11px;color:var(--t2);margin-top:3px}
.dec textarea{width:100%;min-height:60px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;font-size:13px;resize:vertical;outline:none;background:var(--s1);color:var(--t1);font-family:var(--fb);margin-top:12px}
.dec textarea:focus{border-color:var(--ac-m);box-shadow:var(--shri)}

/* Impact card */
.ic{background:var(--s1);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:16px;margin-top:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1))}
.ic h4{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:10px}
.ir{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}.ir:last-child{border-bottom:none}
.ir h5{font-size:13px;font-weight:600}.ir p{font-size:12px;color:var(--t2);margin-top:1px}
.iv{font-family:var(--fd);font-size:14px;font-weight:750;white-space:nowrap;flex-shrink:0}

/* Activity */
.al{display:flex;flex-direction:column}
.ai{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}.ai:last-child{border-bottom:none}
.a-dot{width:8px;height:8px;border-radius:50%;background:var(--s4);margin-top:6px;flex-shrink:0}
.a-dot.action{background:var(--ac)}.a-dot.ok{background:var(--ok)}.a-dot.sys{background:var(--t3)}
.a-text{flex:1;font-size:13px;color:var(--t2)}.a-text strong{color:var(--t1);font-weight:650}
.a-time{font-size:11px;color:var(--t3);flex-shrink:0;padding-top:2px}

/* Rail */
.rail{display:flex;flex-direction:column;gap:12px}
.rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.rc.alert{border-color:#f5d5a0}.rc.danger{border-color:#f5baba}
.ap.dk .rc.alert{border-color:#5a4420}.ap.dk .rc.danger{border-color:#5a2020}
.rc-h{padding:14px 16px 0}.rc-h h3{font-family:var(--fd);font-size:14px;font-weight:700}.rc-h .sub{font-size:12px;color:var(--t3);margin-top:2px}
.rc-b{padding:10px 16px 16px}

/* Residential approval cards */
.rac{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:18px 20px;box-shadow:var(--shsm);margin-bottom:12px}
.rac.pending{border-color:var(--ac-m);border-width:2px}
.rac h3{font-family:var(--fd);font-size:16px;font-weight:700}.rac .rd{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5}
.re{margin-top:12px;padding:12px 14px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-m)}
.re h5{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--ac-t)}.re p{font-size:13px;color:var(--t2);margin-top:3px;line-height:1.5}
.ri{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.ri-i{background:var(--s2);border-radius:var(--r-m);padding:10px 12px}
.ri-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.ri-i .v{font-family:var(--fd);font-size:16px;font-weight:750;margin-top:3px}

/* Responsive */
@media(max-width:1200px){.pg-grid{grid-template-columns:1fr}.md{grid-template-columns:1fr}}
@media(max-width:900px){.ap{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand"><Logo /><div><h1>BuiltCRM</h1><div className="brand-ctx">{meta.label}</div></div></div>
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

      {/* ── Main ── */}
      <main className="mn">
        <div className="tb">
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
            {[["contractor","#5b4fc7","Contractor"],["commercial","#3178b9","Commercial Client"],["residential","#2a7f6f","Residential Client"]].map(([k,c,l]) => (
              <button key={k} className={portal === k ? "on" : ""} onClick={() => { setPortal(k); setActiveTab(0); setSelectedDecision(1); }}>
                <span className="p-dot" style={{ background: c }} />{l}
              </button>
            ))}
          </div>

          {/* ═══════ CONTRACTOR ═══════ */}
          {portal === "contractor" && (
            <div className="fade-up">
              <div className="pg-h">
                <div><h2>Approvals</h2><p>Track approval requests sent to clients for review. Monitor decisions across change orders, procurement releases, and design packages.</p></div>
                <div style={{ display: "flex", gap: 8, paddingTop: 4 }}><button className="btn sm pri">+ New approval request</button></div>
              </div>
              <div className="ss">
                <div className="sc danger"><div className="sc-label">Waiting on client</div><div className="sc-value">5</div><div className="sc-meta">Decisions pending</div></div>
                <div className="sc alert"><div className="sc-label">Overdue</div><div className="sc-value">1</div><div className="sc-meta">Past review deadline</div></div>
                <div className="sc strong"><div className="sc-label">Approved this month</div><div className="sc-value">4</div><div className="sc-meta">Closed cleanly</div></div>
                <div className="sc"><div className="sc-label">Returned</div><div className="sc-value">1</div><div className="sc-meta">Needs revision</div></div>
              </div>
              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head"><div><h3>Approval workspace</h3><div className="sub">Cross-type queue — COs, procurement releases, design packages, and other items needing client sign-off.</div></div></div>
                  <div className="ws-tabs">
                    {["Pending (5)","Approved (4)","Returned (1)","All"].map((t,i) => (
                      <button key={t} className={`wtab${activeTab===i?" on":""}`} onClick={() => setActiveTab(i)}>{t}</button>
                    ))}
                  </div>
                  <div className="md">
                    <div><div className="tl">
                      {contractorApprovals.map((a,i) => (
                        <div key={i} className={`ac${i===0?" on":""}`}>
                          <div className="ac-top">
                            <div style={{flex:1,minWidth:0}}>
                              <div className="ac-meta"><span className={`tb-type ${a.type}`}>{a.typeLabel}</span></div>
                              <div className="ac-title">{a.title}</div>
                              <div className="ac-desc">{a.desc}</div>
                            </div>
                            <span className={`pl ${a.st}`}>{a.status}</span>
                          </div>
                          <div className="ac-foot">{a.footer.map((f,j) => <span key={j}>{f}</span>)}</div>
                        </div>
                      ))}
                    </div></div>

                    {/* Detail pane: CO-014 */}
                    <div className="dp">
                      <div className="dh">
                        <div>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}><span className="tb-type co">Change Order</span><span style={{fontFamily:"var(--fm)",fontSize:11,color:"var(--t3)"}}>CO-014</span></div>
                          <h3>Mechanical reroute — east corridor</h3>
                          <div className="dh-desc">Submitted for client approval Apr 8. HVAC duct reroute caused by structural conflict. Currently overdue — client has not responded.</div>
                        </div>
                        <div className="dh-pills"><span className="pl red">Overdue</span></div>
                      </div>
                      <div className="dg">
                        <div className="dg-i"><div className="k">Sent to</div><div className="v">Riverside Holdings</div><div className="m">Commercial client</div></div>
                        <div className="dg-i"><div className="k">Review due</div><div className="v" style={{color:"var(--dg-t)"}}>Apr 10 (overdue)</div><div className="m">2 days past deadline</div></div>
                        <div className="dg-i"><div className="k">Cost impact</div><div className="v" style={{color:"var(--wr-t)"}}>+$18,400</div><div className="m">Contract addition</div></div>
                        <div className="dg-i"><div className="k">What's blocked</div><div className="v">Procurement release</div><div className="m">Can't order materials without approval</div></div>
                      </div>

                      <div className="ds">
                        <div className="ds-h"><h4>Tracking</h4><div className="ds-acts"><button className="btn sm">Send reminder</button><button className="btn sm">Edit request</button></div></div>
                        <div className="ds-b">
                          <div className="al">
                            <div className="ai"><div className="a-dot action" /><div className="a-text"><strong>Daniel Chen</strong> submitted approval request to Riverside Holdings</div><div className="a-time">Apr 8</div></div>
                            <div className="ai"><div className="a-dot sys" /><div className="a-text">Client notified via email</div><div className="a-time">Apr 8</div></div>
                            <div className="ai"><div className="a-dot sys" /><div className="a-text">Review deadline reached — no response</div><div className="a-time">Apr 10</div></div>
                            <div className="ai"><div className="a-dot sys" /><div className="a-text">Automated reminder sent to client</div><div className="a-time">Apr 11</div></div>
                          </div>
                        </div>
                      </div>

                      <div className="ds">
                        <div className="ds-h"><h4>Supporting documents sent</h4></div>
                        <div className="ds-b">
                          <div className="fr"><div><h5>CO-014 cost breakdown</h5><p>Itemized estimate</p></div><span className="fc">PDF</span></div>
                          <div className="fr"><div><h5>Revised mechanical routing plan</h5><p>Updated duct layout</p></div><span className="fc">DWG</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right rail */}
                <div className="rail">
                  <div className="rc danger">
                    <div className="rc-h"><h3>Overdue</h3><div className="sub">Past review deadline.</div></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>CO-014 reroute</h5><p>+$18,400 · 2 days overdue</p></div></div>
                      <button className="btn sm pri" style={{width:"100%",marginTop:8}}>Send escalation</button>
                    </div>
                  </div>
                  <div className="rc alert">
                    <div className="rc-h"><h3>Due soon</h3></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>Lobby signage</h5><p>$12,600 · Due today</p></div><span className="pl orange" style={{fontSize:9}}>Today</span></div>
                    </div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>By type</h3></div>
                    <div className="rc-b">
                      <div className="fr"><div><h5>Change Orders</h5><p>2 pending</p></div><span className="tb-type co">CO</span></div>
                      <div className="fr"><div><h5>Procurement</h5><p>1 pending</p></div><span className="tb-type procurement">Proc</span></div>
                      <div className="fr"><div><h5>Design</h5><p>1 pending</p></div><span className="tb-type design">Design</span></div>
                      <div className="fr"><div><h5>General</h5><p>1 pending</p></div><span className="tb-type general">Other</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ COMMERCIAL CLIENT ═══════ */}
          {portal === "commercial" && (
            <div className="fade-up">
              <div className="pg-h"><div><h2>Approvals Center</h2><p>Items from your contractor that need your formal review and decision. Review the impact, then approve, reject, or request more information.</p></div></div>
              <div className="ss">
                <div className="sc danger"><div className="sc-label">Needs your decision</div><div className="sc-value">5</div><div className="sc-meta">Waiting on you</div></div>
                <div className="sc alert"><div className="sc-label">Overdue review</div><div className="sc-value">1</div><div className="sc-meta">Past requested deadline</div></div>
                <div className="sc"><div className="sc-label">Approved to date</div><div className="sc-value">7</div><div className="sc-meta">This project</div></div>
                <div className="sc"><div className="sc-label">Returned</div><div className="sc-value">1</div><div className="sc-meta">Sent back for revision</div></div>
              </div>
              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head"><div><h3>Decision queue</h3><div className="sub">All items awaiting your review, sorted by urgency.</div></div></div>
                  <div className="ws-tabs">
                    {["Pending (5)","Approved (7)","Returned (1)"].map((t,i) => (
                      <button key={t} className={`wtab${activeTab===i?" on":""}`} onClick={() => setActiveTab(i)}>{t}</button>
                    ))}
                  </div>
                  <div className="md">
                    <div><div className="tl">
                      {commercialApprovals.map((a,i) => (
                        <div key={i} className={`ac${i===0?" on":""}`}>
                          <div className="ac-top">
                            <div style={{flex:1,minWidth:0}}>
                              <div className="ac-meta"><span className={`tb-type ${a.type}`}>{a.typeLabel}</span></div>
                              <div className="ac-title">{a.title}</div>
                              <div className="ac-desc">{a.desc}</div>
                            </div>
                            <span className={`pl ${a.st}`}>{a.status}</span>
                          </div>
                          <div className="ac-foot">{a.footer.map((f,j) => <span key={j}>{f}</span>)}</div>
                        </div>
                      ))}
                    </div></div>

                    {/* Detail: CO-014 commercial view */}
                    <div className="dp">
                      <div className="dh">
                        <div>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}><span className="tb-type co">Change Order</span><span style={{fontFamily:"var(--fm)",fontSize:11,color:"var(--t3)"}}>CO-014</span></div>
                          <h3>Mechanical reroute — east corridor</h3>
                          <div className="dh-desc">Your contractor is requesting approval for an HVAC duct reroute caused by a structural conflict. This adds cost and may delay work if not approved soon.</div>
                        </div>
                        <div className="dh-pills"><span className="pl red">Overdue</span></div>
                      </div>
                      <div className="dg">
                        <div className="dg-i"><div className="k">Cost impact</div><div className="v" style={{color:"var(--wr-t)"}}>+$18,400</div><div className="m">Added to contract</div></div>
                        <div className="dg-i"><div className="k">Schedule risk</div><div className="v" style={{color:"var(--wr-t)"}}>+3 days</div><div className="m">If not approved now</div></div>
                        <div className="dg-i"><div className="k">Requested by</div><div className="v">Daniel Chen</div><div className="m">Contractor PM</div></div>
                        <div className="dg-i"><div className="k">What it blocks</div><div className="v">Material ordering</div><div className="m">Procurement can't proceed</div></div>
                      </div>

                      <div className="ds">
                        <div className="ds-h"><h4>Contractor's explanation</h4></div>
                        <div className="ds-b"><p>A structural beam offset was discovered at level 3 that doesn't match coordination drawings. The HVAC ductwork needs to be rerouted around this condition. The cost covers additional materials, labor, and trade coordination. This has been reviewed against other trades and creates no new conflicts.</p></div>
                      </div>

                      <div className="ds">
                        <div className="ds-h"><h4>Supporting documents</h4></div>
                        <div className="ds-b">
                          <div className="fr"><div><h5>CO-014 cost breakdown</h5><p>Itemized estimate for the reroute</p></div><span className="fc">PDF</span></div>
                          <div className="fr"><div><h5>Revised mechanical routing plan</h5><p>Updated duct layout drawing</p></div><span className="fc">DWG</span></div>
                        </div>
                      </div>

                      {/* Formal decision card */}
                      <div className="dec">
                        <h4>Your decision</h4>
                        <p>Choose how you'd like to respond to this approval request.</p>
                        <div className="dec-opts">
                          {[
                            { label: "Approve", sub: "Proceed as submitted", color: "var(--ok-t)" },
                            { label: "Approve with note", sub: "Approve with a condition", color: "var(--ac-t)" },
                            { label: "Return for revision", sub: "Send back with feedback", color: "var(--dg-t)" },
                          ].map((opt, i) => (
                            <div key={i} className={`d-opt${selectedDecision===i?" on":""}`} onClick={() => setSelectedDecision(i)}>
                              <h5 style={{color:opt.color}}>{opt.label}</h5>
                              <p>{opt.sub}</p>
                            </div>
                          ))}
                        </div>
                        <textarea placeholder="Add your review note or condition…" defaultValue="Include updated release documentation in the closeout packet." />
                        <div style={{display:"flex",gap:8,marginTop:12}}>
                          <button className="btn pri">Submit decision</button>
                          <button className="btn">Cancel</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right rail */}
                <div className="rail">
                  <div className="rc danger">
                    <div className="rc-h"><h3>Needs attention</h3><div className="sub">Review deadline passed.</div></div>
                    <div className="rc-b"><p style={{fontSize:13,color:"var(--t2)"}}>CO-014 was due for review on Apr 10. Your contractor is waiting on your decision to release procurement.</p></div>
                  </div>
                  <div className="rc">
                    <div className="rc-h"><h3>Pending cost impact</h3></div>
                    <div className="rc-b">
                      <div className="ir"><div><h5>If all pending approved</h5></div><span className="iv" style={{color:"var(--wr-t)"}}>+$25,600</span></div>
                      <div className="ir"><div><h5>Current contract</h5></div><span className="iv">$1,257,000</span></div>
                      <div className="ir"><div><h5>Projected total</h5></div><span className="iv">$1,282,600</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ RESIDENTIAL CLIENT — "Decisions Needed" ═══════ */}
          {portal === "residential" && (
            <div className="fade-up">
              <div className="pg-h"><div><h2>Decisions Needed</h2><p>Your builder occasionally needs your OK on something before they can move forward. Nothing complicated — just a quick review and your go-ahead.</p></div></div>
              <div className="ss tri">
                <div className="sc danger"><div className="sc-label">Needs your OK</div><div className="sc-value">1</div><div className="sc-meta">Take a look when you can</div></div>
                <div className="sc"><div className="sc-label">Already approved</div><div className="sc-value">3</div><div className="sc-meta">All set</div></div>
                <div className="sc"><div className="sc-label">Total project</div><div className="sc-value">4</div><div className="sc-meta">Decisions so far</div></div>
              </div>

              {/* Pending decision */}
              <div className="rac pending">
                <span className="pl red" style={{marginBottom:8,display:"inline-flex"}}>Needs your OK</span>
                <h3>Weekend work for concrete pour</h3>
                <div className="rd">Your builder is asking if it's OK to do some work on Saturday morning. This would help keep the project on schedule by getting the foundation pour done before Monday's inspection.</div>

                <div className="re">
                  <h5>Why they're asking</h5>
                  <p>The concrete crew has a weather window on Saturday that would let them complete the pour in ideal conditions. Working during the week would push the inspection back and could add a few days to the timeline. There's no extra cost — this is about scheduling, not money.</p>
                </div>

                <div className="ri">
                  <div className="ri-i"><div className="k">Cost</div><div className="v" style={{color:"var(--ok-t)"}}>No change</div></div>
                  <div className="ri-i"><div className="k">Schedule benefit</div><div className="v" style={{color:"var(--ok-t)"}}>Saves 2–3 days</div></div>
                </div>

                <div style={{display:"flex",gap:8,marginTop:16}}>
                  <button className="btn pri">Sounds good — approve</button>
                  <button className="btn">I have a question</button>
                </div>
              </div>

              {/* Already approved */}
              <div style={{fontFamily:"var(--fd)",fontSize:14,fontWeight:700,margin:"24px 0 10px"}}>Already approved</div>

              <div className="rac" style={{opacity:.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><h3 style={{fontSize:15}}>Foundation material substitution</h3><div className="rd">Your builder swapped to a locally-available concrete mix that performs the same but ships faster.</div></div>
                  <span className="pl green">Approved</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:8,fontSize:13,color:"var(--t2)"}}>
                  <span>Cost: <strong style={{color:"var(--ok-t)"}}>No change</strong></span>
                  <span>Approved: <strong>Apr 2</strong></span>
                </div>
              </div>

              <div className="rac" style={{opacity:.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><h3 style={{fontSize:15}}>Extra insulation in attic space</h3><div className="rd">Added R-30 insulation in the attic for better energy performance.</div></div>
                  <span className="pl green">Approved</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:8,fontSize:13,color:"var(--t2)"}}>
                  <span>Cost: <strong style={{color:"var(--wr-t)"}}>+$800</strong></span>
                  <span>Approved: <strong>Mar 25</strong></span>
                </div>
              </div>

              <div className="rac" style={{opacity:.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><h3 style={{fontSize:15}}>Electrical panel upgrade</h3><div className="rd">Upgraded to a 200A panel to support your planned EV charger installation.</div></div>
                  <span className="pl green">Approved</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:8,fontSize:13,color:"var(--t2)"}}>
                  <span>Cost: <strong style={{color:"var(--wr-t)"}}>+$1,200</strong></span>
                  <span>Approved: <strong>Mar 18</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
