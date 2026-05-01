import { useState } from "react";

/*
 * STEP 65 COMPANION — PUBLIC PRIVACY PAGES (PAIRED PROTOTYPE)
 * ──────────────────────────────────────────────────────────
 * Phase 4+ · Phase 9-lite · Item 9-lite.1 #65 (companion)
 *
 * Two public, unauthenticated pages that surround the DSAR intake
 * already built in builtcrm_privacy_officer_law25_paired.jsx:
 *
 *   1. Privacy Policy
 *      Path: src/app/privacy/page.tsx   (no auth)
 *      Content: full Law 25 / PIPEDA / GDPR-aware privacy policy
 *      with sticky table of contents and a "Your rights" section
 *      that prominently links to /privacy/dsar.
 *
 *   2. Privacy Officer
 *      Path: src/app/privacy/officer/page.tsx   (no auth)
 *      Content: public listing of the designated Privacy Officer
 *      (required by Law 25 §3.1), mandate, contact, escalation
 *      to the Commission d'accès à l'information, and a DSAR CTA.
 *
 * Aesthetic: matches the marketing-site prototype
 * (builtcrm_marketing_website.jsx) — warm cream background,
 * DM Sans display + Instrument Sans body, #2c2541 dark purple
 * brand. NOT the portal palette. These pages share the marketing
 * nav and footer.
 *
 * The DSAR intake page (View 02 of the Step 65 paired prototype)
 * should be reskinned to match this same aesthetic when wired.
 */

// ── Type defs / dummy data ────────────────────────────────────
const TOC = [
  { id: "who", n: "1", t: "Who we are" },
  { id: "what", n: "2", t: "Information we collect" },
  { id: "how", n: "3", t: "How we use information" },
  { id: "legal", n: "4", t: "Legal bases" },
  { id: "share", n: "5", t: "Who we share with" },
  { id: "intl", n: "6", t: "International transfers" },
  { id: "retain", n: "7", t: "Data retention" },
  { id: "rights", n: "8", t: "Your privacy rights", emph: true },
  { id: "cookies", n: "9", t: "Cookies & tracking" },
  { id: "children", n: "10", t: "Children's privacy" },
  { id: "security", n: "11", t: "Security" },
  { id: "changes", n: "12", t: "Changes to this policy" },
  { id: "contact", n: "13", t: "Contact us" },
];

const SUB_PROCESSORS = [
  { name: "Amazon Web Services", purpose: "Hosting, storage, compute", region: "ca-central-1 (Montréal)" },
  { name: "Stripe", purpose: "Payment processing", region: "United States" },
  { name: "Postmark", purpose: "Transactional email", region: "United States" },
  { name: "Sentry", purpose: "Error monitoring", region: "United States" },
  { name: "Trigger.dev", purpose: "Background jobs", region: "United States" },
  { name: "Cloudflare", purpose: "CDN & DDoS protection", region: "Global edge" },
];

const officer = {
  name: "Marielle Tremblay",
  role: "VP Operations · Designated Privacy Officer",
  email: "privacy@builtcrm.ca",
  phone: "+1 (514) 555-0148",
  designatedAt: "January 14, 2026",
  postal: "1250 René-Lévesque Blvd W, Suite 2200, Montréal, QC H3B 4W8",
  responseSla: "30 days",
};

