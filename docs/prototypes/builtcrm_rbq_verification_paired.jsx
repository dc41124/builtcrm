import { useState } from "react";

/*
 * STEP 66 — RBQ LICENSE VERIFICATION (PAIRED PROTOTYPE)
 * ──────────────────────────────────────────────────────────
 * Phase 4+ · Phase 9-lite · Item 9-lite.1 #66
 *
 * Quebec Régie du bâtiment (RBQ) license lookup. Three views:
 *
 *   1. Subcontractor Profile (with RBQ widget)
 *      Path: src/app/(portal)/contractor/(global)/subcontractors/[subId]/page.tsx
 *      Audience: contractor org admins viewing a sub
 *      Contains: full sub profile + the RBQ verification widget
 *      with all five states (valid, expiring, expired, not-found,
 *      no-number-on-file). Province-gated — only renders when the
 *      *current project* is set to Quebec.
 *
 *   2. RBQ License Cache (admin)
 *      Path: src/app/(portal)/contractor/(global)/settings/compliance/rbq-cache/page.tsx
 *      Audience: contractor org admins
 *      Contains: paginated table of all cached RBQ lookups across
 *      every sub in the org, filterable by status, with bulk and
 *      per-row force-refresh. Cache freshness KPIs at top.
 *
 *   3. Project Compliance Overview (RBQ rollup)
 *      Path: src/app/(portal)/contractor/(global)/projects/[id]/compliance/page.tsx
 *      Audience: contractor PMs scoped to a single project
 *      Contains: per-sub compliance scorecard with the RBQ badge
 *      as one column among insurance/CCQ/CNESST. Quebec-only
 *      surface; ON/AB/BC versions hide the column.
 *
 * Boundary: This module *consumes* the RBQ open data feed. It does
 * not write to RBQ, does not authenticate against RBQ, does not
 * legally certify a sub. The badge is a convenience signal sourced
 * from publicly available data; final liability rests with the GC
 * verifying the sub directly. The README should make this clear.
 *
 * Data source decision (flag for build): RBQ exposes an Open Data
 * catalog at donneesquebec.ca. As of this writing it is CSV-only,
 * so the build path is option (2) from the build guide: nightly
 * Trigger.dev refresh of a `rbq_license_cache` table. Live lookups
 * hit the cache; "Refresh RBQ lookup" forces a single-row re-fetch.
 *
 * Schema additions (drizzle_schema_phase5_law25.ts pending — flag
 * to user on schema-stop trigger):
 *   - rbq_license_cache (rbqNumber PK, legalName, subclasses JSON,
 *     status, expiryDate, lastCheckedAt, sourceVersion)
 *   - subcontractors.rbqNumber (nullable, 10-digit string)
 *   - projects.province (nullable enum: QC|ON|BC|AB|MB|SK|NS|NB|NL|PE)
 */

// ── Icons (inline SVG only — no emojis, no external libs) ────
const I = {
  shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  shieldLg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  shieldOk: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  shieldX: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  bldg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/><path d="M9 9h.01M9 13h.01M9 17h.01"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  warn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  ext: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  mail: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  phone: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>,
  pin: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  bell: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  flag: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  sun: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  history: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  fileText: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  card: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  database: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  chevR: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  hardHat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a4 4 0 014-4h12a4 4 0 014 4v2H2v-2z"/><path d="M9 10V6a3 3 0 016 0v4"/></svg>,
  logo: (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="lg66" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b4fc7"/>
          <stop offset="1" stopColor="#3d3399"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#lg66)"/>
      <rect x="6.5" y="8" width="14" height="3" rx="1" fill="#fff"/>
      <rect x="6.5" y="13.5" width="19" height="3" rx="1" fill="#fff" opacity=".82"/>
      <rect x="6.5" y="19" width="11" height="3" rx="1" fill="#fff" opacity=".62"/>
    </svg>
  ),
  qcFlag: (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <rect width="14" height="11" rx="1.5" fill="#0e3a8c"/>
      <path d="M3.5 3 L3.5 8 M0.5 5.5 L6.5 5.5" stroke="#fff" strokeWidth="0.8"/>
      <path d="M10.5 3 L10.5 8 M7.5 5.5 L13.5 5.5" stroke="#fff" strokeWidth="0.8"/>
      <path d="M7 4 L7.6 5.4 L9 5.6 L8 6.6 L8.2 8 L7 7.3 L5.8 8 L6 6.6 L5 5.6 L6.4 5.4 Z M7 1.5 L7.4 2.5 L8.5 2.6 L7.7 3.3 L7.9 4.3 L7 3.8 L6.1 4.3 L6.3 3.3 L5.5 2.6 L6.6 2.5 Z M2 5.5 L2.4 4.5 L2.8 5.5 M2 5.5 L2.4 6.5 L2.8 5.5 M9 5.5 L9.4 4.5 L9.8 5.5 M9 5.5 L9.4 6.5 L9.8 5.5" fill="#fff"/>
    </svg>
  ),
};

// ── Mock data ────────────────────────────────────────────────
const sub = {
  id: "sub-rivermtl-014",
  legalName: "Construction Bétonneau Inc.",
  shortName: "Bétonneau Construction",
  trade: "Concrete & foundations",
  contact: "Jean-Philippe Robitaille",
  role: "Owner / Project Lead",
  email: "jp.robitaille@betonneau.qc.ca",
  phone: "+1 (450) 555-0192",
  address: "2840 boul. Industriel, Laval, QC H7L 4N9",
  joined: "Mar 12, 2025",
  activeProjects: 3,
  completedProjects: 11,
  avgRating: 4.7,
  invitedBy: "Dan Carter",
  rbqNumber: "5641-9032-01",
};

const project = {
  id: "proj-rivermtl",
  name: "Riverside Tower Fit-Out",
  province: "QC",
  city: "Montréal, QC",
};

// All five RBQ states for the demo state-switcher
const rbqStates = {
  valid: {
    code: "valid",
    legalName: "Construction Bétonneau Inc.",
    rbqNumber: "5641-9032-01",
    status: "Active",
    issuedAt: "Apr 14, 2018",
    expiryDate: "Mar 31, 2027",
    daysToExpiry: 333,
    lastCheckedAt: "Today, 8:14 AM",
    sourceVersion: "RBQ Open Data 2026-04-30",
    subclasses: [
      { code: "1.2", label: "Building shell contractor" },
      { code: "4.1", label: "Concrete foundation contractor" },
      { code: "4.2", label: "Concrete formwork contractor" },
      { code: "5.1", label: "Carpentry & framing contractor" },
    ],
    history: [
      { ts: "Today, 8:14 AM", event: "Cache refreshed via nightly job", source: "trigger.dev" },
      { ts: "Apr 28, 2026", event: "Manual refresh by Dan Carter", source: "user" },
      { ts: "Mar 11, 2026", event: "Number entered on profile", source: "user" },
    ],
  },
  expiring: {
    code: "expiring",
    legalName: "Construction Bétonneau Inc.",
    rbqNumber: "5641-9032-01",
    status: "Active",
    issuedAt: "Apr 14, 2018",
    expiryDate: "May 22, 2026",
    daysToExpiry: 21,
    lastCheckedAt: "Today, 8:14 AM",
    sourceVersion: "RBQ Open Data 2026-04-30",
    subclasses: [
      { code: "1.2", label: "Building shell contractor" },
      { code: "4.1", label: "Concrete foundation contractor" },
      { code: "4.2", label: "Concrete formwork contractor" },
      { code: "5.1", label: "Carpentry & framing contractor" },
    ],
    history: [
      { ts: "Today, 8:14 AM", event: "Cache refreshed — expiry in 21 days", source: "trigger.dev" },
      { ts: "Apr 21, 2026", event: "30-day expiry alert sent to org admins", source: "system" },
      { ts: "Mar 11, 2026", event: "Number entered on profile", source: "user" },
    ],
  },
  expired: {
    code: "expired",
    legalName: "Construction Bétonneau Inc.",
    rbqNumber: "5641-9032-01",
    status: "Expired",
    issuedAt: "Apr 14, 2018",
    expiryDate: "Feb 14, 2026",
    daysToExpiry: -76,
    lastCheckedAt: "Today, 8:14 AM",
    sourceVersion: "RBQ Open Data 2026-04-30",
    subclasses: [
      { code: "1.2", label: "Building shell contractor" },
      { code: "4.1", label: "Concrete foundation contractor" },
    ],
    history: [
      { ts: "Today, 8:14 AM", event: "Cache refreshed — license is expired", source: "trigger.dev" },
      { ts: "Feb 15, 2026", event: "Auto-flagged as expired; payment hold proposed", source: "system" },
      { ts: "Mar 11, 2026", event: "Number entered on profile", source: "user" },
    ],
  },
  notFound: {
    code: "notFound",
    rbqNumber: "0000-0000-00",
    lastCheckedAt: "Today, 8:14 AM",
    sourceVersion: "RBQ Open Data 2026-04-30",
    history: [
      { ts: "Today, 8:14 AM", event: "Lookup returned no match in registry", source: "trigger.dev" },
      { ts: "Apr 24, 2026", event: "Number entered on profile", source: "user" },
    ],
  },
  noNumber: {
    code: "noNumber",
  },
};

