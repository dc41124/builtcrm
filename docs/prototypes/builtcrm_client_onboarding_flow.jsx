import { useState } from "react";

// ── Portal Accents ─────────────────────────────────────────────
const variants = {
  commercial: {
    accent: "#5b4fc7",
    accentHover: "#4f44b3",
    accentSoft: "#eeedfb",
    accentText: "#4a3fb0",
    gradStart: "#2c2541",
    ringAlpha: "rgba(91,79,199,.15)",
    label: "Commercial",
  },
  residential: {
    accent: "#2a7f6f",
    accentHover: "#1d6b5d",
    accentSoft: "#e6f5f2",
    accentText: "#1d6b5d",
    gradStart: "#1d6b5d",
    ringAlpha: "rgba(42,127,111,.15)",
    label: "Residential",
  },
};

const darkVariants = {
  commercial: {
    accent: "#7b6ff0",
    accentHover: "#6e62e0",
    accentSoft: "#252040",
    accentText: "#a99ff8",
    gradStart: "#1a1530",
    ringAlpha: "rgba(123,111,240,.2)",
  },
  residential: {
    accent: "#3da872",
    accentHover: "#2e9462",
    accentSoft: "#162a1f",
    accentText: "#5ec494",
    gradStart: "#132620",
    ringAlpha: "rgba(61,168,114,.2)",
  },
};

// ── Invitation Data ────────────────────────────────────────────
const inviteData = {
  commercial: {
    headline: "You've been invited to a project",
    sub: "Summit Contracting has invited you to collaborate on a construction project through BuiltCRM.",
    projectName: "Riverside Tower Fit-Out",
    projectDesc: "Commercial interior fit-out · Phase 3 in progress",
    meta: [
      { label: "Invited by", value: "Daniel Chen" },
      { label: "Your role", value: "Project Approver" },
    ],
    cta: "Accept invitation",
    signupTitle: "Create your account",
    signupSub: "Set up your account to access the Riverside Tower Fit-Out project.",
    firstName: "Rachel",
    lastName: "Greyson",
    email: "rachel@greysondevelopment.com",
    emailHint: "This is the email your invitation was sent to",
    hasCompanyField: true,
    companyPlaceholder: "Greyson Development",
    welcomeName: "Rachel",
    welcomeSub: "Here's what you can do on the Riverside Tower project.",
    features: [
      { icon: "approve", color: "purple", title: "Review and approve", desc: "Approve change orders, review billing draws, and sign off on project decisions." },
      { icon: "financial", color: "blue", title: "Track financials", desc: "See payment history, current draws, retainage, and your contract status at a glance." },
      { icon: "progress", color: "green", title: "Monitor progress", desc: "View milestones, progress photos, and project updates from your contractor." },
    ],
    waitingLabel: "Already waiting for you:",
    waitingItems: [
      { text: "CO-14 mechanical reroute", pill: "Needs approval", color: "amber" },
      { text: "Draw #7 progress billing", pill: "Ready for review", color: "blue" },
    ],
    goCta: "Go to your project",
  },
  residential: {
    headline: "Your home project is ready",
    sub: "Daniel Chen at Summit Contracting has set up a project portal for your home renovation.",
    projectName: "14 Maple Lane Renovation",
    projectDesc: "Full interior renovation · currently in framing phase",
    meta: [
      { label: "Your builder", value: "Daniel Chen, Summit Contracting" },
    ],
    cta: "Get started",
    signupTitle: "Set up your account",
    signupSub: "This will be your personal login to see updates, make selections, and stay connected with your builder.",
    firstName: "Jennifer",
    lastName: "Chen",
    email: "jennifer.chen@gmail.com",
    emailHint: "This is the email your builder sent the invitation to",
    hasCompanyField: false,
    welcomeName: "Jennifer",
    welcomeSub: "Here's what you can do from your project portal.",
    features: [
      { icon: "selections", color: "teal", title: "Choose your finishes", desc: "Browse curated options for flooring, paint, hardware, and more — then confirm your choices when you're ready." },
      { icon: "photos", color: "green", title: "See your home being built", desc: "Your builder will share progress photos and updates so you always know where things stand." },
      { icon: "messages", color: "amber", title: "Talk to your builder", desc: "Message your project team directly with questions, feedback, or ideas." },
    ],
    waitingLabel: "Ready for you now:",
    waitingItems: [
      { text: "3 finish selections to explore", pill: "Ready", color: "teal" },
      { text: "8 progress photos from this week", pill: "New", color: "teal" },
    ],
    goCta: "See your project",
  },
};

