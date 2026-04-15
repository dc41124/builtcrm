import { useState } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>,
  attach: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m21.44 11.05-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  photo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 00-2.828 0L6 21"/></svg>,
  file: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  link: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  info: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  addUser: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  dots: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
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

// ── Portal configs ──────────────────────────────────────────────
const portals = [
  { id: "contractor", dot: "#5b4fc7", label: "Contractor" },
  { id: "sub", dot: "#3d6b8e", label: "Subcontractor" },
  { id: "comm", dot: "#3178b9", label: "Commercial Client" },
  { id: "resi", dot: "#2a7f6f", label: "Residential Client" },
];

const portalMeta = {
  contractor: { label: "Contractor Portal", project: "Riverside Tower Fit-Out", page: "Messages", user: "DC", name: "Dan Carter", role: "Project Manager" },
  sub: { label: "Subcontractor Portal", project: "Riverside Tower Fit-Out", page: "Messages", user: "AM", name: "Alex Morgan", role: "Meridian MEP" },
  comm: { label: "Commercial Client Portal", project: "Riverside Tower Fit-Out", page: "Messages", user: "PK", name: "Priya Kapoor", role: "Riverside Dev Co" },
  resi: { label: "Residential Client Portal", project: "Carter Residence", page: "Messages", user: "MR", name: "Maria & Rob", role: "Homeowners" },
};

const navData = {
  contractor: [
    { section: "Overview", items: [{ label: "Dashboard" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 3 },
      { label: "Change Orders", badge: 1, bt: "warn" }, { label: "Approvals", badge: 2 },
      { label: "Selections" }, { label: "Billing / Draws" }, { label: "Compliance" },
      { label: "Upload Requests" }, { label: "Documents" }, { label: "Budget" }, { label: "Schedule" },
      { label: "Messages", active: true, badge: 3 }, { label: "Team" },
    ]},
  ],
  sub: [
    { section: "Your Projects", items: [{ label: "Today Board" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "RFIs / Issues", badge: 2, bt: "danger" },
      { label: "Upload Requests", badge: 1 }, { label: "Compliance", badge: 1, bt: "warn" },
      { label: "Documents" }, { label: "Payments" }, { label: "Schedule" },
      { label: "Messages", active: true, badge: 1 },
    ]},
  ],
  comm: [
    { section: "Your Projects", items: [{ label: "Riverside Tower Fit-Out" }] },
    { section: "Riverside Tower Fit-Out", items: [
      { label: "Project Home" }, { label: "Progress & Updates" },
      { label: "Scope Changes", badge: 1, bt: "warn" }, { label: "Approvals", badge: 1 },
      { label: "Billing / Draws" }, { label: "Documents" }, { label: "Schedule" },
      { label: "Messages", active: true }, { label: "Photos" },
    ]},
  ],
  resi: [
    { section: "Your Home", items: [{ label: "Project Home" }] },
    { section: "Carter Residence", items: [
      { label: "Progress & Photos" }, { label: "Selections", badge: 2 },
      { label: "Decisions" }, { label: "Scope Changes" }, { label: "Budget" }, { label: "Schedule" },
      { label: "Messages", active: true }, { label: "Documents" },
    ]},
  ],
};

