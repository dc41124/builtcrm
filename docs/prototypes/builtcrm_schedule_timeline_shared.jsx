import { useState } from "react";

// ── Portal accent CSS var maps ──
const PORTAL_THEMES = {
  contractor: {},
  sub: { "--accent":"#3d6b8e","--accent-hover":"#345d7c","--accent-soft":"#e8f0f6","--accent-text":"#2e5a78","--accent-muted":"#b3cede","--shadow-ring":"0 0 0 3px rgba(61,107,142,.15)" },
  comm: { "--accent":"#3178b9","--accent-hover":"#296aa6","--accent-soft":"#e8f1fa","--accent-text":"#276299","--accent-muted":"#b0cfe8","--shadow-ring":"0 0 0 3px rgba(49,120,185,.15)" },
  resi: { "--accent":"#2a7f6f","--accent-hover":"#237060","--accent-soft":"#e6f5f1","--accent-text":"#1f6b5d","--accent-muted":"#a8d5ca","--shadow-ring":"0 0 0 3px rgba(42,127,111,.15)" },
};

const PORTAL_META = {
  contractor: { label:"Contractor Portal", dot:"#5b4fc7", avatar:"DC", name:"Dan Carter", role:"Project Manager" },
  sub: { label:"Subcontractor Portal", dot:"#3d6b8e", avatar:"AM", name:"Alex Morgan", role:"Meridian MEP" },
  comm: { label:"Commercial Client Portal", dot:"#3178b9", avatar:"PK", name:"Priya Kapoor", role:"Riverside Dev Co" },
  resi: { label:"Residential Client Portal", dot:"#2a7f6f", avatar:"MR", name:"Maria & Rob", role:"Homeowners" },
};

const SIDEBAR_NAV = {
  contractor: [
    { section:"Overview", items:[{ label:"Dashboard" }] },
    { section:"Riverside Tower Fit-Out", items:[
      { label:"Project Home" },{ label:"RFIs / Issues", badge:3 },{ label:"Change Orders", badge:2, warn:true },
      { label:"Approvals", badge:4 },{ label:"Billing / Draws" },{ label:"Compliance", badge:1, warn:true },
      { label:"Upload Requests", badge:2 },{ label:"Selections" },{ label:"Documents" },
      { label:"Schedule", active:true },{ label:"Messages", badge:3 },
    ]},
    { section:"Organization", items:[{ label:"Subcontractors" },{ label:"Clients" },{ label:"Team" }] },
  ],
  sub: [
    { section:"Your Projects", items:[{ label:"Today Board" }] },
    { section:"Riverside Tower Fit-Out", items:[
      { label:"Project Home" },{ label:"RFIs / Issues", badge:2, danger:true },{ label:"Upload Requests", badge:1 },
      { label:"Compliance", badge:1, warn:true },{ label:"Documents" },{ label:"Payments" },
      { label:"Schedule", active:true },{ label:"Messages", badge:1 },
    ]},
  ],
  comm: [
    { section:"Your Projects", items:[{ label:"Riverside Tower Fit-Out" }] },
    { section:"Riverside Tower Fit-Out", items:[
      { label:"Project Home" },{ label:"Progress & Updates" },{ label:"Scope Changes", badge:1, warn:true },
      { label:"Approvals", badge:1 },{ label:"Billing / Draws" },{ label:"Documents" },
      { label:"Schedule", active:true },{ label:"Messages" },{ label:"Photos" },
    ]},
  ],
  resi: [
    { section:"Your Home", items:[{ label:"Project Home" }] },
    { section:"Carter Residence", items:[
      { label:"Progress & Photos" },{ label:"Selections", badge:2 },{ label:"Decisions" },
      { label:"Scope Changes" },{ label:"Budget" },{ label:"Schedule", active:true },
      { label:"Messages" },{ label:"Documents" },
    ]},
  ],
};

// ── SVG Icon helpers ──
const I = {
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>,
  dot: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="1"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  checkSm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  circleSm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="4"/></svg>,
};

