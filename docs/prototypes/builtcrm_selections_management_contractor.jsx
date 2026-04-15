import { useState } from "react";

// BuiltCRM — Selections Management (Contractor)
// File #15 of 24 — Phase 2 conversion from selections_management_contractor.html
// Contractor purple accent, residential project context (The Harrison Residence)
// Master-detail workspace + create form view. Font audit applied.

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Selection Items Data ────────────────────────────────────────
const items = [
  { id:"flooring",t:"Flooring Finish",cat:"Kitchen",desc:"Three hardwood options for the main living areas. This selection affects the install schedule — flooring must be ordered before framing completion.",st:"published",cs:"exploring",al:2800,dl:"Apr 9, 2026",od:true,odD:3,sched:true,sn:"Must order before framing completion",rh:48,pub:"Apr 3, 2026",
    sw:["#c2a87a","#8b7355","#d4c8b0",""],
    opts:[
      {n:"White Oak Natural",d:"7\" wide plank, matte finish, FSC certified",sw:"linear-gradient(135deg,#c2a87a,#a08855)",tr:"included",tl:"Included",p:2640,ld:5,lw:false,rec:true,sku:"WO-NAT-7M",sup:"Heritage Hardwoods",av:"In Stock"},
      {n:"Espresso Walnut",d:"5\" plank, semi-gloss, rich dark tone",sw:"linear-gradient(135deg,#8b7355,#6b5540)",tr:"upgrade",tl:"Upgrade",p:3450,ld:12,lw:true,rec:false,sku:"EW-SG-5P",sup:"Pacific Lumber Co.",av:"In Stock"},
      {n:"Coastal Ash",d:"6\" wide plank, wire-brushed, light finish",sw:"linear-gradient(135deg,#d4c8b0,#bfb59a)",tr:"included",tl:"Included",p:2580,ld:5,lw:false,rec:false,sku:"CA-WB-6W",sup:"Heritage Hardwoods",av:"Limited"},
    ],
    act:[{c:"teal",x:"Sarah Harrison used compare mode",t:"Apr 7"},{c:"teal",x:"Sarah Harrison viewed detail page",t:"Apr 5"},{c:"purple",x:"Dan Carter published with 3 options",t:"Apr 3"},{c:"purple",x:"Dan Carter set allowance $2,800 and deadline Apr 9",t:"Apr 3"},{c:"purple",x:"Dan Carter created in Kitchen",t:"Apr 2"}],
    tl:[{l:"Published",d:"You published · Apr 3",done:true},{l:"Viewed by Client",d:"Sarah Harrison opened · Apr 5",done:true},{l:"Exploring Options",d:"Client used compare · Apr 7",cur:true},{l:"Provisional Selection",d:"Waiting for choice"},{l:"Confirmed",d:"Lock after revision window"}],pp:40
  },
  { id:"cabinet",t:"Cabinet Paint Color",cat:"Kitchen",desc:"Three curated paint colors for upper and lower cabinets. All options included — no upgrade cost.",st:"published",cs:"exploring",al:0,dl:"Apr 18, 2026",od:false,sched:false,sn:"",rh:48,pub:"Apr 6, 2026",
    sw:["#f5f2eb","#b5bfa8","#4a4a4a",""],
    opts:[
      {n:"Swiss Coffee",d:"Warm off-white, Benjamin Moore OC-45",sw:"linear-gradient(135deg,#f5f2eb,#e8e3d8)",tr:"included",tl:"Included",p:0,ld:3,lw:false,rec:true,sku:"BM-OC45",sup:"Benjamin Moore",av:"In Stock"},
      {n:"Sage Mist",d:"Soft green-gray, calming natural tone",sw:"linear-gradient(135deg,#b5bfa8,#99a68a)",tr:"included",tl:"Included",p:0,ld:3,lw:false,rec:false,sku:"SW-9132",sup:"Sherwin-Williams",av:"In Stock"},
      {n:"Iron Ore",d:"Deep charcoal, bold modern contrast",sw:"linear-gradient(135deg,#4a4a4a,#333)",tr:"included",tl:"Included",p:0,ld:3,lw:false,rec:false,sku:"SW-7069",sup:"Sherwin-Williams",av:"In Stock"},
    ],
    act:[{c:"teal",x:"Sarah Harrison viewed options",t:"Apr 8"},{c:"purple",x:"Dan Carter published with 3 options",t:"Apr 6"},{c:"purple",x:"Dan Carter created",t:"Apr 5"}],
    tl:[{l:"Published",d:"You published · Apr 6",done:true},{l:"Viewed by Client",d:"Sarah opened · Apr 8",done:true},{l:"Exploring Options",d:"Client browsing",cur:true},{l:"Provisional Selection",d:"Waiting"},{l:"Confirmed",d:"Lock after revision"}],pp:40
  },
  { id:"countertop",t:"Countertop Material",cat:"Kitchen",desc:"Quartz or granite options for kitchen island and perimeter counters. High-impact visual and budget decision.",st:"draft",cs:null,al:4200,dl:"Apr 25, 2026",od:false,sched:true,sn:"Template after cabinet install — 3 week lead",rh:48,sw:["#e0d8cc","#3a3a3a","",""],
    opts:[
      {n:"Calacatta Quartz",d:"White base with bold gray veining, engineered",sw:"linear-gradient(135deg,#e0d8cc,#cfc5b5)",tr:"included",tl:"Included",p:3900,ld:15,lw:true,rec:true,sku:"CQ-CAL-3CM",sup:"Caesarstone",av:"In Stock"},
      {n:"Absolute Black Granite",d:"Polished solid black, natural stone",sw:"linear-gradient(135deg,#3a3a3a,#222)",tr:"upgrade",tl:"Upgrade",p:5100,ld:18,lw:true,rec:false,sku:"ABG-POL-3CM",sup:"MSI Surfaces",av:"In Stock"},
    ],
    act:[{c:"purple",x:"Dan Carter added 2 options",t:"Apr 9"},{c:"purple",x:"Dan Carter created as draft",t:"Apr 9"}],tl:null,pp:0
  },
  { id:"tile",t:"Tile Pattern",cat:"Master Bathroom",desc:"Backsplash tile for shower surround. Original selection (Herringbone Marble) became unavailable — reopened with two replacement options.",st:"revision",cs:"revision_open",al:1600,dl:"Apr 15, 2026",od:false,sched:true,sn:"Tile install blocked until decision",rh:48,pub:"Apr 10, 2026",
    revReason:"Supplier notified us that Herringbone Marble is on backorder with no confirmed restock date.",prevChoice:"Herringbone Marble",
    sw:["#c5d0d8","#8a9ca8","",""],
    opts:[
      {n:"Chevron Porcelain",d:"Similar visual to original, durable porcelain marble-look",sw:"linear-gradient(135deg,#c5d0d8,#b0bcc5)",tr:"included",tl:"Included",p:1520,ld:5,lw:false,rec:true,sku:"CP-CHEV-WH",sup:"Daltile",av:"In Stock"},
      {n:"Subway Slate",d:"Modern matte slate tile, classic subway layout",sw:"linear-gradient(135deg,#8a9ca8,#6b8090)",tr:"upgrade",tl:"Upgrade",p:2020,ld:8,lw:false,rec:false,sku:"SS-MAT-4x12",sup:"Daltile",av:"In Stock"},
    ],
    act:[{c:"orange",x:"Dan Carter reopened — original unavailable",t:"Apr 10"},{c:"purple",x:"Dan Carter added 2 replacements",t:"Apr 10"},{c:"green",x:"Sarah Harrison had confirmed Herringbone Marble",t:"Apr 6"},{c:"purple",x:"Dan Carter originally published with 3 options",t:"Apr 1"}],
    tl:[{l:"Published",d:"Originally · Apr 1",done:true},{l:"Client Confirmed",d:"Herringbone Marble · Apr 6",done:true},{l:"Reopened for Revision",d:"Original unavailable · Apr 10",cur:true},{l:"Client Re-selects",d:"Waiting for new choice"},{l:"Re-confirmed",d:"Lock after revision"}],pp:50
  },
  { id:"vanity",t:"Vanity Hardware",cat:"Master Bathroom",desc:"Drawer pulls and knobs for the double vanity. Choosing between brushed brass, matte black, and polished nickel.",st:"draft",cs:null,al:350,dl:"Not set",od:false,sched:false,sn:"",rh:48,sw:["","","",""],opts:[],
    act:[{c:"purple",x:"Dan Carter created as draft",t:"Apr 8"}],tl:null,pp:0
  },
  { id:"fireplace",t:"Fireplace Surround",cat:"Living Room",desc:"Stone surround for the living room gas fireplace. Client selected Stacked Ledgestone (upgrade) and confirmed.",st:"decided",cs:"locked",al:1800,dl:"Apr 6, 2026",od:false,sched:false,sn:"",rh:48,pub:"Apr 4, 2026",
    cDate:"Apr 8, 2026",lDate:"Apr 10, 2026",selOpt:"Stacked Ledgestone",selUp:450,
    sw:["#c0b5a8","#8c7b6b","#a8978a",""],
    opts:[
      {n:"Smooth River Stone",d:"Natural rounded stone, neutral tone",sw:"linear-gradient(135deg,#c0b5a8,#a89988)",tr:"included",tl:"Included",p:1680,ld:5,lw:false,rec:false,sku:"SRS-NAT-12",sup:"Stone Source",av:"In Stock",sel:false},
      {n:"Stacked Ledgestone",d:"Textured natural stone, warm earth tones",sw:"linear-gradient(135deg,#8c7b6b,#6b5e50)",tr:"upgrade",tl:"Upgrade",p:2250,ld:7,lw:false,rec:true,sku:"SL-WARM-6",sup:"Stone Source",av:"In Stock",sel:true},
      {n:"Travertine Slab",d:"Polished stone, classic Mediterranean",sw:"linear-gradient(135deg,#a8978a,#8a7d70)",tr:"premium",tl:"Premium",p:3100,ld:14,lw:true,rec:false,sku:"TS-POL-2CM",sup:"MSI Surfaces",av:"In Stock",sel:false},
    ],
    act:[{c:"green",x:"System locked — revision window expired",t:"Apr 10"},{c:"teal",x:"Sarah Harrison confirmed Stacked Ledgestone",t:"Apr 8"},{c:"teal",x:"Sarah provisionally selected",t:"Apr 7"},{c:"purple",x:"Dan Carter published with 3 options",t:"Apr 4"}],
    tl:[{l:"Published",d:"Apr 4",done:true},{l:"Viewed",d:"Apr 5",done:true},{l:"Provisional",d:"Stacked Ledgestone · Apr 7",done:true},{l:"Confirmed",d:"Apr 8",done:true},{l:"Locked",d:"Revision closed · Apr 10",done:true}],pp:100
  },
  { id:"lighting",t:"Pendant Lighting",cat:"Living Room",desc:"Statement pendant for the dining nook. Need to curate options from supplier catalogs.",st:"draft",cs:null,al:900,dl:"Not set",od:false,sched:false,sn:"",rh:48,sw:["","","",""],opts:[],
    act:[{c:"purple",x:"Dan Carter created as draft",t:"Apr 7"}],tl:null,pp:0
  },
  { id:"siding",t:"Siding Color",cat:"Exterior",desc:"Exterior siding color for HardiePlank. Client chose Soft Linen (included) — locked and ordered.",st:"decided",cs:"locked",al:0,dl:"Apr 5, 2026",od:false,sched:true,sn:"Siding delivery on critical path",rh:24,pub:"Mar 28, 2026",
    cDate:"Apr 3, 2026",lDate:"Apr 4, 2026",selOpt:"Soft Linen",selUp:0,
    sw:["#d8d3c8","#4a5568","",""],
    opts:[
      {n:"Soft Linen",d:"Warm off-white, James Hardie ColorPlus",sw:"linear-gradient(135deg,#d8d3c8,#ccc7ba)",tr:"included",tl:"Included",p:0,ld:10,lw:false,rec:true,sku:"JH-CP-SL",sup:"James Hardie",av:"In Stock",sel:true},
      {n:"Evening Blue",d:"Deep navy accent, James Hardie ColorPlus",sw:"linear-gradient(135deg,#4a5568,#2d3748)",tr:"included",tl:"Included",p:0,ld:10,lw:false,rec:false,sku:"JH-CP-EB",sup:"James Hardie",av:"In Stock",sel:false},
    ],
    act:[{c:"green",x:"System locked — revision expired",t:"Apr 4"},{c:"teal",x:"Sarah Harrison confirmed Soft Linen",t:"Apr 3"},{c:"teal",x:"Sarah provisionally selected",t:"Apr 2"},{c:"purple",x:"Dan Carter published",t:"Mar 28"}],
    tl:[{l:"Published",d:"Mar 28",done:true},{l:"Selected",d:"Soft Linen · Apr 2",done:true},{l:"Confirmed",d:"Apr 3",done:true},{l:"Locked",d:"Apr 4",done:true}],pp:100
  },
];

