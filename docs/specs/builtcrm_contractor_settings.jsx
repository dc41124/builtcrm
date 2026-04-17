import { useState } from "react";

/*
 * CONTRACTOR PORTAL-SPECIFIC SETTINGS
 * ───────────────────────────────────
 * This file covers contractor settings that do NOT live in the shared shell.
 *
 * Shared (see builtcrm_settings_shared_shell.jsx):
 *   - Profile, Security, Notifications, Appearance
 *
 * Already built elsewhere (see contractor_settings_integrations.html / .jsx):
 *   - Integrations (QuickBooks, Stripe Connect, Xero, Sage, Calendar, Email, CSV, Webhooks)
 *   - Payments (Stripe Connect onboarding + payout history)
 *
 * This file:
 *   - Organization (company info, logo, licenses, tax ID)
 *   - Team & Roles (functional permissions editor)
 *   - Plan & Billing (subscription, card, invoice history)
 *   - Data (import, export, migration)
 *   - Org Security (domain restrictions, SSO/SAML, session policy, audit log)
 *
 * API keys section is deferred per Phase 4+ guide — arrives after Step 8-lite.
 */

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  building: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h0M9 13h0M9 17h0"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  card: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  database: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  lock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  dots: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  ext: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  warn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ── Nav (contractor portal, Settings active) ───────────────────
const nav = [
  { section: "Overview", items: [{ label: "Dashboard" }] },
  { section: "Riverside Tower Fit-Out", items: [
    { label: "Project Home" }, { label: "RFIs / Issues", badge: 3 },
    { label: "Change Orders", badge: 1, bt: "warn" }, { label: "Approvals", badge: 2 },
    { label: "Selections" }, { label: "Billing / Draws" }, { label: "Compliance" },
    { label: "Upload Requests" }, { label: "Documents" }, { label: "Budget" }, { label: "Schedule" },
    { label: "Messages", badge: 3 }, { label: "Team" },
  ]},
  { section: "Account", items: [{ label: "Settings", active: true }] },
];

const user = { avatar: "DC", name: "Dan Carter", role: "Org Admin · Summit Contracting" };

// ── Settings tabs (contractor-specific only) ───────────────────
const settingsTabs = [
  { id: "organization", label: "Organization", icon: I.building, desc: "Company profile, logo, and licensing" },
  { id: "team", label: "Team & roles", icon: I.users, desc: "Members, permissions, and invites" },
  { id: "billing", label: "Plan & billing", icon: I.card, desc: "Subscription, payment method, and invoices" },
  { id: "data", label: "Data", icon: I.database, desc: "Import, export, and migration" },
  { id: "orgsec", label: "Org security", icon: I.lock, desc: "SSO, domain rules, and the audit log" },
];

// Cross-refs (for the nav-strip at the top of the settings page)
const crossRefs = [
  { id: "profile", label: "Profile", note: "Shared shell" },
  { id: "security", label: "Security", note: "Shared shell" },
  { id: "notifications", label: "Notifications", note: "Shared shell" },
  { id: "integrations", label: "Integrations", note: "Session 18" },
  { id: "payments", label: "Payments (Connect)", note: "Session 18" },
  { id: "apikeys", label: "API keys", note: "After 8-lite", soon: true },
];

// ── Organization defaults ──────────────────────────────────────
const orgDefaults = {
  legalName: "Summit Contracting LLC",
  displayName: "Summit Contracting",
  ein: "87-4521983",
  website: "https://summitcontracting.com",
  phone: "+1 (415) 555-0100",
  addr1: "1240 Industrial Blvd",
  addr2: "Suite 300",
  city: "San Francisco",
  state: "CA",
  zip: "94103",
  country: "United States",
  primaryContact: "Dan Carter",
  billingContact: "Rachel Owens",
  billingEmail: "billing@summitcontracting.com",
  licenses: [
    { id: 1, kind: "General Contractor (CSLB)", number: "B-1089432", state: "CA", expires: "2027-03-15" },
    { id: 2, kind: "RBQ (Quebec)", number: "5812-9947-01", state: "QC", expires: "2026-11-30" },
  ],
};

// ── Roles ──────────────────────────────────────────────────────
const roles = [
  { id: "admin", label: "Admin", desc: "Full access to everything including billing and team management.", scope: "org" },
  { id: "pm", label: "Project Manager", desc: "Create and run projects, approve COs and draws, manage subs and clients.", scope: "project" },
  { id: "estimator", label: "Estimator", desc: "Budgets, bids, and scope. Read access to projects they're assigned to.", scope: "project" },
  { id: "field", label: "Field Supervisor", desc: "RFIs, daily field ops, and schedule updates. No billing access.", scope: "project" },
  { id: "finance", label: "Finance", desc: "Billing, draws, lien waivers, and reports. Read-only on project content.", scope: "org" },
  { id: "viewer", label: "Viewer", desc: "Read-only across all assigned projects. No create/edit permissions.", scope: "project" },
];

// ── Team members ───────────────────────────────────────────────
const membersInitial = [
  { id: 1, name: "Dan Carter", email: "dan.carter@summitcontracting.com", avatar: "DC", role: "admin", lastActive: "Active now", joined: "Jan 2024", you: true },
  { id: 2, name: "Rachel Owens", email: "rachel.owens@summitcontracting.com", avatar: "RO", role: "finance", lastActive: "3 hours ago", joined: "Feb 2024" },
  { id: 3, name: "James Whitfield", email: "james.w@summitcontracting.com", avatar: "JW", role: "pm", lastActive: "1 hour ago", joined: "Mar 2024" },
  { id: 4, name: "Lisa Chen", email: "lisa.chen@summitcontracting.com", avatar: "LC", role: "estimator", lastActive: "Yesterday", joined: "May 2024" },
  { id: 5, name: "Tom Nakamura", email: "tom.n@summitcontracting.com", avatar: "TN", role: "field", lastActive: "2 days ago", joined: "Jul 2024" },
  { id: 6, name: "Marcus Bell", email: "marcus.bell@summitcontracting.com", avatar: "MB", role: "viewer", lastActive: "1 week ago", joined: "Oct 2024" },
];
const pendingInvites = [
  { id: 101, email: "new.hire@summitcontracting.com", role: "pm", sentBy: "Dan Carter", sent: "2 days ago" },
];

