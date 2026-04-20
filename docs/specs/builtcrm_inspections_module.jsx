import { useState } from "react";

// BuiltCRM — Inspections Module (Contractor + Subcontractor / Phase 5 Commercial GC Parity)
// Step 45 (5.1 #45). QA/QC checklists distinct from milestones.
// Template library → assign to sub → sub completes on mobile → pass/fail/
// conditional/NA outcomes per line item → fail/conditional → auto punch items
// → pass rate KPI rolls up. Priority P0.

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Trade category accent colors ───────────────────────────────────────
const tradeColors = {
  framing:    { solid: "#9c6240", soft: "rgba(156,98,64,.12)",  label: "Framing"  },
  electrical: { solid: "#c48a1a", soft: "rgba(196,138,26,.12)", label: "Electric" },
  plumbing:   { solid: "#3878a8", soft: "rgba(56,120,168,.12)", label: "Plumbing" },
  hvac:       { solid: "#2e8a82", soft: "rgba(46,138,130,.12)", label: "HVAC"     },
  insulation: { solid: "#6b6b6b", soft: "rgba(107,107,107,.12)",label: "Insul."   },
  drywall:    { solid: "#6b5d8c", soft: "rgba(107,93,140,.12)", label: "Drywall"  },
  general:    { solid: "#5b7a6a", soft: "rgba(91,122,106,.12)", label: "General"  },
};

// ─── Template library (10 seeded per spec) ──────────────────────────────
const templates = [
  { id: "tpl-frm-rgh",  name: "Framing — Rough",          trade: "framing",    phase: "rough", itemCount: 10, timesUsed: 24, updated: "Feb 12", owner: "org" },
  { id: "tpl-elec-rgh", name: "Electrical — Rough",       trade: "electrical", phase: "rough", itemCount: 12, timesUsed: 31, updated: "Jan 28", owner: "org" },
  { id: "tpl-plb-rgh",  name: "Plumbing — Rough",         trade: "plumbing",   phase: "rough", itemCount: 11, timesUsed: 22, updated: "Feb 03", owner: "org" },
  { id: "tpl-hvac-rgh", name: "HVAC — Rough",             trade: "hvac",       phase: "rough", itemCount: 9,  timesUsed: 15, updated: "Feb 09", owner: "org" },
  { id: "tpl-insul",    name: "Insulation",               trade: "insulation", phase: "rough", itemCount: 8,  timesUsed: 18, updated: "Jan 22", owner: "org" },
  { id: "tpl-dw",       name: "Drywall",                  trade: "drywall",    phase: "rough", itemCount: 12, timesUsed: 26, updated: "Feb 18", owner: "org" },
  { id: "tpl-elec-fin", name: "Electrical — Final",       trade: "electrical", phase: "final", itemCount: 10, timesUsed: 19, updated: "Feb 01", owner: "org" },
  { id: "tpl-plb-fin",  name: "Plumbing — Final",         trade: "plumbing",   phase: "final", itemCount: 9,  timesUsed: 17, updated: "Jan 30", owner: "org" },
  { id: "tpl-mech-fin", name: "Mechanical — Final",       trade: "hvac",       phase: "final", itemCount: 8,  timesUsed: 12, updated: "Feb 07", owner: "org" },
  { id: "tpl-clean",    name: "Final Cleaning",           trade: "general",    phase: "final", itemCount: 7,  timesUsed: 9,  updated: "Feb 14", owner: "org" },
  { id: "tpl-custom-1", name: "Riverside — Shell Envelope", trade: "general",  phase: "rough", itemCount: 6,  timesUsed: 2,  updated: "Apr 04", owner: "custom" },
];

// ─── Inspections (13 mixed-status, on Riverside Office Complex) ─────────
const inspections = [
  { id: "ins-1",  num: "INS-0018", templateId: "tpl-frm-rgh",  templateName: "Framing — Rough",        trade: "framing",    zone: "Floor 2 East",   status: "scheduled",   assignedOrg: "Steel Frame Co.",    assignedUser: "Marcus Chen",    scheduled: "Apr 22", completed: null,     passRate: null, itemCount: 10, failedCount: 0, punchGenerated: 0 },
  { id: "ins-2",  num: "INS-0019", templateId: "tpl-frm-rgh",  templateName: "Framing — Rough",        trade: "framing",    zone: "Floor 2 West",   status: "scheduled",   assignedOrg: "Steel Frame Co.",    assignedUser: "Marcus Chen",    scheduled: "Apr 24", completed: null,     passRate: null, itemCount: 10, failedCount: 0, punchGenerated: 0 },
  { id: "ins-3",  num: "INS-0017", templateId: "tpl-elec-rgh", templateName: "Electrical — Rough",     trade: "electrical", zone: "Floor 1",        status: "in_progress", assignedOrg: "Coastal Electric",   assignedUser: "Ben Rodriguez",  scheduled: "Apr 20", completed: null,     passRate: null, itemCount: 12, failedCount: 0, punchGenerated: 0, progress: 6 },
  { id: "ins-4",  num: "INS-0016", templateId: "tpl-plb-rgh",  templateName: "Plumbing — Rough",       trade: "plumbing",   zone: "Floor 1",        status: "completed",   assignedOrg: "Sullivan Plumbing",  assignedUser: "Mike Sullivan",  scheduled: "Apr 18", completed: "Apr 18", passRate: 87,   itemCount: 11, failedCount: 1, punchGenerated: 1 },
  { id: "ins-5",  num: "INS-0015", templateId: "tpl-hvac-rgh", templateName: "HVAC — Rough",           trade: "hvac",       zone: "Mechanical Room",status: "completed",   assignedOrg: "Northwest HVAC",     assignedUser: "Priya Shah",     scheduled: "Apr 17", completed: "Apr 17", passRate: 100,  itemCount: 9,  failedCount: 0, punchGenerated: 0 },
  { id: "ins-6",  num: "INS-0014", templateId: "tpl-insul",    templateName: "Insulation",             trade: "insulation", zone: "Floor 1",        status: "completed",   assignedOrg: "Thermal Pro",        assignedUser: "Alex Kim",       scheduled: "Apr 15", completed: "Apr 15", passRate: 92,   itemCount: 8,  failedCount: 0, punchGenerated: 1 },
  { id: "ins-7",  num: "INS-0013", templateId: "tpl-dw",       templateName: "Drywall",                trade: "drywall",    zone: "Floor 1",        status: "completed",   assignedOrg: "Summit Drywall",     assignedUser: "Jose Ramirez",   scheduled: "Apr 14", completed: "Apr 14", passRate: 75,   itemCount: 12, failedCount: 2, punchGenerated: 3 },
  { id: "ins-8",  num: "INS-0020", templateId: "tpl-elec-rgh", templateName: "Electrical — Rough",     trade: "electrical", zone: "Floor 2",        status: "scheduled",   assignedOrg: "Coastal Electric",   assignedUser: "Ben Rodriguez",  scheduled: "Apr 25", completed: null,     passRate: null, itemCount: 12, failedCount: 0, punchGenerated: 0 },
  { id: "ins-9",  num: "INS-0021", templateId: "tpl-plb-rgh",  templateName: "Plumbing — Rough",       trade: "plumbing",   zone: "Floor 2",        status: "scheduled",   assignedOrg: "Sullivan Plumbing",  assignedUser: "Mike Sullivan",  scheduled: "Apr 28", completed: null,     passRate: null, itemCount: 11, failedCount: 0, punchGenerated: 0 },
  { id: "ins-10", num: "INS-0012", templateId: "tpl-elec-fin", templateName: "Electrical — Final",     trade: "electrical", zone: "Floor 1",        status: "completed",   assignedOrg: "Coastal Electric",   assignedUser: "Ben Rodriguez",  scheduled: "Apr 19", completed: "Apr 19", passRate: 95,   itemCount: 10, failedCount: 0, punchGenerated: 1 },
  { id: "ins-11", num: "INS-0009", templateId: "tpl-frm-rgh",  templateName: "Framing — Rough",        trade: "framing",    zone: "Floor 1",        status: "completed",   assignedOrg: "Steel Frame Co.",    assignedUser: "Marcus Chen",    scheduled: "Apr 10", completed: "Apr 10", passRate: 100,  itemCount: 10, failedCount: 0, punchGenerated: 0 },
  { id: "ins-12", num: "INS-0022", templateId: "tpl-dw",       templateName: "Drywall",                trade: "drywall",    zone: "Floor 2",        status: "in_progress", assignedOrg: "Summit Drywall",     assignedUser: "Jose Ramirez",   scheduled: "Apr 20", completed: null,     passRate: null, itemCount: 12, failedCount: 0, punchGenerated: 0, progress: 3 },
  { id: "ins-13", num: "INS-0011", templateId: "tpl-plb-fin",  templateName: "Plumbing — Final",       trade: "plumbing",   zone: "Floor 1",        status: "completed",   assignedOrg: "Sullivan Plumbing",  assignedUser: "Mike Sullivan",  scheduled: "Apr 16", completed: "Apr 16", passRate: 100,  itemCount: 9,  failedCount: 0, punchGenerated: 0 },
];

