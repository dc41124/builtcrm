import { useState } from "react";

/*
 * COMMERCIAL CLIENT PORTAL-SPECIFIC SETTINGS
 * ──────────────────────────────────────────
 * Covers commercial-client settings that do NOT live in the shared shell.
 *
 * Shared (see builtcrm_settings_shared_shell.jsx):
 *   - Profile, Security, Notifications, Appearance
 *
 * This file:
 *   - Company (client organization info — Riverside Dev Co)
 *   - Team members (users at the client org with per-person roles)
 *   - Payment methods (saved cards/ACH for paying draws through Stripe Checkout)
 *
 * Clients don't get Plan/Billing (the GC pays for BuiltCRM), SSO, or audit logs.
 * Language: "Approvals" and "Change Orders" — business-formal tone.
 */

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  building: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h0M9 13h0M9 17h0"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  card: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  bank: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-7 9 7M5 10v10h14V10M9 14v4M15 14v4M12 14v4"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  star: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
};

// ── Nav (commercial client portal, Settings active) ───────────
const nav = [
  { section: "Project", items: [
    { label: "Project Home" },
    { label: "Progress & Updates" },
    { label: "Photos" },
    { label: "Schedule" },
  ]},
  { section: "Decisions", items: [
    { label: "Approvals", badge: 2, bt: "blue" },
    { label: "Change Orders", badge: 1, bt: "warn" },
  ]},
  { section: "Financial", items: [
    { label: "Billing & Draws", badge: 1, bt: "warn" },
    { label: "Payment History" },
  ]},
  { section: "Communication", items: [
    { label: "Messages", badge: 2, bt: "blue" },
  ]},
  { section: "Account", items: [
    { label: "Settings", active: true },
  ]},
];

const user = { avatar: "RG", name: "Rachel Greyson", role: "Owner · Riverside Dev Co" };

// ── Settings tabs ──────────────────────────────────────────────
const settingsTabs = [
  { id: "company", label: "Company", icon: I.building, desc: "Your organization's profile and address" },
  { id: "team", label: "Team members", icon: I.users, desc: "Colleagues who access this project" },
  { id: "payment", label: "Payment methods", icon: I.card, desc: "Cards and bank accounts for paying draws" },
];

// Cross-refs (pointing to shared shell)
const crossRefs = [
  { id: "profile", label: "Profile", note: "Shared shell" },
  { id: "security", label: "Security", note: "Shared shell" },
  { id: "notifications", label: "Notifications", note: "Shared shell" },
  { id: "appearance", label: "Appearance", note: "Shared shell" },
];

// ── Company defaults ───────────────────────────────────────────
const companyDefaults = {
  displayName: "Riverside Dev Co",
  legalName: "Riverside Development Company, LLC",
  taxId: "94-3871450",
  industry: "Commercial Real Estate Development",
  companySize: "25–50 employees",
  website: "https://riversidedevco.com",
  phone: "+1 (415) 555-0240",
  addr1: "2180 Embarcadero",
  addr2: "Floor 4",
  city: "San Francisco",
  state: "CA",
  zip: "94111",
  country: "United States",
  billingContactName: "Marcus Blake",
  billingContactTitle: "Director of Finance",
  billingContactEmail: "ap@riversidedevco.com",
  billingContactPhone: "+1 (415) 555-0244",
  invoiceDelivery: "email+portal",
};

// ── Roles ──────────────────────────────────────────────────────
const roles = [
  { id: "owner", label: "Owner", desc: "Full access. Can manage the team, payment methods, and all project decisions." },
  { id: "approver", label: "Approver", desc: "Can approve change orders and mark decisions. View all project content." },
  { id: "billing_approver", label: "Billing Approver", desc: "Can approve draws and manage payment methods. View all project content." },
  { id: "viewer", label: "Viewer", desc: "Read-only access to project updates, documents, and financials. No approval authority." },
];