// ── Conversation data ───────────────────────────────────────────
const convData = {
  contractor: [
    { id: "gc-general1", av: "JW", avBg: "#3178b9", title: "Elevator shaft coordination", time: "2m ago", preview: "James: Can we push the lobby ceiling install to after elevator\u2026", type: "General", typeCl: "general", participants: "James W, You, Alex M", unread: 2 },
    { id: "gc-rfi1", av: "R", avBg: null, title: "RFI-018: Floor drain spec clarification", time: "28m", preview: "Alex: I've uploaded the revised spec sheet, see attachment\u2026", type: "RFI", typeCl: "rfi", participants: "Alex M, You", unread: 1 },
    { id: "gc-co1", av: "C", avBg: null, title: "CO-004: Upgraded lobby finishes", time: "1h", preview: "Priya: The board wants to review the stone samples before\u2026", type: "Change Order", typeCl: "co", participants: "Priya K, James W, You", unread: 3 },
    { id: "gc-appr1", av: "A", avBg: null, title: "Approval: Mechanical room layout", time: "3h", preview: "You: Approved with note \u2014 please confirm routing for the\u2026", type: "Approval", typeCl: "approval", participants: "Tom N, Alex M, You" },
    { id: "gc-gen2", av: "LC", avBg: "#5b4fc7", title: "Furniture delivery logistics", time: "Yesterday", preview: "Lisa: The lead time on the executive chairs came back at 8\u2026", type: "General", typeCl: "general", participants: "Lisa C, You" },
    { id: "gc-rfi2", av: "R", avBg: null, title: "RFI-015: Fire stop detailing", time: "Apr 10", preview: "You: Closing this thread \u2014 resolved per updated drawing\u2026", type: "RFI", typeCl: "rfi", participants: "Tom N, You" },
    { id: "gc-gen3", av: "PK", avBg: "#3178b9", title: "Site visit schedule \u2014 week of Apr 14", time: "Apr 9", preview: "Priya: Thursday 2pm works for our team. Confirm\u2026", type: "General", typeCl: "general", participants: "Priya K, James W, You" },
    { id: "gc-sys", av: "S", avBg: null, title: "Welcome to Riverside Tower Fit-Out", time: "Mar 15", preview: "System: Project messaging has been activated\u2026", type: "System", typeCl: "system", participants: "" },
  ],
  sub: [
    { id: "sub-rfi1", av: "R", avBg: null, title: "RFI-018: Floor drain spec clarification", time: "28m", preview: "Dan: Great, I'll update the RFI with the confirmed model\u2026", type: "RFI", typeCl: "rfi", participants: "Dan C, You", unread: 1 },
    { id: "sub-gen1", av: "DC", avBg: "#5b4fc7", title: "Elevator shaft coordination", time: "47m", preview: "You: Our conduit run needs about 3 working days once\u2026", type: "General", typeCl: "general", participants: "Dan C, James W, You" },
    { id: "sub-appr1", av: "A", avBg: null, title: "Approval: Mechanical room layout", time: "3h", preview: "Dan: Approved with note \u2014 please confirm routing\u2026", type: "Approval", typeCl: "approval", participants: "Dan C, Tom N, You" },
    { id: "sub-rfi2", av: "R", avBg: null, title: "RFI-015: Fire stop detailing", time: "Apr 10", preview: "Dan: Closing this thread \u2014 resolved per updated drawing\u2026", type: "RFI", typeCl: "rfi", participants: "Dan C, You" },
  ],
  comm: [
    { id: "cm-co1", av: "C", avBg: null, title: "Scope Change: Upgraded lobby finishes", time: "1h", preview: "Dan: We've sent over the stone samples list \u2014 three\u2026", type: "Scope Change", typeCl: "co", participants: "Dan C, You, James W" },
    { id: "cm-gen1", av: "DC", avBg: "#5b4fc7", title: "Site visit schedule \u2014 week of Apr 14", time: "Apr 9", preview: "You: Thursday 2pm works for our team. Confirm?", type: "General", typeCl: "general", participants: "Dan C, You, James W" },
    { id: "cm-gen2", av: "DC", avBg: "#5b4fc7", title: "Monthly progress update \u2014 March", time: "Apr 2", preview: "Dan: Hi James, attached is the March progress report\u2026", type: "General", typeCl: "general", participants: "Dan C, You" },
  ],
  resi: [
    { id: "rs-gen1", av: "DC", avBg: "#2a7f6f", title: "Kitchen backsplash \u2014 going with Option B?", time: "2h", preview: "Dan: Great choice! I'll confirm the order with the supplier\u2026", type: "General", typeCl: "general", participants: "Dan C, You" },
    { id: "rs-dec1", av: "A", avBg: "#2d8a5e", title: "Decision: Master bath fixture finish", time: "Apr 10", preview: "You: We'd like to go with the brushed gold. Confirmed!", type: "Decision", typeCl: "approval", participants: "Dan C, You" },
    { id: "rs-gen2", av: "DC", avBg: "#2a7f6f", title: "Weekly update \u2014 framing progress", time: "Apr 7", preview: "Dan: Great news \u2014 framing is 90% complete on the second\u2026", type: "Update", typeCl: "general", participants: "Dan C, You" },
    { id: "rs-sys", av: "S", avBg: null, title: "Welcome to your project!", time: "Mar 1", preview: "Your project portal is set up and ready to go\u2026", type: "System", typeCl: "system", participants: "" },
  ],
};