// ── Feature Icons ──────────────────────────────────────────────
const FeatureIcons = {
  approve: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-5" />
    </svg>
  ),
  financial: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" />
    </svg>
  ),
  progress: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
    </svg>
  ),
  selections: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    </svg>
  ),
  photos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
    </svg>
  ),
  messages: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
};

// ── Logo Mark (Option F — three overlapping rects) ─────────────
const LogoMark = ({ size = 36, gradStart }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.28,
    background: `linear-gradient(135deg, ${gradStart} 0%, var(--ob-ac) 100%)`,
    display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden",
  }}>
    <svg viewBox="0 0 80 80" width={size * 0.65} height={size * 0.65}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
    </svg>
  </div>
);

// ── Arrow Icon ─────────────────────────────────────────────────
const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
  </svg>
);

// ── Component ──────────────────────────────────────────────────
export default function ClientOnboardingFlow() {
  const [variant, setVariant] = useState("commercial");
  const [step, setStep] = useState("invite");
  const [dark, setDark] = useState(false);

  const v = dark ? { ...variants[variant], ...darkVariants[variant] } : variants[variant];
  const d = inviteData[variant];
  const isRes = variant === "residential";

  const steps = ["invite", "signup", "welcome"];
  const stepIndex = steps.indexOf(step);

  const demoVariants = [
    { id: "commercial", label: "Commercial" },
    { id: "residential", label: "Residential" },
  ];
  const demoSteps = [
    { id: "invite", label: "Invitation" },
    { id: "signup", label: "Create account" },
    { id: "welcome", label: "Welcome" },
  ];

  const Brand = () => (
    <div className="ob-brand">
      <LogoMark size={36} gradStart={v.gradStart} />
      <span className="ob-brand-name">BuiltCRM</span>
    </div>
  );

  const StepDots = () => (
    <div className="ob-steps">
      {steps.map((s, i) => (
        <div key={s} className={`ob-dot${i < stepIndex ? " done" : ""}${i === stepIndex ? " active" : ""}`} />
      ))}
    </div>
  );

  // ── Pill color mapping ──
  const pillColor = (c) => {
    const map = {
      amber: { bg: "var(--ob-wr-s)", color: "var(--ob-wr-t)" },
      blue: { bg: "var(--ob-in-s)", color: "var(--ob-in-t)" },
      teal: { bg: "var(--ob-ac-s)", color: "var(--ob-ac-t)" },
      red: { bg: "var(--ob-dg-s)", color: "var(--ob-dg-t)" },
    };
    // For residential teal pills, use the residential accent colors
    if (c === "teal" && isRes) return { bg: "var(--ob-ac-s)", color: "var(--ob-ac-t)" };
    return map[c] || map.blue;
  };

  // ── Feature icon color mapping ──
  const featureIconStyle = (color) => {
    const map = {
      purple: { bg: "var(--ob-ac-s)", color: "var(--ob-ac-t)" },
      teal: { bg: "var(--ob-ac-s)", color: "var(--ob-ac-t)" },
      blue: { bg: "var(--ob-in-s)", color: "var(--ob-in-t)" },
      green: { bg: "var(--ob-ok-s)", color: "var(--ob-ok-t)" },
      amber: { bg: "var(--ob-wr-s)", color: "var(--ob-wr-t)" },
    };
    return map[color] || map.blue;
  };

  return (
    <div className={`ob ${dark ? "dark" : ""}`} style={{
      "--ob-ac": v.accent,
      "--ob-ac-h": v.accentHover,
      "--ob-ac-s": v.accentSoft,
      "--ob-ac-t": v.accentText,
      "--ob-ring": v.ringAlpha,
    }}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.ob {
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--si:#f8f9fa;
  --t1:#111318;--t2:#4a4f5c;--t3:#7d8290;--ti:#faf9f7;
  --ob-ok:#2d8a5e;--ob-ok-s:#edf7f1;--ob-ok-t:#1e6b46;
  --ob-wr:#c17a1a;--ob-wr-s:#fdf4e6;--ob-wr-t:#96600f;
  --ob-dg:#c93b3b;--ob-dg-s:#fdeaea;--ob-dg-t:#a52e2e;
  --ob-in:#3178b9;--ob-in-s:#e8f1fa;--ob-in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;--r-2xl:24px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 10px 32px rgba(26,23,20,.08);
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);
  -webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);min-height:100vh;
}

