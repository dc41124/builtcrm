import { useState, useRef, useEffect } from "react";

// BuiltCRM — Safety Forms Module (Contractor + Subcontractor / Phase 4+ Step 52)
// Step 52 (6 #52). Toolbox talks, JHAs, incident reports, near misses.
// Templates per form type → assign / open in mobile → sub completes on mobile
// (signature, photo, attendees) → incident reports notify admins immediately
// → safety form history exports to PDF per project. Offline-capable via Step 51
// queue. Priority P1.

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Form type config (4 types per Step 52 schema) ──────────────────────
const formTypes = {
  toolbox_talk:    { label: "Toolbox Talk",     short: "Toolbox",  solid: "#3878a8", soft: "rgba(56,120,168,.12)",  desc: "Pre-shift safety briefing with crew sign-in." },
  jha:             { label: "JHA",              short: "JHA",      solid: "#9c6240", soft: "rgba(156,98,64,.12)",   desc: "Job Hazard Analysis — hazards + controls per task." },
  incident_report: { label: "Incident Report",  short: "Incident", solid: "#c93b3b", soft: "rgba(201,59,59,.12)",   desc: "Recordable injury, property damage, or release." },
  near_miss:       { label: "Near Miss",        short: "Near Miss",solid: "#c4700b", soft: "rgba(196,112,11,.12)",  desc: "Close-call event with no injury or damage." },
};

// ─── Severity levels (incident reports) ─────────────────────────────────
const severities = {
  first_aid:       { label: "First Aid",         color: "#3878a8" },
  recordable:      { label: "Recordable",        color: "#c4700b" },
  lost_time:       { label: "Lost Time",         color: "#c93b3b" },
  fatality:        { label: "Fatality",          color: "#7a1f1f" },
  property_damage: { label: "Property Damage",   color: "#6b5d8c" },
  environmental:   { label: "Environmental",     color: "#2e8a82" },
};

// ─── Template library (6 seeded — covers all 4 types) ───────────────────
const templates = [
  {
    id: "tpl-tb-daily",
    name: "Daily Toolbox Talk",
    formType: "toolbox_talk",
    fieldCount: 6,
    timesUsed: 84,
    updated: "Apr 12",
    owner: "org",
    fields: [
      { key: "topic",     type: "select",     label: "Topic",                    required: true,  options: ["Fall Protection", "Hot Work", "PPE Compliance", "Trenching/Excavation", "Lockout/Tagout", "Heat Illness", "Slip/Trip/Fall", "Other"] },
      { key: "talking",   type: "textarea",   label: "Key talking points",        required: true,  hint: "What was covered. Hazards specific to today's work, controls, lessons from any recent incidents." },
      { key: "weather",   type: "select",     label: "Conditions",                required: false, options: ["Clear & dry", "Rain", "High wind", "Heat advisory", "Cold (<0°C)", "Other"] },
      { key: "attendees", type: "attendees",  label: "Crew attendees",            required: true,  hint: "Each attendee signs to confirm participation." },
      { key: "leader",    type: "signature",  label: "Talk leader signature",     required: true },
      { key: "photo",     type: "photo",      label: "Sign-in sheet photo (opt.)",required: false },
    ],
  },
  {
    id: "tpl-jha-roof",
    name: "Roofing — JHA",
    formType: "jha",
    fieldCount: 7,
    timesUsed: 22,
    updated: "Mar 28",
    owner: "org",
    fields: [
      { key: "task",        type: "text",      label: "Task description",                  required: true },
      { key: "location",    type: "text",      label: "Location / area",                   required: true },
      { key: "hazards",     type: "hazards",   label: "Hazards & controls",                required: true,  hint: "List each hazard, then the control measure that mitigates it." },
      { key: "ppe",         type: "checklist", label: "Required PPE",                      required: true,  options: ["Hard hat", "Safety glasses", "Hi-vis vest", "Cut-resistant gloves", "Steel-toe boots", "Harness & lanyard", "Hearing protection", "Respirator"] },
      { key: "permits",     type: "checklist", label: "Permits in place",                  required: false, options: ["Hot work", "Confined space", "Energized work", "Excavation", "Roof access", "None required"] },
      { key: "competent",   type: "text",      label: "Competent person on-site",          required: true },
      { key: "signoff",     type: "signature", label: "Foreman sign-off",                  required: true },
    ],
  },
  {
    id: "tpl-jha-elec",
    name: "Energized Electrical — JHA",
    formType: "jha",
    fieldCount: 7,
    timesUsed: 11,
    updated: "Apr 02",
    owner: "org",
    fields: [
      { key: "task",      type: "text",      label: "Task description",         required: true },
      { key: "voltage",   type: "select",    label: "System voltage",            required: true, options: ["≤120V", "120–480V", "480V–4.16kV", "4.16kV+"] },
      { key: "loto",      type: "checklist", label: "LOTO sequence verified",    required: true, options: ["Sources identified", "Tagged & locked", "Tested dead", "Grounded if required", "PPE verified"] },
      { key: "ppe",       type: "checklist", label: "Arc-flash PPE category",    required: true, options: ["CAT 1 (4 cal/cm²)", "CAT 2 (8)", "CAT 3 (25)", "CAT 4 (40+)"] },
      { key: "boundary",  type: "text",      label: "Approach boundary distance",required: true },
      { key: "qualified", type: "text",      label: "Qualified person performing work", required: true },
      { key: "signoff",   type: "signature", label: "Electrical foreman sign-off", required: true },
    ],
  },
  {
    id: "tpl-incident",
    name: "Incident Report",
    formType: "incident_report",
    fieldCount: 9,
    timesUsed: 4,
    updated: "Feb 14",
    owner: "org",
    fields: [
      { key: "severity",      type: "select",    label: "Severity",                   required: true, options: Object.keys(severities) },
      { key: "when",          type: "datetime",  label: "Date & time of incident",     required: true },
      { key: "location",      type: "text",      label: "Location on site",           required: true },
      { key: "injured",       type: "people",    label: "Injured / affected parties", required: true,  hint: "Add each person involved. Body part / nature of injury per person." },
      { key: "description",   type: "textarea",  label: "What happened",              required: true,  hint: "Sequence of events leading up to and during the incident. Be factual — opinions and root cause go below." },
      { key: "rootCause",     type: "textarea",  label: "Root cause analysis",        required: true,  hint: "Five-whys or similar. The underlying condition, not just the proximate trigger." },
      { key: "corrective",    type: "actions",   label: "Corrective actions",         required: true,  hint: "Each with owner and target date." },
      { key: "photo",         type: "photo",     label: "Incident scene photo(s)",    required: false },
      { key: "signoff",       type: "signature", label: "Reporter signature",         required: true },
    ],
  },
  {
    id: "tpl-near-miss",
    name: "Near Miss Report",
    formType: "near_miss",
    fieldCount: 5,
    timesUsed: 9,
    updated: "Apr 08",
    owner: "org",
    fields: [
      { key: "when",        type: "datetime",  label: "Date & time",                  required: true },
      { key: "location",    type: "text",      label: "Location on site",             required: true },
      { key: "description", type: "textarea",  label: "What happened",                required: true,  hint: "What could have happened, what stopped it, and conditions present." },
      { key: "preventive",  type: "textarea",  label: "Preventive measure suggested", required: true },
      { key: "signoff",     type: "signature", label: "Reporter signature",           required: true },
    ],
  },
  {
    id: "tpl-tb-fall",
    name: "Toolbox Talk — Fall Protection",
    formType: "toolbox_talk",
    fieldCount: 6,
    timesUsed: 17,
    updated: "Mar 19",
    owner: "custom",
    fields: [
      { key: "topic",     type: "select",    label: "Topic",                       required: true,  options: ["Fall Protection"] },
      { key: "talking",   type: "textarea",  label: "Key talking points",          required: true },
      { key: "weather",   type: "select",    label: "Conditions",                  required: false, options: ["Clear & dry", "Rain", "High wind", "Heat advisory", "Cold (<0°C)", "Other"] },
      { key: "attendees", type: "attendees", label: "Crew attendees",              required: true },
      { key: "leader",    type: "signature", label: "Talk leader signature",       required: true },
      { key: "photo",     type: "photo",     label: "Sign-in sheet photo (opt.)",  required: false },
    ],
  },
];

// ─── Submissions (12 mixed: most submitted, one draft, one queued offline) ─
const submissions = [
  { id: "sf-1",  num: "SF-0042", templateId: "tpl-tb-daily",   formType: "toolbox_talk",    title: "Daily Toolbox Talk — Fall Protection",        submittedBy: "Marcus Chen",    submittedOrg: "Steel Frame Co.",   submittedAt: "Apr 22 · 7:12 AM",  status: "submitted",  attendeesCount: 8,  hasPhoto: true,  hasSignature: true,  flagged: false, severity: null },
  { id: "sf-2",  num: "SF-0041", templateId: "tpl-jha-roof",   formType: "jha",             title: "Roofing — JHA · Floor 4 deck install",       submittedBy: "Marcus Chen",    submittedOrg: "Steel Frame Co.",   submittedAt: "Apr 22 · 7:35 AM",  status: "submitted",  attendeesCount: 0,  hasPhoto: false, hasSignature: true,  flagged: false, severity: null },
  { id: "sf-3",  num: "SF-0040", templateId: "tpl-incident",   formType: "incident_report", title: "Incident — Hand laceration · Floor 1",        submittedBy: "Mike Sullivan",  submittedOrg: "Sullivan Plumbing", submittedAt: "Apr 21 · 2:48 PM",  status: "submitted",  attendeesCount: 0,  hasPhoto: true,  hasSignature: true,  flagged: true,  severity: "first_aid" },
  { id: "sf-4",  num: "SF-0039", templateId: "tpl-tb-daily",   formType: "toolbox_talk",    title: "Daily Toolbox Talk — PPE Compliance",         submittedBy: "Ben Rodriguez",  submittedOrg: "Coastal Electric",  submittedAt: "Apr 21 · 6:55 AM",  status: "submitted",  attendeesCount: 6,  hasPhoto: true,  hasSignature: true,  flagged: false, severity: null },
  { id: "sf-5",  num: "SF-0038", templateId: "tpl-near-miss",  formType: "near_miss",       title: "Near Miss — Falling debris · Floor 3",         submittedBy: "Marcus Chen",    submittedOrg: "Steel Frame Co.",   submittedAt: "Apr 20 · 4:20 PM",  status: "submitted",  attendeesCount: 0,  hasPhoto: false, hasSignature: true,  flagged: true,  severity: null },
  { id: "sf-6",  num: "SF-0037", templateId: "tpl-jha-elec",   formType: "jha",             title: "Energized Electrical — JHA · MDP terminate",   submittedBy: "Ben Rodriguez",  submittedOrg: "Coastal Electric",  submittedAt: "Apr 20 · 8:10 AM",  status: "submitted",  attendeesCount: 0,  hasPhoto: false, hasSignature: true,  flagged: false, severity: null },
  { id: "sf-7",  num: "SF-0036", templateId: "tpl-tb-fall",    formType: "toolbox_talk",    title: "Toolbox Talk — Fall Protection refresher",     submittedBy: "Marcus Chen",    submittedOrg: "Steel Frame Co.",   submittedAt: "Apr 19 · 7:05 AM",  status: "submitted",  attendeesCount: 9,  hasPhoto: true,  hasSignature: true,  flagged: false, severity: null },
  { id: "sf-8",  num: "SF-0035", templateId: "tpl-incident",   formType: "incident_report", title: "Incident — Pinched finger · Mech room",       submittedBy: "Priya Shah",     submittedOrg: "Northwest HVAC",    submittedAt: "Apr 18 · 11:42 AM", status: "submitted",  attendeesCount: 0,  hasPhoto: true,  hasSignature: true,  flagged: true,  severity: "first_aid" },
  { id: "sf-9",  num: "SF-0034", templateId: "tpl-tb-daily",   formType: "toolbox_talk",    title: "Daily Toolbox Talk — Hot Work",                submittedBy: "Mike Sullivan",  submittedOrg: "Sullivan Plumbing", submittedAt: "Apr 18 · 6:48 AM",  status: "submitted",  attendeesCount: 5,  hasPhoto: true,  hasSignature: true,  flagged: false, severity: null },
  { id: "sf-10", num: "SF-0033", templateId: "tpl-near-miss",  formType: "near_miss",       title: "Near Miss — Forklift swing · Loading dock",    submittedBy: "Jose Ramirez",   submittedOrg: "Summit Drywall",    submittedAt: "Apr 17 · 3:15 PM",  status: "submitted",  attendeesCount: 0,  hasPhoto: true,  hasSignature: true,  flagged: false, severity: null },
  { id: "sf-11", num: "SF-0044", templateId: "tpl-tb-daily",   formType: "toolbox_talk",    title: "Daily Toolbox Talk — In progress",            submittedBy: "Marcus Chen",    submittedOrg: "Steel Frame Co.",   submittedAt: "—",                  status: "draft",      attendeesCount: 4,  hasPhoto: false, hasSignature: false, flagged: false, severity: null },
  { id: "sf-12", num: "SF-0043", templateId: "tpl-jha-roof",   formType: "jha",             title: "Roofing — JHA · Awaiting sync",                submittedBy: "Marcus Chen",    submittedOrg: "Steel Frame Co.",   submittedAt: "Apr 22 · 6:55 AM",  status: "queued",     attendeesCount: 0,  hasPhoto: true,  hasSignature: true,  flagged: false, severity: null },
];

