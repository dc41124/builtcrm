"use client";

// Step 65 Session A — Privacy Policy UI. Direct port of the policy view
// in `docs/prototypes/builtcrm_privacy_pages_paired.jsx` (View 01).
// Marketing aesthetic; no auth, no portal chrome. The "Open the request
// form" buttons all link to /privacy/dsar (lands in Session B).

import { useState } from "react";
import Link from "next/link";

import { PrivacyShell, PRIVACY_F } from "@/components/privacy/privacy-shell";
import {
  POLICY_VERSION,
  PUBLIC_PRIVACY_OFFICER,
  SUB_PROCESSORS,
} from "@/lib/privacy/public-content";

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
] as const;

const RIGHTS = [
  { ti: "Access", desc: "Receive a copy of the personal data we hold about you, in a readable format." },
  { ti: "Rectification", desc: "Correct inaccurate, incomplete, or outdated personal data we hold about you." },
  { ti: "Deletion", desc: "Have your personal data deleted, subject to legal retention requirements." },
  { ti: "Portability", desc: "Receive a structured, machine-readable export of your data, suitable for transfer." },
  { ti: "Withdrawal of consent", desc: "Withdraw consent for any optional processing (marketing, analytics, third-party sharing) at any time." },
  { ti: "Cessation of dissemination", desc: "Quebec Law 25: have personal information about you de-indexed or hidden where the conditions of §28.1 are met." },
];

const COOKIE_TYPES = [
  { nm: "Essential", req: true, desc: "Authentication, session management, CSRF protection, and load balancing. The service won't work without them." },
  { nm: "Preferences", req: false, desc: "Remember your sidebar collapse state, density, and language." },
  { nm: "Analytics", req: false, desc: "Anonymous, aggregated product usage analytics that help us improve the experience. You can opt out at any time." },
];