// ── Contractor milestone data ──
const PHASES_CONTRACTOR = [
  { name:"Preconstruction", dates:"Jan 6 – Feb 14, 2026", status:"completed", progress:"4/4", milestones:[
    { title:"Permit Application Submitted", desc:"Building permit package submitted to city planning", type:"submission", status:"completed", date:"Jan 15", rel:"Completed Jan 14" },
    { title:"Building Permit Issued", desc:"City approval received — construction can begin", type:"inspection", status:"completed", date:"Feb 1", rel:"Completed Jan 30" },
    { title:"Subcontractor Mobilization Complete", desc:"All trade partners on-site and active", type:"completion", status:"completed", date:"Feb 10", rel:"Completed Feb 10" },
    { title:"Owner Kickoff Walkthrough", desc:"On-site project introduction with Riverside Dev Co", type:"walkthrough", status:"completed", date:"Feb 14", rel:"Completed Feb 14" },
  ]},
  { name:"Phase 1 — Structure & Shell", dates:"Feb 17 – Mar 28, 2026", status:"completed", progress:"5/5", milestones:[
    { title:"Steel Delivery — Levels 8–12", desc:"Structural steel package delivered on schedule", type:"delivery", status:"completed", date:"Feb 24", rel:"Completed Feb 22", assignee:{ initials:"NR", color:"var(--info)", name:"Northline Steel" } },
    { title:"Structural Inspection — Level 10", desc:"City inspector sign-off on structural connections", type:"inspection", status:"completed", date:"Mar 7", rel:"Completed Mar 7" },
    { title:"Draw #2 Submission", desc:"Second progress billing submitted for review", type:"payment", status:"completed", date:"Mar 15", rel:"Completed Mar 14" },
    { title:"Exterior Envelope Closed", desc:"Building weather-tight — interior work can proceed", type:"completion", status:"completed", date:"Mar 21", rel:"Completed Mar 23" },
    { title:"Phase 1 Owner Walkthrough", desc:"Progress review with client on-site", type:"walkthrough", status:"completed", date:"Mar 28", rel:"Completed Mar 28" },
  ]},
  { name:"Phase 2 — MEP Rough-In & Interior Framing", dates:"Mar 31 – May 30, 2026", status:"active", progress:"0/5", milestones:[
    { title:"MEP Rough-In — Level 8 Complete", desc:"Mechanical shaft routing delay — pending RFI-007 resolution", type:"deadline", status:"missed", date:"Apr 7", rel:"5 days overdue", relClass:"overdue", assignee:{ initials:"AM", color:"var(--accent)", name:"Meridian MEP" } },
    { title:"Fire Suppression Inspection — Levels 8–10", desc:"Inspector scheduled, pre-inspection checklist underway", type:"inspection", status:"in-progress", date:"Apr 18", rel:"In 6 days", relClass:"soon" },
    { title:"Draw #4 Submission", desc:"April progress billing — assembling SOV backup", type:"payment", status:"in-progress", date:"Apr 25", rel:"In 13 days" },
    { title:"Interior Framing — All Levels Signed Off", desc:"Structural framing inspection for interior partitions", type:"inspection", status:"scheduled", date:"May 12", rel:"In 30 days" },
    { title:"Phase 2 Owner Walkthrough", desc:"Mid-project progress review with Riverside Dev Co", type:"walkthrough", status:"scheduled", date:"May 28", rel:"In 46 days" },
  ]},
  { name:"Phase 3 — Finishes & Systems Commissioning", dates:"Jun 1 – Jul 31, 2026", status:"upcoming", progress:"0/4", milestones:[
    { title:"Lobby Finish Material Delivery", desc:"Custom stone and panel materials for main lobby", type:"delivery", status:"scheduled", date:"Jun 9", rel:"In 58 days" },
    { title:"HVAC Commissioning Complete", desc:"Full system testing and balancing", type:"completion", status:"scheduled", date:"Jul 7", rel:"In 86 days", assignee:{ initials:"AM", color:"var(--accent)", name:"Meridian MEP" } },
    { title:"Final Inspection — Certificate of Occupancy", desc:"City final inspection for occupancy permit", type:"inspection", status:"scheduled", date:"Jul 21", rel:"In 100 days" },
    { title:"Substantial Completion", desc:"Project delivered to owner — closeout begins", type:"completion", status:"scheduled", date:"Jul 31", rel:"In 110 days" },
  ]},
];

// ── Sub milestones (flat list) ──
const MS_SUB = [
  { title:"MEP Coordination Drawings Submitted", desc:"Coordination package uploaded for clash detection review", type:"submission", status:"completed", date:"Mar 5", rel:"Completed Mar 4" },
  { title:"Ductwork Installation — Levels 8–9", desc:"Main trunk lines and branch distribution complete", type:"completion", status:"completed", date:"Mar 28", rel:"Completed Mar 27" },
  { title:"MEP Rough-In — Level 8 Complete", desc:"Mechanical shaft routing delay — waiting on RFI-007 resolution", type:"deadline", status:"missed", date:"Apr 7", rel:"5 days overdue", relClass:"overdue" },
  { title:"Fire Suppression Inspection — Levels 8–10", desc:"Pre-inspection prep underway — your systems need to be ready", type:"inspection", status:"in-progress", date:"Apr 18", rel:"In 6 days", relClass:"soon" },
  { title:"MEP Rough-In — All Levels Complete", desc:"All mechanical, electrical, and plumbing rough-in signed off", type:"completion", status:"scheduled", date:"May 9", rel:"In 27 days" },
  { title:"HVAC Commissioning Complete", desc:"Full system testing, balancing, and certification", type:"completion", status:"scheduled", date:"Jul 7", rel:"In 86 days" },
];