// ── Team members ───────────────────────────────────────────────
const membersInitial = [
  { id: 1, name: "Rachel Greyson", email: "rachel.greyson@riversidedevco.com", avatar: "RG", role: "owner", lastActive: "Active now", joined: "Jan 2024", you: true },
  { id: 2, name: "Marcus Blake", email: "marcus.blake@riversidedevco.com", avatar: "MB", role: "billing_approver", lastActive: "2 hours ago", joined: "Jan 2024" },
  { id: 3, name: "Priya Nair", email: "priya.nair@riversidedevco.com", avatar: "PN", role: "approver", lastActive: "Yesterday", joined: "Feb 2024" },
  { id: 4, name: "Evan Takahashi", email: "evan.t@riversidedevco.com", avatar: "ET", role: "viewer", lastActive: "3 days ago", joined: "Apr 2024" },
];
const pendingInvitesInitial = [
  { id: 201, email: "legal@riversidedevco.com", role: "viewer", sentBy: "Rachel Greyson", sent: "4 days ago" },
];

// ── Payment methods ────────────────────────────────────────────
const paymentMethodsInitial = [
  { id: 1, type: "card", brand: "Visa", last4: "4242", exp: "09/28", holder: "Riverside Dev Co", isDefault: true, addedOn: "Jan 12, 2024" },
  { id: 2, type: "ach", bank: "First Republic Bank", last4: "8391", accountType: "Business checking", holder: "Riverside Development Co, LLC", isDefault: false, addedOn: "Aug 4, 2025", verified: true },
];

