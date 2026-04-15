import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  plus: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  upload: <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  file: <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(91,79,199,.15)" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  clock: <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(91,79,199,.12)" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
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
  gc: [
    { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Project Directory", badge: 24 }, { label: "Inbox", badge: 8, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 3 },
      { label: "Change Orders", badge: 2 }, { label: "Approvals", badge: 5, bt: "warn" },
      { label: "Selections", badge: 8 }, { label: "Compliance", badge: 4, bt: "warn" },
      { label: "Upload Requests", active: true, badge: 7 },
      { label: "Billing / Draw" }, { label: "Schedule" }, { label: "Documents" }, { label: "Messages" },
    ]},
  ],
  sub: [
    { section: "Workspace", items: [{ label: "Today Board" }, { label: "Inbox", badge: 5, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "Compliance", badge: 2, bt: "danger" },
      { label: "Upload Requests", active: true, badge: 3 },
      { label: "RFIs / Issues", badge: 1 }, { label: "Schedule" }, { label: "Documents" }, { label: "Messages" },
    ]},
  ],
};

const portalMeta = {
  gc: { label: "Contractor Portal", bc: "Contractor Portal", user: "DC", project: "Riverside Tower Fit-Out", page: "Upload Requests" },
  sub: { label: "Subcontractor Portal", bc: "Subcontractor Portal", user: "JR", project: "Riverside Tower Fit-Out", page: "Upload Requests" },
};

// ── Request data ────────────────────────────────────────────────
const REQS = [
  { id: "mep", t: "MEP Closeout Pack", desc: "Final closeout package including equipment schedule, coordination markup, and turnover PDF.", st: "open", org: "Apex Mechanical", orgShort: "Apex", due: "Apr 15", overdue: true, odDays: 1, fileType: "PDF preferred", multi: true, related: "Turnover package", relType: "Closeout", files: [],
    gcAct: [{ c: "purple", x: "Dan Carter created request and assigned to Apex Mechanical", t: "Apr 10" }, { c: "orange", x: "System marked as overdue — past due date", t: "Apr 16" }],
    subAct: [{ c: "steel", x: "Request received from GC — Dan Carter", t: "Apr 10" }, { c: "orange", x: "System overdue warning", t: "Apr 16" }] },
  { id: "switch", t: "Northline Switch Schedule", desc: "Updated electrical switch schedule with panel assignments and circuit labels for commissioning review.", st: "submitted", org: "Northline Electrical", orgShort: "Northline", due: "Apr 16", overdue: false, fileType: "PDF or XLSX", multi: false, related: "Commissioning", relType: "Operations",
    files: [{ name: "switch_schedule_rev2.pdf", size: "1.4 MB", time: "42 min ago" }], subNote: "Updated per the revised panel layout from RFI-024. All circuits now match the as-built.",
    gcAct: [{ c: "steel", x: "Northline Electrical submitted response with 1 file", t: "Apr 15" }, { c: "purple", x: "Dan Carter created request", t: "Apr 12" }],
    subAct: [{ c: "steel", x: "Jake Ramos submitted response", t: "Apr 15" }, { c: "steel", x: "Request received from GC", t: "Apr 12" }] },
  { id: "photos", t: "Progress Photo Set", desc: "Owner update imagery — site finishing progress photos for the weekly client report.", st: "open", org: "Brightline Interiors", orgShort: "Brightline", due: "Apr 16", overdue: false, dueToday: true, fileType: "JPG/PNG", multi: true, related: "Client update", relType: "Reporting", files: [],
    gcAct: [{ c: "purple", x: "Dan Carter created request", t: "Apr 14" }],
    subAct: [{ c: "steel", x: "Request received from GC", t: "Apr 14" }] },
  { id: "firestop", t: "Firestop Compliance Upload", desc: "Certification package for firestop penetrations — inspection report and UL listing confirmation.", st: "open", org: "SafeSeal Firestop", orgShort: "SafeSeal", due: "Apr 17", overdue: false, fileType: "PDF", multi: true, related: "Compliance", relType: "Compliance", files: [],
    gcAct: [{ c: "purple", x: "Dan Carter created request", t: "Apr 13" }],
    subAct: [{ c: "steel", x: "Request received from GC", t: "Apr 13" }] },
  { id: "paint", t: "Paint Color Confirmation", desc: "Final paint schedule with color codes, finish types, and room assignments.", st: "completed", org: "Brightline Interiors", orgShort: "Brightline", due: "Apr 10", overdue: false, fileType: "PDF", multi: false, related: null, relType: null,
    files: [{ name: "paint_schedule_final.pdf", size: "820 KB", time: "Apr 9" }],
    gcAct: [{ c: "green", x: "Dan Carter accepted and closed request", t: "Apr 10" }, { c: "steel", x: "Brightline Interiors submitted", t: "Apr 9" }, { c: "purple", x: "Dan Carter created request", t: "Apr 7" }],
    subAct: [{ c: "green", x: "Request accepted by GC", t: "Apr 10" }, { c: "steel", x: "Maria Lopez submitted", t: "Apr 9" }, { c: "steel", x: "Request received", t: "Apr 7" }] },
  { id: "warranty", t: "HVAC Warranty Documentation", desc: "Manufacturer warranty certificates for all installed HVAC equipment with serial numbers.", st: "submitted", org: "Apex Mechanical", orgShort: "Apex", due: "Apr 18", overdue: false, fileType: "PDF", multi: true, related: "Turnover package", relType: "Closeout",
    files: [{ name: "carrier_warranty_units1-4.pdf", size: "2.1 MB", time: "2 hrs ago" }, { name: "trane_warranty_rtu.pdf", size: "1.8 MB", time: "2 hrs ago" }], subNote: "All 5 units covered. Serial numbers match the equipment schedule submitted last week.",
    gcAct: [{ c: "steel", x: "Apex Mechanical submitted with 2 files", t: "Apr 15" }, { c: "purple", x: "Dan Carter created request", t: "Apr 11" }],
    subAct: [{ c: "steel", x: "Jake Ramos submitted", t: "Apr 15" }, { c: "steel", x: "Request received", t: "Apr 11" }] },
  { id: "asbuilt", t: "As-Built Plumbing Drawings", desc: "Final as-built drawings for all plumbing rough-in and finish work, marked up from construction documents.", st: "open", org: "Valley Plumbing", orgShort: "Valley", due: "Apr 20", overdue: false, fileType: "PDF/DWG", multi: true, related: "Turnover package", relType: "Closeout", files: [],
    gcAct: [{ c: "purple", x: "Dan Carter created request", t: "Apr 14" }],
    subAct: [{ c: "steel", x: "Request received from GC", t: "Apr 14" }] },
];

