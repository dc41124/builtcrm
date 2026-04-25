import { useState, useMemo } from "react";

// BuiltCRM — Closeout Packages Module (Contractor + Client / Phase 5 Differentiator)
// Step 48 (5.3 #48). Effort M · Priority P1 · Require-design-input.
//
// At project closeout, contractors bundle O&M manuals, warranties, as-builts,
// final permits, testing/commissioning certificates, CAD/BIM files, and other
// handover artifacts into a single deliverable for the owner. The owner
// receives the package via the client portal, reviews each section, comments
// or accepts. On acceptance the project transitions to closed and the audit
// trail captures the sign-off (date, signer, optional comment).
//
// Distinct from Transmittals (single-send, multi-recipient with tokenized
// download). Closeout is a structured multi-section deliverable bound to the
// project's lifecycle, with a single owner-recipient and a sign-off contract.
//
// Schema reference (drizzle_schema_phaseX — pending decisions):
//   closeout_packages          (id, projectId, status[building|review|
//                               delivered|accepted], preparedByUserId,
//                               deliveredAt, acceptedAt, acceptedByUserId,
//                               acceptanceNote, createdAt, updatedAt)
//   closeout_package_sections  (id, packageId, sectionType[om_manuals|
//                               warranties|as_builts|permits_final|
//                               testing_certificates|cad_files|other],
//                               customLabel, orderIndex)
//   closeout_package_items     (id, sectionId, documentId, notes,
//                               sortOrder, addedByUserId)
//   closeout_package_comments  (id, packageId, sectionId|itemId, body,
//                               authorUserId, scope[item|section|package],
//                               createdAt)
//
// Design decisions captured in this module:
//   1. Building → Review → Delivered → Accepted state machine.
//   2. HTML5 drag-and-drop from project doc library into sections, with a
//      click-to-add fallback for mobile/a11y.
//   3. Inline auto-suggest chips (leverages Step 21 document categories).
//   4. 7 fixed section types + custom-label "other" sections.
//   5. Per-item + per-package comments on the client side.
//   6. Click-wrap acceptance with optional comment + signed name.

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Section types — color & label config ────────────────────────────────
const sectionTypes = {
  om_manuals:           { label: "O&M Manuals",            short: "O&M",        solid: "#5b4fc7", soft: "rgba(91,79,199,.12)",  desc: "Operations & maintenance manuals for installed equipment." },
  warranties:           { label: "Warranties",              short: "Warranty",   solid: "#2d8a5e", soft: "rgba(45,138,94,.12)",  desc: "Manufacturer & contractor warranty certificates." },
  as_builts:            { label: "As-Built Drawings",      short: "As-Built",   solid: "#3878a8", soft: "rgba(56,120,168,.12)", desc: "Final field-modified drawings reflecting actual install." },
  permits_final:        { label: "Final Permits & Approvals", short: "Permits", solid: "#c4700b", soft: "rgba(196,112,11,.12)", desc: "Closed permits, final inspection approvals, occupancy." },
  testing_certificates: { label: "Testing & Commissioning",  short: "T&C",      solid: "#8a5b2a", soft: "rgba(138,91,42,.12)",  desc: "Balancing reports, commissioning certs, test results." },
  cad_files:            { label: "CAD / BIM Files",         short: "CAD",       solid: "#5b7a6a", soft: "rgba(91,122,106,.12)", desc: "Native CAD/BIM source files for owner archive." },
  other:                { label: "Other",                   short: "Other",     solid: "#6b5d8c", soft: "rgba(107,93,140,.12)", desc: "Custom section — contractor-defined." },
};

// ─── Closeout packages list (one per project — across the demo portfolio) ──
const closeoutPackages = [
  {
    id:               "cp-1",
    num:              "CO-2026-0003",
    projectId:        "p-riverside",
    projectName:      "Riverside Office Complex",
    projectAddress:   "1240 Riverside Dr, Toronto, ON",
    projectClient:    "Bennett Capital",
    projectClientLead: "Owen Bennett",
    status:           "building",                    // active hero — DnD live
    preparedBy:       "Dan Carter",
    preparedByOrg:    "Hammerline Build",
    deliveredAt:      null,
    acceptedAt:       null,
    completionPct:    62,
    sectionsCount:    5,
    docsCount:        18,
    sizeMb:           248.4,
    targetDeliveryDate: "May 02, 2026",
  },
  {
    id:               "cp-2",
    num:              "CO-2025-0017",
    projectId:        "p-northbank",
    projectName:      "Northbank Mixed-Use",
    projectAddress:   "88 Lakeshore Blvd, Mississauga, ON",
    projectClient:    "Northbank Holdings",
    projectClientLead: "Asha Patel",
    status:           "delivered",                   // awaiting client action
    preparedBy:       "Dan Carter",
    preparedByOrg:    "Hammerline Build",
    deliveredAt:      "Apr 18, 2026 · 4:20 PM",
    acceptedAt:       null,
    completionPct:    100,
    sectionsCount:    7,
    docsCount:        34,
    sizeMb:           412.8,
    targetDeliveryDate: "Apr 18, 2026",
  },
  {
    id:               "cp-3",
    num:              "CO-2025-0014",
    projectId:        "p-glenwood",
    projectName:      "Glenwood Tower Refit",
    projectAddress:   "402 Bay St, Toronto, ON",
    projectClient:    "Glenwood Trust",
    projectClientLead: "Marie LaForge",
    status:           "accepted",                    // fully closed
    preparedBy:       "Dan Carter",
    preparedByOrg:    "Hammerline Build",
    deliveredAt:      "Mar 28, 2026 · 11:14 AM",
    acceptedAt:       "Apr 04, 2026 · 9:42 AM",
    acceptedBy:       "Marie LaForge",
    acceptanceNote:   "Package complete. Filing copy with our facilities team and Building Department.",
    completionPct:    100,
    sectionsCount:    6,
    docsCount:        29,
    sizeMb:           308.1,
  },
  {
    id:               "cp-4",
    num:              "CO-2026-0001",
    projectId:        "p-elmcrest",
    projectName:      "Elmcrest Medical Pavilion",
    projectAddress:   "55 Elmcrest Ave, Burlington, ON",
    projectClient:    "Halton Health Group",
    projectClientLead: "Dr. Janelle Park",
    status:           "review",                      // contractor doing internal QA
    preparedBy:       "Sandra Liao",
    preparedByOrg:    "Hammerline Build",
    deliveredAt:      null,
    acceptedAt:       null,
    completionPct:    94,
    sectionsCount:    7,
    docsCount:        41,
    sizeMb:           512.6,
    targetDeliveryDate: "Apr 28, 2026",
  },
  {
    id:               "cp-5",
    num:              "CO-2025-0011",
    projectId:        "p-orchard",
    projectName:      "Orchard Place Condos",
    projectAddress:   "120 Orchard Pl, Hamilton, ON",
    projectClient:    "Orchard Place Corp",
    projectClientLead: "Tom Bell",
    status:           "accepted",
    preparedBy:       "Dan Carter",
    preparedByOrg:    "Hammerline Build",
    deliveredAt:      "Feb 14, 2026 · 2:00 PM",
    acceptedAt:       "Feb 21, 2026 · 10:18 AM",
    acceptedBy:       "Tom Bell",
    acceptanceNote:   "All received and acknowledged. Thanks to the Hammerline team.",
    completionPct:    100,
    sectionsCount:    5,
    docsCount:        22,
    sizeMb:           184.3,
  },
];

// ─── Hero package sections (Riverside Office Complex — building state) ───
// This is the package the contractor is actively assembling. Each section
// has a sectionType + 0..n items. Items reference docs in the project doc
// library and carry contractor notes.
const heroSections = [
  {
    id:        "sec-1",
    type:      "om_manuals",
    customLabel: null,
    orderIndex: 1,
    items: [
      { id: "it-1",  docId: "pd-21", name: "HVAC_Carrier_RTU_OM_Manual.pdf",         sizeMb: 18.4, notes: "Two units installed — units #1 and #3 are this model." },
      { id: "it-2",  docId: "pd-22", name: "Boiler_Lochinvar_OM_Manual.pdf",         sizeMb: 12.1, notes: "" },
      { id: "it-3",  docId: "pd-23", name: "VFD_ABB_ACS580_OM_Manual.pdf",            sizeMb:  8.8, notes: "Three drives; same manual covers all." },
      { id: "it-4",  docId: "pd-24", name: "Sprinkler_Controller_Tyco_OM.pdf",       sizeMb:  6.2, notes: "" },
    ],
  },
  {
    id:        "sec-2",
    type:      "warranties",
    customLabel: null,
    orderIndex: 2,
    items: [
      { id: "it-5",  docId: "pd-31", name: "Roofing_GAF_25yr_Warranty.pdf",          sizeMb:  1.2, notes: "Warranty start date: substantial completion + 30 days." },
      { id: "it-6",  docId: "pd-32", name: "Curtain_Wall_Kawneer_10yr_Warranty.pdf", sizeMb:  0.9, notes: "" },
      { id: "it-7",  docId: "pd-33", name: "HVAC_Carrier_5yr_Warranty.pdf",          sizeMb:  0.7, notes: "Includes 1-yr labor; covers parts and compressor for 5 yrs." },
      { id: "it-8",  docId: "pd-34", name: "Hammerline_GC_2yr_Workmanship.pdf",      sizeMb:  0.4, notes: "Standard Hammerline 2-year workmanship warranty." },
    ],
  },
  {
    id:        "sec-3",
    type:      "as_builts",
    customLabel: null,
    orderIndex: 3,
    items: [
      { id: "it-9",  docId: "pd-41", name: "AB-A_Architectural_AsBuilt_Set.pdf",     sizeMb: 42.1, notes: "Final field set — incorporates RFI-0047 and CO-019." },
      { id: "it-10", docId: "pd-42", name: "AB-S_Structural_AsBuilt_Set.pdf",        sizeMb: 38.7, notes: "" },
      { id: "it-11", docId: "pd-43", name: "AB-M_Mechanical_AsBuilt_Set.pdf",        sizeMb: 29.4, notes: "" },
    ],
  },
  {
    id:        "sec-4",
    type:      "permits_final",
    customLabel: null,
    orderIndex: 4,
    items: [
      { id: "it-12", docId: "pd-51", name: "Building_Permit_Final_Inspection.pdf",   sizeMb:  1.8, notes: "City of Toronto — passed Apr 18." },
      { id: "it-13", docId: "pd-52", name: "Electrical_ESA_Closure.pdf",             sizeMb:  1.1, notes: "ESA #2026-04-1184" },
    ],
  },
  {
    id:        "sec-5",
    type:      "testing_certificates",
    customLabel: null,
    orderIndex: 5,
    items: [],   // empty section — illustrates the empty state + DnD target
  },
  // CAD/BIM and Other not yet added — will appear as "Add section" options
];

// ─── Project document library (drag source for the doc picker) ───────────
// Grouped by category. Tagged with suggested section type so the
// auto-suggest chip can render. In production this comes from the documents
// module + Step 21 categories.
const projectDocLibrary = [
  {
    folder: "Equipment / Mechanical",
    docs: [
      { id: "pd-25", name: "Chiller_Trane_RTAC_OM_Manual.pdf",          sizeMb: 22.4, suggested: "om_manuals" },
      { id: "pd-26", name: "Pump_Bell_Gossett_OM.pdf",                   sizeMb:  9.1, suggested: "om_manuals" },
      { id: "pd-27", name: "Cooling_Tower_BAC_OM.pdf",                   sizeMb: 14.2, suggested: "om_manuals" },
    ],
  },
  {
    folder: "Equipment / Electrical",
    docs: [
      { id: "pd-28", name: "Switchgear_Schneider_OM_Manual.pdf",         sizeMb: 17.8, suggested: "om_manuals" },
      { id: "pd-29", name: "Generator_Cummins_OM_Manual.pdf",            sizeMb: 11.4, suggested: "om_manuals" },
    ],
  },
  {
    folder: "Warranties",
    docs: [
      { id: "pd-35", name: "Elevator_Otis_5yr_Warranty.pdf",             sizeMb:  0.6, suggested: "warranties" },
      { id: "pd-36", name: "Glazing_Pilkington_10yr_Warranty.pdf",       sizeMb:  0.8, suggested: "warranties" },
    ],
  },
  {
    folder: "Drawings / As-Built",
    docs: [
      { id: "pd-44", name: "AB-E_Electrical_AsBuilt_Set.pdf",            sizeMb: 31.2, suggested: "as_builts" },
      { id: "pd-45", name: "AB-P_Plumbing_AsBuilt_Set.pdf",              sizeMb: 24.8, suggested: "as_builts" },
      { id: "pd-46", name: "AB-FP_FireProtection_AsBuilt_Set.pdf",       sizeMb: 19.6, suggested: "as_builts" },
    ],
  },
  {
    folder: "Permits & Approvals",
    docs: [
      { id: "pd-53", name: "Mechanical_Permit_Closure.pdf",              sizeMb:  1.4, suggested: "permits_final" },
      { id: "pd-54", name: "Plumbing_Permit_Closure.pdf",                sizeMb:  1.0, suggested: "permits_final" },
      { id: "pd-55", name: "Occupancy_Permit_Final.pdf",                 sizeMb:  2.1, suggested: "permits_final" },
    ],
  },
  {
    folder: "Testing & Commissioning",
    docs: [
      { id: "pd-61", name: "TAB_Report_Final.pdf",                       sizeMb:  4.8, suggested: "testing_certificates" },
      { id: "pd-62", name: "Cx_HVAC_Functional_Test_Report.pdf",         sizeMb:  6.2, suggested: "testing_certificates" },
      { id: "pd-63", name: "Fire_Alarm_Verification_Cert.pdf",           sizeMb:  1.3, suggested: "testing_certificates" },
      { id: "pd-64", name: "Sprinkler_Hydro_Test_Cert.pdf",              sizeMb:  0.9, suggested: "testing_certificates" },
    ],
  },
  {
    folder: "CAD / BIM",
    docs: [
      { id: "pd-71", name: "Riverside_Final_Architectural.rvt",          sizeMb: 188.4, suggested: "cad_files" },
      { id: "pd-72", name: "Riverside_Final_Structural.rvt",             sizeMb: 102.1, suggested: "cad_files" },
      { id: "pd-73", name: "Riverside_Final_MEP.rvt",                    sizeMb: 156.2, suggested: "cad_files" },
    ],
  },
  {
    folder: "Other / Closeout misc",
    docs: [
      { id: "pd-81", name: "Training_Sign-off_Sheets.pdf",               sizeMb:  2.4, suggested: "other" },
      { id: "pd-82", name: "Spare_Parts_Inventory.xlsx",                 sizeMb:  0.4, suggested: "other" },
    ],
  },
];

