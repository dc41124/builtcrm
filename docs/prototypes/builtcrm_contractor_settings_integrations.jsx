import { useState } from "react";

const F = { display:"'DM Sans',system-ui,sans-serif", body:"'Instrument Sans',system-ui,sans-serif", mono:"'JetBrains Mono',monospace" };

// ── Icons ──
const I = {
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
};

// ── Sidebar nav ──
const SETTINGS_NAV = [
  { section:"Organization", items:[
    { label:"General" },{ label:"Team members" },{ label:"Roles & permissions" },
    { label:"Billing & plan", pill:"Professional", pillColor:"accent" },
  ]},
  { section:"Connections", items:[
    { label:"Integrations", id:"integrations", pill:"2 active", pillColor:"success" },
    { label:"Payments", id:"payments" },
    { label:"Webhooks", pill:"Enterprise", pillColor:"gray" },
  ]},
  { section:"Data", items:[{ label:"Import / migrate" },{ label:"Export" }] },
  { section:"Security", items:[
    { label:"Authentication" },{ label:"SSO / SAML", pill:"Enterprise", pillColor:"gray" },{ label:"Audit log" },
  ]},
  { section:"Preferences", items:[{ label:"Notifications" },{ label:"Email templates" },{ label:"Calendar sync" }] },
];

// ── Integration data ──
const INTEGRATIONS = [
  { id:"qb", name:"QuickBooks Online", provider:"Accounting · Intuit", logo:"QB", logoCls:"qb", desc:"Push approved draw requests as invoices. Pull payment confirmations automatically. Map SOV cost codes to your chart of accounts.", state:"connected", statusLabel:"Connected", statusMeta:"Last sync 2h ago", pills:[{ text:"Healthy", cls:"green" },{ text:"4 projects mapped" },{ text:"127 syncs this month" }] },
  { id:"stripe", name:"Stripe Payments", provider:"Payment processing · ACH & Card", logo:"S", logoCls:"stripe", desc:"Accept draw payments via ACH bank transfer or credit card. Funds route directly to your bank account through Stripe Connect.", state:"connected", statusLabel:"Connected", statusMeta:"Payouts active", pills:[{ text:"Verified", cls:"green" },{ text:"$287,000 processed" },{ text:"ACH + Card enabled" }] },
  { id:"xero", name:"Xero", provider:"Accounting · Xero Limited", logo:"X", logoCls:"xero", desc:"Sync invoices and payment status with Xero. Same capabilities as QuickBooks — choose the accounting system your team already uses.", state:"available", statusLabel:"Not connected", btn:"Connect Xero" },
  { id:"sage", name:"Sage Business Cloud", provider:"Accounting · Sage Group", logo:"S", logoCls:"sage", desc:"Sync billing data with Sage Business Cloud Accounting. Invoices, payments, and journal entries flow automatically.", state:"available", statusLabel:"Not connected", btn:"Connect Sage" },
  { id:"gcal", name:"Calendar Sync", provider:"iCal feed · Google / Outlook / Apple", logo:"\u{1F4C5}", logoCls:"gcal", desc:"Subscribe to your project milestones and inspection dates as a calendar feed. Works with any calendar app that supports iCal.", state:"available", statusLabel:"Not set up", btn:"Generate feed URL", extraPill:{ text:"All plans" } },
  { id:"email", name:"Email Notifications", provider:"Transactional email · Reply-by-email", logo:"\u2709", logoCls:"email", desc:"Automatic email notifications for RFIs, approvals, draws, and messages. Reply directly from your inbox to post messages in BuiltCRM.", state:"connected", alwaysOn:true, statusLabel:"Active", statusMeta:"Always on", pills:[{ text:"Healthy", cls:"green" },{ text:"All plans" },{ text:"Reply-by-email enabled" }] },
  { id:"csv", name:"CSV / Excel Import", provider:"Bulk data import · Self-service", logo:"file", logoCls:"csv", desc:"Import projects, budgets, contacts, milestones, and RFIs from CSV or Excel files. Column mapping wizard with validation preview.", state:"available", statusLabel:"No imports yet", btn:"Start import", extraPill:{ text:"Professional+" } },
  { id:"webhook", name:"Webhook API", provider:"Custom integrations · Outbound events", logo:"link", logoCls:"webhook", desc:"Subscribe to BuiltCRM events and receive HTTP callbacks to your own systems. HMAC-signed payloads with automatic retries.", state:"available", statusLabel:"Enterprise plan required", gated:true, extraPill:{ text:"Enterprise", cls:"purple" } },
];

