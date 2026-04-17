import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bellOutline: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  sparkle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10.7l-5.1 3.7L16.8 20 12 16.5 7.2 20l1.9-5.6L4 10.7l6.1-1.9z"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  eye: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  laptop: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M2 20h20"/></svg>,
  phone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  globe: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  chev: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

// ── Portal configs ──────────────────────────────────────────────
const portals = [
  { id: "contractor", dot: "#5b4fc7", label: "Contractor" },
  { id: "sub", dot: "#3d6b8e", label: "Subcontractor" },
  { id: "comm", dot: "#3178b9", label: "Commercial Client" },
  { id: "resi", dot: "#2a7f6f", label: "Residential Client" },
];

const portalMeta = {
  contractor: { label: "Contractor Portal", project: "Riverside Tower Fit-Out", user: "DC", name: "Dan Carter", role: "Project Manager", email: "dan.carter@summitcontracting.com", phone: "+1 (415) 555-0182", title: "Senior Project Manager", timezone: "America/Los_Angeles" },
  sub: { label: "Subcontractor Portal", project: "Riverside Tower Fit-Out", user: "AM", name: "Alex Morgan", role: "Meridian MEP", email: "alex.morgan@meridianmep.com", phone: "+1 (415) 555-0247", title: "Field Supervisor", timezone: "America/Los_Angeles" },
  comm: { label: "Commercial Client Portal", project: "Riverside Tower Fit-Out", user: "PK", name: "Priya Kapoor", role: "Riverside Dev Co", email: "priya.kapoor@riversidedev.com", phone: "+1 (415) 555-0318", title: "Director of Development", timezone: "America/Los_Angeles" },
  resi: { label: "Residential Client Portal", project: "Carter Residence", user: "MR", name: "Maria Ramirez", role: "Homeowner", email: "maria.ramirez@gmail.com", phone: "+1 (415) 555-0429", title: "Homeowner", timezone: "America/Los_Angeles" },
};

// ── Nav data (Settings is active) ───────────────────────────────
const navData = {
  contractor: [
    { section: "Overview", items: [{ label: "Dashboard" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 3 },
      { label: "Change Orders", badge: 1, bt: "warn" }, { label: "Approvals", badge: 2 },
      { label: "Selections" }, { label: "Billing / Draws" }, { label: "Compliance" },
      { label: "Upload Requests" }, { label: "Documents" }, { label: "Budget" }, { label: "Schedule" },
      { label: "Messages", badge: 3 }, { label: "Team" },
    ]},
    { section: "Account", items: [{ label: "Settings", active: true }] },
  ],
  sub: [
    { section: "Your Projects", items: [{ label: "Today Board" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 2, bt: "danger" },
      { label: "Upload Requests", badge: 1 }, { label: "Compliance", badge: 1, bt: "warn" },
      { label: "Documents" }, { label: "Payments" }, { label: "Schedule" },
      { label: "Messages", badge: 1 },
    ]},
    { section: "Account", items: [{ label: "Settings", active: true }] },
  ],
  comm: [
    { section: "Your Projects", items: [{ label: "Riverside Tower Fit-Out" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "Progress & Updates" },
      { label: "Scope Changes", badge: 1, bt: "warn" }, { label: "Approvals", badge: 1 },
      { label: "Billing / Draws" }, { label: "Documents" }, { label: "Schedule" },
      { label: "Messages" }, { label: "Photos" },
    ]},
    { section: "Account", items: [{ label: "Settings", active: true }] },
  ],
  resi: [
    { section: "Your Home", items: [{ label: "Project Home" }] },
    { section: "Carter Residence", items: [
      { label: "Progress & Photos" }, { label: "Selections", badge: 2 },
      { label: "Decisions" }, { label: "Scope Changes" }, { label: "Budget" }, { label: "Schedule" },
      { label: "Messages" }, { label: "Documents" },
    ]},
    { section: "Account", items: [{ label: "Settings", active: true }] },
  ],
};

