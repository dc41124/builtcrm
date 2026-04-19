import { useState, useMemo } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  camera: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  pin: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clock: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  user: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  send: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
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

// ── Nav per portal ──────────────────────────────────────────────
const navData = {
  contractor: [
    { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Inbox", badge: 8, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 9, bt: "danger" },
      { label: "Approvals", badge: 5, bt: "blue" }, { label: "Change Orders", badge: 2, bt: "warn" },
      { label: "Billing / Draws" }, { label: "Compliance" }, { label: "Daily Logs" },
      { label: "Punch List", active: true, badge: 4, bt: "warn" },
      { label: "Documents" }, { label: "Schedule" },
    ]},
  ],
  subcontractor: [
    { section: "Today", items: [{ label: "My Day" }, { label: "Messages", badge: 3, bt: "blue" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs I've raised", badge: 2, bt: "blue" },
      { label: "Submittals" }, { label: "My Compliance" }, { label: "Daily Logs" },
      { label: "Punch List", active: true, badge: 3, bt: "warn" },
      { label: "Documents" },
    ]},
  ],
};

const portalMeta = {
  contractor:    { label: "Contractor Portal",    project: "Riverside Tower Fit-Out", page: "Punch List", user: "DC" },
  subcontractor: { label: "Subcontractor Portal", project: "Riverside Tower Fit-Out", page: "Punch List", user: "MP", org: "Miller Painting Co." },
};

// ── Mock data ───────────────────────────────────────────────────
// Note: claude-code implementation will fetch from API. This mock structure mirrors the
// proposed punch_items / punch_item_photos / punch_item_comments schema.

