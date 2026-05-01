import { useState } from "react";

/*
 * STEP 65 — LAW 25 PRIVACY OFFICER SURFACE (PAIRED PROTOTYPE)
 * ──────────────────────────────────────────────────────────
 * Phase 4+ · Phase 9-lite · Item 9-lite.1 #65
 *
 * Quebec Law 25 product surfaces. Three views, one prototype:
 *
 *   1. Privacy Officer Admin
 *      Path: src/app/(portal)/contractor/(global)/settings/privacy/page.tsx
 *      Audience: contractor org admins / designated Privacy Officer
 *      Contains: officer designation, DSAR queue (30-day SLA), consent
 *      register, breach register with log-new flow.
 *
 *   2. Public DSAR Intake
 *      Path: src/app/privacy/dsar/page.tsx (no-auth, with CAPTCHA)
 *      Audience: data subjects (anyone — clients, ex-employees, public)
 *      Contains: identity fields, request-type selector, description,
 *      CAPTCHA placeholder, what-to-expect sidebar.
 *
 *   3. End-User Consent Manager
 *      Path: src/app/(portal)/[anyRole]/(global)/settings/privacy/page.tsx
 *      Audience: any logged-in user, any portal
 *      Contains: per-consent toggles, self-serve DSAR shortcut,
 *      consent history timeline.
 *
 * Boundary called out in the build guide: this is the *surface* of
 * Law 25 compliance. Real compliance is organizational. The README
 * and the breach-register UI both flag that CAI notification is a
 * manual out-of-product step (we log the date the org *says* it
 * notified the CAI; we do not actually send to the CAI).
 *
 * Schema reference (drizzle_schema_phase5_law25.ts pending — flag
 * to user on schema-stop trigger):
 *   - privacy_officers (orgId PK, userId FK, designatedAt)
 *   - dsar_requests (id, orgId, requesterEmail, requesterName,
 *     requestType, status, receivedAt, slaDueAt, completedAt, notes)
 *   - consent_records (id, orgId, subjectUserId|subjectEmail,
 *     consentType, granted, grantedAt, revokedAt, source)
 *   - breach_register (id, orgId, discoveredAt, occurredAt, severity,
 *     affectedSubjects, dataTypesAffected, containmentActions,
 *     notifiedUsersAt, reportedToCAIAt, closedAt, closedByUserId)
 */

// ── Icons ───────────────────────────────────────────────────────
const I = {
  shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  shieldLg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  inbox: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  checkCircle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  warn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  fileText: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chevR: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  chevD: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ext: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  mail: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  bell: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  building: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>,
  card: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  database: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  globe: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  flag: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  sun: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  logo: (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b4fc7"/>
          <stop offset="1" stopColor="#3d3399"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#lg)"/>
      <rect x="6.5" y="8" width="14" height="3" rx="1" fill="#fff"/>
      <rect x="6.5" y="13.5" width="19" height="3" rx="1" fill="#fff" opacity=".82"/>
      <rect x="6.5" y="19" width="11" height="3" rx="1" fill="#fff" opacity=".62"/>
    </svg>
  ),
};

// ── Mock data ───────────────────────────────────────────────────
const officer = {
  id: "u-049",
  name: "Marielle Tremblay",
  role: "VP Operations · Summit Contracting",
  email: "marielle.t@summit.ca",
  phone: "+1 (514) 555-0148",
  designatedAt: "Jan 14, 2026",
  avatar: "MT",
};

const officerCandidates = [
  { id: "u-049", name: "Marielle Tremblay", role: "VP Operations" },
  { id: "u-022", name: "Dan Carter", role: "Org Admin" },
  { id: "u-078", name: "Priya Singh", role: "Finance Lead" },
  { id: "u-091", name: "Tom Nakamura", role: "Compliance Manager" },
];

const dsarSeed = [
  {
    id: "DSAR-2026-018",
    requesterName: "Élise Bouchard",
    requesterEmail: "elise.bouchard@gmail.com",
    requestType: "deletion",
    status: "in_progress",
    receivedAt: "Apr 24, 2026",
    slaDueAt: "May 24, 2026",
    daysRemaining: 23,
    notes: "Subject is a former resident on Maplewood Heights project. Requested deletion of all personal data, retention only what's legally required for tax records.",
    assignedTo: "Marielle Tremblay",
    project: "Maplewood Heights",
  },
  {
    id: "DSAR-2026-017",
    requesterName: "James O'Brien",
    requesterEmail: "j.obrien@nmail.com",
    requestType: "access",
    status: "received",
    receivedAt: "Apr 28, 2026",
    slaDueAt: "May 28, 2026",
    daysRemaining: 27,
    notes: "Requested copy of all communications and project records relating to their unit purchase decision.",
    assignedTo: null,
    project: "Riverside Tower Fit-Out",
  },
  {
    id: "DSAR-2026-015",
    requesterName: "Vikram Reddy",
    requesterEmail: "vikram.reddy@protonmail.com",
    requestType: "rectification",
    status: "in_progress",
    receivedAt: "Apr 16, 2026",
    slaDueAt: "May 16, 2026",
    daysRemaining: 15,
    notes: "Reports incorrect spelling of legal name across signed approval documents. Wants corrections plus reissued copies.",
    assignedTo: "Marielle Tremblay",
    project: "Cedar Mill Renovation",
  },
  {
    id: "DSAR-2026-013",
    requesterName: "Sophie Lefèvre",
    requesterEmail: "sophie.l@outlook.com",
    requestType: "access",
    status: "in_progress",
    receivedAt: "Apr 03, 2026",
    slaDueAt: "May 03, 2026",
    daysRemaining: 2,
    notes: "Comprehensive request — all messaging, all approvals, all uploaded photos. Compiling export now.",
    assignedTo: "Marielle Tremblay",
    project: "Maplewood Heights",
  },
  {
    id: "DSAR-2026-011",
    requesterName: "Nadia Hassan",
    requesterEmail: "n.hassan@summit.ca",
    requestType: "portability",
    status: "completed",
    receivedAt: "Mar 21, 2026",
    slaDueAt: "Apr 20, 2026",
    completedAt: "Apr 12, 2026",
    daysRemaining: -11,
    notes: "Portability export generated as JSON archive. Delivered through encrypted link.",
    assignedTo: "Marielle Tremblay",
    project: "Internal — employee data",
  },
  {
    id: "DSAR-2026-009",
    requesterName: "Pierre Gagnon",
    requesterEmail: "pierre.g@yahoo.ca",
    requestType: "deletion",
    status: "rejected",
    receivedAt: "Mar 14, 2026",
    slaDueAt: "Apr 13, 2026",
    completedAt: "Mar 18, 2026",
    daysRemaining: -18,
    notes: "Rejected — subject's records are within 7-year tax retention. Explanation sent. Appeal rights notified.",
    assignedTo: "Dan Carter",
    project: "Cedar Mill Renovation",
  },
];

const consentSeed = [
  { id: "c-1041", subject: "Élise Bouchard", subjectEmail: "elise.bouchard@gmail.com", type: "Marketing email", granted: true, grantedAt: "Feb 11, 2026", revokedAt: null, source: "signup_form" },
  { id: "c-1040", subject: "Élise Bouchard", subjectEmail: "elise.bouchard@gmail.com", type: "Data processing", granted: true, grantedAt: "Feb 11, 2026", revokedAt: null, source: "signup_form" },
  { id: "c-1039", subject: "James O'Brien", subjectEmail: "j.obrien@nmail.com", type: "Marketing email", granted: false, grantedAt: "Mar 02, 2026", revokedAt: "Apr 22, 2026", source: "preferences_page" },
  { id: "c-1038", subject: "James O'Brien", subjectEmail: "j.obrien@nmail.com", type: "Product updates", granted: true, grantedAt: "Mar 02, 2026", revokedAt: null, source: "preferences_page" },
  { id: "c-1037", subject: "Vikram Reddy", subjectEmail: "vikram.reddy@protonmail.com", type: "Analytics", granted: false, grantedAt: "Jan 18, 2026", revokedAt: "Feb 03, 2026", source: "cookie_banner" },
  { id: "c-1036", subject: "Vikram Reddy", subjectEmail: "vikram.reddy@protonmail.com", type: "Data processing", granted: true, grantedAt: "Jan 18, 2026", revokedAt: null, source: "signup_form" },
  { id: "c-1035", subject: "Sophie Lefèvre", subjectEmail: "sophie.l@outlook.com", type: "Marketing email", granted: true, grantedAt: "Jan 04, 2026", revokedAt: null, source: "signup_form" },
  { id: "c-1034", subject: "Sophie Lefèvre", subjectEmail: "sophie.l@outlook.com", type: "Third-party integrations", granted: true, grantedAt: "Jan 04, 2026", revokedAt: null, source: "preferences_page" },
  { id: "c-1033", subject: "Nadia Hassan", subjectEmail: "n.hassan@summit.ca", type: "Data processing", granted: true, grantedAt: "Aug 02, 2025", revokedAt: null, source: "employment_agreement" },
];

const breachSeed = [
  {
    id: "BR-2026-002",
    discoveredAt: "Mar 09, 2026",
    occurredAt: "Mar 07, 2026 (est.)",
    severity: "low",
    affected: 1,
    affectedDescription: "One residential client",
    dataTypes: ["Email address", "Project name"],
    containment: "Misdirected email retracted via Gmail confidential mode within 12 minutes. Recipient confirmed deletion. Targeted client notified by phone.",
    notifiedUsersAt: "Mar 09, 2026",
    reportedToCAIAt: null,
    closedAt: "Mar 12, 2026",
    closedBy: "Marielle Tremblay",
    status: "closed",
  },
  {
    id: "BR-2026-001",
    discoveredAt: "Jan 22, 2026",
    occurredAt: "Jan 19, 2026 (est.)",
    severity: "medium",
    affected: 14,
    affectedDescription: "14 subcontractor users (one trade partner org)",
    dataTypes: ["Email address", "Phone number", "Trade license number"],
    containment: "API key from rotated env file was committed in error. Key revoked within 22 minutes of detection. Logs reviewed — no API access logged from unauthorized origin. Affected partner notified.",
    notifiedUsersAt: "Jan 23, 2026",
    reportedToCAIAt: "Jan 24, 2026",
    closedAt: "Feb 05, 2026",
    closedBy: "Dan Carter",
    status: "closed",
  },
];

