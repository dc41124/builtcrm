// ═══════════════════════════════════════════════════════════════════════════
//  BuiltCRM — Step 53 (Phase 6 #53): Subcontractor Time Tracking
//  ────────────────────────────────────────────────────────────────────────
//  Worker view  : Today (clock in/out), My Timesheet (week grid + submit)
//  Admin view   : Team (all workers, approvals), Worker Detail (drill-down)
//  Modes        : Live running timer, GPS opt-in, online/offline toggle (PWA)
//  Demo context : Steel Frame Co. on Riverside Office Complex
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from "react";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;540;560;600;620;640;660;680;700;720;740;760;780;800;820&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap";

// ─── CONFIG / DEMO CONTEXT ──────────────────────────────────────────────────
const subOrgName = "Steel Frame Co.";
const currentUserId = "u-marcus";

const projects = [
  { id: "p-river",     name: "Riverside Office Complex",  short: "Riverside",  contractor: "Hammerline Build",   color: "#5b4fc7" },
  { id: "p-westend",   name: "West End Medical",           short: "West End",   contractor: "Vanguard GC",        color: "#3878a8" },
  { id: "p-northline", name: "Northline Office Park",      short: "Northline",  contractor: "Coastline Builders", color: "#2d8a5e" },
];

const tasks = [
  { id: "t-fl4-deck",   projectId: "p-river",     name: "Floor 4 deck install",        code: "RIV-T-014" },
  { id: "t-east-rough", projectId: "p-river",     name: "East corridor rough-in",      code: "RIV-T-021" },
  { id: "t-fl3-cleanup",projectId: "p-river",     name: "Floor 3 cleanup",             code: "RIV-T-019" },
  { id: "t-panel-room", projectId: "p-westend",   name: "Panel room work",             code: "WE-T-008" },
  { id: "t-rfi-019",    projectId: "p-westend",   name: "RFI-019 conduit routing",     code: "WE-T-011" },
  { id: "t-frame-rough",projectId: "p-northline", name: "Structural framing prep",     code: "NL-T-003" },
];

const workers = [
  { id: "u-marcus",   name: "Marcus Chen",   initials: "MC", role: "Crew lead",     accent: "#3d6b8e" },
  { id: "u-tomas",    name: "Tomás Ortega",  initials: "TO", role: "Iron worker",   accent: "#5b4fc7" },
  { id: "u-jen",      name: "Jen Park",      initials: "JP", role: "Iron worker",   accent: "#9c6240" },
  { id: "u-ben",      name: "Ben Rodriguez", initials: "BR", role: "Apprentice",    accent: "#2d8a5e" },
  { id: "u-mike",     name: "Mike Sullivan", initials: "MS", role: "Iron worker",   accent: "#c4700b" },
  { id: "u-jose",     name: "José Ramírez",  initials: "JR", role: "Iron worker",   accent: "#c93b3b" },
];

// Statuses: draft (worker can still edit), submitted (locked to worker), approved, rejected, amended (admin edited)
const statusConfig = {
  draft:     { label: "Draft",     color: "#8a8884", soft: "rgba(138,136,132,.12)" },
  running:   { label: "Running",   color: "#2d8a5e", soft: "rgba(45,138,94,.12)"  },
  submitted: { label: "Submitted", color: "#3878a8", soft: "rgba(56,120,168,.12)" },
  approved:  { label: "Approved",  color: "#2d8a5e", soft: "rgba(45,138,94,.12)"  },
  rejected:  { label: "Rejected",  color: "#c93b3b", soft: "rgba(201,59,59,.12)"  },
  amended:   { label: "Amended",   color: "#c4700b", soft: "rgba(196,112,11,.12)" },
};

// ─── TIME ENTRIES SEED DATA ─────────────────────────────────────────────────
// Anchor: today is "Apr 22, 2026" (Wed). Generate Mon–Wed of current week + last week.
// Use simple ISO-like strings; no Date objects in seed (everything's pre-formatted).

const today = "2026-04-22"; // Wednesday
const weekDays = [
  { iso: "2026-04-20", label: "Mon", display: "Apr 20" },
  { iso: "2026-04-21", label: "Tue", display: "Apr 21" },
  { iso: "2026-04-22", label: "Wed", display: "Apr 22" },
  { iso: "2026-04-23", label: "Thu", display: "Apr 23" },
  { iso: "2026-04-24", label: "Fri", display: "Apr 24" },
  { iso: "2026-04-25", label: "Sat", display: "Apr 25" },
  { iso: "2026-04-26", label: "Sun", display: "Apr 26" },
];

const lastWeekDays = [
  { iso: "2026-04-13", label: "Mon", display: "Apr 13" },
  { iso: "2026-04-14", label: "Tue", display: "Apr 14" },
  { iso: "2026-04-15", label: "Wed", display: "Apr 15" },
  { iso: "2026-04-16", label: "Thu", display: "Apr 16" },
  { iso: "2026-04-17", label: "Fri", display: "Apr 17" },
];