const tabFilters = { all:()=>true, draft:i=>i.st==="draft", published:i=>i.st==="published", decided:i=>i.st==="decided", revision:i=>i.st==="revision" };
const fmt = c => c===0 ? "$0" : "$"+c.toLocaleString();

// ─── Icons ───────────────────────────────────────────────────────
const PlusIcon = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const DupIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
const SendIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>;
const NudgeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 003-3V9a7 7 0 0114 0v5a3 3 0 003 3zm-8.27 4a2 2 0 01-3.46 0"/></svg>;
const UndoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>;
const BackIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const BellIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>;
const WarnIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const CheckIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;

const LogoMark = () => (
  <div style={{ width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#2c2541,var(--accent))",display:"grid",placeItems:"center",flexShrink:0 }}>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.45)"/><rect x="5" y="3" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.65)"/><rect x="8" y="7" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.95)"/></svg>
  </div>
);

// ─── Helper: status pill ─────────────────────────────────────────
function StatusPill({item}) {
  if (item.st==="draft") return <span className="sm-pill">Draft</span>;
  if (item.st==="revision") return <span className="sm-pill red">Revision</span>;
  if (item.st==="decided") return <span className="sm-pill green">Confirmed</span>;
  if (item.od) return <span className="sm-pill orange">Overdue</span>;
  if (item.cs==="exploring") return <span className="sm-pill teal">Exploring</span>;
  return <span className="sm-pill blue">Published</span>;
}

// ─── Swatch Mini Grid ────────────────────────────────────────────
function SwatchMini({colors}) {
  if (colors.every(c=>!c)) return (
    <div className="sm-q-swatch" style={{display:"grid",placeItems:"center",background:"var(--surface-2)"}}>
      <PlusIcon s={14}/>
    </div>
  );
  return (
    <div className="sm-q-swatch">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,width:"100%",height:"100%"}}>
        {colors.map((c,i) => <span key={i} style={{display:"block",background:c||"var(--surface-2)"}}/>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function SelectionsManagementContractor() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("workspace"); // workspace | create
  const [activeTab, setActiveTab] = useState("all");
  const [selectedId, setSelectedId] = useState("flooring");

  const t = dark ? "dark" : "light";
  const filtered = items.filter(tabFilters[activeTab]);
  const selected = items.find(i=>i.id===selectedId);

  const handleTab = (tab) => {
    setActiveTab(tab);
    const fl = items.filter(tabFilters[tab]);
    if (fl.length && !fl.find(i=>i.id===selectedId)) setSelectedId(fl[0].id);
  };

  // Group items by category
  const grouped = {};
  filtered.forEach(i => { if(!grouped[i.cat]) grouped[i.cat]=[]; grouped[i.cat].push(i); });

  // Counts
  const counts = { all:items.length, draft:items.filter(i=>i.st==="draft").length, published:items.filter(i=>i.st==="published").length, decided:items.filter(i=>i.st==="decided").length, revision:items.filter(i=>i.st==="revision").length };
  const awaitingCount = items.filter(i=>i.st==="published"||i.st==="revision").length;
  const overdueCount = items.filter(i=>i.od).length;
  const upgradeTotal = items.filter(i=>i.st==="decided").reduce((s,i)=>s+(i.selUp||0),0);
  const decidedCount = items.filter(i=>i.st==="decided").length;
  const totalAllowances = items.reduce((s,i)=>s+i.al,0);

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{`
[data-theme="light"]{
  --surface-0:#eef0f3;--surface-1:#ffffff;--surface-2:#f3f4f6;--surface-3:#e2e5e9;--surface-4:#d1d5db;
  --surface-hover:#f5f6f8;--surface-incard:#f8f9fa;
  --sidebar-bg:#ffffff;--sidebar-hover:#f5f6f8;--sidebar-active:#eef0f3;--sidebar-active-text:#1a1714;
  --sidebar-section-text:#8b919a;--sidebar-item-text:#5a6170;--sidebar-border:#e8eaee;
  --text-primary:#1a1714;--text-secondary:#6b655b;--text-tertiary:#9c958a;--text-inverse:#faf9f7;
  --accent:#5b4fc7;--accent-hover:#4f44b3;--accent-soft:#eeedfb;--accent-text:#4a3fb0;--accent-muted:#c7c2ea;
  --success:#2d8a5e;--success-soft:#edf7f1;--success-text:#1e6b46;
  --warning:#c17a1a;--warning-soft:#fdf4e6;--warning-text:#96600f;
  --danger:#c93b3b;--danger-soft:#fdeaea;--danger-text:#a52e2e;
  --info:#3178b9;--info-soft:#e8f1fa;--info-text:#276299;
  --teal:#2a7f6f;--teal-soft:#e6f5f1;--teal-text:#1f6b5c;--teal-muted:#b0d9cf;
  --topbar-bg:rgba(255,255,255,.88);
  --sc-strong:linear-gradient(180deg,#fff,#f5f3ff);--sc-alert:linear-gradient(180deg,#fff,#fefaf3);
  --sc-danger:linear-gradient(180deg,#fff,#fef5f5);--sc-success:linear-gradient(180deg,#fff,#f5fdf8);
  --sc-info:linear-gradient(180deg,#fff,#f5f9fe);
}
[data-theme="dark"]{
  --surface-0:#0e0f11;--surface-1:#18191c;--surface-2:#1e2023;--surface-3:#2a2d31;--surface-4:#3a3e44;
  --surface-hover:#1f2124;--surface-incard:#1c1d20;
  --sidebar-bg:#141517;--sidebar-hover:#1c1d20;--sidebar-active:#1e2023;--sidebar-active-text:#f0ede8;
  --sidebar-section-text:#6b7280;--sidebar-item-text:#9ca3af;--sidebar-border:#232528;
  --text-primary:#f0ede8;--text-secondary:#a09a90;--text-tertiary:#706a60;--text-inverse:#1a1714;
  --accent:#8b7ff5;--accent-hover:#9d93ff;--accent-soft:#1e1a3a;--accent-text:#b0a6ff;--accent-muted:#4a4080;
  --success:#3aad72;--success-soft:#0f251a;--success-text:#5dd89a;
  --warning:#daa050;--warning-soft:#271d0b;--warning-text:#eab96e;
  --danger:#e25555;--danger-soft:#2a1010;--danger-text:#f28080;
  --info:#5a9fd4;--info-soft:#0d1a2a;--info-text:#80b8e8;
  --teal:#40b89e;--teal-soft:#0d2520;--teal-text:#6fd4b8;--teal-muted:#1a4a40;
  --topbar-bg:rgba(14,15,17,.88);
  --sc-strong:linear-gradient(180deg,var(--surface-1),#1a1530);--sc-alert:linear-gradient(180deg,var(--surface-1),var(--warning-soft));
  --sc-danger:linear-gradient(180deg,var(--surface-1),var(--danger-soft));--sc-success:linear-gradient(180deg,var(--surface-1),var(--success-soft));
  --sc-info:linear-gradient(180deg,var(--surface-1),var(--info-soft));
}
*,*::before,*::after{box-sizing:border-box;margin:0}
.sm-app{display:grid;grid-template-columns:272px 1fr;min-height:100vh;font-family:'Instrument Sans',system-ui,sans-serif;background:var(--surface-0);color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px}

/* SIDEBAR */
.sm-sidebar{background:var(--sidebar-bg);border-right:1px solid var(--sidebar-border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.sm-brand{height:56px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.sm-brand-name{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:-.02em}
.sm-brand-ctx{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}
.sm-sb-search{padding:12px 16px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.sm-sb-input{width:100%;height:36px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);padding:0 12px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;color:var(--text-primary);outline:none;font-weight:520}
.sm-sb-input:focus{border-color:var(--accent)}
.sm-sb-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.sm-ns-label{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;color:var(--sidebar-section-text);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.sm-ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:10px;font-size:13px;color:var(--sidebar-item-text);font-weight:520;cursor:pointer;margin-bottom:2px;transition:all .15s}
.sm-ni:hover{background:var(--sidebar-hover);color:var(--sidebar-active-text)}
.sm-ni.active{background:var(--accent-soft);color:var(--accent-text);font-weight:650}
.sm-ni-badge{min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:var(--accent-soft);color:var(--accent-text);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif}
.sm-ni-badge.warn{background:var(--warning-soft);color:var(--warning-text)}
.sm-sb-foot{border-top:1px solid var(--sidebar-border);padding:12px 16px;flex-shrink:0}
.sm-u-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#7c6fe0);color:#fff;display:grid;place-items:center;font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700}

/* MAIN */
.sm-main{min-width:0;display:flex;flex-direction:column}
.sm-topbar{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--surface-3);background:var(--topbar-bg);backdrop-filter:blur(12px);position:sticky;top:0;z-index:50}
.sm-bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-tertiary);font-weight:520}
.sm-bc-cur{color:var(--text-primary);font-weight:650}
.sm-bc-sep{font-size:11px;color:var(--surface-4)}
.sm-content{padding:24px;flex:1}
.sm-dark-toggle{position:fixed;bottom:20px;right:20px;z-index:100;width:40px;height:40px;border-radius:50%;background:var(--surface-1);border:1px solid var(--surface-3);box-shadow:0 4px 16px rgba(0,0,0,.1);display:grid;place-items:center;cursor:pointer;font-size:16px;transition:all .2s}
.sm-dark-toggle:hover{transform:scale(1.1)}

/* BUTTONS */
.sm-btn{height:38px;padding:0 16px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;font-weight:650;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;white-space:nowrap}
.sm-btn:hover{border-color:var(--surface-4);background:var(--surface-hover)}
.sm-btn:active{transform:scale(.97)}
.sm-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.sm-btn.primary:hover{background:var(--accent-hover)}
.sm-btn.success{background:var(--success);border-color:var(--success);color:#fff}
.sm-btn.ghost{border-color:transparent;background:transparent;color:var(--text-secondary)}.sm-btn.ghost:hover{background:var(--surface-2);color:var(--text-primary)}
.sm-btn.warn-outline{border-color:#f5d5a0;color:var(--warning-text)}.sm-btn.warn-outline:hover{background:var(--warning-soft)}
.sm-btn.sm{height:32px;padding:0 12px;font-size:12px}.sm-btn.xs{height:28px;padding:0 10px;font-size:11px}

/* PILLS */
.sm-pill{height:22px;padding:0 9px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--surface-3);background:var(--surface-1);color:var(--text-tertiary);white-space:nowrap;flex-shrink:0}
.sm-pill.accent{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent-muted)}
.sm-pill.green{background:var(--success-soft);color:var(--success-text);border-color:var(--success)}
.sm-pill.orange{background:var(--warning-soft);color:var(--warning-text);border-color:var(--warning)}
.sm-pill.red{background:var(--danger-soft);color:var(--danger-text);border-color:var(--danger)}
.sm-pill.blue{background:var(--info-soft);color:var(--info-text);border-color:var(--info)}
.sm-pill.teal{background:var(--teal-soft);color:var(--teal-text);border-color:var(--teal-muted)}
.sm-pill.dark{background:var(--text-primary);color:var(--text-inverse);border-color:var(--text-primary)}
.sm-mini-tag{height:20px;padding:0 7px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;border:1px solid var(--surface-3);background:var(--surface-2);color:var(--text-tertiary);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}

/* SUMMARY STRIP */
.sm-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}
.sm-sc{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;padding:13px 15px;box-shadow:0 1px 3px rgba(26,23,20,.05)}
.sm-sc.strong{border-color:var(--accent-muted);background:var(--sc-strong)}
.sm-sc.alert{border-color:#f5d5a0;background:var(--sc-alert)}
.sm-sc.danger{border-color:#f5baba;background:var(--sc-danger)}
.sm-sc.success{border-color:#b0dfc4;background:var(--sc-success)}
.sm-sc.info{border-color:#b3d1ec;background:var(--sc-info)}
.sm-sc-label{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary)}
.sm-sc-value{font-family:'DM Sans',system-ui,sans-serif;font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sm-sc-meta{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}

/* TABS */
.sm-tabs{display:flex;gap:4px;margin-bottom:16px;background:var(--surface-2);border-radius:14px;padding:4px;width:fit-content}
.sm-tab{height:34px;padding:0 16px;border-radius:10px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;font-weight:650;color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .15s;background:none;border:none}
.sm-tab:hover{color:var(--text-primary)}.sm-tab.active{background:var(--surface-1);color:var(--text-primary);box-shadow:0 1px 3px rgba(26,23,20,.05)}
.sm-tab-count{font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:800;color:var(--text-tertiary);background:var(--surface-3);padding:1px 6px;border-radius:999px}
.sm-tab.active .sm-tab-count{background:var(--accent-soft);color:var(--accent-text)}

/* WORKSPACE */
.sm-workspace{display:grid;grid-template-columns:380px minmax(0,1fr);gap:16px;align-items:start}
.sm-queue-panel{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;box-shadow:0 1px 3px rgba(26,23,20,.05);overflow:hidden}
.sm-queue-header{padding:14px 16px;border-bottom:1px solid var(--surface-3);display:flex;align-items:center;justify-content:space-between}
.sm-queue-header h3{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700}
.sm-queue-search{padding:10px 14px;border-bottom:1px solid var(--surface-2)}
.sm-queue-search input{width:100%;height:34px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);padding:0 12px;font-size:12px;outline:none;color:var(--text-primary);font-family:'Instrument Sans',system-ui,sans-serif;font-weight:520}
.sm-queue-list{max-height:calc(100vh - 380px);overflow-y:auto}
.sm-q-cat-label{padding:10px 16px 6px;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;justify-content:space-between}
.sm-q-cat-count{font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;background:var(--surface-2);padding:2px 7px;border-radius:999px;color:var(--text-tertiary)}
.sm-q-item{padding:10px 16px;cursor:pointer;transition:background .12s;display:flex;align-items:center;gap:12px}
.sm-q-item:hover{background:var(--surface-hover)}.sm-q-item.active{background:var(--accent-soft)}
.sm-q-swatch{width:40px;height:40px;border-radius:10px;border:1px solid var(--surface-3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;color:var(--text-tertiary)}
.sm-q-body{flex:1;min-width:0}
.sm-q-body h4{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-q-body p{font-size:11px;color:var(--text-tertiary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:520}
.sm-q-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.sm-q-right span:last-child{font-size:10px;color:var(--text-tertiary);font-weight:520}

/* DETAIL */
.sm-d2{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}
.sm-d-main{display:flex;flex-direction:column;gap:14px}
.sm-d-rail{display:flex;flex-direction:column;gap:14px}
.sm-card{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;box-shadow:0 1px 3px rgba(26,23,20,.05);overflow:hidden}
.sm-d-hdr{padding:20px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.sm-dh-cat{font-family:'DM Sans',system-ui,sans-serif;font-size:12px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.sm-dh-title{font-family:'DM Sans',system-ui,sans-serif;font-size:20px;font-weight:820;letter-spacing:-.02em}
.sm-dh-desc{font-size:13px;color:var(--text-secondary);margin-top:4px;max-width:480px;font-weight:520;line-height:1.5}
.sm-dh-pills{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.sm-dh-actions{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap}

/* METADATA GRID */
.sm-d-meta{display:grid;grid-template-columns:repeat(2,1fr);border-top:1px solid var(--surface-2)}
.sm-dm{padding:14px 22px;border-bottom:1px solid var(--surface-2);border-right:1px solid var(--surface-2)}
.sm-dm:nth-child(even){border-right:none}
.sm-dm .k{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary)}
.sm-dm .v{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;margin-top:3px}
.sm-dm .m{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}

/* OPTIONS TABLE */
.sm-o-hdr{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--surface-2)}
.sm-o-hdr h3{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700}
.sm-ot{width:100%;border-collapse:collapse}
.sm-ot th{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary);text-align:left;padding:10px 12px;background:var(--surface-2);border-bottom:1px solid var(--surface-3)}
.sm-ot th:first-child{padding-left:20px}.sm-ot th:last-child{padding-right:20px;text-align:right}
.sm-ot td{padding:12px;font-size:13px;border-bottom:1px solid var(--surface-2);vertical-align:middle;font-weight:520}
.sm-ot td:first-child{padding-left:20px}.sm-ot td:last-child{padding-right:20px;text-align:right}
.sm-ot tr:last-child td{border-bottom:none}.sm-ot tr:hover{background:var(--surface-hover)}
.sm-ot tr.rec{background:rgba(91,79,199,.03)}.sm-ot tr.sel{background:rgba(45,138,94,.05)}
.sm-on{display:flex;align-items:center;gap:10px}
.sm-os{width:32px;height:32px;border-radius:6px;border:1px solid var(--surface-3);flex-shrink:0}
.sm-ont h5{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700}
.sm-ont p{font-size:11px;color:var(--text-tertiary);margin-top:1px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:520}
.sm-op{font-family:'DM Sans',system-ui,sans-serif;font-weight:750}.sm-op.inc{color:var(--success-text)}.sm-op.upg{color:var(--warning-text)}.sm-op.prem{color:#a04d1a}
.sm-ol{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-secondary);font-weight:520}
.sm-ol.w{color:var(--warning-text);font-weight:600}
.sm-oa{font-size:11px;font-weight:600}.sm-oa.ok{color:var(--success-text)}.sm-oa.lim{color:var(--warning-text)}.sm-oa.bo{color:var(--danger-text)}
.sm-sku{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);font-weight:520}

/* CLIENT TIMELINE */
.sm-r-hdr{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--surface-2)}
.sm-r-hdr h3{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700}
.sm-cs-body{padding:16px 20px}
.sm-cs-bar-wrap{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.sm-cs-bar{flex:1;height:6px;border-radius:999px;background:var(--surface-3);overflow:hidden}
.sm-cs-fill{height:100%;border-radius:999px;background:var(--accent);transition:width .35s}
.sm-cs-pct{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0}
.sm-cs-step{display:flex;gap:12px;position:relative;padding-bottom:14px}
.sm-cs-step:last-child{padding-bottom:0}
.sm-cs-step::before{content:'';position:absolute;left:11px;top:24px;bottom:0;width:2px;background:var(--surface-3)}
.sm-cs-step:last-child::before{display:none}
.sm-cs-step.done::before{background:var(--accent-muted)}
.sm-cs-dot{width:24px;height:24px;border-radius:50%;border:2px solid var(--surface-3);background:var(--surface-1);display:grid;place-items:center;flex-shrink:0;position:relative;z-index:1}
.sm-cs-step.done .sm-cs-dot{background:var(--accent);border-color:var(--accent);color:#fff}
.sm-cs-step.cur .sm-cs-dot{border-color:var(--accent);background:var(--surface-1);box-shadow:0 0 0 4px var(--accent-soft)}
.sm-cs-st h5{font-size:13px;font-weight:650}.sm-cs-st p{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}
.sm-cs-step.done .sm-cs-st h5{color:var(--text-secondary)}

/* ACTIVITY */
.sm-a-list{padding:6px 20px 16px}
.sm-a-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--surface-2)}
.sm-a-item:last-child{border-bottom:none}
.sm-a-dot{width:8px;height:8px;border-radius:50%;background:var(--surface-4);flex-shrink:0;margin-top:5px}
.sm-a-dot.purple{background:var(--accent)}.sm-a-dot.green{background:var(--success)}.sm-a-dot.orange{background:var(--warning)}.sm-a-dot.teal{background:var(--teal)}
.sm-a-text{flex:1;font-size:12px;color:var(--text-secondary);line-height:1.45;font-weight:520}
.sm-a-time{font-size:11px;color:var(--text-tertiary);white-space:nowrap;flex-shrink:0;font-weight:520}

/* BUDGET ROWS */
.sm-b-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--surface-2);font-size:13px;font-weight:520}
.sm-b-row:last-child{border-bottom:none}
.sm-b-row .bk{color:var(--text-secondary)}.sm-b-row .bv{font-family:'DM Sans',system-ui,sans-serif;font-weight:750}
.sm-b-row.total{padding-top:10px;border-top:2px solid var(--surface-3)}.sm-b-row.total .bk{font-weight:700;color:var(--text-primary)}.sm-b-row.total .bv{font-size:15px}

/* REVISION BANNER */
.sm-rev-banner{background:var(--warning-soft);border:1px solid #f0cc8a;border-radius:14px;padding:14px 18px;display:flex;align-items:flex-start;gap:12px}
.sm-rev-banner h4{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;color:var(--warning-text)}
.sm-rev-banner p{font-size:12px;color:var(--text-secondary);margin-top:2px;font-weight:520}

/* DRAFT BANNER */
.sm-draft-banner{background:var(--surface-2);border:1px dashed var(--surface-4);border-radius:14px;padding:20px;text-align:center}
.sm-draft-banner h4{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;margin-bottom:4px}
.sm-draft-banner p{font-size:12px;color:var(--text-secondary);margin-bottom:12px;font-weight:520}

/* ANIMATIONS */
@keyframes sm-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.sm-anim{animation:sm-fadeIn .35s cubic-bezier(.16,1,.3,1) both}

/* RESPONSIVE */
@media(max-width:1280px){.sm-workspace{grid-template-columns:1fr}.sm-d2{grid-template-columns:1fr}.sm-summary{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.sm-app{grid-template-columns:1fr}.sm-sidebar{display:none}.sm-summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.sm-summary{grid-template-columns:1fr}.sm-content{padding:16px}}
      `}</style>

      <div className="sm-app" data-theme={t}>
        {/* SIDEBAR */}
        <aside className="sm-sidebar">
          <div className="sm-brand"><LogoMark /><div><div className="sm-brand-name">BuiltCRM</div><div className="sm-brand-ctx">Contractor Portal</div></div></div>
          <div className="sm-sb-search"><input className="sm-sb-input" placeholder="Search projects…"/></div>
          <nav className="sm-sb-nav">
            <div className="sm-ns-label">Workspace</div>
            <div className="sm-ni">Dashboard</div>
            <div className="sm-ni">Project Directory <span className="sm-ni-badge">24</span></div>
            <div className="sm-ni">Inbox <span className="sm-ni-badge">8</span></div>
            <div className="sm-ns-label">The Harrison Residence</div>
            <div className="sm-ni">Project Home</div>
            <div className="sm-ni">RFIs / Issues <span className="sm-ni-badge">3</span></div>
            <div className="sm-ni">Change Orders <span className="sm-ni-badge">2</span></div>
            <div className="sm-ni">Approvals <span className="sm-ni-badge">5</span></div>
            <div className="sm-ni active">Selections <span className="sm-ni-badge">8</span></div>
            <div className="sm-ni">Compliance <span className="sm-ni-badge warn">4</span></div>
            <div className="sm-ni">Upload Requests <span className="sm-ni-badge">7</span></div>
            <div className="sm-ni">Billing / Draw</div>
            <div className="sm-ni">Schedule</div>
            <div className="sm-ni">Documents</div>
            <div className="sm-ni">Messages</div>
          </nav>
          <div className="sm-sb-foot">
            <div style={{display:"flex",alignItems:"center",gap:12,padding:8}}>
              <div className="sm-u-av">DC</div>
              <div><div style={{fontSize:13,fontWeight:580}}>Dan Carter</div><div style={{fontSize:11,color:"var(--text-tertiary)",fontWeight:520}}>General Contractor</div></div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="sm-main">
          <header className="sm-topbar">
            <div className="sm-bc">
              <span>The Harrison Residence</span>
              <span className="sm-bc-sep">›</span>
              <span className="sm-bc-cur">{view==="create"?"New Selection Item":"Selections"}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button className="sm-btn sm primary" onClick={()=>setView("create")}><PlusIcon s={14}/> New Item</button>
              <button style={{
                width:34,height:34,borderRadius:10,border:"1px solid var(--surface-3)",
                background:"var(--surface-1)",color:"var(--text-tertiary)",display:"grid",
                placeItems:"center",cursor:"pointer",
              }}><BellIcon/></button>
              <div className="sm-u-av">DC</div>
            </div>
          </header>

          <div className="sm-content">
            {view==="create" ? (
              /* ════ CREATE VIEW ════ */
              <div className="sm-anim">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                  <button className="sm-btn sm ghost" onClick={()=>setView("workspace")}><BackIcon/> Back</button>
                  <h2 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:22,fontWeight:820,letterSpacing:"-.02em"}}>New Selection Item</h2>
                </div>
                <div className="sm-d2">
                  <div className="sm-d-main">
                    <div className="sm-card" style={{padding:"20px 22px"}}>
                      <h4 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Item Details</h4>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontSize:12,fontWeight:650,color:"var(--text-secondary)"}}>Category</label>
                          <select style={{height:38,borderRadius:10,border:"1px solid var(--surface-3)",background:"var(--surface-2)",padding:"0 12px",fontSize:13,color:"var(--text-primary)"}}>
                            <option>Kitchen</option><option>Master Bathroom</option><option>Living Room</option><option>Exterior</option>
                          </select>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontSize:12,fontWeight:650,color:"var(--text-secondary)"}}>Item Title</label>
                          <input style={{height:38,borderRadius:10,border:"1px solid var(--surface-3)",background:"var(--surface-2)",padding:"0 12px",fontSize:13,color:"var(--text-primary)"}} placeholder="e.g., Backsplash Tile"/>
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        <label style={{fontSize:12,fontWeight:650,color:"var(--text-secondary)"}}>Description</label>
                        <textarea style={{minHeight:80,borderRadius:10,border:"1px solid var(--surface-3)",background:"var(--surface-2)",padding:"10px 12px",fontSize:13,color:"var(--text-primary)",resize:"vertical",fontFamily:"inherit"}} placeholder="Explain what this selection is for…"/>
                        <span style={{fontSize:11,color:"var(--text-tertiary)",marginTop:2}}>Shown to the homeowner for context.</span>
                      </div>
                    </div>
                    <div className="sm-card" style={{padding:"20px 22px"}}>
                      <h4 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Budget & Timing</h4>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontSize:12,fontWeight:650,color:"var(--text-secondary)"}}>Allowance ($)</label>
                          <input style={{height:38,borderRadius:10,border:"1px solid var(--surface-3)",background:"var(--surface-2)",padding:"0 12px",fontSize:13}} placeholder="0.00"/>
                          <span style={{fontSize:11,color:"var(--text-tertiary)"}}>At or below = "Included" for client.</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <label style={{fontSize:12,fontWeight:650,color:"var(--text-secondary)"}}>Decision Deadline</label>
                          <input type="date" style={{height:38,borderRadius:10,border:"1px solid var(--surface-3)",background:"var(--surface-2)",padding:"0 12px",fontSize:13,color:"var(--text-primary)"}}/>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="sm-d-rail">
                    <div className="sm-card" style={{padding:"20px 22px"}}>
                      <h4 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Publish Settings</h4>
                      <p style={{fontSize:12,color:"var(--text-secondary)",marginBottom:14,fontWeight:520}}>Items stay draft until published. Homeowner cannot see drafts.</p>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <button className="sm-btn primary" style={{width:"100%"}}><SendIcon/> Publish to Client</button>
                        <button className="sm-btn" style={{width:"100%"}}>Save as Draft</button>
                      </div>
                    </div>
                    <div className="sm-card" style={{padding:"20px 22px"}}>
                      <h4 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Publish Checklist</h4>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {["Title and description","Allowance amount set","At least 2 options","One marked recommended","Decision deadline set","Supplier info on all options"].map((txt,i) => (
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:520}}>
                            <div style={{width:18,height:18,borderRadius:4,border:"2px solid var(--surface-4)",flexShrink:0}}/>
                            <span>{txt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ════ WORKSPACE VIEW ════ */
              <>
                {/* Page Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20,marginBottom:16}} className="sm-anim">
                  <div>
                    <h2 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:26,fontWeight:820,letterSpacing:"-.035em"}}>Selections Management</h2>
                    <p style={{marginTop:4,fontSize:13,color:"var(--text-secondary)",maxWidth:560,fontWeight:520}}>Create and curate finish options for your clients. Publish when ready — items are invisible to the homeowner until published.</p>
                  </div>
                </div>

                {/* Summary Strip */}
                <div className="sm-summary sm-anim" style={{animationDelay:"60ms"}}>
                  <div className="sm-sc strong"><div className="sm-sc-label">Total Items</div><div className="sm-sc-value">{items.length}</div><div className="sm-sc-meta">{counts.published+counts.revision} published · {counts.draft} draft</div></div>
                  <div className="sm-sc alert"><div className="sm-sc-label">Awaiting Decision</div><div className="sm-sc-value">{awaitingCount}</div><div className="sm-sc-meta">Published, no confirmation</div></div>
                  <div className="sm-sc danger"><div className="sm-sc-label">Overdue</div><div className="sm-sc-value">{overdueCount}</div><div className="sm-sc-meta">Past deadline</div></div>
                  <div className="sm-sc success"><div className="sm-sc-label">Upgrade Impact</div><div className="sm-sc-value">+{fmt(upgradeTotal)}</div><div className="sm-sc-meta">{decidedCount} confirmed</div></div>
                  <div className="sm-sc info"><div className="sm-sc-label">Total Allowances</div><div className="sm-sc-value">{fmt(totalAllowances)}</div><div className="sm-sc-meta">All categories</div></div>
                </div>

                {/* Tabs */}
                <div className="sm-tabs sm-anim" style={{animationDelay:"120ms"}}>
                  {["all","draft","published","decided","revision"].map(tab => (
                    <button key={tab} className={`sm-tab${activeTab===tab?" active":""}`} onClick={()=>handleTab(tab)}>
                      {tab[0].toUpperCase()+tab.slice(1)} <span className="sm-tab-count">{counts[tab]}</span>
                    </button>
                  ))}
                </div>

                {/* Master-Detail */}
                {filtered.length === 0 ? (
                  <div style={{textAlign:"center",padding:"60px 20px"}}>
                    <h3 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:16,fontWeight:700,marginTop:12}}>No items in this view</h3>
                    <p style={{fontSize:13,color:"var(--text-secondary)",marginTop:4,fontWeight:520}}>Items will appear here when they match this filter.</p>
                  </div>
                ) : (
                  <div className="sm-workspace sm-anim" style={{animationDelay:"180ms"}}>
                    {/* Queue Panel */}
                    <div className="sm-queue-panel">
                      <div className="sm-queue-header"><h3>Selection Items</h3><span style={{fontSize:12,color:"var(--text-tertiary)",fontWeight:520}}>{filtered.length} item{filtered.length!==1?"s":""}</span></div>
                      <div className="sm-queue-search"><input placeholder="Search selections…"/></div>
                      <div className="sm-queue-list">
                        {Object.entries(grouped).map(([cat,its]) => (
                          <div key={cat} style={{borderBottom:"1px solid var(--surface-2)"}}>
                            <div className="sm-q-cat-label">{cat}<span className="sm-q-cat-count">{its.length}</span></div>
                            {its.map(i => (
                              <div key={i.id} className={`sm-q-item${selectedId===i.id?" active":""}`} onClick={()=>setSelectedId(i.id)}>
                                <SwatchMini colors={i.sw}/>
                                <div className="sm-q-body">
                                  <h4>{i.t}</h4>
                                  <p>{i.opts.length} opt{i.opts.length!==1?"s":""} · Allow. {fmt(i.al)}</p>
                                </div>
                                <div className="sm-q-right">
                                  <StatusPill item={i}/>
                                  {i.st==="draft" ? null : i.st==="decided" ? <span>Locked</span> : i.st==="revision" ? <span>Reopened</span> : <span>Published</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detail Pane */}
                    {selected && (
                      <div className="sm-d2">
                        <div className="sm-d-main">
                          {/* Revision banner */}
                          {selected.st==="revision" && (
                            <div className="sm-rev-banner">
                              <WarnIcon/>
                              <div>
                                <h4>Reopened for Revision</h4>
                                <p>{selected.revReason} Previous choice: <strong>{selected.prevChoice}</strong></p>
                              </div>
                            </div>
                          )}

                          {/* Item Header Card */}
                          <div className="sm-card">
                            <div className="sm-d-hdr">
                              <div>
                                <div className="sm-dh-cat">{selected.cat}</div>
                                <h2 className="sm-dh-title">{selected.t}</h2>
                                <div className="sm-dh-desc">{selected.desc}</div>
                                <div className="sm-dh-pills">
                                  {selected.st==="draft" && <span className="sm-pill">Draft — not visible to client</span>}
                                  {selected.st==="revision" && <><span className="sm-pill red">Revision — reopened</span><span className="sm-pill accent">Published</span><span className="sm-pill">{selected.opts.length} options</span></>}
                                  {selected.st==="decided" && <><span className="sm-pill green">Confirmed</span><span className="sm-pill dark">Locked</span></>}
                                  {selected.st==="published" && !selected.od && <><span className="sm-pill accent">Published</span><span className="sm-pill">{selected.opts.length} options</span></>}
                                  {selected.st==="published" && selected.od && <><span className="sm-pill orange">Overdue — {selected.odD}d past deadline</span><span className="sm-pill accent">Published</span><span className="sm-pill">{selected.opts.length} options</span></>}
                                </div>
                              </div>
                              <div className="sm-dh-actions">
                                {selected.st==="draft" && <><button className="sm-btn sm ghost"><EditIcon/> Edit</button>{selected.opts.length>=2 && <button className="sm-btn sm success"><SendIcon/> Publish</button>}<button className="sm-btn sm ghost"><DupIcon/> Duplicate</button></>}
                                {selected.st==="decided" && <button className="sm-btn sm warn-outline"><UndoIcon/> Reopen for Revision</button>}
                                {selected.st==="revision" && <button className="sm-btn sm ghost"><EditIcon/> Edit</button>}
                                {selected.st==="published" && <><button className="sm-btn sm ghost"><EditIcon/> Edit</button>{selected.od && <button className="sm-btn sm warn-outline"><NudgeIcon/> Nudge Client</button>}<button className="sm-btn sm ghost"><DupIcon/> Duplicate</button></>}
                              </div>
                            </div>
                            <div className="sm-d-meta">
                              <div className="sm-dm"><div className="k">Allowance</div><div className="v">{fmt(selected.al)}</div><div className="m">{selected.al>0?"At or below = \"Included\"":"All included"}</div></div>
                              {selected.st==="decided" ? (
                                <><div className="sm-dm"><div className="k">Client's Choice</div><div className="v" style={{color:"var(--accent-text)"}}>{selected.selOpt}</div><div className="m">{selected.selUp>0?`Upgrade · +${fmt(selected.selUp)}`:"Included"}</div></div>
                                <div className="sm-dm"><div className="k">Confirmed</div><div className="v">{selected.cDate}</div><div className="m">Locked {selected.lDate}</div></div>
                                <div className="sm-dm"><div className="k">Lead Time</div><div className="v">{(selected.opts.find(o=>o.sel)||{}).ld||"—"}d</div><div className="m">Order placed</div></div></>
                              ) : (
                                <><div className="sm-dm"><div className="k">Decision Deadline</div><div className="v" style={selected.od?{color:"var(--danger)"}:{}}>{selected.dl}</div><div className="m">{selected.od?`${selected.odD}d overdue`:""}</div></div>
                                <div className="sm-dm"><div className="k">Schedule Impact</div><div className="v">{selected.sched?"Yes — affects install":"No direct impact"}</div><div className="m">{selected.sn||"—"}</div></div>
                                <div className="sm-dm"><div className="k">Revision Window</div><div className="v">{selected.rh}h</div><div className="m">After confirmation</div></div></>
                              )}
                            </div>
                          </div>

                          {/* Options Table */}
                          <div className="sm-card">
                            <div className="sm-o-hdr">
                              <h3>{selected.st==="decided"?"Options (Decided)":"Curated Options"}</h3>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                <span style={{fontSize:12,color:"var(--text-tertiary)",fontWeight:520}}>{selected.opts.length} option{selected.opts.length!==1?"s":""}</span>
                                {selected.st!=="decided" && <button className="sm-btn xs primary"><PlusIcon s={12}/> Add</button>}
                              </div>
                            </div>
                            {selected.opts.length === 0 ? (
                              <div className="sm-draft-banner" style={{margin:16}}>
                                <h4>No options yet</h4>
                                <p>Add at least 2 curated options before publishing.</p>
                                <button className="sm-btn sm primary"><PlusIcon s={14}/> Add First Option</button>
                              </div>
                            ) : (
                              <table className="sm-ot">
                                <thead><tr>
                                  <th>Option</th><th>Tier</th><th>Price</th><th>Lead Time</th><th>Supplier / SKU</th><th>Avail.</th>
                                  <th>{(selected.st==="decided"||selected.st==="revision")?"Status":"Tags"}</th>
                                </tr></thead>
                                <tbody>
                                  {selected.opts.map((o,i) => {
                                    const showSt = selected.st==="decided"||selected.st==="revision";
                                    const rc = o.sel?"sel":o.rec?"rec":"";
                                    const tc = o.tr==="included"?"green":o.tr==="upgrade"?"orange":"";
                                    const pc = o.tr==="included"?"inc":o.tr==="upgrade"?"upg":"prem";
                                    const ac = o.av==="In Stock"?"ok":o.av==="Limited"?"lim":"bo";
                                    return (
                                      <tr key={i} className={rc}>
                                        <td><div className="sm-on"><div className="sm-os" style={{background:o.sw}}/><div className="sm-ont"><h5>{o.n}</h5><p>{o.d}</p></div></div></td>
                                        <td>{o.tr==="premium"?<span className="sm-pill" style={{background:"#fef0e6",borderColor:"#f5c9a0",color:"#a04d1a"}}>Premium</span>:<span className={`sm-pill ${tc}`}>{o.tl}</span>}</td>
                                        <td><span className={`sm-op ${pc}`}>{fmt(o.p)}</span></td>
                                        <td><span className={`sm-ol${o.lw?" w":""}`}>{o.ld}d</span></td>
                                        <td><div style={{fontSize:12}}><div style={{fontWeight:600}}>{o.sup}</div><div className="sm-sku">{o.sku}</div></div></td>
                                        <td><span className={`sm-oa ${ac}`}>{o.av}</span></td>
                                        <td style={{textAlign:"right"}}>
                                          {showSt && o.sel ? <span className="sm-pill green">Selected</span> : showSt ? <span style={{fontSize:12,color:"var(--text-tertiary)"}}>—</span> : o.rec ? <span className="sm-pill accent">Recommended</span> : <button className="sm-btn xs ghost" style={{fontSize:10}}>Set Rec.</button>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>

                        {/* Right Rail */}
                        <div className="sm-d-rail">
                          {/* Client Decision */}
                          <div className="sm-card">
                            <div className="sm-r-hdr">
                              <h3>Client Decision</h3>
                              {selected.st==="draft" ? <span className="sm-pill">Draft</span> : selected.st==="decided" ? <span className="sm-pill green">Locked</span> : selected.st==="revision" ? <span className="sm-pill orange">Revision</span> : selected.od ? <span className="sm-pill orange">Awaiting</span> : <span className="sm-pill blue">In Progress</span>}
                            </div>
                            {selected.tl ? (
                              <div className="sm-cs-body">
                                <div className="sm-cs-bar-wrap">
                                  <div className="sm-cs-bar"><div className="sm-cs-fill" style={{width:`${selected.pp}%`}}/></div>
                                  <span className="sm-cs-pct">{selected.pp}%</span>
                                </div>
                                <div>
                                  {selected.tl.map((s,i) => (
                                    <div key={i} className={`sm-cs-step${s.done?" done":""}${s.cur?" cur":""}`}>
                                      <div className="sm-cs-dot">{s.done && <CheckIcon/>}</div>
                                      <div className="sm-cs-st"><h5>{s.l}</h5><p>{s.d}</p></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{padding:"16px 20px"}}>
                                <div style={{background:"var(--surface-2)",border:"1px dashed var(--surface-4)",borderRadius:14,padding:16,textAlign:"center"}}>
                                  <p style={{fontSize:12,color:"var(--text-secondary)",fontWeight:520}}>Publish this item to track client decisions.</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Financial Impact (decided only) */}
                          {selected.st==="decided" && (() => {
                            const so = selected.opts.find(o=>o.sel);
                            return (
                              <div className="sm-card" style={{padding:"16px 20px"}}>
                                <h4 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:14,fontWeight:700,marginBottom:12}}>Financial Impact</h4>
                                <div className="sm-b-row"><span className="bk">Allowance</span><span className="bv">{fmt(selected.al)}</span></div>
                                <div className="sm-b-row"><span className="bk">Selected price</span><span className="bv">{fmt(so?.p||0)}</span></div>
                                <div className="sm-b-row total"><span className="bk">Upgrade cost</span><span className="bv" style={{color:selected.selUp>0?"var(--warning-text)":"var(--success-text)"}}>{selected.selUp>0?`+${fmt(selected.selUp)}`:"$0"}</span></div>
                                <div className="sm-b-row"><span className="bk">Order status</span><span className="bv" style={{color:"var(--success-text)"}}>Placed</span></div>
                              </div>
                            );
                          })()}

                          {/* Activity */}
                          <div className="sm-card">
                            <div className="sm-r-hdr"><h3>Activity</h3></div>
                            <div className="sm-a-list">
                              {selected.act.map((a,i) => (
                                <div key={i} className="sm-a-item">
                                  <div className={`sm-a-dot ${a.c}`}/>
                                  <div className="sm-a-text">{a.x}</div>
                                  <div className="sm-a-time">{a.t}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <button className="sm-dark-toggle" onClick={()=>setDark(!dark)}>{dark?"☀️":"🌙"}</button>
      </div>
    </>
  );
}
