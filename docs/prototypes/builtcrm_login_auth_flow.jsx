import { useState } from "react";

// ── Portal Accents ─────────────────────────────────────────────
const portalColors = {
  contractor: "#5b4fc7",
  subcontractor: "#3d6b8e",
  commercial: "#3178b9",
  residential: "#2a7f6f",
};

// ── Portal Icons (dual-tone, white on color) ──────────────────
const PortalIcons = {
  contractor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" fill="white" opacity=".2"/>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="white" strokeWidth="1.8"/>
      <path d="M9 2h6v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V2z" fill="white" opacity=".3" stroke="white" strokeWidth="1.8"/>
      <path d="M9 13l2 2 4-4" stroke="white" strokeWidth="2"/>
    </svg>
  ),
  subcontractor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" fill="white" opacity=".2"/>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="white" strokeWidth="1.8"/>
    </svg>
  ),
  commercial: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" fill="white" opacity=".15"/>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="white" strokeWidth="1.8"/>
    </svg>
  ),
};

// ── Data ───────────────────────────────────────────────────────
const portalOptions = [
  { key: "contractor", name: "Contractor Portal", desc: "Summit Contracting · 3 active projects", color: portalColors.contractor },
  { key: "subcontractor", name: "Subcontractor Portal", desc: "Northline Electrical · 2 assigned projects", color: portalColors.subcontractor },
  { key: "commercial", name: "Client Portal", desc: "Riverside Commercial Group · 1 project", color: portalColors.commercial },
];

const projectJumps = [
  { name: "Riverside Tower Fit-Out", role: "Contractor" },
  { name: "West End Medical", role: "Contractor" },
  { name: "Northline Office", role: "Subcontractor" },
];

// ── Icons ──────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.18 0-.36-.02-.53-.06a4.51 4.51 0 01-.04-.51c0-1.08.55-2.27 1.2-3.01.74-.85 2.04-1.56 3.04-1.61.04.18.06.36.06.54h-.002zM21.81 16.72c-.04.08-.7 2.42-2.32 4.79-.74 1.08-1.52 2.17-2.77 2.17s-1.77-.8-3.38-.8c-1.62 0-2.22.82-3.38.82s-1.87-.96-2.78-2.15c-2.08-2.68-3.67-7.6-1.53-10.92a5.27 5.27 0 014.43-2.68c1.18-.02 2.3.8 3.02.8s2.08-.99 3.5-.85c.6.02 2.27.24 3.35 1.81-.09.05-2 1.17-1.98 3.5.02 2.78 2.44 3.71 2.47 3.72l-.07-.21z" fill="currentColor"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M22 6L9 19l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LogoMark = ({ size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.3,
    background: "linear-gradient(135deg, #2c2541 0%, var(--ac) 100%)",
    display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden",
  }}>
    <svg viewBox="0 0 80 80" width={size * 0.7} height={size * 0.7}>
      <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5"/>
      <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75"/>
      <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95"/>
    </svg>
  </div>
);

// ── Component ──────────────────────────────────────────────────
export default function LoginAuthFlow() {
  const [screen, setScreen] = useState("login");
  const [dark, setDark] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState(null);

  const screens = [
    { id: "login", label: "Login" },
    { id: "forgot", label: "Forgot" },
    { id: "sent", label: "Email sent" },
    { id: "reset", label: "Reset" },
    { id: "portal", label: "Portal" },
  ];

  const Brand = () => (
    <div className="a-brand">
      <LogoMark size={40} />
      <span className="a-brand-name">BuiltCRM</span>
    </div>
  );

  return (
    <div className={`auth ${dark ? "dark" : ""}`}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.auth {
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;
  --t1:#111318;--t2:#4a4f5c;--t3:#7d8290;--ti:#faf9f7;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 10px 32px rgba(26,23,20,.08);--shri:0 0 0 3px rgba(91,79,199,.15);
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;--ds:350ms;
  font-family:var(--fb);color:var(--t1);
  -webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px;
  background:var(--s0);min-height:100vh;
}

.auth.dark {
  --s0:#0c0e14;--s1:#171a24;--s2:#1e2130;--s3:#2a2e3c;--s4:#3a3f52;
  --sh:#222536;--sa:#2a2e3c;
  --t1:#edeae5;--t2:#a8a39a;--t3:#6e6a62;--ti:#1a1714;
  --ac:#7b6ff0;--ac-h:#6e62e0;--ac-s:#252040;--ac-t:#a99ff8;--ac-m:#4a4578;
  --ok:#3da872;--ok-s:#162a1f;--ok-t:#5ec494;
  --wr:#d49530;--wr-s:#2a2010;--wr-t:#e8b44e;
  --dg:#e05252;--dg-s:#2c1414;--dg-t:#f28080;
  --in:#4a94d4;--in-s:#141f2c;--in-t:#6cb0ee;
  --shsm:0 1px 3px rgba(0,0,0,.25);--shmd:0 4px 16px rgba(0,0,0,.3);
  --shlg:0 10px 32px rgba(0,0,0,.35);--shri:0 0 0 3px rgba(123,111,240,.2);
}

/* ── Auth Page Layout ───────────────────────────── */
.a-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;position:relative}
.a-page::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(91,79,199,.04) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(61,107,142,.03) 0%,transparent 50%);pointer-events:none;z-index:0}

