import { useState } from "react";

// BuiltCRM — Meetings Module (Contractor + Subcontractor / Phase 5 Commercial GC Parity)
// Step 46 (5.2 #46). Agendas, minutes, attendees, action items.
// Contractor creates/chairs → invites attendees → tracks agenda → records minutes
// → generates action items → open items carry forward to the next meeting on the
// project. Pairs with Phase 7.1 AI agent (Step 56) for audio → minutes transcription.
// Priority P1. Effort S–M.
//
// Schema reference (drizzle_schema_phaseX):
//   meetings               (id, projectId, title, scheduledAt, durationMinutes, status, createdByUserId)
//   meeting_agenda_items   (id, meetingId, orderIndex, title, description, assignedUserId, estimatedMinutes)
//   meeting_attendees      (id, meetingId, userId|orgId, attendedStatus)
//   meeting_minutes        (id, meetingId, content, draftedByUserId, finalizedAt)
//   meeting_action_items   (id, meetingId, description, assignedUserId, dueDate, status, createdAt)

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap";

// ─── Meeting type accent colors (matches construction industry nomenclature) ─
const typeColors = {
  oac:           { solid: "#5b4fc7", soft: "rgba(91,79,199,.12)",   label: "OAC" },         // Owner-Architect-Contractor
  preconstruction:{solid: "#8a5b2a", soft: "rgba(138,91,42,.12)",   label: "Precon" },
  coordination:  { solid: "#2e8a82", soft: "rgba(46,138,130,.12)",  label: "Coord" },       // Subcontractor coordination
  progress:      { solid: "#3878a8", soft: "rgba(56,120,168,.12)",  label: "Progress" },
  safety:        { solid: "#c4700b", soft: "rgba(196,112,11,.12)",  label: "Safety" },
  closeout:      { solid: "#5b7a6a", soft: "rgba(91,122,106,.12)",  label: "Closeout" },
  internal:      { solid: "#6b5d8c", soft: "rgba(107,93,140,.12)",  label: "Internal" },
};

// ─── Meetings (12 mixed-status on Riverside Office Complex — same demo project
//     as the Inspections module so the demo context is continuous) ─────────
const meetings = [
  { id: "mt-1",  num: "MTG-0024", title: "OAC Weekly — Week 14",                type: "oac",            scheduledAt: "Apr 25, 10:00 AM", durationMin: 60, status: "scheduled",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 8,  agendaCount: 7, actionOpenCount: 3, carriedForward: 2 },
  { id: "mt-2",  num: "MTG-0023", title: "Subcontractor Coordination — Floor 2",type: "coordination",   scheduledAt: "Apr 23, 2:00 PM",  durationMin: 45, status: "scheduled",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 6,  agendaCount: 5, actionOpenCount: 0, carriedForward: 0 },
  { id: "mt-3",  num: "MTG-0022", title: "Weekly Progress Review",              type: "progress",       scheduledAt: "Apr 22, 9:00 AM",  durationMin: 30, status: "in_progress",  chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 5,  agendaCount: 4, actionOpenCount: 0, carriedForward: 0, progress: 2 },
  { id: "mt-4",  num: "MTG-0021", title: "OAC Weekly — Week 13",                type: "oac",            scheduledAt: "Apr 18, 10:00 AM", durationMin: 60, status: "completed",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 8,  agendaCount: 6, actionOpenCount: 2, carriedForward: 1, completedAt: "Apr 18, 11:08 AM" },
  { id: "mt-5",  num: "MTG-0020", title: "Safety Stand-down — Falls prevention",type: "safety",         scheduledAt: "Apr 17, 7:00 AM",  durationMin: 20, status: "completed",    chair: "Laura Ng",       chairOrg: "Hammerline Build",  attendeeCount: 24, agendaCount: 3, actionOpenCount: 1, carriedForward: 0, completedAt: "Apr 17, 7:22 AM" },
  { id: "mt-6",  num: "MTG-0019", title: "MEP Coordination — Floor 1 ceiling",  type: "coordination",   scheduledAt: "Apr 16, 3:00 PM",  durationMin: 60, status: "completed",    chair: "Priya Shah",     chairOrg: "Northwest HVAC",    attendeeCount: 5,  agendaCount: 5, actionOpenCount: 0, carriedForward: 0, completedAt: "Apr 16, 4:04 PM" },
  { id: "mt-7",  num: "MTG-0018", title: "OAC Weekly — Week 12",                type: "oac",            scheduledAt: "Apr 11, 10:00 AM", durationMin: 60, status: "completed",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 7,  agendaCount: 6, actionOpenCount: 0, carriedForward: 0, completedAt: "Apr 11, 10:58 AM" },
  { id: "mt-8",  num: "MTG-0017", title: "Preconstruction Review — Phase 2",    type: "preconstruction",scheduledAt: "Apr 09, 1:00 PM",  durationMin: 90, status: "completed",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 10, agendaCount: 8, actionOpenCount: 1, carriedForward: 0, completedAt: "Apr 09, 2:34 PM" },
  { id: "mt-9",  num: "MTG-0016", title: "Framing Pre-pour Walk",               type: "coordination",   scheduledAt: "Apr 08, 8:00 AM",  durationMin: 45, status: "completed",    chair: "Marcus Chen",    chairOrg: "Steel Frame Co.",   attendeeCount: 4,  agendaCount: 3, actionOpenCount: 0, carriedForward: 0, completedAt: "Apr 08, 8:41 AM" },
  { id: "mt-10", num: "MTG-0015", title: "Owner update — April financials",     type: "oac",            scheduledAt: "Apr 04, 3:00 PM",  durationMin: 45, status: "cancelled",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 5,  agendaCount: 4, actionOpenCount: 0, carriedForward: 0, cancelledReason: "Owner unavailable — rolled into Apr 11 OAC" },
  { id: "mt-11", num: "MTG-0025", title: "Closeout readiness check-in",         type: "closeout",       scheduledAt: "Apr 30, 2:00 PM",  durationMin: 60, status: "scheduled",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 6,  agendaCount: 4, actionOpenCount: 0, carriedForward: 0 },
  { id: "mt-12", num: "MTG-0026", title: "Internal — PM sync",                  type: "internal",       scheduledAt: "Apr 24, 4:30 PM",  durationMin: 30, status: "scheduled",    chair: "Dan Carter",     chairOrg: "Hammerline Build",  attendeeCount: 3,  agendaCount: 3, actionOpenCount: 0, carriedForward: 0 },
];

// ─── Agenda items for the demo-hero meeting (MTG-0024 OAC Weekly Week 14) ──
const heroAgenda = [
  { key: "ag-1", orderIndex: 1, title: "Review action items from last OAC",            description: "Walk through 2 open items carried forward from MTG-0021 (Apr 18).",   presenter: "Dan Carter",     presenterOrg: "Hammerline Build",  estMin: 10, carryForward: true },
  { key: "ag-2", orderIndex: 2, title: "Drywall Floor 1 — punch status",                description: "Summit Drywall to report on PI-0234, PI-0235, PI-0236 (auto-gen from INS-0013).",   presenter: "Jose Ramirez",   presenterOrg: "Summit Drywall",    estMin: 8,  carryForward: false },
  { key: "ag-3", orderIndex: 3, title: "MEP above-ceiling sign-off — Floor 1",          description: "Confirm rough-ins complete and cleared for drywall close. Tie to INS-0017 progress.", presenter: "Priya Shah",     presenterOrg: "Northwest HVAC",    estMin: 10, carryForward: false },
  { key: "ag-4", orderIndex: 4, title: "RFI-0047 — Curtain wall attachment clarification", description: "Architect response received Apr 22. Review response and close RFI.",   presenter: "Dan Carter",     presenterOrg: "Hammerline Build",  estMin: 8,  carryForward: false },
  { key: "ag-5", orderIndex: 5, title: "CO-019 — Glazing scope change",                  description: "Owner approved in principle. Confirm cost impact ($18,400) and schedule impact (+3 days).", presenter: "Dan Carter",     presenterOrg: "Hammerline Build",  estMin: 10, carryForward: false },
  { key: "ag-6", orderIndex: 6, title: "Three-week look-ahead",                           description: "Review upcoming milestones: Floor 2 framing complete Apr 29, electrical rough May 2, MEP sign-off May 6.", presenter: "Dan Carter",     presenterOrg: "Hammerline Build",  estMin: 8,  carryForward: false },
  { key: "ag-7", orderIndex: 7, title: "Owner Q&A / AOB",                                description: "",                                                                     presenter: "Owen Bennett",   presenterOrg: "Bennett Capital",   estMin: 6,  carryForward: false },
];

// ─── Attendees for the demo-hero meeting — illustrates full RSVP spread ────
const heroAttendees = [
  { id: "att-1",  name: "Dan Carter",     role: "Project Manager",     org: "Hammerline Build",   scope: "internal",  attendedStatus: "accepted", isChair: true },
  { id: "att-2",  name: "Sarah Mitchell", role: "Architect",           org: "Mitchell Design",    scope: "external",  attendedStatus: "accepted", isChair: false },
  { id: "att-3",  name: "Owen Bennett",   role: "Owner",               org: "Bennett Capital",    scope: "external",  attendedStatus: "accepted", isChair: false },
  { id: "att-4",  name: "Jose Ramirez",   role: "Superintendent",      org: "Summit Drywall",     scope: "sub",       attendedStatus: "accepted", isChair: false },
  { id: "att-5",  name: "Priya Shah",     role: "MEP Coordinator",     org: "Northwest HVAC",     scope: "sub",       attendedStatus: "accepted", isChair: false },
  { id: "att-6",  name: "Ben Rodriguez",  role: "Electrical Foreman",  org: "Coastal Electric",   scope: "sub",       attendedStatus: "tentative",isChair: false },
  { id: "att-7",  name: "Marcus Chen",    role: "Framing Foreman",     org: "Steel Frame Co.",    scope: "sub",       attendedStatus: "declined", isChair: false, declineReason: "Conflicts with Floor 2 framing pour" },
  { id: "att-8",  name: "Laura Ng",       role: "Safety Officer",      org: "Hammerline Build",   scope: "internal",  attendedStatus: "invited",  isChair: false },
];

// ─── Minutes draft for the hero meeting (shown as editor in detail view) ───
const heroMinutesDraft = `Called to order at 10:02 AM. Present: Dan Carter (chair), Sarah Mitchell, Owen Bennett, Jose Ramirez, Priya Shah. Ben Rodriguez joined at 10:06.

Carry-forward items from MTG-0021 reviewed — both items remain in progress but on track. Waiver chasing discussion to continue next week (Dan to follow up with Coastal Electric by EOD Friday).

Drywall punch: Jose confirmed 2 of 3 punch items complete. Crack repair on Rm 103 E wall (PI-0236) pending framing inspection. Will re-walk Monday.

MEP: Priya confirmed HVAC rough above-ceiling on Floor 1 fully complete. Still waiting on Coastal Electric final above-ceiling on three runs. Electrical in progress — expects sign-off Thursday.

[in progress — finalize by EOD]`;

// ─── Action items for hero meeting (mix of new + carried forward) ──────────
const heroActionItems = [
  { id: "ai-1",  description: "Confirm final above-ceiling sign-off for Floor 1 electrical",      assignee: "Ben Rodriguez",   assigneeOrg: "Coastal Electric",  due: "Apr 27", status: "in_progress", origin: "ag-3", carriedFrom: null },
  { id: "ai-2",  description: "Chase Coastal Electric March lien waiver (overdue)",               assignee: "Dan Carter",       assigneeOrg: "Hammerline Build",  due: "Apr 26", status: "open",        origin: "ag-1", carriedFrom: "MTG-0021" },
  { id: "ai-3",  description: "Re-walk drywall PI-0236 after framing verification",               assignee: "Jose Ramirez",    assigneeOrg: "Summit Drywall",    due: "Apr 28", status: "open",        origin: "ag-2", carriedFrom: null },
  { id: "ai-4",  description: "Price glazing change delta and submit formal CO back-up",          assignee: "Dan Carter",       assigneeOrg: "Hammerline Build",  due: "Apr 30", status: "open",        origin: "ag-5", carriedFrom: null },
  { id: "ai-5",  description: "Confirm RFI-0047 closeout with architect and file response",       assignee: "Dan Carter",       assigneeOrg: "Hammerline Build",  due: "Apr 25", status: "open",        origin: "ag-4", carriedFrom: null },
  { id: "ai-6",  description: "Schedule tenant fit-out preconstruction review",                    assignee: "Dan Carter",       assigneeOrg: "Hammerline Build",  due: "May 05", status: "open",        origin: "ag-6", carriedFrom: "MTG-0021" },
];

// ─── Activity feed ─────────────────────────────────────────────────────────
const activity = [
  { who: "Dan Carter",     org: "Hammerline Build",  action: "scheduled meeting",                  target: "MTG-0024 · OAC Weekly — Week 14",  when: "Apr 20 · 4:10 PM", kind: "schedule" },
  { who: "System",         org: "",                  action: "carried forward 2 open action items",target: "from MTG-0021 → MTG-0024",          when: "Apr 20 · 4:10 PM", kind: "carry" },
  { who: "Sarah Mitchell", org: "Mitchell Design",   action: "accepted invitation",                target: "MTG-0024",                          when: "Apr 20 · 5:42 PM", kind: "rsvp" },
  { who: "Marcus Chen",    org: "Steel Frame Co.",   action: "declined invitation",                target: "MTG-0024 · reason provided",        when: "Apr 21 · 9:18 AM", kind: "rsvp" },
  { who: "Priya Shah",     org: "Northwest HVAC",    action: "completed MEP coordination meeting", target: "MTG-0019 · 5 agenda items",         when: "Apr 16 · 4:04 PM", kind: "complete" },
  { who: "Dan Carter",     org: "Hammerline Build",  action: "closed 4 action items",              target: "from MTG-0018",                     when: "Apr 15 · 11:30 AM",kind: "close" },
];

