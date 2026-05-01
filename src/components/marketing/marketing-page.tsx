"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
};

const CHK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const ARR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    color: "#5b4fc7",
    title: "AIA-format billing",
    desc: "G702/G703 draw requests with schedule of values, retainage tracking, and automated lien waiver collection. Your accountant will thank you.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    color: "#2a7f6f",
    title: "RFIs & issue tracking",
    desc: "Log field questions, assign to the right trade, track responses with full history. No more texts that disappear into the void.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: "#3178b9",
    title: "Client portals",
    desc: "Commercial owners see approvals, draws, and documents. Homeowners see progress photos, selections, and budgets — each in a tone that fits.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H2v7l6.29 6.29a1 1 0 0 0 1.42 0l5.58-5.58a1 1 0 0 0 0-1.42Z" />
        <circle cx="6" cy="9" r="1" />
      </svg>
    ),
    color: "#3d6b8e",
    title: "Selections management",
    desc: "Create allowance-based categories, curate options with photos and specs, and let clients choose — with automatic budget impact tracking.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: "#c17a1a",
    title: "Compliance tracking",
    desc: "Insurance, licenses, certifications — track it all per sub with expiration alerts. Non-compliant subs see a restricted view until they're current.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    color: "#2d8a5e",
    title: "Schedule & milestones",
    desc: "Phase-based timelines with milestone tracking, client-visible schedules, and subcontractor scope views. Everyone knows what's next.",
  },
];

type SolutionKey = "gc" | "sub" | "commercial" | "residential";
type Solution = {
  color: string;
  title: string;
  desc: string;
  features: { h: string; p: string }[];
  preview: string;
};

const SOLUTIONS: Record<SolutionKey, Solution> = {
  gc: {
    color: "#5b4fc7",
    title: "Your command center for every active project",
    desc: "BuiltCRM gives GCs a single dashboard across all projects — with deep tools for billing, subs, and client communication built in.",
    features: [
      { h: "Multi-project dashboard", p: "See all projects at a glance with KPI cards, financial health strips, and priority queues that surface what needs attention now." },
      { h: "AIA billing with G702/G703", p: "Build schedule of values, submit draw requests with line-item detail, track retainage, and collect lien waivers — all in one flow." },
      { h: "Subcontractor management", p: "Compliance tracking, upload requests, RFI coordination, and scoped access — subs see only what they need, nothing more." },
      { h: "Client portal control", p: "Decide what clients see, when they see it. Push updates, photos, schedule changes, and documents on your terms." },
    ],
    preview: "Contractor dashboard preview",
  },
  sub: {
    color: "#3d6b8e",
    title: "Show up, do the work, get paid — less admin",
    desc: "Subs get a clean Today Board that surfaces everything they need across all their active projects. No hunting through emails.",
    features: [
      { h: "Today Board", p: "Cross-project view of your tasks, RFIs, upload requests, and compliance alerts — all in one place." },
      { h: "Fast compliance uploads", p: "Upload insurance certs, licenses, and safety docs once. Get reminded when they're expiring." },
      { h: "Scoped project access", p: "See your scope, your schedule, your documents — not the entire project. Clean and focused." },
    ],
    preview: "Subcontractor Today Board preview",
  },
  commercial: {
    color: "#3178b9",
    title: "Real-time visibility into your investment",
    desc: "Commercial property owners and tenant reps get a professional portal for approvals, financial tracking, and project transparency.",
    features: [
      { h: "Approval workflows", p: "Review change orders, procurement requests, and design decisions with full context and one-click response." },
      { h: "Draw review & payment history", p: "Full ledger of every draw request, payment, and lien waiver — with change order financial summaries." },
      { h: "Progress & documentation", p: "Photo updates, milestone tracking, and a curated document library — no noise, just what matters to you." },
    ],
    preview: "Commercial client portal preview",
  },
  residential: {
    color: "#2a7f6f",
    title: "Your home build, demystified",
    desc: "Homeowners get a warm, clear portal to follow along with their build — from selections to photos to payments, in language that makes sense.",
    features: [
      { h: "Selections studio", p: "Browse curated options for countertops, flooring, fixtures — compare side-by-side, and see how each choice affects your budget." },
      { h: "Progress photos & updates", p: "See what's happening on site with photo timelines, builder notes, and milestone announcements — all in one feed." },
      { h: "Clear budget tracking", p: "Milestone-based payment timeline, selections impact on your total, and plain-English explanations of how payments work." },
    ],
    preview: "Residential client portal preview",
  },
};

type Pricing = {
  tier: string;
  desc: string;
  monthly?: number;
  annual?: number;
  custom?: boolean;
  cta: string;
  ctaPrimary: boolean;
  featured?: boolean;
  label: string;
  features: string[];
};

const PRICING: Pricing[] = [
  { tier: "Starter", desc: "Solo GC or small crew with a handful of active projects.", monthly: 149, annual: 119, cta: "Start free trial", ctaPrimary: false, label: "Includes", features: ["Up to 5 active projects", "3 team members (unlimited subs & clients)", "AIA billing & draw requests", "RFI & change order tracking", "Client portals (commercial + residential)", "5 GB document storage"] },
  { tier: "Professional", desc: "Growing team managing multiple projects with full sub coordination.", monthly: 399, annual: 319, cta: "Start free trial", ctaPrimary: true, featured: true, label: "Everything in Starter, plus", features: ["Unlimited active projects", "10 team members (unlimited subs & clients)", "Compliance management & alerts", "Selections studio for residential clients", "Approval workflows & routing", "50 GB document storage", "Priority email support"] },
  { tier: "Enterprise", desc: "Large firms needing custom workflows, integrations, and dedicated support.", custom: true, cta: "Contact sales", ctaPrimary: false, label: "Everything in Professional, plus", features: ["Unlimited team members", "Custom integrations (QuickBooks, Sage, Procore)", "SSO / SAML authentication", "Unlimited document storage", "Dedicated account manager", "Custom onboarding & training"] },
];

const FAQS = [
  { sender: "Homeowner", q: "Do my subs and clients need their own paid accounts?", a: "Nope. Subcontractor and client portal access is always free — they're included in your plan. You only pay based on your team size and project count. Everyone else gets in at no extra cost." },
  { sender: "General Contractor", q: "We're growing fast. Can I switch plans as we scale?", a: "Absolutely. Upgrade or downgrade anytime. If you upgrade mid-cycle, you'll be prorated for the remainder. Downgrade takes effect at your next billing period." },
  { sender: "General Contractor", q: 'What counts as an "active project" for the Starter limit?', a: "Any project that isn't archived. Once a project is complete and you archive it, it no longer counts against your limit — and you can still access all its records anytime." },
  { sender: "Commercial Owner", q: "How secure is our project data? We have NDAs on everything.", a: "All data is encrypted at rest and in transit. We use row-level security so each organization's data is fully isolated. Enterprise plans also support SSO/SAML for your IT requirements." },
  { sender: "General Contractor", q: "We use QuickBooks. Any integrations coming?", a: "QuickBooks, Sage, and Xero integrations are on the roadmap and coming soon. Enterprise plans can access custom integration support today if you need it sooner." },
];

type ResCat = "blog" | "guide" | "case-study";
type Resource = { cat: ResCat; title: string; desc: string; time: string; date: string };

const RESOURCES: Resource[] = [
  { cat: "blog", title: "Why construction needs better software (not more of it)", desc: "The industry doesn't have a tool shortage — it has a coordination problem. Here's how we're approaching it differently.", time: "5 min read", date: "Apr 2026" },
  { cat: "guide", title: "The GC's guide to AIA billing: G702 & G703 explained", desc: "A plain-English walkthrough of schedule of values, draw requests, retainage, and lien waivers — with templates.", time: "12 min read", date: "Mar 2026" },
  { cat: "case-study", title: "How Ridgeline Builders cut draw processing time by 60%", desc: "A 12-person residential builder shares how consolidating billing, documents, and client communication transformed their workflow.", time: "8 min read", date: "Mar 2026" },
  { cat: "blog", title: "Selections management: stop using spreadsheets for finish schedules", desc: "How allowance-based selections with client self-service can save hours per project and reduce change orders.", time: "6 min read", date: "Feb 2026" },
  { cat: "guide", title: "Subcontractor compliance: a checklist for GCs", desc: "Insurance, licenses, certifications — what to track, when to check, and how to automate the nagging.", time: "7 min read", date: "Feb 2026" },
  { cat: "case-study", title: "From email chaos to one platform: Apex Construction's story", desc: "A commercial GC managing $50M+ in active projects shares how centralizing communication changed their operations.", time: "10 min read", date: "Jan 2026" },
];

type ArticleSection = {
  h?: string;
  p?: string;
  quote?: string;
  callout?: string;
  calloutText?: string;
  stat?: string;
  statLabel?: string;
};
type Article = { author: string; sections: ArticleSection[] };