// ── Commercial timeline ──
const TL_COMM = [
  { title:"Building Permit Issued", date:"Jan 30, 2026", desc:"City approval received. Construction mobilization began immediately.", status:"completed" },
  { title:"Owner Kickoff Walkthrough", date:"Feb 14, 2026", desc:"On-site introduction and project overview completed with your team.", status:"completed" },
  { title:"Exterior Envelope Closed", date:"Mar 23, 2026", desc:"Building is now weather-tight. Interior work is proceeding across all levels.", status:"completed" },
  { title:"Phase 1 Progress Walkthrough", date:"Mar 28, 2026", desc:"Structural and shell work reviewed on-site. All items on track.", status:"completed" },
  { title:"MEP Systems & Interior Framing", date:"In progress", desc:"Mechanical, electrical, and plumbing rough-in underway. Interior partition framing proceeding level by level. One mechanical routing item is being resolved and may shift the fire suppression inspection by a few days.", status:"in-progress", pills:["Fire Inspection — Apr 18","Draw #4 — Apr 25"], pillTypes:["inspection","payment"] },
  { title:"Phase 2 Owner Walkthrough", date:"May 28, 2026", desc:"Mid-project progress review. You'll see the interior spaces taking shape.", status:"upcoming" },
  { title:"Certificate of Occupancy", date:"Jul 21, 2026", desc:"Final city inspection and occupancy permit. Target date for move-in readiness.", status:"upcoming" },
  { title:"Substantial Completion", date:"Jul 31, 2026", desc:"Project handover to you. Closeout documentation and warranty period begins.", status:"upcoming" },
];

// ── Residential timeline ──
const TL_RESI = [
  { title:"Building Permits Approved", date:"Jan 18, 2026", desc:"The city approved your building permits. This cleared the way for construction to start.", status:"completed" },
  { title:"Foundation Complete", date:"Feb 20, 2026", desc:"Your home's foundation is poured, cured, and inspected. Everything passed on the first try.", status:"completed" },
  { title:"Framing Walkthrough", date:"Mar 15, 2026", desc:"You visited the site and saw your home's rooms and layout in person for the first time. The framing inspection passed the next day.", status:"completed" },
  { title:"Plumbing, Electrical & HVAC", date:"Happening now", desc:"The mechanical systems are being installed throughout your home — wiring, pipes, and ductwork. Your kitchen and bathroom selections have been ordered and are on track for delivery next month.", status:"in-progress", pills:["Rough-In Inspection — Apr 22"], pillTypes:["inspection"] },
  { title:"Selections Walkthrough", date:"May 5, 2026", desc:"You'll visit to see where your chosen finishes, fixtures, and materials will be installed. A great chance to confirm everything looks right before it goes in.", status:"upcoming" },
  { title:"Finishes & Trim", date:"May – Jun 2026", desc:"Paint, flooring, cabinets, countertops, and fixtures. This is when your home starts to feel like home.", status:"upcoming" },
  { title:"Final Walkthrough", date:"Jul 10, 2026", desc:"Your final walk-through before move-in. We'll go room by room together to make sure everything is exactly right.", status:"upcoming" },
  { title:"Move-In Ready!", date:"Jul 18, 2026", desc:"Keys in hand. Welcome home.", status:"upcoming" },
];

// ── Type pill color map ──
const PILL_COLORS = {
  inspection: { bg:"var(--info-soft)", color:"var(--info-text)" },
  deadline: { bg:"var(--danger-soft)", color:"var(--danger-text)" },
  submission: { bg:"var(--warning-soft)", color:"var(--warning-text)" },
  walkthrough: { bg:"var(--accent-soft)", color:"var(--accent-text)" },
  delivery: { bg:"var(--info-soft)", color:"var(--info-text)" },
  payment: { bg:"var(--success-soft)", color:"var(--success-text)" },
  completion: { bg:"var(--success-soft)", color:"var(--success-text)" },
  custom: { bg:"var(--surface-2)", color:"var(--text-secondary)" },
};

// ── Status icon map ──
const STATUS_ICON = {
  completed: { icon: I.check, bg:"var(--success-soft)", color:"var(--success-text)", border:"#a8d5b8" },
  "in-progress": { icon: I.clock, bg:"var(--accent-soft)", color:"var(--accent-text)", border:"var(--accent-muted)" },
  missed: { icon: I.alert, bg:"var(--danger-soft)", color:"var(--danger-text)", border:"#e8a8a8" },
  scheduled: { icon: I.dot, bg:"var(--surface-2)", color:"var(--text-tertiary)", border:"var(--surface-4)" },
};

/* ============================================================
   COMPONENT
   ============================================================ */
