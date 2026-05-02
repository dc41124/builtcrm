import { useState, useMemo } from "react";

// BuiltCRM — T5018 Contractor Payment Slip Generator (Contractor Settings · Tax Forms)
// Step 67 (9-lite.1 #67). Canada Revenue Agency contractor payment reporting.
// Canadian contractors in the construction industry must issue T5018 slips to subs
// paid > $500 CAD in a calendar year and file the summary with CRA. This module
// aggregates payments per sub for a given fiscal year, filters above the $500
// threshold, generates the CRA-conformant XML + per-sub PDF slips, and packages
// them as a downloadable ZIP.
//
// Page lives at: src/app/(portal)/contractor/(global)/settings/tax-forms/t5018/page.tsx
// Canadian-jurisdiction-only — surface is hidden for non-Canadian contractor orgs.
//
// Mode: Require-design-input · Effort: S · Priority: P1
//
// Schema reference (drizzle_schema_phaseX):
//   organizations.tax_jurisdiction        ('CA' | 'US' | …)  — gate visibility
//   organizations.business_number         (BN, e.g. "123456789RT0001")  — required for CRA filing
//   payments + draws + sov_line_items     — source of payment aggregation
//   t5018_filings                         (id, contractorOrgId, fiscalYear, generatedAt, generatedByUserId,
//                                          xmlChecksum, slipCount, totalAmountCents, fileBundleUri, status)
//   t5018_filing_slips                    (id, filingId, subOrgId, totalAmountCents, slipPdfUri)
//
// Audit event: tax.t5018.generated  { fiscalYear, slipCount, totalAmountCents, contractorOrgId }

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Slip eligibility status colours ────────────────────────────────────────
const slipStatusColors = {
  eligible:        { solid: "#2d8a5e", soft: "rgba(45,138,94,.12)",  label: "Eligible" },
  below_threshold: { solid: "#9c958a", soft: "rgba(156,149,138,.12)",label: "Below $500" },
  missing_data:    { solid: "#c93b3b", soft: "rgba(201,59,59,.12)",  label: "Missing data" },
  generated:       { solid: "#3178b9", soft: "rgba(49,120,185,.12)", label: "Slip ready" },
};

// ─── Filing status colours (header banner) ──────────────────────────────────
const filingStatusColors = {
  draft:     { solid: "#9c958a", soft: "rgba(156,149,138,.12)", label: "Not yet generated" },
  ready:     { solid: "#5b4fc7", soft: "rgba(91,79,199,.12)",   label: "Ready to generate" },
  generated: { solid: "#2d8a5e", soft: "rgba(45,138,94,.12)",   label: "Generated" },
  filed:     { solid: "#3178b9", soft: "rgba(49,120,185,.12)",  label: "Filed with CRA" },
};

// ─── Contractor org (Canadian jurisdiction — gates the whole surface) ───────
const contractorOrg = {
  legalName: "Hammerline Build Inc.",
  displayName: "Hammerline Build",
  bn: "871234567RT0001",
  craReceiverCode: "MM555444",
  addr1: "2410 boulevard Industriel",
  city: "Laval",
  province: "QC",
  postal: "H7L 4S1",
  country: "Canada",
  jurisdiction: "CA",
  filingContact: "Rachel Owens",
  filingEmail: "rachel.owens@hammerline.ca",
};

// ─── 2025 sub payment data (current fiscal year — not yet generated) ────────
// 15 subs total: 12 above $500 threshold, 3 below.
// 1 sub flagged with missing BN/SIN (cannot include in slip until resolved).
const subs2025 = [
  { id: "sub-1",  legalName: "Coastal Electric Ltée",     displayName: "Coastal Electric",     bn: "841230472RT0001", addr: "780 rue Saint-Antoine O · Montréal, QC · H3C 1A9", paymentCount: 14, totalCents: 28475000, status: "eligible" },
  { id: "sub-2",  legalName: "Northwest HVAC Inc.",        displayName: "Northwest HVAC",       bn: "120875639RT0001", addr: "1455 boulevard Curé-Labelle · Laval, QC · H7V 2W4", paymentCount: 11, totalCents: 41200000, status: "eligible" },
  { id: "sub-3",  legalName: "Steel Frame Co. Ltd.",       displayName: "Steel Frame Co.",      bn: "789456123RT0001", addr: "92 rue Industrielle · Saint-Hubert, QC · J3Y 5T1",  paymentCount: 9,  totalCents: 67950000, status: "eligible" },
  { id: "sub-4",  legalName: "Summit Drywall Ltée",        displayName: "Summit Drywall",       bn: "456789012RT0001", addr: "330 rue de l'Industrie · Repentigny, QC · J5Z 4M1", paymentCount: 12, totalCents: 18900000, status: "eligible" },
  { id: "sub-5",  legalName: "Ramirez Concrete Inc.",      displayName: "Ramirez Concrete",     bn: "302487611RT0001", addr: "5610 chemin de Chambly · Saint-Hubert, QC · J3Y 3R3", paymentCount: 8,  totalCents: 53400000, status: "eligible" },
  { id: "sub-6",  legalName: "Boréal Plumbing Ltée",       displayName: "Boréal Plumbing",      bn: "991284673RT0001", addr: "12 rue Principale · Boucherville, QC · J4B 1E2",    paymentCount: 10, totalCents: 22150000, status: "eligible" },
  { id: "sub-7",  legalName: "Alpine Glass & Glazing",     displayName: "Alpine Glass",         bn: "557839102RT0001", addr: "4180 rue Saint-Patrick · Lachine, QC · H8N 1V2",    paymentCount: 6,  totalCents: 15800000, status: "eligible" },
  { id: "sub-8",  legalName: "Reliance Roofing Ltée",      displayName: "Reliance Roofing",     bn: "703129845RT0001", addr: "27 boulevard des Grives · Laval, QC · H7K 3M3",     paymentCount: 5,  totalCents: 9870000,  status: "eligible" },
  { id: "sub-9",  legalName: "Granite Tile & Stone Inc.",  displayName: "Granite Tile",         bn: "418276309RT0001", addr: "905 rue de la Commune · Montréal, QC · H2Y 3M4",    paymentCount: 7,  totalCents: 12450000, status: "eligible" },
  { id: "sub-10", legalName: "Verde Landscape Co.",        displayName: "Verde Landscape",      bn: "624957831RT0001", addr: "1820 chemin Filion · Saint-Eustache, QC · J7P 4H2", paymentCount: 4,  totalCents: 8200000,  status: "eligible" },
  { id: "sub-11", legalName: "Kessler Insulation Inc.",    displayName: "Kessler Insulation",   bn: "839204715RT0001", addr: "33 rue de l'Aqueduc · Brossard, QC · J4Y 1Z3",      paymentCount: 4,  totalCents: 6740000,  status: "eligible" },
  { id: "sub-12", legalName: "Pinnacle Painting Ltée",     displayName: "Pinnacle Painting",    bn: "267148093RT0001", addr: "501 rue Sherbrooke E · Montréal, QC · H2L 1K1",     paymentCount: 6,  totalCents: 5320000,  status: "eligible" },
  // Below-threshold subs — paid in 2025 but < $500. Not included in slip generation.
  { id: "sub-13", legalName: "Atlas Hardware Supply",      displayName: "Atlas Hardware",       bn: "119837426RT0001", addr: "88 rue Notre-Dame · Repentigny, QC · J6A 2R4",      paymentCount: 2,  totalCents: 41200,    status: "below_threshold" },
  { id: "sub-14", legalName: "Riverside Demolition Inc.",  displayName: "Riverside Demolition", bn: "550321987RT0001", addr: "740 boulevard Industriel · Laval, QC · H7L 4N3",    paymentCount: 1,  totalCents: 38000,    status: "below_threshold" },
  // Missing-data sub — paid > $500 but BN unknown. Blocks generation until resolved.
  { id: "sub-15", legalName: "Fortune Excavation Ltée",    displayName: "Fortune Excavation",   bn: null,              addr: "210 rue de l'Industrie · Boucherville, QC · J4B 7K1", paymentCount: 3, totalCents: 7440000, status: "missing_data" },
];

// ─── 2024 sub payment data (already filed with CRA) ────────────────────────
const subs2024 = [
  { id: "sub-1",  legalName: "Coastal Electric Ltée",     displayName: "Coastal Electric",     bn: "841230472RT0001", addr: "780 rue Saint-Antoine O · Montréal, QC · H3C 1A9", paymentCount: 18, totalCents: 36120000, status: "generated" },
  { id: "sub-2",  legalName: "Northwest HVAC Inc.",        displayName: "Northwest HVAC",       bn: "120875639RT0001", addr: "1455 boulevard Curé-Labelle · Laval, QC · H7V 2W4", paymentCount: 14, totalCents: 47800000, status: "generated" },
  { id: "sub-3",  legalName: "Steel Frame Co. Ltd.",       displayName: "Steel Frame Co.",      bn: "789456123RT0001", addr: "92 rue Industrielle · Saint-Hubert, QC · J3Y 5T1",  paymentCount: 11, totalCents: 71200000, status: "generated" },
  { id: "sub-4",  legalName: "Summit Drywall Ltée",        displayName: "Summit Drywall",       bn: "456789012RT0001", addr: "330 rue de l'Industrie · Repentigny, QC · J5Z 4M1", paymentCount: 13, totalCents: 21450000, status: "generated" },
  { id: "sub-5",  legalName: "Ramirez Concrete Inc.",      displayName: "Ramirez Concrete",     bn: "302487611RT0001", addr: "5610 chemin de Chambly · Saint-Hubert, QC · J3Y 3R3", paymentCount: 10, totalCents: 58900000, status: "generated" },
  { id: "sub-6",  legalName: "Boréal Plumbing Ltée",       displayName: "Boréal Plumbing",      bn: "991284673RT0001", addr: "12 rue Principale · Boucherville, QC · J4B 1E2",    paymentCount: 9,  totalCents: 19400000, status: "generated" },
  { id: "sub-9",  legalName: "Granite Tile & Stone Inc.",  displayName: "Granite Tile",         bn: "418276309RT0001", addr: "905 rue de la Commune · Montréal, QC · H2Y 3M4",    paymentCount: 8,  totalCents: 14250000, status: "generated" },
  { id: "sub-12", legalName: "Pinnacle Painting Ltée",     displayName: "Pinnacle Painting",    bn: "267148093RT0001", addr: "501 rue Sherbrooke E · Montréal, QC · H2L 1K1",     paymentCount: 7,  totalCents: 6890000,  status: "generated" },
];

