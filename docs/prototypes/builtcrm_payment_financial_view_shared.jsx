import { useState } from "react";

// ── Portal themes ──
const PORTAL_THEMES = {
  contractor: {},
  sub: { "--accent":"#3d6b8e","--accent-hover":"#345d7c","--accent-soft":"#e8f0f6","--accent-text":"#2e5a78","--accent-muted":"#b3cede","--shadow-ring":"0 0 0 3px rgba(61,107,142,.15)" },
};
const PORTAL_META = {
  contractor: { label:"Contractor Portal", avatar:"DC", name:"Dan Carter", role:"Project Manager", page:"Financials" },
  sub: { label:"Subcontractor Portal", avatar:"AM", name:"Alex Morgan", role:"Meridian MEP", page:"Payments" },
};
const SIDEBAR_NAV = {
  contractor: [
    { section:"Overview", items:[{ label:"Dashboard" }] },
    { section:"Riverside Tower Fit-Out", items:[
      { label:"Project Home" },{ label:"RFIs / Issues", badge:3 },{ label:"Change Orders", badge:2, warn:true },
      { label:"Approvals", badge:4 },{ label:"Billing / Draws", active:true },{ label:"Compliance", badge:1, warn:true },
      { label:"Upload Requests", badge:2 },{ label:"Selections" },{ label:"Documents" },
      { label:"Schedule" },{ label:"Messages", badge:3 },
    ]},
    { section:"Organization", items:[{ label:"Subcontractors" },{ label:"Clients" },{ label:"Team" }] },
  ],
  sub: [
    { section:"Your Projects", items:[{ label:"Today Board" }] },
    { section:"Riverside Tower Fit-Out", items:[
      { label:"Project Home" },{ label:"RFIs / Issues", badge:2, danger:true },{ label:"Upload Requests", badge:1 },
      { label:"Compliance", badge:1, warn:true },{ label:"Documents" },{ label:"Payments", active:true },
      { label:"Schedule" },{ label:"Messages", badge:1 },
    ]},
  ],
};