const QB_MAPPINGS = [
  { project:"Riverside Tower Fit-Out", type:"Commercial · $2.4M", external:"Riverside Holdings LLC : Tower Fit-Out", invoices:8, lastSync:"2h ago" },
  { project:"14 Maple Lane Renovation", type:"Residential · $410K", external:"Chen Family : Maple Lane Reno", invoices:5, lastSync:"2h ago" },
  { project:"King St Office Build-Out", type:"Commercial · $890K", external:"Apex Ventures : King St Office", invoices:6, lastSync:"2h ago" },
  { project:"Harbour View Condo Finishing", type:"Residential · $320K", external:"Thompson, R : Harbour View", invoices:4, lastSync:"2h ago" },
];

const SYNC_LOG = [
  { icon:"push", title:"Invoice pushed — Draw #5 · Riverside Tower", desc:"Created Invoice INV-00892 for $45,100.00 in QuickBooks", time:"2h ago", status:"success" },
  { icon:"pull", title:"Payment confirmed — Draw #4 · Riverside Tower", desc:"QB Payment #PMT-4821 for $38,200.00 matched to Draw #4. Status updated to \"Paid\".", time:"2h ago", status:"success" },
  { icon:"push", title:"Invoice pushed — Draw #3 · 14 Maple Lane", desc:"Created Invoice INV-00889 for $22,750.00 in QuickBooks", time:"Yesterday", status:"success" },
  { icon:"reconcile", title:"Daily reconciliation completed", desc:"Checked 12 open invoices across 4 projects. All balances match. No discrepancies found.", time:"Yesterday · 6:00 AM", status:"success" },
  { icon:"push", title:"Change order journal entry — CO #7 · King St Office", desc:"Posted +$34,500 contract adjustment to Job: King St Office in QuickBooks", time:"Apr 11", status:"success" },
  { icon:"pull", title:"Payment confirmed — Draw #2 · Harbour View", desc:"QB Payment #PMT-4798 for $18,900.00 matched. Status updated to \"Paid\".", time:"Apr 10", status:"success" },
];

const RECENT_PAYMENTS = [
  { icon:"ach", emoji:"\u{1F3E6}", title:"Draw #5 — Riverside Tower Fit-Out", meta:"ACH · TD Bank ****6789 · Riverside Holdings LLC · Apr 13", amount:"$45,100.00", fee:"Fee: $5.00 · Net: $45,095.00", status:"Processing", statusCls:"orange" },
  { icon:"ach", emoji:"\u{1F3E6}", title:"Draw #4 — Riverside Tower Fit-Out", meta:"ACH · TD Bank ****6789 · Riverside Holdings LLC · Apr 8", amount:"$38,200.00", fee:"Fee: $5.00 · Net: $38,195.00", status:"Succeeded", statusCls:"green" },
  { icon:"card", emoji:"\u{1F4B3}", title:"Selection upgrade — 14 Maple Lane", meta:"Visa ****4242 · Sarah Chen · Apr 6", amount:"$2,400.00", fee:"Fee: $69.90 · Net: $2,330.10", status:"Succeeded", statusCls:"green" },
  { icon:"ach", emoji:"\u{1F3E6}", title:"Draw #3 — 14 Maple Lane Renovation", meta:"ACH · RBC ****2341 · Sarah & James Chen · Apr 3", amount:"$22,750.00", fee:"Fee: $5.00 · Net: $22,745.00", status:"Succeeded", statusCls:"green" },
  { icon:"ach", emoji:"\u{1F3E6}", title:"Draw #6 — King St Office Build-Out", meta:"ACH · CIBC ****8870 · Apex Ventures Inc · Mar 29", amount:"$67,200.00", fee:"Fee: $5.00 · Net: $67,195.00", status:"Succeeded", statusCls:"green" },
  { icon:"pending", emoji:"\u{1F4DD}", title:"Draw #2 — Harbour View Condo (manual)", meta:"Check #4891 · R. Thompson · Mar 24", amount:"$18,900.00", fee:"Fee: — · Recorded manually", status:"Manual", statusCls:"" },
];

