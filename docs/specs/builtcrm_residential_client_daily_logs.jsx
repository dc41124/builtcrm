import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  chev: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  chevL: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevR: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  cloud: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  cloudRain: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25"/></svg>,
  cloudSun: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2M5.64 5.64l1.41 1.41M2 12h2M20 12h2M17 5.64l-1.41 1.41M5 16a5 5 0 108-4"/></svg>,
  sunL: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  camera: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  heart: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  sparkle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
  flag: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
};

// ── Logo Mark ───────────────────────────────────────────────────
const Logo = ({ s = 30 }) => (
  <div style={{ width: s, height: s, borderRadius: s * 0.27, background: "linear-gradient(135deg,#1d5249,var(--ac))", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.6} height={s * 0.6}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Sidebar Nav Data ────────────────────────────────────────────
const navSections = [
  { title: "Your Project", items: [
    { label: "Home" },
    { label: "Progress" },
    { label: "Journal", active: true },
  ]},
  { title: "Decisions", items: [
    { label: "Decisions", badge: 2, badgeType: "warn" },
    { label: "Your Selections", badge: 1 },
    { label: "Scope Changes" },
  ]},
  { title: "Records", items: [
    { label: "Documents" },
    { label: "Photos" },
  ]},
  { title: "Money", items: [
    { label: "Payments" },
    { label: "Invoices" },
  ]},
  { title: "Messages", items: [
    { label: "Inbox", badge: 3 },
  ]},
];

// ── Page Data ───────────────────────────────────────────────────
const project = { name: "Wilson Lane Residence", id: "PRJ-1104", phase: "Framing & rough-in", startDate: "Feb 3, 2026", targetMoveIn: "Nov 15, 2026", pctComplete: 38 };

// Journal entries — friendly tone, photo-first. Skip to recent.
const journalEntries = [
  {
    id: "JL-0041",
    date: "Thursday, April 17",
    dateShort: "Apr 17",
    weather: { icon: "sun", label: "Sunny, 16°" },
    heroTitle: "East wing electrical finished — big milestone!",
    summary: "The electrical crew wrapped up the east-side rough-in today, and the inspector is booked for Friday morning. Plumbing started on the second floor, and the drywall arrived and is staged inside. Everything stayed on schedule.",
    highlights: [
      "East wing electrical rough-in complete",
      "Plumbing started on the second floor",
      "Drywall delivered and staged indoors",
    ],
    milestone: "Ready for electrical inspection",
    mood: "great",
    photos: 8,
    heroPhoto: "East hallway, roughed-in electrical and ready for inspection",
    teamNote: "The framing is looking fantastic — you'll love seeing it in person on the next walkthrough.",
    teamMember: "Sarah Kim, Project Manager",
  },
  {
    id: "JL-0040",
    date: "Tuesday, April 15",
    dateShort: "Apr 15",
    weather: { icon: "rain", label: "Light rain, 10°" },
    heroTitle: "Panel room wrapped up indoors",
    summary: "Rainy day, so we kept work inside. The main panel room was finished up and the drywall team hung boards on the west side, levels 2 and 3. Small pause on the outside caulking — we'll pick that back up tomorrow.",
    highlights: [
      "Main electrical panel complete",
      "Drywall hung — west side",
      "Outside work paused for rain",
    ],
    milestone: null,
    mood: "good",
    photos: 5,
    heroPhoto: "Finished electrical panel room, ready for cover plate",
    weatherNote: true,
  },
  {
    id: "JL-0039",
    date: "Friday, April 12",
    dateShort: "Apr 12",
    weather: { icon: "sun", label: "Sunny, 18°" },
    heroTitle: "Inspector visit went perfectly",
    summary: "Full crew on site all day, and our inspector stopped by around 11 AM for a pre-inspection walkthrough — everything passed! This sets us up well for the official inspection next week.",
    highlights: [
      "Pre-inspection passed",
      "Full crew day — all trades active",
      "On track for Friday's formal inspection",
    ],
    milestone: "Pre-inspection passed",
    mood: "great",
    photos: 12,
    heroPhoto: "Inspector walkthrough — panel room cleared",
    teamNote: "This is a really good sign. The inspector noted how clean the work is.",
    teamMember: "Daniel Chen, Site Superintendent",
  },
  {
    id: "JL-0038",
    date: "Thursday, April 11",
    dateShort: "Apr 11",
    weather: { icon: "cloudSun", label: "Partly cloudy, 15°" },
    heroTitle: "Slab repair cured, framing continues",
    summary: "The slab repair we poured earlier this week cured overnight — ready to build on. Framing kept moving on the west side. During today's walkthrough we noted 4 small items for the punch list. Nothing that will slow us down.",
    highlights: [
      "Slab repair cured and ready",
      "West-side framing progress",
      "4 items added to punch list (minor)",
    ],
    milestone: null,
    mood: "good",
    photos: 9,
    heroPhoto: "West-side framing at end of day",
  },
  {
    id: "JL-0037",
    date: "Wednesday, April 10",
    dateShort: "Apr 10",
    weather: { icon: "sun", label: "Sunny, 17°" },
    heroTitle: "Electrical rough-in starts!",
    summary: "The electrical crew started their rough-in on the east side today. HVAC crew finished their coordination walkthrough, so we're clear to start running trunk lines early next week.",
    highlights: [
      "Electrical rough-in started",
      "HVAC coordination wrapped",
    ],
    milestone: "Electrical rough-in begins",
    mood: "good",
    photos: 7,
    heroPhoto: "East-side first electrical runs",
  },
];

// Weather icon helper
const weatherIcon = (k) => k === "rain" ? I.cloudRain : k === "cloud" ? I.cloud : k === "cloudSun" ? I.cloudSun : I.sunL;

// Mood indicator
const moodMap = {
  great: { label: "Great day", icon: I.sparkle, color: "ok" },
  good: { label: "Good day", icon: I.heart, color: "accent" },
  slow: { label: "Slow day", icon: null, color: "warn" },
};

// ── Component ───────────────────────────────────────────────────
export default function ResidentialClientDailyLogs() {
  const [dark, setDark] = useState(false);
  const [expanded, setExpanded] = useState(journalEntries[0].id);
  const [photoModal, setPhotoModal] = useState(null); // { entry, idx } | null
  const [collapsed, setCollapsed] = useState({});

  const toggleSection = (title) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));

  return (
    <div className={`root ${dark ? "dk" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.root{
  --s0:#edf1ef;--s1:#fff;--s2:#f3f5f4;--s3:#e0e6e3;--s4:#cfd6d2;
  --sh:#f5f7f6;--sic:#f8faf9;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;--ti:#faf9f7;
  --ac:#2a7f6f;--ac-h:#236a5b;--ac-s:#e4f2ee;--ac-t:#1f5e52;--ac-m:#a6cec4;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;--r-xxl:22px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);--shlg:0 16px 48px rgba(26,23,20,.14);
  --sbw:256px;--tbh:56px;
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.55;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.root.dk{
  --s0:#0d1210;--s1:#171f1c;--s2:#1e2724;--s3:#2a3430;--s4:#3a4540;
  --sh:#222b28;--sic:#1e2724;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#4fa795;--ac-h:#5fb8a6;--ac-s:#153028;--ac-t:#7cc7b6;--ac-m:#2e5a50;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);--shlg:0 16px 48px rgba(0,0,0,.5);
}
*,*::before,*::after{box-sizing:border-box;margin:0}

/* ── Sidebar ─────────────────────────────────────── */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand-txt h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.brand-txt p{font-size:11.5px;color:var(--t3);line-height:1.2;margin-top:1px}

.s-search{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0;position:relative}
.s-search svg{position:absolute;left:28px;top:50%;transform:translateY(-50%);color:var(--t3)}
.s-input{width:100%;height:34px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px 0 34px;background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
.s-input:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(42,127,111,.15)}
.s-input::placeholder{color:var(--t3)}

.s-nav{flex:1;overflow-y:auto;padding:8px 12px 24px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-track{background:transparent}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

.ns{margin-bottom:4px}
.ns-h{display:flex;align-items:center;gap:6px;padding:8px;font-family:var(--fd);font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;cursor:pointer;border-radius:var(--r-s);user-select:none}
.ns-h:hover{background:var(--sh)}
.ns-chv{transition:transform var(--dn) var(--e)}
.ns-chv.closed{transform:rotate(-90deg)}

.ni{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px 6px 12px;border-radius:var(--r-m);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;transition:all var(--df) var(--e);margin-bottom:1px;position:relative}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--s0);color:var(--t1);font-weight:620}
.ni.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:0 3px 3px 0;background:var(--ac)}
.ni-badge{min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0;background:var(--ac-s);color:var(--ac-t)}
.ni-badge.warn{background:var(--wr-s);color:var(--wr-t)}
.ni-badge.danger{background:var(--dg-s);color:var(--dg-t)}

.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--r-m);cursor:pointer}
.s-user:hover{background:var(--sh)}
.u-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),#1d5249);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11.5px;font-weight:700;flex-shrink:0}
.u-name{font-family:var(--fd);font-size:13px;font-weight:580}
.u-role{font-size:11px;color:var(--t3);margin-top:1px}

/* ── Main area ───────────────────────────────────── */
.mn{display:flex;flex-direction:column;min-width:0}
.topbar{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(237,241,239,.85);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.root.dk .topbar{background:rgba(23,31,28,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:580;color:var(--t3)}
.bc .sep{color:var(--s4)}.bc .cur{color:var(--t1);font-weight:720}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:32px;height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;transition:all var(--df) var(--e);cursor:pointer}
.ib:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:720}

/* ── Content ─────────────────────────────────────── */
.ct{padding:28px 32px;flex:1;overflow-y:auto;max-width:1060px;margin:0 auto;width:100%}

/* Page header — warmer, larger, more spacious */
.ph-head{margin-bottom:22px}
.ph-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;color:var(--t1)}
.ph-desc{font-size:14px;color:var(--t2);margin-top:6px;max-width:620px;font-weight:520;line-height:1.6}

/* Progress strip — residential-friendly, not dense KPI grid */
.prog{display:grid;grid-template-columns:1fr auto;gap:20px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xxl);padding:18px 22px;margin-bottom:22px;box-shadow:var(--shsm);align-items:center}
.prog-l{display:flex;flex-direction:column;gap:2px}
.prog-phase{font-family:var(--fd);font-size:10.5px;font-weight:720;color:var(--ac-t);text-transform:uppercase;letter-spacing:.06em}
.prog-title{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);letter-spacing:-.01em;margin-top:3px}
.prog-meta{font-size:12.5px;color:var(--t2);margin-top:4px;font-weight:540}
.prog-bar{width:280px;height:8px;background:var(--s2);border-radius:999px;overflow:hidden;position:relative;margin-top:10px}
.prog-bar-fill{height:100%;background:linear-gradient(90deg,var(--ac),#3fa792);border-radius:999px;transition:width var(--dn) var(--e)}
.prog-pct{font-family:var(--fd);font-size:36px;font-weight:820;color:var(--ac);letter-spacing:-.04em;line-height:1}
.prog-pct-label{font-size:11.5px;color:var(--t2);font-weight:540;text-align:right;margin-top:4px}

/* Section header for the journal */
.jh{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
.jh-t{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);letter-spacing:-.01em}
.jh-c{font-size:12.5px;color:var(--t3);margin-top:3px;font-weight:540}
.jh-actions{display:flex;gap:8px}

.btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:12.5px;font-weight:640;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;cursor:pointer}
.btn:hover{background:var(--sh);border-color:var(--s4)}
.btn.pri{background:var(--ac);color:white;border-color:var(--ac)}
.btn.pri:hover{background:var(--ac-h)}
.btn.ghost{background:transparent;border-color:transparent;color:var(--t2)}
.btn.ghost:hover{background:var(--sh);color:var(--t1)}
.btn svg{width:14px;height:14px;flex-shrink:0}

/* Timeline of journal entries */
.timeline{display:flex;flex-direction:column;gap:16px;position:relative;padding-left:22px}
.timeline::before{content:'';position:absolute;left:8px;top:12px;bottom:12px;width:2px;background:var(--s3);border-radius:2px}

/* Entry card */
.e-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xxl);overflow:hidden;transition:all var(--dn) var(--e);position:relative}
.e-card::before{content:'';position:absolute;left:-22px;top:24px;width:14px;height:14px;border-radius:50%;background:var(--ac);border:3px solid var(--s0);box-shadow:0 0 0 2px var(--ac-m)}
.e-card.great::before{background:var(--ok);box-shadow:0 0 0 2px color-mix(in srgb,var(--ok) 40%,transparent)}
.e-card.first::before{background:var(--ac);box-shadow:0 0 0 2px var(--ac-m),0 0 0 6px color-mix(in srgb,var(--ac) 20%,transparent)}
.e-card:hover{box-shadow:var(--shmd);border-color:var(--s4)}
.e-card.open{box-shadow:var(--shmd)}

/* Hero header (the "card face") */
.e-hero{display:grid;grid-template-columns:1fr 1.2fr;min-height:240px;cursor:pointer}
.e-hero.compact{grid-template-columns:1fr;min-height:auto}
.e-hero-body{padding:20px 24px;display:flex;flex-direction:column;justify-content:center;gap:10px}
.e-date-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.e-date{font-family:var(--fd);font-size:11px;font-weight:720;color:var(--ac-t);text-transform:uppercase;letter-spacing:.06em}
.e-mood{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:700;font-family:var(--fd)}
.e-mood.ok{background:var(--ok-s);color:var(--ok-t)}
.e-mood.accent{background:var(--ac-s);color:var(--ac-t)}
.e-mood.warn{background:var(--wr-s);color:var(--wr-t)}
.e-wx{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--t2);font-weight:540}
.e-title{font-family:var(--fd);font-size:20px;font-weight:760;color:var(--t1);letter-spacing:-.02em;line-height:1.25}
.e-title.small{font-size:17px}
.e-summary{font-size:13.5px;color:var(--t2);line-height:1.6;font-weight:520}

.e-hero-photo{background:linear-gradient(135deg,var(--s2),var(--s3));display:grid;place-items:center;color:var(--t3);position:relative;min-height:240px;overflow:hidden}
.e-hero-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(0,0,0,.35) 100%);pointer-events:none}
.root.dk .e-hero-photo{background:linear-gradient(135deg,#1e2724,#2a3430)}
.e-hero-photo-caption{position:absolute;left:16px;right:16px;bottom:14px;font-family:var(--fd);font-size:12px;font-weight:620;color:white;z-index:1;line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.e-photo-count{position:absolute;top:14px;right:14px;background:rgba(0,0,0,.45);color:white;padding:5px 11px;border-radius:999px;font-family:var(--fd);font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;backdrop-filter:blur(8px);z-index:1}

/* Expanded content */
.e-expand{padding:0 24px 22px;display:flex;flex-direction:column;gap:18px;border-top:1px solid var(--s3)}
.e-expand-inner{padding-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:20px}

.e-block-t{font-family:var(--fd);font-size:10.5px;font-weight:720;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.e-hl{display:flex;flex-direction:column;gap:8px}
.e-hl-item{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--t1);font-weight:540;line-height:1.5}
.e-hl-item::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--ac);margin-top:7px;flex-shrink:0}

.e-milestone{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--r-l);background:var(--ok-s);border:1px solid color-mix(in srgb,var(--ok) 25%,var(--s3));color:var(--ok-t);font-size:13px;font-weight:640;margin-top:8px}
.e-milestone svg{flex-shrink:0}

.e-team-note{padding:14px 16px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);color:var(--ac-t);font-size:13px;font-style:italic;line-height:1.6;font-weight:540;position:relative}
.e-team-note::before{content:"\\201C";font-family:var(--fd);font-size:36px;color:var(--ac-m);position:absolute;top:-4px;left:10px;line-height:1;font-style:normal}
.e-team-note-body{padding-left:14px}
.e-team-sig{display:block;margin-top:8px;font-family:var(--fd);font-size:11.5px;color:var(--ac-t);font-weight:680;font-style:normal;letter-spacing:.01em}

/* Photo grid (expanded) */
.ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ph-tile{aspect-ratio:1/1;background:linear-gradient(135deg,var(--s2),var(--s3));border-radius:var(--r-m);border:1px solid var(--s3);display:grid;place-items:center;color:var(--t3);cursor:pointer;transition:all var(--df) var(--e);overflow:hidden;position:relative}
.ph-tile:hover{border-color:var(--ac);transform:translateY(-1px);box-shadow:var(--shsm)}
.ph-tile svg{width:20px;height:20px}
.ph-tile .ph-num{position:absolute;bottom:4px;right:6px;font-family:var(--fd);font-size:9.5px;font-weight:700;color:var(--t3);background:rgba(255,255,255,.82);padding:1px 5px;border-radius:4px}
.root.dk .ph-tile .ph-num{background:rgba(0,0,0,.55);color:var(--t2)}

/* Entry footer */
.e-foot{padding:10px 24px;border-top:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;background:var(--sic)}
.e-foot-meta{font-size:11.5px;color:var(--t3);font-weight:540;display:inline-flex;align-items:center;gap:6px}
.e-foot-actions{display:flex;gap:6px}

/* Load more */
.load-more{display:flex;justify-content:center;margin-top:24px;padding-bottom:24px}

/* Photo lightbox */
.lb-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);z-index:100;display:grid;place-items:center;padding:32px}
.lb{background:var(--s1);border-radius:var(--r-xxl);max-width:900px;width:100%;max-height:calc(100vh - 64px);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shlg)}
.lb-h{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--s3)}
.lb-t{font-family:var(--fd);font-size:14px;font-weight:720}
.lb-c{font-size:12px;color:var(--t3);font-weight:540;margin-top:2px}
.lb-img{aspect-ratio:16/10;background:linear-gradient(135deg,var(--s2),var(--s3));display:grid;place-items:center;color:var(--t3);font-size:13px;font-weight:540}
.root.dk .lb-img{background:linear-gradient(135deg,#1e2724,#2a3430)}
.lb-f{padding:14px 20px;display:flex;gap:8px;border-top:1px solid var(--s3);align-items:center}

/* Responsive */
@media (max-width: 860px){
  .e-hero{grid-template-columns:1fr}
  .e-expand-inner{grid-template-columns:1fr}
  .prog{grid-template-columns:1fr}
  .prog-bar{width:100%}
}
      `}</style>

      {/* ── Sidebar ────────────────────────────────── */}
      <aside className="side">
        <div className="brand">
          <Logo s={30}/>
          <div className="brand-txt">
            <h1>BuiltCRM</h1>
            <p>Home Portal</p>
          </div>
        </div>
        <div className="s-search">
          {I.search}
          <input className="s-input" placeholder="Search your project..." />
        </div>
        <nav className="s-nav">
          {navSections.map((sec) => {
            const isClosed = !!collapsed[sec.title];
            return (
              <div key={sec.title} className="ns">
                <div className="ns-h" onClick={() => toggleSection(sec.title)}>
                  <span className={`ns-chv ${isClosed ? "closed" : ""}`}>{I.chev}</span>
                  {sec.title}
                </div>
                {!isClosed && sec.items.map((it) => (
                  <div key={it.label} className={`ni ${it.active ? "on" : ""}`}>
                    <span>{it.label}</span>
                    {it.badge && <span className={`ni-badge ${it.badgeType || ""}`}>{it.badge}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="s-foot">
          <div className="s-user">
            <div className="u-av">JW</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="u-name">Jamie Wilson</div>
              <div className="u-role">Wilson Lane Residence</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────── */}
      <div className="mn">
        <header className="topbar">
          <div className="bc">
            <span>Your Project</span><span className="sep">/</span>
            <span className="cur">Journal</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}>{dark ? I.sun : I.moon}</button>
            <button className="ib" title="Notifications">{I.bell}</button>
            <div className="av">JW</div>
          </div>
        </header>

        <main className="ct">
          {/* Page header */}
          <div className="ph-head">
            <h1 className="ph-title">Project Journal</h1>
            <p className="ph-desc">
              Your day-by-day look at progress on Wilson Lane. Each entry includes photos from site, a short
              summary from your project team, and any notable milestones we've hit.
            </p>
          </div>

          {/* Progress strip */}
          <div className="prog">
            <div className="prog-l">
              <span className="prog-phase">Current phase</span>
              <div className="prog-title">{project.phase}</div>
              <div className="prog-meta">Started {project.startDate} · Estimated move-in {project.targetMoveIn}</div>
              <div className="prog-bar">
                <div className="prog-bar-fill" style={{ width: `${project.pctComplete}%` }}/>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="prog-pct">{project.pctComplete}%</div>
              <div className="prog-pct-label">complete</div>
            </div>
          </div>

          {/* Journal header */}
          <div className="jh">
            <div>
              <div className="jh-t">Recent entries</div>
              <div className="jh-c">{journalEntries.length} entries · showing latest first</div>
            </div>
            <div className="jh-actions">
              <button className="btn">{I.download} Download as PDF</button>
            </div>
          </div>

          {/* Timeline */}
          <div className="timeline">
            {journalEntries.map((e, i) => {
              const isOpen = expanded === e.id;
              const mood = moodMap[e.mood];
              return (
                <article key={e.id} className={`e-card ${e.mood === "great" ? "great" : ""} ${i === 0 ? "first" : ""} ${isOpen ? "open" : ""}`}>
                  <div
                    className="e-hero"
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                  >
                    <div className="e-hero-body">
                      <div className="e-date-line">
                        <span className="e-date">{e.date}</span>
                        {mood && <span className={`e-mood ${mood.color}`}>{mood.icon}{mood.label}</span>}
                        <span className="e-wx">{weatherIcon(e.weather.icon)} {e.weather.label}</span>
                      </div>
                      <div className={`e-title ${!isOpen ? "small" : ""}`}>{e.heroTitle}</div>
                      <p className="e-summary">{e.summary}</p>
                    </div>
                    <div className="e-hero-photo">
                      {I.camera}
                      <span className="e-photo-count">{I.camera} {e.photos}</span>
                      <div className="e-hero-photo-caption">{e.heroPhoto}</div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="e-expand">
                      <div className="e-expand-inner">
                        <div>
                          <div className="e-block-t">What happened</div>
                          <div className="e-hl">
                            {e.highlights.map((h, idx) => (
                              <div key={idx} className="e-hl-item">{h}</div>
                            ))}
                          </div>
                          {e.milestone && (
                            <div className="e-milestone">{I.flag} {e.milestone}</div>
                          )}
                        </div>

                        <div>
                          <div className="e-block-t">Photos from site ({e.photos})</div>
                          <div className="ph-grid">
                            {Array.from({ length: Math.min(e.photos, 8) }, (_, idx) => (
                              <div key={idx} className="ph-tile" onClick={() => setPhotoModal({ entry: e, idx })}>
                                {I.camera}
                                <span className="ph-num">{idx + 1}</span>
                              </div>
                            ))}
                          </div>
                          {e.photos > 8 && (
                            <button className="btn ghost" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>
                              View all {e.photos} photos
                            </button>
                          )}
                        </div>
                      </div>

                      {e.teamNote && (
                        <div className="e-team-note">
                          <div className="e-team-note-body">
                            {e.teamNote}
                            <span className="e-team-sig">— {e.teamMember}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="e-foot">
                    <span className="e-foot-meta">{I.camera} {e.photos} photos · Entry {e.dateShort}</span>
                    <div className="e-foot-actions">
                      <button className="btn ghost" onClick={() => setExpanded(isOpen ? null : e.id)}>
                        {isOpen ? "Collapse" : "Read more"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="load-more">
            <button className="btn">Load earlier entries</button>
          </div>
        </main>
      </div>

      {/* ── Photo lightbox ──────────────────────── */}
      {photoModal && (
        <div className="lb-backdrop" onClick={() => setPhotoModal(null)}>
          <div className="lb" onClick={(ev) => ev.stopPropagation()}>
            <div className="lb-h">
              <div>
                <div className="lb-t">Photo {photoModal.idx + 1} of {photoModal.entry.photos}</div>
                <div className="lb-c">{photoModal.entry.date} · Wilson Lane Residence</div>
              </div>
              <button className="ib" onClick={() => setPhotoModal(null)}>{I.x}</button>
            </div>
            <div className="lb-img">
              {I.camera}&nbsp;&nbsp;{photoModal.entry.heroPhoto}
            </div>
            <div className="lb-f">
              <button
                className="btn"
                onClick={() => setPhotoModal({ ...photoModal, idx: Math.max(0, photoModal.idx - 1) })}
                disabled={photoModal.idx === 0}
              >
                {I.chevL} Previous
              </button>
              <button
                className="btn"
                onClick={() => setPhotoModal({ ...photoModal, idx: Math.min(photoModal.entry.photos - 1, photoModal.idx + 1) })}
                disabled={photoModal.idx === photoModal.entry.photos - 1}
              >
                Next {I.chevR}
              </button>
              <div style={{ flex: 1 }}/>
              <button className="btn">{I.download} Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