export default function ScheduleTimelineShared() {
  const [portal, setPortal] = useState("contractor");
  const [dark, setDark] = useState(false);
  const [gcFilter, setGcFilter] = useState("All");
  const [subFilter, setSubFilter] = useState("All");

  const theme = PORTAL_THEMES[portal];
  const meta = PORTAL_META[portal];

  // Filter counts for contractor
  const allMS = PHASES_CONTRACTOR.flatMap(p => p.milestones);
  const gcCounts = { All:allMS.length, Upcoming:allMS.filter(m=>m.status==="scheduled").length, "In Progress":allMS.filter(m=>m.status==="in-progress").length, Completed:allMS.filter(m=>m.status==="completed").length, Missed:allMS.filter(m=>m.status==="missed").length };

  // Filter counts for sub
  const subCounts = { All:MS_SUB.length, Upcoming:MS_SUB.filter(m=>m.status==="scheduled").length, Overdue:MS_SUB.filter(m=>m.status==="missed").length };

  // Apply filter
  const filterMatch = (m, f) => {
    if (f === "All") return true;
    if (f === "Upcoming") return m.status === "scheduled";
    if (f === "In Progress") return m.status === "in-progress";
    if (f === "Completed") return m.status === "completed";
    if (f === "Missed" || f === "Overdue") return m.status === "missed";
    return true;
  };

  return (
    <div style={{
      "--surface-0": dark ? "#111015" : "#eef0f3",
      "--surface-1": dark ? "#1a191e" : "#ffffff",
      "--surface-2": dark ? "#232228" : "#f3f4f6",
      "--surface-3": dark ? "#2e2d33" : "#e2e5e9",
      "--surface-4": dark ? "#3d3c44" : "#d1d5db",
      "--surface-hover": dark ? "#27262c" : "#f5f6f8",
      "--surface-active": dark ? "#2a292f" : "#e5e7eb",
      "--sidebar-bg": dark ? "#16151a" : "#ffffff",
      "--sidebar-hover": dark ? "#1f1e24" : "#f5f6f8",
      "--sidebar-active": dark ? "#232228" : "#eef0f3",
      "--sidebar-border": dark ? "#2a2930" : "#e8eaee",
      "--text-primary": dark ? "#eae9ed" : "#1a1714",
      "--text-secondary": dark ? "#9e9ba5" : "#6b655b",
      "--text-tertiary": dark ? "#6b6874" : "#9c958a",
      "--text-inverse": dark ? "#1a1714" : "#faf9f7",
      "--accent": "#5b4fc7",
      "--accent-hover": "#4f44b3",
      "--accent-soft": dark ? "#2a2748" : "#eeedfb",
      "--accent-text": dark ? "#b4adf0" : "#4a3fb0",
      "--accent-muted": dark ? "#3d3870" : "#c7c2ea",
      "--success": "#2d8a5e",
      "--success-soft": dark ? "#1a2e22" : "#edf7f1",
      "--success-text": dark ? "#6fcf97" : "#1e6b46",
      "--warning": "#c17a1a",
      "--warning-soft": dark ? "#2e2518" : "#fdf4e6",
      "--warning-text": dark ? "#e8a84c" : "#96600f",
      "--danger": "#c93b3b",
      "--danger-soft": dark ? "#2e1a1a" : "#fdeaea",
      "--danger-text": dark ? "#e87c7c" : "#a52e2e",
      "--info": "#3178b9",
      "--info-soft": dark ? "#1a2530" : "#e8f1fa",
      "--info-text": dark ? "#6db3e8" : "#276299",
      "--shadow-sm": dark ? "0 1px 3px rgba(0,0,0,.3)" : "0 1px 3px rgba(26,23,20,.05)",
      "--shadow-md": dark ? "0 4px 16px rgba(0,0,0,.35)" : "0 4px 16px rgba(26,23,20,.06)",
      "--shadow-ring": "0 0 0 3px rgba(91,79,199,.15)",
      ...theme,
      display:"grid", gridTemplateColumns:"272px 1fr", minHeight:"100vh",
      fontFamily:"'Instrument Sans',system-ui,sans-serif",
      background:"var(--surface-0)", color:"var(--text-primary)",
      WebkitFontSmoothing:"antialiased",
    }}>
      {/* ── SIDEBAR ── */}
      <aside style={{ background:"var(--sidebar-bg)", borderRight:"1px solid var(--sidebar-border)", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", overflow:"hidden" }}>
        <div style={{ height:56, display:"flex", alignItems:"center", gap:12, padding:"0 20px", borderBottom:"1px solid var(--sidebar-border)", flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:dark?"linear-gradient(135deg,#eae9ed,#b8b5c0)":"linear-gradient(135deg,#1a1714,#3d3830)", display:"grid", placeItems:"center", flexShrink:0 }}><svg viewBox="0 0 80 80" width="18" height="18"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke={dark?"#1a1714":"white"} strokeWidth="3.5" opacity=".5"/><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke={dark?"#1a1714":"white"} strokeWidth="3.5" opacity=".75"/><rect x="32" y="32" width="26" height="26" rx="4" fill={dark?"#1a1714":"white"} opacity=".95"/></svg></div>
          <div>
            <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:14, fontWeight:700 }}>BuiltCRM</div>
            <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:1 }}>{meta.label}</div>
          </div>
        </div>
        <nav style={{ flex:1, overflowY:"auto", padding:"8px 10px 20px" }}>
          {SIDEBAR_NAV[portal].map((s,si)=>(
            <div key={si} style={{ marginBottom:4 }}>
              <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:11, fontWeight:700, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:".06em", padding:"10px 10px 6px" }}>{s.section}</div>
              {s.items.map((it,ii)=>(
                <div key={ii} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:10, fontSize:13, fontWeight:it.active?650:520, color:it.active?"var(--accent-text)":"var(--text-secondary)", background:it.active?"var(--accent-soft)":"transparent", marginBottom:2, cursor:"default", transition:"all 200ms cubic-bezier(.16,1,.3,1)" }}>
                  <span>{it.label}</span>
                  {it.badge && (
                    <span style={{ minWidth:20, height:20, padding:"0 7px", borderRadius:999, background:it.danger?"var(--danger-soft)":it.warn?"var(--warning-soft)":"var(--accent-soft)", color:it.danger?"var(--danger-text)":it.warn?"var(--warning-text)":"var(--accent-text)", fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',system-ui,sans-serif" }}>{it.badge}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ borderTop:"1px solid var(--sidebar-border)", padding:"12px 16px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:6 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg,var(--accent),var(--accent-muted))`, color:"white", display:"grid", placeItems:"center", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:11, fontWeight:700, flexShrink:0 }}>{meta.avatar}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:580, color:"var(--text-primary)" }}>{meta.name}</div>
              <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:1 }}>{meta.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* Topbar */}
        <header style={{ height:56, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", borderBottom:"1px solid var(--surface-3)", background:dark?"rgba(26,25,30,.88)":"rgba(255,255,255,.88)", backdropFilter:"blur(12px)", flexShrink:0, position:"sticky", top:0, zIndex:50 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--text-tertiary)" }}>
            <span>{meta.label}</span>
            <span style={{ color:"var(--surface-4)" }}>›</span>
            <span>{portal==="resi"?"Carter Residence":"Riverside Tower Fit-Out"}</span>
            <span style={{ color:"var(--surface-4)" }}>›</span>
            <span style={{ color:"var(--text-primary)", fontWeight:650 }}>Schedule</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>setDark(!dark)} style={{ width:34, height:34, borderRadius:10, border:"1px solid var(--surface-3)", background:"var(--surface-1)", display:"grid", placeItems:"center", color:"var(--text-secondary)", cursor:"pointer" }} aria-label="Toggle dark mode">
              <span style={{ width:16, height:16, display:"block" }}>{dark ? I.sun : I.moon}</span>
            </button>
            <button style={{ width:34, height:34, borderRadius:10, border:"1px solid var(--surface-3)", background:"var(--surface-1)", display:"grid", placeItems:"center", color:"var(--text-secondary)", cursor:"pointer", position:"relative" }} aria-label="Notifications">
              <span style={{ width:16, height:16, display:"block" }}>{I.bell}</span>
              <span style={{ position:"absolute", top:6, right:6, width:7, height:7, borderRadius:"50%", background:"var(--danger)", border:"2px solid var(--surface-1)" }}/>
            </button>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--accent)", color:"white", display:"grid", placeItems:"center", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:12, fontWeight:700 }}>{meta.avatar}</div>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding:24, flex:1 }}>
          {/* Portal Switcher */}
          <div style={{ display:"flex", gap:4, marginBottom:20, background:"var(--surface-2)", borderRadius:14, padding:4, width:"fit-content" }}>
            {[["contractor","Contractor","#5b4fc7"],["sub","Subcontractor","#3d6b8e"],["comm","Commercial Client","#3178b9"],["resi","Residential Client","#2a7f6f"]].map(([key,label,dot])=>(
              <button key={key} onClick={()=>setPortal(key)} style={{ height:36, padding:"0 16px", borderRadius:10, fontSize:13, fontWeight:650, color:portal===key?"var(--text-primary)":"var(--text-secondary)", background:portal===key?"var(--surface-1)":"transparent", boxShadow:portal===key?"var(--shadow-sm)":"none", display:"inline-flex", alignItems:"center", gap:7, border:"none", cursor:"pointer", whiteSpace:"nowrap", transition:"all 200ms cubic-bezier(.16,1,.3,1)" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:dot }}/>
                {label}
              </button>
            ))}
          </div>

          {/* ────── CONTRACTOR VIEW ────── */}
          {portal === "contractor" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:20, marginBottom:16 }}>
                <div>
                  <h2 style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Schedule</h2>
                  <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, fontWeight:520 }}>Riverside Tower Fit-Out · 18 milestones across 4 phases</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ height:38, padding:"0 14px", borderRadius:10, fontSize:13, fontWeight:650, color:"var(--text-secondary)", border:"1px solid var(--surface-3)", display:"inline-flex", alignItems:"center", gap:6, background:"var(--surface-1)", cursor:"pointer" }}>
                    <span style={{ width:14, height:14, display:"block" }}>{I.download}</span>Export
                  </button>
                  <button style={{ height:38, padding:"0 18px", borderRadius:10, background:"var(--accent)", color:"white", fontSize:13, fontWeight:650, display:"inline-flex", alignItems:"center", gap:7, border:"none", cursor:"pointer" }}>
                    <span style={{ width:16, height:16, display:"block" }}>{I.plus}</span>Add Milestone
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display:"flex", gap:12, marginBottom:20 }}>
                {[
                  { icon:I.calendar, value:18, label:"Total Milestones", cls:"purple" },
                  { icon:I.check, value:9, label:"Completed", cls:"green" },
                  { icon:I.clock, value:3, label:"Upcoming (2 Weeks)", cls:"blue" },
                  { icon:I.alert, value:1, label:"Missed / At Risk", cls:"red" },
                ].map((s,i)=>{
                  const iconBg = { purple:"var(--accent-soft)", green:"var(--success-soft)", blue:"var(--info-soft)", red:"var(--danger-soft)" }[s.cls];
                  const iconColor = { purple:"var(--accent-text)", green:"var(--success-text)", blue:"var(--info-text)", red:"var(--danger-text)" }[s.cls];
                  return (
                    <div key={i} style={{ background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:14, padding:"14px 18px", flex:1, display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:10, display:"grid", placeItems:"center", background:iconBg, color:iconColor }}>
                        <span style={{ width:18, height:18, display:"block" }}>{s.icon}</span>
                      </div>
                      <div>
                        <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:20, fontWeight:820, letterSpacing:"-.02em" }}>{s.value}</div>
                        <div style={{ fontSize:11.5, color:"var(--text-tertiary)", fontWeight:560, marginTop:1 }}>{s.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <ProgressBar title="Overall Project Progress" pct={50} phases={[
                { label:"Preconstruction", status:"done" },{ label:"Phase 1", status:"done" },
                { label:"Phase 2", status:"current" },{ label:"Phase 3", status:"" },{ label:"Closeout", status:"" },
              ]}/>

              {/* Filter Tabs */}
              <FilterTabs tabs={Object.entries(gcCounts).map(([k,v])=>({ label:k, count:v }))} active={gcFilter} onSelect={setGcFilter} />

              {/* Phase Groups */}
              {PHASES_CONTRACTOR.map((phase,pi)=>{
                const filtered = phase.milestones.filter(m => filterMatch(m, gcFilter));
                if (filtered.length === 0 && gcFilter !== "All") return null;
                return (
                  <div key={pi} style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:8, borderBottom:"1px solid var(--surface-3)" }}>
                      <span style={{ width:10, height:10, borderRadius:"50%", flexShrink:0, background:phase.status==="completed"?"var(--success)":phase.status==="active"?"var(--accent)":"var(--surface-4)", boxShadow:phase.status==="active"?"0 0 0 3px var(--accent-soft)":"none" }}/>
                      <span style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:15, fontWeight:720, letterSpacing:"-.02em" }}>{phase.name}</span>
                      <span style={{ fontSize:12, color:"var(--text-tertiary)", fontWeight:530 }}>{phase.dates}</span>
                      <span style={{ marginLeft:"auto", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:12, fontWeight:700, color:"var(--text-tertiary)" }}>
                        {phase.progress.startsWith(phase.progress.split("/")[1]) || phase.status==="completed"
                          ? <span style={{ color:"var(--success-text)" }}>{phase.progress}</span>
                          : phase.progress
                        }
                      </span>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {filtered.map((m,mi) => <MilestoneCard key={mi} m={m} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ────── SUBCONTRACTOR VIEW ────── */}
          {portal === "sub" && (
            <div>
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Schedule</h2>
                <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, fontWeight:520 }}>Riverside Tower Fit-Out · Your milestones · 6 total</div>
              </div>

              {/* Stats Row */}
              <div style={{ display:"flex", gap:12, marginBottom:20 }}>
                {[
                  { icon:I.check, value:2, label:"Completed", cls:"green" },
                  { icon:I.clock, value:2, label:"In Progress", cls:"blue" },
                  { icon:I.alert, value:1, label:"Overdue", cls:"red" },
                ].map((s,i)=>{
                  const iconBg = { green:"var(--success-soft)", blue:"var(--info-soft)", red:"var(--danger-soft)" }[s.cls];
                  const iconColor = { green:"var(--success-text)", blue:"var(--info-text)", red:"var(--danger-text)" }[s.cls];
                  return (
                    <div key={i} style={{ background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:14, padding:"14px 18px", flex:1, display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:10, display:"grid", placeItems:"center", background:iconBg, color:iconColor }}>
                        <span style={{ width:18, height:18, display:"block" }}>{s.icon}</span>
                      </div>
                      <div>
                        <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:20, fontWeight:820, letterSpacing:"-.02em" }}>{s.value}</div>
                        <div style={{ fontSize:11.5, color:"var(--text-tertiary)", fontWeight:560, marginTop:1 }}>{s.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <FilterTabs tabs={Object.entries(subCounts).map(([k,v])=>({ label:k, count:v }))} active={subFilter} onSelect={setSubFilter} />

              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {MS_SUB.filter(m => filterMatch(m, subFilter)).map((m,i) => <MilestoneCard key={i} m={m} />)}
              </div>
            </div>
          )}

          {/* ────── COMMERCIAL CLIENT VIEW ────── */}
          {portal === "comm" && (
            <div>
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Project Schedule</h2>
                <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, fontWeight:520 }}>Riverside Tower Fit-Out · Updated Apr 12, 2026</div>
              </div>
              <ProgressBar title="Overall Progress" pct={50} phases={[
                { label:"Preconstruction", status:"done" },{ label:"Structure & Shell", status:"done" },
                { label:"MEP & Framing", status:"current" },{ label:"Finishes", status:"" },{ label:"Closeout", status:"" },
              ]}/>
              <TimelineDots items={TL_COMM} />
            </div>
          )}

          {/* ────── RESIDENTIAL CLIENT VIEW ────── */}
          {portal === "resi" && (
            <div>
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Your Project Timeline</h2>
                <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, fontWeight:520 }}>Carter Residence · Last updated Apr 12, 2026</div>
              </div>
              <ProgressBar title="How Your Home is Coming Along" pct={60} phases={[
                { label:"Planning", status:"done" },{ label:"Foundation", status:"done" },{ label:"Framing", status:"done" },
                { label:"Systems", status:"current" },{ label:"Finishes", status:"" },{ label:"Move-In", status:"" },
              ]}/>
              <TimelineDots items={TL_RESI} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────
   SUB-COMPONENTS
   ────────────────────────────────── */

function ProgressBar({ title, pct, phases }) {
  return (
    <div style={{ marginBottom:20, background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:14, padding:"18px 20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:14, fontWeight:700, letterSpacing:"-.01em" }}>{title}</div>
        <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:20, fontWeight:820, color:"var(--accent-text)" }}>{pct}%</div>
      </div>
      <div style={{ width:"100%", height:10, background:"var(--surface-2)", borderRadius:999, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:999, background:"linear-gradient(90deg,var(--accent),var(--accent-hover))", width:`${pct}%`, transition:"width .6s cubic-bezier(.16,1,.3,1)" }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
        {phases.map((p,i)=>(
          <span key={i} style={{ fontSize:10.5, fontWeight:p.status==="current"?700:p.status==="done"?600:600, color:p.status==="current"?"var(--accent-text)":p.status==="done"?"var(--success-text)":"var(--text-tertiary)" }}>
            {p.status==="done" && <span style={{ marginRight:2 }}>&#10003;</span>}
            {p.status==="current" && <span style={{ marginRight:3 }}>●</span>}
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FilterTabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display:"flex", gap:2, marginBottom:16, background:"var(--surface-2)", borderRadius:10, padding:3, width:"fit-content" }}>
      {tabs.map((t,i)=>(
        <button key={i} onClick={()=>onSelect(t.label)} style={{ height:30, padding:"0 12px", borderRadius:6, fontSize:12, fontWeight:620, color:active===t.label?"var(--text-primary)":"var(--text-tertiary)", background:active===t.label?"var(--surface-1)":"transparent", boxShadow:active===t.label?"var(--shadow-sm)":"none", display:"inline-flex", alignItems:"center", gap:5, border:"none", cursor:"pointer", whiteSpace:"nowrap", transition:"all 120ms" }}>
          {t.label}
          <span style={{ fontSize:10, fontWeight:700, color:"var(--accent-text)", background:"var(--accent-soft)", minWidth:16, height:16, padding:"0 5px", borderRadius:999, display:"inline-flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',system-ui,sans-serif" }}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

function MilestoneCard({ m }) {
  const si = STATUS_ICON[m.status] || STATUS_ICON.scheduled;
  const pc = PILL_COLORS[m.type] || PILL_COLORS.custom;
  const isMissed = m.status === "missed";
  const isIP = m.status === "in-progress";
  const isCompleted = m.status === "completed";

  return (
    <div style={{
      background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:14, padding:"14px 18px",
      display:"flex", alignItems:"center", gap:14, cursor:"pointer",
      borderLeft: isMissed ? "3px solid var(--danger)" : isIP ? "3px solid var(--accent)" : undefined,
      opacity: isCompleted ? 0.7 : 1,
      transition:"all 120ms",
    }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--surface-4)"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; if(isCompleted) e.currentTarget.style.opacity="1"; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--surface-3)"; e.currentTarget.style.boxShadow="none"; if(isCompleted) e.currentTarget.style.opacity="0.7"; }}
    >
      {/* Status icon */}
      <div style={{ width:28, height:28, borderRadius:"50%", display:"grid", placeItems:"center", flexShrink:0, background:si.bg, color:si.color, border:`2px solid ${si.border}` }}>
        <span style={{ width:14, height:14, display:"block" }}>{si.icon}</span>
      </div>
      {/* Body */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:640, color:isCompleted?"var(--text-tertiary)":"var(--text-primary)", textDecoration:isCompleted?"line-through":"none" }}>{m.title}</div>
        <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontWeight:520 }}>{m.desc}</div>
      </div>
      {/* Type pill */}
      <span style={{ fontSize:10, fontWeight:650, padding:"3px 8px", borderRadius:999, whiteSpace:"nowrap", flexShrink:0, background:pc.bg, color:pc.color, fontFamily:"'DM Sans',system-ui,sans-serif" }}>{m.type.charAt(0).toUpperCase()+m.type.slice(1)}</span>
      {/* Assignee (if present) */}
      {m.assignee && (
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11.5, color:"var(--text-tertiary)", fontWeight:560, whiteSpace:"nowrap" }}>
          <div style={{ width:20, height:20, borderRadius:"50%", display:"grid", placeItems:"center", fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:8, fontWeight:700, color:"white", flexShrink:0, background:m.assignee.color }}>{m.assignee.initials}</div>
          <span style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:11, fontWeight:620 }}>{m.assignee.name}</span>
        </div>
      )}
      {/* Date */}
      <div style={{ textAlign:"right", flexShrink:0, minWidth:90 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:"var(--text-primary)" }}>{m.date}</div>
        <div style={{
          fontSize:10.5, marginTop:1, fontWeight: m.relClass==="overdue" ? 650 : m.relClass==="soon" ? 600 : 520,
          color: m.relClass==="overdue" ? "var(--danger-text)" : m.relClass==="soon" ? "var(--warning-text)" : m.rel?.startsWith("Completed") ? "var(--success-text)" : "var(--text-tertiary)",
        }}>{m.rel}</div>
      </div>
    </div>
  );
}

function TimelineDots({ items }) {
  return (
    <div style={{ position:"relative", paddingLeft:28 }}>
      {/* Vertical line */}
      <div style={{ position:"absolute", left:9, top:4, bottom:4, width:2, background:"var(--surface-3)" }}/>

      {items.map((it,i)=>{
        const isIP = it.status === "in-progress";
        const isCompleted = it.status === "completed";
        const isUpcoming = it.status === "upcoming";

        return (
          <div key={i} style={{ position:"relative", marginBottom:20 }}>
            {/* Dot */}
            <div style={{
              position:"absolute", left:-28, top:2, width:20, height:20, borderRadius:"50%", display:"grid", placeItems:"center", zIndex:1,
              background: isCompleted ? "var(--success)" : isIP ? "var(--accent)" : "var(--surface-1)",
              color: isCompleted || isIP ? "white" : "var(--text-tertiary)",
              border: isUpcoming ? "2px solid var(--surface-4)" : "none",
              boxShadow: isIP ? "0 0 0 4px var(--accent-soft)" : "none",
            }}>
              <span style={{ width:10, height:10, display:"block" }}>
                {isCompleted ? I.checkSm : isIP ? I.circleSm : null}
              </span>
            </div>
            {/* Content card */}
            <div style={{
              background: isIP ? "linear-gradient(135deg,var(--surface-1),var(--accent-soft))" : "var(--surface-1)",
              border: `1px solid ${isIP ? "var(--accent-muted)" : "var(--surface-3)"}`,
              borderRadius:14, padding:"14px 18px",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:4 }}>
                <span style={{ fontSize:14, fontWeight:650, color:"var(--text-primary)" }}>{it.title}</span>
                <span style={{ fontSize:12, color:"var(--text-tertiary)", fontWeight:560, whiteSpace:"nowrap" }}>{it.date}</span>
              </div>
              <div style={{ fontSize:12.5, color:"var(--text-secondary)", lineHeight:1.5, fontWeight:520 }}>{it.desc}</div>
              {it.pills && it.pills.length > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                  {it.pills.map((pill,pi)=>{
                    const pt = PILL_COLORS[it.pillTypes?.[pi]] || PILL_COLORS.custom;
                    return <span key={pi} style={{ fontSize:10.5, fontWeight:650, padding:"3px 8px", borderRadius:999, background:pt.bg, color:pt.color, fontFamily:"'DM Sans',system-ui,sans-serif" }}>{pill}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