export function PrivacyPolicyUI() {
  const [active, setActive] = useState<string>("who");

  const goSection = (id: string) => {
    setActive(id);
    if (typeof document !== "undefined") {
      const el = document.getElementById(`s-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <PrivacyShell active="policy" breadcrumbLabel="Privacy Policy">
      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg,#fff 0%,#faf9f7 100%)", borderBottom: "1px solid #eeece8", padding: "60px 32px 50px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: PRIVACY_F.display,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".07em",
              textTransform: "uppercase",
              color: "#4a3fb0",
              background: "#eeedfb",
              padding: "5px 12px",
              borderRadius: 999,
              marginBottom: 18,
            }}
          >
            <ShieldIcon />
            Privacy Policy
          </span>
          <h1 style={{ fontFamily: PRIVACY_F.display, fontSize: 48, fontWeight: 820, letterSpacing: "-.035em", lineHeight: 1.05, color: "#1a1714", margin: "0 0 16px", maxWidth: 760 }}>
            How we handle your data
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: "#5a5249", maxWidth: 680, margin: 0 }}>
            BuiltCRM is built on a foundation of trust with the contractors, subcontractors, clients, and homeowners who use it. This policy explains what we collect, why we collect it, who we share it with, and the rights you have to control it.
          </p>
          <div style={{ display: "flex", gap: 24, marginTop: 28, fontSize: 13, color: "#8b837a", flexWrap: "wrap" }}>
            <span><strong style={{ color: "#5a5249" }}>Last updated:</strong>&nbsp;{POLICY_VERSION.lastUpdated}</span>
            <span><strong style={{ color: "#5a5249" }}>Effective:</strong>&nbsp;{POLICY_VERSION.effectiveDate}</span>
            <span><strong style={{ color: "#5a5249" }}>Version:</strong>&nbsp;{POLICY_VERSION.number}</span>
          </div>
        </div>
      </div>

      {/* TOC + body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 80px", display: "grid", gridTemplateColumns: "240px 1fr", gap: 64 }}>
        {/* TOC */}
        <aside style={{ position: "sticky", top: 140, alignSelf: "start" }}>
          <div style={{ fontFamily: PRIVACY_F.display, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#8b837a", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #eeece8" }}>
            On this page
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOC.map((s) => {
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goSection(s.id)}
                  style={{
                    all: "unset",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "7px 0 7px 12px",
                    marginLeft: -12,
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: isActive ? 640 : 520,
                    color: isActive ? "#4a3fb0" : ("emph" in s && s.emph ? "#4a3fb0" : "#5a5249"),
                    borderLeft: `2px solid ${isActive ? "#5b4fc7" : "transparent"}`,
                  }}
                >
                  <span style={{ fontFamily: PRIVACY_F.mono, fontSize: 11.5, color: isActive ? "#4a3fb0" : "#8b837a", minWidth: 18 }}>{s.n}</span>
                  <span>{s.t}</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 22, background: "linear-gradient(160deg,#2c2541,#5b4fc7)", color: "#fff", padding: 18, borderRadius: 14 }}>
            <div style={{ fontFamily: PRIVACY_F.display, fontSize: 14, fontWeight: 740, marginBottom: 6, letterSpacing: "-.005em" }}>
              Submit a privacy request
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(250,249,247,.78)", margin: "0 0 14px" }}>
              Access, correct, or delete your data — we respond within 30 days.
            </p>
            <Link
              href="/privacy/dsar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                width: "100%",
                background: "#fff",
                color: "#1a1714",
                fontFamily: PRIVACY_F.display,
                fontSize: 12.5,
                fontWeight: 680,
                padding: "8px 14px",
                borderRadius: 6,
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              Open the request form <ArrowSm />
            </Link>
          </div>
        </aside>

        {/* Body */}
        <div className="privacy-body">
          <Section id="who" n="1" title="Who we are">
            <p>
              <strong>BuiltCRM Inc.</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a Canadian software-as-a-service company headquartered in Montréal, Quebec. We provide construction project management software to general contractors, subcontractors, commercial property owners, and homeowners.
            </p>
            <p>
              We are the <strong>data controller</strong> for personal information collected directly through our website, marketing channels, and the BuiltCRM application when you use it as an individual or in connection with your own organization.
            </p>
            <p>
              When a contractor organization invites you (as a subcontractor user, a client, or a team member of another organization) to collaborate on their project, that contractor is the <strong> data controller</strong> for the project data; BuiltCRM acts as a <strong>data processor</strong> on their behalf, processing data only on their documented instructions.
            </p>
          </Section>

          <Section id="what" n="2" title="Information we collect">
            <h3 style={subHeadingStyle}>Information you provide directly</h3>
            <ul style={ulStyle}>
              <li><strong>Account information:</strong> name, email address, password (hashed), organization name, role, profile picture, phone number.</li>
              <li><strong>Billing information:</strong> payment-method tokens via our payment processor (we never see your full card number), billing address, tax identifiers where required.</li>
              <li><strong>Project content:</strong> documents, photos, RFIs, change orders, messages, draws, selections, schedules, and other project artifacts you create or upload.</li>
              <li><strong>Communications:</strong> content of support tickets, in-app messages, and survey responses.</li>
            </ul>
            <h3 style={subHeadingStyle}>Information collected automatically</h3>
            <ul style={ulStyle}>
              <li><strong>Usage data:</strong> pages visited, features used, session timestamps, referring URL, click patterns, error logs.</li>
              <li><strong>Device data:</strong> IP address (truncated for analytics), browser type, operating system, device identifiers, language preference.</li>
              <li><strong>Cookies and similar technologies:</strong> as described in section 9.</li>
            </ul>
            <h3 style={subHeadingStyle}>Information from third parties</h3>
            <ul style={ulStyle}>
              <li>If you sign in via SSO (Google, Microsoft, SAML), we receive your name, email, and profile photo from the identity provider.</li>
              <li>If your organization connects an integration (e.g., QuickBooks, Stripe), we receive the data scoped by the integration grant.</li>
            </ul>
          </Section>

          <Section id="how" n="3" title="How we use information">
            <ul style={ulStyle}>
              <li><strong>Provide the service:</strong> authenticate you, render your projects, send transactional emails, deliver in-app notifications.</li>
              <li><strong>Improve the service:</strong> analyze aggregated usage to find friction, prioritize features, and fix bugs.</li>
              <li><strong>Secure the service:</strong> detect abuse, prevent fraud, investigate incidents, and protect users.</li>
              <li><strong>Communicate with you:</strong> respond to inquiries, send service updates, and (only with your consent) send product news and offers.</li>
              <li><strong>Comply with the law:</strong> respond to lawful requests, enforce our terms, and meet regulatory obligations.</li>
            </ul>
            <p>
              We do not sell personal information. We do not use your project content to train machine learning models, except where you have explicitly opted in to features that depend on it (e.g., the Meeting Minutes assistant).
            </p>
          </Section>

          <Section id="legal" n="4" title="Legal bases">
            <p>
              Where Quebec&apos;s <em>Act respecting the protection of personal information in the private sector</em> (Law 25), Canada&apos;s <em>PIPEDA</em>, or the EU/UK <em>GDPR</em> applies, we rely on the following legal bases for processing:
            </p>
            <ul style={ulStyle}>
              <li><strong>Performance of a contract</strong> — to deliver the service you&apos;ve signed up for.</li>
              <li><strong>Legitimate interests</strong> — to secure, improve, and operate the service, where these interests are not overridden by your rights.</li>
              <li><strong>Consent</strong> — for marketing communications, optional analytics, and certain cookies.</li>
              <li><strong>Legal obligation</strong> — to retain financial records, respond to lawful requests, and meet tax/audit requirements.</li>
            </ul>
            <p>You can withdraw consent at any time without affecting the lawfulness of prior processing.</p>
          </Section>

          <Section id="share" n="5" title="Who we share with">
            <p>We share personal information only with the categories of recipients below.</p>
            <h3 style={subHeadingStyle}>Other users in your organization or project</h3>
            <p>
              When you create or modify content in BuiltCRM, other authorized users in your project see it according to their role. Contractors decide what subcontractors and clients can access.
            </p>
            <h3 style={subHeadingStyle}>Sub-processors</h3>
            <p>
              We use a small number of carefully vetted sub-processors to operate the service. Each is bound by a written data-processing agreement consistent with this policy.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #eeece8", borderRadius: 14, overflow: "hidden", margin: "14px 0" }}>
              <thead>
                <tr>
                  {["Sub-processor", "Purpose", "Region"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontFamily: PRIVACY_F.display, fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8b837a", padding: "12px 18px", background: "#f3efea", borderBottom: "1px solid #eeece8" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUB_PROCESSORS.map((s, i) => (
                  <tr key={s.name}>
                    <td style={{ padding: "14px 18px", fontSize: 13.5, color: "#1a1714", fontFamily: PRIVACY_F.display, fontWeight: 640, borderBottom: i === SUB_PROCESSORS.length - 1 ? "none" : "1px solid #eeece8" }}>{s.name}</td>
                    <td style={{ padding: "14px 18px", fontSize: 13.5, color: "#5a5249", borderBottom: i === SUB_PROCESSORS.length - 1 ? "none" : "1px solid #eeece8" }}>{s.purpose}</td>
                    <td style={{ padding: "14px 18px", fontSize: 13.5, color: "#5a5249", borderBottom: i === SUB_PROCESSORS.length - 1 ? "none" : "1px solid #eeece8" }}>{s.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 13, color: "#8b837a" }}>
              An up-to-date list is available on request from the Privacy Officer. Material changes are announced 30 days in advance.
            </p>
            <h3 style={subHeadingStyle}>Other recipients</h3>
            <ul style={ulStyle}>
              <li><strong>Professional advisors</strong> — auditors, accountants, lawyers, under confidentiality.</li>
              <li><strong>Successors</strong> — in a merger, acquisition, or asset sale, with prior notice.</li>
              <li><strong>Authorities</strong> — when legally required, and only to the minimum extent.</li>
            </ul>
          </Section>

          <Section id="intl" n="6" title="International transfers">
            <p>
              Production data is stored in Canada (AWS <span style={{ fontFamily: PRIVACY_F.mono, fontSize: 13.5 }}>ca-central-1</span>, Montréal). Some of our sub-processors are located in the United States, the United Kingdom, or the European Economic Area. When data leaves Canada, we apply appropriate safeguards, including Standard Contractual Clauses where applicable and supplementary technical measures (encryption in transit and at rest).
            </p>
            <p>
              Quebec residents: under Law 25, we conduct a privacy-impact assessment before any new cross-border transfer of personal information. A summary of the latest PIA is available on request to the Privacy Officer.
            </p>
          </Section>

          <Section id="retain" n="7" title="Data retention">
            <p>We retain personal information only as long as needed for the purposes described in this policy.</p>
            <ul style={ulStyle}>
              <li><strong>Active account data:</strong> retained while your account is active.</li>
              <li><strong>Project content:</strong> retained while the host organization&apos;s account is active, plus an additional 30 days after archive or termination, then deleted (subject to legal hold).</li>
              <li><strong>Billing records:</strong> retained for 7 years for Canadian tax-compliance reasons.</li>
              <li><strong>Backup data:</strong> rolling 30-day window; deletions are propagated as backups expire.</li>
              <li><strong>Marketing data:</strong> retained until you unsubscribe or 24 months of inactivity, whichever is first.</li>
              <li><strong>DSAR records:</strong> closed requests retained for 90 days for audit purposes, then minimized.</li>
            </ul>
          </Section>

          <Section id="rights" n="8" title="Your privacy rights">
            <p>
              You have the rights described below. To exercise any of them, you can submit a request through our intake form (no account required) or by contacting our Privacy Officer directly. We respond within <strong>30 days</strong>; complex requests can be extended once by 30 days with notice.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, margin: "18px 0" }}>
              {RIGHTS.map((r) => (
                <div key={r.ti} style={{ background: "#fff", border: "1px solid #eeece8", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontFamily: PRIVACY_F.display, fontSize: 14.5, fontWeight: 700, color: "#1a1714", marginBottom: 6, letterSpacing: "-.005em" }}>{r.ti}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5a5249" }}>{r.desc}</div>
                </div>
              ))}
            </div>

            <DsarBanner heading="Submit a privacy request" body="Open the secure intake form. No account required. We respond within 30 days." />

            <Callout variant="info">
              <strong>Project data is your contractor&apos;s responsibility.</strong> If your request concerns project content created by a contractor who invited you (drawings, photos, messages, financial records), we&apos;ll forward your request to them within 5 business days, since they are the controller of that data. We&apos;ll keep you informed.
            </Callout>

            <p>
              If you&apos;re unsatisfied with our response, you can lodge a complaint with the <strong>Commission d&apos;accès à l&apos;information du Québec</strong> (CAI) or the Office of the Privacy Commissioner of Canada (OPC). Contact details are on our <Link href="/privacy/officer" style={inlineLinkStyle}>Privacy Officer page</Link>.
            </p>
          </Section>

          <Section id="cookies" n="9" title="Cookies & tracking">
            <p>We use a minimal set of cookies and similar technologies. You can control non-essential cookies through our cookie banner or by visiting your browser settings.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "14px 0" }}>
              {COOKIE_TYPES.map((c) => (
                <div key={c.nm} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, padding: "14px 18px", background: "#fff", border: "1px solid #eeece8", borderRadius: 14 }}>
                  <div style={{ fontFamily: PRIVACY_F.display, fontSize: 13.5, fontWeight: 700, color: "#1a1714" }}>
                    {c.nm}
                    {c.req && (
                      <div style={{ display: "inline-block", marginTop: 4, fontFamily: PRIVACY_F.display, fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", background: "#f3efea", color: "#8b837a", padding: "2px 7px", borderRadius: 999 }}>Required</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5a5249" }}>{c.desc}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13.5 }}>
              We do not use cookies for cross-site advertising. We do not embed third-party social buttons that load before consent.
            </p>
          </Section>

          <Section id="children" n="10" title="Children's privacy">
            <p>
              BuiltCRM is not directed at children under 14 (the age of digital consent in Quebec) and we do not knowingly collect personal information from them. If you believe we have inadvertently collected data about a child, please contact our Privacy Officer and we will delete it.
            </p>
          </Section>

          <Section id="security" n="11" title="Security">
            <p>We protect personal information with administrative, technical, and physical safeguards.</p>
            <ul style={ulStyle}>
              <li>Encryption in transit (TLS 1.3) and at rest (AES-256).</li>
              <li>Row-level multi-tenant isolation; no shared production keys between organizations.</li>
              <li>Multi-factor authentication available to all users; required for org admins.</li>
              <li>Least-privilege access controls and quarterly access reviews.</li>
              <li>Annual third-party penetration testing.</li>
              <li>Incident response plan with breach notification within 72 hours where required.</li>
            </ul>
            <p style={{ fontSize: 13.5, color: "#8b837a" }}>
              No system is perfectly secure. If you believe your account has been compromised, contact our Privacy Officer immediately.
            </p>
          </Section>

          <Section id="changes" n="12" title="Changes to this policy">
            <p>
              We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top tells you when. Material changes (those that meaningfully affect your rights) will be announced by email and in-product notice at least <strong>30 days</strong> before they take effect, and we&apos;ll keep an archive of prior versions on request.
            </p>
          </Section>

          <Section id="contact" n="13" title="Contact us">
            <p>For privacy questions, requests, or complaints, contact our designated Privacy Officer.</p>
            <Callout variant="action">
              <strong>{PUBLIC_PRIVACY_OFFICER.name}</strong> · {PUBLIC_PRIVACY_OFFICER.role}<br />
              <span style={{ fontFamily: PRIVACY_F.mono, fontSize: 13.5 }}>{PUBLIC_PRIVACY_OFFICER.email}</span> · {PUBLIC_PRIVACY_OFFICER.phone}<br />
              <span style={{ fontSize: 13, color: "#4a3fb0", opacity: 0.85 }}>{PUBLIC_PRIVACY_OFFICER.postal}</span>
              <Link href="/privacy/officer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: PRIVACY_F.display, fontWeight: 640, marginTop: 6, color: "#4a3fb0", textDecoration: "none" }}>
                View Privacy Officer page <ArrowSm />
              </Link>
            </Callout>
          </Section>
        </div>
      </div>
    </PrivacyShell>
  );
}

const subHeadingStyle = {
  fontFamily: PRIVACY_F.display,
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "-.012em",
  color: "#1a1714",
  margin: "24px 0 10px",
} as const;

const ulStyle = { margin: "0 0 14px", paddingLeft: 22, fontSize: 15, lineHeight: 1.7, color: "#5a5249" } as const;

const inlineLinkStyle = { color: "#4a3fb0", textDecoration: "none", borderBottom: "1px solid transparent" } as const;

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`s-${id}`} style={{ marginBottom: 44, scrollMarginTop: 140 }}>
      <h2 style={{ fontFamily: PRIVACY_F.display, fontSize: 24, fontWeight: 780, letterSpacing: "-.022em", lineHeight: 1.2, color: "#1a1714", margin: "0 0 14px", display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: PRIVACY_F.mono, fontSize: 14, color: "#8b837a", fontWeight: 500, letterSpacing: 0, display: "inline-block", minWidth: 32 }}>{n}</span>
        <span>{title}</span>
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "#5a5249" }}>{children}</div>
    </section>
  );
}

function DsarBanner({ heading, body }: { heading: string; body: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(160deg,#2c2541 0%,#5b4fc7 100%)",
        color: "#fff",
        borderRadius: 20,
        padding: 32,
        margin: "28px 0",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 24,
        alignItems: "center",
      }}
    >
      <div>
        <h3 style={{ fontFamily: PRIVACY_F.display, fontSize: 22, fontWeight: 780, color: "#fff", margin: "0 0 8px", letterSpacing: "-.018em" }}>{heading}</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "rgba(250,249,247,.82)", margin: 0 }}>{body}</p>
      </div>
      <Link href="/privacy/dsar" style={{ background: "#fff", color: "#1a1714", fontFamily: PRIVACY_F.display, fontSize: 14, fontWeight: 680, padding: "12px 22px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", textDecoration: "none" }}>
        Open the request form <ArrowSm />
      </Link>
    </div>
  );
}

function Callout({ variant, children }: { variant: "info" | "action"; children: React.ReactNode }) {
  const palette = variant === "info"
    ? { bg: "#e8f1fa", border: "#cfe1f3", icon: "#276299", text: "#276299" }
    : { bg: "#eeedfb", border: "#d4cef0", icon: "#4a3fb0", text: "#4a3fb0" };
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14, margin: "18px 0", background: palette.bg, border: `1px solid ${palette.border}` }}>
      <div style={{ flexShrink: 0, marginTop: 2, color: palette.icon }}>
        {variant === "info" ? <CircleInfoIcon /> : <UserIcon />}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: palette.text }}>{children}</div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CircleInfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ArrowSm() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