// ── SVG Icons ──
const I = {
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

// ── DATA ──
const DRAWS = [
  { num:"Draw #6", period:"Apr 1–30", amount:"$162,900", status:"Draft", dot:"var(--surface-4)", paid:"—" },
  { num:"Draw #5", period:"Mar 1–31", amount:"$213,670", status:"Approved", dot:"var(--info)", paid:"Pending" },
  { num:"Draw #4", period:"Feb 1–28", amount:"$285,400", status:"Paid", dot:"var(--success)", paid:"Mar 14" },
  { num:"Draw #3", period:"Jan 1–31", amount:"$312,600", status:"Paid", dot:"var(--success)", paid:"Feb 12" },
  { num:"Draw #2", period:"Dec 1–31", amount:"$289,100", status:"Paid", dot:"var(--success)", paid:"Jan 10" },
  { num:"Draw #1", period:"Nov 1–30", amount:"$233,300", status:"Paid", dot:"var(--success)", paid:"Dec 8" },
];

const SUBS = [
  { initials:"AM", color:"#3d6b8e", name:"Meridian MEP", trade:"Mechanical · Electrical · Plumbing", contract:"$410,000", paid:"$287,000", status:"Current", statusType:"current" },
  { initials:"NR", color:"var(--info)", name:"Northline Electrical", trade:"Electrical systems", contract:"$380,000", paid:"$266,000", status:"$30,400 due", statusType:"outstanding" },
  { initials:"CP", color:"var(--success)", name:"Capital Plumbing", trade:"Plumbing · Fire suppression", contract:"$195,000", paid:"$140,400", status:"Current", statusType:"current" },
  { initials:"AF", color:"var(--warning)", name:"Apex Finishes", trade:"Interior finishes · Drywall", contract:"$290,000", paid:"$78,300", status:"Current", statusType:"current" },
  { initials:"NS", color:"var(--danger)", name:"Northline Steel", trade:"Structural steel", contract:"$520,000", paid:"$457,600", status:"Current", statusType:"current" },
];

const SUB_PAYMENTS = [
  { type:"submitted", title:"Draw #5 — Submitted", meta:"Mar 28, 2026 · Included in GC billing package", amount:"$45,100" },
  { type:"pending", title:"Draw #5 — Approved, Awaiting Payment", meta:"Apr 2, 2026 · Payment expected within 10 business days", amount:"$12,000" },
  { type:"paid", title:"Draw #4 — Paid", meta:"Mar 14, 2026 · Check #4821", amount:"$68,000" },
  { type:"paid", title:"Draw #3 — Paid", meta:"Feb 12, 2026 · Check #4789", amount:"$82,000" },
  { type:"paid", title:"Draw #2 — Paid", meta:"Jan 10, 2026 · Check #4756", amount:"$72,000" },
  { type:"paid", title:"Draw #1 — Paid", meta:"Dec 8, 2025 · Check #4720", amount:"$65,000" },
];

const LIEN_WAIVERS = [
  { title:"Draw #5 — Conditional Waiver", meta:"Submitted Mar 28 · Covers $45,100", status:"Submitted" },
  { title:"Draw #4 — Unconditional Waiver", meta:"Submitted Feb 28 · Covers $68,000", status:"Accepted" },
  { title:"Draw #3 — Unconditional Waiver", meta:"Submitted Jan 28 · Covers $82,000", status:"Accepted" },
];

// ── Shared component styles ──
const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

export default function PaymentFinancialViewShared() {
  const [portal, setPortal] = useState("contractor");
  const [dark, setDark] = useState(false);
  const theme = PORTAL_THEMES[portal];
  const meta = PORTAL_META[portal];

  return (
    <div style={{
      "--surface-0": dark?"#111015":"#eef0f3",
      "--surface-1": dark?"#1a191e":"#ffffff",
      "--surface-2": dark?"#232228":"#f3f4f6",
      "--surface-3": dark?"#2e2d33":"#e2e5e9",
      "--surface-4": dark?"#3d3c44":"#d1d5db",
      "--surface-hover": dark?"#27262c":"#f5f6f8",
      "--sidebar-bg": dark?"#16151a":"#ffffff",
      "--sidebar-hover": dark?"#1f1e24":"#f5f6f8",
      "--sidebar-border": dark?"#2a2930":"#e8eaee",
      "--text-primary": dark?"#eae9ed":"#1a1714",
      "--text-secondary": dark?"#9e9ba5":"#6b655b",
      "--text-tertiary": dark?"#6b6874":"#9c958a",
      "--accent":"#5b4fc7","--accent-hover":"#4f44b3",
      "--accent-soft": dark?"#2a2748":"#eeedfb",
      "--accent-text": dark?"#b4adf0":"#4a3fb0",
      "--accent-muted": dark?"#3d3870":"#c7c2ea",
      "--success":"#2d8a5e","--success-soft": dark?"#1a2e22":"#edf7f1","--success-text": dark?"#6fcf97":"#1e6b46",
      "--warning":"#c17a1a","--warning-soft": dark?"#2e2518":"#fdf4e6","--warning-text": dark?"#e8a84c":"#96600f",
      "--danger":"#c93b3b","--danger-soft": dark?"#2e1a1a":"#fdeaea","--danger-text": dark?"#e87c7c":"#a52e2e",
      "--info":"#3178b9","--info-soft": dark?"#1a2530":"#e8f1fa","--info-text": dark?"#6db3e8":"#276299",
      "--shadow-sm": dark?"0 1px 3px rgba(0,0,0,.3)":"0 1px 3px rgba(26,23,20,.05)",
      "--shadow-md": dark?"0 4px 16px rgba(0,0,0,.35)":"0 4px 16px rgba(26,23,20,.06)",
      "--shadow-ring":"0 0 0 3px rgba(91,79,199,.15)",
      ...theme,
      display:"grid", gridTemplateColumns:"272px 1fr", minHeight:"100vh",
      fontFamily:F.body, background:"var(--surface-0)", color:"var(--text-primary)",
      WebkitFontSmoothing:"antialiased",
    }}>
      {/* ── SIDEBAR ── */}
      <aside style={{ background:"var(--sidebar-bg)", borderRight:"1px solid var(--sidebar-border)", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", overflow:"hidden" }}>
        <div style={{ height:56, display:"flex", alignItems:"center", gap:12, padding:"0 20px", borderBottom:"1px solid var(--sidebar-border)", flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:dark?"linear-gradient(135deg,#eae9ed,#b8b5c0)":"linear-gradient(135deg,#1a1714,#3d3830)", display:"grid", placeItems:"center", flexShrink:0 }}><svg viewBox="0 0 80 80" width="18" height="18"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke={dark?"#1a1714":"white"} strokeWidth="3.5" opacity=".5"/><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke={dark?"#1a1714":"white"} strokeWidth="3.5" opacity=".75"/><rect x="32" y="32" width="26" height="26" rx="4" fill={dark?"#1a1714":"white"} opacity=".95"/></svg></div>
          <div>
            <div style={{ fontFamily:F.display, fontSize:14, fontWeight:700 }}>BuiltCRM</div>
            <div style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:1 }}>{meta.label}</div>
          </div>
        </div>
        <nav style={{ flex:1, overflowY:"auto", padding:"8px 10px 20px" }}>
          {SIDEBAR_NAV[portal].map((s,si)=>(
            <div key={si} style={{ marginBottom:4 }}>
              <div style={{ fontFamily:F.display, fontSize:11, fontWeight:700, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:".06em", padding:"10px 10px 6px" }}>{s.section}</div>
              {s.items.map((it,ii)=>(
                <div key={ii} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:10, fontSize:13, fontWeight:it.active?650:520, color:it.active?"var(--accent-text)":"var(--text-secondary)", background:it.active?"var(--accent-soft)":"transparent", marginBottom:2, cursor:"default" }}>
                  <span>{it.label}</span>
                  {it.badge && <span style={{ minWidth:20, height:20, padding:"0 7px", borderRadius:999, background:it.danger?"var(--danger-soft)":it.warn?"var(--warning-soft)":"var(--accent-soft)", color:it.danger?"var(--danger-text)":it.warn?"var(--warning-text)":"var(--accent-text)", fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", fontFamily:F.display }}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ borderTop:"1px solid var(--sidebar-border)", padding:"12px 16px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:6 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--accent-muted))", color:"white", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:11, fontWeight:700 }}>{meta.avatar}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:580 }}>{meta.name}</div>
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
            <span>{meta.label}</span><span style={{ color:"var(--surface-4)" }}>›</span>
            <span>Riverside Tower Fit-Out</span><span style={{ color:"var(--surface-4)" }}>›</span>
            <span style={{ color:"var(--text-primary)", fontWeight:650 }}>{meta.page}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>setDark(!dark)} style={{ width:34, height:34, borderRadius:10, border:"1px solid var(--surface-3)", background:"var(--surface-1)", display:"grid", placeItems:"center", color:"var(--text-secondary)", cursor:"pointer" }}>
              <span style={{ width:16, height:16, display:"block" }}>{dark?I.sun:I.moon}</span>
            </button>
            <button style={{ width:34, height:34, borderRadius:10, border:"1px solid var(--surface-3)", background:"var(--surface-1)", display:"grid", placeItems:"center", color:"var(--text-secondary)", cursor:"pointer", position:"relative" }}>
              <span style={{ width:16, height:16, display:"block" }}>{I.bell}</span>
              <span style={{ position:"absolute", top:6, right:6, width:7, height:7, borderRadius:"50%", background:"var(--danger)", border:"2px solid var(--surface-1)" }}/>
            </button>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--accent)", color:"white", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:12, fontWeight:700 }}>{meta.avatar}</div>
          </div>
        </header>

        <div style={{ padding:24, flex:1 }}>
          {/* Portal Switcher */}
          <div style={{ display:"flex", gap:4, marginBottom:20, background:"var(--surface-2)", borderRadius:14, padding:4, width:"fit-content" }}>
            {[["contractor","Contractor","#5b4fc7"],["sub","Subcontractor","#3d6b8e"]].map(([key,label,dot])=>(
              <button key={key} onClick={()=>setPortal(key)} style={{ height:36, padding:"0 16px", borderRadius:10, fontSize:13, fontWeight:650, color:portal===key?"var(--text-primary)":"var(--text-secondary)", background:portal===key?"var(--surface-1)":"transparent", boxShadow:portal===key?"var(--shadow-sm)":"none", display:"inline-flex", alignItems:"center", gap:7, border:"none", cursor:"pointer", whiteSpace:"nowrap" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:dot }}/>{label}
              </button>
            ))}
          </div>

          {/* ──── CONTRACTOR VIEW ──── */}
          {portal === "contractor" && (
            <div>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:20, marginBottom:16 }}>
                <div>
                  <h2 style={{ fontFamily:F.display, fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Financials</h2>
                  <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, fontWeight:520 }}>Riverside Tower Fit-Out · Contract financial overview</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <GhostBtn icon={I.download}>Export Report</GhostBtn>
                  <PrimaryBtn icon={I.file}>New Draw Request</PrimaryBtn>
                </div>
              </div>

              {/* Contract Summary Banner */}
              <Card style={{ padding:"20px 24px", marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontFamily:F.display, fontSize:15, fontWeight:720, letterSpacing:"-.02em" }}>Contract Summary</div>
                  <div style={{ fontSize:11.5, color:"var(--text-tertiary)" }}>As of Draw #5 · Approved Apr 2, 2026</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:16 }}>
                  {[
                    { val:"$2,180,000", label:"Original Contract" },
                    { val:"+$247,200", label:"Change Orders (6)" },
                    { val:"$2,427,200", label:"Revised Contract Value", highlight:true },
                    { val:"$1,482,300", label:"Billed to Date" },
                    { val:"$944,900", label:"Remaining to Bill", warn:true },
                  ].map((c,i)=>(
                    <div key={i} style={{ textAlign:"center", padding:"12px 8px", borderRadius:14, background:c.highlight?"var(--accent-soft)":c.warn?"var(--warning-soft)":"var(--surface-2)" }}>
                      <div style={{ fontFamily:F.display, fontSize:18, fontWeight:820, letterSpacing:"-.02em", color:c.highlight?"var(--accent-text)":c.warn?"var(--warning-text)":"var(--text-primary)", marginBottom:2 }}>{c.val}</div>
                      <div style={{ fontSize:11, color:c.highlight?"var(--accent-text)":c.warn?"var(--warning-text)":"var(--text-tertiary)", fontWeight:600 }}>{c.label}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Billing Progress */}
              <BillingBar
                title="Billing & Payment Progress" pctLabel="61% Billed"
                segments={[
                  { width:46, color:"var(--success)", first:true },
                  { width:8, color:"var(--info)" },
                  { width:1, color:"var(--warning)" },
                  { width:6, color:"var(--accent)", last:true },
                ]}
                legend={[
                  { color:"var(--success)", label:"Paid", val:"$1,120,400" },
                  { color:"var(--info)", label:"Approved / Unpaid", val:"$213,670" },
                  { color:"var(--warning)", label:"Under Review", val:"$0" },
                  { color:"var(--accent)", label:"Retainage Held", val:"$148,230" },
                  { color:"var(--surface-3)", label:"Remaining", val:"$944,900" },
                ]}
              />

              {/* Two Column Grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                {/* Draw History */}
                <Card>
                  <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--surface-3)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontFamily:F.display, fontSize:14, fontWeight:720, letterSpacing:"-.01em" }}>Draw History</div>
                      <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2 }}>5 completed · 1 in preparation</div>
                    </div>
                    <MiniGhostBtn>View all</MiniGhostBtn>
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        {["Draw","Period","Amount","Status","Paid"].map(h=>(
                          <th key={h} style={{ fontFamily:F.display, fontSize:10.5, fontWeight:700, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:".04em", padding:"10px 14px", textAlign:"left", borderBottom:"1px solid var(--surface-3)", whiteSpace:"nowrap", background:"var(--surface-2)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DRAWS.map((d,i)=>(
                        <tr key={i} style={{ cursor:"pointer" }}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--surface-hover)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"12px 14px", borderBottom:"1px solid var(--surface-3)", fontSize:13 }}>
                            <span style={{ fontFamily:F.display, fontWeight:700 }}>{d.num}</span>
                          </td>
                          <td style={{ padding:"12px 14px", borderBottom:"1px solid var(--surface-3)", fontSize:12, color:"var(--text-secondary)" }}>{d.period}</td>
                          <td style={{ padding:"12px 14px", borderBottom:"1px solid var(--surface-3)" }}>
                            <span style={{ fontFamily:F.display, fontSize:13, fontWeight:700 }}>{d.amount}</span>
                          </td>
                          <td style={{ padding:"12px 14px", borderBottom:"1px solid var(--surface-3)" }}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:620 }}>
                              <span style={{ width:7, height:7, borderRadius:"50%", background:d.dot, flexShrink:0 }}/>{d.status}
                            </span>
                          </td>
                          <td style={{ padding:"12px 14px", borderBottom:"1px solid var(--surface-3)", fontSize:12, color:"var(--text-secondary)" }}>{d.paid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                {/* Sub Payment Status */}
                <Card>
                  <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--surface-3)" }}>
                    <div style={{ fontFamily:F.display, fontSize:14, fontWeight:720, letterSpacing:"-.01em" }}>Subcontractor Payment Status</div>
                    <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2 }}>5 active subcontractors</div>
                  </div>
                  {SUBS.map((s,i)=>(
                    <div key={i} style={{ padding:"12px 16px", borderBottom:i<SUBS.length-1?"1px solid var(--surface-3)":"none", display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", display:"grid", placeItems:"center", fontFamily:F.display, fontSize:11, fontWeight:700, color:"white", flexShrink:0, background:s.color }}>{s.initials}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:640 }}>
                          <span style={{ fontFamily:F.mono, fontSize:12.5, fontWeight:520 }}>{s.name}</span>
                        </div>
                        <div style={{ fontSize:11.5, color:"var(--text-tertiary)" }}>{s.trade}</div>
                      </div>
                      <div style={{ display:"flex", gap:16, flexShrink:0, alignItems:"center" }}>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:F.display, fontSize:13, fontWeight:700 }}>{s.contract}</div>
                          <div style={{ fontSize:10, color:"var(--text-tertiary)", fontWeight:600, marginTop:1 }}>Contract</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:F.display, fontSize:13, fontWeight:700 }}>{s.paid}</div>
                          <div style={{ fontSize:10, color:"var(--text-tertiary)", fontWeight:600, marginTop:1 }}>Paid</div>
                        </div>
                        <SubPayStatus type={s.statusType}>{s.status}</SubPayStatus>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>

              {/* Retainage Summary */}
              <Card style={{ marginBottom:20 }}>
                <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--surface-3)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontFamily:F.display, fontSize:14, fontWeight:720, letterSpacing:"-.01em" }}>Retainage Summary</div>
                    <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2 }}>10% retainage on all work completed</div>
                  </div>
                  <MiniGhostBtn>Request Release</MiniGhostBtn>
                </div>
                <RetainageBar pct={25} dashoffset={132} amount="$148,230" detail="Retainage will be eligible for release at substantial completion (target Jul 31, 2026)"
                  amounts={[{ label:"Accumulated", val:"$148,230" },{ label:"Released", val:"$0" },{ label:"Balance", val:"$148,230" }]} />
              </Card>
            </div>
          )}

          {/* ──── SUBCONTRACTOR VIEW ──── */}
          {portal === "sub" && (
            <div>
              <div style={{ marginBottom:16 }}>
                <h2 style={{ fontFamily:F.display, fontSize:26, fontWeight:820, letterSpacing:"-.035em", margin:0 }}>Payments</h2>
                <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4, fontWeight:520 }}>Riverside Tower Fit-Out · Your payment status with Carter Construction</div>
              </div>

              {/* Sub Contract Summary */}
              <Card style={{ padding:"20px 24px", marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontFamily:F.display, fontSize:15, fontWeight:720, letterSpacing:"-.02em" }}>Your Contract Summary</div>
                  <div style={{ fontSize:11.5, color:"var(--text-tertiary)" }}>Meridian MEP — Mechanical, Electrical & Plumbing scope</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
                  {[
                    { val:"$410,000", label:"Contract Value" },
                    { val:"$332,100", label:"Total Earned", highlight:true },
                    { val:"$287,000", label:"Total Paid" },
                    { val:"$77,900", label:"Remaining", warn:true },
                  ].map((c,i)=>(
                    <div key={i} style={{ textAlign:"center", padding:"12px 8px", borderRadius:14, background:c.highlight?"var(--accent-soft)":c.warn?"var(--warning-soft)":"var(--surface-2)" }}>
                      <div style={{ fontFamily:F.display, fontSize:18, fontWeight:820, letterSpacing:"-.02em", color:c.highlight?"var(--accent-text)":c.warn?"var(--warning-text)":"var(--text-primary)", marginBottom:2 }}>{c.val}</div>
                      <div style={{ fontSize:11, color:c.highlight?"var(--accent-text)":c.warn?"var(--warning-text)":"var(--text-tertiary)", fontWeight:600 }}>{c.label}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Sub Billing Progress */}
              <BillingBar
                title="Payment Progress" pctLabel="70% Paid"
                segments={[
                  { width:70, color:"var(--success)", first:true },
                  { width:4, color:"var(--info)" },
                  { width:7, color:"var(--accent)", last:true },
                ]}
                legend={[
                  { color:"var(--success)", label:"Paid", val:"$287,000" },
                  { color:"var(--info)", label:"Approved / Awaiting Payment", val:"$12,000" },
                  { color:"var(--accent)", label:"Retainage Held", val:"$33,100" },
                  { color:"var(--surface-3)", label:"Remaining", val:"$77,900" },
                ]}
              />

              {/* Two Column Grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                {/* Payment Timeline */}
                <Card>
                  <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--surface-3)" }}>
                    <div style={{ fontFamily:F.display, fontSize:14, fontWeight:720, letterSpacing:"-.01em" }}>Payment History</div>
                    <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2 }}>Your billing submissions and payments received</div>
                  </div>
                  <div style={{ padding:"16px 20px" }}>
                    {SUB_PAYMENTS.map((p,i)=>{
                      const dotStyle = { paid:{ bg:"var(--success-soft)", color:"var(--success-text)", border:"#a8d5b8" }, pending:{ bg:"var(--warning-soft)", color:"var(--warning-text)", border:"#e0c595" }, submitted:{ bg:"var(--info-soft)", color:"var(--info-text)", border:"#a8c8e0" } }[p.type];
                      const dotIcon = p.type==="paid"?I.check:p.type==="pending"?I.clock:I.upload;
                      return (
                        <div key={i} style={{ display:"flex", gap:12, marginBottom:14, position:"relative" }}>
                          {i < SUB_PAYMENTS.length-1 && <div style={{ position:"absolute", left:13, top:30, bottom:-8, width:1.5, background:"var(--surface-3)" }}/>}
                          <div style={{ width:26, height:26, borderRadius:"50%", display:"grid", placeItems:"center", flexShrink:0, zIndex:1, background:dotStyle.bg, color:dotStyle.color, border:`2px solid ${dotStyle.border}` }}>
                            <span style={{ width:12, height:12, display:"block" }}>{dotIcon}</span>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:640 }}>{p.title}</div>
                            <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2, fontWeight:520 }}>{p.meta}</div>
                          </div>
                          <div style={{ fontFamily:F.display, fontSize:13, fontWeight:700, flexShrink:0 }}>{p.amount}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Right Column: Retainage + Lien Waivers */}
                <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                  {/* Retainage */}
                  <Card>
                    <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--surface-3)" }}>
                      <div style={{ fontFamily:F.display, fontSize:14, fontWeight:720, letterSpacing:"-.01em" }}>Retainage Held</div>
                      <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2 }}>10% withheld on all approved work</div>
                    </div>
                    <RetainageBar pct={10} dashoffset={158} amount="$33,100" detail="Retainage is released after substantial completion and your closeout documents are accepted."
                      amounts={[{ label:"Accumulated", val:"$33,100" },{ label:"Released", val:"$0" }]} />
                  </Card>

                  {/* Lien Waivers */}
                  <Card>
                    <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid var(--surface-3)" }}>
                      <div style={{ fontFamily:F.display, fontSize:14, fontWeight:720, letterSpacing:"-.01em" }}>Lien Waiver Status</div>
                      <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2 }}>Required for each draw payment</div>
                    </div>
                    <div style={{ padding:"4px 0" }}>
                      {LIEN_WAIVERS.map((w,i)=>(
                        <div key={i} style={{ padding:"12px 16px", borderBottom:i<LIEN_WAIVERS.length-1?"1px solid var(--surface-3)":"none", display:"flex", alignItems:"center", gap:14 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:620 }}>{w.title}</div>
                            <div style={{ fontSize:11.5, color:"var(--text-tertiary)", marginTop:2, fontWeight:520 }}>{w.meta}</div>
                          </div>
                          <SubPayStatus type="current">{w.status}</SubPayStatus>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
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

function Card({ children, style={} }) {
  return <div style={{ background:"var(--surface-1)", border:"1px solid var(--surface-3)", borderRadius:18, overflow:"hidden", ...style }}>{children}</div>;
}

function PrimaryBtn({ children, icon }) {
  return (
    <button style={{ height:38, padding:"0 18px", borderRadius:10, background:"var(--accent)", color:"white", fontSize:13, fontWeight:650, display:"inline-flex", alignItems:"center", gap:7, border:"none", cursor:"pointer", fontFamily:"'Instrument Sans',system-ui,sans-serif" }}>
      {icon && <span style={{ width:16, height:16, display:"block" }}>{icon}</span>}{children}
    </button>
  );
}

function GhostBtn({ children, icon }) {
  return (
    <button style={{ height:34, padding:"0 14px", borderRadius:10, fontSize:13, fontWeight:600, color:"var(--text-secondary)", border:"1px solid var(--surface-3)", display:"inline-flex", alignItems:"center", gap:6, background:"var(--surface-1)", cursor:"pointer", fontFamily:"'Instrument Sans',system-ui,sans-serif" }}>
      {icon && <span style={{ width:14, height:14, display:"block" }}>{icon}</span>}{children}
    </button>
  );
}

function MiniGhostBtn({ children }) {
  return (
    <button style={{ height:28, padding:"0 10px", borderRadius:8, fontSize:11.5, fontWeight:600, color:"var(--text-secondary)", border:"1px solid var(--surface-3)", display:"inline-flex", alignItems:"center", background:"var(--surface-1)", cursor:"pointer" }}>{children}</button>
  );
}

function SubPayStatus({ type, children }) {
  const styles = {
    current: { background:"var(--success-soft)", color:"var(--success-text)" },
    outstanding: { background:"var(--warning-soft)", color:"var(--warning-text)" },
    held: { background:"var(--danger-soft)", color:"var(--danger-text)" },
  };
  const s = styles[type] || styles.current;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:620, padding:"3px 8px", borderRadius:999, whiteSpace:"nowrap", ...s }}>{children}</span>;
}

function BillingBar({ title, pctLabel, segments, legend }) {
  return (
    <Card style={{ padding:"20px 24px", marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontFamily:F.display, fontSize:14, fontWeight:700 }}>{title}</div>
        <div style={{ fontFamily:F.display, fontSize:18, fontWeight:820, color:"var(--accent-text)" }}>{pctLabel}</div>
      </div>
      <div style={{ width:"100%", height:14, background:"var(--surface-2)", borderRadius:999, overflow:"hidden", display:"flex" }}>
        {segments.map((s,i)=>(
          <div key={i} style={{ height:"100%", width:`${s.width}%`, background:s.color, borderRadius:s.first?"999px 0 0 999px":s.last?"0 999px 999px 0":undefined, transition:"width .6s cubic-bezier(.16,1,.3,1)" }}/>
        ))}
      </div>
      <div style={{ display:"flex", gap:20, marginTop:10, flexWrap:"wrap" }}>
        {legend.map((l,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--text-secondary)", fontWeight:560 }}>
            <div style={{ width:10, height:10, borderRadius:3, flexShrink:0, background:l.color }}/>
            {l.label} <span style={{ fontFamily:F.display, fontWeight:700, color:"var(--text-primary)", fontSize:12 }}>{l.val}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RetainageBar({ pct, dashoffset, amount, detail, amounts }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 20px" }}>
      <div style={{ width:64, height:64, borderRadius:"50%", display:"grid", placeItems:"center", position:"relative" }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--surface-3)" strokeWidth="6"/>
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray="176" strokeDashoffset={dashoffset} strokeLinecap="round"/>
        </svg>
        <span style={{ position:"absolute", fontFamily:F.display, fontSize:14, fontWeight:750 }}>{pct}%</span>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:F.display, fontSize:14, fontWeight:700 }}>{amount} held in retainage</div>
        <div style={{ fontSize:12.5, color:"var(--text-secondary)", marginTop:3, fontWeight:520 }}>{detail}</div>
        <div style={{ display:"flex", gap:20, marginTop:8 }}>
          {amounts.map((a,i)=>(
            <span key={i} style={{ fontSize:12, fontWeight:560, color:"var(--text-tertiary)" }}>
              {a.label}: <strong style={{ fontFamily:F.display, color:"var(--text-primary)", fontWeight:700 }}>{a.val}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