.auth.dark .a-page::before{background:radial-gradient(ellipse at 30% 20%,rgba(123,111,240,.06) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(74,148,212,.04) 0%,transparent 50%)}

/* ── Brand ──────────────────────────────────────── */
.a-brand{display:flex;align-items:center;gap:12px;margin-bottom:32px;position:relative;z-index:1}
.a-brand-name{font-family:var(--fd);font-size:22px;font-weight:780;letter-spacing:-.04em;color:var(--t1)}

/* ── Card ───────────────────────────────────────── */
.a-card{width:100%;max-width:420px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shlg);padding:36px 32px;position:relative;z-index:1;animation:a-up var(--ds) var(--e) both}
@keyframes a-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

.a-card h1{font-family:var(--fd);font-size:22px;font-weight:780;letter-spacing:-.03em;margin:0 0 6px;color:var(--t1)}
.a-card h2{font-family:var(--fd);font-size:18px;font-weight:740;letter-spacing:-.02em;margin:0 0 6px;color:var(--t1)}
.a-sub{font-family:var(--fb);font-size:14px;font-weight:520;color:var(--t2);margin-bottom:24px;line-height:1.5}

/* ── Fields ─────────────────────────────────────── */
.a-field{margin-bottom:16px}
.a-label{display:block;font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);margin-bottom:6px}
.a-input{width:100%;height:42px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 14px;font-family:var(--fb);font-size:14px;font-weight:520;color:var(--t1);background:var(--s1);outline:none;transition:all var(--df) var(--e)}
.a-input::placeholder{color:var(--t3)}
.a-input:focus{border-color:var(--ac);box-shadow:var(--shri)}
.a-field-hint{font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t2);margin-top:4px}
.a-field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.a-field-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.a-field-hdr .a-label{margin-bottom:0}
.a-field-link{font-family:var(--fd);font-size:13px;color:var(--ac-t);font-weight:640;cursor:pointer;background:none;border:none;padding:0;transition:color var(--df)}
.a-field-link:hover{text-decoration:underline}

/* ── Buttons ────────────────────────────────────── */
.a-btn{width:100%;height:44px;border-radius:var(--r-m);border:1px solid var(--ac);background:var(--ac);color:var(--ti);font-family:var(--fb);font-size:14px;font-weight:660;display:flex;align-items:center;justify-content:center;gap:8px;transition:all var(--df) var(--e);margin-top:8px;cursor:pointer}
.a-btn:hover{background:var(--ac-h)}
.a-btn.sec{background:var(--s1);color:var(--t1);border-color:var(--s3)}
.a-btn.sec:hover{background:var(--sh);border-color:var(--s4)}

/* ── Divider ────────────────────────────────────── */
.a-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--t3);font-size:12px;font-weight:540}
.a-divider::before,.a-divider::after{content:'';flex:1;height:1px;background:var(--s3)}

/* ── SSO Buttons ────────────────────────────────── */
.a-sso-row{display:flex;gap:10px;margin-bottom:8px}
.a-sso{flex:1;height:42px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:620;color:var(--t1);display:flex;align-items:center;justify-content:center;gap:8px;transition:all var(--df) var(--e);cursor:pointer}
.a-sso:hover{background:var(--sh);border-color:var(--s4)}
.a-sso svg{flex-shrink:0}

/* ── Checkbox ───────────────────────────────────── */
.a-check{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.a-check input[type="checkbox"]{width:16px;height:16px;border-radius:4px;accent-color:var(--ac)}
.a-check label{font-family:var(--fb);font-size:13px;color:var(--t2);font-weight:540;margin-bottom:0;cursor:pointer}

/* ── Footer ─────────────────────────────────────── */
.a-footer{text-align:center;margin-top:20px;font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t3);position:relative;z-index:1}
.a-footer a,.a-footer button{color:var(--ac-t);font-weight:660;background:none;border:none;cursor:pointer;font-family:var(--fb);font-size:13px;padding:0;text-decoration:none}
.a-footer a:hover,.a-footer button:hover{text-decoration:underline}
.a-footer strong{color:var(--t1);font-weight:660}