export default function ContractorSettingsIntegrations() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("integrations");
  const [intFilter, setIntFilter] = useState("all");
  const [detailTab, setDetailTab] = useState("overview");

  const filteredInt = INTEGRATIONS.filter(i => {
    if (intFilter === "all") return true;
    if (intFilter === "connected") return i.state === "connected";
    if (intFilter === "available") return i.state === "available";
    return true;
  });

  const connectedCount = INTEGRATIONS.filter(i => i.state === "connected").length;

  return (
    <div style={{
      "--surface-0":dark?"#111015":"#eef0f3","--surface-1":dark?"#1a191e":"#ffffff",
      "--surface-2":dark?"#232228":"#f3f4f6","--surface-3":dark?"#2e2d33":"#e2e5e9",
      "--surface-4":dark?"#3d3c44":"#d1d5db","--surface-hover":dark?"#27262c":"#f5f6f8",
      "--sidebar-bg":dark?"#16151a":"#ffffff","--sidebar-hover":dark?"#1f1e24":"#f5f6f8",
      "--sidebar-border":dark?"#2a2930":"#e8eaee",
      "--text-primary":dark?"#eae9ed":"#1a1714","--text-secondary":dark?"#9e9ba5":"#6b655b",
      "--text-tertiary":dark?"#6b6874":"#9c958a",
      "--accent":"#5b4fc7","--accent-hover":"#4f44b3",
      "--accent-soft":dark?"#2a2748":"#eeedfb","--accent-text":dark?"#b4adf0":"#4a3fb0",
      "--accent-muted":dark?"#3d3870":"#c7c2ea",
      "--success":"#2d8a5e","--success-soft":dark?"#1a2e22":"#edf7f1","--success-text":dark?"#6fcf97":"#1e6b46",
      "--warning":"#c17a1a","--warning-soft":dark?"#2e2518":"#fdf4e6","--warning-text":dark?"#e8a84c":"#96600f",
      "--danger":"#c93b3b","--danger-soft":dark?"#2e1a1a":"#fdeaea","--danger-text":dark?"#e87c7c":"#a52e2e",
      "--info":"#3178b9","--info-soft":dark?"#1a2530":"#e8f1fa","--info-text":dark?"#6db3e8":"#276299",
      "--shadow-sm":dark?"0 1px 3px rgba(0,0,0,.3)":"0 1px 3px rgba(26,23,20,.05)",
      "--shadow-md":dark?"0 4px 16px rgba(0,0,0,.35)":"0 4px 16px rgba(26,23,20,.06)",
      display:"grid", gridTemplateColumns:"272px 1fr", minHeight:"100vh",
      fontFamily:F.body, background:"var(--surface-0)", color:"var(--text-primary)", WebkitFontSmoothing:"antialiased",
    }}>
      {/* ── SIDEBAR ── */}
      <aside style={{ background:"var(--sidebar-bg)", borderRight:"1px solid var(--sidebar-border)", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", overflow:"hidden" }}>
        <div style={{ height:56, display:"flex", alignItems:"center", gap:12, padding:"0 20px", borderBottom:"1px solid var(--sidebar-border)", flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:dark?"linear-gradient(135deg,#6b63d6,#b4adf0)":"linear-gradient(135deg,#2c2541,#5b4fc7)", display:"grid", placeItems:"center", flexShrink:0 }}><svg viewBox="0 0 80 80" width="18" height="18"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/></svg></div>
          <div>
            <div style={{ fontFamily:F.display, fontSize:14, fontWeight:700, letterSpacing:"-.02em" }}>BuiltCRM</div>
            <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:1 }}>Settings</div>
          </div>
        </div>
        <nav style={{ flex:1, overflowY:"auto", padding:"8px 10px 20px" }}>
          {/* Back link */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:10, fontSize:13, color:"var(--accent-text)", fontWeight:620, marginBottom:8, cursor:"pointer" }}>
            <span style={{ width:14, height:14, display:"block" }}>{I.back}</span>Back to dashboard
          </div>
          {SETTINGS_NAV.map((s,si)=>(
            <div key={si} style={{ marginBottom:4 }}>
              <div style={{ fontFamily:F.display, fontSize:11, fontWeight:700, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:".06em", padding:"10px 10px 6px" }}>{s.section}</div>
              {s.items.map((it,ii)=>{
                const isActive = (it.id === view);
                return (
                  <div key={ii} onClick={()=>it.id && setView(it.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:10, fontSize:13, fontWeight:isActive?650:520, color:isActive?"var(--accent-text)":"var(--text-secondary)", background:isActive?"var(--accent-soft)":"transparent", marginBottom:2, cursor:it.id?"pointer":"default", position:"relative" }}>
                    {isActive && <span style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:3, height:16, borderRadius:"0 3px 3px 0", background:"var(--accent)" }}/>}
                    <span>{it.label}</span>
                    {it.pill && (
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:999, fontFamily:F.display,
                        background: it.pillColor==="accent"?"var(--accent-soft)":it.pillColor==="success"?"var(--success-soft)":"var(--surface-2)",
                        color: it.pillColor==="accent"?"var(--accent-text)":it.pillColor==="success"?"var(--success-text)":"var(--text-tertiary)",
                      }}>{it.pill}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ borderTop:"1px solid var(--sidebar-border)", padding:"12px 16px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:6 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--accent-muted))", color:"white", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:11, fontWeight:700 }}>DP</div>
            <div>
              <div style={{ fontSize:13, fontWeight:580 }}>Daniel Pearson</div>
              <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:1 }}>Org Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ height:56, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", borderBottom:"1px solid var(--surface-3)", background:dark?"rgba(26,25,30,.88)":"rgba(255,255,255,.88)", backdropFilter:"blur(12px)", flexShrink:0, position:"sticky", top:0, zIndex:50 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--text-tertiary)" }}>
            <span>Settings</span><span style={{ color:"var(--surface-4)" }}>/</span>
            <span style={{ color:"var(--text-primary)", fontWeight:650 }}>{view==="integrations"?"Integrations":"Payments"}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>setDark(!dark)} style={{ width:32, height:32, borderRadius:10, border:"1px solid var(--surface-3)", background:"var(--surface-1)", display:"grid", placeItems:"center", color:"var(--text-tertiary)", cursor:"pointer" }}>
              <span style={{ width:16, height:16, display:"block" }}>{dark?I.sun:I.moon}</span>
            </button>
            <button style={{ width:32, height:32, borderRadius:10, border:"1px solid var(--surface-3)", background:"var(--surface-1)", display:"grid", placeItems:"center", color:"var(--text-tertiary)", cursor:"pointer", position:"relative" }}>
              <span style={{ width:16, height:16, display:"block" }}>{I.bell}</span>
              <span style={{ position:"absolute", top:4, right:4, width:7, height:7, borderRadius:"50%", background:"var(--danger)", border:"2px solid var(--surface-1)" }}/>
            </button>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--accent)", color:"white", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:12, fontWeight:700 }}>DP</div>
          </div>
        </header>

        <div style={{ padding:24, flex:1 }}>

          {/* ═══════ INTEGRATIONS VIEW ═══════ */}
          {view === "integrations" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontFamily:F.display, fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Integrations</h2>
                <p style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, maxWidth:640, fontWeight:520 }}>Connect your accounting, payment, and productivity tools. Integrations sync automatically — no manual data entry required.</p>
              </div>

              {/* Tab bar */}
              <div style={{ display:"flex", gap:4, background:"var(--surface-2)", borderRadius:14, padding:4, marginBottom:20, width:"fit-content" }}>
                {[["all","All integrations"],["connected","Connected"],["available","Available"]].map(([key,label])=>(
                  <button key={key} onClick={()=>setIntFilter(key)} style={{ height:34, padding:"0 14px", borderRadius:10, fontSize:12, fontWeight:intFilter===key?650:620, color:intFilter===key?"var(--text-primary)":"var(--text-secondary)", background:intFilter===key?"var(--surface-1)":"transparent", boxShadow:intFilter===key?"var(--shadow-sm)":"none", display:"inline-flex", alignItems:"center", gap:6, border:"none", cursor:"pointer", whiteSpace:"nowrap" }}>
                    {label}
                    {key==="connected" && <span style={{ minWidth:16, height:16, padding:"0 5px", borderRadius:999, background:"var(--accent-soft)", color:"var(--accent-text)", fontSize:9, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", fontFamily:F.display }}>{connectedCount}</span>}
                  </button>
                ))}
              </div>

              {/* Integration Cards Grid */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:14, marginBottom:24 }}>
                {filteredInt.map(int => <IntCard key={int.id} int={int} />)}
              </div>

              {/* QuickBooks Detail Panel */}
              <div style={{ background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:18, boxShadow:"var(--shadow-sm)", overflow:"hidden" }}>
                {/* Detail Header */}
                <div style={{ padding:20, borderBottom:"1px solid var(--surface-3)", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#2ca01c,#108a00)", color:"white", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:14, fontWeight:800 }}>QB</div>
                    <div>
                      <h3 style={{ fontFamily:F.display, fontSize:17, fontWeight:720, letterSpacing:"-.015em", margin:0 }}>QuickBooks Online</h3>
                      <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:3, fontWeight:520 }}>Connected to "Pearson Construction Inc." · Realm ID: <span style={{ fontFamily:F.mono, fontSize:11 }}>4620816365014389500</span></div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <SmBtn>Sync now</SmBtn><SmBtn>Edit mapping</SmBtn>
                    <SmBtn danger>Disconnect</SmBtn>
                  </div>
                </div>

                {/* Detail Tabs */}
                <div style={{ display:"flex", gap:4, margin:"16px 20px 0", background:"var(--surface-2)", borderRadius:14, padding:4 }}>
                  {["Overview","Project mapping","Sync activity","Settings"].map(t=>(
                    <button key={t} onClick={()=>setDetailTab(t.toLowerCase())} style={{ height:32, padding:"0 12px", borderRadius:10, fontSize:12, fontWeight:detailTab===t.toLowerCase()?650:620, color:detailTab===t.toLowerCase()?"var(--text-primary)":"var(--text-secondary)", background:detailTab===t.toLowerCase()?"var(--surface-1)":"transparent", boxShadow:detailTab===t.toLowerCase()?"var(--shadow-sm)":"none", border:"none", cursor:"pointer", whiteSpace:"nowrap" }}>{t}</button>
                  ))}
                </div>

                <div style={{ padding:20 }}>
                  {/* Health Strip */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
                    {[
                      { label:"Status", value:"Healthy", meta:"0 errors in last 7 days", type:"success" },
                      { label:"Last sync", value:"2h ago", meta:"Apr 13 · 10:14 AM" },
                      { label:"Invoices synced", value:"23", meta:"$1.2M total value pushed" },
                      { label:"Payments received", value:"19", meta:"$982K confirmed via QB" },
                    ].map((s,i)=>(
                      <div key={i} style={{ background:s.type==="success"?"var(--success-soft)":"var(--surface-2)", border:`1px solid ${s.type==="success"?"#a7d9be":"var(--surface-3)"}`, borderRadius:14, padding:"12px 14px" }}>
                        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".06em", color:"var(--text-tertiary)", fontWeight:700, fontFamily:F.display }}>{s.label}</div>
                        <div style={{ fontFamily:F.display, fontSize:18, fontWeight:820, letterSpacing:"-.03em", marginTop:4, color:s.type==="success"?"var(--success-text)":"var(--text-primary)" }}>{s.value}</div>
                        <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:3, fontWeight:520 }}>{s.meta}</div>
                      </div>
                    ))}
                  </div>

                  {/* Project Mapping */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div>
                      <h3 style={{ fontFamily:F.display, fontSize:15, fontWeight:720, letterSpacing:"-.01em", margin:0 }}>Project mapping</h3>
                      <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2, fontWeight:520 }}>BuiltCRM projects matched to QuickBooks customers/jobs</div>
                    </div>
                    <SmBtn>Add mapping</SmBtn>
                  </div>

                  <div style={{ overflow:"hidden", border:"1px solid var(--surface-3)", borderRadius:14, marginBottom:24 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr>
                          {["BuiltCRM Project","","QuickBooks Customer / Job","Invoices","Last sync","Status"].map(h=>(
                            <th key={h} style={{ textAlign:"left", fontFamily:F.display, fontSize:11, fontWeight:700, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:".06em", padding:"8px 12px", borderBottom:"2px solid var(--surface-3)", background:"var(--surface-2)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {QB_MAPPINGS.map((m,i)=>(
                          <tr key={i} style={{ cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.querySelectorAll("td").forEach(td=>td.style.background="var(--surface-hover)")} onMouseLeave={e=>e.currentTarget.querySelectorAll("td").forEach(td=>td.style.background="")}>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface-3)", fontSize:13 }}>
                              <strong>{m.project}</strong><br/><span style={{ fontSize:11, color:"var(--text-tertiary)" }}>{m.type}</span>
                            </td>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface-3)", color:"var(--text-tertiary)", fontSize:12, textAlign:"center" }}>→</td>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface-3)" }}>
                              <span style={{ fontFamily:F.mono, fontSize:12, color:"var(--accent-text)", background:"var(--accent-soft)", padding:"2px 8px", borderRadius:6, display:"inline-block" }}>{m.external}</span>
                            </td>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface-3)", fontSize:13 }}>{m.invoices}</td>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface-3)", fontSize:12, color:"var(--text-tertiary)" }}>{m.lastSync}</td>
                            <td style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface-3)" }}><Pill cls="green">Synced</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Sync Activity */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div>
                      <h3 style={{ fontFamily:F.display, fontSize:15, fontWeight:720, letterSpacing:"-.01em", margin:0 }}>Recent sync activity</h3>
                      <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2, fontWeight:520 }}>Last 10 sync operations</div>
                    </div>
                    <SmBtn>View all</SmBtn>
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {SYNC_LOG.map((s,i)=>{
                      const iconStyles = { push:{ bg:"var(--accent-soft)", color:"var(--accent-text)", sym:"↑" }, pull:{ bg:"var(--info-soft)", color:"var(--info-text)", sym:"↓" }, reconcile:{ bg:"var(--success-soft)", color:"var(--success-text)", sym:"✓" }, error:{ bg:"var(--danger-soft)", color:"var(--danger-text)", sym:"✕" } };
                      const ic = iconStyles[s.icon] || iconStyles.push;
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 12px", border:"1px solid var(--surface-3)", borderRadius:10, background:"var(--surface-1)" }}>
                          <div style={{ width:28, height:28, borderRadius:6, display:"grid", placeItems:"center", flexShrink:0, fontSize:13, background:ic.bg, color:ic.color, fontWeight:700 }}>{ic.sym}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontFamily:F.display, fontSize:13, fontWeight:650 }}>{s.title}</div>
                            <div style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.45, marginTop:2, fontWeight:520 }}>{s.desc}</div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                            <span style={{ fontSize:11, color:"var(--text-tertiary)", fontFamily:F.display, fontWeight:600, whiteSpace:"nowrap" }}>{s.time}</span>
                            <span style={{ fontSize:10, fontWeight:700, fontFamily:F.display, padding:"2px 8px", borderRadius:999, background:s.status==="success"?"var(--success-soft)":"var(--danger-soft)", color:s.status==="success"?"var(--success-text)":"var(--danger-text)" }}>{s.status==="success"?"Success":"Failed"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ PAYMENTS VIEW ═══════ */}
          {view === "payments" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ fontFamily:F.display, fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Payments</h2>
                <p style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, maxWidth:640, fontWeight:520 }}>Manage your Stripe Connect account, view processed payments, and configure payment preferences.</p>
              </div>

              {/* Stripe Hero */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
                {/* Stripe Connection Card */}
                <div style={{ background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:18, padding:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#635bff,#4f46d6)", color:"white", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:13, fontWeight:800 }}>S</div>
                    <div>
                      <div style={{ fontFamily:F.display, fontSize:15, fontWeight:720, letterSpacing:"-.01em" }}>Stripe Connect</div>
                      <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2, fontWeight:520 }}>Account: <span style={{ fontFamily:F.mono, fontSize:11 }}>acct_1PqR3sT4uV</span> · Verified</div>
                    </div>
                    <Pill cls="green" style={{ marginLeft:"auto" }}>Active</Pill>
                  </div>
                  <div style={{ display:"flex", gap:12, marginBottom:14 }}>
                    {[{ label:"Total processed", value:"$287,000", meta:"14 payments across 4 projects" },
                      { label:"Processing fees", value:"$64", meta:"Avg 0.02% · ACH cap at $5/txn" }
                    ].map((s,i)=>(
                      <div key={i} style={{ flex:1, background:"var(--surface-2)", border:"1px solid var(--surface-3)", borderRadius:14, padding:12 }}>
                        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".06em", color:"var(--text-tertiary)", fontWeight:700, fontFamily:F.display }}>{s.label}</div>
                        <div style={{ fontFamily:F.display, fontSize:20, fontWeight:820, letterSpacing:"-.03em", marginTop:4 }}>{s.value}</div>
                        <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:3, fontWeight:520 }}>{s.meta}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <SmBtn>Stripe dashboard</SmBtn><SmBtn>Payout settings</SmBtn><SmBtn danger>Disconnect</SmBtn>
                  </div>
                </div>

                {/* Payment Methods */}
                <div style={{ background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:18, padding:20 }}>
                  <h4 style={{ fontFamily:F.display, fontSize:14, fontWeight:720, marginBottom:12, margin:0 }}>Payment methods enabled</h4>
                  <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:12 }}>
                    {[
                      { emoji:"\u{1F3E6}", name:"ACH Bank Transfer", desc:"0.8% fee, capped at $5 per transaction", pill:"Enabled", pillCls:"green", bg:"var(--success-soft)" },
                      { emoji:"\u{1F4B3}", name:"Credit / Debit Card", desc:"2.9% + $0.30 per transaction", pill:"Enabled", pillCls:"green", bg:"var(--info-soft)" },
                      { emoji:"\u270F\uFE0F", name:"Manual recording", desc:"Record checks, wires, and other offline payments for tracking", pill:"Always on", bg:"var(--surface-2)" },
                    ].map((m,i)=>(
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"var(--surface-2)", border:"1px solid var(--surface-3)", borderRadius:14 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:m.bg, display:"grid", placeItems:"center", fontSize:14, flexShrink:0 }}>{m.emoji}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:F.display, fontSize:13, fontWeight:650 }}>{m.name}</div>
                          <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:1, fontWeight:520 }}>{m.desc}</div>
                        </div>
                        <Pill cls={m.pillCls}>{m.pill}</Pill>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Payments */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div>
                  <h3 style={{ fontFamily:F.display, fontSize:15, fontWeight:720, letterSpacing:"-.01em", margin:0 }}>Recent payments</h3>
                  <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2, fontWeight:520 }}>All payment transactions across projects</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <SmBtn>Export</SmBtn><SmBtn>Record manual payment</SmBtn>
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {RECENT_PAYMENTS.map((p,i)=>{
                  const iconBg = { ach:"var(--success-soft)", card:"var(--info-soft)", pending:"var(--warning-soft)" }[p.icon] || "var(--surface-2)";
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", border:"1px solid var(--surface-3)", borderRadius:10, background:"var(--surface-1)" }}>
                      <div style={{ width:32, height:32, borderRadius:6, display:"grid", placeItems:"center", flexShrink:0, fontSize:14, background:iconBg }}>{p.emoji}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:F.display, fontSize:13, fontWeight:650 }}>{p.title}</div>
                        <div style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:520 }}>{p.meta}</div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontFamily:F.display, fontSize:15, fontWeight:750, letterSpacing:"-.02em" }}>{p.amount}</div>
                        <div style={{ fontSize:11, color:"var(--text-tertiary)", fontWeight:520, marginTop:2 }}>{p.fee}</div>
                      </div>
                      <Pill cls={p.statusCls}>{p.status}</Pill>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function IntCard({ int }) {
  const isConnected = int.state === "connected";
  const logoStyles = {
    qb: { background:"linear-gradient(135deg,#2ca01c,#108a00)", color:"white", fontFamily:F.display, fontSize:16, fontWeight:800, border:"none" },
    stripe: { background:"linear-gradient(135deg,#635bff,#4f46d6)", color:"white", fontFamily:F.display, fontSize:14, fontWeight:800, border:"none" },
    xero: { background:"linear-gradient(135deg,#13b5ea,#0d9dd5)", color:"white", fontFamily:F.display, fontSize:13, fontWeight:800, border:"none" },
    sage: { background:"linear-gradient(135deg,#00d639,#00b62f)", color:"white", fontFamily:F.display, fontSize:13, fontWeight:800, border:"none" },
    gcal: { background:"#fff", fontSize:22 },
    email: { background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"white", border:"none" },
    csv: { background:"var(--surface-2)", color:"var(--text-secondary)" },
    webhook: { background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"white", border:"none" },
  };
  const ls = logoStyles[int.logoCls] || {};

  return (
    <div style={{ background:"var(--surface-1)", border:`1px solid ${isConnected&&!int.alwaysOn?"var(--accent-muted)":"var(--surface-3)"}`, borderRadius:18, padding:20, position:"relative", overflow:"hidden", cursor:"pointer", transition:"all 200ms" }}>
      {isConnected && !int.alwaysOn && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,var(--accent),var(--accent-muted))" }}/>}
      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:14 }}>
        <div style={{ width:44, height:44, borderRadius:14, border:"1px solid var(--surface-3)", display:"grid", placeItems:"center", flexShrink:0, fontSize:20, background:"var(--surface-2)", ...ls }}>
          {int.logo==="file" ? <span style={{ width:20, height:20, display:"block" }}>{I.file}</span> : int.logo==="link" ? <span style={{ width:18, height:18, display:"block" }}>{I.link}</span> : int.logo}
        </div>
        <div>
          <div style={{ fontFamily:F.display, fontSize:15, fontWeight:700, letterSpacing:"-.01em" }}>{int.name}</div>
          <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:2 }}>{int.provider}</div>
        </div>
      </div>
      <div style={{ fontSize:12.5, color:"var(--text-secondary)", lineHeight:1.5, marginBottom:16, fontWeight:520 }}>{int.desc}</div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:isConnected?"var(--success)":"var(--surface-4)" }}/>
        <span style={{ fontSize:12, fontWeight:620, color:isConnected?"var(--success-text)":"var(--text-tertiary)" }}>{int.statusLabel}</span>
        {int.statusMeta && <span style={{ fontSize:11, color:"var(--text-tertiary)", marginLeft:"auto" }}>{int.statusMeta}</span>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        {int.pills?.map((p,i) => <Pill key={i} cls={p.cls}>{p.text}</Pill>)}
        {int.btn && <button style={{ height:30, padding:"0 10px", borderRadius:6, fontSize:12, fontWeight:620, background:"var(--accent)", color:"white", border:"none", cursor:"pointer" }}>{int.btn}</button>}
        {int.gated && <button style={{ height:30, padding:"0 10px", borderRadius:6, fontSize:12, fontWeight:620, color:"var(--accent-text)", background:"transparent", border:"1px solid var(--surface-3)", cursor:"pointer" }}>Upgrade plan</button>}
        {int.extraPill && <Pill cls={int.extraPill.cls}>{int.extraPill.text}</Pill>}
      </div>
    </div>
  );
}

function Pill({ children, cls, style={} }) {
  const colors = {
    green: { background:"var(--success-soft)", color:"var(--success-text)", borderColor:"#a7d9be" },
    orange: { background:"var(--warning-soft)", color:"var(--warning-text)", borderColor:"#f5d6a0" },
    blue: { background:"var(--info-soft)", color:"var(--info-text)", borderColor:"#b3d4ee" },
    purple: { background:"var(--accent-soft)", color:"var(--accent-text)", borderColor:"var(--accent-muted)" },
  };
  const c = colors[cls] || {};
  return <span style={{ height:24, padding:"0 10px", borderRadius:999, border:"1px solid var(--surface-3)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, background:"var(--surface-1)", color:"var(--text-tertiary)", whiteSpace:"nowrap", flexShrink:0, fontFamily:F.display, ...c, ...style }}>{children}</span>;
}

function SmBtn({ children, danger }) {
  return <button style={{ height:30, padding:"0 10px", borderRadius:6, border:`1px solid ${danger?"var(--danger)":"var(--surface-3)"}`, background:"var(--surface-1)", color:danger?"var(--danger-text)":"var(--text-primary)", fontSize:12, fontWeight:620, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>{children}</button>;
}