// ── Thread data ─────────────────────────────────────────────────
const threadData = {
  "gc-general1": {
    title: "Elevator shaft coordination",
    linked: null,
    participants: [{ name: "James Whitfield", online: true }, { name: "Dan Carter (You)", online: true }, { name: "Alex Morgan", online: false }],
    showActions: true,
    messages: [
      { type: "system", text: "Alex Morgan was added to this conversation", icon: "info" },
      { from: "James Whitfield", av: "JW", bg: "#3178b9", mine: false, text: "Hey Dan \u2014 we're getting close to the elevator shaft work on floors 12-15. The MEP team mentioned they need to route some conduit before we close up the walls. Can we push the lobby ceiling install to after elevator cab installation? Otherwise we'll have access issues.", time: "10:14 AM" },
      { from: "You", av: "DC", bg: "#5b4fc7", mine: true, text: "Good call. I'll check with the schedule \u2014 we might be able to shift the ceiling install by a week without impacting the critical path. Let me loop in Alex from Meridian to confirm the conduit routing timeline.", time: "10:22 AM" },
      { from: "James Whitfield", av: "JW", bg: "#3178b9", mine: false, text: "Perfect. Here's the revised elevator schedule from the subcontractor \u2014 they're targeting cab install for week of April 21.", time: "10:30 AM", attachment: "elevator_schedule_rev2.pdf" },
      { from: "Alex Morgan", av: "AM", bg: "#3d6b8e", mine: false, text: "Just seeing this \u2014 our conduit run through the shaft needs about 3 working days once the rough-in framing is done. If elevator cabs go in week of the 21st, we'd need access April 14-18. Does that work with your framing schedule?", time: "10:47 AM" },
    ],
    typing: { name: "James", active: true },
    composePlaceholder: "Type a message\u2026",
  },
  "gc-rfi1": {
    title: "RFI-018: Floor drain spec clarification",
    linked: { label: "View RFI-018 \u2192", type: "rfi" },
    participants: [{ name: "Alex Morgan", online: true }, { name: "Dan Carter (You)", online: true }],
    showActions: true,
    messages: [
      { type: "system", text: "Conversation linked to RFI-018 \u2014 Floor drain spec clarification", icon: "link" },
      { from: "You", av: "DC", bg: "#5b4fc7", mine: true, text: "Alex \u2014 the architect flagged that the floor drain spec in the L2 restrooms doesn't match the updated plumbing drawings. Can you pull the spec sheet from the manufacturer and confirm the model number?", time: "9:15 AM" },
      { from: "Alex Morgan", av: "AM", bg: "#3d6b8e", mine: false, text: "Found it \u2014 we'd been using the old model. Here's the updated spec sheet from Zurn. Model ZN415-S matches the architect's detail.", time: "9:42 AM", attachment: "ZN415-S_spec_sheet.pdf" },
      { type: "system", text: "Alex Morgan attached ZN415-S_spec_sheet.pdf to RFI-018", icon: "file" },
    ],
    typing: null,
    composePlaceholder: "Reply to RFI-018 thread\u2026",
  },
  "sub-rfi1": {
    title: "RFI-018: Floor drain spec clarification",
    linked: { label: "View RFI-018 \u2192", type: "rfi" },
    participants: [{ name: "Dan Carter", online: true }, { name: "Alex Morgan (You)", online: true }],
    showActions: false,
    messages: [
      { type: "system", text: "Conversation linked to RFI-018", icon: "link" },
      { from: "Dan Carter", av: "DC", bg: "#5b4fc7", mine: false, text: "Alex \u2014 the architect flagged that the floor drain spec in the L2 restrooms doesn't match the updated plumbing drawings. Can you pull the spec sheet from the manufacturer and confirm the model number?", time: "9:15 AM" },
      { from: "You", av: "AM", bg: "#3d6b8e", mine: true, text: "Found it \u2014 we'd been using the old model. Here's the updated spec sheet from Zurn. Model ZN415-S matches the architect's detail.", time: "9:42 AM", attachment: "ZN415-S_spec_sheet.pdf" },
      { from: "Dan Carter", av: "DC", bg: "#5b4fc7", mine: false, text: "Great, I'll update the RFI with the confirmed model. Thanks for the quick turnaround.", time: "9:58 AM" },
    ],
    typing: null,
    composePlaceholder: "Reply\u2026",
  },
  "cm-co1": {
    title: "Scope Change: Upgraded lobby finishes",
    linked: { label: "View Scope Change CO-004 \u2192", type: "co" },
    participants: [{ name: "Dan Carter \u2014 Carter & Co", online: true }],
    showActions: false,
    messages: [
      { type: "system", text: "Linked to Scope Change CO-004 \u2014 Upgraded lobby finishes", icon: "link" },
      { from: "Dan Carter", av: "DC", bg: "#5b4fc7", mine: false, text: "Hi James, Priya \u2014 following up on the lobby finish upgrade discussion. We've sent over the stone samples list with three options at different price points. The scope change request is ready for your review in the Scope Changes section.", time: "11:05 AM" },
      { from: "You (Priya Kapoor)", av: "PK", bg: "#3178b9", mine: true, text: "Thanks Dan. The board wants to review the stone samples before we commit. Can we schedule a 15-min walkthrough at the site to see the mock-up installations?", time: "11:18 AM" },
      { from: "Dan Carter", av: "DC", bg: "#5b4fc7", mine: false, text: "Absolutely. I'll have the three samples installed in the lobby mock-up area by end of this week. Would Thursday or Friday work for a walkthrough?", time: "11:24 AM" },
    ],
    typing: null,
    composePlaceholder: "Reply to conversation\u2026",
  },
  "rs-gen1": {
    title: "Kitchen backsplash \u2014 going with Option B?",
    linked: null,
    participants: [{ name: "Dan Carter \u2014 Your Builder", online: true }],
    showActions: false,
    messages: [
      { from: "Dan Carter", av: "DC", bg: "#5b4fc7", mine: false, text: "Hey! Just checking in on the kitchen backsplash. You mentioned you were leaning toward Option B (the herringbone subway tile in warm white). Want to lock that in? The tile supplier needs about a week lead time.", time: "10:30 AM" },
      { from: "You", av: "MR", bg: "#2a7f6f", mine: true, text: "Yes! We love the herringbone pattern. Let's go with Option B. Quick question though \u2014 is the grout color included in the selection or do we pick that separately?", time: "10:45 AM" },
      { from: "Dan Carter", av: "DC", bg: "#5b4fc7", mine: false, text: "Great choice! You'll pick the grout color separately \u2014 I'll add it to your Selections page. Usually for warm white tile, clients go with either a matching white or a light warm gray. I'll put both options up for you to compare.", time: "11:02 AM", attachment: "grout_color_samples.jpg", attachIcon: "photo" },
      { type: "system", text: "Kitchen Backsplash selection confirmed \u2014 Option B (Herringbone Warm White)", icon: "check" },
    ],
    typing: null,
    composePlaceholder: "Message your builder\u2026",
    composeIcon: "photo",
  },
};