// ─── Filing history (the audit / activity timeline) ─────────────────────────
const filingHistory = [
  { id: "fil-2024", fiscalYear: 2024, status: "filed",     generatedAt: "2025-02-12 09:14",  generatedBy: "Rachel Owens",  slipCount: 8,  totalCents: 276010000, xmlChecksum: "sha256:7c4d…b912", filedAt: "2025-02-19 11:02", craConfirmation: "CRA-T5018-2024-872614" },
  { id: "fil-2023", fiscalYear: 2023, status: "filed",     generatedAt: "2024-02-09 14:48",  generatedBy: "Rachel Owens",  slipCount: 6,  totalCents: 198450000, xmlChecksum: "sha256:9a1f…cd3e", filedAt: "2024-02-16 10:22", craConfirmation: "CRA-T5018-2023-654982" },
];

// ─── Activity feed (admin-side audit log) ───────────────────────────────────
const auditFeed = [
  { who: "Rachel Owens", action: "previewed slip preview",            target: "fiscal year 2025", when: "Apr 24 · 4:12 PM", kind: "preview" },
  { who: "Rachel Owens", action: "flagged missing BN on Fortune Excavation", target: "Resolution required before generation", when: "Apr 24 · 4:11 PM", kind: "warn" },
  { who: "System",       action: "aggregated 99 payments across 15 subs",     target: "for fiscal year 2025",                   when: "Apr 24 · 4:10 PM", kind: "aggregate" },
  { who: "Rachel Owens", action: "generated T5018 package",            target: "Fiscal year 2024 · 8 slips · $2,760,100.00",  when: "Feb 12 · 9:14 AM", kind: "generate" },
  { who: "Rachel Owens", action: "filed T5018 with CRA",                target: "Fiscal year 2024 · CRA-T5018-2024-872614",     when: "Feb 19 · 11:02 AM", kind: "file" },
  { who: "System",       action: "scheduled annual reminder",          target: "Generate FY2025 by Feb 28, 2026",              when: "Feb 19 · 11:02 AM", kind: "reminder" },
];

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS — inline SVG only (no emoji per design system)
// ═══════════════════════════════════════════════════════════════════════════
const I = {
  back:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/></svg>,
  building: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h0M9 13h0M9 17h0"/></svg>,
  check:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  chevD:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  chevR:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  eye:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  external: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  file:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  flag:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  filter:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  info:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  leaf:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-4 3-9 8-11 1 2 2 5 2 7a4 4 0 0 0 4 4c2 0 4-1 5-2-1 5-6 9-12 9z"/><path d="M2 22s4-2 9-7"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  lock:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  moon:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  package:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  plus:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  search:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  shield:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  sun:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  warn:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  x:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  zap:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
};

// ─── Logo mark — cascading rectangles (per design system spec) ─────────────
const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="6" y="6" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity=".6" />
    <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" opacity=".28" />
  </svg>
);

// ─── Format helpers ─────────────────────────────────────────────────────────
const formatCAD = (cents) => {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(dollars);
};

const formatCADCompact = (cents) => {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000)     return `$${(dollars / 1_000).toFixed(1)}K`;
  return formatCAD(cents);
};

const formatBN = (bn) => {
  if (!bn) return "—";
  // Canadian Business Number format: 9 digits + RT + 4 digits = 123456789RT0001
  if (bn.length === 15) return `${bn.slice(0, 9)} ${bn.slice(9, 11)}${bn.slice(11)}`;
  return bn;
};

const initials = (name) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

// ─── Sidebar nav (contractor portal, Settings active, T5018 sub-active) ────
const sidebarNav = [
  { section: "Overview", items: [{ label: "Dashboard" }] },
  { section: "Riverside Office Complex", items: [
    { label: "Project Home" }, { label: "RFIs / Issues", badge: 3 },
    { label: "Change Orders", badge: 1, badgeKind: "warn" },
    { label: "Approvals", badge: 2 }, { label: "Selections" },
    { label: "Billing / Draws" }, { label: "Compliance" },
    { label: "Upload Requests" }, { label: "Documents" },
    { label: "Schedule" }, { label: "Messages", badge: 4 }, { label: "Team" },
  ]},
  { section: "Account", items: [{ label: "Settings", active: true }] },
];

// ─── Settings cross-ref strip (top of every settings page) ─────────────────
const settingsCrossRefs = [
  { id: "organization",  label: "Organization" },
  { id: "team",          label: "Team & roles" },
  { id: "billing",       label: "Plan & billing" },
  { id: "data",          label: "Data" },
  { id: "integrations",  label: "Integrations" },
  { id: "tax",           label: "Tax forms",   active: true,  pillText: "CA only", pillKind: "info" },
  { id: "orgsec",        label: "Org security" },
];

// ─── Tax-forms left rail (inside the Tax Forms section) ────────────────────
const taxFormsNav = [
  { id: "t5018",          label: "T5018 — Contractor payment slips",   active: true,  available: true },
  { id: "gst-hst",        label: "GST/HST registration & remittance",   available: false, soon: "Phase 9.2" },
  { id: "qst",            label: "QST registration (Quebec)",            available: false, soon: "Phase 9.2" },
  { id: "yearend-summary", label: "Year-end financial summary",          available: false, soon: "Phase 9.3" },
];