const SUB_ORGS = ["Apex Mechanical", "Brightline Interiors"];

// ── Component ───────────────────────────────────────────────────
export default function UploadRequestsWorkflow() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("gc");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedId, setSelectedId] = useState("mep");
  const [uploadHover, setUploadHover] = useState(false);

  const meta = portalMeta[portal];
  const nav = navData[portal];
  const isSub = portal === "sub";

  // Filter items by portal
  const allItems = isSub ? REQS.filter(r => SUB_ORGS.includes(r.org)) : REQS;
  const tabFilters = { all: () => true, open: r => r.st === "open", submitted: r => r.st === "submitted", completed: r => r.st === "completed" };
  const filtered = allItems.filter(tabFilters[activeTab]);

  // Ensure selected item is valid
  const validSel = filtered.find(r => r.id === selectedId);
  const active = validSel || filtered[0] || null;
  const activeId = active?.id;

  // KPI counts
  const tc = { all: allItems.length, open: allItems.filter(r => r.st === "open").length, submitted: allItems.filter(r => r.st === "submitted").length, completed: allItems.filter(r => r.st === "completed").length };
  const od = allItems.filter(r => r.overdue).length;

  const switchPortal = (p) => { setPortal(p); setActiveTab("all"); const items = p === "sub" ? REQS.filter(r => SUB_ORGS.includes(r.org)) : REQS; if (items.length) setSelectedId(items[0].id); };
  const selectItem = (id) => setSelectedId(id);

  const statusPill = (r) => {
    if (r.st === "completed") return <span className="pl green">Completed</span>;
    if (r.st === "submitted") return <span className="pl blue">Submitted</span>;
    if (r.overdue) return <span className="pl red">Overdue</span>;
    if (r.dueToday) return <span className="pl orange">Due Today</span>;
    return <span className="pl accent">Open</span>;
  };

  return (
    <div className={`ur ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.ur{
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
.ur.sub{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15)}
.ur.dk{
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
.ur.dk.sub{--ac:#5a9fc0;--ac-h:#4d8aaa;--ac-s:#142030;--ac-t:#7eb8d8;--ac-m:#2a4a5e}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}

/* ── Sidebar ── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.comp-ban{margin:8px 10px;padding:10px 12px;border-radius:var(--r-m);border:1px solid #f5baba;background:var(--dg-s);font-size:12px;color:var(--dg-t);font-weight:600}
.ur.dk .comp-ban{border-color:#5a2020}

/* ── Main ── */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.ur.dk .tb{background:rgba(23,26,36,.88)}
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

/* Title row */
.pg-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-hdr h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em}
.pg-hdr p{margin-top:4px;font-size:13px;color:var(--t2);max-width:560px;font-weight:520}

/* Summary strip */
.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e)}
.sc:hover{transform:translateY(-1px);box-shadow:var(--shmd)}
.sc.strong{border-color:var(--ac-m);background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--ac-s) 40%,var(--s1)))}
.sc.alert{border-color:#f5d5a0;background:linear-gradient(180deg,var(--s1),#fefaf3)}
.sc.danger{border-color:#f5baba;background:linear-gradient(180deg,var(--s1),#fef5f5)}
.sc.success{border-color:#b0dfc4;background:linear-gradient(180deg,var(--s1),#f5fdf8)}
.ur.dk .sc.alert{border-color:var(--wr-s);background:linear-gradient(180deg,var(--s1),var(--wr-s))}
.ur.dk .sc.danger{border-color:var(--dg-s);background:linear-gradient(180deg,var(--s1),var(--dg-s))}
.ur.dk .sc.success{border-color:var(--ok-s);background:linear-gradient(180deg,var(--s1),var(--ok-s))}
.sc-lbl{font-family:var(--fb);font-size:12px;font-weight:560;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-val{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px;font-weight:520}

/* Tabs */
.tabs{display:flex;gap:4px;margin-bottom:16px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.tab{height:34px;padding:0 16px;border-radius:var(--r-m);font-size:12px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:6px;transition:all var(--dn) var(--e)}
.tab:hover{color:var(--t1)}.tab.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.tab-ct{font-size:10px;font-weight:800;color:var(--t3);background:var(--s3);padding:1px 6px;border-radius:999px;font-family:var(--fd)}.tab.on .tab-ct{background:var(--ac-s);color:var(--ac-t)}

/* Workspace */
.ws{display:grid;grid-template-columns:380px minmax(0,1fr);gap:16px;align-items:start}
.qp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.qp-hdr{padding:14px 16px;border-bottom:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between}
.qp-hdr h3{font-family:var(--fd);font-size:14px;font-weight:700}
.qp-hdr span{font-size:12px;color:var(--t3);font-weight:520}
.qp-srch{padding:10px 14px;border-bottom:1px solid var(--s2)}
.qp-srch input{width:100%;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px 0 32px;font-size:12px;color:var(--t1);outline:none}
.qp-srch input:focus{border-color:var(--ac);background:var(--s1)}
.q-list{max-height:calc(100vh - 380px);overflow-y:auto}
.q-list::-webkit-scrollbar{width:4px}.q-list::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.qi{padding:12px 16px;cursor:pointer;transition:background var(--df) var(--e);border-bottom:1px solid var(--s2)}
.qi:last-child{border-bottom:none}.qi:hover{background:var(--sh)}.qi.on{background:var(--ac-s)}
.qi-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.qi h4{font-family:var(--fd);font-size:13px;font-weight:700}
.qi p{font-size:11px;color:var(--t3);margin-top:2px;font-weight:520}
.qi-meta{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}

/* Pills (bordered workflow pattern) */
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.ur.dk .pl{border-color:var(--s4)}.ur.dk .pl.accent{border-color:var(--ac-m)}.ur.dk .pl.green{border-color:#1e4a2e}.ur.dk .pl.orange{border-color:#4a3a1a}.ur.dk .pl.red{border-color:#5a2020}.ur.dk .pl.blue{border-color:#1a3a5a}

/* Detail 2-col */
.d2{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}
.d-main{display:flex;flex-direction:column;gap:14px}
.d-rail{display:flex;flex-direction:column;gap:14px}

/* Card */
.cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}

/* Detail header */
.d-hdr{padding:20px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.d-hdr h2{font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.02em}
.dh-desc{font-size:13px;color:var(--t2);margin-top:4px;max-width:480px;font-weight:520}
.dh-pills{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.dh-acts{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap}

/* Metadata grid */
.d-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border-top:1px solid var(--s2)}
.dm{padding:14px 22px;border-bottom:1px solid var(--s2);border-right:1px solid var(--s2)}.dm:nth-child(even){border-right:none}
.dm-k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dm-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}
.dm-v.mono{font-family:var(--fm);font-size:13px;font-weight:520}
.dm-m{font-size:11px;color:var(--t3);margin-top:1px;font-weight:520}

/* Buttons */
.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--dn) var(--e);font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}.btn:active{transform:scale(.97)}
.btn.primary{background:var(--ac);border-color:var(--ac);color:white}.btn.primary:hover{background:var(--ac-h)}
.btn.sm{height:32px;padding:0 12px;font-size:12px}.btn.xs{height:28px;padding:0 10px;font-size:11px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2);color:var(--t1)}
.btn.success{background:var(--ok);border-color:var(--ok);color:white}.btn.success:hover{background:var(--ok-t)}
.btn.warn-o{border-color:#f5d5a0;color:var(--wr-t);background:transparent}.btn.warn-o:hover{background:var(--wr-s)}
.btn.dng-o{border-color:#f5baba;color:var(--dg-t);background:transparent}.btn.dng-o:hover{background:var(--dg-s)}

/* Section header */
.r-hdr{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--s2)}
.r-hdr h3{font-family:var(--fd);font-size:14px;font-weight:700}
.r-body{padding:16px 20px}

/* File rows */
.f-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
.f-row:last-child{border-bottom:none}
.f-name{font-family:var(--fm);font-size:12.5px;font-weight:520;color:var(--t1)}
.f-time{font-size:11px;color:var(--t3);margin-top:1px;font-weight:520}
.f-chip{font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap;font-family:var(--fd)}

/* Response note */
.r-note{margin-top:12px;padding:12px 14px;background:var(--s2);border-radius:var(--r-m);border:1px solid var(--s3)}
.r-note-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3);margin-bottom:4px}
.r-note p{font-size:13px;color:var(--t2);line-height:1.5;font-weight:520}

/* Upload zone */
.uz{border:2px dashed var(--s4);border-radius:var(--r-l);padding:24px;text-align:center;background:var(--s2);transition:all var(--dn) var(--e)}
.uz.hover{border-color:var(--ac);background:var(--ac-s)}
.uz h5{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:10px;margin-bottom:4px}
.uz p{font-size:12px;color:var(--t2);margin-bottom:12px;font-weight:520}

/* Activity */
.a-list{padding:6px 20px 16px}
.a-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--s2)}.a-item:last-child{border-bottom:none}
.a-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
.a-dot.purple{background:#5b4fc7}.a-dot.green{background:var(--ok)}.a-dot.orange{background:var(--wr)}.a-dot.steel{background:#3d6b8e}
.ur.dk .a-dot.purple{background:#7b6ff0}.ur.dk .a-dot.steel{background:#5a9fc0}
.a-txt{flex:1;font-size:12px;color:var(--t2);line-height:1.45;font-weight:520}
.a-txt strong{color:var(--t1);font-weight:650}
.a-time{font-size:11px;color:var(--t3);white-space:nowrap;flex-shrink:0;font-weight:520}

/* Info section */
.f-sec{padding:16px 20px}
.f-sec h4{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:8px}
.f-sec p{font-size:12px;color:var(--t2);line-height:1.5;font-weight:520}

/* Form */
.f-grp{display:flex;flex-direction:column;gap:4px;margin-top:12px}
.f-grp label{font-size:12px;font-weight:650;color:var(--t2)}
.f-grp textarea{height:60px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:10px 12px;font-size:13px;color:var(--t1);outline:none;resize:vertical;width:100%;font-family:var(--fb)}
.f-grp textarea:focus{border-color:var(--ac);background:var(--s1)}

/* Empty state */
.empty{text-align:center;padding:60px 20px}
.empty h3{font-family:var(--fd);font-size:16px;font-weight:700}
.empty p{font-size:13px;color:var(--t2);margin-top:4px;font-weight:520}

/* Responsive */
@media(max-width:1200px){.ws{grid-template-columns:1fr}.d2{grid-template-columns:1fr}}
@media(max-width:900px){.ur{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">{meta.label}</div>
          </div>
        </div>
        <nav className="s-nav">
          {isSub && <div className="comp-ban">1 compliance item at risk · Payment held</div>}
          {nav.map((sec, si) => (
            <div key={si}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map((it, ii) => (
                <div key={ii} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge && <span className={`ni-b ${it.bt || "blue"}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="mn">
        <header className="tb">
          <div className="bc">
            <span>{meta.bc}</span><span className="sep">/</span>
            <span>{meta.project}</span><span className="sep">/</span>
            <span className="cur">{meta.page}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} title="Toggle dark mode">{dark ? I.sun : I.moon}</button>
            <button className="ib" title="Notifications">{I.bell}</button>
            <div className="av">{meta.user}</div>
          </div>
        </header>

        <div className="ct">
          {/* Portal switch */}
          <div className="psw">
            <button className={portal === "gc" ? "on" : ""} onClick={() => switchPortal("gc")}>
              <span className="p-dot" style={{ background: "#5b4fc7" }} /> Contractor
            </button>
            <button className={portal === "sub" ? "on" : ""} onClick={() => switchPortal("sub")}>
              <span className="p-dot" style={{ background: "#3d6b8e" }} /> Subcontractor
            </button>
          </div>

          {/* Page header */}
          <div className="pg-hdr">
            <div>
              <h2>{isSub ? "Upload Requests \u2014 Response" : "Upload Requests"}</h2>
              <p>{isSub
                ? "See requests from the GC, upload files, and submit responses."
                : "Issue requests, track submissions, and review files from subcontractors."}</p>
            </div>
            {!isSub && (
              <button className="btn sm primary">{I.plus} New Request</button>
            )}
          </div>

          {/* Summary strip */}
          <div className="ss">
            <div className="sc strong" onClick={() => setActiveTab("all")}>
              <div className="sc-lbl">{isSub ? "Assigned to You" : "Total Requests"}</div>
              <div className="sc-val">{tc.all}</div>
              <div className="sc-meta">{tc.open} open · {tc.submitted} submitted</div>
            </div>
            <div className="sc alert" onClick={() => setActiveTab("open")}>
              <div className="sc-lbl">Open</div>
              <div className="sc-val">{tc.open}</div>
              <div className="sc-meta">{isSub ? "Need your response" : "Waiting on subcontractor"}</div>
            </div>
            <div className={`sc${od > 0 ? " danger" : ""}`}>
              <div className="sc-lbl">Overdue</div>
              <div className="sc-val">{od}</div>
              <div className="sc-meta">{od > 0 ? "Needs immediate attention" : "All on track"}</div>
            </div>
            <div className="sc success" onClick={() => setActiveTab("completed")}>
              <div className="sc-lbl">Completed</div>
              <div className="sc-val">{tc.completed}</div>
              <div className="sc-meta">Accepted and closed</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            {["all", "open", "submitted", "completed"].map(t => (
              <button key={t} className={`tab${activeTab === t ? " on" : ""}`} onClick={() => setActiveTab(t)}>
                {t[0].toUpperCase() + t.slice(1)} <span className="tab-ct">{tc[t]}</span>
              </button>
            ))}
          </div>

          {/* Workspace or empty */}
          {filtered.length === 0 ? (
            <div className="empty">
              <h3>No requests in this view</h3>
              <p>Requests will appear here when they match this filter.</p>
            </div>
          ) : (
            <div className="ws">
              {/* Queue panel */}
              <div className="qp">
                <div className="qp-hdr">
                  <h3>{isSub ? "Assigned Requests" : "Request Queue"}</h3>
                  <span>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="qp-srch">
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }}>{I.search}</div>
                    <input type="text" placeholder="Search requests\u2026" />
                  </div>
                </div>
                <div className="q-list">
                  {filtered.map(r => (
                    <div key={r.id} className={`qi${activeId === r.id ? " on" : ""}`} onClick={() => selectItem(r.id)}>
                      <div className="qi-top">
                        <div>
                          <h4>{r.t}</h4>
                          <p>{isSub ? (r.desc.length > 60 ? r.desc.slice(0, 60) + "\u2026" : r.desc) : r.org}</p>
                        </div>
                        {statusPill(r)}
                      </div>
                      <div className="qi-meta">
                        <span className="pl">{r.st === "completed" ? "Done" : r.st === "submitted" ? `${r.files.length} file${r.files.length !== 1 ? "s" : ""}` : "Awaiting"}</span>
                        <span className="pl">Due {r.due}</span>
                        {!isSub && <span className="pl">{r.orgShort}</span>}
                        <span className="pl">{r.fileType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail pane */}
              {active && <DetailPane r={active} portal={portal} uploadHover={uploadHover} setUploadHover={setUploadHover} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Pane ─────────────────────────────────────────────────
function DetailPane({ r, portal, uploadHover, setUploadHover }) {
  const isGC = portal === "gc";
  const isSub = portal === "sub";
  const act = isGC ? r.gcAct : r.subAct;

  // Status pills
  const pills = [];
  if (r.overdue) pills.push(<span key="od" className="pl red">Overdue · {r.odDays}d</span>);
  if (r.st === "open") pills.push(<span key="st" className="pl accent">Open</span>);
  else if (r.st === "submitted") pills.push(<span key="st" className="pl blue">Submitted</span>);
  else pills.push(<span key="st" className="pl green">Completed</span>);
  if (r.multi) pills.push(<span key="mu" className="pl">Multiple files</span>);
  pills.push(<span key="ft" className="pl">{r.fileType}</span>);

  // Action buttons
  let actions = null;
  if (isGC && r.st === "open") actions = (<div className="dh-acts"><button className="btn sm warn-o">Send Reminder</button><button className="btn sm ghost">Reassign</button><button className="btn sm dng-o">Cancel</button></div>);
  else if (isGC && r.st === "submitted") actions = (<div className="dh-acts"><button className="btn sm success">Accept & Close</button><button className="btn sm warn-o">Request Revision</button></div>);
  else if (isGC && r.st === "completed") actions = (<div className="dh-acts"><button className="btn sm ghost">Reopen</button></div>);
  else if (isSub && r.st === "open") actions = (<div className="dh-acts"><button className="btn sm primary">Upload Files</button></div>);
  else if (isSub && r.st === "submitted") actions = (<div className="dh-acts"><span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 520 }}>Waiting on GC review</span></div>);

  return (
    <div className="d2">
      <div className="d-main">
        {/* Header card */}
        <div className="cd">
          <div className="d-hdr">
            <div>
              <h2>{r.t}</h2>
              <div className="dh-desc">{r.desc}</div>
              <div className="dh-pills" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{pills}</div>
            </div>
            {actions}
          </div>
          <div className="d-meta">
            <div className="dm">
              <div className="dm-k">{isGC ? "Assigned To" : "Requested By"}</div>
              <div className="dm-v mono">{isGC ? r.org : "Dan Carter"}</div>
              <div className="dm-m">{isGC ? "Subcontractor" : "Contractor PM"}</div>
            </div>
            <div className="dm">
              <div className="dm-k">Due Date</div>
              <div className="dm-v" style={r.overdue ? { color: "var(--dg)" } : {}}>{r.due}</div>
              <div className="dm-m">{r.overdue ? `${r.odDays}d overdue` : r.dueToday ? "Due today" : ""}</div>
            </div>
            <div className="dm">
              <div className="dm-k">File Type</div>
              <div className="dm-v">{r.fileType}</div>
              <div className="dm-m">{r.multi ? "Multiple files allowed" : "Single file"}</div>
            </div>
            <div className="dm">
              <div className="dm-k">{r.related ? "Related To" : "Status"}</div>
              <div className="dm-v">{r.related || (r.st[0].toUpperCase() + r.st.slice(1))}</div>
              <div className="dm-m">{r.relType || ""}</div>
            </div>
          </div>
        </div>

        {/* Files / Upload section — varies by portal + status */}
        <FilesSection r={r} portal={portal} uploadHover={uploadHover} setUploadHover={setUploadHover} />
      </div>

      {/* Right rail */}
      <div className="d-rail">
        <div className="cd">
          <div className="r-hdr"><h3>Activity</h3></div>
          <div className="a-list">
            {act.map((a, i) => (
              <div key={i} className="a-item">
                <div className={`a-dot ${a.c}`} />
                <div className="a-txt" dangerouslySetInnerHTML={{ __html: a.x }} />
                <div className="a-time">{a.t}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contextual rail cards */}
        {isGC && r.st === "open" && (
          <div className="cd">
            <div className="f-sec">
              <h4>Request Details</h4>
              <p>This request was sent to <strong>{r.org}</strong>. If no response is received by the due date, consider sending a reminder or reassigning.</p>
            </div>
          </div>
        )}
        {isSub && r.st === "open" && (
          <div className="cd">
            <div className="f-sec">
              <h4>What the GC Needs</h4>
              <p>{r.desc}</p>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span className="pl">{r.fileType}</span> <span style={{ fontWeight: 520 }}>Accepted format</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span className="pl">{r.multi ? "Multiple" : "Single"}</span> <span style={{ fontWeight: 520 }}>File count</span>
                </div>
                {r.related && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span className="pl">{r.relType}</span> <span style={{ fontWeight: 520 }}>{r.related}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Files Section (conditional rendering) ───────────────────────
function FilesSection({ r, portal, uploadHover, setUploadHover }) {
  const isGC = portal === "gc";
  const isSub = portal === "sub";

  // Has files (submitted or completed)
  if (r.files.length > 0) {
    return (
      <div className="cd">
        <div className="r-hdr">
          <h3>{isGC && r.st === "submitted" ? "Submitted Files \u2014 Review Required" : "Submitted Files"}</h3>
          <span className={`pl ${r.st === "submitted" ? "blue" : "green"}`}>{r.files.length} file{r.files.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="r-body">
          {r.files.map((f, i) => (
            <div key={i} className="f-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--ac)" }}>{I.file}</span>
                <div>
                  <div className="f-name">{f.name}</div>
                  <div className="f-time">{isSub ? "Uploaded" : "Received"} {f.time}</div>
                </div>
              </div>
              <div className="f-chip">{f.size}</div>
            </div>
          ))}
          {r.subNote && (
            <div className="r-note">
              <div className="r-note-lbl">Response Note</div>
              <p>{r.subNote}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sub + open: Upload zone
  if (isSub && r.st === "open") {
    return (
      <div className="cd">
        <div className="r-hdr">
          <h3>Upload Response</h3>
          <span className="pl accent">Required</span>
        </div>
        <div className="r-body">
          <div
            className={`uz${uploadHover ? " hover" : ""}`}
            onMouseEnter={() => setUploadHover(true)}
            onMouseLeave={() => setUploadHover(false)}
          >
            <div style={{ color: "var(--s4)" }}>{I.upload}</div>
            <h5>Drop files here or click to upload</h5>
            <p>Upload {r.fileType} files for this request. {r.multi ? "Multiple files accepted." : "Single file only."}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn sm primary">Upload Files</button>
              <button className="btn sm">Use Project File</button>
            </div>
          </div>
          <div className="f-grp">
            <label>Response Note (optional)</label>
            <textarea placeholder="Add context about your submission\u2026" />
          </div>
        </div>
      </div>
    );
  }

  // GC + open: Awaiting state
  if (isGC && r.st === "open") {
    return (
      <div className="cd">
        <div className="r-hdr">
          <h3>Submission Status</h3>
          <span className="pl accent">Awaiting</span>
        </div>
        <div className="r-body">
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ color: "var(--s4)" }}>{I.upload}</div>
            <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 8, fontWeight: 520 }}>
              No files submitted yet. {r.org} has been notified.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