// ─── Meeting type summary (for workspace KPI strip) ────────────────────────
const typeSummary = [
  { type: "oac",             upcoming: 1, completed: 3, actionOpen: 5 },
  { type: "coordination",    upcoming: 1, completed: 2, actionOpen: 0 },
  { type: "progress",        upcoming: 0, completed: 0, actionOpen: 0 },
  { type: "safety",          upcoming: 0, completed: 1, actionOpen: 1 },
  { type: "preconstruction", upcoming: 0, completed: 1, actionOpen: 1 },
  { type: "closeout",        upcoming: 1, completed: 0, actionOpen: 0 },
  { type: "internal",        upcoming: 1, completed: 0, actionOpen: 0 },
];

// ═══════════════════════════════════════════════════════════════════════════
//  ICONS (inline SVG — no emoji per design system)
// ═══════════════════════════════════════════════════════════════════════════
const I = {
  plus:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  dash:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>,
  calendar:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  user:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  list:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  clipboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/></svg>,
  edit:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  mic:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  sparkle:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 14l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z"/><path d="M5 3l.5 1.3 1.3.5-1.3.5L5 6.5l-.5-1.2L3.2 4.8l1.3-.5L5 3z"/></svg>,
  grip:      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>,
  trash:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  filter:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  search:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  chevR:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevL:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevD:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/></svg>,
  more:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  link:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  arrowR:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  phone:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  play:      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  copy:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  mail:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  sun:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  info:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

// ─── Logo mark (cascading rectangles — matches design system spec) ────────
const LogoMark = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <rect x="6" y="6" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity=".6" />
    <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" opacity=".28" />
  </svg>
);

// ─── Format helpers ─────────────────────────────────────────────────────────
const statusLabel = (s) => ({
  scheduled:   "Scheduled",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
}[s] || s);

const rsvpLabel = (s) => ({
  invited:   "Invited",
  accepted:  "Accepted",
  tentative: "Tentative",
  declined:  "Declined",
  attended:  "Attended",
  absent:    "Absent",
}[s] || s);

const initials = (name) => name.split(" ").map(w => w[0]).join("").slice(0, 2);