// Marcus is currently clocked in (running entry) — anchor of the demo
const initialEntries = [
  // ── MARCUS · current week ──
  { id: "te-001", userId: "u-marcus", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-22", clockIn: "07:00", clockOut: null,    minutes: null, status: "running",   gps: { lat: 47.5605, lng: -52.7126 }, notes: "" },
  { id: "te-002", userId: "u-marcus", projectId: "p-river", taskId: "t-east-rough", date: "2026-04-21", clockIn: "07:02", clockOut: "11:48", minutes: 286, status: "draft",    gps: { lat: 47.5604, lng: -52.7128 }, notes: "" },
  { id: "te-003", userId: "u-marcus", projectId: "p-river", taskId: "t-east-rough", date: "2026-04-21", clockIn: "12:15", clockOut: "16:22", minutes: 247, status: "draft",    gps: null, notes: "Wrap-up after lunch" },
  { id: "te-004", userId: "u-marcus", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-20", clockIn: "06:55", clockOut: "11:50", minutes: 295, status: "draft",    gps: { lat: 47.5605, lng: -52.7126 }, notes: "" },
  { id: "te-005", userId: "u-marcus", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-20", clockIn: "12:30", clockOut: "16:15", minutes: 225, status: "draft",    gps: null, notes: "" },
  // ── MARCUS · last week (submitted, awaiting approval) ──
  { id: "te-101", userId: "u-marcus", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-17", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "submitted", gps: null, notes: "" },
  { id: "te-102", userId: "u-marcus", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-16", clockIn: "07:00", clockOut: "16:30", minutes: 510, status: "submitted", gps: null, notes: "" },
  { id: "te-103", userId: "u-marcus", projectId: "p-river", taskId: "t-east-rough",date: "2026-04-15", clockIn: "06:45", clockOut: "16:00", minutes: 495, status: "submitted", gps: null, notes: "" },
  { id: "te-104", userId: "u-marcus", projectId: "p-river", taskId: "t-east-rough",date: "2026-04-14", clockIn: "07:10", clockOut: "16:20", minutes: 490, status: "submitted", gps: null, notes: "" },
  { id: "te-105", userId: "u-marcus", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-13", clockIn: "07:00", clockOut: "15:45", minutes: 465, status: "submitted", gps: null, notes: "" },

  // ── TOMÁS · current week ──
  { id: "te-201", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-22", clockIn: "07:05", clockOut: "11:50", minutes: 285, status: "draft", gps: { lat: 47.5605, lng: -52.7126 }, notes: "" },
  { id: "te-202", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck",   date: "2026-04-21", clockIn: "07:00", clockOut: "16:30", minutes: 510, status: "draft", gps: null, notes: "" },
  { id: "te-203", userId: "u-tomas", projectId: "p-river", taskId: "t-east-rough",date: "2026-04-20", clockIn: "07:15", clockOut: "16:45", minutes: 510, status: "draft", gps: null, notes: "" },
  // ── TOMÁS · last week (submitted) ──
  { id: "te-211", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-17", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "submitted", gps: null, notes: "" },
  { id: "te-212", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-16", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "submitted", gps: null, notes: "" },
  { id: "te-213", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-15", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "submitted", gps: null, notes: "" },
  { id: "te-214", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-14", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "submitted", gps: null, notes: "" },
  { id: "te-215", userId: "u-tomas", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-13", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "submitted", gps: null, notes: "" },

  // ── JEN PARK · current week ──
  { id: "te-301", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-22", clockIn: "07:00", clockOut: null,    minutes: null, status: "running", gps: { lat: 47.5605, lng: -52.7126 }, notes: "" },
  { id: "te-302", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-21", clockIn: "06:55", clockOut: "16:10", minutes: 495, status: "draft", gps: null, notes: "" },
  { id: "te-303", userId: "u-jen", projectId: "p-river", taskId: "t-east-rough",date: "2026-04-20", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "draft", gps: null, notes: "" },
  // ── JEN · last week (already approved) ──
  { id: "te-311", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-17", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "approved", gps: null, notes: "" },
  { id: "te-312", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-16", clockIn: "07:00", clockOut: "16:30", minutes: 510, status: "approved", gps: null, notes: "" },
  { id: "te-313", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-15", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "approved", gps: null, notes: "" },
  { id: "te-314", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-14", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "approved", gps: null, notes: "" },
  { id: "te-315", userId: "u-jen", projectId: "p-river", taskId: "t-fl4-deck", date: "2026-04-13", clockIn: "07:00", clockOut: "16:00", minutes: 480, status: "approved", gps: null, notes: "" },

  // ── BEN · current week ──
  { id: "te-401", userId: "u-ben", projectId: "p-westend", taskId: "t-panel-room", date: "2026-04-22", clockIn: "07:30", clockOut: null,    minutes: null, status: "running", gps: null, notes: "" },
  { id: "te-402", userId: "u-ben", projectId: "p-westend", taskId: "t-panel-room", date: "2026-04-21", clockIn: "07:30", clockOut: "16:00", minutes: 510, status: "draft",    gps: null, notes: "" },
  // BEN · last week, one entry was AMENDED by admin
  { id: "te-411", userId: "u-ben", projectId: "p-westend", taskId: "t-panel-room", date: "2026-04-17", clockIn: "07:30", clockOut: "16:00", minutes: 510, status: "amended",   gps: null, notes: "Admin: corrected clock-out from 4:30 PM → 4:00 PM (forgot to stop)" },
  { id: "te-412", userId: "u-ben", projectId: "p-westend", taskId: "t-panel-room", date: "2026-04-16", clockIn: "07:30", clockOut: "16:00", minutes: 510, status: "approved",  gps: null, notes: "" },
  { id: "te-413", userId: "u-ben", projectId: "p-westend", taskId: "t-panel-room", date: "2026-04-15", clockIn: "07:30", clockOut: "16:00", minutes: 510, status: "approved",  gps: null, notes: "" },

  // ── MIKE · current week ──
  { id: "te-501", userId: "u-mike", projectId: "p-westend", taskId: "t-rfi-019", date: "2026-04-22", clockIn: "07:00", clockOut: null,    minutes: null, status: "running", gps: null, notes: "" },
  { id: "te-502", userId: "u-mike", projectId: "p-westend", taskId: "t-rfi-019", date: "2026-04-21", clockIn: "07:00", clockOut: "15:30", minutes: 510, status: "draft", gps: null, notes: "" },
  // MIKE · last week — REJECTED entry
  { id: "te-511", userId: "u-mike", projectId: "p-westend", taskId: "t-rfi-019", date: "2026-04-17", clockIn: "06:00", clockOut: "20:30", minutes: 870, status: "rejected", gps: null, notes: "Admin: 14.5h shift exceeds policy. Please revise and resubmit with break detail." },
  { id: "te-512", userId: "u-mike", projectId: "p-westend", taskId: "t-rfi-019", date: "2026-04-16", clockIn: "07:00", clockOut: "16:00", minutes: 510, status: "approved", gps: null, notes: "" },
  { id: "te-513", userId: "u-mike", projectId: "p-westend", taskId: "t-rfi-019", date: "2026-04-15", clockIn: "07:00", clockOut: "16:00", minutes: 510, status: "approved", gps: null, notes: "" },

  // ── JOSÉ · current week ──
  { id: "te-601", userId: "u-jose", projectId: "p-northline", taskId: "t-frame-rough", date: "2026-04-22", clockIn: "07:00", clockOut: null,    minutes: null, status: "running", gps: null, notes: "" },
  { id: "te-602", userId: "u-jose", projectId: "p-northline", taskId: "t-frame-rough", date: "2026-04-21", clockIn: "07:00", clockOut: "15:45", minutes: 525, status: "draft", gps: null, notes: "" },
  { id: "te-603", userId: "u-jose", projectId: "p-northline", taskId: "t-frame-rough", date: "2026-04-20", clockIn: "07:00", clockOut: "16:00", minutes: 540, status: "draft", gps: null, notes: "" },
];

// Audit trail (admin amendments)
const auditEntries = [
  { id: "au-001", entryId: "te-411", actorName: "Marcus Chen", actorRole: "Sub admin", action: "amended", at: "Apr 18, 9:42 AM", before: "07:30 → 16:30 · 540 min", after: "07:30 → 16:00 · 510 min", reason: "Worker forgot to clock out, corrected per text confirmation." },
  { id: "au-002", entryId: "te-511", actorName: "Marcus Chen", actorRole: "Sub admin", action: "rejected", at: "Apr 18, 10:15 AM", before: "—", after: "—", reason: "14.5h shift exceeds policy. Revise and resubmit with break detail." },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────
const minsToHM = (m) => {
  if (m == null) return "—";
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
};
const minsToDecimal = (m) => (m == null ? "—" : (m / 60).toFixed(2));
const minsToHMSlim = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
};

// Convert "HH:MM" to minutes from midnight
const timeToMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const minsToTime = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
// Format "HH:MM" 24h to "h:mm AM/PM"
const fmt12 = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};
// Compute live duration from clockIn (HH:MM) to "now" (sim from running counter in minutes)
// We use a useEffect-based clock but simulate: today is Wed 2026-04-22, "now" anchored at 14:23 (~ 7h 23m from 07:00)
const getProjectById = (id) => projects.find((p) => p.id === id);
const getTaskById = (id) => tasks.find((t) => t.id === id);
const getWorkerById = (id) => workers.find((w) => w.id === id);

// Sum minutes per day (incl. running entry minutes from live timer)
const sumByDay = (entries, runningMins) =>
  entries.reduce((acc, e) => {
    const m = e.status === "running" ? (runningMins ?? 0) : (e.minutes || 0);
    acc[e.date] = (acc[e.date] || 0) + m;
    return acc;
  }, {});

// ─── ICONS ──────────────────────────────────────────────────────────────────
const I = {
  play:      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  stop:      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>,
  clock:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  calendar:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  user:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  building:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>,
  pin:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  cloud:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  cloudOff:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3M2 2l20 20"/></svg>,
  check:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x:         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chevR:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevL:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevD:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  lock:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  edit:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  plus:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  send:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  alert:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  history:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  download:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  search:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  sun:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  moon:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  bell:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  trend:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  filter:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  refresh:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
};

// ─── SMALL COMPONENTS ───────────────────────────────────────────────────────
function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect x="2"  y="2"  width="13" height="13" rx="2.5" fill="#3d6b8e" />
      <rect x="17" y="2"  width="13" height="13" rx="2.5" fill="#5b4fc7" opacity=".88" />
      <rect x="2"  y="17" width="13" height="13" rx="2.5" fill="#9c6240" opacity=".82" />
      <rect x="17" y="17" width="13" height="13" rx="2.5" fill="#2d8a5e" opacity=".75" />
    </svg>
  );
}

function WorkerAvatar({ worker, size = "md" }) {
  if (!worker) return null;
  const dim = size === "sm" ? 26 : size === "lg" ? 44 : 34;
  const fs = size === "sm" ? 10.5 : size === "lg" ? 15 : 12.5;
  return (
    <div
      className="tt-avatar"
      style={{
        width: dim,
        height: dim,
        background: worker.accent,
        fontSize: fs,
      }}
    >
      {worker.initials}
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = statusConfig[status];
  if (!cfg) return null;
  return (
    <span
      className="tt-status-pill"
      style={{ color: cfg.color, background: cfg.soft }}
    >
      <span className="tt-status-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function ProjectChip({ projectId, size = "md" }) {
  const p = getProjectById(projectId);
  if (!p) return null;
  return (
    <span
      className={`tt-project-chip${size === "sm" ? " sm" : ""}`}
      style={{ borderLeftColor: p.color }}
    >
      {size !== "sm" && I.building}
      <span>{size === "sm" ? p.short : p.name}</span>
    </span>
  );
}

// Live ticking timer for running entries
function RunningTimer({ baseMins, paused = false }) {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTicks((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);
  // baseMins: starting minutes (e.g., 7h 23m = 443 elapsed). ticks is in seconds.
  const totalSec = baseMins * 60 + ticks;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return (
    <span className="tt-running-timer">
      {String(h).padStart(2, "0")}
      <span className="tt-running-colon">:</span>
      {String(m).padStart(2, "0")}
      <span className="tt-running-colon">:</span>
      {String(s).padStart(2, "0")}
    </span>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function TimeTrackingModule() {
  // ── State ────────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(false);
  const [roleView, setRoleView] = useState("worker"); // worker | admin
  const [view, setView] = useState("today");          // today | timesheet | team | worker-detail
  const [isOnline, setIsOnline] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(null); // entry id or null
  const [pendingProjectId, setPendingProjectId] = useState("p-river");
  const [pendingTaskId, setPendingTaskId] = useState("t-fl4-deck");
  const [pendingNotes, setPendingNotes] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("u-tomas");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current, -1 = last
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState(initialEntries);
  const [showToast, setShowToast] = useState(null);
  const [showClockInToast, setShowClockInToast] = useState(false);
  const [showSubmittedToast, setShowSubmittedToast] = useState(false);

  // Derived: current user for worker view
  const me = useMemo(() => getWorkerById(currentUserId), []);
  const myRunning = useMemo(
    () => entries.find((e) => e.userId === currentUserId && e.status === "running"),
    [entries]
  );

  // Anchor "now" — simulated 14:23 (2:23 PM) for the demo. Live timer ticks from there.
  // Marcus clocked in at 07:00 → base elapsed = 7h 23m = 443 minutes.
  const NOW_MINS = 14 * 60 + 23;
  const myRunningElapsed = myRunning ? NOW_MINS - timeToMins(myRunning.clockIn) : 0;

  // Helpers for worker view
  const myWeekDays = weekOffset === 0 ? weekDays : lastWeekDays.concat(weekDays.slice(5)); // simplify
  const activeWeekDays = weekOffset === 0 ? weekDays : lastWeekDays;
  const myEntriesThisWeek = useMemo(
    () => entries.filter((e) => e.userId === currentUserId && activeWeekDays.some((d) => d.iso === e.date)),
    [entries, weekOffset]
  );
  const myTodaysEntries = useMemo(
    () => entries.filter((e) => e.userId === currentUserId && e.date === today),
    [entries]
  );
  const myWeekTotalMins = myEntriesThisWeek.reduce(
    (acc, e) => acc + (e.status === "running" ? myRunningElapsed : (e.minutes || 0)),
    0
  );
  const myWeekTotalsByDay = sumByDay(myEntriesThisWeek, myRunningElapsed);
  const myDraftCount = myEntriesThisWeek.filter((e) => e.status === "draft").length;
  const allMyDraftsThisWeek = myEntriesThisWeek.every(
    (e) => e.status === "draft" || e.status === "running"
  );

  // Helpers for admin view
  const allRunning = useMemo(() => entries.filter((e) => e.status === "running"), [entries]);
  const pendingApprovalEntries = useMemo(
    () => entries.filter((e) => e.status === "submitted"),
    [entries]
  );
  const rejectedEntries = useMemo(
    () => entries.filter((e) => e.status === "rejected"),
    [entries]
  );
  const teamWeekData = useMemo(() => {
    const wkDays = activeWeekDays;
    return workers.map((w) => {
      const wEntries = entries.filter(
        (e) => e.userId === w.id && wkDays.some((d) => d.iso === e.date)
      );
      const total = wEntries.reduce(
        (acc, e) => acc + (e.status === "running" ? (w.id === currentUserId ? myRunningElapsed : (NOW_MINS - timeToMins(e.clockIn))) : (e.minutes || 0)),
        0
      );
      const submitted = wEntries.filter((e) => e.status === "submitted").length;
      const draft = wEntries.filter((e) => e.status === "draft").length;
      const running = wEntries.filter((e) => e.status === "running").length;
      const approved = wEntries.filter((e) => e.status === "approved").length;
      const amended = wEntries.filter((e) => e.status === "amended").length;
      const rejected = wEntries.filter((e) => e.status === "rejected").length;
      return { worker: w, entries: wEntries, total, submitted, draft, running, approved, amended, rejected };
    });
  }, [entries, weekOffset]);

  // Worker detail
  const selectedWorker = getWorkerById(selectedWorkerId);
  const selectedWorkerEntries = useMemo(
    () => entries.filter((e) => e.userId === selectedWorkerId && activeWeekDays.some((d) => d.iso === e.date)),
    [entries, selectedWorkerId, weekOffset]
  );
  const selectedWorkerTotal = selectedWorkerEntries.reduce(
    (acc, e) => acc + (e.status === "running" ? (NOW_MINS - timeToMins(e.clockIn)) : (e.minutes || 0)),
    0
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  const startClockIn = () => {
    setPendingProjectId("p-river");
    setPendingTaskId("t-fl4-deck");
    setPendingNotes("");
    setShowClockInModal(true);
  };

  const confirmClockIn = () => {
    const newId = `te-${Math.floor(1000 + Math.random() * 9000)}`;
    const newEntry = {
      id: newId,
      userId: currentUserId,
      projectId: pendingProjectId,
      taskId: pendingTaskId,
      date: today,
      clockIn: minsToTime(NOW_MINS),
      clockOut: null,
      minutes: null,
      status: "running",
      gps: gpsEnabled ? { lat: 47.5605, lng: -52.7126 } : null,
      notes: pendingNotes,
    };
    setEntries((prev) => [newEntry, ...prev]);
    setShowClockInModal(false);
    setShowClockInToast(true);
    setTimeout(() => setShowClockInToast(false), 2200);
  };

  const stopClock = () => {
    setStopNotes("");
    setShowStopModal(true);
  };

  const confirmStopClock = () => {
    if (!myRunning) return;
    const elapsed = NOW_MINS - timeToMins(myRunning.clockIn);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === myRunning.id
          ? { ...e, clockOut: minsToTime(NOW_MINS), minutes: elapsed, status: "draft", notes: stopNotes || e.notes }
          : e
      )
    );
    setShowStopModal(false);
    setShowToast({ kind: "ok", text: `Clocked out · ${minsToHM(elapsed)} logged` });
    setTimeout(() => setShowToast(null), 2400);
  };

  const submitWeek = () => {
    setEntries((prev) =>
      prev.map((e) =>
        e.userId === currentUserId &&
        activeWeekDays.some((d) => d.iso === e.date) &&
        e.status === "draft"
          ? { ...e, status: "submitted" }
          : e
      )
    );
    setShowSubmitModal(false);
    setShowSubmittedToast(true);
    setTimeout(() => setShowSubmittedToast(false), 2400);
  };

  const approveEntry = (id) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "approved" } : e)));
    setShowToast({ kind: "ok", text: "Entry approved" });
    setTimeout(() => setShowToast(null), 1800);
  };
  const rejectEntry = (id) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "rejected" } : e)));
    setShowToast({ kind: "wr", text: "Entry rejected — worker notified" });
    setTimeout(() => setShowToast(null), 2200);
  };
  const approveWorkerWeek = (workerId) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.userId === workerId &&
        activeWeekDays.some((d) => d.iso === e.date) &&
        e.status === "submitted"
          ? { ...e, status: "approved" }
          : e
      )
    );
    setShowToast({ kind: "ok", text: `Week approved for ${getWorkerById(workerId)?.name}` });
    setTimeout(() => setShowToast(null), 2200);
  };

  // ─── CSS ──────────────────────────────────────────────────────────────────
  const css = `
:root{
  --accent:#3d6b8e;        /* sub primary */
  --accent-deep:#2c5170;
  --accent-soft:rgba(61,107,142,.1);
  --accent-strong:#345d7c;
  --ok:#2d8a5e; --ok-soft:rgba(45,138,94,.11);
  --wr:#c4700b; --wr-soft:rgba(196,112,11,.11);
  --er:#c93b3b; --er-soft:rgba(201,59,59,.11);
  --info:#3878a8; --info-soft:rgba(56,120,168,.1);
  --bg:#f9f8f5;
  --surface-1:#ffffff;
  --surface-2:#f4f2ed;
  --surface-3:#ece9e2;
  --surface-hover:#f7f5f0;
  --border:#e4e0d6;
  --border-strong:#d6d1c4;
  --text-primary:#1f1d1a;
  --text-secondary:#5a5852;
  --text-tertiary:#8a8884;
  --shadow-sm:0 1px 2px rgba(20,18,14,.04);
  --shadow-md:0 4px 12px rgba(20,18,14,.06);
  --shadow-lg:0 14px 38px rgba(20,18,14,.13);
}
.tt-dark{
  --bg:#1a1814;
  --surface-1:#221f1a;
  --surface-2:#1f1c17;
  --surface-3:#2a2620;
  --surface-hover:#27241e;
  --border:#34302a;
  --border-strong:#403b33;
  --text-primary:#f0ede4;
  --text-secondary:#aca9a1;
  --text-tertiary:#7a766f;
  --accent-soft:rgba(112,144,179,.18);
}
.tt-root{font-family:'Instrument Sans',sans-serif;color:var(--text-primary);background:var(--bg);min-height:100vh;letter-spacing:-.005em}
.tt-root *{box-sizing:border-box}
.tt-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

/* ── TOP BAR ──────────────────────────────────────────── */
.tt-topbar{height:56px;background:var(--surface-1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 22px;gap:18px;position:sticky;top:0;z-index:30}
.tt-topbar-left{display:flex;align-items:center;gap:18px;flex:1;min-width:0}
.tt-brand{display:flex;align-items:center;gap:8px;font-family:'DM Sans',sans-serif;font-weight:760;font-size:15px;letter-spacing:-.01em}
.tt-crumbs{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:540}
.tt-crumbs strong{color:var(--text-primary);font-weight:700}
.tt-crumbs-sep{color:var(--text-tertiary);font-size:11px}
.tt-topbar-right{display:flex;align-items:center;gap:8px}
.tt-role-toggle{display:flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px}
.tt-role-btn{height:28px;padding:0 11px;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:12px;color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px;transition:all .15s;letter-spacing:-.005em}
.tt-role-btn:hover{color:var(--text-primary)}
.tt-role-btn.active{background:var(--surface-1);color:var(--text-primary);box-shadow:var(--shadow-sm)}
.tt-icon-btn{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;color:var(--text-secondary);transition:all .15s;position:relative}
.tt-icon-btn:hover{background:var(--surface-2);color:var(--text-primary)}
.tt-icon-btn .tt-dot{position:absolute;top:7px;right:7px;width:7px;height:7px;background:var(--er);border-radius:50%;border:2px solid var(--surface-1)}
.tt-avatar{border-radius:50%;display:grid;place-items:center;color:#fff;font-family:'DM Sans',sans-serif;font-weight:680;letter-spacing:-.01em;flex-shrink:0}

/* ── SHELL ────────────────────────────────────────────── */
.tt-shell{display:flex;min-height:calc(100vh - 56px)}
.tt-sidebar{width:248px;background:var(--surface-1);border-right:1px solid var(--border);padding:18px 14px;flex-shrink:0;position:sticky;top:56px;align-self:flex-start;height:calc(100vh - 56px);overflow-y:auto}
.tt-sb-section{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:720;padding:12px 10px 6px}
.tt-sb-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:560;color:var(--text-secondary);transition:all .12s;letter-spacing:-.005em}
.tt-sb-item:hover{background:var(--surface-2);color:var(--text-primary)}
.tt-sb-item.active{background:var(--accent-soft);color:var(--accent);font-weight:660}
.tt-sb-item.active svg{color:var(--accent)}
.tt-sb-item svg{flex-shrink:0;color:var(--text-tertiary)}
.tt-sb-item.active svg{color:var(--accent)}
.tt-sb-count{margin-left:auto;font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--text-tertiary);font-weight:540}
.tt-sb-item.active .tt-sb-count{color:var(--accent)}
.tt-sb-item .tt-pulse{width:7px;height:7px;border-radius:50%;background:var(--ok);margin-left:auto;animation:ttPulse 1.6s ease-in-out infinite;box-shadow:0 0 0 0 var(--ok)}
@keyframes ttPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.85)}}

/* ── MAIN ─────────────────────────────────────────────── */
.tt-main{flex:1;min-width:0;padding:24px 28px 60px}
.tt-page-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap}
.tt-page-title{font-family:'DM Sans',sans-serif;font-weight:780;font-size:25px;letter-spacing:-.025em;color:var(--text-primary);margin-bottom:4px;line-height:1.15}
.tt-page-sub{font-size:13.5px;color:var(--text-secondary);line-height:1.45}
.tt-btn{height:34px;padding:0 14px;border-radius:8px;background:var(--surface-1);border:1px solid var(--border);font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--text-primary);display:inline-flex;align-items:center;gap:7px;letter-spacing:-.005em;transition:all .14s}
.tt-btn:hover{background:var(--surface-2);border-color:var(--border-strong)}
.tt-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.tt-btn.primary:hover{background:var(--accent-strong)}
.tt-btn.danger{background:var(--er);color:#fff;border-color:var(--er)}
.tt-btn.danger:hover{filter:brightness(.93)}
.tt-btn.ok{background:var(--ok);color:#fff;border-color:var(--ok)}
.tt-btn.ok:hover{filter:brightness(.93)}
.tt-btn.ghost{background:transparent;border-color:transparent;color:var(--text-secondary)}
.tt-btn.ghost:hover{background:var(--surface-2)}
.tt-btn:disabled{opacity:.5;cursor:not-allowed}
.tt-btn.lg{height:42px;padding:0 18px;font-size:13.5px;border-radius:9px}

/* ── CLOCK CARD (worker today hero) ───────────────────── */
.tt-clock-card{background:linear-gradient(135deg,var(--surface-1),var(--surface-2));border:1px solid var(--border);border-radius:14px;padding:24px 26px;display:grid;grid-template-columns:1fr auto;gap:22px;margin-bottom:18px;position:relative;overflow:hidden}
.tt-clock-card.running{background:linear-gradient(135deg,rgba(45,138,94,.06),rgba(45,138,94,.02));border-color:rgba(45,138,94,.3)}
.tt-clock-card.running::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ok)}
.tt-clock-state{display:flex;flex-direction:column;gap:14px;justify-content:space-between;min-width:0}
.tt-clock-state-label{display:flex;align-items:center;gap:8px;font-family:'DM Sans',sans-serif;font-weight:660;font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary)}
.tt-clock-state-label .tt-running-led{width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 0 var(--ok);animation:ttPulse 1.6s ease-in-out infinite}
.tt-running-timer{font-family:'JetBrains Mono',monospace;font-weight:680;font-size:42px;color:var(--text-primary);letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.tt-running-colon{color:var(--ok);animation:ttBlink 1s steps(2) infinite}
@keyframes ttBlink{50%{opacity:.35}}
.tt-idle-hours{font-family:'DM Sans',sans-serif;font-weight:780;font-size:36px;color:var(--text-primary);letter-spacing:-.025em;line-height:1}
.tt-clock-state-meta{display:flex;flex-direction:column;gap:6px;font-size:13px}
.tt-clock-state-meta-row{display:flex;align-items:center;gap:8px;color:var(--text-secondary)}
.tt-clock-state-meta-row strong{color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:660}
.tt-clock-state-meta-row svg{flex-shrink:0;color:var(--text-tertiary)}
.tt-clock-action{display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:10px;min-width:200px}
.tt-clock-btn{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;color:#fff;border:none;cursor:pointer;transition:all .15s;box-shadow:var(--shadow-md);position:relative}
.tt-clock-btn.start{background:var(--ok)}
.tt-clock-btn.start:hover{background:#268351;transform:scale(1.04);box-shadow:var(--shadow-lg)}
.tt-clock-btn.stop{background:var(--er)}
.tt-clock-btn.stop:hover{background:#b53434;transform:scale(1.04);box-shadow:var(--shadow-lg)}
.tt-clock-btn svg{width:32px;height:32px}
.tt-clock-btn-label{font-family:'DM Sans',sans-serif;font-weight:720;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary)}

/* ── KPI STRIP ────────────────────────────────────────── */
.tt-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.tt-kpi{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:14px 16px;position:relative;overflow:hidden}
.tt-kpi-key{font-size:10.5px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-family:'DM Sans',sans-serif;font-weight:680;margin-bottom:7px}
.tt-kpi-val{font-family:'DM Sans',sans-serif;font-weight:820;font-size:24px;letter-spacing:-.025em;color:var(--text-primary);line-height:1;font-variant-numeric:tabular-nums}
.tt-kpi-val .tt-kpi-unit{font-size:13px;font-weight:620;color:var(--text-tertiary);margin-left:3px}
.tt-kpi-foot{margin-top:8px;font-size:11.5px;color:var(--text-secondary);display:flex;align-items:center;gap:5px}
.tt-kpi-foot.ok{color:var(--ok)}
.tt-kpi-foot.wr{color:var(--wr)}
.tt-kpi-foot.er{color:var(--er)}
.tt-kpi-bar{position:absolute;left:0;bottom:0;height:3px;background:var(--accent)}

/* ── CARDS / TABLES ───────────────────────────────────── */
.tt-grid{display:grid;grid-template-columns:1fr 320px;gap:18px}
.tt-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.tt-card-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.tt-card-title{font-family:'DM Sans',sans-serif;font-weight:740;font-size:15px;letter-spacing:-.018em;color:var(--text-primary)}
.tt-card-sub{font-size:12px;color:var(--text-secondary);margin-top:2px}

.tt-table-wrap{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;overflow:hidden}
.tt-table{width:100%;border-collapse:collapse}
.tt-table thead{background:var(--surface-2);border-bottom:1px solid var(--border)}
.tt-table th{padding:11px 14px;text-align:left;font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary);white-space:nowrap}
.tt-table td{padding:13px 14px;border-bottom:1px solid var(--border);vertical-align:middle;font-size:13px}
.tt-table tbody tr{transition:background .1s}
.tt-table tbody tr.clickable{cursor:pointer}
.tt-table tbody tr.clickable:hover{background:var(--surface-hover)}
.tt-table tbody tr:last-child td{border-bottom:none}
.tt-table-id{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary)}
.tt-table-task{font-family:'DM Sans',sans-serif;font-weight:660;color:var(--text-primary);letter-spacing:-.005em;font-size:13px}
.tt-table-time{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-secondary)}
.tt-table-dur{font-family:'DM Sans',sans-serif;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text-primary)}
.tt-table-actions{display:flex;gap:5px;justify-content:flex-end}
.tt-icon-action{width:28px;height:28px;border-radius:6px;display:grid;place-items:center;color:var(--text-tertiary);background:transparent;border:none;cursor:pointer;transition:all .12s}
.tt-icon-action:hover{background:var(--surface-2);color:var(--text-primary)}
.tt-icon-action.danger:hover{background:var(--er-soft);color:var(--er)}
.tt-icon-action.ok:hover{background:var(--ok-soft);color:var(--ok)}

/* ── STATUS PILLS / CHIPS ─────────────────────────────── */
.tt-status-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:5px;font-family:'DM Sans',sans-serif;font-weight:660;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1.4;white-space:nowrap}
.tt-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.tt-project-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px 4px 8px;background:var(--surface-2);border:1px solid var(--border);border-left:2.5px solid;border-radius:5px;font-size:12px;color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:560;letter-spacing:-.005em;white-space:nowrap}
.tt-project-chip.sm{padding:3px 7px 3px 6px;font-size:11px;font-weight:620}
.tt-project-chip svg{flex-shrink:0;color:var(--text-tertiary)}

/* ── WEEK GRID (timesheet) ───────────────────────────── */
.tt-week{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px}
.tt-week-hdr{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--surface-2);flex-wrap:wrap}
.tt-week-title{font-family:'DM Sans',sans-serif;font-weight:740;font-size:14.5px;letter-spacing:-.015em}
.tt-week-sub{font-size:12px;color:var(--text-secondary);margin-top:2px}
.tt-week-nav{display:flex;align-items:center;gap:8px}
.tt-week-nav-btn{width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--surface-1);display:grid;place-items:center;color:var(--text-secondary);transition:all .12s}
.tt-week-nav-btn:hover{background:var(--surface-2);color:var(--text-primary)}
.tt-week-nav-btn:disabled{opacity:.4;cursor:not-allowed}
.tt-week-totals{display:flex;align-items:center;gap:14px;padding-right:8px}
.tt-week-total-key{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:680}
.tt-week-total-val{font-family:'DM Sans',sans-serif;font-weight:780;font-size:18px;color:var(--text-primary);font-variant-numeric:tabular-nums;letter-spacing:-.02em}

.tt-week-grid{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid var(--border)}
.tt-week-day{padding:14px 14px 16px;border-right:1px solid var(--border);min-height:160px;display:flex;flex-direction:column;gap:10px;position:relative}
.tt-week-day:last-child{border-right:none}
.tt-week-day.weekend{background:var(--surface-2)}
.tt-week-day.today{background:var(--accent-soft)}
.tt-week-day-hdr{display:flex;align-items:baseline;justify-content:space-between;gap:6px;padding-bottom:8px;border-bottom:1px dashed var(--border)}
.tt-week-day-name{font-family:'DM Sans',sans-serif;font-weight:680;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-tertiary)}
.tt-week-day.today .tt-week-day-name{color:var(--accent)}
.tt-week-day-num{font-family:'DM Sans',sans-serif;font-weight:780;font-size:16px;color:var(--text-primary);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tt-week-day-total{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-secondary);font-weight:540;margin-left:auto}
.tt-week-day-total.zero{opacity:.45}
.tt-week-entries{display:flex;flex-direction:column;gap:5px;flex:1}
.tt-week-entry{padding:6px 8px 7px;border-radius:6px;background:var(--surface-2);border:1px solid var(--border);font-size:11.5px;line-height:1.35;cursor:pointer;transition:all .12s;border-left:2.5px solid var(--accent)}
.tt-week-entry:hover{background:var(--surface-hover);border-color:var(--border-strong)}
.tt-week-entry.running{background:var(--ok-soft);border-color:rgba(45,138,94,.3);border-left-color:var(--ok)}
.tt-week-entry.submitted{opacity:.85;background:var(--info-soft);border-color:rgba(56,120,168,.2);border-left-color:var(--info)}
.tt-week-entry.approved{opacity:.85;background:var(--ok-soft);border-color:rgba(45,138,94,.18);border-left-color:var(--ok)}
.tt-week-entry.amended{background:var(--wr-soft);border-color:rgba(196,112,11,.2);border-left-color:var(--wr)}
.tt-week-entry.rejected{background:var(--er-soft);border-color:rgba(201,59,59,.22);border-left-color:var(--er)}
.tt-week-entry-row1{display:flex;justify-content:space-between;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text-tertiary)}
.tt-week-entry-dur{font-family:'DM Sans',sans-serif;font-weight:720;color:var(--text-primary);font-size:11.5px;font-variant-numeric:tabular-nums}
.tt-week-entry-task{font-family:'DM Sans',sans-serif;font-weight:580;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── ENTRY DETAIL / EDITS ─────────────────────────────── */
.tt-detail{display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start}
.tt-detail-rail{display:flex;flex-direction:column;gap:14px;position:sticky;top:74px}
.tt-rail-card{background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:14px 16px}
.tt-rail-card h4{font-family:'DM Sans',sans-serif;font-weight:680;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);margin:0 0 10px;display:flex;align-items:center;gap:6px}

/* ── INPUTS ───────────────────────────────────────────── */
.tt-input,.tt-select,.tt-textarea{width:100%;border:1.5px solid var(--border);border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13.5px;background:var(--surface-1);color:var(--text-primary);outline:none}
.tt-input:focus,.tt-select:focus,.tt-textarea:focus{border-color:var(--accent);background:var(--surface-1);box-shadow:0 0 0 3px var(--accent-soft)}
.tt-input{height:38px}
.tt-select{height:38px;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8884' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.tt-textarea{min-height:80px;resize:vertical;padding:10px 12px}
.tt-input-label{font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:block}

/* GPS toggle */
.tt-gps-toggle{display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s}
.tt-gps-toggle:hover{background:var(--surface-hover)}
.tt-gps-toggle.on{background:var(--ok-soft);border-color:rgba(45,138,94,.3)}
.tt-gps-toggle svg{flex-shrink:0;color:var(--text-tertiary)}
.tt-gps-toggle.on svg{color:var(--ok)}
.tt-gps-toggle-text{flex:1;font-size:12.5px;color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:580}
.tt-gps-toggle-state{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-family:'DM Sans',sans-serif;font-weight:680;color:var(--text-tertiary)}
.tt-gps-toggle.on .tt-gps-toggle-state{color:var(--ok)}
.tt-switch{position:relative;width:34px;height:18px;background:var(--border-strong);border-radius:11px;transition:background .15s;flex-shrink:0}
.tt-switch::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .15s;box-shadow:var(--shadow-sm)}
.tt-switch.on{background:var(--ok)}
.tt-switch.on::after{transform:translateX(16px)}

/* ── MODALS ───────────────────────────────────────────── */
.tt-modal-bg{position:fixed;inset:0;background:rgba(20,18,14,.45);z-index:50;display:grid;place-items:center;padding:20px;animation:ttFadeIn .15s ease-out}
.tt-modal{background:var(--surface-1);border:1px solid var(--border);border-radius:14px;padding:24px;width:520px;max-width:100%;box-shadow:var(--shadow-lg);animation:ttSlideUp .2s cubic-bezier(.2,.6,.3,1)}
.tt-modal h3{font-family:'DM Sans',sans-serif;font-weight:780;font-size:18px;letter-spacing:-.018em;margin:0 0 6px;color:var(--text-primary)}
.tt-modal-sub{font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5}
.tt-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
.tt-modal-fields{display:flex;flex-direction:column;gap:14px}
@keyframes ttFadeIn{from{opacity:0}to{opacity:1}}
@keyframes ttSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* ── TOAST ────────────────────────────────────────────── */
.tt-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--text-primary);color:var(--surface-1);padding:11px 18px;border-radius:9px;display:flex;align-items:center;gap:9px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:13px;z-index:60;box-shadow:var(--shadow-lg);animation:ttToastIn .25s cubic-bezier(.2,.7,.3,1)}
.tt-toast.ok{background:var(--ok);color:#fff}
.tt-toast.wr{background:var(--wr);color:#fff}
.tt-toast.er{background:var(--er);color:#fff}
.tt-toast svg{flex-shrink:0}
@keyframes ttToastIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}

/* ── ADMIN: TEAM ROSTER ───────────────────────────────── */
.tt-team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;margin-bottom:18px}
.tt-team-card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:14px 16px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:11px}
.tt-team-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md);transform:translateY(-1px)}
.tt-team-card-hdr{display:flex;align-items:center;gap:11px}
.tt-team-card-name{font-family:'DM Sans',sans-serif;font-weight:720;font-size:14px;letter-spacing:-.012em;color:var(--text-primary);line-height:1.2}
.tt-team-card-role{font-size:11.5px;color:var(--text-tertiary);margin-top:2px}
.tt-team-card-status{margin-left:auto}
.tt-team-card-stat-row{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding-top:11px;border-top:1px dashed var(--border)}
.tt-team-card-hours{font-family:'DM Sans',sans-serif;font-weight:780;font-size:21px;letter-spacing:-.022em;color:var(--text-primary);font-variant-numeric:tabular-nums;line-height:1}
.tt-team-card-hours-sub{font-size:11px;color:var(--text-tertiary);margin-top:3px}
.tt-team-card-pills{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end}
.tt-team-card-pill{font-family:'DM Sans',sans-serif;font-weight:660;font-size:10.5px;padding:3px 7px;border-radius:5px;letter-spacing:.04em;text-transform:uppercase}

/* ── AUDIT TRAIL / ACTIVITY ───────────────────────────── */
.tt-audit-list{display:flex;flex-direction:column;gap:10px}
.tt-audit-item{display:flex;gap:11px;padding:11px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;border-left:2.5px solid var(--wr)}
.tt-audit-item.rejected{border-left-color:var(--er)}
.tt-audit-item.approved{border-left-color:var(--ok)}
.tt-audit-icon{width:28px;height:28px;border-radius:7px;background:var(--wr-soft);color:var(--wr);display:grid;place-items:center;flex-shrink:0}
.tt-audit-item.rejected .tt-audit-icon{background:var(--er-soft);color:var(--er)}
.tt-audit-item.approved .tt-audit-icon{background:var(--ok-soft);color:var(--ok)}
.tt-audit-body{flex:1;min-width:0;font-size:12.5px;line-height:1.5}
.tt-audit-actor{font-family:'DM Sans',sans-serif;font-weight:680;color:var(--text-primary)}
.tt-audit-action{color:var(--text-secondary)}
.tt-audit-when{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);margin-left:6px}
.tt-audit-reason{margin-top:5px;font-size:12px;color:var(--text-secondary);line-height:1.5;font-style:italic}
.tt-audit-diff{display:flex;gap:6px;align-items:center;margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);flex-wrap:wrap}
.tt-audit-diff-from{text-decoration:line-through;opacity:.7}

/* ── FILTER BAR ───────────────────────────────────────── */
.tt-filter-bar{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.tt-filter-pills{display:flex;gap:5px;background:var(--surface-1);border:1px solid var(--border);border-radius:9px;padding:3px}
.tt-filter-pill{height:28px;padding:0 10px;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;color:var(--text-secondary);display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .12s;letter-spacing:-.005em}
.tt-filter-pill:hover{color:var(--text-primary)}
.tt-filter-pill.active{background:var(--accent-soft);color:var(--accent)}
.tt-filter-pill-count{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text-tertiary);font-weight:540}
.tt-filter-pill.active .tt-filter-pill-count{color:var(--accent)}
.tt-search{position:relative;flex:1;min-width:200px;max-width:320px}
.tt-search input{height:34px;padding:0 12px 0 34px;border-radius:8px;border:1px solid var(--border);background:var(--surface-1);width:100%;font-family:inherit;font-size:13px;color:var(--text-primary);outline:none}
.tt-search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.tt-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}

/* ── EMPTY STATES ─────────────────────────────────────── */
.tt-empty{padding:38px 20px;text-align:center;color:var(--text-tertiary);font-size:13px}
.tt-empty-icon{width:42px;height:42px;border-radius:11px;background:var(--surface-2);color:var(--text-tertiary);display:grid;place-items:center;margin:0 auto 11px}
.tt-empty-title{font-family:'DM Sans',sans-serif;font-weight:680;font-size:14px;color:var(--text-secondary);margin-bottom:4px}

/* ── BANNERS ──────────────────────────────────────────── */
.tt-banner{display:flex;align-items:center;gap:11px;padding:12px 16px;border-radius:10px;margin-bottom:14px;font-size:13px;line-height:1.45}
.tt-banner.info{background:var(--info-soft);color:var(--info);border:1px solid rgba(56,120,168,.18)}
.tt-banner.wr{background:var(--wr-soft);color:var(--wr);border:1px solid rgba(196,112,11,.18)}
.tt-banner.er{background:var(--er-soft);color:var(--er);border:1px solid rgba(201,59,59,.2)}
.tt-banner.ok{background:var(--ok-soft);color:var(--ok);border:1px solid rgba(45,138,94,.18)}
.tt-banner svg{flex-shrink:0}
.tt-banner-cta{margin-left:auto}

/* ── CONNECTION PILL ──────────────────────────────────── */
.tt-conn-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:7px;background:var(--ok-soft);color:var(--ok);border:1px solid transparent;font-family:'DM Sans',sans-serif;font-weight:660;font-size:11.5px;cursor:pointer;transition:all .15s;letter-spacing:-.005em}
.tt-conn-pill:hover{filter:brightness(.97)}
.tt-conn-pill.offline{background:var(--wr-soft);color:var(--wr)}
.tt-conn-pill svg{width:13px;height:13px}

/* ── WORKER DETAIL HEADER ─────────────────────────────── */
.tt-detail-hdr{display:flex;align-items:center;gap:14px;margin-bottom:6px}

/* ── RESPONSIVE ───────────────────────────────────────── */
@media (max-width:1100px){
  .tt-grid,.tt-detail{grid-template-columns:1fr}
  .tt-detail-rail{position:static}
  .tt-week-grid{grid-template-columns:repeat(2,1fr)}
  .tt-week-day{min-height:120px}
  .tt-kpi-strip{grid-template-columns:repeat(2,1fr)}
  .tt-clock-card{grid-template-columns:1fr;text-align:left}
  .tt-clock-action{align-items:flex-start;flex-direction:row;gap:18px}
}
@media (max-width:720px){
  .tt-sidebar{display:none}
  .tt-main{padding:14px 14px 40px}
  .tt-page-title{font-size:21px}
  .tt-week-grid{grid-template-columns:1fr}
  .tt-running-timer{font-size:34px}
  .tt-modal{padding:18px}
  .tt-team-grid{grid-template-columns:1fr}
}
`;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className={`tt-root${dark ? " tt-dark" : ""}`}>
      <link rel="stylesheet" href={FONTS_URL} />
      <style>{css}</style>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header className="tt-topbar">
        <div className="tt-topbar-left">
          <div className="tt-brand"><LogoMark /> BuiltCRM</div>
          <div className="tt-crumbs">
            <span>{subOrgName}</span>
            <span className="tt-crumbs-sep">›</span>
            <strong>Time Tracking</strong>
          </div>
        </div>
        <div className="tt-topbar-right">
          <div className="tt-role-toggle">
            <button
              className={`tt-role-btn${roleView === "worker" ? " active" : ""}`}
              onClick={() => { setRoleView("worker"); setView("today"); }}
            >
              {I.user} Worker
            </button>
            <button
              className={`tt-role-btn${roleView === "admin" ? " active" : ""}`}
              onClick={() => { setRoleView("admin"); setView("team"); }}
            >
              {I.users} Admin
            </button>
          </div>
          <div
            className={`tt-conn-pill${isOnline ? "" : " offline"}`}
            onClick={() => setIsOnline(!isOnline)}
            title="Click to toggle (demo)"
          >
            {isOnline ? I.cloud : I.cloudOff}
            {isOnline ? "Online" : "Offline · 2 queued"}
          </div>
          <button className="tt-icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">
            {dark ? I.sun : I.moon}
          </button>
          <button className="tt-icon-btn" title="Notifications">
            {I.bell}
            <span className="tt-dot" />
          </button>
          <WorkerAvatar worker={me} size="sm" />
        </div>
      </header>

      <div className="tt-shell">
        {/* ── SIDEBAR ───────────────────────────────────────── */}
        <aside className="tt-sidebar">
          {roleView === "worker" && (
            <>
              <div className="tt-sb-section">My time</div>
              <div
                className={`tt-sb-item${view === "today" ? " active" : ""}`}
                onClick={() => setView("today")}
              >
                {I.clock} Today
                {myRunning && <span className="tt-pulse" title="Running" />}
              </div>
              <div
                className={`tt-sb-item${view === "timesheet" ? " active" : ""}`}
                onClick={() => setView("timesheet")}
              >
                {I.calendar} My timesheet
                <span className="tt-sb-count">{myDraftCount}</span>
              </div>

              <div className="tt-sb-section">Quick actions</div>
              <div
                className="tt-sb-item"
                onClick={() => myRunning ? stopClock() : startClockIn()}
              >
                {myRunning ? I.stop : I.play}
                {myRunning ? "Clock out" : "Clock in"}
              </div>
              <div
                className="tt-sb-item"
                onClick={() => setShowAddEntryModal(true)}
              >
                {I.plus} Manual entry
              </div>

              <div className="tt-sb-section">Reference</div>
              <div className="tt-sb-item">
                {I.history} History
              </div>
              <div className="tt-sb-item">
                {I.download} Export PDF
              </div>
            </>
          )}

          {roleView === "admin" && (
            <>
              <div className="tt-sb-section">Workforce</div>
              <div
                className={`tt-sb-item${view === "team" ? " active" : ""}`}
                onClick={() => { setView("team"); }}
              >
                {I.users} Team
                <span className="tt-sb-count">{workers.length}</span>
              </div>
              <div
                className={`tt-sb-item${view === "approvals" ? " active" : ""}`}
                onClick={() => setView("approvals")}
              >
                {I.check} Approvals
                <span className="tt-sb-count">{pendingApprovalEntries.length}</span>
              </div>
              <div className="tt-sb-section">Active now</div>
              {allRunning.length === 0 && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
                  No one clocked in.
                </div>
              )}
              {allRunning.map(e => {
                const w = getWorkerById(e.userId);
                return (
                  <div
                    key={e.id}
                    className="tt-sb-item"
                    onClick={() => { setSelectedWorkerId(w.id); setView("worker-detail"); }}
                  >
                    <WorkerAvatar worker={w} size="sm" />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                      {w.name.split(" ")[0]}
                    </span>
                    <span className="tt-pulse" />
                  </div>
                );
              })}

              <div className="tt-sb-section">Reference</div>
              <div className="tt-sb-item">{I.history} Audit log</div>
              <div className="tt-sb-item">{I.download} Export payroll</div>
            </>
          )}
        </aside>

        {/* ── MAIN ──────────────────────────────────────────── */}
        <main className="tt-main">

          {/* ════════════════════════════════════════════════ */}
          {/*  WORKER · TODAY                                  */}
          {/* ════════════════════════════════════════════════ */}
          {roleView === "worker" && view === "today" && (
            <>
              <div className="tt-page-hdr">
                <div>
                  <div className="tt-page-title">Hello, {me.name.split(" ")[0]}</div>
                  <div className="tt-page-sub">
                    Wednesday, April 22, 2026 · {myRunning ? "Currently clocked in" : "Not clocked in"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tt-btn" onClick={() => setShowAddEntryModal(true)}>
                    {I.plus} Manual entry
                  </button>
                  <button className="tt-btn" onClick={() => setView("timesheet")}>
                    {I.calendar} My timesheet
                  </button>
                </div>
              </div>

              {/* Clock card — the hero */}
              <div className={`tt-clock-card${myRunning ? " running" : ""}`}>
                <div className="tt-clock-state">
                  <div className="tt-clock-state-label">
                    {myRunning && <span className="tt-running-led" />}
                    {myRunning ? "Currently clocked in" : "Ready to start"}
                  </div>
                  {myRunning ? (
                    <RunningTimer baseMins={myRunningElapsed} />
                  ) : (
                    <div className="tt-idle-hours">
                      {minsToHM(myWeekTotalsByDay[today] || 0)}
                      <span style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 540, marginLeft: 8, fontFamily: "'DM Sans',sans-serif" }}>
                        logged today
                      </span>
                    </div>
                  )}
                  <div className="tt-clock-state-meta">
                    {myRunning && (
                      <>
                        <div className="tt-clock-state-meta-row">
                          {I.building}
                          <ProjectChip projectId={myRunning.projectId} />
                        </div>
                        <div className="tt-clock-state-meta-row">
                          {I.calendar}
                          <span><strong>{getTaskById(myRunning.taskId)?.name}</strong> · started {fmt12(myRunning.clockIn)}</span>
                        </div>
                        {myRunning.gps && (
                          <div className="tt-clock-state-meta-row">
                            {I.pin}
                            <span>GPS captured · <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>{myRunning.gps.lat.toFixed(4)}, {myRunning.gps.lng.toFixed(4)}</span></span>
                          </div>
                        )}
                      </>
                    )}
                    {!myRunning && (
                      <>
                        <div className="tt-clock-state-meta-row">
                          {I.calendar}
                          <span>This week: <strong>{minsToHM(myWeekTotalMins)}</strong> across {myEntriesThisWeek.length} entr{myEntriesThisWeek.length === 1 ? "y" : "ies"}</span>
                        </div>
                        <div className="tt-clock-state-meta-row">
                          {I.user}
                          <span>Last clocked out: <strong>4:22 PM yesterday</strong></span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="tt-clock-action">
                  <button
                    className={`tt-clock-btn ${myRunning ? "stop" : "start"}`}
                    onClick={() => myRunning ? stopClock() : startClockIn()}
                    aria-label={myRunning ? "Clock out" : "Clock in"}
                  >
                    {myRunning ? I.stop : I.play}
                  </button>
                  <span className="tt-clock-btn-label">
                    {myRunning ? "Tap to stop" : "Tap to start"}
                  </span>
                </div>
              </div>

              {/* KPI strip */}
              <div className="tt-kpi-strip">
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Today</div>
                  <div className="tt-kpi-val">
                    {minsToHM(myWeekTotalsByDay[today] || 0).split("h")[0]}
                    <span className="tt-kpi-unit">h {String((myWeekTotalsByDay[today] || 0) % 60).padStart(2, "0")}m</span>
                  </div>
                  <div className="tt-kpi-foot ok">{I.trend} On pace for 8h</div>
                  <div className="tt-kpi-bar" style={{ width: `${Math.min(100, ((myWeekTotalsByDay[today] || 0) / 480) * 100)}%`, background: "var(--ok)" }} />
                </div>
                <div className="tt-kpi">
                  <div className="tt-kpi-key">This week</div>
                  <div className="tt-kpi-val">
                    {Math.floor(myWeekTotalMins / 60)}<span className="tt-kpi-unit">h {myWeekTotalMins % 60}m</span>
                  </div>
                  <div className="tt-kpi-foot">of 40h target ({Math.round((myWeekTotalMins / 2400) * 100)}%)</div>
                  <div className="tt-kpi-bar" style={{ width: `${Math.min(100, (myWeekTotalMins / 2400) * 100)}%` }} />
                </div>
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Drafts to submit</div>
                  <div className="tt-kpi-val">{myDraftCount}</div>
                  <div className="tt-kpi-foot wr">{myDraftCount > 0 ? "Submit before Sun" : "All clear"}</div>
                </div>
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Last week</div>
                  <div className="tt-kpi-val">40<span className="tt-kpi-unit">h 15m</span></div>
                  <div className="tt-kpi-foot ok">{I.check} Submitted Apr 18</div>
                </div>
              </div>

              {/* Today's entries + activity */}
              <div className="tt-grid">
                <div className="tt-card">
                  <div className="tt-card-hdr">
                    <div>
                      <div className="tt-card-title">Today's entries</div>
                      <div className="tt-card-sub">All clock-ins and clock-outs since midnight</div>
                    </div>
                    <button className="tt-btn" onClick={() => setShowAddEntryModal(true)}>
                      {I.plus} Add entry
                    </button>
                  </div>
                  {myTodaysEntries.length === 0 ? (
                    <div className="tt-empty">
                      <div className="tt-empty-icon">{I.clock}</div>
                      <div className="tt-empty-title">No entries yet today</div>
                      <div>Clock in to start tracking your time.</div>
                    </div>
                  ) : (
                    <div className="tt-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                      <table className="tt-table">
                        <thead>
                          <tr>
                            <th style={{ width: 92 }}>Start</th>
                            <th style={{ width: 92 }}>End</th>
                            <th style={{ width: 96 }}>Duration</th>
                            <th>Project / Task</th>
                            <th style={{ width: 110 }}>Status</th>
                            <th style={{ width: 60 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {myTodaysEntries.map(e => {
                            const isRunning = e.status === "running";
                            const dur = isRunning ? myRunningElapsed : (e.minutes || 0);
                            return (
                              <tr key={e.id}>
                                <td><span className="tt-table-time">{fmt12(e.clockIn)}</span></td>
                                <td><span className="tt-table-time">{e.clockOut ? fmt12(e.clockOut) : "—"}</span></td>
                                <td>
                                  {isRunning ? (
                                    <RunningTimer baseMins={dur} />
                                  ) : (
                                    <span className="tt-table-dur">{minsToHM(dur)}</span>
                                  )}
                                </td>
                                <td>
                                  <ProjectChip projectId={e.projectId} size="sm" />
                                  <div className="tt-table-task" style={{ marginTop: 4 }}>
                                    {getTaskById(e.taskId)?.name}
                                  </div>
                                </td>
                                <td><StatusPill status={e.status} /></td>
                                <td>
                                  <div className="tt-table-actions">
                                    {(e.status === "draft" || e.status === "running") ? (
                                      <button className="tt-icon-action" title="Edit">{I.edit}</button>
                                    ) : (
                                      <button className="tt-icon-action" title="Locked" style={{ cursor: "not-allowed", opacity: .5 }}>{I.lock}</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right rail */}
                <div className="tt-detail-rail">
                  <div className="tt-rail-card">
                    <h4>{I.pin} GPS</h4>
                    <div
                      className={`tt-gps-toggle${gpsEnabled ? " on" : ""}`}
                      onClick={() => setGpsEnabled(!gpsEnabled)}
                    >
                      {I.pin}
                      <span className="tt-gps-toggle-text">Capture location on clock-in</span>
                      <span className={`tt-switch${gpsEnabled ? " on" : ""}`} />
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 9, lineHeight: 1.5 }}>
                      Optional. Asks for browser permission once. Your location is only stored at clock-in time, not continuously.
                    </div>
                  </div>

                  <div className="tt-rail-card">
                    <h4>{I.calendar} This week at a glance</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {weekDays.slice(0, 5).map(d => {
                        const m = myWeekTotalsByDay[d.iso] || 0;
                        const isToday = d.iso === today;
                        return (
                          <div key={d.iso} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                            <span style={{ width: 32, fontFamily: "'DM Sans',sans-serif", fontWeight: 660, color: isToday ? "var(--accent)" : "var(--text-secondary)" }}>
                              {d.label}
                            </span>
                            <div style={{ flex: 1, height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, (m / 600) * 100)}%`, height: "100%", background: m > 0 ? (isToday ? "var(--accent)" : "var(--ok)") : "transparent", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: m > 0 ? "var(--text-primary)" : "var(--text-tertiary)", minWidth: 38, textAlign: "right" }}>
                              {m > 0 ? minsToHMSlim(m) : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="tt-rail-card">
                    <h4>{I.alert} Reminders</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, paddingBottom: 8, borderBottom: "1px dashed var(--border)" }}>
                        <strong style={{ color: "var(--text-primary)", fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>Submit weekly timesheet</strong> by Sunday 11:59 PM. Late submissions delay payroll.
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        <strong style={{ color: "var(--text-primary)", fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>Don't forget breaks.</strong> Clock out for lunch and back in — overlapping entries are blocked.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════ */}
          {/*  WORKER · TIMESHEET (week grid)                  */}
          {/* ════════════════════════════════════════════════ */}
          {roleView === "worker" && view === "timesheet" && (
            <>
              <div className="tt-page-hdr">
                <div>
                  <button className="tt-btn ghost" onClick={() => setView("today")} style={{ marginBottom: 8 }}>
                    {I.back} Back to today
                  </button>
                  <div className="tt-page-title">My timesheet</div>
                  <div className="tt-page-sub">
                    Review your week, edit drafts, and submit for approval.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tt-btn">
                    {I.download} Export PDF
                  </button>
                  <button
                    className="tt-btn primary"
                    onClick={() => setShowSubmitModal(true)}
                    disabled={myDraftCount === 0 || weekOffset !== 0}
                  >
                    {I.send} Submit week ({myDraftCount})
                  </button>
                </div>
              </div>

              {/* Week navigator + totals */}
              <div className="tt-week">
                <div className="tt-week-hdr">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="tt-week-nav">
                      <button
                        className="tt-week-nav-btn"
                        onClick={() => setWeekOffset(weekOffset - 1)}
                        disabled={weekOffset <= -1}
                      >
                        {I.chevL}
                      </button>
                      <button
                        className="tt-week-nav-btn"
                        onClick={() => setWeekOffset(weekOffset + 1)}
                        disabled={weekOffset >= 0}
                      >
                        {I.chevR}
                      </button>
                    </div>
                    <div>
                      <div className="tt-week-title">
                        {weekOffset === 0 ? "This week" : "Last week"} · {activeWeekDays[0].display}–{activeWeekDays[activeWeekDays.length - 1]?.display || "Apr 17"}
                      </div>
                      <div className="tt-week-sub">
                        {weekOffset === 0
                          ? `${myEntriesThisWeek.length} entries · ${myDraftCount} draft${myDraftCount === 1 ? "" : "s"}`
                          : "Submitted Apr 18 · Awaiting approval"}
                      </div>
                    </div>
                  </div>
                  <div className="tt-week-totals">
                    <div>
                      <div className="tt-week-total-key">Week total</div>
                      <div className="tt-week-total-val">{minsToHM(myWeekTotalMins)}</div>
                    </div>
                    <div>
                      <div className="tt-week-total-key">Decimal</div>
                      <div className="tt-week-total-val">{minsToDecimal(myWeekTotalMins)}h</div>
                    </div>
                  </div>
                </div>

                <div className="tt-week-grid">
                  {(weekOffset === 0 ? weekDays : [...lastWeekDays, ...weekDays.slice(5)]).slice(0, 7).map(d => {
                    const dayEntries = myEntriesThisWeek.filter(e => e.date === d.iso);
                    const total = myWeekTotalsByDay[d.iso] || 0;
                    const isToday = d.iso === today && weekOffset === 0;
                    const isWeekend = d.label === "Sat" || d.label === "Sun";
                    return (
                      <div key={d.iso} className={`tt-week-day${isToday ? " today" : ""}${isWeekend ? " weekend" : ""}`}>
                        <div className="tt-week-day-hdr">
                          <span className="tt-week-day-name">{d.label}</span>
                          <span className="tt-week-day-num">{d.display.split(" ")[1]}</span>
                          <span className={`tt-week-day-total${total === 0 ? " zero" : ""}`}>
                            {total > 0 ? minsToHMSlim(total) : "—"}
                          </span>
                        </div>
                        <div className="tt-week-entries">
                          {dayEntries.length === 0 ? (
                            <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic", padding: "10px 4px" }}>
                              No entries
                            </div>
                          ) : dayEntries.map(e => (
                            <div key={e.id} className={`tt-week-entry ${e.status}`} title={`${getProjectById(e.projectId)?.name} — ${getTaskById(e.taskId)?.name}`}>
                              <div className="tt-week-entry-row1">
                                <span>{fmt12(e.clockIn)}{e.clockOut ? `–${fmt12(e.clockOut).replace(" AM", "a").replace(" PM", "p")}` : "–now"}</span>
                                <span className="tt-week-entry-dur">
                                  {e.status === "running"
                                    ? <RunningTimer baseMins={myRunningElapsed} />
                                    : minsToHMSlim(e.minutes || 0)}
                                </span>
                              </div>
                              <div className="tt-week-entry-task">
                                {getTaskById(e.taskId)?.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed entries table */}
              <div className="tt-card">
                <div className="tt-card-hdr">
                  <div>
                    <div className="tt-card-title">All entries this week</div>
                    <div className="tt-card-sub">Click a draft to edit. Submitted entries are read-only.</div>
                  </div>
                  <div className="tt-filter-pills">
                    {[
                      { key: "all", label: "All", count: myEntriesThisWeek.length },
                      { key: "draft", label: "Drafts", count: myEntriesThisWeek.filter(e => e.status === "draft").length },
                      { key: "submitted", label: "Submitted", count: myEntriesThisWeek.filter(e => e.status === "submitted").length },
                      { key: "approved", label: "Approved", count: myEntriesThisWeek.filter(e => e.status === "approved").length },
                    ].map(p => (
                      <button
                        key={p.key}
                        className={`tt-filter-pill${statusFilter === p.key ? " active" : ""}`}
                        onClick={() => setStatusFilter(p.key)}
                      >
                        {p.label}
                        <span className="tt-filter-pill-count">{p.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tt-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="tt-table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Date</th>
                        <th style={{ width: 86 }}>Start</th>
                        <th style={{ width: 86 }}>End</th>
                        <th style={{ width: 96 }}>Duration</th>
                        <th>Project / Task</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th style={{ width: 70 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {myEntriesThisWeek
                        .filter(e => statusFilter === "all" || e.status === statusFilter)
                        .sort((a, b) => b.date.localeCompare(a.date) || a.clockIn.localeCompare(b.clockIn))
                        .map(e => {
                          const isRunning = e.status === "running";
                          const dur = isRunning ? myRunningElapsed : (e.minutes || 0);
                          const editable = e.status === "draft" || e.status === "running";
                          return (
                            <tr key={e.id} className={editable ? "clickable" : ""}>
                              <td>
                                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620, fontSize: 12 }}>
                                  {weekDays.find(d => d.iso === e.date)?.label || lastWeekDays.find(d => d.iso === e.date)?.label}
                                </span>
                                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {e.date.slice(5)}
                                </div>
                              </td>
                              <td><span className="tt-table-time">{fmt12(e.clockIn)}</span></td>
                              <td><span className="tt-table-time">{e.clockOut ? fmt12(e.clockOut) : "—"}</span></td>
                              <td>
                                {isRunning ? (
                                  <RunningTimer baseMins={dur} />
                                ) : (
                                  <span className="tt-table-dur">{minsToHM(dur)}</span>
                                )}
                              </td>
                              <td>
                                <ProjectChip projectId={e.projectId} size="sm" />
                                <div className="tt-table-task" style={{ marginTop: 4 }}>
                                  {getTaskById(e.taskId)?.name}
                                </div>
                                {e.notes && (
                                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontStyle: "italic" }}>
                                    {e.notes}
                                  </div>
                                )}
                              </td>
                              <td><StatusPill status={e.status} /></td>
                              <td>
                                <div className="tt-table-actions">
                                  {editable ? (
                                    <button className="tt-icon-action" title="Edit">{I.edit}</button>
                                  ) : (
                                    <button className="tt-icon-action" title="Locked — submitted" style={{ cursor: "not-allowed", opacity: .5 }}>{I.lock}</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════ */}
          {/*  ADMIN · TEAM (all workers, weekly totals)       */}
          {/* ════════════════════════════════════════════════ */}
          {roleView === "admin" && view === "team" && (
            <>
              <div className="tt-page-hdr">
                <div>
                  <div className="tt-page-title">Team timesheets</div>
                  <div className="tt-page-sub">
                    {workers.length} workers · {allRunning.length} clocked in now · {pendingApprovalEntries.length} entries awaiting approval
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tt-btn">{I.download} Export payroll</button>
                  <button
                    className="tt-btn primary"
                    onClick={() => setView("approvals")}
                    disabled={pendingApprovalEntries.length === 0}
                  >
                    {I.check} Review approvals ({pendingApprovalEntries.length})
                  </button>
                </div>
              </div>

              {pendingApprovalEntries.length > 0 && (
                <div className="tt-banner wr">
                  {I.alert}
                  <span>
                    <strong>{pendingApprovalEntries.length} entries</strong> from {[...new Set(pendingApprovalEntries.map(e => e.userId))].length} workers are awaiting your approval. Payroll cutoff is Sunday at 11:59 PM.
                  </span>
                  <button className="tt-btn tt-banner-cta" onClick={() => setView("approvals")}>
                    Review now {I.chevR}
                  </button>
                </div>
              )}

              {/* KPI strip */}
              <div className="tt-kpi-strip">
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Active now</div>
                  <div className="tt-kpi-val">
                    {allRunning.length}<span className="tt-kpi-unit">/ {workers.length}</span>
                  </div>
                  <div className="tt-kpi-foot ok">
                    <span className="tt-pulse" style={{ display: "inline-block" }} />
                    On the clock
                  </div>
                  <div className="tt-kpi-bar" style={{ width: `${(allRunning.length / workers.length) * 100}%`, background: "var(--ok)" }} />
                </div>
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Team week total</div>
                  <div className="tt-kpi-val">
                    {Math.floor(teamWeekData.reduce((a, w) => a + w.total, 0) / 60)}
                    <span className="tt-kpi-unit">h</span>
                  </div>
                  <div className="tt-kpi-foot">across {teamWeekData.filter(w => w.total > 0).length} workers</div>
                  <div className="tt-kpi-bar" style={{ width: "76%" }} />
                </div>
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Pending approval</div>
                  <div className="tt-kpi-val">{pendingApprovalEntries.length}</div>
                  <div className="tt-kpi-foot wr">{rejectedEntries.length} rejected this week</div>
                </div>
                <div className="tt-kpi">
                  <div className="tt-kpi-key">Last week approved</div>
                  <div className="tt-kpi-val">
                    {entries.filter(e => e.status === "approved" && lastWeekDays.some(d => d.iso === e.date)).length}
                    <span className="tt-kpi-unit"> entries</span>
                  </div>
                  <div className="tt-kpi-foot ok">{I.check} Payroll synced Apr 19</div>
                </div>
              </div>

              {/* Week navigator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="tt-week-nav">
                    <button className="tt-week-nav-btn" onClick={() => setWeekOffset(weekOffset - 1)} disabled={weekOffset <= -1}>{I.chevL}</button>
                    <button className="tt-week-nav-btn" onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0}>{I.chevR}</button>
                  </div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "-.012em" }}>
                    {weekOffset === 0 ? "This week" : "Last week"} · {activeWeekDays[0].display}–{activeWeekDays[activeWeekDays.length - 1]?.display || "Apr 17"}
                  </div>
                </div>
                <div className="tt-search">
                  {I.search}
                  <input
                    type="text"
                    placeholder="Search workers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Team grid */}
              <div className="tt-team-grid">
                {teamWeekData
                  .filter(({ worker }) => !search || worker.name.toLowerCase().includes(search.toLowerCase()))
                  .map(({ worker, total, submitted, draft, running, approved, amended, rejected, entries: wEntries }) => {
                  const projectsActive = [...new Set(wEntries.map(e => e.projectId))];
                  const isRunning = running > 0;
                  return (
                    <div
                      key={worker.id}
                      className="tt-team-card"
                      onClick={() => { setSelectedWorkerId(worker.id); setView("worker-detail"); }}
                    >
                      <div className="tt-team-card-hdr">
                        <WorkerAvatar worker={worker} size="lg" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="tt-team-card-name">{worker.name}</div>
                          <div className="tt-team-card-role">{worker.role}</div>
                        </div>
                        <div className="tt-team-card-status">
                          {isRunning ? (
                            <span className="tt-status-pill" style={{ color: "var(--ok)", background: "var(--ok-soft)" }}>
                              <span className="tt-status-dot" style={{ background: "var(--ok)" }} />
                              On clock
                            </span>
                          ) : (
                            <span className="tt-status-pill" style={{ color: "var(--text-tertiary)", background: "var(--surface-2)" }}>
                              <span className="tt-status-dot" style={{ background: "var(--text-tertiary)" }} />
                              Off
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {projectsActive.map(pid => (
                          <ProjectChip key={pid} projectId={pid} size="sm" />
                        ))}
                      </div>

                      <div className="tt-team-card-stat-row">
                        <div>
                          <div className="tt-team-card-hours">{minsToHM(total)}</div>
                          <div className="tt-team-card-hours-sub">{wEntries.length} entries this week</div>
                        </div>
                        <div className="tt-team-card-pills">
                          {submitted > 0 && (
                            <span className="tt-team-card-pill" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
                              {submitted} pending
                            </span>
                          )}
                          {rejected > 0 && (
                            <span className="tt-team-card-pill" style={{ background: "var(--er-soft)", color: "var(--er)" }}>
                              {rejected} rejected
                            </span>
                          )}
                          {approved > 0 && rejected === 0 && submitted === 0 && (
                            <span className="tt-team-card-pill" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                              {I.check} all set
                            </span>
                          )}
                          {amended > 0 && (
                            <span className="tt-team-card-pill" style={{ background: "var(--wr-soft)", color: "var(--wr)" }}>
                              {amended} amended
                            </span>
                          )}
                          {draft > 0 && submitted === 0 && (
                            <span className="tt-team-card-pill" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}>
                              {draft} draft
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════ */}
          {/*  ADMIN · APPROVALS                               */}
          {/* ════════════════════════════════════════════════ */}
          {roleView === "admin" && view === "approvals" && (
            <>
              <div className="tt-page-hdr">
                <div>
                  <button className="tt-btn ghost" onClick={() => setView("team")} style={{ marginBottom: 8 }}>
                    {I.back} Back to team
                  </button>
                  <div className="tt-page-title">Pending approvals</div>
                  <div className="tt-page-sub">
                    Review submitted entries. Approve, reject, or amend with audit trail.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tt-btn">{I.filter} Filter</button>
                  <button
                    className="tt-btn ok"
                    onClick={() => {
                      pendingApprovalEntries.forEach(e => approveEntry(e.id));
                      setShowToast({ kind: "ok", text: `${pendingApprovalEntries.length} entries approved` });
                      setTimeout(() => setShowToast(null), 2400);
                    }}
                    disabled={pendingApprovalEntries.length === 0}
                  >
                    {I.check} Approve all ({pendingApprovalEntries.length})
                  </button>
                </div>
              </div>

              {pendingApprovalEntries.length === 0 ? (
                <div className="tt-card">
                  <div className="tt-empty">
                    <div className="tt-empty-icon">{I.check}</div>
                    <div className="tt-empty-title">All caught up</div>
                    <div>No entries waiting on approval right now.</div>
                  </div>
                </div>
              ) : (
                <div className="tt-table-wrap">
                  <table className="tt-table">
                    <thead>
                      <tr>
                        <th style={{ width: 200 }}>Worker</th>
                        <th style={{ width: 76 }}>Date</th>
                        <th style={{ width: 86 }}>Start</th>
                        <th style={{ width: 86 }}>End</th>
                        <th style={{ width: 96 }}>Duration</th>
                        <th>Project / Task</th>
                        <th style={{ width: 170 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApprovalEntries
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map(e => {
                          const w = getWorkerById(e.userId);
                          return (
                            <tr key={e.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                  <WorkerAvatar worker={w} size="sm" />
                                  <div>
                                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 13 }}>{w.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{w.role}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620, fontSize: 12 }}>
                                  {[...weekDays, ...lastWeekDays].find(d => d.iso === e.date)?.label}
                                </span>
                                <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono',monospace" }}>{e.date.slice(5)}</div>
                              </td>
                              <td><span className="tt-table-time">{fmt12(e.clockIn)}</span></td>
                              <td><span className="tt-table-time">{e.clockOut ? fmt12(e.clockOut) : "—"}</span></td>
                              <td><span className="tt-table-dur">{minsToHM(e.minutes || 0)}</span></td>
                              <td>
                                <ProjectChip projectId={e.projectId} size="sm" />
                                <div className="tt-table-task" style={{ marginTop: 4 }}>{getTaskById(e.taskId)?.name}</div>
                              </td>
                              <td>
                                <div className="tt-table-actions">
                                  <button
                                    className="tt-icon-action"
                                    title="Amend (with audit)"
                                    onClick={() => setShowAmendModal(e.id)}
                                  >
                                    {I.edit}
                                  </button>
                                  <button
                                    className="tt-icon-action danger"
                                    title="Reject"
                                    onClick={() => rejectEntry(e.id)}
                                  >
                                    {I.x}
                                  </button>
                                  <button
                                    className="tt-icon-action ok"
                                    title="Approve"
                                    onClick={() => approveEntry(e.id)}
                                    style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
                                  >
                                    {I.check}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Audit trail */}
              {auditEntries.length > 0 && (
                <div className="tt-card" style={{ marginTop: 18 }}>
                  <div className="tt-card-hdr">
                    <div>
                      <div className="tt-card-title">Recent admin actions</div>
                      <div className="tt-card-sub">Audit trail of amendments, approvals, and rejections.</div>
                    </div>
                  </div>
                  <div className="tt-audit-list">
                    {auditEntries.map(a => (
                      <div key={a.id} className={`tt-audit-item ${a.action}`}>
                        <div className="tt-audit-icon">
                          {a.action === "amended" ? I.edit : a.action === "rejected" ? I.x : I.check}
                        </div>
                        <div className="tt-audit-body">
                          <span className="tt-audit-actor">{a.actorName}</span>
                          <span className="tt-audit-action"> ({a.actorRole}) {a.action} entry <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>{a.entryId}</span></span>
                          <span className="tt-audit-when">{a.at}</span>
                          {a.before !== "—" && (
                            <div className="tt-audit-diff">
                              <span className="tt-audit-diff-from">{a.before}</span>
                              {I.chevR}
                              <span style={{ color: "var(--text-primary)" }}>{a.after}</span>
                            </div>
                          )}
                          {a.reason && (
                            <div className="tt-audit-reason">"{a.reason}"</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════ */}
          {/*  ADMIN · WORKER DETAIL                           */}
          {/* ════════════════════════════════════════════════ */}
          {roleView === "admin" && view === "worker-detail" && selectedWorker && (
            <>
              <div className="tt-page-hdr">
                <div>
                  <button className="tt-btn ghost" onClick={() => setView("team")} style={{ marginBottom: 8 }}>
                    {I.back} Back to team
                  </button>
                  <div className="tt-detail-hdr">
                    <WorkerAvatar worker={selectedWorker} size="lg" />
                    <div>
                      <div className="tt-page-title" style={{ marginBottom: 0 }}>{selectedWorker.name}</div>
                      <div className="tt-page-sub">
                        {selectedWorker.role} · Steel Frame Co. · {selectedWorkerEntries.length} entries this week
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tt-btn">{I.download} Export</button>
                  <button
                    className="tt-btn ok"
                    onClick={() => approveWorkerWeek(selectedWorker.id)}
                    disabled={!selectedWorkerEntries.some(e => e.status === "submitted")}
                  >
                    {I.check} Approve week
                  </button>
                </div>
              </div>

              <div className="tt-detail">
                <div>
                  {/* Week summary tile */}
                  <div className="tt-card" style={{ marginBottom: 18 }}>
                    <div className="tt-card-hdr">
                      <div>
                        <div className="tt-card-title">Week summary</div>
                        <div className="tt-card-sub">{activeWeekDays[0].display}–{activeWeekDays[activeWeekDays.length - 1]?.display || "Apr 17"}</div>
                      </div>
                      <div className="tt-week-totals" style={{ paddingRight: 0 }}>
                        <div>
                          <div className="tt-week-total-key">Total</div>
                          <div className="tt-week-total-val">{minsToHM(selectedWorkerTotal)}</div>
                        </div>
                        <div>
                          <div className="tt-week-total-key">Decimal</div>
                          <div className="tt-week-total-val">{minsToDecimal(selectedWorkerTotal)}h</div>
                        </div>
                      </div>
                    </div>

                    {/* Daily bars */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {activeWeekDays.map(d => {
                        const dayEntries = selectedWorkerEntries.filter(e => e.date === d.iso);
                        const total = dayEntries.reduce((a, e) => a + (e.status === "running" ? (NOW_MINS - timeToMins(e.clockIn)) : (e.minutes || 0)), 0);
                        return (
                          <div key={d.iso} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 80, fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 12.5 }}>
                              {d.label} {d.display.split(" ")[1]}
                            </span>
                            <div style={{ flex: 1, height: 22, background: "var(--surface-2)", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${Math.min(100, (total / 600) * 100)}%`,
                                  height: "100%",
                                  background: total === 0 ? "transparent"
                                    : dayEntries.some(e => e.status === "rejected") ? "var(--er)"
                                    : dayEntries.some(e => e.status === "submitted") ? "var(--info)"
                                    : dayEntries.some(e => e.status === "approved") ? "var(--ok)"
                                    : dayEntries.some(e => e.status === "amended") ? "var(--wr)"
                                    : "var(--accent)",
                                  borderRadius: 5,
                                  transition: "width .4s",
                                }}
                              />
                              {total > 0 && (
                                <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 660, color: "var(--text-primary)" }}>
                                  {minsToHMSlim(total)}
                                </span>
                              )}
                            </div>
                            <span style={{ width: 44, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-tertiary)", textAlign: "right" }}>
                              {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Entries table */}
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Date</th>
                          <th style={{ width: 86 }}>Start</th>
                          <th style={{ width: 86 }}>End</th>
                          <th style={{ width: 96 }}>Duration</th>
                          <th>Project / Task</th>
                          <th style={{ width: 110 }}>Status</th>
                          <th style={{ width: 130 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkerEntries.length === 0 ? (
                          <tr>
                            <td colSpan={7}>
                              <div className="tt-empty" style={{ padding: 28 }}>
                                <div className="tt-empty-title">No entries this week</div>
                              </div>
                            </td>
                          </tr>
                        ) : selectedWorkerEntries
                          .sort((a, b) => a.date.localeCompare(b.date) || a.clockIn.localeCompare(b.clockIn))
                          .map(e => {
                            const isRunning = e.status === "running";
                            const dur = isRunning ? (NOW_MINS - timeToMins(e.clockIn)) : (e.minutes || 0);
                            return (
                              <tr key={e.id}>
                                <td>
                                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620, fontSize: 12 }}>
                                    {[...weekDays, ...lastWeekDays].find(d => d.iso === e.date)?.label}
                                  </span>
                                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono',monospace" }}>{e.date.slice(5)}</div>
                                </td>
                                <td><span className="tt-table-time">{fmt12(e.clockIn)}</span></td>
                                <td><span className="tt-table-time">{e.clockOut ? fmt12(e.clockOut) : "—"}</span></td>
                                <td>
                                  {isRunning ? (
                                    <RunningTimer baseMins={dur} />
                                  ) : (
                                    <span className="tt-table-dur">{minsToHM(dur)}</span>
                                  )}
                                </td>
                                <td>
                                  <ProjectChip projectId={e.projectId} size="sm" />
                                  <div className="tt-table-task" style={{ marginTop: 4 }}>{getTaskById(e.taskId)?.name}</div>
                                  {e.notes && (
                                    <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 3, fontStyle: "italic" }}>{e.notes}</div>
                                  )}
                                </td>
                                <td><StatusPill status={e.status} /></td>
                                <td>
                                  <div className="tt-table-actions">
                                    <button className="tt-icon-action" title="Amend" onClick={() => setShowAmendModal(e.id)}>{I.edit}</button>
                                    {e.status === "submitted" && (
                                      <>
                                        <button className="tt-icon-action danger" title="Reject" onClick={() => rejectEntry(e.id)}>{I.x}</button>
                                        <button className="tt-icon-action ok" title="Approve" onClick={() => approveEntry(e.id)} style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>{I.check}</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right rail */}
                <div className="tt-detail-rail">
                  <div className="tt-rail-card">
                    <h4>{I.user} Worker info</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 7, borderBottom: "1px dashed var(--border)" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Role</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620 }}>{selectedWorker.role}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 7, borderBottom: "1px dashed var(--border)" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Org</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620 }}>{subOrgName}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 7, borderBottom: "1px dashed var(--border)" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Active projects</span>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620 }}>{[...new Set(selectedWorkerEntries.map(e => e.projectId))].length}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>YTD hours</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 540 }}>624h 30m</span>
                      </div>
                    </div>
                  </div>

                  <div className="tt-rail-card">
                    <h4>{I.history} Recent activity</h4>
                    <div className="tt-audit-list">
                      {auditEntries
                        .filter(a => entries.find(e => e.id === a.entryId)?.userId === selectedWorker.id)
                        .map(a => (
                          <div key={a.id} className={`tt-audit-item ${a.action}`} style={{ padding: "8px 10px" }}>
                            <div className="tt-audit-icon" style={{ width: 22, height: 22 }}>
                              {a.action === "amended" ? I.edit : a.action === "rejected" ? I.x : I.check}
                            </div>
                            <div className="tt-audit-body" style={{ fontSize: 11.5 }}>
                              <div>
                                <span className="tt-audit-actor">{a.actorName}</span>
                                <span className="tt-audit-action"> {a.action}</span>
                                <span className="tt-audit-when">{a.at}</span>
                              </div>
                              {a.reason && (
                                <div className="tt-audit-reason" style={{ fontSize: 11.5 }}>"{a.reason}"</div>
                              )}
                            </div>
                          </div>
                        ))}
                      {auditEntries.filter(a => entries.find(e => e.id === a.entryId)?.userId === selectedWorker.id).length === 0 && (
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: 14 }}>
                          No admin actions yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="tt-rail-card">
                    <h4>{I.alert} Compliance</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px dashed var(--border)" }}>
                        <span>Safety orientation</span>
                        <StatusPill status="approved" />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px dashed var(--border)" }}>
                        <span>WSIB clearance</span>
                        <StatusPill status="approved" />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Working at heights</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: "var(--text-tertiary)" }}>Exp. May 14</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  CLOCK-IN MODAL                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showClockInModal && (
        <div className="tt-modal-bg" onClick={() => setShowClockInModal(false)}>
          <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clock in</h3>
            <div className="tt-modal-sub">
              Pick the project and task you're starting on. Notes and GPS are optional.
            </div>
            <div className="tt-modal-fields">
              <div>
                <label className="tt-input-label">Project</label>
                <select
                  className="tt-select"
                  value={pendingProjectId}
                  onChange={(e) => {
                    setPendingProjectId(e.target.value);
                    const firstTask = tasks.find(t => t.projectId === e.target.value);
                    setPendingTaskId(firstTask ? firstTask.id : "");
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.contractor}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tt-input-label">Task <span style={{ color: "var(--text-tertiary)", textTransform: "none", fontWeight: 540, letterSpacing: 0 }}>(optional)</span></label>
                <select
                  className="tt-select"
                  value={pendingTaskId}
                  onChange={(e) => setPendingTaskId(e.target.value)}
                >
                  <option value="">— No specific task —</option>
                  {tasks.filter(t => t.projectId === pendingProjectId).map(t => (
                    <option key={t.id} value={t.id}>{t.code} · {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tt-input-label">Notes <span style={{ color: "var(--text-tertiary)", textTransform: "none", fontWeight: 540, letterSpacing: 0 }}>(optional)</span></label>
                <textarea
                  className="tt-textarea"
                  placeholder="What you're working on, area, conditions…"
                  value={pendingNotes}
                  onChange={(e) => setPendingNotes(e.target.value)}
                />
              </div>
              <div
                className={`tt-gps-toggle${gpsEnabled ? " on" : ""}`}
                onClick={() => setGpsEnabled(!gpsEnabled)}
              >
                {I.pin}
                <span className="tt-gps-toggle-text">Capture GPS at clock-in</span>
                <span className={`tt-switch${gpsEnabled ? " on" : ""}`} />
              </div>
              {!isOnline && (
                <div className="tt-banner wr" style={{ margin: 0 }}>
                  {I.cloudOff}
                  <span>Offline — entry will sync when connection returns.</span>
                </div>
              )}
            </div>
            <div className="tt-modal-foot">
              <button className="tt-btn ghost" onClick={() => setShowClockInModal(false)}>
                Cancel
              </button>
              <button className="tt-btn primary lg" onClick={confirmClockIn}>
                {I.play} Clock in now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  STOP-CLOCK MODAL                                                */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showStopModal && myRunning && (
        <div className="tt-modal-bg" onClick={() => setShowStopModal(false)}>
          <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clock out</h3>
            <div className="tt-modal-sub">
              You'll save this entry as a draft. You can keep editing it until you submit your weekly timesheet.
            </div>

            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".06em", fontFamily: "'DM Sans',sans-serif", fontWeight: 680 }}>This shift</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                  {fmt12(myRunning.clockIn)} → {fmt12(minsToTime(NOW_MINS))}
                </span>
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em", color: "var(--text-primary)", lineHeight: 1, marginBottom: 8 }}>
                {minsToHM(myRunningElapsed)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)" }}>
                <ProjectChip projectId={myRunning.projectId} size="sm" />
                <span>·</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620 }}>{getTaskById(myRunning.taskId)?.name}</span>
              </div>
            </div>

            <div className="tt-modal-fields">
              <div>
                <label className="tt-input-label">Notes <span style={{ color: "var(--text-tertiary)", textTransform: "none", fontWeight: 540, letterSpacing: 0 }}>(optional)</span></label>
                <textarea
                  className="tt-textarea"
                  placeholder="Anything to flag for your admin? Materials used, blockers…"
                  value={stopNotes}
                  onChange={(e) => setStopNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="tt-modal-foot">
              <button className="tt-btn ghost" onClick={() => setShowStopModal(false)}>
                Keep running
              </button>
              <button className="tt-btn danger lg" onClick={confirmStopClock}>
                {I.stop} Clock out · {minsToHM(myRunningElapsed)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  ADD MANUAL ENTRY MODAL (backfill)                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showAddEntryModal && (
        <div className="tt-modal-bg" onClick={() => setShowAddEntryModal(false)}>
          <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add manual entry</h3>
            <div className="tt-modal-sub">
              Backfill a missed punch. Manual entries are flagged for admin review.
            </div>
            <div className="tt-modal-fields">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label className="tt-input-label">Date</label>
                  <input className="tt-input" type="date" defaultValue="2026-04-22" />
                </div>
                <div>
                  <label className="tt-input-label">Start</label>
                  <input className="tt-input" type="time" defaultValue="07:00" />
                </div>
                <div>
                  <label className="tt-input-label">End</label>
                  <input className="tt-input" type="time" defaultValue="16:00" />
                </div>
              </div>
              <div>
                <label className="tt-input-label">Project</label>
                <select className="tt-select" defaultValue="p-river">
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tt-input-label">Task</label>
                <select className="tt-select" defaultValue="t-fl4-deck">
                  <option value="">— No specific task —</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.code} · {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tt-input-label">Reason for manual entry</label>
                <textarea
                  className="tt-textarea"
                  placeholder="e.g., 'Phone died, forgot to clock in.'"
                />
              </div>
              <div className="tt-banner info" style={{ margin: 0 }}>
                {I.alert}
                <span style={{ fontSize: 12.5 }}>Manual entries are flagged in the admin review queue with the reason you provide.</span>
              </div>
            </div>
            <div className="tt-modal-foot">
              <button className="tt-btn ghost" onClick={() => setShowAddEntryModal(false)}>Cancel</button>
              <button
                className="tt-btn primary lg"
                onClick={() => {
                  setShowAddEntryModal(false);
                  setShowToast({ kind: "ok", text: "Manual entry saved as draft" });
                  setTimeout(() => setShowToast(null), 2200);
                }}
              >
                {I.plus} Save entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  SUBMIT WEEK MODAL                                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showSubmitModal && (
        <div className="tt-modal-bg" onClick={() => setShowSubmitModal(false)}>
          <div className="tt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Submit week for approval</h3>
            <div className="tt-modal-sub">
              Once submitted, you can't edit these entries. Your sub admin can amend with audit trail if anything's wrong.
            </div>

            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Week</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>{activeWeekDays[0].display}–Apr 26</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Entries to submit</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>{myDraftCount} draft{myDraftCount === 1 ? "" : "s"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Total hours</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 660, fontSize: 13 }}>{minsToHM(myEntriesThisWeek.filter(e => e.status === "draft").reduce((a, e) => a + (e.minutes || 0), 0))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Approver</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660 }}>Marcus Chen (Sub admin)</span>
              </div>
            </div>

            {myRunning && (
              <div className="tt-banner wr" style={{ marginBottom: 14 }}>
                {I.alert}
                <span style={{ fontSize: 12.5 }}>You're still clocked in. Your running entry won't be included in this submission.</span>
              </div>
            )}

            <div className="tt-modal-foot">
              <button className="tt-btn ghost" onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button className="tt-btn primary lg" onClick={submitWeek}>
                {I.send} Submit {myDraftCount} entries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  AMEND MODAL (admin only)                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showAmendModal && (() => {
        const e = entries.find(x => x.id === showAmendModal);
        if (!e) return null;
        const w = getWorkerById(e.userId);
        return (
          <div className="tt-modal-bg" onClick={() => setShowAmendModal(null)}>
            <div className="tt-modal" onClick={(ev) => ev.stopPropagation()}>
              <h3>Amend entry</h3>
              <div className="tt-modal-sub">
                Editing a submitted entry creates an audit record. The worker will be notified.
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, marginBottom: 14 }}>
                <WorkerAvatar worker={w} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 13 }}>{w.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    {e.date} · entry <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{e.id}</span>
                  </div>
                </div>
                <StatusPill status={e.status} />
              </div>

              <div className="tt-modal-fields">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="tt-input-label">Start</label>
                    <input className="tt-input" type="time" defaultValue={e.clockIn} />
                  </div>
                  <div>
                    <label className="tt-input-label">End</label>
                    <input className="tt-input" type="time" defaultValue={e.clockOut || "16:00"} />
                  </div>
                </div>
                <div>
                  <label className="tt-input-label">Project</label>
                  <select className="tt-select" defaultValue={e.projectId}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="tt-input-label">Reason for amendment <span style={{ color: "var(--er)", textTransform: "none", fontWeight: 540, letterSpacing: 0 }}>(required)</span></label>
                  <textarea
                    className="tt-textarea"
                    placeholder="e.g., 'Worker forgot to clock out, corrected per text confirmation.'"
                  />
                </div>
              </div>

              <div className="tt-modal-foot">
                <button className="tt-btn ghost" onClick={() => setShowAmendModal(null)}>Cancel</button>
                <button
                  className="tt-btn primary lg"
                  onClick={() => {
                    setEntries(prev => prev.map(x => x.id === showAmendModal ? { ...x, status: "amended" } : x));
                    setShowAmendModal(null);
                    setShowToast({ kind: "ok", text: "Entry amended · audit record created" });
                    setTimeout(() => setShowToast(null), 2400);
                  }}
                >
                  {I.edit} Save amendment
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  TOASTS                                                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showClockInToast && (
        <div className="tt-toast ok">
          {I.check} Clocked in successfully
        </div>
      )}
      {showSubmittedToast && (
        <div className="tt-toast ok">
          {I.send} Week submitted for approval
        </div>
      )}
      {showToast && (
        <div className={`tt-toast ${showToast.kind || ""}`}>
          {showToast.kind === "ok" ? I.check : showToast.kind === "wr" ? I.alert : I.check}
          {showToast.text}
        </div>
      )}

    </div>
  );
}
