import { useState } from "react";

// BuiltCRM — Drawings Module (Contractor / Phase 5 Commercial GC Parity)
// File of Phase 4+ prototypes — Step 44 (5.1 #44)
// Single largest functional addition: sheet management, markup, versioning,
// comments, version compare, sub read-only access, commercial project context.
// Scope ladder (V1 must-have): upload PDF set, auto-extract sheet numbers,
// viewer, markup (pen/text/rect/circle), mobile viewer, version tracking,
// compare overlay, pinned comments. Sub access read-only + scoped markup.

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Drawing Sets Data (commercial project: Riverside Office Complex) ────
const drawingSets = [
  {
    id: "cd-v3",
    family: "cd",
    name: "100% CD Set",
    version: 3,
    status: "current",
    sheetCount: 42,
    uploadedBy: "Emma Morales",
    uploadedAt: "Mar 15, 2026",
    uploadedRel: "2 hours ago",
    fileSize: "48.2 MB",
    supersedesId: "cd-v2",
    disciplines: { A: 14, S: 8, E: 9, M: 7, P: 4 },
    note: "Issued for construction — revision supersedes v2. 3 sheets changed.",
  },
  {
    id: "cd-v2",
    family: "cd",
    name: "100% CD Set",
    version: 2,
    status: "superseded",
    sheetCount: 42,
    uploadedBy: "Emma Morales",
    uploadedAt: "Feb 20, 2026",
    uploadedRel: "2 months ago",
    fileSize: "47.6 MB",
    supersedesId: "cd-v1",
    disciplines: { A: 14, S: 8, E: 9, M: 7, P: 4 },
    note: "Bid set — structural revisions from RFI #14.",
  },
  {
    id: "cd-v1",
    family: "cd",
    name: "100% CD Set",
    version: 1,
    status: "superseded",
    sheetCount: 41,
    uploadedBy: "Emma Morales",
    uploadedAt: "Jan 10, 2026",
    uploadedRel: "3 months ago",
    fileSize: "45.1 MB",
    supersedesId: null,
    disciplines: { A: 14, S: 7, E: 9, M: 7, P: 4 },
    note: "Initial issue for pricing.",
  },
  {
    id: "shell-v1",
    family: "shell",
    name: "Shell Permit Set",
    version: 1,
    status: "current",
    sheetCount: 28,
    uploadedBy: "Dan Carter",
    uploadedAt: "Dec 12, 2025",
    uploadedRel: "4 months ago",
    fileSize: "31.4 MB",
    supersedesId: null,
    disciplines: { A: 10, S: 8, E: 5, M: 3, P: 2 },
    note: "Permit-ready shell package. Stamped Dec 10.",
  },
  {
    id: "dd-v1",
    family: "dd",
    name: "50% DD Set",
    version: 1,
    status: "historical",
    sheetCount: 24,
    uploadedBy: "Dan Carter",
    uploadedAt: "Nov 3, 2025",
    uploadedRel: "5 months ago",
    fileSize: "22.8 MB",
    supersedesId: null,
    disciplines: { A: 8, S: 5, E: 5, M: 4, P: 2 },
    note: "Design development milestone.",
  },
];