const consentTypeCatalog = [
  { id: "data_processing", label: "Essential service data processing", required: true, desc: "Required to provide the service. Includes account, project, and billing records." },
  { id: "marketing_email", label: "Marketing email", required: false, desc: "Product news, customer stories, and occasional promotional offers. Unsubscribe anytime." },
  { id: "product_updates", label: "Product updates", required: false, desc: "Feature releases, downtime notices, and security advisories. Recommended." },
  { id: "analytics", label: "Anonymous usage analytics", required: false, desc: "Aggregated, deidentified product analytics that help us improve the experience." },
  { id: "third_party", label: "Third-party integrations", required: false, desc: "Sharing with the integrations you've connected (e.g. QuickBooks, calendar)." },
];

const userConsentInitial = {
  data_processing: true,
  marketing_email: true,
  product_updates: true,
  analytics: false,
  third_party: true,
};

const userConsentHistory = [
  { date: "Apr 09, 2026 · 9:41 AM", event: "Revoked", target: "Anonymous usage analytics", source: "Settings · Privacy" },
  { date: "Mar 22, 2026 · 4:18 PM", event: "Granted", target: "Third-party integrations", source: "Settings · Privacy" },
  { date: "Mar 12, 2026 · 11:02 AM", event: "Granted", target: "Marketing email", source: "Cookie banner" },
  { date: "Mar 12, 2026 · 11:02 AM", event: "Granted", target: "Product updates", source: "Cookie banner" },
  { date: "Mar 12, 2026 · 11:02 AM", event: "Granted", target: "Essential service data processing", source: "Sign-up form" },
];

// ── Helpers ─────────────────────────────────────────────────────
const fmtType = (t) => ({ access: "Access", deletion: "Deletion", rectification: "Rectification", portability: "Portability" }[t] || t);
const fmtStatus = (s) => ({ received: "Received", in_progress: "In progress", completed: "Completed", rejected: "Rejected" }[s] || s);
const slaTone = (days, status) => {
  if (status === "completed" || status === "rejected") return "muted";
  if (days <= 3) return "danger";
  if (days <= 10) return "warn";
  return "ok";
};
const sevTone = (s) => ({ low: "info", medium: "warn", high: "danger", critical: "danger" }[s] || "muted");