// ── Notification event taxonomy (filtered per portal) ──────────
// Industry standard: clients see curated events, not everything.
const notificationGroups = {
  contractor: [
    { group: "Workflows", events: [
      { id: "rfi_new", label: "New RFI submitted", desc: "A subcontractor submitted a question on one of your projects" },
      { id: "rfi_response", label: "RFI awaiting your response", desc: "A sub is waiting on you to answer their question" },
      { id: "co_submitted", label: "Change order submitted", desc: "A new change order needs your review" },
      { id: "co_approved", label: "Change order approved by client", desc: "Client signed off — scope is now locked in" },
      { id: "approval_needed", label: "Approval awaiting action", desc: "Cross-type approvals routed to you" },
      { id: "selection_confirmed", label: "Selection confirmed", desc: "Client finalized a residential selection" },
    ]},
    { group: "Billing", events: [
      { id: "draw_submitted", label: "Draw request submitted", desc: "Your team submitted a draw for review" },
      { id: "draw_approved", label: "Draw approved by client", desc: "A draw was approved — ready for payment" },
      { id: "draw_paid", label: "Draw payment received", desc: "Payment settled to your connected account" },
      { id: "waiver_needed", label: "Lien waiver required", desc: "A waiver is needed before draw release" },
    ]},
    { group: "Compliance", events: [
      { id: "compliance_expiring", label: "Sub document expiring", desc: "Insurance, W-9, or license approaching expiry" },
      { id: "compliance_blocked", label: "Sub payment held for compliance", desc: "Sub flagged as non-compliant — payment paused" },
    ]},
    { group: "Team & project", events: [
      { id: "team_invited", label: "Team member invitation accepted", desc: "Someone you invited joined your org" },
      { id: "message_new", label: "New message", desc: "Anyone messages you on a project thread" },
      { id: "upload_completed", label: "Upload request fulfilled", desc: "A sub delivered the files you requested" },
      { id: "milestone_hit", label: "Milestone completed", desc: "A tracked schedule milestone was marked done" },
    ]},
  ],
  sub: [
    { group: "Your work", events: [
      { id: "rfi_assigned", label: "RFI assigned to you", desc: "A GC routed a question to your org" },
      { id: "rfi_responded", label: "GC responded to your RFI", desc: "Your submitted question got an answer" },
      { id: "upload_request", label: "New upload request", desc: "A GC is asking you for files or documents" },
      { id: "schedule_change", label: "Your schedule changed", desc: "A task you own was rescheduled or reassigned" },
    ]},
    { group: "Compliance", events: [
      { id: "compliance_expiring", label: "Your document is expiring", desc: "COI, W-9, or license nearing expiry" },
      { id: "compliance_reminder", label: "Compliance document requested", desc: "A GC is asking for a new compliance doc" },
    ]},
    { group: "Payments", events: [
      { id: "payment_received", label: "Payment received", desc: "A GC paid you for a draw or invoice" },
      { id: "waiver_needed", label: "Lien waiver required", desc: "You need to sign a waiver to release funds" },
    ]},
    { group: "Communication", events: [
      { id: "message_new", label: "New message", desc: "Anyone messages you on a project thread" },
    ]},
  ],
  comm: [
    { group: "Approvals", events: [
      { id: "co_needs_approval", label: "Change order awaiting approval", desc: "A scope change is ready for your review" },
      { id: "approval_new", label: "New approval item", desc: "Something needs your sign-off" },
    ]},
    { group: "Billing", events: [
      { id: "draw_review", label: "Draw request awaiting review", desc: "A billing draw is ready for your approval" },
      { id: "payment_processed", label: "Payment processed", desc: "Your payment cleared successfully" },
    ]},
    { group: "Project", events: [
      { id: "milestone_hit", label: "Milestone completed", desc: "A scheduled project milestone was reached" },
      { id: "document_shared", label: "New document shared with you", desc: "Your contractor shared a file to review" },
      { id: "photo_update", label: "New project photos", desc: "Fresh site photos were uploaded" },
      { id: "weekly_update", label: "Weekly progress report", desc: "Your builder's Friday project update" },
    ]},
    { group: "Communication", events: [
      { id: "message_new", label: "New message", desc: "Your contractor sent you a message" },
    ]},
  ],
  resi: [
    { group: "Decisions", events: [
      { id: "decision_needed", label: "Decision needed", desc: "A question from your builder needs your input" },
      { id: "scope_change", label: "Scope change proposed", desc: "Your builder is proposing a change to the plan" },
      { id: "selection_reminder", label: "Selection deadline approaching", desc: "A choice needs to be made soon to avoid delays" },
    ]},
    { group: "Payments", events: [
      { id: "payment_milestone", label: "Payment milestone approaching", desc: "A scheduled payment is coming up" },
      { id: "payment_processed", label: "Payment confirmed", desc: "Your payment went through — receipt attached" },
    ]},
    { group: "Your home", events: [
      { id: "photo_update", label: "New progress photos", desc: "Fresh photos from your build site" },
      { id: "milestone_hit", label: "Milestone reached", desc: "A big step on your home is complete — foundation, framing, etc." },
      { id: "weekly_update", label: "Weekly update", desc: "Your builder's friendly weekly recap" },
      { id: "document_shared", label: "New document shared with you", desc: "Permits, warranties, and other files to keep" },
    ]},
    { group: "Communication", events: [
      { id: "message_new", label: "New message from your builder", desc: "Direct messages and replies" },
    ]},
  ],
};

// Default toggle states per event (industry standard: critical = email+inapp, routine = inapp only)
const criticalEmailEvents = new Set([
  "co_submitted", "co_approved", "approval_needed", "draw_submitted", "draw_approved",
  "compliance_expiring", "compliance_blocked", "rfi_assigned", "upload_request",
  "compliance_reminder", "payment_received", "waiver_needed", "co_needs_approval",
  "approval_new", "draw_review", "decision_needed", "scope_change",
  "payment_milestone", "payment_processed",
]);

function initPrefs(portal) {
  const prefs = {};
  notificationGroups[portal].forEach(g => {
    g.events.forEach(e => {
      prefs[e.id] = { inapp: true, email: criticalEmailEvents.has(e.id) };
    });
  });
  return prefs;
}

