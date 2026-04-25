import { useState, useMemo } from "react";

// BuiltCRM — Transmittals Module (Contractor + Recipient / Phase 5 Commercial GC Parity)
// Step 47 (5.2 #47). Effort S · Priority P1 · Safe-to-autorun.
//
// Transmittals are formal cover-letter records for sending document bundles
// (typically drawings or specs) to other parties. Contractor creates a
// transmittal → attaches docs → adds recipients → sends. Each recipient gets a
// unique tokenized URL that streams a ZIP of the attached documents. Every
// download is logged. Distinct from Submittals (which carry a review workflow
// and stamps) and from Messages (which are conversational).
//
// Schema reference (drizzle_schema_phaseX — pending decisions from survey):
//   transmittals              (id, projectId, sequentialNumber, subject, message,
//                              status[draft|sent], createdByUserId, sentByUserId,
//                              sentAt, createdAt, updatedAt)
//   transmittal_recipients    (id, transmittalId, email, name,
//                              accessTokenDigest, lastDownloadedAt,
//                              firstDownloadedAt, totalDownloads,
//                              revokedAt, expiresAt, createdAt)
//   transmittal_documents     (id, transmittalId, documentId, sortOrder,
//                              attachedByUserId, createdAt)
//   transmittal_access_events (id, recipientId, downloadedAt, ipAddress,
//                              userAgent)
//   projects.transmittal_counter (int — atomic counter for TM-NNNN sequencing)
//
// Design decisions captured in this module:
//   1. Access tokens stored as SHA-256 digests (plaintext never persisted).
//   2. Per-download access_events log table (detail view renders timeline).
//   3. Atomic counter on projects — matches meetings-module pattern.
//   4. Email delivery stubbed; per-recipient share URLs surfaced in UI.
//   5. Document picker scope: documents table only (no drawing_sheets for V1).

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Transmittals (8 mixed-status on Riverside Office Complex — same demo
//     project as the Meetings / Inspections modules so the demo context is
//     continuous across Phase 5 modules) ─────────────────────────────────────
const transmittals = [
  {
    id: "tm-1",
    num: "TM-0007",
    subject: "Floor 2 framing shop drawings — Rev 3 for field",
    message:
      "Attached are the rev-3 framing shop drawings for Floor 2, reflecting the RFI-0047 curtain-wall attachment clarification. Please distribute to your field crews before the Monday pre-pour walk. Supersedes rev-2 issued Apr 12.",
    status: "sent",
    sentAt: "Apr 22 · 2:14 PM",
    sentByName: "Dan Carter",
    sentByOrg: "Hammerline Build",
    recipientCount: 5,
    downloadedCount: 3,
    pendingCount: 2,
    totalDownloads: 4,
    docCount: 6,
    totalSizeMb: 18.4,
  },
  {
    id: "tm-2",
    num: "TM-0006",
    subject: "Owner review — Schematic design package Floor 1 tenant fit-out",
    message:
      "Please find attached the schematic design package for the Floor 1 tenant fit-out. Review at your convenience and return comments by Apr 30. Full spec section 01 00 00 also included for context.",
    status: "sent",
    sentAt: "Apr 19 · 10:02 AM",
    sentByName: "Dan Carter",
    sentByOrg: "Hammerline Build",
    recipientCount: 2,
    downloadedCount: 2,
    pendingCount: 0,
    totalDownloads: 5,
    docCount: 12,
    totalSizeMb: 42.7,
  },
  {
    id: "tm-3",
    num: "TM-0005",
    subject: "MEP above-ceiling coordination — issued for construction",
    message:
      "IFC set for MEP above-ceiling coordination, Floors 1–2. Signed and stamped by architect and MEP engineer. Distribute to all affected trades.",
    status: "sent",
    sentAt: "Apr 16 · 4:40 PM",
    sentByName: "Dan Carter",
    sentByOrg: "Hammerline Build",
    recipientCount: 6,
    downloadedCount: 6,
    pendingCount: 0,
    totalDownloads: 9,
    docCount: 8,
    totalSizeMb: 31.2,
  },
  {
    id: "tm-4",
    num: "TM-0004",
    subject: "Curtain wall bulletin #3 — revised attachment detail",
    message:
      "Bulletin #3 addressing the attachment detail change at the south elevation. Subcontractor acknowledgement requested within 48 hours.",
    status: "sent",
    sentAt: "Apr 14 · 9:12 AM",
    sentByName: "Dan Carter",
    sentByOrg: "Hammerline Build",
    recipientCount: 3,
    downloadedCount: 2,
    pendingCount: 1,
    totalDownloads: 3,
    docCount: 3,
    totalSizeMb: 7.8,
  },
  {
    id: "tm-5",
    num: "TM-0003",
    subject: "Final structural drawings — IFC",
    message:
      "Issued-for-construction structural drawings, full package. Supersedes all prior reviewer sets.",
    status: "sent",
    sentAt: "Apr 09 · 1:20 PM",
    sentByName: "Dan Carter",
    sentByOrg: "Hammerline Build",
    recipientCount: 4,
    downloadedCount: 4,
    pendingCount: 0,
    totalDownloads: 7,
    docCount: 14,
    totalSizeMb: 64.5,
  },
  {
    id: "tm-6",
    num: "TM-0002",
    subject: "Site logistics plan — construction access rev 2",
    message:
      "Rev 2 of the construction access and logistics plan, reflecting the owner's tenant-early-occupancy request. Please share with your delivery coordinators.",
    status: "sent",
    sentAt: "Apr 02 · 3:45 PM",
    sentByName: "Dan Carter",
    sentByOrg: "Hammerline Build",
    recipientCount: 7,
    downloadedCount: 7,
    pendingCount: 0,
    totalDownloads: 11,
    docCount: 2,
    totalSizeMb: 4.1,
  },
  // Two drafts to exercise the draft state in the UI
  {
    id: "tm-7",
    num: "TM-0008",
    subject: "Drywall finish schedule — Floor 1 tenant spaces",
    message:
      "Draft — will send once Jose confirms finish selections are final. Attach to: Summit Drywall + Hammerline super.",
    status: "draft",
    sentAt: null,
    sentByName: null,
    sentByOrg: null,
    recipientCount: 2,
    downloadedCount: 0,
    pendingCount: 2,
    totalDownloads: 0,
    docCount: 3,
    totalSizeMb: 2.8,
  },
  {
    id: "tm-8",
    num: "TM-0009",
    subject: "Elevator spec — vendor coordination",
    message: "",
    status: "draft",
    sentAt: null,
    sentByName: null,
    sentByOrg: null,
    recipientCount: 0,
    downloadedCount: 0,
    pendingCount: 0,
    totalDownloads: 0,
    docCount: 0,
    totalSizeMb: 0,
  },
];

// ─── Recipients for the hero transmittal (TM-0007) ────────────────────────
// Illustrates full coverage: downloaded / pending / revoked states
const heroRecipients = [
  {
    id: "rc-1",
    name: "Marcus Chen",
    email: "mchen@steelframe.co",
    org: "Steel Frame Co.",
    scope: "sub",
    status: "downloaded",
    firstDownloadedAt: "Apr 22 · 2:38 PM",
    lastDownloadedAt: "Apr 22 · 2:38 PM",
    totalDownloads: 1,
    shareUrl: "https://app.builtcrm.co/t/a7f3k2-xR9mQ8pL4nBv",
  },
  {
    id: "rc-2",
    name: "Priya Shah",
    email: "pshah@nw-hvac.com",
    org: "Northwest HVAC",
    scope: "sub",
    status: "downloaded",
    firstDownloadedAt: "Apr 22 · 3:11 PM",
    lastDownloadedAt: "Apr 23 · 7:42 AM",
    totalDownloads: 2,
    shareUrl: "https://app.builtcrm.co/t/b9c1m4-zP7tJ2xN6wKh",
  },
  {
    id: "rc-3",
    name: "Sarah Mitchell",
    email: "smitchell@mitchelldesign.com",
    org: "Mitchell Design",
    scope: "external",
    status: "downloaded",
    firstDownloadedAt: "Apr 22 · 4:02 PM",
    lastDownloadedAt: "Apr 22 · 4:02 PM",
    totalDownloads: 1,
    shareUrl: "https://app.builtcrm.co/t/d2e8n5-yW4qL9fV3jRc",
  },
  {
    id: "rc-4",
    name: "Ben Rodriguez",
    email: "ben.r@coastalelec.com",
    org: "Coastal Electric",
    scope: "sub",
    status: "pending",
    firstDownloadedAt: null,
    lastDownloadedAt: null,
    totalDownloads: 0,
    shareUrl: "https://app.builtcrm.co/t/f5g7p3-uA6sD1hY8kXm",
  },
  {
    id: "rc-5",
    name: "Jose Ramirez",
    email: "jose@summitdrywall.com",
    org: "Summit Drywall",
    scope: "sub",
    status: "pending",
    firstDownloadedAt: null,
    lastDownloadedAt: null,
    totalDownloads: 0,
    shareUrl: "https://app.builtcrm.co/t/h8j2q6-vB4fK5rZ9mCs",
  },
];

// ─── Attached documents on the hero transmittal ───────────────────────────
const heroDocuments = [
  { id: "d-1", name: "A-201_Floor2_Framing_Plan_Rev3.pdf",       kind: "pdf", sizeMb: 4.2, pages: 3 },
  { id: "d-2", name: "A-202_Floor2_Framing_Details_Rev3.pdf",    kind: "pdf", sizeMb: 3.8, pages: 4 },
  { id: "d-3", name: "S-101_Structural_Framing_Rev3.pdf",        kind: "pdf", sizeMb: 5.1, pages: 6 },
  { id: "d-4", name: "RFI-0047_Architect_Response.pdf",          kind: "pdf", sizeMb: 1.4, pages: 2 },
  { id: "d-5", name: "Framing_Shop_Notes_Rev3.docx",             kind: "doc", sizeMb: 0.3, pages: 2 },
  { id: "d-6", name: "Cover_Letter_TM-0007.pdf",                 kind: "pdf", sizeMb: 3.6, pages: 1 },
];

// ─── Per-download access events (the log renders these, not the counter) ──
// Matches transmittal_access_events schema. Ordered newest-first.
const heroAccessEvents = [
  { id: "ev-1", recipientId: "rc-2", recipientName: "Priya Shah",      org: "Northwest HVAC", when: "Apr 23 · 7:42 AM",  ip: "73.218.44.12",  ua: "iOS 17 · Safari" },
  { id: "ev-2", recipientId: "rc-3", recipientName: "Sarah Mitchell",  org: "Mitchell Design", when: "Apr 22 · 4:02 PM",  ip: "98.202.188.9",  ua: "macOS · Chrome 124" },
  { id: "ev-3", recipientId: "rc-2", recipientName: "Priya Shah",      org: "Northwest HVAC", when: "Apr 22 · 3:11 PM",  ip: "73.218.44.12",  ua: "macOS · Chrome 124" },
  { id: "ev-4", recipientId: "rc-1", recipientName: "Marcus Chen",     org: "Steel Frame Co.", when: "Apr 22 · 2:38 PM",  ip: "104.44.12.87",  ua: "Windows · Edge 122" },
];

// ─── Activity feed (workspace rail) ───────────────────────────────────────
const activity = [
  { who: "Priya Shah",     org: "Northwest HVAC",    action: "downloaded bundle",         target: "TM-0007 · 2nd download",   when: "Apr 23 · 7:42 AM", kind: "download" },
  { who: "Sarah Mitchell", org: "Mitchell Design",   action: "downloaded bundle",         target: "TM-0007",                  when: "Apr 22 · 4:02 PM", kind: "download" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "sent transmittal",          target: "TM-0007 · 5 recipients",   when: "Apr 22 · 2:14 PM", kind: "send" },
  { who: "Owen Bennett",   org: "Bennett Capital",   action: "downloaded bundle",         target: "TM-0006 · owner review",   when: "Apr 20 · 9:15 AM", kind: "download" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "sent transmittal",          target: "TM-0006 · 2 recipients",   when: "Apr 19 · 10:02 AM",kind: "send" },
  { who: "System",         org: "",                  action: "revoked recipient access",  target: "TM-0004 · wrong address",  when: "Apr 14 · 9:42 AM", kind: "revoke" },
];

// ─── Existing project documents for the create-form document picker ───────
// Grouped by folder. Matches what a real project's documents module would expose.
const projectDocLibrary = [
  {
    folder: "Drawings / Architectural",
    docs: [
      { id: "pd-1",  name: "A-100_Site_Plan.pdf",                       sizeMb: 2.4 },
      { id: "pd-2",  name: "A-101_Floor1_Plan.pdf",                     sizeMb: 3.1 },
      { id: "pd-3",  name: "A-102_Floor2_Plan.pdf",                     sizeMb: 3.0 },
      { id: "pd-4",  name: "A-201_Floor2_Framing_Plan_Rev3.pdf",        sizeMb: 4.2 },
      { id: "pd-5",  name: "A-202_Floor2_Framing_Details_Rev3.pdf",     sizeMb: 3.8 },
    ],
  },
  {
    folder: "Drawings / Structural",
    docs: [
      { id: "pd-6",  name: "S-101_Structural_Framing_Rev3.pdf",         sizeMb: 5.1 },
      { id: "pd-7",  name: "S-102_Structural_Details.pdf",              sizeMb: 4.4 },
    ],
  },
  {
    folder: "Drawings / MEP",
    docs: [
      { id: "pd-8",  name: "M-101_HVAC_Floor1.pdf",                     sizeMb: 3.7 },
      { id: "pd-9",  name: "E-101_Electrical_Floor1.pdf",               sizeMb: 3.5 },
    ],
  },
  {
    folder: "Specifications",
    docs: [
      { id: "pd-10", name: "Spec_Section_01_00_00_General_Reqs.pdf",    sizeMb: 2.1 },
      { id: "pd-11", name: "Spec_Section_03_30_00_Concrete.pdf",        sizeMb: 1.9 },
      { id: "pd-12", name: "Spec_Section_05_10_00_Steel.pdf",           sizeMb: 2.2 },
    ],
  },
  {
    folder: "Correspondence / RFI Responses",
    docs: [
      { id: "pd-13", name: "RFI-0047_Architect_Response.pdf",           sizeMb: 1.4 },
      { id: "pd-14", name: "RFI-0046_Architect_Response.pdf",           sizeMb: 1.2 },
    ],
  },
  {
    folder: "Cover Letters",
    docs: [
      { id: "pd-15", name: "Cover_Letter_TM-0007.pdf",                  sizeMb: 3.6 },
      { id: "pd-16", name: "Framing_Shop_Notes_Rev3.docx",              sizeMb: 0.3 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS (inline SVG — no emoji per design system)
// ═══════════════════════════════════════════════════════════════════════════
const I = {
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  chevR:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  back:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  send:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>,
  copy:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  link:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  trash:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  doc:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  folder:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2a2 2 0 0 0-1.7-.9H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/></svg>,
  zip:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>,
  clock:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  mail:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>,
  user:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  shield:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  edit:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  arrowR:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  pin:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z"/></svg>,
  external: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><path d="M10 14 21 3"/></svg>,
  phone:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  lock:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  eye:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ─── BuiltCRM logo mark ───────────────────────────────────────────────────
const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="6" y="6" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity=".6" />
    <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" opacity=".28" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────
const statusLabel = (s) => ({ draft: "Draft", sent: "Sent" }[s] || s);
const initials = (name) => (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const fmtSize = (mb) => (mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(mb * 1000)} KB`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ═══════════════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ─── View / role state ───────────────────────────────────────────────
  const [roleView, setRoleView]             = useState("contractor");     // contractor | recipient
  const [view, setView]                     = useState("workspace");      // workspace | detail | draft | recipient
  const [selectedTransmittalId, setSelId]   = useState("tm-1");
  const [statusFilter, setStatusFilter]     = useState("all");            // all | draft | sent
  const [search, setSearch]                 = useState("");
  const [showCreate, setShowCreate]         = useState(false);
  const [dark, setDark]                     = useState(false);

  // ─── Detail-view local state (interactions wired) ────────────────────
  const [copiedShareId, setCopiedShareId]   = useState(null);
  const [detailTab, setDetailTab]           = useState("recipients");     // recipients | documents | access_log

  // ─── Create-form state ───────────────────────────────────────────────
  const [createSubject, setCreateSubject]   = useState("");
  const [createMessage, setCreateMessage]   = useState("");
  const [createRecipients, setCreateRecipients] = useState([
    { id: "nr-1", name: "",  email: "" },
    { id: "nr-2", name: "",  email: "" },
  ]);
  const [createDocs, setCreateDocs]         = useState([]);               // array of pd-* ids
  const [createFolderOpen, setCreateFolderOpen] = useState(
    Object.fromEntries(projectDocLibrary.map((f) => [f.folder, true]))
  );

  // ─── Draft-edit state (independent copy of tm-7) ─────────────────────
  const [draftSubject, setDraftSubject] = useState(
    transmittals.find((t) => t.id === "tm-7").subject
  );
  const [draftMessage, setDraftMessage] = useState(
    transmittals.find((t) => t.id === "tm-7").message
  );

  // ─── Derived ─────────────────────────────────────────────────────────
  const currentTransmittal = useMemo(
    () => transmittals.find((t) => t.id === selectedTransmittalId) || transmittals[0],
    [selectedTransmittalId]
  );

  const filteredTransmittals = useMemo(() => {
    let rows = transmittals;
    if (statusFilter !== "all") rows = rows.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.num.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          (t.message || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [statusFilter, search]);

  const kpiTotal      = transmittals.length;
  const kpiSent       = transmittals.filter((t) => t.status === "sent").length;
  const kpiDraft      = transmittals.filter((t) => t.status === "draft").length;
  const kpiPending    = transmittals.reduce((a, t) => a + t.pendingCount, 0);
  const kpiDownloads  = transmittals.reduce((a, t) => a + t.totalDownloads, 0);

  const isRecipient   = roleView === "recipient";

  // ─── Create-form helpers ─────────────────────────────────────────────
  const addRecipientRow = () =>
    setCreateRecipients((rs) => [...rs, { id: `nr-${rs.length + 1}`, name: "", email: "" }]);
  const removeRecipientRow = (id) =>
    setCreateRecipients((rs) => rs.filter((r) => r.id !== id));
  const updateRecipientRow = (id, field, val) =>
    setCreateRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const toggleDoc = (docId) =>
    setCreateDocs((ds) => (ds.includes(docId) ? ds.filter((d) => d !== docId) : [...ds, docId]));
  const toggleFolder = (folder) =>
    setCreateFolderOpen((o) => ({ ...o, [folder]: !o[folder] }));
  const selectedDocsTotal = useMemo(() => {
    const all = projectDocLibrary.flatMap((f) => f.docs);
    return createDocs.reduce((acc, id) => {
      const d = all.find((x) => x.id === id);
      return acc + (d?.sizeMb || 0);
    }, 0);
  }, [createDocs]);

  const copyShareUrl = (recipientId, url) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedShareId(recipientId);
    setTimeout(() => setCopiedShareId(null), 1800);
  };

  const canSendCreate =
    createSubject.trim().length > 0 &&
    createRecipients.some((r) => r.email.trim().length > 0) &&
    createDocs.length > 0;

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{CSS}</style>

      <div className={`tm-root${dark ? " tm-dark" : ""}`}>
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TOP BAR                                                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <header className="tm-topbar">
          <div className="tm-brand">
            <LogoMark />
            <span className="tm-brand-name">BuiltCRM</span>
          </div>

          {!isRecipient && (
            <div className="tm-crumbs">
              <strong>Riverside Office Complex</strong>
              {I.chevR}
              <span>Transmittals</span>
            </div>
          )}
          {isRecipient && (
            <div className="tm-crumbs tm-crumbs-recipient">
              <span className="tm-lock-pill">{I.lock} Secure download link</span>
            </div>
          )}

          <div className="tm-top-spacer" />

          {/* Role toggle — Contractor sees the workspace, Recipient sees
              what an external email recipient would see when they click the
              tokenized URL. It's the same app shell — different route in
              production (/t/:token vs /contractor/project/:id/transmittals) */}
          <div className="tm-role-toggle">
            <button
              className={roleView === "contractor" ? "active" : ""}
              onClick={() => { setRoleView("contractor"); setView("workspace"); }}
            >
              Contractor
            </button>
            <button
              className={roleView === "recipient" ? "active" : ""}
              onClick={() => { setRoleView("recipient"); setView("recipient"); }}
            >
              {I.mail} Recipient
            </button>
          </div>

          {!isRecipient && (
            <>
              <button className="tm-topbtn" aria-label="Notifications">
                {I.bell}
                <span className="tm-topbtn-dot" />
              </button>

              <div className="tm-user">
                <div className="tm-user-avatar">DC</div>
                <div className="tm-user-info">
                  <div className="tm-user-name">Dan Carter</div>
                  <div className="tm-user-org">Hammerline Build</div>
                </div>
              </div>
            </>
          )}
        </header>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SHELL                                                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="tm-shell">
          {/* ─── Sidebar (contractor only) ─────────────────────────── */}
          {!isRecipient && (
            <aside className="tm-sidebar">
              <div className="tm-side-section">Transmittals</div>
              <button
                className={`tm-side-item${view === "workspace" ? " active" : ""}`}
                onClick={() => setView("workspace")}
              >
                {I.list} Workspace <span className="tm-side-count">{kpiTotal}</span>
              </button>

              <div className="tm-side-section" style={{ marginTop: 10 }}>Status</div>
              <button
                className={`tm-side-item${statusFilter === "all" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("all"); setView("workspace"); }}
              >
                All <span className="tm-side-count">{kpiTotal}</span>
              </button>
              <button
                className={`tm-side-item${statusFilter === "sent" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("sent"); setView("workspace"); }}
              >
                {I.send} Sent <span className="tm-side-count">{kpiSent}</span>
              </button>
              <button
                className={`tm-side-item${statusFilter === "draft" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("draft"); setView("workspace"); }}
              >
                {I.edit} Drafts <span className="tm-side-count">{kpiDraft}</span>
              </button>

              <div className="tm-side-section" style={{ marginTop: 14 }}>Security</div>
              <div className="tm-side-security">
                <div className="tm-side-security-row">
                  {I.shield}
                  <span>Tokens hashed at rest</span>
                </div>
                <div className="tm-side-security-row">
                  {I.eye}
                  <span>Per-download audit log</span>
                </div>
                <div className="tm-side-security-row">
                  {I.x}
                  <span>Per-recipient revocation</span>
                </div>
              </div>
            </aside>
          )}

          {/* ─── Main content ──────────────────────────────────────── */}
          <main className={`tm-main${isRecipient ? " tm-main-recipient" : ""}`}>
            <div className="tm-content">

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: WORKSPACE (contractor)                             */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "workspace" && !isRecipient && (
                <>
                  {/* Page header */}
                  <div className="tm-page-hdr">
                    <div>
                      <h1 className="tm-page-title">Transmittals</h1>
                      <div className="tm-page-sub">
                        Formal cover-letter sends with document bundles.
                        {" "}
                        {kpiPending > 0 ? (
                          <>
                            <span style={{ color: "var(--wr)", fontWeight: 640 }}>
                              {plural(kpiPending, "recipient hasn't", "recipients haven't")} downloaded yet
                            </span>{" "}
                            across sent transmittals.
                          </>
                        ) : (
                          <>All recipients have downloaded their bundles.</>
                        )}
                      </div>
                    </div>
                    <button
                      className="tm-btn primary"
                      onClick={() => setShowCreate(true)}
                    >
                      {I.plus} New Transmittal
                    </button>
                  </div>

                  {/* KPI strip */}
                  <div className="tm-kpi-strip">
                    <div className="tm-kpi">
                      <div className="tm-kpi-label">Total</div>
                      <div className="tm-kpi-value">{kpiTotal}</div>
                      <div className="tm-kpi-sub">on this project</div>
                    </div>
                    <div className="tm-kpi">
                      <div className="tm-kpi-label">Sent</div>
                      <div className="tm-kpi-value">{kpiSent}</div>
                      <div className="tm-kpi-sub">formally issued</div>
                    </div>
                    <div className="tm-kpi">
                      <div className="tm-kpi-label">Pending downloads</div>
                      <div className={`tm-kpi-value${kpiPending > 0 ? " warn" : ""}`}>{kpiPending}</div>
                      <div className="tm-kpi-sub">recipients haven't opened</div>
                    </div>
                    <div className="tm-kpi">
                      <div className="tm-kpi-label">Total downloads</div>
                      <div className="tm-kpi-value">{kpiDownloads}</div>
                      <div className="tm-kpi-sub">access events logged</div>
                    </div>
                    <div className="tm-kpi">
                      <div className="tm-kpi-label">Drafts</div>
                      <div className="tm-kpi-value muted">{kpiDraft}</div>
                      <div className="tm-kpi-sub">awaiting send</div>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="tm-filter-bar">
                    <div className="tm-search">
                      {I.search}
                      <input
                        type="text"
                        placeholder="Search by number, subject, or message…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="tm-filter-tabs">
                      {[
                        { key: "all",   label: "All",    count: kpiTotal },
                        { key: "sent",  label: "Sent",   count: kpiSent },
                        { key: "draft", label: "Drafts", count: kpiDraft },
                      ].map((f) => (
                        <button
                          key={f.key}
                          className={`tm-filter-tab${statusFilter === f.key ? " active" : ""}`}
                          onClick={() => setStatusFilter(f.key)}
                        >
                          {f.label}
                          <span className="tm-filter-tab-count">{f.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content grid: list + activity rail */}
                  <div className="tm-workspace-grid">
                    {/* ─── Transmittal list ─────────────────────── */}
                    <div className="tm-list">
                      {filteredTransmittals.length === 0 && (
                        <div className="tm-empty">
                          <div className="tm-empty-icon">{I.mail}</div>
                          <div className="tm-empty-title">No transmittals match</div>
                          <div className="tm-empty-sub">
                            Try clearing the search or switching the status filter.
                          </div>
                        </div>
                      )}
                      {filteredTransmittals.map((t) => (
                        <button
                          key={t.id}
                          className={`tm-row${t.status === "draft" ? " draft" : ""}`}
                          onClick={() => {
                            setSelId(t.id);
                            setView(t.status === "draft" ? "draft" : "detail");
                          }}
                        >
                          <div className="tm-row-num">
                            <span className={`tm-status-pill ${t.status}`}>
                              {t.status === "sent" ? I.check : I.edit}
                              {statusLabel(t.status)}
                            </span>
                            <span className="tm-row-num-code">{t.num}</span>
                          </div>
                          <div className="tm-row-body">
                            <div className="tm-row-subject">{t.subject || <em style={{opacity:.5}}>No subject</em>}</div>
                            <div className="tm-row-meta">
                              <span>
                                {I.doc} {plural(t.docCount, "doc", "docs")}
                                {t.totalSizeMb > 0 && <> · {fmtSize(t.totalSizeMb)}</>}
                              </span>
                              <span>
                                {I.user} {plural(t.recipientCount, "recipient", "recipients")}
                              </span>
                              {t.status === "sent" && (
                                <span>
                                  {I.download} {plural(t.totalDownloads, "download", "downloads")}
                                </span>
                              )}
                              {t.sentAt && (
                                <span>
                                  {I.clock} Sent {t.sentAt}
                                </span>
                              )}
                              {!t.sentAt && (
                                <span style={{ color: "var(--text-tertiary)" }}>
                                  Not yet sent
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="tm-row-right">
                            {t.status === "sent" && (
                              <div className="tm-download-bar">
                                <div className="tm-download-bar-label">
                                  {t.downloadedCount}/{t.recipientCount} downloaded
                                </div>
                                <div className="tm-download-bar-track">
                                  <div
                                    className={`tm-download-bar-fill${t.pendingCount === 0 ? " complete" : ""}`}
                                    style={{
                                      width: t.recipientCount === 0
                                        ? "0%"
                                        : `${(t.downloadedCount / t.recipientCount) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            {t.status === "draft" && (
                              <span className="tm-row-draft-chip">Resume editing</span>
                            )}
                            <span className="tm-row-arrow">{I.chevR}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* ─── Activity rail ────────────────────────── */}
                    <aside className="tm-rail">
                      <div className="tm-rail-hdr">
                        <h3>Recent activity</h3>
                      </div>
                      <div className="tm-rail-body">
                        {activity.map((a, idx) => (
                          <div key={idx} className="tm-rail-item">
                            <div
                              className={`tm-rail-avatar${a.who === "System" ? " sys" : ""} ${a.kind}`}
                            >
                              {a.who === "System" ? I.shield : initials(a.who)}
                            </div>
                            <div className="tm-rail-item-body">
                              <div className="tm-rail-item-text">
                                <strong>{a.who}</strong> {a.action}
                              </div>
                              {a.target && (
                                <div className="tm-rail-item-target">{a.target}</div>
                              )}
                              <div className="tm-rail-item-when">{a.when}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: DETAIL (sent — contractor)                         */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "detail" && !isRecipient && currentTransmittal && currentTransmittal.status === "sent" && (
                <>
                  <div className="tm-page-hdr">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button className="tm-btn sm ghost" onClick={() => setView("workspace")}>
                        {I.back} Back
                      </button>
                      <div className="tm-crumbs">
                        <span>Transmittals</span>
                        {I.chevR}
                        <strong>{currentTransmittal.num}</strong>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="tm-btn sm ghost">
                        {I.download} Download cover letter
                      </button>
                      <button className="tm-btn sm">
                        {I.zip} Download full ZIP
                      </button>
                    </div>
                  </div>

                  {/* Detail header card */}
                  <div className="tm-detail-hdr">
                    <div className="tm-detail-hdr-top">
                      <span className={`tm-status-pill ${currentTransmittal.status}`}>
                        {I.check} {statusLabel(currentTransmittal.status)}
                      </span>
                      <span className="tm-detail-num">{currentTransmittal.num}</span>
                      <span className="tm-detail-sent">
                        {I.send} Sent by {currentTransmittal.sentByName} · {currentTransmittal.sentAt}
                      </span>
                    </div>
                    <h2 className="tm-detail-subject">{currentTransmittal.subject}</h2>
                    {currentTransmittal.message && (
                      <p className="tm-detail-msg">{currentTransmittal.message}</p>
                    )}
                    <div className="tm-detail-stat-row">
                      <div className="tm-detail-stat">
                        <div className="tm-detail-stat-label">Recipients</div>
                        <div className="tm-detail-stat-value">{currentTransmittal.recipientCount}</div>
                      </div>
                      <div className="tm-detail-stat">
                        <div className="tm-detail-stat-label">Downloaded</div>
                        <div className="tm-detail-stat-value">
                          {currentTransmittal.downloadedCount}
                          <span className="tm-detail-stat-denom">/{currentTransmittal.recipientCount}</span>
                        </div>
                      </div>
                      <div className="tm-detail-stat">
                        <div className="tm-detail-stat-label">Total downloads</div>
                        <div className="tm-detail-stat-value">{currentTransmittal.totalDownloads}</div>
                      </div>
                      <div className="tm-detail-stat">
                        <div className="tm-detail-stat-label">Documents</div>
                        <div className="tm-detail-stat-value">{currentTransmittal.docCount}</div>
                      </div>
                      <div className="tm-detail-stat">
                        <div className="tm-detail-stat-label">Bundle size</div>
                        <div className="tm-detail-stat-value">{fmtSize(currentTransmittal.totalSizeMb)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Email-stub note — honest about the Option C stub */}
                  <div className="tm-stub-note">
                    <div className="tm-stub-note-icon">{I.mail}</div>
                    <div className="tm-stub-note-body">
                      <strong>Email delivery is stubbed.</strong> Per-recipient secure
                      download URLs are surfaced below. Copy and send from your own
                      email client, or wait for the native sender to be wired in a
                      later step. Downloads are logged either way.
                    </div>
                  </div>

                  {/* Tab nav */}
                  <div className="tm-detail-tabs">
                    <button
                      className={`tm-detail-tab${detailTab === "recipients" ? " active" : ""}`}
                      onClick={() => setDetailTab("recipients")}
                    >
                      {I.user} Recipients
                      <span className="tm-detail-tab-count">{heroRecipients.length}</span>
                    </button>
                    <button
                      className={`tm-detail-tab${detailTab === "documents" ? " active" : ""}`}
                      onClick={() => setDetailTab("documents")}
                    >
                      {I.doc} Documents
                      <span className="tm-detail-tab-count">{heroDocuments.length}</span>
                    </button>
                    <button
                      className={`tm-detail-tab${detailTab === "access_log" ? " active" : ""}`}
                      onClick={() => setDetailTab("access_log")}
                    >
                      {I.eye} Access log
                      <span className="tm-detail-tab-count">{heroAccessEvents.length}</span>
                    </button>
                  </div>

                  {/* ─── TAB: RECIPIENTS ───────────────────────── */}
                  {detailTab === "recipients" && (
                    <div className="tm-recip-list">
                      {heroRecipients.map((r) => (
                        <div key={r.id} className={`tm-recip-row ${r.status}`}>
                          <div className={`tm-recip-avatar ${r.scope}`}>
                            {initials(r.name)}
                          </div>
                          <div className="tm-recip-body">
                            <div className="tm-recip-name-row">
                              <span className="tm-recip-name">{r.name}</span>
                              <span className="tm-recip-org">· {r.org}</span>
                              <span className={`tm-recip-scope ${r.scope}`}>{r.scope}</span>
                            </div>
                            <div className="tm-recip-email">{r.email}</div>
                            <div className="tm-recip-share">
                              <span className="tm-recip-share-label">{I.link} Share URL</span>
                              <code className="tm-recip-share-url">{r.shareUrl}</code>
                              <button
                                className={`tm-btn xs ghost${copiedShareId === r.id ? " copied" : ""}`}
                                onClick={() => copyShareUrl(r.id, r.shareUrl)}
                              >
                                {copiedShareId === r.id ? (
                                  <>{I.check} Copied</>
                                ) : (
                                  <>{I.copy} Copy</>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="tm-recip-right">
                            {r.status === "downloaded" ? (
                              <>
                                <span className="tm-recip-status downloaded">
                                  {I.check} Downloaded
                                </span>
                                <div className="tm-recip-status-sub">
                                  {r.totalDownloads} download{r.totalDownloads === 1 ? "" : "s"}
                                </div>
                                <div className="tm-recip-status-sub tertiary">
                                  Last: {r.lastDownloadedAt}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="tm-recip-status pending">
                                  {I.clock} Pending
                                </span>
                                <div className="tm-recip-status-sub tertiary">
                                  Not yet opened
                                </div>
                              </>
                            )}
                            <div className="tm-recip-actions">
                              <button className="tm-recip-action" title="Resend email">
                                {I.send}
                              </button>
                              <button className="tm-recip-action danger" title="Revoke access">
                                {I.x}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─── TAB: DOCUMENTS ────────────────────────── */}
                  {detailTab === "documents" && (
                    <div className="tm-docs">
                      <div className="tm-docs-hdr">
                        <div>
                          <strong>{heroDocuments.length}</strong> documents ·{" "}
                          {fmtSize(heroDocuments.reduce((a, d) => a + d.sizeMb, 0))} bundle
                        </div>
                        <button className="tm-btn sm">
                          {I.zip} Download all as ZIP
                        </button>
                      </div>
                      <div className="tm-docs-grid">
                        {heroDocuments.map((d, idx) => (
                          <div key={d.id} className="tm-doc-tile">
                            <div className={`tm-doc-thumb ${d.kind}`}>
                              {I.doc}
                              <span className="tm-doc-kind">{d.kind.toUpperCase()}</span>
                            </div>
                            <div className="tm-doc-body">
                              <div className="tm-doc-name">{d.name}</div>
                              <div className="tm-doc-meta">
                                {d.pages} {d.pages === 1 ? "page" : "pages"} · {fmtSize(d.sizeMb)}
                              </div>
                            </div>
                            <div className="tm-doc-order">#{idx + 1}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── TAB: ACCESS LOG ───────────────────────── */}
                  {detailTab === "access_log" && (
                    <div className="tm-log">
                      <div className="tm-log-hdr">
                        <h3>Access log</h3>
                        <div className="tm-log-sub">
                          Every download is recorded with timestamp, source IP, and
                          user agent. Tokens are validated against SHA-256 digests —
                          plaintext is never stored.
                        </div>
                      </div>
                      <div className="tm-log-table">
                        <div className="tm-log-table-head">
                          <span>When</span>
                          <span>Recipient</span>
                          <span>Source IP</span>
                          <span>User agent</span>
                        </div>
                        {heroAccessEvents.map((e) => (
                          <div key={e.id} className="tm-log-row">
                            <span className="tm-log-when">
                              {I.clock}
                              {e.when}
                            </span>
                            <span className="tm-log-who">
                              <span className="tm-log-who-avatar">{initials(e.recipientName)}</span>
                              <div>
                                <div className="tm-log-who-name">{e.recipientName}</div>
                                <div className="tm-log-who-org">{e.org}</div>
                              </div>
                            </span>
                            <span className="tm-log-ip">
                              <code>{e.ip}</code>
                            </span>
                            <span className="tm-log-ua">{e.ua}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: DRAFT (editable — contractor)                      */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "draft" && !isRecipient && currentTransmittal && currentTransmittal.status === "draft" && (
                <>
                  <div className="tm-page-hdr">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button className="tm-btn sm ghost" onClick={() => setView("workspace")}>
                        {I.back} Back
                      </button>
                      <div className="tm-crumbs">
                        <span>Transmittals</span>
                        {I.chevR}
                        <strong>{currentTransmittal.num}</strong>
                        <span className="tm-crumb-chip">Draft</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="tm-btn sm ghost">{I.trash} Discard draft</button>
                      <button className="tm-btn sm ghost">Save & close</button>
                      <button className="tm-btn sm primary">
                        {I.send} Send now
                      </button>
                    </div>
                  </div>

                  <div className="tm-draft-note">
                    <span className="tm-draft-note-icon">{I.edit}</span>
                    <div>
                      <strong>This transmittal is a draft.</strong> No recipients
                      have been notified. Tokens aren't generated until send. The
                      audit trail starts at the send event.
                    </div>
                  </div>

                  <div className="tm-draft-form">
                    <label className="tm-field">
                      <span className="tm-field-label">Subject</span>
                      <input
                        type="text"
                        className="tm-input"
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        placeholder="e.g. Floor 2 framing shop drawings — Rev 3 for field"
                      />
                    </label>
                    <label className="tm-field">
                      <span className="tm-field-label">Cover message</span>
                      <textarea
                        className="tm-textarea"
                        rows={6}
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                        placeholder="What is this transmittal covering? What do recipients need to do?"
                      />
                    </label>

                    <div className="tm-draft-meta-grid">
                      <div className="tm-draft-meta-card">
                        <div className="tm-draft-meta-hdr">
                          <span className="tm-draft-meta-label">
                            {I.user} Recipients
                          </span>
                          <button className="tm-btn xs ghost">{I.plus} Add</button>
                        </div>
                        <div className="tm-draft-recipient-list">
                          <div className="tm-draft-recipient-row">
                            <div className="tm-draft-recipient-avatar sub">JR</div>
                            <div>
                              <div className="tm-draft-recipient-name">Jose Ramirez</div>
                              <div className="tm-draft-recipient-email">jose@summitdrywall.com</div>
                            </div>
                            <button className="tm-btn xs ghost">{I.x}</button>
                          </div>
                          <div className="tm-draft-recipient-row">
                            <div className="tm-draft-recipient-avatar internal">LN</div>
                            <div>
                              <div className="tm-draft-recipient-name">Laura Ng</div>
                              <div className="tm-draft-recipient-email">laura@hammerline.build</div>
                            </div>
                            <button className="tm-btn xs ghost">{I.x}</button>
                          </div>
                        </div>
                      </div>

                      <div className="tm-draft-meta-card">
                        <div className="tm-draft-meta-hdr">
                          <span className="tm-draft-meta-label">
                            {I.doc} Documents
                          </span>
                          <button className="tm-btn xs ghost">{I.plus} Attach from project</button>
                        </div>
                        <div className="tm-draft-doc-list">
                          <div className="tm-draft-doc-row">
                            <div className="tm-doc-thumb-sm pdf">{I.doc}</div>
                            <div>
                              <div className="tm-draft-doc-name">A-101_Floor1_Finish_Schedule.pdf</div>
                              <div className="tm-draft-doc-meta">PDF · 1.1 MB</div>
                            </div>
                            <button className="tm-btn xs ghost">{I.x}</button>
                          </div>
                          <div className="tm-draft-doc-row">
                            <div className="tm-doc-thumb-sm pdf">{I.doc}</div>
                            <div>
                              <div className="tm-draft-doc-name">Finish_Selections_Summary_v4.pdf</div>
                              <div className="tm-draft-doc-meta">PDF · 0.8 MB</div>
                            </div>
                            <button className="tm-btn xs ghost">{I.x}</button>
                          </div>
                          <div className="tm-draft-doc-row">
                            <div className="tm-doc-thumb-sm doc">{I.doc}</div>
                            <div>
                              <div className="tm-draft-doc-name">Finish_Notes_Rev1.docx</div>
                              <div className="tm-draft-doc-meta">DOCX · 0.3 MB</div>
                            </div>
                            <button className="tm-btn xs ghost">{I.x}</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="tm-draft-summary">
                      <span className="tm-draft-summary-item">
                        {I.user} <strong>2</strong> recipients
                      </span>
                      <span className="tm-draft-summary-item">
                        {I.doc} <strong>3</strong> docs · 2.2 MB
                      </span>
                      <span className="tm-draft-summary-item">
                        {I.shield} Tokens generated at send
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: RECIPIENT (anonymous tokenized download page)      */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "recipient" && isRecipient && (
                <div className="tm-recipient-page">
                  <div className="tm-recipient-card">
                    <div className="tm-recipient-card-hdr">
                      <div className="tm-recipient-from">
                        <div className="tm-recipient-from-label">From</div>
                        <div className="tm-recipient-from-name">Hammerline Build</div>
                        <div className="tm-recipient-from-sub">
                          Project: <strong>Riverside Office Complex</strong>
                        </div>
                      </div>
                      <div className="tm-recipient-num-block">
                        <div className="tm-recipient-num">TM-0007</div>
                        <div className="tm-recipient-sent">Sent Apr 22 · 2:14 PM</div>
                      </div>
                    </div>

                    <h1 className="tm-recipient-subject">
                      Floor 2 framing shop drawings — Rev 3 for field
                    </h1>

                    <div className="tm-recipient-msg">
                      Attached are the rev-3 framing shop drawings for Floor 2,
                      reflecting the RFI-0047 curtain-wall attachment
                      clarification. Please distribute to your field crews before
                      the Monday pre-pour walk. Supersedes rev-2 issued Apr 12.
                    </div>

                    <div className="tm-recipient-signoff">
                      — Dan Carter, Project Manager
                      <br />
                      Hammerline Build
                    </div>

                    <div className="tm-recipient-bundle">
                      <div className="tm-recipient-bundle-hdr">
                        <span className="tm-recipient-bundle-title">
                          {I.zip} Document bundle
                        </span>
                        <span className="tm-recipient-bundle-meta">
                          {heroDocuments.length} files · {fmtSize(heroDocuments.reduce((a, d) => a + d.sizeMb, 0))}
                        </span>
                      </div>
                      <div className="tm-recipient-doc-list">
                        {heroDocuments.map((d) => (
                          <div key={d.id} className="tm-recipient-doc-row">
                            <div className={`tm-doc-thumb-sm ${d.kind}`}>{I.doc}</div>
                            <div className="tm-recipient-doc-body">
                              <div className="tm-recipient-doc-name">{d.name}</div>
                              <div className="tm-recipient-doc-meta">
                                {fmtSize(d.sizeMb)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="tm-btn lg primary tm-recipient-download">
                        {I.download} Download all as ZIP
                        <span className="tm-recipient-download-sub">
                          {fmtSize(heroDocuments.reduce((a, d) => a + d.sizeMb, 0))}
                          {" · "}
                          {heroDocuments.length} files
                        </span>
                      </button>
                    </div>

                    <div className="tm-recipient-audit">
                      <div className="tm-recipient-audit-icon">{I.eye}</div>
                      <div>
                        <strong>This download is logged.</strong> The sender is
                        notified when you download and sees your source IP and
                        browser. This link is bound to your email address and
                        shouldn't be shared.
                      </div>
                    </div>

                    <div className="tm-recipient-footer">
                      <div className="tm-recipient-footer-brand">
                        <LogoMark />
                        <span>Delivered securely by BuiltCRM</span>
                      </div>
                      <div className="tm-recipient-footer-sub">
                        Token verified · Expires never · Revocable by sender
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CREATE MODAL                                                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showCreate && !isRecipient && (
          <div className="tm-modal-backdrop" onClick={() => setShowCreate(false)}>
            <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="tm-modal-hdr">
                <div>
                  <h2 className="tm-modal-title">New transmittal</h2>
                  <div className="tm-modal-sub">
                    Next number: <code>TM-0010</code> · Project:{" "}
                    <strong>Riverside Office Complex</strong>
                  </div>
                </div>
                <button
                  className="tm-btn xs ghost"
                  onClick={() => setShowCreate(false)}
                  aria-label="Close"
                >
                  {I.x}
                </button>
              </div>

              <div className="tm-modal-body">
                {/* Subject + message */}
                <label className="tm-field">
                  <span className="tm-field-label">Subject</span>
                  <input
                    type="text"
                    className="tm-input"
                    value={createSubject}
                    onChange={(e) => setCreateSubject(e.target.value)}
                    placeholder="e.g. IFC set — Floor 2 framing"
                  />
                </label>
                <label className="tm-field">
                  <span className="tm-field-label">Cover message</span>
                  <textarea
                    className="tm-textarea"
                    rows={4}
                    value={createMessage}
                    onChange={(e) => setCreateMessage(e.target.value)}
                    placeholder="Why are you sending this? What should recipients do with it?"
                  />
                </label>

                {/* Recipients */}
                <div className="tm-create-section">
                  <div className="tm-create-section-hdr">
                    <span className="tm-field-label">
                      {I.user} Recipients
                    </span>
                    <button className="tm-btn xs ghost" onClick={addRecipientRow}>
                      {I.plus} Add row
                    </button>
                  </div>
                  <div className="tm-create-recipients">
                    {createRecipients.map((r) => (
                      <div key={r.id} className="tm-create-recipient-row">
                        <input
                          className="tm-input sm"
                          placeholder="Full name"
                          value={r.name}
                          onChange={(e) => updateRecipientRow(r.id, "name", e.target.value)}
                        />
                        <input
                          className="tm-input sm"
                          placeholder="email@company.com"
                          type="email"
                          value={r.email}
                          onChange={(e) => updateRecipientRow(r.id, "email", e.target.value)}
                        />
                        <button
                          className="tm-btn xs ghost"
                          onClick={() => removeRecipientRow(r.id)}
                          disabled={createRecipients.length === 1}
                        >
                          {I.trash}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document picker */}
                <div className="tm-create-section">
                  <div className="tm-create-section-hdr">
                    <span className="tm-field-label">
                      {I.doc} Attach documents
                    </span>
                    <div className="tm-create-section-sub">
                      {createDocs.length} selected
                      {createDocs.length > 0 && <> · {fmtSize(selectedDocsTotal)}</>}
                    </div>
                  </div>
                  <div className="tm-doc-picker">
                    {projectDocLibrary.map((folder) => (
                      <div key={folder.folder} className="tm-doc-folder">
                        <button
                          className="tm-doc-folder-hdr"
                          onClick={() => toggleFolder(folder.folder)}
                        >
                          <span className="tm-doc-folder-chevron" data-open={createFolderOpen[folder.folder]}>
                            {I.chevR}
                          </span>
                          {I.folder}
                          <span className="tm-doc-folder-name">{folder.folder}</span>
                          <span className="tm-doc-folder-count">{folder.docs.length}</span>
                        </button>
                        {createFolderOpen[folder.folder] && (
                          <div className="tm-doc-folder-body">
                            {folder.docs.map((d) => {
                              const selected = createDocs.includes(d.id);
                              return (
                                <label
                                  key={d.id}
                                  className={`tm-doc-picker-row${selected ? " selected" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleDoc(d.id)}
                                  />
                                  <span className="tm-doc-picker-name">{d.name}</span>
                                  <span className="tm-doc-picker-size">{fmtSize(d.sizeMb)}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="tm-modal-ftr">
                <div className="tm-modal-ftr-left">
                  {I.shield}
                  <span>
                    Tokens generated on send. Plaintext never stored.
                  </span>
                </div>
                <div className="tm-modal-ftr-right">
                  <button
                    className="tm-btn ghost"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                  <button className="tm-btn ghost">
                    {I.edit} Save draft
                  </button>
                  <button
                    className="tm-btn primary"
                    disabled={!canSendCreate}
                    onClick={() => {
                      setShowCreate(false);
                      // In production: POST /api/transmittals/[id]/send
                      // atomic bump of projects.transmittal_counter, fan-out
                      // tokens, write access-log skeleton, fire emailTransmittal().
                    }}
                  >
                    {I.send} Send transmittal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dark mode toggle — global */}
        <button
          className="tm-dark-toggle"
          onClick={() => setDark((d) => !d)}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════
const CSS = `
  /* ─── Design tokens (matches meetings / inspections / submittals) ───── */
  :root{
    --accent:#5b4fc7;
    --accent-soft:rgba(91,79,199,.1);
    --accent-deep:#4a3fa8;
    --ok:#2d8a5e;       --ok-soft:rgba(45,138,94,.12);
    --wr:#c4700b;       --wr-soft:rgba(196,112,11,.12);
    --er:#c94545;       --er-soft:rgba(201,69,69,.12);
    --info:#3178b9;     --info-soft:rgba(49,120,185,.12);
    --na:#8a8a8a;       --na-soft:rgba(138,138,138,.12);

    --bg:#f6f5f2;
    --surface-1:#ffffff;
    --surface-2:#faf9f6;
    --surface-3:#eceae4;
    --surface-hover:#f2f0eb;
    --text-primary:#1a1a1a;
    --text-secondary:#525050;
    --text-tertiary:#8a8884;
    --text-inverse:#fafafa;
    --border:#e4e2dc;
    --border-strong:#d0ccc4;
    --canvas-bg:#efedea;
    --shadow-sm:0 1px 2px rgba(0,0,0,.05);
    --shadow-md:0 4px 12px rgba(0,0,0,.08);
    --shadow-lg:0 8px 24px rgba(0,0,0,.1);
  }
  .tm-dark{
    --bg:#141312;
    --surface-1:#1d1c1a;
    --surface-2:#232120;
    --surface-3:#2e2c29;
    --surface-hover:#272523;
    --text-primary:#f1efea;
    --text-secondary:#b0ada7;
    --text-tertiary:#6f6d68;
    --text-inverse:#141312;
    --border:#2e2c29;
    --border-strong:#3a3733;
    --canvas-bg:#1a1917;
    --accent-soft:rgba(126,114,230,.18);
    --accent:#7e72e6;
    --shadow-sm:0 1px 2px rgba(0,0,0,.3);
    --shadow-md:0 4px 12px rgba(0,0,0,.35);
    --shadow-lg:0 8px 24px rgba(0,0,0,.45);
  }

  *,*::before,*::after{box-sizing:border-box}
  .tm-root{
    font-family:"DM Sans",system-ui,sans-serif;
    background:var(--canvas-bg);
    color:var(--text-primary);
    min-height:100vh;
    letter-spacing:-0.005em;
  }
  .tm-root h1,.tm-root h2,.tm-root h3{font-family:"Instrument Sans",Georgia,serif;font-weight:600;letter-spacing:-0.02em}
  code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.85em}

  /* ─── Top bar ───────────────────────────────────────────────────── */
  .tm-topbar{
    display:flex;align-items:center;gap:18px;
    height:56px;padding:0 22px;
    background:var(--surface-1);
    border-bottom:1px solid var(--border);
    position:sticky;top:0;z-index:20;
  }
  .tm-brand{display:flex;align-items:center;gap:8px;color:var(--text-primary)}
  .tm-brand-name{font-family:"Instrument Sans",serif;font-size:17px;font-weight:600;letter-spacing:-.01em}
  .tm-crumbs{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-secondary)}
  .tm-crumbs strong{color:var(--text-primary);font-weight:580}
  .tm-crumb-chip{background:var(--wr-soft);color:var(--wr);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:560;letter-spacing:.02em;text-transform:uppercase;margin-left:4px}
  .tm-crumbs-recipient{font-size:13px}
  .tm-lock-pill{display:inline-flex;align-items:center;gap:6px;background:var(--ok-soft);color:var(--ok);padding:4px 11px;border-radius:999px;font-size:12px;font-weight:540}
  .tm-top-spacer{flex:1}
  .tm-role-toggle{
    display:flex;background:var(--surface-3);padding:3px;border-radius:7px;font-size:12.5px;
  }
  .tm-role-toggle button{
    display:flex;align-items:center;gap:5px;
    background:none;border:0;padding:6px 12px;border-radius:5px;
    color:var(--text-secondary);font:inherit;font-weight:540;cursor:pointer;
  }
  .tm-role-toggle button.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
  .tm-topbtn{position:relative;background:none;border:0;width:34px;height:34px;border-radius:7px;color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
  .tm-topbtn:hover{background:var(--surface-hover);color:var(--text-primary)}
  .tm-topbtn-dot{position:absolute;top:8px;right:9px;width:7px;height:7px;background:var(--er);border-radius:50%;border:1.5px solid var(--surface-1)}
  .tm-user{display:flex;align-items:center;gap:9px;padding-left:6px}
  .tm-user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent) 0%,var(--accent-deep) 100%);color:var(--text-inverse);font-size:12px;font-weight:600;display:grid;place-items:center;letter-spacing:.02em}
  .tm-user-name{font-size:12.5px;font-weight:560;line-height:1.2}
  .tm-user-org{font-size:11px;color:var(--text-tertiary)}

  /* ─── Shell ─────────────────────────────────────────────────────── */
  .tm-shell{display:flex;min-height:calc(100vh - 56px)}
  .tm-sidebar{
    width:218px;flex-shrink:0;
    background:var(--surface-1);
    border-right:1px solid var(--border);
    padding:16px 12px;
    position:sticky;top:56px;align-self:flex-start;
    height:calc(100vh - 56px);overflow-y:auto;
  }
  .tm-side-section{
    padding:6px 10px 5px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;
    color:var(--text-tertiary);font-weight:560;
  }
  .tm-side-item{
    display:flex;align-items:center;gap:8px;width:100%;
    background:none;border:0;padding:8px 10px;border-radius:6px;
    font:inherit;font-size:13px;color:var(--text-secondary);font-weight:520;
    cursor:pointer;text-align:left;
    transition:background .12s ease, color .12s ease;
  }
  .tm-side-item:hover{background:var(--surface-hover);color:var(--text-primary)}
  .tm-side-item.active{background:var(--accent-soft);color:var(--accent-deep);font-weight:580}
  .tm-dark .tm-side-item.active{color:var(--accent)}
  .tm-side-count{margin-left:auto;background:var(--surface-3);color:var(--text-tertiary);padding:1px 7px;border-radius:10px;font-size:11px;font-weight:540;font-variant-numeric:tabular-nums}
  .tm-side-item.active .tm-side-count{background:var(--surface-1);color:var(--accent-deep)}
  .tm-dark .tm-side-item.active .tm-side-count{background:var(--surface-3);color:var(--accent)}
  .tm-side-security{padding:6px 10px;display:flex;flex-direction:column;gap:8px;font-size:11.5px;color:var(--text-tertiary)}
  .tm-side-security-row{display:flex;align-items:center;gap:7px;line-height:1.35}
  .tm-side-security-row svg{color:var(--ok);flex-shrink:0}

  /* ─── Main content ──────────────────────────────────────────────── */
  .tm-main{flex:1;padding:24px 28px 40px;min-width:0}
  .tm-main-recipient{background:var(--bg);padding:40px 20px}
  .tm-content{max-width:1200px;margin:0 auto}

  /* ─── Page header ───────────────────────────────────────────────── */
  .tm-page-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap}
  .tm-page-title{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}
  .tm-page-sub{font-size:13.5px;color:var(--text-secondary);line-height:1.45;max-width:720px}

  /* ─── Buttons ───────────────────────────────────────────────────── */
  .tm-btn{
    display:inline-flex;align-items:center;gap:6px;
    background:var(--surface-1);border:1px solid var(--border-strong);
    padding:8px 14px;border-radius:7px;
    font-family:inherit;font-size:13px;font-weight:540;color:var(--text-primary);
    cursor:pointer;transition:all .12s ease;
    white-space:nowrap;
  }
  .tm-btn:hover{background:var(--surface-hover)}
  .tm-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--text-inverse)}
  .tm-btn.primary:hover{background:var(--accent-deep)}
  .tm-btn.primary:disabled{background:var(--na);border-color:var(--na);cursor:not-allowed;opacity:.6}
  .tm-btn.ghost{background:none;border-color:transparent;color:var(--text-secondary)}
  .tm-btn.ghost:hover{background:var(--surface-hover);color:var(--text-primary)}
  .tm-btn.sm{padding:6px 11px;font-size:12.5px}
  .tm-btn.xs{padding:4px 8px;font-size:11.5px;border-radius:5px;gap:4px}
  .tm-btn.lg{padding:14px 22px;font-size:15px;font-weight:580;gap:9px;border-radius:9px}
  .tm-btn.copied{background:var(--ok-soft);color:var(--ok);border-color:transparent}

  /* ─── KPI strip ─────────────────────────────────────────────────── */
  .tm-kpi-strip{
    display:grid;grid-template-columns:repeat(5,1fr);gap:10px;
    margin-bottom:18px;
  }
  .tm-kpi{
    background:var(--surface-1);border:1px solid var(--border);
    border-radius:9px;padding:13px 15px;
  }
  .tm-kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:560;margin-bottom:4px}
  .tm-kpi-value{font-family:"Instrument Sans",serif;font-size:26px;font-weight:600;line-height:1;letter-spacing:-.02em;color:var(--text-primary);font-variant-numeric:tabular-nums}
  .tm-kpi-value.warn{color:var(--wr)}
  .tm-kpi-value.muted{color:var(--text-tertiary)}
  .tm-kpi-value .tm-detail-stat-denom{font-size:16px;color:var(--text-tertiary);font-weight:500}
  .tm-kpi-sub{font-size:11.5px;color:var(--text-tertiary);margin-top:3px}
  @media (max-width: 960px){.tm-kpi-strip{grid-template-columns:repeat(2,1fr)}}

  /* ─── Filter bar ────────────────────────────────────────────────── */
  .tm-filter-bar{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}
  .tm-search{
    flex:1;min-width:260px;
    display:flex;align-items:center;gap:8px;
    background:var(--surface-1);border:1px solid var(--border);border-radius:8px;
    padding:0 12px;height:38px;
    color:var(--text-tertiary);
  }
  .tm-search input{
    flex:1;background:none;border:0;outline:none;
    font-family:inherit;font-size:13.5px;color:var(--text-primary);
  }
  .tm-search input::placeholder{color:var(--text-tertiary)}
  .tm-filter-tabs{display:flex;background:var(--surface-3);padding:3px;border-radius:7px;gap:2px}
  .tm-filter-tab{
    display:flex;align-items:center;gap:6px;
    background:none;border:0;padding:6px 12px;border-radius:5px;
    font-family:inherit;font-size:12.5px;font-weight:540;color:var(--text-secondary);cursor:pointer;
  }
  .tm-filter-tab.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
  .tm-filter-tab-count{background:var(--surface-3);padding:0 6px;border-radius:8px;font-size:10.5px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}
  .tm-filter-tab.active .tm-filter-tab-count{background:var(--accent-soft);color:var(--accent-deep)}
  .tm-dark .tm-filter-tab.active .tm-filter-tab-count{color:var(--accent)}

  /* ─── Workspace grid ────────────────────────────────────────────── */
  .tm-workspace-grid{display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start}
  @media (max-width: 1100px){.tm-workspace-grid{grid-template-columns:1fr}}

  /* ─── List rows ─────────────────────────────────────────────────── */
  .tm-list{display:flex;flex-direction:column;gap:8px}
  .tm-row{
    display:grid;grid-template-columns:140px 1fr 220px;gap:18px;align-items:center;
    background:var(--surface-1);border:1px solid var(--border);border-radius:9px;
    padding:14px 18px;
    text-align:left;font-family:inherit;cursor:pointer;
    transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease;
  }
  .tm-row:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md);transform:translateY(-1px)}
  .tm-row.draft{background:var(--surface-2);border-style:dashed}
  .tm-row-num{display:flex;flex-direction:column;align-items:flex-start;gap:5px}
  .tm-row-num-code{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--text-secondary);letter-spacing:.01em}
  .tm-status-pill{
    display:inline-flex;align-items:center;gap:4px;
    padding:3px 9px;border-radius:4px;
    font-size:11px;font-weight:560;letter-spacing:.02em;text-transform:uppercase;
  }
  .tm-status-pill.sent{background:var(--ok-soft);color:var(--ok)}
  .tm-status-pill.draft{background:var(--wr-soft);color:var(--wr)}
  .tm-row-body{min-width:0}
  .tm-row-subject{font-size:14.5px;font-weight:560;color:var(--text-primary);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tm-row-meta{display:flex;gap:14px;font-size:12px;color:var(--text-tertiary);flex-wrap:wrap}
  .tm-row-meta span{display:inline-flex;align-items:center;gap:4px}
  .tm-row-right{display:flex;align-items:center;gap:10px;justify-content:flex-end}
  .tm-row-arrow{color:var(--text-tertiary);display:flex}
  .tm-row-draft-chip{font-size:11.5px;color:var(--wr);font-weight:540}

  /* ─── Download bar ──────────────────────────────────────────────── */
  .tm-download-bar{display:flex;flex-direction:column;gap:5px;min-width:140px}
  .tm-download-bar-label{font-size:11px;color:var(--text-tertiary);font-weight:540;font-variant-numeric:tabular-nums}
  .tm-download-bar-track{height:5px;background:var(--surface-3);border-radius:999px;overflow:hidden}
  .tm-download-bar-fill{height:100%;background:var(--wr);border-radius:999px;transition:width .3s ease}
  .tm-download-bar-fill.complete{background:var(--ok)}

  /* ─── Empty state ───────────────────────────────────────────────── */
  .tm-empty{
    background:var(--surface-1);border:1px dashed var(--border-strong);border-radius:9px;
    padding:44px 20px;text-align:center;
  }
  .tm-empty-icon{display:inline-flex;width:44px;height:44px;background:var(--surface-3);border-radius:50%;align-items:center;justify-content:center;color:var(--text-tertiary);margin-bottom:10px}
  .tm-empty-title{font-size:15px;font-weight:580;color:var(--text-primary);margin-bottom:3px}
  .tm-empty-sub{font-size:12.5px;color:var(--text-tertiary)}

  /* ─── Activity rail ─────────────────────────────────────────────── */
  .tm-rail{
    background:var(--surface-1);border:1px solid var(--border);border-radius:9px;
    position:sticky;top:80px;
  }
  .tm-rail-hdr{padding:13px 16px;border-bottom:1px solid var(--border)}
  .tm-rail-hdr h3{font-size:13px;margin:0;font-family:"DM Sans",sans-serif;font-weight:580;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary)}
  .tm-rail-body{padding:6px 0;max-height:560px;overflow-y:auto}
  .tm-rail-item{display:flex;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)}
  .tm-rail-item:last-child{border-bottom:0}
  .tm-rail-avatar{
    width:28px;height:28px;border-radius:50%;flex-shrink:0;
    background:var(--accent-soft);color:var(--accent-deep);
    font-size:10.5px;font-weight:600;display:grid;place-items:center;letter-spacing:.02em;
  }
  .tm-dark .tm-rail-avatar{color:var(--accent)}
  .tm-rail-avatar.sys{background:var(--surface-3);color:var(--text-tertiary)}
  .tm-rail-avatar.download{background:var(--ok-soft);color:var(--ok)}
  .tm-rail-avatar.send{background:var(--info-soft);color:var(--info)}
  .tm-rail-avatar.revoke{background:var(--er-soft);color:var(--er)}
  .tm-rail-item-text{font-size:12.5px;color:var(--text-primary);line-height:1.4}
  .tm-rail-item-text strong{font-weight:580}
  .tm-rail-item-target{font-size:11.5px;color:var(--text-secondary);margin-top:2px}
  .tm-rail-item-when{font-size:11px;color:var(--text-tertiary);margin-top:3px}

  /* ─── Detail header ─────────────────────────────────────────────── */
  .tm-detail-hdr{
    background:var(--surface-1);border:1px solid var(--border);border-radius:11px;
    padding:22px 26px;margin-bottom:14px;
  }
  .tm-detail-hdr-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
  .tm-detail-num{font-family:"JetBrains Mono",monospace;font-size:13px;color:var(--text-secondary);font-weight:500}
  .tm-detail-sent{margin-left:auto;font-size:12.5px;color:var(--text-tertiary);display:inline-flex;align-items:center;gap:5px}
  .tm-detail-subject{font-size:22px;margin:0 0 8px;letter-spacing:-.015em;line-height:1.3}
  .tm-detail-msg{font-size:14px;color:var(--text-secondary);line-height:1.55;margin:0 0 18px;max-width:780px}
  .tm-detail-stat-row{display:flex;gap:28px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap}
  .tm-detail-stat-label{font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.07em;font-weight:560;margin-bottom:3px}
  .tm-detail-stat-value{font-family:"Instrument Sans",serif;font-size:22px;font-weight:600;letter-spacing:-.015em;font-variant-numeric:tabular-nums}
  .tm-detail-stat-denom{font-size:14px;color:var(--text-tertiary);font-weight:500}

  /* ─── Stub note (honest Option C disclosure) ────────────────────── */
  .tm-stub-note{
    display:flex;gap:12px;align-items:flex-start;
    background:var(--info-soft);border:1px solid transparent;border-left:3px solid var(--info);
    padding:12px 16px;border-radius:7px;margin-bottom:14px;
    font-size:12.5px;color:var(--text-secondary);line-height:1.5;
  }
  .tm-stub-note strong{color:var(--text-primary);font-weight:580}
  .tm-stub-note-icon{color:var(--info);padding-top:1px}

  /* ─── Detail tabs ──────────────────────────────────────────────── */
  .tm-detail-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:18px}
  .tm-detail-tab{
    display:inline-flex;align-items:center;gap:6px;
    background:none;border:0;padding:10px 14px;margin-bottom:-1px;
    font-family:inherit;font-size:13px;font-weight:540;color:var(--text-secondary);cursor:pointer;
    border-bottom:2px solid transparent;
  }
  .tm-detail-tab:hover{color:var(--text-primary)}
  .tm-detail-tab.active{color:var(--accent-deep);border-bottom-color:var(--accent)}
  .tm-dark .tm-detail-tab.active{color:var(--accent)}
  .tm-detail-tab-count{background:var(--surface-3);padding:0 7px;border-radius:8px;font-size:10.5px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}

  /* ─── Recipient list (detail tab) ──────────────────────────────── */
  .tm-recip-list{display:flex;flex-direction:column;gap:8px}
  .tm-recip-row{
    display:grid;grid-template-columns:42px 1fr 200px;gap:14px;align-items:start;
    background:var(--surface-1);border:1px solid var(--border);border-radius:9px;
    padding:14px 18px;
  }
  .tm-recip-row.downloaded{border-left:3px solid var(--ok)}
  .tm-recip-row.pending{border-left:3px solid var(--wr)}
  .tm-recip-avatar{
    width:38px;height:38px;border-radius:50%;
    background:var(--accent-soft);color:var(--accent-deep);
    font-size:12px;font-weight:600;display:grid;place-items:center;
  }
  .tm-dark .tm-recip-avatar{color:var(--accent)}
  .tm-recip-avatar.external{background:var(--info-soft);color:var(--info)}
  .tm-recip-avatar.internal{background:var(--ok-soft);color:var(--ok)}
  .tm-recip-name-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .tm-recip-name{font-size:14px;font-weight:580;color:var(--text-primary)}
  .tm-recip-org{font-size:12.5px;color:var(--text-secondary)}
  .tm-recip-scope{
    font-size:10px;text-transform:uppercase;letter-spacing:.07em;font-weight:580;
    padding:1px 6px;border-radius:3px;
  }
  .tm-recip-scope.sub{background:var(--accent-soft);color:var(--accent-deep)}
  .tm-dark .tm-recip-scope.sub{color:var(--accent)}
  .tm-recip-scope.external{background:var(--info-soft);color:var(--info)}
  .tm-recip-scope.internal{background:var(--ok-soft);color:var(--ok)}
  .tm-recip-email{font-size:12px;color:var(--text-tertiary);margin-top:2px}
  .tm-recip-share{
    display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;
    background:var(--surface-2);border-radius:6px;
    flex-wrap:wrap;
  }
  .tm-recip-share-label{font-size:11px;color:var(--text-tertiary);font-weight:540;text-transform:uppercase;letter-spacing:.06em;display:inline-flex;align-items:center;gap:4px}
  .tm-recip-share-url{flex:1;min-width:0;font-size:11.5px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:none;padding:0}
  .tm-recip-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
  .tm-recip-status{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:4px;font-size:11.5px;font-weight:560;letter-spacing:.01em}
  .tm-recip-status.downloaded{background:var(--ok-soft);color:var(--ok)}
  .tm-recip-status.pending{background:var(--wr-soft);color:var(--wr)}
  .tm-recip-status-sub{font-size:11px;color:var(--text-secondary)}
  .tm-recip-status-sub.tertiary{color:var(--text-tertiary)}
  .tm-recip-actions{display:flex;gap:4px;margin-top:6px}
  .tm-recip-action{
    width:26px;height:26px;border-radius:5px;
    background:var(--surface-2);border:1px solid var(--border);
    color:var(--text-secondary);cursor:pointer;display:grid;place-items:center;
  }
  .tm-recip-action:hover{background:var(--surface-hover);color:var(--text-primary)}
  .tm-recip-action.danger:hover{background:var(--er-soft);color:var(--er);border-color:transparent}

  /* ─── Documents grid (detail tab) ──────────────────────────────── */
  .tm-docs{background:var(--surface-1);border:1px solid var(--border);border-radius:9px;padding:18px}
  .tm-docs-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:13px;color:var(--text-secondary)}
  .tm-docs-hdr strong{color:var(--text-primary);font-weight:580}
  .tm-docs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
  .tm-doc-tile{
    display:grid;grid-template-columns:48px 1fr 32px;gap:12px;align-items:center;
    background:var(--surface-2);border:1px solid var(--border);border-radius:7px;
    padding:11px 13px;
  }
  .tm-doc-thumb{
    width:48px;height:58px;border-radius:5px;
    background:var(--surface-1);border:1px solid var(--border-strong);
    position:relative;display:grid;place-items:center;color:var(--text-tertiary);
  }
  .tm-doc-thumb.pdf{background:linear-gradient(180deg,#fefaf6 0%,#f5e9dc 100%);border-color:#e5d2ba;color:#9e5b2d}
  .tm-doc-thumb.doc{background:linear-gradient(180deg,#f4f8fe 0%,#dfe9f7 100%);border-color:#c2d2e8;color:#3a6bb0}
  .tm-dark .tm-doc-thumb.pdf{background:#2a1f15;border-color:#4a3722;color:#c48a55}
  .tm-dark .tm-doc-thumb.doc{background:#162235;border-color:#2b4066;color:#7aa0d6}
  .tm-doc-kind{position:absolute;bottom:3px;right:3px;font-size:8px;font-weight:600;letter-spacing:.05em;background:var(--surface-1);padding:1px 4px;border-radius:3px;border:1px solid var(--border)}
  .tm-doc-name{font-size:12.5px;font-weight:540;color:var(--text-primary);line-height:1.3;word-break:break-word}
  .tm-doc-meta{font-size:11px;color:var(--text-tertiary);margin-top:2px}
  .tm-doc-order{font-family:"JetBrains Mono",monospace;font-size:10.5px;color:var(--text-tertiary);text-align:right}

  /* ─── Access log ───────────────────────────────────────────────── */
  .tm-log{background:var(--surface-1);border:1px solid var(--border);border-radius:9px;padding:18px}
  .tm-log-hdr{margin-bottom:14px}
  .tm-log-hdr h3{font-size:14.5px;margin:0 0 4px;font-family:"DM Sans",sans-serif;font-weight:580}
  .tm-log-sub{font-size:12px;color:var(--text-tertiary);line-height:1.5;max-width:640px}
  .tm-log-table{border:1px solid var(--border);border-radius:7px;overflow:hidden}
  .tm-log-table-head{
    display:grid;grid-template-columns:180px 1fr 150px 1fr;gap:14px;
    background:var(--surface-2);padding:9px 14px;
    font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.07em;font-weight:560;
    border-bottom:1px solid var(--border);
  }
  .tm-log-row{
    display:grid;grid-template-columns:180px 1fr 150px 1fr;gap:14px;
    padding:10px 14px;align-items:center;font-size:12.5px;
    border-bottom:1px solid var(--border);
  }
  .tm-log-row:last-child{border-bottom:0}
  .tm-log-when{display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-family:"JetBrains Mono",monospace;font-size:11.5px}
  .tm-log-who{display:flex;align-items:center;gap:8px}
  .tm-log-who-avatar{width:24px;height:24px;border-radius:50%;background:var(--accent-soft);color:var(--accent-deep);font-size:10px;font-weight:600;display:grid;place-items:center}
  .tm-dark .tm-log-who-avatar{color:var(--accent)}
  .tm-log-who-name{font-size:12.5px;font-weight:540}
  .tm-log-who-org{font-size:11px;color:var(--text-tertiary)}
  .tm-log-ip code{background:var(--surface-2);padding:2px 6px;border-radius:3px;font-size:11px}
  .tm-log-ua{color:var(--text-secondary);font-size:12px}
  @media (max-width: 840px){
    .tm-log-table-head,.tm-log-row{grid-template-columns:1fr}
    .tm-log-table-head span:not(:first-child){display:none}
  }

  /* ─── Draft view ───────────────────────────────────────────────── */
  .tm-draft-note{
    display:flex;gap:10px;align-items:flex-start;
    background:var(--wr-soft);border-left:3px solid var(--wr);
    padding:12px 16px;border-radius:7px;margin-bottom:16px;
    font-size:12.5px;color:var(--text-secondary);line-height:1.5;
  }
  .tm-draft-note strong{color:var(--text-primary);font-weight:580}
  .tm-draft-note-icon{color:var(--wr);padding-top:1px;display:flex}
  .tm-draft-form{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:22px 26px;display:flex;flex-direction:column;gap:18px}
  .tm-field{display:flex;flex-direction:column;gap:6px}
  .tm-field-label{font-size:12px;font-weight:580;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;display:inline-flex;align-items:center;gap:5px}
  .tm-input,.tm-textarea{
    background:var(--surface-2);border:1px solid var(--border);border-radius:7px;
    padding:10px 12px;font-family:inherit;font-size:13.5px;color:var(--text-primary);
    outline:none;transition:border-color .12s ease, background .12s ease;
    resize:vertical;
  }
  .tm-input:focus,.tm-textarea:focus{border-color:var(--accent);background:var(--surface-1)}
  .tm-input.sm{padding:7px 10px;font-size:12.5px}
  .tm-input::placeholder,.tm-textarea::placeholder{color:var(--text-tertiary)}
  .tm-draft-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media (max-width: 840px){.tm-draft-meta-grid{grid-template-columns:1fr}}
  .tm-draft-meta-card{background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:14px 16px}
  .tm-draft-meta-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .tm-draft-meta-label{font-size:12px;font-weight:580;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;display:inline-flex;align-items:center;gap:5px}
  .tm-draft-recipient-list,.tm-draft-doc-list{display:flex;flex-direction:column;gap:6px}
  .tm-draft-recipient-row,.tm-draft-doc-row{
    display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;
    background:var(--surface-1);border:1px solid var(--border);border-radius:6px;
    padding:8px 10px;
  }
  .tm-draft-recipient-avatar{
    width:30px;height:30px;border-radius:50%;
    background:var(--accent-soft);color:var(--accent-deep);
    font-size:10.5px;font-weight:600;display:grid;place-items:center;
  }
  .tm-dark .tm-draft-recipient-avatar{color:var(--accent)}
  .tm-draft-recipient-avatar.sub{background:var(--accent-soft)}
  .tm-draft-recipient-avatar.internal{background:var(--ok-soft);color:var(--ok)}
  .tm-draft-recipient-avatar.external{background:var(--info-soft);color:var(--info)}
  .tm-draft-recipient-name{font-size:13px;font-weight:540}
  .tm-draft-recipient-email{font-size:11.5px;color:var(--text-tertiary)}
  .tm-doc-thumb-sm{
    width:30px;height:36px;border-radius:4px;
    background:var(--surface-3);border:1px solid var(--border-strong);
    display:grid;place-items:center;color:var(--text-tertiary);
  }
  .tm-doc-thumb-sm.pdf{background:linear-gradient(180deg,#fefaf6 0%,#f5e9dc 100%);border-color:#e5d2ba;color:#9e5b2d}
  .tm-doc-thumb-sm.doc{background:linear-gradient(180deg,#f4f8fe 0%,#dfe9f7 100%);border-color:#c2d2e8;color:#3a6bb0}
  .tm-dark .tm-doc-thumb-sm.pdf{background:#2a1f15;border-color:#4a3722;color:#c48a55}
  .tm-dark .tm-doc-thumb-sm.doc{background:#162235;border-color:#2b4066;color:#7aa0d6}
  .tm-draft-doc-name{font-size:12.5px;font-weight:540;word-break:break-word}
  .tm-draft-doc-meta{font-size:11px;color:var(--text-tertiary)}
  .tm-draft-summary{
    display:flex;gap:18px;padding:12px 16px;background:var(--surface-2);border-radius:7px;
    font-size:12.5px;color:var(--text-secondary);flex-wrap:wrap;
  }
  .tm-draft-summary-item{display:inline-flex;align-items:center;gap:6px}
  .tm-draft-summary-item strong{color:var(--text-primary);font-weight:580}

  /* ─── Recipient (anonymous download) page ──────────────────────── */
  .tm-recipient-page{max-width:720px;margin:0 auto}
  .tm-recipient-card{
    background:var(--surface-1);border:1px solid var(--border);border-radius:14px;
    padding:36px 40px;box-shadow:var(--shadow-lg);
  }
  .tm-recipient-card-hdr{
    display:flex;justify-content:space-between;align-items:flex-start;
    padding-bottom:22px;border-bottom:1px solid var(--border);margin-bottom:22px;gap:20px;
  }
  .tm-recipient-from-label,.tm-recipient-num-block .tm-recipient-sent{font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.07em;font-weight:560;margin-bottom:3px}
  .tm-recipient-from-name{font-size:16px;font-weight:600;color:var(--text-primary);font-family:"Instrument Sans",serif}
  .tm-recipient-from-sub{font-size:12.5px;color:var(--text-secondary);margin-top:2px}
  .tm-recipient-num-block{text-align:right}
  .tm-recipient-num{font-family:"JetBrains Mono",monospace;font-size:14px;color:var(--text-primary);font-weight:500;margin-bottom:3px}
  .tm-recipient-sent{margin-top:0}
  .tm-recipient-subject{font-size:24px;margin:0 0 14px;letter-spacing:-.02em;line-height:1.25}
  .tm-recipient-msg{font-size:14.5px;color:var(--text-secondary);line-height:1.65;margin-bottom:18px}
  .tm-recipient-signoff{font-size:13.5px;color:var(--text-secondary);font-style:italic;line-height:1.5;margin-bottom:26px}
  .tm-recipient-bundle{
    background:var(--surface-2);border:1px solid var(--border);border-radius:10px;
    padding:18px 20px;margin-bottom:20px;
  }
  .tm-recipient-bundle-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:6px}
  .tm-recipient-bundle-title{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:580;color:var(--text-primary);text-transform:uppercase;letter-spacing:.05em}
  .tm-recipient-bundle-meta{font-size:12px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}
  .tm-recipient-doc-list{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
  .tm-recipient-doc-row{
    display:grid;grid-template-columns:32px 1fr;gap:10px;align-items:center;
    background:var(--surface-1);border:1px solid var(--border);border-radius:6px;
    padding:8px 12px;
  }
  .tm-recipient-doc-name{font-size:12.5px;font-weight:540;color:var(--text-primary);line-height:1.3;word-break:break-word}
  .tm-recipient-doc-meta{font-size:11px;color:var(--text-tertiary)}
  .tm-recipient-download{width:100%;justify-content:center;flex-direction:column;gap:3px;padding:16px 22px}
  .tm-recipient-download-sub{font-size:11.5px;font-weight:500;opacity:.82;letter-spacing:.02em;text-transform:uppercase}
  .tm-recipient-audit{
    display:flex;gap:12px;align-items:flex-start;
    background:var(--ok-soft);border-left:3px solid var(--ok);
    padding:12px 16px;border-radius:7px;
    font-size:12.5px;color:var(--text-secondary);line-height:1.5;
  }
  .tm-recipient-audit strong{color:var(--text-primary);font-weight:580}
  .tm-recipient-audit-icon{color:var(--ok);padding-top:1px;display:flex}
  .tm-recipient-footer{
    margin-top:26px;padding-top:18px;border-top:1px solid var(--border);
    display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;
  }
  .tm-recipient-footer-brand{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text-tertiary);font-weight:540}
  .tm-recipient-footer-sub{font-size:11px;color:var(--text-tertiary)}

  /* ─── Create modal ─────────────────────────────────────────────── */
  .tm-modal-backdrop{
    position:fixed;inset:0;z-index:40;
    background:rgba(20,18,16,.5);backdrop-filter:blur(3px);
    display:grid;place-items:center;padding:24px;
    animation:tm-fade .15s ease;
  }
  @keyframes tm-fade{from{opacity:0}to{opacity:1}}
  .tm-modal{
    background:var(--surface-1);border-radius:13px;box-shadow:var(--shadow-lg);
    width:760px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;
    animation:tm-pop .18s cubic-bezier(.2,.8,.3,1.05);
  }
  @keyframes tm-pop{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
  .tm-modal-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px 14px;border-bottom:1px solid var(--border)}
  .tm-modal-title{font-size:20px;margin:0 0 3px;letter-spacing:-.015em}
  .tm-modal-sub{font-size:12.5px;color:var(--text-tertiary)}
  .tm-modal-sub code{background:var(--surface-3);padding:1px 5px;border-radius:3px;color:var(--text-secondary)}
  .tm-modal-body{padding:18px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}
  .tm-create-section{display:flex;flex-direction:column;gap:8px}
  .tm-create-section-hdr{display:flex;justify-content:space-between;align-items:center}
  .tm-create-section-sub{font-size:11.5px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}
  .tm-create-recipients{display:flex;flex-direction:column;gap:6px}
  .tm-create-recipient-row{display:grid;grid-template-columns:1fr 1.3fr 34px;gap:8px;align-items:center}
  .tm-doc-picker{
    background:var(--surface-2);border:1px solid var(--border);border-radius:8px;
    padding:4px;max-height:260px;overflow-y:auto;
  }
  .tm-doc-folder{border-bottom:1px solid var(--border)}
  .tm-doc-folder:last-child{border-bottom:0}
  .tm-doc-folder-hdr{
    display:flex;align-items:center;gap:8px;width:100%;
    background:none;border:0;padding:8px 10px;
    font-family:inherit;font-size:12.5px;color:var(--text-primary);font-weight:540;
    cursor:pointer;text-align:left;
  }
  .tm-doc-folder-hdr:hover{background:var(--surface-1)}
  .tm-doc-folder-chevron{display:inline-flex;color:var(--text-tertiary);transition:transform .15s ease}
  .tm-doc-folder-chevron[data-open="true"]{transform:rotate(90deg)}
  .tm-doc-folder-name{flex:1}
  .tm-doc-folder-count{background:var(--surface-3);color:var(--text-tertiary);padding:1px 7px;border-radius:8px;font-size:10.5px;font-weight:540;font-variant-numeric:tabular-nums}
  .tm-doc-folder-body{padding:2px 10px 6px 28px}
  .tm-doc-picker-row{
    display:grid;grid-template-columns:16px 1fr auto;gap:10px;align-items:center;
    padding:6px 8px;border-radius:5px;cursor:pointer;
    font-size:12.5px;
  }
  .tm-doc-picker-row:hover{background:var(--surface-1)}
  .tm-doc-picker-row.selected{background:var(--accent-soft)}
  .tm-dark .tm-doc-picker-row.selected{background:rgba(126,114,230,.14)}
  .tm-doc-picker-row input[type="checkbox"]{accent-color:var(--accent);cursor:pointer}
  .tm-doc-picker-name{color:var(--text-primary);word-break:break-word}
  .tm-doc-picker-size{font-size:11px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}
  .tm-modal-ftr{
    display:flex;justify-content:space-between;align-items:center;gap:10px;
    padding:14px 24px;border-top:1px solid var(--border);background:var(--surface-2);
    border-bottom-left-radius:13px;border-bottom-right-radius:13px;flex-wrap:wrap;
  }
  .tm-modal-ftr-left{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-tertiary)}
  .tm-modal-ftr-left svg{color:var(--ok)}
  .tm-modal-ftr-right{display:flex;gap:8px}

  /* ─── Dark mode toggle ─────────────────────────────────────────── */
  .tm-dark-toggle{
    position:fixed;bottom:18px;right:18px;width:38px;height:38px;border-radius:50%;
    background:var(--surface-1);border:1px solid var(--border-strong);color:var(--text-primary);
    font-size:18px;cursor:pointer;z-index:50;box-shadow:var(--shadow-md);
    display:grid;place-items:center;
  }
  .tm-dark-toggle:hover{background:var(--surface-hover)}
`;