// ── Component ─────────────────────────────────────────────────
export default function PrivacyPagesPaired() {
  const [view, setView] = useState("policy"); // policy | officer
  const [activeSection, setActiveSection] = useState("who");

  // Smooth-scroll TOC click
  const goSection = (id) => {
    setActiveSection(id);
    if (typeof document !== "undefined") {
      const el = document.getElementById(`s-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="pp">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

.pp{
  --bg:#faf9f7;--bg-2:#f3efea;--ln:#eeece8;--ln-2:#e3dfd8;
  --t1:#1a1714;--t2:#5a5249;--t3:#8b837a;--t-i:#faf9f7;
  --br:#2c2541;--br-2:#3a3158;--ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:20px;
  --sh-sm:0 1px 3px rgba(26,23,20,.05);--sh-md:0 8px 28px rgba(26,23,20,.07);
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:240ms;
  font-family:var(--fb);background:var(--bg);color:var(--t1);min-height:100vh;
  -webkit-font-smoothing:antialiased;line-height:1.6;font-size:15px;
}
.pp *{box-sizing:border-box;}
.pp a{color:var(--ac-t);text-decoration:none;border-bottom:1px solid transparent;transition:border-color var(--df) var(--e);}
.pp a:hover{border-bottom-color:var(--ac);}

/* ── Top harness (prototype-only view switcher) ── */
.pp-harness{
  display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:10px 18px;background:#fff;border-bottom:1px solid var(--ln);
  position:sticky;top:0;z-index:120;
}
.pp-harness-meta{display:flex;align-items:center;gap:12px;}
.pp-harness-meta .step{font-family:var(--fd);font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);}
.pp-harness-meta .name{font-family:var(--fd);font-size:14px;font-weight:680;color:var(--t1);letter-spacing:-.01em;}
.pp-harness-tabs{display:flex;gap:4px;background:var(--bg-2);padding:3px;border-radius:var(--r-m);}
.pp-harness-tab{
  font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t2);
  padding:7px 14px;border-radius:7px;cursor:pointer;border:none;background:transparent;
  display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);
}
.pp-harness-tab:hover{color:var(--t1);}
.pp-harness-tab.active{background:#fff;color:var(--t1);box-shadow:var(--sh-sm);}
.pp-harness-tab .num{font-family:var(--fm);font-size:10px;color:var(--t3);font-weight:500;}
.pp-harness-tab.active .num{color:var(--ac);}

/* ── Marketing nav (sticky) ── */
.mk-nav{
  position:sticky;top:53px;z-index:100;background:rgba(250,249,247,.85);
  backdropFilter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid var(--ln);
}
.mk-nav-inner{
  max-width:1200px;margin:0 auto;height:64px;padding:0 32px;
  display:flex;align-items:center;justify-content:space-between;gap:32px;
}
.mk-brand{display:flex;align-items:center;gap:10px;cursor:pointer;}
.mk-mark{
  width:34px;height:34px;border-radius:10px;
  background:linear-gradient(135deg,#2c2541,#5b4fc7);color:#fff;
  display:grid;place-items:center;font-family:var(--fd);font-size:13px;font-weight:700;
}
.mk-brand-name{font-family:var(--fd);font-size:19px;font-weight:780;letter-spacing:-.04em;color:var(--t1);}
.mk-nav-links{display:flex;gap:32px;}
.mk-nav-link{font-family:var(--fb);font-size:14px;font-weight:540;color:var(--t2);cursor:pointer;}
.mk-nav-link:hover{color:var(--t1);}
.mk-nav-cta{display:flex;align-items:center;gap:14px;}
.mk-cta-ghost{font-family:var(--fd);font-size:13.5px;font-weight:600;color:var(--t1);cursor:pointer;background:none;border:none;padding:8px 4px;}
.mk-cta-pr{
  font-family:var(--fd);font-size:13.5px;font-weight:620;color:#fff;
  background:var(--br);border:none;padding:9px 18px;border-radius:var(--r-s);cursor:pointer;
  transition:background var(--df) var(--e);
}
.mk-cta-pr:hover{background:var(--ac);}

/* ── Privacy sub-nav (under main nav) ── */
.pn{
  background:#fff;border-bottom:1px solid var(--ln);
}
.pn-inner{
  max-width:1200px;margin:0 auto;padding:0 32px;
  display:flex;align-items:center;justify-content:space-between;gap:24px;height:54px;
}
.pn-trail{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t3);}
.pn-trail .sep{color:var(--ln-2);}
.pn-trail .cur{color:var(--t1);font-weight:580;}
.pn-tabs{display:flex;gap:6px;}
.pn-tab{
  font-family:var(--fd);font-size:13px;font-weight:600;color:var(--t2);
  padding:7px 14px;border-radius:999px;background:transparent;border:1px solid transparent;
  cursor:pointer;transition:all var(--df) var(--e);
}
.pn-tab:hover{background:var(--bg-2);color:var(--t1);}
.pn-tab.cur{background:var(--ac-s);color:var(--ac-t);border-color:#d4cef0;}
.pn-tab.cta{
  background:var(--br);color:#fff;border-color:var(--br);
  display:inline-flex;align-items:center;gap:5px;
}
.pn-tab.cta:hover{background:var(--ac);border-color:var(--ac);}

/* ── Hero ── */
.hero{
  background:linear-gradient(180deg,#fff 0%,var(--bg) 100%);
  border-bottom:1px solid var(--ln);
  padding:60px 32px 50px;
}
.hero-inner{max-width:1200px;margin:0 auto;}
.hero-eyebrow{
  display:inline-flex;align-items:center;gap:7px;
  font-family:var(--fd);font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:var(--ac-t);background:var(--ac-s);padding:5px 12px;border-radius:999px;margin-bottom:18px;
}
.hero h1{
  font-family:var(--fd);font-size:48px;font-weight:820;letter-spacing:-.035em;line-height:1.05;
  color:var(--t1);margin:0 0 16px;max-width:760px;
}
.hero p{font-size:18px;line-height:1.55;color:var(--t2);max-width:680px;margin:0;}
.hero-meta{
  display:flex;gap:24px;margin-top:28px;font-size:13px;color:var(--t3);flex-wrap:wrap;
}
.hero-meta span{display:inline-flex;align-items:center;gap:6px;}

/* ── Layout: TOC + content ── */
.layout{max-width:1200px;margin:0 auto;padding:48px 32px 80px;display:grid;grid-template-columns:240px 1fr;gap:64px;}
@media (max-width:920px){.layout{grid-template-columns:1fr;gap:32px;padding:32px 24px 60px;}}

.toc{position:sticky;top:140px;align-self:start;}
@media (max-width:920px){.toc{position:static;}}
.toc-title{
  font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--t3);margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--ln);
}
.toc-list{display:flex;flex-direction:column;gap:2px;}
.toc-item{
  display:flex;align-items:flex-start;gap:10px;padding:7px 0;cursor:pointer;
  font-size:13.5px;font-weight:520;color:var(--t2);transition:color var(--df) var(--e);
  border-left:2px solid transparent;padding-left:12px;margin-left:-12px;
}
.toc-item:hover{color:var(--t1);}
.toc-item.cur{color:var(--ac-t);font-weight:640;border-left-color:var(--ac);}
.toc-item .n{font-family:var(--fm);font-size:11.5px;color:var(--t3);min-width:18px;}
.toc-item.cur .n{color:var(--ac-t);}
.toc-item.emph .label{color:var(--ac-t);font-weight:640;}

.toc-cta{
  margin-top:22px;background:linear-gradient(160deg,var(--br),var(--ac));
  color:#fff;padding:18px;border-radius:var(--r-l);
}
.toc-cta .ti{font-family:var(--fd);font-size:14px;font-weight:740;margin-bottom:6px;letter-spacing:-.005em;}
.toc-cta p{font-size:12.5px;line-height:1.55;color:rgba(250,249,247,.78);margin:0 0 14px;}
.toc-cta button{
  background:#fff;color:var(--t1);font-family:var(--fd);font-size:12.5px;font-weight:680;
  border:none;padding:8px 14px;border-radius:var(--r-s);cursor:pointer;width:100%;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  transition:all var(--df) var(--e);
}
.toc-cta button:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.18);}

/* ── Content ── */
.body section{margin-bottom:44px;scroll-margin-top:140px;}
.body section:last-child{margin-bottom:0;}
.body h2{
  font-family:var(--fd);font-size:24px;font-weight:780;letter-spacing:-.022em;line-height:1.2;
  color:var(--t1);margin:0 0 14px;display:flex;align-items:baseline;gap:14px;
}
.body h2 .n{
  font-family:var(--fm);font-size:14px;color:var(--t3);font-weight:500;letter-spacing:0;
  display:inline-block;min-width:32px;
}
.body h3{
  font-family:var(--fd);font-size:16px;font-weight:700;letter-spacing:-.012em;
  color:var(--t1);margin:24px 0 10px;
}
.body p{font-size:15px;line-height:1.7;color:var(--t2);margin:0 0 14px;}
.body p:last-child{margin-bottom:0;}
.body ul,.body ol{margin:0 0 14px;padding-left:22px;}
.body li{font-size:15px;line-height:1.7;color:var(--t2);margin-bottom:6px;}
.body li::marker{color:var(--t3);}
.body strong{color:var(--t1);font-weight:680;}
.body em{font-style:italic;color:var(--t2);}

/* Callouts */
.callout{
  display:flex;gap:14px;padding:16px 18px;border-radius:var(--r-l);
  margin:18px 0;background:var(--bg-2);border:1px solid var(--ln);
}
.callout.info{background:var(--in-s);border-color:#cfe1f3;}
.callout.action{background:var(--ac-s);border-color:#d4cef0;}
.callout .ic{flex-shrink:0;margin-top:2px;color:var(--t2);}
.callout.info .ic{color:var(--in-t);}
.callout.action .ic{color:var(--ac-t);}
.callout .body-c{font-size:14px;line-height:1.6;color:var(--t1);}
.callout.info .body-c{color:var(--in-t);}
.callout.action .body-c{color:var(--ac-t);}
.callout .body-c strong{color:inherit;}
.callout .body-c .lnk{display:inline-flex;align-items:center;gap:4px;font-family:var(--fd);font-weight:640;margin-top:6px;}

/* Subprocessor table */
.sp-table{
  width:100%;border-collapse:collapse;background:#fff;
  border:1px solid var(--ln);border-radius:var(--r-l);overflow:hidden;margin:14px 0;
}
.sp-table th{
  text-align:left;font-family:var(--fd);font-size:11.5px;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;color:var(--t3);
  padding:12px 18px;background:var(--bg-2);border-bottom:1px solid var(--ln);
}
.sp-table td{padding:14px 18px;font-size:13.5px;color:var(--t2);border-bottom:1px solid var(--ln);}
.sp-table tr:last-child td{border-bottom:none;}
.sp-table td:first-child{font-family:var(--fd);font-weight:640;color:var(--t1);}

/* Rights cards */
.rights-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:18px 0;}
@media (max-width:680px){.rights-grid{grid-template-columns:1fr;}}
.right-card{
  background:#fff;border:1px solid var(--ln);border-radius:var(--r-l);
  padding:18px;transition:all var(--df) var(--e);
}
.right-card:hover{border-color:var(--ln-2);box-shadow:var(--sh-sm);}
.right-card .ti{font-family:var(--fd);font-size:14.5px;font-weight:700;color:var(--t1);margin-bottom:6px;letter-spacing:-.005em;}
.right-card .desc{font-size:13.5px;line-height:1.55;color:var(--t2);}

.dsar-banner{
  background:linear-gradient(160deg,var(--br) 0%,var(--ac) 100%);color:#fff;
  border-radius:var(--r-xl);padding:32px;margin:28px 0;
  display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;
}
@media (max-width:680px){.dsar-banner{grid-template-columns:1fr;}}
.dsar-banner h3{font-family:var(--fd);font-size:22px;font-weight:780;color:#fff;margin:0 0 8px;letter-spacing:-.018em;}
.dsar-banner p{font-size:14.5px;line-height:1.55;color:rgba(250,249,247,.82);margin:0;}
.dsar-banner button{
  background:#fff;color:var(--t1);font-family:var(--fd);font-size:14px;font-weight:680;
  border:none;padding:12px 22px;border-radius:var(--r-s);cursor:pointer;
  display:inline-flex;align-items:center;gap:7px;white-space:nowrap;
  transition:all var(--df) var(--e);
}
.dsar-banner button:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.18);}

/* Cookie types */
.cookie-types{display:flex;flex-direction:column;gap:12px;margin:14px 0;}
.cookie-row{
  display:grid;grid-template-columns:140px 1fr;gap:18px;
  padding:14px 18px;background:#fff;border:1px solid var(--ln);border-radius:var(--r-l);
}
@media (max-width:540px){.cookie-row{grid-template-columns:1fr;gap:6px;}}
.cookie-row .nm{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);}
.cookie-row .desc{font-size:13.5px;line-height:1.55;color:var(--t2);}
.cookie-row .nm .req-tag{
  display:inline-block;font-family:var(--fd);font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  background:var(--bg-2);color:var(--t3);padding:2px 7px;border-radius:999px;margin-top:4px;
}

/* ── Officer page ── */
.of-hero{
  background:linear-gradient(160deg,#fff 0%,var(--bg) 100%);
  border-bottom:1px solid var(--ln);padding:60px 32px;
}
.of-hero-inner{max-width:1080px;margin:0 auto;}
.of-card{
  background:#fff;border:1px solid var(--ln);border-radius:var(--r-xl);
  padding:36px;display:grid;grid-template-columns:auto 1fr;gap:32px;align-items:start;
  box-shadow:var(--sh-md);margin-top:32px;
}
@media (max-width:680px){.of-card{grid-template-columns:1fr;gap:20px;padding:26px;}}
.of-avt{
  width:96px;height:96px;border-radius:50%;
  background:linear-gradient(135deg,var(--br),var(--ac));color:#fff;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--fd);font-size:32px;font-weight:740;letter-spacing:-.02em;flex-shrink:0;
}
.of-info .role-tag{
  display:inline-flex;align-items:center;gap:6px;
  font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  background:var(--ac-s);color:var(--ac-t);padding:4px 10px;border-radius:999px;margin-bottom:12px;
}
.of-info h1{font-family:var(--fd);font-size:32px;font-weight:780;letter-spacing:-.025em;color:var(--t1);margin:0 0 6px;line-height:1.15;}
.of-info .role{font-family:var(--fd);font-size:16px;font-weight:560;color:var(--t2);margin:0 0 22px;}
.of-contact{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
@media (max-width:540px){.of-contact{grid-template-columns:1fr;}}
.of-c-row{
  background:var(--bg-2);border-radius:var(--r-m);padding:12px 14px;
  display:flex;flex-direction:column;gap:3px;
}
.of-c-row .lbl{font-family:var(--fd);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);}
.of-c-row .val{font-size:14px;color:var(--t1);font-weight:540;}
.of-c-row .val.mono{font-family:var(--fm);font-size:13px;}

/* Officer body */
.of-body{max-width:1080px;margin:0 auto;padding:48px 32px 80px;}
.of-section{margin-bottom:42px;}
.of-section h2{font-family:var(--fd);font-size:22px;font-weight:760;letter-spacing:-.02em;color:var(--t1);margin:0 0 14px;}
.of-section p{font-size:15px;line-height:1.7;color:var(--t2);margin:0 0 12px;}
.mandate-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
@media (max-width:680px){.mandate-grid{grid-template-columns:1fr;}}
.mandate-card{
  background:#fff;border:1px solid var(--ln);border-radius:var(--r-l);padding:20px;
  transition:all var(--df) var(--e);
}
.mandate-card:hover{border-color:var(--ln-2);box-shadow:var(--sh-sm);}
.mandate-card .ic{
  width:36px;height:36px;border-radius:var(--r-s);background:var(--ac-s);color:var(--ac-t);
  display:flex;align-items:center;justify-content:center;margin-bottom:12px;
}
.mandate-card .ti{font-family:var(--fd);font-size:14.5px;font-weight:720;color:var(--t1);margin-bottom:6px;letter-spacing:-.005em;}
.mandate-card .desc{font-size:13.5px;line-height:1.55;color:var(--t2);}

.escalation{
  background:var(--in-s);border:1px solid #cfe1f3;border-radius:var(--r-l);padding:24px;
  display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;
}
@media (max-width:680px){.escalation{grid-template-columns:1fr;text-align:center;}}
.escalation .ic{
  width:48px;height:48px;border-radius:50%;background:#fff;color:var(--in-t);
  display:flex;align-items:center;justify-content:center;
}
.escalation .body-e .ti{font-family:var(--fd);font-size:16px;font-weight:720;color:var(--in-t);margin-bottom:4px;letter-spacing:-.01em;}
.escalation .body-e p{font-size:13.5px;line-height:1.55;color:var(--in-t);margin:0;opacity:.92;}
.escalation .body-e a{color:var(--in-t);font-weight:640;}
.escalation button{
  background:#fff;color:var(--in-t);font-family:var(--fd);font-size:13px;font-weight:660;
  border:1px solid #cfe1f3;padding:9px 16px;border-radius:var(--r-s);cursor:pointer;white-space:nowrap;
  display:inline-flex;align-items:center;gap:5px;transition:all var(--df) var(--e);
}
.escalation button:hover{background:var(--in);color:#fff;border-color:var(--in);}

/* ── Footer (matches marketing site) ── */
.mk-footer{
  background:var(--br);color:rgba(250,249,247,.7);padding:72px 32px 36px;
}
.mk-footer-inner{max-width:1200px;margin:0 auto;}
.mk-footer-grid{
  display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:64px;margin-bottom:56px;
}
@media (max-width:920px){.mk-footer-grid{grid-template-columns:1fr 1fr;gap:36px;}}
.mk-footer-blurb{font-size:13.5px;line-height:1.65;max-width:260px;color:rgba(250,249,247,.5);}
.mk-footer-col h4{
  font-family:var(--fd);font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:rgba(250,249,247,.3);margin:0 0 20px;
}
.mk-footer-link{font-size:13.5px;color:rgba(250,249,247,.6);font-weight:480;margin-bottom:12px;cursor:pointer;}
.mk-footer-link:hover{color:rgba(250,249,247,.9);}
.mk-footer-link.cur{color:#fff;font-weight:560;}
.mk-footer-bar{
  height:1px;background:rgba(250,249,247,.08);margin-bottom:24px;
}
.mk-footer-bottom{
  display:flex;justify-content:space-between;align-items:center;
  font-size:12.5px;color:rgba(250,249,247,.35);
}
.mk-footer-bottom .links{display:flex;gap:20px;}
.mk-footer-bottom .links span{cursor:pointer;}
.mk-footer-bottom .links span:hover{color:rgba(250,249,247,.7);}

/* utility */
.icon-arr{display:inline-block;vertical-align:-2px;}
      `}</style>

      {/* ─────────────────────────────────────────────
          Top harness — view switcher
          ───────────────────────────────────────────── */}
      <div className="pp-harness">
        <div className="pp-harness-meta">
          <span className="step">Step 65 · Companion · 9-lite.1 #65</span>
          <span className="name">Public Privacy Pages</span>
        </div>
        <div className="pp-harness-tabs">
          <button className={`pp-harness-tab ${view === "policy" ? "active" : ""}`} onClick={() => setView("policy")}>
            <span className="num">01</span> Privacy Policy
          </button>
          <button className={`pp-harness-tab ${view === "officer" ? "active" : ""}`} onClick={() => setView("officer")}>
            <span className="num">02</span> Privacy Officer
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          Marketing-site nav
          ───────────────────────────────────────────── */}
      <nav className="mk-nav">
        <div className="mk-nav-inner">
          <div className="mk-brand">
            <div className="mk-mark">B</div>
            <div className="mk-brand-name">BuiltCRM</div>
          </div>
          <div className="mk-nav-links">
            <span className="mk-nav-link">Product</span>
            <span className="mk-nav-link">Solutions</span>
            <span className="mk-nav-link">Pricing</span>
            <span className="mk-nav-link">Resources</span>
            <span className="mk-nav-link">Company</span>
          </div>
          <div className="mk-nav-cta">
            <button className="mk-cta-ghost">Sign in</button>
            <button className="mk-cta-pr">Start free trial</button>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────
          Privacy sub-nav
          ───────────────────────────────────────────── */}
      <div className="pn">
        <div className="pn-inner">
          <div className="pn-trail">
            <span>Company</span>
            <span className="sep">/</span>
            <span className="cur">{view === "policy" ? "Privacy Policy" : "Privacy Officer"}</span>
          </div>
          <div className="pn-tabs">
            <button className={`pn-tab ${view === "policy" ? "cur" : ""}`} onClick={() => setView("policy")}>Privacy Policy</button>
            <button className={`pn-tab ${view === "officer" ? "cur" : ""}`} onClick={() => setView("officer")}>Privacy Officer</button>
            <button className="pn-tab cta">
              Submit a privacy request
              <svg className="icon-arr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          VIEW 01 · PRIVACY POLICY
          ═══════════════════════════════════════════════ */}
      {view === "policy" && (
        <>
          <div className="hero">
            <div className="hero-inner">
              <span className="hero-eyebrow">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Privacy Policy
              </span>
              <h1>How we handle your data</h1>
              <p>
                BuiltCRM is built on a foundation of trust with the contractors, subcontractors,
                clients, and homeowners who use it. This policy explains what we collect, why we
                collect it, who we share it with, and the rights you have to control it.
              </p>
              <div className="hero-meta">
                <span><strong style={{ color: "var(--t2)" }}>Last updated:</strong>&nbsp;April 28, 2026</span>
                <span><strong style={{ color: "var(--t2)" }}>Effective:</strong>&nbsp;May 1, 2026</span>
                <span><strong style={{ color: "var(--t2)" }}>Version:</strong>&nbsp;3.2</span>
              </div>
            </div>
          </div>

          <div className="layout">
            {/* TOC */}
            <aside className="toc">
              <div className="toc-title">On this page</div>
              <div className="toc-list">
                {TOC.map((s) => (
                  <div
                    key={s.id}
                    className={`toc-item ${activeSection === s.id ? "cur" : ""} ${s.emph ? "emph" : ""}`}
                    onClick={() => goSection(s.id)}
                  >
                    <span className="n">{s.n}</span>
                    <span className="label">{s.t}</span>
                  </div>
                ))}
              </div>

              <div className="toc-cta">
                <div className="ti">Submit a privacy request</div>
                <p>Access, correct, or delete your data — we respond within 30 days.</p>
                <button>
                  Open the request form
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              </div>
            </aside>

            {/* Body */}
            <div className="body">
              <section id="s-who">
                <h2><span className="n">1</span><span>Who we are</span></h2>
                <p>
                  <strong>BuiltCRM Inc.</strong> ("we", "us", "our") is a Canadian software-as-a-service company
                  headquartered in Montréal, Quebec. We provide construction project management software to
                  general contractors, subcontractors, commercial property owners, and homeowners.
                </p>
                <p>
                  We are the <strong>data controller</strong> for personal information collected directly through
                  our website, marketing channels, and the BuiltCRM application when you use it as an
                  individual or in connection with your own organization.
                </p>
                <p>
                  When a contractor organization invites you (as a subcontractor user, a client, or a team
                  member of another organization) to collaborate on their project, that contractor is the
                  <strong> data controller</strong> for the project data; BuiltCRM acts as a <strong>data processor</strong>
                  on their behalf, processing data only on their documented instructions.
                </p>
              </section>

              <section id="s-what">
                <h2><span className="n">2</span><span>Information we collect</span></h2>
                <h3>Information you provide directly</h3>
                <ul>
                  <li><strong>Account information:</strong> name, email address, password (hashed), organization name, role, profile picture, phone number.</li>
                  <li><strong>Billing information:</strong> payment-method tokens via our payment processor (we never see your full card number), billing address, tax identifiers where required.</li>
                  <li><strong>Project content:</strong> documents, photos, RFIs, change orders, messages, draws, selections, schedules, and other project artifacts you create or upload.</li>
                  <li><strong>Communications:</strong> content of support tickets, in-app messages, and survey responses.</li>
                </ul>
                <h3>Information collected automatically</h3>
                <ul>
                  <li><strong>Usage data:</strong> pages visited, features used, session timestamps, referring URL, click patterns, error logs.</li>
                  <li><strong>Device data:</strong> IP address (truncated for analytics), browser type, operating system, device identifiers, language preference.</li>
                  <li><strong>Cookies and similar technologies:</strong> as described in section 9.</li>
                </ul>
                <h3>Information from third parties</h3>
                <ul>
                  <li>If you sign in via SSO (Google, Microsoft, SAML), we receive your name, email, and profile photo from the identity provider.</li>
                  <li>If your organization connects an integration (e.g., QuickBooks, Stripe), we receive the data scoped by the integration grant.</li>
                </ul>
              </section>

              <section id="s-how">
                <h2><span className="n">3</span><span>How we use information</span></h2>
                <ul>
                  <li><strong>Provide the service:</strong> authenticate you, render your projects, send transactional emails, deliver in-app notifications.</li>
                  <li><strong>Improve the service:</strong> analyze aggregated usage to find friction, prioritize features, and fix bugs.</li>
                  <li><strong>Secure the service:</strong> detect abuse, prevent fraud, investigate incidents, and protect users.</li>
                  <li><strong>Communicate with you:</strong> respond to inquiries, send service updates, and (only with your consent) send product news and offers.</li>
                  <li><strong>Comply with the law:</strong> respond to lawful requests, enforce our terms, and meet regulatory obligations.</li>
                </ul>
                <p>
                  We do not sell personal information. We do not use your project content to train machine
                  learning models, except where you have explicitly opted in to features that depend on it
                  (e.g., the Meeting Minutes assistant).
                </p>
              </section>

              <section id="s-legal">
                <h2><span className="n">4</span><span>Legal bases</span></h2>
                <p>
                  Where Quebec's <em>Act respecting the protection of personal information in the private
                  sector</em> (Law 25), Canada's <em>PIPEDA</em>, or the EU/UK <em>GDPR</em> applies, we rely on
                  the following legal bases for processing:
                </p>
                <ul>
                  <li><strong>Performance of a contract</strong> — to deliver the service you've signed up for.</li>
                  <li><strong>Legitimate interests</strong> — to secure, improve, and operate the service, where these interests are not overridden by your rights.</li>
                  <li><strong>Consent</strong> — for marketing communications, optional analytics, and certain cookies.</li>
                  <li><strong>Legal obligation</strong> — to retain financial records, respond to lawful requests, and meet tax/audit requirements.</li>
                </ul>
                <p>You can withdraw consent at any time without affecting the lawfulness of prior processing.</p>
              </section>

              <section id="s-share">
                <h2><span className="n">5</span><span>Who we share with</span></h2>
                <p>We share personal information only with the categories of recipients below.</p>
                <h3>Other users in your organization or project</h3>
                <p>
                  When you create or modify content in BuiltCRM, other authorized users in your project see
                  it according to their role. Contractors decide what subcontractors and clients can access.
                </p>
                <h3>Sub-processors</h3>
                <p>
                  We use a small number of carefully vetted sub-processors to operate the service. Each is
                  bound by a written data-processing agreement consistent with this policy.
                </p>
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th>Sub-processor</th>
                      <th>Purpose</th>
                      <th>Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUB_PROCESSORS.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>{s.purpose}</td>
                        <td>{s.region}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 13, color: "var(--t3)" }}>
                  An up-to-date list is available on request from the Privacy Officer. Material changes
                  are announced 30 days in advance.
                </p>
                <h3>Other recipients</h3>
                <ul>
                  <li><strong>Professional advisors</strong> — auditors, accountants, lawyers, under confidentiality.</li>
                  <li><strong>Successors</strong> — in a merger, acquisition, or asset sale, with prior notice.</li>
                  <li><strong>Authorities</strong> — when legally required, and only to the minimum extent.</li>
                </ul>
              </section>

              <section id="s-intl">
                <h2><span className="n">6</span><span>International transfers</span></h2>
                <p>
                  Production data is stored in Canada (AWS <span style={{ fontFamily: "var(--fm)", fontSize: 13.5 }}>ca-central-1</span>, Montréal).
                  Some of our sub-processors are located in the United States, the United Kingdom, or the
                  European Economic Area. When data leaves Canada, we apply appropriate safeguards,
                  including Standard Contractual Clauses where applicable and supplementary technical
                  measures (encryption in transit and at rest).
                </p>
                <p>
                  Quebec residents: under Law 25, we conduct a privacy-impact assessment before any new
                  cross-border transfer of personal information. A summary of the latest PIA is available
                  on request to the Privacy Officer.
                </p>
              </section>

              <section id="s-retain">
                <h2><span className="n">7</span><span>Data retention</span></h2>
                <p>We retain personal information only as long as needed for the purposes described in this policy.</p>
                <ul>
                  <li><strong>Active account data:</strong> retained while your account is active.</li>
                  <li><strong>Project content:</strong> retained while the host organization's account is active, plus an additional 30 days after archive or termination, then deleted (subject to legal hold).</li>
                  <li><strong>Billing records:</strong> retained for 7 years for Canadian tax-compliance reasons.</li>
                  <li><strong>Backup data:</strong> rolling 30-day window; deletions are propagated as backups expire.</li>
                  <li><strong>Marketing data:</strong> retained until you unsubscribe or 24 months of inactivity, whichever is first.</li>
                  <li><strong>DSAR records:</strong> closed requests retained for 90 days for audit purposes, then minimized.</li>
                </ul>
              </section>

              <section id="s-rights">
                <h2><span className="n">8</span><span>Your privacy rights</span></h2>
                <p>
                  You have the rights described below. To exercise any of them, you can submit a request
                  through our intake form (no account required) or by contacting our Privacy Officer
                  directly. We respond within <strong>30 days</strong>; complex requests can be extended once
                  by 30 days with notice.
                </p>

                <div className="rights-grid">
                  <div className="right-card">
                    <div className="ti">Access</div>
                    <div className="desc">Receive a copy of the personal data we hold about you, in a readable format.</div>
                  </div>
                  <div className="right-card">
                    <div className="ti">Rectification</div>
                    <div className="desc">Correct inaccurate, incomplete, or outdated personal data we hold about you.</div>
                  </div>
                  <div className="right-card">
                    <div className="ti">Deletion</div>
                    <div className="desc">Have your personal data deleted, subject to legal retention requirements.</div>
                  </div>
                  <div className="right-card">
                    <div className="ti">Portability</div>
                    <div className="desc">Receive a structured, machine-readable export of your data, suitable for transfer.</div>
                  </div>
                  <div className="right-card">
                    <div className="ti">Withdrawal of consent</div>
                    <div className="desc">Withdraw consent for any optional processing (marketing, analytics, third-party sharing) at any time.</div>
                  </div>
                  <div className="right-card">
                    <div className="ti">Cessation of dissemination</div>
                    <div className="desc">Quebec Law 25: have personal information about you de-indexed or hidden where the conditions of §28.1 are met.</div>
                  </div>
                </div>

                <div className="dsar-banner">
                  <div>
                    <h3>Submit a privacy request</h3>
                    <p>Open the secure intake form. No account required. We respond within 30 days.</p>
                  </div>
                  <button>
                    Open the request form
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>

                <div className="callout info">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div className="body-c">
                    <strong>Project data is your contractor's responsibility.</strong> If your request concerns project content created by a contractor who invited you (drawings, photos, messages, financial records), we'll forward your request to them within 5 business days, since they are the controller of that data. We'll keep you informed.
                  </div>
                </div>

                <p>
                  If you're unsatisfied with our response, you can lodge a complaint with the
                  <strong> Commission d'accès à l'information du Québec</strong> (CAI) or the Office of the
                  Privacy Commissioner of Canada (OPC). Contact details are on our
                  <a href="#"> Privacy Officer page</a>.
                </p>
              </section>

              <section id="s-cookies">
                <h2><span className="n">9</span><span>Cookies &amp; tracking</span></h2>
                <p>
                  We use a minimal set of cookies and similar technologies. You can control non-essential
                  cookies through our cookie banner or by visiting your browser settings.
                </p>
                <div className="cookie-types">
                  <div className="cookie-row">
                    <div className="nm">Essential<div className="req-tag">Required</div></div>
                    <div className="desc">Authentication, session management, CSRF protection, and load balancing. The service won't work without them.</div>
                  </div>
                  <div className="cookie-row">
                    <div className="nm">Preferences</div>
                    <div className="desc">Remember your theme (light/dark), sidebar collapse state, and language.</div>
                  </div>
                  <div className="cookie-row">
                    <div className="nm">Analytics</div>
                    <div className="desc">Anonymous, aggregated product usage analytics that help us improve the experience. You can opt out at any time.</div>
                  </div>
                </div>
                <p style={{ fontSize: 13.5 }}>
                  We do not use cookies for cross-site advertising. We do not embed third-party social
                  buttons that load before consent.
                </p>
              </section>

              <section id="s-children">
                <h2><span className="n">10</span><span>Children's privacy</span></h2>
                <p>
                  BuiltCRM is not directed at children under 14 (the age of digital consent in Quebec)
                  and we do not knowingly collect personal information from them. If you believe we have
                  inadvertently collected data about a child, please contact our Privacy Officer and we
                  will delete it.
                </p>
              </section>

              <section id="s-security">
                <h2><span className="n">11</span><span>Security</span></h2>
                <p>We protect personal information with administrative, technical, and physical safeguards.</p>
                <ul>
                  <li>Encryption in transit (TLS 1.3) and at rest (AES-256).</li>
                  <li>Row-level multi-tenant isolation; no shared production keys between organizations.</li>
                  <li>Multi-factor authentication available to all users; required for org admins.</li>
                  <li>Least-privilege access controls and quarterly access reviews.</li>
                  <li>Annual third-party penetration testing.</li>
                  <li>Incident response plan with breach notification within 72 hours where required.</li>
                </ul>
                <p style={{ fontSize: 13.5, color: "var(--t3)" }}>
                  No system is perfectly secure. If you believe your account has been compromised,
                  contact our Privacy Officer immediately.
                </p>
              </section>

              <section id="s-changes">
                <h2><span className="n">12</span><span>Changes to this policy</span></h2>
                <p>
                  We may update this policy from time to time. The "Last updated" date at the top tells
                  you when. Material changes (those that meaningfully affect your rights) will be
                  announced by email and in-product notice at least <strong>30 days</strong> before they take
                  effect, and we'll keep an archive of prior versions on request.
                </p>
              </section>

              <section id="s-contact">
                <h2><span className="n">13</span><span>Contact us</span></h2>
                <p>For privacy questions, requests, or complaints, contact our designated Privacy Officer.</p>
                <div className="callout action">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div className="body-c">
                    <strong>{officer.name}</strong> · {officer.role}<br/>
                    <span style={{ fontFamily: "var(--fm)", fontSize: 13.5 }}>{officer.email}</span> · {officer.phone}<br/>
                    <span style={{ fontSize: 13, color: "var(--ac-t)", opacity: .85 }}>{officer.postal}</span>
                    <div className="lnk" onClick={() => setView("officer")} style={{ cursor: "pointer" }}>
                      View Privacy Officer page
                      <svg className="icon-arr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
          VIEW 02 · PRIVACY OFFICER
          ═══════════════════════════════════════════════ */}
      {view === "officer" && (
        <>
          <div className="of-hero">
            <div className="of-hero-inner">
              <span className="hero-eyebrow">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Designated Privacy Officer · Quebec Law 25 §3.1
              </span>
              <h1 style={{ fontFamily: "var(--fd)", fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.1, margin: "12px 0 14px", maxWidth: 760 }}>
                Meet the person responsible for privacy at BuiltCRM
              </h1>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--t2)", maxWidth: 640, margin: 0 }}>
                Quebec's Law 25 requires every organization to designate a Privacy Officer accountable
                for the protection of personal information. Here's ours, and how to reach them.
              </p>

              <div className="of-card">
                <div className="of-avt">MT</div>
                <div className="of-info">
                  <span className="role-tag">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Active &amp; reachable
                  </span>
                  <h1>{officer.name}</h1>
                  <p className="role">{officer.role}</p>

                  <div className="of-contact">
                    <div className="of-c-row">
                      <div className="lbl">Email</div>
                      <div className="val mono">{officer.email}</div>
                    </div>
                    <div className="of-c-row">
                      <div className="lbl">Phone</div>
                      <div className="val">{officer.phone}</div>
                    </div>
                    <div className="of-c-row">
                      <div className="lbl">Postal address</div>
                      <div className="val" style={{ fontSize: 13 }}>{officer.postal}</div>
                    </div>
                    <div className="of-c-row">
                      <div className="lbl">Response time</div>
                      <div className="val">Within {officer.responseSla}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 22, fontSize: 13, color: "var(--t3)" }}>
                    Designated {officer.designatedAt} · Listed publicly under Law 25 §3.1
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="of-body">
            {/* Mandate */}
            <div className="of-section">
              <h2>What the Privacy Officer does</h2>
              <p>
                The Privacy Officer is internally accountable for our compliance with Quebec's Law 25
                and analogous Canadian and international regimes. Their responsibilities include:
              </p>
              <div className="mandate-grid">
                <div className="mandate-card">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
                  </div>
                  <div className="ti">Handles your privacy requests</div>
                  <div className="desc">Reviews and responds to all access, deletion, rectification, and portability requests within 30 days.</div>
                </div>
                <div className="mandate-card">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div className="ti">Maintains the consent register</div>
                  <div className="desc">Tracks every consent given and revoked across the platform, with a complete audit trail.</div>
                </div>
                <div className="mandate-card">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
                  </div>
                  <div className="ti">Logs and responds to incidents</div>
                  <div className="desc">Maintains the breach register, coordinates containment, notifies affected users, and reports to the CAI when required.</div>
                </div>
                <div className="mandate-card">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div className="ti">Conducts privacy-impact assessments</div>
                  <div className="desc">Reviews new features, integrations, and cross-border transfers before they ship, per Law 25 §3.3.</div>
                </div>
                <div className="mandate-card">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <div className="ti">Trains the team</div>
                  <div className="desc">Runs annual privacy training for all employees and contractors with access to personal information.</div>
                </div>
                <div className="mandate-card">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                  </div>
                  <div className="ti">Publishes our privacy policy</div>
                  <div className="desc">Keeps this site, our policy, and our subprocessor list current. Announces material changes 30 days in advance.</div>
                </div>
              </div>
            </div>

            {/* DSAR CTA */}
            <div className="of-section">
              <h2>Have a privacy request?</h2>
              <p>
                The fastest way to reach our Privacy Officer with a formal request is the secure intake
                form. You don't need a BuiltCRM account, and you'll receive a confirmation with a
                reference number within five minutes.
              </p>
              <div className="dsar-banner">
                <div>
                  <h3>Submit a privacy request</h3>
                  <p>Access · Rectification · Deletion · Portability · Withdrawal of consent</p>
                </div>
                <button>
                  Open the request form
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              </div>
            </div>

            {/* Direct contact */}
            <div className="of-section">
              <h2>Prefer email or phone?</h2>
              <p>
                You can also reach <strong>{officer.name}</strong> directly. Please include enough detail to
                identify yourself and your request — we may need to verify your identity before sharing
                personal information.
              </p>
              <div className="rights-grid">
                <div className="right-card">
                  <div className="ti">Email</div>
                  <div className="desc" style={{ fontFamily: "var(--fm)", fontSize: 14, color: "var(--ac-t)" }}>{officer.email}</div>
                </div>
                <div className="right-card">
                  <div className="ti">Phone</div>
                  <div className="desc" style={{ fontSize: 14 }}>{officer.phone}</div>
                </div>
                <div className="right-card">
                  <div className="ti">Postal mail</div>
                  <div className="desc" style={{ fontSize: 13.5 }}>{officer.postal}</div>
                </div>
                <div className="right-card">
                  <div className="ti">In-product</div>
                  <div className="desc">Logged-in users can manage consent and submit requests directly from <strong>Settings &rarr; Privacy &amp; consents</strong>.</div>
                </div>
              </div>
            </div>

            {/* Escalation */}
            <div className="of-section">
              <h2>Not satisfied with our response?</h2>
              <p>
                You always have the right to escalate. Quebec residents can file a complaint with the
                <strong> Commission d'accès à l'information du Québec</strong> at any time, with or without
                first contacting us. Residents elsewhere in Canada can contact the
                <strong> Office of the Privacy Commissioner of Canada</strong>.
              </p>
              <div className="escalation">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                </div>
                <div className="body-e">
                  <div className="ti">Commission d'accès à l'information du Québec</div>
                  <p>
                    525, boulevard René-Lévesque Est, Suite 2.36, Québec G1R 5S9 ·
                    <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer"> cai.gouv.qc.ca</a>
                  </p>
                </div>
                <button>
                  File a complaint
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
              </div>
            </div>

            {/* Designation history */}
            <div className="of-section">
              <h2>Designation history</h2>
              <p>For transparency, we publish the designation history of this role.</p>
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Privacy Officer</th>
                    <th>Designated by</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Jan 2026 – present</td>
                    <td>{officer.name}, VP Operations</td>
                    <td>Board resolution 2026-01-14</td>
                  </tr>
                  <tr>
                    <td>Jul 2024 – Jan 2026</td>
                    <td>Daniel Pearson, Co-founder &amp; CEO</td>
                    <td>Original designation at incorporation</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────
          Marketing footer
          ───────────────────────────────────────────── */}
      <footer className="mk-footer">
        <div className="mk-footer-inner">
          <div className="mk-footer-grid">
            <div>
              <div className="mk-mark" style={{ marginBottom: 14 }}>B</div>
              <p className="mk-footer-blurb">
                Construction project management built for the way real teams actually work.
              </p>
            </div>
            <div className="mk-footer-col">
              <h4>Product</h4>
              {["Features", "Pricing", "Integrations", "Changelog", "Roadmap"].map((l) => (
                <div className="mk-footer-link" key={l}>{l}</div>
              ))}
            </div>
            <div className="mk-footer-col">
              <h4>Solutions</h4>
              {["General Contractors", "Subcontractors", "Commercial Owners", "Homeowners"].map((l) => (
                <div className="mk-footer-link" key={l}>{l}</div>
              ))}
            </div>
            <div className="mk-footer-col">
              <h4>Company</h4>
              {["About", "Blog", "Careers", "Contact", "Security"].map((l) => (
                <div className="mk-footer-link" key={l}>{l}</div>
              ))}
            </div>
            <div className="mk-footer-col">
              <h4>Privacy</h4>
              <div className={`mk-footer-link ${view === "policy" ? "cur" : ""}`} onClick={() => setView("policy")}>Privacy Policy</div>
              <div className={`mk-footer-link ${view === "officer" ? "cur" : ""}`} onClick={() => setView("officer")}>Privacy Officer</div>
              <div className="mk-footer-link">Submit a request</div>
              <div className="mk-footer-link">Cookie preferences</div>
              <div className="mk-footer-link">Subprocessors</div>
            </div>
          </div>
          <div className="mk-footer-bar" />
          <div className="mk-footer-bottom">
            <span>&copy; 2026 BuiltCRM. All rights reserved.</span>
            <div className="links">
              <span onClick={() => setView("policy")}>Privacy</span>
              <span>Terms</span>
              <span>Security</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