// ─── Recent activity (workspace rail + per-package audit) ────────────────
const activity = [
  { who: "Dan Carter",     org: "Hammerline Build",  action: "added 4 documents",       target: "CO-2026-0003 · O&M Manuals",     when: "Apr 24 · 11:08 AM", kind: "add" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "added section",           target: "CO-2026-0003 · Testing & Commissioning", when: "Apr 24 · 10:42 AM", kind: "add" },
  { who: "Marie LaForge",  org: "Glenwood Trust",    action: "accepted package",        target: "CO-2025-0014 · Glenwood Tower Refit", when: "Apr 04 · 9:42 AM",  kind: "accept" },
  { who: "Asha Patel",     org: "Northbank Holdings",action: "viewed package",          target: "CO-2025-0017 · 3rd view today",       when: "Apr 23 · 2:18 PM",  kind: "view" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "delivered package",       target: "CO-2025-0017 · Northbank Mixed-Use", when: "Apr 18 · 4:20 PM",  kind: "deliver" },
  { who: "Sandra Liao",    org: "Hammerline Build",  action: "moved to internal review",target: "CO-2026-0001 · Elmcrest Medical",     when: "Apr 22 · 5:30 PM",  kind: "review" },
];

// ─── Comments on the hero (delivered) Northbank package, for client view ──
// Used in the client review screen to demonstrate threaded comments.
const heroComments = [
  { id: "cm-1", scope: "item",    targetId: "ni-3",  author: "Asha Patel",   org: "Northbank Holdings", body: "Can we get the Bell & Gossett warranty start date confirmed? It looks like the substantial completion date but I want to verify before filing.", when: "Apr 22 · 9:14 AM", resolved: false },
  { id: "cm-2", scope: "item",    targetId: "ni-7",  author: "Asha Patel",   org: "Northbank Holdings", body: "Are the as-built electrical drawings the final approved set, or do they reflect the panel relocation that happened in March?",                       when: "Apr 22 · 9:18 AM", resolved: false },
  { id: "cm-3", scope: "package", targetId: null,    author: "Asha Patel",   org: "Northbank Holdings", body: "Overall the package looks complete. Once the two questions above are answered I'll proceed with sign-off.",                                            when: "Apr 22 · 9:22 AM", resolved: false },
];

