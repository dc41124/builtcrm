import { useState } from "react";

// BuiltCRM — Residential Selections Flow (Homeowner Portal)
// File #16 of 24 — Phase 2 conversion from residential_selections_flow.html
// Residential teal accent (#2a7f6f), 5 views: overview, exploring, provisional, confirmed, revision
// Font audit: DM Sans display/values, Instrument Sans body, portal pills (11px/650 borderless)

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Selection Overview Cards ────────────────────────────────────
const overviewItems = [
  { cat:"Kitchen", items:[
    { id:"flooring", title:"Flooring finish", desc:"Three hardwood options are ready for your review. This choice affects the install schedule.",
      bg:"linear-gradient(135deg,#d4c5a9,#e8dcc6,#c2b08a)", swatches:["#c2a87a,#a08855","#8b7355,#6b5540","#d4c8b0,#bfb59a"],
      statusPill:{text:"Decide this week",color:"red"}, pills:[{t:"Up next",c:"orange"},{t:"3 options",c:""},{t:"Recommended set",c:"teal"}], view:"exploring" },
    { id:"cabinet", title:"Cabinet paint color", desc:"Three reviewed paint options are ready for your final preference.",
      bg:"linear-gradient(135deg,#f0ece5,#e5ddd3,#d8cfc2)", swatches:["#f5f2eb,#e8e3d8","#b5bfa8,#99a68a","#4a4a4a,#333"],
      pills:[{t:"Ready to review",c:"blue"},{t:"3 options",c:""}], view:"exploring" },
    { id:"countertop", title:"Countertop material", desc:"You confirmed Calacatta quartz. Procurement is underway.",
      bg:"linear-gradient(135deg,#e0dcd6,#d0cac0,#c5bdb0)", swatches:["#e8e2d8,#d8d0c2"],
      statusPill:{text:"Confirmed",color:"green"}, pills:[{t:"Confirmed",c:"green"},{t:"Revision window closes Apr 18",c:""}], view:"confirmed" },
  ]},
  { cat:"Master Bathroom", items:[
    { id:"tile", title:"Tile pattern", desc:"Your original choice was temporarily unavailable. Two new options are available.",
      bg:"linear-gradient(135deg,#c5d0d8,#b0bcc5,#9faab5)", swatches:["#d0d8dd,#b8c4cc","#8a9ca8,#6b8090"],
      statusPill:{text:"Reopened",color:"orange"}, pills:[{t:"Needs attention",c:"orange"},{t:"2 options",c:""}], view:"revision" },
    { id:"fixture", title:"Fixture finish", desc:"Three finish options to match your hardware style.",
      bg:"linear-gradient(135deg,#d4cfc8,#c8c0b5,#b5aa9a)", swatches:["#c9a85c,#b08d3a","#2a2a2a,#111","#c0c0c0,#a0a0a0"],
      pills:[{t:"Not started",c:""},{t:"3 options",c:""}] },
  ]},
];

// ─── Flooring Options (exploring/provisional) ────────────────────
const flooringOptions = [
  { name:"Natural White Oak", desc:"Light, warm tone that pairs well with your cabinet and countertop selections. Low maintenance.",
    bg:"linear-gradient(135deg,#d4c5a9,#e8dcc6,#c2b08a)", sw:"linear-gradient(135deg,#c2a87a,#a08855)",
    rec:true, tier:"included", price:"Included", priceNote:"Within your allowance", timing:"No schedule impact", warn:false,
    attrs:["Warm tone","Matte finish","5\" plank"] },
  { name:"American Walnut", desc:"Rich, dark warmth with natural grain variation. A statement floor that anchors the space.",
    bg:"linear-gradient(135deg,#8b7355,#a08060,#6b5540)", sw:"linear-gradient(135deg,#8b7355,#6b5540)",
    rec:false, tier:"upgrade", price:"+$1,850", priceNote:"Above your allowance", timing:"+5 days lead time", warn:true,
    attrs:["Dark tone","Semi-gloss","6\" plank"] },
  { name:"Light Ash", desc:"Cool, airy feel with minimal grain. Opens up smaller rooms and pairs with modern palettes.",
    bg:"linear-gradient(135deg,#d4c8b0,#e0d8c5,#bfb59a)", sw:"linear-gradient(135deg,#d4c8b0,#bfb59a)",
    rec:false, tier:"included", price:"Included", priceNote:"Within your allowance", timing:"No schedule impact", warn:false,
    attrs:["Cool tone","Matte finish","5\" plank"] },
];

// ─── Revision Options ────────────────────────────────────────────
const revisionOptions = [
  { name:"Chevron Porcelain", desc:"Similar visual pattern to your original choice. Durable porcelain with marble-look finish.",
    bg:"linear-gradient(135deg,#c5d0d8,#b0bcc5)", sw:"linear-gradient(135deg,#d0d8dd,#b8c4cc)",
    rec:true, tier:"included", price:"Included", priceNote:"No cost change from original", timing:"No additional delay", warn:false },
  { name:"Subway Slate", desc:"Modern matte slate tile in a classic subway layout. Darker, more contemporary feel.",
    bg:"linear-gradient(135deg,#8a9ca8,#6b8090)", sw:"linear-gradient(135deg,#8a9ca8,#6b8090)",
    rec:false, tier:"upgrade", price:"+$420", priceNote:"Above original allowance", timing:"+3 days lead time", warn:true },
];

