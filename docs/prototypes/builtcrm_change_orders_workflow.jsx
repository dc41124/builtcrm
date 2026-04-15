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
      { label: "Approvals", badge: 5, bt: "blue" }, { label: "Change Orders", active: true, badge: 2, bt: "warn" },
      { label: "Billing / Draws" }, { label: "Compliance" }, { label: "Documents" }, { label: "Budget" }, { label: "Schedule" },
    ]},
  ],
  commercial: [
    { section: "Your Project", items: [
      { label: "Project Home" }, { label: "Approvals", badge: 3, bt: "danger" },
      { label: "Change Orders", active: true, badge: 2, bt: "warn" }, { label: "Billing / Draws" },
      { label: "Schedule" }, { label: "Documents" }, { label: "Messages" }, { label: "Payments" },
    ]},
  ],
  residential: [
    { section: "Your Project", items: [
      { label: "Project Home" }, { label: "Selections", badge: 5, bt: "blue" },
      { label: "Photos & Updates" }, { label: "Schedule" },
      { label: "Scope Changes", active: true, badge: 1, bt: "warn" },
      { label: "Documents" }, { label: "Messages" }, { label: "Payments" },
    ]},
  ],
};

const portalMeta = {
  contractor: { label: "Contractor Portal", project: "Riverside Tower Fit-Out", page: "Change Orders", user: "DC" },
  commercial: { label: "Commercial Client", project: "Riverside Tower Fit-Out", page: "Change Orders", user: "RH" },
  residential: { label: "Homeowner Portal", project: "The Harrison Residence", page: "Scope Changes", user: "SH" },
};

// ── Contractor CO data ──────────────────────────────────────────
const contractorCOs = [
  { id: "CO-014", title: "Mechanical reroute — east corridor", status: "Pending approval", st: "orange", amount: "+$18,400", amtType: "add", footer: ["Submitted Apr 8", "Client review"], detail: true },
  { id: "CO-013", title: "Electrical panel relocation", status: "Pending approval", st: "orange", amount: "+$7,200", amtType: "add", footer: ["Submitted Apr 6", "Client review"] },
  { id: "CO-012", title: "Fireproofing scope reduction", status: "Approved", st: "green", amount: "−$4,800", amtType: "deduct", footer: ["Approved Apr 2", "SOV updated"] },
  { id: "CO-011", title: "Additional ceiling access panels", status: "Approved", st: "green", amount: "+$3,200", amtType: "add", footer: ["Approved Mar 28"] },
  { id: "CO-010", title: "Lobby finish upgrade", status: "Approved", st: "green", amount: "+$18,600", amtType: "add", footer: ["Approved Mar 20"] },
  { id: "CO-015", title: "Plumbing rough-in adjustment", status: "Draft", st: "gray", amount: "+$2,400", amtType: "add", footer: ["Created Apr 11", "Not yet submitted"] },
];

const commercialCOs = [
  { id: "CO-014", title: "Mechanical reroute — east corridor", status: "Review", st: "red", amount: "+$18,400", amtType: "add", footer: ["Submitted Apr 8", "High impact"], detail: true },
  { id: "CO-013", title: "Electrical panel relocation", status: "Review", st: "orange", amount: "+$7,200", amtType: "add", footer: ["Submitted Apr 6"] },
];

