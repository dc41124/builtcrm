import { useState } from "react";

/*
 * STEP 64 — INTEGRATION GALLERY PAGE
 * ───────────────────────────────────
 * Marketing-shaped grid of ~21 known integrations with logos, scope
 * descriptions, and statuses (Connected · Available · Coming soon).
 * Two render modes in this single prototype:
 *
 *   1. Public ("marketing"): /integrations — no auth, marketing chrome.
 *      Shows the landscape, "Connect" buttons CTA to sign up.
 *   2. Authed ("portal"): /contractor/(global)/integrations/page.tsx — full app
 *      shell, "Connect" buttons either deep-link to Settings → Integrations
 *      (for working providers) or open the consent-mockup modal (for gated).
 *
 * The Settings → Integrations page (Step 28) shows ONLY what's wired and
 * is a separate file. This gallery is the broader "ecosystem" view.
 *
 * Build targets:
 *   - src/lib/integrations/galleryCatalog.ts  (data file)
 *   - src/app/(portal)/contractor/(global)/integrations/page.tsx  (authed)
 *   - src/app/integrations/page.tsx  (public)
 *   - Shared card component
 *   - Consent-mockup modal
 *
 * Logo note: prototype uses styled SVG initials with brand-accurate
 * gradients. Production should swap these for the providers' actual logos
 * with fair-use attribution in /public/logos/ or the marketing footer.
 */

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

// ── Icons ────────────────────────────────────────────────────────
const I = {
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  ext: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z"/></svg>,
  zap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  filter: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  cog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

// ── Categories ──────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",        label: "All" },
  { id: "accounting", label: "Accounting" },
  { id: "payments",   label: "Payments" },
  { id: "documents",  label: "Documents" },
  { id: "comms",      label: "Communication" },
  { id: "pm",         label: "Project Management" },
  { id: "compliance", label: "Compliance" },
  { id: "field",      label: "Field Tools" },
  { id: "payroll",    label: "Payroll" },
  { id: "lending",    label: "Lending" },
];

// ── Logo factory: brand-colored initials in a rounded square ────
const Logo = ({ text, fg = "#fff", bg, br = 12, size = 44, fz = 16 }) => (
  <div style={{
    width: size, height: size, borderRadius: br,
    background: bg, color: fg,
    display: "grid", placeItems: "center", flexShrink: 0,
    fontFamily: F.display, fontSize: fz, fontWeight: 800,
    letterSpacing: "-.02em",
  }}>{text}</div>
);

// ── Sample audit-friendly OAuth scopes per gated provider ───────
// (Realistic for the consent mockup — what we'd ask for if approved.)
const SCOPES = {
  procore: ["projects.read", "rfis.read", "rfis.write", "submittals.read", "drawings.read", "users.read"],
  autodesk: ["data:read", "data:write", "bucket:read", "account:read"],
  bluebeam: ["studio.sessions.read", "studio.documents.read", "studio.markups.read"],
  docusign: ["envelopes.read", "envelopes.write", "signers.read"],
  ms365: ["openid", "email", "Files.Read", "Mail.Send", "Calendars.ReadWrite"],
  gws: ["openid", "email", "drive.file", "calendar.events", "gmail.send"],
  slack: ["chat:write", "channels:read", "files:write", "users:read"],
  gmail: ["gmail.send", "gmail.modify", "gmail.labels"],
  trustlayer: ["certificates.read", "subcontractors.read", "compliance.write"],
  mycoi: ["coi.read", "coi.subscribe", "vendors.read"],
  siteline: ["billing.read", "draws.read", "invoices.read"],
  gcpay: ["billing.read", "draws.write", "lien_waivers.read"],
  trimble: ["payroll.read", "payments.read", "vendors.read"],
  ceridian: ["employees.read", "timesheets.read", "payroll.read"],
  agave: ["multi_provider.read", "webhooks.subscribe"],
  workato: ["recipes.read", "connections.read"],
  built: ["draws.read", "lender_data.read", "payments.read"],
};