.ob.dark {
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--si:#1e2130;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ob-ok:#3da872;--ob-ok-s:#162a1f;--ob-ok-t:#5ec494;
  --ob-wr:#d49530;--ob-wr-s:#2a2010;--ob-wr-t:#e8b44e;
  --ob-dg:#e05252;--ob-dg-s:#2c1414;--ob-dg-t:#f28080;
  --ob-in:#4a94d4;--ob-in-s:#141f2c;--ob-in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 10px 32px rgba(0,0,0,.35);
}

/* ── Page Layout ────────────────────────────── */
.ob-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;position:relative}
.ob-page::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0}
.ob-page::before{background:radial-gradient(ellipse at 30% 20%,color-mix(in srgb,var(--ob-ac) 4%,transparent) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(61,107,142,.03) 0%,transparent 50%)}
.ob.dark .ob-page::before{background:radial-gradient(ellipse at 30% 20%,color-mix(in srgb,var(--ob-ac) 6%,transparent) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(74,148,212,.04) 0%,transparent 50%)}

/* ── Brand ──────────────────────────────────── */
.ob-brand{display:flex;align-items:center;gap:12px;margin-bottom:32px;position:relative;z-index:1}
.ob-brand-name{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.04em;color:var(--t1)}

/* ── Card ───────────────────────────────────── */
.ob-card{width:100%;max-width:480px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-2xl);box-shadow:var(--shlg);overflow:hidden;position:relative;z-index:1;animation:ob-up var(--ds) var(--e) both}
@keyframes ob-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

/* ── Step Dots ──────────────────────────────── */
.ob-steps{display:flex;gap:8px;padding:20px 24px 0;justify-content:center}
.ob-dot{width:32px;height:4px;border-radius:2px;background:var(--s3);transition:background var(--dn) var(--e)}
.ob-dot.active{background:var(--ob-ac)}
.ob-dot.done{background:var(--s4)}

/* ── Body ───────────────────────────────────── */
.ob-body{padding:24px}
.ob-body h1{font-family:var(--fd);font-size:24px;font-weight:780;letter-spacing:-.03em;line-height:1.2;margin:0 0 6px;color:var(--t1)}
.ob-body h2{font-family:var(--fd);font-size:20px;font-weight:740;letter-spacing:-.02em;line-height:1.2;margin:0 0 6px;color:var(--t1)}
.ob-sub{font-family:var(--fb);font-size:14.5px;font-weight:520;color:var(--t2);line-height:1.5;margin-bottom:24px}

/* ── Project Context ────────────────────────── */
.ob-ctx{background:var(--si);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;margin-bottom:24px;transition:all var(--dn) var(--e)}
.ob-ctx.tinted{background:var(--ob-ac-s);border-color:color-mix(in srgb,var(--ob-ac) 20%,transparent)}
.ob-ctx-label{font-family:var(--fd);font-size:11px;font-weight:680;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.ob-ctx h3{font-family:var(--fd);font-size:16px;font-weight:700;letter-spacing:-.01em;color:var(--t1);margin:0}
.ob-ctx p{font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t2);margin-top:4px}
.ob-ctx-meta{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-family:var(--fb);font-size:12.5px;font-weight:520;color:var(--t2)}
.ob-ctx-meta strong{font-weight:640;color:var(--t1)}