const initialItems = [
  {
    id: "PI-014", num: 14, title: "Paint runs on east lobby wall",
    description: "Two visible paint runs on the east-facing lobby wall near the reception desk. Need to be sanded flush and repainted to match.",
    location: "Lobby — east wall, near reception desk (grid B-3)",
    priority: "high", status: "ready_to_verify",
    assigneeOrg: "Miller Painting Co.", assigneeUserInitials: "MP",
    dueDate: "Apr 16", ageDays: 3,
    createdBy: "Daniel Chen", createdAt: "Apr 13",
    rejectionReason: null, voidReason: null,
    photos: [
      { id: 1, caption: "Close-up of upper run", color: "#c8b49a" },
      { id: 2, caption: "Full wall context", color: "#a59178" },
      { id: 3, caption: "After first sanding attempt", color: "#b8a48a" },
    ],
    comments: [
      { id: 1, author: "Daniel Chen", initials: "DC", role: "Contractor", body: "Noticed during walk-through this morning. Two runs visible under the new LED lighting. Pls address before final inspection.", ts: "Apr 13, 9:12 AM", system: false },
      { id: 2, author: "Miguel Perez", initials: "MP", role: "Miller Painting", body: "On it. Will sand flush and recoat tomorrow AM once the other area is dry.", ts: "Apr 13, 10:04 AM", system: false },
      { id: 3, author: "System", initials: "·", role: "system", body: "Miguel Perez marked item as In Progress", ts: "Apr 13, 10:05 AM", system: true },
      { id: 4, author: "Miguel Perez", initials: "MP", role: "Miller Painting", body: "Sanded and recoated. Needs 24h cure, ready for your check tomorrow.", ts: "Apr 15, 4:18 PM", system: false },
      { id: 5, author: "System", initials: "·", role: "system", body: "Miguel Perez marked item as Ready to Verify", ts: "Apr 15, 4:18 PM", system: true },
    ],
    activity: [
      { kind: "action", actor: "Daniel Chen", body: "created PI-014", ts: "Apr 13" },
      { kind: "action", actor: "Daniel Chen", body: "assigned to Miller Painting Co.", ts: "Apr 13" },
      { kind: "action", actor: "Miguel Perez", body: "marked In Progress", ts: "Apr 13" },
      { kind: "action", actor: "Miguel Perez", body: "marked Ready to Verify", ts: "Apr 15" },
    ],
  },
  {
    id: "PI-013", num: 13, title: "Loose trim at entry 2B",
    description: "Door casing is separating from frame at the top corner. Needs to be re-secured and caulked.",
    location: "Floor 2 — corridor entry 2B, door frame upper-left",
    priority: "normal", status: "in_progress",
    assigneeOrg: "Apex Finish Carpentry", assigneeUserInitials: "AF",
    dueDate: "Apr 18", ageDays: 2,
    createdBy: "Daniel Chen", createdAt: "Apr 14",
    rejectionReason: null, voidReason: null,
    photos: [{ id: 1, caption: "Gap at upper corner", color: "#8a7562" }],
    comments: [
      { id: 1, author: "Daniel Chen", initials: "DC", role: "Contractor", body: "Frame has pulled away ~3mm. Pls re-set and caulk.", ts: "Apr 14, 11:30 AM", system: false },
      { id: 2, author: "System", initials: "·", role: "system", body: "Apex Finish Carpentry marked item as In Progress", ts: "Apr 15, 8:15 AM", system: true },
    ],
    activity: [
      { kind: "action", actor: "Daniel Chen", body: "created PI-013", ts: "Apr 14" },
      { kind: "action", actor: "Apex crew", body: "marked In Progress", ts: "Apr 15" },
    ],
  },
  {
    id: "PI-012", num: 12, title: "Outlet plate crooked — kitchenette",
    description: "Outlet cover plate is rotated ~5°. Needs to be adjusted to level.",
    location: "Floor 3 — kitchenette, counter-height outlet above sink",
    priority: "low", status: "open",
    assigneeOrg: "Lakeshore Electric", assigneeUserInitials: "LE",
    dueDate: "Apr 22", ageDays: 1,
    createdBy: "Daniel Chen", createdAt: "Apr 15",
    rejectionReason: null, voidReason: null,
    photos: [{ id: 1, caption: "Crooked plate", color: "#9b8876" }],
    comments: [
      { id: 1, author: "Daniel Chen", initials: "DC", role: "Contractor", body: "Minor fix — just plate alignment.", ts: "Apr 15, 2:45 PM", system: false },
    ],
    activity: [{ kind: "action", actor: "Daniel Chen", body: "created PI-012", ts: "Apr 15" }],
  },
  {
    id: "PI-011", num: 11, title: "Caulk bead missing — window sill 3F",
    description: "Exterior caulk bead missing along the bottom of the floor-3 south window.",
    location: "Floor 3 — south exterior window, sill condition",
    priority: "urgent", status: "rejected",
    assigneeOrg: "Miller Painting Co.", assigneeUserInitials: "MP",
    dueDate: "Apr 14", ageDays: 4,
    createdBy: "Daniel Chen", createdAt: "Apr 12",
    rejectionReason: "Caulk applied unevenly, still gaps at the two mitered corners. Needs full redo — not spot fix.",
    voidReason: null,
    photos: [
      { id: 1, caption: "Gap — SW corner", color: "#7a6752" },
      { id: 2, caption: "Gap — SE corner", color: "#826e58" },
    ],
    comments: [
      { id: 1, author: "Daniel Chen", initials: "DC", role: "Contractor", body: "Water infiltration risk. Priority.", ts: "Apr 12", system: false },
      { id: 2, author: "System", initials: "·", role: "system", body: "Miller Painting Co. marked item as Ready to Verify", ts: "Apr 14", system: true },
      { id: 3, author: "System", initials: "·", role: "system", body: "Daniel Chen rejected — \"Caulk applied unevenly, still gaps at the two mitered corners. Needs full redo — not spot fix.\"", ts: "Apr 15", system: true },
    ],
    activity: [
      { kind: "action", actor: "Daniel Chen", body: "created PI-011", ts: "Apr 12" },
      { kind: "action", actor: "Miller Painting", body: "marked Ready to Verify", ts: "Apr 14" },
      { kind: "action", actor: "Daniel Chen", body: "rejected", ts: "Apr 15" },
    ],
  },
  {
    id: "PI-010", num: 10, title: "Baseboard scuff — corridor 2C",
    description: "Baseboard has a black scuff approximately 4 inches long.",
    location: "Floor 2 — corridor 2C, west side, ~6m from stairwell",
    priority: "normal", status: "verified",
    assigneeOrg: "Miller Painting Co.", assigneeUserInitials: "MP",
    dueDate: "Apr 10", ageDays: 6,
    createdBy: "Daniel Chen", createdAt: "Apr 8",
    verifiedBy: "Daniel Chen", verifiedAt: "Apr 11",
    rejectionReason: null, voidReason: null,
    photos: [{ id: 1, caption: "Scuff — before", color: "#736050" }],
    comments: [
      { id: 1, author: "Daniel Chen", initials: "DC", role: "Contractor", body: "Touch-up needed.", ts: "Apr 8", system: false },
      { id: 2, author: "System", initials: "·", role: "system", body: "Miller Painting Co. marked item as Ready to Verify", ts: "Apr 10", system: true },
      { id: 3, author: "System", initials: "·", role: "system", body: "Daniel Chen verified item. Closed.", ts: "Apr 11", system: true },
    ],
    activity: [
      { kind: "action", actor: "Daniel Chen", body: "created PI-010", ts: "Apr 8" },
      { kind: "action", actor: "Miller Painting", body: "marked Ready to Verify", ts: "Apr 10" },
      { kind: "action", actor: "Daniel Chen", body: "verified", ts: "Apr 11" },
    ],
  },
  {
    id: "PI-009", num: 9, title: "Missing door stop — office 305",
    description: "Door stop was not installed on door 305.",
    location: "Floor 3 — office 305, behind door",
    priority: "low", status: "void",
    assigneeOrg: "Apex Finish Carpentry", assigneeUserInitials: "AF",
    dueDate: "Apr 20", ageDays: 5,
    createdBy: "Daniel Chen", createdAt: "Apr 9",
    rejectionReason: null,
    voidReason: "Duplicate of PI-007. Consolidated.",
    photos: [],
    comments: [
      { id: 1, author: "System", initials: "·", role: "system", body: "Daniel Chen voided — \"Duplicate of PI-007. Consolidated.\"", ts: "Apr 10", system: true },
    ],
    activity: [
      { kind: "action", actor: "Daniel Chen", body: "created PI-009", ts: "Apr 9" },
      { kind: "action", actor: "Daniel Chen", body: "voided", ts: "Apr 10" },
    ],
  },
];

