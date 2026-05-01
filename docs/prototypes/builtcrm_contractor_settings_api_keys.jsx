import { useState } from "react";

/*
 * STEP 58 — PER-ORG API KEY MANAGEMENT
 * ─────────────────────────────────────
 * Contractor settings sub-page for generating, viewing, and revoking
 * API keys scoped to an organization. Authenticates programmatic access
 * to BuiltCRM's REST API (Step 60 documents the API itself).
 *
 * Build target: src/app/(portal)/contractor/(global)/settings/api-keys/page.tsx
 * Mode: Require-design-input — this prototype IS the design.
 *
 * Schema (from Phase 4+ build guide Step 58):
 *   api_keys { id, orgId, keyPrefix, keyHash, name, createdByUserId,
 *              createdAt, lastUsedAt?, revokedAt?, scopes[] }
 *   Key format: bcrm_live_ + 32 random base62 chars
 *   Scopes: read | write | admin (coarse, intentional)
 *
 * UX pillars:
 *   1. One-time reveal — full key shown ONCE on creation, then prefix only.
 *   2. Scope clarity — read/write/admin colored as a privilege gradient.
 *   3. Audit trail — every create/revoke/use(sampled) lands in audit_events.
 *   4. Safe revoke — confirmation modal explains immediate 401 impact.
 *   5. Admin-only — non-admins land on a "Contact your org admin" empty state.
 */

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