// ── Component ──────────────────────────────────────────────────
export default function CommercialClientSettings() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("company");

  // Company
  const [company, setCompany] = useState(companyDefaults);
  const [cDirty, setCDirty] = useState(false);
  const [cSaved, setCSaved] = useState(false);
  const updateCo = (k, v) => { setCompany({ ...company, [k]: v }); setCDirty(true); setCSaved(false); };
  const saveCo = () => { setCDirty(false); setCSaved(true); setTimeout(() => setCSaved(false), 2400); };
  const discardCo = () => { setCompany(companyDefaults); setCDirty(false); };

  // Team
  const [members, setMembers] = useState(membersInitial);
  const [invites, setInvites] = useState(pendingInvitesInitial);
  const [memberSearch, setMemberSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "approver" });
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [roleExplainer, setRoleExplainer] = useState(false);

  const changeMemberRole = (id, newRole) => {
    const ownerCount = members.filter(m => m.role === "owner").length;
    const target = members.find(m => m.id === id);
    if (target.you && target.role === "owner" && newRole !== "owner" && ownerCount === 1) {
      alert("You're the only Owner. Promote someone else before changing your own role.");
      return;
    }
    setMembers(members.map(m => m.id === id ? { ...m, role: newRole } : m));
  };
  const sendInvite = () => {
    if (!inviteForm.email) return;
    setInvites([...invites, { id: Date.now(), email: inviteForm.email, role: inviteForm.role, sentBy: "Rachel Greyson", sent: "Just now" }]);
    setInviteForm({ email: "", role: "approver" });
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

  // Payment methods
  const [methods, setMethods] = useState(paymentMethodsInitial);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethodType, setNewMethodType] = useState("card");
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [autopayThreshold, setAutopayThreshold] = useState("50000");
  const [removeMethodConfirm, setRemoveMethodConfirm] = useState(null);

  const setDefaultMethod = (id) => setMethods(methods.map(m => ({ ...m, isDefault: m.id === id })));
  const removeMethod = (id) => {
    setMethods(methods.filter(m => m.id !== id));
    setRemoveMethodConfirm(null);
  };
  const mockAddMethod = () => {
    // In production this launches Stripe Checkout; for demo we add a placeholder.
    const newOne = newMethodType === "card"
      ? { id: Date.now(), type: "card", brand: "Mastercard", last4: "5678", exp: "06/29", holder: "Riverside Dev Co", isDefault: false, addedOn: "Just now" }
      : { id: Date.now(), type: "ach", bank: "Silicon Valley Bank", last4: "2014", accountType: "Business checking", holder: "Riverside Development Co, LLC", isDefault: false, addedOn: "Just now", verified: false };
    setMethods([...methods, newOne]);
    setShowAddMethod(false);
  };

  const activeTab = settingsTabs.find(t => t.id === tab);

  return (
    <div className={`cs ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.cs{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#3178b9;--ac-h:#2968a3;--ac-s:#e8f1fa;--ac-t:#276299;--ac-m:#a3c8e8;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(49,120,185,.15);
  --sbw:260px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.cs.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#4a94d4;--ac-h:#3d82c0;--ac-s:#141f2c;--ac-t:#6cb0ee;--ac-m:#2e4a60;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shri:0 0 0 3px rgba(74,148,212,.2);
}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none;color:inherit}
input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1a3a5c,var(--ac));display:grid;place-items:center;flex-shrink:0}
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
.s-user-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3178b9,#5a9fd4);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.cs.dk .s-user-av{background:linear-gradient(135deg,#4a94d4,#6cb0ee)}
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

/* Page header — commercial client uses 24px/820 per design system */
.pg-hdr{margin-bottom:22px}
.pg-hdr h2{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em}
.pg-sub{font-size:13.5px;color:var(--t2);margin-top:4px;font-weight:520}

/* Cross-ref strip */
.xrefs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px;padding:10px 12px;background:var(--s1);border:1px dashed var(--s3);border-radius:var(--r-l)}
.xrefs-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:4px 6px 4px 0;margin-right:4px}
.xref{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--s2);color:var(--t2);display:inline-flex;align-items:center;gap:5px}
.xref-note{font-size:10px;color:var(--t3);font-weight:500}

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
.logo-sq{width:88px;height:88px;border-radius:var(--r-l);background:linear-gradient(135deg,#1a3a5c,var(--ac));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:26px;font-weight:800;letter-spacing:-.04em;flex-shrink:0}

/* Table */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:10px 12px;border-bottom:1px solid var(--s3)}
.tbl td{padding:14px 12px;border-bottom:1px solid var(--s2);font-size:13.5px;color:var(--t1);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:var(--sh)}

.m-row{display:flex;align-items:center;gap:12px}
.m-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700;flex-shrink:0}
.m-name{font-family:var(--fd);font-size:13.5px;font-weight:650;letter-spacing:-.01em;display:flex;align-items:center;gap:6px}
.m-email{font-size:12px;color:var(--t3);margin-top:2px;font-weight:500}
.you-tag{font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-family:var(--fd);letter-spacing:.03em}

/* Role select */
.role-sel{height:32px;padding:0 28px 0 10px;border-radius:var(--r-s);border:1px solid var(--s3);background:var(--s1);font-size:12.5px;color:var(--t1);outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;font-family:var(--fb);background-image:url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c958a' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.role-sel:focus{border-color:var(--ac);box-shadow:var(--shri)}

/* Search */
.sb{position:relative;max-width:320px}
.sb input{height:36px;padding:0 12px 0 34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:13px;color:var(--t1);outline:none;width:100%}
.sb input:focus{border-color:var(--ac);box-shadow:var(--shri)}
.sb .ic{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--t3);pointer-events:none}

/* Role explainer */
.re-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:12px}
.re-item{padding:12px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1)}
.re-ttl{font-family:var(--fd);font-size:13px;font-weight:650;margin-bottom:4px}
.re-ds{font-size:11.5px;color:var(--t3);line-height:1.45;font-weight:500}

/* Invite panel */
.inv-panel{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:18px;margin-bottom:12px}
.inv-grid{display:grid;grid-template-columns:2fr 1fr auto auto;gap:10px;align-items:end}
@media(max-width:760px){.inv-grid{grid-template-columns:1fr;gap:12px}}

/* Pending invites */
.pi-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--s2);border:1px dashed var(--s3);border-radius:var(--r-m);margin-bottom:6px;flex-wrap:wrap}
.pi-row:last-child{margin-bottom:0}
.pi-email{font-family:var(--fm);font-size:12.5px;font-weight:600;color:var(--t1)}
.pi-meta{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:500}

/* Remove dialog */
.rm-dialog{background:var(--dg-s);border:1px solid var(--dg);border-radius:var(--r-l);padding:14px;margin:4px 0 0 0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.rm-dialog-l{font-size:12.5px;color:var(--dg);font-weight:580;flex:1;min-width:200px}

/* Payment methods */
.pm-banner{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pm-banner-ic{width:34px;height:34px;border-radius:var(--r-m);background:var(--ac);color:white;display:grid;place-items:center;flex-shrink:0}
.pm-banner-body{flex:1;min-width:240px}
.pm-banner-ttl{font-family:var(--fd);font-size:13.5px;font-weight:650;color:var(--ac-t)}
.pm-banner-ds{font-size:12px;color:var(--ac-t);margin-top:2px;font-weight:520;opacity:.9;line-height:1.5}

.pm-card{display:flex;align-items:center;gap:16px;padding:16px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);margin-bottom:10px;transition:all var(--df)}
.pm-card.default{border-color:var(--ac-m);background:var(--ac-s)}
.pm-card:last-child{margin-bottom:0}
.pm-brand{width:56px;height:38px;border-radius:var(--r-s);display:grid;place-items:center;color:white;font-family:var(--fd);font-size:11px;font-weight:800;letter-spacing:.05em;flex-shrink:0}
.pm-brand.visa{background:linear-gradient(135deg,#1a1f71,#0f1551)}
.pm-brand.mc{background:linear-gradient(135deg,#eb001b,#f79e1b)}
.pm-brand.ach{background:linear-gradient(135deg,#1e6b46,#2d8a5e);font-size:13px}
.pm-body{flex:1;min-width:0}
.pm-num{font-family:var(--fm);font-size:13.5px;font-weight:600;letter-spacing:.02em;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pm-meta{font-size:11.5px;color:var(--t3);margin-top:3px;font-weight:500}
.pm-acts{display:flex;gap:6px;flex-shrink:0}

/* Add method */
.add-method-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
@media(max-width:520px){.add-method-choice{grid-template-columns:1fr}}
.mc-card{padding:14px;border:1.5px solid var(--s3);border-radius:var(--r-l);background:var(--s1);cursor:pointer;transition:all var(--df);display:flex;align-items:flex-start;gap:12px}
.mc-card:hover{border-color:var(--s4);background:var(--sh)}
.mc-card.on{border-color:var(--ac);background:var(--ac-s)}
.mc-card-ic{width:36px;height:36px;border-radius:var(--r-m);background:var(--s2);color:var(--t2);display:grid;place-items:center;flex-shrink:0}
.mc-card.on .mc-card-ic{background:var(--ac);color:white}
.mc-card-body{flex:1;min-width:0}
.mc-card-ttl{font-family:var(--fd);font-size:13.5px;font-weight:650;letter-spacing:-.01em}
.mc-card-ds{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:500;line-height:1.4}

.stripe-note{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--s2);border-radius:var(--r-m);font-size:11.5px;color:var(--t2);font-weight:500}

/* Sec row (for autopay) */
.sec-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--s2)}
.sec-row:last-child{border-bottom:none}
.sec-row:first-child{padding-top:0}
.sec-row-body{flex:1;min-width:0}
.sec-row-ttl{font-family:var(--fd);font-size:14px;font-weight:650;letter-spacing:-.01em;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sec-row-ds{font-size:12.5px;color:var(--t2);margin-top:4px;line-height:1.45;font-weight:500}
.sec-row-act{flex-shrink:0}

.page-anim{animation:fadeIn .24s var(--e)}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Sidebar ───────────────────────── */}
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 80 80" width="16" height="16">
              <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
              <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
              <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
            </svg>
          </div>
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">Client Portal</div>
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
            <span>Riverside Tower Fit-Out</span>
            <span className="sep">/</span>
            <span className="cur">Settings</span>
            <span className="sep">/</span>
            <span className="cur">{activeTab.label}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</button>
            <button className="ib">{I.bell}</button>
            <div className="av">{user.avatar}</div>
          </div>
        </div>

        <div className="ct">
          <div className="pg-hdr">
            <h2>Account settings</h2>
            <div className="pg-sub">Manage your company, team, and how you pay draws on this project.</div>
          </div>

          {/* Cross-refs strip */}
          <div className="xrefs">
            <span className="xrefs-lbl">Also available:</span>
            {crossRefs.map(r => (
              <span key={r.id} className="xref">
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

              {/* ═══════ COMPANY ═══════ */}
              {tab === "company" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Company logo</h3>
                        <p>Shown in your team's portal and on your side of project correspondence.</p>
                      </div>
                    </div>
                    <div className="logo-up">
                      <div className="logo-sq">RDC</div>
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
                        <p>Your organization's details as they appear on contracts, invoices, and payment records.</p>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Display name</label>
                        <input className="fld" value={company.displayName} onChange={e => updateCo("displayName", e.target.value)} />
                        <div className="field-help">What your team sees across the portal</div>
                      </div>
                      <div className="field">
                        <label>Legal name</label>
                        <input className="fld" value={company.legalName} onChange={e => updateCo("legalName", e.target.value)} />
                        <div className="field-help">Used on contracts and payment receipts</div>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Tax ID / EIN</label>
                        <input className="fld mono" value={company.taxId} onChange={e => updateCo("taxId", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Website</label>
                        <input className="fld" type="url" value={company.website} onChange={e => updateCo("website", e.target.value)} />
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Industry</label>
                        <select className="fld" value={company.industry} onChange={e => updateCo("industry", e.target.value)}>
                          <option>Commercial Real Estate Development</option>
                          <option>Corporate Owner / Occupier</option>
                          <option>Healthcare / Institutional</option>
                          <option>Hospitality</option>
                          <option>Retail / Mixed-Use</option>
                          <option>Industrial / Logistics</option>
                          <option>Education</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Company size</label>
                        <select className="fld" value={company.companySize} onChange={e => updateCo("companySize", e.target.value)}>
                          <option>1–10 employees</option>
                          <option>11–25 employees</option>
                          <option>25–50 employees</option>
                          <option>50–250 employees</option>
                          <option>250+ employees</option>
                        </select>
                      </div>
                    </div>

                    <div className="field">
                      <label>Main phone</label>
                      <input className="fld" type="tel" value={company.phone} onChange={e => updateCo("phone", e.target.value)} />
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Business address</h3>
                        <p>Used on invoices, payment receipts, and project documentation.</p>
                      </div>
                    </div>
                    <div className="field">
                      <label>Street address</label>
                      <input className="fld" value={company.addr1} onChange={e => updateCo("addr1", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Suite / floor (optional)</label>
                      <input className="fld" value={company.addr2} onChange={e => updateCo("addr2", e.target.value)} />
                    </div>
                    <div className="fld-row-3">
                      <div className="field">
                        <label>City</label>
                        <input className="fld" value={company.city} onChange={e => updateCo("city", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>State / province</label>
                        <input className="fld" value={company.state} onChange={e => updateCo("state", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>ZIP / postal</label>
                        <input className="fld mono" value={company.zip} onChange={e => updateCo("zip", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Country</label>
                      <select className="fld" value={company.country} onChange={e => updateCo("country", e.target.value)}>
                        <option>United States</option>
                        <option>Canada</option>
                        <option>Mexico</option>
                      </select>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Billing contact</h3>
                        <p>Who receives invoice notices, payment confirmations, and draw-ready alerts.</p>
                      </div>
                    </div>
                    <div className="fld-row">
                      <div className="field">
                        <label>Contact name</label>
                        <input className="fld" value={company.billingContactName} onChange={e => updateCo("billingContactName", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Title / role</label>
                        <input className="fld" value={company.billingContactTitle} onChange={e => updateCo("billingContactTitle", e.target.value)} />
                      </div>
                    </div>
                    <div className="fld-row">
                      <div className="field">
                        <label>Email</label>
                        <input className="fld" type="email" value={company.billingContactEmail} onChange={e => updateCo("billingContactEmail", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Phone</label>
                        <input className="fld" type="tel" value={company.billingContactPhone} onChange={e => updateCo("billingContactPhone", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Invoice delivery</label>
                      <select className="fld" value={company.invoiceDelivery} onChange={e => updateCo("invoiceDelivery", e.target.value)}>
                        <option value="email+portal">Email + portal (recommended)</option>
                        <option value="email">Email only</option>
                        <option value="portal">Portal only</option>
                      </select>
                      <div className="field-help">How you receive invoice PDFs and payment receipts</div>
                    </div>
                  </div>

                  {(cDirty || cSaved) && (
                    <div className={`save-bar ${cSaved ? "success" : "dirty"}`}>
                      <div className="save-bar-l">
                        <span className="save-dot" />
                        {cSaved ? "Company info saved" : "You have unsaved changes"}
                      </div>
                      {!cSaved && (
                        <div className="save-actions">
                          <button className="btn ghost sm" onClick={discardCo}>Discard</button>
                          <button className="btn primary sm" onClick={saveCo}>{I.check} Save changes</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══════ TEAM MEMBERS ═══════ */}
              {tab === "team" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Roles</h3>
                        <p>Who can do what on this project. Only Owners can change roles or remove members.</p>
                      </div>
                      <button className="btn ghost sm" onClick={() => setRoleExplainer(!roleExplainer)}>
                        {roleExplainer ? "Hide details" : "Show details"}
                      </button>
                    </div>
                    {roleExplainer && (
                      <div className="re-list page-anim">
                        {roles.map(r => (
                          <div key={r.id} className="re-item">
                            <div className="re-ttl">{r.label}</div>
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
                        <p>Colleagues from Riverside Dev Co with access to the Riverside Tower Fit-Out project.</p>
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
                            <input className="fld" type="email" placeholder="colleague@riversidedevco.com" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
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
                                    {m.you && <span className="you-tag">You</span>}
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
                            <td style={{ color: "var(--t3)", fontSize: 12.5 }}>{m.lastActive}</td>
                            <td style={{ textAlign: "right" }}>
                              {!m.you && (
                                <button className="btn ghost sm" style={{ color: "var(--dg)" }} onClick={() => setRemoveConfirm(m.id)}>Remove</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredMembers.length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--t3)", fontSize: 13 }}>No members match your search.</td></tr>
                        )}
                      </tbody>
                    </table>

                    {removeConfirm && (
                      <div className="rm-dialog page-anim" style={{ marginTop: 12 }}>
                        <div className="rm-dialog-l">
                          Remove <strong>{members.find(m => m.id === removeConfirm)?.name}</strong> from this project? They'll lose access immediately — project history is preserved.
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
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
                          <h3>Pending invites</h3>
                          <p>Invitations that haven't been accepted yet.</p>
                        </div>
                      </div>
                      {invites.map(inv => (
                        <div key={inv.id} className="pi-row">
                          <div style={{ minWidth: 0 }}>
                            <div className="pi-email">{inv.email}</div>
                            <div className="pi-meta">
                              {roles.find(r => r.id === inv.role)?.label} · Invited by {inv.sentBy} · {inv.sent}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn ghost sm">Resend</button>
                            <button className="btn ghost sm" onClick={() => cancelInvite(inv.id)}>Cancel</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ═══════ PAYMENT METHODS ═══════ */}
              {tab === "payment" && (
                <>
                  <div className="pm-banner">
                    <div className="pm-banner-ic">{I.lock}</div>
                    <div className="pm-banner-body">
                      <div className="pm-banner-ttl">Secured by Stripe</div>
                      <div className="pm-banner-ds">
                        Cards and bank accounts are stored and charged by Stripe — BuiltCRM never sees your full card or account numbers. Methods here are used to pay draws issued by Summit Contracting on this project.
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Saved methods ({methods.length})</h3>
                        <p>The default method is used when you one-click pay a draw. You can always choose another at checkout.</p>
                      </div>
                      <button className="btn primary sm" onClick={() => setShowAddMethod(!showAddMethod)}>
                        {showAddMethod ? "Cancel" : <>{I.plus} Add method</>}
                      </button>
                    </div>

                    {showAddMethod && (
                      <div className="page-anim" style={{ marginBottom: 16 }}>
                        <div className="add-method-choice">
                          <button type="button" className={`mc-card ${newMethodType === "card" ? "on" : ""}`} onClick={() => setNewMethodType("card")}>
                            <div className="mc-card-ic">{I.card}</div>
                            <div className="mc-card-body">
                              <div className="mc-card-ttl">Credit or debit card</div>
                              <div className="mc-card-ds">Instant. 2.9% + 30¢ processing fee on draws over $10K.</div>
                            </div>
                          </button>
                          <button type="button" className={`mc-card ${newMethodType === "ach" ? "on" : ""}`} onClick={() => setNewMethodType("ach")}>
                            <div className="mc-card-ic">{I.bank}</div>
                            <div className="mc-card-body">
                              <div className="mc-card-ttl">Bank account (ACH)</div>
                              <div className="mc-card-ds">3–5 business day settlement. 0.8% fee, capped at $5.</div>
                            </div>
                          </button>
                        </div>
                        <div className="stripe-note" style={{ marginBottom: 10 }}>
                          {I.lock}
                          <span>You'll be redirected to Stripe's secure form to enter details.</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="btn ghost sm" onClick={() => setShowAddMethod(false)}>Cancel</button>
                          <button className="btn primary sm" onClick={mockAddMethod}>
                            Continue to Stripe
                          </button>
                        </div>
                      </div>
                    )}

                    {methods.map(m => (
                      <div key={m.id} className={`pm-card ${m.isDefault ? "default" : ""}`}>
                        {m.type === "card" ? (
                          <div className={`pm-brand ${m.brand === "Visa" ? "visa" : "mc"}`}>{m.brand.toUpperCase()}</div>
                        ) : (
                          <div className="pm-brand ach">{I.bank}</div>
                        )}
                        <div className="pm-body">
                          <div className="pm-num">
                            {m.type === "card"
                              ? <>•••• •••• •••• {m.last4}</>
                              : <>{m.bank} · •••• {m.last4}</>
                            }
                            {m.isDefault && <span className="pill ac">{I.star} Default</span>}
                            {m.type === "ach" && !m.verified && <span className="pill warn">Verification pending</span>}
                          </div>
                          <div className="pm-meta">
                            {m.type === "card"
                              ? <>{m.holder} · Expires {m.exp} · Added {m.addedOn}</>
                              : <>{m.accountType} · {m.holder} · Added {m.addedOn}</>
                            }
                          </div>
                        </div>
                        <div className="pm-acts">
                          {!m.isDefault && <button className="btn ghost sm" onClick={() => setDefaultMethod(m.id)}>Make default</button>}
                          <button className="btn ghost sm" onClick={() => setRemoveMethodConfirm(m.id)} disabled={m.isDefault && methods.length > 1} title={m.isDefault && methods.length > 1 ? "Set another method as default first" : "Remove"}>
                            {I.x}
                          </button>
                        </div>
                      </div>
                    ))}

                    {removeMethodConfirm && (() => {
                      const m = methods.find(x => x.id === removeMethodConfirm);
                      if (!m) return null;
                      return (
                        <div className="rm-dialog page-anim" style={{ marginTop: 12 }}>
                          <div className="rm-dialog-l">
                            Remove this {m.type === "card" ? "card" : "bank account"} ending in <strong>{m.last4}</strong>? You can always add it back later.
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn ghost sm" onClick={() => setRemoveMethodConfirm(null)}>Cancel</button>
                            <button className="btn danger sm" onClick={() => removeMethod(removeMethodConfirm)}>Remove method</button>
                          </div>
                        </div>
                      );
                    })()}

                    {methods.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
                        No payment methods yet. Add one to pay draws with a single click.
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Autopay</h3>
                        <p>Optionally auto-approve small draws below a threshold you set. You'll still receive notifications.</p>
                      </div>
                    </div>
                    <div className="sec-row">
                      <div className="sec-row-body">
                        <div className="sec-row-ttl">
                          Enable autopay
                          {autopayEnabled && <span className="pill ok">On</span>}
                        </div>
                        <div className="sec-row-ds">
                          When on, draws approved by a Billing Approver or Owner will be charged automatically if they're under your threshold. Larger draws always require manual approval at checkout.
                        </div>
                      </div>
                      <div className="sec-row-act">
                        <div className={`sw ${autopayEnabled ? "on" : ""}`} onClick={() => setAutopayEnabled(!autopayEnabled)} />
                      </div>
                    </div>
                    {autopayEnabled && (
                      <div className="sec-row page-anim">
                        <div className="sec-row-body" style={{ maxWidth: 360 }}>
                          <div className="sec-row-ttl">Autopay threshold</div>
                          <div className="sec-row-ds" style={{ marginBottom: 10 }}>Draws at or below this amount will be auto-charged.</div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Maximum amount (USD)</label>
                            <input className="fld mono" type="number" value={autopayThreshold} onChange={e => setAutopayThreshold(e.target.value)} />
                          </div>
                        </div>
                      </div>
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