// ── Session data (shared across portals) ────────────────────────
const sessionsData = {
  contractor: [
    { id: 1, device: "MacBook Pro", browser: "Chrome 136", location: "San Francisco, CA", ip: "73.158.**.**", lastActive: "Active now", current: true },
    { id: 2, device: "iPhone 17", browser: "Safari", location: "San Francisco, CA", ip: "172.58.**.**", lastActive: "2 hours ago" },
    { id: 3, device: "Windows PC", browser: "Edge 136", location: "Oakland, CA", ip: "67.164.**.**", lastActive: "3 days ago" },
  ],
  sub: [
    { id: 1, device: "iPhone 16", browser: "Safari", location: "San Francisco, CA", ip: "172.58.**.**", lastActive: "Active now", current: true },
    { id: 2, device: "iPad Pro", browser: "Safari", location: "San Francisco, CA", ip: "172.58.**.**", lastActive: "Yesterday" },
  ],
  comm: [
    { id: 1, device: "MacBook Air", browser: "Safari", location: "San Francisco, CA", ip: "73.158.**.**", lastActive: "Active now", current: true },
  ],
  resi: [
    { id: 1, device: "iPhone 17 Pro", browser: "Safari", location: "Sausalito, CA", ip: "73.158.**.**", lastActive: "Active now", current: true },
    { id: 2, device: "Home desktop", browser: "Chrome 136", location: "Sausalito, CA", ip: "73.158.**.**", lastActive: "Yesterday" },
  ],
};

// ── Settings tabs ───────────────────────────────────────────────
const settingsTabs = [
  { id: "profile", label: "Profile", icon: I.user, desc: "Name, contact info, and how you appear to others" },
  { id: "security", label: "Security", icon: I.shield, desc: "Password, two-factor authentication, and active sessions" },
  { id: "notifications", label: "Notifications", icon: I.bellOutline, desc: "What you hear about and how you hear about it" },
  { id: "appearance", label: "Appearance", icon: I.sparkle, desc: "Theme, language, and display preferences" },
];