// ─── Hero submission line (used for the contractor detail view) ─────────
const heroSubmissionId = "sf-3"; // The first-aid hand laceration incident — best demo

// Demo-filled data for the hero submission (an incident report)
const heroSubmissionData = {
  severity: "first_aid",
  when: "Apr 21, 2026 · 2:42 PM",
  location: "Floor 1 — west mechanical chase, near drinking-water riser cut-in",
  injured: [
    { name: "Tomás Ortega",  role: "Apprentice plumber, Sullivan Plumbing", bodyPart: "Right palm",         nature: "1.5cm laceration, no tendon involvement, no sutures required" },
  ],
  description: "Crew was reaming a 3/4″ copper riser stub-up using a hand reamer. Reamer slipped off the pipe edge as Tomás was applying downward pressure. The blade contacted his right palm, opening a 1.5cm cut. Bleeding was controlled within 60 seconds with direct pressure. First aid administered on-site by foreman (Mike Sullivan). Tomás declined further medical attention and returned to light-duty work after rest.",
  rootCause: "Five-whys: (1) Reamer slipped → (2) Blade engaged off-center on pipe edge → (3) Pipe end was not fully de-burred from prior cut → (4) Sub crew did not have a proper deburr tool on this floor → (5) Tool kit standards have not been audited since project mobilization. Underlying condition: tool kit verification was not part of mobilization checklist.",
  corrective: [
    { id: "ca-1", action: "Add hand-deburr tool to mandatory tool kit; verify each sub crew has one before any pipe work", owner: "Mike Sullivan",   due: "Apr 23" },
    { id: "ca-2", action: "Update Sullivan Plumbing mobilization checklist; brief crew at next toolbox talk",             owner: "Mike Sullivan",   due: "Apr 25" },
    { id: "ca-3", action: "GC to add 'tool kit verified' line item to sub mobilization SOP",                              owner: "Dan Carter",      due: "Apr 30" },
  ],
  photoCount: 2,
  signedBy: "Mike Sullivan",
  signedAt: "Apr 21 · 2:48 PM",
};

// ─── Activity feed ──────────────────────────────────────────────────────
const activity = [
  { who: "Mike Sullivan",  org: "Sullivan Plumbing", action: "submitted Incident Report",       target: "SF-0040 · Hand laceration",         when: "Apr 21 · 2:48 PM",  kind: "incident" },
  { who: "System",         org: "",                  action: "notified project admins",         target: "SF-0040 · severity: First Aid",     when: "Apr 21 · 2:48 PM",  kind: "alert"    },
  { who: "Marcus Chen",    org: "Steel Frame Co.",   action: "submitted Toolbox Talk",          target: "SF-0042 · Fall Protection",         when: "Apr 22 · 7:12 AM",  kind: "submit"   },
  { who: "Marcus Chen",    org: "Steel Frame Co.",   action: "submitted JHA",                   target: "SF-0041 · Floor 4 deck install",    when: "Apr 22 · 7:35 AM",  kind: "submit"   },
  { who: "Marcus Chen",    org: "Steel Frame Co.",   action: "reported a Near Miss",            target: "SF-0038 · Falling debris",          when: "Apr 20 · 4:20 PM",  kind: "incident" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "added corrective action",         target: "SF-0040 · CA-3 owner update",       when: "Apr 21 · 4:05 PM",  kind: "edit"     },
  { who: "Priya Shah",     org: "Northwest HVAC",    action: "submitted Incident Report",       target: "SF-0035 · Pinched finger",          when: "Apr 18 · 11:42 AM", kind: "incident" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "added Toolbox Talk template",     target: "Toolbox Talk — Fall Protection",    when: "Mar 19 · 9:14 AM",  kind: "template" },
];