/* ── Fields ─────────────────────────────────── */
.ob-field{margin-bottom:16px}
.ob-label{display:block;font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);margin-bottom:6px}
.ob-input{width:100%;height:42px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 14px;font-family:var(--fb);font-size:14px;font-weight:520;color:var(--t1);background:var(--s1);outline:none;transition:all var(--df) var(--e)}
.ob-input::placeholder{color:var(--t3)}
.ob-input:focus{border-color:var(--ob-ac);box-shadow:0 0 0 3px var(--ob-ring)}
.ob-input.ro{background:var(--si);color:var(--t2);cursor:default}
.ob-field-hint{font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t3);margin-top:4px}
.ob-field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* ── Buttons ────────────────────────────────── */
.ob-btn{width:100%;height:44px;border-radius:var(--r-m);border:1px solid var(--ob-ac);background:var(--ob-ac);color:#fff;font-family:var(--fb);font-size:14px;font-weight:660;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:all var(--df) var(--e)}
.ob-btn:hover{background:var(--ob-ac-h)}
.ob-btn.sec{background:var(--s1);color:var(--t1);border-color:var(--s3)}
.ob-btn.sec:hover{background:var(--sh);border-color:var(--s4)}

/* ── Divider ────────────────────────────────── */
.ob-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--t3);font-size:12px;font-weight:540}
.ob-divider::before,.ob-divider::after{content:'';flex:1;height:1px;background:var(--s3)}

/* ── Footer ─────────────────────────────────── */
.ob-footer{padding:0 24px 20px;font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t3);text-align:center}
.ob-footer a{color:var(--ob-ac-t);text-decoration:none;font-weight:640}
.ob-footer a:hover{text-decoration:underline}

/* ── Welcome Features ───────────────────────── */
.ob-features{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
.ob-feature{display:flex;align-items:flex-start;gap:12px;padding:10px;border-radius:var(--r-m);transition:background var(--df) var(--e)}
.ob-feature:hover{background:var(--sh)}
.ob-feat-icon{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0}
.ob-feat-title{font-family:var(--fd);font-size:14px;font-weight:660;letter-spacing:-.01em;margin-bottom:2px;color:var(--t1)}
.ob-feat-desc{font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t2);line-height:1.45}

/* ── Waiting Items ──────────────────────────── */
.ob-waiting{background:var(--si);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;margin-bottom:24px}
.ob-waiting.tinted{background:var(--ob-ac-s);border-color:color-mix(in srgb,var(--ob-ac) 15%,transparent)}
.ob-waiting h4{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);margin:0 0 10px}
.ob-wait-item{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--s3)}
.ob-waiting.tinted .ob-wait-item{border-color:color-mix(in srgb,var(--ob-ac) 12%,transparent)}
.ob-wait-item:last-child{border-bottom:none}
.ob-wait-text{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
.ob-pill{height:22px;padding:0 8px;border-radius:999px;font-family:var(--fd);font-size:11px;font-weight:680;display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}

/* ── Dark toggle ────────────────────────────── */
.ob-dark{position:fixed;top:20px;right:20px;width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;z-index:100;transition:all var(--df) var(--e)}
.ob-dark:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}

/* ── Demo Nav ───────────────────────────────── */
.ob-demo{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;z-index:100}
.ob-demo-group{display:flex;gap:4px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:4px;box-shadow:var(--shlg)}
.ob-demo-tab{height:34px;padding:0 14px;border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:660;color:var(--t2);display:inline-flex;align-items:center;white-space:nowrap;cursor:pointer;transition:all var(--df) var(--e);background:none;border:none}
.ob-demo-tab:hover{color:var(--t1);background:var(--sh)}
.ob-demo-tab.on{background:var(--ob-ac);color:white}