// Default thread IDs per portal
const defaultThread = { contractor: "gc-general1", sub: "sub-rfi1", comm: "cm-co1", resi: "rs-gen1" };

// Filter tab configs per portal
const filterTabs = {
  contractor: ["All", "Unread", "General", "RFI-linked", "CO-linked", "Approvals"],
  sub: ["All", "Unread", "RFI-linked", "General"],
  comm: null,
  resi: null,
};

// ── Component ───────────────────────────────────────────────────
export default function MessagesConversations() {
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");
  const [activeConv, setActiveConv] = useState(defaultThread);
  const [showCreate, setShowCreate] = useState({});
  const [filterTab, setFilterTab] = useState(0);

  const meta = portalMeta[portal];
  const nav = navData[portal];
  const convs = convData[portal];
  const selId = activeConv[portal] || convs[0]?.id;
  const thread = threadData[selId];
  const tabs = filterTabs[portal];
  const unreadCount = convs.filter(c => c.unread).length;

  const switchPortal = (p) => { setPortal(p); setFilterTab(0); };
  const selectConv = (id) => setActiveConv(prev => ({ ...prev, [portal]: id }));
  const toggleCreate = () => setShowCreate(prev => ({ ...prev, [portal]: !prev[portal] }));

  // Page subtitle per portal
  const subtitle = {
    contractor: `${convs.length} conversations \u00b7 ${unreadCount} unread`,
    sub: `${convs.length} conversations \u00b7 ${unreadCount} unread`,
    comm: "Your conversations with the project team",
    resi: "Chat with your builder",
  }[portal];

  return (
    <div className={`ms ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.ms{
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
.ms.sub{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15)}
.ms.comm{--ac:#3178b9;--ac-h:#296aa6;--ac-s:#e8f1fa;--ac-t:#276299;--ac-m:#b0cfe8;--shri:0 0 0 3px rgba(49,120,185,.15)}
.ms.resi{--ac:#2a7f6f;--ac-h:#237060;--ac-s:#e6f5f1;--ac-t:#1f6b5d;--ac-m:#a8d5ca;--shri:0 0 0 3px rgba(42,127,111,.15)}
.ms.dk{
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;
  --ac:#7b6ff0;--ac-h:#6a5ed6;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#3d3660;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
}
.ms.dk.sub{--ac:#5a9fc0;--ac-h:#4d8aaa;--ac-s:#142030;--ac-t:#7eb8d8;--ac-m:#2a4a5e}
.ms.dk.comm{--ac:#4a94d4;--ac-h:#3d82c0;--ac-s:#141f2c;--ac-t:#6cb0ee;--ac-m:#2a4a60}
.ms.dk.resi{--ac:#3da88e;--ac-h:#2e8f78;--ac-s:#142a24;--ac-t:#5ec4a4;--ac-m:#1e4a3c}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.s-foot{border-top:1px solid var(--s3);padding:12px 16px;flex-shrink:0}
.s-user{display:flex;align-items:center;gap:10px;padding:6px}
.s-user-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac-m));color:white;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;flex-shrink:0}
.s-user-name{font-size:13px;font-weight:580;color:var(--t1)}.s-user-role{font-size:11px;color:var(--t3);margin-top:1px}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.tb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.ms.dk .tb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px;flex:1}

/* Portal switch */
.psw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content;flex-wrap:wrap}
.psw button{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e);white-space:nowrap}
.psw button:hover{color:var(--t1)}.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Page header */
.pg-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-hdr h2{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em}
.pg-sub{font-size:13px;color:var(--t2);margin-top:4px;font-weight:520}

/* Buttons */
.btn{height:38px;padding:0 18px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all var(--dn) var(--e);font-family:var(--fb)}
.btn.primary{background:var(--ac);color:white;border:none}.btn.primary:hover{background:var(--ac-h);box-shadow:var(--shmd)}
.btn.ghost{border:1px solid var(--s3);background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--sh);border-color:var(--s4);color:var(--t1)}
.btn.cancel{height:38px;padding:0 18px;border-radius:var(--r-m);border:1px solid var(--s3);font-size:13px;font-weight:620;color:var(--t2);background:transparent}.btn.cancel:hover{background:var(--sh)}

/* Filter tabs */
.ftabs{display:flex;gap:2px;margin-bottom:16px;background:var(--s2);border-radius:var(--r-m);padding:3px;width:fit-content}
.ftab{height:30px;padding:0 12px;border-radius:var(--r-s);font-size:12px;font-weight:620;color:var(--t3);display:inline-flex;align-items:center;gap:5px;transition:all var(--df);white-space:nowrap}
.ftab:hover{color:var(--t2)}.ftab.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.f-ct{font-size:10px;font-weight:700;color:var(--ac-t);background:var(--ac-s);min-width:16px;height:16px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd)}

/* Master-detail layout */
.ml{display:grid;grid-template-columns:380px 1fr;gap:0;min-height:calc(100vh - 260px);background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}

/* Conversation list */
.c-list{border-right:1px solid var(--s3);display:flex;flex-direction:column;overflow:hidden}
.c-list-hdr{padding:14px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
.c-srch{width:100%;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px 0 34px;font-size:13px;color:var(--t1);outline:none}
.c-srch:focus{border-color:var(--ac);box-shadow:var(--shri)}
.c-scroll{flex:1;overflow-y:auto}
.c-scroll::-webkit-scrollbar{width:4px}.c-scroll::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

/* Conv card */
.cc{padding:14px 16px;border-bottom:1px solid var(--s3);cursor:pointer;transition:background var(--df);display:flex;gap:12px;position:relative}
.cc:hover{background:var(--sh)}.cc.on{background:var(--ac-s)}
.cc.unread .cc-title{font-weight:700}
.cc.unread::before{content:'';position:absolute;left:6px;top:50%;transform:translateY(-50%);width:6px;height:6px;border-radius:50%;background:var(--ac)}
.cc-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700;flex-shrink:0;color:white}
.cc-av.general{background:var(--ac)}.cc-av.rfi{background:var(--in)}.cc-av.co{background:var(--wr)}.cc-av.approval{background:var(--ok)}.cc-av.system{background:var(--s4);color:var(--t2)}
.cc-body{flex:1;min-width:0}
.cc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}
.cc-title{font-size:13.5px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.cc-time{font-size:11px;color:var(--t3);font-weight:520;flex-shrink:0;font-family:var(--fd)}
.cc-prev{font-size:12.5px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;font-weight:520}
.cc-meta{display:flex;align-items:center;gap:6px;margin-top:5px}
.cc-type{font-size:10px;font-weight:650;padding:2px 7px;border-radius:999px;letter-spacing:.02em;white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.cc-type.general{background:var(--ac-s);color:var(--ac-t)}.cc-type.rfi{background:var(--in-s);color:var(--in-t)}.cc-type.co{background:var(--wr-s);color:var(--wr-t)}.cc-type.approval{background:var(--ok-s);color:var(--ok-t)}.cc-type.system{background:var(--s2);color:var(--t3)}
.cc-parts{font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:520}
.unread-ct{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--ac);color:white;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0;align-self:center}

/* Thread detail */
.td{display:flex;flex-direction:column;height:100%}
.td-hdr{padding:16px 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.td-hdr-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.td-title{font-family:var(--fd);font-size:17px;font-weight:700;letter-spacing:-.02em}
.td-linked{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:999px;margin-top:6px;cursor:pointer;transition:background var(--df)}
.td-linked.rfi{color:var(--in-t);background:var(--in-s)}.td-linked.rfi:hover{background:#d4e6f5}
.td-linked.co{color:var(--wr-t);background:var(--wr-s)}.td-linked.co:hover{background:#f5e5c9}
.td-linked.approval{color:var(--ok-t);background:var(--ok-s)}.td-linked.approval:hover{background:#c9ebd8}
.td-parts{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--t3);flex-wrap:wrap}
.p-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:560;color:var(--t2);background:var(--s2);padding:2px 8px;border-radius:999px}
.p-dot-on{width:6px;height:6px;border-radius:50%;background:var(--ok)}.p-dot-off{width:6px;height:6px;border-radius:50%;background:var(--s4)}
.td-acts{display:flex;gap:6px;flex-shrink:0}

/* Messages scroll */
.m-scroll{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:2px}
.m-scroll::-webkit-scrollbar{width:4px}.m-scroll::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.m-group{margin-bottom:16px}
.m-date{text-align:center;margin-bottom:14px}
.m-date span{font-size:11px;font-weight:650;color:var(--t3);background:var(--s2);padding:3px 12px;border-radius:999px;letter-spacing:.02em}

/* System msg */
.sys-msg{text-align:center;margin:12px 0;padding:6px 0}
.sys-inner{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--t3);font-weight:560;background:var(--s2);padding:4px 14px;border-radius:999px}

/* Bubble */
.bub-row{display:flex;gap:10px;margin-bottom:4px;align-items:flex-end}
.bub-row.mine{flex-direction:row-reverse}
.bub-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;color:white;flex-shrink:0;margin-bottom:2px}
.bub-col{max-width:65%;display:flex;flex-direction:column}
.bub-name{font-size:11px;font-weight:650;color:var(--t2);margin-bottom:3px;padding-left:2px}
.bub-row.mine .bub-name{text-align:right;padding-right:2px;padding-left:0}
.bub{padding:10px 14px;border-radius:var(--r-l);font-size:13.5px;line-height:1.55;word-wrap:break-word;font-weight:520}
.bub.in{background:var(--s2);color:var(--t1);border-bottom-left-radius:var(--r-s)}
.bub.out{background:var(--ac);color:white;border-bottom-right-radius:var(--r-s)}
.bub-time{font-size:10.5px;color:var(--t3);margin-top:3px;padding:0 2px;font-weight:520}
.bub-row.mine .bub-time{text-align:right}

/* Attachment chip */
.att{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:var(--r-s);margin-top:6px;cursor:pointer;transition:background var(--df);font-family:var(--fm)}
.bub.in .att{background:var(--s1);border:1px solid var(--s3);color:var(--t2)}.bub.in .att:hover{background:var(--sh)}
.bub.out .att{background:rgba(255,255,255,.2);color:white;border:none}.bub.out .att:hover{background:rgba(255,255,255,.3)}

/* Typing */
.typing{display:flex;align-items:center;gap:8px;padding:4px 0 8px;margin-left:38px}
.typing-dots{display:flex;gap:3px;background:var(--s2);padding:8px 14px;border-radius:var(--r-l);border-bottom-left-radius:var(--r-s)}
.typing-dots span{width:6px;height:6px;border-radius:50%;background:var(--t3);animation:typB 1.4s infinite}
.typing-dots span:nth-child(2){animation-delay:.2s}
.typing-dots span:nth-child(3){animation-delay:.4s}
@keyframes typB{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
.typing-name{font-size:11px;color:var(--t3);font-weight:560}

/* Compose bar */
.comp{border-top:1px solid var(--s3);padding:14px 20px;flex-shrink:0;display:flex;align-items:flex-end;gap:10px;background:var(--s1)}
.comp-input{flex:1;min-height:40px;max-height:120px;border-radius:var(--r-l);border:1px solid var(--s3);background:var(--s2);padding:10px 14px;font-size:13.5px;color:var(--t1);outline:none;resize:none;line-height:1.5;font-family:var(--fb)}
.comp-input:focus{border-color:var(--ac);background:var(--s1);box-shadow:var(--shri)}
.comp-btn{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;color:var(--t3);transition:all var(--df)}.comp-btn:hover{background:var(--sh);color:var(--t2)}
.comp-send{width:36px;height:36px;border-radius:var(--r-m);background:var(--ac);color:white;display:grid;place-items:center;transition:all var(--df)}.comp-send:hover{background:var(--ac-h);box-shadow:var(--shmd)}

/* Create panel */
.crp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;margin-bottom:16px;box-shadow:var(--shmd)}
.crp h3{font-family:var(--fd);font-size:17px;font-weight:720;letter-spacing:-.02em;margin-bottom:16px}
.f-row{margin-bottom:14px}
.f-lbl{font-size:12px;font-weight:640;color:var(--t2);margin-bottom:5px;display:block}
.f-input{width:100%;height:38px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none}
.f-input:focus{border-color:var(--ac);box-shadow:var(--shri);background:var(--s1)}
.f-sel{width:100%;height:38px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none;cursor:pointer;appearance:none}
.f-sel:focus{border-color:var(--ac);box-shadow:var(--shri);background:var(--s1)}
.f-ta{width:100%;min-height:80px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:10px 12px;font-size:13px;color:var(--t1);outline:none;resize:vertical;line-height:1.5;font-family:var(--fb)}
.f-ta:focus{border-color:var(--ac);box-shadow:var(--shri);background:var(--s1)}
.f-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}

/* Participant tags */
.pt{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:580;color:var(--t2);background:var(--s2);border:1px solid var(--s3);padding:4px 10px;border-radius:999px;cursor:pointer;transition:all var(--df);margin:0 4px 4px 0}
.pt:hover{border-color:var(--ac);color:var(--ac-t)}.pt.sel{background:var(--ac-s);border-color:var(--ac);color:var(--ac-t);font-weight:650}

@media(max-width:1200px){.ml{grid-template-columns:1fr}}
@media(max-width:900px){.ms{grid-template-columns:1fr}.side{display:none}}
      `}</style>

      {/* ── Sidebar ── */}
      <aside className="side">
        <div className="brand">
          <Logo />
          <div><h1>BuiltCRM</h1><div className="brand-ctx">{meta.label}</div></div>
        </div>
        <nav className="s-nav">
          {nav.map((sec, si) => (
            <div key={si}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map((it, ii) => (
                <div key={ii} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  {it.badge && <span className={`ni-b ${it.bt || "blue"}`}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="s-foot">
          <div className="s-user">
            <div className="s-user-av">{meta.user}</div>
            <div><div className="s-user-name">{meta.name}</div><div className="s-user-role">{meta.role}</div></div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="mn">
        <header className="tb">
          <div className="bc">
            <span>{meta.label}</span><span className="sep">/</span>
            <span>{meta.project}</span><span className="sep">/</span>
            <span className="cur">{meta.page}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)}>{dark ? I.sun : I.moon}</button>
            <button className="ib">{I.bell}</button>
            <div className="av">{meta.user}</div>
          </div>
        </header>

        <div className="ct">
          {/* Portal switch */}
          <div className="psw">
            {portals.map(p => (
              <button key={p.id} className={portal === p.id ? "on" : ""} onClick={() => switchPortal(p.id)}>
                <span className="p-dot" style={{ background: p.dot }} /> {p.label}
              </button>
            ))}
          </div>

          {/* Page header */}
          <div className="pg-hdr">
            <div>
              <h2>Messages</h2>
              <div className="pg-sub">{subtitle}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(portal === "contractor") ? (
                <button className="btn ghost" onClick={toggleCreate}>{I.plus} New Conversation</button>
              ) : (
                <button className="btn primary" onClick={toggleCreate}>{I.plus} New Message</button>
              )}
            </div>
          </div>

          {/* Create panel */}
          {showCreate[portal] && <CreatePanel portal={portal} onClose={toggleCreate} />}

          {/* Filter tabs */}
          {tabs && (
            <div className="ftabs">
              {tabs.map((t, i) => {
                let count = null;
                if (t === "All") count = convs.length;
                else if (t === "Unread") count = unreadCount;
                return (
                  <button key={t} className={`ftab${filterTab === i ? " on" : ""}`} onClick={() => setFilterTab(i)}>
                    {t} {count != null && <span className="f-ct">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Master-detail */}
          <div className="ml">
            <div className="c-list">
              <div className="c-list-hdr">
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }}>{I.search}</div>
                  <input className="c-srch" placeholder="Search conversations\u2026" />
                </div>
              </div>
              <div className="c-scroll">
                {convs.map(c => (
                  <div key={c.id} className={`cc${selId === c.id ? " on" : ""}${c.unread ? " unread" : ""}`} onClick={() => selectConv(c.id)}>
                    <div className={`cc-av ${c.typeCl}`} style={c.avBg ? { background: c.avBg } : {}}>{c.av}</div>
                    <div className="cc-body">
                      <div className="cc-top">
                        <span className="cc-title">{c.title}</span>
                        <span className="cc-time">{c.time}</span>
                      </div>
                      <div className="cc-prev">{c.preview}</div>
                      <div className="cc-meta">
                        <span className={`cc-type ${c.typeCl}`}>{c.type}</span>
                        {c.participants && <span className="cc-parts">{c.participants}</span>}
                      </div>
                    </div>
                    {c.unread && <span className="unread-ct">{c.unread}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Thread detail */}
            {thread ? <ThreadDetail thread={thread} /> : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--t3)", gap: 8, padding: 40 }}>
                <p style={{ fontSize: 14, fontWeight: 580 }}>Select a conversation</p>
                <span style={{ fontSize: 12.5 }}>Choose a thread from the list to view messages</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Thread Detail ───────────────────────────────────────────────
function ThreadDetail({ thread }) {
  return (
    <div className="td">
      <div className="td-hdr">
        <div className="td-hdr-top">
          <div>
            <div className="td-title">{thread.title}</div>
            {thread.linked && (
              <div className={`td-linked ${thread.linked.type}`}>{I.link} {thread.linked.label}</div>
            )}
            <div className="td-parts">
              <span style={{ marginRight: 2 }}>{thread.participants.length > 2 ? "Participants:" : "With:"}</span>
              {thread.participants.map((p, i) => (
                <span key={i} className="p-chip">
                  <span className={p.online ? "p-dot-on" : "p-dot-off"} /> {p.name}
                </span>
              ))}
            </div>
          </div>
          {thread.showActions && (
            <div className="td-acts">
              <button className="btn ghost" style={{ height: 34, padding: "0 10px" }}>{I.addUser}</button>
              <button className="btn ghost" style={{ height: 34, padding: "0 10px" }}>{I.dots}</button>
            </div>
          )}
        </div>
      </div>

      <div className="m-scroll">
        <div className="m-group">
          <div className="m-date"><span>Today</span></div>
          {thread.messages.map((msg, i) => {
            if (msg.type === "system") {
              const icon = msg.icon === "link" ? I.link : msg.icon === "file" ? I.file : msg.icon === "check" ? I.check : I.info;
              return (
                <div key={i} className="sys-msg">
                  <span className="sys-inner">{icon} {msg.text}</span>
                </div>
              );
            }
            return (
              <div key={i} className={`bub-row${msg.mine ? " mine" : ""}`}>
                <div className="bub-av" style={{ background: msg.bg }}>{msg.av}</div>
                <div className="bub-col">
                  <div className="bub-name">{msg.from}</div>
                  <div className={`bub ${msg.mine ? "out" : "in"}`}>
                    {msg.text}
                    {msg.attachment && (
                      <div className="att">
                        {msg.attachIcon === "photo" ? I.photo : I.file}
                        {msg.attachment}
                      </div>
                    )}
                  </div>
                  <div className="bub-time">{msg.time}</div>
                </div>
              </div>
            );
          })}
          {thread.typing?.active && (
            <div className="typing">
              <div className="typing-dots"><span /><span /><span /></div>
              <span className="typing-name">{thread.typing.name} is typing\u2026</span>
            </div>
          )}
        </div>
      </div>

      <div className="comp">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button className="comp-btn">{thread.composeIcon === "photo" ? I.photo : I.attach}</button>
        </div>
        <textarea className="comp-input" rows="1" placeholder={thread.composePlaceholder} />
        <button className="comp-send">{I.send}</button>
      </div>
    </div>
  );
}

// ── Create Panel ────────────────────────────────────────────────
function CreatePanel({ portal, onClose }) {
  if (portal === "contractor") {
    return (
      <div className="crp">
        <h3>New Conversation</h3>
        <div className="f-row"><label className="f-lbl">Subject</label><input className="f-input" placeholder="e.g., Elevator shaft coordination" /></div>
        <div className="f-row">
          <label className="f-lbl">Type</label>
          <select className="f-sel"><option>General Discussion</option><option>Linked to RFI</option><option>Linked to Change Order</option><option>Linked to Approval</option></select>
        </div>
        <div className="f-row">
          <label className="f-lbl">Participants</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            <span className="pt sel">Dan Carter (You)</span>
            <span className="pt">Alex Morgan — Meridian MEP</span>
            <span className="pt">Lisa Chen — Sterling Interiors</span>
            <span className="pt">James Whitfield — Riverside Dev Co</span>
            <span className="pt">Priya Kapoor — Riverside Dev Co</span>
            <span className="pt">Tom Nguyen — Summit Structural</span>
          </div>
        </div>
        <div className="f-row"><label className="f-lbl">First Message</label><textarea className="f-ta" placeholder="Start the conversation\u2026" /></div>
        <div className="f-acts"><button className="btn cancel" onClick={onClose}>Cancel</button><button className="btn primary">{I.send} Send</button></div>
      </div>
    );
  }
  if (portal === "sub") {
    return (
      <div className="crp">
        <h3>New Message</h3>
        <div className="f-row"><label className="f-lbl">Subject</label><input className="f-input" placeholder="e.g., Material delivery update" /></div>
        <div className="f-row">
          <label className="f-lbl">To</label>
          <div style={{ display: "flex", flexWrap: "wrap" }}><span className="pt">Dan Carter — Prime Contractor</span><span className="pt">Sarah Kim — Prime Contractor</span></div>
        </div>
        <div className="f-row"><label className="f-lbl">Message</label><textarea className="f-ta" placeholder="Write your message\u2026" /></div>
        <div className="f-acts"><button className="btn cancel" onClick={onClose}>Cancel</button><button className="btn primary">{I.send} Send</button></div>
      </div>
    );
  }
  if (portal === "comm") {
    return (
      <div className="crp">
        <h3>Message Your Project Team</h3>
        <div className="f-row"><label className="f-lbl">Subject</label><input className="f-input" placeholder="What would you like to discuss?" /></div>
        <div className="f-row"><label className="f-lbl">Message</label><textarea className="f-ta" placeholder="Your message to the project team\u2026" /></div>
        <div className="f-acts"><button className="btn cancel" onClick={onClose}>Cancel</button><button className="btn primary">{I.send} Send Message</button></div>
      </div>
    );
  }
  // resi
  return (
    <div className="crp">
      <h3>Send a Message</h3>
      <div className="f-row"><label className="f-lbl">Subject</label><input className="f-input" placeholder="e.g., Question about kitchen tile" /></div>
      <div className="f-row"><label className="f-lbl">Your Message</label><textarea className="f-ta" placeholder="What's on your mind?" /></div>
      <div className="f-acts"><button className="btn cancel" onClick={onClose}>Cancel</button><button className="btn primary">{I.send} Send</button></div>
    </div>
  );
}