// ─── Form-type summary (workspace KPI strip) ────────────────────────────
const typeSummary = [
  { type: "toolbox_talk",    submitted: 5, last7d: 4, draftsOrQueued: 1 },
  { type: "jha",             submitted: 2, last7d: 2, draftsOrQueued: 1 },
  { type: "incident_report", submitted: 2, last7d: 2, draftsOrQueued: 0 },
  { type: "near_miss",       submitted: 2, last7d: 2, draftsOrQueued: 0 },
];

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS (inline SVG — no emoji per design system)
// ═══════════════════════════════════════════════════════════════════════════
const I = {
  plus:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  warn:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  shield:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  clipboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/></svg>,
  calendar:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  user:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  camera:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  pen:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  filter:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  search:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  chevR:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevL:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevD:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/></svg>,
  more:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  download:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  send:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>,
  phone:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  edit:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  clock:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 15 14"/></svg>,
  cloud:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  cloudOff:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  fileText:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  alert:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  flag:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  copy:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  refresh:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  hardHat:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h20"/><path d="M4 18a8 8 0 0 1 16 0"/><path d="M9 7v4M15 7v4"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>,
  history:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
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

function FormTypeBadge({ type, size = "md" }) {
  const cfg = formTypes[type];
  if (!cfg) return null;
  return (
    <span className={`sf-type-badge sf-type-badge-${size}`} style={{ background: cfg.soft, color: cfg.solid, borderColor: cfg.soft }}>
      <span className="sf-type-dot" style={{ background: cfg.solid }} />
      {size === "sm" ? cfg.short : cfg.label}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    submitted: { label: "Submitted", cls: "ok"   },
    draft:     { label: "Draft",     cls: "muted" },
    queued:    { label: "Queued · offline", cls: "amber" },
  };
  const s = map[status] || map.submitted;
  return <span className={`sf-status-pill sf-status-${s.cls}`}>{s.label}</span>;
}

function SeverityPill({ severity, size = "md" }) {
  if (!severity) return null;
  const cfg = severities[severity];
  return (
    <span className={`sf-sev-pill sf-sev-${size}`} style={{ color: cfg.color, borderColor: cfg.color, background: `${cfg.color}14` }}>
      {I.alert} {cfg.label}
    </span>
  );
}

// ─── Signature pad — pointer events, supports mouse + touch ─────────────
function SignaturePad({ value, onChange, onClear, dark = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = dark ? "#f1efea" : "#1a1a1a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [dark]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    if (!value) onChange?.(true);
  };

  const end = () => { drawingRef.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.(false);
    onClear?.();
  };

  return (
    <div className="sf-sig-wrap">
      <canvas
        ref={canvasRef}
        className="sf-sig-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="sf-sig-meta">
        <span>{value ? "Signed" : "Sign with finger or mouse"}</span>
        <button type="button" className="sf-sig-clear" onClick={clear} disabled={!value}>
          {I.refresh} Clear
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN MODULE
// ═══════════════════════════════════════════════════════════════════════════

export default function SafetyFormsModule() {
  // view: workspace | detail | templates | template-detail | sub-list | sub-form | sub-done
  const [view, setView] = useState("workspace");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(heroSubmissionId);
  const [selectedTemplateId, setSelectedTemplateId] = useState("tpl-incident");
  const [roleView, setRoleView] = useState("contractor"); // contractor | subcontractor
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Sub mobile flow state
  const [activeFormTemplateId, setActiveFormTemplateId] = useState(null); // template chosen on sub list
  const [formStep, setFormStep] = useState(0);
  const [formData, setFormData] = useState({});  // { [field.key]: any }
  const [showSubmittedToast, setShowSubmittedToast] = useState(false);

  // Demo: simulate offline state for sub mobile
  const [isOnline, setIsOnline] = useState(true);

  // ─── Derived ────────────────────────────────────────────────────────
  const currentSubmission = submissions.find(s => s.id === selectedSubmissionId);
  const currentTemplate   = templates.find(t => t.id === selectedTemplateId);
  const isSub = roleView === "subcontractor";

  // Sub demo context — Steel Frame Co. / Marcus Chen
  const subOrgName  = "Steel Frame Co.";
  const subUserName = "Marcus Chen";
  const subAssignedTemplates = ["tpl-tb-daily", "tpl-jha-roof", "tpl-near-miss", "tpl-incident"]
    .map(id => templates.find(t => t.id === id))
    .filter(Boolean);
  const subRecent = submissions
    .filter(s => s.submittedOrg === subOrgName)
    .slice(0, 4);

  const visibleSubmissions = submissions.filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (typeFilter !== "all" && s.formType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.num.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q) ||
            s.submittedBy.toLowerCase().includes(q) ||
            s.submittedOrg.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // KPIs
  const kpiTotal       = submissions.filter(s => s.status === "submitted").length;
  const kpiIncidents   = submissions.filter(s => s.formType === "incident_report" && s.status === "submitted").length;
  const kpiNearMisses  = submissions.filter(s => s.formType === "near_miss" && s.status === "submitted").length;
  const kpiOpen        = submissions.filter(s => s.status === "draft" || s.status === "queued").length;
  const last7Submissions = submissions.filter(s => s.status === "submitted").length; // demo: all "last 7d"

  // Active form template for sub mobile
  const activeTemplate = templates.find(t => t.id === activeFormTemplateId);
  const activeFields   = activeTemplate?.fields || [];
  const totalSteps     = activeFields.length;

  // ─── Form interaction helpers ───────────────────────────────────────
  const updateField = (key, val) => setFormData(d => ({ ...d, [key]: val }));

  const isFieldFilled = (field) => {
    const v = formData[field.key];
    if (field.type === "signature") return v === true;
    if (field.type === "photo") return Array.isArray(v) && v.length > 0;
    if (field.type === "attendees" || field.type === "people" || field.type === "hazards" || field.type === "actions") {
      return Array.isArray(v) && v.length > 0;
    }
    if (field.type === "checklist") return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== null && String(v).trim().length > 0;
  };

  const requiredCount   = activeFields.filter(f => f.required).length;
  const filledRequired  = activeFields.filter(f => f.required && isFieldFilled(f)).length;
  const canSubmit       = requiredCount > 0 && filledRequired === requiredCount;

  const resetSubFlow = () => {
    setActiveFormTemplateId(null);
    setFormStep(0);
    setFormData({});
  };

  const submitForm = () => {
    setView("sub-done");
    setShowSubmittedToast(true);
    setTimeout(() => setShowSubmittedToast(false), 3000);
  };

  // ─── CSS (light + dark theme, `sf-` prefixed) ───────────────────────
  const css = `
:root{
  --accent:#5b4fc7;
  --accent-soft:rgba(91,79,199,.1);
  --accent-deep:#4a3fa8;
  --ok:#2d8a5e; --ok-soft:rgba(45,138,94,.12);
  --wr:#c4700b; --wr-soft:rgba(196,112,11,.12);
  --er:#c93b3b; --er-soft:rgba(201,69,69,.12);
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
.sf-dark{
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
.sf-root{min-height:100vh;background:var(--bg);color:var(--text-primary);font-family:'Instrument Sans',system-ui,sans-serif;font-weight:520;font-size:14px;letter-spacing:-.005em;line-height:1.45;display:flex;flex-direction:column}
.sf-root button{font-family:inherit;color:inherit}
.sf-root input,.sf-root textarea,.sf-root select{font-family:inherit;color:inherit}

/* ── Top bar ───────────────────────────────────────────── */
.sf-topbar{height:54px;background:var(--surface-1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 22px;gap:18px;position:sticky;top:0;z-index:10}
.sf-topbar-left{display:flex;align-items:center;gap:14px;flex:1;min-width:0}
.sf-brand{display:flex;align-items:center;gap:10px;color:var(--accent);font-family:'DM Sans',sans-serif;font-weight:780;font-size:16px;letter-spacing:-.015em}
.sf-brand-divider{width:1px;height:22px;background:var(--border)}
.sf-crumb{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:560}
.sf-crumb-active{color:var(--text-primary);font-weight:680}
.sf-crumb svg{color:var(--text-tertiary)}
.sf-topbar-right{display:flex;align-items:center;gap:8px}
.sf-role-toggle{display:flex;background:var(--surface-3);border-radius:8px;padding:3px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px}
.sf-role-toggle button{background:transparent;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;color:var(--text-secondary);display:flex;align-items:center;gap:6px;letter-spacing:.01em}
.sf-role-toggle button.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.sf-icon-btn{width:34px;height:34px;border-radius:8px;background:transparent;border:1px solid transparent;display:grid;place-items:center;color:var(--text-secondary);cursor:pointer;transition:all .12s}
.sf-icon-btn:hover{background:var(--surface-2);color:var(--text-primary);border-color:var(--border)}
.sf-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#5b4fc7,#7d72e6);color:#fff;display:grid;place-items:center;font-size:12px;font-family:'DM Sans',sans-serif;font-weight:680}

/* ── Layout shell ──────────────────────────────────────── */
.sf-shell{display:flex;flex:1;min-height:0}
.sf-sidebar{width:272px;background:var(--surface-1);border-right:1px solid var(--border);padding:18px 12px;display:flex;flex-direction:column;gap:4px;flex-shrink:0}
.sf-sb-section{font-family:'DM Sans',sans-serif;font-weight:640;font-size:10.5px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.08em;padding:14px 10px 6px}
.sf-sb-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:580;font-size:13px;letter-spacing:-.005em;transition:all .12s}
.sf-sb-item:hover{background:var(--surface-2);color:var(--text-primary)}
.sf-sb-item.active{background:var(--accent-soft);color:var(--accent);font-weight:640}
.sf-sb-item .sf-sb-count{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary)}
.sf-sb-item.active .sf-sb-count{color:var(--accent)}

.sf-main{flex:1;overflow-x:hidden;display:flex;flex-direction:column;min-width:0}
.sf-page{padding:22px 28px 60px;max-width:1480px;width:100%;margin:0 auto}
.sf-page-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}
.sf-page-title{font-family:'DM Sans',sans-serif;font-weight:780;font-size:24px;letter-spacing:-.025em;color:var(--text-primary);line-height:1.15;margin:0}
.sf-page-sub{font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:1.5}
.sf-page-actions{display:flex;align-items:center;gap:8px}

/* ── Buttons ───────────────────────────────────────────── */
.sf-btn{height:34px;padding:0 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;letter-spacing:.005em;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .12s;white-space:nowrap}
.sf-btn:hover{background:var(--surface-2);border-color:var(--border-strong)}
.sf-btn:disabled{opacity:.45;cursor:not-allowed}
.sf-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.sf-btn.primary:hover{background:var(--accent-deep);border-color:var(--accent-deep)}
.sf-btn.danger{background:var(--er);border-color:var(--er);color:#fff}
.sf-btn.danger:hover{background:#a83838;border-color:#a83838}
.sf-btn.ghost{background:transparent;border-color:transparent;color:var(--text-secondary)}
.sf-btn.ghost:hover{background:var(--surface-2);color:var(--text-primary)}
.sf-btn.sm{height:28px;padding:0 10px;font-size:11.5px}

/* ── KPI strip ─────────────────────────────────────────── */
.sf-kpi-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:22px}
.sf-kpi{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:14px 16px}
.sf-kpi-label{font-family:'DM Sans',sans-serif;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary)}
.sf-kpi-row{display:flex;align-items:baseline;gap:8px;margin-top:6px}
.sf-kpi-val{font-family:'DM Sans',sans-serif;font-weight:820;font-size:26px;letter-spacing:-.03em;color:var(--text-primary);line-height:1}
.sf-kpi-sub{font-size:11.5px;color:var(--text-tertiary)}
.sf-kpi.alert .sf-kpi-val{color:var(--er)}
.sf-kpi.warn  .sf-kpi-val{color:var(--wr)}
.sf-kpi.ok    .sf-kpi-val{color:var(--ok)}

/* ── Workspace grid ─────────────────────────────────────── */
.sf-grid{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}

/* ── Filter bar ────────────────────────────────────────── */
.sf-filter-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface-1);border:1px solid var(--border);border-radius:11px;margin-bottom:12px;flex-wrap:wrap}
.sf-search{flex:1;min-width:220px;display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text-secondary);transition:all .12s}
.sf-search:focus-within{border-color:var(--accent);background:var(--surface-1);color:var(--text-primary)}
.sf-search input{flex:1;border:none;outline:none;background:transparent;font-size:13px;color:inherit}
.sf-pill-group{display:flex;gap:4px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:3px}
.sf-pill-group button{height:24px;padding:0 10px;border-radius:6px;border:none;background:transparent;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.sf-pill-group button.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}

/* ── Submissions table ─────────────────────────────────── */
.sf-table-wrap{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;overflow:hidden}
.sf-table{width:100%;border-collapse:collapse}
.sf-table thead{background:var(--surface-2);border-bottom:1px solid var(--border)}
.sf-table th{padding:11px 14px;text-align:left;font-family:'DM Sans',sans-serif;font-weight:640;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary);white-space:nowrap}
.sf-table td{padding:13px 14px;border-bottom:1px solid var(--border);vertical-align:middle;font-size:13px}
.sf-table tbody tr{cursor:pointer;transition:background .1s}
.sf-table tbody tr:hover{background:var(--surface-hover)}
.sf-table tbody tr:last-child td{border-bottom:none}
.sf-table-num{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--text-secondary);font-weight:520}
.sf-table-title{font-family:'DM Sans',sans-serif;font-weight:680;color:var(--text-primary);letter-spacing:-.01em}
.sf-table-meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--text-tertiary);margin-top:3px}
.sf-table-icons{display:flex;gap:6px;color:var(--text-tertiary)}
.sf-table-icons span{display:inline-flex;align-items:center;gap:3px}

/* ── Form-type badges + status pills ───────────────────── */
.sf-type-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:680;font-size:11px;letter-spacing:.005em;line-height:1;white-space:nowrap}
.sf-type-badge-sm{font-size:10px;padding:3px 7px}
.sf-type-dot{width:6px;height:6px;border-radius:50%}
.sf-status-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:14px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;line-height:1.2;border:1px solid}
.sf-status-ok{background:var(--ok-soft);color:var(--ok);border-color:transparent}
.sf-status-amber{background:var(--wr-soft);color:var(--wr);border-color:transparent}
.sf-status-muted{background:var(--surface-3);color:var(--text-secondary);border-color:transparent}
.sf-sev-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;border:1px solid;font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.005em}
.sf-sev-sm{font-size:9.5px;padding:2px 6px}

/* ── Side rail (workspace) ─────────────────────────────── */
.sf-rail{display:flex;flex-direction:column;gap:14px}
.sf-rail-card{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:14px 16px}
.sf-rail-card h4{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13.5px;color:var(--text-primary);margin:0 0 10px;letter-spacing:-.005em}
.sf-rail-typeRow{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--border);font-size:12.5px}
.sf-rail-typeRow:last-child{border-bottom:none}
.sf-rail-typeRow .sf-rail-typeNum{display:flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--text-secondary)}
.sf-rail-typeRow .sf-rail-typeBars{display:flex;gap:3px}
.sf-rail-typeRow .sf-rail-bar{width:14px;height:14px;border-radius:3px}

/* ── Activity feed ─────────────────────────────────────── */
.sf-activity{display:flex;flex-direction:column;gap:11px}
.sf-act-row{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;line-height:1.45}
.sf-act-dot{width:7px;height:7px;border-radius:50%;margin-top:7px;flex-shrink:0}
.sf-act-dot.submit{background:var(--accent)}
.sf-act-dot.incident{background:var(--er)}
.sf-act-dot.alert{background:var(--wr)}
.sf-act-dot.edit{background:var(--text-tertiary)}
.sf-act-dot.template{background:var(--ok)}
.sf-act-row .sf-act-text{color:var(--text-secondary);flex:1}
.sf-act-row .sf-act-text strong{color:var(--text-primary);font-weight:660;font-family:'DM Sans',sans-serif}
.sf-act-row .sf-act-target{display:block;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;font-size:11.5px;margin-top:1px}
.sf-act-row .sf-act-when{display:block;color:var(--text-tertiary);font-size:11px;margin-top:1px}

/* ── Detail view ───────────────────────────────────────── */
.sf-detail{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
.sf-detail-main{display:flex;flex-direction:column;gap:16px}
.sf-detail-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.sf-detail-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}
.sf-detail-title{font-family:'DM Sans',sans-serif;font-weight:760;font-size:20px;letter-spacing:-.02em;line-height:1.2;margin:0;color:var(--text-primary)}
.sf-detail-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text-tertiary);margin-top:8px}
.sf-detail-meta-item{display:flex;align-items:center;gap:5px}
.sf-detail-section{padding-top:14px;border-top:1px solid var(--border);margin-top:14px}
.sf-detail-section:first-child{border-top:none;padding-top:0;margin-top:0}
.sf-detail-section h3{font-family:'DM Sans',sans-serif;font-weight:680;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary);margin:0 0 10px}
.sf-detail-row{display:flex;gap:12px;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px}
.sf-detail-row:last-child{border-bottom:none}
.sf-detail-row .sf-detail-key{font-family:'DM Sans',sans-serif;font-weight:620;color:var(--text-secondary);width:32%;flex-shrink:0;font-size:12.5px}
.sf-detail-row .sf-detail-val{flex:1;color:var(--text-primary);line-height:1.5}
.sf-detail-prose{font-size:13.5px;line-height:1.6;color:var(--text-primary);white-space:pre-wrap}

.sf-injured-card{background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:12px 14px;margin-bottom:8px}
.sf-injured-card-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:13.5px;color:var(--text-primary)}
.sf-injured-card-role{font-size:12px;color:var(--text-secondary);margin-top:1px}
.sf-injured-card-injury{font-size:12.5px;color:var(--text-secondary);margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)}
.sf-injured-card-injury strong{color:var(--text-primary);font-weight:620}

.sf-action-card{display:grid;grid-template-columns:1fr 140px 100px;gap:12px;padding:11px 13px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;align-items:center}
.sf-action-text{font-size:12.5px;color:var(--text-primary);line-height:1.5}
.sf-action-owner{font-size:11.5px;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:620}
.sf-action-due{font-size:11.5px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace}

.sf-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sf-photo-tile{aspect-ratio:1;background:var(--surface-3);border-radius:8px;display:grid;place-items:center;color:var(--text-tertiary);position:relative;overflow:hidden}
.sf-photo-tile.has-img{background:linear-gradient(135deg,#3b3a37,#5a5752)}
.sf-photo-tile-label{position:absolute;bottom:6px;left:6px;font-size:10px;color:#fff;background:rgba(0,0,0,.55);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace}

.sf-sig-box{background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:9px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px}
.sf-sig-box-svg{width:170px;height:60px;color:var(--text-primary)}
.sf-sig-box-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:13px;color:var(--text-primary);margin-top:2px}
.sf-sig-box-when{font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace}

/* ── Detail rail ───────────────────────────────────────── */
.sf-detail-rail{display:flex;flex-direction:column;gap:14px;position:sticky;top:74px}
.sf-detail-rail .sf-rail-card h4{display:flex;align-items:center;gap:8px}

/* ── Templates ────────────────────────────────────────── */
.sf-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.sf-tpl-card{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:16px 18px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:10px}
.sf-tpl-card:hover{border-color:var(--border-strong);transform:translateY(-1px);box-shadow:var(--shadow-md)}
.sf-tpl-card-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.sf-tpl-card-name{font-family:'DM Sans',sans-serif;font-weight:720;font-size:14.5px;color:var(--text-primary);letter-spacing:-.01em;line-height:1.3;flex:1}
.sf-tpl-card-meta{display:flex;align-items:center;gap:12px;font-size:11.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:560;padding-top:8px;border-top:1px dashed var(--border)}
.sf-tpl-card-meta-item{display:flex;align-items:center;gap:4px}

.sf-tpl-detail{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:20px 22px}
.sf-tpl-detail-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.sf-tpl-field-list{display:flex;flex-direction:column;gap:8px}
.sf-tpl-field{display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px}
.sf-tpl-field-num{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);width:22px}
.sf-tpl-field-icon{width:28px;height:28px;border-radius:6px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex-shrink:0}
.sf-tpl-field-label{font-family:'DM Sans',sans-serif;font-weight:660;font-size:13px;color:var(--text-primary);flex:1}
.sf-tpl-field-type{font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace}
.sf-tpl-field-req{font-size:10px;font-family:'DM Sans',sans-serif;font-weight:700;color:var(--er);background:var(--er-soft);padding:2px 6px;border-radius:4px;letter-spacing:.04em}

/* ── Sub desktop additions ─────────────────────────────── */
.sf-tpl-card-time{font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;flex-shrink:0}
.sf-tpl-card-desc{font-size:12.5px;color:var(--text-secondary);line-height:1.45}
.sf-tpl-card-foot{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:560;padding-top:10px;border-top:1px dashed var(--border);margin-top:auto}
.sf-tpl-card-cta{display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-weight:660}
.sf-tpl-card:hover .sf-tpl-card-cta{gap:6px}

.sf-section-hdr{margin:6px 0 14px}
.sf-section-title{font-family:'DM Sans',sans-serif;font-weight:720;font-size:14.5px;color:var(--text-primary);letter-spacing:-.01em}
.sf-section-sub{font-size:12.5px;color:var(--text-secondary);margin-top:3px}

.sf-conn-pill{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:8px;background:var(--ok-soft);color:var(--ok);border:1px solid transparent;font-family:'DM Sans',sans-serif;font-weight:660;font-size:12px;cursor:pointer;transition:all .15s;letter-spacing:-.005em}
.sf-conn-pill:hover{filter:brightness(.97)}
.sf-conn-pill.offline{background:var(--wr-soft);color:var(--wr)}
.sf-conn-pill svg{width:14px;height:14px}

/* ── Wizard (sub form, desktop) ───────────────────────── */
.sf-wiz-prog{margin-bottom:18px}
.sf-wiz-prog-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;font-size:12px;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:540}
.sf-wiz-prog-bar{height:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;overflow:hidden}
.sf-wiz-prog-fill{height:100%;background:var(--accent);transition:width .3s ease;border-radius:3px}

.sf-wiz-grid{display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start}
.sf-wiz-rail{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:14px;position:sticky;top:74px;max-height:calc(100vh - 100px);overflow-y:auto}
.sf-wiz-rail-title{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-family:'DM Sans',sans-serif;font-weight:720;color:var(--text-tertiary);margin-bottom:10px;padding:0 4px}
.sf-wiz-rail-list{display:flex;flex-direction:column;gap:3px}
.sf-wiz-step{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .12s}
.sf-wiz-step:hover{background:var(--surface-2)}
.sf-wiz-step.current{background:var(--accent-soft)}
.sf-wiz-step.current .sf-wiz-step-num{background:var(--accent);color:#fff;border-color:var(--accent)}
.sf-wiz-step.current .sf-wiz-step-label{color:var(--accent-deep);font-weight:680}
.sf-wiz-step.done .sf-wiz-step-num{background:var(--ok);color:#fff;border-color:var(--ok)}
.sf-wiz-step.done .sf-wiz-step-num svg{width:11px;height:11px}
.sf-wiz-step-num{width:22px;height:22px;border-radius:6px;border:1.5px solid var(--border-strong);background:var(--surface-2);font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-tertiary);display:grid;place-items:center;flex-shrink:0;font-weight:660}
.sf-wiz-step-label{flex:1;font-size:12.5px;color:var(--text-primary);line-height:1.3;font-family:'DM Sans',sans-serif;font-weight:540;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sf-wiz-step-req{color:var(--er);font-size:14px;line-height:1;flex-shrink:0}

.sf-wiz-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.sf-wiz-card-hdr{padding:22px 26px 18px;border-bottom:1px solid var(--border);background:var(--surface-2)}
.sf-wiz-card-meta{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:11px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.sf-wiz-card-req{font-size:10px;color:var(--er);background:var(--er-soft);padding:2px 7px;border-radius:4px;font-weight:720}
.sf-wiz-card-label{font-family:'DM Sans',sans-serif;font-weight:740;font-size:19px;color:var(--text-primary);letter-spacing:-.015em;line-height:1.3}
.sf-wiz-card-hint{font-size:13px;color:var(--text-secondary);margin-top:6px;line-height:1.5;font-family:'Instrument Sans',sans-serif}
.sf-wiz-card-body{padding:24px 26px;display:flex;flex-direction:column;gap:14px;min-height:200px}
.sf-wiz-card-foot{padding:14px 22px;border-top:1px solid var(--border);background:var(--surface-2);display:flex;align-items:center;justify-content:space-between;gap:10px}

/* ── Done page (sub, desktop) ─────────────────────────── */
.sf-done-hero{display:flex;align-items:flex-start;gap:18px;padding:24px 26px;background:var(--surface-1);border:1px solid var(--border);border-radius:12px;margin-bottom:16px}
.sf-done-hero-icon{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;flex-shrink:0}
.sf-done-hero-icon svg{width:24px;height:24px}
.sf-done-hero-title{font-family:'DM Sans',sans-serif;font-weight:780;font-size:22px;color:var(--text-primary);letter-spacing:-.02em;line-height:1.2}
.sf-done-hero-sub{font-size:13.5px;color:var(--text-secondary);margin-top:8px;line-height:1.55;font-family:'Instrument Sans',sans-serif;max-width:560px}

.sf-done-stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.sf-done-stat{background:var(--surface-1);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
.sf-done-stat-key{font-size:10.5px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-family:'DM Sans',sans-serif;font-weight:660;margin-bottom:6px}
.sf-done-stat-val{font-family:'DM Sans',sans-serif;font-weight:720;font-size:16px;color:var(--text-primary);letter-spacing:-.01em}

.sf-done-alert{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;background:var(--er-soft);border:1px solid transparent;border-radius:10px;margin-bottom:16px}

.sf-done-next{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin-bottom:16px}
.sf-done-next-title{font-family:'DM Sans',sans-serif;font-weight:720;font-size:13.5px;color:var(--text-primary);margin-bottom:12px}
.sf-done-next-list{display:flex;flex-direction:column;gap:10px}
.sf-done-next-item{display:flex;align-items:flex-start;gap:11px;font-size:13px;color:var(--text-secondary);line-height:1.5}
.sf-done-next-dot{width:22px;height:22px;border-radius:6px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700}

.sf-done-actions{display:flex;justify-content:flex-end;gap:8px}

/* ── Sub mobile shell (legacy — phone preview retired) ── */
.sf-sub-banner{display:flex;align-items:flex-start;gap:10px;padding:11px 16px;background:var(--accent-soft);border:1px solid transparent;border-radius:10px;margin-bottom:18px;font-size:12.5px;color:var(--accent-deep);line-height:1.45}
.sf-sub-banner svg{flex-shrink:0;margin-top:1px}
.sf-mobile-wrap{display:flex;justify-content:center;padding:10px 0 40px}
.sf-mobile-frame{width:420px;max-width:100%;background:var(--surface-1);border:1px solid var(--border);border-radius:28px;overflow:hidden;box-shadow:var(--shadow-lg);position:relative}
.sf-mobile-hdr{background:var(--accent);color:#fff;padding:18px 20px 14px;display:flex;flex-direction:column;gap:8px}
.sf-mobile-hdr-top{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:640;opacity:.92}
.sf-mobile-hdr-title{font-family:'DM Sans',sans-serif;font-weight:760;font-size:18px;letter-spacing:-.02em;line-height:1.2}
.sf-mobile-hdr-sub{font-size:12px;opacity:.85;font-weight:540}
.sf-mobile-prog{height:5px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden;margin-top:8px}
.sf-mobile-prog-fill{height:100%;background:#fff;transition:width .25s ease}
.sf-mobile-net{position:absolute;top:14px;right:18px;display:flex;align-items:center;gap:5px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.18);padding:3px 8px;border-radius:12px;cursor:pointer}
.sf-mobile-net.offline{background:rgba(196,112,11,.85)}

.sf-mobile-list-body{padding:18px 18px 20px;display:flex;flex-direction:column;gap:16px;background:var(--bg);min-height:520px}
.sf-mobile-section-label{font-family:'DM Sans',sans-serif;font-weight:660;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);padding-left:4px}
.sf-mobile-tpl-card{background:var(--surface-1);border:1px solid var(--border);border-radius:13px;padding:14px 15px;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:all .12s}
.sf-mobile-tpl-card:active{transform:scale(.98)}
.sf-mobile-tpl-card-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.sf-mobile-tpl-card-name{font-family:'DM Sans',sans-serif;font-weight:720;font-size:15px;color:var(--text-primary);line-height:1.25;letter-spacing:-.01em}
.sf-mobile-tpl-card-desc{font-size:12px;color:var(--text-secondary);line-height:1.45}
.sf-mobile-tpl-card-foot{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-tertiary);padding-top:8px;border-top:1px dashed var(--border)}

.sf-mobile-recent-row{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:11px 13px;display:flex;align-items:center;gap:11px}
.sf-mobile-recent-row .sf-mobile-recent-text{flex:1;min-width:0}
.sf-mobile-recent-num{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary)}
.sf-mobile-recent-title{font-family:'DM Sans',sans-serif;font-weight:680;font-size:13px;color:var(--text-primary);line-height:1.3;margin-top:2px}

.sf-mobile-body{padding:22px 20px 18px;min-height:420px;display:flex;flex-direction:column;gap:14px;background:var(--surface-1)}
.sf-mobile-step-info{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:620;text-transform:uppercase;letter-spacing:.07em}
.sf-mobile-step-req{font-size:10px;font-family:'DM Sans',sans-serif;font-weight:700;color:var(--er);background:var(--er-soft);padding:2px 7px;border-radius:5px;letter-spacing:.04em;text-transform:none}
.sf-mobile-item-label{font-family:'DM Sans',sans-serif;font-weight:740;font-size:18px;color:var(--text-primary);line-height:1.3;letter-spacing:-.015em}
.sf-mobile-item-hint{font-size:12px;color:var(--text-secondary);line-height:1.45;margin-top:-6px}

.sf-mobile-input{width:100%;height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 13px;font-family:inherit;font-size:14px;background:var(--surface-2);color:var(--text-primary);outline:none}
.sf-mobile-input:focus{border-color:var(--accent);background:var(--surface-1)}
.sf-mobile-textarea{width:100%;min-height:110px;border:1.5px solid var(--border);border-radius:10px;padding:11px 13px;font-family:inherit;font-size:13.5px;resize:vertical;outline:none;background:var(--surface-2);color:var(--text-primary);line-height:1.5}
.sf-mobile-textarea:focus{border-color:var(--accent);background:var(--surface-1)}
.sf-mobile-select{width:100%;height:44px;border:1.5px solid var(--border);border-radius:10px;padding:0 13px;font-family:inherit;font-size:14px;background:var(--surface-2);color:var(--text-primary);outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8884' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
.sf-mobile-select:focus{border-color:var(--accent);background-color:var(--surface-1)}

.sf-mobile-checklist{display:flex;flex-direction:column;gap:7px}
.sf-mobile-check{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);cursor:pointer;transition:all .12s}
.sf-mobile-check:hover{border-color:var(--border-strong)}
.sf-mobile-check.active{border-color:var(--accent);background:var(--accent-soft)}
.sf-mobile-check-box{width:20px;height:20px;border:1.5px solid var(--border-strong);border-radius:5px;display:grid;place-items:center;flex-shrink:0;color:transparent;background:var(--surface-1)}
.sf-mobile-check.active .sf-mobile-check-box{background:var(--accent);border-color:var(--accent);color:#fff}
.sf-mobile-check-label{font-size:13px;color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:580}

.sf-mobile-list-add{height:42px;border:1.5px dashed var(--border-strong);border-radius:10px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:640;font-size:12.5px;color:var(--text-secondary);width:100%}
.sf-mobile-list-add:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.sf-mobile-list-row{display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px}
.sf-mobile-list-row .sf-mobile-list-num{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);width:18px;flex-shrink:0}
.sf-mobile-list-row .sf-mobile-list-text{flex:1;font-size:13px;color:var(--text-primary);line-height:1.4}
.sf-mobile-list-row .sf-mobile-list-x{width:24px;height:24px;border-radius:6px;border:none;background:transparent;color:var(--text-tertiary);cursor:pointer;display:grid;place-items:center}
.sf-mobile-list-row .sf-mobile-list-x:hover{background:var(--er-soft);color:var(--er)}

.sf-mobile-photo-btn{width:100%;height:48px;border:1.5px dashed var(--border-strong);border-radius:10px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:640;font-size:13px;color:var(--text-secondary)}
.sf-mobile-photo-btn:hover{border-color:var(--accent);color:var(--accent)}
.sf-mobile-photo-thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:7px}
.sf-mobile-photo-thumb{aspect-ratio:1;background:linear-gradient(135deg,#3b3a37,#5a5752);border-radius:8px;display:grid;place-items:center;color:rgba(255,255,255,.55);position:relative}
.sf-mobile-photo-thumb svg{width:18px;height:18px}

.sf-mobile-nav{padding:14px 18px;background:var(--surface-2);border-top:1px solid var(--border);display:flex;gap:10px;align-items:center}
.sf-mobile-nav .sf-btn{flex:1;justify-content:center;height:42px;font-size:13px}

/* Signature pad */
.sf-sig-wrap{width:100%;display:flex;flex-direction:column;gap:6px}
.sf-sig-canvas{width:100%;height:140px;border:1.5px solid var(--border-strong);border-radius:10px;background:var(--surface-1);touch-action:none;cursor:crosshair}
.sf-sig-meta{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--text-tertiary)}
.sf-sig-clear{height:26px;padding:0 9px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:620;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.sf-sig-clear:hover{border-color:var(--border-strong);color:var(--text-primary)}
.sf-sig-clear:disabled{opacity:.45;cursor:not-allowed}

/* Hazards / actions list (multi-row composite fields) */
.sf-hazard-row{background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.sf-hazard-row-hdr{display:flex;align-items:center;justify-content:space-between}
.sf-hazard-row-num{font-family:'DM Sans',sans-serif;font-weight:660;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em}
.sf-hazard-row textarea{font-size:13px;min-height:50px;padding:8px 10px;border-radius:8px}

/* Done / submit confirm screen */
.sf-mobile-done{padding:36px 22px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px;background:var(--surface-1)}
.sf-mobile-done-icon{width:64px;height:64px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:grid;place-items:center}
.sf-mobile-done-icon svg{width:32px;height:32px}
.sf-mobile-done h3{font-family:'DM Sans',sans-serif;font-weight:780;font-size:20px;letter-spacing:-.02em;margin:0;color:var(--text-primary)}
.sf-mobile-done-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-top:8px}
.sf-mobile-done-stat{background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:11px 13px;text-align:left}
.sf-mobile-done-stat-key{font-size:11px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:620;text-transform:uppercase;letter-spacing:.05em}
.sf-mobile-done-stat-val{font-family:'DM Sans',sans-serif;font-weight:720;font-size:14px;color:var(--text-primary);margin-top:3px;letter-spacing:-.005em}

/* Toast */
.sf-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--text-primary);color:var(--text-inverse);padding:11px 18px;border-radius:9px;display:flex;align-items:center;gap:8px;font-family:'DM Sans',sans-serif;font-weight:640;font-size:13px;box-shadow:var(--shadow-lg);z-index:50}

/* Responsive — collapse rail at <1100px */
@media (max-width: 1100px){
  .sf-grid, .sf-detail{grid-template-columns:1fr}
  .sf-detail-rail{position:static}
  .sf-kpi-strip{grid-template-columns:repeat(3,1fr)}
  .sf-wiz-grid{grid-template-columns:1fr}
  .sf-wiz-rail{position:static;max-height:none}
  .sf-done-stat-row{grid-template-columns:repeat(2,1fr)}
}
@media (max-width: 720px){
  .sf-sidebar{display:none}
  .sf-page{padding:14px 14px 40px}
  .sf-mobile-frame{border-radius:0;border:none;box-shadow:none}
  .sf-kpi-strip{grid-template-columns:1fr 1fr}
  .sf-action-card{grid-template-columns:1fr}
  .sf-wiz-card-hdr{padding:18px 18px 14px}
  .sf-wiz-card-body{padding:18px}
  .sf-wiz-card-foot{padding:12px 16px;flex-wrap:wrap}
  .sf-done-hero{flex-direction:column;padding:20px}
  .sf-done-stat-row{grid-template-columns:1fr 1fr}
}
`;

  // ─── RENDER ────────────────────────────────────────────────────────
  return (
    <div className={`sf-root${dark ? " sf-dark" : ""}`}>
      <link rel="stylesheet" href={FONTS_URL} />
      <style>{css}</style>

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <header className="sf-topbar">
        <div className="sf-topbar-left">
          <div className="sf-brand"><LogoMark /> BuiltCRM</div>
          <div className="sf-brand-divider" />
          <div className="sf-crumb">
            <span>Riverside Office Complex</span>
            {I.chevR}
            <span className="sf-crumb-active">Safety Forms</span>
          </div>
        </div>
        <div className="sf-topbar-right">
          <div className="sf-role-toggle" role="tablist">
            <button
              className={!isSub ? "active" : ""}
              onClick={() => { setRoleView("contractor"); setView("workspace"); resetSubFlow(); }}
              role="tab"
            >
              {I.hardHat} Contractor
            </button>
            <button
              className={isSub ? "active" : ""}
              onClick={() => { setRoleView("subcontractor"); setView("sub-list"); }}
              role="tab"
            >
              {I.phone} Subcontractor
            </button>
          </div>
          <button className="sf-icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">
            {dark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
          </button>
          <button className="sf-icon-btn">{I.bell}</button>
          <div className="sf-avatar">DC</div>
        </div>
      </header>

      <div className="sf-shell">
        {/* ── SIDEBAR (contractor) ──────────────────────────── */}
        {!isSub && (
          <aside className="sf-sidebar">
            <div className="sf-sb-section">Safety Forms</div>
            <div
              className={`sf-sb-item${view === "workspace" ? " active" : ""}`}
              onClick={() => setView("workspace")}
            >
              {I.shield} All submissions
              <span className="sf-sb-count">{kpiTotal}</span>
            </div>
            <div
              className={`sf-sb-item${view === "templates" || view === "template-detail" ? " active" : ""}`}
              onClick={() => setView("templates")}
            >
              {I.clipboard} Templates
              <span className="sf-sb-count">{templates.length}</span>
            </div>
            <div className="sf-sb-section">Filter by type</div>
            {Object.entries(formTypes).map(([key, cfg]) => {
              const count = submissions.filter(s => s.formType === key && s.status === "submitted").length;
              return (
                <div
                  key={key}
                  className={`sf-sb-item${typeFilter === key && view === "workspace" ? " active" : ""}`}
                  onClick={() => { setTypeFilter(typeFilter === key ? "all" : key); setView("workspace"); }}
                >
                  <span className="sf-type-dot" style={{ background: cfg.solid, width: 8, height: 8 }} />
                  {cfg.label}
                  <span className="sf-sb-count">{count}</span>
                </div>
              );
            })}
            <div className="sf-sb-section">Compliance</div>
            <div className="sf-sb-item">
              {I.history} Form history
            </div>
            <div className="sf-sb-item">
              {I.alert} Incident log
              <span className="sf-sb-count">{kpiIncidents}</span>
            </div>
          </aside>
        )}

        {/* ── SIDEBAR (subcontractor) ───────────────────────── */}
        {isSub && (
          <aside className="sf-sidebar">
            <div className="sf-sb-section">Safety Forms</div>
            <div
              className={`sf-sb-item${view === "sub-list" ? " active" : ""}`}
              onClick={() => { resetSubFlow(); setView("sub-list"); }}
            >
              {I.shield} My forms
              <span className="sf-sb-count">{subRecent.length}</span>
            </div>
            <div className="sf-sb-section">Start a new form</div>
            {subAssignedTemplates.map(t => {
              const cfg = formTypes[t.formType];
              return (
                <div
                  key={t.id}
                  className="sf-sb-item"
                  onClick={() => {
                    setActiveFormTemplateId(t.id);
                    setFormStep(0);
                    setFormData({});
                    setView("sub-form");
                  }}
                >
                  <span className="sf-type-dot" style={{ background: cfg.solid, width: 8, height: 8 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                </div>
              );
            })}
            <div className="sf-sb-section">Connection</div>
            <div
              className="sf-sb-item"
              onClick={() => setIsOnline(!isOnline)}
              style={{ cursor: "pointer" }}
            >
              {isOnline ? I.cloud : I.cloudOff}
              <span style={{ color: isOnline ? "var(--ok)" : "var(--wr)", fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 12.5 }}>
                {isOnline ? "Online" : "Offline · 1 queued"}
              </span>
            </div>
          </aside>
        )}

        {/* ── MAIN ─────────────────────────────────────────── */}
        <main className="sf-main">
          {/* ════════════════════════════════════════════════════ */}
          {/*  CONTRACTOR · WORKSPACE                              */}
          {/* ════════════════════════════════════════════════════ */}
          {!isSub && view === "workspace" && (
            <div className="sf-page">
              <div className="sf-page-hdr">
                <div>
                  <h1 className="sf-page-title">Safety Forms</h1>
                  <p className="sf-page-sub">Toolbox talks, JHAs, and incident reports submitted by your crews. Mobile-first, offline-capable, automatically routed to admins on incident.</p>
                </div>
                <div className="sf-page-actions">
                  <button className="sf-btn" onClick={() => setShowExport(true)}>
                    {I.download} Export history
                  </button>
                  <button className="sf-btn" onClick={() => setView("templates")}>
                    {I.clipboard} Templates
                  </button>
                  <button className="sf-btn primary" onClick={() => setShowCreate(true)}>
                    {I.plus} New form
                  </button>
                </div>
              </div>

              {/* KPI strip */}
              <div className="sf-kpi-strip">
                <div className="sf-kpi">
                  <div className="sf-kpi-label">Total submitted</div>
                  <div className="sf-kpi-row">
                    <span className="sf-kpi-val">{kpiTotal}</span>
                    <span className="sf-kpi-sub">last 7 days</span>
                  </div>
                </div>
                <div className="sf-kpi">
                  <div className="sf-kpi-label">Toolbox talks</div>
                  <div className="sf-kpi-row">
                    <span className="sf-kpi-val">{submissions.filter(s => s.formType === "toolbox_talk" && s.status === "submitted").length}</span>
                    <span className="sf-kpi-sub">5 days running</span>
                  </div>
                </div>
                <div className="sf-kpi alert">
                  <div className="sf-kpi-label">Incidents</div>
                  <div className="sf-kpi-row">
                    <span className="sf-kpi-val">{kpiIncidents}</span>
                    <span className="sf-kpi-sub">first aid · 0 lost time</span>
                  </div>
                </div>
                <div className="sf-kpi warn">
                  <div className="sf-kpi-label">Near misses</div>
                  <div className="sf-kpi-row">
                    <span className="sf-kpi-val">{kpiNearMisses}</span>
                    <span className="sf-kpi-sub">trended below avg</span>
                  </div>
                </div>
                <div className="sf-kpi">
                  <div className="sf-kpi-label">Open / queued</div>
                  <div className="sf-kpi-row">
                    <span className="sf-kpi-val">{kpiOpen}</span>
                    <span className="sf-kpi-sub">{kpiOpen > 0 ? "1 syncing" : "all clear"}</span>
                  </div>
                </div>
              </div>

              <div className="sf-grid">
                <div>
                  {/* Filter bar */}
                  <div className="sf-filter-bar">
                    <div className="sf-search">
                      {I.search}
                      <input
                        placeholder="Search by ID, title, person, or org…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="sf-pill-group">
                      {[
                        { k: "all", label: "All" },
                        { k: "submitted", label: "Submitted" },
                        { k: "draft", label: "Drafts" },
                        { k: "queued", label: "Queued" },
                      ].map(p => (
                        <button
                          key={p.k}
                          className={statusFilter === p.k ? "active" : ""}
                          onClick={() => setStatusFilter(p.k)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="sf-pill-group">
                      <button className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}>All types</button>
                      {Object.entries(formTypes).map(([key, cfg]) => (
                        <button
                          key={key}
                          className={typeFilter === key ? "active" : ""}
                          onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                        >
                          {cfg.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submissions table */}
                  <div className="sf-table-wrap">
                    <table className="sf-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Submission</th>
                          <th>Type</th>
                          <th>Submitted by</th>
                          <th>When</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSubmissions.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: "30px 14px", color: "var(--text-tertiary)", fontSize: 13 }}>
                              No submissions match your filters.
                            </td>
                          </tr>
                        )}
                        {visibleSubmissions.map(s => (
                          <tr key={s.id} onClick={() => { setSelectedSubmissionId(s.id); setView("detail"); }}>
                            <td><span className="sf-table-num">{s.num}</span></td>
                            <td>
                              <div className="sf-table-title">{s.title}</div>
                              <div className="sf-table-meta">
                                {s.flagged && <span style={{ color: "var(--er)", display: "inline-flex", alignItems: "center", gap: 3 }}>{I.flag} flagged</span>}
                                <span className="sf-table-icons">
                                  {s.hasPhoto && <span>{I.camera} {s.formType === "incident_report" ? heroSubmissionData.photoCount : "1"}</span>}
                                  {s.hasSignature && <span>{I.pen} signed</span>}
                                  {s.attendeesCount > 0 && <span>{I.users} {s.attendeesCount}</span>}
                                </span>
                              </div>
                            </td>
                            <td>
                              <FormTypeBadge type={s.formType} size="sm" />
                              {s.severity && (
                                <div style={{ marginTop: 4 }}>
                                  <SeverityPill severity={s.severity} size="sm" />
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 12.5 }}>{s.submittedBy}</div>
                              <div style={{ color: "var(--text-tertiary)", fontSize: 11.5, marginTop: 2 }}>{s.submittedOrg}</div>
                            </td>
                            <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "var(--text-secondary)" }}>
                              {s.submittedAt}
                            </td>
                            <td><StatusPill status={s.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right rail */}
                <aside className="sf-rail">
                  <div className="sf-rail-card">
                    <h4>By form type · last 7 days</h4>
                    {typeSummary.map(t => {
                      const cfg = formTypes[t.type];
                      return (
                        <div key={t.type} className="sf-rail-typeRow">
                          <span className="sf-rail-typeNum">
                            <span className="sf-type-dot" style={{ background: cfg.solid, width: 8, height: 8 }} />
                            {cfg.label}
                          </span>
                          <div className="sf-rail-typeBars">
                            {Array.from({ length: 7 }).map((_, i) => (
                              <span
                                key={i}
                                className="sf-rail-bar"
                                style={{ background: i < t.last7d ? cfg.solid : "var(--surface-3)" }}
                              />
                            ))}
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "var(--text-tertiary)", minWidth: 18, textAlign: "right" }}>
                            {t.submitted}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sf-rail-card">
                    <h4>Recent activity</h4>
                    <div className="sf-activity">
                      {activity.slice(0, 7).map((a, i) => (
                        <div key={i} className="sf-act-row">
                          <span className={`sf-act-dot ${a.kind}`} />
                          <div className="sf-act-text">
                            <strong>{a.who}</strong>{a.org && <span style={{ color: "var(--text-tertiary)" }}> · {a.org}</span>} {a.action}
                            <span className="sf-act-target">{a.target}</span>
                            <span className="sf-act-when">{a.when}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="sf-rail-card">
                    <h4>Compliance posture</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <div className="sf-rail-typeRow">
                        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>OSHA recordable rate</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--ok)", fontSize: 13 }}>0.00</span>
                      </div>
                      <div className="sf-rail-typeRow">
                        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Days without lost time</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>184</span>
                      </div>
                      <div className="sf-rail-typeRow">
                        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Toolbox talk completion</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--ok)", fontSize: 13 }}>96%</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/*  CONTRACTOR · DETAIL                                 */}
          {/* ════════════════════════════════════════════════════ */}
          {!isSub && view === "detail" && currentSubmission && (
            <div className="sf-page">
              <div className="sf-page-hdr">
                <div>
                  <button className="sf-btn ghost" onClick={() => setView("workspace")} style={{ marginBottom: 8 }}>
                    {I.back} Back to all submissions
                  </button>
                  <h1 className="sf-page-title">{currentSubmission.title}</h1>
                  <div className="sf-detail-meta">
                    <span className="sf-detail-meta-item" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{currentSubmission.num}</span>
                    <span style={{ color: "var(--border-strong)" }}>·</span>
                    <FormTypeBadge type={currentSubmission.formType} size="sm" />
                    {currentSubmission.severity && <SeverityPill severity={currentSubmission.severity} />}
                    <StatusPill status={currentSubmission.status} />
                  </div>
                </div>
                <div className="sf-page-actions">
                  <button className="sf-btn">{I.download} Export PDF</button>
                  <button className="sf-btn">{I.copy} Duplicate</button>
                  <button className="sf-btn">{I.send} Forward</button>
                </div>
              </div>

              <div className="sf-detail">
                <div className="sf-detail-main">
                  {/* Summary card */}
                  <div className="sf-detail-card">
                    <div className="sf-detail-section">
                      <h3>Submission summary</h3>
                      <div className="sf-detail-row">
                        <span className="sf-detail-key">Submitted by</span>
                        <span className="sf-detail-val">{currentSubmission.submittedBy} · <span style={{ color: "var(--text-secondary)" }}>{currentSubmission.submittedOrg}</span></span>
                      </div>
                      <div className="sf-detail-row">
                        <span className="sf-detail-key">Submitted at</span>
                        <span className="sf-detail-val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}>{currentSubmission.submittedAt}</span>
                      </div>
                      <div className="sf-detail-row">
                        <span className="sf-detail-key">Project</span>
                        <span className="sf-detail-val">Riverside Office Complex</span>
                      </div>
                      <div className="sf-detail-row">
                        <span className="sf-detail-key">Template</span>
                        <span className="sf-detail-val">{templates.find(t => t.id === currentSubmission.templateId)?.name || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Incident-specific blocks (rendered when currentSubmission is the hero incident) */}
                  {currentSubmission.formType === "incident_report" && currentSubmission.id === heroSubmissionId && (
                    <>
                      <div className="sf-detail-card">
                        <div className="sf-detail-section">
                          <h3>Incident details</h3>
                          <div className="sf-detail-row">
                            <span className="sf-detail-key">Severity</span>
                            <span className="sf-detail-val"><SeverityPill severity={heroSubmissionData.severity} /></span>
                          </div>
                          <div className="sf-detail-row">
                            <span className="sf-detail-key">Date & time</span>
                            <span className="sf-detail-val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}>{heroSubmissionData.when}</span>
                          </div>
                          <div className="sf-detail-row">
                            <span className="sf-detail-key">Location</span>
                            <span className="sf-detail-val">{heroSubmissionData.location}</span>
                          </div>
                        </div>

                        <div className="sf-detail-section">
                          <h3>Injured / affected parties</h3>
                          {heroSubmissionData.injured.map((p, i) => (
                            <div key={i} className="sf-injured-card">
                              <div className="sf-injured-card-name">{p.name}</div>
                              <div className="sf-injured-card-role">{p.role}</div>
                              <div className="sf-injured-card-injury">
                                <strong>{p.bodyPart}:</strong> {p.nature}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="sf-detail-section">
                          <h3>What happened</h3>
                          <p className="sf-detail-prose">{heroSubmissionData.description}</p>
                        </div>

                        <div className="sf-detail-section">
                          <h3>Root cause analysis</h3>
                          <p className="sf-detail-prose">{heroSubmissionData.rootCause}</p>
                        </div>

                        <div className="sf-detail-section">
                          <h3>Corrective actions</h3>
                          {heroSubmissionData.corrective.map(ca => (
                            <div key={ca.id} className="sf-action-card">
                              <span className="sf-action-text">{ca.action}</span>
                              <span className="sf-action-owner">{ca.owner}</span>
                              <span className="sf-action-due">due {ca.due}</span>
                            </div>
                          ))}
                        </div>

                        <div className="sf-detail-section">
                          <h3>Photos · {heroSubmissionData.photoCount}</h3>
                          <div className="sf-photo-grid">
                            {Array.from({ length: heroSubmissionData.photoCount }).map((_, i) => (
                              <div key={i} className="sf-photo-tile has-img">
                                {I.camera}
                                <span className="sf-photo-tile-label">IMG_{1234 + i}.jpg</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="sf-detail-section">
                          <h3>Reporter signature</h3>
                          <div className="sf-sig-box">
                            <svg className="sf-sig-box-svg" viewBox="0 0 170 60">
                              <path
                                d="M5 42 Q15 18, 28 32 T 50 30 Q60 25, 68 38 Q72 44, 80 30 T 100 28 Q108 25, 115 36 Q120 42, 130 32 T 158 30"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                fill="none"
                              />
                            </svg>
                            <div className="sf-sig-box-name">{heroSubmissionData.signedBy}</div>
                            <div className="sf-sig-box-when">{heroSubmissionData.signedAt}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Generic non-incident detail card */}
                  {currentSubmission.formType !== "incident_report" && (
                    <div className="sf-detail-card">
                      <div className="sf-detail-section">
                        <h3>Form contents</h3>
                        <div className="sf-detail-row">
                          <span className="sf-detail-key">Topic / scope</span>
                          <span className="sf-detail-val">{currentSubmission.title}</span>
                        </div>
                        {currentSubmission.attendeesCount > 0 && (
                          <div className="sf-detail-row">
                            <span className="sf-detail-key">Attendees</span>
                            <span className="sf-detail-val">{currentSubmission.attendeesCount} crew members signed in</span>
                          </div>
                        )}
                        {currentSubmission.hasPhoto && (
                          <div className="sf-detail-row">
                            <span className="sf-detail-key">Photos</span>
                            <span className="sf-detail-val">1 attached</span>
                          </div>
                        )}
                      </div>
                      <div className="sf-detail-section">
                        <h3>Reporter signature</h3>
                        <div className="sf-sig-box">
                          <svg className="sf-sig-box-svg" viewBox="0 0 170 60">
                            <path d="M5 42 Q22 22, 38 34 T 70 30 Q82 25, 92 38 T 130 32 T 158 30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                          </svg>
                          <div className="sf-sig-box-name">{currentSubmission.submittedBy}</div>
                          <div className="sf-sig-box-when">{currentSubmission.submittedAt}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail rail */}
                <aside className="sf-detail-rail">
                  <div className="sf-rail-card">
                    <h4>{I.bell} Notifications sent</h4>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {currentSubmission.formType === "incident_report" ? (
                        <>
                          <p style={{ margin: "0 0 8px" }}>This incident report triggered immediate alerts to:</p>
                          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                            <li>Dan Carter (Project Admin) — push, email · sent {currentSubmission.submittedAt}</li>
                            <li>Lauren Park (Safety Officer) — email · sent {currentSubmission.submittedAt}</li>
                            <li>Owner contact — email · sent {currentSubmission.submittedAt}</li>
                          </ul>
                        </>
                      ) : (
                        <p style={{ margin: 0 }}>Standard submission — admins notified via daily digest. No immediate alerts triggered.</p>
                      )}
                    </div>
                  </div>

                  <div className="sf-rail-card">
                    <h4>{I.history} Audit trail</h4>
                    <div className="sf-activity">
                      {[
                        { kind: "submit",   text: <><strong>{currentSubmission.submittedBy}</strong> submitted form</>, when: currentSubmission.submittedAt },
                        ...(currentSubmission.formType === "incident_report" ? [{ kind: "alert", text: <><strong>System</strong> notified 3 admins</>, when: currentSubmission.submittedAt }] : []),
                        ...(currentSubmission.id === heroSubmissionId ? [{ kind: "edit", text: <><strong>Dan Carter</strong> added CA-3</>, when: "Apr 21 · 4:05 PM" }] : []),
                      ].map((a, i) => (
                        <div key={i} className="sf-act-row">
                          <span className={`sf-act-dot ${a.kind}`} />
                          <div className="sf-act-text">
                            {a.text}
                            <span className="sf-act-when">{a.when}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="sf-rail-card">
                    <h4>Related submissions</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {submissions
                        .filter(s => s.id !== currentSubmission.id && s.formType === currentSubmission.formType)
                        .slice(0, 3)
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => setSelectedSubmissionId(s.id)}
                            style={{ padding: "9px 11px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                          >
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{s.num}</div>
                            <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 12.5, marginTop: 2, color: "var(--text-primary)" }}>{s.title}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/*  CONTRACTOR · TEMPLATES                              */}
          {/* ════════════════════════════════════════════════════ */}
          {!isSub && view === "templates" && (
            <div className="sf-page">
              <div className="sf-page-hdr">
                <div>
                  <button className="sf-btn ghost" onClick={() => setView("workspace")} style={{ marginBottom: 8 }}>
                    {I.back} Back to submissions
                  </button>
                  <h1 className="sf-page-title">Form templates</h1>
                  <p className="sf-page-sub">The form definitions your crews can complete in the field. Edit fields, mark as required, and assign to projects.</p>
                </div>
                <div className="sf-page-actions">
                  <button className="sf-btn primary">{I.plus} New template</button>
                </div>
              </div>

              <div className="sf-tpl-grid">
                {templates.map(t => {
                  const cfg = formTypes[t.formType];
                  return (
                    <div
                      key={t.id}
                      className="sf-tpl-card"
                      onClick={() => { setSelectedTemplateId(t.id); setView("template-detail"); }}
                    >
                      <div className="sf-tpl-card-hdr">
                        <div className="sf-tpl-card-name">{t.name}</div>
                        <FormTypeBadge type={t.formType} size="sm" />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45, minHeight: 32 }}>
                        {cfg.desc}
                      </div>
                      <div className="sf-tpl-card-meta">
                        <span className="sf-tpl-card-meta-item">{I.fileText} {t.fieldCount} fields</span>
                        <span className="sf-tpl-card-meta-item">{I.refresh} {t.timesUsed} uses</span>
                        <span className="sf-tpl-card-meta-item">{I.clock} {t.updated}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/*  CONTRACTOR · TEMPLATE DETAIL                        */}
          {/* ════════════════════════════════════════════════════ */}
          {!isSub && view === "template-detail" && currentTemplate && (
            <div className="sf-page">
              <div className="sf-page-hdr">
                <div>
                  <button className="sf-btn ghost" onClick={() => setView("templates")} style={{ marginBottom: 8 }}>
                    {I.back} Back to templates
                  </button>
                  <h1 className="sf-page-title">{currentTemplate.name}</h1>
                  <div className="sf-detail-meta">
                    <FormTypeBadge type={currentTemplate.formType} />
                    <span>·</span>
                    <span>{currentTemplate.fieldCount} fields</span>
                    <span>·</span>
                    <span>{currentTemplate.timesUsed} uses</span>
                    <span>·</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>updated {currentTemplate.updated}</span>
                  </div>
                </div>
                <div className="sf-page-actions">
                  <button className="sf-btn">{I.copy} Duplicate</button>
                  <button className="sf-btn">{I.edit} Edit fields</button>
                  <button className="sf-btn primary">{I.send} Assign to project</button>
                </div>
              </div>

              <div className="sf-tpl-detail">
                <div className="sf-tpl-detail-hdr">
                  <div>
                    <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 14, margin: 0, color: "var(--text-primary)", letterSpacing: "-.005em" }}>
                      Field definitions
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
                      These render in mobile order during completion. Drag to reorder, tap to edit.
                    </p>
                  </div>
                </div>

                <div className="sf-tpl-field-list">
                  {currentTemplate.fields.map((f, i) => (
                    <div key={f.key} className="sf-tpl-field">
                      <span className="sf-tpl-field-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="sf-tpl-field-icon">
                        {f.type === "text" && I.fileText}
                        {f.type === "textarea" && I.fileText}
                        {f.type === "select" && I.chevD}
                        {f.type === "checklist" && I.check}
                        {f.type === "datetime" && I.calendar}
                        {f.type === "signature" && I.pen}
                        {f.type === "photo" && I.camera}
                        {(f.type === "attendees" || f.type === "people") && I.users}
                        {f.type === "hazards" && I.warn}
                        {f.type === "actions" && I.flag}
                      </span>
                      <span className="sf-tpl-field-label">{f.label}</span>
                      {f.required && <span className="sf-tpl-field-req">REQUIRED</span>}
                      <span className="sf-tpl-field-type">{f.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/*  SUB · LIST (template picker + recent submissions)   */}
          {/* ════════════════════════════════════════════════════ */}
          {isSub && view === "sub-list" && (
            <div className="sf-page">
              <div className="sf-page-hdr">
                <div>
                  <div className="sf-page-title">Safety forms</div>
                  <div className="sf-page-sub">
                    Riverside Office Complex · Crew lead: <strong>{subUserName}</strong> ({subOrgName})
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div
                    className={`sf-conn-pill${isOnline ? "" : " offline"}`}
                    onClick={() => setIsOnline(!isOnline)}
                    title="Click to toggle (demo)"
                  >
                    {isOnline ? I.cloud : I.cloudOff}
                    {isOnline ? "Online" : "Offline · 1 queued"}
                  </div>
                </div>
              </div>

              <div className="sf-section-hdr">
                <div className="sf-section-title">Start a new form</div>
                <div className="sf-section-sub">Templates assigned to your crew. Click to begin.</div>
              </div>

              <div className="sf-tpl-grid">
                {subAssignedTemplates.map(t => {
                  const cfg = formTypes[t.formType];
                  return (
                    <div
                      key={t.id}
                      className="sf-tpl-card"
                      onClick={() => {
                        setActiveFormTemplateId(t.id);
                        setFormStep(0);
                        setFormData({});
                        setView("sub-form");
                      }}
                    >
                      <div className="sf-tpl-card-hdr">
                        <FormTypeBadge type={t.formType} size="sm" />
                        <span className="sf-tpl-card-time">~{Math.max(1, Math.round(t.fieldCount * 0.7))} min</span>
                      </div>
                      <div className="sf-tpl-card-name">{t.name}</div>
                      <div className="sf-tpl-card-desc">{cfg.desc}</div>
                      <div className="sf-tpl-card-foot">
                        <span>{t.fieldCount} fields</span>
                        <span className="sf-tpl-card-cta">
                          Start {I.chevR}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sf-section-hdr" style={{ marginTop: 24 }}>
                <div className="sf-section-title">Your recent submissions</div>
                <div className="sf-section-sub">Forms you've submitted on this project.</div>
              </div>

              <div className="sf-table-wrap">
                <table className="sf-table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>ID</th>
                      <th>Form</th>
                      <th style={{ width: 140 }}>Type</th>
                      <th style={{ width: 140 }}>Submitted</th>
                      <th style={{ width: 130 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subRecent.map(s => (
                      <tr key={s.id} style={{ cursor: "default" }}>
                        <td><span className="sf-table-num">{s.num}</span></td>
                        <td>
                          <div className="sf-table-title">{s.title}</div>
                          {s.attendeesCount > 0 && (
                            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                              {s.attendeesCount} attendees
                            </div>
                          )}
                        </td>
                        <td><FormTypeBadge type={s.formType} size="sm" /></td>
                        <td style={{ fontSize: 12.5, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono',monospace" }}>{s.submittedAt}</td>
                        <td><StatusPill status={s.status} /></td>
                      </tr>
                    ))}
                    {subRecent.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)", fontSize: 13 }}>
                          No submissions yet. Pick a template above to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/*  SUB · FORM (multi-step wizard, desktop)             */}
          {/* ════════════════════════════════════════════════════ */}
          {isSub && view === "sub-form" && activeTemplate && (() => {
            const currentField = activeFields[formStep];
            if (!currentField) return null;
            const isLast = formStep === totalSteps - 1;
            const cfg = formTypes[activeTemplate.formType];

            return (
              <div className="sf-page">
                <div className="sf-page-hdr">
                  <div>
                    <button
                      className="sf-btn ghost"
                      onClick={() => {
                        if (formStep === 0) { setView("sub-list"); resetSubFlow(); }
                        else { setFormStep(formStep - 1); }
                      }}
                      style={{ marginBottom: 8 }}
                    >
                      {I.back} {formStep === 0 ? "Back to forms" : "Previous step"}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FormTypeBadge type={activeTemplate.formType} size="md" />
                      <div className="sf-page-title" style={{ marginBottom: 0 }}>{activeTemplate.name}</div>
                    </div>
                    <div className="sf-page-sub" style={{ marginTop: 6 }}>
                      Riverside Office Complex · {subUserName}
                    </div>
                  </div>
                  <div
                    className={`sf-conn-pill${isOnline ? "" : " offline"}`}
                    onClick={() => setIsOnline(!isOnline)}
                  >
                    {isOnline ? I.cloud : I.cloudOff}
                    {isOnline ? "Online · auto-saving" : "Offline · saving locally"}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="sf-wiz-prog">
                  <div className="sf-wiz-prog-meta">
                    <span><strong style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 720 }}>Step {formStep + 1}</strong> of {totalSteps}</span>
                    <span>{Math.round(((formStep + (isFieldFilled(currentField) ? 1 : 0)) / totalSteps) * 100)}% complete</span>
                  </div>
                  <div className="sf-wiz-prog-bar">
                    <div
                      className="sf-wiz-prog-fill"
                      style={{
                        width: `${((formStep + (isFieldFilled(currentField) ? 1 : 0)) / totalSteps) * 100}%`,
                        background: cfg.solid,
                      }}
                    />
                  </div>
                </div>

                {/* Two-column wizard layout */}
                <div className="sf-wiz-grid">
                  {/* Left rail — step nav */}
                  <aside className="sf-wiz-rail">
                    <div className="sf-wiz-rail-title">All steps</div>
                    <div className="sf-wiz-rail-list">
                      {activeFields.map((f, idx) => {
                        const filled = isFieldFilled(f);
                        const isCur = idx === formStep;
                        const cls = `sf-wiz-step${isCur ? " current" : ""}${filled && !isCur ? " done" : ""}`;
                        return (
                          <div
                            key={f.key}
                            className={cls}
                            onClick={() => setFormStep(idx)}
                          >
                            <span className="sf-wiz-step-num">
                              {filled && !isCur ? I.check : String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="sf-wiz-step-label">{f.label}</span>
                            {f.required && !filled && <span className="sf-wiz-step-req">•</span>}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  {/* Right — current field card */}
                  <div className="sf-wiz-card">
                    <div className="sf-wiz-card-hdr">
                      <div className="sf-wiz-card-meta">
                        <span>Field {formStep + 1} of {totalSteps}</span>
                        {currentField.required && <span className="sf-wiz-card-req">Required</span>}
                      </div>
                      <div className="sf-wiz-card-label">{currentField.label}</div>
                      {currentField.hint && (
                        <div className="sf-wiz-card-hint">{currentField.hint}</div>
                      )}
                    </div>

                    <div className="sf-wiz-card-body">
                      {/* ── Field type renderers ───────────────────────── */}
                      {currentField.type === "text" && (
                        <input
                          className="sf-mobile-input"
                          type="text"
                          placeholder="Type your answer…"
                          value={formData[currentField.key] || ""}
                          onChange={(e) => updateField(currentField.key, e.target.value)}
                        />
                      )}

                      {currentField.type === "textarea" && (
                        <textarea
                          className="sf-mobile-textarea"
                          placeholder="Type your answer…"
                          value={formData[currentField.key] || ""}
                          onChange={(e) => updateField(currentField.key, e.target.value)}
                        />
                      )}

                      {currentField.type === "datetime" && (
                        <input
                          className="sf-mobile-input"
                          type="datetime-local"
                          value={formData[currentField.key] || ""}
                          onChange={(e) => updateField(currentField.key, e.target.value)}
                        />
                      )}

                      {currentField.type === "select" && (
                        <select
                          className="sf-mobile-select"
                          value={formData[currentField.key] || ""}
                          onChange={(e) => updateField(currentField.key, e.target.value)}
                        >
                          <option value="">Choose…</option>
                          {currentField.options.map(opt => (
                            <option key={opt} value={opt}>
                              {currentField.key === "severity" ? severities[opt]?.label || opt : opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {currentField.type === "checklist" && (
                        <div className="sf-mobile-checklist">
                          {currentField.options.map(opt => {
                            const arr = formData[currentField.key] || [];
                            const isOn = arr.includes(opt);
                            return (
                              <div
                                key={opt}
                                className={`sf-mobile-check${isOn ? " active" : ""}`}
                                onClick={() => {
                                  const next = isOn ? arr.filter(x => x !== opt) : [...arr, opt];
                                  updateField(currentField.key, next);
                                }}
                              >
                                <span className="sf-mobile-check-box">{isOn && I.check}</span>
                                <span className="sf-mobile-check-label">{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Attendees — list of names with sign-in marker */}
                      {currentField.type === "attendees" && (
                        <>
                          {(formData[currentField.key] || []).map((a, i) => (
                            <div key={i} className="sf-mobile-list-row">
                              <span className="sf-mobile-list-num">{String(i + 1).padStart(2, "0")}</span>
                              <span className="sf-mobile-list-text">{a}</span>
                              <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 10, color: "var(--ok)", background: "var(--ok-soft)", padding: "2px 6px", borderRadius: 4, letterSpacing: ".04em" }}>
                                SIGNED IN
                              </span>
                              <button
                                className="sf-mobile-list-x"
                                onClick={() => {
                                  const arr = formData[currentField.key] || [];
                                  updateField(currentField.key, arr.filter((_, idx) => idx !== i));
                                }}
                              >
                                {I.x}
                              </button>
                            </div>
                          ))}
                          <button
                            className="sf-mobile-list-add"
                            onClick={() => {
                              const arr = formData[currentField.key] || [];
                              const sample = ["Marcus Chen", "Tomás Ortega", "Jen Park", "Ben Rodriguez", "Mike Sullivan", "Priya Shah", "Jose Ramirez", "Alex Kim", "Dan Carter"];
                              const next = sample[arr.length % sample.length];
                              updateField(currentField.key, [...arr, next]);
                            }}
                          >
                            {I.plus} Add attendee
                          </button>
                        </>
                      )}

                      {/* People — injured parties (incident report) */}
                      {currentField.type === "people" && (
                        <>
                          {(formData[currentField.key] || []).map((p, i) => (
                            <div key={i} className="sf-injured-card" style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div className="sf-injured-card-name">{p.name || `Person ${i + 1}`}</div>
                                <button
                                  className="sf-mobile-list-x"
                                  onClick={() => {
                                    const arr = formData[currentField.key] || [];
                                    updateField(currentField.key, arr.filter((_, idx) => idx !== i));
                                  }}
                                  style={{ marginTop: -4 }}
                                >
                                  {I.x}
                                </button>
                              </div>
                              <input
                                className="sf-mobile-input"
                                style={{ height: 36, marginTop: 6, fontSize: 13 }}
                                placeholder="Name"
                                value={p.name || ""}
                                onChange={(e) => {
                                  const arr = [...(formData[currentField.key] || [])];
                                  arr[i] = { ...arr[i], name: e.target.value };
                                  updateField(currentField.key, arr);
                                }}
                              />
                              <input
                                className="sf-mobile-input"
                                style={{ height: 36, marginTop: 6, fontSize: 13 }}
                                placeholder="Body part / nature of injury"
                                value={p.injury || ""}
                                onChange={(e) => {
                                  const arr = [...(formData[currentField.key] || [])];
                                  arr[i] = { ...arr[i], injury: e.target.value };
                                  updateField(currentField.key, arr);
                                }}
                              />
                            </div>
                          ))}
                          <button
                            className="sf-mobile-list-add"
                            onClick={() => {
                              const arr = formData[currentField.key] || [];
                              updateField(currentField.key, [...arr, { name: "", injury: "" }]);
                            }}
                          >
                            {I.plus} Add affected person
                          </button>
                        </>
                      )}

                      {/* Hazards — pairs of hazard + control */}
                      {currentField.type === "hazards" && (
                        <>
                          {(formData[currentField.key] || []).map((h, i) => (
                            <div key={i} className="sf-hazard-row">
                              <div className="sf-hazard-row-hdr">
                                <span className="sf-hazard-row-num">Hazard {i + 1}</span>
                                <button
                                  className="sf-mobile-list-x"
                                  onClick={() => {
                                    const arr = formData[currentField.key] || [];
                                    updateField(currentField.key, arr.filter((_, idx) => idx !== i));
                                  }}
                                >
                                  {I.x}
                                </button>
                              </div>
                              <textarea
                                className="sf-mobile-textarea"
                                style={{ minHeight: 50 }}
                                placeholder="Hazard description (e.g., fall from height, energized circuit…)"
                                value={h.hazard || ""}
                                onChange={(e) => {
                                  const arr = [...(formData[currentField.key] || [])];
                                  arr[i] = { ...arr[i], hazard: e.target.value };
                                  updateField(currentField.key, arr);
                                }}
                              />
                              <textarea
                                className="sf-mobile-textarea"
                                style={{ minHeight: 50 }}
                                placeholder="Control measure (e.g., harness + lifeline, LOTO + voltage test…)"
                                value={h.control || ""}
                                onChange={(e) => {
                                  const arr = [...(formData[currentField.key] || [])];
                                  arr[i] = { ...arr[i], control: e.target.value };
                                  updateField(currentField.key, arr);
                                }}
                              />
                            </div>
                          ))}
                          <button
                            className="sf-mobile-list-add"
                            onClick={() => {
                              const arr = formData[currentField.key] || [];
                              updateField(currentField.key, [...arr, { hazard: "", control: "" }]);
                            }}
                          >
                            {I.plus} Add hazard + control
                          </button>
                        </>
                      )}

                      {/* Corrective actions */}
                      {currentField.type === "actions" && (
                        <>
                          {(formData[currentField.key] || []).map((a, i) => (
                            <div key={i} className="sf-hazard-row">
                              <div className="sf-hazard-row-hdr">
                                <span className="sf-hazard-row-num">Action {i + 1}</span>
                                <button
                                  className="sf-mobile-list-x"
                                  onClick={() => {
                                    const arr = formData[currentField.key] || [];
                                    updateField(currentField.key, arr.filter((_, idx) => idx !== i));
                                  }}
                                >
                                  {I.x}
                                </button>
                              </div>
                              <textarea
                                className="sf-mobile-textarea"
                                style={{ minHeight: 50 }}
                                placeholder="Corrective action…"
                                value={a.action || ""}
                                onChange={(e) => {
                                  const arr = [...(formData[currentField.key] || [])];
                                  arr[i] = { ...arr[i], action: e.target.value };
                                  updateField(currentField.key, arr);
                                }}
                              />
                              <div style={{ display: "flex", gap: 7 }}>
                                <input
                                  className="sf-mobile-input"
                                  style={{ height: 38, fontSize: 13, flex: 2 }}
                                  placeholder="Owner"
                                  value={a.owner || ""}
                                  onChange={(e) => {
                                    const arr = [...(formData[currentField.key] || [])];
                                    arr[i] = { ...arr[i], owner: e.target.value };
                                    updateField(currentField.key, arr);
                                  }}
                                />
                                <input
                                  className="sf-mobile-input"
                                  style={{ height: 38, fontSize: 13, flex: 1 }}
                                  type="date"
                                  value={a.due || ""}
                                  onChange={(e) => {
                                    const arr = [...(formData[currentField.key] || [])];
                                    arr[i] = { ...arr[i], due: e.target.value };
                                    updateField(currentField.key, arr);
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            className="sf-mobile-list-add"
                            onClick={() => {
                              const arr = formData[currentField.key] || [];
                              updateField(currentField.key, [...arr, { action: "", owner: "", due: "" }]);
                            }}
                          >
                            {I.plus} Add corrective action
                          </button>
                        </>
                      )}

                      {/* Photo */}
                      {currentField.type === "photo" && (
                        <>
                          <button
                            className="sf-mobile-photo-btn"
                            onClick={() => {
                              const arr = formData[currentField.key] || [];
                              updateField(currentField.key, [...arr, `IMG_${Math.floor(1000 + Math.random() * 9000)}`]);
                            }}
                          >
                            {I.camera} {(formData[currentField.key] || []).length === 0 ? "Take photo" : "Add another photo"}
                          </button>
                          {(formData[currentField.key] || []).length > 0 && (
                            <div className="sf-mobile-photo-thumbs">
                              {(formData[currentField.key] || []).map((p, i) => (
                                <div key={i} className="sf-mobile-photo-thumb" onClick={() => {
                                  const arr = formData[currentField.key] || [];
                                  updateField(currentField.key, arr.filter((_, idx) => idx !== i));
                                }}>
                                  {I.camera}
                                  <span style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.5)", color: "#fff", borderRadius: 4, padding: "1px 4px", fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>
                                    {i + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Signature */}
                      {currentField.type === "signature" && (
                        <SignaturePad
                          value={formData[currentField.key] || false}
                          onChange={(signed) => updateField(currentField.key, signed)}
                          onClear={() => updateField(currentField.key, false)}
                          dark={dark}
                        />
                      )}
                    </div>

                    <div className="sf-wiz-card-foot">
                      <button
                        className="sf-btn"
                        onClick={() => {
                          if (formStep === 0) {
                            setView("sub-list");
                            resetSubFlow();
                          } else {
                            setFormStep(formStep - 1);
                          }
                        }}
                      >
                        {I.chevL} {formStep === 0 ? "Cancel" : "Previous"}
                      </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!isLast && (
                          <button
                            className="sf-btn ghost"
                            onClick={() => setFormStep(formStep + 1)}
                          >
                            Skip for now
                          </button>
                        )}
                        {!isLast && (
                          <button
                            className="sf-btn primary"
                            onClick={() => setFormStep(formStep + 1)}
                            disabled={currentField.required && !isFieldFilled(currentField)}
                          >
                            Next {I.chevR}
                          </button>
                        )}
                        {isLast && (
                          <button
                            className="sf-btn primary"
                            onClick={submitForm}
                            disabled={!canSubmit}
                          >
                            {I.send} Submit form
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ════════════════════════════════════════════════════ */}
          {/*  SUB · DONE                                          */}
          {/* ════════════════════════════════════════════════════ */}
          {isSub && view === "sub-done" && activeTemplate && (
            <div className="sf-page">
              <div className="sf-done-hero">
                <div className="sf-done-hero-icon" style={{ background: isOnline ? "var(--ok-soft)" : "var(--wr-soft)", color: isOnline ? "var(--ok)" : "var(--wr)" }}>
                  {isOnline ? I.check : I.cloudOff}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="sf-done-hero-title">
                    {isOnline ? "Form submitted" : "Saved offline"}
                  </div>
                  <div className="sf-done-hero-sub">
                    {isOnline
                      ? activeTemplate.formType === "incident_report"
                        ? "Project admins were notified immediately. You'll get a copy in your records."
                        : "Submitted to Hammerline Build for review. You'll get a copy in your records."
                      : "Saved to your local queue. The form will sync automatically the next time you have a connection."}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <FormTypeBadge type={activeTemplate.formType} size="md" />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>SF-0045</span>
                    <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>Just now · {subUserName}</span>
                  </div>
                </div>
              </div>

              <div className="sf-done-stat-row">
                <div className="sf-done-stat">
                  <div className="sf-done-stat-key">Form type</div>
                  <div className="sf-done-stat-val">{formTypes[activeTemplate.formType].label}</div>
                </div>
                <div className="sf-done-stat">
                  <div className="sf-done-stat-key">Fields completed</div>
                  <div className="sf-done-stat-val">{totalSteps}</div>
                </div>
                <div className="sf-done-stat">
                  <div className="sf-done-stat-key">Photos attached</div>
                  <div className="sf-done-stat-val">
                    {Object.values(formData).reduce((acc, v) => acc + (Array.isArray(v) && typeof v[0] === "string" && v[0]?.startsWith?.("IMG_") ? v.length : 0), 0)}
                  </div>
                </div>
                <div className="sf-done-stat">
                  <div className="sf-done-stat-key">Signature</div>
                  <div className="sf-done-stat-val" style={{ color: "var(--ok)" }}>Captured</div>
                </div>
              </div>

              {activeTemplate.formType === "incident_report" && (
                <div className="sf-done-alert">
                  <span style={{ display: "inline-flex", color: "var(--er)" }}>{I.alert}</span>
                  <div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13.5, color: "var(--er)" }}>
                      Project admins were alerted
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                      Push notification sent to <strong>Dan Carter (PM)</strong> and <strong>Lauren Park (Safety Officer)</strong>. They'll review and follow up directly.
                    </div>
                  </div>
                </div>
              )}

              <div className="sf-done-next">
                <div className="sf-done-next-title">What happens next</div>
                <div className="sf-done-next-list">
                  <div className="sf-done-next-item">
                    <span className="sf-done-next-dot">1</span>
                    <span>{isOnline ? "Hammerline Build receives your submission and adds it to the project safety log." : "When you're back online, this form will auto-sync and notify Hammerline."}</span>
                  </div>
                  <div className="sf-done-next-item">
                    <span className="sf-done-next-dot">2</span>
                    <span>You'll get a copy in your form history. PDF export is available anytime.</span>
                  </div>
                  {activeTemplate.formType === "incident_report" && (
                    <div className="sf-done-next-item">
                      <span className="sf-done-next-dot">3</span>
                      <span>Corrective actions you logged are tracked until closeout — owners get reminders.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sf-done-actions">
                <button
                  className="sf-btn"
                  onClick={() => {
                    resetSubFlow();
                    setView("sub-list");
                  }}
                >
                  {I.back} Back to forms
                </button>
                <button
                  className="sf-btn primary"
                  onClick={() => {
                    resetSubFlow();
                    setView("sub-list");
                  }}
                >
                  {I.plus} Start another form
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Toast ───────────────────────────────────────────────── */}
      {showSubmittedToast && (
        <div className="sf-toast">
          {I.check} Form submitted successfully
        </div>
      )}

      {/* ── New form modal (placeholder shell, kept simple) ─────── */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 40, display: "grid", placeItems: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, width: 460, maxWidth: "100%", boxShadow: "var(--shadow-lg)" }}
          >
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 760, fontSize: 17, marginBottom: 6, letterSpacing: "-.01em" }}>Start a new form</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.45 }}>
              Pick a template. The form will open in the mobile completion view as if you were a sub on-site.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {templates.slice(0, 5).map(t => (
                <div
                  key={t.id}
                  onClick={() => {
                    setShowCreate(false);
                    setActiveFormTemplateId(t.id);
                    setFormStep(0);
                    setFormData({});
                    setRoleView("subcontractor");
                    setView("sub-form");
                  }}
                  style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface-2)" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 680, fontSize: 13.5 }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{t.fieldCount} fields</div>
                  </div>
                  <FormTypeBadge type={t.formType} size="sm" />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button className="sf-btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal ────────────────────────────────────────── */}
      {showExport && (
        <div
          onClick={() => setShowExport(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 40, display: "grid", placeItems: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, width: 460, maxWidth: "100%", boxShadow: "var(--shadow-lg)" }}
          >
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 760, fontSize: 17, marginBottom: 6, letterSpacing: "-.01em" }}>Export safety form history</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.45 }}>
              Generate a PDF of all safety form submissions for Riverside Office Complex. Useful for audits and project closeout binders.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-secondary)" }}>Total submissions</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>{kpiTotal}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-secondary)" }}>Date range</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>Apr 17 — Apr 22, 2026</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: "var(--text-secondary)" }}>Estimated pages</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>~{kpiTotal * 2 + 4}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="sf-btn ghost" onClick={() => setShowExport(false)}>Cancel</button>
              <button className="sf-btn primary" onClick={() => setShowExport(false)}>{I.download} Generate PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