// ── Component ───────────────────────────────────────────────────
export default function PrivacyOfficerLaw25Paired() {
  const [view, setView] = useState("admin"); // admin | intake | user
  const [dark, setDark] = useState(false);

  // Admin state
  const [adminTab, setAdminTab] = useState("dsar"); // dsar | consents | breaches
  const [dsars, setDsars] = useState(dsarSeed);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openDsar, setOpenDsar] = useState(null);
  const [showOfficerPicker, setShowOfficerPicker] = useState(false);
  const [pickedOfficer, setPickedOfficer] = useState(officer.id);
  const [consents] = useState(consentSeed);
  const [consentSearch, setConsentSearch] = useState("");
  const [consentScope, setConsentScope] = useState("all"); // all | active | revoked
  const [breaches, setBreaches] = useState(breachSeed);
  const [showLogBreach, setShowLogBreach] = useState(false);
  const [breachForm, setBreachForm] = useState({
    discoveredAt: "May 01, 2026", occurredAt: "", severity: "low",
    affected: "", affectedDescription: "", dataTypes: "", containment: "",
  });

  // Intake state
  const [intake, setIntake] = useState({
    name: "", email: "", accountEmail: "", province: "QC",
    requestType: "access", description: "", captcha: false, agreeIdentity: false,
  });
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);

  // End-user consent manager
  const [userConsents, setUserConsents] = useState(userConsentInitial);
  const [userTab, setUserTab] = useState("preferences"); // preferences | history | requests

  // Filtered DSARs
  const filteredDsars = dsars.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.requestType !== typeFilter) return false;
    return true;
  });

  // Filtered consents
  const filteredConsents = consents.filter((c) => {
    if (consentScope === "active" && !c.granted) return false;
    if (consentScope === "revoked" && c.granted) return false;
    if (consentSearch) {
      const q = consentSearch.toLowerCase();
      if (!c.subject.toLowerCase().includes(q) && !c.subjectEmail.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const dsarOpen = dsars.filter((d) => d.status === "received" || d.status === "in_progress").length;
  const dsarUrgent = dsars.filter((d) => (d.status === "received" || d.status === "in_progress") && d.daysRemaining <= 7).length;
  const dsarCompleted30 = dsars.filter((d) => d.status === "completed").length;
  const consentsActive = consents.filter((c) => c.granted).length;
  const consentsRevoked30 = consents.filter((c) => !c.granted).length;
  const breachesOpen = breaches.filter((b) => b.status !== "closed").length;
  const breachesYTD = breaches.length;

  // DSAR actions
  const advanceDsar = (id, next) => {
    setDsars(dsars.map((d) => d.id === id
      ? { ...d, status: next, completedAt: (next === "completed" || next === "rejected") ? "May 01, 2026" : d.completedAt }
      : d));
    setOpenDsar(null);
  };
  const assignDsar = (id, who) => {
    setDsars(dsars.map((d) => d.id === id ? { ...d, assignedTo: who } : d));
  };

  // Breach action
  const submitBreach = () => {
    if (!breachForm.discoveredAt || !breachForm.affectedDescription) return;
    const next = {
      id: `BR-2026-${String(breaches.length + 1).padStart(3, "0")}`,
      discoveredAt: breachForm.discoveredAt,
      occurredAt: breachForm.occurredAt || "Unknown",
      severity: breachForm.severity,
      affected: parseInt(breachForm.affected || "0", 10) || 0,
      affectedDescription: breachForm.affectedDescription,
      dataTypes: breachForm.dataTypes ? breachForm.dataTypes.split(",").map((s) => s.trim()) : [],
      containment: breachForm.containment,
      notifiedUsersAt: null,
      reportedToCAIAt: null,
      closedAt: null,
      closedBy: null,
      status: "open",
    };
    setBreaches([next, ...breaches]);
    setShowLogBreach(false);
    setBreachForm({ discoveredAt: "May 01, 2026", occurredAt: "", severity: "low", affected: "", affectedDescription: "", dataTypes: "", containment: "" });
  };

  return (
    <div className={`po ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.po{
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
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);--shri:0 0 0 3px rgba(91,79,199,.15);
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);min-height:100vh;
}
.po.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4d92cf;--in-s:#102230;--in-t:#7eb8e3;
}

/* ── Top harness (prototype-only view switcher) ── */
.po-harness{
  display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:10px 18px;background:var(--s1);border-bottom:1px solid var(--s3);
  position:sticky;top:0;z-index:50;
}
.po-harness-meta{display:flex;align-items:center;gap:12px;}
.po-harness-meta .step{font-family:var(--fd);font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);}
.po-harness-meta .name{font-family:var(--fd);font-size:14px;font-weight:680;color:var(--t1);letter-spacing:-.01em;}
.po-harness-tabs{display:flex;gap:4px;background:var(--s2);padding:3px;border-radius:var(--r-m);}
.po-harness-tab{
  font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t2);
  padding:7px 14px;border-radius:7px;cursor:pointer;border:none;background:transparent;
  display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);
}
.po-harness-tab:hover{color:var(--t1);}
.po-harness-tab.active{background:var(--s1);color:var(--t1);box-shadow:var(--shsm);}
.po-harness-tab .num{font-family:var(--fm);font-size:10px;color:var(--t3);font-weight:500;}
.po-harness-tab.active .num{color:var(--ac);}
.theme-tog{
  border:1px solid var(--s3);background:var(--s1);width:32px;height:32px;border-radius:var(--r-s);
  display:inline-flex;align-items:center;justify-content:center;color:var(--t2);cursor:pointer;
  transition:all var(--df) var(--e);
}
.theme-tog:hover{background:var(--sh);color:var(--t1);}

/* ────────────────────────────────────────
   SHARED: Portal shell pieces (admin + user views)
   ──────────────────────────────────────── */
.shell{display:grid;grid-template-columns:var(--sbw) 1fr;min-height:calc(100vh - 53px);}
.sb{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;height:calc(100vh - 53px);position:sticky;top:53px;}
.sb-head{padding:18px 20px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--s3);}
.sb-mark{display:flex;align-items:center;gap:9px;}
.sb-brand{font-family:var(--fd);font-size:15px;font-weight:760;color:var(--t1);letter-spacing:-.02em;}
.sb-org{padding:11px 20px;border-bottom:1px solid var(--s3);}
.sb-org .name{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);letter-spacing:-.01em;}
.sb-org .meta{font-size:12px;color:var(--t3);margin-top:1px;}
.sb-nav{flex:1;overflow-y:auto;padding:12px 0;}
.sb-section{padding:10px 20px 4px;font-family:var(--fd);font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--t3);}
.sb-item{
  display:flex;align-items:center;justify-content:space-between;padding:7px 20px;
  font-size:13px;font-weight:540;color:var(--t2);cursor:pointer;border-left:2px solid transparent;
  transition:all var(--df) var(--e);
}
.sb-item:hover{background:var(--sh);color:var(--t1);}
.sb-item.active{background:var(--s2);color:var(--t1);border-left-color:var(--ac);font-weight:640;}
.sb-item .badge{
  font-family:var(--fd);font-size:10px;font-weight:700;
  background:var(--s2);color:var(--t2);padding:1px 7px;border-radius:999px;
}
.sb-item .badge.warn{background:var(--wr-s);color:var(--wr-t);}
.sb-item .badge.danger{background:var(--dg-s);color:var(--dg-t);}
.sb-foot{border-top:1px solid var(--s3);padding:12px 20px;display:flex;align-items:center;gap:10px;}
.sb-avt{width:32px;height:32px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:12px;font-weight:700;}
.sb-foot .uname{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1);}
.sb-foot .urole{font-size:11.5px;color:var(--t3);}

.main{display:flex;flex-direction:column;}
.tb{
  height:var(--tbh);border-bottom:1px solid var(--s3);background:var(--s1);
  display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:53px;z-index:5;
}
.tb-bc{font-size:12.5px;color:var(--t3);}
.tb-bc .sep{margin:0 7px;color:var(--s4);}
.tb-bc .cur{color:var(--t1);font-weight:580;}
.tb-acts{display:flex;align-items:center;gap:8px;}
.icon-btn{
  border:1px solid var(--s3);background:var(--s1);width:34px;height:34px;border-radius:var(--r-s);
  display:flex;align-items:center;justify-content:center;color:var(--t2);cursor:pointer;
  transition:all var(--df) var(--e);position:relative;
}
.icon-btn:hover{background:var(--sh);color:var(--t1);}
.icon-btn .dot{position:absolute;top:8px;right:8px;width:6px;height:6px;border-radius:50%;background:var(--ac);}

.content{padding:26px 28px 60px;max-width:1320px;width:100%;}

/* ────────────────────────────────────────
   COMMON ATOMS
   ──────────────────────────────────────── */
.h1{font-family:var(--fd);font-size:26px;font-weight:820;color:var(--t1);letter-spacing:-.025em;line-height:1.15;}
.h1-sub{font-size:14px;color:var(--t2);margin-top:6px;max-width:740px;}
.h2{font-family:var(--fd);font-size:18px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.h3{font-family:var(--fd);font-size:14px;font-weight:680;color:var(--t1);letter-spacing:-.005em;}

.card{
  background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);
  overflow:hidden;transition:box-shadow var(--dn) var(--e);
}
.card:hover{box-shadow:var(--shsm);}
.card-h{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:1px solid var(--s3);
}
.card-h .ti{font-family:var(--fd);font-size:14.5px;font-weight:700;color:var(--t1);letter-spacing:-.01em;}
.card-h .sub{font-size:12px;color:var(--t3);margin-top:2px;}
.card-b{padding:16px 18px;}
.card-b.np{padding:0;}

.btn{
  font-family:var(--fd);font-size:13px;font-weight:620;
  padding:7px 14px;border-radius:var(--r-s);border:1px solid transparent;
  display:inline-flex;align-items:center;gap:6px;cursor:pointer;
  transition:all var(--df) var(--e);white-space:nowrap;
}
.btn.pr{background:var(--ac);color:#fff;}
.btn.pr:hover{background:var(--ac-h);}
.btn.sec{background:var(--s2);color:var(--t1);border-color:var(--s3);}
.btn.sec:hover{background:var(--sh);}
.btn.gh{background:transparent;color:var(--t2);}
.btn.gh:hover{background:var(--sh);color:var(--t1);}
.btn.dg{background:var(--dg-s);color:var(--dg-t);border-color:var(--dg-s);}
.btn.dg:hover{background:var(--dg);color:#fff;}
.btn.sm{padding:5px 10px;font-size:12px;}
.btn.lg{padding:10px 18px;font-size:14px;font-weight:650;}

.pill{
  font-family:var(--fd);font-size:10.5px;font-weight:700;letter-spacing:.02em;
  padding:3px 9px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;text-transform:uppercase;
}
.pill.ok{background:var(--ok-s);color:var(--ok-t);}
.pill.warn{background:var(--wr-s);color:var(--wr-t);}
.pill.danger{background:var(--dg-s);color:var(--dg-t);}
.pill.info{background:var(--in-s);color:var(--in-t);}
.pill.muted{background:var(--s2);color:var(--t3);}
.pill.acc{background:var(--ac-s);color:var(--ac-t);}

.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
.kpi{
  background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px 18px;
  position:relative;overflow:hidden;
}
.kpi .lbl{font-size:11.5px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;}
.kpi .val{font-family:var(--fd);font-size:24px;font-weight:820;color:var(--t1);letter-spacing:-.03em;line-height:1.05;}
.kpi .meta{font-size:12px;color:var(--t2);margin-top:4px;}
.kpi .meta .em{color:var(--ok-t);font-weight:620;}
.kpi .meta .em.dg{color:var(--dg-t);}
.kpi .meta .em.wr{color:var(--wr-t);}
.kpi.alert{background:linear-gradient(160deg,var(--wr-s) 0%,var(--s1) 60%);}
.kpi.alert .lbl{color:var(--wr-t);}

.field{display:flex;flex-direction:column;gap:6px;}
.field label{font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t1);letter-spacing:-.005em;}
.field .hint{font-size:12px;color:var(--t3);}
.field .req{color:var(--dg);margin-left:3px;}
.input,.textarea,.select{
  font-family:var(--fb);font-size:13.5px;color:var(--t1);
  border:1px solid var(--s3);background:var(--s1);border-radius:var(--r-s);
  padding:9px 12px;transition:all var(--df) var(--e);width:100%;
}
.input:focus,.textarea:focus,.select:focus{outline:none;border-color:var(--ac);box-shadow:var(--shri);}
.textarea{resize:vertical;min-height:90px;font-family:var(--fb);}

/* ────────────────────────────────────────
   ADMIN: Settings tab strip + page
   ──────────────────────────────────────── */
.settings-strip{
  display:flex;gap:6px;padding:6px;background:var(--s1);border:1px solid var(--s3);
  border-radius:var(--r-l);margin-bottom:20px;overflow-x:auto;
}
.settings-strip .stab{
  display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--r-s);
  font-family:var(--fd);font-size:12.5px;font-weight:600;color:var(--t2);cursor:pointer;
  white-space:nowrap;border:1px solid transparent;background:transparent;transition:all var(--df) var(--e);
}
.settings-strip .stab:hover{background:var(--sh);color:var(--t1);}
.settings-strip .stab.cur{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m);}
.settings-strip .stab .note{font-size:10.5px;color:var(--t3);font-weight:500;font-family:var(--fb);}
.settings-strip .stab.cur .note{color:var(--ac-t);opacity:.7;}

.officer-card{
  display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;
  padding:20px 22px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);
  margin-bottom:22px;position:relative;overflow:hidden;
}
.officer-card::before{
  content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac);
}
.officer-avt{
  width:56px;height:56px;border-radius:50%;background:var(--ac);color:#fff;
  display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:18px;font-weight:740;
  letter-spacing:-.01em;
}
.officer-info .role-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.officer-info .role-tag{
  font-family:var(--fd);font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  background:var(--ac-s);color:var(--ac-t);padding:3px 8px;border-radius:999px;
}
.officer-info .name{font-family:var(--fd);font-size:18px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.officer-info .role{font-size:13px;color:var(--t2);margin-top:2px;}
.officer-info .contact{display:flex;gap:14px;margin-top:8px;font-size:12.5px;color:var(--t2);}
.officer-info .contact span{display:inline-flex;align-items:center;gap:5px;}
.officer-info .since{font-size:11.5px;color:var(--t3);margin-top:6px;}

.subtab-row{
  display:flex;gap:0;border-bottom:1px solid var(--s3);margin-bottom:18px;
}
.subtab{
  font-family:var(--fd);font-size:13.5px;font-weight:600;color:var(--t3);
  padding:12px 18px;cursor:pointer;border-bottom:2px solid transparent;background:transparent;border:none;
  transition:all var(--df) var(--e);margin-bottom:-1px;
  display:inline-flex;align-items:center;gap:8px;
}
.subtab:hover{color:var(--t1);}
.subtab.cur{color:var(--t1);font-weight:700;border-bottom-color:var(--ac);}
.subtab .ct{
  font-family:var(--fm);font-size:11px;font-weight:500;
  background:var(--s2);color:var(--t2);padding:1px 7px;border-radius:999px;
}
.subtab.cur .ct{background:var(--ac-s);color:var(--ac-t);}

/* ── Filter bar ── */
.filter-bar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:12px 14px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);margin-bottom:14px;
}
.filter-pill{
  font-family:var(--fd);font-size:12px;font-weight:600;color:var(--t2);
  padding:5px 11px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);cursor:pointer;
  transition:all var(--df) var(--e);
}
.filter-pill:hover{background:var(--sh);}
.filter-pill.cur{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m);}
.search-wrap{flex:1;min-width:220px;display:flex;align-items:center;gap:8px;background:var(--s2);padding:6px 12px;border-radius:var(--r-s);border:1px solid var(--s3);}
.search-wrap .search-icon{color:var(--t3);}
.search-wrap input{flex:1;background:transparent;border:none;outline:none;font-family:var(--fb);font-size:13px;color:var(--t1);}
.filter-bar .grow{flex:1;}

/* ── Table ── */
.tbl{width:100%;border-collapse:collapse;}
.tbl thead th{
  font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);
  padding:10px 16px;text-align:left;border-bottom:1px solid var(--s3);background:var(--s2);
}
.tbl thead th.right{text-align:right;}
.tbl tbody td{padding:14px 16px;border-bottom:1px solid var(--s3);font-size:13px;color:var(--t1);vertical-align:middle;}
.tbl tbody tr:last-child td{border-bottom:none;}
.tbl tbody tr{transition:background var(--df) var(--e);cursor:pointer;}
.tbl tbody tr:hover{background:var(--sh);}
.tbl .id{font-family:var(--fm);font-size:12px;font-weight:560;color:var(--t2);letter-spacing:-.01em;}
.tbl .who{display:flex;flex-direction:column;}
.tbl .who .name{font-weight:580;color:var(--t1);}
.tbl .who .em{font-family:var(--fm);font-size:11.5px;color:var(--t3);margin-top:1px;}
.tbl .currency{font-family:var(--fd);font-weight:680;}
.tbl .right{text-align:right;}

/* ── DSAR drawer ── */
.drawer-mask{position:fixed;inset:0;background:rgba(12,14,20,.42);z-index:80;animation:fadein var(--dn) var(--e);}
.drawer{
  position:fixed;top:0;right:0;bottom:0;width:560px;max-width:96vw;
  background:var(--s1);border-left:1px solid var(--s3);z-index:81;display:flex;flex-direction:column;
  animation:slidein var(--dn) var(--e);
}
@keyframes slidein{from{transform:translateX(100%);}to{transform:translateX(0);}}
@keyframes fadein{from{opacity:0;}to{opacity:1;}}
.drawer-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;align-items:start;justify-content:space-between;gap:14px;}
.drawer-h .ti{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.drawer-h .id{font-family:var(--fm);font-size:12px;color:var(--t2);margin-top:3px;}
.drawer-b{flex:1;overflow-y:auto;padding:18px 22px;}
.drawer-row{padding:13px 0;border-bottom:1px solid var(--s3);}
.drawer-row:last-child{border-bottom:none;}
.drawer-row .lbl{font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);margin-bottom:6px;}
.drawer-row .val{font-size:13.5px;color:var(--t1);line-height:1.55;}
.drawer-row .val.mono{font-family:var(--fm);}
.drawer-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:space-between;gap:10px;background:var(--s2);}
.drawer-f .left{display:flex;gap:8px;}
.drawer-f .right{display:flex;gap:8px;}

/* ── Modal ── */
.modal-mask{position:fixed;inset:0;background:rgba(12,14,20,.5);z-index:90;display:flex;align-items:flex-start;justify-content:center;padding:8vh 18px;animation:fadein var(--dn) var(--e);}
.modal{
  background:var(--s1);border-radius:var(--r-xl);max-width:560px;width:100%;
  box-shadow:var(--shmd);overflow:hidden;animation:popin var(--dn) var(--e);
}
@keyframes popin{from{opacity:0;transform:translateY(8px) scale(.99);}to{opacity:1;transform:translateY(0) scale(1);}}
.modal-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;align-items:start;justify-content:space-between;}
.modal-h .ti{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.modal-h .sub{font-size:12.5px;color:var(--t2);margin-top:3px;}
.modal-b{padding:18px 22px;display:flex;flex-direction:column;gap:14px;max-height:62vh;overflow-y:auto;}
.modal-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px;background:var(--s2);}

.officer-pick{
  display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid var(--s3);border-radius:var(--r-m);
  cursor:pointer;transition:all var(--df) var(--e);
}
.officer-pick:hover{background:var(--sh);}
.officer-pick.cur{border-color:var(--ac);background:var(--ac-s);}
.officer-pick .avt{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:11.5px;font-weight:700;}
.officer-pick .info{flex:1;}
.officer-pick .info .n{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);}
.officer-pick .info .r{font-size:12px;color:var(--t3);}
.officer-pick .marker{
  width:18px;height:18px;border-radius:50%;border:2px solid var(--s4);background:transparent;flex-shrink:0;
  position:relative;
}
.officer-pick.cur .marker{border-color:var(--ac);background:var(--ac);}
.officer-pick.cur .marker::after{content:"";position:absolute;inset:3px;border-radius:50%;background:#fff;}

/* ── Note row (Law 25 boundary callout) ── */
.note{
  display:flex;gap:12px;padding:14px 16px;border-radius:var(--r-m);
  background:var(--in-s);border:1px solid var(--in-s);
}
.note .ic{color:var(--in-t);flex-shrink:0;margin-top:2px;}
.note .body{font-size:13px;color:var(--in-t);line-height:1.55;}
.note .body strong{font-weight:700;}

/* ── Breach severity dot ── */
.sev-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;}
.sev-dot.low{background:var(--in);}
.sev-dot.medium{background:var(--wr);}
.sev-dot.high{background:var(--dg);}

/* ── Empty state ── */
.empty{padding:48px 24px;text-align:center;}
.empty .ic{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:50%;background:var(--s2);color:var(--t3);margin-bottom:14px;}
.empty .ti{font-family:var(--fd);font-size:15px;font-weight:680;color:var(--t1);margin-bottom:5px;}
.empty .desc{font-size:13px;color:var(--t2);max-width:360px;margin:0 auto;}

/* ────────────────────────────────────────
   PUBLIC DSAR INTAKE (no shell)
   ──────────────────────────────────────── */
.intake{background:var(--s0);min-height:calc(100vh - 53px);}
.intake-top{
  background:var(--s1);border-bottom:1px solid var(--s3);padding:18px 24px;
  display:flex;align-items:center;justify-content:space-between;
}
.intake-top .brand{display:flex;align-items:center;gap:10px;}
.intake-top .brand .name{font-family:var(--fd);font-size:16px;font-weight:760;color:var(--t1);letter-spacing:-.02em;}
.intake-top .links{display:flex;gap:18px;font-size:13px;color:var(--t2);}
.intake-top .links a{color:var(--t2);text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
.intake-top .links a:hover{color:var(--t1);}
.intake-wrap{max-width:1080px;margin:0 auto;padding:32px 24px 60px;display:grid;grid-template-columns:1.55fr .85fr;gap:32px;}
@media (max-width:880px){.intake-wrap{grid-template-columns:1fr;}}
.intake-hero{margin-bottom:22px;}
.intake-hero .badge{display:inline-flex;align-items:center;gap:6px;font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ac-t);background:var(--ac-s);padding:5px 11px;border-radius:999px;}
.intake-hero h1{font-family:var(--fd);font-size:32px;font-weight:820;color:var(--t1);letter-spacing:-.028em;line-height:1.1;margin:14px 0 10px;}
.intake-hero p{font-size:15px;color:var(--t2);line-height:1.55;max-width:560px;}
.intake-form{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:26px;}
.intake-form .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media (max-width:540px){.intake-form .grid{grid-template-columns:1fr;}}
.req-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media (max-width:540px){.req-type-grid{grid-template-columns:1fr;}}
.req-type{
  border:1.5px solid var(--s3);border-radius:var(--r-m);padding:13px 14px;cursor:pointer;
  transition:all var(--df) var(--e);background:var(--s1);
}
.req-type:hover{border-color:var(--s4);}
.req-type.cur{border-color:var(--ac);background:var(--ac-s);}
.req-type .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;}
.req-type .ti{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);}
.req-type .desc{font-size:12px;color:var(--t2);line-height:1.5;}
.req-type .marker{
  width:18px;height:18px;border-radius:50%;border:2px solid var(--s4);background:transparent;
  position:relative;flex-shrink:0;
}
.req-type.cur .marker{border-color:var(--ac);background:var(--ac);}
.req-type.cur .marker::after{content:"";position:absolute;inset:3px;border-radius:50%;background:#fff;}
.captcha-box{
  border:1.5px dashed var(--s4);border-radius:var(--r-m);padding:18px;
  display:flex;align-items:center;gap:14px;background:var(--s2);
}
.captcha-box .check{
  width:22px;height:22px;border:2px solid var(--s4);border-radius:4px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;color:#fff;background:#fff;
  transition:all var(--df) var(--e);flex-shrink:0;
}
.captcha-box .check.on{background:var(--ac);border-color:var(--ac);}
.captcha-box .lbl{font-family:var(--fd);font-size:13px;font-weight:600;color:var(--t1);}
.captcha-box .meta{font-size:11.5px;color:var(--t3);font-family:var(--fm);margin-left:auto;}
.checkbox-row{display:flex;align-items:flex-start;gap:10px;cursor:pointer;}
.cb{
  width:18px;height:18px;border:1.5px solid var(--s4);border-radius:4px;flex-shrink:0;margin-top:2px;
  display:flex;align-items:center;justify-content:center;color:#fff;background:transparent;
  transition:all var(--df) var(--e);
}
.cb.on{background:var(--ac);border-color:var(--ac);}
.checkbox-row .lbl{font-size:13px;color:var(--t2);line-height:1.55;}

.intake-side{display:flex;flex-direction:column;gap:16px;}
.side-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:18px 20px;}
.side-card .ti{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);letter-spacing:-.005em;margin-bottom:10px;display:flex;align-items:center;gap:7px;}
.side-card ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px;}
.side-card li{display:flex;gap:10px;font-size:12.5px;color:var(--t2);line-height:1.55;}
.side-card li .num{font-family:var(--fd);font-size:11.5px;font-weight:740;color:var(--ac-t);background:var(--ac-s);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.side-card .meta{font-size:12px;color:var(--t3);line-height:1.55;margin-top:8px;}
.side-card .meta a{color:var(--ac-t);text-decoration:none;}

.intake-success{
  background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:42px 32px;text-align:center;max-width:540px;margin:60px auto;
}
.intake-success .ic{display:inline-flex;width:64px;height:64px;border-radius:50%;background:var(--ok-s);color:var(--ok-t);align-items:center;justify-content:center;margin-bottom:16px;}
.intake-success h2{font-family:var(--fd);font-size:24px;font-weight:780;color:var(--t1);letter-spacing:-.02em;margin-bottom:10px;}
.intake-success p{font-size:14px;color:var(--t2);line-height:1.55;margin-bottom:6px;}
.intake-success .ref{font-family:var(--fm);font-size:12.5px;color:var(--t1);background:var(--s2);padding:8px 14px;border-radius:var(--r-s);display:inline-block;margin-top:14px;}

/* ────────────────────────────────────────
   USER CONSENT MANAGER
   ──────────────────────────────────────── */
.uc-tab-row{display:flex;gap:0;border-bottom:1px solid var(--s3);margin-bottom:22px;}
.consent-grid{display:grid;grid-template-columns:1fr;gap:12px;}
.consent-card{
  background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);
  padding:18px 22px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;
  transition:all var(--df) var(--e);
}
.consent-card:hover{border-color:var(--s4);}
.consent-card.req{background:linear-gradient(160deg,var(--s2) 0%,var(--s1) 60%);}
.consent-card .info .head{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.consent-card .info .ti{font-family:var(--fd);font-size:14.5px;font-weight:700;color:var(--t1);letter-spacing:-.01em;}
.consent-card .info .desc{font-size:12.5px;color:var(--t2);line-height:1.55;max-width:560px;}
.consent-card .info .req-tag{
  font-family:var(--fd);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  background:var(--s2);color:var(--t3);padding:2px 8px;border-radius:999px;
}

/* Toggle switch */
.tog{
  position:relative;width:44px;height:24px;border-radius:999px;background:var(--s4);cursor:pointer;
  transition:background var(--df) var(--e);flex-shrink:0;
}
.tog.on{background:var(--ac);}
.tog::after{
  content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform var(--df) var(--e);
}
.tog.on::after{transform:translateX(20px);}
.tog.locked{cursor:not-allowed;opacity:.55;}

/* Timeline */
.timeline{display:flex;flex-direction:column;gap:0;}
.tl-row{display:grid;grid-template-columns:140px 18px 1fr;gap:16px;padding:14px 0;border-bottom:1px solid var(--s3);}
.tl-row:last-child{border-bottom:none;}
.tl-row .ts{font-size:12px;color:var(--t3);font-family:var(--fm);}
.tl-row .marker{
  width:10px;height:10px;border-radius:50%;background:var(--ac);margin:6px 4px;position:relative;
}
.tl-row .marker.dg{background:var(--dg);}
.tl-row .marker::after{
  content:"";position:absolute;left:50%;top:14px;width:1px;height:30px;background:var(--s3);transform:translateX(-50%);
}
.tl-row:last-child .marker::after{display:none;}
.tl-row .body .ev{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);}
.tl-row .body .src{font-size:12px;color:var(--t3);margin-top:2px;}

.action-card-row{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
@media (max-width:680px){.action-card-row{grid-template-columns:1fr;}}
.action-card{
  border:1px solid var(--s3);border-radius:var(--r-l);padding:20px;background:var(--s1);
  display:flex;flex-direction:column;gap:8px;transition:all var(--df) var(--e);
}
.action-card:hover{border-color:var(--s4);box-shadow:var(--shsm);}
.action-card .ic{
  width:36px;height:36px;border-radius:var(--r-s);background:var(--ac-s);color:var(--ac-t);
  display:flex;align-items:center;justify-content:center;
}
.action-card.dg .ic{background:var(--dg-s);color:var(--dg-t);}
.action-card .ti{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);}
.action-card .desc{font-size:12.5px;color:var(--t2);line-height:1.55;flex:1;}
.action-card .lnk{font-family:var(--fd);font-size:12.5px;font-weight:620;color:var(--ac-t);display:inline-flex;align-items:center;gap:5px;margin-top:6px;cursor:pointer;}

/* Save toast */
.toast{
  position:fixed;bottom:24px;right:24px;z-index:100;
  background:var(--t1);color:var(--s1);font-family:var(--fd);font-size:13px;font-weight:600;
  padding:11px 16px;border-radius:var(--r-m);box-shadow:var(--shmd);display:inline-flex;align-items:center;gap:8px;
  animation:popin var(--dn) var(--e);
}
      `}</style>

      {/* ──────────────────────────────────────────────
          Top harness — prototype-only view switcher
          ────────────────────────────────────────────── */}
      <div className="po-harness">
        <div className="po-harness-meta">
          <span className="step">Step 65 · 9-lite.1 #65</span>
          <span className="name">Law 25 Privacy Officer Surface</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="po-harness-tabs">
            <button className={`po-harness-tab ${view === "admin" ? "active" : ""}`} onClick={() => setView("admin")}>
              <span className="num">01</span> Privacy Officer Admin
            </button>
            <button className={`po-harness-tab ${view === "intake" ? "active" : ""}`} onClick={() => { setView("intake"); setIntakeSubmitted(false); }}>
              <span className="num">02</span> Public DSAR Intake
            </button>
            <button className={`po-harness-tab ${view === "user" ? "active" : ""}`} onClick={() => setView("user")}>
              <span className="num">03</span> User Consent Manager
            </button>
          </div>
          <button className="theme-tog" onClick={() => setDark(!dark)} title="Toggle theme">
            {dark ? I.sun : I.moon}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────
          VIEW 01 · PRIVACY OFFICER ADMIN
          (contractor portal · settings · privacy)
          ───────────────────────────────────────────────── */}
      {view === "admin" && (
        <div className="shell">
          {/* Sidebar (contractor) */}
          <aside className="sb">
            <div className="sb-head">
              <div className="sb-mark">{I.logo}<span className="sb-brand">BuiltCRM</span></div>
            </div>
            <div className="sb-org">
              <div className="name">Summit Contracting</div>
              <div className="meta">12 members · Contractor org</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Overview</div>
              <div className="sb-item">Dashboard</div>
              <div className="sb-section">Riverside Tower Fit-Out</div>
              <div className="sb-item">Project Home</div>
              <div className="sb-item">RFIs / Issues <span className="badge">3</span></div>
              <div className="sb-item">Change Orders <span className="badge warn">1</span></div>
              <div className="sb-item">Approvals <span className="badge">2</span></div>
              <div className="sb-item">Compliance</div>
              <div className="sb-item">Documents</div>
              <div className="sb-item">Schedule</div>
              <div className="sb-item">Messages <span className="badge">3</span></div>
              <div className="sb-section">Account</div>
              <div className="sb-item active">Settings</div>
            </nav>
            <div className="sb-foot">
              <div className="sb-avt">DC</div>
              <div>
                <div className="uname">Dan Carter</div>
                <div className="urole">Org Admin</div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="main">
            <header className="tb">
              <div className="tb-bc">
                <span>Settings</span><span className="sep">/</span>
                <span className="cur">Privacy &amp; Law 25</span>
              </div>
              <div className="tb-acts">
                <button className="icon-btn"><span className="dot"/>{I.bell}</button>
                <div className="sb-avt" style={{ width: 32, height: 32, fontSize: 11 }}>DC</div>
              </div>
            </header>

            <div className="content">
              {/* Page header */}
              <div style={{ marginBottom: 22 }}>
                <h1 className="h1">Privacy &amp; Law 25</h1>
                <p className="h1-sub">
                  Quebec Law 25 surface. Designate a Privacy Officer, work the DSAR queue against the
                  30-day SLA, manage the consent register, and log breaches. Real CAI notification is a
                  manual out-of-product step.
                </p>
              </div>

              {/* Settings strip — current is Privacy, others are cross-refs */}
              <div className="settings-strip">
                <button className="stab"><span>{I.building}</span> Organization <span className="note">Org</span></button>
                <button className="stab"><span>{I.users}</span> Team &amp; roles</button>
                <button className="stab"><span>{I.card}</span> Plan &amp; billing</button>
                <button className="stab"><span>{I.database}</span> Data</button>
                <button className="stab"><span>{I.lock}</span> Org security</button>
                <button className="stab cur"><span>{I.shield}</span> Privacy &amp; Law 25 <span className="note">Step 65</span></button>
                <button className="stab"><span>{I.flag}</span> Compliance &amp; CCQ <span className="note">Step 69</span></button>
              </div>

              {/* Officer designation card */}
              <div className="officer-card">
                <div className="officer-avt">{officer.avatar}</div>
                <div className="officer-info">
                  <div className="role-row">
                    <span className="role-tag">Designated Privacy Officer</span>
                    <span className="pill ok"><span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor", display: "inline-block", opacity: .8 }}/>Active</span>
                  </div>
                  <div className="name">{officer.name}</div>
                  <div className="role">{officer.role}</div>
                  <div className="contact">
                    <span>{I.mail}<span style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{officer.email}</span></span>
                    <span>{I.user}<span>{officer.phone}</span></span>
                  </div>
                  <div className="since">Designated since {officer.designatedAt} · public listing on /privacy/officer</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn sec" onClick={() => setShowOfficerPicker(true)}>{I.edit} Change officer</button>
                  <button className="btn gh sm">{I.ext} Public listing</button>
                </div>
              </div>

              {/* KPI row */}
              <div className="kpi-row">
                <div className="kpi">
                  <div className="lbl">Open DSARs</div>
                  <div className="val">{dsarOpen}</div>
                  <div className="meta">{dsarUrgent > 0 ? <><span className="em wr">{dsarUrgent} within 7-day SLA</span></> : "All within SLA"}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Completed YTD</div>
                  <div className="val">{dsarCompleted30}</div>
                  <div className="meta">Avg. resolution <span className="em">11 days</span></div>
                </div>
                <div className="kpi">
                  <div className="lbl">Active consents</div>
                  <div className="val">{consentsActive}</div>
                  <div className="meta">{consentsRevoked30} revoked across catalog</div>
                </div>
                <div className={`kpi ${breachesOpen > 0 ? "alert" : ""}`}>
                  <div className="lbl">Breaches open</div>
                  <div className="val">{breachesOpen}</div>
                  <div className="meta">{breachesYTD} logged YTD · 0 unreported &gt; 72h</div>
                </div>
              </div>

              {/* Boundary callout */}
              <div className="note" style={{ marginBottom: 22 }}>
                <div className="ic">{I.alert}</div>
                <div className="body">
                  <strong>What this surface does and doesn't do.</strong> This page provides Law 25 product
                  surface — DSAR intake, queue, consent register, breach log. <strong>It does not transmit notifications to the Commission d'accès à l'information.</strong> CAI reporting remains a manual step performed
                  by the Privacy Officer outside the product; this register tracks the date you say it was reported.
                </div>
              </div>

              {/* Sub-tab row */}
              <div className="subtab-row">
                <button className={`subtab ${adminTab === "dsar" ? "cur" : ""}`} onClick={() => setAdminTab("dsar")}>
                  {I.inbox} DSAR queue <span className="ct">{dsarOpen}</span>
                </button>
                <button className={`subtab ${adminTab === "consents" ? "cur" : ""}`} onClick={() => setAdminTab("consents")}>
                  {I.checkCircle} Consent register <span className="ct">{consents.length}</span>
                </button>
                <button className={`subtab ${adminTab === "breaches" ? "cur" : ""}`} onClick={() => setAdminTab("breaches")}>
                  {I.warn} Breach register <span className="ct">{breaches.length}</span>
                </button>
              </div>

              {/* DSAR queue */}
              {adminTab === "dsar" && (
                <>
                  <div className="filter-bar">
                    <div className="search-wrap">
                      <span className="search-icon">{I.search}</span>
                      <input placeholder="Search by requester or DSAR ID…" />
                    </div>
                    <button className={`filter-pill ${statusFilter === "all" ? "cur" : ""}`} onClick={() => setStatusFilter("all")}>All</button>
                    <button className={`filter-pill ${statusFilter === "received" ? "cur" : ""}`} onClick={() => setStatusFilter("received")}>Received</button>
                    <button className={`filter-pill ${statusFilter === "in_progress" ? "cur" : ""}`} onClick={() => setStatusFilter("in_progress")}>In progress</button>
                    <button className={`filter-pill ${statusFilter === "completed" ? "cur" : ""}`} onClick={() => setStatusFilter("completed")}>Completed</button>
                    <button className={`filter-pill ${statusFilter === "rejected" ? "cur" : ""}`} onClick={() => setStatusFilter("rejected")}>Rejected</button>
                    <span style={{ width: 1, height: 20, background: "var(--s3)" }} />
                    <button className={`filter-pill ${typeFilter === "all" ? "cur" : ""}`} onClick={() => setTypeFilter("all")}>All types</button>
                    <button className={`filter-pill ${typeFilter === "access" ? "cur" : ""}`} onClick={() => setTypeFilter("access")}>Access</button>
                    <button className={`filter-pill ${typeFilter === "deletion" ? "cur" : ""}`} onClick={() => setTypeFilter("deletion")}>Deletion</button>
                    <button className={`filter-pill ${typeFilter === "rectification" ? "cur" : ""}`} onClick={() => setTypeFilter("rectification")}>Rectification</button>
                    <button className={`filter-pill ${typeFilter === "portability" ? "cur" : ""}`} onClick={() => setTypeFilter("portability")}>Portability</button>
                  </div>

                  <div className="card">
                    <div className="card-b np">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th style={{ width: 142 }}>DSAR ID</th>
                            <th>Requester</th>
                            <th>Type</th>
                            <th>Received</th>
                            <th>SLA</th>
                            <th>Status</th>
                            <th>Assigned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDsars.map((d) => (
                            <tr key={d.id} onClick={() => setOpenDsar(d)}>
                              <td><span className="id">{d.id}</span></td>
                              <td>
                                <div className="who">
                                  <span className="name">{d.requesterName}</span>
                                  <span className="em">{d.requesterEmail}</span>
                                </div>
                              </td>
                              <td><span className="pill acc">{fmtType(d.requestType)}</span></td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{d.receivedAt}</td>
                              <td>
                                {d.status === "completed" || d.status === "rejected" ? (
                                  <span className="pill muted">{I.check} Closed</span>
                                ) : (
                                  <span className={`pill ${slaTone(d.daysRemaining, d.status)}`}>
                                    {I.clock} {d.daysRemaining}d left
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`pill ${d.status === "completed" ? "ok" : d.status === "rejected" ? "muted" : d.status === "in_progress" ? "info" : "warn"}`}>
                                  {fmtStatus(d.status)}
                                </span>
                              </td>
                              <td style={{ fontSize: 12.5, color: "var(--t2)" }}>{d.assignedTo || <span style={{ color: "var(--t3)" }}>Unassigned</span>}</td>
                            </tr>
                          ))}
                          {filteredDsars.length === 0 && (
                            <tr><td colSpan={7}><div className="empty"><div className="ic">{I.inbox}</div><div className="ti">No matching requests</div><div className="desc">Adjust the filters or wait for new submissions from /privacy/dsar.</div></div></td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Consent register */}
              {adminTab === "consents" && (
                <>
                  <div className="filter-bar">
                    <div className="search-wrap">
                      <span className="search-icon">{I.search}</span>
                      <input
                        placeholder="Search by name or email…"
                        value={consentSearch}
                        onChange={(e) => setConsentSearch(e.target.value)}
                      />
                    </div>
                    <button className={`filter-pill ${consentScope === "all" ? "cur" : ""}`} onClick={() => setConsentScope("all")}>All consents</button>
                    <button className={`filter-pill ${consentScope === "active" ? "cur" : ""}`} onClick={() => setConsentScope("active")}>Active</button>
                    <button className={`filter-pill ${consentScope === "revoked" ? "cur" : ""}`} onClick={() => setConsentScope("revoked")}>Revoked</button>
                    <div className="grow" />
                    <button className="btn sec sm">{I.download} Export CSV</button>
                  </div>

                  <div className="card">
                    <div className="card-b np">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Consent type</th>
                            <th>Status</th>
                            <th>Granted</th>
                            <th>Revoked</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredConsents.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <div className="who">
                                  <span className="name">{c.subject}</span>
                                  <span className="em">{c.subjectEmail}</span>
                                </div>
                              </td>
                              <td style={{ fontWeight: 580 }}>{c.type}</td>
                              <td>{c.granted ? <span className="pill ok">Granted</span> : <span className="pill muted">Revoked</span>}</td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{c.grantedAt}</td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{c.revokedAt || <span style={{ color: "var(--t3)" }}>—</span>}</td>
                              <td>
                                <span className="pill muted" style={{ fontFamily: "var(--fm)", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                                  {c.source}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Breach register */}
              {adminTab === "breaches" && (
                <>
                  <div className="filter-bar">
                    <div className="search-wrap">
                      <span className="search-icon">{I.search}</span>
                      <input placeholder="Search by ID, severity, or affected description…" />
                    </div>
                    <div className="grow" />
                    <button className="btn pr" onClick={() => setShowLogBreach(true)}>{I.plus} Log new breach</button>
                  </div>

                  <div className="card">
                    <div className="card-b np">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th style={{ width: 132 }}>Breach ID</th>
                            <th>Severity</th>
                            <th>Discovered</th>
                            <th>Affected</th>
                            <th>Notified users</th>
                            <th>CAI reported</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breaches.map((b) => (
                            <tr key={b.id}>
                              <td><span className="id">{b.id}</span></td>
                              <td>
                                <span className={`pill ${sevTone(b.severity)}`}>
                                  <span className={`sev-dot ${b.severity}`} />{b.severity}
                                </span>
                              </td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{b.discoveredAt}</td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 660, fontFamily: "var(--fd)" }}>{b.affected}</span>
                                  <span style={{ fontSize: 12, color: "var(--t3)" }}>{b.affectedDescription}</span>
                                </div>
                              </td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{b.notifiedUsersAt || <span style={{ color: "var(--t3)" }}>—</span>}</td>
                              <td style={{ color: "var(--t2)", fontSize: 12.5 }}>
                                {b.reportedToCAIAt ? (
                                  <span className="pill info" style={{ textTransform: "none", letterSpacing: 0 }}>{I.flag} {b.reportedToCAIAt}</span>
                                ) : (
                                  <span style={{ color: "var(--t3)" }}>Not reported</span>
                                )}
                              </td>
                              <td>
                                {b.status === "closed"
                                  ? <span className="pill ok">{I.check} Closed</span>
                                  : <span className="pill warn">Open</span>}
                              </td>
                            </tr>
                          ))}
                          {breaches.length === 0 && (
                            <tr>
                              <td colSpan={7}>
                                <div className="empty">
                                  <div className="ic">{I.shieldLg}</div>
                                  <div className="ti">No breaches logged</div>
                                  <div className="desc">Good. If something happens, log it within 72 hours of discovery — Law 25 requires it for incidents likely to cause serious harm.</div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* DSAR drawer */}
          {openDsar && (
            <>
              <div className="drawer-mask" onClick={() => setOpenDsar(null)} />
              <div className="drawer">
                <div className="drawer-h">
                  <div>
                    <div className="ti">{openDsar.requesterName}</div>
                    <div className="id">{openDsar.id} · {fmtType(openDsar.requestType)} request</div>
                  </div>
                  <button className="icon-btn" onClick={() => setOpenDsar(null)}>{I.x}</button>
                </div>
                <div className="drawer-b">
                  <div className="drawer-row">
                    <div className="lbl">Status</div>
                    <div className="val">
                      <span className={`pill ${openDsar.status === "completed" ? "ok" : openDsar.status === "rejected" ? "muted" : openDsar.status === "in_progress" ? "info" : "warn"}`}>
                        {fmtStatus(openDsar.status)}
                      </span>
                      {(openDsar.status === "received" || openDsar.status === "in_progress") && (
                        <span className={`pill ${slaTone(openDsar.daysRemaining, openDsar.status)}`} style={{ marginLeft: 8 }}>
                          {I.clock} {openDsar.daysRemaining}d left · due {openDsar.slaDueAt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="drawer-row">
                    <div className="lbl">Requester</div>
                    <div className="val">
                      {openDsar.requesterName}<br/>
                      <span className="mono" style={{ color: "var(--t2)", fontSize: 12.5 }}>{openDsar.requesterEmail}</span>
                    </div>
                  </div>
                  <div className="drawer-row">
                    <div className="lbl">Project context</div>
                    <div className="val">{openDsar.project}</div>
                  </div>
                  <div className="drawer-row">
                    <div className="lbl">Received</div>
                    <div className="val">{openDsar.receivedAt} · SLA due {openDsar.slaDueAt}</div>
                  </div>
                  <div className="drawer-row">
                    <div className="lbl">Notes</div>
                    <div className="val">{openDsar.notes}</div>
                  </div>
                  <div className="drawer-row">
                    <div className="lbl">Assigned to</div>
                    <div className="val" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select className="select" defaultValue={openDsar.assignedTo || ""} onChange={(e) => assignDsar(openDsar.id, e.target.value)}>
                        <option value="">Unassigned</option>
                        {officerCandidates.map((o) => <option key={o.id} value={o.name}>{o.name} · {o.role}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="drawer-row">
                    <div className="lbl">Audit trail</div>
                    <div className="val" style={{ fontSize: 12.5, color: "var(--t2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ color: "var(--t3)", display: "inline-flex" }}>{I.mail}</span>
                        <span>Received via /privacy/dsar · {openDsar.receivedAt}</span>
                      </div>
                      {openDsar.assignedTo && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "var(--t3)", display: "inline-flex" }}>{I.user}</span>
                          <span>Assigned to {openDsar.assignedTo}</span>
                        </div>
                      )}
                      {openDsar.status === "in_progress" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "var(--in-t)", display: "inline-flex" }}>{I.clock}</span>
                          <span>Status moved to In progress</span>
                        </div>
                      )}
                      {openDsar.completedAt && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "var(--ok-t)", display: "inline-flex" }}>{I.check}</span>
                          <span>Closed {openDsar.completedAt}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="drawer-f">
                  <div className="left">
                    <button className="btn gh sm">{I.download} Export package</button>
                  </div>
                  <div className="right">
                    {(openDsar.status === "received" || openDsar.status === "in_progress") && (
                      <>
                        <button className="btn dg sm" onClick={() => advanceDsar(openDsar.id, "rejected")}>Reject</button>
                        {openDsar.status === "received" && (
                          <button className="btn sec sm" onClick={() => advanceDsar(openDsar.id, "in_progress")}>Start work</button>
                        )}
                        <button className="btn pr sm" onClick={() => advanceDsar(openDsar.id, "completed")}>Mark complete</button>
                      </>
                    )}
                    {(openDsar.status === "completed" || openDsar.status === "rejected") && (
                      <button className="btn sec sm" onClick={() => setOpenDsar(null)}>Close</button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Officer picker modal */}
          {showOfficerPicker && (
            <div className="modal-mask" onClick={() => setShowOfficerPicker(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-h">
                  <div>
                    <div className="ti">Designate Privacy Officer</div>
                    <div className="sub">Required by Law 25 · One per organization · Public listing on /privacy/officer</div>
                  </div>
                  <button className="icon-btn" onClick={() => setShowOfficerPicker(false)}>{I.x}</button>
                </div>
                <div className="modal-b">
                  {officerCandidates.map((o) => (
                    <div
                      key={o.id}
                      className={`officer-pick ${pickedOfficer === o.id ? "cur" : ""}`}
                      onClick={() => setPickedOfficer(o.id)}
                    >
                      <div className="avt">{o.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                      <div className="info">
                        <div className="n">{o.name}</div>
                        <div className="r">{o.role}</div>
                      </div>
                      <div className="marker" />
                    </div>
                  ))}
                  <div className="note">
                    <div className="ic">{I.alert}</div>
                    <div className="body">
                      The designated officer's name and contact email will appear on the public
                      <strong> /privacy/officer</strong> page, satisfying Law 25 §3.1.
                    </div>
                  </div>
                </div>
                <div className="modal-f">
                  <button className="btn gh" onClick={() => setShowOfficerPicker(false)}>Cancel</button>
                  <button className="btn pr" onClick={() => setShowOfficerPicker(false)}>Confirm designation</button>
                </div>
              </div>
            </div>
          )}

          {/* Log breach modal */}
          {showLogBreach && (
            <div className="modal-mask" onClick={() => setShowLogBreach(false)}>
              <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-h">
                  <div>
                    <div className="ti">Log new breach</div>
                    <div className="sub">Required within 72 hours of discovery if likely to cause serious harm</div>
                  </div>
                  <button className="icon-btn" onClick={() => setShowLogBreach(false)}>{I.x}</button>
                </div>
                <div className="modal-b">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div className="field">
                      <label>Discovered <span className="req">*</span></label>
                      <input className="input" value={breachForm.discoveredAt} onChange={(e) => setBreachForm({ ...breachForm, discoveredAt: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Occurred (estimated)</label>
                      <input className="input" placeholder="e.g. Apr 28, 2026 (est.)" value={breachForm.occurredAt} onChange={(e) => setBreachForm({ ...breachForm, occurredAt: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Severity <span className="req">*</span></label>
                    <select className="select" value={breachForm.severity} onChange={(e) => setBreachForm({ ...breachForm, severity: e.target.value })}>
                      <option value="low">Low — minimal risk of harm</option>
                      <option value="medium">Medium — moderate risk, contained</option>
                      <option value="high">High — serious risk, notify subjects</option>
                      <option value="critical">Critical — broad exposure, notify CAI</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
                    <div className="field">
                      <label>Subjects affected</label>
                      <input className="input" placeholder="Count" value={breachForm.affected} onChange={(e) => setBreachForm({ ...breachForm, affected: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Description <span className="req">*</span></label>
                      <input className="input" placeholder="e.g. 14 subcontractor users (one trade partner)" value={breachForm.affectedDescription} onChange={(e) => setBreachForm({ ...breachForm, affectedDescription: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Data types affected</label>
                    <input className="input" placeholder="Comma-separated, e.g. Email address, Phone number, Trade license" value={breachForm.dataTypes} onChange={(e) => setBreachForm({ ...breachForm, dataTypes: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Containment actions</label>
                    <textarea className="textarea" placeholder="What was done to contain the breach? Include timestamps where possible." value={breachForm.containment} onChange={(e) => setBreachForm({ ...breachForm, containment: e.target.value })} />
                    <span className="hint">Logged in audit trail. Subjects can be notified after submission. CAI notification is a manual step outside this product.</span>
                  </div>
                </div>
                <div className="modal-f">
                  <button className="btn gh" onClick={() => setShowLogBreach(false)}>Cancel</button>
                  <button className="btn pr" onClick={submitBreach}>Log breach</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────
          VIEW 02 · PUBLIC DSAR INTAKE
          (no auth · /privacy/dsar)
          ───────────────────────────────────────────────── */}
      {view === "intake" && (
        <div className="intake">
          <div className="intake-top">
            <div className="brand">{I.logo}<span className="name">BuiltCRM</span></div>
            <div className="links">
              <a href="#">Privacy policy {I.ext}</a>
              <a href="#">Privacy Officer {I.ext}</a>
              <a href="#">Back to site</a>
            </div>
          </div>

          {!intakeSubmitted ? (
            <div className="intake-wrap">
              <div>
                <div className="intake-hero">
                  <span className="badge">{I.shield} Quebec Law 25 · DSAR</span>
                  <h1>Submit a privacy request</h1>
                  <p>
                    Under Quebec's Law 25 and similar regulations elsewhere, you can request access to,
                    correction of, deletion of, or a portable copy of personal data we hold about you.
                    We respond within <strong>30 days</strong>.
                  </p>
                </div>

                <div className="intake-form">
                  <h3 className="h3" style={{ marginBottom: 14 }}>Your identity</h3>
                  <div className="grid" style={{ marginBottom: 14 }}>
                    <div className="field">
                      <label>Full name <span className="req">*</span></label>
                      <input className="input" value={intake.name} onChange={(e) => setIntake({ ...intake, name: e.target.value })} placeholder="Marie Lefèvre" />
                    </div>
                    <div className="field">
                      <label>Contact email <span className="req">*</span></label>
                      <input className="input" type="email" value={intake.email} onChange={(e) => setIntake({ ...intake, email: e.target.value })} placeholder="you@example.com" />
                    </div>
                  </div>
                  <div className="grid" style={{ marginBottom: 22 }}>
                    <div className="field">
                      <label>Account email <span className="hint" style={{ display: "inline" }}>(if different)</span></label>
                      <input className="input" value={intake.accountEmail} onChange={(e) => setIntake({ ...intake, accountEmail: e.target.value })} placeholder="If you held a BuiltCRM account under a different email" />
                    </div>
                    <div className="field">
                      <label>Province / state</label>
                      <select className="select" value={intake.province} onChange={(e) => setIntake({ ...intake, province: e.target.value })}>
                        <option value="QC">Quebec (Law 25)</option>
                        <option value="ON">Ontario (PIPEDA)</option>
                        <option value="BC">British Columbia (PIPA)</option>
                        <option value="AB">Alberta (PIPA)</option>
                        <option value="OTHER">Other / outside Canada</option>
                      </select>
                    </div>
                  </div>

                  <h3 className="h3" style={{ marginBottom: 12 }}>What kind of request?</h3>
                  <div className="req-type-grid" style={{ marginBottom: 22 }}>
                    {[
                      { id: "access", ti: "Access", desc: "Receive a copy of personal data we hold about you, in a readable format." },
                      { id: "deletion", ti: "Deletion", desc: "Have your personal data removed, subject to legal retention requirements." },
                      { id: "rectification", ti: "Rectification", desc: "Correct inaccurate or incomplete personal data we hold about you." },
                      { id: "portability", ti: "Portability", desc: "Receive a structured, machine-readable export to transfer to another service." },
                    ].map((t) => (
                      <div key={t.id} className={`req-type ${intake.requestType === t.id ? "cur" : ""}`} onClick={() => setIntake({ ...intake, requestType: t.id })}>
                        <div className="head">
                          <div className="ti">{t.ti}</div>
                          <div className="marker" />
                        </div>
                        <div className="desc">{t.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="field" style={{ marginBottom: 22 }}>
                    <label>Description of your request <span className="req">*</span></label>
                    <textarea className="textarea" rows={4} value={intake.description} onChange={(e) => setIntake({ ...intake, description: e.target.value })} placeholder="Tell us what you're looking for. The more specific you are (project name, timeframe, type of data), the faster we can respond." />
                    <span className="hint">If your request is broad, we may ask for clarification — the 30-day clock pauses once for a single clarification request.</span>
                  </div>

                  <div className="captcha-box" style={{ marginBottom: 16 }}>
                    <div className={`check ${intake.captcha ? "on" : ""}`} onClick={() => setIntake({ ...intake, captcha: !intake.captcha })}>
                      {intake.captcha && I.check}
                    </div>
                    <span className="lbl">I'm not a robot</span>
                    <span className="meta">reCAPTCHA placeholder</span>
                  </div>

                  <div className="checkbox-row" style={{ marginBottom: 22 }} onClick={() => setIntake({ ...intake, agreeIdentity: !intake.agreeIdentity })}>
                    <div className={`cb ${intake.agreeIdentity ? "on" : ""}`}>{intake.agreeIdentity && I.check}</div>
                    <div className="lbl">
                      I confirm I am the person whose data is being requested, or I am the legal
                      representative authorized to make this request. I understand BuiltCRM may ask for
                      additional identity verification before fulfilling the request.
                    </div>
                  </div>

                  <button
                    className="btn pr lg"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={!intake.name || !intake.email || !intake.description || !intake.captcha || !intake.agreeIdentity}
                    onClick={() => setIntakeSubmitted(true)}
                  >
                    Submit request
                  </button>
                </div>
              </div>

              <div className="intake-side">
                <div className="side-card">
                  <div className="ti">{I.clock} What happens next</div>
                  <ul>
                    <li><span className="num">1</span><span>You'll get a confirmation email with a reference number within 5 minutes.</span></li>
                    <li><span className="num">2</span><span>Our Privacy Officer reviews and may request identity verification.</span></li>
                    <li><span className="num">3</span><span>We respond within <strong>30 days</strong> with the request fulfilled or an explanation.</span></li>
                    <li><span className="num">4</span><span>Complex requests may be extended once by 30 days with notice.</span></li>
                  </ul>
                </div>
                <div className="side-card">
                  <div className="ti">{I.user} Privacy Officer</div>
                  <div style={{ fontFamily: "var(--fd)", fontSize: 13.5, fontWeight: 680, color: "var(--t1)", marginBottom: 2 }}>{officer.name}</div>
                  <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 8 }}>{officer.role}</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--t2)" }}>{officer.email}</div>
                  <div className="meta">
                    Not satisfied with our response? You may file a complaint with the
                    <a href="#"> Commission d'accès à l'information</a> at any time.
                  </div>
                </div>
                <div className="side-card">
                  <div className="ti">{I.lock} Your privacy</div>
                  <div className="meta" style={{ marginTop: 0 }}>
                    Information you submit through this form is encrypted in transit and stored only as
                    long as needed to process your request — typically 90 days after closure.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="intake-success">
              <div className="ic">{I.checkCircle}</div>
              <h2>Request submitted</h2>
              <p>We've sent a confirmation to <strong>{intake.email}</strong>.</p>
              <p>Our Privacy Officer will respond within 30 days.</p>
              <div className="ref">Reference: DSAR-2026-019</div>
              <div style={{ marginTop: 22 }}>
                <button className="btn sec" onClick={() => { setIntakeSubmitted(false); setIntake({ name: "", email: "", accountEmail: "", province: "QC", requestType: "access", description: "", captcha: false, agreeIdentity: false }); }}>
                  Submit another request
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────
          VIEW 03 · END-USER CONSENT MANAGER
          (any portal · settings · privacy)
          ───────────────────────────────────────────────── */}
      {view === "user" && (
        <div className="shell">
          <aside className="sb">
            <div className="sb-head">
              <div className="sb-mark">{I.logo}<span className="sb-brand">BuiltCRM</span></div>
            </div>
            <div className="sb-org">
              <div className="name">Maplewood Heights</div>
              <div className="meta">Residential client</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Your project</div>
              <div className="sb-item">Project Home</div>
              <div className="sb-item">Selections <span className="badge">3</span></div>
              <div className="sb-item">Decisions <span className="badge">1</span></div>
              <div className="sb-item">Schedule</div>
              <div className="sb-item">Documents</div>
              <div className="sb-item">Messages <span className="badge">2</span></div>
              <div className="sb-section">Account</div>
              <div className="sb-item">Profile</div>
              <div className="sb-item">Notifications</div>
              <div className="sb-item active">Privacy &amp; consents</div>
            </nav>
            <div className="sb-foot">
              <div className="sb-avt" style={{ background: "#2a7f6f" }}>EB</div>
              <div>
                <div className="uname">Élise Bouchard</div>
                <div className="urole">Residential client</div>
              </div>
            </div>
          </aside>

          <div className="main">
            <header className="tb">
              <div className="tb-bc">
                <span>Account</span><span className="sep">/</span>
                <span className="cur">Privacy &amp; consents</span>
              </div>
              <div className="tb-acts">
                <button className="icon-btn">{I.bell}</button>
                <div className="sb-avt" style={{ width: 32, height: 32, fontSize: 11, background: "#2a7f6f" }}>EB</div>
              </div>
            </header>

            <div className="content">
              <div style={{ marginBottom: 22 }}>
                <h1 className="h1">Privacy &amp; consents</h1>
                <p className="h1-sub">
                  You're in control of your data. Manage what you've agreed to share, see your full
                  consent history, and request a copy or deletion of your data anytime.
                </p>
              </div>

              {/* Tab row */}
              <div className="uc-tab-row">
                <button className={`subtab ${userTab === "preferences" ? "cur" : ""}`} onClick={() => setUserTab("preferences")}>
                  {I.checkCircle} Consent preferences
                </button>
                <button className={`subtab ${userTab === "history" ? "cur" : ""}`} onClick={() => setUserTab("history")}>
                  {I.clock} History <span className="ct">{userConsentHistory.length}</span>
                </button>
                <button className={`subtab ${userTab === "requests" ? "cur" : ""}`} onClick={() => setUserTab("requests")}>
                  {I.fileText} Your data
                </button>
              </div>

              {userTab === "preferences" && (
                <div className="consent-grid">
                  {consentTypeCatalog.map((ct) => (
                    <div key={ct.id} className={`consent-card ${ct.required ? "req" : ""}`}>
                      <div className="info">
                        <div className="head">
                          <div className="ti">{ct.label}</div>
                          {ct.required && <span className="req-tag">Required</span>}
                        </div>
                        <div className="desc">{ct.desc}</div>
                      </div>
                      <div
                        className={`tog ${userConsents[ct.id] ? "on" : ""} ${ct.required ? "locked" : ""}`}
                        onClick={() => {
                          if (ct.required) return;
                          setUserConsents({ ...userConsents, [ct.id]: !userConsents[ct.id] });
                        }}
                      />
                    </div>
                  ))}

                  <div className="note" style={{ marginTop: 6 }}>
                    <div className="ic">{I.alert}</div>
                    <div className="body">
                      Changes here apply going forward. They don't delete data we've already collected — for that,
                      use <strong>Your data → Request deletion</strong> below.
                    </div>
                  </div>
                </div>
              )}

              {userTab === "history" && (
                <div className="card">
                  <div className="card-h">
                    <div>
                      <div className="ti">Consent history</div>
                      <div className="sub">Every time you've granted, revoked, or updated a consent</div>
                    </div>
                    <button className="btn sec sm">{I.download} Export history</button>
                  </div>
                  <div className="card-b" style={{ paddingTop: 4 }}>
                    <div className="timeline">
                      {userConsentHistory.map((h, i) => (
                        <div className="tl-row" key={i}>
                          <div className="ts">{h.date}</div>
                          <div className={`marker ${h.event === "Revoked" ? "dg" : ""}`} />
                          <div className="body">
                            <div className="ev">{h.event} · {h.target}</div>
                            <div className="src">via {h.source}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {userTab === "requests" && (
                <>
                  <div className="action-card-row" style={{ marginBottom: 22 }}>
                    <div className="action-card">
                      <div className="ic">{I.download}</div>
                      <div className="ti">Request a copy of your data</div>
                      <div className="desc">We'll prepare a structured export of everything we hold about you and email you a secure download link within 30 days.</div>
                      <div className="lnk">Request access copy {I.chevR}</div>
                    </div>
                    <div className="action-card">
                      <div className="ic">{I.refresh}</div>
                      <div className="ti">Correct your information</div>
                      <div className="desc">Spot something wrong in our records? Tell us what to fix and our Privacy Officer will follow up to confirm and update.</div>
                      <div className="lnk">Request correction {I.chevR}</div>
                    </div>
                    <div className="action-card">
                      <div className="ic">{I.fileText}</div>
                      <div className="ti">Portable export</div>
                      <div className="desc">A machine-readable JSON archive of your data, suitable for transfer to another service.</div>
                      <div className="lnk">Request portable export {I.chevR}</div>
                    </div>
                    <div className="action-card dg">
                      <div className="ic">{I.trash}</div>
                      <div className="ti">Request deletion</div>
                      <div className="desc">We'll delete your personal data within 30 days, except records we're legally required to retain (e.g. tax records for 7 years).</div>
                      <div className="lnk" style={{ color: "var(--dg-t)" }}>Request deletion {I.chevR}</div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-h">
                      <div>
                        <div className="ti">Active requests</div>
                        <div className="sub">Requests you've made about your data</div>
                      </div>
                    </div>
                    <div className="card-b np">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Type</th>
                            <th>Submitted</th>
                            <th>Status</th>
                            <th>SLA</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><span className="id">DSAR-2026-018</span></td>
                            <td><span className="pill acc">Deletion</span></td>
                            <td style={{ color: "var(--t2)", fontSize: 12.5 }}>Apr 24, 2026</td>
                            <td><span className="pill info">In progress</span></td>
                            <td><span className="pill ok">{I.clock} 23d left</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