/* ── Success ────────────────────────────────────── */
.a-success-ico{width:56px;height:56px;border-radius:50%;background:var(--ok-s);color:var(--ok);display:grid;place-items:center;margin:0 auto 16px}

/* ── Back Link ──────────────────────────────────── */
.a-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--fd);font-size:13px;color:var(--t3);font-weight:640;margin-bottom:20px;cursor:pointer;transition:color var(--df) var(--e);background:none;border:none;padding:0}
.a-back:hover{color:var(--t1)}

/* ── Portal Selector ────────────────────────────── */
.a-portals{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.a-portal{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--s3);border-radius:var(--r-l);cursor:pointer;transition:all var(--df) var(--e);background:none;width:100%;text-align:left}
.a-portal:hover{border-color:var(--s4);background:var(--sh)}
.a-portal.sel{border-color:var(--ac);background:var(--ac-s);box-shadow:var(--shri)}
.a-portal-dot{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;color:white;font-family:var(--fd);font-size:12px;font-weight:780;flex-shrink:0}
.a-portal-info{flex:1;min-width:0}
.a-portal-name{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1)}
.a-portal-desc{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
.a-portal-arrow{color:var(--t3);font-family:var(--fd);font-size:16px;font-weight:520;flex-shrink:0;transition:transform var(--df) var(--e)}
.a-portal:hover .a-portal-arrow{transform:translateX(2px);color:var(--t2)}

/* ── Project Jump List ──────────────────────────── */
.a-pjump{display:flex;flex-direction:column;gap:6px;margin-top:16px}
.a-pjump-label{font-family:var(--fd);font-size:11px;font-weight:720;color:var(--t2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.a-pjump-item{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);font-family:var(--fb);font-size:13px;font-weight:580;color:var(--t1);cursor:pointer;transition:all var(--df) var(--e);background:none;width:100%;text-align:left}
.a-pjump-item:hover{border-color:var(--ac-m);background:var(--ac-s)}
.a-pjump-meta{font-family:var(--fd);font-size:11px;color:var(--t2);font-weight:640}

/* ── Inline resend ──────────────────────────────── */
.a-hint-row{margin-top:16px;font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t3);text-align:center}
.a-hint-row a{color:var(--ac-t);font-weight:640;text-decoration:none;cursor:pointer}
.a-hint-row a:hover{text-decoration:underline}

/* ── Demo Nav ───────────────────────────────────── */
.a-demo{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:4px;box-shadow:var(--shlg);z-index:100}
.a-demo-tab{height:34px;padding:0 14px;border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:660;color:var(--t2);display:inline-flex;align-items:center;white-space:nowrap;cursor:pointer;transition:all var(--df) var(--e);background:none;border:none}
.a-demo-tab:hover{color:var(--t1);background:var(--sh)}
.a-demo-tab.on{background:var(--ac);color:white}

/* ── Dark mode toggle ───────────────────────────── */
.a-dark-toggle{position:fixed;top:20px;right:20px;width:34px;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t3);display:grid;place-items:center;cursor:pointer;z-index:100;transition:all var(--df) var(--e)}
.a-dark-toggle:hover{border-color:var(--s4);color:var(--t2);background:var(--sh)}