// ── The gallery catalog ─────────────────────────────────────────
const CATALOG = [
  // ─── WORKING TODAY ───
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    desc: "Accept ACH and card payments for draws, selection upgrades, and invoices. Funds route directly to your bank account.",
    state: "connected",
    logo: <Logo text="S" bg="linear-gradient(135deg,#635bff,#4f46d6)" />,
    accent: "#635bff",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    desc: "Push approved draw requests as invoices, pull payment confirmations, and map SOV cost codes to your chart of accounts.",
    state: "connected",
    logo: <Logo text="QB" bg="linear-gradient(135deg,#2ca01c,#108a00)" />,
    accent: "#2ca01c",
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    desc: "Sync invoices, payments, and journal entries with Xero. Same capabilities as QuickBooks for teams already on Xero.",
    state: "available",
    logo: <Logo text="X" bg="linear-gradient(135deg,#13b5ea,#0d9dd5)" />,
    accent: "#13b5ea",
    sandboxNote: "Sandbox-ready · Production sync requires Xero app review.",
  },
  {
    id: "sage",
    name: "Sage Business Cloud",
    category: "accounting",
    desc: "Sync billing data with Sage Business Cloud Accounting. Invoices, payments, and journal entries flow automatically.",
    state: "available",
    logo: <Logo text="Sg" bg="linear-gradient(135deg,#00d639,#00b62f)" fz={14} />,
    accent: "#00d639",
    sandboxNote: "Sandbox-ready · Production sync requires Sage app review.",
  },

  // ─── COMING SOON — gated ───
  {
    id: "procore",
    name: "Procore",
    category: "pm",
    desc: "Two-way sync of projects, RFIs, submittals, and drawings between BuiltCRM and Procore for joint-venture workflows.",
    state: "soon",
    logo: <Logo text="Pc" bg="linear-gradient(135deg,#f47920,#e35f00)" fz={14} />,
    accent: "#f47920",
    gateReason: "Procore App Marketplace partner application",
  },
  {
    id: "autodesk",
    name: "Autodesk Construction Cloud",
    category: "pm",
    desc: "Pull drawings, sheets, and BIM 360 issues into BuiltCRM. Push RFIs and change orders back to ACC.",
    state: "soon",
    logo: <Logo text="Ad" bg="linear-gradient(135deg,#0696d7,#005ea6)" fz={14} />,
    accent: "#0696d7",
    gateReason: "Autodesk Forge developer agreement",
  },
  {
    id: "bluebeam",
    name: "Bluebeam Studio Prime",
    category: "documents",
    desc: "Sync Studio sessions and markup state into the project document library. Track who reviewed what.",
    state: "soon",
    logo: <Logo text="Bb" bg="linear-gradient(135deg,#0066b3,#004580)" fz={14} />,
    accent: "#0066b3",
    gateReason: "Bluebeam Studio Prime API access",
  },
  {
    id: "docusign",
    name: "DocuSign",
    category: "documents",
    desc: "Send change orders, contracts, and lien waivers for e-signature. Status syncs back automatically.",
    state: "soon",
    logo: <Logo text="DS" bg="linear-gradient(135deg,#fcb53b,#dc8a14)" fz={14} />,
    accent: "#fcb53b",
    gateReason: "DocuSign ISV partnership",
  },
  {
    id: "ms365",
    name: "Microsoft 365",
    category: "comms",
    desc: "OneDrive document attach, Outlook calendar sync, and Teams meeting links on project events.",
    state: "soon",
    logo: <Logo text="M" bg="linear-gradient(135deg,#0078d4,#005a9e)" />,
    accent: "#0078d4",
    gateReason: "Microsoft Graph app verification",
  },
  {
    id: "gws",
    name: "Google Workspace",
    category: "comms",
    desc: "Drive document attach, Calendar two-way sync for project events, and Gmail outbound delivery.",
    state: "soon",
    logo: <Logo text="G" bg="linear-gradient(135deg,#4285f4,#1a73e8)" />,
    accent: "#4285f4",
    gateReason: "Google OAuth app verification",
  },
  {
    id: "slack",
    name: "Slack",
    category: "comms",
    desc: "Route RFIs, change orders, and approval requests into Slack channels. Reply from Slack to update BuiltCRM.",
    state: "soon",
    logo: <Logo text="Sl" bg="linear-gradient(135deg,#611f69,#4a154b)" fz={14} />,
    accent: "#611f69",
    gateReason: "Slack App Directory listing",
  },
  {
    id: "gmail",
    name: "Gmail (Enhanced)",
    category: "comms",
    desc: "Native Gmail thread linking — every project gets a unique reply-to address that lands messages directly in BuiltCRM.",
    state: "soon",
    logo: <Logo text="Gm" bg="linear-gradient(135deg,#ea4335,#c5221f)" fz={14} />,
    accent: "#ea4335",
    gateReason: "Google Gmail API restricted scope review",
  },
  {
    id: "trustlayer",
    name: "TrustLayer",
    category: "compliance",
    desc: "Continuous COI verification for subcontractors. Auto-flag expired insurance and missing endorsements.",
    state: "soon",
    logo: <Logo text="TL" bg="linear-gradient(135deg,#0ea5e9,#0369a1)" fz={14} />,
    accent: "#0ea5e9",
    gateReason: "TrustLayer partner program",
  },
  {
    id: "mycoi",
    name: "myCOI",
    category: "compliance",
    desc: "Subscribe to subcontractor COI updates. Insurance changes flow into BuiltCRM compliance records.",
    state: "soon",
    logo: <Logo text="mC" bg="linear-gradient(135deg,#0d9488,#115e59)" fz={14} />,
    accent: "#0d9488",
    gateReason: "myCOI partner data feed",
  },
  {
    id: "siteline",
    name: "Siteline",
    category: "accounting",
    desc: "Specialty contractor billing — sync schedules of values and draw packages with Siteline workflows.",
    state: "soon",
    logo: <Logo text="St" bg="linear-gradient(135deg,#7c3aed,#5b21b6)" fz={14} />,
    accent: "#7c3aed",
    gateReason: "Siteline partnership",
  },
  {
    id: "gcpay",
    name: "GCPay",
    category: "payments",
    desc: "Pay subcontractors with automated lien-waiver collection on every payment. Reduce paperwork on draws.",
    state: "soon",
    logo: <Logo text="GP" bg="linear-gradient(135deg,#16a34a,#15803d)" fz={14} />,
    accent: "#16a34a",
    gateReason: "GCPay integration agreement",
  },
  {
    id: "trimble",
    name: "Trimble Pay",
    category: "payments",
    desc: "Cross-border payments and integrated subcontractor payment workflows for Trimble customers.",
    state: "soon",
    logo: <Logo text="Tr" bg="linear-gradient(135deg,#005f86,#003e58)" fz={14} />,
    accent: "#005f86",
    gateReason: "Trimble developer program",
  },
  {
    id: "ceridian",
    name: "Ceridian Dayforce",
    category: "payroll",
    desc: "Sync field-labor hours from BuiltCRM time tracking into Dayforce for payroll processing.",
    state: "soon",
    logo: <Logo text="Cd" bg="linear-gradient(135deg,#d97706,#b45309)" fz={14} />,
    accent: "#d97706",
    gateReason: "Ceridian Dayforce API certification",
  },
  {
    id: "agave",
    name: "Agave",
    category: "pm",
    desc: "Unified API gateway across construction tools. One integration to reach Procore, Autodesk, Sage, and more.",
    state: "soon",
    logo: <Logo text="Ag" bg="linear-gradient(135deg,#84cc16,#4d7c0f)" fz={14} />,
    accent: "#84cc16",
    gateReason: "Agave API key tier upgrade",
  },
  {
    id: "workato",
    name: "Workato",
    category: "pm",
    desc: "No-code automation across BuiltCRM, your CRM, ERP, and warehouse systems. Build custom workflows visually.",
    state: "soon",
    logo: <Logo text="Wk" bg="linear-gradient(135deg,#ef4444,#b91c1c)" fz={14} />,
    accent: "#ef4444",
    gateReason: "Workato Connector SDK partnership",
  },
  {
    id: "built",
    name: "Built Technologies",
    category: "lending",
    desc: "Construction loan administration sync — push draw packages directly to your construction lender for funding.",
    state: "soon",
    logo: <Logo text="Bt" bg="linear-gradient(135deg,#1e40af,#1e3a8a)" fz={14} />,
    accent: "#1e40af",
    gateReason: "Built Technologies partner program",
  },
];

