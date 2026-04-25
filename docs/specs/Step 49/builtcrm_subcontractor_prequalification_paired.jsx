import { useState, useMemo } from "react";

// ── Icons ───────────────────────────────────────────────────────
const I = {
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m1 0v1a2 2 0 004 0v-1m-4 0h4"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  chk: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
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

// ── Nav data (cross-project — prequal is NOT project-scoped) ────
const navData = {
  contractor: [
    { section: "Workspace", items: [{ label: "Dashboard" }, { label: "Project Directory", badge: 12, bt: "blue" }, { label: "Inbox", badge: 8, bt: "blue" }] },
    { section: "Cross-project", items: [
      { label: "Approvals", badge: 5, bt: "blue" },
      { label: "Compliance", badge: 4, bt: "danger" },
      { label: "Prequalification", active: true, badge: 3, bt: "warn" },
      { label: "Payment tracking" },
      { label: "Reports" },
    ]},
    { section: "Projects", items: [
      { label: "Riverside Tower Fit-Out", state: "Current" },
      { label: "West End Medical" },
      { label: "Lot 7 Redevelopment" },
    ]},
    { section: "Account", items: [{ label: "Settings" }, { label: "Team" }] },
  ],
  sub: [
    { section: "Workspace", items: [{ label: "Today Board" }, { label: "Inbox", badge: 5, bt: "blue" }] },
    { section: "Cross-project", items: [
      { label: "Daily logs" },
      { label: "RFIs / Issues", badge: 1, bt: "blue" },
      { label: "Compliance", badge: 2, bt: "danger" },
      { label: "Prequalification", active: true, badge: 2, bt: "warn" },
      { label: "Documents" },
      { label: "Schedule" },
      { label: "Messages" },
    ]},
    { section: "Projects", items: [{ label: "Riverside Tower Fit-Out", state: "Active" }] },
    { section: "Account", items: [{ label: "Settings" }, { label: "Team" }] },
  ],
};

const portalMeta = {
  contractor: { label: "Contractor Portal", page: "Prequalification", user: "DC" },
  sub: { label: "Subcontractor Portal", page: "Prequalification", user: "AM" },
};

// ── Contractor-side records + details (from mockup) ─────────────
const gcRecords = [
  { id: "rivermark", org: "Rivermark Concrete", title: "Concrete · Riverside Tower", desc: "Submitted 1 hr ago. Score 81/100. No gating fails. Bond + insurance + 2 references uploaded.", tags: ["Concrete template", "New submission", "Bond present"], status: "Needs review", pill: "orange", tab: "review", score: 81, time: "1 hr ago" },
  { id: "northline", org: "Northline Electrical", title: "Electrical · General template", desc: "Submitted today. Score 78/100. Pass threshold 60 — clears. All 5 doc types uploaded; insurance limit verified.", tags: ["Electrical template", "All docs", "Threshold met"], status: "Needs review", pill: "orange", tab: "review", score: 78, time: "4 hrs ago" },
  { id: "pioneer", org: "Pioneer Drywall", title: "Drywall · General template", desc: "Submitted yesterday. Score 72/100. Insurance below project minimum — needs correction or reviewer override.", tags: ["Drywall", "Insurance flag", "Score 72"], status: "Needs review", pill: "orange", tab: "review", score: 72, time: "1 day ago" },
  { id: "kestrel", org: "Kestrel Glazing", title: "Glazing · General template", desc: "Under review since Mon. Reviewer assigned: Daniel C. Score 76.", tags: ["Under review", "Glazing"], status: "Under review", pill: "blue", tab: "under_review", score: 76, time: "3 days ago" },
  { id: "apex", org: "Apex Mechanical", title: "HVAC · Mechanical template", desc: "Approved Mar 17, 2025. Expires May 2 — 8 days remaining. Auto-reminder sent at 14-day mark.", tags: ["Approved", "Expires soon", "HVAC"], status: "Expires May 2", pill: "orange", tab: "expiring", score: 92, time: "1 yr ago", hot: true },
  { id: "meridian", org: "Meridian Roofing", title: "Roofing · General template", desc: "Approved Sep 12, 2025. Expires Sep 12, 2026 — 142 days remaining.", tags: ["Approved", "Roofing"], status: "Approved", pill: "green", tab: "approved", score: 88, time: "7 mo ago" },
  { id: "capital", org: "Capital Plumbing", title: "Plumbing · Plumbing template", desc: "Rejected Apr 21. Gating question failed — bankruptcy filed within 5 years. Sub may resubmit after disclosure.", tags: ["Rejected", "Gating fail", "Bankruptcy"], status: "Rejected", pill: "red", tab: "rejected", score: 45, time: "4 days ago" },
];

const gcDetails = {
  rivermark: {
    title: "Rivermark Concrete · Concrete prequalification",
    org: "Submission · sub_org_id: 4d12…ae89 · Template: Concrete (default for trade)",
    desc: "Submitted 1 hour ago. Score 81/100 — passes threshold 65. No gating fails. Bond, insurance, and two references provided. Safety manual on file but financial statement not yet uploaded — sub flagged it as in-progress.",
    pills: [{ t: "Needs review", c: "orange" }, { t: "Score 81", c: "accent" }, { t: "4/5 docs", c: "orange" }],
    grid: [
      { k: "Sub org", v: "Rivermark Concrete", m: "30-person crew · CA #C-8 license" },
      { k: "Trade", v: "Concrete / Foundations", m: "Mid-rise commercial" },
      { k: "Submitted", v: "1 hr ago", m: "Maya Patel · Estimator" },
      { k: "Score", v: "81 / 100", m: "Threshold 65 · Passes" },
    ],
    score: null,
    docs: [
      { type: "BOND", title: "Performance bond — $5M capacity.pdf", meta: "Uploaded 1 hr ago · 156 KB" },
      { type: "INSURANCE", title: "COI — General liability $5M.pdf", meta: "Uploaded 1 hr ago · 92 KB" },
      { type: "SAFETY", title: "Safety program 2026.pdf", meta: "Uploaded 1 hr ago · 940 KB" },
      { type: "REFERENCES", title: "References — 2 attached letters.pdf", meta: "Uploaded 1 hr ago · 134 KB" },
    ],
    docsNote: "Financials missing. Sub may submit later; you can request before deciding.",
    showDecide: true, showOverride: false,
  },
  northline: {
    title: "Northline Electrical · Electrical prequalification",
    org: "Submission · sub_org_id: 8c41…d7e2 · Template: Electrical (default for trade)",
    desc: "Submitted today by Alex Morales (Owner). Score 78 of 100 — passes threshold of 60. No gating questions failed. All five required document types uploaded. Insurance certificate verified at $2M general liability, meeting your project floor. Recommended: approve.",
    pills: [{ t: "Needs review", c: "orange" }, { t: "Score 78", c: "accent" }, { t: "No gating fails", c: "green" }, { t: "5/5 docs", c: "green" }],
    grid: [
      { k: "Sub org", v: "Northline Electrical", m: "12-person crew · CA license #C10-887441" },
      { k: "Trade", v: "Electrical", m: "Light-commercial focus" },
      { k: "Submitted", v: "4 hrs ago", m: "Alex Morales · Owner" },
      { k: "Score", v: "78 / 100", m: "Threshold 60 · Passes" },
    ],
    score: {
      threshold: 60, total: 78,
      rows: [
        { q: "Years in business", sub: "Score band: 6+ years", a: "12 years", w: "10", pts: "10" },
        { q: "Crew size", sub: "Score band: 10–25", a: "12 people", w: "8", pts: "6" },
        { q: "Trade certifications", sub: "C-10 + C-45 selected", a: "C-10, C-45", w: "10 max", pts: "10" },
        { q: "EMR (workers comp)", sub: "Threshold ≤ 1.0", a: "0.78", w: "15", pts: "15" },
        { q: "Insurance limit ($M)", sub: "Score band: 2.0–4.9M", a: "$2.0M", w: "15", pts: "10" },
        { q: "Bonding capacity", sub: "Single-project max", a: "$2.5M", w: "12", pts: "12" },
        { q: "Safety program", sub: "Comprehensive selected", a: "Comprehensive", w: "15", pts: "15" },
        { q: "Bankruptcy in last 5 yrs", sub: "Gating · No is required", a: "No", w: "gating", pts: "pass", gating: true },
        { q: "Active litigation", sub: "Gating · No is required", a: "No", w: "gating", pts: "pass", gating: true },
      ],
    },
    docs: [
      { type: "BOND", title: "Performance bond template — $2.5M capacity.pdf", meta: "Uploaded by Alex Morales · 4 hrs ago · 142 KB" },
      { type: "INSURANCE", title: "COI — General liability $2M.pdf", meta: "Uploaded by Alex Morales · 4 hrs ago · 89 KB" },
      { type: "SAFETY", title: "Safety program manual rev. 2025-Q4.pdf", meta: "Uploaded by Alex Morales · 4 hrs ago · 1.4 MB" },
      { type: "REFERENCES", title: "Reference — Greer & Sons GC (3 projects).pdf", meta: "Uploaded by Alex Morales · 4 hrs ago · 56 KB" },
      { type: "FINANCIALS", title: "Financial statement Q3 2025.pdf", meta: "Uploaded by Alex Morales · 4 hrs ago · 78 KB" },
    ],
    showDecide: true, showOverride: false,
  },
  pioneer: {
    title: "Pioneer Drywall · Drywall prequalification",
    org: "Submission · sub_org_id: 9a02…f441 · Template: General (no trade-specific template for Drywall)",
    desc: "Submitted yesterday. Score 72/100 — passes threshold 60. Insurance certificate at $1M is below your $2M project floor. Either request correction or override and approve with note.",
    pills: [{ t: "Needs review", c: "orange" }, { t: "Score 72", c: "accent" }, { t: "Insurance flag", c: "red" }],
    grid: [
      { k: "Sub org", v: "Pioneer Drywall", m: "8-person crew · License #DRY-2244" },
      { k: "Trade", v: "Drywall", m: "Commercial finish" },
      { k: "Submitted", v: "1 day ago", m: "Sam Reyes · Owner" },
      { k: "Score", v: "72 / 100", m: "Threshold 60 · Passes" },
    ],
    score: null,
    docs: [],
    showDecide: true, showOverride: true,
    overrideText: "Insurance limit ($1M) is below your project minimum ($2M). Approving overrides this gap; you can also reject or request a corrected COI.",
  },
  kestrel: {
    title: "Kestrel Glazing · Glazing prequalification",
    org: "Submission · sub_org_id: 2b77…1c04 · Template: General",
    desc: "Under review. Reviewer Daniel C. opened this Monday and left interim notes. Score 76/100; thresholds clear but glazing-specific certification question needs verification before approve.",
    pills: [{ t: "Under review", c: "blue" }, { t: "Score 76", c: "accent" }, { t: "Reviewer assigned", c: "accent" }],
    grid: [
      { k: "Sub org", v: "Kestrel Glazing", m: "Mid-rise curtain wall" },
      { k: "Trade", v: "Glazing", m: "Curtain wall / storefront" },
      { k: "Submitted", v: "3 days ago", m: "Priya Rao · GM" },
      { k: "Score", v: "76 / 100", m: "Threshold 60 · Passes" },
    ],
    score: null,
    docs: [],
    showDecide: true, showOverride: false,
  },
  apex: {
    title: "Apex Mechanical · HVAC prequalification",
    org: "Submission · sub_org_id: 1e90…b772 · Template: Mechanical",
    desc: "Approved Mar 17, 2025. Expires May 2 — 8 days remaining. Sub has been notified at 30 and 14 day marks. Renewal not yet started.",
    pills: [{ t: "Approved", c: "green" }, { t: "Expires May 2", c: "orange" }, { t: "Score 92", c: "accent" }],
    grid: [
      { k: "Sub org", v: "Apex Mechanical", m: "45-person crew · 2 active projects" },
      { k: "Trade", v: "HVAC / Mechanical", m: "Commercial refits" },
      { k: "Approved", v: "Mar 17, 2025", m: "By Daniel Chen" },
      { k: "Expires", v: "May 2, 2026", m: "8 days · 30/14 reminders sent" },
    ],
    score: null, docs: [],
    showDecide: false, showOverride: false,
    expiringNote: "Approved status remains active until May 2. After that, status flips to expired and Apex can be blocked from new project assignments per your enforcement mode.",
  },
  meridian: {
    title: "Meridian Roofing · Roofing prequalification",
    org: "Submission · sub_org_id: 6f23…a190 · Template: General",
    desc: "Approved Sep 12, 2025. Expires Sep 12, 2026 — 142 days remaining. No reviewer actions required.",
    pills: [{ t: "Approved", c: "green" }, { t: "Score 88", c: "accent" }],
    grid: [
      { k: "Sub org", v: "Meridian Roofing", m: "18-person crew" },
      { k: "Trade", v: "Roofing", m: "Low-slope commercial" },
      { k: "Approved", v: "Sep 12, 2025", m: "By Daniel Chen" },
      { k: "Expires", v: "Sep 12, 2026", m: "142 days remaining" },
    ],
    score: null, docs: [],
    showDecide: false, showOverride: false,
  },
  capital: {
    title: "Capital Plumbing · Plumbing prequalification",
    org: "Submission · sub_org_id: 3a88…e712 · Template: Plumbing",
    desc: "Rejected Apr 21 — gating question failed. Applicant disclosed bankruptcy within the last 5 years. Reviewer note shared with sub; resubmission permitted once disclosure is updated with creditor status.",
    pills: [{ t: "Rejected", c: "red" }, { t: "Gating fail", c: "red" }],
    grid: [
      { k: "Sub org", v: "Capital Plumbing", m: "6-person crew" },
      { k: "Trade", v: "Plumbing", m: "Commercial service" },
      { k: "Rejected", v: "Apr 21, 2026", m: "By Daniel Chen" },
      { k: "Reason", v: "Gating fail", m: "Bankruptcy in last 5 yrs" },
    ],
    score: null, docs: [],
    showDecide: false, showOverride: false,
    rejectedNote: "Sub has been notified with reviewer note. New submission can be created once sub confirms creditor discharge and attaches court filing.",
  },
};

// ── Subcontractor-side records + details (from mockup) ──────────
const subReqs = [
  { id: "bedrock", org: "Bedrock Builders", title: "General prequalification", desc: "Invitation received yesterday. No questions answered yet. Estimated 12–15 minutes; bring insurance and bonding info.", tags: ["General template", "22 questions", "5 doc types"], status: "Not started", pill: "red", tab: "open", time: "Yesterday" },
  { id: "foothills", org: "Foothills GC", title: "Electrical prequalification", desc: "In progress. 14 of 22 questions answered. 2 documents uploaded. Resume to finish.", tags: ["Electrical", "64% complete", "2/5 docs"], status: "In progress", pill: "orange", tab: "open", time: "2 days ago" },
  { id: "summit", org: "Summit Contracting", title: "Electrical prequalification", desc: "Submitted 2 hrs ago. Awaiting GC review. Score not visible to you.", tags: ["Submitted", "Awaiting GC"], status: "Submitted", pill: "accent", tab: "submitted", time: "2 hrs ago" },
  { id: "meridian-c", org: "Meridian Construction", title: "Electrical prequalification", desc: "Approved Mar 15, 2026. Expires Mar 15, 2027 — 326 days remaining.", tags: ["Approved", "Expires Mar 15, 2027"], status: "Approved", pill: "green", tab: "decided", time: "40 days ago" },
  { id: "greer", org: "Greer & Sons GC", title: "Electrical prequalification", desc: "Approved Aug 4, 2025. Expires Aug 4, 2026 — 102 days remaining.", tags: ["Approved"], status: "Approved", pill: "green", tab: "decided", time: "8 mo ago" },
  { id: "westwind", org: "Westwind Builders", title: "Electrical prequalification", desc: "Rejected Mar 1, 2026. Reviewer note: insurance limit below project floor. Resubmit with $2M COI.", tags: ["Rejected", "Resubmit"], status: "Rejected", pill: "red", tab: "decided", time: "54 days ago" },
];

const subDetails = {
  bedrock: {
    title: "Bedrock Builders · General prequalification",
    org: "Invitation · template: General (no trade-specific Electrical template) · Validity 12 months once approved",
    desc: "Bedrock invited you to prequalify yesterday. Complete this once and stay eligible for any of their projects for 12 months. You can save and return; submission only happens when you click Submit at the bottom.",
    pills: [{ t: "Not started", c: "red" }, { t: "12 mo validity", c: "accent" }, { t: "5 doc types", c: "orange" }],
    grid: [
      { k: "Contractor", v: "Bedrock Builders", m: "4 active projects in Bay Area" },
      { k: "Template", v: "General", m: "22 questions · 5 doc types" },
      { k: "Sent", v: "Yesterday", m: "By Linda Park · PM" },
      { k: "Validity", v: "12 months", m: "Once approved" },
    ],
    progress: { answered: 0, total: 22, docsUploaded: 0, docsRequired: 5 },
    showForm: true, formMode: "fresh",
  },
  foothills: {
    title: "Foothills GC · Electrical prequalification",
    org: "Invitation · template: Electrical (trade-specific) · Validity 12 months once approved",
    desc: "You started this 2 days ago. 14 of 22 questions are answered, 2 of 5 documents uploaded. Pick up where you left off — your draft is saved automatically.",
    pills: [{ t: "In progress", c: "orange" }, { t: "64% complete", c: "accent" }, { t: "2/5 docs", c: "orange" }],
    grid: [
      { k: "Contractor", v: "Foothills GC", m: "7-person GC · East Bay" },
      { k: "Template", v: "Electrical", m: "22 questions · 5 doc types" },
      { k: "Started", v: "2 days ago", m: "By you · Auto-saved" },
      { k: "Progress", v: "64%", m: "14 of 22 answered" },
    ],
    progress: { answered: 14, total: 22, docsUploaded: 2, docsRequired: 5 },
    showForm: true, formMode: "inprogress",
  },
  summit: {
    title: "Summit Contracting · Electrical prequalification",
    org: "Submission · submitted 2 hrs ago · awaiting Summit review",
    desc: "Your submission is in Summit's review queue. They typically review within 3 business days. You'll get a notification when they decide. You cannot edit a submitted form — if Summit requests corrections, you'll be able to resubmit.",
    pills: [{ t: "Submitted", c: "accent" }, { t: "Awaiting GC", c: "blue" }],
    grid: [
      { k: "Contractor", v: "Summit Contracting", m: "Mid-size commercial GC" },
      { k: "Submitted", v: "2 hrs ago", m: "21 of 22 questions answered" },
      { k: "Documents", v: "5 of 5", m: "All required docs uploaded" },
      { k: "Decision", v: "Pending", m: "Typical: 3 business days" },
    ],
    showForm: false,
    submittedNote: "Submitted form is read-only until a decision is made. You'll see the decision and any reviewer notes here when Summit responds.",
  },
  "meridian-c": {
    title: "Meridian Construction · Electrical prequalification",
    org: "Approved Mar 15, 2026 · Expires Mar 15, 2027",
    desc: "You're approved with Meridian for the next 326 days. They can assign you to any of their projects without further prequalification. We'll remind you 30, 14, and 7 days before expiry.",
    pills: [{ t: "Approved", c: "green" }, { t: "326 days remaining", c: "accent" }],
    grid: [
      { k: "Contractor", v: "Meridian Construction", m: "Education sector specialist" },
      { k: "Approved on", v: "Mar 15, 2026", m: "40 days ago" },
      { k: "Expires", v: "Mar 15, 2027", m: "326 days remaining" },
      { k: "Reviewer note", v: "\u201CClean record. Strong references.\u201D", m: "Visible to you" },
    ],
    showForm: false,
    approvedNote: "No action needed. We'll send reminders before expiry. To refresh ahead of time, request renewal from Meridian directly.",
  },
  greer: {
    title: "Greer & Sons GC · Electrical prequalification",
    org: "Approved Aug 4, 2025 · Expires Aug 4, 2026",
    desc: "Approved for the next 102 days. Reminder will arrive 30 days before expiry. No reviewer notes.",
    pills: [{ t: "Approved", c: "green" }, { t: "102 days remaining", c: "accent" }],
    grid: [
      { k: "Contractor", v: "Greer & Sons GC", m: "Bay Area GC" },
      { k: "Approved on", v: "Aug 4, 2025", m: "8 months ago" },
      { k: "Expires", v: "Aug 4, 2026", m: "102 days remaining" },
      { k: "Reviewer note", v: "None", m: "No note shared" },
    ],
    showForm: false,
    approvedNote: "You're in good standing with Greer. No action required until the 30-day reminder.",
  },
  westwind: {
    title: "Westwind Builders · Electrical prequalification",
    org: "Rejected Mar 1, 2026",
    desc: "Your submission was rejected with a reviewer note. You can address the issue and resubmit — a new submission will be created; this one stays in your history.",
    pills: [{ t: "Rejected", c: "red" }, { t: "Can resubmit", c: "accent" }],
    grid: [
      { k: "Contractor", v: "Westwind Builders", m: "Residential + light commercial" },
      { k: "Rejected on", v: "Mar 1, 2026", m: "54 days ago" },
      { k: "Reason", v: "Insurance limit", m: "Below $2M project floor" },
      { k: "Reviewer note", v: "\u201CResubmit with $2M COI.\u201D", m: "Shared with you" },
    ],
    showForm: false,
    rejectedNote: "The reviewer asked for a $2M general liability certificate. Update your insurance, upload the new COI, and start a fresh submission from the action below.",
  },
};

// ── Component ───────────────────────────────────────────────────
export default function SubcontractorPrequalificationPaired() {
  // Shell state
  const [dark, setDark] = useState(false);
  const [portal, setPortal] = useState("contractor");

  // Contractor queue state
  const [gcTab, setGcTab] = useState("review");
  const [gcSelected, setGcSelected] = useState("rivermark");

  // Subcontractor queue state
  const [subTab, setSubTab] = useState("open");
  const [subSelected, setSubSelected] = useState("bedrock");

  // Decision state (contractor reviews) — keyed by submissionId
  // { [id]: { status: "approved"|"rejected"|"under_review", overrideUsed?: bool, expiresAt?: string } }
  const [decisions, setDecisions] = useState({});
  const [notes, setNotes] = useState({});
  const [overrideConfirmed, setOverrideConfirmed] = useState({});

  // Sub form state (answers + uploads) — keyed by contractor id
  // answers: { [contractorId]: { years: string, crew: string, certs: Set<string>, emr: string, safety: string, bankruptcy: "yes"|"no", litigation: "yes"|"no" } }
  // uploads: { [contractorId]: { bond: bool, insurance: bool, safety: bool, references: bool, financials: bool } }
  const [subAnswers, setSubAnswers] = useState({
    foothills: { years: "12", crew: "12", certs: new Set(["c10", "c45"]), emr: "0.78", safety: "comprehensive", bankruptcy: "no", litigation: "no" },
    bedrock: { years: "", crew: "", certs: new Set(), emr: "", safety: "", bankruptcy: "", litigation: "" },
  });
  const [subUploads, setSubUploads] = useState({
    foothills: { bond: true, insurance: true, safety: false, references: false, financials: false },
    bedrock: { bond: false, insurance: false, safety: false, references: false, financials: false },
  });
  const [submittedIds, setSubmittedIds] = useState(new Set());

  const meta = portalMeta[portal];
  const nav = navData[portal];

  // ── Derived filters ───────────────────────────────────────────
  const filteredGc = useMemo(() => gcRecords.filter(r => r.tab === gcTab), [gcTab]);
  const filteredSub = useMemo(() => subReqs.filter(r => r.tab === subTab), [subTab]);

  const gcDetail = gcDetails[gcSelected];
  const subDetailBase = subDetails[subSelected];

  // Live-computed sub detail reflects in-progress answers/uploads
  const subDetail = useMemo(() => {
    if (!subDetailBase) return null;
    if (!subDetailBase.progress) return subDetailBase;
    const ans = subAnswers[subSelected] || {};
    const ups = subUploads[subSelected] || {};
    const answered = [ans.years, ans.crew, (ans.certs && ans.certs.size > 0) ? "x" : "", ans.emr, ans.safety, ans.bankruptcy, ans.litigation].filter(v => v && v !== "").length;
    // Template has 22 questions; we model 7 for the UI. Scale the rest proportionally but cap the live answered count.
    const liveAnswered = Math.min(subDetailBase.progress.total, answered + (subDetailBase.formMode === "inprogress" ? 7 : 0));
    const liveDocs = Object.values(ups).filter(Boolean).length;
    return { ...subDetailBase, progress: { ...subDetailBase.progress, answered: liveAnswered, docsUploaded: liveDocs } };
  }, [subDetailBase, subSelected, subAnswers, subUploads]);

  // ── Handlers ──────────────────────────────────────────────────
  const switchGcTab = (tab) => {
    setGcTab(tab);
    const first = gcRecords.find(r => r.tab === tab);
    if (first) setGcSelected(first.id);
  };
  const switchSubTab = (tab) => {
    setSubTab(tab);
    const first = subReqs.find(r => r.tab === tab);
    if (first) setSubSelected(first.id);
  };

  const handleApprove = (id, { override = false } = {}) => {
    const today = new Date();
    const exp = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    const fmt = exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setDecisions(prev => ({ ...prev, [id]: { status: "approved", overrideUsed: override, expiresAt: fmt } }));
  };
  const handleReject = (id) => {
    setDecisions(prev => ({ ...prev, [id]: { status: "rejected" } }));
  };
  const handleMoveUnderReview = (id) => {
    setDecisions(prev => ({ ...prev, [id]: { status: "under_review" } }));
  };

  const updateAnswer = (cid, key, val) => {
    setSubAnswers(prev => ({ ...prev, [cid]: { ...(prev[cid] || {}), [key]: val } }));
  };
  const toggleCert = (cid, certKey) => {
    setSubAnswers(prev => {
      const current = prev[cid] || { certs: new Set() };
      const next = new Set(current.certs || []);
      if (next.has(certKey)) next.delete(certKey);
      else next.add(certKey);
      return { ...prev, [cid]: { ...current, certs: next } };
    });
  };
  const toggleUpload = (cid, docKey) => {
    setSubUploads(prev => ({ ...prev, [cid]: { ...(prev[cid] || {}), [docKey]: !(prev[cid] || {})[docKey] } }));
  };
  const submitForm = (cid) => {
    setSubmittedIds(prev => new Set(prev).add(cid));
  };

  const decision = decisions[gcSelected];

  return (
    <div className={`cp ${dark ? "dk" : ""} ${portal}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');
.cp{
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
  --sbw:272px;--tbh:56px;--e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);display:grid;grid-template-columns:var(--sbw) 1fr;min-height:100vh;
}
.cp.sub{--ac:#3d6b8e;--ac-h:#345d7c;--ac-s:#e8f0f6;--ac-t:#2e5a78;--ac-m:#b3cede;--shri:0 0 0 3px rgba(61,107,142,.15)}
.cp.dk{
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
.cp.dk.sub{--ac:#5a9abe;--ac-h:#4d87a8;--ac-s:#14202c;--ac-t:#7cb8da;--ac-m:#2a4a60}
*,*::before,*::after{box-sizing:border-box;margin:0}
button{cursor:pointer;font-family:inherit;border:none;background:none}input,select,textarea{font-family:inherit}

/* Sidebar */
.side{background:var(--s1);border-right:1px solid var(--s3);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.brand{height:var(--tbh);display:flex;align-items:center;gap:12px;padding:0 20px;border-bottom:1px solid var(--s3);flex-shrink:0}
.brand h1{font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.02em}
.brand-ctx{font-size:11px;color:var(--t3);margin-top:1px}
.sb-srch{padding:12px 16px;border-bottom:1px solid var(--s3);flex-shrink:0}
.sb-srch input{width:100%;height:36px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-size:13px;color:var(--t1);outline:none}
.s-nav{flex:1;overflow-y:auto;padding:8px 10px 20px}
.s-nav::-webkit-scrollbar{width:4px}.s-nav::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.ns-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:10px 10px 6px}
.ni{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-m);font-size:13px;color:var(--t2);font-weight:520;transition:all var(--df);margin-bottom:2px;cursor:pointer}
.ni:hover{background:var(--sh);color:var(--t1)}.ni.on{background:var(--ac-s);color:var(--ac-t);font-weight:650}
.ni-b{min-width:20px;height:20px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd);flex-shrink:0}
.ni-b.blue{background:var(--ac-s);color:var(--ac-t)}.ni-b.warn{background:var(--wr-s);color:var(--wr-t)}.ni-b.danger{background:var(--dg-s);color:var(--dg-t)}
.ni-state{font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.cb{margin:8px 10px;padding:10px 12px;border-radius:var(--r-m);border:1px solid var(--ac-m);background:var(--ac-s);font-size:12px;color:var(--ac-t);font-weight:600}

/* Main */
.mn{display:flex;flex-direction:column;min-width:0}
.topb{height:var(--tbh);display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--s3);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);flex-shrink:0;position:sticky;top:0;z-index:50}
.cp.dk .topb{background:rgba(23,26,36,.88)}
.bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;font-weight:540;color:var(--t3)}.bc .sep{font-size:11px;color:var(--s4)}.bc .cur{color:var(--t1);font-weight:650}
.tb-acts{display:flex;align-items:center;gap:8px}
.ib{width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;transition:all var(--df)}.ib:hover{border-color:var(--s4);color:var(--t2)}
.av{width:32px;height:32px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:700}
.ct{padding:24px;flex:1}

/* Portal switch */
.psw{display:flex;gap:4px;margin-bottom:20px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
.psw button{height:36px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:7px;transition:all var(--dn) var(--e)}
.psw button:hover{color:var(--t1)}.psw button.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.p-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Shared */
.pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:560px;line-height:1.5}
.pg-h-acts{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

.ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e);text-align:left}
.sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
.sc.alert{border-color:#f5d5a0}.sc.danger{border-color:#f5baba}.sc.strong{border-color:var(--ac-m)}.sc.success{border-color:#b0dfc4}
.cp.dk .sc.alert{border-color:#5a4420}.cp.dk .sc.danger{border-color:#5a2020}.cp.dk .sc.success{border-color:#1e4a3c}
.sc-label{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);transition:all var(--df) var(--e);white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.pri:disabled{opacity:.55;cursor:not-allowed}.btn.pri:disabled:hover{background:var(--ac)}
.btn:disabled{cursor:not-allowed;opacity:.55}
.btn.sm{height:32px;padding:0 12px;font-size:12px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2)}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.btn.dg-f{background:var(--dg);border-color:var(--dg);color:white}.btn.dg-f:hover{background:var(--dg-t)}
.btn.ok-f{background:var(--ok);border-color:var(--ok);color:white}.btn.ok-f:hover{background:var(--ok-t)}
.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.mtag{height:20px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid var(--s3);background:var(--s2);color:var(--t3);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0;font-family:var(--fd)}

/* Workspace + queue */
.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:700}.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;transition:all var(--df);gap:6px;font-family:var(--fd)}
.wtab:hover{border-color:var(--s4);color:var(--t1)}.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.wtab-c{height:18px;min-width:18px;padding:0 5px;border-radius:999px;background:var(--s2);font-size:10px;color:var(--t3);display:inline-flex;align-items:center;justify-content:center;font-weight:700}
.wtab.on .wtab-c{background:var(--s1);color:var(--ac-t)}
.md{display:grid;grid-template-columns:380px minmax(0,1fr);padding:16px 20px 20px;gap:16px;align-items:start}
.q-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
.q-filt{height:30px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-size:12px;color:var(--t2);outline:none;font-family:var(--fb)}

/* Record cards */
.tl{display:flex;flex-direction:column;gap:6px;max-height:720px;overflow-y:auto}
.tl::-webkit-scrollbar{width:4px}.tl::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.rcd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);text-align:left;width:100%}
.rcd:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.rcd.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.rcd.hot{border-color:#f5baba}.rcd.hot.on{border-color:var(--dg-t);box-shadow:0 0 0 3px rgba(201,59,59,.12)}
.cp.dk .rcd.hot{border-color:#5a2020}
.rcd-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.rcd-org{font-family:var(--fm);font-size:11px;color:var(--t3);font-weight:500}
.rcd-title{font-family:var(--fd);font-size:13px;font-weight:700;margin-top:2px}
.rcd-desc{font-size:12px;color:var(--t2);margin-top:2px;line-height:1.4}
.rcd-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.rcd-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--t3)}
.rcd-score{display:inline-flex;align-items:center;gap:4px;font-family:var(--fm);font-weight:700;color:var(--ac-t)}

/* Detail */
.dp{min-height:400px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.dh-org{font-family:var(--fm);font-size:12px;color:var(--t3);margin-top:2px}
.dh-desc{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;max-width:520px}
.dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px;align-items:flex-start}
.dg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.dg-i{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.dg-i .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px}.dg-i .m{font-size:12px;color:var(--t2);margin-top:2px}

/* Detail sections */
.ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
.ds.gate{border-color:#f5baba}.cp.dk .ds.gate{border-color:#5a2020}
.ds.dec{border-color:var(--ac-m)}
.ds-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
.ds-h h4{font-family:var(--fd);font-size:13px;font-weight:700}
.ds-h .ds-acts{display:flex;gap:6px;align-items:center}
.ds.gate .ds-h{background:linear-gradient(180deg,#fef5f5,#fdeaea);border-bottom-color:#f5baba}.cp.dk .ds.gate .ds-h{background:var(--dg-s)}
.ds.gate .ds-h h4{color:var(--dg-t)}
.ds.dec .ds-h{background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--ac-s) 40%,var(--s1)));border-bottom-color:var(--ac-m)}
.ds-b{padding:14px 16px}
.ds-b>p{font-size:13px;color:var(--t2);line-height:1.55}

/* Score table */
.sr{display:grid;grid-template-columns:1fr auto auto auto;gap:14px;padding:10px 0;border-bottom:1px solid var(--s2);align-items:center;font-size:13px}
.sr:last-child{border-bottom:none}
.sr-q{font-weight:600}.sr-q span{display:block;font-weight:400;font-size:12px;color:var(--t3);margin-top:2px}
.sr-a{font-family:var(--fm);font-size:12px;color:var(--t2);background:var(--s2);padding:3px 8px;border-radius:6px;white-space:nowrap}
.sr-w{font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.sr-pts{font-family:var(--fm);font-weight:700;color:var(--ac-t);min-width:48px;text-align:right}
.sr.gating .sr-q{color:var(--dg-t)}.sr.gating .sr-pts{color:var(--dg-t)}
.st{display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;margin-top:10px;border-top:2px solid var(--s3)}
.st-label{font-family:var(--fd);font-size:13px;font-weight:700}
.st-value{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.02em;text-align:right}
.st-thr{font-size:11px;color:var(--t3);margin-top:2px;text-align:right}

/* Documents */
.dr{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);margin-bottom:6px;gap:12px}
.dr:last-child{margin-bottom:0}
.dr h5{font-family:var(--fd);font-size:13px;font-weight:650;display:flex;align-items:center;gap:8px;min-width:0}
.dr h5 span.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dr p{font-size:11px;color:var(--t3);margin-top:2px;font-family:var(--fm)}
.dr .dr-acts{display:flex;gap:6px;flex-shrink:0}
.dt-tag{height:18px;padding:0 7px;border-radius:6px;background:var(--s2);color:var(--t2);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;display:inline-flex;align-items:center;flex-shrink:0;font-family:var(--fd)}

/* Gating / override card */
.gc{background:var(--s1);border:1px solid #f5baba;border-radius:var(--r-m);padding:12px 14px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:8px}
.cp.dk .gc{border-color:#5a2020;background:var(--s1)}
.gc:last-child{margin-bottom:0}
.gc h5{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--dg-t)}
.gc p{font-size:12px;color:var(--t2);margin-top:2px;line-height:1.4}
.gc-a{font-family:var(--fm);font-size:11px;color:var(--dg-t);background:var(--dg-s);padding:3px 8px;border-radius:6px;font-weight:700;flex-shrink:0;white-space:nowrap}

/* Decision */
.ntx{width:100%;min-height:88px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;font-size:13px;color:var(--t1);outline:none;resize:vertical;background:var(--s1);line-height:1.5;font-family:var(--fb)}
.ntx:focus{border-color:var(--ac)}
.ntx-h{font-size:11px;color:var(--t3);margin-top:6px}
.dec-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px}
.dec-acts .spc{flex:1}
.ov-ban{margin-top:10px;padding:10px 12px;border-radius:var(--r-m);background:var(--wr-s);border:1px solid #f5d5a0;font-size:12px;color:var(--wr-t)}
.cp.dk .ov-ban{border-color:#5a4420}
.ov-ban strong{font-weight:700}
.dec-note{margin-top:10px;padding:10px 12px;border-radius:var(--r-m);background:var(--ok-s);border:1px solid #b0dfc4;font-size:12px;color:var(--ok-t)}
.cp.dk .dec-note{border-color:#1e4a3c}
.dec-note.reject{background:var(--dg-s);border-color:#f5baba;color:var(--dg-t)}
.cp.dk .dec-note.reject{border-color:#5a2020}

/* Form (sub side) */
.fs{margin-top:14px;border:1px solid var(--s3);border-radius:var(--r-l);background:var(--s1);overflow:hidden}
.fs-h{padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.fs-h h4{font-family:var(--fd);font-size:13px;font-weight:700}.fs-h .pg{font-size:11px;color:var(--t3);font-weight:600;font-family:var(--fd)}
.fs-b{padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.q{display:flex;flex-direction:column;gap:6px}
.q label{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.q label .req{color:var(--dg-t)}
.q label .gate-tag{font-size:10px;font-weight:700;color:var(--wr-t);background:var(--wr-s);padding:2px 6px;border-radius:6px;letter-spacing:.04em;text-transform:uppercase;border:1px solid #f5d5a0;font-family:var(--fd)}
.cp.dk .q label .gate-tag{border-color:#5a4420}
.q .help{font-size:11px;color:var(--t3);line-height:1.4}
.q input,.q select,.q textarea{width:100%;height:38px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:13px;color:var(--t1);outline:none;background:var(--s1);font-family:var(--fb)}
.q textarea{height:auto;min-height:72px;padding:8px 12px;resize:vertical;line-height:1.5}
.q input:focus,.q select:focus,.q textarea:focus{border-color:var(--ac)}
.q.fill input,.q.fill select{border-color:var(--ok);background:color-mix(in srgb,var(--ok-s) 50%,var(--s1))}
.cp.dk .q.fill input,.cp.dk .q.fill select{background:var(--ok-s)}

.rgrp{display:flex;gap:8px}
.ropt{flex:1;height:38px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:13px;font-weight:600;color:var(--t2);transition:all var(--df);font-family:var(--fb)}
.ropt:hover{border-color:var(--s4);color:var(--t1)}
.ropt.sel{background:var(--ac-s);border-color:var(--ac-m);color:var(--ac-t)}
.ropt.sel.no{background:var(--dg-s);border-color:#f5baba;color:var(--dg-t)}.cp.dk .ropt.sel.no{border-color:#5a2020}

.cgrp{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.copt{height:36px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-size:13px;font-weight:500;color:var(--t2);display:flex;align-items:center;gap:8px;padding:0 12px;transition:all var(--df);font-family:var(--fb);text-align:left;width:100%}
.copt:hover{border-color:var(--s4)}
.copt.chk{background:var(--ac-s);border-color:var(--ac-m);color:var(--ac-t);font-weight:600}
.copt .cbm{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--s4);display:grid;place-items:center;flex-shrink:0;color:white;background:var(--s1)}
.copt.chk .cbm{background:var(--ac);border-color:var(--ac)}

/* Upload zones */
.uz{border:2px dashed var(--s3);border-radius:var(--r-m);padding:18px;text-align:center;background:var(--s2);transition:all var(--df)}
.uz:hover{border-color:var(--ac-m);background:var(--ac-s)}
.uz h5{font-family:var(--fd);font-size:13px;font-weight:700}
.uz p{font-size:12px;color:var(--t3);margin-top:4px;line-height:1.4}
.uz-acts{display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap}
.uz.done{border-style:solid;border-color:#b0dfc4;background:color-mix(in srgb,var(--ok-s) 60%,var(--s1));text-align:left}
.cp.dk .uz.done{border-color:#1e4a3c;background:var(--ok-s)}
.uz-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}

/* Form footer */
.ff{margin-top:18px;padding:14px 16px;border-radius:var(--r-l);background:var(--s2);border:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ff-tx{font-size:12px;color:var(--t2)}.ff-tx strong{font-weight:700;color:var(--t1)}
.ff-acts{display:flex;gap:8px}

/* Responsive */
@media(max-width:1280px){.md{grid-template-columns:1fr}.dg{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){.cp{grid-template-columns:1fr}.side{display:none}.ss{grid-template-columns:repeat(2,1fr)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp var(--ds) var(--e)}
      `}</style>

      {/* Sidebar */}
      <aside className="side">
        <div className="brand"><Logo /><div><h1>BuiltCRM</h1><div className="brand-ctx">{meta.label}</div></div></div>
        <div className="sb-srch"><input placeholder="Search…" /></div>
        <nav className="s-nav">
          {portal === "sub" && <div className="cb">1 prequal not started · Bedrock Builders</div>}
          {nav.map(sec => (
            <div key={sec.section} style={{ marginBottom: 4 }}>
              <div className="ns-lbl">{sec.section}</div>
              {sec.items.map(it => (
                <div key={it.label} className={`ni${it.active ? " on" : ""}`}>
                  <span>{it.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {it.state && <span className="ni-state">{it.state}</span>}
                    {it.badge != null && <span className={`ni-b ${it.bt || ""}`}>{it.badge}</span>}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="mn">
        <div className="topb">
          <div className="bc">
            <span>{meta.label}</span><span className="sep">›</span>
            <span className="cur">{meta.page}</span>
          </div>
          <div className="tb-acts">
            <button className="ib" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? I.sun : I.moon}</button>
            <button className="ib" aria-label="Notifications">{I.bell}</button>
            <div className="av">{meta.user}</div>
          </div>
        </div>

        <div className="ct">
          <div className="psw">
            {[["contractor", "#5b4fc7", "Contractor view"], ["sub", "#3d6b8e", "Subcontractor view"]].map(([k, c, l]) => (
              <button key={k} className={portal === k ? "on" : ""} onClick={() => setPortal(k)}>
                <span className="p-dot" style={{ background: c }} />{l}
              </button>
            ))}
          </div>

          {/* ═══════ CONTRACTOR VIEW ═══════ */}
          {portal === "contractor" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Prequalification</h2>
                  <p>Review subcontractor submissions, score against your templates, and approve or reject before awarding work. Approved status flows to the compliance workspace and gates assignment.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn">Manage templates</button>
                  <button className="btn pri">Invite a sub</button>
                </div>
              </div>

              <div className="ss">
                <button className="sc strong" onClick={() => switchGcTab("review")}>
                  <div className="sc-label">Awaiting your review</div><div className="sc-value">3</div><div className="sc-meta">2 submitted today</div>
                </button>
                <button className="sc alert" onClick={() => switchGcTab("expiring")}>
                  <div className="sc-label">Expiring in 30 days</div><div className="sc-value">2</div><div className="sc-meta">1 expires within a week</div>
                </button>
                <button className="sc success" onClick={() => switchGcTab("approved")}>
                  <div className="sc-label">Approved subs</div><div className="sc-value">14</div><div className="sc-meta">Across 4 trades</div>
                </button>
                <button className="sc danger" onClick={() => switchGcTab("rejected")}>
                  <div className="sc-label">Block-mode overrides</div><div className="sc-value">1</div><div className="sc-meta">Granted exemption · Lot 7</div>
                </button>
              </div>

              <div className="ws">
                <div className="ws-head">
                  <div><h3>Prequalification submissions</h3><div className="sub">All trades · Cross-project review queue</div></div>
                </div>
                <div className="ws-tabs">
                  {[
                    ["review", "Needs review", gcRecords.filter(r => r.tab === "review").length],
                    ["under_review", "Under review", gcRecords.filter(r => r.tab === "under_review").length],
                    ["approved", "Approved", 14],
                    ["expiring", "Expiring soon", gcRecords.filter(r => r.tab === "expiring").length],
                    ["rejected", "Rejected", gcRecords.filter(r => r.tab === "rejected").length],
                  ].map(([k, l, n]) => (
                    <button key={k} className={`wtab${gcTab === k ? " on" : ""}`} onClick={() => switchGcTab(k)}>
                      {l}<span className="wtab-c">{n}</span>
                    </button>
                  ))}
                </div>
                <div className="md">
                  <div>
                    <div className="q-bar">
                      <select className="q-filt">
                        <option>All trades</option><option>Electrical</option><option>Concrete</option><option>Drywall</option><option>HVAC</option>
                      </select>
                      <button className="btn sm ghost">Sort: Newest</button>
                    </div>
                    <div className="tl">
                      {filteredGc.length === 0 && <p style={{ color: "var(--t3)", padding: 20 }}>No submissions in this view.</p>}
                      {filteredGc.map(r => {
                        const d = decisions[r.id];
                        const liveStatus = d?.status === "approved" ? "Approved" : d?.status === "rejected" ? "Rejected" : d?.status === "under_review" ? "Under review" : r.status;
                        const livePill = d?.status === "approved" ? "green" : d?.status === "rejected" ? "red" : d?.status === "under_review" ? "blue" : r.pill;
                        return (
                          <button key={r.id} className={`rcd${gcSelected === r.id ? " on" : ""}${r.hot ? " hot" : ""}`} onClick={() => setGcSelected(r.id)}>
                            <div className="rcd-top">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="rcd-org">{r.org}</div>
                                <div className="rcd-title">{r.title}</div>
                                <div className="rcd-desc">{r.desc}</div>
                              </div>
                              <span className={`pl ${livePill}`}>{liveStatus}</span>
                            </div>
                            <div className="rcd-tags">{r.tags.map((t, j) => <span key={j} className="mtag">{t}</span>)}</div>
                            <div className="rcd-foot">
                              <span className="rcd-score">Score · {r.score}</span>
                              <span>{r.time}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detail pane */}
                  {gcDetail && (
                    <div className="dp">
                      <div className="dh">
                        <div>
                          <h3>{gcDetail.title}</h3>
                          <div className="dh-org">{gcDetail.org}</div>
                          <div className="dh-desc">{gcDetail.desc}</div>
                        </div>
                        <div className="dh-pills">
                          {decision?.status === "approved" && <span className="pl green">Approved{decision.overrideUsed ? " · override" : ""}</span>}
                          {decision?.status === "rejected" && <span className="pl red">Rejected</span>}
                          {decision?.status === "under_review" && <span className="pl blue">Under review</span>}
                          {!decision && gcDetail.pills.map((p, i) => <span key={i} className={`pl ${p.c}`}>{p.t}</span>)}
                        </div>
                      </div>
                      <div className="dg">{gcDetail.grid.map((g, i) => (
                        <div key={i} className="dg-i"><div className="k">{g.k}</div><div className="v">{g.v}</div><div className="m">{g.m}</div></div>
                      ))}</div>

                      {/* Score breakdown */}
                      {gcDetail.score && (
                        <div className="ds">
                          <div className="ds-h"><h4>Score breakdown</h4><div className="ds-acts"><span className="mtag">Internal · sub doesn't see</span></div></div>
                          <div className="ds-b">
                            {gcDetail.score.rows.map((r, i) => (
                              <div key={i} className={`sr${r.gating ? " gating" : ""}`}>
                                <div className="sr-q">{r.q}<span>{r.sub}</span></div>
                                <div className="sr-a">{r.a}</div>
                                <div className="sr-w">{r.w}</div>
                                <div className="sr-pts">{r.pts}</div>
                              </div>
                            ))}
                            <div className="st">
                              <div className="st-label">Total score</div>
                              <div>
                                <div className="st-value">{gcDetail.score.total} / 100</div>
                                <div className="st-thr">Threshold {gcDetail.score.threshold} · Passes by {gcDetail.score.total - gcDetail.score.threshold}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {gcDetail.docs && gcDetail.docs.length > 0 && (
                        <div className="ds">
                          <div className="ds-h"><h4>Supporting documents</h4><div className="ds-acts"><span className={`pl ${gcDetail.docs.length === 5 ? "green" : "orange"}`}>{gcDetail.docs.length}/5 types</span></div></div>
                          <div className="ds-b">
                            {gcDetail.docs.map((doc, i) => (
                              <div key={i} className="dr">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <h5><span className="dt-tag">{doc.type}</span><span className="name">{doc.title}</span></h5>
                                  <p>{doc.meta}</p>
                                </div>
                                <div className="dr-acts"><button className="btn sm">View</button><button className="btn sm">Download</button></div>
                              </div>
                            ))}
                            {gcDetail.docsNote && <p style={{ marginTop: 10, fontSize: 12, color: "var(--wr-t)" }}><strong>Note:</strong> {gcDetail.docsNote}</p>}
                          </div>
                        </div>
                      )}

                      {/* Override / gating attention */}
                      {gcDetail.showOverride && (
                        <div className="ds gate">
                          <div className="ds-h"><h4>Reviewer attention</h4><div className="ds-acts"><span className="pl red">Threshold gap</span></div></div>
                          <div className="ds-b">
                            <div className="gc">
                              <div>
                                <h5>Insurance below project floor</h5>
                                <p>{gcDetail.overrideText}</p>
                              </div>
                              <span className="gc-a">$1.0M / $2.0M required</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rejected note */}
                      {gcDetail.rejectedNote && !decision && (
                        <div className="ds">
                          <div className="ds-h"><h4>Decision recorded</h4><div className="ds-acts"><span className="pl red">Rejected</span></div></div>
                          <div className="ds-b"><p>{gcDetail.rejectedNote}</p>
                            <div className="dec-acts"><button className="btn">View history</button><button className="btn ghost">Send reminder to resubmit</button></div>
                          </div>
                        </div>
                      )}

                      {/* Decision panel */}
                      {gcDetail.showDecide && (
                        <div className="ds dec">
                          <div className="ds-h"><h4>Decision</h4><div className="ds-acts"><span className="mtag">Approve · Reject · Override</span></div></div>
                          <div className="ds-b">
                            <p style={{ marginBottom: 10, color: "var(--t1)", fontWeight: 600 }}>Reviewer notes <span style={{ fontWeight: 400, color: "var(--t3)" }}>(visible to sub on decision)</span></p>
                            <textarea
                              className="ntx"
                              placeholder="Optional. Notes appear on the sub's decision notification."
                              value={notes[gcSelected] || ""}
                              onChange={(e) => setNotes(prev => ({ ...prev, [gcSelected]: e.target.value }))}
                              disabled={!!decision}
                            />
                            <p className="ntx-h">Approval sets expiry to today + 12 months (template default). Rejection requires a reason.</p>

                            {gcDetail.showOverride && !decision && !overrideConfirmed[gcSelected] && (
                              <div className="ov-ban"><strong>Override available.</strong> Approve anyway with explicit reason. Override is audit-logged and visible on the sub's profile.</div>
                            )}

                            {decision?.status === "approved" && (
                              <div className="dec-note">
                                <strong>✓ Approved.</strong> Expires {decision.expiresAt}.
                                {decision.overrideUsed && " Override applied — audit event written."}
                              </div>
                            )}
                            {decision?.status === "rejected" && (
                              <div className="dec-note reject"><strong>✗ Rejected.</strong> Sub has been notified with your note. They may resubmit a fresh application.</div>
                            )}
                            {decision?.status === "under_review" && (
                              <div className="ov-ban"><strong>Moved to under review.</strong> You remain the assigned reviewer.</div>
                            )}

                            <div className="dec-acts">
                              {!decision && (
                                <>
                                  <button
                                    className="btn pri"
                                    onClick={() => handleApprove(gcSelected, { override: false })}
                                    disabled={gcDetail.showOverride && !overrideConfirmed[gcSelected]}
                                  >
                                    Approve · 12-month validity
                                  </button>
                                  <button className="btn" onClick={() => setNotes(prev => ({ ...prev, [gcSelected]: (prev[gcSelected] || "") + (prev[gcSelected] ? "\n" : "") + "Requesting correction: " }))}>Request correction</button>
                                  <button className="btn dg-o" onClick={() => handleReject(gcSelected)} disabled={!notes[gcSelected]}>Reject with note</button>
                                  {gcDetail.showOverride && !overrideConfirmed[gcSelected] && (
                                    <button className="btn ok-f" onClick={() => { setOverrideConfirmed(prev => ({ ...prev, [gcSelected]: true })); handleApprove(gcSelected, { override: true }); }}>
                                      Override & approve
                                    </button>
                                  )}
                                  <span className="spc" />
                                  <button className="btn ghost" onClick={() => handleMoveUnderReview(gcSelected)}>Move to under review</button>
                                </>
                              )}
                              {decision && (
                                <button className="btn ghost" onClick={() => { setDecisions(prev => { const n = { ...prev }; delete n[gcSelected]; return n; }); setOverrideConfirmed(prev => { const n = { ...prev }; delete n[gcSelected]; return n; }); }}>
                                  Undo decision
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expiring note */}
                      {gcDetail.expiringNote && (
                        <div className="ds">
                          <div className="ds-h"><h4>Expiry status</h4><div className="ds-acts"><span className="pl orange">8 days</span></div></div>
                          <div className="ds-b"><p>{gcDetail.expiringNote}</p>
                            <div className="dec-acts">
                              <button className="btn pri">Invite to re-prequalify</button>
                              <button className="btn">Send reminder</button>
                              <button className="btn ghost">View history</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ SUBCONTRACTOR VIEW ═══════ */}
          {portal === "sub" && (
            <div className="fade-up">
              <div className="pg-h">
                <div>
                  <h2>Prequalification</h2>
                  <p>Complete prequalification forms from contractors who've invited you. Approval lets you be assigned to projects without delay; expiry tracks when you'll need to refresh.</p>
                </div>
                <div className="pg-h-acts">
                  <button className="btn">Help · What contractors look for</button>
                </div>
              </div>

              <div className="ss">
                <button className="sc danger" onClick={() => { switchSubTab("open"); setSubSelected("bedrock"); }}>
                  <div className="sc-label">To start</div><div className="sc-value">1</div><div className="sc-meta">Bedrock Builders · Sent yesterday</div>
                </button>
                <button className="sc alert" onClick={() => { switchSubTab("open"); setSubSelected("foothills"); }}>
                  <div className="sc-label">In progress</div><div className="sc-value">1</div><div className="sc-meta">Continue where you left off</div>
                </button>
                <button className="sc strong" onClick={() => switchSubTab("submitted")}>
                  <div className="sc-label">Submitted</div><div className="sc-value">{1 + submittedIds.size}</div><div className="sc-meta">Awaiting GC review</div>
                </button>
                <button className="sc success" onClick={() => switchSubTab("decided")}>
                  <div className="sc-label">Approved</div><div className="sc-value">2</div><div className="sc-meta">1 expires Mar 15, 2027</div>
                </button>
              </div>

              <div className="ws">
                <div className="ws-head">
                  <div><h3>Contractor prequalifications</h3><div className="sub">Northline Electrical · One submission per contractor</div></div>
                </div>
                <div className="ws-tabs">
                  {[
                    ["open", "Open", subReqs.filter(r => r.tab === "open").length],
                    ["submitted", "Submitted", subReqs.filter(r => r.tab === "submitted").length + submittedIds.size],
                    ["decided", "Decided", subReqs.filter(r => r.tab === "decided").length],
                  ].map(([k, l, n]) => (
                    <button key={k} className={`wtab${subTab === k ? " on" : ""}`} onClick={() => switchSubTab(k)}>
                      {l}<span className="wtab-c">{n}</span>
                    </button>
                  ))}
                </div>
                <div className="md">
                  <div>
                    <div className="q-bar">
                      <select className="q-filt"><option>All contractors</option><option>Active invitations</option></select>
                      <button className="btn sm ghost">Sort: Recent</button>
                    </div>
                    <div className="tl">
                      {filteredSub.length === 0 && <p style={{ color: "var(--t3)", padding: 20 }}>Nothing here. New invitations will appear when contractors send them.</p>}
                      {filteredSub.map(r => {
                        const isSubmittedNow = submittedIds.has(r.id);
                        const livePill = isSubmittedNow ? "accent" : r.pill;
                        const liveStatus = isSubmittedNow ? "Submitted" : r.status;
                        return (
                          <button key={r.id} className={`rcd${subSelected === r.id ? " on" : ""}`} onClick={() => setSubSelected(r.id)}>
                            <div className="rcd-top">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="rcd-org">{r.org}</div>
                                <div className="rcd-title">{r.title}</div>
                                <div className="rcd-desc">{r.desc}</div>
                              </div>
                              <span className={`pl ${livePill}`}>{liveStatus}</span>
                            </div>
                            <div className="rcd-tags">{r.tags.map((t, j) => <span key={j} className="mtag">{t}</span>)}</div>
                            <div className="rcd-foot">
                              <span>Validity: 12 mo once approved</span>
                              <span>{r.time}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub detail pane */}
                  {subDetail && (
                    <div className="dp">
                      <div className="dh">
                        <div>
                          <h3>{subDetail.title}</h3>
                          <div className="dh-org">{subDetail.org}</div>
                          <div className="dh-desc">{subDetail.desc}</div>
                        </div>
                        <div className="dh-pills">
                          {submittedIds.has(subSelected) ? (
                            <span className="pl accent">Submitted · Awaiting GC</span>
                          ) : (
                            subDetail.pills.map((p, i) => <span key={i} className={`pl ${p.c}`}>{p.t}</span>)
                          )}
                        </div>
                      </div>
                      <div className="dg">{subDetail.grid.map((g, i) => (
                        <div key={i} className="dg-i"><div className="k">{g.k}</div><div className="v">{g.v}</div><div className="m">{g.m}</div></div>
                      ))}</div>

                      {/* Form (only when showForm and not yet submitted in this session) */}
                      {subDetail.showForm && !submittedIds.has(subSelected) && (() => {
                        const cid = subSelected;
                        const ans = subAnswers[cid] || { certs: new Set() };
                        const ups = subUploads[cid] || {};
                        const certs = ans.certs instanceof Set ? ans.certs : new Set(ans.certs || []);
                        const companySectionAns = [ans.years, ans.crew, certs.size > 0 ? "x" : ""].filter(v => v && v !== "").length;
                        const riskSectionAns = [ans.emr, ans.safety, ans.bankruptcy, ans.litigation].filter(v => v && v !== "").length;
                        const docsUploaded = Object.values(ups).filter(Boolean).length;
                        const readyToSubmit = companySectionAns === 3 && riskSectionAns === 4 && docsUploaded >= 3;

                        return (
                          <>
                            <div className="fs">
                              <div className="fs-h"><h4>Company information</h4><div className="pg">{companySectionAns} of 3 answered</div></div>
                              <div className="fs-b">
                                <div className={`q${ans.years ? " fill" : ""}`}>
                                  <label>Years in business <span className="req">*</span></label>
                                  <p className="help">How long has your company been operating?</p>
                                  <input type="number" placeholder="e.g. 10" value={ans.years || ""} onChange={(e) => updateAnswer(cid, "years", e.target.value)} />
                                </div>
                                <div className={`q${ans.crew ? " fill" : ""}`}>
                                  <label>Crew size <span className="req">*</span></label>
                                  <input type="number" placeholder="Active employees" value={ans.crew || ""} onChange={(e) => updateAnswer(cid, "crew", e.target.value)} />
                                </div>
                                <div className={`q${certs.size > 0 ? " fill" : ""}`}>
                                  <label>Trade certifications held <span className="req">*</span></label>
                                  <p className="help">Select all that apply.</p>
                                  <div className="cgrp">
                                    {[
                                      ["c10", "C-10 Electrical"],
                                      ["c45", "C-45 Sign electrical"],
                                      ["c7", "C-7 Low voltage"],
                                      ["nicet", "NICET certified"],
                                    ].map(([k, l]) => (
                                      <button key={k} className={`copt${certs.has(k) ? " chk" : ""}`} onClick={() => toggleCert(cid, k)}>
                                        <span className="cbm">{certs.has(k) && I.chk}</span>{l}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="fs">
                              <div className="fs-h"><h4>Risk &amp; safety</h4><div className="pg">{riskSectionAns} of 4 answered</div></div>
                              <div className="fs-b">
                                <div className={`q${ans.emr ? " fill" : ""}`}>
                                  <label>EMR (workers compensation rate) <span className="req">*</span></label>
                                  <p className="help">Most recent annual EMR. Industry baseline 1.0; lower is better.</p>
                                  <input type="number" step="0.01" placeholder="e.g. 0.85" value={ans.emr || ""} onChange={(e) => updateAnswer(cid, "emr", e.target.value)} />
                                </div>
                                <div className={`q${ans.safety ? " fill" : ""}`}>
                                  <label>Safety program scope <span className="req">*</span></label>
                                  <select value={ans.safety || ""} onChange={(e) => updateAnswer(cid, "safety", e.target.value)}>
                                    <option value="">Choose one</option>
                                    <option value="comprehensive">Comprehensive — written program, regular training, dedicated officer</option>
                                    <option value="standard">Standard — written program, periodic training</option>
                                    <option value="minimal">Minimal — informal</option>
                                  </select>
                                </div>
                                <div className="q">
                                  <label>Has your company filed for bankruptcy in the last 5 years? <span className="req">*</span> <span className="gate-tag">Gating</span></label>
                                  <p className="help">A "Yes" answer triggers automatic rejection unless overridden by the contractor.</p>
                                  <div className="rgrp">
                                    <button className={`ropt${ans.bankruptcy === "no" ? " sel" : ""}`} onClick={() => updateAnswer(cid, "bankruptcy", "no")}>No</button>
                                    <button className={`ropt${ans.bankruptcy === "yes" ? " sel no" : ""}`} onClick={() => updateAnswer(cid, "bankruptcy", "yes")}>Yes</button>
                                  </div>
                                </div>
                                <div className="q">
                                  <label>Active litigation involving prior projects? <span className="req">*</span> <span className="gate-tag">Gating</span></label>
                                  <div className="rgrp">
                                    <button className={`ropt${ans.litigation === "no" ? " sel" : ""}`} onClick={() => updateAnswer(cid, "litigation", "no")}>No</button>
                                    <button className={`ropt${ans.litigation === "yes" ? " sel no" : ""}`} onClick={() => updateAnswer(cid, "litigation", "yes")}>Yes</button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="fs">
                              <div className="fs-h"><h4>Supporting documents</h4><div className="pg">{docsUploaded} of 5 uploaded</div></div>
                              <div className="fs-b">
                                {[
                                  { k: "bond", label: "Bond", desc: "Performance/payment bond letter or capacity statement", file: "bond_capacity_letter_2026.pdf", size: "142 KB" },
                                  { k: "insurance", label: "Insurance", desc: "Certificate of insurance — general liability, auto, workers comp", file: "coi_general_liability_2026.pdf", size: "89 KB" },
                                  { k: "safety", label: "Safety manual", desc: "Current written safety program", file: "safety_program_2026.pdf", size: "1.4 MB" },
                                  { k: "references", label: "References", desc: "2–3 references from prior GCs", file: "references_bundle.pdf", size: "56 KB" },
                                  { k: "financials", label: "Financial statements", desc: "Most recent financial statement", file: "financials_q3_2025.pdf", size: "78 KB" },
                                ].map(doc => ups[doc.k] ? (
                                  <div key={doc.k} className="uz done">
                                    <h5>{doc.label} · uploaded</h5>
                                    <p>{doc.desc}</p>
                                    <div className="uz-list">
                                      <div className="dr" style={{ margin: 0 }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <h5><span className="dt-tag">{doc.label.toUpperCase().replace(/\s/g, "_")}</span><span className="name">{doc.file}</span></h5>
                                          <p>Uploaded by you · just now · {doc.size}</p>
                                        </div>
                                        <div className="dr-acts">
                                          <button className="btn sm">Replace</button>
                                          <button className="btn sm" onClick={() => toggleUpload(cid, doc.k)}>Remove</button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div key={doc.k} className="uz">
                                    <h5>{doc.label}</h5>
                                    <p>{doc.desc}</p>
                                    <div className="uz-acts">
                                      <button className="btn pri sm" onClick={() => toggleUpload(cid, doc.k)}>Upload file</button>
                                      <button className="btn sm">I don't have one</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="ff">
                              <div className="ff-tx">
                                {(companySectionAns + riskSectionAns) > 0 ? (
                                  <><strong>Draft saved automatically.</strong> {companySectionAns + riskSectionAns} of 7 key questions answered · {docsUploaded} of 5 documents uploaded.</>
                                ) : (
                                  <><strong>Nothing answered yet.</strong> Save and return any time. Submission only happens when you click Submit.</>
                                )}
                              </div>
                              <div className="ff-acts">
                                <button className="btn">Save draft</button>
                                <button className="btn pri" onClick={() => submitForm(cid)} disabled={!readyToSubmit}>Submit for review</button>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Post-submit confirmation */}
                      {submittedIds.has(subSelected) && (
                        <div className="ds">
                          <div className="ds-h"><h4>Submission received</h4><div className="ds-acts"><span className="pl accent">Awaiting GC</span></div></div>
                          <div className="ds-b">
                            <p>Your submission has been sent. {subDetail.org.split(" ·")[0]} will review within their typical 3-day window. We'll notify you as soon as they decide.</p>
                            <div className="dec-acts">
                              <button className="btn" onClick={() => setSubmittedIds(prev => { const n = new Set(prev); n.delete(subSelected); return n; })}>Undo submit</button>
                              <button className="btn ghost">View printable copy</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Submitted status (static — already-submitted record like Summit) */}
                      {subDetail.submittedNote && !submittedIds.has(subSelected) && (
                        <div className="ds">
                          <div className="ds-h"><h4>Status</h4><div className="ds-acts"><span className="pl accent">Awaiting GC</span></div></div>
                          <div className="ds-b"><p>{subDetail.submittedNote}</p></div>
                        </div>
                      )}

                      {/* Approved status */}
                      {subDetail.approvedNote && (
                        <div className="ds">
                          <div className="ds-h"><h4>Status</h4><div className="ds-acts"><span className="pl green">Active</span></div></div>
                          <div className="ds-b"><p>{subDetail.approvedNote}</p>
                            <div className="dec-acts">
                              <button className="btn">Request renewal</button>
                              <button className="btn ghost">Download decision letter</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rejected note */}
                      {subDetail.rejectedNote && (
                        <div className="ds">
                          <div className="ds-h"><h4>Decision</h4><div className="ds-acts"><span className="pl red">Rejected</span></div></div>
                          <div className="ds-b"><p>{subDetail.rejectedNote}</p>
                            <div className="dec-acts">
                              <button className="btn pri">Start fresh submission</button>
                              <button className="btn ghost">Contact GC</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