// ─── Line items for the demo-hero inspection (INS-0013 Drywall Floor 1) ─
// Shows the pass/fail/conditional/na outcome spread + auto-punch linkage.
const heroInspectionId = "ins-7";
const heroLineItems = [
  { key: "dw-01", label: "All fasteners recessed per spec",                  ref: "Spec 09 29 00 §3.4",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-02", label: "Butt joints staggered per pattern",                ref: "Spec 09 29 00 §3.3",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-03", label: "No gaps >1/8\" at panel joints",                   ref: "ASTM C840 §7.2",      outcome: "fail",        note: "South wall Rm 102, three joints measured 1/4\"–3/8\" gap. Refer patch + reset.", photos: 2, punchId: "PI-0234" },
  { key: "dw-04", label: "Inside corners taped and mudded first coat",       ref: "Spec 09 29 00 §3.5",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-05", label: "Outside corners have corner bead installed",       ref: "Spec 09 29 00 §3.5",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-06", label: "Screw pattern per spec (12\" field / 8\" edges)",  ref: "ASTM C840 §6.5",      outcome: "conditional", note: "Spacing OK in field. Tub enclosure wall short by ~4 screws per sheet — sub to add before finish.", photos: 1, punchId: "PI-0235" },
  { key: "dw-07", label: "Joints taped with proper tape width (≥2\")",       ref: "Spec 09 29 00 §3.5",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-08", label: "First coat of mud applied to all joints",          ref: "Spec 09 29 00 §3.5",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-09", label: "No visible damage, cracks, or protrusions",        ref: "Visual",              outcome: "fail",        note: "Cracks propagating from window return, east wall Rm 103. Likely framing movement — verify before retouch.", photos: 3, punchId: "PI-0236" },
  { key: "dw-10", label: "Ceiling sheets supported per T-bar / strapping",   ref: "Spec 09 29 00 §3.2",  outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-11", label: "Cutouts for boxes match finish plan",              ref: "Finish plan A-101",   outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
  { key: "dw-12", label: "All wall-ceiling transitions clean",               ref: "Visual",              outcome: "pass",        note: "",                                                                   photos: 0, punchId: null },
];

// ─── Linked punch items (auto-generated from hero inspection) ───────────
const heroPunchItems = [
  { num: "PI-0234", title: "Drywall gap repair — Rm 102 S wall",    priority: "high",   status: "open",        assignee: "Summit Drywall", due: "Apr 24", origin: "dw-03" },
  { num: "PI-0235", title: "Drywall screw pattern — tub enclosure", priority: "normal", status: "in_progress", assignee: "Summit Drywall", due: "Apr 22", origin: "dw-06" },
  { num: "PI-0236", title: "Drywall crack repair — Rm 103 E wall",  priority: "high",   status: "open",        assignee: "Summit Drywall", due: "Apr 25", origin: "dw-09" },
];

// ─── Activity feed ──────────────────────────────────────────────────────
const activity = [
  { who: "Jose Ramirez",   org: "Summit Drywall",    action: "completed Drywall inspection",      target: "INS-0013 · Floor 1",       when: "Apr 14 · 3:42 PM", kind: "complete" },
  { who: "System",         org: "",                  action: "auto-created 3 punch items",        target: "PI-0234, PI-0235, PI-0236", when: "Apr 14 · 3:42 PM", kind: "punch" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "verified punch item",               target: "PI-0229",                   when: "Apr 14 · 1:18 PM", kind: "verify" },
  { who: "Ben Rodriguez",  org: "Coastal Electric",  action: "started Electrical Rough inspection", target: "INS-0017 · Floor 1",      when: "Apr 20 · 8:05 AM", kind: "start" },
  { who: "Priya Shah",     org: "Northwest HVAC",    action: "completed HVAC Rough inspection",   target: "INS-0015 · Mech Room",      when: "Apr 17 · 11:20 AM", kind: "complete" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "assigned inspection to Marcus Chen", target: "INS-0018 · Floor 2 East",  when: "Apr 13 · 4:30 PM", kind: "assign" },
];

// ─── Trade category summary (for workspace KPI strip) ───────────────────
const tradeSummary = [
  { trade: "framing",    scheduled: 2, inProgress: 0, completed: 1, passRate: 100 },
  { trade: "electrical", scheduled: 1, inProgress: 1, completed: 1, passRate: 95  },
  { trade: "plumbing",   scheduled: 1, inProgress: 0, completed: 2, passRate: 93  },
  { trade: "hvac",       scheduled: 0, inProgress: 0, completed: 1, passRate: 100 },
  { trade: "insulation", scheduled: 0, inProgress: 0, completed: 1, passRate: 92  },
  { trade: "drywall",    scheduled: 0, inProgress: 1, completed: 1, passRate: 75  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS (inline SVG — no emoji per design system)
// ═══════════════════════════════════════════════════════════════════════════
const I = {
  plus:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  warn:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  dash:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>,
  clipboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/></svg>,
  calendar:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  user:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  camera:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  filter:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  search:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  chevR:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevL:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevD:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/></svg>,
  more:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  grip:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>,
  link:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.75 5.17"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  edit:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  settings:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  send:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>,
  phone:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  tag:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  clock:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 15 14"/></svg>,
  archive:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  copy:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════════════
//  SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="7" y="7" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity=".12"/>
    <rect x="11.5" y="11.5" width="9.5" height="9.5" rx="1.5" fill="currentColor"/>
  </svg>
);

function PassRatePill({ rate, size = "md" }) {
  if (rate == null) return <span className={`in-rate-pill in-rate-pill-${size} none`}>—</span>;
  const color = rate >= 95 ? "ok" : rate >= 85 ? "warn" : "fail";
  return (
    <span className={`in-rate-pill in-rate-pill-${size} ${color}`}>
      <span className="in-rate-val">{rate}%</span>
      {size !== "sm" && <span className="in-rate-lbl">pass</span>}
    </span>
  );
}

function OutcomeIcon({ outcome }) {
  if (outcome === "pass")        return <span className="in-oc in-oc-pass">{I.check}</span>;
  if (outcome === "fail")        return <span className="in-oc in-oc-fail">{I.x}</span>;
  if (outcome === "conditional") return <span className="in-oc in-oc-cond">{I.warn}</span>;
  if (outcome === "na")          return <span className="in-oc in-oc-na">{I.dash}</span>;
  return <span className="in-oc in-oc-pending" />;
}

function TradeBadge({ trade }) {
  const t = tradeColors[trade] || tradeColors.general;
  return (
    <span className="in-trade-badge" style={{ background: t.soft, color: t.solid }}>
      <span className="in-trade-dot" style={{ background: t.solid }} />
      {t.label}
    </span>
  );
}

function StatusPill({ status, passRate, progress, itemCount }) {
  if (status === "scheduled")   return <span className="in-stat-pill sched">{I.calendar}Scheduled</span>;
  if (status === "in_progress") return <span className="in-stat-pill prog">{I.clock}In progress · {progress}/{itemCount}</span>;
  if (status === "completed")   return (
    <span className="in-stat-pill done">
      {I.check}Completed
      {passRate != null && <span className="in-stat-rate">· {passRate}%</span>}
    </span>
  );
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function InspectionsModule() {
  // view: workspace | detail | templates | template-detail | sub-mobile
  const [view, setView] = useState("workspace");
  const [selectedInspectionId, setSelectedInspectionId] = useState(heroInspectionId);
  const [selectedTemplateId, setSelectedTemplateId] = useState("tpl-dw");
  const [roleView, setRoleView] = useState("contractor"); // contractor | subcontractor
  const [statusFilter, setStatusFilter] = useState("all"); // all | scheduled | in_progress | completed
  const [tradeFilter, setTradeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);
  const [subStep, setSubStep] = useState(0); // for sub mobile walkthrough pagination
  const [subOutcomes, setSubOutcomes] = useState({}); // { [lineItemKey]: "pass"|"fail"|... }

  // ─── Derived ──────────────────────────────────────────────────────────
  const currentInspection = inspections.find(i => i.id === selectedInspectionId);
  const currentTemplate = templates.find(t => t.id === selectedTemplateId);
  const isSub = roleView === "subcontractor";

  // Sub role sees only inspections for their org — use Steel Frame Co. for demo
  const subOrgName = "Steel Frame Co.";
  const subUserName = "Marcus Chen";
  const subInspections = inspections.filter(i => i.assignedOrg === subOrgName);
  const subActiveInspection = subInspections.find(i => i.status === "scheduled") || subInspections[0];

  const visibleInspections = inspections.filter(i => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (tradeFilter !== "all" && i.trade !== tradeFilter) return false;
    if (search && !(i.num.toLowerCase().includes(search.toLowerCase()) ||
                    i.templateName.toLowerCase().includes(search.toLowerCase()) ||
                    i.zone.toLowerCase().includes(search.toLowerCase()) ||
                    i.assignedOrg.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  // Workspace KPIs
  const kpiScheduled   = inspections.filter(i => i.status === "scheduled").length;
  const kpiInProgress  = inspections.filter(i => i.status === "in_progress").length;
  const kpiCompleted   = inspections.filter(i => i.status === "completed");
  const kpiPassRate    = kpiCompleted.length
    ? Math.round(kpiCompleted.reduce((s, i) => s + (i.passRate || 0), 0) / kpiCompleted.length)
    : 0;
  const kpiPunchTotal  = inspections.reduce((s, i) => s + i.punchGenerated, 0);

  const heroPassCount = heroLineItems.filter(l => l.outcome === "pass").length;
  const heroFailCount = heroLineItems.filter(l => l.outcome === "fail").length;
  const heroCondCount = heroLineItems.filter(l => l.outcome === "conditional").length;
  const heroNaCount   = heroLineItems.filter(l => l.outcome === "na").length;

  // ─── CSS (light + dark theme, `in-` prefixed) ─────────────────────────
  const css = `
:root{
  --accent:#5b4fc7;
  --accent-soft:rgba(91,79,199,.1);
  --accent-deep:#4a3fa8;
  --ok:#2d8a5e; --ok-soft:rgba(45,138,94,.12);
  --wr:#c4700b; --wr-soft:rgba(196,112,11,.12);
  --er:#c94545; --er-soft:rgba(201,69,69,.12);
  --na:#8a8a8a; --na-soft:rgba(138,138,138,.12);

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
.in-dark{
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
.in-root{min-height:100vh;background:var(--bg);color:var(--text-primary);font-family:'Instrument Sans',system-ui,sans-serif;font-weight:520;font-size:14px;letter-spacing:-.005em;line-height:1.45;display:flex;flex-direction:column}
.in-root button{font-family:inherit;color:inherit}
.in-root input,.in-root textarea,.in-root select{font-family:inherit;color:inherit}

/* ── Top bar ───────────────────────────────────────────── */
.in-topbar{height:56px;background:var(--surface-1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:16px;flex-shrink:0;position:sticky;top:0;z-index:40}
.in-brand{display:flex;align-items:center;gap:10px;color:var(--accent);font-family:'DM Sans',system-ui,sans-serif;font-weight:740;font-size:15px;letter-spacing:-.02em}
.in-brand-name{color:var(--text-primary)}
.in-crumbs{display:flex;align-items:center;gap:8px;color:var(--text-tertiary);font-size:12.5px;font-weight:540}
.in-crumbs strong{color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:650}
.in-top-spacer{flex:1}
.in-role-toggle{display:flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:2px}
.in-role-toggle button{border:none;background:none;padding:5px 10px;border-radius:6px;font-size:11.5px;font-weight:620;font-family:'DM Sans',sans-serif;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;gap:5px}
.in-role-toggle button.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.in-topbtn{width:32px;height:32px;border:none;background:none;border-radius:8px;color:var(--text-secondary);display:grid;place-items:center;cursor:pointer;position:relative}
.in-topbtn:hover{background:var(--surface-hover);color:var(--text-primary)}
.in-topbtn-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--er);border:1.5px solid var(--surface-1)}
.in-user{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;background:var(--surface-2);border:1px solid var(--border);border-radius:20px;cursor:pointer}
.in-user-avatar{width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:700;font-size:11px}
.in-user-info{line-height:1.15}
.in-user-name{font-family:'DM Sans',sans-serif;font-weight:650;font-size:12px;color:var(--text-primary)}
.in-user-org{font-size:10.5px;color:var(--text-tertiary);font-weight:540}

/* ── Main shell (sidebar + content) ─────────────────────── */
.in-shell{display:flex;flex:1;min-height:0}
.in-sidebar{width:220px;background:var(--surface-1);border-right:1px solid var(--border);padding:16px 10px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;overflow-y:auto}
.in-side-section{font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.05em;color:var(--text-tertiary);text-transform:uppercase;padding:10px 10px 6px}
.in-side-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;font-family:'DM Sans',sans-serif;font-weight:560;font-size:13px;color:var(--text-secondary);cursor:pointer;border:none;background:none;text-align:left;width:100%}
.in-side-item:hover{background:var(--surface-hover);color:var(--text-primary)}
.in-side-item.active{background:var(--accent-soft);color:var(--accent);font-weight:650}
.in-side-count{margin-left:auto;background:var(--surface-3);color:var(--text-secondary);font-size:10.5px;padding:2px 7px;border-radius:10px;font-family:'DM Sans',sans-serif;font-weight:650;letter-spacing:0}
.in-side-item.active .in-side-count{background:var(--accent);color:#fff}

.in-content{flex:1;overflow-y:auto;padding:24px 28px;min-width:0}

/* ── Page header ─────────────────────────────────────────── */
.in-page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
.in-page-title{font-family:'DM Sans',sans-serif;font-weight:770;font-size:26px;letter-spacing:-.025em;color:var(--text-primary);margin:0}
.in-page-sub{color:var(--text-secondary);font-size:13px;margin-top:3px;font-weight:540}
.in-page-actions{display:flex;gap:8px;flex-shrink:0}

/* ── Buttons ─────────────────────────────────────────────── */
.in-btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-1);font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--text-primary);cursor:pointer;transition:all .12s;white-space:nowrap}
.in-btn:hover{background:var(--surface-hover)}
.in-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.in-btn.primary:hover{background:var(--accent-deep)}
.in-btn.ghost{border-color:transparent;background:none;color:var(--text-secondary)}
.in-btn.ghost:hover{background:var(--surface-hover);color:var(--text-primary)}
.in-btn.danger{background:var(--surface-1);border-color:var(--er);color:var(--er)}
.in-btn.danger:hover{background:var(--er-soft)}
.in-btn.sm{height:28px;padding:0 10px;font-size:11.5px;border-radius:7px}
.in-btn.xs{height:24px;padding:0 8px;font-size:11px;border-radius:6px}
.in-btn.icon{width:34px;padding:0;justify-content:center}
.in-btn.sm.icon{width:28px}

/* ── KPI strip ───────────────────────────────────────────── */
.in-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.in-kpi{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:6px}
.in-kpi-label{font-size:11.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:620;letter-spacing:.02em;text-transform:uppercase}
.in-kpi-val{font-family:'DM Sans',sans-serif;font-weight:820;font-size:30px;letter-spacing:-.03em;line-height:1;color:var(--text-primary)}
.in-kpi-val.ok{color:var(--ok)}
.in-kpi-val.wr{color:var(--wr)}
.in-kpi-val.er{color:var(--er)}
.in-kpi-meta{font-size:11.5px;color:var(--text-secondary);font-weight:540}

/* ── Trade summary strip ─────────────────────────────────── */
.in-trade-strip{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:20px}
.in-trade-strip-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.in-trade-strip-hdr h4{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;margin:0;letter-spacing:-.01em}
.in-trade-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.in-trade-card{border:1px solid var(--border);border-radius:9px;padding:10px 12px;display:flex;flex-direction:column;gap:5px;cursor:pointer;transition:all .12s;background:var(--surface-2)}
.in-trade-card:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.in-trade-card.active{border-color:var(--accent);background:var(--accent-soft)}
.in-trade-card-top{display:flex;justify-content:space-between;align-items:center}
.in-trade-card-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:12px;color:var(--text-primary)}
.in-trade-card-meta{font-size:10.5px;color:var(--text-tertiary);font-weight:540}
.in-trade-card-nums{display:flex;gap:8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600}

/* ── Filter row ──────────────────────────────────────────── */
.in-filter-row{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.in-search{position:relative;flex:0 0 260px}
.in-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}
.in-search input{width:100%;height:32px;border:1px solid var(--border);border-radius:8px;padding:0 10px 0 30px;background:var(--surface-1);font-size:12.5px;outline:none;font-weight:540}
.in-search input:focus{border-color:var(--accent)}
.in-tabs{display:flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px}
.in-tab{border:none;background:none;padding:5px 10px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;color:var(--text-secondary);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:5px}
.in-tab:hover{color:var(--text-primary)}
.in-tab.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.in-tab-count{background:var(--surface-3);color:var(--text-secondary);font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700}
.in-tab.active .in-tab-count{background:var(--accent);color:#fff}

/* ── Inspection list table ───────────────────────────────── */
.in-list{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.in-list-hdr{display:grid;grid-template-columns:110px 1fr 140px 180px 100px 120px 80px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface-2);font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary)}
.in-row{display:grid;grid-template-columns:110px 1fr 140px 180px 100px 120px 80px;padding:12px 16px;border-bottom:1px solid var(--border);align-items:center;cursor:pointer;transition:background .1s}
.in-row:hover{background:var(--surface-hover)}
.in-row:last-child{border-bottom:none}
.in-row-num{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;color:var(--text-primary)}
.in-row-title{display:flex;flex-direction:column;gap:3px;min-width:0}
.in-row-title-top{display:flex;align-items:center;gap:8px}
.in-row-title-name{font-family:'DM Sans',sans-serif;font-weight:650;font-size:13px;color:var(--text-primary)}
.in-row-title-zone{font-size:11.5px;color:var(--text-secondary)}
.in-row-assignee{display:flex;flex-direction:column;gap:1px}
.in-row-assignee-org{font-family:'DM Sans',sans-serif;font-weight:620;font-size:12px}
.in-row-assignee-user{font-size:10.5px;color:var(--text-tertiary);font-weight:540}
.in-row-date{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:560;color:var(--text-primary)}
.in-row-punch{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--er);font-weight:600;display:inline-flex;align-items:center;gap:4px}
.in-row-punch.zero{color:var(--text-tertiary);font-weight:500}

/* ── Pills ───────────────────────────────────────────────── */
.in-trade-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:5px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.02em}
.in-trade-dot{width:6px;height:6px;border-radius:50%}
.in-stat-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-family:'DM Sans',sans-serif;font-weight:680;font-size:11px;letter-spacing:-.01em}
.in-stat-pill.sched{background:rgba(56,120,168,.12);color:#3878a8}
.in-stat-pill.prog{background:var(--wr-soft);color:var(--wr)}
.in-stat-pill.done{background:var(--ok-soft);color:var(--ok)}
.in-stat-rate{font-family:'JetBrains Mono',monospace;font-weight:600}
.in-rate-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:7px;font-family:'DM Sans',sans-serif}
.in-rate-pill.ok{background:var(--ok-soft);color:var(--ok)}
.in-rate-pill.warn{background:var(--wr-soft);color:var(--wr)}
.in-rate-pill.fail{background:var(--er-soft);color:var(--er)}
.in-rate-pill.none{background:var(--surface-3);color:var(--text-tertiary);font-weight:600}
.in-rate-val{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11.5px}
.in-rate-lbl{font-size:10px;font-weight:650;opacity:.75;letter-spacing:.04em;text-transform:uppercase}
.in-rate-pill-sm{padding:2px 6px}
.in-rate-pill-sm .in-rate-val{font-size:10.5px}

/* ── Outcome icons ───────────────────────────────────────── */
.in-oc{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}
.in-oc-pass{background:var(--ok-soft);color:var(--ok)}
.in-oc-fail{background:var(--er-soft);color:var(--er)}
.in-oc-cond{background:var(--wr-soft);color:var(--wr)}
.in-oc-na{background:var(--na-soft);color:var(--na)}
.in-oc-pending{background:var(--surface-3);width:22px;height:22px}

/* ── Workspace side rail ─────────────────────────────────── */
.in-workspace{display:grid;grid-template-columns:1fr 320px;gap:20px}
.in-rail{display:flex;flex-direction:column;gap:14px}
.in-rail-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.in-rail-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.in-rail-hdr h4{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;margin:0;display:flex;align-items:center;gap:6px}
.in-rail-item{display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--border)}
.in-rail-item:first-child{border-top:none;padding-top:0}
.in-rail-item-avatar{width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;flex-shrink:0}
.in-rail-item-avatar.sys{background:var(--text-tertiary)}
.in-rail-item-avatar.punch{background:var(--er)}
.in-rail-item-body{flex:1;min-width:0}
.in-rail-item-text{font-size:12px;color:var(--text-primary);line-height:1.4}
.in-rail-item-text strong{font-weight:650;font-family:'DM Sans',sans-serif}
.in-rail-item-target{color:var(--text-secondary);font-size:11px;margin-top:2px;font-family:'JetBrains Mono',monospace;font-weight:500}
.in-rail-item-when{font-size:10.5px;color:var(--text-tertiary);margin-top:3px;font-weight:540}

/* ── Detail view ─────────────────────────────────────────── */
.in-detail{display:grid;grid-template-columns:1fr 320px;gap:20px}
.in-detail-main{display:flex;flex-direction:column;gap:16px}
.in-detail-hdr-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.in-detail-hdr-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}
.in-detail-hdr-title{display:flex;flex-direction:column;gap:6px}
.in-detail-hdr-num{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:12px;color:var(--text-tertiary);letter-spacing:.02em}
.in-detail-hdr-name{font-family:'DM Sans',sans-serif;font-weight:770;font-size:22px;letter-spacing:-.02em;color:var(--text-primary);margin:0}
.in-detail-hdr-meta{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:2px;font-size:12px;color:var(--text-secondary)}
.in-detail-hdr-meta-item{display:flex;align-items:center;gap:5px}
.in-detail-hdr-meta-item strong{color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:620}

/* Progress ring strip */
.in-detail-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;padding-top:14px;border-top:1px solid var(--border)}
.in-summary-cell{display:flex;flex-direction:column;gap:3px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px}
.in-summary-cell-top{display:flex;align-items:center;justify-content:space-between}
.in-summary-cell-label{font-size:10.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:640;text-transform:uppercase;letter-spacing:.04em}
.in-summary-cell-val{font-family:'DM Sans',sans-serif;font-weight:780;font-size:22px;letter-spacing:-.02em}
.in-summary-cell-val.ok{color:var(--ok)}
.in-summary-cell-val.er{color:var(--er)}
.in-summary-cell-val.wr{color:var(--wr)}
.in-summary-cell-val.na{color:var(--na)}

/* Progress bar */
.in-prog{display:flex;height:6px;border-radius:4px;overflow:hidden;background:var(--surface-3);margin-top:10px}
.in-prog-seg{height:100%}
.in-prog-seg.ok{background:var(--ok)}
.in-prog-seg.er{background:var(--er)}
.in-prog-seg.wr{background:var(--wr)}
.in-prog-seg.na{background:var(--na)}

/* Line items */
.in-items{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.in-items-hdr{padding:14px 18px;border-bottom:1px solid var(--border);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center}
.in-items-hdr h3{font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;margin:0}
.in-item{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:flex-start}
.in-item:last-child{border-bottom:none}
.in-item-body{flex:1;min-width:0}
.in-item-label{font-family:'DM Sans',sans-serif;font-weight:640;font-size:13.5px;color:var(--text-primary);line-height:1.35}
.in-item-ref{font-size:11px;color:var(--text-tertiary);margin-top:3px;font-family:'JetBrains Mono',monospace;font-weight:500}
.in-item-note{margin-top:8px;padding:8px 10px;background:var(--surface-2);border-radius:7px;font-size:12px;color:var(--text-secondary);line-height:1.4;border-left:3px solid var(--border-strong)}
.in-item-note.fail{border-left-color:var(--er)}
.in-item-note.cond{border-left-color:var(--wr)}
.in-item-extras{display:flex;gap:10px;margin-top:8px;align-items:center;flex-wrap:wrap}
.in-item-photos{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary);font-weight:560;padding:2px 8px;background:var(--surface-2);border-radius:10px}
.in-item-photos svg{color:var(--text-tertiary)}
.in-item-punch-link{display:inline-flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px;color:var(--er);padding:2px 8px;background:var(--er-soft);border-radius:10px;cursor:pointer}
.in-item-punch-link:hover{background:var(--er);color:#fff}

/* Outcome radio group (detail view) */
.in-outcome-group{display:flex;gap:4px;flex-shrink:0}
.in-outcome-btn{width:30px;height:30px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface-1);display:grid;place-items:center;cursor:pointer;transition:all .12s;color:var(--text-tertiary)}
.in-outcome-btn:hover{border-color:var(--border-strong);color:var(--text-primary)}
.in-outcome-btn.active-pass{background:var(--ok);border-color:var(--ok);color:#fff}
.in-outcome-btn.active-fail{background:var(--er);border-color:var(--er);color:#fff}
.in-outcome-btn.active-cond{background:var(--wr);border-color:var(--wr);color:#fff}
.in-outcome-btn.active-na{background:var(--na);border-color:var(--na);color:#fff}

/* ── Linked punch panel ──────────────────────────────────── */
.in-punch-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px 18px}
.in-punch-card-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.in-punch-card-hdr h4{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;margin:0;display:flex;align-items:center;gap:6px}
.in-punch-card-hdr .er-dot{width:8px;height:8px;background:var(--er);border-radius:50%}
.in-punch-item{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;margin-bottom:8px;cursor:pointer;transition:all .12s}
.in-punch-item:hover{border-color:var(--border-strong);background:var(--surface-hover)}
.in-punch-item:last-child{margin-bottom:0}
.in-punch-item-top{display:flex;justify-content:space-between;align-items:center}
.in-punch-item-num{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11.5px;color:var(--er)}
.in-punch-item-title{font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--text-primary);line-height:1.3}
.in-punch-item-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-tertiary);font-weight:540}
.in-punch-prio{display:inline-flex;padding:1px 7px;border-radius:5px;font-size:10px;font-weight:700;font-family:'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.04em}
.in-punch-prio.high{background:var(--er-soft);color:var(--er)}
.in-punch-prio.normal{background:var(--surface-3);color:var(--text-secondary)}

/* ── Template library view ───────────────────────────────── */
.in-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.in-tpl-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px 18px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:10px;position:relative}
.in-tpl-card:hover{border-color:var(--border-strong);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.in-tpl-card.custom::before{content:"CUSTOM";position:absolute;top:10px;right:14px;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:740;letter-spacing:.08em;color:var(--accent);background:var(--accent-soft);padding:2px 6px;border-radius:4px}
.in-tpl-card-top{display:flex;justify-content:space-between;align-items:flex-start}
.in-tpl-name{font-family:'DM Sans',sans-serif;font-weight:720;font-size:15px;color:var(--text-primary);margin:0;letter-spacing:-.015em}
.in-tpl-meta{display:flex;gap:12px;font-size:11.5px;color:var(--text-secondary);font-weight:540;padding-top:10px;border-top:1px solid var(--border)}
.in-tpl-meta-item{display:flex;align-items:center;gap:4px}
.in-tpl-meta-val{font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text-primary)}
.in-tpl-phase{display:inline-flex;padding:2px 7px;border-radius:4px;font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:740;letter-spacing:.06em;text-transform:uppercase}
.in-tpl-phase.rough{background:rgba(196,138,26,.14);color:#a67510}
.in-tpl-phase.final{background:var(--ok-soft);color:var(--ok)}

/* ── Template detail view ────────────────────────────────── */
.in-tpl-detail{display:grid;grid-template-columns:1fr 300px;gap:20px}
.in-tpl-items{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.in-tpl-items-hdr{padding:14px 18px;border-bottom:1px solid var(--border);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center}
.in-tpl-items-hdr h3{font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;margin:0}
.in-tpl-item-row{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.in-tpl-item-row:last-child{border-bottom:none}
.in-tpl-grip{color:var(--text-tertiary);cursor:grab}
.in-tpl-item-num{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;color:var(--text-tertiary);min-width:24px}
.in-tpl-item-body{flex:1}
.in-tpl-item-label-in{width:100%;border:none;background:none;font-family:'DM Sans',sans-serif;font-weight:620;font-size:13px;color:var(--text-primary);padding:2px 0;outline:none}
.in-tpl-item-ref-in{width:100%;border:none;background:none;font-size:11px;color:var(--text-tertiary);padding:2px 0;outline:none;font-family:'JetBrains Mono',monospace;margin-top:2px}
.in-tpl-side{display:flex;flex-direction:column;gap:14px}

/* ── Sub mobile walkthrough ──────────────────────────────── */
.in-mobile-wrap{display:flex;justify-content:center;padding:10px 0 40px}
.in-mobile-frame{width:420px;max-width:100%;background:var(--surface-1);border:1px solid var(--border);border-radius:28px;overflow:hidden;box-shadow:var(--shadow-lg)}
.in-mobile-hdr{background:var(--accent);color:#fff;padding:18px 20px 14px;display:flex;flex-direction:column;gap:8px}
.in-mobile-hdr-top{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:640;opacity:.9}
.in-mobile-hdr-title{font-family:'DM Sans',sans-serif;font-weight:760;font-size:18px;letter-spacing:-.02em;line-height:1.2}
.in-mobile-hdr-sub{font-size:12px;opacity:.85;font-weight:540}
.in-mobile-prog{height:5px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden;margin-top:8px}
.in-mobile-prog-fill{height:100%;background:#fff}
.in-mobile-body{padding:22px 20px 18px;min-height:420px;display:flex;flex-direction:column;gap:16px}
.in-mobile-step-info{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:620;text-transform:uppercase;letter-spacing:.06em}
.in-mobile-step-ref{font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:none;letter-spacing:0}
.in-mobile-item-label{font-family:'DM Sans',sans-serif;font-weight:720;font-size:19px;color:var(--text-primary);line-height:1.3;letter-spacing:-.015em}
.in-mobile-outcomes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.in-mobile-out-btn{height:56px;border:2px solid var(--border);border-radius:12px;background:var(--surface-2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
.in-mobile-out-btn:hover{border-color:var(--border-strong)}
.in-mobile-out-btn .in-oc{margin-bottom:2px}
.in-mobile-out-btn-label{font-size:12.5px;font-weight:700;color:var(--text-primary)}
.in-mobile-out-btn.active.pass{background:var(--ok);border-color:var(--ok)}
.in-mobile-out-btn.active.fail{background:var(--er);border-color:var(--er)}
.in-mobile-out-btn.active.cond{background:var(--wr);border-color:var(--wr)}
.in-mobile-out-btn.active.na{background:var(--na);border-color:var(--na)}
.in-mobile-out-btn.active *{color:#fff!important}
.in-mobile-out-btn.active .in-oc{background:rgba(255,255,255,.25);color:#fff}
.in-mobile-note{width:100%;min-height:68px;border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;background:var(--surface-1);color:var(--text-primary)}
.in-mobile-note:focus{border-color:var(--accent)}
.in-mobile-photo-btn{width:100%;height:44px;border:1.5px dashed var(--border-strong);border-radius:10px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:640;font-size:12.5px;color:var(--text-secondary)}
.in-mobile-photo-btn:hover{border-color:var(--accent);color:var(--accent)}
.in-mobile-nav{padding:14px 20px;background:var(--surface-2);border-top:1px solid var(--border);display:flex;gap:10px;align-items:center}
.in-mobile-nav .in-btn{flex:1;justify-content:center;height:40px}
.in-mobile-done{padding:40px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}
.in-mobile-done-icon{width:64px;height:64px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:grid;place-items:center}
.in-mobile-done-icon svg{width:32px;height:32px}
.in-mobile-done h3{font-family:'DM Sans',sans-serif;font-weight:760;font-size:20px;margin:0;letter-spacing:-.015em}
.in-mobile-done-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;margin-top:8px}
.in-mobile-done-stat{padding:10px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;text-align:center}
.in-mobile-done-stat-val{font-family:'DM Sans',sans-serif;font-weight:780;font-size:18px;letter-spacing:-.02em}
.in-mobile-done-stat-lbl{font-size:9.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:640;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}

/* Sub role banner */
.in-sub-banner{background:linear-gradient(135deg,rgba(56,120,168,.08),rgba(56,120,168,.03));border:1px solid rgba(56,120,168,.2);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:12.5px;color:var(--text-secondary)}
.in-sub-banner strong{color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:680}

/* ── Create modal ────────────────────────────────────────── */
.in-modal-veil{position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:100;padding:20px}
.in-modal{background:var(--surface-1);border-radius:14px;width:560px;max-width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)}
.in-modal-hdr{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.in-modal-hdr h3{font-family:'DM Sans',sans-serif;font-weight:720;font-size:17px;margin:0;letter-spacing:-.015em}
.in-modal-body{padding:20px 22px;display:flex;flex-direction:column;gap:14px}
.in-modal-field{display:flex;flex-direction:column;gap:5px}
.in-modal-field label{font-family:'DM Sans',sans-serif;font-weight:640;font-size:11.5px;color:var(--text-secondary);letter-spacing:.01em}
.in-modal-field input,.in-modal-field select,.in-modal-field textarea{height:36px;border:1px solid var(--border);border-radius:8px;padding:0 12px;font-family:inherit;font-size:13px;background:var(--surface-1);color:var(--text-primary);outline:none;font-weight:540}
.in-modal-field textarea{min-height:60px;padding:8px 12px;resize:vertical}
.in-modal-field input:focus,.in-modal-field select:focus,.in-modal-field textarea:focus{border-color:var(--accent)}
.in-modal-tpl-pick{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:240px;overflow-y:auto;padding:4px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)}
.in-modal-tpl-opt{padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface-1);display:flex;flex-direction:column;gap:4px;transition:all .12s}
.in-modal-tpl-opt:hover{border-color:var(--border-strong)}
.in-modal-tpl-opt.active{border-color:var(--accent);background:var(--accent-soft)}
.in-modal-tpl-opt-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:12.5px}
.in-modal-tpl-opt-meta{font-size:10.5px;color:var(--text-tertiary);font-weight:540}
.in-modal-ftr{padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;background:var(--surface-2)}

/* ── Dark toggle ─────────────────────────────────────────── */
.in-dark-toggle{position:fixed;bottom:18px;right:18px;width:38px;height:38px;border-radius:50%;background:var(--surface-1);border:1px solid var(--border-strong);color:var(--text-primary);font-size:18px;cursor:pointer;z-index:50;box-shadow:var(--shadow-md);display:grid;place-items:center}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width:1280px){
  .in-workspace,.in-detail,.in-tpl-detail{grid-template-columns:1fr}
  .in-kpi-strip{grid-template-columns:repeat(2,1fr)}
  .in-trade-grid{grid-template-columns:repeat(3,1fr)}
  .in-detail-summary{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:960px){
  .in-sidebar{display:none}
  .in-trade-grid{grid-template-columns:repeat(2,1fr)}
  .in-list-hdr,.in-row{grid-template-columns:90px 1fr 120px}
  .in-list-hdr > :nth-child(n+4),.in-row > :nth-child(n+4){display:none}
}
@media (max-width:560px){
  .in-content{padding:16px 14px}
  .in-kpi-strip{grid-template-columns:1fr 1fr}
  .in-page-title{font-size:22px}
  .in-mobile-frame{border-radius:0;border:none}
}
`;

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{css}</style>
      <div className={`in-root${dark ? " in-dark" : ""}`}>
        {/* ─── Top bar ─────────────────────────────────────── */}
        <header className="in-topbar">
          <div className="in-brand">
            <LogoMark />
            <span className="in-brand-name">BuiltCRM</span>
          </div>
          <div className="in-crumbs">
            <strong>Riverside Office Complex</strong>
            {I.chevR}
            <span>Inspections</span>
          </div>

          <div className="in-top-spacer" />

          <div className="in-role-toggle">
            <button className={roleView === "contractor" ? "active" : ""} onClick={() => { setRoleView("contractor"); setView("workspace"); }}>
              Contractor
            </button>
            <button className={roleView === "subcontractor" ? "active" : ""} onClick={() => { setRoleView("subcontractor"); setView("sub-mobile"); setSubStep(0); }}>
              {I.phone}Subcontractor
            </button>
          </div>

          <button className="in-topbtn">
            {I.bell}
            <span className="in-topbtn-dot" />
          </button>

          <div className="in-user">
            <div className="in-user-avatar">{isSub ? "MC" : "DC"}</div>
            <div className="in-user-info">
              <div className="in-user-name">{isSub ? subUserName : "Dan Carter"}</div>
              <div className="in-user-org">{isSub ? subOrgName : "Hammerline Build"}</div>
            </div>
          </div>
        </header>

        <div className="in-shell">
          {/* ─── Sidebar ─────────────────────────────────────── */}
          {!isSub && (
            <aside className="in-sidebar">
              <div className="in-side-section">Inspections</div>
              <button className={`in-side-item${view === "workspace" ? " active" : ""}`} onClick={() => setView("workspace")}>
                {I.clipboard} Workspace <span className="in-side-count">{inspections.length}</span>
              </button>
              <button className={`in-side-item${view === "templates" || view === "template-detail" ? " active" : ""}`} onClick={() => setView("templates")}>
                {I.copy} Templates <span className="in-side-count">{templates.length}</span>
              </button>

              <div className="in-side-section" style={{ marginTop: 10 }}>Status</div>
              <button className={`in-side-item${statusFilter === "all" && view === "workspace" ? " active" : ""}`} onClick={() => { setStatusFilter("all"); setView("workspace"); }}>
                All <span className="in-side-count">{inspections.length}</span>
              </button>
              <button className={`in-side-item${statusFilter === "scheduled" && view === "workspace" ? " active" : ""}`} onClick={() => { setStatusFilter("scheduled"); setView("workspace"); }}>
                Scheduled <span className="in-side-count">{kpiScheduled}</span>
              </button>
              <button className={`in-side-item${statusFilter === "in_progress" && view === "workspace" ? " active" : ""}`} onClick={() => { setStatusFilter("in_progress"); setView("workspace"); }}>
                In progress <span className="in-side-count">{kpiInProgress}</span>
              </button>
              <button className={`in-side-item${statusFilter === "completed" && view === "workspace" ? " active" : ""}`} onClick={() => { setStatusFilter("completed"); setView("workspace"); }}>
                Completed <span className="in-side-count">{kpiCompleted.length}</span>
              </button>

              <div className="in-side-section" style={{ marginTop: 10 }}>Settings</div>
              <button className="in-side-item" onClick={() => setView("templates")}>
                {I.settings} Template library
              </button>
            </aside>
          )}

          {/* ─── Content ─────────────────────────────────────── */}
          <main className="in-content">
            {/* ══════════════════════════════════════════════════ */}
            {/* VIEW: WORKSPACE (contractor)                       */}
            {/* ══════════════════════════════════════════════════ */}
            {view === "workspace" && !isSub && (
              <>
                <div className="in-page-hdr">
                  <div>
                    <h1 className="in-page-title">Inspections</h1>
                    <div className="in-page-sub">QA/QC checklists · Riverside Office Complex</div>
                  </div>
                  <div className="in-page-actions">
                    <button className="in-btn" onClick={() => setView("templates")}>
                      {I.copy} Templates
                    </button>
                    <button className="in-btn primary" onClick={() => setShowCreate(true)}>
                      {I.plus} New inspection
                    </button>
                  </div>
                </div>

                {/* KPI strip */}
                <div className="in-kpi-strip">
                  <div className="in-kpi">
                    <div className="in-kpi-label">Scheduled</div>
                    <div className="in-kpi-val">{kpiScheduled}</div>
                    <div className="in-kpi-meta">Next 7 days · 3 assigned</div>
                  </div>
                  <div className="in-kpi">
                    <div className="in-kpi-label">In progress</div>
                    <div className="in-kpi-val wr">{kpiInProgress}</div>
                    <div className="in-kpi-meta">Subs actively completing</div>
                  </div>
                  <div className="in-kpi">
                    <div className="in-kpi-label">Overall pass rate</div>
                    <div className="in-kpi-val ok">{kpiPassRate}%</div>
                    <div className="in-kpi-meta">Across {kpiCompleted.length} completed</div>
                  </div>
                  <div className="in-kpi">
                    <div className="in-kpi-label">Punch items generated</div>
                    <div className="in-kpi-val er">{kpiPunchTotal}</div>
                    <div className="in-kpi-meta">Auto from fail / conditional</div>
                  </div>
                </div>

                {/* Trade summary */}
                <div className="in-trade-strip">
                  <div className="in-trade-strip-hdr">
                    <h4>By trade category</h4>
                    <button className={`in-btn xs${tradeFilter === "all" ? " primary" : " ghost"}`} onClick={() => setTradeFilter("all")}>
                      {tradeFilter === "all" ? "All trades" : "Clear filter"}
                    </button>
                  </div>
                  <div className="in-trade-grid">
                    {tradeSummary.map(t => (
                      <div
                        key={t.trade}
                        className={`in-trade-card${tradeFilter === t.trade ? " active" : ""}`}
                        onClick={() => setTradeFilter(tradeFilter === t.trade ? "all" : t.trade)}
                      >
                        <div className="in-trade-card-top">
                          <TradeBadge trade={t.trade} />
                          <PassRatePill rate={t.passRate} size="sm" />
                        </div>
                        <div className="in-trade-card-nums">
                          <span style={{ color: "var(--text-tertiary)" }}>S {t.scheduled}</span>
                          <span style={{ color: "var(--wr)" }}>P {t.inProgress}</span>
                          <span style={{ color: "var(--ok)" }}>C {t.completed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="in-workspace">
                  <div>
                    {/* Filter row */}
                    <div className="in-filter-row">
                      <div className="in-search">
                        {I.search}
                        <input placeholder="Search by number, template, zone, sub…" value={search} onChange={(e) => setSearch(e.target.value)} />
                      </div>
                      <div className="in-tabs">
                        <button className={`in-tab${statusFilter === "all" ? " active" : ""}`} onClick={() => setStatusFilter("all")}>
                          All<span className="in-tab-count">{inspections.length}</span>
                        </button>
                        <button className={`in-tab${statusFilter === "scheduled" ? " active" : ""}`} onClick={() => setStatusFilter("scheduled")}>
                          Scheduled<span className="in-tab-count">{kpiScheduled}</span>
                        </button>
                        <button className={`in-tab${statusFilter === "in_progress" ? " active" : ""}`} onClick={() => setStatusFilter("in_progress")}>
                          In progress<span className="in-tab-count">{kpiInProgress}</span>
                        </button>
                        <button className={`in-tab${statusFilter === "completed" ? " active" : ""}`} onClick={() => setStatusFilter("completed")}>
                          Completed<span className="in-tab-count">{kpiCompleted.length}</span>
                        </button>
                      </div>
                      <div style={{ flex: 1 }} />
                      <button className="in-btn sm ghost">{I.filter} More filters</button>
                    </div>

                    {/* List */}
                    <div className="in-list">
                      <div className="in-list-hdr">
                        <div>Number</div>
                        <div>Inspection</div>
                        <div>Trade</div>
                        <div>Assignee</div>
                        <div>Scheduled</div>
                        <div>Status</div>
                        <div>Punch</div>
                      </div>
                      {visibleInspections.map(ins => (
                        <div
                          key={ins.id}
                          className="in-row"
                          onClick={() => { setSelectedInspectionId(ins.id); setView("detail"); }}
                        >
                          <div className="in-row-num">{ins.num}</div>
                          <div className="in-row-title">
                            <div className="in-row-title-top">
                              <span className="in-row-title-name">{ins.templateName}</span>
                            </div>
                            <span className="in-row-title-zone">{ins.zone}</span>
                          </div>
                          <div><TradeBadge trade={ins.trade} /></div>
                          <div className="in-row-assignee">
                            <span className="in-row-assignee-org">{ins.assignedOrg}</span>
                            <span className="in-row-assignee-user">{ins.assignedUser}</span>
                          </div>
                          <div className="in-row-date">{ins.scheduled}</div>
                          <div>
                            <StatusPill status={ins.status} passRate={ins.passRate} progress={ins.progress} itemCount={ins.itemCount} />
                          </div>
                          <div>
                            <span className={`in-row-punch${ins.punchGenerated === 0 ? " zero" : ""}`}>
                              {ins.punchGenerated > 0 && I.link}
                              {ins.punchGenerated || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                      {visibleInspections.length === 0 && (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                          No inspections match the current filter.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Workspace side rail: Recent activity */}
                  <aside className="in-rail">
                    <div className="in-rail-card">
                      <div className="in-rail-hdr">
                        <h4>{I.clock} Recent activity</h4>
                      </div>
                      {activity.map((a, idx) => (
                        <div key={idx} className="in-rail-item">
                          <div className={`in-rail-item-avatar${a.who === "System" ? " sys" : ""}${a.kind === "punch" ? " punch" : ""}`}>
                            {a.who === "System" ? (a.kind === "punch" ? I.link : "S") : a.who.split(" ").map(w => w[0]).join("").slice(0, 2)}
                          </div>
                          <div className="in-rail-item-body">
                            <div className="in-rail-item-text">
                              <strong>{a.who}</strong> {a.action}
                            </div>
                            {a.target && <div className="in-rail-item-target">{a.target}</div>}
                            <div className="in-rail-item-when">{a.when}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* VIEW: DETAIL (contractor)                          */}
            {/* ══════════════════════════════════════════════════ */}
            {view === "detail" && !isSub && currentInspection && (
              <>
                <div className="in-page-hdr">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="in-btn sm ghost" onClick={() => setView("workspace")}>
                      {I.back} Back
                    </button>
                    <div className="in-crumbs">
                      <span>Inspections</span>
                      {I.chevR}
                      <strong>{currentInspection.num}</strong>
                    </div>
                  </div>
                  <div className="in-page-actions">
                    <button className="in-btn sm">{I.copy} Duplicate</button>
                    <button className="in-btn sm ghost icon">{I.more}</button>
                  </div>
                </div>

                <div className="in-detail">
                  <div className="in-detail-main">
                    {/* Header card */}
                    <div className="in-detail-hdr-card">
                      <div className="in-detail-hdr-top">
                        <div className="in-detail-hdr-title">
                          <span className="in-detail-hdr-num">{currentInspection.num}</span>
                          <h2 className="in-detail-hdr-name">{currentInspection.templateName}</h2>
                          <div className="in-detail-hdr-meta">
                            <span className="in-detail-hdr-meta-item">
                              <TradeBadge trade={currentInspection.trade} />
                            </span>
                            <span className="in-detail-hdr-meta-item">
                              {I.tag} <strong>{currentInspection.zone}</strong>
                            </span>
                            <span className="in-detail-hdr-meta-item">
                              {I.user} <strong>{currentInspection.assignedOrg}</strong> · {currentInspection.assignedUser}
                            </span>
                            <span className="in-detail-hdr-meta-item">
                              {I.calendar} Scheduled <strong>{currentInspection.scheduled}</strong>
                            </span>
                            {currentInspection.completed && (
                              <span className="in-detail-hdr-meta-item">
                                {I.check} Completed <strong>{currentInspection.completed}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusPill
                          status={currentInspection.status}
                          passRate={currentInspection.passRate}
                          progress={currentInspection.progress}
                          itemCount={currentInspection.itemCount}
                        />
                      </div>

                      {/* Summary cells — only for the hero inspection with real data */}
                      {currentInspection.id === heroInspectionId && (
                        <>
                          <div className="in-detail-summary">
                            <div className="in-summary-cell">
                              <div className="in-summary-cell-top">
                                <span className="in-summary-cell-label">Pass</span>
                                <OutcomeIcon outcome="pass" />
                              </div>
                              <div className="in-summary-cell-val ok">{heroPassCount}</div>
                            </div>
                            <div className="in-summary-cell">
                              <div className="in-summary-cell-top">
                                <span className="in-summary-cell-label">Fail</span>
                                <OutcomeIcon outcome="fail" />
                              </div>
                              <div className="in-summary-cell-val er">{heroFailCount}</div>
                            </div>
                            <div className="in-summary-cell">
                              <div className="in-summary-cell-top">
                                <span className="in-summary-cell-label">Conditional</span>
                                <OutcomeIcon outcome="conditional" />
                              </div>
                              <div className="in-summary-cell-val wr">{heroCondCount}</div>
                            </div>
                            <div className="in-summary-cell">
                              <div className="in-summary-cell-top">
                                <span className="in-summary-cell-label">N/A</span>
                                <OutcomeIcon outcome="na" />
                              </div>
                              <div className="in-summary-cell-val na">{heroNaCount}</div>
                            </div>
                          </div>
                          <div className="in-prog" title={`${currentInspection.passRate}% pass rate`}>
                            <div className="in-prog-seg ok" style={{ width: `${(heroPassCount / heroLineItems.length) * 100}%` }} />
                            <div className="in-prog-seg er" style={{ width: `${(heroFailCount / heroLineItems.length) * 100}%` }} />
                            <div className="in-prog-seg wr" style={{ width: `${(heroCondCount / heroLineItems.length) * 100}%` }} />
                            <div className="in-prog-seg na" style={{ width: `${(heroNaCount / heroLineItems.length) * 100}%` }} />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Line items */}
                    <div className="in-items">
                      <div className="in-items-hdr">
                        <h3>Line items {currentInspection.id === heroInspectionId ? `· ${heroLineItems.length}` : `· ${currentInspection.itemCount}`}</h3>
                        {currentInspection.status === "completed"
                          ? <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 540 }}>Read-only — inspection completed</span>
                          : <button className="in-btn sm primary">{I.check} Complete inspection</button>
                        }
                      </div>

                      {currentInspection.id === heroInspectionId ? (
                        heroLineItems.map((item, idx) => (
                          <div key={item.key} className="in-item">
                            <OutcomeIcon outcome={item.outcome} />
                            <div className="in-item-body">
                              <div className="in-item-label">{idx + 1}. {item.label}</div>
                              <div className="in-item-ref">{item.ref}</div>
                              {item.note && (
                                <div className={`in-item-note${item.outcome === "fail" ? " fail" : item.outcome === "conditional" ? " cond" : ""}`}>
                                  {item.note}
                                </div>
                              )}
                              {(item.photos > 0 || item.punchId) && (
                                <div className="in-item-extras">
                                  {item.photos > 0 && (
                                    <span className="in-item-photos">
                                      {I.camera}{item.photos} photo{item.photos > 1 ? "s" : ""}
                                    </span>
                                  )}
                                  {item.punchId && (
                                    <span className="in-item-punch-link">
                                      {I.link}{item.punchId}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="in-outcome-group">
                              <button className={`in-outcome-btn${item.outcome === "pass" ? " active-pass" : ""}`} title="Pass">{I.check}</button>
                              <button className={`in-outcome-btn${item.outcome === "fail" ? " active-fail" : ""}`} title="Fail">{I.x}</button>
                              <button className={`in-outcome-btn${item.outcome === "conditional" ? " active-cond" : ""}`} title="Conditional">{I.warn}</button>
                              <button className={`in-outcome-btn${item.outcome === "na" ? " active-na" : ""}`} title="N/A">{I.dash}</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        // For non-hero inspections, show a skeleton with placeholder items
                        Array.from({ length: Math.min(currentInspection.itemCount, 6) }, (_, idx) => (
                          <div key={idx} className="in-item">
                            <OutcomeIcon outcome={currentInspection.status === "completed" ? "pass" : null} />
                            <div className="in-item-body">
                              <div className="in-item-label">{idx + 1}. Checklist item from {currentInspection.templateName} template</div>
                              <div className="in-item-ref">Spec reference · §3.{idx + 1}</div>
                            </div>
                            <div className="in-outcome-group">
                              <button className={`in-outcome-btn${currentInspection.status === "completed" ? " active-pass" : ""}`}>{I.check}</button>
                              <button className="in-outcome-btn">{I.x}</button>
                              <button className="in-outcome-btn">{I.warn}</button>
                              <button className="in-outcome-btn">{I.dash}</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Detail side rail */}
                  <aside className="in-rail">
                    {/* Linked punch items */}
                    {currentInspection.id === heroInspectionId && heroPunchItems.length > 0 && (
                      <div className="in-punch-card">
                        <div className="in-punch-card-hdr">
                          <h4><span className="er-dot" /> Auto-generated punch items</h4>
                          <span className="in-rate-pill fail" style={{ fontSize: 11 }}>
                            <span className="in-rate-val">{heroPunchItems.length}</span>
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.4 }}>
                          Fail and conditional outcomes were converted to punch items on completion. Assigned back to sub for correction.
                        </div>
                        {heroPunchItems.map(p => (
                          <div key={p.num} className="in-punch-item">
                            <div className="in-punch-item-top">
                              <span className="in-punch-item-num">{p.num}</span>
                              <span className={`in-punch-prio ${p.priority}`}>{p.priority}</span>
                            </div>
                            <div className="in-punch-item-title">{p.title}</div>
                            <div className="in-punch-item-meta">
                              <span>{p.assignee}</span>
                              <span>Due {p.due}</span>
                            </div>
                          </div>
                        ))}
                        <button className="in-btn sm" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
                          Open in punch list {I.chevR}
                        </button>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="in-rail-card">
                      <div className="in-rail-hdr">
                        <h4>{I.clock} Timeline</h4>
                      </div>
                      <div className="in-rail-item">
                        <div className="in-rail-item-avatar sys">S</div>
                        <div className="in-rail-item-body">
                          <div className="in-rail-item-text">Inspection created from <strong>Drywall</strong> template</div>
                          <div className="in-rail-item-when">Apr 13 · 9:14 AM</div>
                        </div>
                      </div>
                      <div className="in-rail-item">
                        <div className="in-rail-item-avatar">DC</div>
                        <div className="in-rail-item-body">
                          <div className="in-rail-item-text"><strong>Dan Carter</strong> assigned to Summit Drywall</div>
                          <div className="in-rail-item-when">Apr 13 · 9:15 AM</div>
                        </div>
                      </div>
                      <div className="in-rail-item">
                        <div className="in-rail-item-avatar" style={{ background: "#6b5d8c" }}>JR</div>
                        <div className="in-rail-item-body">
                          <div className="in-rail-item-text"><strong>Jose Ramirez</strong> started inspection on mobile</div>
                          <div className="in-rail-item-when">Apr 14 · 2:08 PM</div>
                        </div>
                      </div>
                      <div className="in-rail-item">
                        <div className="in-rail-item-avatar" style={{ background: "#6b5d8c" }}>JR</div>
                        <div className="in-rail-item-body">
                          <div className="in-rail-item-text"><strong>Jose Ramirez</strong> completed · <span style={{ color: "var(--wr)", fontWeight: 650 }}>75% pass rate</span></div>
                          <div className="in-rail-item-when">Apr 14 · 3:42 PM</div>
                        </div>
                      </div>
                      <div className="in-rail-item">
                        <div className="in-rail-item-avatar punch">{I.link}</div>
                        <div className="in-rail-item-body">
                          <div className="in-rail-item-text"><strong>System</strong> auto-created 3 punch items</div>
                          <div className="in-rail-item-target">PI-0234, PI-0235, PI-0236</div>
                          <div className="in-rail-item-when">Apr 14 · 3:42 PM</div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* VIEW: TEMPLATES (library)                          */}
            {/* ══════════════════════════════════════════════════ */}
            {view === "templates" && !isSub && (
              <>
                <div className="in-page-hdr">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="in-btn sm ghost" onClick={() => setView("workspace")}>
                      {I.back} Back
                    </button>
                    <div>
                      <h1 className="in-page-title">Inspection templates</h1>
                      <div className="in-page-sub">{templates.length} templates · {templates.filter(t => t.owner === "custom").length} custom · {templates.reduce((s, t) => s + t.timesUsed, 0)} total uses</div>
                    </div>
                  </div>
                  <div className="in-page-actions">
                    <button className="in-btn primary">{I.plus} New template</button>
                  </div>
                </div>

                <div className="in-tpl-grid">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className={`in-tpl-card${t.owner === "custom" ? " custom" : ""}`}
                      onClick={() => { setSelectedTemplateId(t.id); setView("template-detail"); }}
                    >
                      <div className="in-tpl-card-top">
                        <TradeBadge trade={t.trade} />
                        <span className={`in-tpl-phase ${t.phase}`}>{t.phase}</span>
                      </div>
                      <h3 className="in-tpl-name">{t.name}</h3>
                      <div className="in-tpl-meta">
                        <span className="in-tpl-meta-item">
                          <span className="in-tpl-meta-val">{t.itemCount}</span> items
                        </span>
                        <span className="in-tpl-meta-item">
                          <span className="in-tpl-meta-val">{t.timesUsed}</span> uses
                        </span>
                        <span className="in-tpl-meta-item" style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>
                          Updated {t.updated}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* VIEW: TEMPLATE DETAIL                              */}
            {/* ══════════════════════════════════════════════════ */}
            {view === "template-detail" && !isSub && currentTemplate && (
              <>
                <div className="in-page-hdr">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="in-btn sm ghost" onClick={() => setView("templates")}>
                      {I.back} Templates
                    </button>
                    <div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <h1 className="in-page-title">{currentTemplate.name}</h1>
                        <span className={`in-tpl-phase ${currentTemplate.phase}`}>{currentTemplate.phase}</span>
                      </div>
                      <div className="in-page-sub">
                        <TradeBadge trade={currentTemplate.trade} /> · {currentTemplate.itemCount} items · {currentTemplate.timesUsed} uses · Updated {currentTemplate.updated}
                      </div>
                    </div>
                  </div>
                  <div className="in-page-actions">
                    <button className="in-btn sm">{I.copy} Duplicate</button>
                    <button className="in-btn sm danger">{I.archive} Archive</button>
                    <button className="in-btn primary">{I.check} Save changes</button>
                  </div>
                </div>

                <div className="in-tpl-detail">
                  <div className="in-tpl-items">
                    <div className="in-tpl-items-hdr">
                      <h3>Line items</h3>
                      <button className="in-btn sm primary">{I.plus} Add item</button>
                    </div>
                    {/* Show the drywall items if this is the drywall template, else generic */}
                    {currentTemplate.id === "tpl-dw"
                      ? heroLineItems.map((item, idx) => (
                          <div key={item.key} className="in-tpl-item-row">
                            <span className="in-tpl-grip">{I.grip}</span>
                            <span className="in-tpl-item-num">{String(idx + 1).padStart(2, "0")}</span>
                            <div className="in-tpl-item-body">
                              <input className="in-tpl-item-label-in" defaultValue={item.label} />
                              <input className="in-tpl-item-ref-in" defaultValue={item.ref} placeholder="Spec reference (optional)" />
                            </div>
                            <button className="in-btn xs ghost icon" title="Delete">{I.trash}</button>
                          </div>
                        ))
                      : Array.from({ length: currentTemplate.itemCount }, (_, idx) => (
                          <div key={idx} className="in-tpl-item-row">
                            <span className="in-tpl-grip">{I.grip}</span>
                            <span className="in-tpl-item-num">{String(idx + 1).padStart(2, "0")}</span>
                            <div className="in-tpl-item-body">
                              <input className="in-tpl-item-label-in" defaultValue={`${currentTemplate.name} check item ${idx + 1}`} />
                              <input className="in-tpl-item-ref-in" placeholder="Spec reference (optional)" />
                            </div>
                            <button className="in-btn xs ghost icon" title="Delete">{I.trash}</button>
                          </div>
                        ))
                    }
                  </div>

                  <div className="in-tpl-side">
                    <div className="in-rail-card">
                      <div className="in-rail-hdr">
                        <h4>Template settings</h4>
                      </div>
                      <div className="in-modal-field" style={{ marginBottom: 10 }}>
                        <label>Name</label>
                        <input defaultValue={currentTemplate.name} />
                      </div>
                      <div className="in-modal-field" style={{ marginBottom: 10 }}>
                        <label>Trade category</label>
                        <select defaultValue={currentTemplate.trade}>
                          {Object.entries(tradeColors).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="in-modal-field">
                        <label>Phase</label>
                        <select defaultValue={currentTemplate.phase}>
                          <option value="rough">Rough-in</option>
                          <option value="final">Final</option>
                        </select>
                      </div>
                    </div>
                    <div className="in-rail-card">
                      <div className="in-rail-hdr">
                        <h4>Usage</h4>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        Used in <strong style={{ color: "var(--text-primary)", fontFamily: "'DM Sans',sans-serif" }}>{currentTemplate.timesUsed}</strong> inspections across {Math.ceil(currentTemplate.timesUsed / 3)} projects. Archiving will not remove historical inspections.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* VIEW: SUB MOBILE WALKTHROUGH                       */}
            {/* ══════════════════════════════════════════════════ */}
            {isSub && (() => {
              // Sub walkthrough uses the Framing — Rough template against INS-0018.
              // Generate 10 framing line items for the mobile demo.
              const walkthroughItems = [
                { key: "fr-01", label: "All exterior walls plumb and square (±1/4\" in 10')",         ref: "Spec 06 10 00 §3.2" },
                { key: "fr-02", label: "Wall plates anchored per structural engineering",             ref: "Spec 06 10 00 §3.3" },
                { key: "fr-03", label: "Headers sized and installed per plan",                        ref: "Structural S-2.1" },
                { key: "fr-04", label: "King/jack stud count at all openings",                        ref: "Spec 06 10 00 §3.4" },
                { key: "fr-05", label: "Fire blocking installed at required locations",               ref: "IBC 2021 §718" },
                { key: "fr-06", label: "Roof truss spacing and bracing per plan",                     ref: "Structural S-3.2" },
                { key: "fr-07", label: "Sheathing nailing pattern matches plan",                      ref: "Structural S-2.2" },
                { key: "fr-08", label: "Window / door rough openings verified",                       ref: "Arch A-201" },
                { key: "fr-09", label: "Beams and posts installed per structural plan",               ref: "Structural S-2.1" },
                { key: "fr-10", label: "Crawl space access framing clear of obstructions",            ref: "Arch A-301" },
              ];
              const totalSteps = walkthroughItems.length;
              const isDone = subStep >= totalSteps;
              const currentItem = walkthroughItems[subStep];
              const answeredCount = Object.keys(subOutcomes).length;

              return (
                <>
                  <div className="in-sub-banner">
                    {I.phone}
                    <span>
                      Previewing as <strong>{subUserName} · {subOrgName}</strong>. Subs see only inspections assigned to their org, optimized for mobile walk-through.
                    </span>
                  </div>

                  <div className="in-mobile-wrap">
                    <div className="in-mobile-frame">
                      {/* Mobile header */}
                      <div className="in-mobile-hdr">
                        <div className="in-mobile-hdr-top">
                          <span>INS-0018 · Riverside</span>
                          <span>{isDone ? "Complete" : `${subStep + 1} of ${totalSteps}`}</span>
                        </div>
                        <div className="in-mobile-hdr-title">Framing — Rough</div>
                        <div className="in-mobile-hdr-sub">Floor 2 East · scheduled Apr 22</div>
                        <div className="in-mobile-prog">
                          <div className="in-mobile-prog-fill" style={{ width: `${(answeredCount / totalSteps) * 100}%` }} />
                        </div>
                      </div>

                      {/* Mobile body */}
                      {!isDone && currentItem && (
                        <>
                          <div className="in-mobile-body">
                            <div className="in-mobile-step-info">
                              <span>Item {subStep + 1} of {totalSteps}</span>
                              <span className="in-mobile-step-ref">{currentItem.ref}</span>
                            </div>
                            <div className="in-mobile-item-label">{currentItem.label}</div>

                            <div className="in-mobile-outcomes">
                              <button
                                className={`in-mobile-out-btn${subOutcomes[currentItem.key] === "pass" ? " active pass" : ""}`}
                                onClick={() => setSubOutcomes({ ...subOutcomes, [currentItem.key]: "pass" })}
                              >
                                <OutcomeIcon outcome="pass" />
                                <span className="in-mobile-out-btn-label">Pass</span>
                              </button>
                              <button
                                className={`in-mobile-out-btn${subOutcomes[currentItem.key] === "fail" ? " active fail" : ""}`}
                                onClick={() => setSubOutcomes({ ...subOutcomes, [currentItem.key]: "fail" })}
                              >
                                <OutcomeIcon outcome="fail" />
                                <span className="in-mobile-out-btn-label">Fail</span>
                              </button>
                              <button
                                className={`in-mobile-out-btn${subOutcomes[currentItem.key] === "conditional" ? " active cond" : ""}`}
                                onClick={() => setSubOutcomes({ ...subOutcomes, [currentItem.key]: "conditional" })}
                              >
                                <OutcomeIcon outcome="conditional" />
                                <span className="in-mobile-out-btn-label">Conditional</span>
                              </button>
                              <button
                                className={`in-mobile-out-btn${subOutcomes[currentItem.key] === "na" ? " active na" : ""}`}
                                onClick={() => setSubOutcomes({ ...subOutcomes, [currentItem.key]: "na" })}
                              >
                                <OutcomeIcon outcome="na" />
                                <span className="in-mobile-out-btn-label">N/A</span>
                              </button>
                            </div>

                            <textarea
                              className="in-mobile-note"
                              placeholder={
                                subOutcomes[currentItem.key] === "fail" || subOutcomes[currentItem.key] === "conditional"
                                  ? "Note required for fail/conditional — describe issue, location, corrective action…"
                                  : "Optional note…"
                              }
                            />

                            <button className="in-mobile-photo-btn">
                              {I.camera} Add photo
                            </button>
                          </div>

                          <div className="in-mobile-nav">
                            <button
                              className="in-btn"
                              onClick={() => setSubStep(Math.max(0, subStep - 1))}
                              disabled={subStep === 0}
                            >
                              {I.chevL} Previous
                            </button>
                            <button
                              className="in-btn primary"
                              onClick={() => setSubStep(subStep + 1)}
                            >
                              {subStep === totalSteps - 1 ? "Review" : "Next"} {I.chevR}
                            </button>
                          </div>
                        </>
                      )}

                      {/* Done screen */}
                      {isDone && (
                        <>
                          <div className="in-mobile-done">
                            <div className="in-mobile-done-icon">{I.check}</div>
                            <div>
                              <h3>Inspection complete</h3>
                              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                                Submitted to Hammerline Build for review.
                              </div>
                            </div>

                            <div className="in-mobile-done-stats">
                              <div className="in-mobile-done-stat">
                                <div className="in-mobile-done-stat-val" style={{ color: "var(--ok)" }}>
                                  {Object.values(subOutcomes).filter(v => v === "pass").length}
                                </div>
                                <div className="in-mobile-done-stat-lbl">Pass</div>
                              </div>
                              <div className="in-mobile-done-stat">
                                <div className="in-mobile-done-stat-val" style={{ color: "var(--er)" }}>
                                  {Object.values(subOutcomes).filter(v => v === "fail").length}
                                </div>
                                <div className="in-mobile-done-stat-lbl">Fail</div>
                              </div>
                              <div className="in-mobile-done-stat">
                                <div className="in-mobile-done-stat-val" style={{ color: "var(--wr)" }}>
                                  {Object.values(subOutcomes).filter(v => v === "conditional").length}
                                </div>
                                <div className="in-mobile-done-stat-lbl">Cond</div>
                              </div>
                              <div className="in-mobile-done-stat">
                                <div className="in-mobile-done-stat-val" style={{ color: "var(--na)" }}>
                                  {Object.values(subOutcomes).filter(v => v === "na").length}
                                </div>
                                <div className="in-mobile-done-stat-lbl">N/A</div>
                              </div>
                            </div>

                            <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, marginTop: 4 }}>
                              Any fail or conditional items will be auto-converted into punch list items for your crew to correct.
                            </div>
                          </div>

                          <div className="in-mobile-nav">
                            <button className="in-btn" onClick={() => { setSubStep(0); setSubOutcomes({}); }}>
                              {I.back} Restart walk-through
                            </button>
                            <button className="in-btn primary" onClick={() => { setRoleView("contractor"); setView("workspace"); }}>
                              View in contractor portal
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </main>
        </div>

        {/* ─── Create inspection modal ──────────────────────── */}
        {showCreate && (
          <div className="in-modal-veil" onClick={() => setShowCreate(false)}>
            <div className="in-modal" onClick={(e) => e.stopPropagation()}>
              <div className="in-modal-hdr">
                <h3>New inspection</h3>
                <button className="in-btn xs ghost icon" onClick={() => setShowCreate(false)}>{I.x}</button>
              </div>
              <div className="in-modal-body">
                <div className="in-modal-field">
                  <label>Template</label>
                  <div className="in-modal-tpl-pick">
                    {templates.slice(0, 8).map(t => (
                      <div
                        key={t.id}
                        className={`in-modal-tpl-opt${selectedTemplateId === t.id ? " active" : ""}`}
                        onClick={() => setSelectedTemplateId(t.id)}
                      >
                        <div className="in-modal-tpl-opt-name">{t.name}</div>
                        <div className="in-modal-tpl-opt-meta">{t.itemCount} items · {tradeColors[t.trade].label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="in-modal-field">
                  <label>Zone / location</label>
                  <input placeholder="e.g. Floor 2 West" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="in-modal-field">
                    <label>Scheduled date</label>
                    <input type="date" />
                  </div>
                  <div className="in-modal-field">
                    <label>Assign to sub</label>
                    <select>
                      <option>Steel Frame Co.</option>
                      <option>Coastal Electric</option>
                      <option>Sullivan Plumbing</option>
                      <option>Northwest HVAC</option>
                      <option>Summit Drywall</option>
                      <option>Thermal Pro</option>
                    </select>
                  </div>
                </div>

                <div className="in-modal-field">
                  <label>Notes for sub (optional)</label>
                  <textarea placeholder="Access info, specific concerns, prerequisites…" />
                </div>
              </div>
              <div className="in-modal-ftr">
                <button className="in-btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="in-btn primary" onClick={() => setShowCreate(false)}>
                  {I.send} Create & assign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dark toggle */}
        <button className="in-dark-toggle" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">
          {dark ? "☀" : "☾"}
        </button>
      </div>
    </>
  );
}