const STATE_META = {
  connected: { label: "Connected", bg: "var(--success-soft)", fg: "var(--success-text)", border: "#a7d9be", dot: "var(--success)" },
  available: { label: "Available", bg: "var(--accent-soft)", fg: "var(--accent-text)", border: "var(--accent-muted)", dot: "var(--accent)" },
  soon:      { label: "Coming soon", bg: "var(--surface-2)", fg: "var(--text-tertiary)", border: "var(--surface-3)", dot: "var(--surface-4)" },
};

export default function IntegrationGallery() {
  const [mode, setMode] = useState("portal"); // "portal" | "public"
  const [dark, setDark] = useState(false);
  const [category, setCategory] = useState("all");
  const [showOnlySoon, setShowOnlySoon] = useState(false);
  const [search, setSearch] = useState("");
  const [consent, setConsent] = useState(null); // currently-open consent provider

  const filtered = CATALOG.filter((c) => {
    if (category !== "all" && c.category !== category) return false;
    if (showOnlySoon && c.state !== "soon") return false;
    if (search) {
      const s = search.toLowerCase();
      if (!c.name.toLowerCase().includes(s) && !c.desc.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const counts = {
    all: CATALOG.length,
    connected: CATALOG.filter((c) => c.state === "connected").length,
    available: CATALOG.filter((c) => c.state === "available").length,
    soon: CATALOG.filter((c) => c.state === "soon").length,
  };
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat.id === "all" ? CATALOG.length : CATALOG.filter((c) => c.category === cat.id).length;
    return acc;
  }, {});

  return (
    <div style={tokens(dark)}>
      {/* ═══════ MODE TOGGLE (prototype-only switcher) ═══════ */}
      <ModeBar mode={mode} setMode={setMode} />

      {mode === "portal" ? (
        <PortalShell dark={dark} setDark={setDark}>
          <GalleryBody
            mode="portal" dark={dark}
            search={search} setSearch={setSearch}
            category={category} setCategory={setCategory}
            categoryCounts={categoryCounts} counts={counts}
            showOnlySoon={showOnlySoon} setShowOnlySoon={setShowOnlySoon}
            filtered={filtered} setConsent={setConsent}
          />
        </PortalShell>
      ) : (
        <PublicShell>
          <GalleryBody
            mode="public" dark={false}
            search={search} setSearch={setSearch}
            category={category} setCategory={setCategory}
            categoryCounts={categoryCounts} counts={counts}
            showOnlySoon={showOnlySoon} setShowOnlySoon={setShowOnlySoon}
            filtered={filtered} setConsent={setConsent}
          />
        </PublicShell>
      )}

      {/* ═══════ CONSENT MOCKUP MODAL ═══════ */}
      {consent && <ConsentModal provider={consent} onClose={() => setConsent(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Tokens (CSS variables for the whole tree)
   ═══════════════════════════════════════════════════════════════ */
function tokens(dark) {
  return {
    "--surface-0": dark ? "#111015" : "#eef0f3",
    "--surface-1": dark ? "#1a191e" : "#ffffff",
    "--surface-2": dark ? "#232228" : "#f3f4f6",
    "--surface-3": dark ? "#2e2d33" : "#e2e5e9",
    "--surface-4": dark ? "#3d3c44" : "#d1d5db",
    "--surface-hover": dark ? "#27262c" : "#f5f6f8",
    "--sidebar-bg": dark ? "#16151a" : "#ffffff",
    "--sidebar-border": dark ? "#2a2930" : "#e8eaee",
    "--text-primary": dark ? "#eae9ed" : "#1a1714",
    "--text-secondary": dark ? "#9e9ba5" : "#6b655b",
    "--text-tertiary": dark ? "#6b6874" : "#9c958a",
    "--accent": "#5b4fc7",
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
    "--shadow-lg": dark ? "0 16px 48px rgba(0,0,0,.55)" : "0 16px 48px rgba(26,23,20,.18)",
    fontFamily: F.body,
    background: "var(--surface-0)",
    color: "var(--text-primary)",
    WebkitFontSmoothing: "antialiased",
    minHeight: "100vh",
    position: "relative",
  };
}

/* ═══════════════════════════════════════════════════════════════
   Mode toggle bar (prototype demonstration aid only)
   ═══════════════════════════════════════════════════════════════ */
function ModeBar({ mode, setMode }) {
  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: "rgba(20,18,24,.9)", color: "white", padding: 4, borderRadius: 999, display: "flex", gap: 2, fontFamily: F.display, fontSize: 11, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.25)", backdropFilter: "blur(8px)" }}>
      <span style={{ padding: "4px 10px 4px 12px", color: "rgba(255,255,255,.5)" }}>VIEW</span>
      {[["portal", "Contractor portal"], ["public", "Public marketing"]].map(([k, l]) => (
        <button key={k} onClick={() => setMode(k)} style={{ height: 26, padding: "0 12px", borderRadius: 999, background: mode === k ? "white" : "transparent", color: mode === k ? "#1a1714" : "rgba(255,255,255,.7)", border: "none", cursor: "pointer", fontFamily: F.display, fontSize: 11, fontWeight: 650 }}>{l}</button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Portal shell — full app chrome (sidebar + topbar)
   ═══════════════════════════════════════════════════════════════ */
function PortalShell({ children, dark, setDark }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderBottom: "1px solid var(--sidebar-border)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: dark ? "linear-gradient(135deg,#6b63d6,#b4adf0)" : "linear-gradient(135deg,#2c2541,#5b4fc7)", color: dark ? "#1a1714" : "#faf9f7", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 12, fontWeight: 700 }}>B</div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, letterSpacing: "-.02em" }}>BuiltCRM</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Pearson Construction</div>
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 10px 20px" }}>
          {[
            { sec: "Workspace", items: [["Dashboard"], ["Projects"], ["Approvals", "4"], ["Messages", "8"]] },
            { sec: "Operations", items: [["Subcontractors"], ["Compliance"], ["Documents"], ["Schedule"]] },
            { sec: "Platform", items: [["Integrations", null, true], ["Reports"], ["Settings"]] },
          ].map((g, gi) => (
            <div key={gi} style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".06em", padding: "10px 10px 6px" }}>{g.sec}</div>
              {g.items.map(([label, badge, active], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 10, fontSize: 13, fontWeight: active ? 650 : 520, color: active ? "var(--accent-text)" : "var(--text-secondary)", background: active ? "var(--accent-soft)" : "transparent", marginBottom: 2, cursor: "pointer", position: "relative" }}>
                  {active && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, borderRadius: "0 3px 3px 0", background: "var(--accent)" }}/>}
                  <span>{label}</span>
                  {badge && <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-text)", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: F.display }}>{badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid var(--sidebar-border)", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-muted))", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 11, fontWeight: 700 }}>DP</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 580 }}>Daniel Pearson</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Org Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--surface-3)", background: dark ? "rgba(26,25,30,.88)" : "rgba(255,255,255,.88)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-tertiary)" }}>
            <span>Platform</span>
            <span style={{ color: "var(--surface-4)" }}>/</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 650 }}>Integrations</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setDark(!dark)} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", display: "grid", placeItems: "center", color: "var(--text-tertiary)", cursor: "pointer" }}>
              <span style={{ width: 16, height: 16, display: "block" }}>{dark ? I.sun : I.moon}</span>
            </button>
            <button style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", display: "grid", placeItems: "center", color: "var(--text-tertiary)", cursor: "pointer", position: "relative" }}>
              <span style={{ width: 16, height: 16, display: "block" }}>{I.bell}</span>
              <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "var(--danger)", border: "2px solid var(--surface-1)" }}/>
            </button>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 12, fontWeight: 700 }}>DP</div>
          </div>
        </header>
        <div style={{ padding: 24, flex: 1, maxWidth: 1280, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Public shell — marketing chrome
   ═══════════════════════════════════════════════════════════════ */
function PublicShell({ children }) {
  return (
    <div style={{ background: "#faf9f7", color: "#1a1714", minHeight: "100vh" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,249,247,.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid #eeece8" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "0 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#2c2541,#5b4fc7)", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 12, fontWeight: 700 }}>B</div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 780, letterSpacing: "-.04em" }}>BuiltCRM</div>
            </div>
            <nav style={{ display: "flex", gap: 4 }}>
              {[["Product", false], ["Solutions", false], ["Pricing", false], ["Integrations", true], ["Resources", false]].map(([l, active]) => (
                <a key={l} style={{ padding: "8px 12px", fontSize: 13, fontWeight: active ? 650 : 540, color: active ? "#1a1714" : "#5e5850", borderRadius: 8, cursor: "pointer", textDecoration: "none" }}>{l}</a>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{ height: 34, padding: "0 14px", fontSize: 12.5, fontWeight: 600, color: "#5e5850", background: "transparent", border: "none", cursor: "pointer", fontFamily: F.display }}>Log in</button>
            <button style={{ height: 34, padding: "0 14px", fontSize: 12.5, fontWeight: 650, color: "white", background: "#5b4fc7", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F.display }}>
              Start free trial <span style={{ width: 12, height: 12, display: "block" }}>{I.arrow}</span>
            </button>
          </div>
        </div>
      </header>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 80px" }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Gallery body — used by both shells
   ═══════════════════════════════════════════════════════════════ */
function GalleryBody({ mode, dark, search, setSearch, category, setCategory, categoryCounts, counts, showOnlySoon, setShowOnlySoon, filtered, setConsent }) {
  const isPublic = mode === "public";

  return (
    <div>
      {/* ═══ Header ═══ */}
      <div style={{ marginBottom: 28 }}>
        {isPublic && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 8px", background: "#eeedfb", border: "1px solid rgba(91,79,199,.12)", borderRadius: 999, fontSize: 11.5, fontWeight: 620, color: "#4a3fb0", marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5b4fc7" }}/>
            Integrations
          </div>
        )}
        <h1 style={{
          fontFamily: F.display,
          fontSize: isPublic ? 42 : 26,
          fontWeight: isPublic ? 820 : 780,
          letterSpacing: "-.04em",
          margin: 0, lineHeight: 1.1,
          color: isPublic ? "#1a1714" : "var(--text-primary)",
        }}>
          {isPublic ? "Built to fit the tools you already use" : "Integrations"}
        </h1>
        <p style={{
          fontSize: isPublic ? 16 : 13,
          color: isPublic ? "#5e5850" : "var(--text-secondary)",
          marginTop: isPublic ? 12 : 6,
          maxWidth: 680, fontWeight: 520, lineHeight: 1.55,
        }}>
          {isPublic
            ? "BuiltCRM connects with the accounting, payment, document, and project-management tools your team relies on. Live integrations are ready today; partner-gated providers ship as we complete app reviews."
            : "Browse the full ecosystem. Connected and Available providers are ready to wire up; Coming-soon providers are partner-gated and notify you when the integration ships."}
        </p>

        {/* Stat strip — only on public */}
        {isPublic && (
          <div style={{ display: "flex", gap: 24, marginTop: 28, paddingTop: 24, borderTop: "1px solid #eeece8" }}>
            {[
              { k: "Live integrations", v: counts.connected + counts.available },
              { k: "On the roadmap", v: counts.soon },
              { k: "Categories covered", v: CATEGORIES.length - 1 },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 820, letterSpacing: "-.03em", color: "#5b4fc7" }}>{s.v}</div>
                <div style={{ fontSize: 12, color: "#928b80", fontWeight: 580, marginTop: 2 }}>{s.k}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Toolbar: search + category chips ═══ */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: isPublic ? "#928b80" : "var(--text-tertiary)" }}>{I.search}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or capability…"
            style={{
              width: "100%", height: 38, padding: "0 12px 0 36px", borderRadius: 10,
              border: `1px solid ${isPublic ? "#eeece8" : "var(--surface-3)"}`,
              background: isPublic ? "#fff" : "var(--surface-1)",
              color: isPublic ? "#1a1714" : "var(--text-primary)",
              fontSize: 13, fontFamily: F.body, fontWeight: 520,
              boxSizing: "border-box", outline: "none",
            }}
          />
        </div>
        <button
          onClick={() => setShowOnlySoon(!showOnlySoon)}
          style={{
            height: 38, padding: "0 14px", borderRadius: 10,
            border: `1px solid ${showOnlySoon ? "var(--accent)" : (isPublic ? "#eeece8" : "var(--surface-3)")}`,
            background: showOnlySoon ? "var(--accent-soft)" : (isPublic ? "#fff" : "var(--surface-1)"),
            color: showOnlySoon ? "var(--accent-text)" : (isPublic ? "#5e5850" : "var(--text-secondary)"),
            fontSize: 12.5, fontWeight: 620, cursor: "pointer", fontFamily: F.display,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ width: 12, height: 12, display: "block" }}>{I.filter}</span>
          Coming soon only
          {showOnlySoon && (
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--accent)", color: "white", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 800 }}>{counts.soon}</span>
          )}
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: isPublic ? "#928b80" : "var(--text-tertiary)", fontWeight: 520 }}>
          Showing {filtered.length} of {CATALOG.length}
        </div>
      </div>

      {/* Category chip rail */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => {
          const isSel = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                height: 32, padding: "0 12px", borderRadius: 999,
                border: `1px solid ${isSel ? "var(--accent)" : (isPublic ? "#eeece8" : "var(--surface-3)")}`,
                background: isSel ? "var(--accent)" : (isPublic ? "#fff" : "var(--surface-1)"),
                color: isSel ? "white" : (isPublic ? "#5e5850" : "var(--text-secondary)"),
                fontSize: 12, fontWeight: isSel ? 650 : 580, cursor: "pointer",
                fontFamily: F.display, display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {cat.label}
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                background: isSel ? "rgba(255,255,255,.22)" : (isPublic ? "#f3f1ec" : "var(--surface-2)"),
                color: isSel ? "white" : (isPublic ? "#928b80" : "var(--text-tertiary)"),
                fontFamily: F.display,
              }}>{categoryCounts[cat.id]}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ Card grid ═══ */}
      {filtered.length === 0 ? (
        <div style={{ padding: "80px 24px", textAlign: "center", border: `2px dashed ${isPublic ? "#eeece8" : "var(--surface-3)"}`, borderRadius: 16 }}>
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No integrations match</div>
          <div style={{ fontSize: 13, color: isPublic ? "#928b80" : "var(--text-tertiary)", fontWeight: 520 }}>Try clearing the search or selecting a different category.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 14 }}>
          {filtered.map((p) => (
            <IntegrationCard
              key={p.id}
              p={p}
              isPublic={isPublic}
              onComingSoon={() => setConsent(p)}
            />
          ))}
        </div>
      )}

      {/* ═══ Footer note ═══ */}
      <div style={{ marginTop: 36, padding: 16, border: `1px solid ${isPublic ? "#eeece8" : "var(--surface-3)"}`, borderRadius: 12, background: isPublic ? "#fff" : "var(--surface-1)", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 18, height: 18, color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>{I.shield}</div>
        <div style={{ fontSize: 12.5, color: isPublic ? "#5e5850" : "var(--text-secondary)", fontWeight: 520, lineHeight: 1.55 }}>
          <b style={{ color: isPublic ? "#1a1714" : "var(--text-primary)", fontWeight: 680 }}>Don't see what you need?</b> Use our public REST API or webhook subscriptions to wire up anything. <a style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Read API docs →</a>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Card
   ═══════════════════════════════════════════════════════════════ */
function IntegrationCard({ p, isPublic, onComingSoon }) {
  const meta = STATE_META[p.state];
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const isSoon = p.state === "soon";
  const isConnected = p.state === "connected";

  const cardBg = isPublic ? "#fff" : "var(--surface-1)";
  const cardBorder = isPublic
    ? (isConnected ? "#c7c2ea" : "#eeece8")
    : (isConnected ? "var(--accent-muted)" : "var(--surface-3)");

  return (
    <div style={{
      position: "relative",
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 16,
      padding: 18,
      display: "flex", flexDirection: "column", gap: 12,
      transition: "all 200ms",
      overflow: "hidden",
    }}>
      {/* Connected accent stripe */}
      {isConnected && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, var(--accent), var(--accent-muted))` }}/>
      )}

      {/* Header row: logo + status pill */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        {p.logo}
        <span style={{
          height: 22, padding: "0 9px", borderRadius: 999,
          border: `1px solid ${meta.border}`, background: meta.bg, color: meta.fg,
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 10, fontWeight: 720, fontFamily: F.display,
          textTransform: "uppercase", letterSpacing: ".02em",
          flexShrink: 0,
        }}>
          {isSoon ? <span style={{ width: 8, height: 8 }}>{I.lock}</span> : <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot }}/>}
          {meta.label}
        </span>
      </div>

      {/* Name + category badge */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 15, fontWeight: 720, letterSpacing: "-.015em", margin: 0, color: isPublic ? "#1a1714" : "var(--text-primary)" }}>{p.name}</h3>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: isPublic ? "#f3f1ec" : "var(--surface-2)", color: isPublic ? "#5e5850" : "var(--text-tertiary)", fontFamily: F.display, textTransform: "uppercase", letterSpacing: ".04em" }}>
          {cat.label}
        </span>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12.5, color: isPublic ? "#5e5850" : "var(--text-secondary)", lineHeight: 1.55, fontWeight: 520, flex: 1 }}>
        {p.desc}
      </div>

      {/* Sandbox note for available accounting providers */}
      {p.sandboxNote && (
        <div style={{ fontSize: 11, color: isPublic ? "#928b80" : "var(--text-tertiary)", fontWeight: 520, padding: "6px 8px", background: isPublic ? "#f9f7f2" : "var(--surface-2)", borderRadius: 6, border: `1px dashed ${isPublic ? "#eeece8" : "var(--surface-3)"}` }}>
          {p.sandboxNote}
        </div>
      )}

      {/* Footer / CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        {isConnected && (
          <button style={{
            height: 32, padding: "0 12px", borderRadius: 8,
            border: `1px solid ${isPublic ? "#eeece8" : "var(--surface-3)"}`,
            background: isPublic ? "#fff" : "var(--surface-1)",
            color: isPublic ? "#1a1714" : "var(--text-primary)",
            fontSize: 12, fontWeight: 620, cursor: "pointer", fontFamily: F.display,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 12, height: 12, display: "block" }}>{I.cog}</span>
            Manage
          </button>
        )}
        {p.state === "available" && (
          <button
            disabled={isPublic}
            style={{
              height: 32, padding: "0 14px", borderRadius: 8, border: "none",
              background: isPublic ? "#e2e5e9" : "var(--accent)",
              color: isPublic ? "#928b80" : "white",
              fontSize: 12, fontWeight: 650,
              cursor: isPublic ? "not-allowed" : "pointer",
              fontFamily: F.display,
              display: "inline-flex", alignItems: "center", gap: 6,
              opacity: isPublic ? 0.7 : 1,
            }}
          >
            {isPublic ? "Sign in to connect" : "Connect"}
            {!isPublic && <span style={{ width: 12, height: 12, display: "block" }}>{I.arrow}</span>}
          </button>
        )}
        {isSoon && (
          <button
            onClick={onComingSoon}
            style={{
              height: 32, padding: "0 12px", borderRadius: 8,
              border: `1px solid ${isPublic ? "#eeece8" : "var(--surface-3)"}`,
              background: isPublic ? "#fff" : "var(--surface-1)",
              color: isPublic ? "#5e5850" : "var(--text-secondary)",
              fontSize: 12, fontWeight: 620, cursor: "pointer", fontFamily: F.display,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            Request access
            <span style={{ width: 12, height: 12, display: "block" }}>{I.arrow}</span>
          </button>
        )}
        <div style={{ marginLeft: "auto", fontSize: 10.5, color: isPublic ? "#928b80" : "var(--text-tertiary)", fontWeight: 600, fontFamily: F.mono, letterSpacing: ".02em" }}>
          {p.id}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Consent mockup modal — for "Coming soon" providers
   ═══════════════════════════════════════════════════════════════ */
function ConsentModal({ provider, onClose }) {
  const scopes = SCOPES[provider.id] || ["account.read"];
  const [notify, setNotify] = useState(false);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,18,24,.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 200, padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540, maxHeight: "90vh", overflowY: "auto",
          background: "var(--surface-1)", borderRadius: 18,
          boxShadow: "var(--shadow-lg)", border: "1px solid var(--surface-3)",
          color: "var(--text-primary)",
        }}
      >
        {/* Header — mimics an OAuth consent screen */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--surface-3)", background: "var(--surface-2)", borderRadius: "18px 18px 0 0", position: "relative" }}>
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "grid", placeItems: "center" }}
          >
            <span style={{ width: 14, height: 14, display: "block" }}>{I.x}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", marginBottom: 16 }}>
            <Logo text="B" bg="linear-gradient(135deg,#2c2541,#5b4fc7)" size={48} br={14} fz={18} />
            <div style={{ display: "flex", gap: 6, color: "var(--text-tertiary)" }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }}/>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }}/>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }}/>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", flexShrink: 0, fontFamily: F.display, fontSize: 18, fontWeight: 800, background: provider.accent, color: "white" }}>
              {provider.id.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 720, letterSpacing: "-.02em", margin: 0, textAlign: "center", lineHeight: 1.3 }}>
            BuiltCRM wants to connect to your {provider.name} account
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6, fontWeight: 520, textAlign: "center" }}>
            Preview of the consent screen you'll see when this integration ships
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 720, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            BuiltCRM will be able to
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
            {scopes.map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--surface-3)", borderRadius: 10, background: "var(--surface-1)" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--success-soft)", color: "var(--success-text)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <span style={{ width: 12, height: 12, display: "block" }}>{I.check}</span>
                </div>
                <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 520, color: "var(--text-primary)" }}>{s}</span>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 580, fontFamily: F.display }}>
                  {scopeLabel(s)}
                </span>
              </div>
            ))}
          </div>

          {/* Gating notice */}
          <div style={{ background: "var(--warning-soft)", border: "1px solid #f5d6a0", borderRadius: 12, padding: "14px 16px", marginBottom: 18, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 18, height: 18, color: "var(--warning-text)", flexShrink: 0, marginTop: 1 }}>{I.lock}</div>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: "var(--warning-text)", marginBottom: 4 }}>This integration isn't ready yet</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 520, lineHeight: 1.55 }}>
                Production integration with {provider.name} requires <b style={{ color: "var(--text-primary)" }}>{provider.gateReason}</b>. We're working on it. Sign up below and we'll email you the moment it goes live.
              </div>
            </div>
          </div>

          {/* Notify toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: `1px solid ${notify ? "var(--accent)" : "var(--surface-3)"}`, borderRadius: 12, background: notify ? "var(--accent-soft)" : "var(--surface-1)", cursor: "pointer", marginBottom: 18 }}>
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 650 }}>Notify me when this is available</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 520, marginTop: 2 }}>One email when {provider.name} ships. We won't send marketing.</div>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--surface-3)", background: "var(--surface-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderRadius: "0 0 18px 18px" }}>
          <button
            style={{ height: 36, padding: "0 6px", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-tertiary)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: F.display }}
          >
            View {provider.name} site
            <span style={{ width: 11, height: 11, display: "block" }}>{I.ext}</span>
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 620, cursor: "pointer", fontFamily: F.display }}>Close</button>
            <button
              onClick={onClose}
              disabled={!notify}
              style={{
                height: 36, padding: "0 18px", borderRadius: 10, border: "none",
                background: notify ? "var(--accent)" : "var(--surface-3)",
                color: "white", fontSize: 12, fontWeight: 650,
                cursor: notify ? "pointer" : "not-allowed",
                fontFamily: F.display, opacity: notify ? 1 : 0.6,
              }}
            >
              Notify me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Map raw scope strings to friendlier labels for the consent screen.
function scopeLabel(s) {
  if (s.endsWith(".read")) return "Read access";
  if (s.endsWith(".write")) return "Write access";
  if (s.includes("subscribe")) return "Subscribe";
  if (s.includes("send")) return "Send";
  if (s === "openid" || s === "email") return "Identity";
  return "Access";
}