const ARTICLES: Article[] = [
  { author: "BuiltCRM Team", sections: [
    { h: "The coordination problem nobody talks about", p: "Every general contractor we've talked to runs at least four separate tools. A scheduling app, a billing spreadsheet, a shared drive for documents, and email for everything else. The issue isn't that any one of these tools is bad — it's that none of them talk to each other. When a subcontractor uploads an insurance certificate, nobody downstream knows until someone manually checks. When a draw request gets approved, the schedule doesn't update. When a client asks a question about a selection, the PM has to dig through three inboxes to find the thread." },
    { h: "More tools won't fix a systems problem", p: "The instinct is always to add another tool. A Slack channel for quick messages. A Trello board for approvals. A shared calendar for milestones. But each new tool is another place to check, another login, another set of notifications. The real cost isn't the subscription — it's the context-switching tax your team pays every single day." },
    { quote: "We were spending two hours a day just making sure everyone had the same information. That's not project management — that's data entry with extra steps." },
    { h: "What a unified approach actually looks like", p: "BuiltCRM started from a simple observation: most construction workflows are interconnected. A change order affects the budget, the schedule, and the client's expectations — simultaneously. So why manage them in three different places? Our approach puts all project data in one workspace. When something changes in billing, the dashboard reflects it instantly. When a compliance document expires, the affected projects flag automatically. No manual syncing, no copy-pasting between tools." },
    { stat: "73%", statLabel: "of GCs report spending 10+ hours/week on administrative coordination across disconnected tools" },
    { h: "Building for how teams actually work", p: "We didn't build BuiltCRM by imagining what construction software should look like. We built it by sitting in job trailers, watching PMs juggle phone calls and spreadsheets, and asking one question over and over: what would make this moment easier? The answer was never 'more features.' It was always 'less switching.'" },
  ] },
  { author: "Daniel Chen, PE", sections: [
    { h: "What is AIA billing and why does it matter?", p: "The American Institute of Architects (AIA) billing system is the standard for construction payment applications. The two key documents — the G702 Application and Certificate for Payment and the G703 Continuation Sheet — form the backbone of how contractors request payment from project owners. Understanding these documents isn't optional for GCs — it's the difference between getting paid on time and chasing down approvals for weeks." },
    { h: "The G702: your cover sheet for payment", p: "Think of the G702 as the summary page. It shows the original contract value, any approved change orders, the total completed work to date, retainage held, and the net amount being requested. The architect reviews this document, certifies the amounts, and the owner issues payment based on it. Every number on the G702 flows directly from the G703 — so accuracy on the continuation sheet is everything." },
    { callout: "Pro tip", calloutText: "Always reconcile your G703 line items against the original schedule of values before submitting. Mismatched line items are the #1 reason draw requests get kicked back." },
    { h: "The G703: where the detail lives", p: "The G703 Continuation Sheet is a line-by-line breakdown of every item in your schedule of values. Each row tracks the scheduled value, work completed from previous periods, work completed this period, materials presently stored, a total completed percentage, and the balance to finish. This is where most billing disputes start and end — so precision matters." },
    { h: "Retainage and lien waivers", p: "Retainage — typically 5-10% of each payment — is held by the owner as a safeguard until substantial completion. It's your money, but you won't see it until the project wraps. Lien waivers are the other critical piece: you provide a conditional waiver with each draw request stating that you'll release lien rights once payment is received. After payment clears, an unconditional waiver follows." },
    { stat: "$2.4B", statLabel: "estimated annual cost to the U.S. construction industry from billing disputes and delayed payment processing" },
    { h: "Making AIA billing less painful", p: "The traditional workflow involves Excel spreadsheets, PDF forms, and a lot of manual math. BuiltCRM's billing workspace pre-fills G702/G703 documents from your schedule of values, tracks retainage automatically, and lets you submit draw requests digitally — with a full audit trail your architect and owner can review in real time." },
  ] },
  { author: "BuiltCRM Team", sections: [
    { h: "The challenge: paper-based billing in a digital world", p: "Ridgeline Builders is a 12-person residential construction firm based in the Pacific Northwest. Like most small-to-mid-size builders, they were managing billing through a combination of QuickBooks, Excel, and email. Each draw request involved manually populating an AIA G702 form, attaching backup documentation, emailing it to the client, waiting for questions, revising, and re-sending. The average draw cycle took 18 days from draft to payment." },
    { stat: "18 → 7", statLabel: "days average draw processing time, from initial draft to payment received" },
    { h: "What they changed", p: "Ridgeline moved their entire billing workflow into BuiltCRM. The schedule of values lives in the system, so each new draw request auto-populates from the last approved application. Backup documentation — lien waivers, progress photos, inspection reports — attaches directly to the draw. The client reviews everything in their portal with line-by-line visibility, asks questions inline, and approves digitally." },
    { quote: "The biggest surprise wasn't the time savings — it was that our clients stopped calling to ask where things stood. They could just log in and see it themselves." },
    { h: "The results after 6 months", p: "Draw processing time dropped from 18 days to 7. The number of back-and-forth emails per draw request went from an average of 11 to 2. Client satisfaction scores improved, and Ridgeline's office manager estimated she reclaimed roughly 15 hours per month that had been spent on billing administration alone." },
    { h: "Key takeaway", p: "Ridgeline didn't overhaul their process — they just gave it a better home. The AIA structure stayed the same. The approval chain stayed the same. What changed was that everyone involved could see the same information at the same time, without anyone having to be the messenger." },
  ] },
  { author: "Sarah Kim", sections: [
    { h: "The hidden cost of spreadsheet-based selections", p: "Most residential builders manage finish selections through a shared spreadsheet. It starts simple — a few columns for category, allowance, and client choice. But by the time you're tracking 40+ selections across flooring, lighting, plumbing fixtures, tile, paint, hardware, and appliances, that spreadsheet becomes a liability. Version conflicts, missed deadlines, and miscommunicated allowances create change orders that eat into margins and damage client trust." },
    { h: "What allowance-based selections actually mean", p: "An allowance is a budgeted amount included in the contract for a specific finish category. If the client chooses an option at or below the allowance, there's no cost change. If they go over, the difference becomes a change order — but one that's clearly documented and expected. The problem with spreadsheets is that clients can't easily see where they stand against their allowances in real time. They make choices in isolation and get surprised by the overage later." },
    { callout: "Real numbers", calloutText: "Builders who moved from spreadsheets to structured selection management report 40% fewer selection-related change orders and 3x faster client decision turnaround." },
    { h: "Client self-service changes the dynamic", p: "When clients can browse their options on their own schedule — seeing photos, specs, pricing, and allowance impact side by side — they make better decisions faster. They stop emailing to ask what's included. They stop calling to check deadlines. The builder's time shifts from answering questions to curating options and managing timelines." },
    { h: "How BuiltCRM handles it", p: "Each selection item lives in a structured workspace with allowance tracking, option comparison, and a clear approval flow. The builder publishes items when ready, the client reviews and decides at their pace, and every choice is logged with timestamps, pricing impact, and approval status. No spreadsheets. No version confusion. No ambiguity about who approved what." },
  ] },
  { author: "BuiltCRM Team", sections: [
    { h: "Why compliance tracking matters more than you think", p: "Every general contractor carries liability for their subcontractors' compliance status. If a sub's general liability insurance lapses mid-project and someone gets injured, the GC is exposed. If a trade license expires and the work fails inspection, the GC eats the rework cost and the schedule hit. Compliance isn't administrative overhead — it's risk management." },
    { h: "What to track for every subcontractor", p: "At minimum, you need current certificates for: general liability insurance, workers' compensation insurance, the relevant trade license or contractor's license, any specialty certifications required by the project or jurisdiction, and a signed W-9. Beyond these basics, some projects require additional environmental certifications, safety training documentation (like OSHA 30), or bonding certificates." },
    { stat: "34%", statLabel: "of GCs report discovering a lapsed insurance certificate only after an incident or audit — not through proactive monitoring" },
    { h: "When to check and how often", p: "Insurance and license checks should happen at three points: onboarding (before any work begins), at regular intervals during the project (monthly for long projects), and at any contract renewal or scope change. The problem is that manual checking doesn't scale. Once you're managing 15+ subs across multiple projects, the spreadsheet approach breaks down." },
    { callout: "Compliance checklist", calloutText: "For each sub, verify: GL insurance (current + adequate limits), workers' comp (or valid exemption), trade license (matching scope), W-9 on file, and any project-specific certs. Set expiration alerts at 30, 14, and 7 days before lapse." },
    { h: "Automating the nagging", p: "BuiltCRM's compliance module tracks every document with expiration dates, sends automated reminders to subcontractors when certificates are approaching expiry, and flags the GC when a sub falls out of compliance. You can set restriction thresholds — if a sub's insurance lapses, their access to submit work or payment requests is automatically limited until the issue is resolved." },
  ] },
  { author: "Marcus Torres, VP Operations at Apex Construction", sections: [
    { h: "Background: $50M in active projects, zero centralization", p: "Apex Construction is a commercial GC operating primarily in the mid-Atlantic region. At any given time, they're managing 8-12 active projects ranging from $2M tenant fit-outs to $15M ground-up builds. Before BuiltCRM, their communication infrastructure was a patchwork: email for client correspondence, a shared drive for documents, Procore for some scheduling, QuickBooks for billing, and text messages for anything urgent. The result was predictable — information lived in silos, and the person who knew where to find something was always the bottleneck." },
    { quote: "I used to joke that my actual job title was 'human search engine.' Half my day was spent finding information that already existed somewhere and forwarding it to whoever needed it." },
    { h: "The tipping point", p: "The breaking point came during a $12M healthcare facility build. A subcontractor's insurance lapsed without anyone noticing for three weeks. During that window, a minor jobsite incident occurred. The insurance gap created a liability exposure that cost Apex over $40K in legal fees and nearly derailed the project. That's when leadership decided that 'the way we've always done it' wasn't going to work anymore." },
    { h: "What centralization actually changed", p: "Apex rolled out BuiltCRM across all active projects over a 6-week period. The immediate wins were obvious: RFI response times dropped because questions and answers lived in one threaded system instead of scattered emails. Document retrieval went from minutes-of-searching to seconds. Billing disputes decreased because clients could see exactly what they were being billed for, line by line." },
    { stat: "$180K", statLabel: "estimated annual savings from reduced administrative overhead, faster payment cycles, and eliminated compliance gaps" },
    { h: "The cultural shift", p: "The harder — and more valuable — change was cultural. When everyone on a project can see the same dashboard, accountability becomes ambient. You don't need to chase people for updates because the system reflects reality in real time. Project managers started spending less time reporting and more time managing. Subcontractors stopped calling to ask about payment status because they could check their portal. Clients felt more informed, which meant fewer escalations." },
    { h: "Advice for other GCs considering the switch", p: "Marcus's advice is straightforward: don't try to migrate everything at once. Start with one project, get your team comfortable, and let the results speak for themselves. The biggest resistance will come from people who are very good at the current system — and they're right that change has a cost. But the cost of not changing is higher. You just don't see it because it's spread across a thousand small inefficiencies every week." },
  ] },
];

type PageKey = "home" | "solutions" | "pricing" | "resources";