// ── Component ───────────────────────────────────────────────────
export default function ChangeOrdersWorkflow() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [activeTab, setActiveTab] = useState(0);

  const meta = portalMeta[portal];
  const nav = navData[portal];

  return (
    <div className={`co ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.co{
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
.co.commercial{--ac:#3178b9;--ac-h:#2a6aa3;--ac-s:#e8f1fa;--ac-t:#276299;--ac-m:#b3cede;--shri:0 0 0 3px rgba(49,120,185,.15)}
.co.residential{--ac:#2a7f6f;--ac-h:#237060;--ac-s:#e6f5f1;--ac-t:#1f6b5c;--ac-m:#b0d9cf;--shri:0 0 0 3px rgba(42,127,111,.18)}
.co.dk{
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
.co.dk.commercial{--ac:#4a94d4;--ac-h:#3d82c0;--ac-s:#141f2c;--ac-t:#6cb0ee;--ac-m:#2a4a60}
.co.dk.residential{--ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c}
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
.co.dk .tb{background:rgba(23,26,36,.88)}
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
.co.dk .sc.alert{border-color:#5a4420}.co.dk .sc.danger{border-color:#5a2020}
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

/* Page grid */
.pg-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:700}.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.md{display:grid;grid-template-columns:340px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}

/* CO cards */
.tl{display:flex;flex-direction:column;gap:6px;max-height:620px;overflow-y:auto}
.tl::-webkit-scrollbar{width:4px}.tl::-webkit-scrollbar-track{background:transparent}.tl::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.cc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e)}
.cc:hover{border-color:var(--s4);box-shadow:var(--shsm)}.cc.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.cc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.cc-id{font-family:var(--fm);font-size:11px;color:var(--t3)}.cc-title{font-family:var(--fd);font-size:13px;font-weight:700;margin-top:2px}
.cc-amt{font-family:var(--fd);font-size:14px;font-weight:750;margin-top:6px}.cc-amt.add{color:var(--wr-t)}.cc-amt.deduct{color:var(--ok-t)}
.cc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;color:var(--t3)}

/* Detail */
.dp{min-height:400px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.dh-id{font-family:var(--fm);font-size:12px;color:var(--t3);margin-top:2px}
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

/* Impact card */
.ic{background:var(--s1);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:16px;margin-top:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1))}
.ic h4{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:10px}
.ir{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}.ir:last-child{border-bottom:none}
.ir h5{font-size:13px;font-weight:600}.ir p{font-size:12px;color:var(--t2);margin-top:1px}
.iv{font-family:var(--fd);font-size:14px;font-weight:750;white-space:nowrap;flex-shrink:0}

/* Decision card */
.dec{border:2px solid var(--ac-m);border-radius:var(--r-l);padding:18px;margin-top:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1))}
.dec h4{font-family:var(--fd);font-size:15px;font-weight:750}.dec p{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5}
.dec-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.dec-acts .btn{flex:1;min-width:120px}

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
.rc.alert{border-color:#f5d5a0}.co.dk .rc.alert{border-color:#5a4420}
.rc-h{padding:14px 16px 0}.rc-h h3{font-family:var(--fd);font-size:14px;font-weight:700}.rc-h .sub{font-size:12px;color:var(--t3);margin-top:2px}
.rc-b{padding:10px 16px 16px}

/* Residential scope cards */
.scc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:18px 20px;box-shadow:var(--shsm);margin-bottom:12px}
.scc.pending{border-color:var(--ac-m);border-width:2px}
.scc h3{font-family:var(--fd);font-size:16px;font-weight:700}.scc .sd{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5}
.si{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.si-i{background:var(--s2);border-radius:var(--r-m);padding:10px 12px}
.si-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.si-i .v{font-family:var(--fd);font-size:16px;font-weight:750;margin-top:3px}.si-i .m{font-size:12px;color:var(--t2);margin-top:2px}
.se{margin-top:14px;padding:14px 16px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-m)}
.se h5{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--ac-t)}.se p{font-size:13px;color:var(--t2);margin-top:4px;line-height:1.5}

/* Responsive */
@media(max-width:1200px){.pg-grid{grid-template-columns:1fr}.md{grid-template-columns:1fr}}
@media(max-width:900px){.co{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}
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
              <button key={k} className={portal === k ? "on" : ""} onClick={() => { setPortal(k); setActiveTab(0); }}>
                <span className="p-dot" style={{ background: c }} />{l}
              </button>
            ))}
          </div>

          {/* ═══════ CONTRACTOR ═══════ */}
          {portal === "contractor" && (
            <div className="fade-up">
              <div className="pg-h">
                <div><h2>Change Orders</h2><p>Create, track, and manage scope changes. Submit to the client for formal approval when ready.</p></div>
                <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                  <button className="btn sm">Export</button>
                  <button className="btn sm pri">+ New change order</button>
                </div>
              </div>
              <div className="ss">
                <div className="sc"><div className="sc-label">Total COs</div><div className="sc-value">6</div><div className="sc-meta">This project</div></div>
                <div className="sc alert"><div className="sc-label">Pending approval</div><div className="sc-value">2</div><div className="sc-meta">Waiting on client</div></div>
                <div className="sc strong"><div className="sc-label">Net change</div><div className="sc-value">+$42,600</div><div className="sc-meta">Additions to contract</div></div>
                <div className="sc"><div className="sc-label">Approved</div><div className="sc-value">3</div><div className="sc-meta">Incorporated into SOV</div></div>
              </div>
              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head"><div><h3>Change order workspace</h3><div className="sub">Full lifecycle from draft through client approval.</div></div></div>
                  <div className="ws-tabs">
                    {["All (6)","Pending approval (2)","Draft (1)","Approved (3)"].map((t,i) => (
                      <button key={t} className={`wtab${activeTab===i?" on":""}`} onClick={() => setActiveTab(i)}>{t}</button>
                    ))}
                  </div>
                  <div className="md">
                    <div><div className="tl">
                      {contractorCOs.map((c,i) => (
                        <div key={c.id} className={`cc${i===0?" on":""}`}>
                          <div className="cc-top"><div style={{flex:1,minWidth:0}}><div className="cc-id">{c.id}</div><div className="cc-title">{c.title}</div></div><span className={`pl ${c.st}`}>{c.status}</span></div>
                          <div className={`cc-amt ${c.amtType}`}>{c.amount}</div>
                          <div className="cc-foot">{c.footer.map((f,j) => <span key={j}>{f}</span>)}</div>
                        </div>
                      ))}
                    </div></div>
                    <div className="dp">
                      <div className="dh"><div><div className="dh-id">CO-014</div><h3>Mechanical reroute — east corridor</h3><div className="dh-desc">HVAC ductwork must be rerouted around a structural conflict in the east service corridor. This originated from RFI-018.</div></div><div className="dh-pills"><span className="pl orange">Pending approval</span><span className="pl accent">Client visible</span></div></div>
                      <div className="dg">
                        <div className="dg-i"><div className="k">Status</div><div className="v">Pending client approval</div><div className="m">Submitted Apr 8</div></div>
                        <div className="dg-i"><div className="k">Cost impact</div><div className="v" style={{color:"var(--wr-t)"}}>+$18,400</div><div className="m">Addition to contract</div></div>
                        <div className="dg-i"><div className="k">Schedule impact</div><div className="v" style={{color:"var(--wr-t)"}}>+3 days risk</div><div className="m">If not approved this week</div></div>
                        <div className="dg-i"><div className="k">Originated from</div><div className="v" style={{color:"var(--ac-t)"}}>RFI-018</div><div className="m">Beam offset conflict</div></div>
                      </div>
                      <div className="ds"><div className="ds-h"><h4>Reason & justification</h4></div><div className="ds-b"><p>During structural coordination, a beam offset conflict was identified at grid E-4 on level 3 (documented in RFI-018). The mechanical duct path must be rerouted around the as-built beam location. This adds material, labor, and coordination time for the mechanical trade. The revised path has been coordinated with electrical and fire protection and does not create new conflicts.</p></div></div>
                      <div className="ds"><div className="ds-h"><h4>Supporting documents</h4><div className="ds-acts"><button className="btn sm">Attach file</button></div></div><div className="ds-b">
                        <div className="fr"><div><h5>CO-014 cost breakdown</h5><p>Itemized cost estimate for mechanical reroute</p></div><span className="fc">PDF</span></div>
                        <div className="fr"><div><h5>Revised mechanical routing plan</h5><p>Updated duct path showing rerouted layout</p></div><span className="fc">DWG</span></div>
                        <div className="fr"><div><h5>RFI-018 resolution summary</h5><p>Context from the originating RFI</p></div><span className="fc">PDF</span></div>
                      </div></div>
                      <div className="ds"><div className="ds-h"><h4>Approval timeline</h4></div><div className="ds-b"><div className="al">
                        <div className="ai"><div className="a-dot action"/><div className="a-text"><strong>Daniel Chen</strong> created CO-014 from RFI-018</div><div className="a-time">Apr 7</div></div>
                        <div className="ai"><div className="a-dot action"/><div className="a-text"><strong>Daniel Chen</strong> submitted for client review</div><div className="a-time">Apr 8</div></div>
                        <div className="ai"><div className="a-dot sys"/><div className="a-text">Client notified — <strong>Riverside Holdings</strong></div><div className="a-time">Apr 8</div></div>
                        <div className="ai"><div className="a-dot sys"/><div className="a-text">Pending — no response yet (4 days)</div><div className="a-time">Apr 12</div></div>
                      </div></div></div>
                    </div>
                  </div>
                </div>
                <div className="rail">
                  <div className="rc alert"><div className="rc-h"><h3>Awaiting decisions</h3><div className="sub">COs pending client approval.</div></div><div className="rc-b">
                    <div className="fr"><div><h5>CO-014</h5><p>+$18,400 · Mechanical reroute</p></div><span className="pl orange" style={{fontSize:10}}>4 days</span></div>
                    <div className="fr"><div><h5>CO-013</h5><p>+$7,200 · Electrical panel</p></div><span className="pl orange" style={{fontSize:10}}>6 days</span></div>
                  </div></div>
                  <div className="rc"><div className="rc-h"><h3>Contract summary</h3></div><div className="rc-b">
                    <div className="ir"><div><h5>Original contract</h5></div><span className="iv">$1,240,000</span></div>
                    <div className="ir"><div><h5>Approved changes</h5></div><span className="iv" style={{color:"var(--wr-t)"}}>+$17,000</span></div>
                    <div className="ir"><div><h5>Pending changes</h5></div><span className="iv" style={{color:"var(--t3)"}}>+$25,600</span></div>
                    <div className="ir" style={{borderTop:"2px solid var(--s3)",paddingTop:10}}><div><h5>Current contract value</h5></div><span className="iv">$1,257,000</span></div>
                  </div></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ COMMERCIAL CLIENT ═══════ */}
          {portal === "commercial" && (
            <div className="fade-up">
              <div className="pg-h"><div><h2>Change Orders for Review</h2><p>Your contractor has submitted scope changes that need your approval. Review the cost and schedule impact, then approve, reject, or request clarification.</p></div></div>
              <div className="ss">
                <div className="sc danger"><div className="sc-label">Needs your review</div><div className="sc-value">2</div><div className="sc-meta">Decisions waiting on you</div></div>
                <div className="sc alert"><div className="sc-label">Pending total</div><div className="sc-value">+$25,600</div><div className="sc-meta">If all approved</div></div>
                <div className="sc"><div className="sc-label">Approved to date</div><div className="sc-value">+$17,000</div><div className="sc-meta">3 change orders</div></div>
                <div className="sc"><div className="sc-label">Current contract</div><div className="sc-value">$1,257,000</div><div className="sc-meta">Original + approved changes</div></div>
              </div>
              <div className="pg-grid">
                <div className="ws">
                  <div className="ws-head"><div><h3>Review queue</h3><div className="sub">Change orders submitted by your contractor for your formal approval.</div></div></div>
                  <div className="ws-tabs">
                    {["Pending review (2)","Approved (3)","Rejected"].map((t,i) => (
                      <button key={t} className={`wtab${activeTab===i?" on":""}`} onClick={() => setActiveTab(i)}>{t}</button>
                    ))}
                  </div>
                  <div className="md">
                    <div><div className="tl">
                      {commercialCOs.map((c,i) => (
                        <div key={c.id} className={`cc${i===0?" on":""}`}>
                          <div className="cc-top"><div style={{flex:1,minWidth:0}}><div className="cc-id">{c.id}</div><div className="cc-title">{c.title}</div></div><span className={`pl ${c.st}`}>{c.status}</span></div>
                          <div className={`cc-amt ${c.amtType}`}>{c.amount}</div>
                          <div className="cc-foot">{c.footer.map((f,j) => <span key={j}>{f}</span>)}</div>
                        </div>
                      ))}
                    </div></div>
                    <div className="dp">
                      <div className="dh"><div><div className="dh-id">CO-014</div><h3>Mechanical reroute — east corridor</h3><div className="dh-desc">Your contractor is requesting approval for an HVAC duct reroute caused by a structural conflict. This affects project cost and may affect schedule if delayed.</div></div><div className="dh-pills"><span className="pl red">Needs your approval</span></div></div>
                      <div className="ic"><h4>Impact of this change</h4>
                        <div className="ir"><div><h5>Cost impact</h5><p>Addition to your current contract value</p></div><span className="iv" style={{color:"var(--wr-t)",fontSize:18}}>+$18,400</span></div>
                        <div className="ir"><div><h5>Schedule risk</h5><p>If not approved this week, mechanical work may slip</p></div><span className="iv" style={{color:"var(--wr-t)"}}>+3 days risk</span></div>
                        <div className="ir"><div><h5>What triggered this</h5><p>Structural conflict found during coordination (RFI-018)</p></div><span className="iv" style={{color:"var(--ac-t)"}}>RFI-018</span></div>
                      </div>
                      <div className="ds"><div className="ds-h"><h4>Contractor's explanation</h4></div><div className="ds-b"><p>A beam offset at grid E-4 on level 3 doesn't match the coordination drawings. The mechanical duct path needs to be rerouted around the as-built condition. This has been coordinated with other trades and won't create new conflicts. The cost covers additional material, labor, and coordination time.</p></div></div>
                      <div className="ds"><div className="ds-h"><h4>Supporting documents</h4></div><div className="ds-b">
                        <div className="fr"><div><h5>CO-014 cost breakdown</h5><p>Itemized cost estimate</p></div><span className="fc">PDF</span></div>
                        <div className="fr"><div><h5>Revised mechanical routing plan</h5><p>Updated duct path layout</p></div><span className="fc">DWG</span></div>
                      </div></div>
                      <div className="dec"><h4>Your decision</h4><p>Approving this change order will add $18,400 to your contract and allow the mechanical work to proceed on schedule.</p>
                        <div className="dec-acts"><button className="btn ok">Approve</button><button className="btn dg-o">Reject</button><button className="btn">Request clarification</button></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rail">
                  <div className="rc"><div className="rc-h"><h3>Contract impact</h3><div className="sub">How pending COs affect your total.</div></div><div className="rc-b">
                    <div className="ir"><div><h5>Original contract</h5></div><span className="iv">$1,240,000</span></div>
                    <div className="ir"><div><h5>Already approved</h5></div><span className="iv">+$17,000</span></div>
                    <div className="ir"><div><h5>If CO-014 approved</h5></div><span className="iv" style={{color:"var(--wr-t)"}}>+$18,400</span></div>
                    <div className="ir"><div><h5>If CO-013 approved</h5></div><span className="iv" style={{color:"var(--wr-t)"}}>+$7,200</span></div>
                    <div className="ir" style={{borderTop:"2px solid var(--s3)",paddingTop:10}}><div><h5>If all approved</h5></div><span className="iv">$1,282,600</span></div>
                  </div></div>
                  <div className="rc"><div className="rc-h"><h3>Questions?</h3><div className="sub">Contact your project team.</div></div><div className="rc-b"><p style={{fontSize:13,color:"var(--t2)"}}>If you need more information before deciding, use "Request clarification" and your contractor will respond.</p></div></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ RESIDENTIAL CLIENT — "Scope Changes" ═══════ */}
          {portal === "residential" && (
            <div className="fade-up">
              <div className="pg-h"><div><h2>Scope Changes</h2><p>Sometimes things change during construction. When your builder needs to adjust something that affects cost or timing, they'll explain it here for your review.</p></div></div>
              <div className="ss tri">
                <div className="sc danger"><div className="sc-label">Needs your OK</div><div className="sc-value">1</div><div className="sc-meta">Review when you're ready</div></div>
                <div className="sc"><div className="sc-label">Already approved</div><div className="sc-value">2</div><div className="sc-meta">Part of your project now</div></div>
                <div className="sc"><div className="sc-label">Net cost change</div><div className="sc-value">+$3,200</div><div className="sc-meta">From approved changes</div></div>
              </div>

              {/* Pending scope change */}
              <div className="scc pending">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                  <div><span className="pl red" style={{marginBottom:8,display:"inline-flex"}}>Needs your OK</span><h3>Bathroom plumbing adjustment</h3><div className="sd">Your builder found that the existing drain line is in a slightly different position than the original plans showed. The plumbing needs a small reroute to connect properly. This is a normal adjustment that happens during renovation.</div></div>
                </div>
                <div className="si">
                  <div className="si-i"><div className="k">Cost change</div><div className="v" style={{color:"var(--wr-t)"}}>+$1,400</div><div className="m">Added to your project total</div></div>
                  <div className="si-i"><div className="k">Timing</div><div className="v">No delay</div><div className="m">Work can continue on schedule</div></div>
                </div>
                <div className="se"><h5>Why this is happening</h5><p>When walls are opened up during renovation, the existing plumbing sometimes doesn't match the original drawings exactly. Your builder is adjusting the drain connection so everything lines up properly. This is a standard part of renovation work and doesn't affect the rest of the project.</p></div>
                <div style={{display:"flex",gap:8,marginTop:16}}><button className="btn pri">Approve this change</button><button className="btn">Ask a question first</button></div>
              </div>

              {/* Approved */}
              <div style={{fontFamily:"var(--fd)",fontSize:14,fontWeight:700,margin:"20px 0 10px"}}>Already approved</div>

              <div className="scc" style={{opacity:.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                  <div><h3 style={{fontSize:15}}>Additional ceiling access panels</h3><div className="sd">Your builder added access panels in two areas to make future maintenance easier.</div></div>
                  <span className="pl green">Approved</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:10}}>
                  <div style={{fontSize:13,color:"var(--t2)"}}>Cost: <strong style={{color:"var(--wr-t)"}}>+$1,800</strong></div>
                  <div style={{fontSize:13,color:"var(--t2)"}}>Approved: <strong>Mar 28</strong></div>
                </div>
              </div>

              <div className="scc" style={{opacity:.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                  <div><h3 style={{fontSize:15}}>Kitchen outlet relocation</h3><div className="sd">One outlet was moved to better align with your island layout.</div></div>
                  <span className="pl green">Approved</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:10}}>
                  <div style={{fontSize:13,color:"var(--t2)"}}>Cost: <strong style={{color:"var(--wr-t)"}}>+$1,400</strong></div>
                  <div style={{fontSize:13,color:"var(--t2)"}}>Approved: <strong>Mar 15</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