/* ── Responsive ─────────────────────────────────── */
@media(max-width:500px){
  .a-card{padding:28px 20px}
  .a-sso-row{flex-direction:column}
  .a-field-row{grid-template-columns:1fr}
  .a-demo{gap:2px;padding:3px}
  .a-demo-tab{padding:0 10px;font-size:11px;height:30px}
}
      `}</style>

      {/* Dark mode toggle */}
      <button className="a-dark-toggle" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}>
        {dark
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        }
      </button>

      {/* Demo nav */}
      <div className="a-demo">
        {screens.map((s) => (
          <button key={s.id} className={`a-demo-tab ${screen === s.id ? "on" : ""}`} onClick={() => setScreen(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── SCREEN: LOGIN ─────────────────────── */}
      {screen === "login" && (
        <div className="a-page">
          <Brand />
          <div className="a-card">
            <h1>Welcome back</h1>
            <p className="a-sub">Sign in to your account to access your projects.</p>

            <div className="a-sso-row">
              <button className="a-sso"><GoogleIcon /> Google</button>
              <button className="a-sso"><AppleIcon /> Apple</button>
            </div>

            <div className="a-divider">or continue with email</div>

            <div className="a-field">
              <label className="a-label">Email address</label>
              <input className="a-input" type="email" placeholder="you@company.com" />
            </div>

            <div className="a-field">
              <div className="a-field-hdr">
                <label className="a-label">Password</label>
                <button className="a-field-link" onClick={() => setScreen("forgot")}>Forgot password?</button>
              </div>
              <input className="a-input" type="password" placeholder="Enter your password" />
            </div>

            <div className="a-check">
              <input type="checkbox" id="remember" defaultChecked />
              <label htmlFor="remember">Keep me signed in</label>
            </div>

            <button className="a-btn" onClick={() => setScreen("portal")}>Sign in</button>
          </div>

          <div className="a-footer">
            Have an invitation? <a href="#" onClick={(e) => { e.preventDefault(); }}>Accept invite instead</a>
          </div>
        </div>
      )}

      {/* ── SCREEN: FORGOT PASSWORD ───────────── */}
      {screen === "forgot" && (
        <div className="a-page">
          <Brand />
          <div className="a-card">
            <button className="a-back" onClick={() => setScreen("login")}>
              <ArrowLeftIcon /> Back to sign in
            </button>

            <h2>Reset your password</h2>
            <p className="a-sub">Enter the email address associated with your account and we'll send you a link to reset your password.</p>

            <div className="a-field">
              <label className="a-label">Email address</label>
              <input className="a-input" type="email" placeholder="you@company.com" />
            </div>

            <button className="a-btn" onClick={() => setScreen("sent")}>Send reset link</button>
          </div>
        </div>
      )}

      {/* ── SCREEN: EMAIL SENT ────────────────── */}
      {screen === "sent" && (
        <div className="a-page">
          <Brand />
          <div className="a-card" style={{ textAlign: "center" }}>
            <div className="a-success-ico"><CheckIcon /></div>

            <h2>Check your email</h2>
            <p className="a-sub">We've sent a password reset link to <strong style={{ color: "var(--t1)" }}>david@summitcontracting.com</strong>. It will expire in 60 minutes.</p>

            <button className="a-btn sec" onClick={() => setScreen("login")}>Back to sign in</button>

            <div className="a-hint-row">
              Didn't receive it? Check spam, or <a onClick={() => {}}>resend the link</a>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN: RESET PASSWORD ────────────── */}
      {screen === "reset" && (
        <div className="a-page">
          <Brand />
          <div className="a-card">
            <h2>Set a new password</h2>
            <p className="a-sub">Choose a new password for your account. Make it at least 8 characters.</p>

            <div className="a-field">
              <label className="a-label">New password</label>
              <input className="a-input" type="password" placeholder="At least 8 characters" />
            </div>

            <div className="a-field">
              <label className="a-label">Confirm password</label>
              <input className="a-input" type="password" placeholder="Enter it again" />
            </div>

            <button className="a-btn" onClick={() => setScreen("login")}>Update password</button>
          </div>
        </div>
      )}

      {/* ── SCREEN: PORTAL SELECTOR ───────────── */}
      {screen === "portal" && (
        <div className="a-page">
          <Brand />
          <div className="a-card">
            <h2>Where do you want to go?</h2>
            <p className="a-sub">You have access to multiple portals. Choose one to continue, or jump directly into a project.</p>

            <div className="a-portals">
              {portalOptions.map((p) => (
                <button key={p.key} className={`a-portal ${selectedPortal === p.key ? "sel" : ""}`} onClick={() => setSelectedPortal(selectedPortal === p.key ? null : p.key)}>
                  <div className="a-portal-dot" style={{ background: p.color }}>{PortalIcons[p.key]}</div>
                  <div className="a-portal-info">
                    <div className="a-portal-name">{p.name}</div>
                    <div className="a-portal-desc">{p.desc}</div>
                  </div>
                  <span className="a-portal-arrow">→</span>
                </button>
              ))}
            </div>

            <div className="a-pjump">
              <div className="a-pjump-label">Or jump to a project</div>
              {projectJumps.map((pj) => (
                <button key={pj.name} className="a-pjump-item">
                  <span>{pj.name}</span>
                  <span className="a-pjump-meta">{pj.role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="a-footer">
            Signed in as <strong>david@summitcontracting.com</strong> · <button onClick={() => setScreen("login")}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
