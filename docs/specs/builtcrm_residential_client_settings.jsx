import { useState } from "react";

/*
 * RESIDENTIAL CLIENT PORTAL-SPECIFIC SETTINGS
 * ───────────────────────────────────────────
 * Covers residential-client settings that do NOT live in the shared shell.
 *
 * Shared (see builtcrm_settings_shared_shell.jsx):
 *   - Profile, Security, Notifications, Appearance
 *
 * This file:
 *   - Household profile (your home, your details, contact preferences)
 *   - Co-owner access (household-scoped team with simple 2-role model)
 *   - Payment methods (saved cards/ACH for paying draws through Stripe Checkout)
 *
 * Differences from commercial client settings:
 *   - Warmer, educational tone. "Your home" not "Your project".
 *   - "Decisions" language — NO "Approvals" or "Change Orders".
 *   - 2-role co-owner model: Co-owner (full) + Viewer (read-only). No separate
 *     approver/billing-approver distinction — residential is simpler.
 *   - No role explainer panel — 2 roles explained inline in a help strip.
 *   - Autopay threshold defaults lower ($5K) — residential draws are smaller.
 *   - No SSO, no audit logs, no plan/billing — the GC pays for BuiltCRM.
 */

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>,
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
  bulb: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>,
};

// ── Nav (residential client portal, Settings active) ───────────
const nav = [
  { section: "Your project", items: [
    { label: "Project Home" },
    { label: "Progress & Photos" },
    { label: "Selections", badge: 3, bt: "amber" },
    { label: "Schedule" },
  ]},
  { section: "Decisions", items: [
    { label: "Scope changes", badge: 1, bt: "amber" },
    { label: "Confirmed choices" },
  ]},
  { section: "Payments & docs", items: [
    { label: "Budget" },
    { label: "Documents" },
  ]},
  { section: "Messages", items: [
    { label: "Inbox", badge: 1, bt: "blue" },
  ]},
  { section: "Account", items: [
    { label: "Settings", active: true },
  ]},
];

const user = { avatar: "JC", name: "Jennifer Chen", role: "Homeowner" };

// ── Settings tabs ──────────────────────────────────────────────
const settingsTabs = [
  { id: "household", label: "Household profile", icon: I.home, desc: "Your home, your details, and how we reach you" },
  { id: "access",    label: "Co-owner access",  icon: I.users, desc: "Who else in your household can see and decide" },
  { id: "payment",   label: "Payment methods",  icon: I.card, desc: "Cards and bank accounts for paying draws" },
];

// Cross-refs (pointing to shared shell)
const crossRefs = [
  { id: "profile",       label: "Profile",       note: "Shared shell" },
  { id: "security",      label: "Security",      note: "Shared shell" },
  { id: "notifications", label: "Notifications", note: "Shared shell" },
  { id: "appearance",    label: "Appearance",    note: "Shared shell" },
];

// ── Household defaults ─────────────────────────────────────────
const householdDefaults = {
  projectName: "Chen Residence",
  addr1: "14 Maple Lane",
  addr2: "",
  city: "Palo Alto",
  state: "CA",
  zip: "94306",
  country: "United States",
  // Your details (primary homeowner)
  legalName: "Jennifer Chen",
  preferredName: "Jen",
  email: "jennifer.chen@gmail.com",
  phone: "+1 (650) 555-0187",
  // Contact preferences
  preferredChannel: "email+sms",
  preferredTime: "anytime",
  // Emergency contact (for site-access or after-hours issues)
  emergencyName: "Michael Chen",
  emergencyRelation: "Spouse",
  emergencyPhone: "+1 (650) 555-0188",
};

// ── Roles (residential — just 2) ───────────────────────────────
const roles = [
  { id: "co_owner", label: "Co-owner", desc: "Full access. Can make decisions, approve scope changes, manage payment methods, and invite others." },
  { id: "viewer",   label: "Viewer",   desc: "Read-only. Can see progress, photos, documents, and the budget. Can't approve or pay anything." },
];

// ── Household members ──────────────────────────────────────────
const membersInitial = [
  { id: 1, name: "Jennifer Chen", email: "jennifer.chen@gmail.com", avatar: "JC", role: "co_owner", lastActive: "Active now", joined: "Feb 2026", you: true },
  { id: 2, name: "Michael Chen",  email: "michael.chen@gmail.com",  avatar: "MC", role: "co_owner", lastActive: "Yesterday",    joined: "Feb 2026" },
];
const pendingInvitesInitial = [
  // Start empty — residential households rarely have pending invites at steady state.
];