/* ── Responsive ─────────────────────────────── */
@media(max-width:540px){
  .ob-body{padding:20px}
  .ob-field-row{grid-template-columns:1fr}
  .ob-ctx-meta{flex-direction:column;gap:6px}
  .ob-demo{flex-direction:column;gap:8px;bottom:12px}
  .ob-demo-tab{padding:0 10px;font-size:11px;height:30px}
}
      `}</style>

      {/* Dark mode toggle */}
      <button className="ob-dark" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}>
        {dark
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        }
      </button>

      {/* Demo nav */}
      <div className="ob-demo">
        <div className="ob-demo-group">
          {demoVariants.map((dv) => (
            <button key={dv.id} className={`ob-demo-tab ${variant === dv.id ? "on" : ""}`} onClick={() => setVariant(dv.id)}>
              {dv.label}
            </button>
          ))}
        </div>
        <div className="ob-demo-group">
          {demoSteps.map((ds) => (
            <button key={ds.id} className={`ob-demo-tab ${step === ds.id ? "on" : ""}`} onClick={() => setStep(ds.id)}>
              {ds.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STEP 1: INVITATION ───────────────── */}
      {step === "invite" && (
        <div className="ob-page" key={`${variant}-invite`}>
          <Brand />
          <div className="ob-card">
            <StepDots />
            <div className="ob-body">
              <h1>{d.headline}</h1>
              <p className="ob-sub">{d.sub}</p>

              <div className={`ob-ctx${isRes ? " tinted" : ""}`}>
                <div className="ob-ctx-label">{isRes ? "Your project" : "Project"}</div>
                <h3>{d.projectName}</h3>
                <p>{d.projectDesc}</p>
                <div className="ob-ctx-meta">
                  {d.meta.map((m) => (
                    <span key={m.label}><strong>{m.label}:</strong> {m.value}</span>
                  ))}
                </div>
              </div>

              <button className="ob-btn" onClick={() => setStep("signup")}>{d.cta}</button>
              <div className="ob-divider">or</div>
              <button className="ob-btn sec">I already have an account — sign in</button>
            </div>
            <div className="ob-footer">
              By {isRes ? "continuing" : "accepting"}, you agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: ACCOUNT CREATION ─────────── */}
      {step === "signup" && (
        <div className="ob-page" key={`${variant}-signup`}>
          <Brand />
          <div className="ob-card">
            <StepDots />
            <div className="ob-body">
              <h2>{d.signupTitle}</h2>
              <p className="ob-sub">{d.signupSub}</p>

              <div className="ob-field-row">
                <div className="ob-field">
                  <label className="ob-label">First name</label>
                  <input className="ob-input" type="text" placeholder={d.firstName} />
                </div>
                <div className="ob-field">
                  <label className="ob-label">Last name</label>
                  <input className="ob-input" type="text" placeholder={d.lastName} />
                </div>
              </div>

              <div className="ob-field">
                <label className="ob-label">Email</label>
                <input className="ob-input ro" type="email" value={d.email} readOnly />
                <div className="ob-field-hint">{d.emailHint}</div>
              </div>

              <div className="ob-field">
                <label className="ob-label">{isRes ? "Create a password" : "Password"}</label>
                <input className="ob-input" type="password" placeholder={isRes ? "Choose something secure" : "Create a password"} />
              </div>

              {d.hasCompanyField && (
                <div className="ob-field">
                  <label className="ob-label">Company name (optional)</label>
                  <input className="ob-input" type="text" placeholder={d.companyPlaceholder} />
                </div>
              )}

              <button className="ob-btn" onClick={() => setStep("welcome")}>{isRes ? "Create my account" : "Create account"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: WELCOME ──────────────────── */}
      {step === "welcome" && (
        <div className="ob-page" key={`${variant}-welcome`}>
          <Brand />
          <div className="ob-card">
            <StepDots />
            <div className="ob-body">
              <h2>Welcome, {d.welcomeName}</h2>
              <p className="ob-sub">{d.welcomeSub}</p>

              <div className="ob-features">
                {d.features.map((f) => {
                  const ic = featureIconStyle(f.color);
                  return (
                    <div className="ob-feature" key={f.title}>
                      <div className="ob-feat-icon" style={{ background: ic.bg, color: ic.color }}>
                        {FeatureIcons[f.icon]}
                      </div>
                      <div>
                        <div className="ob-feat-title">{f.title}</div>
                        <div className="ob-feat-desc">{f.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`ob-waiting${isRes ? " tinted" : ""}`}>
                <h4>{d.waitingLabel}</h4>
                {d.waitingItems.map((w) => {
                  const pc = pillColor(w.color);
                  return (
                    <div className="ob-wait-item" key={w.text}>
                      <span className="ob-wait-text">{w.text}</span>
                      <span className="ob-pill" style={{ background: pc.bg, color: pc.color }}>{w.pill}</span>
                    </div>
                  );
                })}
              </div>

              <button className="ob-btn">
                {d.goCta} <ArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