// Cache view — paginated table of cached lookups across the whole org
const cacheRows = [
  { rbqNumber: "5641-9032-01", legalName: "Construction Bétonneau Inc.", subId: "sub-014", subclasses: 4, status: "valid", expiryDate: "Mar 31, 2027", lastCheckedAt: "Today, 8:14 AM", subShort: "Bétonneau Construction" },
  { rbqNumber: "5708-1144-02", legalName: "Couvreurs Falardeau & Frères", subId: "sub-022", subclasses: 2, status: "valid", expiryDate: "Nov 18, 2026", lastCheckedAt: "Today, 8:14 AM", subShort: "Falardeau Roofing" },
  { rbqNumber: "5219-7733-01", legalName: "Plomberie Lavallée 2018 Inc.", subId: "sub-031", subclasses: 3, status: "expiring", expiryDate: "May 22, 2026", lastCheckedAt: "Today, 8:14 AM", subShort: "Lavallée Plumbing" },
  { rbqNumber: "5912-4001-03", legalName: "Électricité Boisclair Ltée", subId: "sub-007", subclasses: 5, status: "valid", expiryDate: "Aug 04, 2027", lastCheckedAt: "Today, 8:14 AM", subShort: "Boisclair Electric" },
  { rbqNumber: "5102-9988-01", legalName: "Excavation Tremblay-Hudon", subId: "sub-019", subclasses: 6, status: "valid", expiryDate: "Jan 30, 2027", lastCheckedAt: "Yesterday, 11:42 PM", subShort: "Tremblay-Hudon Excavation" },
  { rbqNumber: "5333-2210-02", legalName: "Vitres Côté Inc.", subId: "sub-046", subclasses: 1, status: "expired", expiryDate: "Feb 14, 2026", lastCheckedAt: "Today, 8:14 AM", subShort: "Côté Glazing" },
  { rbqNumber: "5874-5512-01", legalName: "Charpenterie Beauregard", subId: "sub-052", subclasses: 2, status: "valid", expiryDate: "Sep 22, 2026", lastCheckedAt: "Today, 8:14 AM", subShort: "Beauregard Carpentry" },
  { rbqNumber: "5061-7344-01", legalName: "Mécanique du Bâtiment Pelletier", subId: "sub-061", subclasses: 4, status: "valid", expiryDate: "Dec 11, 2026", lastCheckedAt: "Today, 8:14 AM", subShort: "Pelletier HVAC" },
  { rbqNumber: "0000-0000-00", legalName: null, subId: "sub-068", subclasses: 0, status: "notFound", expiryDate: null, lastCheckedAt: "Today, 8:14 AM", subShort: "Marchand Drywall (entered: 0000-0000-00)" },
  { rbqNumber: "5447-2299-02", legalName: "Peinture Industrielle Bisson", subId: "sub-073", subclasses: 1, status: "expiring", expiryDate: "May 30, 2026", lastCheckedAt: "Today, 8:14 AM", subShort: "Bisson Painting" },
  { rbqNumber: "5790-3361-01", legalName: "Isolation Beaudry & Associés", subId: "sub-088", subclasses: 2, status: "valid", expiryDate: "Jul 04, 2027", lastCheckedAt: "Today, 8:14 AM", subShort: "Beaudry Insulation" },
  { rbqNumber: "5288-1010-03", legalName: "Carrelage de Maisonneuve", subId: "sub-093", subclasses: 1, status: "valid", expiryDate: "Apr 17, 2027", lastCheckedAt: "Today, 8:14 AM", subShort: "Maisonneuve Tile" },
];

// Project compliance scorecard rows — full RBQ + adjacent compliance
const projectSubs = [
  { id: "sub-014", name: "Bétonneau Construction", trade: "Concrete & foundations", rbq: "valid", rbqExpiry: "Mar 31, 2027", insurance: "valid", cnesst: "valid", ccq: "valid", scope: "Foundations · Slab" },
  { id: "sub-022", name: "Falardeau Roofing", trade: "Roofing", rbq: "valid", rbqExpiry: "Nov 18, 2026", insurance: "valid", cnesst: "valid", ccq: "valid", scope: "Roof membrane" },
  { id: "sub-031", name: "Lavallée Plumbing", trade: "Plumbing", rbq: "expiring", rbqExpiry: "May 22, 2026", insurance: "valid", cnesst: "valid", ccq: "expiring", scope: "Riser stacks · Fixtures" },
  { id: "sub-007", name: "Boisclair Electric", trade: "Electrical", rbq: "valid", rbqExpiry: "Aug 04, 2027", insurance: "valid", cnesst: "valid", ccq: "valid", scope: "Distribution · Branch" },
  { id: "sub-019", name: "Tremblay-Hudon Excavation", trade: "Excavation", rbq: "valid", rbqExpiry: "Jan 30, 2027", insurance: "valid", cnesst: "valid", ccq: "valid", scope: "Site work · Backfill" },
  { id: "sub-046", name: "Côté Glazing", trade: "Glazing", rbq: "expired", rbqExpiry: "Feb 14, 2026", insurance: "valid", cnesst: "valid", ccq: "valid", scope: "Curtain wall" },
  { id: "sub-068", name: "Marchand Drywall", trade: "Drywall", rbq: "notFound", rbqExpiry: null, insurance: "expiring", cnesst: "valid", ccq: "valid", scope: "Partitions · Ceilings" },
  { id: "sub-073", name: "Bisson Painting", trade: "Painting", rbq: "expiring", rbqExpiry: "May 30, 2026", insurance: "valid", cnesst: "valid", ccq: "valid", scope: "Common areas · Units" },
];

// ── Helpers ──────────────────────────────────────────────────
const fmtSubclassPills = (sc) => sc.map((s) => `${s.code}`).join(" · ");
const subclassBigList = (sc) => sc;

// Tone helpers
const rbqTone = (s) => ({ valid: "ok", expiring: "warn", expired: "danger", notFound: "danger", noNumber: "muted" }[s] || "muted");
const rbqLabel = (s) => ({ valid: "RBQ valid", expiring: "Expiring soon", expired: "License expired", notFound: "Not found", noNumber: "No RBQ on file" }[s] || s);
const cnesstTone = (s) => ({ valid: "ok", expiring: "warn", expired: "danger" }[s] || "muted");