// ── Plan data ──────────────────────────────────────────────────
const plans = [
  { id: "starter", name: "Starter", monthly: 149, annual: 119, blurb: "Solo GC or small crew, handful of projects.",
    limits: { projects: "5 active", team: "3 members", storage: "5 GB" },
    highlights: ["AIA billing & draw requests", "RFI & change order tracking", "Client portals"] },
  { id: "pro", name: "Professional", monthly: 399, annual: 319, blurb: "Growing teams with multiple projects.", featured: true,
    limits: { projects: "Unlimited", team: "10 members", storage: "50 GB" },
    highlights: ["Everything in Starter", "Compliance management", "Selections studio", "Approval workflows", "Priority support"] },
  { id: "enterprise", name: "Enterprise", monthly: null, annual: null, blurb: "Custom workflows, integrations, and dedicated support.",
    limits: { projects: "Unlimited", team: "Unlimited", storage: "Unlimited" },
    highlights: ["Custom integrations", "SSO / SAML", "Dedicated account manager", "Custom onboarding"] },
];

const currentUsage = { projects: { used: 7, cap: "Unlimited" }, team: { used: 6, cap: 10 }, storage: { used: 14.2, cap: 50 } };

const invoices = [
  { id: "INV-2026-04-0041", date: "Apr 1, 2026", amount: 319.00, status: "Paid", period: "Apr 2026" },
  { id: "INV-2026-03-0038", date: "Mar 1, 2026", amount: 319.00, status: "Paid", period: "Mar 2026" },
  { id: "INV-2026-02-0035", date: "Feb 1, 2026", amount: 319.00, status: "Paid", period: "Feb 2026" },
  { id: "INV-2026-01-0032", date: "Jan 1, 2026", amount: 319.00, status: "Paid", period: "Jan 2026" },
  { id: "INV-2025-12-0029", date: "Dec 1, 2025", amount: 319.00, status: "Paid", period: "Dec 2025" },
  { id: "INV-2025-11-0026", date: "Nov 1, 2025", amount: 319.00, status: "Paid", period: "Nov 2025" },
];

// ── Audit log ──────────────────────────────────────────────────
const auditEventTypes = ["All events", "Authentication", "Team", "Permissions", "Billing", "Projects", "Compliance", "Integrations"];
const auditEvents = [
  { time: "Apr 17, 2026 · 9:42 AM", actor: "Dan Carter", category: "Team", event: "membership.role_changed", detail: "Lisa Chen · Estimator → PM", ip: "73.158.**.**" },
  { time: "Apr 17, 2026 · 8:14 AM", actor: "Rachel Owens", category: "Billing", event: "payment_method.updated", detail: "Card ending 4242 → ending 8391", ip: "172.58.**.**" },
  { time: "Apr 16, 2026 · 4:28 PM", actor: "Dan Carter", category: "Integrations", event: "integration.connected", detail: "QuickBooks Online · OAuth grant", ip: "73.158.**.**" },
  { time: "Apr 16, 2026 · 11:07 AM", actor: "James Whitfield", category: "Projects", event: "project.created", detail: "Northshore Community Center", ip: "67.164.**.**" },
  { time: "Apr 15, 2026 · 3:51 PM", actor: "Dan Carter", category: "Team", event: "membership.invited", detail: "new.hire@summitcontracting.com · PM", ip: "73.158.**.**" },
  { time: "Apr 15, 2026 · 10:19 AM", actor: "Marcus Bell", category: "Authentication", event: "user.signed_in", detail: "Chrome 136 · macOS", ip: "104.132.**.**" },
  { time: "Apr 14, 2026 · 5:44 PM", actor: "Dan Carter", category: "Permissions", event: "role.permissions_updated", detail: "Viewer · Enabled read access to Draws", ip: "73.158.**.**" },
  { time: "Apr 14, 2026 · 2:11 PM", actor: "Rachel Owens", category: "Billing", event: "invoice.downloaded", detail: "INV-2026-04-0041", ip: "172.58.**.**" },
  { time: "Apr 13, 2026 · 1:02 PM", actor: "Tom Nakamura", category: "Compliance", event: "compliance_doc.uploaded", detail: "COI — Meridian MEP · Expires Dec 2026", ip: "67.164.**.**" },
];