// ─── Hero "delivered" package sections (Northbank — for client view) ──────
// Smaller version used to render the client review screen against a real
// delivered package. This is what the owner sees.
const northbankSections = [
  {
    id: "ns-1", type: "om_manuals",           customLabel: null, items: [
      { id: "ni-1",  name: "HVAC_Trane_RTAC_OM_Manual.pdf",          sizeMb: 18.0, notes: "Single chiller unit." },
      { id: "ni-2",  name: "Pumps_BG_OM_Combined.pdf",                sizeMb: 11.4, notes: "" },
    ],
  },
  {
    id: "ns-2", type: "warranties",           customLabel: null, items: [
      { id: "ni-3",  name: "Pump_BG_5yr_Warranty.pdf",                sizeMb:  0.6, notes: "Warranty start: substantial completion." },
      { id: "ni-4",  name: "Roofing_Soprema_20yr_Warranty.pdf",       sizeMb:  1.4, notes: "" },
      { id: "ni-5",  name: "Hammerline_GC_2yr_Workmanship.pdf",       sizeMb:  0.4, notes: "" },
    ],
  },
  {
    id: "ns-3", type: "as_builts",            customLabel: null, items: [
      { id: "ni-6",  name: "AB-A_Architectural_AsBuilt.pdf",          sizeMb: 38.4, notes: "Final field set." },
      { id: "ni-7",  name: "AB-E_Electrical_AsBuilt.pdf",             sizeMb: 28.2, notes: "Reflects panel relocation Mar 12." },
      { id: "ni-8",  name: "AB-M_Mechanical_AsBuilt.pdf",             sizeMb: 26.1, notes: "" },
    ],
  },
  {
    id: "ns-4", type: "permits_final",        customLabel: null, items: [
      { id: "ni-9",  name: "Building_Permit_Closure.pdf",             sizeMb:  1.6, notes: "" },
      { id: "ni-10", name: "Occupancy_Permit.pdf",                    sizeMb:  2.0, notes: "Issued Apr 14." },
    ],
  },
  {
    id: "ns-5", type: "testing_certificates", customLabel: null, items: [
      { id: "ni-11", name: "TAB_Report.pdf",                          sizeMb:  4.4, notes: "" },
      { id: "ni-12", name: "Fire_Alarm_Verification.pdf",             sizeMb:  1.2, notes: "" },
      { id: "ni-13", name: "Sprinkler_Hydro_Test.pdf",                sizeMb:  0.8, notes: "" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════════════════════
const I = {
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  chevR:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevD:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  send:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>,
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  doc:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  folder:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2a2 2 0 0 0-1.7-.9H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/></svg>,
  zip:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>,
  clock:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  list:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  edit:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  trash:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  drag:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9"  cy="6"  r="1"/><circle cx="9"  cy="12" r="1"/><circle cx="9"  cy="18" r="1"/><circle cx="15" cy="6"  r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>,
  pkg:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  shield:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>,
  comment:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  sparkle:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
  pen:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
  building: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>,
  user:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  award:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
};

// ─── Logo ────────────────────────────────────────────────────────────────
const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="6" y="6" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity=".6" />
    <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" opacity=".28" />
  </svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────
const statusLabel = (s) => ({ building: "Building", review: "Review", delivered: "Delivered", accepted: "Accepted" }[s] || s);
const statusVerb  = (s) => ({ building: "in progress", review: "internal review", delivered: "awaiting client", accepted: "signed off" }[s] || s);
const initials = (name) => (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const fmtSize = (mb) => (mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(mb * 1000)} KB`);
const fmtSizeBig = (mb) => (mb >= 1000 ? `${(mb/1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ═══════════════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ─── View / role state ──────────────────────────────────────────────
  const [roleView, setRoleView]     = useState("contractor");        // contractor | client
  const [view, setView]             = useState("workspace");         // workspace | builder | clientList | clientReview
  const [selectedPackageId, setSel] = useState("cp-1");              // hero is in 'building' state
  const [statusFilter, setStatus]   = useState("all");
  const [search, setSearch]         = useState("");
  const [dark, setDark]             = useState(false);

  // ─── Builder-view state (sections + items, fully wired) ─────────────
  const [sections, setSections]     = useState(heroSections);
  const [editingItemId, setEditing] = useState(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [activeDragDocId, setDrag]  = useState(null);
  const [dropTargetSecId, setDrop]  = useState(null);
  const [docPickerSearch, setDPS]   = useState("");
  const [pickerFolderOpen, setPFO]  = useState(
    Object.fromEntries(projectDocLibrary.map((f) => [f.folder, true]))
  );

  // Items already in the package — used to filter the doc picker so the
  // contractor doesn't add duplicates.
  const usedDocIds = useMemo(
    () => new Set(sections.flatMap((s) => s.items.map((i) => i.docId))),
    [sections]
  );

  // ─── Section management ─────────────────────────────────────────────
  const [showAddSection, setShowAddSection] = useState(false);
  const availableSectionTypes = useMemo(() => {
    const used = new Set(sections.map((s) => s.type));
    // 'other' can be added repeatedly
    return Object.keys(sectionTypes).filter((t) => t === "other" || !used.has(t));
  }, [sections]);

  // ─── Modals ─────────────────────────────────────────────────────────
  const [showDeliverModal, setShowDeliver] = useState(false);
  const [showAcceptModal, setShowAccept]   = useState(false);
  const [acceptComment, setAcceptComment]  = useState("");
  const [acceptSigner, setAcceptSigner]    = useState("Asha Patel");

  // ─── Comments (client-side review demo) ─────────────────────────────
  const [comments, setComments] = useState(heroComments);
  const [newCommentItemId, setNewCommentItemId] = useState(null);
  const [newCommentText, setNewCommentText]     = useState("");

  // ─── Derived ────────────────────────────────────────────────────────
  const currentPackage = useMemo(
    () => closeoutPackages.find((p) => p.id === selectedPackageId) || closeoutPackages[0],
    [selectedPackageId]
  );

  const filteredPackages = useMemo(() => {
    let rows = closeoutPackages;
    if (statusFilter !== "all") rows = rows.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.num.toLowerCase().includes(q) ||
          p.projectName.toLowerCase().includes(q) ||
          p.projectClient.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [statusFilter, search]);

  // KPIs
  const kpiTotal     = closeoutPackages.length;
  const kpiBuilding  = closeoutPackages.filter((p) => p.status === "building").length;
  const kpiReview    = closeoutPackages.filter((p) => p.status === "review").length;
  const kpiDelivered = closeoutPackages.filter((p) => p.status === "delivered").length;
  const kpiAccepted  = closeoutPackages.filter((p) => p.status === "accepted").length;

  const isClient = roleView === "client";

  // Builder rollups
  const totalItems = sections.reduce((a, s) => a + s.items.length, 0);
  const totalSize  = sections.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + (i.sizeMb || 0), 0),
    0
  );

  // ─── Drag-and-drop handlers ─────────────────────────────────────────
  const onDragStart = (e, docId) => {
    setDrag(docId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", docId);
    }
  };
  const onDragEnd = () => { setDrag(null); setDrop(null); };
  const onDragOverSection = (e, secId) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    if (dropTargetSecId !== secId) setDrop(secId);
  };
  const onDragLeaveSection = (e, secId) => {
    // only clear if leaving the actual element (rough heuristic — fine for demo)
    if (dropTargetSecId === secId) setDrop(null);
  };
  const onDropSection = (e, secId) => {
    e.preventDefault();
    const docId = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || activeDragDocId;
    if (!docId) return;
    addDocToSection(secId, docId);
    setDrag(null); setDrop(null);
  };

  // ─── Item / section mutations ───────────────────────────────────────
  const addDocToSection = (secId, docId) => {
    if (usedDocIds.has(docId)) return;
    const doc = projectDocLibrary.flatMap((f) => f.docs).find((d) => d.id === docId);
    if (!doc) return;
    setSections((ss) =>
      ss.map((s) =>
        s.id === secId
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  id: `it-new-${Date.now()}`,
                  docId,
                  name: doc.name,
                  sizeMb: doc.sizeMb,
                  notes: "",
                  isNew: true,
                },
              ],
            }
          : s
      )
    );
  };
  const removeItem = (secId, itemId) => {
    setSections((ss) =>
      ss.map((s) =>
        s.id === secId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s
      )
    );
  };
  const startEditingNotes = (item) => {
    setEditing(item.id);
    setDraftNotes(item.notes || "");
  };
  const saveNotes = (secId, itemId) => {
    setSections((ss) =>
      ss.map((s) =>
        s.id === secId
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, notes: draftNotes } : i)) }
          : s
      )
    );
    setEditing(null);
    setDraftNotes("");
  };
  const addSection = (type) => {
    setSections((ss) => [
      ...ss,
      {
        id: `sec-new-${Date.now()}`,
        type,
        customLabel: type === "other" ? "Custom" : null,
        orderIndex: ss.length + 1,
        items: [],
        isNew: true,
      },
    ]);
    setShowAddSection(false);
  };
  const removeSection = (secId) => {
    setSections((ss) => ss.filter((s) => s.id !== secId));
  };
  const renameCustomSection = (secId, label) => {
    setSections((ss) =>
      ss.map((s) => (s.id === secId ? { ...s, customLabel: label } : s))
    );
  };

  // ─── Comment helpers (client review) ────────────────────────────────
  const startNewComment = (itemId) => {
    setNewCommentItemId(itemId);
    setNewCommentText("");
  };
  const submitComment = () => {
    if (!newCommentText.trim()) return;
    setComments((cs) => [
      ...cs,
      {
        id: `cm-new-${Date.now()}`,
        scope: "item",
        targetId: newCommentItemId,
        author: acceptSigner,
        org: "Northbank Holdings",
        body: newCommentText,
        when: "Just now",
        resolved: false,
      },
    ]);
    setNewCommentItemId(null);
    setNewCommentText("");
  };
  const commentsForItem = (itemId) => comments.filter((c) => c.scope === "item" && c.targetId === itemId);
  const packageComments = comments.filter((c) => c.scope === "package");
  const openItemComments = comments.filter((c) => c.scope === "item" && !c.resolved).length;

  // ─── Filtered doc picker ────────────────────────────────────────────
  const filteredLibrary = useMemo(() => {
    if (!docPickerSearch.trim()) return projectDocLibrary;
    const q = docPickerSearch.toLowerCase();
    return projectDocLibrary
      .map((folder) => ({
        ...folder,
        docs: folder.docs.filter((d) => d.name.toLowerCase().includes(q)),
      }))
      .filter((f) => f.docs.length > 0);
  }, [docPickerSearch]);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{CSS}</style>

      <div className={`cp-root${dark ? " cp-dark" : ""}`}>
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TOP BAR                                                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <header className="cp-topbar">
          <div className="cp-brand">
            <LogoMark />
            <span className="cp-brand-name">BuiltCRM</span>
          </div>

          {!isClient && (
            <div className="cp-crumbs">
              <strong>{view === "builder" ? currentPackage.projectName : "All projects"}</strong>
              {I.chevR}
              <span>Closeout</span>
              {view === "builder" && (
                <>
                  {I.chevR}
                  <strong>{currentPackage.num}</strong>
                </>
              )}
            </div>
          )}
          {isClient && (
            <div className="cp-crumbs">
              <span className="cp-portal-pill">{I.user} Owner Portal</span>
              {view === "clientReview" && (
                <>
                  {I.chevR}
                  <strong>Northbank Mixed-Use</strong>
                  {I.chevR}
                  <span>Closeout package</span>
                </>
              )}
            </div>
          )}

          <div className="cp-top-spacer" />

          <div className="cp-role-toggle">
            <button
              className={roleView === "contractor" ? "active" : ""}
              onClick={() => { setRoleView("contractor"); setView("workspace"); }}
            >
              Contractor
            </button>
            <button
              className={roleView === "client" ? "active" : ""}
              onClick={() => { setRoleView("client"); setView("clientList"); }}
            >
              {I.user} Client / Owner
            </button>
          </div>

          <button className="cp-topbtn" aria-label="Notifications">
            {I.bell}
            <span className="cp-topbtn-dot" />
          </button>

          <div className="cp-user">
            <div className="cp-user-avatar">{isClient ? "AP" : "DC"}</div>
            <div className="cp-user-info">
              <div className="cp-user-name">{isClient ? "Asha Patel" : "Dan Carter"}</div>
              <div className="cp-user-org">{isClient ? "Northbank Holdings" : "Hammerline Build"}</div>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SHELL                                                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="cp-shell">
          {/* ─── Sidebar (contractor workspace + builder) ────────────── */}
          {!isClient && view !== "builder" && (
            <aside className="cp-sidebar">
              <div className="cp-side-section">Closeout</div>
              <button
                className={`cp-side-item${view === "workspace" ? " active" : ""}`}
                onClick={() => setView("workspace")}
              >
                {I.list} All packages <span className="cp-side-count">{kpiTotal}</span>
              </button>

              <div className="cp-side-section" style={{ marginTop: 10 }}>Status</div>
              {[
                { key: "all",       label: "All",       count: kpiTotal,     icon: I.pkg },
                { key: "building",  label: "Building",  count: kpiBuilding,  icon: I.edit },
                { key: "review",    label: "Review",    count: kpiReview,    icon: I.shield },
                { key: "delivered", label: "Delivered", count: kpiDelivered, icon: I.send },
                { key: "accepted",  label: "Accepted",  count: kpiAccepted,  icon: I.check },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`cp-side-item${statusFilter === f.key && view === "workspace" ? " active" : ""}`}
                  onClick={() => { setStatus(f.key); setView("workspace"); }}
                >
                  {f.icon} {f.label} <span className="cp-side-count">{f.count}</span>
                </button>
              ))}

              <div className="cp-side-section" style={{ marginTop: 14 }}>About</div>
              <div className="cp-side-help">
                <p>
                  Closeout packages bundle <strong>O&amp;M manuals</strong>,
                  <strong> warranties</strong>, <strong>as-builts</strong>,
                  permits, and testing records into a single deliverable for
                  the owner.
                </p>
                <p>
                  On client acceptance, the project transitions to{" "}
                  <strong>Closed</strong> and the audit log captures the
                  sign-off.
                </p>
              </div>
            </aside>
          )}

          {/* ─── Main content ──────────────────────────────────────── */}
          <main className={`cp-main${isClient ? " cp-main-client" : ""}${view === "builder" ? " cp-main-builder" : ""}`}>
            <div className={`cp-content${view === "builder" ? " cp-content-builder" : ""}`}>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: WORKSPACE (contractor — list of all packages)      */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "workspace" && !isClient && (
                <>
                  <div className="cp-page-hdr">
                    <div>
                      <h1 className="cp-page-title">Closeout packages</h1>
                      <div className="cp-page-sub">
                        Final handover deliverables — O&amp;M manuals, warranties,
                        as-builts, permits, and testing records bundled per project.
                        {kpiBuilding + kpiReview > 0 && (
                          <> <strong>{kpiBuilding + kpiReview}</strong> active across the portfolio.</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KPI strip */}
                  <div className="cp-kpi-strip">
                    <div className="cp-kpi">
                      <div className="cp-kpi-label">In progress</div>
                      <div className="cp-kpi-value">{kpiBuilding}</div>
                      <div className="cp-kpi-sub">currently building</div>
                    </div>
                    <div className="cp-kpi">
                      <div className="cp-kpi-label">Internal review</div>
                      <div className="cp-kpi-value">{kpiReview}</div>
                      <div className="cp-kpi-sub">QA before send</div>
                    </div>
                    <div className="cp-kpi">
                      <div className="cp-kpi-label">Delivered</div>
                      <div className={`cp-kpi-value${kpiDelivered > 0 ? " accent" : ""}`}>{kpiDelivered}</div>
                      <div className="cp-kpi-sub">awaiting client sign-off</div>
                    </div>
                    <div className="cp-kpi">
                      <div className="cp-kpi-label">Accepted</div>
                      <div className="cp-kpi-value ok">{kpiAccepted}</div>
                      <div className="cp-kpi-sub">projects closed out</div>
                    </div>
                  </div>

                  {/* Filter / search */}
                  <div className="cp-filter-bar">
                    <div className="cp-search">
                      {I.search}
                      <input
                        type="text"
                        placeholder="Search by package number, project, or client…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Workspace grid: package cards + activity rail */}
                  <div className="cp-workspace-grid">
                    <div className="cp-package-grid">
                      {filteredPackages.length === 0 && (
                        <div className="cp-empty">
                          <div className="cp-empty-icon">{I.pkg}</div>
                          <div className="cp-empty-title">No packages match</div>
                          <div className="cp-empty-sub">Try clearing the filter or search.</div>
                        </div>
                      )}
                      {filteredPackages.map((p) => (
                        <button
                          key={p.id}
                          className={`cp-pkg-card status-${p.status}`}
                          onClick={() => {
                            setSel(p.id);
                            // Only the actively-building hero opens the live builder.
                            // Others open a builder in their own state. For demo
                            // purposes we route everything to builder; in
                            // production each state has different affordances.
                            setView("builder");
                          }}
                        >
                          <div className="cp-pkg-card-hdr">
                            <span className={`cp-status-pill ${p.status}`}>
                              {p.status === "building" && I.edit}
                              {p.status === "review" && I.shield}
                              {p.status === "delivered" && I.send}
                              {p.status === "accepted" && I.check}
                              {statusLabel(p.status)}
                            </span>
                            <span className="cp-pkg-num">{p.num}</span>
                          </div>
                          <div className="cp-pkg-card-body">
                            <div className="cp-pkg-project-name">{p.projectName}</div>
                            <div className="cp-pkg-project-meta">
                              <span>{I.building}{p.projectClient}</span>
                              <span className="cp-pkg-project-addr">{p.projectAddress}</span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="cp-pkg-progress">
                            <div className="cp-pkg-progress-row">
                              <span className="cp-pkg-progress-label">
                                {p.status === "accepted" ? "Final" : "Completion"}
                              </span>
                              <span className="cp-pkg-progress-pct">{p.completionPct}%</span>
                            </div>
                            <div className="cp-pkg-progress-track">
                              <div
                                className={`cp-pkg-progress-fill status-${p.status}`}
                                style={{ width: `${p.completionPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="cp-pkg-card-stats">
                            <div className="cp-pkg-stat">
                              <span className="cp-pkg-stat-value">{p.sectionsCount}</span>
                              <span className="cp-pkg-stat-label">sections</span>
                            </div>
                            <div className="cp-pkg-stat">
                              <span className="cp-pkg-stat-value">{p.docsCount}</span>
                              <span className="cp-pkg-stat-label">documents</span>
                            </div>
                            <div className="cp-pkg-stat">
                              <span className="cp-pkg-stat-value">{fmtSizeBig(p.sizeMb)}</span>
                              <span className="cp-pkg-stat-label">bundle</span>
                            </div>
                          </div>

                          {/* Footer line */}
                          <div className="cp-pkg-card-ftr">
                            {p.status === "building" && p.targetDeliveryDate && (
                              <span>{I.clock} Target delivery {p.targetDeliveryDate}</span>
                            )}
                            {p.status === "review" && (
                              <span>{I.shield} Internal QA in progress</span>
                            )}
                            {p.status === "delivered" && p.deliveredAt && (
                              <span>{I.send} Delivered {p.deliveredAt}</span>
                            )}
                            {p.status === "accepted" && p.acceptedAt && (
                              <span className="cp-pkg-accepted">
                                {I.award} Accepted by {p.acceptedBy} · {p.acceptedAt}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    <aside className="cp-rail">
                      <div className="cp-rail-hdr">
                        <h3>Recent activity</h3>
                      </div>
                      <div className="cp-rail-body">
                        {activity.map((a, idx) => (
                          <div key={idx} className="cp-rail-item">
                            <div className={`cp-rail-avatar ${a.kind}`}>
                              {a.kind === "accept" ? I.award :
                               a.kind === "deliver" ? I.send :
                               a.kind === "view" ? I.user :
                               a.kind === "review" ? I.shield :
                               initials(a.who)}
                            </div>
                            <div className="cp-rail-item-body">
                              <div className="cp-rail-item-text">
                                <strong>{a.who}</strong> {a.action}
                              </div>
                              {a.target && <div className="cp-rail-item-target">{a.target}</div>}
                              <div className="cp-rail-item-when">{a.when}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: BUILDER (contractor — assembling package)          */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "builder" && !isClient && currentPackage && (
                <>
                  <div className="cp-builder-hdr">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        className="cp-btn sm ghost"
                        onClick={() => setView("workspace")}
                      >
                        {I.back} All packages
                      </button>
                    </div>
                    <div className="cp-builder-title-block">
                      <div className="cp-builder-title-row">
                        <span className={`cp-status-pill ${currentPackage.status}`}>
                          {currentPackage.status === "building" && I.edit}
                          {currentPackage.status === "review" && I.shield}
                          {currentPackage.status === "delivered" && I.send}
                          {currentPackage.status === "accepted" && I.check}
                          {statusLabel(currentPackage.status)}
                        </span>
                        <h1 className="cp-builder-title">{currentPackage.projectName}</h1>
                        <span className="cp-builder-num">{currentPackage.num}</span>
                      </div>
                      <div className="cp-builder-sub">
                        Closeout package {statusVerb(currentPackage.status)}.
                        {" Prepared by "}<strong>{currentPackage.preparedBy}</strong>
                        {" · "}{currentPackage.preparedByOrg}
                        {currentPackage.targetDeliveryDate && (
                          <> · Target delivery <strong>{currentPackage.targetDeliveryDate}</strong></>
                        )}
                      </div>
                    </div>
                    <div className="cp-builder-actions">
                      <button className="cp-btn sm ghost">
                        {I.zip} Preview ZIP
                      </button>
                      <button className="cp-btn sm ghost">
                        {I.doc} Generate cover letter
                      </button>
                      {currentPackage.status === "building" && (
                        <button
                          className="cp-btn sm primary"
                          onClick={() => setShowDeliver(true)}
                        >
                          {I.send} Move to review
                        </button>
                      )}
                      {currentPackage.status === "review" && (
                        <button
                          className="cp-btn sm primary"
                          onClick={() => setShowDeliver(true)}
                        >
                          {I.send} Deliver to client
                        </button>
                      )}
                      {currentPackage.status === "delivered" && (
                        <span className="cp-builder-state-note">
                          {I.clock} Awaiting client sign-off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Completion summary */}
                  <div className="cp-completion-card">
                    <div className="cp-completion-stat">
                      <div className="cp-completion-label">Sections</div>
                      <div className="cp-completion-value">{sections.length}</div>
                    </div>
                    <div className="cp-completion-divider" />
                    <div className="cp-completion-stat">
                      <div className="cp-completion-label">Documents</div>
                      <div className="cp-completion-value">{totalItems}</div>
                    </div>
                    <div className="cp-completion-divider" />
                    <div className="cp-completion-stat">
                      <div className="cp-completion-label">Bundle size</div>
                      <div className="cp-completion-value">{fmtSizeBig(totalSize)}</div>
                    </div>
                    <div className="cp-completion-divider" />
                    <div className="cp-completion-stat cp-completion-progress">
                      <div className="cp-completion-label">Completion</div>
                      <div className="cp-completion-bar">
                        <div className="cp-completion-bar-track">
                          <div
                            className="cp-completion-bar-fill"
                            style={{ width: `${currentPackage.completionPct}%` }}
                          />
                        </div>
                        <span className="cp-completion-pct">{currentPackage.completionPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Two-column builder: sections + doc picker */}
                  <div className="cp-builder-grid">
                    {/* ─── Sections column ─────────────────────── */}
                    <div className="cp-sections">
                      {sections.map((sec) => {
                        const cfg = sectionTypes[sec.type];
                        const sectionTotalSize = sec.items.reduce((a, i) => a + (i.sizeMb || 0), 0);
                        const isDropTarget = dropTargetSecId === sec.id;
                        return (
                          <div
                            key={sec.id}
                            className={`cp-section${isDropTarget ? " drop-target" : ""}`}
                            onDragOver={(e) => onDragOverSection(e, sec.id)}
                            onDragLeave={(e) => onDragLeaveSection(e, sec.id)}
                            onDrop={(e) => onDropSection(e, sec.id)}
                          >
                            <div
                              className="cp-section-hdr"
                              style={{
                                "--sec-solid": cfg.solid,
                                "--sec-soft": cfg.soft,
                              }}
                            >
                              <div className="cp-section-hdr-left">
                                <span
                                  className="cp-section-color-tag"
                                  style={{ background: cfg.solid }}
                                />
                                <div>
                                  {sec.type === "other" ? (
                                    <input
                                      type="text"
                                      className="cp-section-custom-input"
                                      value={sec.customLabel || ""}
                                      onChange={(e) => renameCustomSection(sec.id, e.target.value)}
                                      placeholder="Custom section name"
                                    />
                                  ) : (
                                    <h3 className="cp-section-name">{cfg.label}</h3>
                                  )}
                                  <div className="cp-section-desc">{cfg.desc}</div>
                                </div>
                              </div>
                              <div className="cp-section-hdr-right">
                                <span className="cp-section-count">
                                  {plural(sec.items.length, "doc", "docs")}
                                  {sectionTotalSize > 0 && <> · {fmtSize(sectionTotalSize)}</>}
                                </span>
                                <button
                                  className="cp-icon-btn danger"
                                  onClick={() => removeSection(sec.id)}
                                  title="Remove section"
                                >
                                  {I.trash}
                                </button>
                              </div>
                            </div>

                            {/* Items */}
                            <div className="cp-section-body">
                              {sec.items.length === 0 && (
                                <div className="cp-section-empty">
                                  <div className="cp-section-empty-icon">{I.doc}</div>
                                  <div className="cp-section-empty-text">
                                    No documents yet — <strong>drag from the library</strong>{" "}
                                    or click <strong>Add</strong> on the right.
                                  </div>
                                </div>
                              )}
                              {sec.items.map((item, idx) => (
                                <div
                                  key={item.id}
                                  className={`cp-item${item.isNew ? " new" : ""}`}
                                >
                                  <div className="cp-item-row">
                                    <div className="cp-item-num">#{idx + 1}</div>
                                    <div className="cp-item-thumb">{I.doc}</div>
                                    <div className="cp-item-body">
                                      <div className="cp-item-name">{item.name}</div>
                                      <div className="cp-item-meta">
                                        {fmtSize(item.sizeMb)}
                                      </div>
                                      {editingItemId === item.id ? (
                                        <div className="cp-item-notes-edit">
                                          <textarea
                                            className="cp-textarea sm"
                                            rows={2}
                                            value={draftNotes}
                                            onChange={(e) => setDraftNotes(e.target.value)}
                                            placeholder="Add notes — visible to the owner."
                                            autoFocus
                                          />
                                          <div className="cp-item-notes-actions">
                                            <button
                                              className="cp-btn xs ghost"
                                              onClick={() => { setEditing(null); setDraftNotes(""); }}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="cp-btn xs primary"
                                              onClick={() => saveNotes(sec.id, item.id)}
                                            >
                                              {I.check} Save
                                            </button>
                                          </div>
                                        </div>
                                      ) : item.notes ? (
                                        <button
                                          className="cp-item-notes"
                                          onClick={() => startEditingNotes(item)}
                                        >
                                          <span className="cp-item-notes-icon">{I.pen}</span>
                                          <span className="cp-item-notes-text">{item.notes}</span>
                                        </button>
                                      ) : (
                                        <button
                                          className="cp-item-notes-add"
                                          onClick={() => startEditingNotes(item)}
                                        >
                                          {I.plus} Add note
                                        </button>
                                      )}
                                    </div>
                                    <div className="cp-item-actions">
                                      <button
                                        className="cp-icon-btn"
                                        onClick={() => startEditingNotes(item)}
                                        title="Edit notes"
                                      >
                                        {I.edit}
                                      </button>
                                      <button
                                        className="cp-icon-btn danger"
                                        onClick={() => removeItem(sec.id, item.id)}
                                        title="Remove from package"
                                      >
                                        {I.x}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Drop hint when dragging */}
                              {activeDragDocId && (
                                <div className={`cp-drop-hint${isDropTarget ? " active" : ""}`}>
                                  {I.plus} Drop here to add to{" "}
                                  <strong>{sec.type === "other" ? sec.customLabel || "Custom" : cfg.label}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Add section */}
                      <div className="cp-add-section">
                        {!showAddSection && (
                          <button
                            className="cp-btn ghost full"
                            onClick={() => setShowAddSection(true)}
                          >
                            {I.plus} Add a section
                          </button>
                        )}
                        {showAddSection && (
                          <div className="cp-add-section-picker">
                            <div className="cp-add-section-hdr">
                              <strong>Choose a section type</strong>
                              <button
                                className="cp-btn xs ghost"
                                onClick={() => setShowAddSection(false)}
                              >
                                {I.x}
                              </button>
                            </div>
                            <div className="cp-add-section-grid">
                              {availableSectionTypes.map((t) => {
                                const cfg = sectionTypes[t];
                                return (
                                  <button
                                    key={t}
                                    className="cp-add-section-tile"
                                    onClick={() => addSection(t)}
                                  >
                                    <span
                                      className="cp-add-section-color"
                                      style={{ background: cfg.solid }}
                                    />
                                    <div className="cp-add-section-name">{cfg.label}</div>
                                    <div className="cp-add-section-desc">{cfg.desc}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ─── Doc picker column ───────────────────── */}
                    <aside className="cp-picker">
                      <div className="cp-picker-hdr">
                        <div>
                          <h3 className="cp-picker-title">{I.folder} Project documents</h3>
                          <div className="cp-picker-sub">
                            Drag onto a section, or click to add. {usedDocIds.size} of {projectDocLibrary.flatMap((f)=>f.docs).length} added.
                          </div>
                        </div>
                      </div>
                      <div className="cp-picker-search">
                        {I.search}
                        <input
                          type="text"
                          placeholder="Search documents…"
                          value={docPickerSearch}
                          onChange={(e) => setDPS(e.target.value)}
                        />
                      </div>
                      <div className="cp-picker-body">
                        {filteredLibrary.map((folder) => (
                          <div key={folder.folder} className="cp-picker-folder">
                            <button
                              className="cp-picker-folder-hdr"
                              onClick={() =>
                                setPFO((o) => ({ ...o, [folder.folder]: !o[folder.folder] }))
                              }
                            >
                              <span
                                className="cp-picker-folder-chev"
                                data-open={pickerFolderOpen[folder.folder]}
                              >
                                {I.chevR}
                              </span>
                              {I.folder}
                              <span className="cp-picker-folder-name">{folder.folder}</span>
                              <span className="cp-picker-folder-count">{folder.docs.length}</span>
                            </button>
                            {pickerFolderOpen[folder.folder] && (
                              <div className="cp-picker-docs">
                                {folder.docs.map((d) => {
                                  const used = usedDocIds.has(d.id);
                                  const targetSec = sections.find((s) => s.type === d.suggested);
                                  return (
                                    <div
                                      key={d.id}
                                      className={`cp-picker-doc${used ? " used" : ""}${
                                        activeDragDocId === d.id ? " dragging" : ""
                                      }`}
                                      draggable={!used}
                                      onDragStart={(e) => onDragStart(e, d.id)}
                                      onDragEnd={onDragEnd}
                                    >
                                      <span className="cp-picker-doc-grip">{I.drag}</span>
                                      <div className="cp-picker-doc-body">
                                        <div className="cp-picker-doc-name">{d.name}</div>
                                        <div className="cp-picker-doc-meta">
                                          <span>{fmtSize(d.sizeMb)}</span>
                                          {d.suggested && !used && (
                                            <span
                                              className="cp-picker-suggest-chip"
                                              style={{
                                                background: sectionTypes[d.suggested].soft,
                                                color: sectionTypes[d.suggested].solid,
                                              }}
                                            >
                                              {I.sparkle}
                                              {sectionTypes[d.suggested].short}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {used ? (
                                        <span className="cp-picker-doc-status added">
                                          {I.check} Added
                                        </span>
                                      ) : (
                                        <button
                                          className="cp-picker-doc-add"
                                          onClick={() => {
                                            if (targetSec) addDocToSection(targetSec.id, d.id);
                                            else if (sections[0]) addDocToSection(sections[0].id, d.id);
                                          }}
                                          disabled={!targetSec && sections.length === 0}
                                          title={
                                            targetSec
                                              ? `Add to ${sectionTypes[targetSec.type].label}`
                                              : "Add to first section"
                                          }
                                        >
                                          {I.plus}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                        {filteredLibrary.length === 0 && (
                          <div className="cp-empty sm">
                            <div className="cp-empty-sub">No documents match.</div>
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: CLIENT LIST (owner sees their packages)            */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "clientList" && isClient && (
                <div className="cp-client-page">
                  <div className="cp-client-hdr">
                    <h1 className="cp-client-title">Project closeout</h1>
                    <p className="cp-client-sub">
                      Hammerline Build has shared the closeout package for your
                      project. Review the documents below, leave comments where
                      needed, and sign off when you're satisfied.
                    </p>
                  </div>

                  <div className="cp-client-pkg-list">
                    {/* Active delivered package — primary CTA */}
                    <div
                      className="cp-client-pkg cp-client-pkg-active"
                      onClick={() => setView("clientReview")}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="cp-client-pkg-hdr">
                        <span className="cp-status-pill delivered">
                          {I.send} Delivered — awaiting your review
                        </span>
                        <span className="cp-client-pkg-num">CO-2025-0017</span>
                      </div>
                      <h2 className="cp-client-pkg-name">Northbank Mixed-Use</h2>
                      <div className="cp-client-pkg-meta">
                        88 Lakeshore Blvd, Mississauga, ON · Delivered Apr 18, 2026
                      </div>
                      <div className="cp-client-pkg-stats">
                        <div><strong>7</strong> sections</div>
                        <div><strong>34</strong> documents</div>
                        <div><strong>403 MB</strong> bundle</div>
                        {openItemComments > 0 && (
                          <div className="cp-client-pkg-comments-chip">
                            {I.comment} {openItemComments} open question{openItemComments === 1 ? "" : "s"}
                          </div>
                        )}
                      </div>
                      <div className="cp-client-pkg-cta">
                        Open and review {I.chevR}
                      </div>
                    </div>

                    {/* Already-accepted historical package */}
                    <div className="cp-client-pkg cp-client-pkg-archived">
                      <div className="cp-client-pkg-hdr">
                        <span className="cp-status-pill accepted">
                          {I.check} Accepted Apr 4, 2026
                        </span>
                        <span className="cp-client-pkg-num">CO-2025-0014</span>
                      </div>
                      <h2 className="cp-client-pkg-name">Glenwood Tower Refit</h2>
                      <div className="cp-client-pkg-meta">
                        402 Bay St, Toronto, ON · Project closed
                      </div>
                      <div className="cp-client-pkg-stats">
                        <div><strong>6</strong> sections</div>
                        <div><strong>29</strong> documents</div>
                        <div><strong>308 MB</strong> bundle</div>
                      </div>
                      <button className="cp-btn sm ghost">
                        {I.download} Download archive
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* VIEW: CLIENT REVIEW (owner — review + accept the pkg)    */}
              {/* ═══════════════════════════════════════════════════════ */}
              {view === "clientReview" && isClient && (
                <div className="cp-client-review">
                  <div className="cp-page-hdr">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        className="cp-btn sm ghost"
                        onClick={() => setView("clientList")}
                      >
                        {I.back} Back
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="cp-btn sm ghost">
                        {I.download} Download full ZIP (403 MB)
                      </button>
                      <button
                        className="cp-btn sm primary"
                        onClick={() => setShowAccept(true)}
                      >
                        {I.award} Accept package
                      </button>
                    </div>
                  </div>

                  {/* Review header */}
                  <div className="cp-review-hdr">
                    <div className="cp-review-hdr-top">
                      <span className="cp-status-pill delivered">
                        {I.send} Delivered Apr 18, 2026
                      </span>
                      <span className="cp-review-num">CO-2025-0017</span>
                    </div>
                    <h2 className="cp-review-subject">
                      Closeout package — Northbank Mixed-Use
                    </h2>
                    <p className="cp-review-msg">
                      Asha — attached is the complete closeout package for the
                      Northbank Mixed-Use project. Please review each section
                      and let us know if anything needs clarification before
                      sign-off. Once you accept, we'll close out the project on
                      our end and final invoicing will release.
                    </p>
                    <div className="cp-review-signoff-from">
                      — Dan Carter, Hammerline Build
                    </div>

                    <div className="cp-review-stat-row">
                      <div className="cp-review-stat">
                        <div className="cp-review-stat-label">Sections</div>
                        <div className="cp-review-stat-value">{northbankSections.length}</div>
                      </div>
                      <div className="cp-review-stat">
                        <div className="cp-review-stat-label">Documents</div>
                        <div className="cp-review-stat-value">
                          {northbankSections.reduce((a, s) => a + s.items.length, 0)}
                        </div>
                      </div>
                      <div className="cp-review-stat">
                        <div className="cp-review-stat-label">Bundle</div>
                        <div className="cp-review-stat-value">
                          {fmtSizeBig(northbankSections.reduce((a, s) => a + s.items.reduce((b, i) => b + i.sizeMb, 0), 0))}
                        </div>
                      </div>
                      <div className="cp-review-stat">
                        <div className="cp-review-stat-label">Open questions</div>
                        <div className={`cp-review-stat-value${openItemComments > 0 ? " warn" : ""}`}>
                          {openItemComments}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Package-level comment thread */}
                  {packageComments.length > 0 && (
                    <div className="cp-review-pkg-comments">
                      <div className="cp-review-pkg-comments-hdr">
                        {I.comment} Overall comments
                      </div>
                      {packageComments.map((c) => (
                        <div key={c.id} className="cp-review-comment">
                          <div className="cp-review-comment-avatar">{initials(c.author)}</div>
                          <div className="cp-review-comment-body">
                            <div className="cp-review-comment-meta">
                              <strong>{c.author}</strong>
                              <span className="cp-review-comment-org">· {c.org}</span>
                              <span className="cp-review-comment-when">{c.when}</span>
                            </div>
                            <div className="cp-review-comment-text">{c.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sections — read-only with comment affordance */}
                  <div className="cp-review-sections">
                    {northbankSections.map((sec) => {
                      const cfg = sectionTypes[sec.type];
                      return (
                        <div key={sec.id} className="cp-review-section">
                          <div
                            className="cp-review-section-hdr"
                            style={{ "--sec-solid": cfg.solid, "--sec-soft": cfg.soft }}
                          >
                            <span
                              className="cp-section-color-tag"
                              style={{ background: cfg.solid }}
                            />
                            <h3 className="cp-section-name">{cfg.label}</h3>
                            <span className="cp-section-count">
                              {plural(sec.items.length, "doc", "docs")}
                            </span>
                          </div>
                          <div className="cp-review-section-body">
                            {sec.items.map((item) => {
                              const itemComments = commentsForItem(item.id);
                              const isAddingComment = newCommentItemId === item.id;
                              return (
                                <div key={item.id} className="cp-review-item">
                                  <div className="cp-review-item-row">
                                    <div className="cp-item-thumb">{I.doc}</div>
                                    <div className="cp-review-item-body">
                                      <div className="cp-review-item-name">{item.name}</div>
                                      <div className="cp-review-item-meta">
                                        {fmtSize(item.sizeMb)}
                                      </div>
                                      {item.notes && (
                                        <div className="cp-review-item-note">
                                          <span className="cp-review-item-note-icon">{I.pen}</span>
                                          {item.notes}
                                        </div>
                                      )}
                                    </div>
                                    <div className="cp-review-item-actions">
                                      <button className="cp-btn xs ghost">
                                        {I.download} Open
                                      </button>
                                      <button
                                        className={`cp-btn xs ghost${itemComments.length > 0 ? " has-comments" : ""}`}
                                        onClick={() => startNewComment(item.id)}
                                      >
                                        {I.comment}
                                        {itemComments.length > 0 && (
                                          <span className="cp-comment-count">
                                            {itemComments.length}
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Comment thread for this item */}
                                  {(itemComments.length > 0 || isAddingComment) && (
                                    <div className="cp-review-item-comments">
                                      {itemComments.map((c) => (
                                        <div key={c.id} className="cp-review-comment small">
                                          <div className="cp-review-comment-avatar">{initials(c.author)}</div>
                                          <div className="cp-review-comment-body">
                                            <div className="cp-review-comment-meta">
                                              <strong>{c.author}</strong>
                                              <span className="cp-review-comment-when">{c.when}</span>
                                            </div>
                                            <div className="cp-review-comment-text">{c.body}</div>
                                          </div>
                                        </div>
                                      ))}
                                      {isAddingComment && (
                                        <div className="cp-comment-compose">
                                          <textarea
                                            className="cp-textarea sm"
                                            rows={2}
                                            placeholder="Ask a question or note an issue…"
                                            value={newCommentText}
                                            onChange={(e) => setNewCommentText(e.target.value)}
                                            autoFocus
                                          />
                                          <div className="cp-comment-compose-actions">
                                            <button
                                              className="cp-btn xs ghost"
                                              onClick={() => { setNewCommentItemId(null); setNewCommentText(""); }}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="cp-btn xs primary"
                                              onClick={submitComment}
                                              disabled={!newCommentText.trim()}
                                            >
                                              {I.send} Post
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sticky accept bar */}
                  <div className="cp-review-accept-bar">
                    <div className="cp-review-accept-text">
                      <strong>Ready to sign off?</strong> Accepting this package
                      transitions the project to <strong>Closed</strong> and
                      releases final invoicing. The audit log captures your
                      acceptance.
                    </div>
                    <button
                      className="cp-btn primary lg"
                      onClick={() => setShowAccept(true)}
                    >
                      {I.award} Accept package
                    </button>
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL: DELIVER (contractor — moves package to client)            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showDeliverModal && !isClient && (
          <div className="cp-modal-backdrop" onClick={() => setShowDeliver(false)}>
            <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cp-modal-hdr">
                <div>
                  <h2 className="cp-modal-title">
                    {currentPackage.status === "building"
                      ? "Move to internal review"
                      : "Deliver to client"}
                  </h2>
                  <div className="cp-modal-sub">
                    {currentPackage.status === "building"
                      ? "Lock further edits and route to your team for QA before sending to the owner."
                      : <>Send <strong>{currentPackage.num}</strong> to <strong>{currentPackage.projectClientLead}</strong> at <strong>{currentPackage.projectClient}</strong>.</>
                    }
                  </div>
                </div>
                <button
                  className="cp-btn xs ghost"
                  onClick={() => setShowDeliver(false)}
                >
                  {I.x}
                </button>
              </div>

              <div className="cp-modal-body">
                <div className="cp-deliver-summary">
                  <div className="cp-deliver-row">
                    <span className="cp-deliver-label">Project</span>
                    <span className="cp-deliver-value">{currentPackage.projectName}</span>
                  </div>
                  <div className="cp-deliver-row">
                    <span className="cp-deliver-label">Bundle</span>
                    <span className="cp-deliver-value">
                      {sections.length} sections · {totalItems} documents · {fmtSizeBig(totalSize)}
                    </span>
                  </div>
                  {currentPackage.status === "review" && (
                    <>
                      <div className="cp-deliver-row">
                        <span className="cp-deliver-label">Recipient</span>
                        <span className="cp-deliver-value">
                          {currentPackage.projectClientLead} · {currentPackage.projectClient}
                        </span>
                      </div>
                      <div className="cp-deliver-row">
                        <span className="cp-deliver-label">Delivery</span>
                        <span className="cp-deliver-value">
                          Email + client portal notification
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {currentPackage.status === "review" && (
                  <label className="cp-field">
                    <span className="cp-field-label">Cover note (optional)</span>
                    <textarea
                      className="cp-textarea"
                      rows={4}
                      placeholder="Any final notes for the owner…"
                    />
                  </label>
                )}

                <div className="cp-modal-info">
                  <span className="cp-modal-info-icon">{I.shield}</span>
                  <div>
                    {currentPackage.status === "building" ? (
                      <>
                        Moving to review locks the section structure. You'll
                        still be able to edit notes and swap individual
                        documents. The audit log captures the transition.
                      </>
                    ) : (
                      <>
                        On delivery, an indexed ZIP and PDF cover letter are
                        generated. The client gets portal access plus an email
                        notification. Until they sign off the package stays
                        locked from edits.
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="cp-modal-ftr">
                <button
                  className="cp-btn ghost"
                  onClick={() => setShowDeliver(false)}
                >
                  Cancel
                </button>
                <button
                  className="cp-btn primary"
                  onClick={() => {
                    // In production: PATCH /api/closeout/[id] { status: 'review' | 'delivered' }
                    // Generates ZIP + cover, fires notifications, writes audit event.
                    setShowDeliver(false);
                  }}
                >
                  {currentPackage.status === "building"
                    ? <>{I.shield} Move to review</>
                    : <>{I.send} Deliver to client</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MODAL: ACCEPT (client — sign off and close project)              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showAcceptModal && isClient && (
          <div className="cp-modal-backdrop" onClick={() => setShowAccept(false)}>
            <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cp-modal-hdr">
                <div>
                  <h2 className="cp-modal-title">Accept closeout package</h2>
                  <div className="cp-modal-sub">
                    Acknowledge receipt of all materials and close out the
                    Northbank Mixed-Use project.
                  </div>
                </div>
                <button
                  className="cp-btn xs ghost"
                  onClick={() => setShowAccept(false)}
                >
                  {I.x}
                </button>
              </div>

              <div className="cp-modal-body">
                <div className="cp-accept-summary">
                  <div className="cp-accept-icon">{I.award}</div>
                  <div>
                    <div className="cp-accept-summary-title">
                      You're accepting <strong>CO-2025-0017</strong>
                    </div>
                    <div className="cp-accept-summary-sub">
                      {northbankSections.length} sections ·{" "}
                      {northbankSections.reduce((a, s) => a + s.items.length, 0)} documents ·{" "}
                      {fmtSizeBig(northbankSections.reduce((a, s) => a + s.items.reduce((b, i) => b + i.sizeMb, 0), 0))}
                    </div>
                  </div>
                </div>

                <label className="cp-field">
                  <span className="cp-field-label">Sign as</span>
                  <input
                    type="text"
                    className="cp-input"
                    value={acceptSigner}
                    onChange={(e) => setAcceptSigner(e.target.value)}
                  />
                  <span className="cp-field-hint">
                    Your name and timestamp are recorded on the project audit
                    log.
                  </span>
                </label>

                <label className="cp-field">
                  <span className="cp-field-label">Acceptance note (optional)</span>
                  <textarea
                    className="cp-textarea"
                    rows={3}
                    placeholder="Any closing thoughts for the contractor…"
                    value={acceptComment}
                    onChange={(e) => setAcceptComment(e.target.value)}
                  />
                </label>

                {openItemComments > 0 && (
                  <div className="cp-modal-warn">
                    <span className="cp-modal-warn-icon">{I.shield}</span>
                    <div>
                      <strong>{openItemComments} open question{openItemComments === 1 ? "" : "s"}</strong> on individual
                      documents — these stay on record after acceptance. Add
                      additional notes below if anything still needs follow-up.
                    </div>
                  </div>
                )}

                <div className="cp-accept-clickwrap">
                  <span className="cp-accept-clickwrap-icon">{I.check}</span>
                  <div>
                    By clicking <strong>Sign &amp; accept</strong> I confirm
                    that I have received the closeout materials for the
                    Northbank Mixed-Use project and that the project may be
                    transitioned to <strong>Closed</strong>. Final invoicing
                    can release.
                  </div>
                </div>
              </div>

              <div className="cp-modal-ftr">
                <button
                  className="cp-btn ghost"
                  onClick={() => setShowAccept(false)}
                >
                  Cancel
                </button>
                <button
                  className="cp-btn primary"
                  disabled={!acceptSigner.trim()}
                  onClick={() => {
                    // In production: PATCH /api/closeout/[id]
                    //   { status:'accepted', acceptedByUserId, acceptedAt, acceptanceNote }
                    // Triggers project.closedAt = now, fires notifications,
                    // writes audit event(s).
                    setShowAccept(false);
                    setAcceptComment("");
                  }}
                >
                  {I.award} Sign &amp; accept
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          className="cp-dark-toggle"
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
  /* ─── Design tokens ─── */
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
  .cp-dark{
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
  .cp-root{
    font-family:"DM Sans",system-ui,sans-serif;
    background:var(--canvas-bg);
    color:var(--text-primary);
    min-height:100vh;
    letter-spacing:-0.005em;
  }
  .cp-root h1,.cp-root h2,.cp-root h3{font-family:"Instrument Sans",Georgia,serif;font-weight:600;letter-spacing:-0.02em}
  code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.85em}

  /* ─── Top bar ─── */
  .cp-topbar{
    display:flex;align-items:center;gap:18px;
    height:56px;padding:0 22px;
    background:var(--surface-1);
    border-bottom:1px solid var(--border);
    position:sticky;top:0;z-index:20;
  }
  .cp-brand{display:flex;align-items:center;gap:8px;color:var(--text-primary)}
  .cp-brand-name{font-family:"Instrument Sans",serif;font-size:17px;font-weight:600;letter-spacing:-.01em}
  .cp-crumbs{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-secondary)}
  .cp-crumbs strong{color:var(--text-primary);font-weight:580}
  .cp-portal-pill{display:inline-flex;align-items:center;gap:6px;background:var(--info-soft);color:var(--info);padding:4px 11px;border-radius:999px;font-size:12px;font-weight:540}
  .cp-top-spacer{flex:1}
  .cp-role-toggle{display:flex;background:var(--surface-3);padding:3px;border-radius:7px;font-size:12.5px}
  .cp-role-toggle button{
    display:flex;align-items:center;gap:5px;
    background:none;border:0;padding:6px 12px;border-radius:5px;
    color:var(--text-secondary);font:inherit;font-weight:540;cursor:pointer;
  }
  .cp-role-toggle button.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
  .cp-topbtn{position:relative;background:none;border:0;width:34px;height:34px;border-radius:7px;color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
  .cp-topbtn:hover{background:var(--surface-hover);color:var(--text-primary)}
  .cp-topbtn-dot{position:absolute;top:8px;right:9px;width:7px;height:7px;background:var(--er);border-radius:50%;border:1.5px solid var(--surface-1)}
  .cp-user{display:flex;align-items:center;gap:9px;padding-left:6px}
  .cp-user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent) 0%,var(--accent-deep) 100%);color:var(--text-inverse);font-size:12px;font-weight:600;display:grid;place-items:center;letter-spacing:.02em}
  .cp-user-name{font-size:12.5px;font-weight:560;line-height:1.2}
  .cp-user-org{font-size:11px;color:var(--text-tertiary)}

  /* ─── Shell ─── */
  .cp-shell{display:flex;min-height:calc(100vh - 56px)}
  .cp-sidebar{
    width:218px;flex-shrink:0;
    background:var(--surface-1);
    border-right:1px solid var(--border);
    padding:16px 12px;
    position:sticky;top:56px;align-self:flex-start;
    height:calc(100vh - 56px);overflow-y:auto;
  }
  .cp-side-section{padding:6px 10px 5px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:560}
  .cp-side-item{
    display:flex;align-items:center;gap:8px;width:100%;
    background:none;border:0;padding:8px 10px;border-radius:6px;
    font:inherit;font-size:13px;color:var(--text-secondary);font-weight:520;
    cursor:pointer;text-align:left;
    transition:background .12s ease, color .12s ease;
  }
  .cp-side-item:hover{background:var(--surface-hover);color:var(--text-primary)}
  .cp-side-item.active{background:var(--accent-soft);color:var(--accent-deep);font-weight:580}
  .cp-dark .cp-side-item.active{color:var(--accent)}
  .cp-side-count{margin-left:auto;background:var(--surface-3);color:var(--text-tertiary);padding:1px 7px;border-radius:10px;font-size:11px;font-weight:540;font-variant-numeric:tabular-nums}
  .cp-side-item.active .cp-side-count{background:var(--surface-1);color:var(--accent-deep)}
  .cp-dark .cp-side-item.active .cp-side-count{background:var(--surface-3);color:var(--accent)}
  .cp-side-help{padding:6px 10px;font-size:11.5px;line-height:1.55;color:var(--text-tertiary)}
  .cp-side-help p{margin:0 0 8px}
  .cp-side-help strong{color:var(--text-secondary);font-weight:580}

  .cp-main{flex:1;padding:24px 28px 40px;min-width:0}
  .cp-main-builder{padding:18px 28px 100px}
  .cp-main-client{background:var(--bg);padding:30px 24px}
  .cp-content{max-width:1280px;margin:0 auto}
  .cp-content-builder{max-width:1380px}

  /* ─── Page header ─── */
  .cp-page-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap}
  .cp-page-title{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}
  .cp-page-sub{font-size:13.5px;color:var(--text-secondary);line-height:1.5;max-width:760px}
  .cp-page-sub strong{color:var(--text-primary);font-weight:580}

  /* ─── Buttons ─── */
  .cp-btn{
    display:inline-flex;align-items:center;gap:6px;
    background:var(--surface-1);border:1px solid var(--border-strong);
    padding:8px 14px;border-radius:7px;
    font-family:inherit;font-size:13px;font-weight:540;color:var(--text-primary);
    cursor:pointer;transition:all .12s ease;white-space:nowrap;
  }
  .cp-btn:hover{background:var(--surface-hover)}
  .cp-btn:disabled{opacity:.45;cursor:not-allowed}
  .cp-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--text-inverse)}
  .cp-btn.primary:hover{background:var(--accent-deep)}
  .cp-btn.primary:disabled{background:var(--na);border-color:var(--na);color:var(--text-inverse)}
  .cp-btn.ghost{background:none;border-color:transparent;color:var(--text-secondary)}
  .cp-btn.ghost:hover{background:var(--surface-hover);color:var(--text-primary)}
  .cp-btn.full{width:100%;justify-content:center}
  .cp-btn.sm{padding:6px 11px;font-size:12.5px}
  .cp-btn.xs{padding:4px 8px;font-size:11.5px;border-radius:5px;gap:4px}
  .cp-btn.lg{padding:14px 24px;font-size:14.5px;font-weight:580;gap:9px;border-radius:9px}
  .cp-btn.has-comments{background:var(--info-soft);color:var(--info);border-color:transparent}

  /* ─── KPI strip ─── */
  .cp-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
  .cp-kpi{
    background:var(--surface-1);border:1px solid var(--border);
    border-radius:9px;padding:13px 15px;
  }
  .cp-kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-weight:560;margin-bottom:4px}
  .cp-kpi-value{font-family:"Instrument Sans",serif;font-size:28px;font-weight:600;line-height:1;letter-spacing:-.02em;color:var(--text-primary);font-variant-numeric:tabular-nums}
  .cp-kpi-value.ok{color:var(--ok)}
  .cp-kpi-value.accent{color:var(--accent)}
  .cp-kpi-value.warn{color:var(--wr)}
  .cp-kpi-sub{font-size:11.5px;color:var(--text-tertiary);margin-top:3px}
  @media (max-width:960px){.cp-kpi-strip{grid-template-columns:repeat(2,1fr)}}

  /* ─── Filter bar ─── */
  .cp-filter-bar{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}
  .cp-search{
    flex:1;min-width:260px;
    display:flex;align-items:center;gap:8px;
    background:var(--surface-1);border:1px solid var(--border);border-radius:8px;
    padding:0 12px;height:38px;color:var(--text-tertiary);
  }
  .cp-search input{flex:1;background:none;border:0;outline:none;font-family:inherit;font-size:13.5px;color:var(--text-primary)}
  .cp-search input::placeholder{color:var(--text-tertiary)}

  /* ─── Workspace grid (cards + rail) ─── */
  .cp-workspace-grid{display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start}
  @media (max-width:1100px){.cp-workspace-grid{grid-template-columns:1fr}}

  /* ─── Package cards ─── */
  .cp-package-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px}
  .cp-pkg-card{
    display:flex;flex-direction:column;gap:14px;
    background:var(--surface-1);border:1px solid var(--border);border-radius:11px;
    padding:18px 20px;cursor:pointer;text-align:left;
    font-family:inherit;
    transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease;
    position:relative;overflow:hidden;
  }
  .cp-pkg-card::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
    background:var(--text-tertiary);opacity:.7;
  }
  .cp-pkg-card.status-building::before{background:var(--wr)}
  .cp-pkg-card.status-review::before{background:var(--info)}
  .cp-pkg-card.status-delivered::before{background:var(--accent)}
  .cp-pkg-card.status-accepted::before{background:var(--ok)}
  .cp-pkg-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md);transform:translateY(-1px)}
  .cp-pkg-card-hdr{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .cp-status-pill{
    display:inline-flex;align-items:center;gap:5px;
    padding:3px 9px;border-radius:4px;
    font-size:11px;font-weight:560;letter-spacing:.02em;text-transform:uppercase;
  }
  .cp-status-pill.building{background:var(--wr-soft);color:var(--wr)}
  .cp-status-pill.review{background:var(--info-soft);color:var(--info)}
  .cp-status-pill.delivered{background:var(--accent-soft);color:var(--accent-deep)}
  .cp-dark .cp-status-pill.delivered{color:var(--accent)}
  .cp-status-pill.accepted{background:var(--ok-soft);color:var(--ok)}
  .cp-pkg-num{font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--text-tertiary);font-weight:500}
  .cp-pkg-project-name{font-family:"Instrument Sans",serif;font-size:18px;font-weight:600;letter-spacing:-.015em;line-height:1.25;margin-bottom:4px}
  .cp-pkg-project-meta{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--text-secondary)}
  .cp-pkg-project-meta span{display:inline-flex;align-items:center;gap:5px}
  .cp-pkg-project-addr{color:var(--text-tertiary)}
  .cp-pkg-progress{display:flex;flex-direction:column;gap:4px}
  .cp-pkg-progress-row{display:flex;justify-content:space-between;align-items:center;font-size:11px}
  .cp-pkg-progress-label{color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-weight:560}
  .cp-pkg-progress-pct{color:var(--text-primary);font-weight:580;font-variant-numeric:tabular-nums}
  .cp-pkg-progress-track{height:5px;background:var(--surface-3);border-radius:999px;overflow:hidden}
  .cp-pkg-progress-fill{height:100%;border-radius:999px;transition:width .3s ease}
  .cp-pkg-progress-fill.status-building{background:var(--wr)}
  .cp-pkg-progress-fill.status-review{background:var(--info)}
  .cp-pkg-progress-fill.status-delivered{background:var(--accent)}
  .cp-pkg-progress-fill.status-accepted{background:var(--ok)}
  .cp-pkg-card-stats{display:flex;gap:18px;padding:8px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
  .cp-pkg-stat{display:flex;flex-direction:column;gap:1px}
  .cp-pkg-stat-value{font-family:"Instrument Sans",serif;font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--text-primary);font-variant-numeric:tabular-nums}
  .cp-pkg-stat-label{font-size:10.5px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-weight:560}
  .cp-pkg-card-ftr{font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:6px}
  .cp-pkg-card-ftr span{display:inline-flex;align-items:center;gap:5px}
  .cp-pkg-accepted{color:var(--ok) !important;font-weight:540}

  /* ─── Empty states ─── */
  .cp-empty{
    background:var(--surface-1);border:1px dashed var(--border-strong);border-radius:9px;
    padding:44px 20px;text-align:center;
  }
  .cp-empty.sm{padding:24px 16px}
  .cp-empty-icon{display:inline-flex;width:44px;height:44px;background:var(--surface-3);border-radius:50%;align-items:center;justify-content:center;color:var(--text-tertiary);margin-bottom:10px}
  .cp-empty-title{font-size:15px;font-weight:580;color:var(--text-primary);margin-bottom:3px}
  .cp-empty-sub{font-size:12.5px;color:var(--text-tertiary)}

  /* ─── Activity rail ─── */
  .cp-rail{background:var(--surface-1);border:1px solid var(--border);border-radius:9px;position:sticky;top:80px}
  .cp-rail-hdr{padding:13px 16px;border-bottom:1px solid var(--border)}
  .cp-rail-hdr h3{font-size:13px;margin:0;font-family:"DM Sans",sans-serif;font-weight:580;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary)}
  .cp-rail-body{padding:6px 0;max-height:580px;overflow-y:auto}
  .cp-rail-item{display:flex;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)}
  .cp-rail-item:last-child{border-bottom:0}
  .cp-rail-avatar{
    width:28px;height:28px;border-radius:50%;flex-shrink:0;
    background:var(--accent-soft);color:var(--accent-deep);
    font-size:10.5px;font-weight:600;display:grid;place-items:center;
  }
  .cp-dark .cp-rail-avatar{color:var(--accent)}
  .cp-rail-avatar.accept{background:var(--ok-soft);color:var(--ok)}
  .cp-rail-avatar.deliver{background:var(--accent-soft);color:var(--accent-deep)}
  .cp-rail-avatar.review{background:var(--info-soft);color:var(--info)}
  .cp-rail-avatar.view{background:var(--surface-3);color:var(--text-tertiary)}
  .cp-rail-avatar.add{background:var(--accent-soft);color:var(--accent-deep)}
  .cp-rail-item-text{font-size:12.5px;color:var(--text-primary);line-height:1.4}
  .cp-rail-item-text strong{font-weight:580}
  .cp-rail-item-target{font-size:11.5px;color:var(--text-secondary);margin-top:2px}
  .cp-rail-item-when{font-size:11px;color:var(--text-tertiary);margin-top:3px}

  /* ─── Builder header ─── */
  .cp-builder-hdr{
    display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;
    margin-bottom:14px;
  }
  .cp-builder-title-block{min-width:0}
  .cp-builder-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:3px}
  .cp-builder-title{font-size:22px;margin:0;letter-spacing:-.015em;line-height:1.2}
  .cp-builder-num{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--text-tertiary);font-weight:500}
  .cp-builder-sub{font-size:12.5px;color:var(--text-secondary);line-height:1.45}
  .cp-builder-sub strong{color:var(--text-primary);font-weight:580}
  .cp-builder-actions{display:flex;gap:8px;flex-wrap:wrap}
  .cp-builder-state-note{display:inline-flex;align-items:center;gap:5px;background:var(--accent-soft);color:var(--accent-deep);padding:8px 14px;border-radius:7px;font-size:13px;font-weight:540}
  .cp-dark .cp-builder-state-note{color:var(--accent)}
  @media (max-width:920px){
    .cp-builder-hdr{grid-template-columns:1fr}
  }

  /* ─── Completion summary card ─── */
  .cp-completion-card{
    display:flex;gap:0;align-items:stretch;
    background:var(--surface-1);border:1px solid var(--border);border-radius:10px;
    padding:14px 0;margin-bottom:18px;
  }
  .cp-completion-stat{flex:1;padding:0 22px;display:flex;flex-direction:column;justify-content:center;gap:4px}
  .cp-completion-stat.cp-completion-progress{flex:2}
  .cp-completion-divider{width:1px;background:var(--border);margin:4px 0}
  .cp-completion-label{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary);font-weight:560}
  .cp-completion-value{font-family:"Instrument Sans",serif;font-size:22px;font-weight:600;letter-spacing:-.015em;font-variant-numeric:tabular-nums}
  .cp-completion-bar{display:flex;align-items:center;gap:10px}
  .cp-completion-bar-track{flex:1;height:8px;background:var(--surface-3);border-radius:999px;overflow:hidden}
  .cp-completion-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent) 0%,var(--accent-deep) 100%);border-radius:999px;transition:width .4s ease}
  .cp-completion-pct{font-family:"Instrument Sans",serif;font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--accent-deep)}
  .cp-dark .cp-completion-pct{color:var(--accent)}
  @media (max-width:760px){
    .cp-completion-card{flex-direction:column;padding:14px 18px;gap:10px}
    .cp-completion-divider{display:none}
    .cp-completion-stat{padding:6px 0}
  }

  /* ─── Builder grid: sections + picker ─── */
  .cp-builder-grid{display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start}
  @media (max-width:1100px){.cp-builder-grid{grid-template-columns:1fr}}

  /* ─── Sections ─── */
  .cp-sections{display:flex;flex-direction:column;gap:12px}
  .cp-section{
    background:var(--surface-1);border:1px solid var(--border);border-radius:10px;
    overflow:hidden;
    transition:border-color .15s ease, box-shadow .15s ease;
  }
  .cp-section.drop-target{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
  .cp-section-hdr{
    display:flex;justify-content:space-between;align-items:center;gap:10px;
    padding:14px 18px;
    background:linear-gradient(90deg, var(--sec-soft, var(--surface-2)) 0%, transparent 100%);
    border-bottom:1px solid var(--border);
  }
  .cp-section-hdr-left{display:flex;align-items:flex-start;gap:12px;min-width:0}
  .cp-section-color-tag{display:inline-block;width:4px;height:34px;border-radius:2px;flex-shrink:0;margin-top:2px}
  .cp-section-name{font-size:15px;margin:0 0 2px;font-family:"DM Sans",sans-serif;font-weight:580;letter-spacing:-.005em;color:var(--text-primary)}
  .cp-section-desc{font-size:11.5px;color:var(--text-tertiary);line-height:1.4}
  .cp-section-custom-input{
    background:transparent;border:1px dashed var(--border-strong);border-radius:5px;
    padding:3px 8px;font-family:"DM Sans",sans-serif;font-size:14.5px;font-weight:580;
    color:var(--text-primary);width:240px;outline:none;
  }
  .cp-section-custom-input:focus{border-style:solid;border-color:var(--accent);background:var(--surface-1)}
  .cp-section-hdr-right{display:flex;align-items:center;gap:8px}
  .cp-section-count{font-size:11.5px;color:var(--text-secondary);font-weight:540;font-variant-numeric:tabular-nums;background:var(--surface-2);padding:4px 9px;border-radius:5px}
  .cp-icon-btn{
    width:28px;height:28px;border-radius:5px;
    background:var(--surface-2);border:1px solid var(--border);
    color:var(--text-secondary);cursor:pointer;display:grid;place-items:center;
  }
  .cp-icon-btn:hover{background:var(--surface-hover);color:var(--text-primary)}
  .cp-icon-btn.danger:hover{background:var(--er-soft);color:var(--er);border-color:transparent}
  .cp-section-body{padding:6px 14px 14px}
  .cp-section-empty{
    display:flex;align-items:center;gap:14px;
    padding:28px 18px;background:var(--surface-2);
    border:1.5px dashed var(--border-strong);border-radius:8px;
    color:var(--text-tertiary);
  }
  .cp-section-empty-icon{
    width:40px;height:40px;border-radius:7px;
    background:var(--surface-1);border:1px solid var(--border);
    display:grid;place-items:center;color:var(--text-tertiary);flex-shrink:0;
  }
  .cp-section-empty-text{font-size:12.5px;line-height:1.5}
  .cp-section-empty-text strong{color:var(--text-secondary);font-weight:580}

  /* ─── Items ─── */
  .cp-item{
    background:var(--surface-2);border:1px solid var(--border);border-radius:7px;
    margin-top:8px;
    transition:border-color .15s ease, transform .15s ease;
  }
  .cp-item.new{animation:cp-item-pulse .8s ease}
  @keyframes cp-item-pulse{
    0%{background:var(--accent-soft)}
    100%{background:var(--surface-2)}
  }
  .cp-item-row{display:grid;grid-template-columns:36px 36px 1fr auto;gap:12px;align-items:start;padding:11px 14px}
  .cp-item-num{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--text-tertiary);font-weight:500;align-self:center;text-align:center}
  .cp-item-thumb{
    width:36px;height:42px;border-radius:5px;
    background:linear-gradient(180deg,#fefaf6 0%,#f5e9dc 100%);
    border:1px solid #e5d2ba;color:#9e5b2d;
    display:grid;place-items:center;align-self:center;flex-shrink:0;
  }
  .cp-dark .cp-item-thumb{background:#2a1f15;border-color:#4a3722;color:#c48a55}
  .cp-item-body{min-width:0}
  .cp-item-name{font-size:13px;font-weight:540;color:var(--text-primary);line-height:1.35;word-break:break-word}
  .cp-item-meta{font-size:11.5px;color:var(--text-tertiary);margin-top:2px;font-variant-numeric:tabular-nums}
  .cp-item-notes{
    display:flex;align-items:flex-start;gap:6px;
    background:var(--accent-soft);border:0;border-radius:5px;
    padding:6px 10px;margin-top:7px;width:100%;
    font-family:inherit;font-size:12px;color:var(--text-secondary);line-height:1.45;text-align:left;
    cursor:pointer;
  }
  .cp-dark .cp-item-notes{background:rgba(126,114,230,.12)}
  .cp-item-notes:hover{background:var(--accent-soft);filter:brightness(.96)}
  .cp-item-notes-icon{color:var(--accent-deep);padding-top:2px;display:flex;flex-shrink:0}
  .cp-dark .cp-item-notes-icon{color:var(--accent)}
  .cp-item-notes-text{font-style:italic}
  .cp-item-notes-add{
    display:inline-flex;align-items:center;gap:4px;
    background:none;border:0;padding:6px 0 0;margin-top:4px;
    font-family:inherit;font-size:11.5px;color:var(--text-tertiary);font-weight:540;cursor:pointer;
  }
  .cp-item-notes-add:hover{color:var(--accent-deep)}
  .cp-dark .cp-item-notes-add:hover{color:var(--accent)}
  .cp-item-notes-edit{margin-top:7px;display:flex;flex-direction:column;gap:6px}
  .cp-item-notes-actions{display:flex;justify-content:flex-end;gap:6px}
  .cp-item-actions{display:flex;flex-direction:column;gap:4px;align-self:center}

  /* Drop hint */
  .cp-drop-hint{
    display:flex;align-items:center;gap:6px;
    margin-top:8px;padding:10px 14px;
    background:var(--surface-2);border:1.5px dashed var(--border-strong);border-radius:7px;
    font-size:12px;color:var(--text-tertiary);
    transition:all .15s ease;
  }
  .cp-drop-hint.active{
    background:var(--accent-soft);border-color:var(--accent);border-style:solid;
    color:var(--accent-deep);font-weight:540;
  }
  .cp-dark .cp-drop-hint.active{color:var(--accent)}
  .cp-drop-hint strong{color:inherit;font-weight:580}

  /* ─── Add section ─── */
  .cp-add-section{margin-top:4px}
  .cp-add-section-picker{
    background:var(--surface-1);border:1px solid var(--border);border-radius:10px;
    padding:14px 18px;
  }
  .cp-add-section-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .cp-add-section-hdr strong{font-size:13.5px;font-weight:580}
  .cp-add-section-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
  .cp-add-section-tile{
    text-align:left;background:var(--surface-2);border:1px solid var(--border);
    border-radius:7px;padding:11px 13px;
    cursor:pointer;font-family:inherit;
    display:flex;flex-direction:column;gap:4px;
    transition:border-color .12s ease, background .12s ease;
  }
  .cp-add-section-tile:hover{background:var(--surface-hover);border-color:var(--border-strong)}
  .cp-add-section-color{width:24px;height:3px;border-radius:1.5px}
  .cp-add-section-name{font-size:12.5px;font-weight:580;color:var(--text-primary)}
  .cp-add-section-desc{font-size:11px;color:var(--text-tertiary);line-height:1.4}

  /* ─── Doc picker ─── */
  .cp-picker{
    background:var(--surface-1);border:1px solid var(--border);border-radius:10px;
    position:sticky;top:80px;max-height:calc(100vh - 100px);
    display:flex;flex-direction:column;
  }
  .cp-picker-hdr{padding:14px 16px 8px;border-bottom:1px solid var(--border)}
  .cp-picker-title{font-size:13.5px;margin:0 0 3px;font-family:"DM Sans",sans-serif;font-weight:580;display:inline-flex;align-items:center;gap:6px;color:var(--text-primary)}
  .cp-picker-sub{font-size:11.5px;color:var(--text-tertiary);line-height:1.45}
  .cp-picker-search{
    display:flex;align-items:center;gap:7px;
    margin:10px 12px 6px;padding:0 10px;height:32px;
    background:var(--surface-2);border:1px solid var(--border);border-radius:6px;
    color:var(--text-tertiary);
  }
  .cp-picker-search input{flex:1;background:none;border:0;outline:none;font-family:inherit;font-size:12.5px;color:var(--text-primary)}
  .cp-picker-search input::placeholder{color:var(--text-tertiary)}
  .cp-picker-body{padding:4px 8px 12px;overflow-y:auto;flex:1}
  .cp-picker-folder{margin-bottom:4px}
  .cp-picker-folder-hdr{
    display:flex;align-items:center;gap:7px;width:100%;
    background:none;border:0;padding:7px 10px;border-radius:6px;
    font-family:inherit;font-size:12px;color:var(--text-secondary);font-weight:540;
    cursor:pointer;text-align:left;
  }
  .cp-picker-folder-hdr:hover{background:var(--surface-hover)}
  .cp-picker-folder-chev{display:inline-flex;color:var(--text-tertiary);transition:transform .15s ease}
  .cp-picker-folder-chev[data-open="true"]{transform:rotate(90deg)}
  .cp-picker-folder-name{flex:1;color:var(--text-primary)}
  .cp-picker-folder-count{background:var(--surface-3);color:var(--text-tertiary);padding:1px 7px;border-radius:8px;font-size:10.5px;font-weight:540;font-variant-numeric:tabular-nums}
  .cp-picker-docs{padding:2px 4px 4px 18px;display:flex;flex-direction:column;gap:3px}
  .cp-picker-doc{
    display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;
    background:var(--surface-2);border:1px solid var(--border);border-radius:6px;
    padding:7px 10px;
    cursor:grab;
    transition:border-color .15s ease, transform .15s ease, opacity .15s ease;
  }
  .cp-picker-doc:hover{border-color:var(--border-strong);background:var(--surface-hover)}
  .cp-picker-doc:active{cursor:grabbing}
  .cp-picker-doc.dragging{opacity:.45;transform:scale(.97)}
  .cp-picker-doc.used{opacity:.55;cursor:not-allowed;background:var(--surface-2)}
  .cp-picker-doc-grip{color:var(--text-tertiary);display:flex;align-items:center}
  .cp-picker-doc-name{font-size:11.5px;font-weight:540;color:var(--text-primary);line-height:1.3;word-break:break-word}
  .cp-picker-doc-meta{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text-tertiary);margin-top:2px;font-variant-numeric:tabular-nums;flex-wrap:wrap}
  .cp-picker-suggest-chip{
    display:inline-flex;align-items:center;gap:3px;
    padding:1px 6px;border-radius:3px;
    font-size:9.5px;font-weight:580;letter-spacing:.03em;text-transform:uppercase;
  }
  .cp-picker-suggest-chip svg{width:9px;height:9px}
  .cp-picker-doc-add{
    width:24px;height:24px;border-radius:5px;
    background:var(--accent-soft);border:0;color:var(--accent-deep);
    cursor:pointer;display:grid;place-items:center;
  }
  .cp-dark .cp-picker-doc-add{color:var(--accent)}
  .cp-picker-doc-add:hover{background:var(--accent);color:var(--text-inverse)}
  .cp-picker-doc-add:disabled{opacity:.4;cursor:not-allowed}
  .cp-picker-doc-status{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;color:var(--ok);font-weight:540}

  /* ─── Client portal page ─── */
  .cp-client-page{max-width:840px;margin:0 auto}
  .cp-client-hdr{margin-bottom:24px}
  .cp-client-title{font-size:28px;margin:0 0 6px;letter-spacing:-.02em}
  .cp-client-sub{font-size:14px;color:var(--text-secondary);line-height:1.55;max-width:680px}
  .cp-client-pkg-list{display:flex;flex-direction:column;gap:14px}
  .cp-client-pkg{
    background:var(--surface-1);border:1px solid var(--border);border-radius:11px;
    padding:22px 26px;cursor:pointer;
    transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease;
    position:relative;
  }
  .cp-client-pkg-active{border-left:3px solid var(--accent)}
  .cp-client-pkg-active:hover{border-color:var(--accent);box-shadow:var(--shadow-md);transform:translateY(-1px)}
  .cp-client-pkg-archived{opacity:.85;border-left:3px solid var(--ok);cursor:default}
  .cp-client-pkg-hdr{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
  .cp-client-pkg-num{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--text-tertiary)}
  .cp-client-pkg-name{font-size:22px;margin:0 0 4px;letter-spacing:-.015em;line-height:1.25}
  .cp-client-pkg-meta{font-size:13px;color:var(--text-secondary);margin-bottom:14px}
  .cp-client-pkg-stats{display:flex;gap:22px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:12.5px;color:var(--text-secondary);flex-wrap:wrap;align-items:center}
  .cp-client-pkg-stats strong{color:var(--text-primary);font-weight:580;font-family:"Instrument Sans",serif;font-size:15px}
  .cp-client-pkg-comments-chip{
    display:inline-flex;align-items:center;gap:5px;
    background:var(--info-soft);color:var(--info);
    padding:4px 9px;border-radius:5px;font-size:11.5px;font-weight:540;
    margin-left:auto;
  }
  .cp-client-pkg-cta{
    display:inline-flex;align-items:center;gap:5px;margin-top:14px;
    color:var(--accent-deep);font-weight:580;font-size:13px;
  }
  .cp-dark .cp-client-pkg-cta{color:var(--accent)}

  /* ─── Client review screen ─── */
  .cp-client-review{max-width:920px;margin:0 auto;padding-bottom:80px}
  .cp-review-hdr{
    background:var(--surface-1);border:1px solid var(--border);border-radius:12px;
    padding:24px 28px;margin-bottom:18px;
  }
  .cp-review-hdr-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
  .cp-review-num{font-family:"JetBrains Mono",monospace;font-size:13px;color:var(--text-secondary)}
  .cp-review-subject{font-size:22px;margin:0 0 12px;letter-spacing:-.015em;line-height:1.3}
  .cp-review-msg{font-size:14px;color:var(--text-secondary);line-height:1.6;margin:0 0 12px;max-width:780px}
  .cp-review-signoff-from{font-size:13px;color:var(--text-tertiary);font-style:italic;margin-bottom:18px}
  .cp-review-stat-row{display:flex;gap:32px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap}
  .cp-review-stat-label{font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.07em;font-weight:560;margin-bottom:3px}
  .cp-review-stat-value{font-family:"Instrument Sans",serif;font-size:22px;font-weight:600;letter-spacing:-.015em;font-variant-numeric:tabular-nums}
  .cp-review-stat-value.warn{color:var(--wr)}

  .cp-review-pkg-comments{
    background:var(--info-soft);border:1px solid transparent;border-left:3px solid var(--info);
    border-radius:8px;padding:14px 18px;margin-bottom:16px;
  }
  .cp-review-pkg-comments-hdr{font-size:12px;font-weight:580;color:var(--info);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;display:inline-flex;align-items:center;gap:6px}

  .cp-review-comment{display:flex;gap:10px;padding:8px 0}
  .cp-review-comment.small{padding:6px 0}
  .cp-review-comment-avatar{
    width:30px;height:30px;border-radius:50%;flex-shrink:0;
    background:var(--info-soft);color:var(--info);
    font-size:11px;font-weight:600;display:grid;place-items:center;
  }
  .cp-review-comment-body{flex:1;min-width:0}
  .cp-review-comment-meta{font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap}
  .cp-review-comment-meta strong{color:var(--text-primary);font-weight:580}
  .cp-review-comment-org{color:var(--text-tertiary)}
  .cp-review-comment-when{color:var(--text-tertiary);margin-left:auto;font-size:11px}
  .cp-review-comment-text{font-size:13px;color:var(--text-secondary);line-height:1.5;background:var(--surface-1);padding:8px 12px;border-radius:6px;border:1px solid var(--border)}

  .cp-review-sections{display:flex;flex-direction:column;gap:12px;margin-bottom:18px}
  .cp-review-section{background:var(--surface-1);border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .cp-review-section-hdr{
    display:flex;align-items:center;gap:10px;
    padding:14px 18px;
    background:linear-gradient(90deg, var(--sec-soft, var(--surface-2)) 0%, transparent 100%);
    border-bottom:1px solid var(--border);
  }
  .cp-review-section-body{padding:8px 14px 14px}
  .cp-review-item{
    background:var(--surface-2);border:1px solid var(--border);border-radius:7px;
    margin-top:8px;
  }
  .cp-review-item-row{display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:start;padding:11px 14px}
  .cp-review-item-body{min-width:0}
  .cp-review-item-name{font-size:13px;font-weight:540;color:var(--text-primary);line-height:1.35;word-break:break-word}
  .cp-review-item-meta{font-size:11.5px;color:var(--text-tertiary);margin-top:2px;font-variant-numeric:tabular-nums}
  .cp-review-item-note{
    display:flex;align-items:flex-start;gap:6px;
    background:var(--accent-soft);border-radius:5px;
    padding:6px 10px;margin-top:7px;
    font-size:12px;color:var(--text-secondary);line-height:1.45;font-style:italic;
  }
  .cp-dark .cp-review-item-note{background:rgba(126,114,230,.12)}
  .cp-review-item-note-icon{color:var(--accent-deep);padding-top:2px;display:flex;flex-shrink:0}
  .cp-dark .cp-review-item-note-icon{color:var(--accent)}
  .cp-review-item-actions{display:flex;gap:6px;align-self:center;flex-wrap:wrap}
  .cp-comment-count{
    background:var(--info);color:var(--text-inverse);
    padding:0 5px;border-radius:8px;font-size:9.5px;font-weight:580;
    margin-left:3px;font-variant-numeric:tabular-nums;
  }

  .cp-review-item-comments{padding:6px 14px 12px 56px;display:flex;flex-direction:column;gap:6px}
  .cp-comment-compose{
    margin-top:6px;display:flex;flex-direction:column;gap:6px;
    background:var(--surface-1);border:1px solid var(--border);border-radius:7px;
    padding:10px 12px;
  }
  .cp-comment-compose-actions{display:flex;justify-content:flex-end;gap:6px}

  /* ─── Sticky accept bar ─── */
  .cp-review-accept-bar{
    position:sticky;bottom:18px;
    background:var(--surface-1);border:1px solid var(--border-strong);
    border-radius:12px;box-shadow:var(--shadow-lg);
    padding:18px 24px;
    display:flex;align-items:center;gap:18px;flex-wrap:wrap;
    margin-top:24px;
  }
  .cp-review-accept-text{flex:1;min-width:240px;font-size:13px;color:var(--text-secondary);line-height:1.5}
  .cp-review-accept-text strong{color:var(--text-primary);font-weight:580}

  /* ─── Forms / inputs ─── */
  .cp-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
  .cp-field-label{font-size:12px;font-weight:580;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em}
  .cp-field-hint{font-size:11.5px;color:var(--text-tertiary);font-style:italic}
  .cp-input,.cp-textarea{
    background:var(--surface-2);border:1px solid var(--border);border-radius:7px;
    padding:10px 12px;font-family:inherit;font-size:13.5px;color:var(--text-primary);
    outline:none;transition:border-color .12s ease, background .12s ease;
    resize:vertical;
  }
  .cp-input:focus,.cp-textarea:focus{border-color:var(--accent);background:var(--surface-1)}
  .cp-input::placeholder,.cp-textarea::placeholder{color:var(--text-tertiary)}
  .cp-textarea.sm{font-size:12.5px;padding:8px 10px}

  /* ─── Modals ─── */
  .cp-modal-backdrop{
    position:fixed;inset:0;z-index:40;
    background:rgba(20,18,16,.55);backdrop-filter:blur(3px);
    display:grid;place-items:center;padding:24px;
    animation:cp-fade .15s ease;
  }
  @keyframes cp-fade{from{opacity:0}to{opacity:1}}
  .cp-modal{
    background:var(--surface-1);border-radius:13px;box-shadow:var(--shadow-lg);
    width:600px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;
    animation:cp-pop .18s cubic-bezier(.2,.8,.3,1.05);
  }
  @keyframes cp-pop{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
  .cp-modal-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px 14px;border-bottom:1px solid var(--border);gap:18px}
  .cp-modal-title{font-size:20px;margin:0 0 3px;letter-spacing:-.015em}
  .cp-modal-sub{font-size:12.5px;color:var(--text-secondary);line-height:1.5}
  .cp-modal-sub strong{color:var(--text-primary);font-weight:580}
  .cp-modal-body{padding:18px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}

  .cp-deliver-summary{
    background:var(--surface-2);border-radius:8px;padding:12px 16px;
    display:flex;flex-direction:column;gap:6px;
  }
  .cp-deliver-row{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;gap:12px}
  .cp-deliver-label{color:var(--text-tertiary);text-transform:uppercase;font-size:10.5px;letter-spacing:.07em;font-weight:560}
  .cp-deliver-value{color:var(--text-primary);font-weight:540;text-align:right}

  .cp-modal-info{
    display:flex;gap:10px;align-items:flex-start;
    background:var(--info-soft);border-left:3px solid var(--info);
    padding:10px 14px;border-radius:6px;
    font-size:12px;color:var(--text-secondary);line-height:1.5;
  }
  .cp-modal-info-icon{color:var(--info);padding-top:1px;display:flex;flex-shrink:0}
  .cp-modal-warn{
    display:flex;gap:10px;align-items:flex-start;
    background:var(--wr-soft);border-left:3px solid var(--wr);
    padding:10px 14px;border-radius:6px;
    font-size:12px;color:var(--text-secondary);line-height:1.5;
  }
  .cp-modal-warn strong{color:var(--text-primary);font-weight:580}
  .cp-modal-warn-icon{color:var(--wr);padding-top:1px;display:flex;flex-shrink:0}

  .cp-accept-summary{
    display:flex;gap:14px;align-items:center;
    background:var(--ok-soft);border-radius:8px;padding:14px 16px;
  }
  .cp-accept-icon{
    width:48px;height:48px;border-radius:50%;
    background:var(--ok);color:var(--text-inverse);
    display:grid;place-items:center;flex-shrink:0;
  }
  .cp-accept-icon svg{width:24px;height:24px}
  .cp-accept-summary-title{font-size:14px;color:var(--text-primary);font-weight:540}
  .cp-accept-summary-title strong{font-family:"JetBrains Mono",monospace;font-size:13px;font-weight:600}
  .cp-accept-summary-sub{font-size:12px;color:var(--text-secondary);margin-top:2px;font-variant-numeric:tabular-nums}

  .cp-accept-clickwrap{
    display:flex;gap:10px;align-items:flex-start;
    background:var(--surface-2);border:1px solid var(--border);border-radius:7px;
    padding:12px 14px;
    font-size:12px;color:var(--text-secondary);line-height:1.55;
  }
  .cp-accept-clickwrap strong{color:var(--text-primary);font-weight:580}
  .cp-accept-clickwrap-icon{color:var(--ok);padding-top:1px;display:flex;flex-shrink:0}

  .cp-modal-ftr{
    display:flex;justify-content:flex-end;gap:8px;
    padding:14px 24px;border-top:1px solid var(--border);background:var(--surface-2);
    border-bottom-left-radius:13px;border-bottom-right-radius:13px;
  }

  /* ─── Dark mode toggle ─── */
  .cp-dark-toggle{
    position:fixed;bottom:18px;right:18px;width:38px;height:38px;border-radius:50%;
    background:var(--surface-1);border:1px solid var(--border-strong);color:var(--text-primary);
    font-size:18px;cursor:pointer;z-index:50;box-shadow:var(--shadow-md);
    display:grid;place-items:center;
  }
  .cp-dark-toggle:hover{background:var(--surface-hover)}
`;