export default function MarketingPage() {
  const [page, setPage] = useState<PageKey>("home");
  const [audience, setAudience] = useState<SolutionKey>("gc");
  const [annual, setAnnual] = useState(true);
  const [resCat, setResCat] = useState<"all" | ResCat>("all");
  const [activeArticle, setActiveArticle] = useState<number | null>(null);
  const [activeFaq, setActiveFaq] = useState<number>(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (activeArticle === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [activeArticle]);

  const nav = (p: PageKey) => {
    setPage(p);
    setActiveArticle(null);
    setMobileMenu(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!mobileMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenu]);

  return (
    <div className="mkt" style={{ fontFamily: F.body, background: "#faf9f7", color: "#1a1714", WebkitFontSmoothing: "antialiased", lineHeight: 1.6, fontSize: 15, minHeight: "100vh" }}>
      

      {/* ── STICKY NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,249,247,.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid #eeece8", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
          <div onClick={() => nav("home")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#2c2541,#5b4fc7)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 80 80" width="19" height="19"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" /><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" /><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" /></svg>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 780, letterSpacing: "-.04em" }}>BuiltCRM</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {([["home", "Product"], ["solutions", "Solutions"], ["pricing", "Pricing"]] as [PageKey, string][]).map(([k, l]) => (
              <div key={k} onClick={() => nav(k)} style={{ padding: "8px 14px", fontSize: 14, fontWeight: page === k ? 640 : 560, color: page === k ? "#1a1714" : "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms" }}>{l}</div>
            ))}
            <div onClick={() => nav("resources")} style={{ padding: "8px 14px", fontSize: 14, fontWeight: page === "resources" ? 640 : 560, color: page === "resources" ? "#1a1714" : "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms" }}>Resources</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/login" className="mkt-nav-login" style={{ height: 38, padding: "0 16px", fontSize: 13.5, fontWeight: 620, color: "#5e5850", background: "transparent", border: "none", borderRadius: 10, cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none", fontFamily: F.body }}>Log in</Link>
            <Link href="/signup" className="mkt-nav-signup" style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 650, color: "white", background: "#5b4fc7", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", textDecoration: "none", fontFamily: F.body }}>
              Get started free <span style={{ width: 14, height: 14, display: "block" }}>{ARR}</span>
            </Link>
            <button
              type="button"
              aria-label={mobileMenu ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenu(!mobileMenu)}
              className="mkt-hamburger"
              style={{ display: "none", width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e2dc", background: "white", cursor: "pointer", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1714" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenu ? (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>) : (<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>)}
              </svg>
            </button>
          </div>
        </div>
      </nav>
      {mobileMenu && (
        <div className="mkt-mobile-menu" style={{ position: "fixed", top: 58, left: 0, right: 0, bottom: 0, background: "#faf9f7", zIndex: 99, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          {([["home", "Product"], ["solutions", "Solutions"], ["pricing", "Pricing"]] as [PageKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => nav(k)} style={{ textAlign: "left", padding: "16px 14px", fontFamily: F.display, fontSize: 18, fontWeight: page === k ? 720 : 620, color: page === k ? "#5b4fc7" : "#1a1714", background: page === k ? "#eeedfb" : "transparent", border: "none", borderRadius: 12, cursor: "pointer" }}>{l}</button>
          ))}
          <button onClick={() => nav("resources")} style={{ textAlign: "left", padding: "16px 14px", fontFamily: F.display, fontSize: 18, fontWeight: page === "resources" ? 720 : 620, color: page === "resources" ? "#5b4fc7" : "#1a1714", background: page === "resources" ? "#eeedfb" : "transparent", border: "none", borderRadius: 12, cursor: "pointer" }}>Resources</button>
          <div style={{ height: 1, background: "#eeece8", margin: "12px 0" }} />
          <Link href="/login" onClick={() => setMobileMenu(false)} style={{ padding: "14px 14px", fontSize: 15, fontWeight: 620, color: "#5e5850", textDecoration: "none", fontFamily: F.body }}>Log in</Link>
          <Link href="/signup" onClick={() => setMobileMenu(false)} style={{ marginTop: 8, height: 50, borderRadius: 12, background: "#5b4fc7", color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 680, textDecoration: "none", fontFamily: F.body }}>
            Get started free <span style={{ width: 16, height: 16, display: "block" }}>{ARR}</span>
          </Link>
        </div>
      )}

      {/* ══════════ HOME / PRODUCT ══════════ */}
      {page === "home" && (
        <div>
          {/* Hero */}
          <section style={{ padding: "100px 32px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,rgba(91,79,199,.06) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(42,127,111,.04) 0%,transparent 40%)", pointerEvents: "none" }} />
            <div style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px 6px 8px", background: "#eeedfb", border: "1px solid rgba(91,79,199,.12)", borderRadius: 999, fontSize: 12.5, fontWeight: 620, color: "#4a3fb0", marginBottom: 24 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5b4fc7", animation: "pulse 2s ease-in-out infinite" }} /> Now in early access
              </div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(40px,5vw,60px)", fontWeight: 820, letterSpacing: "-.04em", lineHeight: 1.08, marginBottom: 20 }}>Run your builds,<br />not your inbox</h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#5e5850", maxWidth: 580, margin: "0 auto 36px" }}>BuiltCRM connects general contractors, subcontractors, and clients on one platform — so everyone sees the same project, in real time, without the email chaos.</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                <Btn lg primary href="/signup">Start free trial <span style={{ width: 16, height: 16, display: "inline-block" }}>{ARR}</span></Btn>
                <Btn lg secondary href="#">Watch demo</Btn>
              </div>
            </div>
          </section>
          

          {/* Trust Bar */}
          <div style={{ padding: "40px 32px 60px", textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 620, letterSpacing: ".06em", textTransform: "uppercase", color: "#928b80", marginBottom: 20 }}>Trusted by builders who actually build</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap", opacity: .4 }}>
              {["Summit Contracting", "Ridgeline Builders", "Apex Construction", "Ironwood Group", "BluePrint Homes"].map(n => (
                <span key={n} style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: "#928b80", letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{n}</span>
              ))}
            </div>
          </div>

          {/* Product Preview */}
          <Section>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>The platform</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>One project. Every stakeholder.<br />Zero confusion.</h2>
              <p style={{ fontSize: 15, color: "#5e5850", maxWidth: 560, margin: "12px auto 0" }}>Billing, RFIs, change orders, selections, documents, scheduling — all in one workspace your whole team actually uses.</p>
              <div style={{ maxWidth: 960, margin: "40px auto 0", background: "white", border: "1px solid #e5e2dc", borderRadius: 24, boxShadow: "0 20px 60px rgba(26,23,20,.1)", overflow: "hidden", aspectRatio: "16/9", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 36, background: "#f5f4f1", borderBottom: "1px solid #eeece8", display: "flex", alignItems: "center", padding: "0 14px", gap: 6, zIndex: 2 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e27b6b" }} /><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e9b84f" }} /><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#6fbf7f" }} />
                  <div style={{ flex: 1, maxWidth: 280, height: 20, background: "white", borderRadius: 5, border: "1px solid #eeece8", marginLeft: 12, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 10, color: "#928b80", fontFamily: F.body, fontWeight: 520 }}>app.builtcrm.com / dashboard</div>
                </div>
                <DashboardMock />
              </div>
            </div>
          </Section>

          {/* Features */}
          <Section alt>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Core features</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>Everything you need to manage a project from contract to closeout</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
              {FEATURES.map((f, i) => (
                <div key={i} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 20, padding: "32px 28px", transition: "all 250ms cubic-bezier(.16,1,.3,1)", cursor: "default" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", marginBottom: 16, background: `linear-gradient(135deg,${f.color},${f.color}aa)` }}>
                    <span style={{ width: 22, height: 22, display: "block", color: "white" }}>{f.icon}</span>
                  </div>
                  <h3 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, letterSpacing: "-.015em", marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "#5e5850", lineHeight: 1.55, fontWeight: 520 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Feature deep-dives */}
          <Section>
            <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>
              <FeatureRow
                eyebrow="Billing"
                title="AIA-format draw requests, without the paperwork"
                desc="Build your schedule of values once. Every draw request auto-populates with line-item detail, tracks retainage, and hands off clean G702/G703 documents to your architect and owner."
                bullets={["Schedule of values workspace", "Line-item draw applications", "Automatic retainage calculations", "Lien waiver collection"]}
                mock={<BillingMock />}
                flip={false}
              />
              <FeatureRow
                eyebrow="Coordination"
                title="RFIs and change orders in one threaded workspace"
                desc="Field questions get logged, assigned, and answered in context — with a full audit trail. Change orders flow through the same system, so nothing gets lost between an iMessage and a spreadsheet."
                bullets={["Threaded RFI responses", "Assignee routing by trade", "Change order financial impact", "Full audit history"]}
                mock={<RfiMock />}
                flip={true}
              />
              <FeatureRow
                eyebrow="Client portals"
                title="A clean, role-shaped view for every stakeholder"
                desc="Commercial owners see approvals, draws, and documentation. Homeowners see photos, selections, and a budget they can actually understand. You publish — clients see only what's ready."
                bullets={["Commercial approvals ledger", "Residential selections studio", "Progress photo feed", "Controlled publish workflow"]}
                mock={<PortalMock />}
                flip={false}
              />
            </div>
          </Section>

          {/* Stats */}
          <Section dark>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
              {([["3", "Portal experiences"], ["12+", "Workflow modules"], ["100%", "AIA-compliant billing"], ["0", "Lost text messages"]] as [string, string][]).map(([n, l], i) => (
                <div key={i}>
                  <div style={{ fontFamily: F.display, fontSize: "clamp(32px,4vw,44px)", fontWeight: 820, letterSpacing: "-.03em", lineHeight: 1, color: "white" }}>{n}</div>
                  <div style={{ fontSize: 14, color: "rgba(250,249,247,.5)", marginTop: 6 }}>{l}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* CTA */}
          <Section>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Ready to build?</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8, marginBottom: 16 }}>Stop managing your projects<br />across 6 different apps</h2>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#5e5850", marginBottom: 32 }}>Start with a free trial. No credit card required. Import your first project in under 5 minutes.</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Btn lg primary href="/signup">Get started free <span style={{ width: 16, height: 16, display: "inline-block" }}>{ARR}</span></Btn>
                <Btn lg secondary href="#">Talk to sales</Btn>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ══════════ SOLUTIONS ══════════ */}
      {page === "solutions" && (
        <div>
          <Section style={{ paddingTop: 56 }}>
            <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto 56px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Solutions</div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>Built for every seat at the table</h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#5e5850", marginTop: 12 }}>Different roles need different things. BuiltCRM gives each stakeholder a workspace that fits how they actually work.</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 48, flexWrap: "wrap" }}>
              {([["gc", "General Contractors", "#5b4fc7"], ["sub", "Subcontractors", "#3d6b8e"], ["commercial", "Commercial Owners", "#3178b9"], ["residential", "Homeowners", "#2a7f6f"]] as [SolutionKey, string, string][]).map(([k, l, c]) => (
                <button key={k} onClick={() => setAudience(k)} style={{ height: 40, padding: "0 20px", borderRadius: 999, fontSize: 13.5, fontWeight: 620, color: audience === k ? "white" : "#5e5850", background: audience === k ? c : "transparent", border: audience === k ? "none" : "1px solid #e5e2dc", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "all 120ms", fontFamily: F.body }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: audience === k ? "rgba(255,255,255,.5)" : c }} />{l}
                </button>
              ))}
            </div>
            {(() => {
              const s = SOLUTIONS[audience];
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
                  <div>
                    <h2 style={{ fontFamily: F.display, fontSize: "clamp(22px,2.5vw,28px)", fontWeight: 750, letterSpacing: "-.03em", lineHeight: 1.2, marginBottom: 12 }}>{s.title}</h2>
                    <p style={{ fontSize: 15, color: "#5e5850", marginBottom: 28, fontWeight: 520 }}>{s.desc}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {s.features.map((f, i) => (
                        <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1, background: s.color }}>
                            <span style={{ width: 14, height: 14, display: "block", color: "white" }}>{CHK}</span>
                          </div>
                          <div>
                            <h4 style={{ fontFamily: F.display, fontSize: 14, fontWeight: 680, marginBottom: 3 }}>{f.h}</h4>
                            <p style={{ fontSize: 13.5, color: "#5e5850", lineHeight: 1.5, fontWeight: 520 }}>{f.p}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: "white", border: "1px solid #e5e2dc", borderRadius: 20, aspectRatio: "4/3", overflow: "hidden", boxShadow: "0 4px 16px rgba(26,23,20,.06)", position: "relative" }}>
                    <SolutionMock audience={audience} />
                  </div>
                </div>
              );
            })()}
          </Section>

          {/* Rollout timeline */}
          <Section alt>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>How rollout works</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(26px,3vw,36px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>Live on your first project in a week</h2>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5e5850", marginTop: 12, fontWeight: 520 }}>No SOW. No implementation fee. No six-week deployment. Start with one project, invite your team, keep building.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, position: "relative" }}>
              {[
                { n: "01", d: "Day 1", h: "Spin up your workspace", p: "Create your org, import a schedule of values, and invite your PM team. The platform is ready before your first coffee break." },
                { n: "02", d: "Day 2-3", h: "Loop in subs & clients", p: "Send portal invites to your subcontractors and clients. They land in a scoped view — no training required, no learning curve." },
                { n: "03", d: "Day 4-7", h: "Run your first draw", p: "Build a draw from your SOV, attach lien waivers, and submit. Architect and owner review in real time. You're live." },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 20, padding: "28px 26px", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#5b4fc7,#7c6fe0)", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 14, fontWeight: 820, letterSpacing: "-.02em" }}>{s.n}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#928b80", textTransform: "uppercase", letterSpacing: ".05em" }}>{s.d}</div>
                  </div>
                  <h3 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740, letterSpacing: "-.015em", marginBottom: 8, color: "#1a1714" }}>{s.h}</h3>
                  <p style={{ fontSize: 13.5, color: "#5e5850", lineHeight: 1.55, fontWeight: 520 }}>{s.p}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Comparison strip */}
          <Section>
            <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 40px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>The old way vs the BuiltCRM way</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(26px,3vw,36px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>Stop taxing your team with context switching</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 920, margin: "0 auto" }}>
              <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 20, padding: "28px 28px", opacity: .85 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 720, padding: "3px 10px", borderRadius: 999, color: "#928b80", background: "#f3f1ee", textTransform: "uppercase", letterSpacing: ".04em" }}>Spreadsheets + email</span>
                </div>
                {[
                  "SOV lives in Excel, draws rebuilt from scratch each month",
                  "RFIs lost in email threads, no audit trail",
                  "Compliance tracked in a shared drive folder nobody checks",
                  "Clients call to ask what's happening on site",
                  "Sub coordination happens in 4 group texts",
                ].map(l => (
                  <div key={l} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#5e5850", lineHeight: 1.5, marginBottom: 10, fontWeight: 520 }}>
                    <span style={{ width: 16, height: 16, color: "#d04b3a", flexShrink: 0, marginTop: 1, display: "block" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </span>{l}
                  </div>
                ))}
              </div>
              <div style={{ background: "linear-gradient(135deg,#eeedfb,#faf9f7)", border: "2px solid #5b4fc7", borderRadius: 20, padding: "28px 28px", boxShadow: "0 12px 40px rgba(91,79,199,.12)", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 720, padding: "3px 10px", borderRadius: 999, color: "white", background: "#5b4fc7", textTransform: "uppercase", letterSpacing: ".04em" }}>BuiltCRM</span>
                </div>
                {[
                  "SOV is the source — draws auto-populate from the last approved app",
                  "RFIs threaded, routed, and timestamped with full history",
                  "Compliance alerts fire 30/14/7 days before any cert expires",
                  "Clients log into their portal and see progress themselves",
                  "One workspace for everyone — GC, subs, owners, architects",
                ].map(l => (
                  <div key={l} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#1a1714", lineHeight: 1.5, marginBottom: 10, fontWeight: 560 }}>
                    <span style={{ width: 16, height: 16, color: "#5b4fc7", flexShrink: 0, marginTop: 1, display: "block" }}>{CHK}</span>{l}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section alt>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginBottom: 16 }}>One platform, every perspective</h2>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#5e5850", marginBottom: 32 }}>Give your entire project team the tools they need — without the learning curve of enterprise software.</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Btn lg primary href="/signup">Get started free</Btn>
                <Btn lg secondary onClick={() => nav("pricing")}>See pricing</Btn>
              </div>
            </div>
          </Section>

          {/* About Us teaser */}
          <Section>
            <div style={{ maxWidth: 960, margin: "0 auto", background: "linear-gradient(135deg,#2c2541,#3d3366)", borderRadius: 24, padding: "56px 56px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,79,199,.35),transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#a89cf0", marginBottom: 12 }}>About BuiltCRM</div>
                  <h2 style={{ fontFamily: F.display, fontSize: "clamp(26px,3vw,34px)", fontWeight: 820, letterSpacing: "-.03em", lineHeight: 1.15, marginBottom: 14, color: "white" }}>Built by people who&apos;ve sat in job trailers</h2>
                  <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(250,249,247,.7)", marginBottom: 24, fontWeight: 520 }}>We&apos;re a small team of ex-PMs, builders, and engineers who got tired of watching construction teams lose hours a day to spreadsheets and email chains. BuiltCRM is our answer — a single workspace designed around how real projects actually run.</p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link href="/about" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 22px", fontSize: 14, fontWeight: 680, color: "#1a1714", background: "white", borderRadius: 12, textDecoration: "none", fontFamily: F.body }}>
                      Read our story <span style={{ width: 14, height: 14, display: "block" }}>{ARR}</span>
                    </Link>
                    <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 22px", fontSize: 14, fontWeight: 680, color: "white", background: "transparent", border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, textDecoration: "none", fontFamily: F.body }}>Meet the team</a>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                  {[["2024", "Founded"], ["18", "Team members"], ["500+", "Projects piloted"], ["4", "Portal roles"]].map(([v, l]) => (
                    <div key={l} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "18px 18px" }}>
                      <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 820, letterSpacing: "-.02em", color: "white", lineHeight: 1 }}>{v}</div>
                      <div style={{ fontSize: 12, color: "rgba(250,249,247,.5)", marginTop: 4, fontWeight: 520 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ══════════ PRICING ══════════ */}
      {page === "pricing" && (
        <div>
          <Section style={{ paddingTop: 56 }}>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Pricing</div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>Simple pricing that<br />grows with your crew</h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#5e5850", marginTop: 12 }}>No per-user fees for clients or subs. You pay based on your projects — everyone else is included.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "24px 0 48px", fontSize: 14, fontWeight: 600, color: "#5e5850" }}>
              <span>Monthly</span>
              <div onClick={() => setAnnual(!annual)} style={{ width: 44, height: 24, borderRadius: 12, background: annual ? "#5b4fc7" : "#e5e2dc", cursor: "pointer", position: "relative", transition: "background 120ms" }}>
                <div style={{ position: "absolute", top: 3, left: annual ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(26,23,20,.04)", transition: "left 250ms cubic-bezier(.16,1,.3,1)" }} />
              </div>
              <span>Annual</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2d8a5e", background: "#edf7f1", padding: "2px 8px", borderRadius: 999 }}>Save 20%</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, maxWidth: 960, margin: "0 auto" }}>
              {PRICING.map((p, i) => (
                <div key={i} style={{ background: "white", border: p.featured ? "2px solid #5b4fc7" : "1px solid #e5e2dc", borderRadius: 20, padding: "32px 28px", position: "relative", boxShadow: p.featured ? "0 0 0 1px #5b4fc7, 0 12px 40px rgba(26,23,20,.08)" : "none" }}>
                  {p.featured && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#5b4fc7", color: "white", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 999, whiteSpace: "nowrap" }}>Most popular</div>}
                  <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 720, marginBottom: 4 }}>{p.tier}</div>
                  <div style={{ fontSize: 13, color: "#928b80", marginBottom: 20, lineHeight: 1.45 }}>{p.desc}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontFamily: F.display, fontSize: 42, fontWeight: 820, letterSpacing: "-.03em", lineHeight: 1 }}>{p.custom ? "Custom" : `$${annual ? p.annual : p.monthly}`}</span>
                    {!p.custom && <span style={{ fontSize: 14, color: "#928b80", fontWeight: 550 }}>/month</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#928b80", marginBottom: 24 }}>{p.custom ? "tailored to your team" : annual ? "billed annually" : "billed monthly"}</div>
                  {p.custom ? (
                    <a href="#" style={{ width: "100%", height: 42, borderRadius: 10, fontSize: 14, fontWeight: 650, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 24, border: "1px solid #e5e2dc", background: "white", color: "#1a1714", cursor: "pointer", textDecoration: "none", fontFamily: F.body, boxSizing: "border-box" }}>{p.cta}</a>
                  ) : (
                    <Link href="/signup" style={{ width: "100%", height: 42, borderRadius: 10, fontSize: 14, fontWeight: 650, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 24, border: p.ctaPrimary ? "none" : "1px solid #e5e2dc", background: p.ctaPrimary ? "#5b4fc7" : "white", color: p.ctaPrimary ? "white" : "#1a1714", cursor: "pointer", textDecoration: "none", fontFamily: F.body, boxSizing: "border-box" }}>{p.cta}</Link>
                  )}
                  <div style={{ height: 1, background: "#eeece8", marginBottom: 20 }} />
                  <div style={{ fontSize: 12, fontWeight: 650, color: "#928b80", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>{p.label}</div>
                  {p.features.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#5e5850", lineHeight: 1.45, marginBottom: 10 }}>
                      <span style={{ width: 16, height: 16, color: "#2d8a5e", flexShrink: 0, marginTop: 2, display: "block" }}>{CHK}</span>{f}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>

          {/* Included in every plan */}
          <Section alt>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Included in every plan</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(26px,3vw,36px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>The essentials, standard</h2>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5e5850", marginTop: 12, fontWeight: 520 }}>No nickel-and-diming on core functionality. Every plan ships with the workflows your team needs on day one.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, maxWidth: 960, margin: "0 auto" }}>
              {[
                { c: "#5b4fc7", h: "Unlimited clients", p: "Never pay per seat for owners or homeowners. Portal access is always free." },
                { c: "#3d6b8e", h: "Unlimited subs", p: "Every subcontractor you work with gets scoped portal access at no extra cost." },
                { c: "#2d8a5e", h: "Data export", p: "Your project data is yours. Export to CSV or JSON anytime, no lock-in." },
                { c: "#c17a1a", h: "Encrypted at rest", p: "AES-256 encryption, row-level tenant isolation, daily backups — table stakes." },
              ].map(x => (
                <div key={x.h} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 16, padding: "22px 22px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${x.c}18`, color: x.c, display: "grid", placeItems: "center", marginBottom: 14 }}>
                    <span style={{ width: 18, height: 18, display: "block" }}>{CHK}</span>
                  </div>
                  <h3 style={{ fontFamily: F.display, fontSize: 15, fontWeight: 720, letterSpacing: "-.015em", marginBottom: 6, color: "#1a1714" }}>{x.h}</h3>
                  <p style={{ fontSize: 12.5, color: "#5e5850", lineHeight: 1.55, fontWeight: 520 }}>{x.p}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Testimonial strip */}
          <Section>
            <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#5b4fc7" opacity=".2" style={{ margin: "0 auto 20px" }}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.017-2-2H4c-1.24 0-2 .75-2 1.993V11c0 1.25.76 2 2 2h2s.5 1-1.5 2C2 16 3 21 3 21zm14 0c3 0 7-1 7-8V5c0-1.25-.76-2.017-2-2h-4c-1.24 0-2 .75-2 1.993V11c0 1.25.76 2 2 2h2s.5 1-1.5 2c-1.5 1-.5 6-.5 6z" /></svg>
              <p style={{ fontFamily: F.display, fontSize: "clamp(20px,2.2vw,26px)", fontWeight: 620, letterSpacing: "-.02em", lineHeight: 1.35, color: "#1a1714", marginBottom: 24 }}>&ldquo;We priced it against adding another project coordinator. BuiltCRM paid for itself in three weeks — and our clients actually enjoy logging in now.&rdquo;</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#5b4fc7,#7c6fe0)", color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 15, fontWeight: 720 }}>ER</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 720, color: "#1a1714" }}>Elena Ramirez</div>
                  <div style={{ fontSize: 12, color: "#928b80", fontWeight: 520 }}>Operations Director · Ridgeline Builders</div>
                </div>
              </div>
            </div>
          </Section>

          <Section alt>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Questions</div>
              <h2 style={{ fontFamily: F.display, fontSize: "clamp(22px,2.5vw,28px)", fontWeight: 750, letterSpacing: "-.03em", lineHeight: 1.2, marginTop: 8 }}>Answered the way we answer everything</h2>
              <p style={{ fontSize: 14.5, color: "#5e5850", maxWidth: 500, margin: "10px auto 0", fontWeight: 520 }}>Each question is its own conversation — click a thread to open the answer. Same workspace your team uses inside BuiltCRM.</p>
            </div>
            <FaqMessages active={activeFaq} setActive={setActiveFaq} />
          </Section>
        </div>
      )}

      {/* ══════════ RESOURCES ══════════ */}
      {page === "resources" && (
        <div>
          <Section style={{ paddingTop: 56 }}>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7" }}>Resources</div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(30px,3.5vw,42px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.12, marginTop: 8 }}>Learn, adapt, build better</h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#5e5850", marginTop: 12 }}>Guides, case studies, and articles for construction teams who want to work smarter.</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 36, flexWrap: "wrap" }}>
              {([["all", "All"], ["blog", "Blog"], ["guide", "Guides"], ["case-study", "Case studies"]] as ["all" | ResCat, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setResCat(k)} style={{ height: 34, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 620, color: resCat === k ? "#faf9f7" : "#5e5850", background: resCat === k ? "#1a1714" : "transparent", border: resCat === k ? "none" : "1px solid #e5e2dc", cursor: "pointer", fontFamily: F.body }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
              {RESOURCES.filter(r => resCat === "all" || r.cat === resCat).map((r, i) => {
                const catColor = ({ blog: "#5b4fc7", guide: "#2a7f6f", "case-study": "#3178b9" } as Record<ResCat, string>)[r.cat];
                const origIdx = RESOURCES.indexOf(r);
                return (
                  <div key={i} onClick={() => setActiveArticle(origIdx)} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 20, overflow: "hidden", cursor: "pointer", transition: "all 250ms" }}>
                    <div style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden" }}>
                      <ResourceThumb idx={origIdx} color={catColor} />
                      <span style={{ position: "absolute", top: 12, left: 12, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, color: "white", textTransform: "uppercase", letterSpacing: ".04em", background: catColor, zIndex: 2 }}>{r.cat === "case-study" ? "Case study" : r.cat.charAt(0).toUpperCase() + r.cat.slice(1)}</span>
                    </div>
                    <div style={{ padding: "20px 24px 24px" }}>
                      <h3 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, letterSpacing: "-.015em", lineHeight: 1.3, marginBottom: 8 }}>{r.title}</h3>
                      <p style={{ fontSize: 13.5, color: "#5e5850", lineHeight: 1.55, marginBottom: 12, fontWeight: 520 }}>{r.desc}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#928b80", fontWeight: 550 }}>
                        <span>{r.time}</span><span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d1cdc5" }} /><span>{r.date}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {/* ── ARTICLE OVERLAY ── */}
      {activeArticle !== null && (() => {
        const r = RESOURCES[activeArticle];
        const a = ARTICLES[activeArticle];
        const catColor = ({ blog: "#5b4fc7", guide: "#2a7f6f", "case-study": "#3178b9" } as Record<ResCat, string>)[r.cat];
        const catLabel = r.cat === "case-study" ? "Case Study" : r.cat.charAt(0).toUpperCase() + r.cat.slice(1);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#faf9f7", overflowY: "auto" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(250,249,247,.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid #eeece8" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => setActiveArticle(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F.display, fontSize: 13, fontWeight: 620, color: "#5b4fc7", background: "none", border: "none", cursor: "pointer", padding: "6px 0" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  Back to Resources
                </button>
                <span style={{ fontSize: 12, color: "#928b80", fontWeight: 520 }}>{r.time}</span>
              </div>
            </div>
            <article style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
              <div style={{ marginBottom: 32 }}>
                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, color: "white", textTransform: "uppercase", letterSpacing: ".04em", background: catColor, marginBottom: 16 }}>{catLabel}</span>
                <h1 style={{ fontFamily: F.display, fontSize: "clamp(28px,4vw,38px)", fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.15, marginBottom: 16 }}>{r.title}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#928b80", fontWeight: 520, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 620, color: "#5e5850" }}>{a.author}</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d1cdc5" }} />
                  <span>{r.date}</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d1cdc5" }} />
                  <span>{r.time}</span>
                </div>
              </div>
              <div style={{ fontSize: 16.5, lineHeight: 1.75, color: "#3d3830", fontWeight: 520 }}>
                {a.sections.map((s, si) => (
                  <div key={si}>
                    {s.h && <h2 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 780, letterSpacing: "-.02em", lineHeight: 1.3, margin: "36px 0 12px", color: "#1a1714" }}>{s.h}</h2>}
                    {s.p && <p style={{ marginBottom: 20 }}>{s.p}</p>}
                    {s.quote && <blockquote style={{ margin: "28px 0", padding: "20px 24px", borderLeft: "3px solid #5b4fc7", background: "#f5f4f1", borderRadius: "0 14px 14px 0", fontStyle: "italic", fontSize: 17, lineHeight: 1.7, color: "#3d3830", fontWeight: 520 }}>{s.quote}</blockquote>}
                    {s.callout && <div style={{ margin: "28px 0", padding: "20px 24px", border: "1px solid #e5e2dc", borderRadius: 14, background: "#f9f8f6" }}><div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: "#5b4fc7", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>{s.callout}</div><p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#3d3830", fontWeight: 520 }}>{s.calloutText}</p></div>}
                    {s.stat && <div style={{ margin: "32px 0", textAlign: "center", padding: "32px 24px", background: "linear-gradient(135deg,#f5f4f1,#eeedfb)", borderRadius: 18 }}><div style={{ fontFamily: F.display, fontSize: 48, fontWeight: 820, letterSpacing: "-.04em", color: "#5b4fc7", lineHeight: 1 }}>{s.stat}</div><div style={{ fontSize: 14, color: "#5e5850", marginTop: 10, maxWidth: 360, marginLeft: "auto", marginRight: "auto", fontWeight: 520, lineHeight: 1.5 }}>{s.statLabel}</div></div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 56, padding: "40px 32px", background: "linear-gradient(135deg,#2c2541,#5b4fc7)", borderRadius: 20, textAlign: "center" }}>
                <h3 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 780, color: "white", letterSpacing: "-.02em", marginBottom: 8 }}>Ready to simplify your workflow?</h3>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,.7)", marginBottom: 24, fontWeight: 520 }}>Join hundreds of construction teams already using BuiltCRM.</p>
                <button onClick={() => { setActiveArticle(null); nav("pricing"); }} style={{ height: 44, padding: "0 28px", fontSize: 14, fontWeight: 650, color: "#1a1714", background: "white", borderRadius: 12, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: F.body }}>See plans and pricing <span style={{ width: 14, height: 14, display: "block" }}>{ARR}</span></button>
              </div>
            </article>
          </div>
        );
      })()}

      {/* ── FOOTER ── */}
      <footer style={{ background: "#2c2541", color: "rgba(250,249,247,.7)", padding: "72px 32px 36px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 64, marginBottom: 56 }}>
            <div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#5b4fc7,#7c6fe0)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                <svg viewBox="0 0 80 80" width="19" height="19"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" /><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" /><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" /></svg>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, maxWidth: 260, color: "rgba(250,249,247,.5)" }}>Construction project management built for the way real teams actually work.</p>
            </div>
            {([
              { h: "Product", links: [{ l: "Features" }, { l: "Pricing" }, { l: "Integrations", href: "/integrations" }, { l: "API docs", href: "/api-docs" }, { l: "Changelog" }, { l: "Roadmap" }] },
              { h: "Solutions", links: [{ l: "General Contractors" }, { l: "Subcontractors" }, { l: "Commercial Owners" }, { l: "Homeowners" }] },
              { h: "Company", links: [{ l: "About" }, { l: "Blog" }, { l: "Careers" }, { l: "Contact" }, { l: "Security" }] },
            ] as { h: string; links: { l: string; href?: string }[] }[]).map((col, i) => (
              <div key={i}>
                <h4 style={{ fontFamily: F.display, fontSize: 11.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "rgba(250,249,247,.3)", marginBottom: 20 }}>{col.h}</h4>
                {col.links.map(({ l, href }) => href ? (
                  <Link key={l} href={href} style={{ display: "block", fontSize: 13.5, color: "rgba(250,249,247,.6)", fontWeight: 480, marginBottom: 12, textDecoration: "none" }}>{l}</Link>
                ) : (
                  <div key={l} style={{ fontSize: 13.5, color: "rgba(250,249,247,.6)", fontWeight: 480, marginBottom: 12, cursor: "pointer" }}>{l}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(250,249,247,.08)", marginBottom: 24 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "rgba(250,249,247,.35)" }}>
            <span>&copy; 2026 BuiltCRM. All rights reserved.</span>
            <div style={{ display: "flex", gap: 20 }}>
              {["Privacy", "Terms", "Security"].map(l => <span key={l} style={{ cursor: "pointer" }}>{l}</span>)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ children, alt, dark, style = {} }: { children: ReactNode; alt?: boolean; dark?: boolean; style?: CSSProperties }) {
  return (
    <section style={{ padding: "80px 32px", background: dark ? "#2c2541" : alt ? "#f3f1ee" : "transparent", color: dark ? "#faf9f7" : undefined, ...style }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Btn({ children, lg, primary, secondary, href, onClick }: { children: ReactNode; lg?: boolean; primary?: boolean; secondary?: boolean; href?: string; onClick?: () => void }) {
  const style: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 650, borderRadius: lg ? 14 : 10,
    height: lg ? 48 : 40, padding: lg ? "0 28px" : "0 20px", fontSize: lg ? 15 : 14, whiteSpace: "nowrap",
    background: primary ? "#5b4fc7" : "transparent", color: primary ? "white" : "#1a1714",
    border: secondary ? "1px solid #e5e2dc" : "none", boxShadow: secondary ? "0 1px 3px rgba(26,23,20,.04)" : "none",
    cursor: "pointer", fontFamily: F.body, textDecoration: "none", boxSizing: "border-box",
  };
  if (href && href !== "#") return <Link href={href} style={style}>{children}</Link>;
  if (href === "#") return <a href="#" style={style}>{children}</a>;
  return <button onClick={onClick} style={style}>{children}</button>;
}

/* ─── FAQ as messages workspace ─── */
const FAQ_META: { type: string; typeColor: string; senderColor: string; time: string; date: string; unread: boolean }[] = [
  { type: "General", typeColor: "#5b4fc7", senderColor: "#2a7f6f", time: "9:14 AM", date: "Today", unread: false },
  { type: "Billing", typeColor: "#c17a1a", senderColor: "#5b4fc7", time: "9:22 AM", date: "Today", unread: true },
  { type: "General", typeColor: "#5b4fc7", senderColor: "#5b4fc7", time: "10:03 AM", date: "Today", unread: false },
  { type: "Security", typeColor: "#3178b9", senderColor: "#3178b9", time: "10:41 AM", date: "Today", unread: true },
  { type: "Integrations", typeColor: "#2d8a5e", senderColor: "#5b4fc7", time: "11:08 AM", date: "Today", unread: false },
];

function FaqMessages({ active, setActive }: { active: number; setActive: (i: number) => void }) {
  const cur = FAQS[active];
  const meta = FAQ_META[active];
  return (
    <div style={{ maxWidth: 960, margin: "32px auto 0", background: "white", border: "1px solid #eeece8", borderRadius: 20, boxShadow: "0 8px 30px rgba(26,23,20,.06)", overflow: "hidden" }}>
      {/* Workspace header */}
      <div style={{ padding: "14px 22px", borderBottom: "1px solid #eeece8", display: "flex", alignItems: "center", gap: 12, background: "#faf9f7" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5b4fc7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 720, color: "#1a1714", letterSpacing: "-.01em" }}>Customer questions</div>
          <div style={{ fontSize: 11.5, color: "#928b80", fontWeight: 520 }}>{FAQS.length} conversations · Live workspace preview</div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 720, padding: "3px 10px", borderRadius: 999, color: "#2d8a5e", background: "#edf7f1", textTransform: "uppercase", letterSpacing: ".04em" }}>Inbox</div>
      </div>

      {/* Two-pane layout */}
      <div className="faq-ml" style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 520, background: "#faf9f7" }}>
        {/* Conversation list */}
        <div style={{ borderRight: "1px solid #eeece8", background: "white", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #f3f1ee" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#928b80", marginBottom: 8 }}>Conversations</div>
            <div style={{ height: 30, borderRadius: 8, border: "1px solid #eeece8", background: "#faf9f7", padding: "0 10px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#928b80", fontWeight: 520 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              Search questions
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {FAQS.map((f, i) => {
              const m = FAQ_META[i];
              const isActive = i === active;
              const initial = f.sender.charAt(0);
              return (
                <div
                  key={i}
                  onClick={() => setActive(i)}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #f3f1ee",
                    cursor: "pointer",
                    display: "flex",
                    gap: 11,
                    background: isActive ? "#eeedfb" : "transparent",
                    borderLeft: isActive ? "3px solid #5b4fc7" : "3px solid transparent",
                    transition: "background 120ms",
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: m.senderColor, color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 13, fontWeight: 720, flexShrink: 0 }}>{initial}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: isActive ? 720 : 660, color: "#1a1714", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.sender}</span>
                      <span style={{ fontSize: 10.5, color: "#928b80", fontWeight: 520, flexShrink: 0 }}>{m.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#5e5850", lineHeight: 1.4, fontWeight: 520, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.q}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 720, padding: "2px 7px", borderRadius: 999, color: m.typeColor, background: `${m.typeColor}15`, textTransform: "uppercase", letterSpacing: ".04em" }}>{m.type}</span>
                      {m.unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5b4fc7" }} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread detail */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Thread header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #eeece8", background: "white" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 740, color: "#1a1714", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.q}</div>
              <span style={{ fontSize: 10.5, fontWeight: 720, padding: "3px 9px", borderRadius: 999, color: meta.typeColor, background: `${meta.typeColor}15`, textTransform: "uppercase", letterSpacing: ".04em", flexShrink: 0 }}>{meta.type}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#928b80", fontWeight: 520, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: "#f3f1ee", color: "#5e5850", fontWeight: 620 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.senderColor }} />{cur.sender}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: "#f3f1ee", color: "#5e5850", fontWeight: 620 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#5b4fc7" }} />BuiltCRM team
              </span>
            </div>
          </div>

          {/* Message scroll */}
          <div style={{ padding: "22px 26px", background: "#faf9f7", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ alignSelf: "center", fontSize: 10.5, fontWeight: 620, color: "#928b80", textTransform: "uppercase", letterSpacing: ".06em", padding: "3px 10px", background: "white", border: "1px solid #eeece8", borderRadius: 999 }}>{meta.date}</div>

            {/* Incoming */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: "85%" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: meta.senderColor, color: "white", display: "grid", placeItems: "center", fontFamily: F.display, fontSize: 12, fontWeight: 720, flexShrink: 0 }}>{cur.sender.charAt(0)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 620, color: "#5e5850", marginBottom: 4, paddingLeft: 2 }}>{cur.sender}</div>
                <div style={{ padding: "11px 15px", fontSize: 14, lineHeight: 1.55, background: "white", color: "#1a1714", border: "1px solid #eeece8", borderRadius: "14px 14px 14px 4px", fontWeight: 540 }}>{cur.q}</div>
                <div style={{ fontSize: 10.5, color: "#928b80", marginTop: 4, paddingLeft: 2, fontWeight: 520 }}>{meta.time}</div>
              </div>
            </div>

            {/* Outgoing */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexDirection: "row-reverse", maxWidth: "85%", alignSelf: "flex-end" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#2c2541,#5b4fc7)", color: "white", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <svg viewBox="0 0 80 80" width="16" height="16"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="4" opacity=".5" /><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="4" opacity=".75" /><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" /></svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 620, color: "#5e5850", marginBottom: 4, paddingRight: 2, textAlign: "right" }}>BuiltCRM team</div>
                <div style={{ padding: "11px 15px", fontSize: 14, lineHeight: 1.55, background: "#5b4fc7", color: "white", borderRadius: "14px 14px 4px 14px", fontWeight: 520 }}>{cur.a}</div>
                <div style={{ fontSize: 10.5, color: "#928b80", marginTop: 4, paddingRight: 2, fontWeight: 520, textAlign: "right" }}>
                  {(() => { const [h, rest] = meta.time.split(":"); const [mins, ap] = rest.split(" "); const nm = (parseInt(mins) + 2) % 60; return `${h}:${String(nm).padStart(2, "0")} ${ap}`; })()}
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div style={{ padding: "12px 18px", borderTop: "1px solid #eeece8", background: "white", display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #eeece8", background: "#faf9f7", color: "#928b80", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            </button>
            <div style={{ flex: 1, height: 36, border: "1px solid #eeece8", borderRadius: 10, background: "#faf9f7", padding: "0 14px", display: "flex", alignItems: "center", fontSize: 13, color: "#928b80", fontWeight: 520, fontFamily: F.body }}>Reply to this question…</div>
            <button type="button" style={{ height: 36, padding: "0 16px", borderRadius: 10, background: "#5b4fc7", color: "white", border: "none", fontSize: 13, fontWeight: 680, fontFamily: F.body, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              Send
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Product preview: mini contractor dashboard ─── */
function DashboardMock() {
  const navItems: [string, boolean][] = [["Dashboard", true], ["Projects", false], ["Billing", false], ["RFIs", false], ["Documents", false], ["Messages", false]];
  const kpis: [string, string, string][] = [
    ["Active projects", "12", "+2 this month"],
    ["Open RFIs", "8", "3 overdue"],
    ["Draws pending", "$284k", "Across 4 projects"],
    ["Compliance", "96%", "1 expiring soon"],
  ];
  const attention: [string, string, string, string][] = [
    ["RFI #0142 overdue", "Riverside Tower · Framing clarification", "Overdue", "#d04b3a"],
    ["Draw #08 ready to submit", "Harbor Lofts · $42,500 net", "Ready", "#2d8a5e"],
    ["Insurance expires in 5 days", "Ironwood Electrical · GL cert", "Warning", "#c17a1a"],
  ];
  const health: [string, number, string][] = [["Riverside Tower", 72, "#5b4fc7"], ["Harbor Lofts", 48, "#2d8a5e"], ["Aspen Ridge", 91, "#3178b9"], ["Birchwood Estate", 22, "#c17a1a"]];
  return (
    <div style={{ position: "absolute", top: 36, left: 0, right: 0, bottom: 0, display: "grid", gridTemplateColumns: "172px 1fr", background: "#faf9f7", fontSize: 11 }}>
      {/* Sidebar */}
      <div style={{ background: "#2c2541", color: "white", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 14px", borderBottom: "1px solid rgba(255,255,255,.08)", marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#5b4fc7,#7c6fe0)", display: "grid", placeItems: "center" }}>
            <svg viewBox="0 0 80 80" width="12" height="12"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="4" opacity=".5" /><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="4" opacity=".75" /><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" /></svg>
          </div>
          <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 780, letterSpacing: "-.02em" }}>BuiltCRM</div>
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", padding: "4px 8px 6px" }}>Workspace</div>
        {navItems.map(([l, active]) => (
          <div key={l} style={{ padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: active ? 680 : 560, color: active ? "white" : "rgba(255,255,255,.6)", background: active ? "rgba(91,79,199,.35)" : "transparent", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: active ? "#a89cf0" : "rgba(255,255,255,.3)" }} />{l}
          </div>
        ))}
      </div>
      {/* Main */}
      <div style={{ padding: "14px 18px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, letterSpacing: "-.02em", color: "#1a1714" }}>Dashboard</div>
            <div style={{ fontSize: 10, color: "#928b80", fontWeight: 520, marginTop: 1 }}>Summit Contracting · 12 active projects</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ width: 24, height: 22, borderRadius: 5, background: "white", border: "1px solid #eeece8" }} />
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#5b4fc7", color: "white", display: "grid", placeItems: "center", fontSize: 9, fontFamily: F.display, fontWeight: 720 }}>DR</div>
          </div>
        </div>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
          {kpis.map(([l, v, m], i) => (
            <div key={i} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 8.5, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 820, letterSpacing: "-.02em", color: "#1a1714", marginTop: 2 }}>{v}</div>
              <div style={{ fontSize: 8.5, color: "#5e5850", fontWeight: 520, marginTop: 1 }}>{m}</div>
            </div>
          ))}
        </div>
        {/* Main cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 8 }}>
          <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1a1714", fontFamily: F.display, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>Needs attention</span><span style={{ fontSize: 8.5, color: "#928b80", fontWeight: 520 }}>3 items</span>
            </div>
            {attention.map(([t, s, pill, pc], i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: i < 2 ? "1px solid #f3f1ee" : "none", alignItems: "flex-start" }}>
                <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: pc, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 680, color: "#1a1714", fontFamily: F.display, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
                  <div style={{ fontSize: 9, color: "#928b80", fontWeight: 520, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
                </div>
                <div style={{ fontSize: 8, fontWeight: 720, padding: "2px 6px", borderRadius: 4, color: pc, background: `${pc}15`, textTransform: "uppercase", letterSpacing: ".03em", flexShrink: 0 }}>{pill}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1a1714", fontFamily: F.display, marginBottom: 8 }}>Project health</div>
            {health.map(([n, p, c], i) => (
              <div key={i} style={{ marginBottom: i < 3 ? 8 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "#1a1714", fontWeight: 620, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{n}</span>
                  <span style={{ fontSize: 9, color: "#5e5850", fontFamily: F.display, fontWeight: 700 }}>{p}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "#f3f1ee", overflow: "hidden" }}>
                  <div style={{ width: `${p}%`, height: "100%", background: c, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Feature deep-dive row ─── */
function FeatureRow({ eyebrow, title, desc, bullets, mock, flip }: { eyebrow: string; title: string; desc: string; bullets: string[]; mock: ReactNode; flip: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
      <div style={{ order: flip ? 2 : 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b4fc7", marginBottom: 10 }}>{eyebrow}</div>
        <h3 style={{ fontFamily: F.display, fontSize: "clamp(24px,2.8vw,32px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.15, marginBottom: 14, color: "#1a1714" }}>{title}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5e5850", marginBottom: 22, fontWeight: 520 }}>{desc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bullets.map(b => (
            <div key={b} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, color: "#1a1714", fontWeight: 560 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#eeedfb", color: "#5b4fc7", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <span style={{ width: 11, height: 11, display: "block" }}>{CHK}</span>
              </span>{b}
            </div>
          ))}
        </div>
      </div>
      <div style={{ order: flip ? 1 : 2, background: "white", border: "1px solid #e5e2dc", borderRadius: 20, boxShadow: "0 12px 40px rgba(26,23,20,.08)", overflow: "hidden", aspectRatio: "4/3", position: "relative" }}>
        {mock}
      </div>
    </div>
  );
}

/* ─── Billing mock: G703 line items ─── */
function BillingMock() {
  const lines: [string, string, string, string][] = [
    ["Site prep & excavation", "$48,000", "100%", "$0"],
    ["Concrete foundation", "$92,500", "100%", "$0"],
    ["Framing & rough carpentry", "$184,200", "78%", "$40,524"],
    ["Mechanical rough-in", "$62,400", "45%", "$34,320"],
    ["Electrical rough-in", "$54,800", "40%", "$32,880"],
    ["Plumbing rough-in", "$38,600", "35%", "$25,090"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", display: "flex", flexDirection: "column", background: "#faf9f7" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Draw request #08</div>
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 800, color: "#1a1714", letterSpacing: "-.02em", marginTop: 2 }}>Harbor Lofts — G703</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 720, padding: "4px 10px", borderRadius: 999, color: "#c17a1a", background: "#fbf2e4", textTransform: "uppercase", letterSpacing: ".04em" }}>Draft</div>
      </div>
      <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, overflow: "hidden", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr .7fr 1fr", gap: 8, padding: "8px 12px", background: "#f5f4f1", borderBottom: "1px solid #eeece8", fontSize: 9, color: "#5e5850", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>
          <span>Description</span><span style={{ textAlign: "right" }}>Scheduled</span><span style={{ textAlign: "right" }}>%</span><span style={{ textAlign: "right" }}>Balance</span>
        </div>
        {lines.map(([d, s, pct, bal], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr .7fr 1fr", gap: 8, padding: "8px 12px", borderBottom: i < lines.length - 1 ? "1px solid #f5f4f1" : "none", fontSize: 11, alignItems: "center" }}>
            <span style={{ color: "#1a1714", fontWeight: 560, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d}</span>
            <span style={{ textAlign: "right", color: "#5e5850", fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{s}</span>
            <span style={{ textAlign: "right", color: "#5b4fc7", fontWeight: 700, fontFamily: F.display }}>{pct}</span>
            <span style={{ textAlign: "right", color: "#1a1714", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600 }}>{bal}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: "10px 14px", background: "white", border: "1px solid #eeece8", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Net this draw</div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em" }}>$132,814</div>
        </div>
        <div style={{ padding: "7px 14px", borderRadius: 8, background: "#5b4fc7", color: "white", fontSize: 11, fontWeight: 680, fontFamily: F.body }}>Submit draw</div>
      </div>
    </div>
  );
}

/* ─── RFI mock: threaded conversation ─── */
function RfiMock() {
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>RFI #0142</div>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: "#1a1714", letterSpacing: "-.02em", marginTop: 2 }}>Framing clarification — grid line C</div>
          <div style={{ fontSize: 10, color: "#5e5850", fontWeight: 520, marginTop: 3 }}>Riverside Tower · Assigned to Structural Eng.</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 720, padding: "4px 10px", borderRadius: 999, color: "#d04b3a", background: "#fbe9e6", textTransform: "uppercase", letterSpacing: ".04em" }}>Overdue</div>
      </div>
      <div style={{ flex: 1, background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#3d6b8e", color: "white", display: "grid", placeItems: "center", fontSize: 10, fontFamily: F.display, fontWeight: 720, flexShrink: 0 }}>MT</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 620, color: "#5e5850", marginBottom: 3 }}>Mike Torres · Field PM</div>
            <div style={{ padding: "8px 12px", fontSize: 11, lineHeight: 1.5, background: "#f5f4f1", color: "#1a1714", borderRadius: "10px 10px 10px 3px", fontWeight: 520 }}>Beam size at grid C-7 doesn&apos;t match plan set rev 3. Need confirmation before Friday pour — W14x22 or W14x30?</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: "row-reverse" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#5b4fc7", color: "white", display: "grid", placeItems: "center", fontSize: 10, fontFamily: F.display, fontWeight: 720, flexShrink: 0 }}>DR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 620, color: "#5e5850", marginBottom: 3, textAlign: "right" }}>David Reeve · PM</div>
            <div style={{ padding: "8px 12px", fontSize: 11, lineHeight: 1.5, background: "#5b4fc7", color: "white", borderRadius: "10px 10px 3px 10px", fontWeight: 520 }}>Forwarded to structural. Expecting response today. Holding pour just in case.</div>
          </div>
        </div>
        <div style={{ marginTop: "auto", padding: "8px 12px", background: "#faf9f7", border: "1px dashed #d1cdc5", borderRadius: 8, fontSize: 10, color: "#928b80", fontWeight: 520 }}>Waiting on Rivera Structural Engineering · 2d 4h</div>
      </div>
    </div>
  );
}

/* ─── Portal mock: client tiles ─── */
function PortalMock() {
  const tiles: [string, string, string, string][] = [
    ["Approvals", "3 pending", "#3178b9", "Change order #4"],
    ["Draws", "$284k total", "#5b4fc7", "Draw #08 ready"],
    ["Documents", "42 files", "#2d8a5e", "Updated 2h ago"],
    ["Progress", "Week 14", "#c17a1a", "7 new photos"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Client portal</div>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 800, color: "#1a1714", letterSpacing: "-.02em", marginTop: 2 }}>Harbor Lofts — Owner view</div>
        </div>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#3178b9", color: "white", display: "grid", placeItems: "center", fontSize: 9, fontFamily: F.display, fontWeight: 720 }}>SH</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
        {tiles.map(([l, v, c, sub], i) => (
          <div key={i} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: `${c}18`, color: c, display: "grid", placeItems: "center", marginBottom: 6 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />
              </div>
              <div style={{ fontSize: 9, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</div>
              <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 800, color: "#1a1714", letterSpacing: "-.015em", marginTop: 1 }}>{v}</div>
            </div>
            <div style={{ fontSize: 9.5, color: c, fontWeight: 680, marginTop: 6 }}>{sub} →</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Solutions: per-audience dashboard previews ─── */
function SolutionMock({ audience }: { audience: SolutionKey }) {
  if (audience === "gc") return <SolutionGC />;
  if (audience === "sub") return <SolutionSub />;
  if (audience === "commercial") return <SolutionCommercial />;
  return <SolutionResidential />;
}

function SolutionGC() {
  const kpis: [string, string][] = [["Active", "12"], ["RFIs", "8"], ["Draws", "$284k"], ["Comp.", "96%"]];
  const rows: [string, number, string][] = [["Riverside Tower", 72, "#5b4fc7"], ["Harbor Lofts", 48, "#2d8a5e"], ["Aspen Ridge", 91, "#3178b9"], ["Birchwood", 22, "#c17a1a"]];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Contractor</div>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em", marginTop: 1 }}>Dashboard</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
        {kpis.map(([l, v], i) => (
          <div key={i} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 8.5, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".03em" }}>{l}</div>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em", marginTop: 1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "12px 14px", flex: 1 }}>
        <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 720, color: "#1a1714", marginBottom: 10 }}>Project health</div>
        {rows.map(([n, p, c], i) => (
          <div key={i} style={{ marginBottom: i < rows.length - 1 ? 10 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, color: "#1a1714", fontWeight: 620 }}>{n}</span>
              <span style={{ fontSize: 10.5, color: "#5e5850", fontFamily: F.display, fontWeight: 720 }}>{p}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "#f3f1ee", overflow: "hidden" }}>
              <div style={{ width: `${p}%`, height: "100%", background: c, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolutionSub() {
  const tasks: [string, string, string][] = [
    ["Upload insurance cert", "Ironwood Electrical · Due today", "#d04b3a"],
    ["Respond to RFI #0142", "Riverside Tower · Grid C beam", "#c17a1a"],
    ["Submit draw backup", "Harbor Lofts · Photos needed", "#3d6b8e"],
    ["Sign updated scope", "Aspen Ridge · Electrical", "#2d8a5e"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Subcontractor</div>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em", marginTop: 1 }}>Today Board</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
        {[["4", "Tasks"], ["2", "RFIs"], ["1", "Alerts"]].map(([v, l], i) => (
          <div key={i} style={{ background: "white", border: "1px solid #eeece8", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, color: "#3d6b8e", letterSpacing: "-.02em" }}>{v}</div>
            <div style={{ fontSize: 8.5, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".03em" }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "10px 12px", flex: 1 }}>
        <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 720, color: "#1a1714", marginBottom: 6 }}>Attention list</div>
        {tasks.map(([t, s, c], i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: i < tasks.length - 1 ? "1px solid #f3f1ee" : "none", alignItems: "center" }}>
            <div style={{ width: 3, height: 20, borderRadius: 2, background: c, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 640, color: "#1a1714", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
              <div style={{ fontSize: 9, color: "#928b80", fontWeight: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolutionCommercial() {
  const approvals: [string, string, string][] = [
    ["Change order #4", "$18,420 · Structural", "Pending"],
    ["Procurement — HVAC", "$42,800 · Carrier spec", "Pending"],
    ["Substitution request", "Finish hardware", "Review"],
  ];
  const draws: [string, string, string][] = [["Draw #07", "$98,400", "Paid"], ["Draw #08", "$132,814", "Pending"]];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Commercial owner</div>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em", marginTop: 1 }}>Harbor Lofts</div>
      </div>
      <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1a1714", fontFamily: F.display, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <span>Approvals</span><span style={{ fontSize: 8.5, color: "#3178b9", fontWeight: 720 }}>3 waiting</span>
        </div>
        {approvals.map(([t, s, p], i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < approvals.length - 1 ? "1px solid #f3f1ee" : "none", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 640, color: "#1a1714", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
              <div style={{ fontSize: 8.5, color: "#928b80", fontWeight: 520 }}>{s}</div>
            </div>
            <div style={{ fontSize: 8, fontWeight: 720, padding: "2px 6px", borderRadius: 4, color: "#3178b9", background: "#e8f1fa", textTransform: "uppercase", letterSpacing: ".03em" }}>{p}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "10px 12px", flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1a1714", fontFamily: F.display, marginBottom: 6 }}>Draw ledger</div>
        {draws.map(([l, v, s], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < draws.length - 1 ? "1px solid #f3f1ee" : "none" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 640, color: "#1a1714" }}>{l}</div>
              <div style={{ fontSize: 8.5, color: "#928b80", fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
            </div>
            <div style={{ fontSize: 8, fontWeight: 720, padding: "2px 6px", borderRadius: 4, color: s === "Paid" ? "#2d8a5e" : "#c17a1a", background: s === "Paid" ? "#edf7f1" : "#fbf2e4", textTransform: "uppercase", letterSpacing: ".03em" }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolutionResidential() {
  const selections: [string, string, string][] = [
    ["Kitchen countertop", "Carrara Quartz", "$4,200 / $4,500"],
    ["Primary bath tile", "Chose yesterday", "$2,800 / $3,000"],
    ["Hardwood flooring", "Need to choose", "Allowance $8,500"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "16px 18px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#928b80", fontWeight: 620, textTransform: "uppercase", letterSpacing: ".04em" }}>Your home</div>
        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em", marginTop: 1 }}>Birchwood Estate</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <div style={{ background: "linear-gradient(135deg,#2a7f6f,#4fa697)", borderRadius: 10, padding: "10px 12px", color: "white" }}>
          <div style={{ fontSize: 8.5, fontWeight: 620, textTransform: "uppercase", letterSpacing: ".03em", opacity: .8 }}>Progress</div>
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 820, letterSpacing: "-.02em", marginTop: 2 }}>Week 14</div>
          <div style={{ fontSize: 9, fontWeight: 520, marginTop: 2, opacity: .85 }}>Framing complete</div>
        </div>
        <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 8.5, fontWeight: 620, textTransform: "uppercase", letterSpacing: ".03em", color: "#928b80" }}>Next payment</div>
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 820, color: "#1a1714", letterSpacing: "-.02em", marginTop: 2 }}>$42,500</div>
          <div style={{ fontSize: 9, fontWeight: 520, marginTop: 2, color: "#5e5850" }}>Milestone: drywall</div>
        </div>
      </div>
      <div style={{ background: "white", border: "1px solid #eeece8", borderRadius: 10, padding: "10px 12px", flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "#1a1714", fontFamily: F.display, marginBottom: 6 }}>Selections studio</div>
        {selections.map(([t, s, a], i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < selections.length - 1 ? "1px solid #f3f1ee" : "none", alignItems: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: i === 2 ? "#f3f1ee" : "#e6f5f1", border: i === 2 ? "1px dashed #d1cdc5" : "none", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 640, color: "#1a1714", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
              <div style={{ fontSize: 8.5, color: i === 2 ? "#c17a1a" : "#2a7f6f", fontWeight: 620 }}>{s}</div>
            </div>
            <div style={{ fontSize: 8.5, color: "#5e5850", fontFamily: "'JetBrains Mono',monospace", fontWeight: 560 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Resource thumbnails ─── */
function ResourceThumb({ idx, color }: { idx: number; color: string }) {
  const themes: ReactNode[] = [
    // 0: Why construction needs better software — connected nodes
    (
      <svg key="rt0" viewBox="0 0 200 113" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs><linearGradient id="rt0" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".18" /><stop offset="1" stopColor={color} stopOpacity=".04" /></linearGradient></defs>
        <rect width="200" height="113" fill="url(#rt0)" />
        <g stroke={color} strokeWidth="1.2" opacity=".45"><line x1="50" y1="35" x2="100" y2="56" /><line x1="100" y1="56" x2="150" y2="35" /><line x1="100" y1="56" x2="60" y2="80" /><line x1="100" y1="56" x2="140" y2="80" /></g>
        <g fill={color}><circle cx="50" cy="35" r="6" /><circle cx="150" cy="35" r="6" /><circle cx="100" cy="56" r="8" /><circle cx="60" cy="80" r="6" /><circle cx="140" cy="80" r="6" /></g>
      </svg>
    ),
    // 1: AIA billing guide — document rows
    (
      <svg key="rt1" viewBox="0 0 200 113" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs><linearGradient id="rt1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".18" /><stop offset="1" stopColor={color} stopOpacity=".04" /></linearGradient></defs>
        <rect width="200" height="113" fill="url(#rt1)" />
        <rect x="50" y="22" width="100" height="78" rx="6" fill="white" stroke={color} strokeOpacity=".3" />
        <rect x="58" y="32" width="54" height="6" rx="2" fill={color} fillOpacity=".7" />
        <rect x="58" y="44" width="84" height="3" rx="1.5" fill={color} fillOpacity=".25" />
        <rect x="58" y="52" width="84" height="3" rx="1.5" fill={color} fillOpacity=".25" />
        <rect x="58" y="60" width="68" height="3" rx="1.5" fill={color} fillOpacity=".25" />
        <rect x="58" y="72" width="84" height="16" rx="3" fill={color} fillOpacity=".12" />
        <text x="62" y="83" fontFamily="monospace" fontSize="6" fill={color} fontWeight="700">G702 / G703</text>
      </svg>
    ),
    // 2: Ridgeline case study — progress bar
    (
      <svg key="rt2" viewBox="0 0 200 113" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs><linearGradient id="rt2" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".2" /><stop offset="1" stopColor={color} stopOpacity=".05" /></linearGradient></defs>
        <rect width="200" height="113" fill="url(#rt2)" />
        <text x="40" y="48" fontFamily="DM Sans,sans-serif" fontSize="24" fontWeight="820" fill={color} letterSpacing="-1">18→7</text>
        <text x="40" y="62" fontFamily="sans-serif" fontSize="7" fill={color} fillOpacity=".7" fontWeight="600">DAYS TO PAYMENT</text>
        <rect x="40" y="76" width="120" height="6" rx="3" fill={color} fillOpacity=".15" />
        <rect x="40" y="76" width="46" height="6" rx="3" fill={color} />
        <circle cx="86" cy="79" r="4" fill="white" stroke={color} strokeWidth="1.5" />
      </svg>
    ),
    // 3: Selections — color swatches
    (
      <svg key="rt3" viewBox="0 0 200 113" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs><linearGradient id="rt3" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".18" /><stop offset="1" stopColor={color} stopOpacity=".04" /></linearGradient></defs>
        <rect width="200" height="113" fill="url(#rt3)" />
        <g><rect x="48" y="32" width="28" height="48" rx="4" fill="#e8dcc4" stroke={color} strokeOpacity=".3" />
          <rect x="80" y="32" width="28" height="48" rx="4" fill="#c8b89a" stroke={color} strokeOpacity=".3" />
          <rect x="112" y="32" width="28" height="48" rx="4" fill={color} fillOpacity=".6" stroke={color} />
          <rect x="144" y="32" width="28" height="48" rx="4" fill="#a89078" stroke={color} strokeOpacity=".3" /></g>
        <circle cx="126" cy="70" r="3" fill="white" stroke={color} strokeWidth="1.5" />
      </svg>
    ),
    // 4: Compliance — shield with check
    (
      <svg key="rt4" viewBox="0 0 200 113" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs><linearGradient id="rt4" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".2" /><stop offset="1" stopColor={color} stopOpacity=".04" /></linearGradient></defs>
        <rect width="200" height="113" fill="url(#rt4)" />
        <path d="M100 26 L130 36 L130 62 Q130 82 100 92 Q70 82 70 62 L70 36 Z" fill="white" stroke={color} strokeWidth="2" />
        <path d="M85 58 L96 68 L115 48" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    // 5: Apex — convergence arrows
    (
      <svg key="rt5" viewBox="0 0 200 113" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs><linearGradient id="rt5" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".2" /><stop offset="1" stopColor={color} stopOpacity=".04" /></linearGradient></defs>
        <rect width="200" height="113" fill="url(#rt5)" />
        <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M40 30 Q80 40 100 56" /><path d="M40 85 Q80 72 100 56" />
          <path d="M160 30 Q120 40 100 56" /><path d="M160 85 Q120 72 100 56" />
        </g>
        <circle cx="100" cy="56" r="10" fill={color} />
        <g fill={color} fillOpacity=".6"><circle cx="40" cy="30" r="4" /><circle cx="40" cy="85" r="4" /><circle cx="160" cy="30" r="4" /><circle cx="160" cy="85" r="4" /></g>
      </svg>
    ),
  ];
  return <div style={{ position: "absolute", inset: 0, background: `${color}0d` }}>{themes[idx] ?? themes[0]}</div>;
}