// ═══════════════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ─── Theme + view ────────────────────────────────────────────────────
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("workspace");          // workspace | confirm | generating | success
  const [fiscalYear, setFiscalYear] = useState(2025);     // 2024 (filed) | 2025 (current)
  const [filter, setFilter] = useState("all");            // all | eligible | below | missing
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("total");        // name | total | count
  const [sortDir, setSortDir] = useState("desc");
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [showSlipDetail, setShowSlipDetail] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  // Per-session generation: starts in 2025-not-yet-generated state. Once generated,
  // 2025 transitions to "generated" until the user resets the demo.
  const [generated2025, setGenerated2025] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────
  const isCanadian = contractorOrg.jurisdiction === "CA";

  const subs = fiscalYear === 2025 ? subs2025 : subs2024;

  const filteredSubs = useMemo(() => {
    let list = [...subs];
    if (filter === "eligible") list = list.filter(s => s.status === "eligible" || s.status === "generated");
    if (filter === "below")    list = list.filter(s => s.status === "below_threshold");
    if (filter === "missing")  list = list.filter(s => s.status === "missing_data");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.legalName.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        (s.bn || "").toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name")  return dir * a.legalName.localeCompare(b.legalName);
      if (sortKey === "count") return dir * (a.paymentCount - b.paymentCount);
      return dir * (a.totalCents - b.totalCents);
    });
    return list;
  }, [subs, filter, search, sortKey, sortDir]);

  const eligibleSubs    = subs.filter(s => s.status === "eligible" || s.status === "generated");
  const belowSubs       = subs.filter(s => s.status === "below_threshold");
  const missingSubs     = subs.filter(s => s.status === "missing_data");
  const totalEligibleCents = eligibleSubs.reduce((acc, s) => acc + s.totalCents, 0);
  const totalAllCents      = subs.reduce((acc, s) => acc + s.totalCents, 0);

  const yearStatus =
    fiscalYear === 2024 ? "filed" :
    generated2025         ? "generated" :
    missingSubs.length > 0 ? "ready" :   // gating: missing data blocks "ready"
    eligibleSubs.length > 0 ? "ready" :
    "draft";

  const blockingIssues = [
    ...(missingSubs.length > 0
      ? [{ kind: "blocker", text: `${missingSubs.length} sub${missingSubs.length === 1 ? "" : "s"} missing Business Number — resolve before generating`, action: "Resolve" }]
      : []),
  ];
  const advisoryIssues = [
    ...(belowSubs.length > 0
      ? [{ kind: "advisory", text: `${belowSubs.length} sub${belowSubs.length === 1 ? "" : "s"} paid below the $500 threshold — excluded by CRA rule, no slip generated` }]
      : []),
  ];

  const filingDeadline = `Feb 28, ${fiscalYear + 1}`;
  const priorFiling = filingHistory.find(f => f.fiscalYear === fiscalYear);

  // ─── Selected sub for detail modal ───────────────────────────────────
  const selectedSub = subs.find(s => s.id === selectedSubId);

  // ─── Generate handler ────────────────────────────────────────────────
  const canGenerate = isCanadian && eligibleSubs.length > 0 && missingSubs.length === 0 && !generated2025 && fiscalYear === 2025;

  const onConfirmGenerate = () => {
    setView("generating");
    // Simulate generation latency for the demo.
    setTimeout(() => {
      setGenerated2025(true);
      setView("success");
    }, 1800);
  };

  // ─── Inline CSS ──────────────────────────────────────────────────────
  const css = `
:root{
  --bg:#eef0f3; --s1:#ffffff; --s2:#f3f4f6; --s3:#e2e5e9; --s4:#d1d5db;
  --hover:#f5f6f8; --active:#e5e7eb;
  --t1:#1a1714; --t2:#6b655b; --t3:#9c958a;
  --accent:#5b4fc7; --accent-h:#4f44b3; --accent-soft:#eeedfb; --accent-text:#4a3fb0;
  --green:#2d8a5e; --green-soft:#edf7f1; --green-text:#1e6b46;
  --amber:#c17a1a; --amber-soft:#fdf4e6; --amber-text:#96600f;
  --red:#c93b3b; --red-soft:#fdeaea; --red-text:#a52e2e;
  --info:#3178b9; --info-soft:#e8f1fa; --info-text:#276299;
  --sb-bg:#ffffff; --sb-hover:#f5f6f8; --sb-active:#eef0f3; --sb-border:#e8eaee;
  --sb-section:#8b919a; --sb-item:#5a6170;
  --shadow-sm:0 1px 2px rgba(15,17,22,.06);
  --shadow-md:0 4px 12px rgba(15,17,22,.08);
  --shadow-lg:0 12px 32px rgba(15,17,22,.14);
  --radius-sm:6px; --radius-md:10px; --radius-lg:14px; --radius-xl:18px;
  --font-d:'DM Sans',system-ui,sans-serif;
  --font-b:'Instrument Sans',system-ui,sans-serif;
  --font-m:'JetBrains Mono',ui-monospace,monospace;
}
.t5-dark{
  --bg:#15181d; --s1:#1c2027; --s2:#22272f; --s3:#2c323b; --s4:#3a4150;
  --hover:#262b34; --active:#2f343d;
  --t1:#f0eee9; --t2:#a8a298; --t3:#6e6960;
  --accent:#8278e8; --accent-h:#9b91f0; --accent-soft:rgba(130,120,232,.16); --accent-text:#b3a9ff;
  --green-soft:rgba(45,138,94,.18); --amber-soft:rgba(193,122,26,.18);
  --red-soft:rgba(201,59,59,.18); --info-soft:rgba(49,120,185,.18); --accent-soft:rgba(130,120,232,.16);
  --sb-bg:#1c2027; --sb-hover:#262b34; --sb-active:#2c323b; --sb-border:#2a2f38;
  --sb-section:#777d87; --sb-item:#a8a298;
  --shadow-sm:0 1px 2px rgba(0,0,0,.32);
  --shadow-md:0 4px 14px rgba(0,0,0,.40);
  --shadow-lg:0 14px 38px rgba(0,0,0,.48);
}

*{box-sizing:border-box}
.t5-root{font-family:var(--font-b);font-weight:520;color:var(--t1);background:var(--bg);min-height:100vh;line-height:1.45;letter-spacing:-.005em}

/* ── Topbar ───────────────────────────────────────────────────── */
.t5-topbar{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:18px;height:56px;padding:0 24px;background:var(--s1);border-bottom:1px solid var(--s3)}
.t5-brand{display:flex;align-items:center;gap:9px;color:var(--accent)}
.t5-brand-name{font-family:var(--font-d);font-weight:780;font-size:15px;letter-spacing:-.015em;color:var(--t1)}
.t5-crumbs{display:flex;align-items:center;gap:8px;color:var(--t2);font-size:13px}
.t5-crumbs strong{font-family:var(--font-d);font-weight:680;color:var(--t1);letter-spacing:-.01em}
.t5-top-spacer{flex:1}
.t5-icon-btn{height:32px;width:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--t2);cursor:pointer;transition:all .15s}
.t5-icon-btn:hover{background:var(--hover);color:var(--t1);border-color:var(--s3)}
.t5-avatar{height:32px;width:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-h));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-d);font-weight:700;font-size:12px;letter-spacing:.02em}

/* ── Layout ───────────────────────────────────────────────────── */
.t5-layout{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 56px)}

/* ── Sidebar ──────────────────────────────────────────────────── */
.t5-sb{background:var(--sb-bg);border-right:1px solid var(--sb-border);padding:20px 12px;overflow-y:auto}
.t5-org{padding:8px 10px 14px;border-bottom:1px solid var(--sb-border);margin-bottom:14px}
.t5-org-name{font-family:var(--font-d);font-weight:720;font-size:13px;color:var(--t1);letter-spacing:-.005em}
.t5-org-meta{font-size:11.5px;color:var(--t3);margin-top:3px}
.t5-section-label{font-size:10.5px;font-weight:680;text-transform:uppercase;letter-spacing:.06em;color:var(--sb-section);padding:14px 10px 6px}
.t5-nav-item{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:7px;color:var(--sb-item);font-size:13px;cursor:pointer;transition:background .12s,color .12s;font-weight:540}
.t5-nav-item:hover{background:var(--sb-hover);color:var(--t1)}
.t5-nav-item.active{background:var(--sb-active);color:var(--t1);font-weight:640}
.t5-nav-badge{margin-left:auto;font-family:var(--font-d);font-weight:700;font-size:10.5px;padding:1px 7px;border-radius:9px;background:var(--s2);color:var(--t2)}
.t5-nav-badge.warn{background:var(--amber-soft);color:var(--amber-text)}

/* ── Main scroll region ───────────────────────────────────────── */
.t5-main{padding:24px 32px 80px;max-width:1480px;margin:0 auto;width:100%;animation:fadeUp .45s cubic-bezier(.2,.7,.2,1) both}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* ── Settings cross-ref strip ─────────────────────────────────── */
.t5-crossref{display:flex;align-items:center;gap:6px;padding:10px;border-radius:var(--radius-md);background:var(--s1);border:1px solid var(--s3);margin-bottom:18px;overflow-x:auto;box-shadow:var(--shadow-sm)}
.t5-crossref-item{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:7px;font-size:12.5px;color:var(--t2);cursor:pointer;white-space:nowrap;transition:all .12s;font-weight:560}
.t5-crossref-item:hover{background:var(--hover);color:var(--t1)}
.t5-crossref-item.active{background:var(--accent-soft);color:var(--accent-text);font-weight:660}
.t5-crossref-pill{font-family:var(--font-d);font-size:9.5px;font-weight:720;letter-spacing:.04em;padding:1.5px 6px;border-radius:8px;text-transform:uppercase}
.t5-crossref-pill.info{background:var(--info-soft);color:var(--info-text)}

/* ── Page header ──────────────────────────────────────────────── */
.t5-pagehead{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:20px}
.t5-pagehead-left h1{font-family:var(--font-d);font-weight:820;font-size:26px;letter-spacing:-.024em;color:var(--t1);margin:0 0 4px}
.t5-pagehead-left p{color:var(--t2);font-size:14px;margin:0;max-width:680px}
.t5-pagehead-right{display:flex;align-items:center;gap:10px;flex-shrink:0}

/* ── Year selector ────────────────────────────────────────────── */
.t5-year-pick{display:inline-flex;border:1px solid var(--s3);border-radius:8px;background:var(--s1);overflow:hidden;box-shadow:var(--shadow-sm)}
.t5-year-pick button{font-family:var(--font-d);font-weight:660;font-size:12.5px;padding:7px 12px;border:0;background:transparent;color:var(--t2);cursor:pointer;letter-spacing:.005em;transition:all .12s}
.t5-year-pick button:hover{background:var(--hover);color:var(--t1)}
.t5-year-pick button.active{background:var(--accent);color:#fff}
.t5-year-pick-label{font-size:9.5px;font-weight:600;display:block;opacity:.78;margin-top:2px;letter-spacing:.05em;text-transform:uppercase}

/* ── Buttons ──────────────────────────────────────────────────── */
.t5-btn{font-family:var(--font-d);font-weight:640;font-size:13px;padding:9px 16px;border-radius:8px;border:1px solid transparent;background:transparent;cursor:pointer;display:inline-flex;align-items:center;gap:7px;letter-spacing:-.005em;transition:all .15s}
.t5-btn-primary{background:var(--accent);color:#fff}
.t5-btn-primary:hover:not(:disabled){background:var(--accent-h);box-shadow:var(--shadow-md)}
.t5-btn-primary:disabled{opacity:.45;cursor:not-allowed}
.t5-btn-ghost{background:transparent;color:var(--t2);border-color:var(--s3)}
.t5-btn-ghost:hover{background:var(--hover);color:var(--t1)}
.t5-btn-soft{background:var(--accent-soft);color:var(--accent-text)}
.t5-btn-soft:hover{background:var(--accent);color:#fff}
.t5-btn-danger-ghost{color:var(--red-text);border-color:transparent}
.t5-btn-danger-ghost:hover{background:var(--red-soft)}

/* ── Status banner ────────────────────────────────────────────── */
.t5-banner{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:var(--radius-md);background:var(--s1);border:1px solid var(--s3);margin-bottom:18px;box-shadow:var(--shadow-sm)}
.t5-banner-icon{height:36px;width:36px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.t5-banner-icon.green{background:var(--green-soft);color:var(--green-text)}
.t5-banner-icon.amber{background:var(--amber-soft);color:var(--amber-text)}
.t5-banner-icon.red{background:var(--red-soft);color:var(--red-text)}
.t5-banner-title{font-family:var(--font-d);font-weight:720;font-size:13.5px;color:var(--t1);letter-spacing:-.005em}
.t5-banner-meta{font-size:12.5px;color:var(--t2);margin-top:2px}
.t5-banner-cta{margin-left:auto}

/* ── KPI strip ────────────────────────────────────────────────── */
.t5-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.t5-kpi-cell{padding:14px 16px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--radius-md);box-shadow:var(--shadow-sm)}
.t5-kpi-label{font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}
.t5-kpi-value{font-family:var(--font-d);font-size:24px;font-weight:820;color:var(--t1);margin-top:4px;letter-spacing:-.025em;line-height:1.05}
.t5-kpi-hint{font-size:11.5px;color:var(--t2);margin-top:3px}
.t5-kpi-hint .ok{color:var(--green-text);font-weight:660}
.t5-kpi-hint .warn{color:var(--amber-text);font-weight:660}
.t5-kpi-hint .err{color:var(--red-text);font-weight:660}

/* ── Two-column workspace ─────────────────────────────────────── */
.t5-grid-2{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;margin-bottom:18px}
.t5-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);overflow:hidden}
.t5-card-head{padding:14px 18px;border-bottom:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between;gap:14px}
.t5-card-title{font-family:var(--font-d);font-weight:720;font-size:14px;letter-spacing:-.008em;color:var(--t1)}
.t5-card-sub{font-size:12px;color:var(--t2);margin-top:2px}
.t5-card-body{padding:16px 18px}

/* ── Filing summary card ──────────────────────────────────────── */
.t5-summary-row{display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px dashed var(--s3)}
.t5-summary-row:last-child{border-bottom:0}
.t5-summary-label{font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;width:128px;flex-shrink:0;padding-top:2px}
.t5-summary-val{font-size:13px;color:var(--t1);font-weight:560}
.t5-summary-val.mono{font-family:var(--font-m);font-size:12.5px;letter-spacing:-.01em}
.t5-summary-meta{font-size:11.5px;color:var(--t2);margin-top:1px}

/* ── Generation panel ─────────────────────────────────────────── */
.t5-genpanel{padding:0}
.t5-gen-status{padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.t5-gen-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;font-family:var(--font-d);font-weight:700;font-size:11px;letter-spacing:.03em;text-transform:uppercase}
.t5-gen-headline{font-family:var(--font-d);font-weight:720;font-size:16px;color:var(--t1);letter-spacing:-.012em;margin-top:4px}
.t5-gen-help{font-size:12.5px;color:var(--t2);max-width:280px}
.t5-gen-issues{padding:12px 18px;border-top:1px solid var(--s3);background:var(--s2)}
.t5-issue{display:flex;align-items:flex-start;gap:9px;padding:7px 0;font-size:12.5px}
.t5-issue:not(:first-child){border-top:1px dashed var(--s3)}
.t5-issue-icon{flex-shrink:0;height:18px;width:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
.t5-issue-icon.blocker{background:var(--red-soft);color:var(--red-text)}
.t5-issue-icon.advisory{background:var(--amber-soft);color:var(--amber-text)}
.t5-issue-text{color:var(--t1);font-weight:540;flex:1}
.t5-issue-action{font-family:var(--font-d);font-weight:640;font-size:11.5px;color:var(--accent-text);background:transparent;border:0;cursor:pointer}
.t5-issue-action:hover{color:var(--accent-h)}
.t5-gen-actions{padding:14px 18px;border-top:1px solid var(--s3);display:flex;flex-direction:column;gap:8px}
.t5-gen-cta{justify-content:center;padding:11px 18px;font-size:13.5px;font-weight:680}
.t5-gen-secondary{display:flex;gap:8px}
.t5-gen-secondary .t5-btn{flex:1;justify-content:center}

/* ── Slip preview table ───────────────────────────────────────── */
.t5-toolbar{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--s3);background:var(--s2)}
.t5-search{display:flex;align-items:center;gap:7px;flex:1;max-width:340px;padding:6px 10px;border-radius:7px;background:var(--s1);border:1px solid var(--s3)}
.t5-search input{border:0;background:transparent;flex:1;outline:none;font-family:var(--font-b);font-size:13px;color:var(--t1)}
.t5-tabbar{display:inline-flex;background:var(--s1);border:1px solid var(--s3);border-radius:7px;padding:2px;gap:1px}
.t5-tab{font-family:var(--font-d);font-weight:600;font-size:12px;padding:5px 11px;border-radius:5px;border:0;background:transparent;color:var(--t2);cursor:pointer;letter-spacing:-.002em}
.t5-tab:hover{color:var(--t1)}
.t5-tab.active{background:var(--accent-soft);color:var(--accent-text);font-weight:680}
.t5-toolbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;color:var(--t2);font-size:12px;font-weight:560}
.t5-toolbar-right strong{color:var(--t1);font-family:var(--font-d);font-weight:720}

.t5-table{width:100%;border-collapse:collapse}
.t5-table thead th{font-family:var(--font-d);font-weight:680;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);text-align:left;padding:10px 14px;border-bottom:1px solid var(--s3);background:var(--s1);position:sticky;top:0;z-index:1}
.t5-table thead th.sortable{cursor:pointer;user-select:none}
.t5-table thead th.sortable:hover{color:var(--t1)}
.t5-table thead th.right{text-align:right}
.t5-table tbody tr{transition:background .12s;cursor:pointer}
.t5-table tbody tr:hover{background:var(--hover)}
.t5-table tbody tr.muted{opacity:.65}
.t5-table td{padding:11px 14px;border-bottom:1px solid var(--s3);font-size:13px;color:var(--t1);vertical-align:top}
.t5-table td.right{text-align:right;font-family:var(--font-d);font-weight:680;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.t5-sub-cell{display:flex;align-items:center;gap:11px}
.t5-sub-avatar{height:30px;width:30px;border-radius:8px;background:var(--accent-soft);color:var(--accent-text);display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-d);font-weight:720;font-size:11px;flex-shrink:0}
.t5-sub-name{font-weight:600;color:var(--t1)}
.t5-sub-legal{font-size:11.5px;color:var(--t2);margin-top:1px}
.t5-bn{font-family:var(--font-m);font-size:11.5px;color:var(--t2);letter-spacing:-.01em}
.t5-bn.missing{color:var(--red-text);font-weight:600}

.t5-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-family:var(--font-d);font-weight:700;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1.2}

/* ── Audit / activity drawer + history ────────────────────────── */
.t5-history-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--s3)}
.t5-history-row:last-child{border-bottom:0}
.t5-history-yr{font-family:var(--font-d);font-weight:780;font-size:18px;color:var(--t1);min-width:64px;letter-spacing:-.022em}
.t5-history-meta{flex:1;display:flex;flex-direction:column;gap:2px}
.t5-history-title{font-size:13px;color:var(--t1);font-weight:600}
.t5-history-sub{font-size:11.5px;color:var(--t2);font-family:var(--font-m);letter-spacing:-.005em}
.t5-history-actions{display:flex;align-items:center;gap:6px}

.t5-feed{display:flex;flex-direction:column}
.t5-feed-row{display:flex;gap:11px;padding:10px 0;border-bottom:1px dashed var(--s3)}
.t5-feed-row:last-child{border-bottom:0}
.t5-feed-icon{flex-shrink:0;height:26px;width:26px;border-radius:7px;background:var(--s2);color:var(--t2);display:inline-flex;align-items:center;justify-content:center}
.t5-feed-icon.warn{background:var(--amber-soft);color:var(--amber-text)}
.t5-feed-icon.preview{background:var(--info-soft);color:var(--info-text)}
.t5-feed-icon.aggregate{background:var(--accent-soft);color:var(--accent-text)}
.t5-feed-icon.generate{background:var(--green-soft);color:var(--green-text)}
.t5-feed-icon.file{background:var(--info-soft);color:var(--info-text)}
.t5-feed-icon.reminder{background:var(--s2);color:var(--t2)}
.t5-feed-text{flex:1;font-size:12.5px;color:var(--t1);line-height:1.5}
.t5-feed-text strong{font-weight:660}
.t5-feed-text .target{color:var(--t2);font-family:var(--font-m);font-size:11.5px}
.t5-feed-when{font-size:11px;color:var(--t3);margin-left:auto;font-family:var(--font-m);letter-spacing:-.005em;flex-shrink:0;margin-top:2px}

/* ── Modal ────────────────────────────────────────────────────── */
.t5-modal-bg{position:fixed;inset:0;background:rgba(15,17,22,.45);backdrop-filter:blur(3px);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.t5-modal{background:var(--s1);border:1px solid var(--s3);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:680px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;animation:popUp .22s cubic-bezier(.2,.7,.2,1) both}
.t5-modal.wide{max-width:780px}
@keyframes popUp{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
.t5-modal-head{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between;gap:14px}
.t5-modal-title{font-family:var(--font-d);font-weight:760;font-size:16px;letter-spacing:-.014em;color:var(--t1)}
.t5-modal-sub{font-size:12.5px;color:var(--t2);margin-top:2px}
.t5-modal-body{padding:22px;overflow-y:auto;flex:1}
.t5-modal-foot{padding:14px 22px;border-top:1px solid var(--s3);display:flex;align-items:center;justify-content:flex-end;gap:9px;background:var(--s2)}

/* ── Slip preview (CRA T5018 form-shape) ──────────────────────── */
.t5-slip{border:2px solid var(--t1);border-radius:8px;padding:18px;font-family:var(--font-m);font-size:12px;background:#fcfcfa;color:#222}
.t5-dark .t5-slip{background:#0d0f12;color:#e8e6e1;border-color:#7a766f}
.t5-slip-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5px solid currentColor;padding-bottom:10px;margin-bottom:12px}
.t5-slip-head-left h3{font-family:var(--font-d);font-weight:780;font-size:16px;letter-spacing:-.005em;margin:0}
.t5-slip-head-left p{font-size:11px;margin:2px 0 0;font-family:var(--font-b);font-weight:540}
.t5-slip-head-right{text-align:right;font-size:10.5px}
.t5-slip-head-right strong{font-family:var(--font-d);font-weight:780;font-size:14px;display:block}
.t5-slip-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.t5-slip-cell{padding:8px 10px;border:1px solid #999;border-radius:4px;background:#fff}
.t5-dark .t5-slip-cell{background:#1a1d22;border-color:#444}
.t5-slip-box-label{font-family:var(--font-b);font-weight:680;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#666}
.t5-dark .t5-slip-box-label{color:#9c958a}
.t5-slip-box-val{font-size:13px;font-weight:600;margin-top:3px;letter-spacing:-.005em}
.t5-slip-amt{font-family:var(--font-d);font-weight:780;font-size:18px;letter-spacing:-.018em;font-variant-numeric:tabular-nums}
.t5-slip-foot{margin-top:14px;padding-top:10px;border-top:1px dashed #999;font-size:10.5px;color:#666;display:flex;justify-content:space-between}
.t5-dark .t5-slip-foot{color:#9c958a;border-top-color:#444}

/* ── Generation success state ─────────────────────────────────── */
.t5-success-icon{height:64px;width:64px;border-radius:50%;background:var(--green-soft);color:var(--green-text);display:inline-flex;align-items:center;justify-content:center;margin:8px auto 14px}
.t5-success-icon svg{width:32px;height:32px}
.t5-success-headline{font-family:var(--font-d);font-weight:780;font-size:20px;letter-spacing:-.018em;text-align:center;color:var(--t1)}
.t5-success-meta{font-size:13px;color:var(--t2);text-align:center;margin-top:6px;max-width:440px;margin-left:auto;margin-right:auto}
.t5-files{display:flex;flex-direction:column;gap:8px;margin-top:18px}
.t5-file-row{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1px solid var(--s3);border-radius:8px;background:var(--s2)}
.t5-file-icon{height:30px;width:30px;border-radius:7px;background:var(--info-soft);color:var(--info-text);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.t5-file-name{font-family:var(--font-m);font-size:12.5px;font-weight:600;color:var(--t1);letter-spacing:-.005em}
.t5-file-meta{font-size:11px;color:var(--t2);margin-top:1px;font-family:var(--font-b)}
.t5-file-size{margin-left:auto;font-family:var(--font-m);font-size:11.5px;color:var(--t2);font-weight:560}

/* ── Generating spinner ───────────────────────────────────────── */
.t5-spinner{height:42px;width:42px;border-radius:50%;border:3px solid var(--s3);border-top-color:var(--accent);animation:spin .9s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
.t5-gen-steps{margin-top:18px;display:flex;flex-direction:column;gap:9px}
.t5-gen-step{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--t2)}
.t5-gen-step.done{color:var(--green-text);font-weight:600}
.t5-gen-step-dot{height:14px;width:14px;border-radius:50%;background:var(--s2);border:1.5px solid var(--s3);flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}
.t5-gen-step.done .t5-gen-step-dot{background:var(--green-soft);border-color:var(--green-text)}

/* ── Drawer (audit log) ───────────────────────────────────────── */
.t5-drawer-bg{position:fixed;inset:0;background:rgba(15,17,22,.30);z-index:45;animation:fadeIn .15s ease}
.t5-drawer{position:fixed;top:0;right:0;bottom:0;width:420px;background:var(--s1);border-left:1px solid var(--s3);box-shadow:var(--shadow-lg);z-index:46;display:flex;flex-direction:column;animation:slideIn .25s cubic-bezier(.2,.7,.2,1)}
@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
.t5-drawer-head{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between}
.t5-drawer-body{padding:18px 22px;overflow-y:auto;flex:1}

/* ── Smaller layout breakpoint ────────────────────────────────── */
@media(max-width:1100px){
  .t5-grid-2{grid-template-columns:1fr}
  .t5-kpi{grid-template-columns:repeat(2,1fr)}
  .t5-layout{grid-template-columns:64px 1fr}
  .t5-sb{padding:14px 6px}
  .t5-section-label,.t5-org,.t5-nav-item span{display:none}
  .t5-nav-item{justify-content:center}
}
`;

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{css}</style>
      <div className={`t5-root${dark ? " t5-dark" : ""}`}>

        {/* ─── TOP BAR ────────────────────────────────────────────── */}
        <header className="t5-topbar">
          <div className="t5-brand">
            <LogoMark />
            <span className="t5-brand-name">BuiltCRM</span>
          </div>
          <div className="t5-crumbs">
            <strong>Hammerline Build</strong>
            {I.chevR}
            <span>Settings</span>
            {I.chevR}
            <span>Tax forms</span>
            {I.chevR}
            <strong>T5018</strong>
          </div>
          <div className="t5-top-spacer" />
          <button className="t5-icon-btn" onClick={() => setDark(d => !d)} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? I.sun : I.moon}
          </button>
          <button className="t5-icon-btn" title="Notifications">{I.bell}</button>
          <span className="t5-avatar">RO</span>
        </header>

        <div className="t5-layout">

          {/* ─── SIDEBAR ────────────────────────────────────────── */}
          <aside className="t5-sb">
            <div className="t5-org">
              <div className="t5-org-name">Hammerline Build Inc.</div>
              <div className="t5-org-meta">Contractor · 18 members · QC</div>
            </div>
            {sidebarNav.map(group => (
              <div key={group.section}>
                <div className="t5-section-label">{group.section}</div>
                {group.items.map(item => (
                  <div key={item.label} className={`t5-nav-item${item.active ? " active" : ""}`}>
                    <span>{item.label}</span>
                    {item.badge && <span className={`t5-nav-badge${item.badgeKind === "warn" ? " warn" : ""}`}>{item.badge}</span>}
                  </div>
                ))}
              </div>
            ))}
          </aside>

          {/* ─── MAIN ───────────────────────────────────────────── */}
          <main className="t5-main">

            {/* Settings cross-ref strip */}
            <nav className="t5-crossref" aria-label="Settings sections">
              {settingsCrossRefs.map(item => (
                <div key={item.id} className={`t5-crossref-item${item.active ? " active" : ""}`}>
                  {item.label}
                  {item.pillText && <span className={`t5-crossref-pill ${item.pillKind}`}>{item.pillText}</span>}
                </div>
              ))}
            </nav>

            {/* Page header */}
            <div className="t5-pagehead">
              <div className="t5-pagehead-left">
                <h1>T5018 — Contractor Payment Slips</h1>
                <p>
                  Issue Canada Revenue Agency contractor payment slips to subs paid more
                  than $500 CAD in a calendar year. Generate the consolidated CRA-conformant
                  XML plus per-sub PDF slips, package as a ZIP, and file with the CRA by{" "}
                  <strong style={{ color: "var(--t1)", fontWeight: 660 }}>{filingDeadline}</strong>.
                </p>
              </div>
              <div className="t5-pagehead-right">
                <div className="t5-year-pick" role="tablist" aria-label="Fiscal year">
                  <button className={fiscalYear === 2024 ? "active" : ""} onClick={() => setFiscalYear(2024)}>
                    Fiscal 2024
                    <span className="t5-year-pick-label">filed</span>
                  </button>
                  <button className={fiscalYear === 2025 ? "active" : ""} onClick={() => setFiscalYear(2025)}>
                    Fiscal 2025
                    <span className="t5-year-pick-label">{generated2025 ? "generated" : "current"}</span>
                  </button>
                </div>
                <button className="t5-btn t5-btn-ghost" onClick={() => setShowAuditDrawer(true)}>
                  {I.shield}
                  Audit log
                </button>
                <button
                  className="t5-btn t5-btn-primary"
                  disabled={!canGenerate}
                  onClick={() => setView("confirm")}
                  title={!canGenerate ? "Resolve blocking issues, or year already generated" : "Generate T5018 package"}
                >
                  {I.zap}
                  {generated2025 && fiscalYear === 2025 ? "Re-generate package" :
                   fiscalYear === 2024                  ? "Already filed" :
                                                          "Generate T5018 package"}
                </button>
              </div>
            </div>

            {/* Jurisdiction banner */}
            {isCanadian ? (
              <div className="t5-banner">
                <span className="t5-banner-icon green">{I.leaf}</span>
                <div>
                  <div className="t5-banner-title">Canadian tax jurisdiction enabled · Business Number {formatBN(contractorOrg.bn)}</div>
                  <div className="t5-banner-meta">
                    T5018 slips required for subs paid &gt; $500 CAD on construction services.
                    Filing due {filingDeadline} for fiscal year {fiscalYear}.
                  </div>
                </div>
                <button className="t5-btn t5-btn-ghost t5-banner-cta">
                  {I.external}
                  CRA T5018 guidance
                </button>
              </div>
            ) : (
              <div className="t5-banner">
                <span className="t5-banner-icon amber">{I.warn}</span>
                <div>
                  <div className="t5-banner-title">Tax forms not enabled for this organization</div>
                  <div className="t5-banner-meta">
                    T5018 surfaces require a Canadian tax jurisdiction. Update org settings → Organization → Tax jurisdiction.
                  </div>
                </div>
              </div>
            )}

            {/* KPI strip */}
            <div className="t5-kpi">
              <div className="t5-kpi-cell">
                <div className="t5-kpi-label">Qualifying subs</div>
                <div className="t5-kpi-value">{eligibleSubs.length}</div>
                <div className="t5-kpi-hint">
                  paid &gt; $500 in {fiscalYear} ·{" "}
                  <span className="ok">{eligibleSubs.length} ready</span>
                </div>
              </div>
              <div className="t5-kpi-cell">
                <div className="t5-kpi-label">Total reportable</div>
                <div className="t5-kpi-value">{formatCADCompact(totalEligibleCents)}</div>
                <div className="t5-kpi-hint">
                  across {eligibleSubs.reduce((acc, s) => acc + s.paymentCount, 0)} payments
                </div>
              </div>
              <div className="t5-kpi-cell">
                <div className="t5-kpi-label">Below threshold</div>
                <div className="t5-kpi-value">{belowSubs.length}</div>
                <div className="t5-kpi-hint">
                  {belowSubs.length === 0
                    ? "no excluded subs"
                    : <>excluded · {formatCAD(belowSubs.reduce((a, s) => a + s.totalCents, 0))} total</>}
                </div>
              </div>
              <div className="t5-kpi-cell">
                <div className="t5-kpi-label">Filing status</div>
                <div className="t5-kpi-value" style={{ color: filingStatusColors[yearStatus]?.solid }}>
                  {filingStatusColors[yearStatus]?.label}
                </div>
                <div className="t5-kpi-hint">
                  {yearStatus === "filed"     && <>CRA confirmation {priorFiling?.craConfirmation}</>}
                  {yearStatus === "generated" && <>generated · awaiting CRA filing</>}
                  {yearStatus === "ready"     && missingSubs.length > 0 && <span className="err">{missingSubs.length} blocker — resolve before generating</span>}
                  {yearStatus === "ready"     && missingSubs.length === 0 && <span className="ok">ready to generate</span>}
                  {yearStatus === "draft"     && <>nothing eligible yet</>}
                </div>
              </div>
            </div>

            {/* Two-column workspace: Filing summary + Generation panel */}
            <div className="t5-grid-2">

              {/* Filing summary card */}
              <section className="t5-card">
                <div className="t5-card-head">
                  <div>
                    <div className="t5-card-title">Filing summary</div>
                    <div className="t5-card-sub">Reporter and recipient details applied to every slip</div>
                  </div>
                  <button className="t5-btn t5-btn-ghost">
                    {I.refresh}
                    Refresh from org
                  </button>
                </div>
                <div className="t5-card-body">
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Reporter</div>
                    <div>
                      <div className="t5-summary-val">{contractorOrg.legalName}</div>
                      <div className="t5-summary-meta">
                        {contractorOrg.addr1} · {contractorOrg.city}, {contractorOrg.province} {contractorOrg.postal}
                      </div>
                    </div>
                  </div>
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Business Number</div>
                    <div>
                      <div className="t5-summary-val mono">{formatBN(contractorOrg.bn)}</div>
                      <div className="t5-summary-meta">Trust account program — RT0001</div>
                    </div>
                  </div>
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Receiver code</div>
                    <div>
                      <div className="t5-summary-val mono">{contractorOrg.craReceiverCode}</div>
                      <div className="t5-summary-meta">CRA-issued · for electronic transmission</div>
                    </div>
                  </div>
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Reporting period</div>
                    <div>
                      <div className="t5-summary-val">January 1 – December 31, {fiscalYear}</div>
                      <div className="t5-summary-meta">Calendar year basis · payments-received method</div>
                    </div>
                  </div>
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Filing contact</div>
                    <div>
                      <div className="t5-summary-val">{contractorOrg.filingContact}</div>
                      <div className="t5-summary-meta">{contractorOrg.filingEmail}</div>
                    </div>
                  </div>
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Filing deadline</div>
                    <div>
                      <div className="t5-summary-val">{filingDeadline}</div>
                      <div className="t5-summary-meta">Late filing penalty: $100–$2,500 per slip (CRA)</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Generation panel */}
              <section className="t5-card t5-genpanel">
                <div className="t5-card-head">
                  <div>
                    <div className="t5-card-title">Generation status</div>
                    <div className="t5-card-sub">CRA-conformant XML + per-sub PDF slips</div>
                  </div>
                </div>
                <div className="t5-gen-status">
                  <span className="t5-gen-pill" style={{
                    background: filingStatusColors[yearStatus]?.soft,
                    color: filingStatusColors[yearStatus]?.solid,
                  }}>
                    <span style={{ height: 6, width: 6, borderRadius: "50%", background: "currentColor" }} />
                    {filingStatusColors[yearStatus]?.label}
                  </span>
                  <div className="t5-gen-headline">
                    Fiscal year {fiscalYear} · {eligibleSubs.length} slip{eligibleSubs.length === 1 ? "" : "s"}
                  </div>
                  <div className="t5-gen-help">
                    {yearStatus === "filed"     && <>Filed with CRA on {priorFiling?.filedAt}. Original generation available below.</>}
                    {yearStatus === "generated" && <>Package ready. Download below or proceed to filing.</>}
                    {yearStatus === "ready"     && missingSubs.length > 0 && <>Resolve {missingSubs.length} blocking issue before generating.</>}
                    {yearStatus === "ready"     && missingSubs.length === 0 && <>All eligible subs validated. Click generate to build the CRA package.</>}
                    {yearStatus === "draft"     && <>No qualifying payments aggregated for this year yet.</>}
                  </div>
                </div>

                {(blockingIssues.length > 0 || advisoryIssues.length > 0) && (
                  <div className="t5-gen-issues">
                    {blockingIssues.map((issue, idx) => (
                      <div key={`b-${idx}`} className="t5-issue">
                        <span className="t5-issue-icon blocker">{I.warn}</span>
                        <span className="t5-issue-text">{issue.text}</span>
                        <button className="t5-issue-action" onClick={() => setFilter("missing")}>
                          {issue.action} →
                        </button>
                      </div>
                    ))}
                    {advisoryIssues.map((issue, idx) => (
                      <div key={`a-${idx}`} className="t5-issue">
                        <span className="t5-issue-icon advisory">{I.info}</span>
                        <span className="t5-issue-text">{issue.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="t5-gen-actions">
                  {yearStatus === "filed" && priorFiling && (
                    <>
                      <button className="t5-btn t5-btn-soft t5-gen-cta">
                        {I.download}
                        Download original package ({priorFiling.slipCount} slips)
                      </button>
                      <div className="t5-gen-secondary">
                        <button className="t5-btn t5-btn-ghost">
                          {I.file}
                          View XML
                        </button>
                        <button className="t5-btn t5-btn-ghost">
                          {I.list}
                          Slip list
                        </button>
                      </div>
                    </>
                  )}
                  {yearStatus === "generated" && (
                    <>
                      <button className="t5-btn t5-btn-primary t5-gen-cta">
                        {I.download}
                        Download T5018 package (.zip)
                      </button>
                      <div className="t5-gen-secondary">
                        <button className="t5-btn t5-btn-ghost">
                          {I.external}
                          File with CRA
                        </button>
                        <button className="t5-btn t5-btn-ghost" onClick={() => setGenerated2025(false)}>
                          {I.refresh}
                          Re-generate
                        </button>
                      </div>
                    </>
                  )}
                  {(yearStatus === "ready" || yearStatus === "draft") && (
                    <button
                      className="t5-btn t5-btn-primary t5-gen-cta"
                      disabled={!canGenerate}
                      onClick={() => setView("confirm")}
                    >
                      {I.zap}
                      Generate T5018 package
                    </button>
                  )}
                </div>
              </section>
            </div>

            {/* Slip preview table */}
            <section className="t5-card" style={{ marginBottom: 18 }}>
              <div className="t5-card-head">
                <div>
                  <div className="t5-card-title">Slip preview · {fiscalYear}</div>
                  <div className="t5-card-sub">
                    Aggregated from <strong style={{ color: "var(--t1)" }}>payments</strong> joined with{" "}
                    <strong style={{ color: "var(--t1)" }}>draws</strong> across all projects this calendar year
                  </div>
                </div>
                <button className="t5-btn t5-btn-ghost">
                  {I.download}
                  Export CSV
                </button>
              </div>

              <div className="t5-toolbar">
                <div className="t5-search">
                  {I.search}
                  <input
                    placeholder="Search by sub name or BN…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="t5-tabbar">
                  <button className={`t5-tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
                    All ({subs.length})
                  </button>
                  <button className={`t5-tab${filter === "eligible" ? " active" : ""}`} onClick={() => setFilter("eligible")}>
                    Eligible ({eligibleSubs.length})
                  </button>
                  <button className={`t5-tab${filter === "below" ? " active" : ""}`} onClick={() => setFilter("below")}>
                    Below $500 ({belowSubs.length})
                  </button>
                  {missingSubs.length > 0 && (
                    <button className={`t5-tab${filter === "missing" ? " active" : ""}`} onClick={() => setFilter("missing")}
                            style={{ color: filter === "missing" ? "var(--red-text)" : "var(--red-text)", background: filter === "missing" ? "var(--red-soft)" : "transparent" }}>
                      Blocker ({missingSubs.length})
                    </button>
                  )}
                </div>
                <div className="t5-toolbar-right">
                  Showing <strong>{filteredSubs.length}</strong> of <strong>{subs.length}</strong>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="t5-table">
                  <thead>
                    <tr>
                      <th
                        className="sortable"
                        onClick={() => { setSortKey("name"); setSortDir(d => sortKey === "name" && d === "asc" ? "desc" : "asc"); }}
                      >
                        Subcontractor
                      </th>
                      <th>Business Number</th>
                      <th>Mailing address</th>
                      <th
                        className="sortable right"
                        onClick={() => { setSortKey("count"); setSortDir(d => sortKey === "count" && d === "asc" ? "desc" : "asc"); }}
                      >
                        Payments
                      </th>
                      <th
                        className="sortable right"
                        onClick={() => { setSortKey("total"); setSortDir(d => sortKey === "total" && d === "asc" ? "desc" : "asc"); }}
                      >
                        {fiscalYear} total (CAD)
                      </th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map(s => {
                      const sc = slipStatusColors[s.status];
                      const muted = s.status === "below_threshold";
                      return (
                        <tr key={s.id} className={muted ? "muted" : ""} onClick={() => { setSelectedSubId(s.id); setShowSlipDetail(true); }}>
                          <td>
                            <div className="t5-sub-cell">
                              <span className="t5-sub-avatar">{initials(s.displayName)}</span>
                              <div>
                                <div className="t5-sub-name">{s.displayName}</div>
                                <div className="t5-sub-legal">{s.legalName}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`t5-bn${s.bn ? "" : " missing"}`}>
                              {s.bn ? formatBN(s.bn) : "BN not on file"}
                            </span>
                          </td>
                          <td style={{ color: "var(--t2)", fontSize: 12 }}>{s.addr}</td>
                          <td className="right" style={{ color: "var(--t2)", fontWeight: 600 }}>{s.paymentCount}</td>
                          <td className="right">{formatCAD(s.totalCents)}</td>
                          <td>
                            <span className="t5-pill" style={{ background: sc.soft, color: sc.solid }}>
                              {s.status === "missing_data" ? I.warn : s.status === "below_threshold" ? I.x : I.check}
                              {sc.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredSubs.length === 0 && (
                <div style={{ padding: 36, textAlign: "center", color: "var(--t2)" }}>
                  No subs match the current filter.
                </div>
              )}
            </section>

            {/* Filing history */}
            <section className="t5-card">
              <div className="t5-card-head">
                <div>
                  <div className="t5-card-title">Filing history</div>
                  <div className="t5-card-sub">Prior T5018 packages generated and filed with CRA</div>
                </div>
              </div>
              {filingHistory.map(f => {
                const sc = filingStatusColors[f.status];
                return (
                  <div key={f.id} className="t5-history-row">
                    <div className="t5-history-yr">{f.fiscalYear}</div>
                    <div className="t5-history-meta">
                      <div className="t5-history-title">
                        {f.slipCount} slip{f.slipCount === 1 ? "" : "s"} · {formatCAD(f.totalCents)} reported
                      </div>
                      <div className="t5-history-sub">
                        Generated {f.generatedAt} by {f.generatedBy} · {f.xmlChecksum}
                        {f.filedAt && <> · Filed {f.filedAt} · {f.craConfirmation}</>}
                      </div>
                    </div>
                    <span className="t5-pill" style={{ background: sc.soft, color: sc.solid }}>
                      {f.status === "filed" ? I.check : I.package}
                      {sc.label}
                    </span>
                    <div className="t5-history-actions">
                      <button className="t5-btn t5-btn-ghost">
                        {I.download}
                        Package
                      </button>
                      <button className="t5-btn t5-btn-ghost">
                        {I.eye}
                        XML
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

          </main>
        </div>

        {/* ─── SLIP DETAIL MODAL ──────────────────────────────────── */}
        {showSlipDetail && selectedSub && (
          <div className="t5-modal-bg" onClick={() => setShowSlipDetail(false)}>
            <div className="t5-modal wide" onClick={(e) => e.stopPropagation()}>
              <div className="t5-modal-head">
                <div>
                  <div className="t5-modal-title">Slip preview — {selectedSub.displayName}</div>
                  <div className="t5-modal-sub">
                    {selectedSub.paymentCount} payment{selectedSub.paymentCount === 1 ? "" : "s"} aggregated for fiscal year {fiscalYear}
                  </div>
                </div>
                <button className="t5-icon-btn" onClick={() => setShowSlipDetail(false)}>{I.x}</button>
              </div>
              <div className="t5-modal-body">

                {selectedSub.status === "missing_data" && (
                  <div className="t5-banner" style={{ marginBottom: 18 }}>
                    <span className="t5-banner-icon red">{I.warn}</span>
                    <div>
                      <div className="t5-banner-title">Business Number missing</div>
                      <div className="t5-banner-meta">
                        Cannot include in filing until BN/SIN is captured. Edit subcontractor profile to add it.
                      </div>
                    </div>
                  </div>
                )}

                {/* Mock T5018 slip layout (CRA boxes) */}
                <div className="t5-slip">
                  <div className="t5-slip-head">
                    <div className="t5-slip-head-left">
                      <h3>T5018 — Statement of Contract Payments</h3>
                      <p>État des paiements contractuels · Canada Revenue Agency</p>
                    </div>
                    <div className="t5-slip-head-right">
                      <strong>{fiscalYear}</strong>
                      Reporting period: Jan 1 – Dec 31
                    </div>
                  </div>

                  <div className="t5-slip-grid">
                    <div className="t5-slip-cell" style={{ gridColumn: "1 / -1" }}>
                      <div className="t5-slip-box-label">Box 22 — Recipient name</div>
                      <div className="t5-slip-box-val">{selectedSub.legalName}</div>
                    </div>
                    <div className="t5-slip-cell">
                      <div className="t5-slip-box-label">Box 24 — Recipient BN/SIN</div>
                      <div className="t5-slip-box-val">{selectedSub.bn ? formatBN(selectedSub.bn) : "Not on file"}</div>
                    </div>
                    <div className="t5-slip-cell">
                      <div className="t5-slip-box-label">Box 26 — Account number</div>
                      <div className="t5-slip-box-val">{selectedSub.id.toUpperCase()}</div>
                    </div>
                    <div className="t5-slip-cell" style={{ gridColumn: "1 / -1" }}>
                      <div className="t5-slip-box-label">Box 27 — Recipient address</div>
                      <div className="t5-slip-box-val">{selectedSub.addr}</div>
                    </div>
                    <div className="t5-slip-cell">
                      <div className="t5-slip-box-label">Box 28 — Reporting period start</div>
                      <div className="t5-slip-box-val">January 1, {fiscalYear}</div>
                    </div>
                    <div className="t5-slip-cell">
                      <div className="t5-slip-box-label">Box 29 — Reporting period end</div>
                      <div className="t5-slip-box-val">December 31, {fiscalYear}</div>
                    </div>
                    <div className="t5-slip-cell" style={{ gridColumn: "1 / -1" }}>
                      <div className="t5-slip-box-label">Box 82 — Total contract payments</div>
                      <div className="t5-slip-amt">{formatCAD(selectedSub.totalCents)}</div>
                    </div>
                  </div>

                  <div className="t5-slip-foot">
                    <span>Reporter: {contractorOrg.legalName} · {formatBN(contractorOrg.bn)}</span>
                    <span>Slip {selectedSub.id.toUpperCase()} of {eligibleSubs.length}</span>
                  </div>
                </div>

                {/* Payment breakdown */}
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 13, color: "var(--t1)", marginBottom: 8 }}>
                    Payment breakdown · {selectedSub.paymentCount} payment{selectedSub.paymentCount === 1 ? "" : "s"}
                  </div>
                  <div style={{ background: "var(--s2)", borderRadius: "var(--radius-md)", padding: 14, fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65 }}>
                    Aggregation pulls from <span style={{ fontFamily: "var(--font-m)", color: "var(--t1)" }}>payments</span> joined
                    with <span style={{ fontFamily: "var(--font-m)", color: "var(--t1)" }}>draws</span> joined with{" "}
                    <span style={{ fontFamily: "var(--font-m)", color: "var(--t1)" }}>sov_line_items</span>{" "}
                    where <span style={{ fontFamily: "var(--font-m)", color: "var(--t1)" }}>recipientOrgId = {selectedSub.id}</span>{" "}
                    and <span style={{ fontFamily: "var(--font-m)", color: "var(--t1)" }}>paymentDate</span> falls inside fiscal {fiscalYear}.
                    Construction-services portion only — material-only line items are excluded per CRA rule.
                  </div>
                </div>

              </div>
              <div className="t5-modal-foot">
                <button className="t5-btn t5-btn-ghost" onClick={() => setShowSlipDetail(false)}>Close</button>
                <button className="t5-btn t5-btn-ghost">{I.external} Open subcontractor profile</button>
                <button className="t5-btn t5-btn-soft" disabled={selectedSub.status !== "eligible" && selectedSub.status !== "generated"}>
                  {I.download}
                  Download single slip (PDF)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── GENERATE CONFIRM MODAL ─────────────────────────────── */}
        {view === "confirm" && (
          <div className="t5-modal-bg" onClick={() => setView("workspace")}>
            <div className="t5-modal" onClick={(e) => e.stopPropagation()}>
              <div className="t5-modal-head">
                <div>
                  <div className="t5-modal-title">Generate T5018 package — fiscal year {fiscalYear}</div>
                  <div className="t5-modal-sub">Final review before creating CRA-conformant outputs</div>
                </div>
                <button className="t5-icon-btn" onClick={() => setView("workspace")}>{I.x}</button>
              </div>
              <div className="t5-modal-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="t5-summary-row" style={{ borderBottom: "1px solid var(--s3)", paddingBottom: 14 }}>
                    <div className="t5-summary-label">Reporter</div>
                    <div>
                      <div className="t5-summary-val">{contractorOrg.legalName}</div>
                      <div className="t5-summary-meta mono" style={{ fontFamily: "var(--font-m)" }}>{formatBN(contractorOrg.bn)}</div>
                    </div>
                  </div>
                  <div className="t5-summary-row" style={{ borderBottom: "1px solid var(--s3)", paddingBottom: 14 }}>
                    <div className="t5-summary-label">Slips to generate</div>
                    <div>
                      <div className="t5-summary-val">{eligibleSubs.length} slip{eligibleSubs.length === 1 ? "" : "s"}</div>
                      <div className="t5-summary-meta">All eligible · BN validated · &gt; $500 threshold</div>
                    </div>
                  </div>
                  <div className="t5-summary-row" style={{ borderBottom: "1px solid var(--s3)", paddingBottom: 14 }}>
                    <div className="t5-summary-label">Total reportable</div>
                    <div>
                      <div className="t5-summary-val" style={{ fontFamily: "var(--font-d)", fontWeight: 760, fontSize: 18 }}>
                        {formatCAD(totalEligibleCents)}
                      </div>
                      <div className="t5-summary-meta">Box 82 sum across all slips</div>
                    </div>
                  </div>
                  <div className="t5-summary-row" style={{ borderBottom: "1px solid var(--s3)", paddingBottom: 14 }}>
                    <div className="t5-summary-label">Outputs</div>
                    <div>
                      <div className="t5-summary-val">CRA XML (1 file) + per-sub PDF (× {eligibleSubs.length}) + ZIP bundle</div>
                      <div className="t5-summary-meta">XML conforms to CRA T5018 schema · v25-1</div>
                    </div>
                  </div>
                  <div className="t5-summary-row">
                    <div className="t5-summary-label">Audit event</div>
                    <div>
                      <div className="t5-summary-val mono" style={{ fontFamily: "var(--font-m)" }}>tax.t5018.generated</div>
                      <div className="t5-summary-meta">Logged with year, slip count, total amount, and your user ID</div>
                    </div>
                  </div>
                </div>

                {advisoryIssues.length > 0 && (
                  <div style={{ marginTop: 18, padding: 12, background: "var(--amber-soft)", borderRadius: "var(--radius-md)", border: "1px solid rgba(193,122,26,.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--amber-text)", marginTop: 1, flexShrink: 0 }}>{I.info}</span>
                    <div style={{ fontSize: 12.5, color: "var(--amber-text)", lineHeight: 1.55 }}>
                      <strong style={{ fontWeight: 700 }}>Heads up:</strong> {belowSubs.length} sub{belowSubs.length === 1 ? "" : "s"}{" "}
                      paid below the $500 CAD threshold {belowSubs.length === 1 ? "is" : "are"} excluded from this filing per CRA rule.
                      They remain visible in the workspace but no slip is issued.
                    </div>
                  </div>
                )}
              </div>
              <div className="t5-modal-foot">
                <button className="t5-btn t5-btn-ghost" onClick={() => setView("workspace")}>Cancel</button>
                <button className="t5-btn t5-btn-primary" onClick={onConfirmGenerate}>
                  {I.zap}
                  Generate {eligibleSubs.length} slip{eligibleSubs.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── GENERATING SPINNER ─────────────────────────────────── */}
        {view === "generating" && (
          <div className="t5-modal-bg">
            <div className="t5-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
              <div className="t5-modal-body" style={{ padding: 36, textAlign: "center" }}>
                <div className="t5-spinner" />
                <div className="t5-success-headline" style={{ marginTop: 18 }}>Generating T5018 package…</div>
                <div className="t5-success-meta">
                  Aggregating {eligibleSubs.reduce((acc, s) => acc + s.paymentCount, 0)} payments across {eligibleSubs.length} subs.
                </div>
                <div className="t5-gen-steps" style={{ textAlign: "left", maxWidth: 280, margin: "18px auto 0" }}>
                  <div className="t5-gen-step done">
                    <span className="t5-gen-step-dot">{I.check}</span>
                    Aggregated payments
                  </div>
                  <div className="t5-gen-step done">
                    <span className="t5-gen-step-dot">{I.check}</span>
                    Validated against CRA schema
                  </div>
                  <div className="t5-gen-step">
                    <span className="t5-gen-step-dot" />
                    Building XML + PDF outputs…
                  </div>
                  <div className="t5-gen-step">
                    <span className="t5-gen-step-dot" />
                    Packaging ZIP
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── GENERATION SUCCESS MODAL ───────────────────────────── */}
        {view === "success" && (
          <div className="t5-modal-bg" onClick={() => setView("workspace")}>
            <div className="t5-modal" onClick={(e) => e.stopPropagation()}>
              <div className="t5-modal-head">
                <div>
                  <div className="t5-modal-title">T5018 package ready</div>
                  <div className="t5-modal-sub">Fiscal year {fiscalYear} · {eligibleSubs.length} slips · {formatCAD(totalEligibleCents)} reported</div>
                </div>
                <button className="t5-icon-btn" onClick={() => setView("workspace")}>{I.x}</button>
              </div>
              <div className="t5-modal-body">
                <div className="t5-success-icon">{I.check}</div>
                <div className="t5-success-headline">Package generated successfully</div>
                <div className="t5-success-meta">
                  XML validated against CRA T5018 schema v25-1. Audit event{" "}
                  <span style={{ fontFamily: "var(--font-m)" }}>tax.t5018.generated</span> recorded.
                </div>

                <div className="t5-files">
                  <div className="t5-file-row">
                    <span className="t5-file-icon">{I.package}</span>
                    <div>
                      <div className="t5-file-name">T5018-{contractorOrg.bn}-{fiscalYear}.zip</div>
                      <div className="t5-file-meta">Bundle · XML + {eligibleSubs.length} PDF slips</div>
                    </div>
                    <span className="t5-file-size">2.4 MB</span>
                  </div>
                  <div className="t5-file-row">
                    <span className="t5-file-icon">{I.file}</span>
                    <div>
                      <div className="t5-file-name">T5018-{contractorOrg.bn}-{fiscalYear}.xml</div>
                      <div className="t5-file-meta">CRA-conformant XML · 1 summary + {eligibleSubs.length} slips</div>
                    </div>
                    <span className="t5-file-size">84 KB</span>
                  </div>
                  <div className="t5-file-row">
                    <span className="t5-file-icon">{I.list}</span>
                    <div>
                      <div className="t5-file-name">T5018-summary-{fiscalYear}.csv</div>
                      <div className="t5-file-meta">Reconciliation summary for your records</div>
                    </div>
                    <span className="t5-file-size">12 KB</span>
                  </div>
                </div>

                <div style={{ marginTop: 18, padding: 12, background: "var(--info-soft)", borderRadius: "var(--radius-md)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--info-text)", marginTop: 1, flexShrink: 0 }}>{I.info}</span>
                  <div style={{ fontSize: 12.5, color: "var(--info-text)", lineHeight: 1.55 }}>
                    Next step: log into your CRA <em>Represent a Client</em> portal and upload the XML.
                    File by <strong>{filingDeadline}</strong> to avoid late-filing penalties.
                  </div>
                </div>
              </div>
              <div className="t5-modal-foot">
                <button className="t5-btn t5-btn-ghost" onClick={() => setView("workspace")}>Close</button>
                <button className="t5-btn t5-btn-soft">
                  {I.external}
                  CRA upload portal
                </button>
                <button className="t5-btn t5-btn-primary">
                  {I.download}
                  Download package (.zip)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── AUDIT LOG DRAWER ───────────────────────────────────── */}
        {showAuditDrawer && (
          <>
            <div className="t5-drawer-bg" onClick={() => setShowAuditDrawer(false)} />
            <aside className="t5-drawer">
              <div className="t5-drawer-head">
                <div>
                  <div className="t5-modal-title">Audit log</div>
                  <div className="t5-modal-sub">T5018 surface — last 30 days</div>
                </div>
                <button className="t5-icon-btn" onClick={() => setShowAuditDrawer(false)}>{I.x}</button>
              </div>
              <div className="t5-drawer-body">
                <div className="t5-feed">
                  {auditFeed.map((row, idx) => (
                    <div key={idx} className="t5-feed-row">
                      <span className={`t5-feed-icon ${row.kind}`}>
                        {row.kind === "warn"      && I.warn}
                        {row.kind === "preview"   && I.eye}
                        {row.kind === "aggregate" && I.refresh}
                        {row.kind === "generate"  && I.zap}
                        {row.kind === "file"      && I.shield}
                        {row.kind === "reminder"  && I.info}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div className="t5-feed-text">
                          <strong>{row.who}</strong> {row.action}
                        </div>
                        <div className="t5-feed-text">
                          <span className="target">{row.target}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 3, fontFamily: "var(--font-m)" }}>
                          {row.when}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </>
        )}

      </div>
    </>
  );
}