// ═══════════════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ─── View / role state ────────────────────────────────────────────────
  const [roleView, setRoleView] = useState("contractor");       // contractor | subcontractor
  const [view, setView] = useState("workspace");                // workspace | detail | sub-list | sub-detail
  const [selectedMeetingId, setSelectedMeetingId] = useState("mt-1");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(false);

  // ─── Detail view state (wired edits) ──────────────────────────────────
  const [agendaItems, setAgendaItems] = useState(heroAgenda);
  const [actionItems, setActionItems] = useState(heroActionItems);
  const [minutesText, setMinutesText] = useState(heroMinutesDraft);
  const [attendees, setAttendees] = useState(heroAttendees);
  const [detailTab, setDetailTab] = useState("agenda");         // agenda | attendees | minutes | actions

  // ─── Sub view state ───────────────────────────────────────────────────
  const [subRsvp, setSubRsvp] = useState({});                   // { [meetingId]: "accepted"|"declined"|"tentative" }
  const [subStatusFilter, setSubStatusFilter] = useState("all"); // all | upcoming | awaiting | completed
  const [subSearch, setSubSearch] = useState("");
  const [subDetailTab, setSubDetailTab] = useState("agenda");   // agenda | attendees | minutes | my-actions

  // ─── Create modal state ───────────────────────────────────────────────
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState("oac");
  const [createDuration, setCreateDuration] = useState(60);

  // ─── Derived ──────────────────────────────────────────────────────────
  const currentMeeting = meetings.find(m => m.id === selectedMeetingId);
  const isSub = roleView === "subcontractor";

  // Sub role sees only meetings where their org is invited — demo: Steel Frame Co.
  const subOrgName = "Steel Frame Co.";
  const subUserName = "Marcus Chen";
  // For demo purposes sub is invited to OAC meetings + coordination meetings on this project
  const subInvitedMeetingIds = new Set(["mt-1", "mt-2", "mt-3", "mt-4", "mt-5", "mt-7", "mt-9"]);
  const subMeetings = meetings.filter(m => subInvitedMeetingIds.has(m.id));

  // Action items assigned to the sub across recent meetings (demo data for the "my actions" rail + tab)
  const subMyActionItems = [
    { id: "act-s1", meetingNum: "MTG-0024", meetingTitle: "OAC Weekly — Week 14", description: "Submit revised structural connection detail for Grid C-4", dueDate: "Apr 26", dueStatus: "soon",    status: "open" },
    { id: "act-s2", meetingNum: "MTG-0024", meetingTitle: "OAC Weekly — Week 14", description: "Confirm steel delivery date with supplier",                    dueDate: "Apr 25", dueStatus: "overdue", status: "in_progress" },
    { id: "act-s3", meetingNum: "MTG-0021", meetingTitle: "OAC Weekly — Week 13", description: "Provide erection sequence diagram to GC superintendent",       dueDate: "May 02", dueStatus: "normal",  status: "open" },
    { id: "act-s4", meetingNum: "MTG-0019", meetingTitle: "Trade Coordination — MEP/Structural", description: "Clear conflict with ductwork at Level 3 east bay", dueDate: "Apr 24", dueStatus: "overdue", status: "open" },
    { id: "act-s5", meetingNum: "MTG-0016", meetingTitle: "OAC Weekly — Week 11", description: "Sign off on revised bolt torque spec",                         dueDate: "Apr 10", dueStatus: "normal",  status: "done" },
  ];

  const subVisibleMeetings = subMeetings.filter(m => {
    if (subStatusFilter === "upcoming" && m.status !== "scheduled") return false;
    if (subStatusFilter === "awaiting" && !(m.status === "scheduled" && !subRsvp[m.id])) return false;
    if (subStatusFilter === "completed" && m.status !== "completed") return false;
    if (subSearch && !(m.num.toLowerCase().includes(subSearch.toLowerCase()) ||
                       m.title.toLowerCase().includes(subSearch.toLowerCase()) ||
                       m.chair.toLowerCase().includes(subSearch.toLowerCase()))) return false;
    return true;
  });

  // Sub KPIs
  const subKpiUpcoming   = subMeetings.filter(m => m.status === "scheduled").length;
  const subKpiAwaiting   = subMeetings.filter(m => m.status === "scheduled" && !subRsvp[m.id]).length;
  const subKpiMyActions  = subMyActionItems.filter(a => a.status !== "done").length;
  const subKpiCompleted  = subMeetings.filter(m => m.status === "completed").length;
  const subKpiMyActionsOverdue = subMyActionItems.filter(a => a.status !== "done" && a.dueStatus === "overdue").length;

  // Meetings that have published minutes for the "recent minutes" rail
  const subRecentMinutes = subMeetings.filter(m => m.status === "completed").slice(0, 3);

  const visibleMeetings = meetings.filter(m => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (search && !(m.num.toLowerCase().includes(search.toLowerCase()) ||
                    m.title.toLowerCase().includes(search.toLowerCase()) ||
                    m.chair.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  // Workspace KPIs
  const kpiUpcoming    = meetings.filter(m => m.status === "scheduled").length;
  const kpiInProgress  = meetings.filter(m => m.status === "in_progress").length;
  const kpiCompleted   = meetings.filter(m => m.status === "completed").length;
  const kpiActionOpen  = meetings.reduce((s, m) => s + m.actionOpenCount, 0);
  const kpiCarriedFwd  = meetings.reduce((s, m) => s + m.carriedForward, 0);

  // Hero-meeting derived counts (on the CURRENT STATE of agenda/actions)
  const heroAcceptedCount   = attendees.filter(a => a.attendedStatus === "accepted").length;
  const heroDeclinedCount   = attendees.filter(a => a.attendedStatus === "declined").length;
  const heroTentativeCount  = attendees.filter(a => a.attendedStatus === "tentative").length;
  const heroInvitedCount    = attendees.filter(a => a.attendedStatus === "invited").length;
  const totalEstMinutes     = agendaItems.reduce((s, a) => s + a.estMin, 0);
  const actionOpenHero      = actionItems.filter(a => a.status === "open").length;
  const actionInProgHero    = actionItems.filter(a => a.status === "in_progress").length;
  const actionDoneHero      = actionItems.filter(a => a.status === "done").length;

  // ─── Edit handlers ────────────────────────────────────────────────────
  const updateActionStatus = (id, newStatus) => {
    setActionItems(items => items.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  const removeAgendaItem = (key) => {
    setAgendaItems(items => items.filter(a => a.key !== key).map((a, idx) => ({ ...a, orderIndex: idx + 1 })));
  };

  const addAgendaItem = () => {
    const nextIdx = agendaItems.length + 1;
    setAgendaItems(items => [...items, {
      key: `ag-new-${Date.now()}`,
      orderIndex: nextIdx,
      title: "New agenda item",
      description: "",
      presenter: "Dan Carter",
      presenterOrg: "Hammerline Build",
      estMin: 5,
      carryForward: false,
    }]);
  };

  const moveAgendaItem = (key, direction) => {
    const idx = agendaItems.findIndex(a => a.key === key);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= agendaItems.length) return;
    const next = [...agendaItems];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setAgendaItems(next.map((a, i) => ({ ...a, orderIndex: i + 1 })));
  };

  const updateRsvp = (attId, newStatus) => {
    setAttendees(list => list.map(a => a.id === attId ? { ...a, attendedStatus: newStatus } : a));
  };

  const setSubRsvpFor = (meetingId, status) => {
    setSubRsvp(prev => ({ ...prev, [meetingId]: status }));
  };

  // ─── CSS (light + dark theme, `mt-` prefixed for meetings) ────────────
  const css = `
:root{
  --accent:#5b4fc7;
  --accent-soft:rgba(91,79,199,.1);
  --accent-deep:#4a3fa8;
  --ok:#2d8a5e; --ok-soft:rgba(45,138,94,.12);
  --wr:#c4700b; --wr-soft:rgba(196,112,11,.12);
  --er:#c94545; --er-soft:rgba(201,69,69,.12);
  --info:#3178b9; --info-soft:rgba(49,120,185,.12);
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
.mt-dark{
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
.mt-root{min-height:100vh;background:var(--bg);color:var(--text-primary);font-family:'Instrument Sans',system-ui,sans-serif;font-weight:520;font-size:14px;letter-spacing:-.005em;line-height:1.45;display:flex;flex-direction:column}
.mt-root button{font-family:inherit;color:inherit}
.mt-root input,.mt-root textarea,.mt-root select{font-family:inherit;color:inherit}

/* ── Top bar ───────────────────────────────────────────── */
.mt-topbar{height:56px;background:var(--surface-1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:16px;flex-shrink:0;position:sticky;top:0;z-index:40}
.mt-brand{display:flex;align-items:center;gap:10px;color:var(--accent);font-family:'DM Sans',system-ui,sans-serif;font-weight:740;font-size:15px;letter-spacing:-.02em}
.mt-brand-name{color:var(--text-primary)}
.mt-crumbs{display:flex;align-items:center;gap:8px;color:var(--text-tertiary);font-size:12.5px;font-weight:540}
.mt-crumbs strong{color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:650}
.mt-top-spacer{flex:1}
.mt-role-toggle{display:flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:2px}
.mt-role-toggle button{border:none;background:none;padding:5px 10px;border-radius:6px;font-size:11.5px;font-weight:620;font-family:'DM Sans',sans-serif;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;gap:5px}
.mt-role-toggle button.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.mt-topbtn{width:32px;height:32px;border:none;background:none;border-radius:8px;color:var(--text-secondary);display:grid;place-items:center;cursor:pointer;position:relative}
.mt-topbtn:hover{background:var(--surface-hover);color:var(--text-primary)}
.mt-topbtn-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--er);border:1.5px solid var(--surface-1)}
.mt-user{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;background:var(--surface-2);border:1px solid var(--border);border-radius:20px;cursor:pointer}
.mt-user-avatar{width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:700;font-size:11px}
.mt-user-info{line-height:1.15}
.mt-user-name{font-family:'DM Sans',sans-serif;font-weight:650;font-size:12px;color:var(--text-primary)}
.mt-user-org{font-size:10.5px;color:var(--text-tertiary);font-weight:540}

/* ── Main shell (sidebar + content) ─────────────────────── */
.mt-shell{display:flex;flex:1;min-height:0}
.mt-sidebar{width:220px;background:var(--surface-1);border-right:1px solid var(--border);padding:16px 10px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;overflow-y:auto}
.mt-side-section{font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;letter-spacing:.05em;color:var(--text-tertiary);text-transform:uppercase;padding:10px 10px 6px}
.mt-side-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;font-family:'DM Sans',sans-serif;font-weight:560;font-size:13px;color:var(--text-secondary);cursor:pointer;border:none;background:none;text-align:left;width:100%}
.mt-side-item:hover{background:var(--surface-hover);color:var(--text-primary)}
.mt-side-item.active{background:var(--accent-soft);color:var(--accent);font-weight:650}
.mt-side-count{margin-left:auto;background:var(--surface-3);color:var(--text-secondary);font-size:10.5px;padding:2px 7px;border-radius:10px;font-family:'DM Sans',sans-serif;font-weight:650;letter-spacing:0}
.mt-side-item.active .mt-side-count{background:var(--accent);color:#fff}

.mt-main{flex:1;min-width:0;overflow-y:auto;background:var(--canvas-bg)}
.mt-content{padding:20px 24px;max-width:1480px;margin:0 auto;display:flex;flex-direction:column;gap:18px}

/* ── Page header ─────────────────────────────────────────── */
.mt-page-hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.mt-page-title{font-family:'DM Sans',sans-serif;font-weight:760;font-size:26px;letter-spacing:-.02em;color:var(--text-primary);margin:0}
.mt-page-sub{font-size:13px;color:var(--text-secondary);font-weight:540;margin-top:3px}
.mt-page-actions{display:flex;gap:8px}

/* ── Buttons ─────────────────────────────────────────────── */
.mt-btn{height:34px;padding:0 12px;background:var(--surface-1);border:1px solid var(--border);border-radius:8px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .12s;white-space:nowrap}
.mt-btn:hover{background:var(--surface-hover);border-color:var(--border-strong)}
.mt-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.mt-btn.primary:hover{background:var(--accent-deep)}
.mt-btn.ghost{background:transparent;border-color:transparent}
.mt-btn.ghost:hover{background:var(--surface-hover)}
.mt-btn.danger{color:var(--er);border-color:var(--er-soft)}
.mt-btn.danger:hover{background:var(--er-soft)}
.mt-btn.sm{height:28px;padding:0 10px;font-size:11.5px;border-radius:7px}
.mt-btn.xs{height:24px;padding:0 8px;font-size:11px;border-radius:6px}
.mt-btn.icon{padding:0;width:34px;justify-content:center}
.mt-btn.sm.icon{width:28px}
.mt-btn.xs.icon{width:24px}
.mt-btn.ai{background:linear-gradient(135deg,var(--accent) 0%,#7e72e6 100%);color:#fff;border-color:transparent;position:relative}
.mt-btn.ai:hover{filter:brightness(1.08)}
.mt-btn.ai:disabled,.mt-btn:disabled{opacity:.55;cursor:not-allowed}

/* ── KPI strip ───────────────────────────────────────────── */
.mt-kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.mt-kpi-strip.four{grid-template-columns:repeat(4,1fr)}
.mt-kpi{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}
.mt-kpi-label{font-family:'DM Sans',sans-serif;font-weight:640;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary)}
.mt-kpi-val{font-family:'DM Sans',sans-serif;font-weight:820;font-size:28px;letter-spacing:-.02em;color:var(--text-primary);line-height:1.05}
.mt-kpi-sub{font-size:11px;color:var(--text-secondary);font-weight:540;display:flex;align-items:center;gap:4px}
.mt-kpi-sub.carry{color:var(--wr)}

/* ── Workspace layout (list + side rail) ─────────────────── */
.mt-workspace{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}

/* ── Type summary cards (horizontal strip above list) ────── */
.mt-type-strip{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.mt-type-strip-hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:10px}
.mt-type-strip-hdr h4{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;margin:0;letter-spacing:-.01em}
.mt-type-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.mt-type-card{border:1px solid var(--border);border-radius:9px;padding:9px 11px;display:flex;flex-direction:column;gap:4px;cursor:pointer;transition:all .12s;background:var(--surface-2)}
.mt-type-card:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.mt-type-card.active{border-color:var(--accent);background:var(--accent-soft)}
.mt-type-card-top{display:flex;justify-content:space-between;align-items:center;gap:4px}
.mt-type-card-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:11.5px;color:var(--text-primary)}
.mt-type-card-dot{width:8px;height:8px;border-radius:50%}
.mt-type-card-meta{font-size:10px;color:var(--text-tertiary);font-weight:540}
.mt-type-card-nums{display:flex;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;color:var(--text-primary)}

/* ── Filter row ──────────────────────────────────────────── */
.mt-filter-row{display:flex;align-items:center;gap:10px;margin-bottom:0;flex-wrap:wrap}
.mt-search{position:relative;flex:0 0 260px}
.mt-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}
.mt-search input{width:100%;height:32px;border:1px solid var(--border);border-radius:8px;padding:0 10px 0 30px;background:var(--surface-1);font-size:12.5px;outline:none;font-weight:540}
.mt-search input:focus{border-color:var(--accent)}
.mt-tabs{display:flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px}
.mt-tab{border:none;background:none;padding:5px 10px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;color:var(--text-secondary);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:5px}
.mt-tab:hover{color:var(--text-primary)}
.mt-tab.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.mt-tab-count{background:var(--surface-3);color:var(--text-secondary);font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700}
.mt-tab.active .mt-tab-count{background:var(--accent);color:#fff}

/* ── Meeting list table ──────────────────────────────────── */
.mt-list{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.mt-list-hdr{display:grid;grid-template-columns:110px 1fr 100px 130px 110px 90px 80px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface-2);font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary)}
.mt-row{display:grid;grid-template-columns:110px 1fr 100px 130px 110px 90px 80px;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;align-items:center;transition:all .1s}
.mt-row:hover{background:var(--surface-2)}
.mt-row:last-child{border-bottom:none}
.mt-row-num{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11.5px;color:var(--text-secondary)}
.mt-row-title{font-family:'DM Sans',sans-serif;font-weight:650;font-size:13.5px;color:var(--text-primary);letter-spacing:-.01em;display:flex;align-items:center;gap:6px}
.mt-row-sub{font-size:11.5px;color:var(--text-tertiary);font-weight:540;margin-top:3px;display:flex;align-items:center;gap:6px}
.mt-row-type{display:inline-flex;padding:2px 7px;border-radius:4px;font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:740;letter-spacing:.06em;text-transform:uppercase;align-self:flex-start}
.mt-row-when{font-family:'DM Sans',sans-serif;font-weight:600;font-size:12px;color:var(--text-primary)}
.mt-row-when-sub{font-size:10.5px;color:var(--text-tertiary);font-weight:540;margin-top:2px}
.mt-row-chair{font-family:'DM Sans',sans-serif;font-weight:600;font-size:12px;color:var(--text-primary)}
.mt-row-chair-sub{font-size:10.5px;color:var(--text-tertiary);font-weight:540;margin-top:2px;font-family:'JetBrains Mono',monospace}
.mt-row-status{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:11px;font-family:'DM Sans',sans-serif;font-size:10.5px;font-weight:680;letter-spacing:.01em;align-self:flex-start}
.mt-row-status.scheduled   {background:var(--info-soft);   color:var(--info)}
.mt-row-status.in_progress {background:var(--wr-soft);     color:var(--wr)}
.mt-row-status.completed   {background:var(--ok-soft);     color:var(--ok)}
.mt-row-status.cancelled   {background:var(--na-soft);     color:var(--na)}
.mt-row-status-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.mt-row-count{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:12px;color:var(--text-primary);display:flex;align-items:center;gap:4px}
.mt-row-count.zero{color:var(--text-tertiary)}
.mt-carry-pill{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:4px;background:var(--wr-soft);color:var(--wr);font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:720;letter-spacing:.04em;text-transform:uppercase}

/* ── Workspace side rail (calendar mini + activity) ────── */
.mt-rail{display:flex;flex-direction:column;gap:12px;position:sticky;top:72px}
.mt-rail-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.mt-rail-hdr{padding:12px 14px;border-bottom:1px solid var(--border);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center}
.mt-rail-hdr h4{font-family:'DM Sans',sans-serif;font-weight:700;font-size:12.5px;margin:0;display:flex;align-items:center;gap:6px}

/* Calendar mini */
.mt-cal{padding:10px 14px}
.mt-cal-month{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.mt-cal-month-label{font-family:'DM Sans',sans-serif;font-weight:700;font-size:12.5px}
.mt-cal-nav{display:flex;gap:2px}
.mt-cal-nav button{width:22px;height:22px;border-radius:6px;border:none;background:none;color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
.mt-cal-nav button:hover{background:var(--surface-hover)}
.mt-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.mt-cal-dow{font-family:'DM Sans',sans-serif;font-weight:700;font-size:9px;color:var(--text-tertiary);text-align:center;padding:4px 0;letter-spacing:.04em;text-transform:uppercase}
.mt-cal-day{aspect-ratio:1;font-family:'DM Sans',sans-serif;font-weight:560;font-size:11px;color:var(--text-secondary);display:grid;place-items:center;border-radius:6px;cursor:pointer;position:relative}
.mt-cal-day:hover{background:var(--surface-hover)}
.mt-cal-day.dim{color:var(--text-tertiary);opacity:.4}
.mt-cal-day.today{background:var(--accent-soft);color:var(--accent);font-weight:720}
.mt-cal-day.has-meeting{color:var(--text-primary);font-weight:650}
.mt-cal-day.has-meeting::after{content:"";position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--accent)}
.mt-cal-day.has-meeting.today::after{background:#fff}

.mt-cal-upcoming{padding:0 14px 12px;border-top:1px solid var(--border);margin-top:6px}
.mt-cal-upcoming-hdr{font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em;padding:10px 0 6px}
.mt-cal-upcoming-item{display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--border);cursor:pointer;transition:background .1s}
.mt-cal-upcoming-item:last-child{border-bottom:none}
.mt-cal-upcoming-item:hover .mt-cal-upcoming-title{color:var(--accent)}
.mt-cal-upcoming-date{font-family:'DM Sans',sans-serif;font-weight:720;font-size:10.5px;color:var(--text-tertiary);width:40px;flex-shrink:0;text-transform:uppercase;letter-spacing:.04em;line-height:1.15}
.mt-cal-upcoming-date strong{display:block;font-size:15px;color:var(--text-primary);font-weight:780;letter-spacing:-.02em}
.mt-cal-upcoming-body{flex:1;min-width:0}
.mt-cal-upcoming-title{font-family:'DM Sans',sans-serif;font-weight:640;font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mt-cal-upcoming-meta{font-size:10.5px;color:var(--text-tertiary);font-weight:540;margin-top:1px;display:flex;gap:6px;align-items:center}

/* Activity rail */
.mt-rail-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)}
.mt-rail-item:last-child{border-bottom:none}
.mt-rail-item-avatar{width:26px;height:26px;border-radius:50%;background:var(--surface-3);color:var(--text-secondary);display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:700;font-size:10.5px;flex-shrink:0}
.mt-rail-item-avatar.sys{background:var(--accent);color:#fff}
.mt-rail-item-avatar.carry{background:var(--wr);color:#fff}
.mt-rail-item-body{flex:1;min-width:0}
.mt-rail-item-text{font-size:12px;color:var(--text-primary);line-height:1.4}
.mt-rail-item-text strong{font-family:'DM Sans',sans-serif;font-weight:650}
.mt-rail-item-target{font-size:11px;color:var(--text-secondary);margin-top:2px;font-weight:540}
.mt-rail-item-when{font-size:10.5px;color:var(--text-tertiary);font-weight:540;margin-top:3px}

/* ── Detail view ─────────────────────────────────────────── */
.mt-detail{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.mt-detail-main{display:flex;flex-direction:column;gap:14px}
.mt-detail-hero{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.mt-detail-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.mt-detail-hero-left h2{font-family:'DM Sans',sans-serif;font-weight:780;font-size:22px;letter-spacing:-.02em;margin:0 0 4px}
.mt-detail-hero-meta{display:flex;gap:12px;align-items:center;font-size:12px;color:var(--text-secondary);font-weight:540;flex-wrap:wrap}
.mt-detail-hero-meta strong{font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text-primary)}
.mt-detail-hero-actions{display:flex;gap:8px;flex-shrink:0}

/* Summary strip under detail hero */
.mt-detail-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding-top:12px;border-top:1px solid var(--border)}
.mt-summary-item{display:flex;flex-direction:column;gap:2px}
.mt-summary-label{font-family:'DM Sans',sans-serif;font-weight:640;font-size:10px;letter-spacing:.05em;color:var(--text-tertiary);text-transform:uppercase}
.mt-summary-val{font-family:'DM Sans',sans-serif;font-weight:780;font-size:18px;letter-spacing:-.02em;color:var(--text-primary);line-height:1.05}
.mt-summary-sub{font-size:10.5px;color:var(--text-secondary);font-weight:540}

/* Detail tabs */
.mt-detail-tabs{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.mt-detail-tab-bar{display:flex;background:var(--surface-2);border-bottom:1px solid var(--border);padding:6px 8px;gap:2px}
.mt-detail-tab{border:none;background:none;padding:7px 14px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--text-secondary);border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:6px}
.mt-detail-tab:hover{color:var(--text-primary)}
.mt-detail-tab.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.mt-detail-tab-count{background:var(--surface-3);color:var(--text-secondary);font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700}
.mt-detail-tab.active .mt-detail-tab-count{background:var(--accent);color:#fff}

.mt-detail-tab-body{padding:16px 18px}
.mt-detail-tab-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px}
.mt-detail-tab-hdr h3{font-family:'DM Sans',sans-serif;font-weight:720;font-size:15px;margin:0;letter-spacing:-.01em}

/* ── Agenda list ─────────────────────────────────────────── */
.mt-agenda-list{display:flex;flex-direction:column;gap:8px}
.mt-agenda-row{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);transition:border-color .1s}
.mt-agenda-row:hover{border-color:var(--border-strong)}
.mt-agenda-row.carry{background:var(--wr-soft);border-color:rgba(196,112,11,.3)}
.mt-agenda-grip{color:var(--text-tertiary);cursor:grab;padding-top:2px}
.mt-agenda-grip:active{cursor:grabbing}
.mt-agenda-num{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px;color:var(--text-tertiary);width:22px;padding-top:3px}
.mt-agenda-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.mt-agenda-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mt-agenda-title{font-family:'DM Sans',sans-serif;font-weight:650;font-size:13.5px;color:var(--text-primary)}
.mt-agenda-desc{font-size:12px;color:var(--text-secondary);font-weight:540;line-height:1.4}
.mt-agenda-meta{display:flex;gap:10px;align-items:center;font-size:11px;color:var(--text-tertiary);font-weight:540;margin-top:4px;flex-wrap:wrap}
.mt-agenda-meta-item{display:flex;align-items:center;gap:4px}
.mt-agenda-presenter{font-family:'JetBrains Mono',monospace;color:var(--text-secondary);font-weight:600}
.mt-agenda-est{font-family:'DM Sans',sans-serif;font-weight:650;color:var(--text-primary)}
.mt-agenda-actions{display:flex;flex-direction:column;gap:2px;flex-shrink:0}
.mt-agenda-actions button{width:22px;height:22px;border:none;background:none;border-radius:4px;color:var(--text-tertiary);cursor:pointer;display:grid;place-items:center}
.mt-agenda-actions button:hover{background:var(--surface-3);color:var(--text-primary)}

.mt-agenda-add{margin-top:10px;padding:10px;border:1.5px dashed var(--border);border-radius:10px;text-align:center;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;background:none;width:100%;transition:all .12s}
.mt-agenda-add:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}

.mt-agenda-total{margin-top:10px;padding:10px 12px;background:var(--surface-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:540;color:var(--text-secondary)}
.mt-agenda-total strong{font-family:'DM Sans',sans-serif;font-weight:720;color:var(--text-primary);font-size:13px}
.mt-agenda-total.over strong{color:var(--wr)}

/* ── Attendees list ──────────────────────────────────────── */
.mt-att-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mt-att-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)}
.mt-att-avatar{width:32px;height:32px;border-radius:50%;background:var(--surface-3);color:var(--text-secondary);display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:700;font-size:11.5px;flex-shrink:0;position:relative}
.mt-att-avatar.chair::after{content:"★";position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:var(--accent);color:#fff;font-size:9px;display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:700;border:1.5px solid var(--surface-2)}
.mt-att-body{flex:1;min-width:0}
.mt-att-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:12.5px;color:var(--text-primary)}
.mt-att-role{font-size:11px;color:var(--text-secondary);font-weight:540;margin-top:1px;display:flex;align-items:center;gap:5px}
.mt-att-org{font-family:'JetBrains Mono',monospace;font-weight:500;color:var(--text-tertiary)}
.mt-att-scope{display:inline-flex;padding:1px 5px;border-radius:3px;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:720;letter-spacing:.05em;text-transform:uppercase}
.mt-att-scope.internal{background:var(--accent-soft);color:var(--accent)}
.mt-att-scope.sub{background:rgba(61,107,142,.12);color:#3d6b8e}
.mt-att-scope.external{background:var(--info-soft);color:var(--info)}
.mt-att-rsvp{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:11px;font-family:'DM Sans',sans-serif;font-size:10.5px;font-weight:680;flex-shrink:0}
.mt-att-rsvp.accepted  {background:var(--ok-soft);  color:var(--ok)}
.mt-att-rsvp.declined  {background:var(--er-soft);  color:var(--er)}
.mt-att-rsvp.tentative {background:var(--wr-soft);  color:var(--wr)}
.mt-att-rsvp.invited   {background:var(--na-soft);  color:var(--na)}

.mt-att-decline-note{margin-top:6px;padding:8px 10px;background:var(--er-soft);border-radius:6px;font-size:11.5px;color:var(--er);font-weight:540;display:flex;gap:6px;align-items:flex-start}

/* ── Minutes editor ──────────────────────────────────────── */
.mt-minutes-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:10px}
.mt-minutes-hdr h3{font-family:'DM Sans',sans-serif;font-weight:720;font-size:15px;margin:0}
.mt-minutes-editor{border:1px solid var(--border);border-radius:10px;overflow:hidden}
.mt-minutes-toolbar{display:flex;gap:1px;padding:6px 8px;border-bottom:1px solid var(--border);background:var(--surface-2);align-items:center;flex-wrap:wrap}
.mt-minutes-toolbar-divider{width:1px;height:18px;background:var(--border);margin:0 4px}
.mt-minutes-toolbar-btn{border:none;background:none;padding:4px 8px;border-radius:5px;color:var(--text-secondary);cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;display:flex;align-items:center;gap:5px}
.mt-minutes-toolbar-btn:hover{background:var(--surface-3);color:var(--text-primary)}
.mt-minutes-ta{width:100%;min-height:260px;border:none;background:var(--surface-1);padding:14px 16px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:520;font-size:13.5px;color:var(--text-primary);outline:none;resize:vertical;line-height:1.55}
.mt-minutes-footer{padding:10px 14px;border-top:1px solid var(--border);background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-tertiary);font-weight:540}

.mt-ai-callout{margin-top:12px;padding:12px 14px;border:1px dashed var(--accent);background:var(--accent-soft);border-radius:10px;display:flex;gap:10px;align-items:flex-start}
.mt-ai-callout-icon{width:30px;height:30px;border-radius:7px;background:var(--accent);color:#fff;display:grid;place-items:center;flex-shrink:0}
.mt-ai-callout-body{flex:1;min-width:0}
.mt-ai-callout-title{font-family:'DM Sans',sans-serif;font-weight:720;font-size:12.5px;color:var(--accent)}
.mt-ai-callout-text{font-size:11.5px;color:var(--text-secondary);font-weight:540;margin-top:2px;line-height:1.4}

/* ── Action items table ──────────────────────────────────── */
.mt-actions-table{border:1px solid var(--border);border-radius:10px;overflow:hidden}
.mt-actions-table-hdr{display:grid;grid-template-columns:1fr 160px 90px 120px 32px;padding:8px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);font-family:'DM Sans',sans-serif;font-weight:680;font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em}
.mt-actions-row{display:grid;grid-template-columns:1fr 160px 90px 120px 32px;padding:10px 14px;border-bottom:1px solid var(--border);align-items:center;gap:10px}
.mt-actions-row:last-child{border-bottom:none}
.mt-actions-desc{font-size:12.5px;color:var(--text-primary);font-weight:540;display:flex;flex-direction:column;gap:3px}
.mt-actions-desc-main{display:flex;align-items:center;gap:6px}
.mt-actions-desc-carried{font-size:10.5px;color:var(--wr);font-weight:640;display:flex;align-items:center;gap:4px}
.mt-actions-assignee{display:flex;flex-direction:column;gap:1px;font-size:11.5px}
.mt-actions-assignee-name{font-family:'DM Sans',sans-serif;font-weight:650;color:var(--text-primary)}
.mt-actions-assignee-org{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:10.5px;color:var(--text-tertiary)}
.mt-actions-due{font-family:'DM Sans',sans-serif;font-weight:650;font-size:12px;color:var(--text-primary)}
.mt-actions-status-sel{height:26px;padding:0 24px 0 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-1) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8884' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center;appearance:none;font-size:11.5px;font-weight:620;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer}
.mt-actions-status-sel.open        {color:var(--na)}
.mt-actions-status-sel.in_progress {color:var(--wr)}
.mt-actions-status-sel.done        {color:var(--ok)}

/* ── Sub-portal list (mobile-friendly list of meetings I'm invited to) ─ */
/* Sub-list table — desktop-first (uses shared .mt-list .mt-row) */
.mt-sub-list-hdr{display:grid;grid-template-columns:110px 1fr 100px 140px 160px 100px 40px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface-2);font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary)}
.mt-sub-row{display:grid;grid-template-columns:110px 1fr 100px 140px 160px 100px 40px;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;align-items:center;transition:all .1s}
.mt-sub-row:hover{background:var(--surface-2)}
.mt-sub-row:last-child{border-bottom:none}

/* Inline RSVP pill-group (compact, lives inside row/hero) */
.mt-rsvp-group{display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px}
.mt-rsvp-group-btn{border:none;background:none;padding:4px 9px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11px;color:var(--text-secondary);border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .1s}
.mt-rsvp-group-btn:hover{color:var(--text-primary)}
.mt-rsvp-group-btn.active.accepted  {background:var(--ok-soft);  color:var(--ok);   box-shadow:var(--shadow-sm)}
.mt-rsvp-group-btn.active.tentative {background:var(--wr-soft);  color:var(--wr);   box-shadow:var(--shadow-sm)}
.mt-rsvp-group-btn.active.declined  {background:var(--er-soft);  color:var(--er);   box-shadow:var(--shadow-sm)}
.mt-rsvp-group.pending{border-style:dashed;border-color:var(--wr)}

/* Sub "my actions" rail list */
.mt-sub-action{display:flex;flex-direction:column;gap:3px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}
.mt-sub-action:last-child{border-bottom:none}
.mt-sub-action:hover{background:var(--surface-2)}
.mt-sub-action-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.mt-sub-action-desc{font-size:12px;color:var(--text-primary);line-height:1.4;font-weight:580}
.mt-sub-action-ref{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text-tertiary);font-weight:600;flex-shrink:0}
.mt-sub-action-meta{display:flex;gap:8px;font-size:10.5px;color:var(--text-tertiary);font-weight:540;margin-top:2px}
.mt-sub-action-due.overdue{color:var(--er);font-weight:650}
.mt-sub-action-due.soon{color:var(--wr);font-weight:650}

/* Sub detail — RSVP strip in hero slot */
.mt-hero-rsvp-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.mt-hero-rsvp-label{font-family:'DM Sans',sans-serif;font-weight:640;font-size:10px;letter-spacing:.05em;color:var(--text-tertiary);text-transform:uppercase}

/* Read-only minutes render (sub) */
.mt-minutes-readonly{background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:16px 18px;font-size:13px;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;font-weight:540;max-height:480px;overflow-y:auto}
.mt-minutes-readonly-pending{padding:32px 20px;text-align:center;color:var(--text-tertiary);font-size:13px;font-weight:540;background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:10px}

/* ── Create modal ───────────────────────────────────────── */
.mt-modal-veil{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:grid;place-items:center;padding:20px}
.mt-modal{background:var(--surface-1);border-radius:14px;width:100%;max-width:560px;max-height:85vh;overflow:auto;box-shadow:var(--shadow-lg)}
.mt-modal-hdr{padding:16px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.mt-modal-hdr h3{font-family:'DM Sans',sans-serif;font-weight:740;font-size:16px;margin:0}
.mt-modal-body{padding:18px 22px;display:flex;flex-direction:column;gap:14px}
.mt-modal-field{display:flex;flex-direction:column;gap:5px}
.mt-modal-field label{font-family:'DM Sans',sans-serif;font-weight:640;font-size:11.5px;color:var(--text-secondary);letter-spacing:.01em}
.mt-modal-field input,.mt-modal-field select,.mt-modal-field textarea{height:36px;border:1px solid var(--border);border-radius:8px;padding:0 12px;font-family:inherit;font-size:13px;background:var(--surface-1);color:var(--text-primary);outline:none;font-weight:540}
.mt-modal-field textarea{min-height:60px;padding:8px 12px;resize:vertical}
.mt-modal-field input:focus,.mt-modal-field select:focus,.mt-modal-field textarea:focus{border-color:var(--accent)}
.mt-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mt-modal-type-pick{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.mt-modal-type-opt{padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface-1);display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .12s}
.mt-modal-type-opt:hover{border-color:var(--border-strong)}
.mt-modal-type-opt.active{border-color:var(--accent);background:var(--accent-soft)}
.mt-modal-type-opt-label{font-family:'DM Sans',sans-serif;font-weight:680;font-size:11.5px;color:var(--text-primary)}
.mt-modal-carry-hint{padding:10px 12px;background:var(--wr-soft);border-radius:8px;display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:var(--wr);font-weight:540;line-height:1.4}
.mt-modal-ftr{padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;background:var(--surface-2)}

/* ── Dark toggle ─────────────────────────────────────────── */
.mt-dark-toggle{position:fixed;bottom:18px;right:18px;width:38px;height:38px;border-radius:50%;background:var(--surface-1);border:1px solid var(--border-strong);color:var(--text-primary);font-size:18px;cursor:pointer;z-index:50;box-shadow:var(--shadow-md);display:grid;place-items:center}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width:1280px){
  .mt-workspace,.mt-detail{grid-template-columns:1fr}
  .mt-kpi-strip{grid-template-columns:repeat(3,1fr)}
  .mt-kpi-strip.four{grid-template-columns:repeat(2,1fr)}
  .mt-type-grid{grid-template-columns:repeat(4,1fr)}
  .mt-detail-summary{grid-template-columns:repeat(2,1fr)}
  .mt-att-grid{grid-template-columns:1fr}
}
@media (max-width:960px){
  .mt-sidebar{display:none}
  .mt-type-grid{grid-template-columns:repeat(3,1fr)}
  .mt-list-hdr,.mt-row{grid-template-columns:90px 1fr 110px}
  .mt-list-hdr > :nth-child(n+4),.mt-row > :nth-child(n+4){display:none}
  .mt-sub-list-hdr,.mt-sub-row{grid-template-columns:90px 1fr 130px}
  .mt-sub-list-hdr > :nth-child(n+4),.mt-sub-row > :nth-child(n+4){display:none}
  .mt-actions-table-hdr,.mt-actions-row{grid-template-columns:1fr 110px 90px}
  .mt-actions-table-hdr > :nth-child(n+4),.mt-actions-row > :nth-child(n+4){display:none}
  .mt-hero-rsvp-wrap{align-items:flex-start}
}
@media (max-width:560px){
  .mt-content{padding:16px 14px}
  .mt-kpi-strip{grid-template-columns:1fr 1fr}
  .mt-kpi-strip.four{grid-template-columns:1fr 1fr}
  .mt-page-title{font-size:22px}
  .mt-type-grid{grid-template-columns:repeat(2,1fr)}
}
`;

  // ═════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════
  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{css}</style>
      <div className={`mt-root${dark ? " mt-dark" : ""}`}>
        {/* ─── Top bar ─────────────────────────────────────── */}
        <header className="mt-topbar">
          <div className="mt-brand">
            <LogoMark />
            <span className="mt-brand-name">BuiltCRM</span>
          </div>
          <div className="mt-crumbs">
            <strong>Riverside Office Complex</strong>
            {I.chevR}
            <span>Meetings</span>
          </div>

          <div className="mt-top-spacer" />

          <div className="mt-role-toggle">
            <button
              className={roleView === "contractor" ? "active" : ""}
              onClick={() => { setRoleView("contractor"); setView("workspace"); }}
            >
              Contractor
            </button>
            <button
              className={roleView === "subcontractor" ? "active" : ""}
              onClick={() => { setRoleView("subcontractor"); setView("sub-list"); }}
            >
              {I.phone}Subcontractor
            </button>
          </div>

          <button className="mt-topbtn">
            {I.bell}
            <span className="mt-topbtn-dot" />
          </button>

          <div className="mt-user">
            <div className="mt-user-avatar">{isSub ? "MC" : "DC"}</div>
            <div className="mt-user-info">
              <div className="mt-user-name">{isSub ? subUserName : "Dan Carter"}</div>
              <div className="mt-user-org">{isSub ? subOrgName : "Hammerline Build"}</div>
            </div>
          </div>
        </header>

        <div className="mt-shell">
          {/* ─── Sidebar (contractor only) ───────────────────── */}
          {!isSub && (
            <aside className="mt-sidebar">
              <div className="mt-side-section">Meetings</div>
              <button
                className={`mt-side-item${view === "workspace" ? " active" : ""}`}
                onClick={() => setView("workspace")}
              >
                {I.list} Workspace <span className="mt-side-count">{meetings.length}</span>
              </button>

              <div className="mt-side-section" style={{ marginTop: 10 }}>Status</div>
              <button
                className={`mt-side-item${statusFilter === "all" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("all"); setView("workspace"); }}
              >
                All <span className="mt-side-count">{meetings.length}</span>
              </button>
              <button
                className={`mt-side-item${statusFilter === "scheduled" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("scheduled"); setView("workspace"); }}
              >
                Scheduled <span className="mt-side-count">{kpiUpcoming}</span>
              </button>
              <button
                className={`mt-side-item${statusFilter === "in_progress" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("in_progress"); setView("workspace"); }}
              >
                In Progress <span className="mt-side-count">{kpiInProgress}</span>
              </button>
              <button
                className={`mt-side-item${statusFilter === "completed" && view === "workspace" ? " active" : ""}`}
                onClick={() => { setStatusFilter("completed"); setView("workspace"); }}
              >
                Completed <span className="mt-side-count">{kpiCompleted}</span>
              </button>

              <div className="mt-side-section" style={{ marginTop: 10 }}>Type</div>
              {Object.entries(typeColors).map(([key, cfg]) => {
                const count = meetings.filter(m => m.type === key).length;
                return (
                  <button
                    key={key}
                    className={`mt-side-item${typeFilter === key && view === "workspace" ? " active" : ""}`}
                    onClick={() => { setTypeFilter(typeFilter === key ? "all" : key); setView("workspace"); }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.solid, display: "inline-block" }} />
                    {cfg.label} <span className="mt-side-count">{count}</span>
                  </button>
                );
              })}
            </aside>
          )}

          {/* ─── Main content ────────────────────────────────── */}
          <main className="mt-main">
            <div className="mt-content">

              {/* ═══════════════════════════════════════════════ */}
              {/* VIEW: WORKSPACE (contractor)                    */}
              {/* ═══════════════════════════════════════════════ */}
              {view === "workspace" && !isSub && (
                <>
                  {/* Page header */}
                  <div className="mt-page-hdr">
                    <div>
                      <h1 className="mt-page-title">Meetings</h1>
                      <div className="mt-page-sub">
                        Agendas, minutes, attendees, and action items — {kpiCarriedFwd > 0 && (
                          <><span style={{ color: "var(--wr)", fontWeight: 640 }}>{kpiCarriedFwd} item{kpiCarriedFwd === 1 ? "" : "s"} carried forward</span> to upcoming meetings</>
                        )}{kpiCarriedFwd === 0 && "no open carry-forward items"}.
                      </div>
                    </div>
                    <div className="mt-page-actions">
                      <button className="mt-btn sm" onClick={() => alert("Export CSV of meetings")}>
                        {I.copy} Export
                      </button>
                      <button className="mt-btn primary sm" onClick={() => setShowCreate(true)}>
                        {I.plus} New meeting
                      </button>
                    </div>
                  </div>

                  {/* KPI strip */}
                  <div className="mt-kpi-strip">
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Upcoming</div>
                      <div className="mt-kpi-val">{kpiUpcoming}</div>
                      <div className="mt-kpi-sub">{I.calendar} this project</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">In progress</div>
                      <div className="mt-kpi-val">{kpiInProgress}</div>
                      <div className="mt-kpi-sub">live now</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Completed</div>
                      <div className="mt-kpi-val">{kpiCompleted}</div>
                      <div className="mt-kpi-sub">last 30 days</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Open actions</div>
                      <div className="mt-kpi-val">{kpiActionOpen}</div>
                      <div className="mt-kpi-sub">across meetings</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Carried forward</div>
                      <div className="mt-kpi-val" style={{ color: kpiCarriedFwd > 0 ? "var(--wr)" : undefined }}>{kpiCarriedFwd}</div>
                      <div className="mt-kpi-sub carry">{kpiCarriedFwd > 0 ? "from prior meetings" : "all caught up"}</div>
                    </div>
                  </div>

                  {/* Type summary strip */}
                  <div className="mt-type-strip">
                    <div className="mt-type-strip-hdr">
                      <h4>By meeting type</h4>
                      <button className="mt-btn xs ghost" onClick={() => setTypeFilter("all")}>
                        Clear filter
                      </button>
                    </div>
                    <div className="mt-type-grid">
                      {typeSummary.map(t => {
                        const cfg = typeColors[t.type];
                        return (
                          <div
                            key={t.type}
                            className={`mt-type-card${typeFilter === t.type ? " active" : ""}`}
                            onClick={() => setTypeFilter(typeFilter === t.type ? "all" : t.type)}
                          >
                            <div className="mt-type-card-top">
                              <div className="mt-type-card-name">{cfg.label}</div>
                              <div className="mt-type-card-dot" style={{ background: cfg.solid }} />
                            </div>
                            <div className="mt-type-card-meta">Upcoming / Done</div>
                            <div className="mt-type-card-nums">
                              <span>{t.upcoming}</span>
                              <span style={{ color: "var(--text-tertiary)" }}>/</span>
                              <span>{t.completed}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter row */}
                  <div className="mt-filter-row">
                    <div className="mt-search">
                      {I.search}
                      <input
                        placeholder="Search by number, title, or chair"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-tabs">
                      <button className={`mt-tab${statusFilter === "all" ? " active" : ""}`} onClick={() => setStatusFilter("all")}>
                        All <span className="mt-tab-count">{meetings.length}</span>
                      </button>
                      <button className={`mt-tab${statusFilter === "scheduled" ? " active" : ""}`} onClick={() => setStatusFilter("scheduled")}>
                        Upcoming <span className="mt-tab-count">{kpiUpcoming}</span>
                      </button>
                      <button className={`mt-tab${statusFilter === "in_progress" ? " active" : ""}`} onClick={() => setStatusFilter("in_progress")}>
                        Live <span className="mt-tab-count">{kpiInProgress}</span>
                      </button>
                      <button className={`mt-tab${statusFilter === "completed" ? " active" : ""}`} onClick={() => setStatusFilter("completed")}>
                        Completed <span className="mt-tab-count">{kpiCompleted}</span>
                      </button>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 540 }}>
                      Showing {visibleMeetings.length} of {meetings.length}
                    </div>
                  </div>

                  {/* Two-column layout: list + rail */}
                  <div className="mt-workspace">
                    <div className="mt-list">
                      <div className="mt-list-hdr">
                        <div>Number</div>
                        <div>Meeting</div>
                        <div>Type</div>
                        <div>When</div>
                        <div>Chair</div>
                        <div>Status</div>
                        <div style={{ textAlign: "right" }}>Actions</div>
                      </div>
                      {visibleMeetings.map(m => {
                        const typeCfg = typeColors[m.type];
                        return (
                          <div
                            key={m.id}
                            className="mt-row"
                            onClick={() => { setSelectedMeetingId(m.id); setView("detail"); setDetailTab("agenda"); }}
                          >
                            <div className="mt-row-num">{m.num}</div>
                            <div>
                              <div className="mt-row-title">
                                {m.title}
                                {m.carriedForward > 0 && (
                                  <span className="mt-carry-pill" title={`${m.carriedForward} item(s) carried forward from prior meeting`}>
                                    {I.arrowR} {m.carriedForward}
                                  </span>
                                )}
                              </div>
                              <div className="mt-row-sub">
                                {I.users} {m.attendeeCount} attendees · {m.agendaCount} agenda items
                                {m.actionOpenCount > 0 && (
                                  <> · <span style={{ color: "var(--wr)", fontWeight: 640 }}>{m.actionOpenCount} open action{m.actionOpenCount === 1 ? "" : "s"}</span></>
                                )}
                              </div>
                            </div>
                            <div>
                              <span
                                className="mt-row-type"
                                style={{ background: typeCfg.soft, color: typeCfg.solid }}
                              >
                                {typeCfg.label}
                              </span>
                            </div>
                            <div>
                              <div className="mt-row-when">{m.scheduledAt}</div>
                              <div className="mt-row-when-sub">{m.durationMin} min</div>
                            </div>
                            <div>
                              <div className="mt-row-chair">{m.chair}</div>
                              <div className="mt-row-chair-sub">{m.chairOrg}</div>
                            </div>
                            <div>
                              <span className={`mt-row-status ${m.status}`}>
                                <span className="mt-row-status-dot" />
                                {statusLabel(m.status)}
                              </span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <button
                                className="mt-btn xs ghost icon"
                                onClick={(e) => { e.stopPropagation(); }}
                                title="More"
                              >
                                {I.more}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {visibleMeetings.length === 0 && (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                          No meetings match the current filter.
                        </div>
                      )}
                    </div>

                    {/* Side rail: Calendar mini + Activity */}
                    <aside className="mt-rail">
                      <div className="mt-rail-card">
                        <div className="mt-rail-hdr">
                          <h4>{I.calendar} April 2026</h4>
                          <div className="mt-cal-nav">
                            <button>{I.chevL}</button>
                            <button>{I.chevR}</button>
                          </div>
                        </div>
                        <div className="mt-cal">
                          <div className="mt-cal-grid">
                            {["S","M","T","W","T","F","S"].map((d, i) => (
                              <div key={i} className="mt-cal-dow">{d}</div>
                            ))}
                            {/* Static calendar for April 2026 — starts Wednesday */}
                            {[29,30,31].map(d => <div key={`p${d}`} className="mt-cal-day dim">{d}</div>)}
                            {Array.from({ length: 30 }, (_, i) => i + 1).map(d => {
                              const hasMeeting = [4, 8, 9, 11, 16, 17, 18, 22, 23, 24, 25, 30].includes(d);
                              const isToday = d === 22;
                              return (
                                <div
                                  key={d}
                                  className={`mt-cal-day${isToday ? " today" : ""}${hasMeeting ? " has-meeting" : ""}`}
                                >
                                  {d}
                                </div>
                              );
                            })}
                            {[1,2,3].map(d => <div key={`n${d}`} className="mt-cal-day dim">{d}</div>)}
                          </div>
                          <div className="mt-cal-upcoming">
                            <div className="mt-cal-upcoming-hdr">Next up</div>
                            {meetings.filter(m => m.status === "scheduled").slice(0, 3).map(m => {
                              const [monDay, time] = m.scheduledAt.split(",");
                              const [mon, day] = monDay.split(" ");
                              return (
                                <div
                                  key={m.id}
                                  className="mt-cal-upcoming-item"
                                  onClick={() => { setSelectedMeetingId(m.id); setView("detail"); setDetailTab("agenda"); }}
                                >
                                  <div className="mt-cal-upcoming-date">
                                    {mon}<strong>{day}</strong>
                                  </div>
                                  <div className="mt-cal-upcoming-body">
                                    <div className="mt-cal-upcoming-title">{m.title}</div>
                                    <div className="mt-cal-upcoming-meta">
                                      {I.clock}{time?.trim()} · {m.durationMin}m · {m.attendeeCount} inv.
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-rail-card">
                        <div className="mt-rail-hdr">
                          <h4>{I.clock} Recent activity</h4>
                        </div>
                        {activity.map((a, idx) => (
                          <div key={idx} className="mt-rail-item">
                            <div className={`mt-rail-item-avatar${a.who === "System" ? " sys" : ""}${a.kind === "carry" ? " carry" : ""}`}>
                              {a.who === "System" ? (a.kind === "carry" ? I.arrowR : "S") : initials(a.who)}
                            </div>
                            <div className="mt-rail-item-body">
                              <div className="mt-rail-item-text">
                                <strong>{a.who}</strong> {a.action}
                              </div>
                              {a.target && <div className="mt-rail-item-target">{a.target}</div>}
                              <div className="mt-rail-item-when">{a.when}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════ */}
              {/* VIEW: DETAIL (contractor)                       */}
              {/* ═══════════════════════════════════════════════ */}
              {view === "detail" && !isSub && currentMeeting && (() => {
                const typeCfg = typeColors[currentMeeting.type];
                return (
                  <>
                    <div className="mt-page-hdr">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button className="mt-btn sm ghost" onClick={() => setView("workspace")}>
                          {I.back} Back
                        </button>
                        <div className="mt-crumbs">
                          <span>Meetings</span>
                          {I.chevR}
                          <strong>{currentMeeting.num}</strong>
                        </div>
                      </div>
                      <div className="mt-page-actions">
                        <button className="mt-btn sm">{I.copy} Duplicate</button>
                        <button className="mt-btn sm">{I.mail} Send reminder</button>
                        <button className="mt-btn sm ghost icon" title="More">{I.more}</button>
                      </div>
                    </div>

                    <div className="mt-detail">
                      <div className="mt-detail-main">
                        {/* Hero summary */}
                        <div className="mt-detail-hero">
                          <div className="mt-detail-hero-top">
                            <div className="mt-detail-hero-left">
                              <h2>{currentMeeting.title}</h2>
                              <div className="mt-detail-hero-meta">
                                <span className="mt-row-type" style={{ background: typeCfg.soft, color: typeCfg.solid }}>
                                  {typeCfg.label}
                                </span>
                                <span className={`mt-row-status ${currentMeeting.status}`}>
                                  <span className="mt-row-status-dot" />
                                  {statusLabel(currentMeeting.status)}
                                </span>
                                <span>·</span>
                                <span>{I.calendar}</span>
                                <strong>{currentMeeting.scheduledAt}</strong>
                                <span>·</span>
                                <span>{I.clock} {currentMeeting.durationMin} min</span>
                                <span>·</span>
                                <span>Chaired by <strong>{currentMeeting.chair}</strong></span>
                              </div>
                            </div>
                            <div className="mt-detail-hero-actions">
                              {currentMeeting.status === "scheduled" && (
                                <button className="mt-btn primary sm">{I.play} Start meeting</button>
                              )}
                              {currentMeeting.status === "in_progress" && (
                                <button className="mt-btn primary sm">{I.check} Complete</button>
                              )}
                              {currentMeeting.status === "completed" && (
                                <button className="mt-btn sm">{I.copy} Schedule next</button>
                              )}
                            </div>
                          </div>

                          <div className="mt-detail-summary">
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Agenda items</div>
                              <div className="mt-summary-val">{agendaItems.length}</div>
                              <div className="mt-summary-sub">{totalEstMinutes} min estimated · {totalEstMinutes > currentMeeting.durationMin ? <span style={{ color: "var(--wr)" }}>over budget</span> : "within budget"}</div>
                            </div>
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Attendees</div>
                              <div className="mt-summary-val">{attendees.length}</div>
                              <div className="mt-summary-sub">{heroAcceptedCount} accepted · {heroDeclinedCount} declined · {heroTentativeCount + heroInvitedCount} pending</div>
                            </div>
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Action items</div>
                              <div className="mt-summary-val">{actionItems.length}</div>
                              <div className="mt-summary-sub">
                                <span style={{ color: "var(--na)" }}>{actionOpenHero} open</span> · <span style={{ color: "var(--wr)" }}>{actionInProgHero} active</span> · <span style={{ color: "var(--ok)" }}>{actionDoneHero} done</span>
                              </div>
                            </div>
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Carry-forward</div>
                              <div className="mt-summary-val" style={{ color: currentMeeting.carriedForward > 0 ? "var(--wr)" : undefined }}>
                                {currentMeeting.carriedForward}
                              </div>
                              <div className="mt-summary-sub">
                                {currentMeeting.carriedForward > 0 ? "from prior OAC" : "none"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Tabbed content */}
                        <div className="mt-detail-tabs">
                          <div className="mt-detail-tab-bar">
                            <button className={`mt-detail-tab${detailTab === "agenda" ? " active" : ""}`} onClick={() => setDetailTab("agenda")}>
                              {I.list} Agenda <span className="mt-detail-tab-count">{agendaItems.length}</span>
                            </button>
                            <button className={`mt-detail-tab${detailTab === "attendees" ? " active" : ""}`} onClick={() => setDetailTab("attendees")}>
                              {I.users} Attendees <span className="mt-detail-tab-count">{attendees.length}</span>
                            </button>
                            <button className={`mt-detail-tab${detailTab === "minutes" ? " active" : ""}`} onClick={() => setDetailTab("minutes")}>
                              {I.edit} Minutes
                            </button>
                            <button className={`mt-detail-tab${detailTab === "actions" ? " active" : ""}`} onClick={() => setDetailTab("actions")}>
                              {I.clipboard} Action items <span className="mt-detail-tab-count">{actionItems.length}</span>
                            </button>
                          </div>

                          <div className="mt-detail-tab-body">
                            {/* ── TAB: AGENDA ─────────────────── */}
                            {detailTab === "agenda" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Agenda</h3>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="mt-btn xs ghost">{I.copy} Copy from prior</button>
                                  </div>
                                </div>

                                <div className="mt-agenda-list">
                                  {agendaItems.map((a, idx) => (
                                    <div key={a.key} className={`mt-agenda-row${a.carryForward ? " carry" : ""}`}>
                                      <div className="mt-agenda-grip">{I.grip}</div>
                                      <div className="mt-agenda-num">{a.orderIndex}.</div>
                                      <div className="mt-agenda-body">
                                        <div className="mt-agenda-title-row">
                                          <span className="mt-agenda-title">{a.title}</span>
                                          {a.carryForward && (
                                            <span className="mt-carry-pill">{I.arrowR} Carried forward</span>
                                          )}
                                        </div>
                                        {a.description && <div className="mt-agenda-desc">{a.description}</div>}
                                        <div className="mt-agenda-meta">
                                          <span className="mt-agenda-meta-item">
                                            {I.user}
                                            <span className="mt-agenda-presenter">{a.presenter}</span>
                                            <span style={{ color: "var(--text-tertiary)" }}>· {a.presenterOrg}</span>
                                          </span>
                                          <span className="mt-agenda-meta-item">
                                            {I.clock}
                                            <span className="mt-agenda-est">{a.estMin} min</span>
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-agenda-actions">
                                        <button onClick={() => moveAgendaItem(a.key, "up")} disabled={idx === 0} title="Move up">↑</button>
                                        <button onClick={() => moveAgendaItem(a.key, "down")} disabled={idx === agendaItems.length - 1} title="Move down">↓</button>
                                        <button onClick={() => removeAgendaItem(a.key)} title="Remove">{I.trash}</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <button className="mt-agenda-add" onClick={addAgendaItem}>
                                  {I.plus} Add agenda item
                                </button>

                                <div className={`mt-agenda-total${totalEstMinutes > currentMeeting.durationMin ? " over" : ""}`}>
                                  <span>Estimated total duration</span>
                                  <strong>{totalEstMinutes} of {currentMeeting.durationMin} min scheduled</strong>
                                </div>
                              </>
                            )}

                            {/* ── TAB: ATTENDEES ──────────────── */}
                            {detailTab === "attendees" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Attendees</h3>
                                  <button className="mt-btn xs">{I.plus} Invite</button>
                                </div>

                                <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", fontWeight: 540 }}>
                                  <span>{I.mail}</span>
                                  <span>Invitations sent via email + in-app notification on meeting creation. RSVP deadline: 24 hours before meeting start.</span>
                                </div>

                                <div className="mt-att-grid">
                                  {attendees.map(a => (
                                    <div key={a.id}>
                                      <div className="mt-att-row">
                                        <div className={`mt-att-avatar${a.isChair ? " chair" : ""}`}>
                                          {initials(a.name)}
                                        </div>
                                        <div className="mt-att-body">
                                          <div className="mt-att-name">{a.name}</div>
                                          <div className="mt-att-role">
                                            {a.role}
                                            <span className="mt-att-org">· {a.org}</span>
                                            <span className={`mt-att-scope ${a.scope}`}>{a.scope}</span>
                                          </div>
                                        </div>
                                        <span className={`mt-att-rsvp ${a.attendedStatus}`}>
                                          {a.attendedStatus === "accepted" && I.check}
                                          {a.attendedStatus === "declined" && I.x}
                                          {rsvpLabel(a.attendedStatus)}
                                        </span>
                                      </div>
                                      {a.attendedStatus === "declined" && a.declineReason && (
                                        <div className="mt-att-decline-note">
                                          {I.info}
                                          <span><strong>Reason:</strong> {a.declineReason}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {/* ── TAB: MINUTES ────────────────── */}
                            {detailTab === "minutes" && (
                              <>
                                <div className="mt-minutes-hdr">
                                  <h3>Meeting minutes</h3>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="mt-btn xs ghost">{I.copy} Copy</button>
                                    <button className="mt-btn xs">{I.check} Finalize</button>
                                  </div>
                                </div>

                                <div className="mt-minutes-editor">
                                  <div className="mt-minutes-toolbar">
                                    <button className="mt-minutes-toolbar-btn"><strong>B</strong></button>
                                    <button className="mt-minutes-toolbar-btn"><em>I</em></button>
                                    <button className="mt-minutes-toolbar-btn"><u>U</u></button>
                                    <div className="mt-minutes-toolbar-divider" />
                                    <button className="mt-minutes-toolbar-btn">{I.list} List</button>
                                    <button className="mt-minutes-toolbar-btn">{I.clipboard} Decision</button>
                                    <button className="mt-minutes-toolbar-btn">{I.check} Action</button>
                                    <div className="mt-minutes-toolbar-divider" />
                                    <button className="mt-minutes-toolbar-btn">{I.link} Link to RFI / CO</button>
                                    <div style={{ flex: 1 }} />
                                    <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 540 }}>Auto-saved · just now</span>
                                  </div>

                                  <textarea
                                    className="mt-minutes-ta"
                                    value={minutesText}
                                    onChange={(e) => setMinutesText(e.target.value)}
                                    placeholder="Start typing meeting minutes, or use the AI transcription below once Phase 7.1 ships."
                                  />

                                  <div className="mt-minutes-footer">
                                    <span>Drafted by <strong>Dan Carter</strong> · not yet finalized</span>
                                    <span>{minutesText.length} characters</span>
                                  </div>
                                </div>

                                {/* AI placeholder — wired per Step 46 spec */}
                                <div className="mt-ai-callout">
                                  <div className="mt-ai-callout-icon">{I.sparkle}</div>
                                  <div className="mt-ai-callout-body">
                                    <div className="mt-ai-callout-title">Generate minutes from audio</div>
                                    <div className="mt-ai-callout-text">
                                      Upload a recording or live audio stream and the Minutes Assistant will draft a structured summary with decisions and action items. <strong>Available in Step 56 (Phase 7.1).</strong>
                                    </div>
                                  </div>
                                  <button className="mt-btn ai sm" disabled title="Available in Phase 7.1 (Step 56)">
                                    {I.mic} Upload audio
                                  </button>
                                </div>
                              </>
                            )}

                            {/* ── TAB: ACTION ITEMS ───────────── */}
                            {detailTab === "actions" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Action items</h3>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="mt-btn xs ghost">{I.link} Sync to task list</button>
                                    <button className="mt-btn xs">{I.plus} Add action</button>
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: "10px 12px", background: "var(--wr-soft)", borderRadius: 8, fontSize: 12, color: "var(--wr)", fontWeight: 540 }}>
                                  {I.arrowR}
                                  <span>Open action items on meeting completion will automatically carry forward to the next meeting on this project.</span>
                                </div>

                                <div className="mt-actions-table">
                                  <div className="mt-actions-table-hdr">
                                    <div>Action</div>
                                    <div>Assignee</div>
                                    <div>Due</div>
                                    <div>Status</div>
                                    <div />
                                  </div>
                                  {actionItems.map(a => (
                                    <div key={a.id} className="mt-actions-row">
                                      <div className="mt-actions-desc">
                                        <div className="mt-actions-desc-main">{a.description}</div>
                                        {a.carriedFrom && (
                                          <div className="mt-actions-desc-carried">
                                            {I.arrowR} Carried from {a.carriedFrom}
                                          </div>
                                        )}
                                      </div>
                                      <div className="mt-actions-assignee">
                                        <div className="mt-actions-assignee-name">{a.assignee}</div>
                                        <div className="mt-actions-assignee-org">{a.assigneeOrg}</div>
                                      </div>
                                      <div className="mt-actions-due">{a.due}</div>
                                      <div>
                                        <select
                                          className={`mt-actions-status-sel ${a.status}`}
                                          value={a.status}
                                          onChange={(e) => updateActionStatus(a.id, e.target.value)}
                                        >
                                          <option value="open">Open</option>
                                          <option value="in_progress">In progress</option>
                                          <option value="done">Done</option>
                                        </select>
                                      </div>
                                      <div>
                                        <button className="mt-btn xs ghost icon" title="More">{I.more}</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detail side rail (same activity rail) */}
                      <aside className="mt-rail">
                        <div className="mt-rail-card">
                          <div className="mt-rail-hdr">
                            <h4>{I.clock} Activity</h4>
                          </div>
                          {activity.slice(0, 5).map((a, idx) => (
                            <div key={idx} className="mt-rail-item">
                              <div className={`mt-rail-item-avatar${a.who === "System" ? " sys" : ""}${a.kind === "carry" ? " carry" : ""}`}>
                                {a.who === "System" ? (a.kind === "carry" ? I.arrowR : "S") : initials(a.who)}
                              </div>
                              <div className="mt-rail-item-body">
                                <div className="mt-rail-item-text">
                                  <strong>{a.who}</strong> {a.action}
                                </div>
                                {a.target && <div className="mt-rail-item-target">{a.target}</div>}
                                <div className="mt-rail-item-when">{a.when}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {currentMeeting.status === "cancelled" && currentMeeting.cancelledReason && (
                          <div className="mt-rail-card" style={{ padding: 14 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                              {I.info}
                              <div>
                                <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 12.5, color: "var(--er)" }}>Cancelled</div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 540, marginTop: 3 }}>
                                  {currentMeeting.cancelledReason}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </aside>
                    </div>
                  </>
                );
              })()}

              {/* ═══════════════════════════════════════════════ */}
              {/* VIEW: SUB-LIST (subcontractor — desktop-first)  */}
              {/* ═══════════════════════════════════════════════ */}
              {view === "sub-list" && isSub && (
                <>
                  {/* Page header */}
                  <div className="mt-page-hdr">
                    <div>
                      <h1 className="mt-page-title">Meetings</h1>
                      <div className="mt-page-sub">
                        Meetings {subOrgName} is invited to on Riverside Office Complex — {subKpiAwaiting > 0 ? (
                          <><span style={{ color: "var(--wr)", fontWeight: 640 }}>{subKpiAwaiting} awaiting your RSVP</span></>
                        ) : "all caught up on RSVPs"}.
                      </div>
                    </div>
                    <div className="mt-page-actions">
                      <button className="mt-btn sm" onClick={() => alert("Export iCal of meetings for your team")}>
                        {I.calendar} Add to calendar
                      </button>
                    </div>
                  </div>

                  {/* KPI strip — sub-specific */}
                  <div className="mt-kpi-strip four">
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Upcoming</div>
                      <div className="mt-kpi-val">{subKpiUpcoming}</div>
                      <div className="mt-kpi-sub">{I.calendar} you're invited to</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Awaiting RSVP</div>
                      <div className="mt-kpi-val" style={{ color: subKpiAwaiting > 0 ? "var(--wr)" : undefined }}>{subKpiAwaiting}</div>
                      <div className="mt-kpi-sub">{subKpiAwaiting > 0 ? "respond by meeting start" : "you've replied to all"}</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">My open actions</div>
                      <div className="mt-kpi-val" style={{ color: subKpiMyActionsOverdue > 0 ? "var(--er)" : undefined }}>{subKpiMyActions}</div>
                      <div className="mt-kpi-sub">{subKpiMyActionsOverdue > 0 ? <span style={{ color: "var(--er)" }}>{subKpiMyActionsOverdue} overdue</span> : "across meetings"}</div>
                    </div>
                    <div className="mt-kpi">
                      <div className="mt-kpi-label">Completed</div>
                      <div className="mt-kpi-val">{subKpiCompleted}</div>
                      <div className="mt-kpi-sub">minutes available</div>
                    </div>
                  </div>

                  {/* Filter row */}
                  <div className="mt-filter-row">
                    <div className="mt-search">
                      {I.search}
                      <input
                        placeholder="Search meetings..."
                        value={subSearch}
                        onChange={(e) => setSubSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-tabs">
                      <button className={`mt-tab${subStatusFilter === "all" ? " active" : ""}`} onClick={() => setSubStatusFilter("all")}>
                        All <span className="mt-tab-count">{subMeetings.length}</span>
                      </button>
                      <button className={`mt-tab${subStatusFilter === "upcoming" ? " active" : ""}`} onClick={() => setSubStatusFilter("upcoming")}>
                        Upcoming <span className="mt-tab-count">{subKpiUpcoming}</span>
                      </button>
                      <button className={`mt-tab${subStatusFilter === "awaiting" ? " active" : ""}`} onClick={() => setSubStatusFilter("awaiting")}>
                        Awaiting RSVP <span className="mt-tab-count">{subKpiAwaiting}</span>
                      </button>
                      <button className={`mt-tab${subStatusFilter === "completed" ? " active" : ""}`} onClick={() => setSubStatusFilter("completed")}>
                        Completed <span className="mt-tab-count">{subKpiCompleted}</span>
                      </button>
                    </div>
                  </div>

                  {/* Main + rail grid */}
                  <div className="mt-workspace">
                    {/* Meeting list table */}
                    <div className="mt-list">
                      <div className="mt-sub-list-hdr">
                        <div>#</div>
                        <div>Meeting</div>
                        <div>Type</div>
                        <div>Scheduled</div>
                        <div>Your RSVP</div>
                        <div>Status</div>
                        <div></div>
                      </div>
                      {subVisibleMeetings.map(m => {
                        const typeCfg = typeColors[m.type];
                        const myRsvp = subRsvp[m.id];
                        const showRsvp = m.status === "scheduled";
                        return (
                          <div
                            key={m.id}
                            className="mt-sub-row"
                            onClick={() => { setSelectedMeetingId(m.id); setView("sub-detail"); setSubDetailTab("agenda"); }}
                          >
                            <div className="mt-row-num">{m.num}</div>
                            <div>
                              <div className="mt-row-title">{m.title}</div>
                              <div className="mt-row-sub">
                                {I.user} Chaired by {m.chair} · {m.durationMin} min
                              </div>
                            </div>
                            <div>
                              <span className="mt-row-type" style={{ background: typeCfg.soft, color: typeCfg.solid }}>
                                {typeCfg.label}
                              </span>
                            </div>
                            <div>
                              <div className="mt-row-when">{m.scheduledAt}</div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              {showRsvp ? (
                                <div className={`mt-rsvp-group${!myRsvp ? " pending" : ""}`}>
                                  <button
                                    className={`mt-rsvp-group-btn accepted${myRsvp === "accepted" ? " active" : ""}`}
                                    onClick={() => setSubRsvpFor(m.id, "accepted")}
                                    title="Accept"
                                  >
                                    {I.check}
                                  </button>
                                  <button
                                    className={`mt-rsvp-group-btn tentative${myRsvp === "tentative" ? " active" : ""}`}
                                    onClick={() => setSubRsvpFor(m.id, "tentative")}
                                    title="Tentative"
                                  >
                                    {I.dash}
                                  </button>
                                  <button
                                    className={`mt-rsvp-group-btn declined${myRsvp === "declined" ? " active" : ""}`}
                                    onClick={() => setSubRsvpFor(m.id, "declined")}
                                    title="Decline"
                                  >
                                    {I.x}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 540 }}>—</span>
                              )}
                            </div>
                            <div>
                              <span className={`mt-row-status ${m.status}`}>
                                <span className="mt-row-status-dot" />
                                {statusLabel(m.status)}
                              </span>
                            </div>
                            <div style={{ textAlign: "right", color: "var(--text-tertiary)" }}>
                              {I.chevR}
                            </div>
                          </div>
                        );
                      })}
                      {subVisibleMeetings.length === 0 && (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
                          No meetings match the current filter.
                        </div>
                      )}
                    </div>

                    {/* Side rail: my action items + recent minutes */}
                    <aside className="mt-rail">
                      <div className="mt-rail-card">
                        <div className="mt-rail-hdr">
                          <h4>{I.clipboard} Your open action items</h4>
                          <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 600 }}>{subKpiMyActions} open</span>
                        </div>
                        {subMyActionItems.filter(a => a.status !== "done").map(a => (
                          <div key={a.id} className="mt-sub-action" onClick={() => alert(`Open ${a.meetingNum} → action ${a.id}`)}>
                            <div className="mt-sub-action-top">
                              <div className="mt-sub-action-desc">{a.description}</div>
                              <div className="mt-sub-action-ref">{a.meetingNum}</div>
                            </div>
                            <div className="mt-sub-action-meta">
                              <span>From {a.meetingTitle}</span>
                              <span>·</span>
                              <span className={`mt-sub-action-due ${a.dueStatus}`}>
                                Due {a.dueDate}{a.dueStatus === "overdue" ? " · overdue" : a.dueStatus === "soon" ? " · soon" : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                        {subMyActionItems.filter(a => a.status !== "done").length === 0 && (
                          <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12, fontWeight: 540 }}>
                            No open action items assigned to you.
                          </div>
                        )}
                      </div>

                      {subRecentMinutes.length > 0 && (
                        <div className="mt-rail-card">
                          <div className="mt-rail-hdr">
                            <h4>{I.list} Recently published minutes</h4>
                          </div>
                          {subRecentMinutes.map(m => {
                            const typeCfg = typeColors[m.type];
                            return (
                              <div key={m.id} className="mt-sub-action" onClick={() => { setSelectedMeetingId(m.id); setView("sub-detail"); setSubDetailTab("minutes"); }}>
                                <div className="mt-sub-action-top">
                                  <div className="mt-sub-action-desc">{m.title}</div>
                                  <div className="mt-sub-action-ref">{m.num}</div>
                                </div>
                                <div className="mt-sub-action-meta">
                                  <span className="mt-row-type" style={{ background: typeCfg.soft, color: typeCfg.solid, padding: "1px 5px", fontSize: 9 }}>
                                    {typeCfg.label}
                                  </span>
                                  <span>{m.scheduledAt}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </aside>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════ */}
              {/* VIEW: SUB-DETAIL (subcontractor — read-only)    */}
              {/* ═══════════════════════════════════════════════ */}
              {view === "sub-detail" && isSub && currentMeeting && (() => {
                const typeCfg = typeColors[currentMeeting.type];
                const myRsvp = subRsvp[currentMeeting.id];
                // Action items assigned to the sub, scoped to this meeting (demo)
                const meetingMyActions = subMyActionItems.filter(a => a.meetingNum === currentMeeting.num);
                // If the hero meeting is the one we have full data on (MTG-0024 / mt-1), show real agenda/attendees/minutes; otherwise show a small stand-in.
                const isHeroMeeting = currentMeeting.id === "mt-1";
                const displayAgenda = isHeroMeeting ? agendaItems : agendaItems.slice(0, 4);
                const displayAttendees = isHeroMeeting ? attendees : attendees.slice(0, 5);

                return (
                  <>
                    <div className="mt-page-hdr">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button className="mt-btn sm ghost" onClick={() => setView("sub-list")}>
                          {I.back} Back
                        </button>
                        <div className="mt-crumbs">
                          <span>Meetings</span>
                          {I.chevR}
                          <strong>{currentMeeting.num}</strong>
                        </div>
                      </div>
                      <div className="mt-page-actions">
                        <button className="mt-btn sm" onClick={() => alert(`Add ${currentMeeting.num} to your calendar`)}>
                          {I.calendar} Add to calendar
                        </button>
                      </div>
                    </div>

                    <div className="mt-detail">
                      <div className="mt-detail-main">
                        {/* Hero */}
                        <div className="mt-detail-hero">
                          <div className="mt-detail-hero-top">
                            <div className="mt-detail-hero-left">
                              <h2>{currentMeeting.title}</h2>
                              <div className="mt-detail-hero-meta">
                                <span className="mt-row-type" style={{ background: typeCfg.soft, color: typeCfg.solid }}>
                                  {typeCfg.label}
                                </span>
                                <span className={`mt-row-status ${currentMeeting.status}`}>
                                  <span className="mt-row-status-dot" />
                                  {statusLabel(currentMeeting.status)}
                                </span>
                                <span>·</span>
                                <span>{I.calendar}</span>
                                <strong>{currentMeeting.scheduledAt}</strong>
                                <span>·</span>
                                <span>{I.clock} {currentMeeting.durationMin} min</span>
                                <span>·</span>
                                <span>Chaired by <strong>{currentMeeting.chair}</strong></span>
                              </div>
                            </div>
                            {/* Inline RSVP for scheduled meetings */}
                            {currentMeeting.status === "scheduled" && (
                              <div className="mt-hero-rsvp-wrap">
                                <div className="mt-hero-rsvp-label">Your RSVP</div>
                                <div className={`mt-rsvp-group${!myRsvp ? " pending" : ""}`}>
                                  <button
                                    className={`mt-rsvp-group-btn accepted${myRsvp === "accepted" ? " active" : ""}`}
                                    onClick={() => setSubRsvpFor(currentMeeting.id, "accepted")}
                                  >
                                    {I.check} Accept
                                  </button>
                                  <button
                                    className={`mt-rsvp-group-btn tentative${myRsvp === "tentative" ? " active" : ""}`}
                                    onClick={() => setSubRsvpFor(currentMeeting.id, "tentative")}
                                  >
                                    {I.dash} Tentative
                                  </button>
                                  <button
                                    className={`mt-rsvp-group-btn declined${myRsvp === "declined" ? " active" : ""}`}
                                    onClick={() => setSubRsvpFor(currentMeeting.id, "declined")}
                                  >
                                    {I.x} Decline
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-detail-summary">
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Agenda items</div>
                              <div className="mt-summary-val">{displayAgenda.length}</div>
                              <div className="mt-summary-sub">{displayAgenda.reduce((s, a) => s + a.estMin, 0)} min estimated</div>
                            </div>
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Attendees</div>
                              <div className="mt-summary-val">{displayAttendees.length}</div>
                              <div className="mt-summary-sub">{displayAttendees.filter(a => a.attendedStatus === "accepted").length} accepted</div>
                            </div>
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">My action items</div>
                              <div className="mt-summary-val" style={{ color: meetingMyActions.filter(a => a.dueStatus === "overdue" && a.status !== "done").length > 0 ? "var(--er)" : undefined }}>
                                {meetingMyActions.filter(a => a.status !== "done").length}
                              </div>
                              <div className="mt-summary-sub">{meetingMyActions.length === 0 ? "none assigned to you" : `${meetingMyActions.filter(a => a.status === "done").length} completed`}</div>
                            </div>
                            <div className="mt-summary-item">
                              <div className="mt-summary-label">Minutes</div>
                              <div className="mt-summary-val" style={{ fontSize: 15, fontWeight: 720 }}>
                                {currentMeeting.status === "completed" ? "Published" : currentMeeting.status === "in_progress" ? "Drafting" : "Pending"}
                              </div>
                              <div className="mt-summary-sub">{currentMeeting.status === "completed" ? "by the chair" : currentMeeting.status === "scheduled" ? "after the meeting" : "live now"}</div>
                            </div>
                          </div>
                        </div>

                        {/* Tabbed content (read-only for sub) */}
                        <div className="mt-detail-tabs">
                          <div className="mt-detail-tab-bar">
                            <button className={`mt-detail-tab${subDetailTab === "agenda" ? " active" : ""}`} onClick={() => setSubDetailTab("agenda")}>
                              {I.list} Agenda <span className="mt-detail-tab-count">{displayAgenda.length}</span>
                            </button>
                            <button className={`mt-detail-tab${subDetailTab === "attendees" ? " active" : ""}`} onClick={() => setSubDetailTab("attendees")}>
                              {I.users} Attendees <span className="mt-detail-tab-count">{displayAttendees.length}</span>
                            </button>
                            <button className={`mt-detail-tab${subDetailTab === "minutes" ? " active" : ""}`} onClick={() => setSubDetailTab("minutes")}>
                              {I.edit} Minutes
                            </button>
                            <button className={`mt-detail-tab${subDetailTab === "my-actions" ? " active" : ""}`} onClick={() => setSubDetailTab("my-actions")}>
                              {I.clipboard} My actions <span className="mt-detail-tab-count">{meetingMyActions.length}</span>
                            </button>
                          </div>

                          <div className="mt-detail-tab-body">
                            {/* ── TAB: AGENDA (read-only) ────── */}
                            {subDetailTab === "agenda" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Agenda</h3>
                                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 540 }}>
                                    {displayAgenda.reduce((s, a) => s + a.estMin, 0)} min estimated · read-only
                                  </span>
                                </div>
                                <div className="mt-agenda-list">
                                  {displayAgenda.map(a => (
                                    <div key={a.key} className={`mt-agenda-row${a.carryForward ? " carry" : ""}`}>
                                      <div className="mt-agenda-num">{a.orderIndex}.</div>
                                      <div className="mt-agenda-body">
                                        <div className="mt-agenda-title-row">
                                          <span className="mt-agenda-title">{a.title}</span>
                                          {a.carryForward && <span className="mt-carry-pill">{I.arrowR} Carry-forward</span>}
                                        </div>
                                        {a.description && <div className="mt-agenda-desc">{a.description}</div>}
                                        <div className="mt-agenda-meta">
                                          <span className="mt-agenda-meta-item">
                                            {I.user}
                                            <span className="mt-agenda-presenter">{a.presenter}</span>
                                          </span>
                                          <span className="mt-agenda-meta-item">
                                            {I.clock}
                                            <span className="mt-agenda-est">{a.estMin} min</span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {/* ── TAB: ATTENDEES (read-only) ────── */}
                            {subDetailTab === "attendees" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Attendees</h3>
                                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 540 }}>read-only</span>
                                </div>
                                <div className="mt-att-grid">
                                  {displayAttendees.map(a => (
                                    <div key={a.id}>
                                      <div className="mt-att-row">
                                        <div className={`mt-att-avatar${a.isChair ? " chair" : ""}`}>
                                          {initials(a.name)}
                                        </div>
                                        <div className="mt-att-body">
                                          <div className="mt-att-name">{a.name}</div>
                                          <div className="mt-att-role">
                                            {a.role}
                                            <span className="mt-att-org">· {a.org}</span>
                                            <span className={`mt-att-scope ${a.scope}`}>{a.scope}</span>
                                          </div>
                                        </div>
                                        <span className={`mt-att-rsvp ${a.attendedStatus}`}>
                                          {a.attendedStatus === "accepted" && I.check}
                                          {a.attendedStatus === "declined" && I.x}
                                          {rsvpLabel(a.attendedStatus)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {/* ── TAB: MINUTES (read-only) ────── */}
                            {subDetailTab === "minutes" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Meeting minutes</h3>
                                  {currentMeeting.status === "completed" && (
                                    <button className="mt-btn xs ghost" onClick={() => alert("Export minutes as PDF")}>
                                      {I.copy} Export PDF
                                    </button>
                                  )}
                                </div>
                                {currentMeeting.status === "completed" ? (
                                  <div className="mt-minutes-readonly">{minutesText}</div>
                                ) : currentMeeting.status === "in_progress" ? (
                                  <div className="mt-minutes-readonly-pending">
                                    Minutes are being taken live. They will appear here once the chair finalizes them.
                                  </div>
                                ) : (
                                  <div className="mt-minutes-readonly-pending">
                                    Minutes will be published here after the meeting. You'll receive an email notification when they're available.
                                  </div>
                                )}
                              </>
                            )}

                            {/* ── TAB: MY ACTION ITEMS ────── */}
                            {subDetailTab === "my-actions" && (
                              <>
                                <div className="mt-detail-tab-hdr">
                                  <h3>Action items assigned to {subOrgName}</h3>
                                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 540 }}>
                                    {meetingMyActions.filter(a => a.status !== "done").length} open · {meetingMyActions.filter(a => a.status === "done").length} completed
                                  </span>
                                </div>

                                {meetingMyActions.length === 0 ? (
                                  <div className="mt-minutes-readonly-pending">
                                    No action items from this meeting are assigned to your team.
                                  </div>
                                ) : (
                                  <div className="mt-actions-table">
                                    <div className="mt-actions-table-hdr">
                                      <div>Description</div>
                                      <div>Due</div>
                                      <div>Status</div>
                                      <div>Carried from</div>
                                    </div>
                                    {meetingMyActions.map(a => (
                                      <div key={a.id} className="mt-actions-row">
                                        <div className="mt-actions-desc">{a.description}</div>
                                        <div className={`mt-actions-due ${a.dueStatus === "overdue" ? "overdue" : ""}`}>
                                          {a.dueDate}{a.dueStatus === "overdue" && " · overdue"}{a.dueStatus === "soon" && " · soon"}
                                        </div>
                                        <div>
                                          <select
                                            className={`mt-actions-status-select ${a.status}`}
                                            value={a.status}
                                            onChange={(e) => alert(`Would notify GC: action ${a.id} → ${e.target.value}`)}
                                          >
                                            <option value="open">Open</option>
                                            <option value="in_progress">In progress</option>
                                            <option value="done">Done</option>
                                          </select>
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 540 }}>—</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Side rail on detail */}
                      <aside className="mt-rail">
                        <div className="mt-rail-card">
                          <div className="mt-rail-hdr">
                            <h4>{I.info} Your role</h4>
                          </div>
                          <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)", fontWeight: 540, lineHeight: 1.55 }}>
                            You're viewing this meeting as <strong style={{ color: "var(--text-primary)", fontFamily: "'DM Sans'", fontWeight: 650 }}>{subUserName}</strong> from <strong style={{ color: "var(--text-primary)", fontFamily: "'DM Sans'", fontWeight: 650 }}>{subOrgName}</strong>. You can RSVP, read the agenda and minutes, and update the status of action items assigned to your team. Only the chair can edit meeting details.
                          </div>
                        </div>

                        {currentMeeting.status === "scheduled" && (
                          <div className="mt-rail-card">
                            <div className="mt-rail-hdr">
                              <h4>{I.calendar} Before the meeting</h4>
                            </div>
                            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-secondary)", fontWeight: 540 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ color: "var(--ok)", marginTop: 2 }}>{I.check}</span>
                                <span>Review the agenda above</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ color: myRsvp ? "var(--ok)" : "var(--text-tertiary)", marginTop: 2 }}>{myRsvp ? I.check : I.dash}</span>
                                <span>RSVP {myRsvp ? `(${rsvpLabel(myRsvp)})` : "— pending"}</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ color: "var(--text-tertiary)", marginTop: 2 }}>{I.dash}</span>
                                <span>Close out overdue action items from prior meetings</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentMeeting.status === "completed" && (
                          <div className="mt-rail-card">
                            <div className="mt-rail-hdr">
                              <h4>{I.sparkle} Follow-up</h4>
                            </div>
                            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)", fontWeight: 540, lineHeight: 1.55 }}>
                              {meetingMyActions.filter(a => a.status !== "done").length > 0 ? (
                                <>You have <strong style={{ color: "var(--wr)" }}>{meetingMyActions.filter(a => a.status !== "done").length} open action item{meetingMyActions.filter(a => a.status !== "done").length === 1 ? "" : "s"}</strong> from this meeting. Update status as you make progress.</>
                              ) : (
                                <>No outstanding action items from this meeting.</>
                              )}
                            </div>
                          </div>
                        )}
                      </aside>
                    </div>
                  </>
                );
              })()}
            </div>
          </main>
        </div>

        {/* ─── Create meeting modal ──────────────────────────── */}
        {showCreate && (
          <div className="mt-modal-veil" onClick={() => setShowCreate(false)}>
            <div className="mt-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mt-modal-hdr">
                <h3>New meeting</h3>
                <button className="mt-btn xs ghost icon" onClick={() => setShowCreate(false)}>{I.x}</button>
              </div>
              <div className="mt-modal-body">
                <div className="mt-modal-field">
                  <label>Title</label>
                  <input
                    placeholder="e.g. OAC Weekly — Week 15"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                  />
                </div>

                <div className="mt-modal-field">
                  <label>Meeting type</label>
                  <div className="mt-modal-type-pick">
                    {Object.entries(typeColors).map(([key, cfg]) => (
                      <div
                        key={key}
                        className={`mt-modal-type-opt${createType === key ? " active" : ""}`}
                        onClick={() => setCreateType(key)}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.solid }} />
                        <div className="mt-modal-type-opt-label">{cfg.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-modal-grid">
                  <div className="mt-modal-field">
                    <label>Scheduled date & time</label>
                    <input type="datetime-local" defaultValue="2026-04-25T10:00" />
                  </div>
                  <div className="mt-modal-field">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      value={createDuration}
                      onChange={(e) => setCreateDuration(Number(e.target.value))}
                      min="15"
                      step="15"
                    />
                  </div>
                </div>

                <div className="mt-modal-field">
                  <label>Invite attendees</label>
                  <input placeholder="Search project members or external contacts…" />
                </div>

                {/* Carry-forward hint if OAC type */}
                {(createType === "oac" || createType === "coordination") && (
                  <div className="mt-modal-carry-hint">
                    {I.arrowR}
                    <span>
                      Open action items from the last <strong>{typeColors[createType].label}</strong> meeting on this project will carry forward to the new meeting's agenda automatically.
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-modal-ftr">
                <button className="mt-btn sm ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="mt-btn sm">Save as draft</button>
                <button
                  className="mt-btn primary sm"
                  onClick={() => {
                    // Wired: in production this would create the meeting + send invites.
                    alert(`Meeting created: "${createTitle || "Untitled"}" (${typeColors[createType].label}, ${createDuration} min). Invites will be sent to selected attendees.`);
                    setShowCreate(false);
                    setCreateTitle("");
                  }}
                >
                  {I.mail} Create & send invites
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Dark mode toggle ──────────────────────────────── */}
        <button className="mt-dark-toggle" onClick={() => setDark(d => !d)} title="Toggle dark mode">
          {dark ? I.sun : I.moon}
        </button>
      </div>
    </>
  );
}
