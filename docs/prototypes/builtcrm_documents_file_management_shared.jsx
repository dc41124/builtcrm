import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  upload: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  folder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  drawing: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>,
  doc: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  spec: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>,
  shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>,
  lock: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  globe: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>,
  eye: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  user: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  link: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  download: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  share: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  sort: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
  dot: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="1"/></svg>,
  img: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 00-2.828 0L6 21"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  contract: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>,
  permit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  meeting: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  flag: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
};

// ── Logo ────────────────────────────────────────────────────────
const Logo = ({ s = 32 }) => (
  <div style={{ width: s, height: s, borderRadius: 10, background: "linear-gradient(135deg,#1a1714,#3d3830)", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <svg viewBox="0 0 80 80" width={s * 0.55} height={s * 0.55}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="#faf9f7" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="#faf9f7" opacity=".95"/>
    </svg>
  </div>
);

// ── Portal/nav config ───────────────────────────────────────────
const navData = {
  gc: [
    { section: "Overview", items: [{ label: "Dashboard" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 3 },
      { label: "Change Orders", badge: 2, bt: "warn" }, { label: "Approvals", badge: 4 },
      { label: "Billing / Draws" }, { label: "Compliance", badge: 1, bt: "warn" },
      { label: "Upload Requests", badge: 2 }, { label: "Selections" },
      { label: "Documents", active: true }, { label: "Schedule" }, { label: "Messages", badge: 3 },
    ]},
    { section: "Organization", items: [{ label: "Subcontractors" }, { label: "Clients" }, { label: "Team" }] },
  ],
  sub: [
    { section: "Your Projects", items: [{ label: "Today Board" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 2, bt: "danger" },
      { label: "Upload Requests", badge: 1 }, { label: "Compliance", badge: 1, bt: "warn" },
      { label: "Documents", active: true }, { label: "Payments" }, { label: "Schedule" },
      { label: "Messages", badge: 1 },
    ]},
  ],
};
const portalMeta = {
  gc: { label: "Contractor Portal", project: "Riverside Tower Fit-Out", page: "Documents", user: "DC", name: "Dan Carter", role: "Project Manager" },
  sub: { label: "Subcontractor Portal", project: "Riverside Tower Fit-Out", page: "Documents", user: "AM", name: "Alex Morgan", role: "Meridian MEP" },
};

// ── Categories ──────────────────────────────────────────────────
const categories = [
  { id: "all", label: "All Documents", icon: "folder", count: 47, group: null },
  { id: "drawings", label: "Drawings / Plans", icon: "drawing", count: 14, group: "Construction" },
  { id: "specs", label: "Specifications", icon: "spec", count: 8, group: "Construction" },
  { id: "submittals", label: "Submittals", icon: "doc", count: 5, group: "Construction" },
  { id: "contracts", label: "Contracts", icon: "contract", count: 3, group: "Administration" },
  { id: "insurance", label: "Insurance / Compliance", icon: "shield", count: 4, group: "Administration" },
  { id: "permits", label: "Permits", icon: "permit", count: 3, group: "Administration" },
  { id: "minutes", label: "Meeting Minutes", icon: "meeting", count: 3, group: "Administration" },
  { id: "safety", label: "Safety Plans", icon: "shield", count: 2, group: "Administration" },
  { id: "closeout", label: "Closeout", icon: "flag", count: 2, group: "Administration" },
];

const catIcons = { folder: I.folder, drawing: I.drawing, spec: I.spec, doc: I.doc, contract: I.contract, shield: I.shield, permit: I.permit, meeting: I.meeting, flag: I.flag };

// ── File data ───────────────────────────────────────────────────
const gcFiles = [
  { id: 1, title: "A-201 Floor Plan Level 12 \u2014 Rev C", ext: ".dwg \u00b7 v3", icon: "dwg", vis: "project", visLabel: "Project-Wide", linked: "CO-003", linkType: "co", status: "active", size: "4.2 MB", date: "Apr 10, 2026", uploader: "Dan Carter" },
  { id: 2, title: "MEP Coordination Meeting \u2014 Apr 8", ext: ".pdf", icon: "pdf", vis: "internal", visLabel: "Internal", linked: null, linkType: null, status: "active", size: "1.1 MB", date: "Apr 8, 2026", uploader: "Dan Carter" },
  { id: 3, title: "Meridian MEP \u2014 General Liability COI", ext: ".pdf", icon: "pdf", vis: "sub", visLabel: "Sub-Scoped", linked: "Compliance", linkType: "compliance", status: "active", size: "340 KB", date: "Apr 7, 2026", uploader: "Alex Morgan" },
  { id: 4, title: "Structural Spec \u2014 Section 05 12 00 Steel", ext: ".pdf \u00b7 v2", icon: "doc", vis: "project", visLabel: "Project-Wide", linked: null, linkType: null, status: "active", size: "2.8 MB", date: "Apr 5, 2026", uploader: "Sarah Lin" },
  { id: 5, title: "Schedule of Values \u2014 Rev 4", ext: ".xlsx \u00b7 v4", icon: "xls", vis: "client", visLabel: "Client-Visible", linked: "Draw #4", linkType: "billing", status: "active", size: "156 KB", date: "Apr 4, 2026", uploader: "Dan Carter" },
  { id: 6, title: "Progress Photo \u2014 Level 8 Framing", ext: ".jpg", icon: "img", vis: "client", visLabel: "Client-Visible", linked: null, linkType: null, status: "active", size: "3.4 MB", date: "Apr 3, 2026", uploader: "Dan Carter" },
  { id: 7, title: "RFI-007 Response \u2014 Shaft Routing Detail", ext: ".pdf", icon: "pdf", vis: "project", visLabel: "Project-Wide", linked: "RFI-007", linkType: "rfi", status: "active", size: "890 KB", date: "Apr 2, 2026", uploader: "Alex Morgan" },
  { id: 8, title: "A-201 Floor Plan Level 12 \u2014 Rev B", ext: ".dwg \u00b7 v2 \u00b7 superseded", icon: "dwg", vis: "project", visLabel: "Project-Wide", linked: "CO-003", linkType: "co", status: "superseded", size: "4.0 MB", date: "Mar 22, 2026", uploader: "Dan Carter" },
  { id: 9, title: "Building Permit \u2014 Riverside Tower", ext: ".pdf", icon: "pdf", vis: "client", visLabel: "Client-Visible", linked: null, linkType: null, status: "active", size: "2.1 MB", date: "Mar 15, 2026", uploader: "Dan Carter" },
];

const subFiles = [
  { id: 1, title: "A-201 Floor Plan Level 12 \u2014 Rev C", ext: ".dwg \u00b7 v3", icon: "dwg", cat: "Drawings / Plans", linked: "CO-003", linkType: "co", status: "active", size: "4.2 MB", date: "Apr 10, 2026" },
  { id: 2, title: "Meridian MEP \u2014 General Liability COI", ext: ".pdf \u00b7 Uploaded by you", icon: "pdf", cat: "Insurance", linked: "Compliance", linkType: "compliance", status: "active", size: "340 KB", date: "Apr 7, 2026" },
  { id: 3, title: "Structural Spec \u2014 Section 05 12 00 Steel", ext: ".pdf \u00b7 v2", icon: "pdf", cat: "Specifications", linked: null, linkType: null, status: "active", size: "2.8 MB", date: "Apr 5, 2026" },
  { id: 4, title: "RFI-007 Response \u2014 Shaft Routing Detail", ext: ".pdf", icon: "pdf", cat: "RFI Response", linked: "RFI-007", linkType: "rfi", status: "active", size: "890 KB", date: "Apr 2, 2026" },
  { id: 5, title: "Meridian MEP \u2014 Workers Comp Certificate", ext: ".pdf \u00b7 Uploaded by you", icon: "pdf", cat: "Insurance", linked: "Compliance", linkType: "compliance", status: "active", size: "280 KB", date: "Mar 28, 2026" },
  { id: 6, title: "Safety Plan \u2014 MEP Coordination Area", ext: ".pdf", icon: "pdf", cat: "Safety", linked: null, linkType: null, status: "active", size: "1.5 MB", date: "Mar 20, 2026" },
  { id: 7, title: "M-301 Mechanical Riser Diagram", ext: ".dwg", icon: "dwg", cat: "Drawings / Plans", linked: null, linkType: null, status: "active", size: "5.1 MB", date: "Mar 12, 2026" },
  { id: 8, title: "Building Permit \u2014 Riverside Tower", ext: ".pdf", icon: "pdf", cat: "Permits", linked: null, linkType: null, status: "active", size: "2.1 MB", date: "Mar 15, 2026" },
];

// Detail data for selected file
const detailData = {
  title: "A-201 Floor Plan Level 12 \u2014 Rev C", ext: ".dwg \u00b7 4.2 MB", icon: "dwg",
  props: [
    { k: "Category", v: "Drawings / Plans" }, { k: "Visibility", v: "Project-Wide", pill: "project" },
    { k: "Status", v: "Active", dot: "active" }, { k: "Uploaded By", v: "Dan Carter" },
    { k: "Date Added", v: "Apr 10, 2026 \u00b7 2:14 PM" }, { k: "Storage Key", v: "proj_riv/drawings/a201-l12-c.dwg", mono: true },
  ],
  linked: [
    { label: "CO-003 \u2014 Floor 12 Layout Revision", role: "Supporting Document", type: "co" },
    { label: "RFI-005 \u2014 Column Grid Clarification", role: "Reference Attachment", type: "rfi" },
  ],
  versions: [
    { label: "Version 3 (Current)", by: "Dan Carter \u00b7 Apr 10, 2026", size: "4.2 MB", current: true },
    { label: "Version 2 (Superseded)", by: "Dan Carter \u00b7 Mar 22, 2026", size: "4.0 MB", current: false },
    { label: "Version 1 (Superseded)", by: "Sarah Lin \u00b7 Feb 14, 2026", size: "3.8 MB", current: false },
  ],
};

// Sub filter pills
const subFilterPills = [
  { label: "All", count: 18, icon: "folder" },
  { label: "Drawings", count: 7, icon: "drawing" },
  { label: "Specs", count: 4, icon: "spec" },
  { label: "Compliance", count: 3, icon: "shield" },
  { label: "My Uploads", count: 4, icon: "upload" },
];
const pillIcons = { folder: I.folder, drawing: I.drawing, spec: I.spec, shield: I.shield, upload: I.upload };

// ── Component ───────────────────────────────────────────────────
export default function DocumentsFileManagement() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("gc");
  const [showUpload, setShowUpload] = useState({});
  const [selCat, setSelCat] = useState("all");
  const [selFile, setSelFile] = useState(1);
  const [showDetail, setShowDetail] = useState(true);
  const [subFilter, setSubFilter] = useState(0);

  const isSub = portal === "sub";
  const meta = portalMeta[portal];
  const nav = navData[portal];

  const switchPortal = (p) => { setPortal(p); setShowUpload({}); };

  const iconMap = { dwg: "dwg", pdf: "pdf", doc: "doc", xls: "xls", img: "img" };
  const iconColors = { dwg: { bg: "#e8f1fa", c: "#3178b9" }, pdf: { bg: "#fdeaea", c: "#c93b3b" }, doc: { bg: "#eeedfb", c: "#5b4fc7" }, xls: { bg: "#edf7f1", c: "#1e6b46" }, img: { bg: "#edf7f1", c: "#2d8a5e" } };
  const visColors = { project: { bg: "var(--ac-s)", c: "var(--ac-t)" }, internal: { bg: "var(--s2)", c: "var(--t3)" }, client: { bg: "var(--ok-s)", c: "var(--ok-t)" }, sub: { bg: "var(--in-s)", c: "var(--in-t)" } };
  const visIcons = { project: I.globe, internal: I.lock, client: I.eye, sub: I.user };
  const linkColors = { rfi: { bg: "var(--in-s)", c: "var(--in-t)" }, co: { bg: "var(--wr-s)", c: "var(--wr-t)" }, billing: { bg: "var(--ok-s)", c: "var(--ok-t)" }, compliance: { bg: "var(--dg-s)", c: "var(--dg-t)" }, approval: { bg: "var(--ac-s)", c: "var(--ac-t)" } };

  return (
    <div className={`df ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.df{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(91,79,199,.15);
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.df.sub{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15)}
.df.dk{--s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;--sh:#222536;--t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;--ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;--wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;--dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;--in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;--shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3)}
.df.dk.sub{--ac:#5a9fc0;--ac-h:#4d8aaa;--ac-s:#142030;--ac-t:#7eb8d8;--ac-m:#2a4a5e}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd)}.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px}
.s-user-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}.df.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px;flex:1}
.psw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.psw button{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e)}
.psw button:hover{color:var(--t1)}.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.pg-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-hdr h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em}
.pg-sub{font-size:13px;color:var(--t2);margin-top:4px;font-weight:520}
.btn{height:38px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all var(--dn) var(--e);font-family:var(--fb)}
.btn.primary{background:var(--ac);color:white;border:none}.btn.primary:hover{background:var(--ac-h)}
.btn.ghost{border:1px solid var(--s3);background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--sh);border-color:var(--s4);color:var(--t1)}
.btn.cancel{border:1px solid var(--s3);background:transparent;color:var(--t2)}.btn.cancel:hover{background:var(--sh)}
/* Stats */
.sr{display:flex;gap:12px;margin-bottom:16px}
.stc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px;flex:1;display:flex;align-items:center;gap:12px}
.st-ic{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center}
.st-val{font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.02em}
.st-lbl{font-size:11.5px;color:var(--t3);font-weight:560;margin-top:1px}
/* Doc browser */
.db{display:grid;gap:0;min-height:calc(100vh - 300px);background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.db.gc-mode{grid-template-columns:240px 1fr}.db.gc-detail{grid-template-columns:240px 1fr 360px}
.db.sub-mode{grid-template-columns:1fr}
/* Cat panel */
.cp{border-right:1px solid var(--s3);display:flex;flex-direction:column;overflow:hidden}
.cp-hdr{padding:14px 16px;border-bottom:1px solid var(--s3);font-family:var(--fd);font-size:13px;font-weight:700}
.cp-list{flex:1;overflow-y:auto;padding:8px}.cp-list::-webkit-scrollbar{width:4px}.cp-list::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.cg-lbl{font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 4px}
.ci{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:var(--r-m);font-size:12.5px;font-weight:530;color:var(--t2);cursor:pointer;transition:all var(--df);margin-bottom:1px}
.ci:hover{background:var(--sh);color:var(--t1)}.ci.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ci-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0}.ci-left span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-ct{font-size:10px;font-weight:700;color:var(--t3);background:var(--s2);min-width:20px;height:18px;padding:0 6px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd)}.ci.on .ci-ct{background:rgba(91,79,199,.12);color:var(--ac-t)}
/* File area */
.fa{display:flex;flex-direction:column;overflow:hidden}
.ft{padding:12px 16px;border-bottom:1px solid var(--s3);display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0}
.ft-srch{width:220px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px 0 34px;font-size:13px;color:var(--t1);outline:none}
.ft-srch:focus{border-color:var(--ac);box-shadow:var(--shri)}
.ft-sep{width:1px;height:20px;background:var(--s3);margin:0 4px}
.vt{display:flex;border:1px solid var(--s3);border-radius:var(--r-m);overflow:hidden}
.vt-btn{width:32px;height:30px;display:grid;place-items:center;background:var(--s2);color:var(--t3);transition:all var(--df)}.vt-btn:hover{color:var(--t2)}.vt-btn.on{background:var(--s1);color:var(--t1)}
.so-btn{height:30px;padding:0 10px;border-radius:var(--r-m);font-size:11.5px;font-weight:620;color:var(--t3);display:inline-flex;align-items:center;gap:4px;transition:all var(--df)}.so-btn:hover{color:var(--t2);background:var(--sh)}
.ft-right{margin-left:auto;display:flex;align-items:center;gap:6px}
.bk-btn{height:28px;padding:0 10px;border-radius:var(--r-s);font-size:11.5px;font-weight:620;display:inline-flex;align-items:center;gap:4px;transition:all var(--df)}
.bk-btn.dl{color:var(--in-t);background:var(--in-s)}.bk-btn.dl:hover{filter:brightness(.95)}
.bk-btn.sh{color:var(--ac-t);background:var(--ac-s)}.bk-btn.sh:hover{filter:brightness(.95)}
/* File table */
.fs{flex:1;overflow-y:auto}.fs::-webkit-scrollbar{width:4px}.fs::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ftbl{width:100%;border-collapse:collapse}
.ftbl th{position:sticky;top:0;background:var(--s2);font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--s3);white-space:nowrap;z-index:2}
.ftbl th:first-child{padding-left:16px}
.ftbl td{padding:10px 12px;border-bottom:1px solid var(--s3);font-size:13px;vertical-align:middle}
.ftbl td:first-child{padding-left:16px}
.ftbl tbody tr{transition:background var(--df);cursor:pointer}
.ftbl tbody tr:hover{background:var(--sh)}.ftbl tbody tr.sel{background:var(--ac-s)}
.fn-cell{display:flex;align-items:center;gap:10px;min-width:0}
.fn-check{width:16px;height:16px;border-radius:4px;border:2px solid var(--s4);flex-shrink:0;display:grid;place-items:center;transition:all var(--df)}
.fn-check.ck{background:var(--ac);border-color:var(--ac)}
.fn-ic{width:34px;height:34px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0}
.fn-txt{min-width:0}.fn-title{font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.fn-ext{font-size:11px;color:var(--t3);font-family:var(--fm);margin-top:1px}
.vis-pl{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:650;padding:3px 8px;border-radius:999px;white-space:nowrap;font-family:var(--fd)}
.lk-pl{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:620;padding:3px 8px;border-radius:999px;white-space:nowrap;cursor:pointer;transition:background var(--df);font-family:var(--fd)}
.lk-pl:hover{filter:brightness(.92)}
.st-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.st-dot.active{background:var(--ok)}.st-dot.superseded{background:var(--s4)}
.f-stat{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:560}
.f-sz{font-size:11.5px;color:var(--t3);font-family:var(--fm);white-space:nowrap}
.f-dt{font-size:12px;color:var(--t2);white-space:nowrap;font-weight:520}
/* Detail panel */
.dp{border-left:1px solid var(--s3);display:flex;flex-direction:column;overflow:hidden;background:var(--s1)}
.dp-hdr{padding:18px 20px 14px;border-bottom:1px solid var(--s3);flex-shrink:0}
.dp-close{width:28px;height:28px;border-radius:var(--r-s);display:grid;place-items:center;color:var(--t3);float:right;transition:all var(--df)}.dp-close:hover{background:var(--sh);color:var(--t1)}
.dp-ic{width:48px;height:48px;border-radius:var(--r-l);display:grid;place-items:center;margin-bottom:12px}
.dp-title{font-family:var(--fd);font-size:16px;font-weight:720;letter-spacing:-.02em;margin-bottom:4px}
.dp-ext{font-size:12px;color:var(--t3);font-family:var(--fm)}
.dp-acts{display:flex;gap:6px;margin-top:14px}
.dp-scroll{flex:1;overflow-y:auto;padding:16px 20px}.dp-scroll::-webkit-scrollbar{width:4px}.dp-scroll::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ds{margin-bottom:20px}
.ds-title{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.dr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:12px}
.dr-k{font-size:12px;color:var(--t3);font-weight:560;min-width:80px;flex-shrink:0}
.dr-v{font-size:12.5px;color:var(--t1);font-weight:530;text-align:right;word-break:break-word}
.lo{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--r-m);border:1px solid var(--s3);margin-bottom:6px;cursor:pointer;transition:all var(--df)}
.lo:hover{background:var(--sh);border-color:var(--s4)}
.lo-ic{width:28px;height:28px;border-radius:var(--r-s);display:grid;place-items:center;flex-shrink:0}
.lo-txt{font-size:12px;font-weight:580;color:var(--t1);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lo-role{font-size:10px;color:var(--t3);font-weight:600}
/* Version timeline */
.vl{display:flex;flex-direction:column}
.vi{display:flex;gap:10px;padding:8px 0;position:relative}
.vi:not(:last-child)::after{content:'';position:absolute;left:13px;top:34px;bottom:-2px;width:1.5px;background:var(--s3)}
.vi-dot{width:26px;height:26px;border-radius:50%;border:2px solid var(--s3);background:var(--s1);display:grid;place-items:center;flex-shrink:0;z-index:1}
.vi.cur .vi-dot{border-color:var(--ac);background:var(--ac-s)}
.vi-dot svg{color:var(--t3)}.vi.cur .vi-dot svg{color:var(--ac-t)}
.vi-lbl{font-size:12px;font-weight:640;color:var(--t1)}.vi.cur .vi-lbl{color:var(--ac-t)}
.vi-meta{font-size:11px;color:var(--t3);margin-top:2px}
.vi-sz{font-family:var(--fm);font-size:10px;color:var(--t3);margin-top:1px}
/* Upload panel */
.up{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;margin-bottom:16px;box-shadow:var(--shmd)}
.up h3{font-family:var(--fd);font-size:17px;font-weight:720;letter-spacing:-.02em;margin-bottom:16px}
.udz{border:2px dashed var(--s4);border-radius:var(--r-l);padding:32px;text-align:center;transition:all var(--dn);margin-bottom:16px}
.udz:hover{border-color:var(--ac);background:var(--ac-s)}
.udz p{font-size:13.5px;font-weight:600;margin-top:8px;margin-bottom:4px}
.udz span{font-size:12px;color:var(--t3)}
.udz .browse{color:var(--ac-t);font-weight:650;cursor:pointer;text-decoration:underline}
.f-row{margin-bottom:14px}.f-row-h{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.f-lbl{font-size:12px;font-weight:640;color:var(--t2);margin-bottom:5px;display:block}
.f-input,.f-sel{width:100%;height:38px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none}
.f-input:focus,.f-sel:focus{border-color:var(--ac);box-shadow:var(--shri);background:var(--s1)}
.f-sel{cursor:pointer;appearance:none}
.f-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
/* Filter pills (sub) */
.fp-bar{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.fp{height:30px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:600;color:var(--t2);border:1px solid var(--s3);display:inline-flex;align-items:center;gap:5px;transition:all var(--df);white-space:nowrap}
.fp:hover{border-color:var(--s4);color:var(--t1)}.fp.on{background:var(--ac-s);border-color:var(--ac-m);color:var(--ac-t);font-weight:650}
.fp-ct{font-size:10px;font-weight:700;font-family:var(--fd)}
@media(max-width:1200px){.db.gc-detail{grid-template-columns:240px 1fr}.dp{display:none}}
@media(max-width:900px){.df{grid-template-columns:1fr}.side{display:none}.sr{flex-wrap:wrap}.sr .stc{min-width:calc(50% - 6px)}.db.gc-mode,.db.gc-detail{grid-template-columns:1fr}.cp{display:none}}
      `}</style>

      {/* Sidebar */}
      <aside className="side">
        <div className="brand"><Logo /><div><h1>BuiltCRM</h1><div className="brand-ctx">{meta.label}</div></div></div>
        <nav className="s-nav">
          {nav.map((sec, si) => (
            <div key={si}><div className="ns-lbl">{sec.section}</div>
              {sec.items.map((it, ii) => (
                <div key={ii} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>{it.badge && <span className={`ni-b ${it.bt || "blue"}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="s-foot"><div className="s-user"><div className="s-user-av">{meta.user}</div><div><div style={{ fontSize: 13, fontWeight: 580 }}>{meta.name}</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>{meta.role}</div></div></div></div>
      </aside>

      {/* Main */}
      <div className="mn">
        <header className="tb">
          <div className="bc"><span>{meta.label}</span><span className="sep">/</span><span>{meta.project}</span><span className="sep">/</span><span className="cur">{meta.page}</span></div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</button>
            <button className="ib">{I.bell}</button>
            <div className="av">{meta.user}</div>
          </div>
        </header>
        <div className="ct">
          <div className="psw">
            <button className={portal === "gc" ? "on" : ""} onClick={() => switchPortal("gc")}><span className="p-dot" style={{ background: "#5b4fc7" }} /> Contractor</button>
            <button className={portal === "sub" ? "on" : ""} onClick={() => switchPortal("sub")}><span className="p-dot" style={{ background: "#3d6b8e" }} /> Subcontractor</button>
          </div>

          {/* Page header */}
          <div className="pg-hdr">
            <div><h2>Documents</h2><div className="pg-sub">{isSub ? "Riverside Tower Fit-Out \u00b7 18 documents available to you" : "Riverside Tower Fit-Out \u00b7 47 documents \u00b7 2.4 GB"}</div></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={() => setShowUpload(p => ({ ...p, [portal]: !p[portal] }))}>{I.upload} {isSub ? "Upload Document" : "Upload Files"}</button>
              {!isSub && <button className="btn primary">{I.plus} New Folder</button>}
            </div>
          </div>

          {/* Upload panel */}
          {showUpload[portal] && (
            <div className="up">
              <h3>{isSub ? "Upload Document" : "Upload Documents"}</h3>
              <div className="udz">
                <div style={{ color: "var(--t3)" }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                <p>Drag files here to upload</p>
                <span>or <span className="browse">browse your computer</span> · Max 50 MB per file</span>
              </div>
              {!isSub ? (
                <div className="f-row-h">
                  <div className="f-row"><label className="f-lbl">Document Type</label>
                    <select className="f-sel"><option>Select type\u2026</option><option>Drawings / Plans</option><option>Specifications</option><option>Contracts</option><option>Submittals</option><option>Insurance / Compliance</option><option>Permits</option><option>Meeting Minutes</option><option>Safety Plans</option><option>Closeout Documents</option><option>Photos</option><option>Other</option></select>
                  </div>
                  <div className="f-row"><label className="f-lbl">Visibility</label>
                    <select className="f-sel"><option>Project-Wide (All Members)</option><option>Internal Only (Contractor Team)</option><option>Client-Visible</option><option>Subcontractor-Scoped</option></select>
                  </div>
                </div>
              ) : (
                <div className="f-row"><label className="f-lbl">Document Type</label>
                  <select className="f-sel"><option>Select type\u2026</option><option>Submittals</option><option>Insurance / Compliance</option><option>Shop Drawings</option><option>Daily Reports</option><option>Safety Documentation</option><option>Closeout Documents</option><option>Other</option></select>
                </div>
              )}
              <div className="f-row"><label className="f-lbl">{isSub ? "Link to Request (Optional)" : "Link to Object (Optional)"}</label>
                <select className="f-sel">{isSub ? <><option>None</option><option>Upload Request \u2014 General Liability COI (Renewal)</option><option>Upload Request \u2014 Workers Comp Certificate</option></> : <><option>None</option><option>RFI-007 \u2014 Mechanical Shaft Routing</option><option>CO-003 \u2014 Floor 12 Layout Revision</option><option>Draw #4 \u2014 April 2026</option><option>Approval \u2014 Lobby Finish Material</option></>}</select>
              </div>
              <div className="f-acts"><button className="btn cancel" onClick={() => setShowUpload(p => ({ ...p, [portal]: false }))}>Cancel</button><button className="btn primary">{isSub ? "Upload Document" : "Upload Files"}</button></div>
            </div>
          )}

          {/* Contractor: stats row */}
          {!isSub && (
            <div className="sr">
              {[{ v: 47, l: "Total Documents", bg: "var(--ac-s)", c: "var(--ac-t)", icon: I.doc },
                { v: 6, l: "Uploaded This Week", bg: "var(--in-s)", c: "var(--in-t)", icon: I.upload },
                { v: 12, l: "Client-Visible", bg: "var(--ok-s)", c: "var(--ok-t)", icon: I.eye },
                { v: 3, l: "Pending Review", bg: "var(--wr-s)", c: "var(--wr-t)", icon: I.shield }].map((s, i) => (
                <div key={i} className="stc">
                  <div className="st-ic" style={{ background: s.bg, color: s.c }}>{s.icon}</div>
                  <div><div className="st-val">{s.v}</div><div className="st-lbl">{s.l}</div></div>
                </div>
              ))}
            </div>
          )}

          {/* Sub: filter pills */}
          {isSub && (
            <div className="fp-bar">
              {subFilterPills.map((p, i) => (
                <button key={i} className={`fp${subFilter === i ? " on" : ""}`} onClick={() => setSubFilter(i)}>
                  {pillIcons[p.icon]} {p.label} <span className="fp-ct">{p.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Doc browser */}
          <div className={`db ${isSub ? "sub-mode" : (showDetail ? "gc-detail" : "gc-mode")}`}>
            {/* Category tree (GC only) */}
            {!isSub && (
              <div className="cp">
                <div className="cp-hdr">Categories</div>
                <div className="cp-list">
                  {categories.map((cat, i) => {
                    const prevGroup = i > 0 ? categories[i - 1].group : null;
                    return (
                      <div key={cat.id}>
                        {cat.group && cat.group !== prevGroup && <div className="cg-lbl">{cat.group}</div>}
                        <div className={`ci${selCat === cat.id ? " on" : ""}`} onClick={() => setSelCat(cat.id)}>
                          <div className="ci-left">{catIcons[cat.icon]}<span>{cat.label}</span></div>
                          <span className="ci-ct">{cat.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* File area */}
            <div className="fa">
              <div className="ft">
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }}>{I.search}</div>
                  <input className="ft-srch" placeholder="Search documents\u2026" />
                </div>
                <div className="ft-sep" />
                {!isSub && <><div className="vt"><button className="vt-btn on">{I.list}</button><button className="vt-btn">{I.grid}</button></div></>}
                <button className="so-btn">{I.sort} Date Added</button>
                <div className="ft-right">
                  <button className="bk-btn dl">{I.download} Download</button>
                  {!isSub && <button className="bk-btn sh">{I.share} Share</button>}
                </div>
              </div>
              <div className="fs">
                <table className="ftbl">
                  <thead><tr>
                    <th style={{ width: isSub ? "45%" : "40%" }}>Name</th>
                    <th>{isSub ? "Category" : "Visibility"}</th>
                    <th>Linked To</th><th>Status</th><th>Size</th><th>Uploaded</th>
                  </tr></thead>
                  <tbody>
                    {(isSub ? subFiles : gcFiles).map(f => (
                      <tr key={f.id} className={!isSub && selFile === f.id ? "sel" : ""} onClick={() => { if (!isSub) { setSelFile(f.id); setShowDetail(true); } }}>
                        <td>
                          <div className="fn-cell">
                            <div className={`fn-check${!isSub && selFile === f.id ? " ck" : ""}`}>{!isSub && selFile === f.id && <span style={{ width: 8, height: 5, borderLeft: "2px solid white", borderBottom: "2px solid white", transform: "rotate(-45deg) translateY(-1px)", display: "block" }} />}</div>
                            <div className="fn-ic" style={{ background: iconColors[f.icon]?.bg, color: iconColors[f.icon]?.c }}>{f.icon === "dwg" ? I.drawing : f.icon === "img" ? I.img : f.icon === "xls" ? I.doc : I.doc}</div>
                            <div className="fn-txt"><div className="fn-title">{f.title}</div><div className="fn-ext">{f.ext}</div></div>
                          </div>
                        </td>
                        <td>
                          {isSub ? <span style={{ fontSize: 12, color: "var(--t2)" }}>{f.cat}</span> : (
                            <span className="vis-pl" style={{ background: visColors[f.vis]?.bg, color: visColors[f.vis]?.c }}>{visIcons[f.vis]} {f.visLabel}</span>
                          )}
                        </td>
                        <td>{f.linked ? <span className="lk-pl" style={{ background: linkColors[f.linkType]?.bg, color: linkColors[f.linkType]?.c }}>{I.link} {f.linked}</span> : "\u2014"}</td>
                        <td><div className="f-stat"><span className={`st-dot ${f.status}`} /> {f.status[0].toUpperCase() + f.status.slice(1)}</div></td>
                        <td><span className="f-sz">{f.size}</span></td>
                        <td><span className="f-dt">{f.date}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail panel (GC only) */}
            {!isSub && showDetail && (
              <div className="dp">
                <div className="dp-hdr">
                  <button className="dp-close" onClick={() => setShowDetail(false)}>{I.x}</button>
                  <div className="dp-ic" style={{ background: iconColors.dwg.bg, color: iconColors.dwg.c }}>{I.drawing}</div>
                  <div className="dp-title">{detailData.title}</div>
                  <div className="dp-ext">{detailData.ext}</div>
                  <div className="dp-acts">
                    <button className="btn ghost" style={{ height: 30, fontSize: 12, padding: "0 10px" }}>{I.download} Download</button>
                    <button className="btn ghost" style={{ height: 30, fontSize: 12, padding: "0 10px" }}>{I.share} Share</button>
                  </div>
                </div>
                <div className="dp-scroll">
                  <div className="ds"><div className="ds-title">Properties</div>
                    {detailData.props.map((p, i) => (
                      <div key={i} className="dr">
                        <span className="dr-k">{p.k}</span>
                        <span className="dr-v" style={p.mono ? { fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" } : {}}>
                          {p.pill ? <span className="vis-pl" style={{ background: visColors[p.pill]?.bg, color: visColors[p.pill]?.c, fontSize: 10 }}>{visIcons[p.pill]} {p.v}</span>
                          : p.dot ? <span className="f-stat" style={{ justifyContent: "flex-end" }}><span className={`st-dot ${p.dot}`} /> {p.v}</span>
                          : p.v}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="ds"><div className="ds-title">Linked Objects</div>
                    {detailData.linked.map((l, i) => (
                      <div key={i} className="lo">
                        <div className="lo-ic" style={{ background: linkColors[l.type]?.bg, color: linkColors[l.type]?.c }}>{I.doc}</div>
                        <div style={{ flex: 1, minWidth: 0 }}><div className="lo-txt">{l.label}</div><div className="lo-role">{l.role}</div></div>
                      </div>
                    ))}
                  </div>
                  <div className="ds"><div className="ds-title">Version History</div>
                    <div className="vl">
                      {detailData.versions.map((v, i) => (
                        <div key={i} className={`vi${v.current ? " cur" : ""}`}>
                          <div className="vi-dot">{v.current ? I.check : I.dot}</div>
                          <div style={{ flex: 1 }}><div className="vi-lbl">{v.label}</div><div className="vi-meta">{v.by}</div><div className="vi-sz">{v.size}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