// ── Constants ───────────────────────────────────────────────────
const STATUS_LABELS = {
  open: "Open", in_progress: "In Progress", ready_to_verify: "Ready to Verify",
  verified: "Verified", rejected: "Rejected", void: "Void",
};
const STATUS_PILL = {
  open: "gray", in_progress: "orange", ready_to_verify: "accent",
  verified: "green", rejected: "red", void: "gray",
};
const PRIORITY_LABELS = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
const PRIORITY_PILL = { low: "gray", normal: "gray", high: "orange", urgent: "red" };

// ── Component ───────────────────────────────────────────────────
export default function PunchListWorkflowPaired() {
  const [dark, setDark]             = useState(false);
  const [portal, setPortal]         = useState("contractor");
  const [statusTab, setStatusTab]   = useState("all");
  const [items, setItems]           = useState(initialItems);
  const [selectedId, setSelectedId] = useState("PI-014");
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [voidOpen, setVoidOpen]           = useState(false);
  const [rejectReason, setRejectReason]   = useState("");
  const [voidReason, setVoidReason]       = useState("");
  const [commentDraft, setCommentDraft]   = useState("");

  const meta = portalMeta[portal];
  const nav  = navData[portal];

  // ── Filter items per portal ──
  const portalItems = useMemo(() => {
    if (portal === "subcontractor") {
      // Filtered to assigneeOrg = current sub's org (Miller Painting in this mock)
      return items.filter(it => it.assigneeOrg === "Miller Painting Co.");
    }
    return items;
  }, [items, portal]);

  const visibleItems = useMemo(() => {
    if (statusTab === "all")      return portalItems.filter(it => it.status !== "void");
    if (statusTab === "active")   return portalItems.filter(it => ["open","in_progress","ready_to_verify","rejected"].includes(it.status));
    if (statusTab === "verified") return portalItems.filter(it => it.status === "verified");
    return portalItems.filter(it => it.status === statusTab);
  }, [portalItems, statusTab]);

  // Ensure selectedId points at a visible item, else fall back
  const selected = portalItems.find(it => it.id === selectedId) || portalItems[0];

  // Summary counts (for portal's scope)
  const counts = useMemo(() => ({
    total:            portalItems.filter(it => it.status !== "void").length,
    open:             portalItems.filter(it => it.status === "open").length,
    inProgress:       portalItems.filter(it => it.status === "in_progress").length,
    readyToVerify:    portalItems.filter(it => it.status === "ready_to_verify").length,
    verified:         portalItems.filter(it => it.status === "verified").length,
    rejected:         portalItems.filter(it => it.status === "rejected").length,
    overdue:          portalItems.filter(it => ["open","in_progress","rejected"].includes(it.status) && it.ageDays >= 3).length,
  }), [portalItems]);

  // ── Transitions (with system comment auto-posting) ──
  const transition = (id, toStatus, extras = {}) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const now = "Apr 16";
      const actor = portal === "contractor" ? "Daniel Chen" : "Miguel Perez";
      const initials = portal === "contractor" ? "DC" : "MP";
      let systemBody = `${actor} marked item as ${STATUS_LABELS[toStatus]}`;
      if (toStatus === "rejected") systemBody = `${actor} rejected — "${extras.rejectionReason}"`;
      if (toStatus === "void")     systemBody = `${actor} voided — "${extras.voidReason}"`;
      if (toStatus === "verified") systemBody = `${actor} verified item. Closed.`;
      const newComment = {
        id: Date.now(), author: "System", initials: "·", role: "system",
        body: systemBody, ts: now, system: true,
      };
      return {
        ...it,
        status: toStatus,
        ...(extras.rejectionReason !== undefined ? { rejectionReason: extras.rejectionReason } : {}),
        ...(extras.voidReason !== undefined ? { voidReason: extras.voidReason } : {}),
        ...(toStatus === "verified" ? { verifiedBy: actor, verifiedAt: now } : {}),
        ...(toStatus === "in_progress" && it.status === "rejected" ? { rejectionReason: null } : {}),
        comments: [...it.comments, newComment],
        activity: [...it.activity, { kind: "action", actor, body: `marked ${STATUS_LABELS[toStatus]}`, ts: now }],
      };
    }));
  };

  // ── Post comment ──
  const postComment = () => {
    if (!commentDraft.trim()) return;
    const actor = portal === "contractor" ? "Daniel Chen" : "Miguel Perez";
    const initials = portal === "contractor" ? "DC" : "MP";
    const role = portal === "contractor" ? "Contractor" : "Miller Painting";
    setItems(prev => prev.map(it => it.id === selected.id ? {
      ...it,
      comments: [...it.comments, { id: Date.now(), author: actor, initials, role, body: commentDraft, ts: "Apr 16, now", system: false }],
    } : it));
    setCommentDraft("");
  };

  // ── Available actions per portal × current status ──
  const getActions = (it) => {
    if (!it) return [];
    if (portal === "contractor") {
      switch (it.status) {
        case "open":             return [{ to: "in_progress", label: "Mark In Progress", kind: "" }, { to: "void", label: "Void…", kind: "dg-o" }];
        case "in_progress":      return [{ to: "ready_to_verify", label: "Mark Ready to Verify", kind: "pri" }, { to: "void", label: "Void…", kind: "dg-o" }];
        case "ready_to_verify":  return [{ to: "verified", label: "Verify & close", kind: "ok" }, { to: "rejected", label: "Reject…", kind: "dg-o" }, { to: "void", label: "Void…", kind: "" }];
        case "rejected":         return [{ to: "in_progress", label: "Reopen (In Progress)", kind: "pri" }, { to: "void", label: "Void…", kind: "dg-o" }];
        case "verified":         return [];
        case "void":             return [];
        default:                 return [];
      }
    }
    // subcontractor
    switch (it.status) {
      case "open":            return [{ to: "in_progress", label: "Mark In Progress", kind: "pri" }];
      case "in_progress":     return [{ to: "ready_to_verify", label: "Mark Ready to Verify", kind: "pri" }];
      case "ready_to_verify": return []; // waiting on GC
      case "rejected":        return [{ to: "in_progress", label: "Reopen (In Progress)", kind: "pri" }];
      case "verified":        return [];
      default:                return [];
    }
  };

  // ── Helpers ──
  const statusPill = (s) => <span className={`pl ${STATUS_PILL[s]}`}>{STATUS_LABELS[s]}</span>;
  const priorityPill = (p) => <span className={`pl ${PRIORITY_PILL[p]}`}>{PRIORITY_LABELS[p]}</span>;

  return (
    <div className={`pl-app ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.pl-app{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
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
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
/* Sub uses a slightly warmer orange accent — matches the Subcontractor Today Board convention */
.pl-app.subcontractor{--ac:#c17a1a;--ac-h:#a6680f;--ac-s:#fdf4e6;--ac-t:#96600f;--ac-m:#e8c896;--shri:0 0 0 3px rgba(193,122,26,.18)}
.pl-app.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
}
.pl-app.dk.subcontractor{--ac:#d49530;--ac-h:#b57d21;--ac-s:#2a2010;--ac-t:#e8b44e;--ac-m:#4a3a1e}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.sb-srch{padding:12px 16px}
.sb-srch input{width:100%;height:32px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:12.5px;background:var(--s2);color:var(--t1);outline:none}
.sb-srch input:focus{border-color:var(--ac);background:var(--s1);box-shadow:var(--shri)}
.s-nav{flex:1;overflow-y:auto;padding:0 10px 16px}
.ns-lbl{font-family:var(--fd);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:10px 10px 6px}
.ni{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r-m);font-size:13px;font-weight:560;color:var(--t2);cursor:pointer;transition:all var(--df)}
.ni:hover{background:var(--sh);color:var(--t1)}
.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:680}
.ni-b{margin-left:auto;min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:720;display:grid;place-items:center;background:var(--s2);color:var(--t3);font-family:var(--fd)}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}
.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}
.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.pl-app.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}
.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}
.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}

.ct{padding:24px;flex:1}

/* Portal switch */
.psw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.psw button{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e)}
.psw button:hover{color:var(--t1)}
.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:560px;line-height:1.5}

.ss{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px}
.ss.sub{grid-template-columns:repeat(4,1fr)}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.sc.alert{border-color:#f5d5a0}.sc.danger{border-color:#f5baba}.sc.strong{border-color:var(--ac-m)}
.pl-app.dk .sc.alert{border-color:#5a4420}.pl-app.dk .sc.danger{border-color:#5a2020}
.sc-label{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

/* Buttons */
.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--df) var(--e);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.ok{background:var(--ok);border-color:var(--ok);color:white}.btn.ok:hover{filter:brightness(.92)}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.pl-app.dk .btn.dg-o{border-color:#5a2020}
.btn.sm{height:32px;padding:0 12px;font-size:12px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2)}
.btn[disabled]{opacity:.45;cursor:not-allowed}

/* Pills */
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.gray{background:var(--s2);color:var(--t3)}

/* Page grid (list + detail) */
.pg-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:700}.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}
.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.wtab .c{margin-left:6px;font-family:var(--fm);font-size:11px;color:var(--t3)}
.wtab.on .c{color:var(--ac-t)}

.md{display:grid;grid-template-columns:360px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}

/* List cards */
.tl{display:flex;flex-direction:column;gap:6px;max-height:720px;overflow-y:auto;padding-right:4px}
.tl::-webkit-scrollbar{width:4px}
.tl::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.cc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e)}
.cc:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.cc.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.cc.overdue{border-left:3px solid var(--dg)}
.cc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.cc-id{font-family:var(--fm);font-size:11px;color:var(--t3)}
.cc-title{font-family:var(--fd);font-size:13px;font-weight:700;margin-top:2px;line-height:1.35}
.cc-loc{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--t3);margin-top:6px}
.cc-loc svg{color:var(--t3);flex-shrink:0}
.cc-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
.cc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--t3);padding-top:8px;border-top:1px solid var(--s2)}
.cc-asg{display:flex;align-items:center;gap:5px}
.cc-ini{width:18px;height:18px;border-radius:50%;background:var(--s2);color:var(--t2);display:grid;place-items:center;font-family:var(--fd);font-size:9.5px;font-weight:700}

/* Detail */
.dp{min-height:400px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;line-height:1.25}
.dh-id{font-family:var(--fm);font-size:12px;color:var(--t3);margin-top:2px}
.dh-desc{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;max-width:560px}
.dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px}

.dg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.dg-i{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.dg-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}
.dg-i .m{font-size:11.5px;color:var(--t2);margin-top:2px}

/* Rejection banner */
.rej-bnr{margin-top:12px;padding:12px 14px;border:1.5px solid #f5baba;border-radius:var(--r-m);background:var(--dg-s);display:flex;gap:10px}
.pl-app.dk .rej-bnr{border-color:#5a2020}
.rej-bnr .k{font-family:var(--fd);font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.05em;color:var(--dg-t);margin-bottom:4px}
.rej-bnr .v{font-size:13px;color:var(--t1);line-height:1.5}

/* Section boxes */
.ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
.ds-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
.ds-h h4{font-family:var(--fd);font-size:13px;font-weight:700}
.ds-acts{display:flex;gap:6px}
.ds-b{padding:14px 16px}
.ds-b p{font-size:13px;color:var(--t2);line-height:1.55}

/* Location chip */
.loc-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);font-size:12.5px;color:var(--t2)}

/* Photo gallery */
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.ph{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;position:relative;cursor:pointer;border:1px solid var(--s3);transition:transform var(--df)}
.ph:hover{transform:scale(1.02)}
.ph .phbg{position:absolute;inset:0}
.ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.6));color:white;font-size:11px;font-weight:600}
.ph-add{aspect-ratio:4/3;border:1.5px dashed var(--s4);border-radius:var(--r-m);background:var(--s2);color:var(--t3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all var(--df)}
.ph-add:hover{border-color:var(--ac);color:var(--ac);background:var(--ac-s)}

/* Comment thread */
.cmt-th{display:flex;flex-direction:column;gap:10px}
.cmt{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--s2)}
.cmt:last-child{border-bottom:none}
.cmt-av{width:28px;height:28px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:10.5px;font-weight:700;flex-shrink:0}
.cmt.sys .cmt-av{background:var(--s3);color:var(--t3)}
.cmt-body{flex:1;min-width:0}
.cmt-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.cmt-name{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}
.cmt-role{font-size:11px;color:var(--t3)}
.cmt-ts{font-size:11px;color:var(--t3);margin-left:auto}
.cmt-text{font-size:13px;color:var(--t1);line-height:1.5}
.cmt.sys .cmt-text{font-size:12.5px;color:var(--t2);font-style:italic}
.cmt-input{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--s2)}
.cmt-input input{flex:1;height:38px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:13px;background:var(--s1);color:var(--t1);outline:none}
.cmt-input input:focus{border-color:var(--ac);box-shadow:var(--shri)}

/* Activity */
.al{display:flex;flex-direction:column}
.ai{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}.ai:last-child{border-bottom:none}
.a-dot{width:8px;height:8px;border-radius:50%;background:var(--ac);margin-top:6px;flex-shrink:0}
.a-text{flex:1;font-size:13px;color:var(--t2)}.a-text strong{color:var(--t1);font-weight:650}
.a-time{font-size:11px;color:var(--t3);flex-shrink:0;padding-top:2px}

/* Transition bar (sticky at bottom of detail) */
.tx-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1.5px solid var(--s3)}
.tx-empty{padding:14px;background:var(--s2);border-radius:var(--r-m);font-size:12.5px;color:var(--t3);text-align:center;margin-top:18px;font-style:italic}

/* Drawer (new item + reject/void) */
.drawer-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;display:flex;justify-content:flex-end;animation:fadeIn var(--dn) var(--e)}
.drawer{width:520px;max-width:100vw;height:100vh;background:var(--s1);display:flex;flex-direction:column;animation:slideIn var(--ds) var(--e);overflow:hidden}
.drawer-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.drawer-h h3{font-family:var(--fd);font-size:17px;font-weight:750}
.drawer-b{flex:1;overflow-y:auto;padding:18px 22px}
.drawer-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px;background:var(--s2)}
.field{margin-bottom:14px}
.field label{display:block;font-family:var(--fd);font-size:12px;font-weight:700;color:var(--t2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.field input,.field select,.field textarea{width:100%;height:38px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:13px;background:var(--s1);color:var(--t1);outline:none;font-family:var(--fb)}
.field textarea{min-height:100px;padding:10px 12px;line-height:1.5;resize:vertical;height:auto}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ac);box-shadow:var(--shri)}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* Modal (smaller than drawer, for reject/void reason) */
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:110;display:grid;place-items:center;animation:fadeIn var(--dn) var(--e);padding:20px}
.modal{width:520px;max-width:100%;background:var(--s1);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shmd)}
.modal-h{padding:18px 22px;border-bottom:1px solid var(--s3)}
.modal-h h3{font-family:var(--fd);font-size:17px;font-weight:750}
.modal-h p{font-size:13px;color:var(--t2);margin-top:3px}
.modal-b{padding:18px 22px}
.modal-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px;background:var(--s2)}

/* Responsive */
@media(max-width:1200px){.md{grid-template-columns:1fr}.ss{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.pl-app{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div>
            <h1>BuiltCRM</h1>
            <div className="brand-ctx">{meta.label}</div>
          </div>
        </div>
        <div className="sb-srch"><input placeholder="Search…" /></div>
        <nav className="s-nav">
          {nav.map((sec) => (
            <div key={sec.section} style={{ marginBottom: 4 }}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map((it) => (
                <div key={it.label} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge != null && <span className={`ni-b ${it.bt}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="mn">
        <div className="tb">
          <div className="bc">
            <span>{meta.label}</span><span className="sep">›</span>
            <span>{meta.project}</span><span className="sep">›</span>
            <span className="cur">{meta.page}</span>
          </div>
          <div className="tb-acts">
            <div className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</div>
            <div className="ib">{I.bell}</div>
            <div className="av">{meta.user}</div>
          </div>
        </div>

        <div className="ct fade-up">
          <div className="psw">
            {[
              ["contractor",    "#5b4fc7", "Contractor"],
              ["subcontractor", "#c17a1a", "Subcontractor"],
            ].map(([k, c, l]) => (
              <button key={k} className={portal === k ? "on" : ""} onClick={() => { setPortal(k); setStatusTab("all"); }}>
                <span className="p-dot" style={{ background: c }} />{l}
              </button>
            ))}
          </div>

          {/* ── Page header ── */}
          <div className="pg-h">
            <div>
              <h2>{portal === "contractor" ? "Punch List" : "My Punch List"}</h2>
              <p>
                {portal === "contractor"
                  ? "Track and verify final completion items across trades. Create items, assign to subs, and close them out as work is inspected and approved."
                  : `Items assigned to ${meta.org}. Mark in progress when you start work and ready-to-verify when complete. The contractor will close out or send back with notes.`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button className="btn sm">Export</button>
              {portal === "contractor" && (
                <button className="btn sm pri" onClick={() => setNewDrawerOpen(true)}>{I.plus} New item</button>
              )}
            </div>
          </div>

          {/* ── Summary strip ── */}
          {portal === "contractor" ? (
            <div className="ss">
              <div className="sc"><div className="sc-label">Total</div><div className="sc-value">{counts.total}</div><div className="sc-meta">Active items</div></div>
              <div className="sc"><div className="sc-label">Open</div><div className="sc-value">{counts.open}</div><div className="sc-meta">Not started</div></div>
              <div className="sc alert"><div className="sc-label">In Progress</div><div className="sc-value">{counts.inProgress}</div><div className="sc-meta">Work underway</div></div>
              <div className="sc strong"><div className="sc-label">Ready to Verify</div><div className="sc-value">{counts.readyToVerify}</div><div className="sc-meta">Needs your check</div></div>
              <div className="sc"><div className="sc-label">Verified</div><div className="sc-value">{counts.verified}</div><div className="sc-meta">Closed out</div></div>
              <div className="sc danger"><div className="sc-label">Overdue</div><div className="sc-value">{counts.overdue}</div><div className="sc-meta">Past due date</div></div>
            </div>
          ) : (
            <div className="ss sub">
              <div className="sc"><div className="sc-label">Assigned to me</div><div className="sc-value">{portalItems.filter(it => it.status !== "void").length}</div><div className="sc-meta">Active items</div></div>
              <div className="sc"><div className="sc-label">Open</div><div className="sc-value">{counts.open}</div><div className="sc-meta">Not started</div></div>
              <div className="sc alert"><div className="sc-label">In Progress</div><div className="sc-value">{counts.inProgress}</div><div className="sc-meta">Working on it</div></div>
              <div className="sc danger"><div className="sc-label">Rejected</div><div className="sc-value">{counts.rejected}</div><div className="sc-meta">Needs rework</div></div>
            </div>
          )}

          {/* ── Workspace card (tabs + list+detail) ── */}
          <div className="pg-grid">
            <div className="ws">
              <div className="ws-head">
                <div>
                  <h3>{portal === "contractor" ? "Item workspace" : "My work"}</h3>
                  <div className="sub">
                    {portal === "contractor"
                      ? "Full lifecycle from creation through verification."
                      : "Items where you're the assigned trade."}
                  </div>
                </div>
              </div>

              <div className="ws-tabs">
                {[
                  ["all", "All"],
                  ["open", "Open"],
                  ["in_progress", "In Progress"],
                  ["ready_to_verify", "Ready to Verify"],
                  ...(portal === "contractor" ? [["rejected","Rejected"], ["verified","Verified"]] : [["rejected","Rejected"]]),
                ].map(([k, label]) => {
                  const count = k === "all"
                    ? portalItems.filter(it => it.status !== "void").length
                    : portalItems.filter(it => it.status === k).length;
                  return (
                    <button key={k} className={`wtab${statusTab === k ? " on" : ""}`} onClick={() => setStatusTab(k)}>
                      {label}<span className="c">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="md">
                {/* List */}
                <div>
                  <div className="tl">
                    {visibleItems.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--t3)" }}>
                        No items in this view.
                      </div>
                    )}
                    {visibleItems.map(it => {
                      const overdue = ["open","in_progress","rejected"].includes(it.status) && it.ageDays >= 3;
                      return (
                        <div key={it.id} className={`cc${selected?.id === it.id ? " on" : ""}${overdue ? " overdue" : ""}`}
                             onClick={() => setSelectedId(it.id)}>
                          <div className="cc-top">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="cc-id">{it.id}</div>
                              <div className="cc-title">{it.title}</div>
                            </div>
                            {statusPill(it.status)}
                          </div>
                          <div className="cc-loc">{I.pin}<span>{it.location}</span></div>
                          <div className="cc-meta">
                            {priorityPill(it.priority)}
                            <span className="pl gray">Due {it.dueDate}</span>
                            {overdue && <span className="pl red">Overdue</span>}
                          </div>
                          <div className="cc-foot">
                            <div className="cc-asg">
                              <div className="cc-ini">{it.assigneeUserInitials}</div>
                              <span>{it.assigneeOrg}</span>
                            </div>
                            <span>{it.ageDays}d old</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detail */}
                <div className="dp">
                  {!selected ? (
                    <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--t3)" }}>
                      Select an item to view details.
                    </div>
                  ) : (
                    <>
                      <div className="dh">
                        <div>
                          <div className="dh-id">{selected.id}</div>
                          <h3>{selected.title}</h3>
                          <div className="dh-desc">{selected.description}</div>
                        </div>
                        <div className="dh-pills">
                          {statusPill(selected.status)}
                          {priorityPill(selected.priority)}
                        </div>
                      </div>

                      <div className="dg">
                        <div className="dg-i"><div className="k">Priority</div><div className="v">{PRIORITY_LABELS[selected.priority]}</div><div className="m">{selected.priority === "urgent" ? "Needs immediate attention" : "Standard"}</div></div>
                        <div className="dg-i"><div className="k">Assignee</div><div className="v">{selected.assigneeOrg}</div><div className="m">{selected.assigneeUserInitials === "MP" ? "Miguel Perez" : "Crew lead"}</div></div>
                        <div className="dg-i"><div className="k">Due</div><div className="v">{selected.dueDate}</div><div className="m">{selected.ageDays >= 3 ? "Overdue" : `${selected.ageDays}d old`}</div></div>
                        <div className="dg-i"><div className="k">Created by</div><div className="v">{selected.createdBy}</div><div className="m">{selected.createdAt}</div></div>
                      </div>

                      {/* Rejection banner (only when status === rejected) */}
                      {selected.status === "rejected" && selected.rejectionReason && (
                        <div className="rej-bnr">
                          <div>
                            <div className="k">Rejected — requires rework</div>
                            <div className="v">{selected.rejectionReason}</div>
                          </div>
                        </div>
                      )}

                      {/* Void banner */}
                      {selected.status === "void" && selected.voidReason && (
                        <div className="rej-bnr" style={{ background: "var(--s2)", borderColor: "var(--s3)" }}>
                          <div>
                            <div className="k" style={{ color: "var(--t3)" }}>Voided</div>
                            <div className="v">{selected.voidReason}</div>
                          </div>
                        </div>
                      )}

                      {/* Location */}
                      <div className="ds">
                        <div className="ds-h"><h4>Location</h4></div>
                        <div className="ds-b">
                          <div className="loc-chip">{I.pin}<span>{selected.location}</span></div>
                        </div>
                      </div>

                      {/* Photos */}
                      <div className="ds">
                        <div className="ds-h">
                          <h4>Photos ({selected.photos.length})</h4>
                          <div className="ds-acts">
                            <button className="btn sm">{I.camera} Add photos</button>
                          </div>
                        </div>
                        <div className="ds-b">
                          {selected.photos.length === 0 ? (
                            <div className="gal">
                              <div className="ph-add">{I.camera}<span>Add photos</span></div>
                            </div>
                          ) : (
                            <div className="gal">
                              {selected.photos.map(p => (
                                <div key={p.id} className="ph">
                                  <div className="phbg" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }} />
                                  <div className="ph-cap">{p.caption}</div>
                                </div>
                              ))}
                              <div className="ph-add">{I.camera}<span>Add more</span></div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Comment thread */}
                      <div className="ds">
                        <div className="ds-h"><h4>Discussion ({selected.comments.filter(c => !c.system).length})</h4></div>
                        <div className="ds-b">
                          <div className="cmt-th">
                            {selected.comments.map(c => (
                              <div key={c.id} className={`cmt${c.system ? " sys" : ""}`}>
                                <div className="cmt-av">{c.initials}</div>
                                <div className="cmt-body">
                                  <div className="cmt-head">
                                    <span className="cmt-name">{c.author}</span>
                                    <span className="cmt-role">{c.role !== "system" ? c.role : ""}</span>
                                    <span className="cmt-ts">{c.ts}</span>
                                  </div>
                                  <div className="cmt-text">{c.body}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {selected.status !== "verified" && selected.status !== "void" && (
                            <div className="cmt-input">
                              <input
                                placeholder="Add a comment…"
                                value={commentDraft}
                                onChange={e => setCommentDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") postComment(); }}
                              />
                              <button className="btn pri" onClick={postComment} disabled={!commentDraft.trim()}>{I.send} Post</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Activity */}
                      <div className="ds">
                        <div className="ds-h"><h4>Activity</h4></div>
                        <div className="ds-b">
                          <div className="al">
                            {selected.activity.map((a, i) => (
                              <div key={i} className="ai">
                                <div className="a-dot" />
                                <div className="a-text"><strong>{a.actor}</strong> {a.body}</div>
                                <div className="a-time">{a.ts}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Transition bar */}
                      {getActions(selected).length === 0 ? (
                        <div className="tx-empty">
                          {selected.status === "verified" && "Item verified and closed. No further actions."}
                          {selected.status === "void" && "Item voided. No further actions."}
                          {selected.status === "ready_to_verify" && portal === "subcontractor" && "Waiting on the contractor to verify."}
                        </div>
                      ) : (
                        <div className="tx-bar">
                          {getActions(selected).map(a => (
                            <button
                              key={a.to}
                              className={`btn ${a.kind}`}
                              onClick={() => {
                                if (a.to === "rejected") setRejectOpen(true);
                                else if (a.to === "void") setVoidOpen(true);
                                else transition(selected.id, a.to);
                              }}
                            >
                              {a.to === "verified" && I.check}
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── New Item Drawer ── */}
      {newDrawerOpen && (
        <div className="drawer-ov" onClick={() => setNewDrawerOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-h">
              <h3>New punch list item</h3>
              <button className="btn ghost" onClick={() => setNewDrawerOpen(false)}>{I.x}</button>
            </div>
            <div className="drawer-b">
              <div className="field">
                <label>Title</label>
                <input placeholder="e.g., Paint runs on east lobby wall" />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea placeholder="What needs to be addressed and how…" />
              </div>
              <div className="field">
                <label>Location</label>
                <input placeholder="e.g., Floor 2 — corridor 2B, door frame upper-left" />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Priority</label>
                  <select defaultValue="normal">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="field">
                  <label>Due date</label>
                  <input type="date" />
                </div>
              </div>
              <div className="field">
                <label>Assign to</label>
                <select defaultValue="">
                  <option value="" disabled>Select subcontractor…</option>
                  <option>Miller Painting Co.</option>
                  <option>Apex Finish Carpentry</option>
                  <option>Lakeshore Electric</option>
                  <option>Unassigned</option>
                </select>
              </div>
              <div className="field">
                <label>Photos (optional)</label>
                <div className="ph-add" style={{ aspectRatio: "unset", padding: 24 }}>
                  {I.camera}<span>Click or drag photos here</span>
                </div>
              </div>
            </div>
            <div className="drawer-f">
              <button className="btn" onClick={() => setNewDrawerOpen(false)}>Cancel</button>
              <button className="btn pri" onClick={() => setNewDrawerOpen(false)}>{I.plus} Create item</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Reason Modal ── */}
      {rejectOpen && (
        <div className="modal-ov" onClick={() => setRejectOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Reject — send back for rework</h3>
              <p>Explain what still needs to be addressed. This reason will be shown to the assignee and logged on the thread.</p>
            </div>
            <div className="modal-b">
              <div className="field">
                <label>Reason</label>
                <textarea placeholder="e.g., Caulk applied unevenly, still gaps at the two mitered corners. Needs full redo." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-f">
              <button className="btn" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>Cancel</button>
              <button className="btn dg-o" disabled={!rejectReason.trim()}
                      onClick={() => { transition(selected.id, "rejected", { rejectionReason: rejectReason }); setRejectOpen(false); setRejectReason(""); }}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void Reason Modal ── */}
      {voidOpen && (
        <div className="modal-ov" onClick={() => setVoidOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Void this item</h3>
              <p>Voiding removes the item from the active list but preserves the record for audit. Use for duplicates, mistakes, or items no longer applicable.</p>
            </div>
            <div className="modal-b">
              <div className="field">
                <label>Reason</label>
                <textarea placeholder="e.g., Duplicate of PI-007. Consolidated." value={voidReason} onChange={e => setVoidReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-f">
              <button className="btn" onClick={() => { setVoidOpen(false); setVoidReason(""); }}>Cancel</button>
              <button className="btn dg-o" disabled={!voidReason.trim()}
                      onClick={() => { transition(selected.id, "void", { voidReason: voidReason }); setVoidOpen(false); setVoidReason(""); }}>
                Void item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