// Compare data
const compareRows = [
  { label:"Price impact", vals:["Included","+$1,850","Included"], styles:["accent","warning","accent"] },
  { label:"Schedule", vals:["No change","+5 days","No change"], styles:["","warning",""] },
  { label:"Tone", vals:["Warm","Dark warm","Cool"] },
  { label:"Finish", vals:["Matte","Semi-gloss","Matte"] },
  { label:"Plank width", vals:["5\"","6\"","5\""] },
];

// Icons
const BackArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m0 0 7 7m-7-7 7-7"/></svg>;
const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>;
const CalIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2Z"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
const BellIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>;
const WarnTriangle = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const LockIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const BigCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;

const LogoMark = () => (
  <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#1a1714,#3d3830)",display:"grid",placeItems:"center",flexShrink:0}}>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.45)"/><rect x="5" y="3" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.65)"/><rect x="8" y="7" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.95)"/></svg>
  </div>
);

// ─── Option Card Component ───────────────────────────────────────
function OptionCard({opt, selected, onClick}) {
  return (
    <div className={`rs-option-card${opt.rec?" recommended":""}${selected?" selected":""}`} onClick={onClick}>
      <div className="rs-opt-visual">
        <div style={{position:"absolute",inset:0,background:opt.bg}}/>
        <div className="rs-opt-swatch" style={{background:opt.sw}}/>
        <div className="rs-opt-tags">
          {opt.rec && <span className="rs-opt-tag rec">Recommended</span>}
          <span className={`rs-opt-tag ${opt.tier==="included"?"inc":opt.tier==="upgrade"?"upg":"prem"}`}>
            {opt.tier==="included"?"Included":opt.tier==="upgrade"?"Upgrade":"Premium"}
          </span>
        </div>
        <div className="rs-opt-check"><CheckIcon/></div>
      </div>
      <div className="rs-opt-body">
        <h4>{opt.name}</h4>
        <p>{opt.desc}</p>
        <div className="rs-opt-price">
          <span className={`rs-price ${opt.tier==="included"?"included":"upgrade"}`}>{opt.price}</span>
          <span className="rs-price-note">{opt.priceNote}</span>
        </div>
        <div className={`rs-opt-timing${opt.warn?" warn":""}`}><ClockIcon/> {opt.timing}</div>
        {opt.attrs && <div className="rs-opt-attrs">{opt.attrs.map((a,i)=><span key={i} className="rs-attr-tag">{a}</span>)}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function ResidentialSelectionsFlow() {
  const [dark, setDark] = useState(false);
  const [currentView, setCurrentView] = useState("overview");
  const [selectedOption, setSelectedOption] = useState(null);
  const [revisionSelected, setRevisionSelected] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const th = dark ? "dark" : "light";
  const goTo = (v) => { setCurrentView(v); setSelectedOption(null); setRevisionSelected(null); setShowCompare(false); setConfirmed(false); };

  const bcLabel = currentView==="overview"?"Selections":currentView==="revision"?"Tile Pattern":"Flooring Finish";

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet"/>
      <style>{`
[data-theme="light"]{
  --surface-0:#eef0f3;--surface-1:#ffffff;--surface-2:#f3f4f6;--surface-3:#e2e5e9;--surface-4:#d1d5db;
  --surface-hover:#f5f6f8;
  --sidebar-bg:#ffffff;--sidebar-hover:#f5f6f8;--sidebar-active:#eef0f3;--sidebar-active-text:#1a1714;
  --sidebar-section-text:#8b919a;--sidebar-item-text:#5a6170;--sidebar-border:#e8eaee;
  --text-primary:#1a1714;--text-secondary:#6b655b;--text-tertiary:#9c958a;
  --accent:#2a7f6f;--accent-hover:#237060;--accent-soft:#e6f5f1;--accent-text:#1f6b5c;--accent-muted:#b0d9cf;
  --success:#2d8a5e;--success-soft:#edf7f1;--success-text:#1e6b46;
  --warning:#c17a1a;--warning-soft:#fdf4e6;--warning-text:#96600f;
  --danger:#c93b3b;--danger-soft:#fdeaea;--danger-text:#a52e2e;
  --info:#3178b9;--info-soft:#e8f1fa;--info-text:#276299;
  --topbar-bg:rgba(255,255,255,.88);
  --sc-teal:linear-gradient(180deg,#fff,#f2faf7);--sc-orange:linear-gradient(180deg,#fff,#fefaf3);
  --rail-teal:linear-gradient(180deg,#f2faf7,#fff);--rail-orange:linear-gradient(180deg,#fefaf3,#fff);
  --post-bg:linear-gradient(180deg,#f2faf7,#fff);
}
[data-theme="dark"]{
  --surface-0:#0e0f11;--surface-1:#18191c;--surface-2:#1e2023;--surface-3:#2a2d31;--surface-4:#3a3e44;
  --surface-hover:#1f2124;
  --sidebar-bg:#141517;--sidebar-hover:#1c1d20;--sidebar-active:#1e2023;--sidebar-active-text:#f0ede8;
  --sidebar-section-text:#6b7280;--sidebar-item-text:#9ca3af;--sidebar-border:#232528;
  --text-primary:#f0ede8;--text-secondary:#a09a90;--text-tertiary:#706a60;
  --accent:#40b89e;--accent-hover:#50c8ae;--accent-soft:#0d2520;--accent-text:#6fd4b8;--accent-muted:#1a4a40;
  --success:#3aad72;--success-soft:#0f251a;--success-text:#5dd89a;
  --warning:#daa050;--warning-soft:#271d0b;--warning-text:#eab96e;
  --danger:#e25555;--danger-soft:#2a1010;--danger-text:#f28080;
  --info:#5a9fd4;--info-soft:#0d1a2a;--info-text:#80b8e8;
  --topbar-bg:rgba(14,15,17,.88);
  --sc-teal:linear-gradient(180deg,var(--surface-1),#0d2520);--sc-orange:linear-gradient(180deg,var(--surface-1),var(--warning-soft));
  --rail-teal:linear-gradient(180deg,#0d2520,var(--surface-1));--rail-orange:linear-gradient(180deg,var(--warning-soft),var(--surface-1));
  --post-bg:linear-gradient(180deg,#0d2520,var(--surface-1));
}
*,*::before,*::after{box-sizing:border-box;margin:0}
.rs-app{display:grid;grid-template-columns:272px 1fr;min-height:100vh;font-family:'Instrument Sans',system-ui,sans-serif;background:var(--surface-0);color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px}

/* SIDEBAR */
.rs-sidebar{background:var(--sidebar-bg);border-right:1px solid var(--sidebar-border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.rs-brand{height:56px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.rs-brand-name{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:-.02em}
.rs-brand-ctx{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}
.rs-sb-search{padding:12px 16px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.rs-sb-input{width:100%;height:36px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);padding:0 12px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;color:var(--text-primary);outline:none;font-weight:520}
.rs-sb-input:focus{border-color:var(--accent)}
.rs-sb-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.rs-ns-label{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;color:var(--sidebar-section-text);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.rs-ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:10px;font-size:13px;color:var(--sidebar-item-text);font-weight:520;cursor:pointer;margin-bottom:2px;transition:all .15s}
.rs-ni:hover{background:var(--sidebar-hover);color:var(--sidebar-active-text)}
.rs-ni.active{background:var(--accent-soft);color:var(--accent-text);font-weight:650}
.rs-ni-badge{min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:var(--accent-soft);color:var(--accent-text);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif}
.rs-ni-badge.warn{background:var(--warning-soft);color:var(--warning-text)}
.rs-sb-foot{border-top:1px solid var(--sidebar-border);padding:12px 16px;flex-shrink:0}

/* MAIN */
.rs-main{min-width:0;display:flex;flex-direction:column}
.rs-topbar{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--surface-3);background:var(--topbar-bg);backdrop-filter:blur(12px);position:sticky;top:0;z-index:50}
.rs-bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-tertiary);font-weight:520;cursor:pointer}
.rs-bc-cur{color:var(--text-primary);font-weight:650;cursor:default}
.rs-bc-sep{font-size:11px;color:var(--surface-4)}
.rs-content{padding:24px;flex:1}
.rs-dark-toggle{position:fixed;bottom:20px;right:20px;z-index:100;width:40px;height:40px;border-radius:50%;background:var(--surface-1);border:1px solid var(--surface-3);box-shadow:0 4px 16px rgba(0,0,0,.1);display:grid;place-items:center;cursor:pointer;font-size:16px;transition:all .2s}
.rs-dark-toggle:hover{transform:scale(1.1)}

/* BUTTONS */
.rs-btn{height:38px;padding:0 16px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;font-weight:650;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;white-space:nowrap}
.rs-btn:hover{border-color:var(--surface-4);background:var(--surface-hover)}
.rs-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.rs-btn.primary:hover{background:var(--accent-hover)}
.rs-btn.outline-teal{border-color:var(--accent-muted);color:var(--accent-text)}.rs-btn.outline-teal:hover{background:var(--accent-soft)}
.rs-btn.sm{height:34px;padding:0 14px;font-size:12px}

/* PILLS — portal style (11px/650 borderless) */
.rs-pill{height:22px;padding:0 9px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:650;display:inline-flex;align-items:center;background:var(--surface-2);color:var(--text-tertiary);white-space:nowrap;flex-shrink:0}
.rs-pill.teal{background:var(--accent-soft);color:var(--accent-text)}
.rs-pill.green{background:var(--success-soft);color:var(--success-text)}
.rs-pill.orange{background:var(--warning-soft);color:var(--warning-text)}
.rs-pill.red{background:var(--danger-soft);color:var(--danger-text)}
.rs-pill.blue{background:var(--info-soft);color:var(--info-text)}

/* STATE TABS */
.rs-state-nav{display:flex;gap:4px;margin-bottom:20px;background:var(--surface-2);border-radius:14px;padding:4px;width:fit-content}
.rs-state-tab{height:34px;padding:0 16px;border-radius:10px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;font-weight:650;color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .15s;background:none;border:none}
.rs-state-tab:hover{color:var(--text-primary)}
.rs-state-tab.active{background:var(--surface-1);color:var(--text-primary);box-shadow:0 1px 3px rgba(26,23,20,.05)}
.rs-tab-dot{width:6px;height:6px;border-radius:50%}

/* SUMMARY STRIP */
.rs-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.rs-sc{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;padding:14px 16px;box-shadow:0 1px 3px rgba(26,23,20,.05)}
.rs-sc.teal{border-color:var(--accent-muted);background:var(--sc-teal)}
.rs-sc.orange{border-color:#f5d5a0;background:var(--sc-orange)}
.rs-sc-label{font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;font-weight:560;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary)}
.rs-sc-value{font-family:'DM Sans',system-ui,sans-serif;font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.rs-sc-meta{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}

/* CATEGORY / CARD GRID */
.rs-cat-label{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.rs-cat-count{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;color:var(--text-tertiary);background:var(--surface-2);padding:2px 8px;border-radius:999px}
.rs-item-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-bottom:24px}
.rs-sel-card{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,23,20,.05);cursor:pointer;transition:all .2s}
.rs-sel-card:hover{box-shadow:0 4px 16px rgba(26,23,20,.06);border-color:var(--surface-4);transform:translateY(-1px)}
.rs-sel-card-visual{height:100px;display:flex;align-items:flex-end;padding:10px 14px;position:relative;overflow:hidden}
.rs-sel-card-visual::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.06) 100%)}
.rs-swatch{width:38px;height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(0,0,0,.12);position:relative;z-index:1}
.rs-sel-card-status{position:absolute;top:10px;right:10px;z-index:1}
.rs-sel-card-body{padding:14px 16px 16px}
.rs-sel-card-body h4{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700;letter-spacing:-.01em}
.rs-sel-card-body p{font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.45;font-weight:520}
.rs-sel-card-footer{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}

/* DETAIL LAYOUT */
.rs-detail{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.rs-back{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-tertiary);font-weight:550;margin-bottom:14px;cursor:pointer;transition:color .2s;background:none;border:none;font-family:inherit}
.rs-back:hover{color:var(--accent)}

/* ITEM HEADER */
.rs-item-header{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;padding:20px 22px;box-shadow:0 1px 3px rgba(26,23,20,.05);margin-bottom:14px}
.rs-ih-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.rs-ih-title{font-family:'DM Sans',system-ui,sans-serif;font-size:22px;font-weight:820;letter-spacing:-.02em}
.rs-ih-desc{font-size:13px;color:var(--text-secondary);margin-top:4px;max-width:560px;font-weight:520;line-height:1.5}
.rs-meta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.rs-meta-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);font-size:12px;color:var(--text-secondary);font-weight:520}
.rs-meta-chip strong{color:var(--text-primary);font-weight:650}
.rs-meta-chip svg{color:var(--text-tertiary)}

/* OPTION CARDS */
.rs-options-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.rs-options-head h3{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700}
.rs-options-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.rs-options-grid.two{grid-template-columns:repeat(2,1fr)}
.rs-option-card{background:var(--surface-1);border:2px solid var(--surface-3);border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(26,23,20,.05);transition:all .2s;cursor:pointer;position:relative}
.rs-option-card:hover{border-color:var(--surface-4);box-shadow:0 4px 16px rgba(26,23,20,.06)}
.rs-option-card.selected{border-color:var(--accent);box-shadow:0 0 0 3px rgba(42,127,111,.18),0 4px 16px rgba(26,23,20,.06)}
.rs-option-card.recommended{border-color:var(--accent-muted)}.rs-option-card.selected.recommended{border-color:var(--accent)}
.rs-opt-visual{height:160px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.rs-opt-swatch{width:72px;height:72px;border-radius:16px;border:3px solid rgba(255,255,255,.8);box-shadow:0 6px 20px rgba(0,0,0,.15);position:relative;z-index:1}
.rs-opt-tags{position:absolute;top:10px;left:10px;display:flex;gap:5px;flex-wrap:wrap;z-index:2}
.rs-opt-tag{height:22px;padding:0 9px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:750;letter-spacing:.02em;display:inline-flex;align-items:center;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.6);color:var(--text-secondary);backdrop-filter:blur(6px)}
.rs-opt-tag.rec{background:#eef8f4;border-color:#bde5d4;color:var(--success-text)}
.rs-opt-tag.inc{background:var(--accent-soft);border-color:var(--accent-muted);color:var(--accent-text)}
.rs-opt-tag.upg{background:var(--warning-soft);border-color:#f0cc8a;color:var(--warning-text)}
.rs-opt-check{position:absolute;top:10px;right:10px;z-index:2;width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.7);background:rgba(255,255,255,.5);display:grid;place-items:center;backdrop-filter:blur(4px)}
.rs-option-card.selected .rs-opt-check{background:var(--accent);border-color:var(--accent)}
.rs-opt-check svg{color:transparent}.rs-option-card.selected .rs-opt-check svg{color:#fff}
.rs-opt-body{padding:14px 16px 16px}
.rs-opt-body h4{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700}
.rs-opt-body p{font-size:12px;color:var(--text-secondary);margin-top:3px;line-height:1.45;font-weight:520}
.rs-opt-price{margin-top:10px;display:flex;align-items:baseline;gap:6px}
.rs-price{font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:750}
.rs-price.included{color:var(--accent-text)}.rs-price.upgrade{color:var(--warning-text)}
.rs-price-note{font-size:11px;color:var(--text-tertiary);font-weight:520}
.rs-opt-timing{margin-top:6px;font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:4px;font-weight:520}
.rs-opt-timing.warn{color:var(--warning-text)}
.rs-opt-attrs{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}
.rs-attr-tag{height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;color:var(--text-tertiary);border:1px solid var(--surface-3);background:var(--surface-2);display:inline-flex;align-items:center}

/* RAIL */
.rs-rail{display:flex;flex-direction:column;gap:12px}
.rs-rail-card{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;box-shadow:0 1px 3px rgba(26,23,20,.05);overflow:hidden}
.rs-rail-card.teal{border-color:var(--accent-muted);background:var(--rail-teal)}
.rs-rail-card.orange{border-color:#f0cc8a;background:var(--rail-orange)}
.rs-rch{padding:16px 18px 0}
.rs-rch h3{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700}
.rs-rch-sub{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}
.rs-rcb{padding:12px 18px 18px}
.rs-rcb p{font-size:13px;color:var(--text-secondary);line-height:1.55;font-weight:520}
.rs-impact-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface-2)}
.rs-impact-row:last-child{border-bottom:none}
.rs-impact-row h5{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:650}
.rs-impact-row p{font-size:12px;color:var(--text-secondary);margin-top:1px;font-weight:520}
.rs-impact-val{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0}
.rs-file-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface-2)}
.rs-file-row:last-child{border-bottom:none}
.rs-file-row h5{font-size:13px;font-weight:600}.rs-file-row p{font-size:12px;color:var(--text-secondary);margin-top:1px;font-weight:520}
.rs-file-chip{font-size:11px;font-weight:700;color:var(--text-tertiary);padding:3px 8px;border-radius:6px;background:var(--surface-2);white-space:nowrap}

/* POST-CONFIRM CARD */
.rs-post-card{background:var(--post-bg);border:1px solid var(--accent-muted);border-radius:18px;padding:18px 20px;box-shadow:0 1px 3px rgba(26,23,20,.05)}
.rs-post-card h3{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700;color:var(--accent-text);display:flex;align-items:center;gap:8px}
.rs-post-step{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(42,127,111,.1)}
.rs-post-step:last-child{border-bottom:none}
.rs-post-dot{width:24px;height:24px;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);display:grid;place-items:center;flex-shrink:0;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:800}
.rs-post-text h5{font-size:13px;font-weight:650}.rs-post-text p{font-size:12px;color:var(--text-secondary);margin-top:1px;font-weight:520}

/* COMMENT */
.rs-comment-input{display:flex;gap:8px;margin-top:8px}
.rs-comment-input input{flex:1;height:36px;border-radius:10px;border:1px solid var(--surface-3);padding:0 12px;font-size:13px;color:var(--text-primary);outline:none;background:var(--surface-2);font-family:'Instrument Sans',system-ui,sans-serif;font-weight:520}
.rs-comment-input input:focus{border-color:var(--accent);background:var(--surface-1)}

/* COMPARE PANEL */
.rs-compare{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;box-shadow:0 10px 32px rgba(26,23,20,.08);padding:20px 22px;margin-top:16px}
.rs-compare h3{font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:750}
.rs-cg{display:grid;grid-template-columns:150px repeat(3,1fr);margin-top:16px}
.rs-cg-header{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary);padding:10px 12px;background:var(--surface-2);border-bottom:1px solid var(--surface-3)}
.rs-cg-label{font-size:12px;font-weight:650;color:var(--text-secondary);padding:12px;border-bottom:1px solid var(--surface-2);display:flex;align-items:center}
.rs-cg-cell{padding:12px;border-bottom:1px solid var(--surface-2);font-size:13px;display:flex;align-items:center;font-weight:520}
.rs-cg-cell.hl{background:rgba(42,127,111,.04)}

/* LOCKED BANNER */
.rs-locked-banner{background:var(--surface-2);border:1px solid var(--surface-3);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:10px;margin-bottom:14px}
.rs-locked-banner p{font-size:13px;color:var(--text-secondary);font-weight:520}
.rs-locked-banner strong{color:var(--text-primary);font-weight:650}

/* REVISION BANNER */
.rs-rev-banner{background:var(--warning-soft);border:1px solid #f0cc8a;border-radius:14px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-start;gap:12px}
.rs-rev-banner h4{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;color:var(--warning-text)}
.rs-rev-banner p{font-size:12px;color:var(--text-secondary);margin-top:2px;font-weight:520}

/* ANIMATIONS */
@keyframes rs-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.rs-anim{animation:rs-fadeIn .35s cubic-bezier(.16,1,.3,1) both}

/* RESPONSIVE */
@media(max-width:1100px){.rs-detail{grid-template-columns:1fr}.rs-options-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){.rs-app{grid-template-columns:1fr}.rs-sidebar{display:none}.rs-summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.rs-options-grid,.rs-options-grid.two{grid-template-columns:1fr}.rs-summary{grid-template-columns:1fr}.rs-content{padding:16px}}
      `}</style>

      <div className="rs-app" data-theme={th}>
        {/* SIDEBAR */}
        <aside className="rs-sidebar">
          <div className="rs-brand"><LogoMark/><div><div className="rs-brand-name">BuiltCRM</div><div className="rs-brand-ctx">Homeowner Portal</div></div></div>
          <div className="rs-sb-search"><input className="rs-sb-input" placeholder="Search your project…"/></div>
          <nav className="rs-sb-nav">
            <div className="rs-ns-label">Your Project</div>
            <div className="rs-ni">Project Home</div>
            <div className="rs-ni active">Selections <span className="rs-ni-badge">5</span></div>
            <div className="rs-ni">Photos & Updates</div>
            <div className="rs-ni">Schedule</div>
            <div className="rs-ni">Scope Changes</div>
            <div className="rs-ni">Documents</div>
            <div className="rs-ni">Messages <span className="rs-ni-badge warn">2</span></div>
            <div className="rs-ni">Payments</div>
            <div className="rs-ns-label">Support</div>
            <div className="rs-ni">Project Team</div>
            <div className="rs-ni">Help & FAQ</div>
          </nav>
          <div className="rs-sb-foot">
            <div style={{display:"flex",alignItems:"center",gap:12,padding:8}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"var(--accent)",color:"#fff",display:"grid",placeItems:"center",fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:12,fontWeight:700}}>SH</div>
              <div><div style={{fontSize:13,fontWeight:580}}>Sarah Harrison</div><div style={{fontSize:11,color:"var(--text-tertiary)",fontWeight:520}}>Homeowner</div></div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="rs-main">
          <header className="rs-topbar">
            <div className="rs-bc">
              <span onClick={()=>goTo("overview")}>The Harrison Residence</span>
              <span className="rs-bc-sep">›</span>
              <span className="rs-bc-cur">{bcLabel}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button style={{width:34,height:34,borderRadius:10,border:"1px solid var(--surface-3)",background:"var(--surface-1)",color:"var(--text-tertiary)",display:"grid",placeItems:"center",cursor:"pointer"}}><BellIcon/></button>
              <div style={{width:32,height:32,borderRadius:"50%",background:"var(--accent)",color:"#fff",display:"grid",placeItems:"center",fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:12,fontWeight:700}}>SH</div>
            </div>
          </header>

          <div className="rs-content">
            {/* State Nav Tabs */}
            <div className="rs-state-nav">
              {[{k:"overview",label:"Overview",dot:"var(--accent)"},{k:"exploring",label:"Exploring",dot:"var(--warning)"},{k:"provisional",label:"Provisional",dot:"var(--accent)"},{k:"confirmed",label:"Confirmed",dot:"var(--success)"},{k:"revision",label:"Revision",dot:"var(--danger)"}].map(t=>(
                <button key={t.k} className={`rs-state-tab${currentView===t.k?" active":""}`} onClick={()=>goTo(t.k)}>
                  <span className="rs-tab-dot" style={{background:t.dot}}/> {t.label}
                </button>
              ))}
            </div>

            {/* ════ OVERVIEW ════ */}
            {currentView==="overview" && (
              <div className="rs-anim">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20,marginBottom:20}}>
                  <div>
                    <h2 style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:26,fontWeight:820,letterSpacing:"-.035em"}}>Your Selections</h2>
                    <p style={{marginTop:4,fontSize:13,color:"var(--text-secondary)",maxWidth:520,fontWeight:520}}>Your builder has prepared finish options for you to review. Take your time — we'll let you know which ones need attention first.</p>
                  </div>
                </div>
                <div className="rs-summary">
                  <div className="rs-sc teal"><div className="rs-sc-label">Ready to choose</div><div className="rs-sc-value">3</div><div className="rs-sc-meta">Options are waiting for you</div></div>
                  <div className="rs-sc orange"><div className="rs-sc-label">Time-sensitive</div><div className="rs-sc-value">1</div><div className="rs-sc-meta">Affects scheduling this week</div></div>
                  <div className="rs-sc"><div className="rs-sc-label">Confirmed</div><div className="rs-sc-value">1</div><div className="rs-sc-meta">Locked in and moving forward</div></div>
                  <div className="rs-sc"><div className="rs-sc-label">Upgrade total</div><div className="rs-sc-value">+$1,850</div><div className="rs-sc-meta">Based on current choices</div></div>
                </div>
                {overviewItems.map(cat=>(
                  <div key={cat.cat}>
                    <div className="rs-cat-label">{cat.cat} <span className="rs-cat-count">{cat.items.length} items</span></div>
                    <div className="rs-item-grid">
                      {cat.items.map(item=>(
                        <div key={item.id} className="rs-sel-card" onClick={()=>item.view&&goTo(item.view)}>
                          <div className="rs-sel-card-visual" style={{background:item.bg}}>
                            <div style={{display:"flex",gap:6,position:"relative",zIndex:1}}>
                              {item.swatches.map((s,i)=><div key={i} className="rs-swatch" style={{background:`linear-gradient(135deg,${s})`}}/>)}
                            </div>
                            {item.statusPill && <span className="rs-sel-card-status"><span className={`rs-pill ${item.statusPill.color}`}>{item.statusPill.text}</span></span>}
                          </div>
                          <div className="rs-sel-card-body">
                            <h4>{item.title}</h4>
                            <p>{item.desc}</p>
                            <div className="rs-sel-card-footer">
                              {item.pills.map((p,i)=><span key={i} className={`rs-pill ${p.c}`}>{p.t}</span>)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ════ EXPLORING ════ */}
            {currentView==="exploring" && (
              <div className="rs-anim">
                <button className="rs-back" onClick={()=>goTo("overview")}><BackArrow/> Back to all selections</button>
                <div className="rs-detail">
                  <div>
                    <div className="rs-item-header">
                      <div className="rs-ih-top">
                        <div>
                          <h2 className="rs-ih-title">Flooring finish</h2>
                          <p className="rs-ih-desc">Your builder has prepared three hardwood options for the main living areas. The recommendation is based on your home's lighting and the finishes already selected.</p>
                        </div>
                        <span className="rs-pill red">Decide this week</span>
                      </div>
                      <div className="rs-meta-row">
                        <div className="rs-meta-chip"><CalIcon/> Decide by <strong>Apr 18</strong></div>
                        <div className="rs-meta-chip"><strong>3</strong> options</div>
                        <div className="rs-meta-chip"><ClockIcon/> May affect schedule</div>
                        <div className="rs-meta-chip">Allowance: <strong>$4,200</strong></div>
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div className="rs-options-head">
                        <h3>Your options</h3>
                        <button className="rs-btn sm outline-teal" onClick={()=>setShowCompare(!showCompare)}>Compare side by side</button>
                      </div>
                      <div className="rs-options-grid">
                        {flooringOptions.map((opt,i)=>(
                          <OptionCard key={i} opt={opt} selected={selectedOption===i} onClick={()=>{setSelectedOption(i);setTimeout(()=>goTo("provisional"),600);}}/>
                        ))}
                      </div>
                    </div>
                    {showCompare && (
                      <div className="rs-compare">
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                          <h3>Side-by-side comparison</h3>
                          <button className="rs-btn sm" onClick={()=>setShowCompare(false)}>Close</button>
                        </div>
                        <div className="rs-cg">
                          <div className="rs-cg-header"></div>
                          {flooringOptions.map((o,i)=><div key={i} className="rs-cg-header">{o.name}</div>)}
                          {compareRows.map((row,ri)=><>
                            <div key={`l${ri}`} className="rs-cg-label">{row.label}</div>
                            {row.vals.map((v,ci)=><div key={`c${ri}${ci}`} className={`rs-cg-cell${ci===0?" hl":""}`} style={row.styles?.[ci]==="accent"?{color:"var(--accent-text)",fontWeight:700}:row.styles?.[ci]==="warning"?{color:"var(--warning-text)",fontWeight:700}:{}}>{v}</div>)}
                          </>)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rs-rail">
                    <div className="rs-rail-card teal">
                      <div className="rs-rch"><h3>What your builder recommends</h3><div className="rs-rch-sub">This is a suggestion — the choice is yours.</div></div>
                      <div className="rs-rcb">
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#c2a87a,#a08855)",border:"1px solid var(--surface-3)",flexShrink:0}}/>
                          <div><div style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontWeight:700,fontSize:14}}>Natural White Oak</div><div style={{fontSize:12,color:"var(--text-secondary)",fontWeight:520}}>Included · No schedule change</div></div>
                        </div>
                        <p style={{fontSize:12,color:"var(--text-secondary)",marginTop:10,lineHeight:1.5}}>Your design team picked this option because it pairs well with the Calacatta countertop you already confirmed and the warm lighting in your open floor plan.</p>
                      </div>
                    </div>
                    <div className="rs-rail-card">
                      <div className="rs-rch"><h3>Helpful files</h3><div className="rs-rch-sub">References to help you decide.</div></div>
                      <div className="rs-rcb">
                        <div className="rs-file-row"><div><h5>Flooring samples photo board</h5><p>All three options photographed in similar lighting.</p></div><span className="rs-file-chip">PDF</span></div>
                        <div className="rs-file-row"><div><h5>Hardwood care guide</h5><p>Maintenance and cleaning recommendations.</p></div><span className="rs-file-chip">PDF</span></div>
                      </div>
                    </div>
                    <div className="rs-rail-card">
                      <div className="rs-rch"><h3>Questions?</h3><div className="rs-rch-sub">Ask your project team anything.</div></div>
                      <div className="rs-rcb">
                        <div className="rs-comment-input"><input placeholder="Ask a question…"/><button className="rs-btn sm primary">Send</button></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ PROVISIONAL ════ */}
            {currentView==="provisional" && (
              <div className="rs-anim">
                <button className="rs-back" onClick={()=>goTo("overview")}><BackArrow/> Back to all selections</button>
                <div className="rs-detail">
                  <div>
                    <div className="rs-item-header">
                      <div className="rs-ih-top">
                        <div><h2 className="rs-ih-title">Flooring finish</h2><p className="rs-ih-desc">You've selected an option. Review the impact below and confirm when you're ready.</p></div>
                        <span className="rs-pill teal">Provisional choice</span>
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div className="rs-options-head"><h3>Your provisional selection</h3></div>
                      <div className="rs-options-grid" style={{gridTemplateColumns:"1fr"}}>
                        <OptionCard opt={flooringOptions[0]} selected={true} onClick={()=>{}}/>
                      </div>
                    </div>
                  </div>
                  <div className="rs-rail">
                    <div className="rs-rail-card teal">
                      <div className="rs-rch"><h3>Impact summary</h3><div className="rs-rch-sub">What this choice means for your project.</div></div>
                      <div className="rs-rcb">
                        <div className="rs-impact-row"><div><h5>Budget impact</h5><p>Within your $4,200 allowance</p></div><span className="rs-impact-val" style={{color:"var(--success-text)"}}>Included</span></div>
                        <div className="rs-impact-row"><div><h5>Schedule impact</h5><p>No delay to your timeline</p></div><span className="rs-impact-val" style={{color:"var(--success-text)"}}>None</span></div>
                        <div className="rs-impact-row"><div><h5>Revision window</h5><p>You can change your mind within 48h</p></div><span className="rs-impact-val">48 hours</span></div>
                        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
                          {confirmed ? (
                            <button className="rs-btn primary" style={{opacity:.7,pointerEvents:"none"}}><CheckIcon/> Confirmed</button>
                          ) : (
                            <button className="rs-btn primary" onClick={()=>setConfirmed(true)}>Confirm Natural White Oak</button>
                          )}
                          <button className="rs-btn" onClick={()=>goTo("exploring")}>Change my mind</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ CONFIRMED ════ */}
            {currentView==="confirmed" && (
              <div className="rs-anim">
                <button className="rs-back" onClick={()=>goTo("overview")}><BackArrow/> Back to all selections</button>
                <div className="rs-detail">
                  <div>
                    <div className="rs-locked-banner"><LockIcon/><p>This selection is <strong>confirmed and locked</strong>. The revision window has closed.</p></div>
                    <div className="rs-item-header">
                      <div className="rs-ih-top">
                        <div><h2 className="rs-ih-title">Flooring finish</h2><p className="rs-ih-desc">You confirmed Natural White Oak. Your builder has placed the order.</p></div>
                        <span className="rs-pill green">Confirmed</span>
                      </div>
                    </div>
                    <div className="rs-post-card" style={{marginTop:14}}>
                      <h3><BigCheck/> What happens next</h3>
                      <div style={{marginTop:12}}>
                        {[{n:"1",t:"Order placed",d:"Your builder ordered the material on Apr 12."},{n:"2",t:"Delivery scheduled",d:"Expected to arrive at the job site by Apr 22."},{n:"3",t:"Installation",d:"Install is scheduled during the flooring phase of your timeline."}].map((s,i)=>(
                          <div key={i} className="rs-post-step"><div className="rs-post-dot">{s.n}</div><div className="rs-post-text"><h5>{s.t}</h5><p>{s.d}</p></div></div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rs-rail">
                    <div className="rs-rail-card">
                      <div className="rs-rch"><h3>Your choice</h3></div>
                      <div className="rs-rcb">
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#c2a87a,#a08855)",border:"1px solid var(--surface-3)",flexShrink:0}}/>
                          <div><div style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontWeight:700,fontSize:14}}>Natural White Oak</div><div style={{fontSize:12,color:"var(--text-secondary)",fontWeight:520}}>Included · Confirmed Apr 10</div></div>
                        </div>
                      </div>
                    </div>
                    <div className="rs-rail-card">
                      <div className="rs-rch"><h3>Questions?</h3></div>
                      <div className="rs-rcb"><div className="rs-comment-input"><input placeholder="Ask your project team…"/><button className="rs-btn sm primary">Send</button></div></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════ REVISION ════ */}
            {currentView==="revision" && (
              <div className="rs-anim">
                <button className="rs-back" onClick={()=>goTo("overview")}><BackArrow/> Back to all selections</button>
                <div className="rs-detail">
                  <div>
                    <div className="rs-rev-banner"><WarnTriangle/><div><h4>Your previous choice is no longer available</h4><p>Herringbone Marble is on backorder. Your builder prepared two alternatives that match the style and budget.</p></div></div>
                    <div className="rs-item-header">
                      <div className="rs-ih-top">
                        <div><h2 className="rs-ih-title">Tile pattern</h2><p className="rs-ih-desc">Your shower surround tile needs a new selection. Two replacement options are ready.</p></div>
                        <span className="rs-pill orange">Reopened</span>
                      </div>
                      <div className="rs-meta-row">
                        <div className="rs-meta-chip"><strong>Reason:</strong> Original option unavailable</div>
                        <div className="rs-meta-chip">Previous choice: <strong>Herringbone Marble</strong></div>
                        <div className="rs-meta-chip"><strong>2</strong> new options</div>
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div className="rs-options-head"><h3>Updated options</h3></div>
                      <div className="rs-options-grid two">
                        {revisionOptions.map((opt,i)=>(
                          <OptionCard key={i} opt={opt} selected={revisionSelected===i} onClick={()=>setRevisionSelected(i)}/>
                        ))}
                      </div>
                    </div>
                    <div style={{background:"var(--surface-2)",border:"1px solid var(--surface-3)",borderRadius:14,padding:"14px 18px",opacity:.7}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",color:"var(--text-tertiary)"}}>Previous choice (unavailable)</div>
                          <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontWeight:700,fontSize:14,marginTop:4}}>Herringbone Marble</div>
                          <div style={{fontSize:12,color:"var(--text-secondary)",marginTop:2,fontWeight:520}}>This option is currently unavailable from the supplier.</div>
                        </div>
                        <span className="rs-pill">Unavailable</span>
                      </div>
                    </div>
                  </div>
                  <div className="rs-rail">
                    <div className="rs-rail-card orange">
                      <div className="rs-rch"><h3>Why this was reopened</h3></div>
                      <div className="rs-rcb">
                        <p>The supplier notified us that Herringbone Marble is on backorder with no confirmed restock date. To keep your project on schedule, your builder prepared two alternatives that match the style and budget of your original choice.</p>
                        <p style={{fontSize:12,color:"var(--text-tertiary)",marginTop:10}}>If the original becomes available again before install, your team will let you know.</p>
                      </div>
                    </div>
                    <div className="rs-rail-card">
                      <div className="rs-rch"><h3>Impact summary</h3><div className="rs-rch-sub">What changes with the recommended replacement.</div></div>
                      <div className="rs-rcb">
                        <div className="rs-impact-row"><div><h5>Cost vs original</h5><p>Chevron Porcelain matches original price</p></div><span className="rs-impact-val" style={{color:"var(--success-text)"}}>No change</span></div>
                        <div className="rs-impact-row"><div><h5>Schedule vs original</h5><p>No additional delay with recommended</p></div><span className="rs-impact-val" style={{color:"var(--success-text)"}}>On track</span></div>
                        <div className="rs-impact-row"><div><h5>Style match</h5><p>Similar pattern and color family</p></div><span className="rs-impact-val">Close match</span></div>
                      </div>
                    </div>
                    <div className="rs-rail-card">
                      <div className="rs-rch"><h3>Questions about the change?</h3></div>
                      <div className="rs-rcb"><div className="rs-comment-input"><input placeholder="Ask your project team…"/><button className="rs-btn sm primary">Send</button></div></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <button className="rs-dark-toggle" onClick={()=>setDark(!dark)}>{dark?"☀️":"🌙"}</button>
      </div>
    </>
  );
}