// ── Component ──────────────────────────────────────────────────
export default function ContractorSettings() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("organization");

  // Organization
  const [org, setOrg] = useState(orgDefaults);
  const [orgDirty, setOrgDirty] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const updateOrg = (k, v) => { setOrg({ ...org, [k]: v }); setOrgDirty(true); setOrgSaved(false); };
  const saveOrg = () => { setOrgDirty(false); setOrgSaved(true); setTimeout(() => setOrgSaved(false), 2400); };
  const discardOrg = () => { setOrg(orgDefaults); setOrgDirty(false); };

  // Team
  const [members, setMembers] = useState(membersInitial);
  const [invites, setInvites] = useState(pendingInvites);
  const [memberSearch, setMemberSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "pm" });
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [roleExplainer, setRoleExplainer] = useState(false);

  const changeMemberRole = (id, newRole) => {
    const adminCount = members.filter(m => m.role === "admin").length;
    const target = members.find(m => m.id === id);
    if (target.you && target.role === "admin" && newRole !== "admin" && adminCount === 1) {
      alert("You're the only Admin. Promote someone else before demoting yourself.");
      return;
    }
    setMembers(members.map(m => m.id === id ? { ...m, role: newRole } : m));
  };
  const sendInvite = () => {
    if (!inviteForm.email) return;
    setInvites([...invites, { id: Date.now(), email: inviteForm.email, role: inviteForm.role, sentBy: "Dan Carter", sent: "Just now" }]);
    setInviteForm({ email: "", role: "pm" });
    setShowInvite(false);
  };
  const removeMember = (id) => {
    setMembers(members.filter(m => m.id !== id));
    setRemoveConfirm(null);
  };
  const cancelInvite = (id) => setInvites(invites.filter(i => i.id !== id));
  const filteredMembers = members.filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Billing
  const [billingCycle, setBillingCycle] = useState("annual");
  const [currentPlan] = useState("pro");
  const [showChangePlan, setShowChangePlan] = useState(false);

  // Data
  const [exportStatus, setExportStatus] = useState(null);

  // Org Security
  const [domainLock, setDomainLock] = useState(true);
  const [ssoEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("720");
  const [auditFilter, setAuditFilter] = useState("All events");
  const [auditActor, setAuditActor] = useState("");
  const [ssoDrawerOpen, setSsoDrawerOpen] = useState(false);

  const filteredAudit = auditEvents.filter(e => {
    if (auditFilter !== "All events" && e.category !== auditFilter) return false;
    if (auditActor && !e.actor.toLowerCase().includes(auditActor.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={`cs ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.cs{
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
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.cs.dk{
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
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none;color:inherit}
input,select,textarea{font-family:inherit}

/* Sidebar (reused from design system) */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1a1714,#3d3830);display:grid;place-items:center;flex-shrink:0}
.cs.dk .brand-mark{background:linear-gradient(135deg,#edeae5,#a8a39a)}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px}
.s-user-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.s-user-name{font-size:13px;font-weight:580;color:var(--t1)}.s-user-role{font-size:11px;color:var(--t3);margin-top:1px}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.cs.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px 32px 40px;flex:1;max-width:1200px;width:100%}

/* Page header */
.pg-hdr{margin-bottom:22px}
.pg-hdr h2{font-family:var(--fd);font-size:26px;font-weight:750;letter-spacing:-.03em}
.pg-sub{font-size:13.5px;color:var(--t2);margin-top:4px;font-weight:520}

/* Cross-ref strip */
.xrefs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px;padding:10px 12px;background:var(--s1);border:1px dashed var(--s3);border-radius:var(--r-l)}
.xrefs-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:4px 6px 4px 0;margin-right:4px}
.xref{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--s2);color:var(--t2);display:inline-flex;align-items:center;gap:5px}
.xref-note{font-size:10px;color:var(--t3);font-weight:500}
.xref.soon{opacity:.6}

/* Settings layout */
.slt{display:grid;grid-template-columns:248px 1fr;gap:28px;align-items:start}
@media(max-width:960px){.slt{grid-template-columns:1fr}}

.snv{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:8px;display:flex;flex-direction:column;gap:2px;position:sticky;top:calc(var(--tbh) + 16px)}
.st-tab{display:flex;align-items:flex-start;gap:12px;padding:11px 12px;border-radius:var(--r-m);text-align:left;transition:all var(--df);color:var(--t2);cursor:pointer;width:100%}
.st-tab:hover{background:var(--sh);color:var(--t1)}
.st-tab.on{background:var(--ac-s);color:var(--ac-t)}
.st-tab-ic{width:28px;height:28px;border-radius:var(--r-s);background:var(--s2);display:grid;place-items:center;flex-shrink:0;color:var(--t2);margin-top:1px;transition:all var(--df)}
.st-tab.on .st-tab-ic{background:var(--ac);color:white}
.st-tab-body{flex:1;min-width:0}
.st-tab-lbl{font-family:var(--fd);font-size:13px;font-weight:650;letter-spacing:-.01em}
.st-tab-ds{font-size:11.5px;color:var(--t3);margin-top:2px;line-height:1.35;font-weight:500}

/* Panel */
.panel{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;margin-bottom:16px}
.panel-hdr{margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.panel-hdr .h-body h3{font-family:var(--fd);font-size:17px;font-weight:700;letter-spacing:-.02em}
.panel-hdr .h-body p{font-size:13px;color:var(--t2);margin-top:3px;font-weight:520}

/* Fields */
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.field:last-child{margin-bottom:0}
.field label{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t2);letter-spacing:.01em}
.fld{height:40px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:13.5px;color:var(--t1);outline:none;transition:all var(--df);font-family:var(--fb);width:100%}
.fld:focus{border-color:var(--ac);box-shadow:var(--shri)}
.fld.mono{font-family:var(--fm);font-size:13px;letter-spacing:.02em}
.fld-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fld-row-3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px}
@media(max-width:620px){.fld-row,.fld-row-3{grid-template-columns:1fr}}
.field-help{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:500}

/* Buttons */
.btn{height:38px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all var(--dn) var(--e);font-family:var(--fb)}
.btn.primary{background:var(--ac);color:white;border:none}.btn.primary:hover{background:var(--ac-h);box-shadow:var(--shmd)}
.btn.primary:disabled{background:var(--s3);color:var(--t3);cursor:not-allowed;box-shadow:none}
.btn.ghost{border:1px solid var(--s3);background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--sh);border-color:var(--s4);color:var(--t1)}
.btn.danger{border:1px solid var(--dg);background:transparent;color:var(--dg)}.btn.danger:hover{background:var(--dg-s)}
.btn.sm{height:32px;padding:0 14px;font-size:12px}

/* Pill */
.pill{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;font-family:var(--fd);letter-spacing:.02em;flex-shrink:0;display:inline-flex;align-items:center;gap:4px}
.pill.ok{background:var(--ok-s);color:var(--ok-t)}
.pill.off{background:var(--s3);color:var(--t2)}
.pill.warn{background:var(--wr-s);color:var(--wr-t)}
.pill.info{background:var(--in-s);color:var(--in-t)}
.pill.ac{background:var(--ac-s);color:var(--ac-t)}

/* Save bar */
.save-bar{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);margin-top:12px}
.save-bar.dirty{background:var(--wr-s);border-color:var(--wr)}
.save-bar.success{background:var(--ok-s);border-color:var(--ok)}
.save-bar-l{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:580}
.save-bar.dirty .save-bar-l{color:var(--wr-t)}
.save-bar.success .save-bar-l{color:var(--ok-t)}
.save-dot{width:8px;height:8px;border-radius:50%;background:var(--wr)}
.save-bar.success .save-dot{background:var(--ok)}
.save-actions{display:flex;gap:8px}

/* Toggle switch */
.sw{position:relative;width:38px;height:22px;background:var(--s3);border-radius:999px;cursor:pointer;transition:background var(--df);flex-shrink:0}
.sw::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:white;border-radius:50%;transition:all var(--dn) var(--e);box-shadow:0 1px 3px rgba(0,0,0,.15)}
.sw.on{background:var(--ac)}.sw.on::after{left:18px}

/* Logo uploader */
.logo-up{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.logo-sq{width:88px;height:88px;border-radius:var(--r-l);background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:34px;font-weight:800;letter-spacing:-.04em;flex-shrink:0}

/* License list */
.lic-row{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid var(--s3);border-radius:var(--r-l);margin-bottom:8px}
.lic-row:last-child{margin-bottom:0}
.lic-body{flex:1;min-width:0}
.lic-kind{font-family:var(--fd);font-size:13.5px;font-weight:650;letter-spacing:-.01em}
.lic-meta{font-size:12px;color:var(--t3);margin-top:3px;font-weight:500;font-family:var(--fm)}

/* Table */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:10px 12px;border-bottom:1px solid var(--s3)}
.tbl td{padding:14px 12px;border-bottom:1px solid var(--s2);font-size:13.5px;color:var(--t1);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:var(--sh)}

.m-row{display:flex;align-items:center;gap:12px}
.m-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700;flex-shrink:0}
.m-name{font-family:var(--fd);font-size:13.5px;font-weight:650;letter-spacing:-.01em}
.m-email{font-size:12px;color:var(--t3);margin-top:2px;font-weight:500}

/* Role select */
.role-sel{height:32px;padding:0 28px 0 10px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);font-size:12.5px;color:var(--t1);outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;font-family:var(--fb);background-image:url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c958a' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.role-sel:focus{border-color:var(--ac);box-shadow:var(--shri)}

/* Search bar */
.sb{position:relative;max-width:320px}
.sb input{height:36px;padding:0 12px 0 34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:13px;color:var(--t1);outline:none;width:100%}
.sb input:focus{border-color:var(--ac);box-shadow:var(--shri)}
.sb .ic{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--t3);pointer-events:none}

/* Role explainer */
.re-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:12px}
.re-item{padding:12px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1)}
.re-ttl{font-family:var(--fd);font-size:13px;font-weight:650;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
.re-ds{font-size:11.5px;color:var(--t3);line-height:1.45;font-weight:500}

/* Invite panel */
.inv-panel{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:18px;margin-bottom:12px}
.inv-grid{display:grid;grid-template-columns:2fr 1fr auto auto;gap:10px;align-items:end}
@media(max-width:760px){.inv-grid{grid-template-columns:1fr;gap:12px}}

/* Remove dialog */
.rm-dialog{background:var(--dg-s);border:1px solid var(--dg);border-radius:var(--r-l);padding:14px;margin:4px 0 0 0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.rm-dialog-l{font-size:12.5px;color:var(--dg);font-weight:580;flex:1;min-width:200px}

/* Plan */
.plan-row{display:grid;grid-template-columns:2fr 1fr;gap:16px;align-items:start}
@media(max-width:820px){.plan-row{grid-template-columns:1fr}}
.plan-card{background:linear-gradient(135deg,var(--ac-s),var(--s1));border:1px solid var(--ac-m);border-radius:var(--r-l);padding:20px}
.plan-row-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.plan-name{font-family:var(--fd);font-size:22px;font-weight:780;letter-spacing:-.03em;color:var(--ac-t)}
.plan-price{font-family:var(--fd);font-size:18px;font-weight:700;color:var(--t1);text-align:right}
.plan-price small{font-size:12px;font-weight:500;color:var(--t3)}
.plan-blurb{font-size:13px;color:var(--t2);font-weight:520;margin-top:2px}

.use-list{display:flex;flex-direction:column;gap:14px;margin-top:4px}
.use-item{display:flex;flex-direction:column;gap:6px}
.use-top{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;font-weight:600}
.use-val{font-family:var(--fm);font-size:12px;color:var(--t2)}
.use-bar{height:6px;background:var(--s3);border-radius:999px;overflow:hidden;position:relative}
.use-fill{height:100%;background:var(--ac);border-radius:999px;transition:width var(--dn) var(--e)}
.use-fill.warn{background:var(--wr)}
.use-fill.danger{background:var(--dg)}

/* Plan picker */
.cycle-toggle{display:flex;gap:2px;background:var(--s2);border-radius:var(--r-m);padding:3px;width:fit-content;margin-bottom:16px}
.cycle-toggle button{height:32px;padding:0 14px;border-radius:var(--r-s);font-size:12px;font-weight:650;color:var(--t2)}
.cycle-toggle button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}

.tier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:860px){.tier-grid{grid-template-columns:1fr}}
.tier{background:var(--s1);border:1.5px solid var(--s3);border-radius:var(--r-l);padding:18px;position:relative}
.tier.featured{border-color:var(--ac)}
.tier.current{border-color:var(--ok);background:var(--ok-s)}
.tier-lbl{position:absolute;top:-10px;right:14px;padding:3px 10px;border-radius:999px;font-family:var(--fd);font-size:10px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
.tier.featured .tier-lbl{background:var(--ac);color:white}
.tier.current .tier-lbl{background:var(--ok);color:white}
.tier-name{font-family:var(--fd);font-size:17px;font-weight:750;letter-spacing:-.02em}
.tier-price{font-family:var(--fd);font-size:24px;font-weight:800;letter-spacing:-.03em;margin:6px 0 4px;color:var(--t1)}
.tier-price small{font-size:12px;font-weight:500;color:var(--t3)}
.tier-blurb{font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.4;font-weight:520}
.tier-limits{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;padding:10px 12px;background:var(--s2);border-radius:var(--r-m)}
.tier-limit{display:flex;justify-content:space-between;font-size:11.5px}
.tier-limit span:first-child{color:var(--t3);font-weight:500}
.tier-limit span:last-child{color:var(--t1);font-weight:650;font-family:var(--fd)}
.tier-feat{list-style:none;padding:0;margin:0 0 14px;display:flex;flex-direction:column;gap:5px}
.tier-feat li{font-size:12px;color:var(--t2);display:flex;align-items:flex-start;gap:6px;line-height:1.4}
.tier-feat li svg{color:var(--ok);flex-shrink:0;margin-top:2px}

/* Payment method */
.pm-card{display:flex;align-items:center;gap:14px;padding:14px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l)}
.pm-brand{width:48px;height:32px;border-radius:var(--r-s);background:linear-gradient(135deg,#1a1f71,#0f1551);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:800;letter-spacing:.05em;flex-shrink:0}
.pm-body{flex:1;min-width:0}
.pm-num{font-family:var(--fm);font-size:13px;font-weight:600}
.pm-meta{font-size:11.5px;color:var(--t3);margin-top:3px;font-weight:500}

/* Data tab */
.data-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.data-card{padding:18px;border:1px solid var(--s3);border-radius:var(--r-l);background:var(--s1)}
.data-card-ic{width:36px;height:36px;border-radius:var(--r-m);background:var(--ac-s);color:var(--ac-t);display:grid;place-items:center;margin-bottom:10px}
.data-card h4{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.01em;margin-bottom:4px}
.data-card p{font-size:12px;color:var(--t2);font-weight:500;line-height:1.45;margin-bottom:12px}

/* Security tab */
.sec-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--s2)}
.sec-row:last-child{border-bottom:none}
.sec-row:first-child{padding-top:0}
.sec-row-body{flex:1;min-width:0}
.sec-row-ttl{font-family:var(--fd);font-size:14px;font-weight:650;letter-spacing:-.01em;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sec-row-ds{font-size:12.5px;color:var(--t2);margin-top:4px;line-height:1.45;font-weight:500}
.sec-row-act{flex-shrink:0}

/* SSO drawer */
.sso-drawer{background:var(--s2);border-radius:var(--r-l);padding:16px;margin-top:12px}
.sso-drawer h5{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:6px}

/* Audit log */
.au-filter{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.au-filter select,.au-filter input{height:34px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:12.5px;color:var(--t1);outline:none;font-family:var(--fb)}
.au-filter select:focus,.au-filter input:focus{border-color:var(--ac);box-shadow:var(--shri)}
.au-ev{font-family:var(--fm);font-size:11.5px;color:var(--ac-t);background:var(--ac-s);padding:2px 8px;border-radius:var(--r-s);display:inline-block;font-weight:600}
.au-empty{padding:32px;text-align:center;color:var(--t3);font-size:13px}

.page-anim{animation:fadeIn .24s var(--e)}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Sidebar ───────────────────────── */}
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 80 80" width="16" height="16">
              <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".5"/>
              <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".75"/>
              <rect x="32" y="32" width="26" height="26" rx="4" fill="#faf9f7" opacity=".95"/>
            </svg>
          </div>
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">Contractor Portal</div>
          </div>
        </div>

        <nav className="s-nav">
          {nav.map(sec => (
            <div key={sec.section}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map(it => (
                <div key={it.label} className={`ni ${it.active ? "on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge != null && <span className={`ni-b ${it.bt || "blue"}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="s-foot">
          <div className="s-user">
            <div className="s-user-av">{user.avatar}</div>
            <div style={{ minWidth: 0 }}>
              <div className="s-user-name">{user.name}</div>
              <div className="s-user-role">{user.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>Contractor Portal</span>
            <span className="sep">/</span>
            <span className="cur">Settings</span>
            <span className="sep">/</span>
            <span className="cur">{settingsTabs.find(t => t.id === tab).label}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</button>
            <button className="ib">{I.bell}</button>
            <div className="av">{user.avatar}</div>
          </div>
        </div>

        <div className="ct">
          <div className="pg-hdr">
            <h2>Organization settings</h2>
            <div className="pg-sub">Manage your company profile, team, plan, and security.</div>
          </div>

          {/* Cross-refs strip */}
          <div className="xrefs">
            <span className="xrefs-lbl">Also available:</span>
            {crossRefs.map(r => (
              <span key={r.id} className={`xref ${r.soon ? "soon" : ""}`}>
                {r.label}
                <span className="xref-note">· {r.note}</span>
              </span>
            ))}
          </div>

          <div className="slt">
            <nav className="snv">
              {settingsTabs.map(t => (
                <button key={t.id} className={`st-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                  <div className="st-tab-ic">{t.icon}</div>
                  <div className="st-tab-body">
                    <div className="st-tab-lbl">{t.label}</div>
                    <div className="st-tab-ds">{t.desc}</div>
                  </div>
                </button>
              ))}
            </nav>

            <div className="page-anim" key={tab}>

              {/* ═══════ ORGANIZATION ═══════ */}
              {tab === "organization" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Company logo</h3>
                        <p>Shown in the sidebar, on client-facing documents, and on invoices.</p>
                      </div>
                    </div>
                    <div className="logo-up">
                      <div className="logo-sq">SC</div>
                      <div>
                        <div className="field-help" style={{ marginBottom: 8 }}>PNG or SVG · square, up to 2 MB · 512×512 recommended</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn ghost sm">{I.upload} Upload logo</button>
                          <button className="btn ghost sm">Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Company information</h3>
                        <p>How your organization appears across the app and on official documents.</p>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Display name</label>
                        <input className="fld" value={org.displayName} onChange={e => updateOrg("displayName", e.target.value)} />
                        <div className="field-help">Shown in the app and to your team</div>
                      </div>
                      <div className="field">
                        <label>Legal name</label>
                        <input className="fld" value={org.legalName} onChange={e => updateOrg("legalName", e.target.value)} />
                        <div className="field-help">Used on invoices, W-9s, and contracts</div>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Tax ID (EIN)</label>
                        <input className="fld mono" value={org.ein} onChange={e => updateOrg("ein", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Website</label>
                        <input className="fld" type="url" value={org.website} onChange={e => updateOrg("website", e.target.value)} />
                      </div>
                    </div>

                    <div className="field">
                      <label>Main phone</label>
                      <input className="fld" type="tel" value={org.phone} onChange={e => updateOrg("phone", e.target.value)} />
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Business address</h3>
                        <p>Used on invoices, mailing, and tax forms.</p>
                      </div>
                    </div>
                    <div className="field">
                      <label>Street address</label>
                      <input className="fld" value={org.addr1} onChange={e => updateOrg("addr1", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Suite / unit (optional)</label>
                      <input className="fld" value={org.addr2} onChange={e => updateOrg("addr2", e.target.value)} />
                    </div>
                    <div className="fld-row-3">
                      <div className="field">
                        <label>City</label>
                        <input className="fld" value={org.city} onChange={e => updateOrg("city", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>State / province</label>
                        <input className="fld" value={org.state} onChange={e => updateOrg("state", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>ZIP / postal</label>
                        <input className="fld mono" value={org.zip} onChange={e => updateOrg("zip", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Country</label>
                      <select className="fld" value={org.country} onChange={e => updateOrg("country", e.target.value)}>
                        <option>United States</option>
                        <option>Canada</option>
                        <option>Mexico</option>
                      </select>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Contacts</h3>
                        <p>Primary and billing contacts for your organization.</p>
                      </div>
                    </div>
                    <div className="fld-row">
                      <div className="field">
                        <label>Primary contact</label>
                        <input className="fld" value={org.primaryContact} onChange={e => updateOrg("primaryContact", e.target.value)} />
                        <div className="field-help">Default point of contact for inbound queries</div>
                      </div>
                      <div className="field">
                        <label>Billing contact</label>
                        <input className="fld" value={org.billingContact} onChange={e => updateOrg("billingContact", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Billing email</label>
                      <input className="fld" type="email" value={org.billingEmail} onChange={e => updateOrg("billingEmail", e.target.value)} />
                      <div className="field-help">Where invoice PDFs and receipts are sent</div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Licenses & credentials</h3>
                        <p>Licensing information shown on client-facing documents and used for compliance verification.</p>
                      </div>
                      <button className="btn ghost sm">{I.plus} Add license</button>
                    </div>
                    {org.licenses.map(l => (
                      <div key={l.id} className="lic-row">
                        <div className="lic-body">
                          <div className="lic-kind">{l.kind}</div>
                          <div className="lic-meta">{l.number} · {l.state} · Expires {l.expires}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn ghost sm">Edit</button>
                          <button className="btn ghost sm" style={{ color: "var(--dg)" }}>{I.x}</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(orgDirty || orgSaved) && (
                    <div className={`save-bar ${orgSaved ? "success" : "dirty"}`}>
                      <div className="save-bar-l">
                        <span className="save-dot" />
                        {orgSaved ? "Organization saved" : "You have unsaved changes"}
                      </div>
                      {!orgSaved && (
                        <div className="save-actions">
                          <button className="btn ghost sm" onClick={discardOrg}>Discard</button>
                          <button className="btn primary sm" onClick={saveOrg}>{I.check} Save changes</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══════ TEAM & ROLES ═══════ */}
              {tab === "team" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Roles</h3>
                        <p>How permissions are organized. Admins can change any member's role; Admin cannot demote themselves if they're the last one.</p>
                      </div>
                      <button className="btn ghost sm" onClick={() => setRoleExplainer(!roleExplainer)}>
                        {roleExplainer ? "Hide details" : "Show details"}
                      </button>
                    </div>
                    {roleExplainer && (
                      <div className="re-list page-anim">
                        {roles.map(r => (
                          <div key={r.id} className="re-item">
                            <div className="re-ttl">
                              {r.label}
                              <span className={`pill ${r.scope === "org" ? "ac" : "info"}`}>{r.scope === "org" ? "Org-wide" : "Per-project"}</span>
                            </div>
                            <div className="re-ds">{r.desc}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Members ({members.length})</h3>
                        <p>Everyone in your organization with access to BuiltCRM. Changes apply on their next request.</p>
                      </div>
                      <button className="btn primary sm" onClick={() => setShowInvite(!showInvite)}>
                        {showInvite ? "Cancel" : <>{I.plus} Invite member</>}
                      </button>
                    </div>

                    {showInvite && (
                      <div className="inv-panel page-anim">
                        <div className="inv-grid">
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Email address</label>
                            <input className="fld" type="email" placeholder="new.member@summitcontracting.com" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Role</label>
                            <select className="fld" value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                              {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                          </div>
                          <button className="btn ghost sm" onClick={() => setShowInvite(false)}>Cancel</button>
                          <button className="btn primary sm" onClick={sendInvite} disabled={!inviteForm.email}>Send invite</button>
                        </div>
                      </div>
                    )}

                    <div className="sb" style={{ marginBottom: 14 }}>
                      <span className="ic">{I.search}</span>
                      <input placeholder="Search members by name or email..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                    </div>

                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Role</th>
                          <th>Last active</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map(m => (
                          <tr key={m.id}>
                            <td>
                              <div className="m-row">
                                <div className="m-av">{m.avatar}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="m-name">
                                    {m.name}
                                    {m.you && <span className="pill ac" style={{ marginLeft: 8 }}>You</span>}
                                  </div>
                                  <div className="m-email">{m.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <select className="role-sel" value={m.role} onChange={e => changeMemberRole(m.id, e.target.value)}>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                              </select>
                            </td>
                            <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{m.lastActive}</td>
                            <td style={{ textAlign: "right" }}>
                              {!m.you && (
                                <button className="btn ghost sm" style={{ color: "var(--dg)" }} onClick={() => setRemoveConfirm(m.id)}>Remove</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredMembers.length === 0 && (
                          <tr><td colSpan="4" style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>No members match "{memberSearch}"</td></tr>
                        )}
                      </tbody>
                    </table>

                    {removeConfirm && (
                      <div className="rm-dialog page-anim">
                        <div className="rm-dialog-l">
                          {I.warn} Remove <strong>{members.find(m => m.id === removeConfirm)?.name}</strong> from the organization? Their record will be preserved for audit but they'll lose access immediately.
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn ghost sm" onClick={() => setRemoveConfirm(null)}>Cancel</button>
                          <button className="btn danger sm" onClick={() => removeMember(removeConfirm)}>Confirm remove</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {invites.length > 0 && (
                    <div className="panel">
                      <div className="panel-hdr">
                        <div className="h-body">
                          <h3>Pending invites ({invites.length})</h3>
                          <p>People who've been invited but haven't accepted yet.</p>
                        </div>
                      </div>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Sent</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invites.map(inv => (
                            <tr key={inv.id}>
                              <td style={{ fontFamily: "var(--fm)", fontSize: 12.5 }}>{inv.email}</td>
                              <td>
                                <span className="pill off">{roles.find(r => r.id === inv.role)?.label}</span>
                              </td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{inv.sent} · by {inv.sentBy}</td>
                              <td style={{ textAlign: "right" }}>
                                <button className="btn ghost sm">Resend</button>
                                <button className="btn ghost sm" style={{ color: "var(--dg)", marginLeft: 4 }} onClick={() => cancelInvite(inv.id)}>Cancel</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ═══════ PLAN & BILLING ═══════ */}
              {tab === "billing" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Current plan</h3>
                        <p>Your subscription and how much of each limit you're using.</p>
                      </div>
                      <button className="btn ghost sm" onClick={() => setShowChangePlan(!showChangePlan)}>
                        {showChangePlan ? "Hide options" : "Change plan"}
                      </button>
                    </div>
                    <div className="plan-row">
                      <div className="plan-card">
                        <div className="plan-row-top">
                          <div>
                            <div className="plan-name">Professional</div>
                            <div className="plan-blurb">Annual billing · Renews May 1, 2026</div>
                          </div>
                          <div className="plan-price">
                            $319<small>/mo</small>
                            <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--fb)", fontWeight: 500 }}>Billed $3,828/yr</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span className="pill ok">Active</span>
                          <span className="pill ac">Annual · save 20%</span>
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontFamily: "var(--fd)", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Usage this month</h4>
                        <div className="use-list">
                          <div className="use-item">
                            <div className="use-top">
                              <span>Active projects</span>
                              <span className="use-val">{currentUsage.projects.used} / {currentUsage.projects.cap}</span>
                            </div>
                            <div className="use-bar"><div className="use-fill" style={{ width: "28%" }} /></div>
                          </div>
                          <div className="use-item">
                            <div className="use-top">
                              <span>Team members</span>
                              <span className="use-val">{currentUsage.team.used} / {currentUsage.team.cap}</span>
                            </div>
                            <div className="use-bar"><div className={`use-fill ${(currentUsage.team.used / currentUsage.team.cap) > 0.75 ? "warn" : ""}`} style={{ width: `${(currentUsage.team.used / currentUsage.team.cap) * 100}%` }} /></div>
                          </div>
                          <div className="use-item">
                            <div className="use-top">
                              <span>Document storage</span>
                              <span className="use-val">{currentUsage.storage.used} GB / {currentUsage.storage.cap} GB</span>
                            </div>
                            <div className="use-bar"><div className="use-fill" style={{ width: `${(currentUsage.storage.used / currentUsage.storage.cap) * 100}%` }} /></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {showChangePlan && (
                      <div className="page-anim" style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--s3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                          <h4 style={{ fontFamily: "var(--fd)", fontSize: 15, fontWeight: 700 }}>Compare plans</h4>
                          <div className="cycle-toggle">
                            <button className={billingCycle === "monthly" ? "on" : ""} onClick={() => setBillingCycle("monthly")}>Monthly</button>
                            <button className={billingCycle === "annual" ? "on" : ""} onClick={() => setBillingCycle("annual")}>Annual · save 20%</button>
                          </div>
                        </div>
                        <div className="tier-grid">
                          {plans.map(p => (
                            <div key={p.id} className={`tier ${p.featured ? "featured" : ""} ${currentPlan === p.id ? "current" : ""}`}>
                              {p.featured && currentPlan !== p.id && <div className="tier-lbl">Popular</div>}
                              {currentPlan === p.id && <div className="tier-lbl">Current</div>}
                              <div className="tier-name">{p.name}</div>
                              <div className="tier-price">
                                {p.monthly == null ? "Custom" : <>${billingCycle === "annual" ? p.annual : p.monthly}<small>/mo</small></>}
                              </div>
                              <div className="tier-blurb">{p.blurb}</div>
                              <div className="tier-limits">
                                <div className="tier-limit"><span>Projects</span><span>{p.limits.projects}</span></div>
                                <div className="tier-limit"><span>Team</span><span>{p.limits.team}</span></div>
                                <div className="tier-limit"><span>Storage</span><span>{p.limits.storage}</span></div>
                              </div>
                              <ul className="tier-feat">
                                {p.highlights.map(h => <li key={h}>{I.check} {h}</li>)}
                              </ul>
                              {currentPlan === p.id
                                ? <button className="btn ghost sm" style={{ width: "100%" }} disabled>Current plan</button>
                                : <button className={`btn ${p.featured ? "primary" : "ghost"} sm`} style={{ width: "100%" }}>
                                    {p.id === "enterprise" ? "Contact sales" : p.id === "starter" ? "Downgrade" : "Upgrade"}
                                  </button>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Payment method</h3>
                        <p>The card we charge for your BuiltCRM subscription. Separate from Stripe Connect which handles your payouts.</p>
                      </div>
                      <button className="btn ghost sm">Update card</button>
                    </div>
                    <div className="pm-card">
                      <div className="pm-brand">VISA</div>
                      <div className="pm-body">
                        <div className="pm-num">•••• •••• •••• 4242</div>
                        <div className="pm-meta">Rachel Owens · Expires 08/2028</div>
                      </div>
                      <span className="pill ok">Default</span>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Billing history</h3>
                        <p>Your past invoices. Click any to download a PDF receipt.</p>
                      </div>
                      <button className="btn ghost sm">{I.download} Export all</button>
                    </div>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Period</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map(inv => (
                          <tr key={inv.id}>
                            <td style={{ fontFamily: "var(--fm)", fontSize: 12.5 }}>{inv.id}</td>
                            <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{inv.period}</td>
                            <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{inv.date}</td>
                            <td style={{ fontFamily: "var(--fm)", fontWeight: 600 }}>${inv.amount.toFixed(2)}</td>
                            <td><span className="pill ok">{inv.status}</span></td>
                            <td style={{ textAlign: "right" }}>
                              <button className="btn ghost sm">{I.download}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ═══════ DATA ═══════ */}
              {tab === "data" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Export your data</h3>
                        <p>Download your data in portable formats. Exports are scoped to your organization and respect authorization — you'll only export what you have access to read.</p>
                      </div>
                    </div>

                    <div className="data-grid">
                      <div className="data-card">
                        <div className="data-card-ic">{I.download}</div>
                        <h4>Complete archive</h4>
                        <p>Everything — projects, documents, messages, billing records, audit log. Delivered as a zipped JSON bundle.</p>
                        <button className="btn primary sm" style={{ width: "100%" }} onClick={() => { setExportStatus("preparing"); setTimeout(() => setExportStatus("ready"), 2000); }} disabled={exportStatus === "preparing"}>
                          {exportStatus === "preparing" ? "Preparing..." : exportStatus === "ready" ? "Ready — download" : "Request export"}
                        </button>
                        {exportStatus === "ready" && <div className="field-help" style={{ marginTop: 8 }}>Link emailed to your billing address.</div>}
                      </div>
                      <div className="data-card">
                        <div className="data-card-ic">{I.file}</div>
                        <h4>Projects (CSV)</h4>
                        <p>Project list with statuses, budgets, and team assignments. Good for spreadsheets and reports.</p>
                        <button className="btn ghost sm" style={{ width: "100%" }}>{I.download} Download CSV</button>
                      </div>
                      <div className="data-card">
                        <div className="data-card-ic">{I.file}</div>
                        <h4>Financial records (CSV)</h4>
                        <p>SOVs, draws, invoices, lien waivers, and payment history. Feeds straight into accounting.</p>
                        <button className="btn ghost sm" style={{ width: "100%" }}>{I.download} Download CSV</button>
                      </div>
                      <div className="data-card">
                        <div className="data-card-ic">{I.file}</div>
                        <h4>Documents (ZIP)</h4>
                        <p>All files uploaded to your projects, with folder structure preserved. Large — may take a few minutes.</p>
                        <button className="btn ghost sm" style={{ width: "100%" }}>{I.download} Request ZIP</button>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Import projects</h3>
                        <p>Bring in data from your previous PM tool or a spreadsheet.</p>
                      </div>
                    </div>

                    <div className="data-grid">
                      <div className="data-card">
                        <div className="data-card-ic" style={{ background: "#e6f5ef", color: "#1e6b46" }}>{I.upload}</div>
                        <h4>CSV / spreadsheet</h4>
                        <p>Map your columns to BuiltCRM fields. Good for project lists, client contacts, and sub directories.</p>
                        <button className="btn ghost sm" style={{ width: "100%" }}>Start import</button>
                      </div>
                      <div className="data-card">
                        <div className="data-card-ic" style={{ background: "#e8f1fa", color: "#276299" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 8h10M7 12h10M7 16h7"/></svg>
                        </div>
                        <h4>Procore</h4>
                        <p>One-time import of projects, documents, and RFIs. OAuth connect, then choose what comes over.</p>
                        <button className="btn ghost sm" style={{ width: "100%" }}>Connect Procore</button>
                      </div>
                      <div className="data-card">
                        <div className="data-card-ic" style={{ background: "#fdf4e6", color: "#96600f" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 7h7l-5.5 4 2 7.5L12 16l-6.5 4.5 2-7.5L2 9h7z"/></svg>
                        </div>
                        <h4>Buildertrend</h4>
                        <p>Residential-focused import including selections, change orders, and client records.</p>
                        <button className="btn ghost sm" style={{ width: "100%" }}>Connect Buildertrend</button>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Assisted migration</h3>
                        <p>For larger moves, our team can do a hands-on migration from any legacy system.</p>
                      </div>
                      <span className="pill ac">Enterprise</span>
                    </div>
                    <div className="sec-card" style={{ background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: "var(--r-l)", padding: 18, display: "flex", gap: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "var(--r-m)", background: "var(--s1)", color: "var(--ac)", display: "grid", placeItems: "center", flexShrink: 0 }}>{I.database}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--fd)", fontSize: 14, fontWeight: 650 }}>Talk to our migration team</div>
                        <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 4, lineHeight: 1.45 }}>We'll scope your move, build mapping rules together, and run the import end-to-end. Typical project: 2–4 weeks.</div>
                        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                          <button className="btn primary sm">Schedule a call</button>
                          <button className="btn ghost sm">View sample plan</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════ ORG SECURITY ═══════ */}
              {tab === "orgsec" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Sign-in policies</h3>
                        <p>Org-wide rules that apply to every member's account.</p>
                      </div>
                    </div>

                    <div className="sec-row">
                      <div className="sec-row-body">
                        <div className="sec-row-ttl">Restrict sign-in to approved domains</div>
                        <div className="sec-row-ds">
                          Only allow new members from <span style={{ fontFamily: "var(--fm)", fontSize: 12, background: "var(--s2)", padding: "1px 6px", borderRadius: 4 }}>@summitcontracting.com</span>. Existing members with other domains are unaffected.
                        </div>
                      </div>
                      <div className={`sw ${domainLock ? "on" : ""}`} onClick={() => setDomainLock(!domainLock)} role="switch" aria-checked={domainLock} />
                    </div>

                    <div className="sec-row">
                      <div className="sec-row-body">
                        <div className="sec-row-ttl">Session timeout</div>
                        <div className="sec-row-ds">How long a session stays active before sign-in is required again.</div>
                      </div>
                      <select className="fld" style={{ width: 180 }} value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}>
                        <option value="60">1 hour</option>
                        <option value="480">8 hours</option>
                        <option value="720">12 hours</option>
                        <option value="1440">24 hours</option>
                        <option value="10080">7 days (default)</option>
                      </select>
                    </div>

                    <div className="sec-row">
                      <div className="sec-row-body">
                        <div className="sec-row-ttl">Require 2FA for all members <span className="pill ac">Enterprise</span></div>
                        <div className="sec-row-ds">Force every member to enable two-factor authentication before they can sign in.</div>
                      </div>
                      <button className="btn ghost sm" disabled>Upgrade to enable</button>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Single sign-on (SSO)</h3>
                        <p>Connect your identity provider for SAML-based authentication.</p>
                      </div>
                      <span className="pill ac">Enterprise</span>
                    </div>

                    <div className="sec-row" style={{ paddingTop: 0 }}>
                      <div className="sec-row-body">
                        <div className="sec-row-ttl">
                          SAML 2.0 SSO
                          <span className={`pill ${ssoEnabled ? "ok" : "off"}`}>{ssoEnabled ? "Connected" : "Not connected"}</span>
                        </div>
                        <div className="sec-row-ds">Compatible with Okta, Azure AD, Google Workspace, OneLogin, and any SAML 2.0–compliant IdP.</div>
                      </div>
                      <button className="btn ghost sm" onClick={() => setSsoDrawerOpen(!ssoDrawerOpen)}>
                        {ssoDrawerOpen ? "Close" : "Configure"}
                      </button>
                    </div>

                    {ssoDrawerOpen && (
                      <div className="sso-drawer page-anim">
                        <h5>Service provider details</h5>
                        <div className="field">
                          <label>Entity ID (SP)</label>
                          <input className="fld mono" value="https://app.builtcrm.com/sso/saml/summitcontracting" readOnly />
                        </div>
                        <div className="field">
                          <label>ACS URL (Reply URL)</label>
                          <input className="fld mono" value="https://app.builtcrm.com/sso/saml/summitcontracting/acs" readOnly />
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                          <label>Metadata XML</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn ghost sm">{I.download} Download metadata</button>
                            <button className="btn primary sm" disabled>Upload IdP metadata</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Audit log</h3>
                        <p>An immutable record of every security-relevant action in your organization. Retained for 2 years.</p>
                      </div>
                      <button className="btn ghost sm">{I.download} Export log</button>
                    </div>

                    <div className="au-filter">
                      <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)}>
                        {auditEventTypes.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <input placeholder="Filter by actor..." value={auditActor} onChange={e => setAuditActor(e.target.value)} />
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: "var(--t3)", alignSelf: "center", fontFamily: "var(--fm)" }}>{filteredAudit.length} events</span>
                    </div>

                    {filteredAudit.length === 0 ? (
                      <div className="au-empty">No events match your filters.</div>
                    ) : (
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Actor</th>
                            <th>Event</th>
                            <th>Detail</th>
                            <th>IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAudit.map((e, idx) => (
                            <tr key={idx}>
                              <td style={{ color: "var(--t2)", fontSize: 12, fontFamily: "var(--fm)", whiteSpace: "nowrap" }}>{e.time}</td>
                              <td style={{ fontSize: 13 }}>{e.actor}</td>
                              <td><span className="au-ev">{e.event}</span></td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{e.detail}</td>
                              <td style={{ fontFamily: "var(--fm)", fontSize: 11.5, color: "var(--t3)", whiteSpace: "nowrap" }}>{e.ip}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