// ─── Sheets per Set (current CD v3 has the full list) ─────────────────────
const sheetsBySetId = {
  "cd-v3": [
    { id: "A-001", number: "A-001", title: "Cover Sheet & Index", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "A-010", number: "A-010", title: "General Notes & Abbreviations", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 1, autoDetected: true },
    { id: "A-100", number: "A-100", title: "First Floor Plan", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 2, commentCount: 3, autoDetected: true },
    { id: "A-101", number: "A-101", title: "Second Floor Plan", discipline: "A", disciplineLabel: "Architectural", changed: true, markupCount: 5, commentCount: 4, autoDetected: true },
    { id: "A-102", number: "A-102", title: "Third Floor Plan", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 1, commentCount: 2, autoDetected: true },
    { id: "A-103", number: "A-103", title: "Roof Plan", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "A-201", number: "A-201", title: "North & East Elevations", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 1, autoDetected: true },
    { id: "A-202", number: "A-202", title: "South & West Elevations", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "A-301", number: "A-301", title: "Building Sections A-A / B-B", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 1, commentCount: 0, autoDetected: true },
    { id: "A-401", number: "A-401", title: "Stair Enlarged Plans", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "A-501", number: "A-501", title: "Wall Type Details", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 3, commentCount: 2, autoDetected: true },
    { id: "A-601", number: "A-601", title: "Door & Window Schedules", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "A-602", number: "A-602", title: "Finish Schedule & Legend", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 0, commentCount: 0, autoDetected: false },
    { id: "A-701", number: "A-701", title: "Enlarged Restroom Plans", discipline: "A", disciplineLabel: "Architectural", changed: false, markupCount: 1, commentCount: 0, autoDetected: true },
    { id: "S-001", number: "S-001", title: "Structural Notes", discipline: "S", disciplineLabel: "Structural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "S-101", number: "S-101", title: "First Floor Framing Plan", discipline: "S", disciplineLabel: "Structural", changed: false, markupCount: 0, commentCount: 1, autoDetected: true },
    { id: "S-102", number: "S-102", title: "Second Floor Framing Plan", discipline: "S", disciplineLabel: "Structural", changed: true, markupCount: 4, commentCount: 6, autoDetected: true },
    { id: "S-103", number: "S-103", title: "Third Floor Framing Plan", discipline: "S", disciplineLabel: "Structural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "S-201", number: "S-201", title: "Foundation Plan", discipline: "S", disciplineLabel: "Structural", changed: false, markupCount: 2, commentCount: 1, autoDetected: true },
    { id: "S-301", number: "S-301", title: "Column Schedule", discipline: "S", disciplineLabel: "Structural", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "S-501", number: "S-501", title: "Typical Framing Details", discipline: "S", disciplineLabel: "Structural", changed: false, markupCount: 1, commentCount: 0, autoDetected: true },
    { id: "S-502", number: "S-502", title: "Connection Details", discipline: "S", disciplineLabel: "Structural", changed: true, markupCount: 0, commentCount: 2, autoDetected: true },
    { id: "E-001", number: "E-001", title: "Electrical Legend & Notes", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "E-101", number: "E-101", title: "First Floor Lighting Plan", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "E-102", number: "E-102", title: "Second Floor Lighting Plan", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 1, commentCount: 2, autoDetected: true },
    { id: "E-201", number: "E-201", title: "First Floor Power Plan", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "E-202", number: "E-202", title: "Second Floor Power Plan", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 2, commentCount: 3, autoDetected: true },
    { id: "E-301", number: "E-301", title: "Panel Schedules", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 0, commentCount: 0, autoDetected: false },
    { id: "E-401", number: "E-401", title: "Single-Line Diagram", discipline: "E", disciplineLabel: "Electrical", changed: false, markupCount: 0, commentCount: 1, autoDetected: true },
    { id: "M-001", number: "M-001", title: "Mechanical Legend", discipline: "M", disciplineLabel: "Mechanical", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "M-101", number: "M-101", title: "First Floor HVAC Plan", discipline: "M", disciplineLabel: "Mechanical", changed: false, markupCount: 1, commentCount: 2, autoDetected: true },
    { id: "M-102", number: "M-102", title: "Second Floor HVAC Plan", discipline: "M", disciplineLabel: "Mechanical", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "M-201", number: "M-201", title: "Rooftop Equipment Plan", discipline: "M", disciplineLabel: "Mechanical", changed: false, markupCount: 0, commentCount: 1, autoDetected: true },
    { id: "M-501", number: "M-501", title: "Mechanical Schedules", discipline: "M", disciplineLabel: "Mechanical", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "P-001", number: "P-001", title: "Plumbing Notes & Riser Diagram", discipline: "P", disciplineLabel: "Plumbing", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
    { id: "P-101", number: "P-101", title: "First Floor Plumbing Plan", discipline: "P", disciplineLabel: "Plumbing", changed: false, markupCount: 1, commentCount: 1, autoDetected: true },
    { id: "P-102", number: "P-102", title: "Second Floor Plumbing Plan", discipline: "P", disciplineLabel: "Plumbing", changed: false, markupCount: 0, commentCount: 0, autoDetected: true },
  ],
};

// ─── Markups per Sheet (vector JSON saved per user per sheet) ─────────────
const markupsBySheetId = {
  "A-101": [
    { id: "mk1", userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", tool: "rect", x: 22, y: 34, w: 18, h: 14, label: "Verify room size", createdAt: "Apr 19" },
    { id: "mk2", userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", tool: "pen", path: "M 55,40 L 62,42 L 68,40 L 74,43 L 80,41", createdAt: "Apr 19" },
    { id: "mk3", userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", tool: "text", x: 45, y: 68, text: "Check dim", createdAt: "Apr 19" },
    { id: "mk4", userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", tool: "circle", x: 72, y: 55, r: 6, createdAt: "Apr 18" },
    { id: "mk5", userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", tool: "rect", x: 65, y: 72, w: 12, h: 10, label: "Steel scope", createdAt: "Apr 18" },
  ],
  "S-102": [
    { id: "mk6", userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", tool: "circle", x: 45, y: 38, r: 7, createdAt: "Apr 17" },
    { id: "mk7", userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", tool: "rect", x: 30, y: 55, w: 20, h: 12, label: "Beam callout", createdAt: "Apr 17" },
  ],
};

// Calibration per sheet (pdf.js text extraction reads scale from title block; user
// can confirm or re-calibrate by clicking two points of known distance).
const calibrationBySheetId = {
  "A-101": { scale: '1/8" = 1\'-0"', source: "title block", calibratedBy: "Dan Carter", calibratedAt: "Apr 19" },
  "A-102": { scale: '1/8" = 1\'-0"', source: "title block", calibratedBy: "auto", calibratedAt: "Apr 15" },
  "S-101": { scale: '1/8" = 1\'-0"', source: "title block", calibratedBy: "auto", calibratedAt: "Apr 15" },
  "S-102": { scale: '1/4" = 1\'-0"', source: "manual", calibratedBy: "Marcus Chen", calibratedAt: "Apr 17" },
};

// Persistent measurements. Linear = two points + formatted distance.
// Area = polygon vertices + formatted area. Coords are 0–100 fractional.
const measurementsBySheetId = {
  "A-101": [
    { id: "ms1", userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", type: "linear", x1: 14, y1: 30, x2: 40, y2: 30, label: "24'-6\"", createdAt: "Apr 19" },
    { id: "ms2", userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", type: "linear", x1: 42, y1: 33, x2: 42, y2: 56, label: "14'-0\"", createdAt: "Apr 19" },
    { id: "ms3", userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", type: "area", points: [[55, 62], [78, 62], [78, 82], [55, 82]], label: "348 SF", createdAt: "Apr 19" },
  ],
  "S-102": [
    { id: "ms4", userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", type: "linear", x1: 18, y1: 78, x2: 78, y2: 78, label: "28'-4\" · W18×35", createdAt: "Apr 18" },
  ],
};

// ─── Comments per Sheet (x,y fractional coords) ───────────────────────────
const commentsBySheetId = {
  "A-101": [
    { id: "cm1", num: 1, userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", x: 32, y: 42, text: "Confirm ceiling height here is 10'-0\" per spec §09200.", createdAt: "Apr 19", replies: 1, resolved: false },
    { id: "cm2", num: 2, userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", x: 68, y: 58, text: "Steel column here conflicts with my stair rail detail on A-401.", createdAt: "Apr 18", replies: 3, resolved: false },
    { id: "cm3", num: 3, userId: "em", userName: "Emma Morales", userInitials: "EM", userColor: "#c17a1a", x: 50, y: 28, text: "Door swing revised per RFI-014 response.", createdAt: "Mar 15", replies: 0, resolved: true },
    { id: "cm4", num: 4, userId: "dc", userName: "Dan Carter", userInitials: "DC", userColor: "#5b4fc7", x: 78, y: 80, text: "Need submittal reference for this partition type.", createdAt: "Apr 19", replies: 0, resolved: false },
  ],
  "S-102": [
    { id: "cm5", num: 1, userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", x: 40, y: 35, text: "Beam W18x35 — confirm depth fits above MEP zone.", createdAt: "Apr 17", replies: 2, resolved: false },
    { id: "cm6", num: 2, userId: "mc", userName: "Marcus Chen", userInitials: "MC", userColor: "#3d6b8e", x: 62, y: 60, text: "Connection type TC-3 — verify with S-502.", createdAt: "Apr 17", replies: 0, resolved: false },
  ],
};

// ─── Activity Feed ────────────────────────────────────────────────────────
const activityFeed = [
  { color: "purple", text: "Emma Morales uploaded 100% CD Set v3 (42 sheets)", time: "2h ago" },
  { color: "purple", text: "3 sheets flagged as changed between v2 and v3", time: "2h ago" },
  { color: "purple", text: "Dan Carter added markup on A-101 (5 annotations)", time: "yesterday" },
  { color: "teal", text: "Marcus Chen (Steel Frame) pinned comment on S-102", time: "2d ago" },
  { color: "teal", text: "Marcus Chen viewed sheet set — scoped to structural", time: "2d ago" },
  { color: "green", text: "Comment thread resolved on A-101 (door swing)", time: "Mar 15" },
  { color: "purple", text: "Emma Morales uploaded 100% CD Set v2", time: "Feb 20" },
];

// ─── Icons ────────────────────────────────────────────────────────────────
const I = {
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  pan: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V4a2 2 0 014 0v3M10 13V3a2 2 0 014 0v6M14 13V5a2 2 0 014 0v9M18 12a2 2 0 014 0v3a7 7 0 01-7 7h-2a7 7 0 01-5.66-2.92L3.5 15.5A2 2 0 016.5 13l1.5 2"/></svg>,
  pen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
  text: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  rect: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  circle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>,
  measure: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.3 15.3 15.3 21.3a1 1 0 0 1-1.4 0L2.7 10.1a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0l11.2 11.2a1 1 0 0 1 0 1.4z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/></svg>,
  calibrate: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4M17 12h4M12 3v4M12 17v4"/><circle cx="12" cy="12" r="3"/></svg>,
  comment: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  zoomIn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  zoomOut: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  layers: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  compare: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  chevRight: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  tag: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  more: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  send: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>,
  file: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  archive: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  mobile: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  revert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
};

// ─── Logo Mark ────────────────────────────────────────────────────────────
const LogoMark = () => (
  <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#2c2541,var(--accent))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.45)"/><rect x="5" y="3" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.65)"/><rect x="8" y="7" width="9" height="6" rx="1.5" fill="rgba(255,255,255,.95)"/></svg>
  </div>
);

// ─── Discipline Color Map ────────────────────────────────────────────────
const disciplineColors = {
  A: { bg: "#eeedfb", text: "#4a3fb0", border: "#c7c2ea", label: "Architectural" },
  S: { bg: "#e8f1fa", text: "#276299", border: "#b3d1ec", label: "Structural" },
  E: { bg: "#fdf4e6", text: "#96600f", border: "#f0cc8a", label: "Electrical" },
  M: { bg: "#e6f5f1", text: "#1f6b5c", border: "#b0d9cf", label: "Mechanical" },
  P: { bg: "#e8f1fa", text: "#276299", border: "#b3d1ec", label: "Plumbing" },
};

// ─── Mini Sheet Thumbnail (stylized architectural preview) ───────────────
function SheetThumbnail({ sheet, active, onClick, changed }) {
  const d = disciplineColors[sheet.discipline] || disciplineColors.A;
  return (
    <div className={`dr-thumb${active ? " active" : ""}`} onClick={onClick}>
      <div className="dr-thumb-preview">
        <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
          {/* sheet background */}
          <rect x="2" y="2" width="96" height="76" fill="var(--surface-1)" stroke="var(--surface-4)" strokeWidth=".5"/>
          {/* title block (right strip) */}
          <rect x="75" y="4" width="21" height="72" fill="var(--surface-2)" stroke="var(--surface-3)" strokeWidth=".3"/>
          <line x1="75" y1="20" x2="96" y2="20" stroke="var(--surface-4)" strokeWidth=".3"/>
          <line x1="75" y1="55" x2="96" y2="55" stroke="var(--surface-4)" strokeWidth=".3"/>
          <text x="85.5" y="14" textAnchor="middle" fontSize="5" fontFamily="JetBrains Mono" fill="var(--text-tertiary)" fontWeight="500">{sheet.number}</text>
          {/* mock drawing content varies by discipline */}
          {sheet.discipline === "A" && (
            <g stroke={d.text} strokeWidth=".4" fill="none" opacity=".5">
              <rect x="8" y="12" width="60" height="56"/>
              <line x1="30" y1="12" x2="30" y2="68"/>
              <line x1="48" y1="12" x2="48" y2="68"/>
              <line x1="8" y1="36" x2="68" y2="36"/>
              <line x1="8" y1="52" x2="68" y2="52"/>
              <circle cx="15" cy="19" r="1.5" fill={d.text} opacity=".3"/>
              <circle cx="36" cy="44" r="1" fill={d.text} opacity=".3"/>
            </g>
          )}
          {sheet.discipline === "S" && (
            <g stroke={d.text} strokeWidth=".5" fill="none" opacity=".5">
              <line x1="10" y1="20" x2="68" y2="20"/>
              <line x1="10" y1="35" x2="68" y2="35"/>
              <line x1="10" y1="50" x2="68" y2="50"/>
              <line x1="10" y1="65" x2="68" y2="65"/>
              <line x1="15" y1="15" x2="15" y2="70"/>
              <line x1="30" y1="15" x2="30" y2="70"/>
              <line x1="48" y1="15" x2="48" y2="70"/>
              <line x1="63" y1="15" x2="63" y2="70"/>
              <rect x="14" y="19" width="2" height="2" fill={d.text}/>
              <rect x="29" y="19" width="2" height="2" fill={d.text}/>
              <rect x="47" y="19" width="2" height="2" fill={d.text}/>
              <rect x="62" y="19" width="2" height="2" fill={d.text}/>
            </g>
          )}
          {sheet.discipline === "E" && (
            <g stroke={d.text} strokeWidth=".3" fill="none" opacity=".5">
              <rect x="8" y="12" width="60" height="56"/>
              {[20, 30, 40, 50, 60].map(y => [15, 30, 45, 60].map(x => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r=".8" fill={d.text}/>
              )))}
              <path d="M 15 20 L 30 20 L 30 30 L 45 30" strokeDasharray="1,1"/>
            </g>
          )}
          {sheet.discipline === "M" && (
            <g stroke={d.text} strokeWidth=".4" fill="none" opacity=".5">
              <rect x="8" y="12" width="60" height="56"/>
              <path d="M 10 18 L 65 18 L 65 28 L 18 28 L 18 38 L 55 38 L 55 50 L 25 50 L 25 62 L 50 62" />
              <rect x="50" y="30" width="4" height="6" fill={d.text} opacity=".5"/>
              <rect x="20" y="42" width="4" height="6" fill={d.text} opacity=".5"/>
            </g>
          )}
          {sheet.discipline === "P" && (
            <g stroke={d.text} strokeWidth=".4" fill="none" opacity=".5">
              <rect x="8" y="12" width="60" height="56"/>
              <path d="M 12 15 L 12 68"/>
              <path d="M 40 15 L 40 68"/>
              <circle cx="20" cy="25" r="2"/>
              <circle cx="20" cy="45" r="2"/>
              <circle cx="55" cy="25" r="2"/>
              <circle cx="55" cy="55" r="2"/>
              <line x1="20" y1="25" x2="40" y2="25"/>
              <line x1="40" y1="45" x2="20" y2="45"/>
            </g>
          )}
        </svg>
      </div>
      <div className="dr-thumb-meta">
        <div className="dr-thumb-num">{sheet.number}</div>
        <div className="dr-thumb-title">{sheet.title}</div>
      </div>
      {changed && <div className="dr-thumb-changed">Changed</div>}
      {(sheet.markupCount > 0 || sheet.commentCount > 0) && (
        <div className="dr-thumb-badges">
          {sheet.markupCount > 0 && <span className="dr-thumb-badge mk">{sheet.markupCount}</span>}
          {sheet.commentCount > 0 && <span className="dr-thumb-badge cm">{sheet.commentCount}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Full Sheet Mock (SVG architectural drawing simulation) ──────────────
function SheetCanvas({ sheet, markups, measurements, calibration, comments, tool, showComments, compareMode, selectedCommentId, onPinClick, onMarkupClick }) {
  if (!sheet) return null;
  const d = disciplineColors[sheet.discipline] || disciplineColors.A;

  return (
    <div className="dr-sheet-canvas" style={{ cursor: tool === "pan" ? "grab" : "crosshair" }}>
      <svg viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
        {/* Sheet background with paper shadow */}
        <defs>
          <filter id="paperShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity=".12"/>
          </filter>
          <pattern id="gridPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--surface-3)" strokeWidth=".5" opacity=".4"/>
          </pattern>
        </defs>

        <rect x="40" y="30" width="920" height="660" fill="var(--surface-1)" stroke="var(--surface-4)" strokeWidth="1" filter="url(#paperShadow)"/>

        {/* Title block (right side) */}
        <g>
          <rect x="780" y="50" width="170" height="620" fill="var(--surface-2)" stroke="var(--surface-3)" strokeWidth=".8"/>
          <line x1="780" y1="110" x2="950" y2="110" stroke="var(--surface-4)" strokeWidth=".6"/>
          <line x1="780" y1="240" x2="950" y2="240" stroke="var(--surface-4)" strokeWidth=".6"/>
          <line x1="780" y1="380" x2="950" y2="380" stroke="var(--surface-4)" strokeWidth=".6"/>
          <line x1="780" y1="520" x2="950" y2="520" stroke="var(--surface-4)" strokeWidth=".6"/>
          <text x="790" y="75" fontSize="11" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">PROJECT</text>
          <text x="790" y="92" fontSize="13" fontFamily="DM Sans" fill="var(--text-primary)" fontWeight="700">Riverside Office</text>
          <text x="790" y="105" fontSize="11" fontFamily="Instrument Sans" fill="var(--text-secondary)">Complex</text>
          <text x="790" y="135" fontSize="11" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">SHEET</text>
          <text x="790" y="170" fontSize="36" fontFamily="JetBrains Mono" fill="var(--text-primary)" fontWeight="500">{sheet.number}</text>
          <text x="790" y="195" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">TITLE</text>
          <text x="790" y="215" fontSize="12" fontFamily="DM Sans" fill="var(--text-primary)" fontWeight="650">{sheet.title}</text>
          <text x="790" y="265" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">DATE</text>
          <text x="790" y="282" fontSize="11" fontFamily="Instrument Sans" fill="var(--text-secondary)">03 / 15 / 2026</text>
          <text x="790" y="305" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">SCALE</text>
          <text x="790" y="322" fontSize="11" fontFamily="JetBrains Mono" fill="var(--text-secondary)">1/8" = 1'-0"</text>
          <text x="790" y="345" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">DRAWN</text>
          <text x="790" y="362" fontSize="11" fontFamily="JetBrains Mono" fill="var(--text-secondary)">EM / RK</text>
          <text x="790" y="405" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">REVISION</text>
          <text x="790" y="440" fontSize="24" fontFamily="JetBrains Mono" fill="var(--accent)" fontWeight="500">3</text>
          <text x="820" y="440" fontSize="10" fontFamily="Instrument Sans" fill="var(--text-tertiary)">current</text>
          <text x="790" y="545" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">ARCHITECT</text>
          <text x="790" y="562" fontSize="11" fontFamily="Instrument Sans" fill="var(--text-secondary)">Morales + Kline</text>
          <text x="790" y="576" fontSize="11" fontFamily="Instrument Sans" fill="var(--text-secondary)">Associates</text>
          <text x="790" y="600" fontSize="10" fontFamily="DM Sans" fill="var(--text-tertiary)" fontWeight="700" letterSpacing=".1em">DISCIPLINE</text>
          <rect x="790" y="612" width="100" height="22" rx="4" fill={d.bg} stroke={d.border}/>
          <text x="840" y="627" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} fontWeight="700">{d.label}</text>
        </g>

        {/* Drawing area */}
        <rect x="60" y="50" width="700" height="620" fill="url(#gridPattern)"/>

        {/* Simulated architectural plan content based on discipline */}
        <g>
          {sheet.discipline === "A" && (
            <g stroke={d.text} strokeWidth="1.8" fill="none" opacity=".7">
              {/* outer walls */}
              <rect x="100" y="90" width="640" height="540" strokeWidth="3"/>
              {/* interior walls */}
              <line x1="300" y1="90" x2="300" y2="400"/>
              <line x1="500" y1="90" x2="500" y2="400"/>
              <line x1="100" y1="400" x2="740" y2="400"/>
              <line x1="200" y1="400" x2="200" y2="630"/>
              <line x1="420" y1="400" x2="420" y2="630"/>
              <line x1="600" y1="400" x2="600" y2="630"/>
              <line x1="100" y1="520" x2="200" y2="520"/>
              <line x1="420" y1="520" x2="600" y2="520"/>
              {/* door swings */}
              <path d="M 250 90 A 40 40 0 0 1 290 130" strokeWidth="1"/>
              <path d="M 250 90 L 290 90" strokeWidth="2"/>
              <path d="M 450 400 A 40 40 0 0 0 450 360" strokeWidth="1"/>
              <path d="M 450 400 L 450 360" strokeWidth="2"/>
              {/* windows (on outer walls) */}
              <line x1="150" y1="90" x2="220" y2="90" strokeWidth="1" strokeDasharray="3,2"/>
              <line x1="550" y1="90" x2="720" y2="90" strokeWidth="1" strokeDasharray="3,2"/>
              <line x1="100" y1="150" x2="100" y2="350" strokeWidth="1" strokeDasharray="3,2"/>
              {/* dimension lines */}
              <g strokeWidth=".6" opacity=".5">
                <line x1="100" y1="60" x2="300" y2="60"/>
                <line x1="100" y1="55" x2="100" y2="65"/>
                <line x1="300" y1="55" x2="300" y2="65"/>
                <line x1="300" y1="60" x2="500" y2="60"/>
                <line x1="500" y1="55" x2="500" y2="65"/>
                <line x1="500" y1="60" x2="740" y2="60"/>
                <line x1="740" y1="55" x2="740" y2="65"/>
              </g>
              {/* text labels */}
              <text x="200" y="255" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">CONFERENCE</text>
              <text x="200" y="270" textAnchor="middle" fontSize="9" fontFamily="Instrument Sans" fill={d.text} opacity=".6">204</text>
              <text x="400" y="255" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">OPEN OFFICE</text>
              <text x="400" y="270" textAnchor="middle" fontSize="9" fontFamily="Instrument Sans" fill={d.text} opacity=".6">205</text>
              <text x="620" y="255" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">BREAK</text>
              <text x="620" y="270" textAnchor="middle" fontSize="9" fontFamily="Instrument Sans" fill={d.text} opacity=".6">206</text>
              <text x="150" y="475" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">CORRIDOR</text>
              <text x="310" y="475" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">OFFICE</text>
              <text x="310" y="490" textAnchor="middle" fontSize="9" fontFamily="Instrument Sans" fill={d.text} opacity=".6">207</text>
              <text x="510" y="475" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">OFFICE</text>
              <text x="510" y="490" textAnchor="middle" fontSize="9" fontFamily="Instrument Sans" fill={d.text} opacity=".6">208</text>
              <text x="670" y="475" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".8" fontWeight="600">STAIR 2</text>
              {/* column grid dots */}
              {[200, 400, 600].map(x => [180, 380, 580].map(y => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={d.text} opacity=".4"/>
              )))}
            </g>
          )}
          {sheet.discipline === "S" && (
            <g stroke={d.text} strokeWidth="1.5" fill="none" opacity=".7">
              {/* grid lines with bubbles */}
              {[150, 290, 430, 570, 710].map((x, i) => (
                <g key={i}>
                  <line x1={x} y1="90" x2={x} y2="630" strokeDasharray="4,2" strokeWidth="1"/>
                  <circle cx={x} cy="75" r="14" strokeWidth="1.5"/>
                  <text x={x} y="80" textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono" fill={d.text} fontWeight="500">{String.fromCharCode(64 + i + 1)}</text>
                </g>
              ))}
              {[130, 270, 410, 550].map((y, i) => (
                <g key={i}>
                  <line x1="100" y1={y} x2="740" y2={y} strokeDasharray="4,2" strokeWidth="1"/>
                  <circle cx="115" cy={y} r="14" strokeWidth="1.5"/>
                  <text x="115" y={y + 4} textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono" fill={d.text} fontWeight="500">{i + 1}</text>
                </g>
              ))}
              {/* beams */}
              {[150, 290, 430, 570, 710].map((x, i) => (
                <rect key={`c-${i}`} x={x - 8} y={120} width="16" height="16" fill={d.text} opacity=".3"/>
              ))}
              {[150, 290, 430, 570, 710].map((x, i) => (
                <rect key={`c2-${i}`} x={x - 8} y={260} width="16" height="16" fill={d.text} opacity=".3"/>
              ))}
              {[150, 290, 430, 570, 710].map((x, i) => (
                <rect key={`c3-${i}`} x={x - 8} y={400} width="16" height="16" fill={d.text} opacity=".3"/>
              ))}
              {[150, 290, 430, 570, 710].map((x, i) => (
                <rect key={`c4-${i}`} x={x - 8} y={540} width="16" height="16" fill={d.text} opacity=".3"/>
              ))}
              {/* beam callouts */}
              <text x="220" y="125" fontSize="9" fontFamily="JetBrains Mono" fill={d.text}>W18x35</text>
              <text x="360" y="125" fontSize="9" fontFamily="JetBrains Mono" fill={d.text}>W18x35</text>
              <text x="500" y="125" fontSize="9" fontFamily="JetBrains Mono" fill={d.text}>W21x44</text>
              <text x="640" y="125" fontSize="9" fontFamily="JetBrains Mono" fill={d.text}>W18x35</text>
            </g>
          )}
          {(sheet.discipline === "E" || sheet.discipline === "M" || sheet.discipline === "P") && (
            <g stroke={d.text} strokeWidth="1.5" fill="none" opacity=".65">
              <rect x="100" y="90" width="640" height="540"/>
              <line x1="300" y1="90" x2="300" y2="400"/>
              <line x1="500" y1="90" x2="500" y2="400"/>
              <line x1="100" y1="400" x2="740" y2="400"/>
              {/* system-specific symbols */}
              {sheet.discipline === "E" && (
                <g>
                  {[[180, 180], [380, 180], [580, 180], [180, 300], [380, 300], [580, 300], [180, 500], [380, 500], [580, 500]].map(([x, y], i) => (
                    <g key={i}>
                      <circle cx={x} cy={y} r="8" fill={d.text} opacity=".15" strokeWidth="1"/>
                      <circle cx={x} cy={y} r="4" fill={d.text} opacity=".6"/>
                    </g>
                  ))}
                  <path d="M 180 180 L 180 300 M 380 180 L 380 300 M 580 180 L 580 300" strokeDasharray="2,2" strokeWidth=".8"/>
                </g>
              )}
              {sheet.discipline === "M" && (
                <g>
                  <path d="M 120 150 L 720 150 L 720 260 L 140 260 L 140 380 L 720 380" strokeWidth="6" opacity=".3"/>
                  <path d="M 120 150 L 720 150 L 720 260 L 140 260 L 140 380 L 720 380" strokeWidth="1.5"/>
                  {[[200, 150], [400, 150], [600, 150], [250, 260], [500, 260]].map(([x, y], i) => (
                    <rect key={i} x={x - 10} y={y - 6} width="20" height="12" fill={d.text} opacity=".4"/>
                  ))}
                </g>
              )}
              {sheet.discipline === "P" && (
                <g>
                  <path d="M 140 130 L 140 600" strokeWidth="3" opacity=".4"/>
                  <path d="M 140 130 L 140 600" strokeWidth="1.2"/>
                  <path d="M 400 130 L 400 600" strokeWidth="3" opacity=".4"/>
                  <path d="M 400 130 L 400 600" strokeWidth="1.2"/>
                  {[[140, 200, 6], [140, 350, 6], [140, 500, 6], [400, 200, 6], [400, 350, 6], [400, 500, 6], [220, 200, 4], [220, 500, 4]].map(([x, y, r], i) => (
                    <circle key={i} cx={x} cy={y} r={r} fill={d.text} opacity=".5"/>
                  ))}
                  <path d="M 140 200 L 220 200 M 140 500 L 220 500 M 140 350 L 400 350" strokeWidth="1"/>
                </g>
              )}
              <text x="200" y="255" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".7" fontWeight="600">ZONE A</text>
              <text x="400" y="255" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".7" fontWeight="600">ZONE B</text>
              <text x="600" y="255" textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill={d.text} opacity=".7" fontWeight="600">ZONE C</text>
            </g>
          )}
        </g>

        {/* Compare mode overlay: diff highlight */}
        {compareMode && (
          <g opacity=".35">
            <rect x="280" y="200" width="140" height="180" fill="#c93b3b" opacity=".25"/>
            <rect x="280" y="200" width="140" height="180" fill="none" stroke="#c93b3b" strokeWidth="2" strokeDasharray="6,3"/>
            <text x="350" y="195" textAnchor="middle" fontSize="10" fontFamily="DM Sans" fill="#c93b3b" fontWeight="700" letterSpacing=".05em">CHANGED IN v3</text>
          </g>
        )}

        {/* Markups layer */}
        {!compareMode && markups.map(m => {
          if (m.tool === "rect") {
            return (
              <g key={m.id} className="dr-markup" onClick={() => onMarkupClick && onMarkupClick(m)} style={{ cursor: "pointer" }}>
                <rect x={60 + (m.x / 100) * 700} y={50 + (m.y / 100) * 620} width={(m.w / 100) * 700} height={(m.h / 100) * 620} fill={m.userColor} fillOpacity=".1" stroke={m.userColor} strokeWidth="2"/>
                {m.label && (
                  <g>
                    <rect x={60 + (m.x / 100) * 700 + 4} y={50 + (m.y / 100) * 620 + 4} width="86" height="18" rx="3" fill={m.userColor}/>
                    <text x={60 + (m.x / 100) * 700 + 47} y={50 + (m.y / 100) * 620 + 16} textAnchor="middle" fontSize="10" fontFamily="DM Sans" fill="#fff" fontWeight="700">{m.label}</text>
                  </g>
                )}
              </g>
            );
          }
          if (m.tool === "circle") {
            return (
              <g key={m.id} className="dr-markup" onClick={() => onMarkupClick && onMarkupClick(m)} style={{ cursor: "pointer" }}>
                <circle cx={60 + (m.x / 100) * 700} cy={50 + (m.y / 100) * 620} r={(m.r / 100) * 700} fill={m.userColor} fillOpacity=".1" stroke={m.userColor} strokeWidth="2"/>
              </g>
            );
          }
          if (m.tool === "pen") {
            // scale path coordinates (simple: they're already in 0-100 space, scale to drawing area)
            const scaled = m.path.replace(/(\d+),(\d+)/g, (_, x, y) => `${60 + (parseFloat(x) / 100) * 700},${50 + (parseFloat(y) / 100) * 620}`);
            return (
              <path key={m.id} d={scaled} fill="none" stroke={m.userColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".85"/>
            );
          }
          if (m.tool === "text") {
            return (
              <g key={m.id} className="dr-markup" onClick={() => onMarkupClick && onMarkupClick(m)} style={{ cursor: "pointer" }}>
                <rect x={60 + (m.x / 100) * 700 - 4} y={50 + (m.y / 100) * 620 - 14} width={m.text.length * 7.5 + 8} height="20" rx="3" fill={m.userColor} fillOpacity=".95"/>
                <text x={60 + (m.x / 100) * 700} y={50 + (m.y / 100) * 620} fontSize="12" fontFamily="DM Sans" fill="#fff" fontWeight="650">{m.text}</text>
              </g>
            );
          }
          return null;
        })}

        {/* Measurements (linear + area) — persisted, calibrated against sheet scale */}
        {!compareMode && measurements && measurements.map(m => {
          if (m.type === "linear") {
            const x1 = 60 + (m.x1 / 100) * 700;
            const y1 = 50 + (m.y1 / 100) * 620;
            const x2 = 60 + (m.x2 / 100) * 700;
            const y2 = 50 + (m.y2 / 100) * 620;
            const midx = (x1 + x2) / 2;
            const midy = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            // Perpendicular unit vector for tick marks
            const px = -dy / len;
            const py = dx / len;
            const tick = 6;
            const labelW = m.label.length * 6.2 + 10;
            return (
              <g key={m.id} className="dr-measure" style={{ pointerEvents: "none" }}>
                {/* Tick marks at endpoints */}
                <line x1={x1 - px * tick} y1={y1 - py * tick} x2={x1 + px * tick} y2={y1 + py * tick} stroke={m.userColor} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1={x2 - px * tick} y1={y2 - py * tick} x2={x2 + px * tick} y2={y2 + py * tick} stroke={m.userColor} strokeWidth="1.8" strokeLinecap="round"/>
                {/* Dimension line */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={m.userColor} strokeWidth="1.4" strokeDasharray="3 2" opacity=".9"/>
                {/* Label with background */}
                <rect x={midx - labelW / 2} y={midy - 8} width={labelW} height="15" rx="2.5" fill="#fff" stroke={m.userColor} strokeWidth="1.2"/>
                <text x={midx} y={midy + 3} textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono" fill={m.userColor} fontWeight="600">{m.label}</text>
              </g>
            );
          }
          if (m.type === "area") {
            const pts = m.points.map(([px, py]) => `${60 + (px / 100) * 700},${50 + (py / 100) * 620}`).join(" ");
            // Centroid for label placement
            const cx = 60 + (m.points.reduce((s, [px]) => s + px, 0) / m.points.length / 100) * 700;
            const cy = 50 + (m.points.reduce((s, [, py]) => s + py, 0) / m.points.length / 100) * 620;
            const labelW = m.label.length * 6.2 + 12;
            return (
              <g key={m.id} className="dr-measure" style={{ pointerEvents: "none" }}>
                <polygon points={pts} fill={m.userColor} fillOpacity=".08" stroke={m.userColor} strokeWidth="1.4" strokeDasharray="4 3"/>
                <rect x={cx - labelW / 2} y={cy - 8} width={labelW} height="16" rx="2.5" fill="#fff" stroke={m.userColor} strokeWidth="1.2"/>
                <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill={m.userColor} fontWeight="600">{m.label}</text>
              </g>
            );
          }
          return null;
        })}

        {/* Comment pins */}
        {showComments && !compareMode && comments.map(c => {
          const cx = 60 + (c.x / 100) * 700;
          const cy = 50 + (c.y / 100) * 620;
          const isSelected = selectedCommentId === c.id;
          return (
            <g key={c.id} className="dr-pin" onClick={() => onPinClick && onPinClick(c)} style={{ cursor: "pointer" }}>
              {isSelected && <circle cx={cx} cy={cy} r="22" fill={c.userColor} opacity=".18"/>}
              <circle cx={cx} cy={cy} r="13" fill={c.resolved ? "#2d8a5e" : c.userColor} stroke="#fff" strokeWidth="2.5"/>
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill="#fff" fontWeight="700">{c.num}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DrawingsModule() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("sets"); // sets | index | detail
  const [selectedSetId, setSelectedSetId] = useState("cd-v3");
  const [selectedSheetId, setSelectedSheetId] = useState("A-101");
  const [tool, setTool] = useState("pan");
  const [showComments, setShowComments] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState("cd-v2");
  const [showUpload, setShowUpload] = useState(false);
  const [roleView, setRoleView] = useState("contractor"); // contractor | subcontractor
  const [sheetFilter, setSheetFilter] = useState("all");
  const [indexLayout, setIndexLayout] = useState("grid"); // grid | list
  const [selectedCommentId, setSelectedCommentId] = useState(null);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [sheetSearch, setSheetSearch] = useState("");
  const [newComment, setNewComment] = useState("");

  const t = dark ? "dark" : "light";
  const currentSet = drawingSets.find(s => s.id === selectedSetId);
  const sheets = sheetsBySetId[selectedSetId] || sheetsBySetId["cd-v3"];
  const currentSheet = sheets.find(s => s.id === selectedSheetId) || sheets[0];
  const markups = markupsBySheetId[selectedSheetId] || [];
  const measurements = measurementsBySheetId[selectedSheetId] || [];
  const calibration = calibrationBySheetId[selectedSheetId] || null;
  const comments = commentsBySheetId[selectedSheetId] || [];
  const selectedComment = comments.find(c => c.id === selectedCommentId);

  // Sheet filtering
  const lowerSearch = sheetSearch.toLowerCase();
  const filteredSheets = sheets.filter(s => {
    if (sheetFilter !== "all" && s.discipline !== sheetFilter) return false;
    if (lowerSearch && !s.number.toLowerCase().includes(lowerSearch) && !s.title.toLowerCase().includes(lowerSearch)) return false;
    return true;
  });

  // Version chain
  const versionChain = drawingSets.filter(s => s.family === currentSet?.family).sort((a, b) => b.version - a.version);

  // Sub-scoped filter: if subcontractor, restrict to structural only (demo)
  const isSub = roleView === "subcontractor";
  const subScopedSheets = isSub ? filteredSheets.filter(s => s.discipline === "S") : filteredSheets;

  // Counts for summary strip
  const currentSets = drawingSets.filter(s => s.status === "current").length;
  const totalSheets = drawingSets.filter(s => s.status === "current").reduce((sum, s) => sum + s.sheetCount, 0);
  const changedSheetsInCurrent = sheets.filter(s => s.changed).length;
  const totalMarkups = sheets.reduce((sum, s) => sum + s.markupCount, 0);
  const totalComments = sheets.reduce((sum, s) => sum + s.commentCount, 0);

  const handleSheetOpen = (sheetId) => {
    setSelectedSheetId(sheetId);
    setView("detail");
    setSelectedCommentId(null);
    setCompareMode(false);
  };

  const handlePinClick = (comment) => {
    setSelectedCommentId(comment.id === selectedCommentId ? null : comment.id);
  };

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{`
[data-theme="light"]{
  --surface-0:#eef0f3;--surface-1:#ffffff;--surface-2:#f3f4f6;--surface-3:#e2e5e9;--surface-4:#d1d5db;
  --surface-hover:#f5f6f8;--surface-incard:#f8f9fa;--sheet-bg:#fafaf8;
  --sidebar-bg:#ffffff;--sidebar-hover:#f5f6f8;--sidebar-active:#eef0f3;--sidebar-active-text:#1a1714;
  --sidebar-section-text:#8b919a;--sidebar-item-text:#5a6170;--sidebar-border:#e8eaee;
  --text-primary:#1a1714;--text-secondary:#6b655b;--text-tertiary:#9c958a;--text-inverse:#faf9f7;
  --accent:#5b4fc7;--accent-hover:#4f44b3;--accent-soft:#eeedfb;--accent-text:#4a3fb0;--accent-muted:#c7c2ea;
  --accent-sub:#3d6b8e;--accent-sub-soft:#e5eef5;--accent-sub-text:#2d5273;
  --success:#2d8a5e;--success-soft:#edf7f1;--success-text:#1e6b46;
  --warning:#c17a1a;--warning-soft:#fdf4e6;--warning-text:#96600f;
  --danger:#c93b3b;--danger-soft:#fdeaea;--danger-text:#a52e2e;
  --info:#3178b9;--info-soft:#e8f1fa;--info-text:#276299;
  --teal:#2a7f6f;--teal-soft:#e6f5f1;--teal-text:#1f6b5c;
  --topbar-bg:rgba(255,255,255,.88);
  --sc-strong:linear-gradient(180deg,#fff,#f5f3ff);
  --sc-alert:linear-gradient(180deg,#fff,#fefaf3);
  --sc-info:linear-gradient(180deg,#fff,#f5f9fe);
  --sc-success:linear-gradient(180deg,#fff,#f5fdf8);
  --sc-teal:linear-gradient(180deg,#fff,#f2fbf7);
  --canvas-bg:#e6e8ec;--canvas-grid:#d1d5db;
}
[data-theme="dark"]{
  --surface-0:#0e0f11;--surface-1:#18191c;--surface-2:#1e2023;--surface-3:#2a2d31;--surface-4:#3a3e44;
  --surface-hover:#1f2124;--surface-incard:#1c1d20;--sheet-bg:#1a1b1e;
  --sidebar-bg:#141517;--sidebar-hover:#1c1d20;--sidebar-active:#1e2023;--sidebar-active-text:#f0ede8;
  --sidebar-section-text:#6b7280;--sidebar-item-text:#9ca3af;--sidebar-border:#232528;
  --text-primary:#f0ede8;--text-secondary:#a09a90;--text-tertiary:#706a60;--text-inverse:#1a1714;
  --accent:#8b7ff5;--accent-hover:#9d93ff;--accent-soft:#1e1a3a;--accent-text:#b0a6ff;--accent-muted:#4a4080;
  --accent-sub:#5a9fd4;--accent-sub-soft:#0d1a2a;--accent-sub-text:#80b8e8;
  --success:#3aad72;--success-soft:#0f251a;--success-text:#5dd89a;
  --warning:#daa050;--warning-soft:#271d0b;--warning-text:#eab96e;
  --danger:#e25555;--danger-soft:#2a1010;--danger-text:#f28080;
  --info:#5a9fd4;--info-soft:#0d1a2a;--info-text:#80b8e8;
  --teal:#40b89e;--teal-soft:#0d2520;--teal-text:#6fd4b8;
  --topbar-bg:rgba(14,15,17,.88);
  --sc-strong:linear-gradient(180deg,var(--surface-1),#1a1530);
  --sc-alert:linear-gradient(180deg,var(--surface-1),var(--warning-soft));
  --sc-info:linear-gradient(180deg,var(--surface-1),var(--info-soft));
  --sc-success:linear-gradient(180deg,var(--surface-1),var(--success-soft));
  --sc-teal:linear-gradient(180deg,var(--surface-1),var(--teal-soft));
  --canvas-bg:#0a0b0d;--canvas-grid:#2a2d31;
}

*,*::before,*::after{box-sizing:border-box;margin:0}
.dr-app{display:grid;grid-template-columns:272px 1fr;min-height:100vh;font-family:'Instrument Sans',system-ui,sans-serif;background:var(--surface-0);color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px}

/* SIDEBAR */
.dr-sidebar{background:var(--sidebar-bg);border-right:1px solid var(--sidebar-border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.dr-brand{height:56px;display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0}
.dr-brand-name{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:-.02em}
.dr-brand-ctx{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}
.dr-sb-search{padding:12px 16px;border-bottom:1px solid var(--sidebar-border);flex-shrink:0;position:relative}
.dr-sb-input{width:100%;height:36px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);padding:0 12px 0 34px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;color:var(--text-primary);outline:none;font-weight:520}
.dr-sb-input:focus{border-color:var(--accent)}
.dr-sb-search-icon{position:absolute;left:28px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);pointer-events:none}
.dr-sb-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.dr-ns-label{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;color:var(--sidebar-section-text);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.dr-ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:10px;font-size:13px;color:var(--sidebar-item-text);font-weight:520;cursor:pointer;margin-bottom:2px;transition:all .15s}
.dr-ni:hover{background:var(--sidebar-hover);color:var(--sidebar-active-text)}
.dr-ni.active{background:var(--accent-soft);color:var(--accent-text);font-weight:650}
.dr-ni-badge{min-width:20px;height:20px;padding:0 7px;border-radius:999px;background:var(--surface-2);color:var(--text-tertiary);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif}
.dr-ni.active .dr-ni-badge{background:var(--accent-soft);color:var(--accent-text)}
.dr-ni-badge.warn{background:var(--warning-soft);color:var(--warning-text)}
.dr-sb-foot{border-top:1px solid var(--sidebar-border);padding:12px 16px;flex-shrink:0}
.dr-u-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#7c6fe0);color:#fff;display:grid;place-items:center;font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700;flex-shrink:0}
.dr-u-av.sub{background:linear-gradient(135deg,var(--accent-sub),#6b8eb3)}

/* MAIN + TOPBAR */
.dr-main{min-width:0;display:flex;flex-direction:column}
.dr-topbar{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--surface-3);background:var(--topbar-bg);backdrop-filter:blur(12px);position:sticky;top:0;z-index:50}
.dr-bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-tertiary);font-weight:520}
.dr-bc-lnk{cursor:pointer;transition:color .15s}.dr-bc-lnk:hover{color:var(--text-secondary)}
.dr-bc-cur{color:var(--text-primary);font-weight:650}
.dr-bc-sep{font-size:11px;color:var(--surface-4)}
.dr-content{padding:24px;flex:1;min-height:0}
.dr-content.detail{padding:0;display:flex;flex-direction:column;height:calc(100vh - 56px)}
.dr-dark-toggle{position:fixed;bottom:20px;right:20px;z-index:100;width:40px;height:40px;border-radius:50%;background:var(--surface-1);border:1px solid var(--surface-3);box-shadow:0 4px 16px rgba(0,0,0,.1);display:grid;place-items:center;cursor:pointer;font-size:16px;transition:all .2s}
.dr-dark-toggle:hover{transform:scale(1.1)}

/* BUTTONS */
.dr-btn{height:38px;padding:0 16px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-1);font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;font-weight:650;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;white-space:nowrap}
.dr-btn:hover{border-color:var(--surface-4);background:var(--surface-hover)}
.dr-btn:active{transform:scale(.97)}
.dr-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.dr-btn.primary:hover{background:var(--accent-hover)}
.dr-btn.ghost{border-color:transparent;background:transparent;color:var(--text-secondary)}.dr-btn.ghost:hover{background:var(--surface-2);color:var(--text-primary)}
.dr-btn.sm{height:32px;padding:0 12px;font-size:12px}
.dr-btn.xs{height:28px;padding:0 10px;font-size:11px}
.dr-btn.icon{width:34px;padding:0;flex-shrink:0}

/* PILLS */
.dr-pill{height:22px;padding:0 9px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--surface-3);background:var(--surface-1);color:var(--text-tertiary);white-space:nowrap;flex-shrink:0;gap:4px}
.dr-pill.accent{background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent-muted)}
.dr-pill.green{background:var(--success-soft);color:var(--success-text);border-color:var(--success)}
.dr-pill.orange{background:var(--warning-soft);color:var(--warning-text);border-color:var(--warning)}
.dr-pill.red{background:var(--danger-soft);color:var(--danger-text);border-color:var(--danger)}
.dr-pill.blue{background:var(--info-soft);color:var(--info-text);border-color:var(--info)}
.dr-pill.teal{background:var(--teal-soft);color:var(--teal-text);border-color:var(--teal)}
.dr-pill.gray{background:var(--surface-2);color:var(--text-tertiary);border-color:var(--surface-3)}
.dr-pill.dark{background:var(--text-primary);color:var(--text-inverse);border-color:var(--text-primary)}

/* SUMMARY STRIP (sets view) */
.dr-page-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.dr-page-title{font-family:'DM Sans',system-ui,sans-serif;font-size:24px;font-weight:750;letter-spacing:-.03em}
.dr-page-desc{margin-top:4px;font-size:13px;color:var(--text-secondary);max-width:560px;font-weight:520}
.dr-page-actions{display:flex;gap:8px;align-items:center;flex-shrink:0}

.dr-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.dr-sc{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;padding:13px 15px;box-shadow:0 1px 3px rgba(26,23,20,.05)}
.dr-sc.strong{border-color:var(--accent-muted);background:var(--sc-strong)}
.dr-sc.alert{border-color:#f5d5a0;background:var(--sc-alert)}
.dr-sc.info{border-color:#b3d1ec;background:var(--sc-info)}
.dr-sc.success{border-color:#b0dfc4;background:var(--sc-success)}
.dr-sc.teal{border-color:#b0d9cf;background:var(--sc-teal)}
.dr-sc-label{font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary)}
.dr-sc-value{font-family:'DM Sans',system-ui,sans-serif;font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.dr-sc-meta{font-size:12px;color:var(--text-tertiary);margin-top:2px;font-weight:520}

/* SETS LIST */
.dr-sets-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.dr-sets-list{display:flex;flex-direction:column;gap:12px}
.dr-set-card{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:16px;padding:18px 22px;cursor:pointer;transition:all .15s;display:flex;gap:18px;align-items:flex-start}
.dr-set-card:hover{border-color:var(--accent-muted);box-shadow:0 4px 18px rgba(91,79,199,.08);transform:translateY(-1px)}
.dr-set-card.current{border-left:3px solid var(--accent)}
.dr-set-card.superseded{opacity:.72;border-style:dashed}
.dr-set-icon{width:48px;height:48px;border-radius:12px;background:var(--accent-soft);color:var(--accent-text);display:grid;place-items:center;flex-shrink:0;border:1px solid var(--accent-muted)}
.dr-set-icon.shell{background:var(--teal-soft);color:var(--teal-text);border-color:var(--teal)}
.dr-set-icon.old{background:var(--surface-2);color:var(--text-tertiary);border-color:var(--surface-3)}
.dr-set-body{flex:1;min-width:0}
.dr-set-title-row{display:flex;align-items:center;gap:10px;margin-bottom:4px;flex-wrap:wrap}
.dr-set-title{font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:750;letter-spacing:-.02em}
.dr-set-ver{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-secondary);font-weight:500}
.dr-set-note{font-size:12.5px;color:var(--text-secondary);font-weight:520;line-height:1.5;margin-bottom:10px;max-width:540px}
.dr-set-stats{display:flex;gap:18px;flex-wrap:wrap}
.dr-set-stat{display:flex;flex-direction:column;gap:1px}
.dr-set-stat-k{font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary)}
.dr-set-stat-v{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:680;color:var(--text-primary)}
.dr-set-disciplines{display:flex;gap:4px;margin-top:10px;flex-wrap:wrap}
.dr-set-disc-tag{height:22px;padding:0 8px;border-radius:6px;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px}

/* SIDE RAIL (activity + chain) */
.dr-rail{display:flex;flex-direction:column;gap:14px}
.dr-card{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:16px;box-shadow:0 1px 3px rgba(26,23,20,.05);overflow:hidden}
.dr-card-hdr{padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--surface-2)}
.dr-card-hdr h3{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700}
.dr-card-body{padding:14px 18px}
.dr-activity{padding:6px 18px 12px}
.dr-a-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--surface-2)}
.dr-a-item:last-child{border-bottom:none}
.dr-a-dot{width:8px;height:8px;border-radius:50%;background:var(--surface-4);flex-shrink:0;margin-top:5px}
.dr-a-dot.purple{background:var(--accent)}.dr-a-dot.green{background:var(--success)}.dr-a-dot.teal{background:var(--teal)}.dr-a-dot.orange{background:var(--warning)}
.dr-a-text{flex:1;font-size:12px;color:var(--text-secondary);line-height:1.45;font-weight:520}
.dr-a-time{font-size:11px;color:var(--text-tertiary);white-space:nowrap;flex-shrink:0;font-weight:520}

.dr-chain{padding:6px 18px 14px;display:flex;flex-direction:column;gap:0}
.dr-chain-step{display:flex;gap:12px;position:relative;padding:10px 0}
.dr-chain-step::before{content:'';position:absolute;left:11px;top:28px;bottom:0;width:2px;background:var(--surface-3)}
.dr-chain-step:last-child::before{display:none}
.dr-chain-dot{width:24px;height:24px;border-radius:50%;border:2px solid var(--surface-3);background:var(--surface-1);display:grid;place-items:center;flex-shrink:0;z-index:1;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:var(--text-tertiary)}
.dr-chain-step.current .dr-chain-dot{background:var(--accent);border-color:var(--accent);color:#fff}
.dr-chain-info{flex:1}
.dr-chain-info h5{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:680}
.dr-chain-info p{font-size:11px;color:var(--text-tertiary);margin-top:1px;font-weight:520}

/* INDEX VIEW (thumbnail grid) */
.dr-index-hdr{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.dr-index-ctx{display:flex;align-items:center;gap:10px}
.dr-index-ctx h2{font-family:'DM Sans',system-ui,sans-serif;font-size:20px;font-weight:750;letter-spacing:-.02em}
.dr-index-filters{display:flex;gap:4px;padding:4px;background:var(--surface-2);border-radius:12px}
.dr-index-filter{height:30px;padding:0 14px;border-radius:8px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:12px;font-weight:650;color:var(--text-secondary);cursor:pointer;border:none;background:none;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
.dr-index-filter:hover{color:var(--text-primary)}
.dr-index-filter.active{background:var(--surface-1);color:var(--text-primary);box-shadow:0 1px 3px rgba(26,23,20,.05)}
.dr-index-filter-count{font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:800;color:var(--text-tertiary);background:var(--surface-3);padding:1px 6px;border-radius:999px}
.dr-index-filter.active .dr-index-filter-count{background:var(--accent-soft);color:var(--accent-text)}

.dr-index-tools{display:flex;gap:8px;align-items:center;margin-left:auto}
.dr-index-search{position:relative}
.dr-index-search input{height:34px;width:240px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);padding:0 12px 0 34px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;color:var(--text-primary);outline:none;font-weight:520}
.dr-index-search input:focus{border-color:var(--accent)}
.dr-index-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);pointer-events:none}
.dr-layout-toggle{display:flex;background:var(--surface-2);border-radius:10px;padding:3px;gap:2px}
.dr-layout-btn{width:30px;height:28px;border-radius:7px;border:none;background:none;color:var(--text-tertiary);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.dr-layout-btn.active{background:var(--surface-1);color:var(--text-primary);box-shadow:0 1px 3px rgba(26,23,20,.05)}

/* Thumbnails */
.dr-thumb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
.dr-thumb{position:relative;background:var(--surface-1);border:1px solid var(--surface-3);border-radius:12px;overflow:hidden;cursor:pointer;transition:all .2s}
.dr-thumb:hover{transform:translateY(-2px);border-color:var(--accent-muted);box-shadow:0 8px 24px rgba(91,79,199,.12)}
.dr-thumb.active{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.dr-thumb-preview{aspect-ratio:1.3/1;background:var(--sheet-bg);padding:8px;border-bottom:1px solid var(--surface-2)}
.dr-thumb-meta{padding:10px 12px}
.dr-thumb-num{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:var(--text-primary);letter-spacing:-.01em}
.dr-thumb-title{font-family:'Instrument Sans',system-ui,sans-serif;font-size:11.5px;color:var(--text-secondary);margin-top:2px;font-weight:520;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-thumb-changed{position:absolute;top:8px;left:8px;padding:2px 7px;border-radius:5px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;background:var(--warning-soft);color:var(--warning-text);border:1px solid var(--warning);letter-spacing:.02em}
.dr-thumb-badges{position:absolute;top:8px;right:8px;display:flex;gap:4px}
.dr-thumb-badge{min-width:20px;height:20px;padding:0 5px;border-radius:999px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;color:#fff;backdrop-filter:blur(4px)}
.dr-thumb-badge.mk{background:rgba(91,79,199,.9)}
.dr-thumb-badge.cm{background:rgba(193,122,26,.9)}

/* Thumbnail list layout */
.dr-thumb-list{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;overflow:hidden}
.dr-thumb-row{display:grid;grid-template-columns:60px 110px 1fr 100px 80px 80px;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--surface-2);cursor:pointer;transition:background .12s}
.dr-thumb-row:hover{background:var(--surface-hover)}
.dr-thumb-row.active{background:var(--accent-soft)}
.dr-thumb-row:last-child{border-bottom:none}
.dr-thumb-row .tr-num{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:var(--text-primary)}
.dr-thumb-row .tr-title{font-size:13px;font-weight:580;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* DETAIL VIEW (full-bleed viewer) */
.dr-detail{display:grid;grid-template-columns:240px 1fr 320px;height:100%;min-height:0;background:var(--canvas-bg)}
.dr-detail.no-comments{grid-template-columns:240px 1fr}
.dr-sheet-rail{background:var(--surface-1);border-right:1px solid var(--surface-3);display:flex;flex-direction:column;min-height:0}
.dr-sheet-rail-hdr{padding:12px 14px;border-bottom:1px solid var(--surface-2);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}
.dr-sheet-rail-hdr h4{font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary)}
.dr-sheet-rail-list{flex:1;overflow-y:auto;padding:6px 10px 20px}
.dr-sheet-rail-disc{padding:10px 6px 4px;font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;justify-content:space-between}
.dr-sheet-rail-item{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .12s;font-size:12px;font-weight:520}
.dr-sheet-rail-item:hover{background:var(--surface-hover)}
.dr-sheet-rail-item.active{background:var(--accent-soft);color:var(--accent-text)}
.dr-sheet-rail-item .sr-num{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;flex-shrink:0;min-width:44px}
.dr-sheet-rail-item .sr-title{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
.dr-sheet-rail-item .sr-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--accent-soft);color:var(--accent-text);font-family:'DM Sans',system-ui,sans-serif;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}

/* Viewer center */
.dr-viewer{display:flex;flex-direction:column;min-width:0;min-height:0}
.dr-viewer-topbar{height:48px;background:var(--surface-1);border-bottom:1px solid var(--surface-3);display:flex;align-items:center;padding:0 14px;gap:10px;flex-shrink:0}
.dr-viewer-title{display:flex;align-items:center;gap:10px;min-width:0}
.dr-viewer-title-num{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:var(--text-primary)}
.dr-viewer-title-name{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:680;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-viewer-controls{display:flex;align-items:center;gap:6px;margin-left:auto}

.dr-version-dd{position:relative}
.dr-version-dd-btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--surface-3);background:var(--surface-1);font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:680;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.dr-version-dd-btn:hover{background:var(--surface-hover);border-color:var(--surface-4)}
.dr-version-dd-menu{position:absolute;top:calc(100% + 4px);right:0;min-width:260px;background:var(--surface-1);border:1px solid var(--surface-3);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);z-index:40;overflow:hidden}
.dr-version-dd-item{padding:10px 14px;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--surface-2)}
.dr-version-dd-item:hover{background:var(--surface-hover)}
.dr-version-dd-item:last-child{border-bottom:none}
.dr-version-dd-item.current{background:var(--accent-soft)}
.dr-version-dd-item-top{display:flex;align-items:center;gap:8px}
.dr-version-dd-item-top h6{font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700}
.dr-version-dd-item-date{font-size:11px;color:var(--text-tertiary);font-weight:520;margin-top:2px}

/* Toolbar (floating left strip inside viewer) */
.dr-toolbar{position:absolute;left:16px;top:50%;transform:translateY(-50%);background:var(--surface-1);border:1px solid var(--surface-3);border-radius:14px;padding:6px;display:flex;flex-direction:column;gap:2px;box-shadow:0 4px 16px rgba(0,0,0,.08);z-index:20}
.dr-tool{width:36px;height:36px;border-radius:10px;border:none;background:none;color:var(--text-secondary);cursor:pointer;display:grid;place-items:center;transition:all .12s;position:relative}
.dr-tool:hover{background:var(--surface-hover);color:var(--text-primary)}
.dr-tool.active{background:var(--accent);color:#fff}
.dr-tool.disabled{opacity:.4;cursor:not-allowed}
.dr-tool.warn{color:#c4700b;background:rgba(219,133,31,.08)}
.dr-tool.warn:hover{background:rgba(219,133,31,.15)}
.dr-tool.warn.active{background:#c4700b;color:#fff}
.dr-tool-sep{height:1px;background:var(--surface-3);margin:3px 4px}
.dr-tool-label{position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);background:var(--text-primary);color:var(--text-inverse);padding:4px 8px;border-radius:6px;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:600;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s}
.dr-tool:hover .dr-tool-label{opacity:1}

/* Scale / calibration pill (viewer top bar) */
.dr-scale-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;background:var(--surface-2);border:1px solid var(--surface-3);font-family:'DM Sans',system-ui,sans-serif;font-size:11.5px;font-weight:620;color:var(--text-secondary);cursor:default}
.dr-scale-pill.warn{background:rgba(219,133,31,.1);border-color:rgba(219,133,31,.3);color:#c4700b;cursor:pointer}
.dr-scale-pill.warn:hover{background:rgba(219,133,31,.18)}
.dr-scale-pill-label{color:var(--text-tertiary);font-weight:560}
.dr-scale-pill.warn .dr-scale-pill-label{color:#c4700b;font-weight:650}
.dr-scale-pill-val{font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text-primary);letter-spacing:-.01em}

/* Canvas area */
.dr-canvas-wrap{flex:1;background:var(--canvas-bg);position:relative;overflow:hidden;min-height:0}
.dr-sheet-canvas{width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:24px}
.dr-zoom-indicator{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:var(--surface-1);border:1px solid var(--surface-3);border-radius:10px;padding:6px 12px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.06);z-index:10}
.dr-zoom-indicator button{background:none;border:none;color:var(--text-tertiary);cursor:pointer;padding:2px;display:grid;place-items:center}
.dr-zoom-indicator button:hover{color:var(--text-primary)}

.dr-compare-banner{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:var(--warning-soft);border:1px solid var(--warning);border-radius:10px;padding:6px 14px;font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:680;color:var(--warning-text);display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.06);z-index:10}

/* Comments panel */
.dr-comments-panel{background:var(--surface-1);border-left:1px solid var(--surface-3);display:flex;flex-direction:column;min-height:0}
.dr-comments-hdr{padding:14px 18px;border-bottom:1px solid var(--surface-2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.dr-comments-hdr h3{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
.dr-comments-list{flex:1;overflow-y:auto;padding:8px 12px}
.dr-comment{padding:12px 14px;border-radius:10px;margin-bottom:6px;cursor:pointer;transition:background .12s;border:1px solid transparent}
.dr-comment:hover{background:var(--surface-hover)}
.dr-comment.selected{background:var(--accent-soft);border-color:var(--accent-muted)}
.dr-comment.resolved{opacity:.68}
.dr-comment-top{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.dr-comment-pin{width:22px;height:22px;border-radius:50%;color:#fff;display:grid;place-items:center;font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;flex-shrink:0}
.dr-comment-user{font-family:'DM Sans',system-ui,sans-serif;font-size:12.5px;font-weight:680}
.dr-comment-time{font-size:11px;color:var(--text-tertiary);margin-left:auto;font-weight:520}
.dr-comment-body{font-size:12.5px;color:var(--text-secondary);line-height:1.5;font-weight:520}
.dr-comment-footer{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:11px;color:var(--text-tertiary);font-weight:520}
.dr-comment-reply-btn{border:none;background:none;color:var(--accent-text);font-size:11px;font-weight:650;cursor:pointer;padding:0;font-family:'Instrument Sans',system-ui,sans-serif}

.dr-comments-composer{border-top:1px solid var(--surface-2);padding:12px 14px;display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.dr-comments-composer textarea{width:100%;min-height:60px;border:1px solid var(--surface-3);border-radius:10px;padding:10px 12px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;color:var(--text-primary);background:var(--surface-2);outline:none;resize:vertical;font-weight:520}
.dr-comments-composer textarea:focus{border-color:var(--accent)}
.dr-comments-composer-foot{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-tertiary);font-weight:520}

/* Role toggle (top-right of topbar) */
.dr-role-toggle{display:flex;background:var(--surface-2);border-radius:9px;padding:3px;gap:2px}
.dr-role-btn{height:28px;padding:0 12px;border-radius:6px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:11.5px;font-weight:650;color:var(--text-secondary);cursor:pointer;border:none;background:none;transition:all .15s;display:inline-flex;align-items:center;gap:5px}
.dr-role-btn:hover{color:var(--text-primary)}
.dr-role-btn.active{background:var(--surface-1);color:var(--text-primary);box-shadow:0 1px 2px rgba(0,0,0,.04)}
.dr-role-btn.active.sub{color:var(--accent-sub-text)}

/* Sub scope banner */
.dr-sub-banner{padding:10px 16px;background:var(--accent-sub-soft);border:1px solid var(--accent-sub);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--accent-sub-text);font-weight:580}

/* UPLOAD MODAL */
.dr-modal-backdrop{position:fixed;inset:0;background:rgba(10,11,13,.52);backdrop-filter:blur(4px);z-index:200;display:grid;place-items:center;padding:20px;animation:dr-fadeIn .2s ease-out}
.dr-modal{background:var(--surface-1);border:1px solid var(--surface-3);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.28);width:100%;max-width:620px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;animation:dr-slideUp .25s cubic-bezier(.16,1,.3,1) both}
.dr-modal-hdr{padding:18px 22px;border-bottom:1px solid var(--surface-2);display:flex;justify-content:space-between;align-items:center}
.dr-modal-hdr h3{font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:750;letter-spacing:-.02em}
.dr-modal-body{padding:20px 22px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px}
.dr-modal-foot{padding:14px 22px;border-top:1px solid var(--surface-2);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0}

.dr-upload-drop{border:2px dashed var(--surface-4);border-radius:14px;padding:32px 20px;text-align:center;background:var(--surface-2);transition:all .2s;cursor:pointer}
.dr-upload-drop:hover{border-color:var(--accent);background:var(--accent-soft)}
.dr-upload-drop h4{font-family:'DM Sans',system-ui,sans-serif;font-size:15px;font-weight:700;margin-top:10px}
.dr-upload-drop p{font-size:12.5px;color:var(--text-secondary);margin-top:4px;font-weight:520}
.dr-upload-drop-icon{width:48px;height:48px;margin:0 auto;border-radius:12px;background:var(--accent-soft);color:var(--accent-text);display:grid;place-items:center}

.dr-upload-progress{background:var(--surface-2);border:1px solid var(--surface-3);border-radius:12px;padding:14px 16px}
.dr-upload-prog-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.dr-upload-prog-name{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:var(--text-primary);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-upload-prog-pct{font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700;color:var(--accent-text)}
.dr-upload-prog-bar{height:6px;border-radius:999px;background:var(--surface-3);overflow:hidden}
.dr-upload-prog-fill{height:100%;background:var(--accent);border-radius:999px;transition:width .35s}

.dr-upload-preview{background:var(--surface-2);border:1px solid var(--surface-3);border-radius:12px;padding:14px 16px}
.dr-upload-preview h5{font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary);margin-bottom:10px}
.dr-upload-preview-row{display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;font-weight:520}
.dr-upload-preview-row .k{color:var(--text-secondary)}
.dr-upload-preview-row .v{font-family:'DM Sans',system-ui,sans-serif;font-weight:680;color:var(--text-primary)}

/* Form inputs */
.dr-field{display:flex;flex-direction:column;gap:5px}
.dr-field label{font-size:12px;font-weight:650;color:var(--text-secondary)}
.dr-field input,.dr-field select,.dr-field textarea{height:38px;border-radius:10px;border:1px solid var(--surface-3);background:var(--surface-2);padding:0 12px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:13px;color:var(--text-primary);outline:none;font-weight:520}
.dr-field textarea{min-height:72px;padding:10px 12px;resize:vertical}
.dr-field input:focus,.dr-field select:focus,.dr-field textarea:focus{border-color:var(--accent)}
.dr-field-hint{font-size:11px;color:var(--text-tertiary);font-weight:520}

/* ANIMATIONS */
@keyframes dr-fadeIn{from{opacity:0}to{opacity:1}}
@keyframes dr-slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes dr-slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.dr-anim{animation:dr-slideIn .3s cubic-bezier(.16,1,.3,1) both}

/* RESPONSIVE */
@media(max-width:1400px){
  .dr-sets-grid{grid-template-columns:1fr}
  .dr-detail{grid-template-columns:220px 1fr}
  .dr-detail.no-comments{grid-template-columns:220px 1fr}
  .dr-comments-panel{display:none}
}
@media(max-width:1100px){
  .dr-summary{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:900px){
  .dr-app{grid-template-columns:1fr}
  .dr-sidebar{display:none}
  .dr-summary{grid-template-columns:repeat(2,1fr)}
  .dr-detail{grid-template-columns:1fr}
  .dr-sheet-rail{display:none}
  .dr-toolbar{left:8px;padding:4px}
  .dr-tool{width:32px;height:32px}
}
@media(max-width:640px){
  .dr-summary{grid-template-columns:1fr}
  .dr-content{padding:16px}
  .dr-viewer-title-name{display:none}
}
      `}</style>

      <div className="dr-app" data-theme={t}>
        {/* SIDEBAR */}
        <aside className="dr-sidebar">
          <div className="dr-brand">
            <LogoMark />
            <div>
              <div className="dr-brand-name">BuiltCRM</div>
              <div className="dr-brand-ctx">{isSub ? "Subcontractor Portal" : "Contractor Portal"}</div>
            </div>
          </div>
          <div className="dr-sb-search">
            <span className="dr-sb-search-icon">{I.search}</span>
            <input className="dr-sb-input" placeholder="Search projects…" />
          </div>
          <nav className="dr-sb-nav">
            <div className="dr-ns-label">Workspace</div>
            <div className="dr-ni">Dashboard</div>
            <div className="dr-ni">Project Directory <span className="dr-ni-badge">18</span></div>
            <div className="dr-ni">Inbox <span className="dr-ni-badge">4</span></div>
            <div className="dr-ns-label">Riverside Office Complex</div>
            <div className="dr-ni">Project Home</div>
            <div className="dr-ni">RFIs / Issues <span className="dr-ni-badge">6</span></div>
            <div className="dr-ni">Submittals <span className="dr-ni-badge">9</span></div>
            <div className="dr-ni">Change Orders <span className="dr-ni-badge">3</span></div>
            <div className="dr-ni">Approvals <span className="dr-ni-badge">2</span></div>
            <div className="dr-ni">Compliance <span className="dr-ni-badge warn">4</span></div>
            <div className="dr-ni">Daily Logs</div>
            <div className="dr-ni">Punch List <span className="dr-ni-badge">12</span></div>
            <div className="dr-ni active">Drawings <span className="dr-ni-badge">{currentSets} sets</span></div>
            <div className="dr-ni">Inspections</div>
            <div className="dr-ni">Billing / Draw</div>
            <div className="dr-ni">Schedule</div>
            <div className="dr-ni">Documents</div>
            <div className="dr-ni">Messages</div>
          </nav>
          <div className="dr-sb-foot">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}>
              <div className={`dr-u-av${isSub ? " sub" : ""}`}>{isSub ? "MC" : "DC"}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 580 }}>{isSub ? "Marcus Chen" : "Dan Carter"}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 520 }}>{isSub ? "Steel Frame Co." : "General Contractor"}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="dr-main">
          <header className="dr-topbar">
            <div className="dr-bc">
              <span className="dr-bc-lnk" onClick={() => setView("sets")}>Riverside Office Complex</span>
              <span className="dr-bc-sep">›</span>
              {view === "sets" ? (
                <span className="dr-bc-cur">Drawings</span>
              ) : view === "index" ? (
                <>
                  <span className="dr-bc-lnk" onClick={() => setView("sets")}>Drawings</span>
                  <span className="dr-bc-sep">›</span>
                  <span className="dr-bc-cur">{currentSet?.name} v{currentSet?.version}</span>
                </>
              ) : (
                <>
                  <span className="dr-bc-lnk" onClick={() => setView("sets")}>Drawings</span>
                  <span className="dr-bc-sep">›</span>
                  <span className="dr-bc-lnk" onClick={() => setView("index")}>v{currentSet?.version}</span>
                  <span className="dr-bc-sep">›</span>
                  <span className="dr-bc-cur">{currentSheet?.number}</span>
                </>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="dr-role-toggle" title="Preview how this looks for a subcontractor">
                <button className={`dr-role-btn${roleView === "contractor" ? " active" : ""}`} onClick={() => setRoleView("contractor")}>Contractor</button>
                <button className={`dr-role-btn${roleView === "subcontractor" ? " active sub" : ""}`} onClick={() => setRoleView("subcontractor")}>Sub</button>
              </div>
              {!isSub && (
                <button className="dr-btn sm primary" onClick={() => setShowUpload(true)}>
                  {I.upload} Upload Set
                </button>
              )}
              <button className="dr-btn sm icon" aria-label="Notifications">{I.bell}</button>
              <div className={`dr-u-av${isSub ? " sub" : ""}`}>{isSub ? "MC" : "DC"}</div>
            </div>
          </header>

          {/* ═════════════════════ SETS VIEW ═════════════════════ */}
          {view === "sets" && (
            <div className="dr-content dr-anim">
              <div className="dr-page-hdr">
                <div>
                  <h2 className="dr-page-title">Drawings</h2>
                  <p className="dr-page-desc">Sheet management, markup, and version control. Uploaded sheet sets are split into per-sheet pages with auto-extracted sheet numbers. New versions supersede old ones — older versions remain accessible.</p>
                </div>
                <div className="dr-page-actions">
                  {!isSub && <button className="dr-btn primary" onClick={() => setShowUpload(true)}>{I.upload} Upload Set</button>}
                </div>
              </div>

              {isSub && (
                <div className="dr-sub-banner">
                  {I.eye}
                  <span>You're viewing as <strong>Steel Frame Co.</strong> — scoped to structural sheets only. You can view all sets but markups and comments are limited to your trade scope.</span>
                </div>
              )}

              {/* Summary strip */}
              <div className="dr-summary">
                <div className="dr-sc strong">
                  <div className="dr-sc-label">Active Sets</div>
                  <div className="dr-sc-value">{currentSets}</div>
                  <div className="dr-sc-meta">{drawingSets.length - currentSets} superseded / historical</div>
                </div>
                <div className="dr-sc info">
                  <div className="dr-sc-label">Total Sheets</div>
                  <div className="dr-sc-value">{totalSheets}</div>
                  <div className="dr-sc-meta">Across active sets</div>
                </div>
                <div className="dr-sc alert">
                  <div className="dr-sc-label">Changed in v3</div>
                  <div className="dr-sc-value">{changedSheetsInCurrent}</div>
                  <div className="dr-sc-meta">vs. previous revision</div>
                </div>
                <div className="dr-sc teal">
                  <div className="dr-sc-label">Active Markups</div>
                  <div className="dr-sc-value">{totalMarkups}</div>
                  <div className="dr-sc-meta">Team annotations</div>
                </div>
                <div className="dr-sc success">
                  <div className="dr-sc-label">Open Comments</div>
                  <div className="dr-sc-value">{totalComments - 1}</div>
                  <div className="dr-sc-meta">1 resolved this week</div>
                </div>
              </div>

              <div className="dr-sets-grid">
                {/* Sets list */}
                <div className="dr-sets-list">
                  {drawingSets.map(set => {
                    const iconClass = set.family === "shell" ? "shell" : set.status === "current" ? "" : "old";
                    return (
                      <div
                        key={set.id}
                        className={`dr-set-card ${set.status === "current" ? "current" : "superseded"}`}
                        onClick={() => { setSelectedSetId(set.id); setView("index"); }}
                      >
                        <div className={`dr-set-icon ${iconClass}`}>{I.file}</div>
                        <div className="dr-set-body">
                          <div className="dr-set-title-row">
                            <span className="dr-set-title">{set.name}</span>
                            <span className="dr-set-ver">v{set.version}</span>
                            {set.status === "current" && <span className="dr-pill accent">CURRENT</span>}
                            {set.status === "superseded" && <span className="dr-pill gray">SUPERSEDED</span>}
                            {set.status === "historical" && <span className="dr-pill gray">HISTORICAL</span>}
                          </div>
                          <p className="dr-set-note">{set.note}</p>
                          <div className="dr-set-stats">
                            <div className="dr-set-stat"><span className="dr-set-stat-k">SHEETS</span><span className="dr-set-stat-v">{set.sheetCount}</span></div>
                            <div className="dr-set-stat"><span className="dr-set-stat-k">UPLOADED</span><span className="dr-set-stat-v">{set.uploadedAt}</span></div>
                            <div className="dr-set-stat"><span className="dr-set-stat-k">BY</span><span className="dr-set-stat-v">{set.uploadedBy}</span></div>
                            <div className="dr-set-stat"><span className="dr-set-stat-k">SIZE</span><span className="dr-set-stat-v">{set.fileSize}</span></div>
                          </div>
                          <div className="dr-set-disciplines">
                            {Object.entries(set.disciplines).map(([disc, count]) => {
                              const dc = disciplineColors[disc];
                              return (
                                <span key={disc} className="dr-set-disc-tag" style={{ background: dc.bg, color: dc.text, border: `1px solid ${dc.border}` }}>
                                  {disc} · {count}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>{I.chevRight}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Rail */}
                <div className="dr-rail">
                  <div className="dr-card">
                    <div className="dr-card-hdr">
                      <h3>Version Chain</h3>
                      <span className="dr-pill gray">CD</span>
                    </div>
                    <div className="dr-chain">
                      {versionChain.filter(v => v.family === "cd").map((v, i, arr) => (
                        <div key={v.id} className={`dr-chain-step${i === 0 ? " current" : ""}`}>
                          <div className="dr-chain-dot">v{v.version}</div>
                          <div className="dr-chain-info">
                            <h5>{v.name} v{v.version} {i === 0 && "— current"}</h5>
                            <p>{v.uploadedAt} · {v.uploadedBy} · {v.fileSize}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="dr-card">
                    <div className="dr-card-hdr">
                      <h3>Recent Activity</h3>
                    </div>
                    <div className="dr-activity">
                      {activityFeed.map((a, i) => (
                        <div key={i} className="dr-a-item">
                          <div className={`dr-a-dot ${a.color}`} />
                          <div className="dr-a-text">{a.text}</div>
                          <div className="dr-a-time">{a.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════ INDEX VIEW ═════════════════════ */}
          {view === "index" && (
            <div className="dr-content dr-anim">
              <div className="dr-index-hdr">
                <div className="dr-index-ctx">
                  <button className="dr-btn sm ghost" onClick={() => setView("sets")}>{I.back} Sets</button>
                  <h2>{currentSet?.name} v{currentSet?.version}</h2>
                  {currentSet?.status === "current" && <span className="dr-pill accent">CURRENT</span>}
                </div>
                <div className="dr-index-tools">
                  <div className="dr-index-search">
                    <span className="dr-index-search-icon">{I.search}</span>
                    <input placeholder="Search sheets…" value={sheetSearch} onChange={e => setSheetSearch(e.target.value)} />
                  </div>
                  <div className="dr-layout-toggle">
                    <button className={`dr-layout-btn${indexLayout === "grid" ? " active" : ""}`} onClick={() => setIndexLayout("grid")} aria-label="Grid view">{I.grid}</button>
                    <button className={`dr-layout-btn${indexLayout === "list" ? " active" : ""}`} onClick={() => setIndexLayout("list")} aria-label="List view">{I.list}</button>
                  </div>
                  <button className="dr-btn sm">{I.download} Export Set</button>
                </div>
              </div>

              {/* Discipline filter tabs */}
              <div className="dr-index-filters" style={{ marginBottom: 18 }}>
                {[
                  { key: "all", label: "All", count: sheets.length },
                  { key: "A", label: "Architectural", count: sheets.filter(s => s.discipline === "A").length },
                  { key: "S", label: "Structural", count: sheets.filter(s => s.discipline === "S").length },
                  { key: "E", label: "Electrical", count: sheets.filter(s => s.discipline === "E").length },
                  { key: "M", label: "Mechanical", count: sheets.filter(s => s.discipline === "M").length },
                  { key: "P", label: "Plumbing", count: sheets.filter(s => s.discipline === "P").length },
                ].map(f => (
                  <button
                    key={f.key}
                    className={`dr-index-filter${sheetFilter === f.key ? " active" : ""}`}
                    onClick={() => setSheetFilter(f.key)}
                  >
                    {f.label} <span className="dr-index-filter-count">{f.count}</span>
                  </button>
                ))}
              </div>

              {isSub && (
                <div className="dr-sub-banner" style={{ marginTop: -4 }}>
                  {I.eye}
                  <span>Scope filter: <strong>Structural only</strong>. You have read access to all sheets but can only markup your scope.</span>
                </div>
              )}

              {/* Grid or list */}
              {indexLayout === "grid" ? (
                <div className="dr-thumb-grid">
                  {subScopedSheets.map(sheet => (
                    <SheetThumbnail
                      key={sheet.id}
                      sheet={sheet}
                      active={false}
                      changed={sheet.changed}
                      onClick={() => handleSheetOpen(sheet.id)}
                    />
                  ))}
                  {subScopedSheets.length === 0 && (
                    <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, fontWeight: 520 }}>
                      No sheets match your search.
                    </div>
                  )}
                </div>
              ) : (
                <div className="dr-thumb-list">
                  <div className="dr-thumb-row" style={{ background: "var(--surface-2)", fontFamily: "DM Sans", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-tertiary)", cursor: "default" }}>
                    <div>#</div><div>Number</div><div>Title</div><div>Discipline</div><div>Markups</div><div>Comments</div>
                  </div>
                  {subScopedSheets.map((sheet, i) => {
                    const dc = disciplineColors[sheet.discipline];
                    return (
                      <div key={sheet.id} className="dr-thumb-row" onClick={() => handleSheetOpen(sheet.id)}>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{String(i + 1).padStart(2, "0")}</div>
                        <div className="tr-num">{sheet.number}</div>
                        <div className="tr-title">{sheet.title} {sheet.changed && <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 5, background: "var(--warning-soft)", color: "var(--warning-text)", border: "1px solid var(--warning)", fontFamily: "DM Sans", fontSize: 10, fontWeight: 700 }}>Changed</span>}</div>
                        <div><span className="dr-set-disc-tag" style={{ background: dc.bg, color: dc.text, border: `1px solid ${dc.border}` }}>{sheet.discipline}</span></div>
                        <div style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 680, color: sheet.markupCount ? "var(--accent-text)" : "var(--text-tertiary)" }}>{sheet.markupCount || "—"}</div>
                        <div style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 680, color: sheet.commentCount ? "var(--warning-text)" : "var(--text-tertiary)" }}>{sheet.commentCount || "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════ DETAIL VIEW ═════════════════════ */}
          {view === "detail" && (
            <div className={`dr-content detail dr-anim${!showComments ? " no-comments" : ""}`}>
              <div className={`dr-detail${!showComments ? " no-comments" : ""}`}>
                {/* Sheet rail (left) */}
                <aside className="dr-sheet-rail">
                  <div className="dr-sheet-rail-hdr">
                    <h4>Sheets · v{currentSet?.version}</h4>
                    <button className="dr-btn xs ghost" onClick={() => setView("index")}>{I.grid}</button>
                  </div>
                  <div className="dr-sheet-rail-list">
                    {["A", "S", "E", "M", "P"].map(disc => {
                      const discSheets = sheets.filter(s => s.discipline === disc);
                      if (discSheets.length === 0) return null;
                      const dc = disciplineColors[disc];
                      return (
                        <div key={disc}>
                          <div className="dr-sheet-rail-disc">
                            <span>{dc.label}</span>
                            <span style={{ color: "var(--text-tertiary)" }}>{discSheets.length}</span>
                          </div>
                          {discSheets.map(s => (
                            <div
                              key={s.id}
                              className={`dr-sheet-rail-item${selectedSheetId === s.id ? " active" : ""}`}
                              onClick={() => { setSelectedSheetId(s.id); setSelectedCommentId(null); setCompareMode(false); }}
                            >
                              <span className="sr-num">{s.number}</span>
                              <span className="sr-title">{s.title}</span>
                              {(s.markupCount > 0 || s.commentCount > 0) && (
                                <span className="sr-badge">{s.markupCount + s.commentCount}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                {/* Viewer center */}
                <div className="dr-viewer">
                  <div className="dr-viewer-topbar">
                    <div className="dr-viewer-title">
                      <span className="dr-viewer-title-num">{currentSheet?.number}</span>
                      <span className="dr-viewer-title-name">{currentSheet?.title}</span>
                      {currentSheet?.changed && <span className="dr-pill orange">CHANGED IN v3</span>}
                    </div>
                    <div className="dr-viewer-controls">
                      {calibration ? (
                        <div className="dr-scale-pill" title={`Calibrated ${calibration.calibratedAt} by ${calibration.calibratedBy} · ${calibration.source}`}>
                          {I.calibrate}
                          <span className="dr-scale-pill-label">Scale</span>
                          <span className="dr-scale-pill-val">{calibration.scale}</span>
                        </div>
                      ) : (
                        <button className="dr-scale-pill warn" onClick={() => setTool("measure")} title="Click two known points on the sheet to set scale">
                          {I.calibrate}
                          <span className="dr-scale-pill-label">Calibrate scale</span>
                        </button>
                      )}
                      <button
                        className={`dr-btn sm${compareMode ? " primary" : ""}`}
                        onClick={() => setCompareMode(!compareMode)}
                      >
                        {I.compare} Compare {compareMode && "· v2"}
                      </button>
                      <div className="dr-version-dd">
                        <button className="dr-version-dd-btn" onClick={() => setShowVersionMenu(!showVersionMenu)}>
                          v{currentSet?.version} {I.chevDown}
                        </button>
                        {showVersionMenu && (
                          <div className="dr-version-dd-menu">
                            {versionChain.filter(v => v.family === "cd").map(v => (
                              <div
                                key={v.id}
                                className={`dr-version-dd-item${v.id === selectedSetId ? " current" : ""}`}
                                onClick={() => { setSelectedSetId(v.id); setShowVersionMenu(false); }}
                              >
                                <div className="dr-version-dd-item-top">
                                  <h6>{v.name} v{v.version}</h6>
                                  {v.id === selectedSetId && <span className="dr-pill accent">CURRENT</span>}
                                  {v.status === "superseded" && <span className="dr-pill gray">SUPERSEDED</span>}
                                </div>
                                <div className="dr-version-dd-item-date">{v.uploadedAt} · {v.uploadedBy} · {v.sheetCount} sheets</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="dr-btn sm icon" aria-label="Layers" title="Layer visibility">{I.layers}</button>
                      <button
                        className="dr-btn sm icon"
                        onClick={() => setShowComments(!showComments)}
                        aria-label="Toggle comments"
                        title={showComments ? "Hide comments" : "Show comments"}
                      >
                        {showComments ? I.eye : I.eyeOff}
                      </button>
                      <button className="dr-btn sm icon" aria-label="Download">{I.download}</button>
                      <button className="dr-btn sm icon" aria-label="More">{I.more}</button>
                    </div>
                  </div>

                  {/* Canvas area with floating toolbar */}
                  <div className="dr-canvas-wrap">
                    {/* Floating toolbar */}
                    <div className="dr-toolbar">
                      <button className={`dr-tool${tool === "pan" ? " active" : ""}`} onClick={() => setTool("pan")}>
                        {I.pan}<span className="dr-tool-label">Pan / Hand (H)</span>
                      </button>
                      <div className="dr-tool-sep" />
                      <button
                        className={`dr-tool${tool === "pen" ? " active" : ""}${isSub && currentSheet?.discipline !== "S" ? " disabled" : ""}`}
                        onClick={() => !(isSub && currentSheet?.discipline !== "S") && setTool("pen")}
                      >
                        {I.pen}<span className="dr-tool-label">Pen (P)</span>
                      </button>
                      <button
                        className={`dr-tool${tool === "text" ? " active" : ""}${isSub && currentSheet?.discipline !== "S" ? " disabled" : ""}`}
                        onClick={() => !(isSub && currentSheet?.discipline !== "S") && setTool("text")}
                      >
                        {I.text}<span className="dr-tool-label">Text (T)</span>
                      </button>
                      <button
                        className={`dr-tool${tool === "rect" ? " active" : ""}${isSub && currentSheet?.discipline !== "S" ? " disabled" : ""}`}
                        onClick={() => !(isSub && currentSheet?.discipline !== "S") && setTool("rect")}
                      >
                        {I.rect}<span className="dr-tool-label">Rectangle (R)</span>
                      </button>
                      <button
                        className={`dr-tool${tool === "circle" ? " active" : ""}${isSub && currentSheet?.discipline !== "S" ? " disabled" : ""}`}
                        onClick={() => !(isSub && currentSheet?.discipline !== "S") && setTool("circle")}
                      >
                        {I.circle}<span className="dr-tool-label">Circle (C)</span>
                      </button>
                      <div className="dr-tool-sep" />
                      <button
                        className={`dr-tool${tool === "measure" ? " active" : ""}${!calibration ? " warn" : ""}`}
                        onClick={() => setTool("measure")}
                        title={calibration ? `Scale: ${calibration.scale}` : "Sheet not calibrated — click two known points to set scale"}
                      >
                        {I.measure}<span className="dr-tool-label">Measure (L){!calibration && " · calibrate"}</span>
                      </button>
                      <div className="dr-tool-sep" />
                      <button className={`dr-tool${tool === "comment" ? " active" : ""}`} onClick={() => setTool("comment")}>
                        {I.comment}<span className="dr-tool-label">Comment (M)</span>
                      </button>
                      <div className="dr-tool-sep" />
                      <button className="dr-tool">{I.revert}<span className="dr-tool-label">Undo</span></button>
                    </div>

                    {compareMode && (
                      <div className="dr-compare-banner">
                        {I.compare} Comparing <strong>v3</strong> (current) vs <strong>v2</strong> · Red highlight shows changes
                      </div>
                    )}

                    <SheetCanvas
                      sheet={currentSheet}
                      markups={markups}
                      measurements={measurements}
                      calibration={calibration}
                      comments={comments}
                      tool={tool}
                      showComments={showComments}
                      compareMode={compareMode}
                      selectedCommentId={selectedCommentId}
                      onPinClick={handlePinClick}
                      onMarkupClick={() => {}}
                    />

                    <div className="dr-zoom-indicator">
                      <button>{I.zoomOut}</button>
                      <span>100%</span>
                      <button>{I.zoomIn}</button>
                    </div>
                  </div>
                </div>

                {/* Comments panel (right) */}
                {showComments && (
                  <aside className="dr-comments-panel">
                    <div className="dr-comments-hdr">
                      <h3>
                        {I.comment} Comments
                        {comments.length > 0 && <span className="dr-pill gray">{comments.length}</span>}
                      </h3>
                      <button className="dr-btn xs ghost" onClick={() => setShowComments(false)}>{I.x}</button>
                    </div>
                    <div className="dr-comments-list">
                      {comments.length === 0 && (
                        <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5, fontWeight: 520 }}>
                          No comments on this sheet. Click the Comment tool then click anywhere on the sheet to pin one.
                        </div>
                      )}
                      {comments.map(c => (
                        <div
                          key={c.id}
                          className={`dr-comment${selectedCommentId === c.id ? " selected" : ""}${c.resolved ? " resolved" : ""}`}
                          onClick={() => handlePinClick(c)}
                        >
                          <div className="dr-comment-top">
                            <div className="dr-comment-pin" style={{ background: c.resolved ? "#2d8a5e" : c.userColor }}>{c.num}</div>
                            <div className="dr-comment-user">{c.userName}</div>
                            <div className="dr-comment-time">{c.createdAt}</div>
                          </div>
                          <div className="dr-comment-body">{c.text}</div>
                          <div className="dr-comment-footer">
                            {c.resolved ? (
                              <span style={{ color: "var(--success-text)", fontWeight: 650 }}>{I.check} Resolved</span>
                            ) : (
                              <>
                                <button className="dr-comment-reply-btn">Reply{c.replies > 0 && ` (${c.replies})`}</button>
                                <span>·</span>
                                <button className="dr-comment-reply-btn">Resolve</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="dr-comments-composer">
                      <textarea
                        placeholder={tool === "comment" ? "Click on the sheet to pin a comment…" : "Switch to Comment tool to pin, or type a general note…"}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                      />
                      <div className="dr-comments-composer-foot">
                        <span>{newComment.length} chars</span>
                        <button className="dr-btn sm primary" disabled={!newComment.trim()}>
                          {I.send} Post
                        </button>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            </div>
          )}
        </main>

        {/* UPLOAD MODAL */}
        {showUpload && (
          <div className="dr-modal-backdrop" onClick={() => setShowUpload(false)}>
            <div className="dr-modal" onClick={e => e.stopPropagation()}>
              <div className="dr-modal-hdr">
                <h3>Upload Drawing Set</h3>
                <button className="dr-btn sm ghost icon" onClick={() => setShowUpload(false)}>{I.x}</button>
              </div>
              <div className="dr-modal-body">
                <div className="dr-upload-drop">
                  <div className="dr-upload-drop-icon">{I.upload}</div>
                  <h4>Drop a PDF sheet set here</h4>
                  <p>Multi-page PDF. We'll split into sheets and auto-detect sheet numbers from the title block. Max 500 MB.</p>
                </div>

                {/* Simulated "uploaded" state preview */}
                <div className="dr-upload-progress">
                  <div className="dr-upload-prog-top">
                    {I.file}
                    <span className="dr-upload-prog-name">CD_Set_100pct_v3_2026-03-15.pdf</span>
                    <span className="dr-upload-prog-pct">100%</span>
                  </div>
                  <div className="dr-upload-prog-bar">
                    <div className="dr-upload-prog-fill" style={{ width: "100%" }} />
                  </div>
                </div>

                <div className="dr-upload-preview">
                  <h5>Detected Preview</h5>
                  <div className="dr-upload-preview-row"><span className="k">Pages detected</span><span className="v">42</span></div>
                  <div className="dr-upload-preview-row"><span className="k">Sheet numbers auto-extracted</span><span className="v">40 of 42 <span style={{ color: "var(--warning-text)", fontSize: 11, fontWeight: 580, marginLeft: 6 }}>· 2 need manual entry</span></span></div>
                  <div className="dr-upload-preview-row"><span className="k">File size</span><span className="v">48.2 MB</span></div>
                  <div className="dr-upload-preview-row"><span className="k">Detected disciplines</span><span className="v">A, S, E, M, P</span></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="dr-field">
                    <label>Set Name</label>
                    <input defaultValue="100% CD Set" />
                  </div>
                  <div className="dr-field">
                    <label>Version</label>
                    <input defaultValue="3" type="number" />
                    <span className="dr-field-hint">Will supersede 100% CD Set v2</span>
                  </div>
                </div>
                <div className="dr-field">
                  <label>Notes (optional)</label>
                  <textarea defaultValue="Issued for construction — revision supersedes v2. 3 sheets changed." />
                </div>
              </div>
              <div className="dr-modal-foot">
                <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 520 }}>
                  Processing typically takes ~30 seconds for a 40-page set
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="dr-btn sm ghost" onClick={() => setShowUpload(false)}>Cancel</button>
                  <button className="dr-btn sm primary" onClick={() => setShowUpload(false)}>
                    {I.check} Confirm & Publish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button className="dr-dark-toggle" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">
          {dark ? "☀" : "☾"}
        </button>
      </div>
    </>
  );
}