// ── Component ────────────────────────────────────────────────
export default function RbqVerificationPaired() {
  const [view, setView] = useState("profile"); // profile | cache | project
  const [dark, setDark] = useState(false);
  const [demoState, setDemoState] = useState("valid"); // valid | expiring | expired | notFound | noNumber
  const [demoProvince, setDemoProvince] = useState("QC"); // QC | ON

  // Lookup interaction
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rbqInput, setRbqInput] = useState(sub.rbqNumber || "");
  const [showHistory, setShowHistory] = useState(false);

  // Cache view
  const [cacheFilter, setCacheFilter] = useState("all"); // all | valid | expiring | expired | notFound
  const [cacheSearch, setCacheSearch] = useState("");
  const [bulkRefreshing, setBulkRefreshing] = useState(false);

  // Project view
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 1300);
  };

  const handleBulkRefresh = () => {
    setBulkRefreshing(true);
    setTimeout(() => setBulkRefreshing(false), 2200);
  };

  // Filtered cache rows
  const filteredCache = cacheRows.filter((r) => {
    if (cacheFilter !== "all" && r.status !== cacheFilter) return false;
    if (cacheSearch) {
      const q = cacheSearch.toLowerCase();
      if (
        !r.rbqNumber.toLowerCase().includes(q) &&
        !(r.legalName || "").toLowerCase().includes(q) &&
        !r.subShort.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const filteredSubs = projectSubs.filter((s) => {
    if (showOnlyIssues) {
      return s.rbq === "expiring" || s.rbq === "expired" || s.rbq === "notFound" || s.insurance !== "valid" || s.cnesst !== "valid" || s.ccq !== "valid";
    }
    return true;
  });

  // Cache KPIs
  const k_total = cacheRows.length;
  const k_valid = cacheRows.filter((r) => r.status === "valid").length;
  const k_expiring = cacheRows.filter((r) => r.status === "expiring").length;
  const k_expired = cacheRows.filter((r) => r.status === "expired").length;
  const k_notFound = cacheRows.filter((r) => r.status === "notFound").length;

  return (
    <div className={`po ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.po{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;--ok-m:#b8dfc7;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;--wr-m:#f0d9a8;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;--dg-m:#f0bcbc;
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
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;--ok-m:#1f3a2a;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;--wr-m:#3a2c14;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;--dg-m:#3a1e1e;
  --in:#4d92cf;--in-s:#102230;--in-t:#7eb8e3;
}

/* Animations */
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes fadein{from{opacity:0;}to{opacity:1;}}
@keyframes slidein{from{transform:translateX(100%);}to{transform:translateX(0);}}
@keyframes popin{from{opacity:0;transform:translateY(8px) scale(.99);}to{opacity:1;transform:translateY(0) scale(1);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.55;}}
@keyframes shimmer{0%{background-position:-200px 0;}100%{background-position:calc(200px + 100%) 0;}}
.spin{animation:spin 800ms linear infinite;}
.pulse{animation:pulse 1.6s ease-in-out infinite;}

/* ── Top harness ── */
.po-harness{
  display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  padding:10px 18px;background:var(--s1);border-bottom:1px solid var(--s3);
  position:sticky;top:0;z-index:50;
}
.po-h-meta{display:flex;align-items:center;gap:12px;}
.po-h-meta .step{font-family:var(--fd);font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);}
.po-h-meta .name{font-family:var(--fd);font-size:14px;font-weight:680;color:var(--t1);letter-spacing:-.01em;}
.po-h-tabs{display:flex;gap:4px;background:var(--s2);padding:3px;border-radius:var(--r-m);}
.po-h-tab{
  font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t2);
  padding:7px 14px;border-radius:7px;cursor:pointer;border:none;background:transparent;
  display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;
}
.po-h-tab:hover{color:var(--t1);}
.po-h-tab.active{background:var(--s1);color:var(--t1);box-shadow:var(--shsm);}
.po-h-tab .num{font-family:var(--fm);font-size:10px;color:var(--t3);font-weight:500;}
.po-h-tab.active .num{color:var(--ac);}

.po-h-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.demo-strip{
  display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--s2);
  border:1px solid var(--s3);border-radius:var(--r-m);
}
.demo-strip .lbl{font-family:var(--fd);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin-right:2px;}
.demo-pill{
  font-family:var(--fd);font-size:11px;font-weight:600;padding:4px 9px;border-radius:6px;
  border:none;background:transparent;color:var(--t2);cursor:pointer;
  transition:all var(--df) var(--e);white-space:nowrap;
}
.demo-pill:hover{color:var(--t1);background:var(--s1);}
.demo-pill.cur{background:var(--s1);color:var(--t1);box-shadow:var(--shsm);}
.demo-pill.cur.ok{color:var(--ok-t);}
.demo-pill.cur.warn{color:var(--wr-t);}
.demo-pill.cur.danger{color:var(--dg-t);}
.demo-pill.cur.muted{color:var(--t3);}

.theme-tog{
  border:1px solid var(--s3);background:var(--s1);width:32px;height:32px;border-radius:var(--r-s);
  display:inline-flex;align-items:center;justify-content:center;color:var(--t2);cursor:pointer;
  transition:all var(--df) var(--e);
}
.theme-tog:hover{background:var(--sh);color:var(--t1);}

/* ── Portal shell ── */
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
.sb-item .badge{font-family:var(--fd);font-size:10px;font-weight:700;background:var(--s2);color:var(--t2);padding:1px 7px;border-radius:999px;}
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
.tb-bc .lk{color:var(--t2);cursor:pointer;}
.tb-bc .lk:hover{color:var(--t1);}
.tb-acts{display:flex;align-items:center;gap:8px;}
.icon-btn{
  border:1px solid var(--s3);background:var(--s1);width:34px;height:34px;border-radius:var(--r-s);
  display:flex;align-items:center;justify-content:center;color:var(--t2);cursor:pointer;
  transition:all var(--df) var(--e);position:relative;
}
.icon-btn:hover{background:var(--sh);color:var(--t1);}
.icon-btn .dot{position:absolute;top:8px;right:8px;width:6px;height:6px;border-radius:50%;background:var(--ac);}

.content{padding:26px 28px 60px;max-width:1320px;width:100%;}

/* ── Common atoms ── */
.h1{font-family:var(--fd);font-size:26px;font-weight:820;color:var(--t1);letter-spacing:-.025em;line-height:1.15;}
.h1-sub{font-size:14px;color:var(--t2);margin-top:6px;max-width:740px;}
.h2{font-family:var(--fd);font-size:18px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.h3{font-family:var(--fd);font-size:14px;font-weight:680;color:var(--t1);letter-spacing:-.005em;}

.card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden;transition:box-shadow var(--dn) var(--e);}
.card:hover{box-shadow:var(--shsm);}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;border-bottom:1px solid var(--s3);}
.card-h .ti{font-family:var(--fd);font-size:14.5px;font-weight:700;color:var(--t1);letter-spacing:-.01em;display:flex;align-items:center;gap:7px;}
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
.btn.dg{background:var(--dg-s);color:var(--dg-t);border-color:var(--dg-m);}
.btn.dg:hover{background:var(--dg);color:#fff;border-color:var(--dg);}
.btn.sm{padding:5px 10px;font-size:12px;}
.btn.lg{padding:10px 18px;font-size:14px;font-weight:650;}
.btn[disabled]{opacity:.55;cursor:not-allowed;}

.pill{font-family:var(--fd);font-size:10.5px;font-weight:700;letter-spacing:.02em;padding:3px 9px;border-radius:999px;display:inline-flex;align-items:center;gap:5px;text-transform:uppercase;}
.pill.ok{background:var(--ok-s);color:var(--ok-t);}
.pill.warn{background:var(--wr-s);color:var(--wr-t);}
.pill.danger{background:var(--dg-s);color:var(--dg-t);}
.pill.info{background:var(--in-s);color:var(--in-t);}
.pill.muted{background:var(--s2);color:var(--t3);}
.pill.acc{background:var(--ac-s);color:var(--ac-t);}
.pill.lg{font-size:11.5px;padding:5px 12px;}

.field{display:flex;flex-direction:column;gap:6px;}
.field label{font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t1);letter-spacing:-.005em;}
.field .hint{font-size:12px;color:var(--t3);}
.field .req{color:var(--dg);margin-left:3px;}
.input,.select{
  font-family:var(--fb);font-size:13.5px;color:var(--t1);
  border:1px solid var(--s3);background:var(--s1);border-radius:var(--r-s);
  padding:9px 12px;transition:all var(--df) var(--e);width:100%;
}
.input:focus,.select:focus{outline:none;border-color:var(--ac);box-shadow:var(--shri);}
.input.mono{font-family:var(--fm);letter-spacing:.04em;}

/* ── Settings strip ── */
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

/* ────────────────────────────────────────
   VIEW 01 — SUB PROFILE
   ──────────────────────────────────────── */

.sp-grid{display:grid;grid-template-columns:1.55fr .9fr;gap:22px;align-items:start;}
@media (max-width:1080px){.sp-grid{grid-template-columns:1fr;}}

.sp-head{
  background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);
  padding:24px;display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:start;margin-bottom:22px;
}
.sp-avt{
  width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#3d3399);color:#fff;
  display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:24px;font-weight:740;letter-spacing:-.02em;
}
.sp-info .legal{font-family:var(--fd);font-size:22px;font-weight:780;color:var(--t1);letter-spacing:-.022em;line-height:1.15;}
.sp-info .short{font-size:13.5px;color:var(--t2);margin-top:3px;}
.sp-info .meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;font-size:12.5px;color:var(--t2);}
.sp-info .meta span{display:inline-flex;align-items:center;gap:5px;}
.sp-info .pills{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;}

.sp-head-acts{display:flex;flex-direction:column;gap:8px;align-items:flex-end;}
.sp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px;font-size:12px;}
.sp-stat{text-align:right;}
.sp-stat .v{font-family:var(--fd);font-size:18px;font-weight:780;color:var(--t1);letter-spacing:-.02em;line-height:1.05;}
.sp-stat .l{color:var(--t3);font-size:11px;margin-top:2px;}

/* ── RBQ Widget — the headline ── */
.rbq-card{
  border-radius:var(--r-xl);overflow:hidden;border:1px solid var(--s3);background:var(--s1);
  position:relative;
}
.rbq-card.valid{border-color:var(--ok-m);}
.rbq-card.expiring{border-color:var(--wr-m);}
.rbq-card.expired{border-color:var(--dg-m);}
.rbq-card.notFound{border-color:var(--dg-m);}

.rbq-banner{
  padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  border-bottom:1px solid var(--s3);
}
.rbq-banner.valid{background:linear-gradient(160deg,var(--ok-s) 0%,var(--s1) 70%);border-bottom-color:var(--ok-m);}
.rbq-banner.expiring{background:linear-gradient(160deg,var(--wr-s) 0%,var(--s1) 70%);border-bottom-color:var(--wr-m);}
.rbq-banner.expired{background:linear-gradient(160deg,var(--dg-s) 0%,var(--s1) 70%);border-bottom-color:var(--dg-m);}
.rbq-banner.notFound{background:linear-gradient(160deg,var(--dg-s) 0%,var(--s1) 70%);border-bottom-color:var(--dg-m);}
.rbq-banner.noNumber{background:var(--s2);border-bottom:1px solid var(--s3);}

.rbq-banner-l{display:flex;align-items:center;gap:14px;}
.rbq-banner .ic{
  width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.rbq-banner.valid .ic{background:var(--ok);color:#fff;}
.rbq-banner.expiring .ic{background:var(--wr);color:#fff;}
.rbq-banner.expired .ic{background:var(--dg);color:#fff;}
.rbq-banner.notFound .ic{background:var(--dg);color:#fff;}
.rbq-banner.noNumber .ic{background:var(--s4);color:var(--t3);}

.rbq-banner .label{font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;}
.rbq-banner.valid .label{color:var(--ok-t);}
.rbq-banner.expiring .label{color:var(--wr-t);}
.rbq-banner.expired .label{color:var(--dg-t);}
.rbq-banner.notFound .label{color:var(--dg-t);}
.rbq-banner.noNumber .label{color:var(--t3);}

.rbq-banner .title{font-family:var(--fd);font-size:18px;font-weight:780;color:var(--t1);letter-spacing:-.018em;margin-top:2px;}
.rbq-banner .title .qc{display:inline-flex;align-items:center;gap:5px;margin-left:8px;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);}
.rbq-banner .number{font-family:var(--fm);font-size:14px;font-weight:560;color:var(--t1);margin-top:4px;letter-spacing:.04em;}

.rbq-banner-r{display:flex;align-items:center;gap:8px;}
.rbq-refresh-meta{font-size:11px;color:var(--t3);text-align:right;line-height:1.35;}
.rbq-refresh-meta strong{font-family:var(--fd);font-weight:600;color:var(--t2);}

.rbq-body{padding:20px 22px;}
.rbq-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-bottom:20px;}
@media (max-width:680px){.rbq-grid{grid-template-columns:1fr;}}
.rbq-row .lbl{font-family:var(--fd);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin-bottom:4px;}
.rbq-row .val{font-size:14px;color:var(--t1);font-family:var(--fb);}
.rbq-row .val.mono{font-family:var(--fm);letter-spacing:.03em;}
.rbq-row .val.lg{font-family:var(--fd);font-size:16px;font-weight:680;letter-spacing:-.01em;}

.subclass-list{display:flex;flex-direction:column;gap:8px;margin-top:6px;}
.subclass-row{
  display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--s2);
  border-radius:var(--r-s);border:1px solid var(--s3);
}
.subclass-row .code{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--ac-t);background:var(--ac-s);padding:3px 8px;border-radius:4px;letter-spacing:.04em;}
.subclass-row .lbl{font-size:13.5px;color:var(--t1);}

.rbq-foot{
  padding:12px 22px;background:var(--s2);border-top:1px solid var(--s3);
  display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  font-size:12px;color:var(--t3);
}
.rbq-foot .src{display:inline-flex;align-items:center;gap:6px;}
.rbq-foot .src .mono{font-family:var(--fm);font-size:11.5px;color:var(--t2);}
.rbq-foot a{color:var(--t2);text-decoration:none;border-bottom:1px solid var(--s3);transition:border-color var(--df) var(--e);}
.rbq-foot a:hover{border-bottom-color:var(--ac);color:var(--t1);}

/* No-RBQ-on-file empty state */
.no-rbq{
  padding:36px 24px;text-align:center;
}
.no-rbq .ic{
  display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:50%;
  background:var(--s2);color:var(--t3);margin-bottom:14px;
}
.no-rbq .ti{font-family:var(--fd);font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px;letter-spacing:-.005em;}
.no-rbq .desc{font-size:13.5px;color:var(--t2);max-width:420px;margin:0 auto 16px;line-height:1.55;}

/* Non-Quebec hidden state */
.hidden-state{
  padding:32px 24px;text-align:center;background:var(--s2);border:1px dashed var(--s3);border-radius:var(--r-l);
}
.hidden-state .ic{display:inline-flex;width:42px;height:42px;border-radius:50%;background:var(--s1);color:var(--t3);align-items:center;justify-content:center;margin-bottom:10px;}
.hidden-state .ti{font-family:var(--fd);font-size:14.5px;font-weight:700;color:var(--t2);margin-bottom:4px;}
.hidden-state .desc{font-size:13px;color:var(--t3);max-width:360px;margin:0 auto;}

/* Side card list */
.side-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden;}
.side-card + .side-card{margin-top:14px;}
.side-list{display:flex;flex-direction:column;}
.side-row{
  display:flex;align-items:center;justify-content:space-between;padding:12px 18px;
  border-bottom:1px solid var(--s3);font-size:13px;
}
.side-row:last-child{border-bottom:none;}
.side-row .l{color:var(--t2);display:flex;align-items:center;gap:8px;}
.side-row .r{color:var(--t1);font-family:var(--fd);font-weight:620;}

/* Note row */
.note{display:flex;gap:12px;padding:14px 16px;border-radius:var(--r-m);background:var(--in-s);border:1px solid #cfe1f3;margin-bottom:18px;}
.note .ic{color:var(--in-t);flex-shrink:0;margin-top:2px;}
.note .body{font-size:13px;color:var(--in-t);line-height:1.55;}
.note .body strong{font-weight:700;}

/* History drawer */
.drawer-mask{position:fixed;inset:0;background:rgba(12,14,20,.42);z-index:80;animation:fadein var(--dn) var(--e);}
.drawer{position:fixed;top:0;right:0;bottom:0;width:480px;max-width:96vw;background:var(--s1);border-left:1px solid var(--s3);z-index:81;display:flex;flex-direction:column;animation:slidein var(--dn) var(--e);}
.drawer-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;align-items:start;justify-content:space-between;gap:14px;}
.drawer-h .ti{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.drawer-h .id{font-family:var(--fm);font-size:12px;color:var(--t2);margin-top:3px;}
.drawer-b{flex:1;overflow-y:auto;padding:18px 22px;}

/* Modal */
.modal-mask{position:fixed;inset:0;background:rgba(12,14,20,.5);z-index:90;display:flex;align-items:flex-start;justify-content:center;padding:8vh 18px;animation:fadein var(--dn) var(--e);}
.modal{background:var(--s1);border-radius:var(--r-xl);max-width:520px;width:100%;box-shadow:var(--shmd);overflow:hidden;animation:popin var(--dn) var(--e);}
.modal-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;align-items:start;justify-content:space-between;}
.modal-h .ti{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);letter-spacing:-.018em;}
.modal-h .sub{font-size:12.5px;color:var(--t2);margin-top:3px;}
.modal-b{padding:18px 22px;display:flex;flex-direction:column;gap:14px;max-height:62vh;overflow-y:auto;}
.modal-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px;background:var(--s2);}

/* Timeline */
.tl{display:flex;flex-direction:column;}
.tl-row{display:grid;grid-template-columns:160px 1fr;gap:16px;padding:12px 0;border-bottom:1px solid var(--s3);}
.tl-row:last-child{border-bottom:none;}
.tl-row .ts{font-family:var(--fm);font-size:11.5px;color:var(--t3);}
.tl-row .ev{font-family:var(--fd);font-size:13.5px;font-weight:600;color:var(--t1);}
.tl-row .src{font-size:11.5px;color:var(--t3);font-family:var(--fm);margin-top:2px;}

/* ────────────────────────────────────────
   VIEW 02 — CACHE ADMIN
   ──────────────────────────────────────── */
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px;}
@media (max-width:980px){.kpi-row{grid-template-columns:repeat(2,1fr);}}
.kpi{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;position:relative;overflow:hidden;}
.kpi .lbl{font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.kpi .val{font-family:var(--fd);font-size:24px;font-weight:820;color:var(--t1);letter-spacing:-.03em;line-height:1.05;}
.kpi .meta{font-size:11.5px;color:var(--t2);margin-top:3px;}
.kpi.ok{background:linear-gradient(160deg,var(--ok-s) 0%,var(--s1) 60%);}
.kpi.ok .lbl{color:var(--ok-t);}
.kpi.warn{background:linear-gradient(160deg,var(--wr-s) 0%,var(--s1) 60%);}
.kpi.warn .lbl{color:var(--wr-t);}
.kpi.danger{background:linear-gradient(160deg,var(--dg-s) 0%,var(--s1) 60%);}
.kpi.danger .lbl{color:var(--dg-t);}

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
.search-wrap .si{color:var(--t3);}
.search-wrap input{flex:1;background:transparent;border:none;outline:none;font-family:var(--fb);font-size:13px;color:var(--t1);}
.filter-bar .grow{flex:1;}

.tbl{width:100%;border-collapse:collapse;}
.tbl thead th{
  font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);
  padding:10px 16px;text-align:left;border-bottom:1px solid var(--s3);background:var(--s2);
}
.tbl thead th.right{text-align:right;}
.tbl thead th.center{text-align:center;}
.tbl tbody td{padding:14px 16px;border-bottom:1px solid var(--s3);font-size:13px;color:var(--t1);vertical-align:middle;}
.tbl tbody tr:last-child td{border-bottom:none;}
.tbl tbody tr{transition:background var(--df) var(--e);}
.tbl tbody tr:hover{background:var(--sh);}
.tbl .id{font-family:var(--fm);font-size:12.5px;font-weight:560;color:var(--t1);letter-spacing:.04em;}
.tbl .who{display:flex;flex-direction:column;}
.tbl .who .name{font-weight:600;color:var(--t1);}
.tbl .who .em{font-size:11.5px;color:var(--t3);margin-top:1px;}
.tbl .right{text-align:right;}
.tbl .center{text-align:center;}
.tbl .row-act{display:inline-flex;align-items:center;gap:4px;}

/* Bulk action bar */
.bulk-bar{
  display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--ac-s);border:1px solid var(--ac-m);
  border-radius:var(--r-m);margin-bottom:14px;
}
.bulk-bar .meta{flex:1;font-family:var(--fd);font-size:13px;font-weight:620;color:var(--ac-t);}
.bulk-bar .meta-sub{font-size:12px;font-weight:500;color:var(--ac-t);opacity:.8;margin-top:2px;}

.empty{padding:48px 24px;text-align:center;}
.empty .ic{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:50%;background:var(--s2);color:var(--t3);margin-bottom:14px;}
.empty .ti{font-family:var(--fd);font-size:15px;font-weight:680;color:var(--t1);margin-bottom:5px;}
.empty .desc{font-size:13px;color:var(--t2);max-width:360px;margin:0 auto;}

/* ────────────────────────────────────────
   VIEW 03 — PROJECT COMPLIANCE OVERVIEW
   ──────────────────────────────────────── */
.proj-banner{
  background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);
  padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
  margin-bottom:22px;
}
.proj-banner .info .ti{font-family:var(--fd);font-size:18px;font-weight:760;color:var(--t1);letter-spacing:-.015em;display:flex;align-items:center;gap:8px;}
.proj-banner .info .meta{font-size:12.5px;color:var(--t2);margin-top:4px;display:flex;align-items:center;gap:14px;}
.proj-banner .info .meta span{display:inline-flex;align-items:center;gap:5px;}
.proj-banner .acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

.toggle-row{display:flex;align-items:center;gap:10px;background:var(--s2);padding:6px 10px;border-radius:var(--r-s);border:1px solid var(--s3);}
.toggle-row .lbl{font-family:var(--fd);font-size:12.5px;font-weight:600;color:var(--t2);}
.tog{position:relative;width:36px;height:20px;border-radius:999px;background:var(--s4);cursor:pointer;transition:background var(--df) var(--e);}
.tog.on{background:var(--ac);}
.tog::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform var(--df) var(--e);}
.tog.on::after{transform:translateX(16px);}

.compl-tbl .who-cell{display:flex;align-items:center;gap:10px;}
.compl-avt{width:32px;height:32px;border-radius:50%;background:var(--ac-s);color:var(--ac-t);display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0;}
.compl-tbl .badge-stack{display:flex;flex-direction:column;gap:3px;align-items:flex-start;}
.compl-tbl .expiry{font-family:var(--fm);font-size:11px;color:var(--t3);margin-top:2px;}

.legend{
  display:flex;gap:18px;align-items:center;flex-wrap:wrap;
  padding:12px 16px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);margin-top:14px;
  font-size:12px;color:var(--t2);
}
.legend-item{display:inline-flex;align-items:center;gap:6px;}
.legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.legend-dot.ok{background:var(--ok);}
.legend-dot.warn{background:var(--wr);}
.legend-dot.danger{background:var(--dg);}

      `}</style>

      {/* ── Top harness ── */}
      <div className="po-harness">
        <div className="po-h-meta">
          <span className="step">Step 66 · 9-lite.1 #66</span>
          <span className="name">RBQ License Verification</span>
        </div>

        <div className="po-h-controls">
          {/* View tabs */}
          <div className="po-h-tabs">
            <button className={`po-h-tab ${view === "profile" ? "active" : ""}`} onClick={() => setView("profile")}>
              <span className="num">01</span> Sub Profile + Widget
            </button>
            <button className={`po-h-tab ${view === "cache" ? "active" : ""}`} onClick={() => setView("cache")}>
              <span className="num">02</span> Cache Admin
            </button>
            <button className={`po-h-tab ${view === "project" ? "active" : ""}`} onClick={() => setView("project")}>
              <span className="num">03</span> Project Rollup
            </button>
          </div>

          {/* Demo state controls — only useful on profile view */}
          {view === "profile" && (
            <>
              <div className="demo-strip">
                <span className="lbl">State</span>
                <button className={`demo-pill ${demoState === "valid" ? "cur ok" : ""}`} onClick={() => setDemoState("valid")}>Valid</button>
                <button className={`demo-pill ${demoState === "expiring" ? "cur warn" : ""}`} onClick={() => setDemoState("expiring")}>Expiring</button>
                <button className={`demo-pill ${demoState === "expired" ? "cur danger" : ""}`} onClick={() => setDemoState("expired")}>Expired</button>
                <button className={`demo-pill ${demoState === "notFound" ? "cur danger" : ""}`} onClick={() => setDemoState("notFound")}>Not found</button>
                <button className={`demo-pill ${demoState === "noNumber" ? "cur muted" : ""}`} onClick={() => setDemoState("noNumber")}>No number</button>
              </div>
              <div className="demo-strip">
                <span className="lbl">Project</span>
                <button className={`demo-pill ${demoProvince === "QC" ? "cur ok" : ""}`} onClick={() => setDemoProvince("QC")}>QC (shown)</button>
                <button className={`demo-pill ${demoProvince === "ON" ? "cur muted" : ""}`} onClick={() => setDemoProvince("ON")}>ON (gated)</button>
              </div>
            </>
          )}

          <button className="theme-tog" onClick={() => setDark(!dark)} title="Toggle theme">
            {dark ? I.sun : I.moon}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          VIEW 01 — SUB PROFILE + RBQ WIDGET
          ════════════════════════════════════════ */}
      {view === "profile" && (
        <div className="shell">
          <aside className="sb">
            <div className="sb-head"><div className="sb-mark">{I.logo}<span className="sb-brand">BuiltCRM</span></div></div>
            <div className="sb-org">
              <div className="name">Summit Contracting</div>
              <div className="meta">12 members · Contractor org</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Org</div>
              <div className="sb-item">Dashboard</div>
              <div className="sb-item">Projects</div>
              <div className="sb-item active">Subcontractors <span className="badge">14</span></div>
              <div className="sb-item">Compliance <span className="badge warn">3</span></div>
              <div className="sb-item">Documents</div>
              <div className="sb-item">Reports</div>
              <div className="sb-section">Riverside Tower Fit-Out</div>
              <div className="sb-item">Project Home</div>
              <div className="sb-item">RFIs / Issues <span className="badge">3</span></div>
              <div className="sb-item">Approvals</div>
              <div className="sb-item">Documents</div>
              <div className="sb-section">Account</div>
              <div className="sb-item">Settings</div>
            </nav>
            <div className="sb-foot">
              <div className="sb-avt">DC</div>
              <div><div className="uname">Dan Carter</div><div className="urole">Org Admin</div></div>
            </div>
          </aside>

          <div className="main">
            <header className="tb">
              <div className="tb-bc">
                <span className="lk">Subcontractors</span><span className="sep">/</span>
                <span className="cur">{sub.shortName}</span>
              </div>
              <div className="tb-acts">
                <button className="icon-btn"><span className="dot"/>{I.bell}</button>
                <div className="sb-avt" style={{ width: 32, height: 32, fontSize: 11 }}>DC</div>
              </div>
            </header>

            <div className="content">
              {/* Sub profile head */}
              <div className="sp-head">
                <div className="sp-avt">BC</div>
                <div className="sp-info">
                  <div className="legal">{sub.legalName}</div>
                  <div className="short">{sub.shortName} · {sub.trade}</div>
                  <div className="meta">
                    <span>{I.user}{sub.contact} · {sub.role}</span>
                    <span>{I.mail}<span style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{sub.email}</span></span>
                    <span>{I.phone}{sub.phone}</span>
                    <span>{I.pin}{sub.address}</span>
                  </div>
                  <div className="pills">
                    <span className="pill ok">{I.check} Onboarded</span>
                    <span className="pill acc">{sub.activeProjects} active projects</span>
                    <span className="pill muted">Joined {sub.joined}</span>
                    {demoProvince === "QC" && <span className="pill info">{I.qcFlag}<span style={{ marginLeft: 1 }}>QC project</span></span>}
                  </div>
                </div>
                <div className="sp-head-acts">
                  <button className="btn pr sm">{I.mail} Message</button>
                  <button className="btn sec sm">{I.fileText} View profile pack</button>
                  <div className="sp-stats">
                    <div className="sp-stat"><div className="v">{sub.activeProjects}</div><div className="l">Active</div></div>
                    <div className="sp-stat"><div className="v">{sub.completedProjects}</div><div className="l">Completed</div></div>
                    <div className="sp-stat"><div className="v">{sub.avgRating}</div><div className="l">Rating</div></div>
                  </div>
                </div>
              </div>

              {/* Province-gated info note */}
              {demoProvince === "ON" && (
                <div className="note">
                  <div className="ic">{I.info}</div>
                  <div className="body">
                    <strong>RBQ verification is hidden on this page.</strong> The Régie du bâtiment du Québec only licenses contractors operating in Quebec. The current project (<strong>{project.name}</strong>) is set to <strong>Ontario</strong>, so the RBQ widget below is hidden. The Ontario equivalent — Construction Act prompt-payment compliance — surfaces in <a href="#" style={{ color: "var(--in-t)", fontWeight: 600 }}>Step 68</a> instead.
                  </div>
                </div>
              )}

              <div className="sp-grid">
                {/* LEFT — RBQ widget */}
                <div>
                  <h2 className="h2" style={{ marginBottom: 12 }}>Compliance &amp; verification</h2>

                  {/* RBQ Widget — conditional per state + province */}
                  {demoProvince === "ON" ? (
                    <div className="hidden-state">
                      <div className="ic">{I.lock}</div>
                      <div className="ti">RBQ widget hidden</div>
                      <div className="desc">This project is in Ontario. RBQ verification only renders for Quebec projects.</div>
                    </div>
                  ) : demoState === "noNumber" ? (
                    <div className={`rbq-card`}>
                      <div className={`rbq-banner noNumber`}>
                        <div className="rbq-banner-l">
                          <div className="ic">{I.shield}</div>
                          <div>
                            <div className="label">RBQ Verification</div>
                            <div className="title">No RBQ number on file<span className="qc">{I.qcFlag} Quebec project</span></div>
                            <div className="number">Add a license number to enable verification</div>
                          </div>
                        </div>
                      </div>
                      <div className="no-rbq">
                        <div className="ic">{I.shield}</div>
                        <div className="ti">Quebec contractors require an RBQ license</div>
                        <div className="desc">
                          The Régie du bâtiment du Québec requires most building contractors to hold a valid RBQ license.
                          Add this sub's 10-digit RBQ number to verify their license status, subclasses, and expiry against the public registry.
                        </div>
                        <button className="btn pr" onClick={() => setShowEditModal(true)}>{I.plus} Add RBQ number</button>
                      </div>
                    </div>
                  ) : (() => {
                    const s = rbqStates[demoState];
                    return (
                      <div className={`rbq-card ${demoState}`}>
                        {/* Banner */}
                        <div className={`rbq-banner ${demoState}`}>
                          <div className="rbq-banner-l">
                            <div className="ic">
                              {demoState === "valid" && I.shieldOk}
                              {demoState === "expiring" && I.warn}
                              {demoState === "expired" && I.shieldX}
                              {demoState === "notFound" && I.shieldX}
                            </div>
                            <div>
                              <div className="label">
                                {demoState === "valid" && "RBQ License · Active"}
                                {demoState === "expiring" && `RBQ License · Expiring in ${s.daysToExpiry} days`}
                                {demoState === "expired" && `RBQ License · Expired ${Math.abs(s.daysToExpiry)} days ago`}
                                {demoState === "notFound" && "RBQ License · Not found in registry"}
                              </div>
                              <div className="title">
                                {demoState === "notFound" ? sub.legalName : s.legalName}
                                <span className="qc">{I.qcFlag} Quebec project</span>
                              </div>
                              <div className="number">RBQ {s.rbqNumber}</div>
                            </div>
                          </div>
                          <div className="rbq-banner-r">
                            <div className="rbq-refresh-meta">
                              {refreshing ? (
                                <span><span className="pulse">Looking up RBQ registry…</span></span>
                              ) : (
                                <>
                                  <strong>Last checked</strong>
                                  <div>{refreshedAt ? `Just now (${refreshedAt})` : s.lastCheckedAt}</div>
                                </>
                              )}
                            </div>
                            <button className="btn sec sm" onClick={handleRefresh} disabled={refreshing}>
                              <span className={refreshing ? "spin" : ""} style={{ display: "inline-flex" }}>{I.refresh}</span>
                              {refreshing ? "Refreshing…" : "Refresh"}
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="rbq-body">
                          {demoState === "notFound" ? (
                            <div style={{ padding: "8px 0" }}>
                              <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 12px" }}>
                                The RBQ number on file (<span style={{ fontFamily: "var(--fm)", color: "var(--t1)" }}>{s.rbqNumber}</span>) does
                                not appear in the Régie du bâtiment du Québec public registry. This usually means one of:
                              </p>
                              <ul style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.7, marginTop: 0 }}>
                                <li>The number was entered incorrectly — verify the 10-digit format with the sub.</li>
                                <li>The license was recently issued and not yet in the public dataset (typically 5–10 business days).</li>
                                <li>The license has been suspended or revoked.</li>
                                <li>The contractor operates under an exemption (e.g., handyman work below regulated thresholds).</li>
                              </ul>
                              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                                <button className="btn pr sm" onClick={() => setShowEditModal(true)}>{I.edit} Update RBQ number</button>
                                <button className="btn sec sm" onClick={() => window.open("https://www.rbq.gouv.qc.ca", "_blank")}>{I.ext} Open RBQ registry</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="rbq-grid">
                                <div className="rbq-row">
                                  <div className="lbl">Legal name on license</div>
                                  <div className="val lg">{s.legalName}</div>
                                </div>
                                <div className="rbq-row">
                                  <div className="lbl">License status</div>
                                  <div className="val">
                                    <span className={`pill lg ${rbqTone(demoState)}`}>
                                      {demoState === "valid" && I.check}
                                      {demoState === "expiring" && I.warn}
                                      {demoState === "expired" && I.x}
                                      {s.status}
                                    </span>
                                  </div>
                                </div>
                                <div className="rbq-row">
                                  <div className="lbl">License number</div>
                                  <div className="val mono">{s.rbqNumber}</div>
                                </div>
                                <div className="rbq-row">
                                  <div className="lbl">Issued</div>
                                  <div className="val">{s.issuedAt}</div>
                                </div>
                                <div className="rbq-row">
                                  <div className="lbl">Expiry</div>
                                  <div className="val">
                                    {s.expiryDate}
                                    {demoState === "expiring" && <span className="pill warn" style={{ marginLeft: 8 }}>{I.clock} {s.daysToExpiry} days left</span>}
                                    {demoState === "expired" && <span className="pill danger" style={{ marginLeft: 8 }}>{I.x} Expired</span>}
                                  </div>
                                </div>
                                <div className="rbq-row">
                                  <div className="lbl">Subclasses ({s.subclasses.length})</div>
                                  <div className="val" style={{ fontFamily: "var(--fm)", fontSize: 12.5, color: "var(--ac-t)" }}>
                                    {fmtSubclassPills(s.subclasses)}
                                  </div>
                                </div>
                              </div>

                              {/* Subclasses detail */}
                              <div>
                                <div className="rbq-row" style={{ marginBottom: 8 }}>
                                  <div className="lbl">Authorized subclasses</div>
                                </div>
                                <div className="subclass-list">
                                  {subclassBigList(s.subclasses).map((sc) => (
                                    <div className="subclass-row" key={sc.code}>
                                      <span className="code">{sc.code}</span>
                                      <span className="lbl">{sc.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Footer with source attribution */}
                        <div className="rbq-foot">
                          <div className="src">
                            {I.database}<span>Source: <a href="https://www.donneesquebec.ca" target="_blank" rel="noopener noreferrer">RBQ Open Data</a> · <span className="mono">{s.sourceVersion}</span></span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }} onClick={() => setShowHistory(true)}>
                              {I.history}<span>Lookup history ({s.history?.length || 0})</span>
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }} onClick={() => setShowEditModal(true)}>
                              {I.edit}<span>Edit number</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action prompts — when expired/expiring/notFound */}
                  {demoProvince === "QC" && (demoState === "expired" || demoState === "notFound") && (
                    <div className="card" style={{ marginTop: 14, borderColor: "var(--dg-m)" }}>
                      <div className="card-h" style={{ background: "var(--dg-s)", borderBottomColor: "var(--dg-m)" }}>
                        <div className="ti" style={{ color: "var(--dg-t)" }}>{I.warn} Compliance action required</div>
                      </div>
                      <div className="card-b">
                        <p style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 12px" }}>
                          GCs are jointly liable when a sub lacks a valid RBQ license for their work category. Recommended next steps:
                        </p>
                        <ul style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.7, margin: "0 0 12px", paddingLeft: 22 }}>
                          <li>Place a payment hold on this sub until license status is resolved.</li>
                          <li>Notify the sub directly with the issue.</li>
                          <li>Pause new project assignments to this sub until cleared.</li>
                        </ul>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn dg sm">{I.lock} Place payment hold</button>
                          <button className="btn sec sm">{I.mail} Notify sub</button>
                          <button className="btn gh sm">Mark as acknowledged</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {demoProvince === "QC" && demoState === "expiring" && (
                    <div className="card" style={{ marginTop: 14, borderColor: "var(--wr-m)" }}>
                      <div className="card-h" style={{ background: "var(--wr-s)", borderBottomColor: "var(--wr-m)" }}>
                        <div className="ti" style={{ color: "var(--wr-t)" }}>{I.clock} Expiry approaching</div>
                      </div>
                      <div className="card-b">
                        <p style={{ fontSize: 13.5, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 12px" }}>
                          This sub's license expires in <strong>{rbqStates.expiring.daysToExpiry} days</strong>. The system will email org admins again at 14 days, 7 days, and on the day of expiry. The sub has been notified at their primary contact email.
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn pr sm">{I.mail} Send reminder</button>
                          <button className="btn sec sm">View notification history</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT — side cards */}
                <div>
                  <div className="side-card">
                    <div className="card-h"><div className="ti">{I.shield} Other compliance signals</div></div>
                    <div className="side-list">
                      <div className="side-row"><div className="l">{I.fileText} Insurance (COI)</div><div className="r"><span className="pill ok">Valid</span></div></div>
                      <div className="side-row"><div className="l">{I.fileText} CNESST attestation</div><div className="r"><span className="pill ok">Valid</span></div></div>
                      <div className="side-row"><div className="l">{I.fileText} CCQ competency cards</div><div className="r"><span className="pill ok">3 cards on file</span></div></div>
                      <div className="side-row"><div className="l">{I.fileText} Lien waiver template</div><div className="r"><span className="pill muted">Not signed</span></div></div>
                    </div>
                  </div>

                  <div className="side-card">
                    <div className="card-h"><div className="ti">{I.bldg} Active assignments</div></div>
                    <div className="side-list">
                      <div className="side-row"><div className="l">{project.name}</div><div className="r" style={{ fontWeight: 540, color: "var(--t2)" }}>Foundations · Slab</div></div>
                      <div className="side-row"><div className="l">Cedar Mill Renovation</div><div className="r" style={{ fontWeight: 540, color: "var(--t2)" }}>Footings</div></div>
                      <div className="side-row"><div className="l">Maplewood Heights</div><div className="r" style={{ fontWeight: 540, color: "var(--t2)" }}>Pad &amp; piers</div></div>
                    </div>
                  </div>

                  <div className="side-card">
                    <div className="card-h"><div className="ti">{I.info} About RBQ verification</div></div>
                    <div className="card-b" style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>
                      <p style={{ margin: "0 0 10px" }}>
                        License data is sourced from the <strong>RBQ Open Data feed</strong> (donneesquebec.ca), refreshed nightly.
                      </p>
                      <p style={{ margin: "0 0 10px" }}>
                        This badge is a <strong>convenience signal</strong>, not legal certification. The General Contractor remains responsible for verifying licenses for their projects.
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>
                        See <a href="#" style={{ color: "var(--ac-t)" }}>Quebec compliance guide</a> for details.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Edit RBQ modal */}
          {showEditModal && (
            <div className="modal-mask" onClick={() => setShowEditModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-h">
                  <div>
                    <div className="ti">{demoState === "noNumber" ? "Add" : "Update"} RBQ license number</div>
                    <div className="sub">10-digit format · {sub.legalName}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setShowEditModal(false)}>{I.x}</button>
                </div>
                <div className="modal-b">
                  <div className="field">
                    <label>RBQ license number <span className="req">*</span></label>
                    <input
                      className="input mono"
                      value={rbqInput}
                      onChange={(e) => setRbqInput(e.target.value)}
                      placeholder="0000-0000-00"
                      maxLength={12}
                    />
                    <span className="hint">Format: four digits, dash, four digits, dash, two digits. The first digit is typically 5 for active licenses.</span>
                  </div>
                  <div className="note">
                    <div className="ic">{I.info}</div>
                    <div className="body">
                      Once saved, the system will look this number up in the RBQ registry within 30 seconds and update the badge. If the number isn't found, the badge will turn red and you'll see options to re-enter or contact the sub.
                    </div>
                  </div>
                </div>
                <div className="modal-f">
                  <button className="btn gh" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button className="btn pr" onClick={() => { setShowEditModal(false); handleRefresh(); }}>
                    {I.refresh} Save &amp; verify
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History drawer */}
          {showHistory && demoState !== "noNumber" && (
            <>
              <div className="drawer-mask" onClick={() => setShowHistory(false)} />
              <div className="drawer">
                <div className="drawer-h">
                  <div>
                    <div className="ti">RBQ lookup history</div>
                    <div className="id">{rbqStates[demoState]?.rbqNumber} · {sub.legalName}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setShowHistory(false)}>{I.x}</button>
                </div>
                <div className="drawer-b">
                  <div className="tl">
                    {(rbqStates[demoState]?.history || []).map((h, i) => (
                      <div className="tl-row" key={i}>
                        <div className="ts">{h.ts}</div>
                        <div>
                          <div className="ev">{h.event}</div>
                          <div className="src">via {h.source}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 18, lineHeight: 1.55 }}>
                    Lookup history is retained for 24 months. Includes nightly automated refreshes, manual refreshes by org members, and any system-triggered re-checks (e.g., after the sub edits their number).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          VIEW 02 — RBQ CACHE ADMIN
          ════════════════════════════════════════ */}
      {view === "cache" && (
        <div className="shell">
          <aside className="sb">
            <div className="sb-head"><div className="sb-mark">{I.logo}<span className="sb-brand">BuiltCRM</span></div></div>
            <div className="sb-org">
              <div className="name">Summit Contracting</div>
              <div className="meta">12 members · Contractor org</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Org</div>
              <div className="sb-item">Dashboard</div>
              <div className="sb-item">Projects</div>
              <div className="sb-item">Subcontractors <span className="badge">14</span></div>
              <div className="sb-item">Compliance <span className="badge warn">3</span></div>
              <div className="sb-section">Account</div>
              <div className="sb-item active">Settings</div>
            </nav>
            <div className="sb-foot">
              <div className="sb-avt">DC</div>
              <div><div className="uname">Dan Carter</div><div className="urole">Org Admin</div></div>
            </div>
          </aside>

          <div className="main">
            <header className="tb">
              <div className="tb-bc">
                <span className="lk">Settings</span><span className="sep">/</span>
                <span className="lk">Compliance &amp; CCQ</span><span className="sep">/</span>
                <span className="cur">RBQ License Cache</span>
              </div>
              <div className="tb-acts">
                <button className="icon-btn">{I.bell}</button>
                <div className="sb-avt" style={{ width: 32, height: 32, fontSize: 11 }}>DC</div>
              </div>
            </header>

            <div className="content">
              <div style={{ marginBottom: 22 }}>
                <h1 className="h1">RBQ License Cache</h1>
                <p className="h1-sub">
                  Cached lookups against the <strong>RBQ Open Data feed</strong> for every subcontractor in your org.
                  Refreshed nightly at 03:00 EST. Force a single re-check from the row, or refresh the whole cache.
                </p>
              </div>

              {/* Settings strip */}
              <div className="settings-strip">
                <button className="stab"><span>{I.bldg}</span> Organization</button>
                <button className="stab"><span>{I.users}</span> Team &amp; roles</button>
                <button className="stab"><span>{I.card}</span> Plan &amp; billing</button>
                <button className="stab"><span>{I.database}</span> Data</button>
                <button className="stab"><span>{I.lock}</span> Org security</button>
                <button className="stab"><span>{I.shield}</span> Privacy &amp; Law 25 <span className="note">Step 65</span></button>
                <button className="stab cur"><span>{I.flag}</span> Compliance &amp; CCQ <span className="note">Step 66</span></button>
              </div>

              {/* KPIs */}
              <div className="kpi-row">
                <div className="kpi">
                  <div className="lbl">{I.database} Total cached</div>
                  <div className="val">{k_total}</div>
                  <div className="meta">Across {k_total} sub orgs</div>
                </div>
                <div className="kpi ok">
                  <div className="lbl">{I.check} Valid</div>
                  <div className="val">{k_valid}</div>
                  <div className="meta">{Math.round((k_valid / k_total) * 100)}% of cache</div>
                </div>
                <div className="kpi warn">
                  <div className="lbl">{I.clock} Expiring &lt; 30d</div>
                  <div className="val">{k_expiring}</div>
                  <div className="meta">Auto-alerts active</div>
                </div>
                <div className="kpi danger">
                  <div className="lbl">{I.x} Expired</div>
                  <div className="val">{k_expired}</div>
                  <div className="meta">Payment hold proposed</div>
                </div>
                <div className="kpi danger">
                  <div className="lbl">{I.warn} Not found</div>
                  <div className="val">{k_notFound}</div>
                  <div className="meta">Manual review needed</div>
                </div>
              </div>

              {/* Bulk action bar */}
              <div className="bulk-bar">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="meta">{I.refresh} Cache refresh schedule</div>
                  <div className="meta-sub">Nightly job runs at 03:00 EST · Last run: Today, 03:00 AM · Next run: Tomorrow, 03:00 AM</div>
                </div>
                <button className="btn pr sm" onClick={handleBulkRefresh} disabled={bulkRefreshing}>
                  <span className={bulkRefreshing ? "spin" : ""} style={{ display: "inline-flex" }}>{I.refresh}</span>
                  {bulkRefreshing ? "Refreshing all…" : "Force refresh all"}
                </button>
              </div>

              {/* Filter bar */}
              <div className="filter-bar">
                <div className="search-wrap">
                  <span className="si">{I.search}</span>
                  <input
                    placeholder="Search by RBQ number, legal name, or sub…"
                    value={cacheSearch}
                    onChange={(e) => setCacheSearch(e.target.value)}
                  />
                </div>
                <button className={`filter-pill ${cacheFilter === "all" ? "cur" : ""}`} onClick={() => setCacheFilter("all")}>All ({cacheRows.length})</button>
                <button className={`filter-pill ${cacheFilter === "valid" ? "cur" : ""}`} onClick={() => setCacheFilter("valid")}>Valid ({k_valid})</button>
                <button className={`filter-pill ${cacheFilter === "expiring" ? "cur" : ""}`} onClick={() => setCacheFilter("expiring")}>Expiring ({k_expiring})</button>
                <button className={`filter-pill ${cacheFilter === "expired" ? "cur" : ""}`} onClick={() => setCacheFilter("expired")}>Expired ({k_expired})</button>
                <button className={`filter-pill ${cacheFilter === "notFound" ? "cur" : ""}`} onClick={() => setCacheFilter("notFound")}>Not found ({k_notFound})</button>
                <div className="grow" />
                <button className="btn sec sm">{I.download} Export CSV</button>
              </div>

              {/* Table */}
              <div className="card">
                <div className="card-b np">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 142 }}>RBQ number</th>
                        <th>Legal name on license</th>
                        <th>Subclasses</th>
                        <th>Status</th>
                        <th>Expiry</th>
                        <th>Last checked</th>
                        <th className="right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCache.map((r) => (
                        <tr key={r.rbqNumber + r.subId}>
                          <td><span className="id">{r.rbqNumber}</span></td>
                          <td>
                            <div className="who">
                              <span className="name">{r.legalName || <span style={{ color: "var(--t3)", fontStyle: "italic" }}>Not found in registry</span>}</span>
                              <span className="em">{r.subShort}</span>
                            </div>
                          </td>
                          <td>
                            {r.subclasses > 0 ? (
                              <span className="pill acc">{r.subclasses} subclass{r.subclasses !== 1 ? "es" : ""}</span>
                            ) : (
                              <span style={{ color: "var(--t3)", fontSize: 12.5 }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={`pill ${rbqTone(r.status)}`}>
                              {r.status === "valid" && I.check}
                              {r.status === "expiring" && I.clock}
                              {r.status === "expired" && I.x}
                              {r.status === "notFound" && I.warn}
                              {rbqLabel(r.status)}
                            </span>
                          </td>
                          <td style={{ color: "var(--t2)", fontSize: 12.5 }}>
                            {r.expiryDate || <span style={{ color: "var(--t3)" }}>—</span>}
                          </td>
                          <td style={{ color: "var(--t2)", fontSize: 12, fontFamily: "var(--fm)" }}>{r.lastCheckedAt}</td>
                          <td className="right">
                            <div className="row-act">
                              <button className="btn gh sm">{I.refresh} Refresh</button>
                              <button className="btn gh sm">{I.chevR}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredCache.length === 0 && (
                        <tr>
                          <td colSpan={7}>
                            <div className="empty">
                              <div className="ic">{I.database}</div>
                              <div className="ti">No cached lookups match your filter</div>
                              <div className="desc">Adjust the filter or search to see other entries.</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Source info */}
              <div className="note" style={{ marginTop: 18 }}>
                <div className="ic">{I.database}</div>
                <div className="body">
                  <strong>Source &amp; freshness.</strong> The cache is hydrated from the public RBQ Open Data CSV
                  (<a href="https://www.donneesquebec.ca" style={{ color: "var(--in-t)", fontWeight: 600 }}>donneesquebec.ca</a>),
                  which the RBQ refreshes daily. Our nightly Trigger.dev job downloads the diff at 03:00 EST and updates rows where the
                  source version differs. "Force refresh" performs a single-row re-check against the most recent cached snapshot — it
                  does not re-download the full dataset.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          VIEW 03 — PROJECT COMPLIANCE OVERVIEW
          ════════════════════════════════════════ */}
      {view === "project" && (
        <div className="shell">
          <aside className="sb">
            <div className="sb-head"><div className="sb-mark">{I.logo}<span className="sb-brand">BuiltCRM</span></div></div>
            <div className="sb-org">
              <div className="name">Summit Contracting</div>
              <div className="meta">12 members · Contractor org</div>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Org</div>
              <div className="sb-item">Dashboard</div>
              <div className="sb-item">Projects</div>
              <div className="sb-item">Subcontractors <span className="badge">14</span></div>
              <div className="sb-section">Riverside Tower Fit-Out</div>
              <div className="sb-item">Project Home</div>
              <div className="sb-item">RFIs / Issues <span className="badge">3</span></div>
              <div className="sb-item active">Compliance <span className="badge warn">3</span></div>
              <div className="sb-item">Approvals</div>
              <div className="sb-item">Documents</div>
              <div className="sb-section">Account</div>
              <div className="sb-item">Settings</div>
            </nav>
            <div className="sb-foot">
              <div className="sb-avt">DC</div>
              <div><div className="uname">Dan Carter</div><div className="urole">Org Admin</div></div>
            </div>
          </aside>

          <div className="main">
            <header className="tb">
              <div className="tb-bc">
                <span className="lk">{project.name}</span><span className="sep">/</span>
                <span className="cur">Compliance</span>
              </div>
              <div className="tb-acts">
                <button className="icon-btn">{I.bell}</button>
                <div className="sb-avt" style={{ width: 32, height: 32, fontSize: 11 }}>DC</div>
              </div>
            </header>

            <div className="content">
              {/* Project banner */}
              <div className="proj-banner">
                <div className="info">
                  <div className="ti">{I.bldg}{project.name}</div>
                  <div className="meta">
                    <span>{I.pin}{project.city}</span>
                    <span>{I.qcFlag}<span style={{ marginLeft: 1 }}>Quebec project</span></span>
                    <span>{I.users}{projectSubs.length} active subs</span>
                  </div>
                </div>
                <div className="acts">
                  <div className="toggle-row">
                    <span className="lbl">Show only issues</span>
                    <div className={`tog ${showOnlyIssues ? "on" : ""}`} onClick={() => setShowOnlyIssues(!showOnlyIssues)} />
                  </div>
                  <button className="btn sec sm" onClick={handleBulkRefresh} disabled={bulkRefreshing}>
                    <span className={bulkRefreshing ? "spin" : ""} style={{ display: "inline-flex" }}>{I.refresh}</span>
                    {bulkRefreshing ? "Refreshing…" : "Refresh all RBQ"}
                  </button>
                  <button className="btn pr sm">{I.download} Export compliance pack</button>
                </div>
              </div>

              <h2 className="h2" style={{ marginBottom: 12 }}>Sub compliance scorecard</h2>

              <div className="card">
                <div className="card-b np">
                  <table className="tbl compl-tbl">
                    <thead>
                      <tr>
                        <th>Subcontractor</th>
                        <th>Scope</th>
                        <th className="center">RBQ</th>
                        <th className="center">Insurance</th>
                        <th className="center">CNESST</th>
                        <th className="center">CCQ</th>
                        <th className="right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="who-cell">
                              <div className="compl-avt">{s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
                              <div className="who">
                                <span className="name">{s.name}</span>
                                <span className="em">{s.trade}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: "var(--t2)", fontSize: 12.5 }}>{s.scope}</td>
                          <td className="center">
                            <div className="badge-stack" style={{ alignItems: "center" }}>
                              <span className={`pill ${rbqTone(s.rbq)}`}>
                                {s.rbq === "valid" && I.check}
                                {s.rbq === "expiring" && I.clock}
                                {s.rbq === "expired" && I.x}
                                {s.rbq === "notFound" && I.warn}
                                {rbqLabel(s.rbq)}
                              </span>
                              {s.rbqExpiry && <span className="expiry">exp {s.rbqExpiry}</span>}
                            </div>
                          </td>
                          <td className="center">
                            <span className={`pill ${cnesstTone(s.insurance)}`}>{s.insurance === "valid" ? I.check : I.warn}{s.insurance}</span>
                          </td>
                          <td className="center">
                            <span className={`pill ${cnesstTone(s.cnesst)}`}>{s.cnesst === "valid" ? I.check : I.warn}{s.cnesst}</span>
                          </td>
                          <td className="center">
                            <span className={`pill ${cnesstTone(s.ccq)}`}>{s.ccq === "valid" ? I.check : I.warn}{s.ccq}</span>
                          </td>
                          <td className="right">
                            <button className="btn gh sm">View profile {I.chevR}</button>
                          </td>
                        </tr>
                      ))}
                      {filteredSubs.length === 0 && (
                        <tr>
                          <td colSpan={7}>
                            <div className="empty">
                              <div className="ic">{I.check}</div>
                              <div className="ti">No compliance issues</div>
                              <div className="desc">Every active sub on this project is clear across RBQ, Insurance, CNESST, and CCQ.</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="legend">
                <span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 11.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--t3)" }}>Legend</span>
                <span className="legend-item"><span className="legend-dot ok" />Valid</span>
                <span className="legend-item"><span className="legend-dot warn" />Expiring within 30 days</span>
                <span className="legend-item"><span className="legend-dot danger" />Expired or not found</span>
                <span style={{ marginLeft: "auto", color: "var(--t3)", fontSize: 11.5 }}>RBQ data sourced from RBQ Open Data feed · Refreshed nightly</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