// ── Payment methods ────────────────────────────────────────────
const paymentMethodsInitial = [
  { id: 1, type: "card", brand: "Visa",      last4: "4242", exp: "09/28", holder: "Jennifer Chen",             isDefault: true,  addedOn: "Feb 12, 2026" },
  { id: 2, type: "ach",  bank: "Chase Bank", last4: "8391", accountType: "Joint checking", holder: "Jennifer & Michael Chen", isDefault: false, addedOn: "Feb 20, 2026", verified: true },
];

// ── Component ──────────────────────────────────────────────────
export default function ResidentialClientSettings() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("household");

  // Household
  const [household, setHousehold] = useState(householdDefaults);
  const [hDirty, setHDirty] = useState(false);
  const [hSaved, setHSaved] = useState(false);
  const updateH = (k, v) => { setHousehold({ ...household, [k]: v }); setHDirty(true); setHSaved(false); };
  const saveH = () => { setHDirty(false); setHSaved(true); setTimeout(() => setHSaved(false), 2400); };
  const discardH = () => { setHousehold(householdDefaults); setHDirty(false); };

  // Co-owner access
  const [members, setMembers] = useState(membersInitial);
  const [invites, setInvites] = useState(pendingInvitesInitial);
  const [memberSearch, setMemberSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "viewer" });
  const [removeConfirm, setRemoveConfirm] = useState(null);

  const changeMemberRole = (id, newRole) => {
    const coOwnerCount = members.filter(m => m.role === "co_owner").length;
    const target = members.find(m => m.id === id);
    if (target.you && target.role === "co_owner" && newRole !== "co_owner" && coOwnerCount === 1) {
      alert("You're the only Co-owner. Add another Co-owner before changing your own role.");
      return;
    }
    setMembers(members.map(m => m.id === id ? { ...m, role: newRole } : m));
  };
  const sendInvite = () => {
    if (!inviteForm.email) return;
    setInvites([...invites, { id: Date.now(), email: inviteForm.email, role: inviteForm.role, sentBy: "Jennifer Chen", sent: "Just now" }]);
    setInviteForm({ email: "", role: "viewer" });
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
  const [autopayThreshold, setAutopayThreshold] = useState("5000");
  const [removeMethodConfirm, setRemoveMethodConfirm] = useState(null);

  const setDefaultMethod = (id) => setMethods(methods.map(m => ({ ...m, isDefault: m.id === id })));
  const removeMethod = (id) => {
    setMethods(methods.filter(m => m.id !== id));
    setRemoveMethodConfirm(null);
  };
  const mockAddMethod = () => {
    // In production this launches Stripe Checkout; for demo we add a placeholder.
    const newOne = newMethodType === "card"
      ? { id: Date.now(), type: "card", brand: "Mastercard", last4: "5678", exp: "06/29", holder: "Jennifer Chen", isDefault: false, addedOn: "Just now" }
      : { id: Date.now(), type: "ach", bank: "Wells Fargo", last4: "2014", accountType: "Personal checking", holder: "Jennifer Chen", isDefault: false, addedOn: "Just now", verified: false };
    setMethods([...methods, newOne]);
    setShowAddMethod(false);
  };

  const activeTab = settingsTabs.find(t => t.id === tab);

  return (
    <div className={`rc ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.rc{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#2a7f6f;--ac-h:#1d6b5d;--ac-s:#e6f5f2;--ac-t:#1d6b5d;--ac-m:#8ac4b4;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(42,127,111,.15);
  --sbw:256px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.rc.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shri:0 0 0 3px rgba(61,168,142,.2);
}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none;color:inherit}
input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1d6b5d,var(--ac));display:grid;place-items:center;flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.sb-wc{margin:12px 12px 0;padding:14px;border:1px solid var(--s3);border-radius:var(--r-l);background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%)}
.sb-wc h4{font-family:var(--fd);font-size:13px;font-weight:650;margin-bottom:2px;letter-spacing:-.01em}
.sb-wc p{font-size:11.5px;color:var(--t2);line-height:1.4;font-weight:500}
.s-nav{flex:1;overflow-y:auto;padding:10px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer;position:relative}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--sa);color:var(--t1);font-weight:650}
.ni.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--ac)}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.amber{background:var(--wr-s);color:var(--wr-t)}
.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px}
.s-user-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#2a7f6f,#4caf7a);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.rc.dk .s-user-av{background:linear-gradient(135deg,#3da88e,#5ec4a4)}
.s-user-name{font-size:13px;font-weight:580;color:var(--t1)}.s-user-role{font-size:11px;color:var(--t3);margin-top:1px}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(238,240,243,.85);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.rc.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px 32px 40px;flex:1;max-width:1200px;width:100%}

/* Page header — client uses 24px/820 per design system */
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
.btn.primary{background:var(--ac);color:white;border:none;box-shadow:0 1px 4px rgba(42,127,111,.25)}.btn.primary:hover{background:var(--ac-h);box-shadow:var(--shmd)}
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

/* Home card (shown on Household tab) */
.home-card{display:flex;gap:16px;align-items:center;padding:18px;background:linear-gradient(135deg,var(--ac-s) 0%,var(--s1) 65%);border:1px solid var(--ac-m);border-radius:var(--r-l);margin-bottom:16px}
.home-icon{width:56px;height:56px;border-radius:var(--r-l);background:linear-gradient(135deg,#1d6b5d,var(--ac));color:white;display:grid;place-items:center;flex-shrink:0}
.home-body{flex:1;min-width:0}
.home-ttl{font-family:var(--fd);font-size:15px;font-weight:700;letter-spacing:-.01em;color:var(--ac-t)}
.home-ds{font-size:12.5px;color:var(--t2);margin-top:3px;font-weight:520;line-height:1.45}

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

/* Role hint strip (residential — replaces commercial's full role explainer) */
.role-hint{display:flex;gap:12px;padding:14px 16px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);margin-bottom:16px;align-items:flex-start}
.role-hint-ic{width:28px;height:28px;border-radius:var(--r-s);background:var(--ac);color:white;display:grid;place-items:center;flex-shrink:0}
.role-hint-body{flex:1;min-width:0;font-size:12.5px;color:var(--ac-t);line-height:1.5;font-weight:520}
.role-hint-body strong{font-family:var(--fd);font-weight:700}

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
.pm-brand.ach{background:linear-gradient(135deg,#1d6b5d,#2a7f6f);font-size:13px}
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
            <div className="brand-ctx">Homeowner Portal</div>
          </div>
        </div>

        <div className="sb-wc">
          <h4>14 Maple Lane</h4>
          <p>Interior finishes · On track</p>
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
            <span>Your Home</span>
            <span className="sep">›</span>
            <span>14 Maple Lane</span>
            <span className="sep">›</span>
            <span className="cur">Settings</span>
            <span className="sep">›</span>
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
            <div className="pg-sub">Manage your household info, who has access, and how you pay draws.</div>
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

              {/* ═══════ HOUSEHOLD PROFILE ═══════ */}
              {tab === "household" && (
                <>
                  <div className="home-card">
                    <div className="home-icon">{I.home}</div>
                    <div className="home-body">
                      <div className="home-ttl">{household.projectName} · {household.addr1}</div>
                      <div className="home-ds">This is your home — the address where your builder is working. Keep it accurate so inspections, deliveries, and payment receipts go to the right place.</div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Your home</h3>
                        <p>The address of the home being built or renovated. Also used on your invoices and payment receipts.</p>
                      </div>
                    </div>

                    <div className="field">
                      <label>Project nickname</label>
                      <input className="fld" value={household.projectName} onChange={e => updateH("projectName", e.target.value)} />
                      <div className="field-help">Shown across the portal — e.g. "Chen Residence" or "Maple Lane Remodel"</div>
                    </div>

                    <div className="field">
                      <label>Street address</label>
                      <input className="fld" value={household.addr1} onChange={e => updateH("addr1", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Apartment, suite, or unit (optional)</label>
                      <input className="fld" value={household.addr2} onChange={e => updateH("addr2", e.target.value)} />
                    </div>
                    <div className="fld-row-3">
                      <div className="field">
                        <label>City</label>
                        <input className="fld" value={household.city} onChange={e => updateH("city", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>State / province</label>
                        <input className="fld" value={household.state} onChange={e => updateH("state", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>ZIP / postal</label>
                        <input className="fld mono" value={household.zip} onChange={e => updateH("zip", e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Country</label>
                      <select className="fld" value={household.country} onChange={e => updateH("country", e.target.value)}>
                        <option>United States</option>
                        <option>Canada</option>
                        <option>Mexico</option>
                      </select>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Your details</h3>
                        <p>Your personal info as the primary homeowner on this project.</p>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Legal name</label>
                        <input className="fld" value={household.legalName} onChange={e => updateH("legalName", e.target.value)} />
                        <div className="field-help">As it appears on your contract</div>
                      </div>
                      <div className="field">
                        <label>Preferred name</label>
                        <input className="fld" value={household.preferredName} onChange={e => updateH("preferredName", e.target.value)} />
                        <div className="field-help">What your builder calls you in messages</div>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Email</label>
                        <input className="fld" type="email" value={household.email} onChange={e => updateH("email", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Phone</label>
                        <input className="fld" type="tel" value={household.phone} onChange={e => updateH("phone", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>How we reach you</h3>
                        <p>Your preferences for updates, questions, and alerts from your builder.</p>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Preferred channel</label>
                        <select className="fld" value={household.preferredChannel} onChange={e => updateH("preferredChannel", e.target.value)}>
                          <option value="email+sms">Email + text (recommended)</option>
                          <option value="email">Email only</option>
                          <option value="sms">Text only</option>
                          <option value="portal">In-portal notifications only</option>
                        </select>
                        <div className="field-help">Urgent items (safety, inspections) still come through all channels</div>
                      </div>
                      <div className="field">
                        <label>Best time to reach you</label>
                        <select className="fld" value={household.preferredTime} onChange={e => updateH("preferredTime", e.target.value)}>
                          <option value="anytime">Anytime during business hours</option>
                          <option value="morning">Mornings (before 11 AM)</option>
                          <option value="midday">Midday (11 AM – 2 PM)</option>
                          <option value="afternoon">Afternoons (2 PM – 5 PM)</option>
                          <option value="evening">Evenings (after 5 PM)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Emergency contact</h3>
                        <p>Someone your builder can reach if there's an after-hours site issue and they can't get you.</p>
                      </div>
                    </div>

                    <div className="fld-row-3">
                      <div className="field">
                        <label>Name</label>
                        <input className="fld" value={household.emergencyName} onChange={e => updateH("emergencyName", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Relationship</label>
                        <input className="fld" value={household.emergencyRelation} onChange={e => updateH("emergencyRelation", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Phone</label>
                        <input className="fld" type="tel" value={household.emergencyPhone} onChange={e => updateH("emergencyPhone", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {(hDirty || hSaved) && (
                    <div className={`save-bar ${hSaved ? "success" : "dirty"}`}>
                      <div className="save-bar-l">
                        <span className="save-dot" />
                        {hSaved ? "Household info saved" : "You have unsaved changes"}
                      </div>
                      {!hSaved && (
                        <div className="save-actions">
                          <button className="btn ghost sm" onClick={discardH}>Discard</button>
                          <button className="btn primary sm" onClick={saveH}>{I.check} Save changes</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══════ CO-OWNER ACCESS ═══════ */}
              {tab === "access" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Who has access to your home's portal</h3>
                        <p>Add a spouse, partner, or trusted family member. Most households have 1–2 people here.</p>
                      </div>
                      <button className="btn primary sm" onClick={() => setShowInvite(!showInvite)}>
                        {showInvite ? "Cancel" : <>{I.plus} Invite someone</>}
                      </button>
                    </div>

                    <div className="role-hint">
                      <div className="role-hint-ic">{I.bulb}</div>
                      <div className="role-hint-body">
                        <strong>Co-owners</strong> can see everything, approve scope changes, pay draws, and invite others. <strong>Viewers</strong> can see progress, photos, documents, and the budget — but can't approve or pay anything. Only Co-owners can change roles or remove people.
                      </div>
                    </div>

                    {showInvite && (
                      <div className="inv-panel page-anim">
                        <div className="inv-grid">
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>Email address</label>
                            <input className="fld" type="email" placeholder="partner@example.com" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
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

                    {members.length > 2 && (
                      <div className="sb" style={{ marginBottom: 14 }}>
                        <span className="ic">{I.search}</span>
                        <input placeholder="Search by name or email..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                      </div>
                    )}

                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Person</th>
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
                          <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "var(--t3)", fontSize: 13 }}>No one matches your search.</td></tr>
                        )}
                      </tbody>
                    </table>

                    {removeConfirm && (
                      <div className="rm-dialog page-anim" style={{ marginTop: 12 }}>
                        <div className="rm-dialog-l">
                          Remove <strong>{members.find(m => m.id === removeConfirm)?.name}</strong> from this household? They'll lose access right away — project history is preserved.
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
                        Your cards and bank accounts are stored and charged by Stripe — BuiltCRM never sees your full card or account numbers. These methods are used to pay draws from your builder.
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <div className="h-body">
                        <h3>Saved methods ({methods.length})</h3>
                        <p>Your default method is used when you one-click pay a draw. You can always pick another at checkout.</p>
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
                              <div className="mc-card-ds">3–5 business day settlement. 0.8% fee, capped at $5 — best for big draws.</div>
                            </div>
                          </button>
                        </div>
                        <div className="stripe-note" style={{ marginBottom: 10 }}>
                          {I.lock}
                          <span>You'll be redirected to Stripe's secure form to enter your details.</span>
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
                        <p>Optionally auto-approve small draws below a threshold you set. You'll still get a receipt every time.</p>
                      </div>
                    </div>
                    <div className="sec-row">
                      <div className="sec-row-body">
                        <div className="sec-row-ttl">
                          Enable autopay
                          {autopayEnabled && <span className="pill ok">On</span>}
                        </div>
                        <div className="sec-row-ds">
                          When on, draws under your threshold will be charged automatically once your builder marks the milestone complete. Larger draws always wait for you to approve them at checkout.
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
                          <div className="sec-row-ds" style={{ marginBottom: 10 }}>Draws at or below this amount will be auto-charged. Most homeowners pick $5,000–$10,000.</div>
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