// ── Component ───────────────────────────────────────────────────
export default function SettingsSharedShell() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [tab, setTab] = useState("profile");

  // Per-portal state (profile edits stay scoped to the portal you're previewing)
  const [profiles, setProfiles] = useState(() => {
    const p = {};
    Object.keys(portalMeta).forEach(k => {
      p[k] = {
        name: portalMeta[k].name,
        email: portalMeta[k].email,
        phone: portalMeta[k].phone,
        title: portalMeta[k].title,
        timezone: portalMeta[k].timezone,
      };
    });
    return p;
  });
  const [dirty, setDirty] = useState({});
  const [saved, setSaved] = useState({});

  // Notification prefs per portal
  const [notifPrefs, setNotifPrefs] = useState(() => {
    const n = {};
    Object.keys(notificationGroups).forEach(k => { n[k] = initPrefs(k); });
    return n;
  });

  // Security state
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState({ contractor: true, sub: false, comm: false, resi: false });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "", showCurrent: false, showNext: false });

  // Appearance state
  const [themeMode, setThemeMode] = useState("light"); // light | dark | system
  const [language, setLanguage] = useState("en");
  const [density, setDensity] = useState("comfortable");

  const meta = portalMeta[portal];
  const nav = navData[portal];
  const profile = profiles[portal];
  const prefs = notifPrefs[portal];
  const sessions = sessionsData[portal];

  const switchPortal = (p) => {
    setPortal(p);
    setTab("profile");
    setShow2faSetup(false);
  };

  const updateProfile = (field, val) => {
    setProfiles(prev => ({ ...prev, [portal]: { ...prev[portal], [field]: val } }));
    setDirty(prev => ({ ...prev, [portal]: true }));
    setSaved(prev => ({ ...prev, [portal]: false }));
  };

  const saveProfile = () => {
    setDirty(prev => ({ ...prev, [portal]: false }));
    setSaved(prev => ({ ...prev, [portal]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [portal]: false })), 2400);
  };

  const toggleNotif = (eventId, channel) => {
    setNotifPrefs(prev => ({
      ...prev,
      [portal]: {
        ...prev[portal],
        [eventId]: { ...prev[portal][eventId], [channel]: !prev[portal][eventId][channel] }
      }
    }));
  };

  // Effective theme (for preview)
  const effectiveDark = themeMode === "dark" || (themeMode === "system" && dark);

  return (
    <div className={`st ${effectiveDark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.st{
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
.st.sub{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15)}
.st.comm{--ac:#3178b9;--ac-h:#296aa6;--ac-s:#e8f1fa;--ac-t:#276299;--ac-m:#b0cfe8;--shri:0 0 0 3px rgba(49,120,185,.15)}
.st.resi{--ac:#2a7f6f;--ac-h:#237060;--ac-s:#e6f5f1;--ac-t:#1f6b5d;--ac-m:#a8d5ca;--shri:0 0 0 3px rgba(42,127,111,.15)}
.st.dk{
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
.st.dk.sub{--ac:#5a9fc0;--ac-h:#4d8aaa;--ac-s:#142030;--ac-t:#7eb8d8;--ac-m:#2a4a5e}
.st.dk.comm{--ac:#4a94d4;--ac-h:#3d82c0;--ac-s:#141f2c;--ac-t:#6cb0ee;--ac-m:#2a4a60}
.st.dk.resi{--ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none;color:inherit}
input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-mark{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1a1714,#3d3830);display:grid;place-items:center;flex-shrink:0}
.st.dk .brand-mark{background:linear-gradient(135deg,#edeae5,#a8a39a)}
.brand-mark svg{width:16px;height:16px}
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
.st.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px 32px 40px;flex:1;max-width:1200px;width:100%}

/* Portal switch */
.psw{display:flex;gap:4px;margin-bottom:22px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content;flex-wrap:wrap}
.psw button{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e);white-space:nowrap}
.psw button:hover{color:var(--t1)}.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Page header */
.pg-hdr{margin-bottom:22px}
.pg-hdr h2{font-family:var(--fd);font-size:26px;font-weight:750;letter-spacing:-.03em}
.pg-sub{font-size:13.5px;color:var(--t2);margin-top:4px;font-weight:520}

/* Settings layout */
.slt{display:grid;grid-template-columns:248px 1fr;gap:28px;align-items:start}
@media(max-width:960px){.slt{grid-template-columns:1fr}}

/* Settings sub-nav */
.snv{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:8px;display:flex;flex-direction:column;gap:2px;position:sticky;top:calc(var(--tbh) + 16px)}
.st-tab{display:flex;align-items:flex-start;gap:12px;padding:11px 12px;border-radius:var(--r-m);text-align:left;transition:all var(--df);color:var(--t2);cursor:pointer;width:100%}
.st-tab:hover{background:var(--sh);color:var(--t1)}
.st-tab.on{background:var(--ac-s);color:var(--ac-t)}
.st-tab-ic{width:28px;height:28px;border-radius:var(--r-s);background:var(--s2);display:grid;place-items:center;flex-shrink:0;color:var(--t2);margin-top:1px;transition:all var(--df)}
.st-tab.on .st-tab-ic{background:var(--ac);color:white}
.st-tab-body{flex:1;min-width:0}
.st-tab-lbl{font-family:var(--fd);font-size:13px;font-weight:650;letter-spacing:-.01em}
.st-tab-ds{font-size:11.5px;color:var(--t3);margin-top:2px;line-height:1.35;font-weight:500}

/* Panels */
.panel{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;margin-bottom:16px}
.panel-hdr{margin-bottom:18px}
.panel-hdr h3{font-family:var(--fd);font-size:17px;font-weight:700;letter-spacing:-.02em}
.panel-hdr p{font-size:13px;color:var(--t2);margin-top:3px;font-weight:520}

/* Form fields */
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.field:last-child{margin-bottom:0}
.field label{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--t2);letter-spacing:.01em}
.fld{height:40px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:13.5px;color:var(--t1);outline:none;transition:all var(--df);font-family:var(--fb);width:100%}
.fld:focus{border-color:var(--ac);box-shadow:var(--shri)}
.fld[readonly]{background:var(--s2);color:var(--t2);cursor:default}
.fld-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:620px){.fld-row{grid-template-columns:1fr}}
.field-help{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:500}

.fld-pw{position:relative}
.fld-pw .fld{padding-right:40px}
.fld-pw button.reveal{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:var(--r-s);color:var(--t3);display:grid;place-items:center}
.fld-pw button.reveal:hover{background:var(--sh);color:var(--t2)}

/* Avatar uploader */
.av-up{display:flex;align-items:center;gap:16px;margin-bottom:18px}
.av-up-big{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:26px;font-weight:700;flex-shrink:0}
.av-up-body{flex:1;min-width:0}
.av-up-lbl{font-family:var(--fd);font-size:14px;font-weight:650}
.av-up-ds{font-size:12px;color:var(--t3);margin-top:2px;font-weight:500}
.av-up-acts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}

/* Buttons */
.btn{height:38px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all var(--dn) var(--e);font-family:var(--fb)}
.btn.primary{background:var(--ac);color:white;border:none}.btn.primary:hover{background:var(--ac-h);box-shadow:var(--shmd)}
.btn.primary:disabled{background:var(--s3);color:var(--t3);cursor:not-allowed;box-shadow:none}
.btn.ghost{border:1px solid var(--s3);background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--sh);border-color:var(--s4);color:var(--t1)}
.btn.danger{border:1px solid var(--dg);background:transparent;color:var(--dg)}.btn.danger:hover{background:var(--dg-s)}
.btn.sm{height:32px;padding:0 14px;font-size:12px}

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
.sw.on{background:var(--ac)}
.sw.on::after{left:18px}
.sw.sm{width:32px;height:18px}
.sw.sm::after{width:14px;height:14px}
.sw.sm.on::after{left:16px}

/* Notification groups */
.ng{margin-bottom:20px}
.ng:last-child{margin-bottom:0}
.ng-ttl{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:0 4px 10px;border-bottom:1px solid var(--s3);margin-bottom:6px;display:grid;grid-template-columns:1fr 70px 70px;gap:20px;align-items:center}
.ng-ttl .ch-h{text-align:center;font-size:11px;color:var(--t3)}
.ne{display:grid;grid-template-columns:1fr 70px 70px;gap:20px;align-items:center;padding:12px 4px;border-bottom:1px solid var(--s2)}
.ne:last-child{border-bottom:none}
.ne-info{min-width:0}
.ne-lbl{font-size:13.5px;font-weight:600;color:var(--t1);font-family:var(--fd);letter-spacing:-.01em}
.ne-ds{font-size:12px;color:var(--t3);margin-top:2px;font-weight:500;line-height:1.4}
.ne-ch{display:flex;justify-content:center}

/* Security — 2FA card */
.sec-card{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:18px;display:flex;align-items:flex-start;gap:14px}
.sec-card-ic{width:36px;height:36px;border-radius:var(--r-m);background:var(--s1);color:var(--ac);display:grid;place-items:center;flex-shrink:0}
.sec-card.on .sec-card-ic{background:var(--ok-s);color:var(--ok-t)}
.sec-card-body{flex:1;min-width:0}
.sec-card-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sec-card-title h4{font-family:var(--fd);font-size:14px;font-weight:650;letter-spacing:-.01em}
.sec-card-ds{font-size:12.5px;color:var(--t2);margin-top:4px;font-weight:500;line-height:1.45}
.sec-card-actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.pill{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;font-family:var(--fd);letter-spacing:.02em;flex-shrink:0}
.pill.ok{background:var(--ok-s);color:var(--ok-t)}
.pill.off{background:var(--s3);color:var(--t2)}
.pill.warn{background:var(--wr-s);color:var(--wr-t)}

/* 2FA setup drawer */
.tfa-setup{background:var(--s2);border-radius:var(--r-l);padding:18px;margin-top:14px;border:1px solid var(--s3)}
.tfa-step{margin-bottom:14px}
.tfa-step:last-child{margin-bottom:0}
.tfa-step h5{font-family:var(--fd);font-size:13px;font-weight:700;margin-bottom:6px}
.tfa-step p{font-size:12.5px;color:var(--t2);margin-bottom:8px}
.tfa-qr{width:140px;height:140px;background:white;border:1px solid var(--s3);border-radius:var(--r-m);display:grid;place-items:center;position:relative;overflow:hidden}
.tfa-qr-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:10px}
.tfa-qr-cell{width:100%;aspect-ratio:1;background:#1a1714;border-radius:1px}
.tfa-qr-cell.off{background:transparent}
.tfa-secret{display:flex;align-items:center;gap:8px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);padding:8px 12px;font-family:var(--fm);font-size:12px;letter-spacing:.06em;width:fit-content}
.tfa-secret button{color:var(--t3);display:grid;place-items:center;width:24px;height:24px;border-radius:var(--r-s)}
.tfa-secret button:hover{background:var(--sh);color:var(--t1)}

/* Sessions */
.ses{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid var(--s3);border-radius:var(--r-l);margin-bottom:8px}
.ses:last-child{margin-bottom:0}
.ses.current{background:var(--ac-s);border-color:var(--ac-m)}
.ses-ic{width:34px;height:34px;border-radius:var(--r-m);background:var(--s2);color:var(--t2);display:grid;place-items:center;flex-shrink:0}
.ses.current .ses-ic{background:var(--s1);color:var(--ac-t)}
.ses-body{flex:1;min-width:0}
.ses-device{font-family:var(--fd);font-size:13.5px;font-weight:650;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ses-meta{font-size:12px;color:var(--t3);margin-top:3px;font-weight:500}
.ses-active{font-size:11.5px;font-family:var(--fm);color:var(--t2)}
.ses.current .ses-active{color:var(--ok-t);font-weight:600}

/* Appearance */
.theme-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px}
@media(max-width:620px){.theme-grid{grid-template-columns:1fr}}
.theme-card{padding:14px;border:1.5px solid var(--s3);border-radius:var(--r-l);cursor:pointer;transition:all var(--df);text-align:left;background:var(--s1)}
.theme-card:hover{border-color:var(--s4)}
.theme-card.on{border-color:var(--ac);background:var(--ac-s)}
.theme-preview{height:64px;border-radius:var(--r-m);margin-bottom:10px;position:relative;overflow:hidden;border:1px solid var(--s3)}
.theme-preview.light{background:#fff}
.theme-preview.light::after{content:'';position:absolute;left:10px;top:10px;right:10px;height:6px;background:#e2e5e9;border-radius:2px;box-shadow:0 10px 0 -2px #f3f4f6,0 20px 0 -4px #eef0f3}
.theme-preview.dark{background:#0c0e14}
.theme-preview.dark::after{content:'';position:absolute;left:10px;top:10px;right:10px;height:6px;background:#2a2e3c;border-radius:2px;box-shadow:0 10px 0 -2px #1e2130,0 20px 0 -4px #171a24}
.theme-preview.system{background:linear-gradient(90deg,#fff 50%,#0c0e14 50%)}
.theme-preview.system::after{content:'';position:absolute;left:10px;top:10px;right:10px;height:6px;background:linear-gradient(90deg,#e2e5e9 50%,#2a2e3c 50%);border-radius:2px;box-shadow:0 10px 0 -2px rgba(0,0,0,0)}
.theme-lbl{font-family:var(--fd);font-size:13px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.theme-ds{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:500}

/* Radio group */
.rg{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.ro{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--s3);border-radius:var(--r-m);cursor:pointer;transition:all var(--df);background:var(--s1)}
.ro:hover{border-color:var(--s4)}
.ro.on{border-color:var(--ac);background:var(--ac-s)}
.ro-dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--s4);flex-shrink:0;margin-top:1px;position:relative;transition:all var(--df)}
.ro.on .ro-dot{border-color:var(--ac);background:var(--ac)}
.ro.on .ro-dot::after{content:'';position:absolute;top:3px;left:3px;width:8px;height:8px;border-radius:50%;background:white}
.ro-body{flex:1;min-width:0}
.ro-lbl{font-family:var(--fd);font-size:13.5px;font-weight:640;letter-spacing:-.01em}
.ro-ds{font-size:12px;color:var(--t3);margin-top:2px;font-weight:500;line-height:1.4}

/* Danger zone */
.dz{background:var(--dg-s);border:1px solid var(--dg);border-radius:var(--r-xl);padding:20px}
.dz h3{font-family:var(--fd);font-size:15px;font-weight:700;color:var(--dg);margin-bottom:4px}
.dz p{font-size:12.5px;color:var(--dg);opacity:.85;margin-bottom:12px;font-weight:500;line-height:1.45}
.st.dk .dz{background:rgba(224,82,82,.08)}

.page-anim{animation:fadeIn .24s var(--e)}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

/* Portal banner (only when switcher is shown) */
.banner{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:18px;font-size:12.5px;color:var(--ac-t);font-weight:540}
      `}</style>

      {/* ── Sidebar ───────────────────────── */}
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 80 80">
              <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".5"/>
              <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".75"/>
              <rect x="32" y="32" width="26" height="26" rx="4" fill="#faf9f7" opacity=".95"/>
            </svg>
          </div>
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">{meta.label}</div>
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
            <div className="s-user-av">{meta.user}</div>
            <div style={{ minWidth: 0 }}>
              <div className="s-user-name">{profile.name}</div>
              <div className="s-user-role">{meta.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>{meta.label}</span>
            <span className="sep">/</span>
            <span className="cur">Settings</span>
            <span className="sep">/</span>
            <span className="cur">{settingsTabs.find(t => t.id === tab).label}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} title="Toggle system-dark preview">
              {dark ? I.sun : I.moon}
            </button>
            <button className="ib">{I.bell}</button>
            <div className="av">{meta.user}</div>
          </div>
        </div>

        <div className="ct">
          {/* Portal switcher (prototype-only, for demo across portals) */}
          <div className="psw">
            {portals.map(p => (
              <button key={p.id} className={portal === p.id ? "on" : ""} onClick={() => switchPortal(p.id)}>
                <span className="p-dot" style={{ background: p.dot }} />
                {p.label}
              </button>
            ))}
          </div>

          <div className="pg-hdr">
            <h2>Settings</h2>
            <div className="pg-sub">Manage your profile, security, notifications, and appearance.</div>
          </div>

          <div className="slt">
            {/* Settings sub-nav */}
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

            {/* Tab content */}
            <div className="page-anim" key={`${portal}-${tab}`}>

              {/* ═══════ PROFILE ═══════ */}
              {tab === "profile" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Your photo</h3>
                      <p>This appears on your messages, comments, and wherever you show up across the portal.</p>
                    </div>
                    <div className="av-up">
                      <div className="av-up-big">{meta.user}</div>
                      <div className="av-up-body">
                        <div className="av-up-lbl">{profile.name}</div>
                        <div className="av-up-ds">PNG or JPG, square, up to 2MB</div>
                        <div className="av-up-acts">
                          <button className="btn ghost sm">{I.upload} Upload new</button>
                          <button className="btn ghost sm">Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Personal information</h3>
                      <p>Your contact info and how you're identified in the system.</p>
                    </div>

                    <div className="field">
                      <label>Full name</label>
                      <input className="fld" value={profile.name} onChange={e => updateProfile("name", e.target.value)} />
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>Email address</label>
                        <input className="fld" type="email" value={profile.email} onChange={e => updateProfile("email", e.target.value)} />
                        <div className="field-help">Used for sign-in and notifications</div>
                      </div>
                      <div className="field">
                        <label>Phone number</label>
                        <input className="fld" type="tel" value={profile.phone} onChange={e => updateProfile("phone", e.target.value)} />
                        <div className="field-help">For urgent project alerts (optional)</div>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>{portal === "resi" ? "Role in the household" : "Title or role"}</label>
                        <input className="fld" value={profile.title} onChange={e => updateProfile("title", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Time zone</label>
                        <select className="fld" value={profile.timezone} onChange={e => updateProfile("timezone", e.target.value)}>
                          <option value="America/Los_Angeles">Pacific Time — Los Angeles</option>
                          <option value="America/Denver">Mountain Time — Denver</option>
                          <option value="America/Chicago">Central Time — Chicago</option>
                          <option value="America/New_York">Eastern Time — New York</option>
                          <option value="America/Toronto">Eastern Time — Toronto</option>
                          <option value="America/Vancouver">Pacific Time — Vancouver</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Save bar */}
                  {(dirty[portal] || saved[portal]) && (
                    <div className={`save-bar ${saved[portal] ? "success" : "dirty"}`}>
                      <div className="save-bar-l">
                        <span className="save-dot" />
                        {saved[portal] ? "Profile saved" : "You have unsaved changes"}
                      </div>
                      {!saved[portal] && (
                        <div className="save-actions">
                          <button className="btn ghost sm" onClick={() => {
                            setProfiles(prev => ({ ...prev, [portal]: {
                              name: portalMeta[portal].name, email: portalMeta[portal].email,
                              phone: portalMeta[portal].phone, title: portalMeta[portal].title,
                              timezone: portalMeta[portal].timezone,
                            }}));
                            setDirty(prev => ({ ...prev, [portal]: false }));
                          }}>Discard</button>
                          <button className="btn primary sm" onClick={saveProfile}>{I.check} Save changes</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ═══════ SECURITY ═══════ */}
              {tab === "security" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Password</h3>
                      <p>Change your sign-in password. Use at least 12 characters with a mix of letters, numbers, and symbols.</p>
                    </div>

                    <div className="field">
                      <label>Current password</label>
                      <div className="fld-pw">
                        <input className="fld" type={pwForm.showCurrent ? "text" : "password"} value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} placeholder="Enter your current password" />
                        <button className="reveal" onClick={() => setPwForm({ ...pwForm, showCurrent: !pwForm.showCurrent })}>
                          {pwForm.showCurrent ? I.eyeOff : I.eye}
                        </button>
                      </div>
                    </div>

                    <div className="fld-row">
                      <div className="field">
                        <label>New password</label>
                        <div className="fld-pw">
                          <input className="fld" type={pwForm.showNext ? "text" : "password"} value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} placeholder="At least 12 characters" />
                          <button className="reveal" onClick={() => setPwForm({ ...pwForm, showNext: !pwForm.showNext })}>
                            {pwForm.showNext ? I.eyeOff : I.eye}
                          </button>
                        </div>
                      </div>
                      <div className="field">
                        <label>Confirm new password</label>
                        <input className="fld" type={pwForm.showNext ? "text" : "password"} value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Re-enter new password" />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button className="btn primary sm" disabled={!pwForm.current || !pwForm.next || pwForm.next !== pwForm.confirm}>Update password</button>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Two-factor authentication</h3>
                      <p>Add a second verification step when signing in from new devices.</p>
                    </div>

                    <div className={`sec-card ${twoFaEnabled[portal] ? "on" : ""}`}>
                      <div className="sec-card-ic">{I.shield}</div>
                      <div className="sec-card-body">
                        <div className="sec-card-title">
                          <h4>Authenticator app</h4>
                          <span className={`pill ${twoFaEnabled[portal] ? "ok" : "off"}`}>
                            {twoFaEnabled[portal] ? "Enabled" : "Off"}
                          </span>
                        </div>
                        <div className="sec-card-ds">Use Google Authenticator, 1Password, Authy, or any TOTP app to generate sign-in codes.</div>
                        <div className="sec-card-actions">
                          {twoFaEnabled[portal] ? (
                            <>
                              <button className="btn ghost sm">View recovery codes</button>
                              <button className="btn danger sm" onClick={() => setTwoFaEnabled({ ...twoFaEnabled, [portal]: false })}>Disable</button>
                            </>
                          ) : (
                            <button className="btn primary sm" onClick={() => setShow2faSetup(!show2faSetup)}>
                              {show2faSetup ? "Cancel setup" : "Set up authenticator"}
                            </button>
                          )}
                        </div>

                        {show2faSetup && !twoFaEnabled[portal] && (
                          <div className="tfa-setup page-anim">
                            <div className="tfa-step">
                              <h5>Step 1 — Scan the QR code</h5>
                              <p>Open your authenticator app and scan this code, or enter the secret manually.</p>
                              <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                                <div className="tfa-qr">
                                  <div className="tfa-qr-grid">
                                    {Array.from({ length: 49 }).map((_, i) => (
                                      <div key={i} className={`tfa-qr-cell ${[0,2,6,8,14,16,18,22,28,30,32,36,42,44,48].includes(i) ? "off" : ""}`} />
                                    ))}
                                  </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 180 }}>
                                  <div className="field-help" style={{ marginBottom: 8 }}>Or enter manually:</div>
                                  <div className="tfa-secret">
                                    <span>JBSW Y3DP EHPK 3PXP</span>
                                    <button title="Copy">{I.copy}</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="tfa-step">
                              <h5>Step 2 — Enter the 6-digit code</h5>
                              <p>Type the code your authenticator is showing right now.</p>
                              <input className="fld" placeholder="000 000" maxLength="7" style={{ width: 160, fontFamily: "var(--fm)", letterSpacing: ".2em", fontSize: 15 }} />
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn ghost sm" onClick={() => setShow2faSetup(false)}>Cancel</button>
                              <button className="btn primary sm" onClick={() => { setTwoFaEnabled({ ...twoFaEnabled, [portal]: true }); setShow2faSetup(false); }}>Verify & enable</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Active sessions</h3>
                      <p>Devices currently signed in with your account. Sign out any session you don't recognize.</p>
                    </div>

                    {sessions.map(s => (
                      <div key={s.id} className={`ses ${s.current ? "current" : ""}`}>
                        <div className="ses-ic">{s.device.includes("Phone") || s.device.includes("iPad") ? I.phone : I.laptop}</div>
                        <div className="ses-body">
                          <div className="ses-device">
                            {s.device} · {s.browser}
                            {s.current && <span className="pill ok">This device</span>}
                          </div>
                          <div className="ses-meta">{s.location} · {s.ip}</div>
                        </div>
                        <div className="ses-active">{s.lastActive}</div>
                        {!s.current && <button className="btn ghost sm">Sign out</button>}
                      </div>
                    ))}

                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn danger sm">Sign out everywhere else</button>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════ NOTIFICATIONS ═══════ */}
              {tab === "notifications" && (
                <div className="panel">
                  <div className="panel-hdr" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <h3>Notification preferences</h3>
                      <p>
                        {portal === "resi"
                          ? "Choose how you'd like to hear from your builder — email, in-app, or both."
                          : portal === "comm"
                          ? "Choose how you'd like to stay informed about project activity."
                          : "Choose which events reach you by email and which show in your in-app inbox."}
                      </p>
                    </div>
                    <button className="btn ghost sm" onClick={() => setNotifPrefs(prev => ({ ...prev, [portal]: initPrefs(portal) }))}>Reset to defaults</button>
                  </div>

                  {notificationGroups[portal].map(group => (
                    <div key={group.group} className="ng">
                      <div className="ng-ttl">
                        <span>{group.group}</span>
                        <span className="ch-h">Email</span>
                        <span className="ch-h">In-app</span>
                      </div>
                      {group.events.map(ev => (
                        <div key={ev.id} className="ne">
                          <div className="ne-info">
                            <div className="ne-lbl">{ev.label}</div>
                            <div className="ne-ds">{ev.desc}</div>
                          </div>
                          <div className="ne-ch">
                            <div
                              className={`sw sm ${prefs[ev.id].email ? "on" : ""}`}
                              onClick={() => toggleNotif(ev.id, "email")}
                              role="switch"
                              aria-checked={prefs[ev.id].email}
                              aria-label={`Email notifications for ${ev.label}`}
                            />
                          </div>
                          <div className="ne-ch">
                            <div
                              className={`sw sm ${prefs[ev.id].inapp ? "on" : ""}`}
                              onClick={() => toggleNotif(ev.id, "inapp")}
                              role="switch"
                              aria-checked={prefs[ev.id].inapp}
                              aria-label={`In-app notifications for ${ev.label}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* ═══════ APPEARANCE ═══════ */}
              {tab === "appearance" && (
                <>
                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Theme</h3>
                      <p>Choose how BuiltCRM looks. System follows your device's setting automatically.</p>
                    </div>
                    <div className="theme-grid">
                      {[
                        { id: "light", label: "Light", desc: "Bright, warm surfaces" },
                        { id: "dark", label: "Dark", desc: "Easier on the eyes at night" },
                        { id: "system", label: "System", desc: "Match your device" },
                      ].map(t => (
                        <button key={t.id} className={`theme-card ${themeMode === t.id ? "on" : ""}`} onClick={() => setThemeMode(t.id)}>
                          <div className={`theme-preview ${t.id}`} />
                          <div className="theme-lbl">
                            {t.label}
                            {themeMode === t.id && <span style={{ color: "var(--ac)" }}>{I.check}</span>}
                          </div>
                          <div className="theme-ds">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Display density</h3>
                      <p>Controls how tightly information is packed. Compact fits more on screen, comfortable is easier to scan.</p>
                    </div>
                    <div className="rg">
                      {[
                        { id: "comfortable", label: "Comfortable", desc: "Generous spacing (default)" },
                        { id: "compact", label: "Compact", desc: "Tighter rows — good for power users" },
                      ].map(d => (
                        <button key={d.id} className={`ro ${density === d.id ? "on" : ""}`} onClick={() => setDensity(d.id)}>
                          <div className="ro-dot" />
                          <div className="ro-body">
                            <div className="ro-lbl">{d.label}</div>
                            <div className="ro-ds">{d.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-hdr">
                      <h3>Language</h3>
                      <p>The language used throughout the app. More languages coming soon.</p>
                    </div>
                    <div className="field" style={{ maxWidth: 320 }}>
                      <label>Language</label>
                      <select className="fld" value={language} onChange={e => setLanguage(e.target.value)}>
                        <option value="en">English (United States)</option>
                        <option value="en-CA">English (Canada)</option>
                        <option value="fr-CA" disabled>Français (Canada) — coming soon</option>
                        <option value="es" disabled>Español — coming soon</option>
                      </select>
                      <div className="field-help">Your selection affects dates, numbers, and currency formatting too.</div>
                    </div>
                  </div>

                  {portal === "contractor" && (
                    <div className="dz">
                      <h3>Danger zone</h3>
                      <p>Delete your personal account and end your access to all portals you belong to. This won't delete organization data — talk to your admin first.</p>
                      <button className="btn danger sm">Delete my account</button>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