// ── Icons ───────────────────────────────────────────────────────
const I = {
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.5 9.5M15.5 7.5l3 3"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  zap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z"/></svg>,
  more: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/></svg>,
  rotate: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ── Sidebar nav (shared with other settings pages) ──────────────
const SETTINGS_NAV = [
  { section: "Organization", items: [
    { label: "General" },
    { label: "Team members" },
    { label: "Roles & permissions" },
    { label: "Billing & plan", pill: "Professional", pillColor: "accent" },
  ]},
  { section: "Connections", items: [
    { label: "Integrations", pill: "2 active", pillColor: "success" },
    { label: "Payments" },
    { label: "Webhooks", pill: "Enterprise", pillColor: "gray" },
    { label: "API keys", id: "api-keys", pill: "Pro+", pillColor: "accent" },
  ]},
  { section: "Data", items: [{ label: "Import / migrate" }, { label: "Export" }] },
  { section: "Security", items: [
    { label: "Authentication" },
    { label: "SSO / SAML", pill: "Enterprise", pillColor: "gray" },
    { label: "Audit log" },
  ]},
  { section: "Preferences", items: [{ label: "Notifications" }, { label: "Email templates" }, { label: "Calendar sync" }] },
];

// ── Sample API key data ─────────────────────────────────────────
const KEYS = [
  {
    id: "key_01HVAB", name: "CI/CD Pipeline", prefix: "bcrm_live_a3f8e2c1",
    scopes: ["admin"], createdBy: "Daniel Pearson", createdByInit: "DP",
    createdAt: "Jan 18, 2026", lastUsed: "14 min ago", lastUsedRel: "live",
    usage30d: 8114, status: "active",
  },
  {
    id: "key_01HVAC", name: "QuickBooks middleware", prefix: "bcrm_live_77c20d4b",
    scopes: ["write"], createdBy: "Daniel Pearson", createdByInit: "DP",
    createdAt: "Mar 02, 2026", lastUsed: "Yesterday · 4:18 PM", lastUsedRel: "recent",
    usage30d: 2407, status: "active",
  },
  {
    id: "key_01HVAD", name: "Reporting dashboard", prefix: "bcrm_live_91be7a05",
    scopes: ["read"], createdBy: "Maria Lopez", createdByInit: "ML",
    createdAt: "Apr 02, 2026", lastUsed: "1h ago", lastUsedRel: "live",
    usage30d: 3766, status: "active",
  },
  {
    id: "key_01HVAE", name: "Old Zapier connector", prefix: "bcrm_live_2ddf9a18",
    scopes: ["write"], createdBy: "Daniel Pearson", createdByInit: "DP",
    createdAt: "Nov 14, 2025", lastUsed: "Apr 7", lastUsedRel: "old",
    usage30d: 0, status: "revoked", revokedAt: "Apr 8, 2026",
    revokedBy: "Daniel Pearson",
  },
  {
    id: "key_01HVAF", name: "Test integration (Postman)", prefix: "bcrm_live_eeaa50f3",
    scopes: ["read"], createdBy: "Daniel Pearson", createdByInit: "DP",
    createdAt: "Sep 30, 2025", lastUsed: "Mar 11", lastUsedRel: "old",
    usage30d: 0, status: "revoked", revokedAt: "Mar 12, 2026",
    revokedBy: "Daniel Pearson",
  },
];

// ── Usage stats (last 30 days) ──────────────────────────────────
const STATS = [
  { label: "Total requests", value: "14,287", meta: "Last 30 days · +12% vs prior", type: "primary" },
  { label: "Top endpoint", value: "GET /projects", meta: "3,910 calls · 27% of traffic", type: "default" },
  { label: "Avg response time", value: "184ms", meta: "p95: 412ms · within SLA", type: "success" },
  { label: "Failed auth (24h)", value: "0", meta: "No revoked-key attempts", type: "success" },
];

// ── Recent audit events ─────────────────────────────────────────
const AUDIT = [
  { kind: "used", title: "API request — CI/CD Pipeline", desc: "POST /api/v1/draws · 200 · 94ms · scope: admin", time: "14 min ago", actor: "DP" },
  { kind: "used", title: "API request — Reporting dashboard", desc: "GET /api/v1/projects?limit=50 · 200 · 102ms · scope: read", time: "1h ago", actor: "ML" },
  { kind: "created", title: "API key created — Reporting dashboard", desc: "Scopes: read · Prefix: bcrm_live_91be7a05", time: "Apr 2, 2026 · 9:42 AM", actor: "ML" },
  { kind: "revoked", title: "API key revoked — Old Zapier connector", desc: "Reason: replaced by direct webhook subscription · All future calls return 401", time: "Apr 8, 2026 · 2:11 PM", actor: "DP" },
  { kind: "used", title: "API request — QuickBooks middleware", desc: "POST /api/v1/draws/45/sync · 200 · 318ms · scope: write", time: "Yesterday · 4:18 PM", actor: "DP" },
];

const SCOPE_COPY = {
  read: { label: "Read", desc: "List and fetch projects, draws, RFIs, documents. No mutations.", color: "info" },
  write: { label: "Write", desc: "Create and update projects, RFIs, change orders, draws, messages.", color: "accent" },
  admin: { label: "Admin", desc: "Everything in Write, plus org settings, member management, integrations.", color: "warning" },
};

export default function ContractorSettingsApiKeys() {
  const [dark, setDark] = useState(false);
  const [filter, setFilter] = useState("all");
  // Modal state: null | "create" | "reveal" | "revoke"
  const [modal, setModal] = useState(null);
  // Form state for create
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState(["read"]);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [copied, setCopied] = useState(false);

  const filteredKeys = KEYS.filter(k => {
    if (filter === "all") return true;
    if (filter === "active") return k.status === "active";
    if (filter === "revoked") return k.status === "revoked";
    return true;
  });

  const activeCount = KEYS.filter(k => k.status === "active").length;
  const revokedCount = KEYS.filter(k => k.status === "revoked").length;

  // Mock generated key for the reveal modal
  const generatedKey = "bcrm_live_8f3e2d4c9b1a7e5f6d2c8b4a3e9f1d7c";

  const openCreate = () => {
    setNewName("");
    setNewScopes(["read"]);
    setModal("create");
  };

  const submitCreate = () => {
    if (!newName.trim()) return;
    setCopied(false);
    setModal("reveal");
  };

  const closeReveal = () => {
    setModal(null);
    setCopied(false);
  };

  const openRevoke = (key) => {
    setRevokeTarget(key);
    setModal("revoke");
  };

  const toggleScope = (s) => {
    // Tiered exclusivity: admin includes write+read; write includes read.
    if (s === "admin") setNewScopes(["admin"]);
    else if (s === "write") setNewScopes(["read", "write"]);
    else setNewScopes(["read"]);
  };

  const currentScope = newScopes.includes("admin") ? "admin"
    : newScopes.includes("write") ? "write" : "read";

  return (
    <div style={{
      "--surface-0": dark ? "#111015" : "#eef0f3",
      "--surface-1": dark ? "#1a191e" : "#ffffff",
      "--surface-2": dark ? "#232228" : "#f3f4f6",
      "--surface-3": dark ? "#2e2d33" : "#e2e5e9",
      "--surface-4": dark ? "#3d3c44" : "#d1d5db",
      "--surface-hover": dark ? "#27262c" : "#f5f6f8",
      "--sidebar-bg": dark ? "#16151a" : "#ffffff",
      "--sidebar-hover": dark ? "#1f1e24" : "#f5f6f8",
      "--sidebar-border": dark ? "#2a2930" : "#e8eaee",
      "--text-primary": dark ? "#eae9ed" : "#1a1714",
      "--text-secondary": dark ? "#9e9ba5" : "#6b655b",
      "--text-tertiary": dark ? "#6b6874" : "#9c958a",
      "--accent": "#5b4fc7", "--accent-hover": "#4f44b3",
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
      display: "grid", gridTemplateColumns: "272px 1fr", minHeight: "100vh",
      fontFamily: F.body, background: "var(--surface-0)", color: "var(--text-primary)",
      WebkitFontSmoothing: "antialiased", position: "relative",
    }}>
      {/* ── SIDEBAR ── */}
      <aside style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderBottom: "1px solid var(--sidebar-border)", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: dark ? "linear-gradient(135deg,#6b63d6,#b4adf0)" : "linear-gradient(135deg,#2c2541,#5b4fc7)", color: dark ? "#1a1714" : "#faf9f7", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>B</div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, letterSpacing: "-.02em" }}>BuiltCRM</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Settings</div>
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 10px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, fontSize: 13, color: "var(--accent-text)", fontWeight: 600, marginBottom: 8, cursor: "pointer" }}>
            <span style={{ width: 14, height: 14, display: "block" }}>{I.back}</span>Back to dashboard
          </div>
          {SETTINGS_NAV.map((s, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".06em", padding: "10px 10px 6px" }}>{s.section}</div>
              {s.items.map((it, ii) => {
                const isActive = it.id === "api-keys";
                return (
                  <div key={ii} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 10, fontSize: 13, fontWeight: isActive ? 650 : 520, color: isActive ? "var(--accent-text)" : "var(--text-secondary)", background: isActive ? "var(--accent-soft)" : "transparent", marginBottom: 2, cursor: "pointer", position: "relative" }}>
                    {isActive && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, borderRadius: "0 3px 3px 0", background: "var(--accent)" }}/>}
                    <span>{it.label}</span>
                    {it.pill && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: F.display,
                        background: it.pillColor === "accent" ? "var(--accent-soft)" : it.pillColor === "success" ? "var(--success-soft)" : "var(--surface-2)",
                        color: it.pillColor === "accent" ? "var(--accent-text)" : it.pillColor === "success" ? "var(--success-text)" : "var(--text-tertiary)",
                      }}>{it.pill}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid var(--sidebar-border)", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-muted))", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 11, fontWeight: 700 }}>DP</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 580 }}>Daniel Pearson</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>Org Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--surface-3)", background: dark ? "rgba(26,25,30,.88)" : "rgba(255,255,255,.88)", backdropFilter: "blur(12px)", flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-tertiary)" }}>
            <span>Settings</span>
            <span style={{ color: "var(--surface-4)" }}>/</span>
            <span>Connections</span>
            <span style={{ color: "var(--surface-4)" }}>/</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 650 }}>API keys</span>
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
          {/* ═══════ PAGE HEADER ═══════ */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 780, letterSpacing: "-.035em", margin: 0 }}>API keys</h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, maxWidth: 640, fontWeight: 520 }}>
                Generate, rotate, and revoke API keys for programmatic access to BuiltCRM. Each key is scoped to your organization and shown in full only once at creation.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 620, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: F.display }}>
                <span style={{ width: 14, height: 14, display: "block" }}>{I.book}</span>
                Read API docs
              </button>
              <button onClick={openCreate} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "white", fontSize: 12, fontWeight: 650, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: F.display, boxShadow: "var(--shadow-sm)" }}>
                <span style={{ width: 14, height: 14, display: "block" }}>{I.plus}</span>
                Create new key
              </button>
            </div>
          </div>

          {/* ═══════ INFO BANNER ═══════ */}
          <div style={{ background: "var(--info-soft)", border: "1px solid #b3d4ee", borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 18, height: 18, color: "var(--info-text)", flexShrink: 0, marginTop: 1 }}>{I.shield}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 680, color: "var(--info-text)", marginBottom: 4 }}>How API keys work</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, fontWeight: 520 }}>
                Send keys as <span style={{ fontFamily: F.mono, fontSize: 11.5, padding: "1px 5px", borderRadius: 4, background: "var(--surface-1)", border: "1px solid var(--surface-3)" }}>Authorization: Bearer bcrm_live_…</span> on every request to <span style={{ fontFamily: F.mono, fontSize: 11.5 }}>/api/v1/*</span>. Revoked keys return 401 immediately on next call. Rate limit is 60 req/min, 1,000 req/hour per key. Test-mode keys (<span style={{ fontFamily: F.mono, fontSize: 11.5 }}>bcrm_test_</span>) are coming soon — only live keys are available today.
              </div>
            </div>
          </div>

          {/* ═══════ TAB FILTER ═══════ */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", borderRadius: 14, padding: 4, marginBottom: 16, width: "fit-content" }}>
            {[["all", "All keys", KEYS.length], ["active", "Active", activeCount], ["revoked", "Revoked", revokedCount]].map(([key, label, count]) => (
              <button key={key} onClick={() => setFilter(key)} style={{ height: 34, padding: "0 14px", borderRadius: 10, fontSize: 12, fontWeight: filter === key ? 650 : 600, color: filter === key ? "var(--text-primary)" : "var(--text-secondary)", background: filter === key ? "var(--surface-1)" : "transparent", boxShadow: filter === key ? "var(--shadow-sm)" : "none", display: "inline-flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: F.display }}>
                {label}
                <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, background: filter === key ? "var(--accent-soft)" : "var(--surface-3)", color: filter === key ? "var(--accent-text)" : "var(--text-tertiary)", fontSize: 9.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: F.display }}>{count}</span>
              </button>
            ))}
          </div>

          {/* ═══════ KEY LIST ═══════ */}
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)", borderRadius: 18, boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 24 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) minmax(220px,2fr) 1fr 1fr 1fr 80px", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--surface-3)", background: "var(--surface-2)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, color: "var(--text-tertiary)", fontFamily: F.display }}>
              <div>Key</div>
              <div>Prefix · Scopes</div>
              <div>Created by</div>
              <div>Last used</div>
              <div>Status</div>
              <div></div>
            </div>
            {filteredKeys.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                No keys match this filter.
              </div>
            ) : filteredKeys.map((k, i) => (
              <KeyRow key={k.id} k={k} isLast={i === filteredKeys.length - 1} onRevoke={() => openRevoke(k)} />
            ))}
          </div>

          {/* ═══════ USAGE STATS STRIP ═══════ */}
          <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h3 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 720, letterSpacing: "-.02em", margin: 0 }}>Usage at a glance</h3>
            <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 520 }}>Aggregated across all active keys · Last 30 days</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
            {STATS.map((s, i) => {
              const isPrimary = s.type === "primary", isSuccess = s.type === "success";
              return (
                <div key={i} style={{
                  background: isSuccess ? "var(--success-soft)" : isPrimary ? "var(--accent-soft)" : "var(--surface-1)",
                  border: `1px solid ${isSuccess ? "#a7d9be" : isPrimary ? "var(--accent-muted)" : "var(--surface-3)"}`,
                  borderRadius: 14, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-tertiary)", fontWeight: 700, fontFamily: F.display }}>{s.label}</div>
                  <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 820, letterSpacing: "-.03em", marginTop: 6, color: isSuccess ? "var(--success-text)" : isPrimary ? "var(--accent-text)" : "var(--text-primary)" }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4, fontWeight: 520 }}>{s.meta}</div>
                </div>
              );
            })}
          </div>

          {/* ═══════ AUDIT LOG ═══════ */}
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--surface-3)", borderRadius: 18, padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 720, letterSpacing: "-.02em", margin: 0 }}>Recent activity</h3>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 520 }}>Key creation, revocation, and a sampled feed of usage events.</div>
              </div>
              <button style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: "var(--text-secondary)", fontSize: 11.5, fontWeight: 620, cursor: "pointer", fontFamily: F.display }}>View full audit log</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {AUDIT.map((a, i) => {
                const meta = {
                  used: { color: "var(--info-text)", bg: "var(--info-soft)", icon: I.zap, label: "Used" },
                  created: { color: "var(--success-text)", bg: "var(--success-soft)", icon: I.plus, label: "Created" },
                  revoked: { color: "var(--danger-text)", bg: "var(--danger-soft)", icon: I.trash, label: "Revoked" },
                }[a.kind];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", borderRadius: 10, background: i % 2 === 0 ? "var(--surface-2)" : "transparent" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: meta.bg, color: meta.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <span style={{ width: 14, height: 14, display: "block" }}>{meta.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 650 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, fontWeight: 520 }}>{a.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-muted))", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 9, fontWeight: 700 }}>{a.actor}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 520, whiteSpace: "nowrap" }}>{a.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ MODAL: CREATE KEY (form) ═══════ */}
      {modal === "create" && (
        <ModalBackdrop onClose={() => setModal(null)}>
          <div style={{ width: 520, background: "var(--surface-1)", borderRadius: 18, boxShadow: "var(--shadow-lg)", overflow: "hidden", border: "1px solid var(--surface-3)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-text)", display: "grid", placeItems: "center" }}>
                  <span style={{ width: 18, height: 18, display: "block" }}>{I.key}</span>
                </div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 720, letterSpacing: "-.02em" }}>Create API key</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>Scoped to Pearson Construction Inc.</div>
                </div>
              </div>
              <button onClick={() => setModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <span style={{ width: 16, height: 16, display: "block" }}>{I.x}</span>
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontFamily: F.display, fontSize: 12, fontWeight: 680, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Key name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CI/CD Pipeline, Reporting dashboard"
                  style={{ width: "100%", height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: 13, fontFamily: F.body, fontWeight: 520, boxSizing: "border-box", outline: "none" }}
                />
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6, fontWeight: 520 }}>For your reference only — appears in audit logs and the key list. Not sent in API requests.</div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontFamily: F.display, fontSize: 12, fontWeight: 680, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Scope</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["read", "write", "admin"].map(s => {
                    const c = SCOPE_COPY[s];
                    const selected = currentScope === s;
                    return (
                      <label key={s} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 12, border: `1px solid ${selected ? "var(--accent)" : "var(--surface-3)"}`, background: selected ? "var(--accent-soft)" : "var(--surface-1)", cursor: "pointer", transition: "all 150ms" }}>
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => toggleScope(s)}
                          style={{ marginTop: 3, accentColor: "var(--accent)" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ScopePill scope={s} />
                            <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 680 }}>{c.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 520, lineHeight: 1.45 }}>{c.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {currentScope === "admin" && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--warning-soft)", border: "1px solid #f5d6a0", borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 14, height: 14, color: "var(--warning-text)", marginTop: 2, flexShrink: 0 }}>{I.alert}</div>
                  <div style={{ fontSize: 11.5, color: "var(--warning-text)", fontWeight: 580, lineHeight: 1.5 }}>
                    Admin keys can modify org settings, members, and billing. Use only for trusted automation.
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--surface-3)", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 620, cursor: "pointer", fontFamily: F.display }}>Cancel</button>
              <button
                onClick={submitCreate}
                disabled={!newName.trim()}
                style={{ height: 36, padding: "0 18px", borderRadius: 10, border: "none", background: newName.trim() ? "var(--accent)" : "var(--surface-3)", color: "white", fontSize: 12, fontWeight: 650, cursor: newName.trim() ? "pointer" : "not-allowed", fontFamily: F.display, opacity: newName.trim() ? 1 : 0.6 }}
              >
                Generate key
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ═══════ MODAL: REVEAL (one-time) ═══════ */}
      {modal === "reveal" && (
        <ModalBackdrop onClose={null /* intentionally no backdrop close */}>
          <div style={{ width: 560, background: "var(--surface-1)", borderRadius: 18, boxShadow: "var(--shadow-lg)", overflow: "hidden", border: "1px solid var(--surface-3)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--surface-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--success-soft)", color: "var(--success-text)", display: "grid", placeItems: "center" }}>
                  <span style={{ width: 18, height: 18, display: "block" }}>{I.check}</span>
                </div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 720, letterSpacing: "-.02em" }}>Key generated</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>{newName || "Unnamed key"} · scope: {currentScope}</div>
                </div>
              </div>
            </div>

            {/* Danger banner */}
            <div style={{ padding: "14px 24px 0" }}>
              <div style={{ background: "var(--danger-soft)", border: "1px solid #f0b8b8", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, color: "var(--danger-text)", marginTop: 2, flexShrink: 0 }}>{I.alert}</div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 720, color: "var(--danger-text)", marginBottom: 2 }}>This is the only time you'll see this key</div>
                  <div style={{ fontSize: 12, color: "var(--danger-text)", fontWeight: 520, lineHeight: 1.5, opacity: 0.9 }}>Copy it now and store it in your secrets manager. Once you close this dialog, the full key is gone — only the prefix remains visible. To replace it, you'll have to generate a new one.</div>
                </div>
              </div>
            </div>

            {/* Key display */}
            <div style={{ padding: "16px 24px 8px" }}>
              <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Your API key</div>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <div style={{ flex: 1, minWidth: 0, padding: "12px 14px", border: "1px solid var(--surface-3)", borderRadius: 10, background: "var(--surface-2)", fontFamily: F.mono, fontSize: 13, fontWeight: 520, color: "var(--text-primary)", overflowX: "auto", whiteSpace: "nowrap", letterSpacing: ".02em" }}>
                  {generatedKey}
                </div>
                <button
                  onClick={() => setCopied(true)}
                  style={{ minWidth: 110, height: "auto", padding: "0 16px", borderRadius: 10, border: "none", background: copied ? "var(--success)" : "var(--accent)", color: "white", fontSize: 12, fontWeight: 650, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: F.display, transition: "background 150ms" }}
                >
                  <span style={{ width: 14, height: 14, display: "block" }}>{copied ? I.check : I.copy}</span>
                  {copied ? "Copied" : "Copy key"}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8, fontWeight: 520 }}>
                Use as <span style={{ fontFamily: F.mono, fontSize: 11 }}>Authorization: Bearer {generatedKey.slice(0, 18)}…</span>
              </div>
            </div>

            {/* Quick reference */}
            <div style={{ padding: "12px 24px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                <div style={{ padding: 12, border: "1px solid var(--surface-3)", borderRadius: 10, background: "var(--surface-1)" }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-tertiary)", fontWeight: 700, fontFamily: F.display }}>Rate limits</div>
                  <div style={{ fontSize: 12.5, fontFamily: F.display, fontWeight: 620, marginTop: 4 }}>60 / min · 1,000 / hour</div>
                </div>
                <div style={{ padding: 12, border: "1px solid var(--surface-3)", borderRadius: 10, background: "var(--surface-1)" }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-tertiary)", fontWeight: 700, fontFamily: F.display }}>Endpoint</div>
                  <div style={{ fontSize: 12.5, fontFamily: F.mono, fontWeight: 620, marginTop: 4 }}>/api/v1/*</div>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--surface-3)", background: "var(--surface-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 520, display: "flex", alignItems: "center", gap: 6 }}>
                {copied ? (
                  <><span style={{ width: 12, height: 12, color: "var(--success-text)", display: "inline-block" }}>{I.check}</span><span style={{ color: "var(--success-text)", fontWeight: 600 }}>Copied to clipboard</span></>
                ) : (
                  <span>Copy the key before closing</span>
                )}
              </div>
              <button
                onClick={closeReveal}
                disabled={!copied}
                style={{ height: 36, padding: "0 18px", borderRadius: 10, border: "none", background: copied ? "var(--accent)" : "var(--surface-3)", color: "white", fontSize: 12, fontWeight: 650, cursor: copied ? "pointer" : "not-allowed", fontFamily: F.display, opacity: copied ? 1 : 0.6 }}
              >
                I've stored my key — close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ═══════ MODAL: REVOKE confirmation ═══════ */}
      {modal === "revoke" && revokeTarget && (
        <ModalBackdrop onClose={() => setModal(null)}>
          <div style={{ width: 480, background: "var(--surface-1)", borderRadius: 18, boxShadow: "var(--shadow-lg)", overflow: "hidden", border: "1px solid var(--surface-3)" }}>
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--danger-soft)", color: "var(--danger-text)", display: "grid", placeItems: "center" }}>
                  <span style={{ width: 18, height: 18, display: "block" }}>{I.alert}</span>
                </div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 720, letterSpacing: "-.02em" }}>Revoke API key?</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>This action cannot be undone.</div>
                </div>
              </div>

              <div style={{ padding: 14, border: "1px solid var(--surface-3)", borderRadius: 12, background: "var(--surface-2)", marginBottom: 14 }}>
                <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>{revokeTarget.name}</div>
                <div style={{ fontFamily: F.mono, fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontWeight: 520 }}>{revokeTarget.prefix}…</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6, fontWeight: 520 }}>
                  Created by {revokeTarget.createdBy} on {revokeTarget.createdAt} · {revokeTarget.usage30d.toLocaleString()} requests in last 30 days
                </div>
              </div>

              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, fontWeight: 520, marginBottom: 14 }}>
                Any system using this key will fail with <span style={{ fontFamily: F.mono, fontSize: 12 }}>401 Unauthorized</span> on its next request — usually within seconds. Make sure you've rotated dependent integrations to a new key first.
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--surface-3)", background: "var(--surface-2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 620, cursor: "pointer", fontFamily: F.display }}>Cancel</button>
              <button onClick={() => setModal(null)} style={{ height: 36, padding: "0 18px", borderRadius: 10, border: "none", background: "var(--danger)", color: "white", fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: F.display, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 14, height: 14, display: "block" }}>{I.trash}</span>
                Revoke key
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function KeyRow({ k, isLast, onRevoke }) {
  const isActive = k.status === "active";
  const liveColors = { live: "var(--success)", recent: "var(--success)", old: "var(--surface-4)" };
  const dot = liveColors[k.lastUsedRel];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) minmax(220px,2fr) 1fr 1fr 1fr 80px", gap: 16, padding: "14px 20px", borderBottom: isLast ? "none" : "1px solid var(--surface-3)", alignItems: "center", opacity: isActive ? 1 : 0.7 }}>
      {/* Key name + activity dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? "var(--accent-soft)" : "var(--surface-2)", color: isActive ? "var(--accent-text)" : "var(--text-tertiary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.5 9.5M15.5 7.5l3 3"/>
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 680, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 520, marginTop: 2 }}>Created {k.createdAt}</div>
        </div>
      </div>

      {/* Prefix + scopes */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: F.mono, fontSize: 12, color: "var(--text-secondary)", fontWeight: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.prefix}…</div>
        <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
          {k.scopes.map(s => <ScopePill key={s} scope={s} />)}
        </div>
      </div>

      {/* Created by */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-muted))", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{k.createdByInit}</div>
        <span style={{ fontSize: 12, fontWeight: 580, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.createdBy}</span>
      </div>

      {/* Last used */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }}/>}
          <span style={{ fontSize: 12, fontWeight: 580 }}>{k.lastUsed}</span>
        </div>
        {isActive && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 520, fontFamily: F.mono }}>{k.usage30d.toLocaleString()} / 30d</div>}
        {!isActive && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 520 }}>Revoked {k.revokedAt}</div>}
      </div>

      {/* Status */}
      <div>
        {isActive ? (
          <span style={{ height: 24, padding: "0 10px", borderRadius: 999, border: "1px solid #a7d9be", background: "var(--success-soft)", color: "var(--success-text)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, fontFamily: F.display }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }}/>
            Active
          </span>
        ) : (
          <span style={{ height: 24, padding: "0 10px", borderRadius: 999, border: "1px solid var(--surface-3)", background: "var(--surface-2)", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, fontFamily: F.display }}>
            Revoked
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
        {isActive ? (
          <>
            <IconBtn title="Rotate key">
              <span style={{ width: 14, height: 14, display: "block" }}>{I.rotate}</span>
            </IconBtn>
            <IconBtn title="Revoke" danger onClick={onRevoke}>
              <span style={{ width: 14, height: 14, display: "block" }}>{I.trash}</span>
            </IconBtn>
          </>
        ) : (
          <IconBtn title="More">
            <span style={{ width: 14, height: 14, display: "block" }}>{I.more}</span>
          </IconBtn>
        )}
      </div>
    </div>
  );
}

function ScopePill({ scope }) {
  const styles = {
    read: { bg: "var(--info-soft)", color: "var(--info-text)", border: "#b3d4ee" },
    write: { bg: "var(--accent-soft)", color: "var(--accent-text)", border: "var(--accent-muted)" },
    admin: { bg: "var(--warning-soft)", color: "var(--warning-text)", border: "#f5d6a0" },
  }[scope];
  return (
    <span style={{ height: 20, padding: "0 8px", borderRadius: 999, border: `1px solid ${styles.border}`, background: styles.bg, color: styles.color, display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 720, fontFamily: F.display, letterSpacing: ".01em", textTransform: "uppercase" }}>
      {scope}
    </span>
  );
}

function IconBtn({ children, title, danger, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--surface-3)", background: "var(--surface-1)", color: danger ? "var(--danger-text)" : "var(--text-tertiary)", cursor: "pointer", display: "grid", placeItems: "center" }}
    >
      {children}
    </button>
  );
}

function ModalBackdrop({ children, onClose }) {
  return (
    <div
      onClick={onClose ? onClose : undefined}
      style={{ position: "fixed", inset: 0, background: "rgba(20,18,24,.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 100, padding: 24 }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
