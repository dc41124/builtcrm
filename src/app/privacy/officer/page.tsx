import type { Metadata } from "next";
import Link from "next/link";

import { PrivacyShell } from "@/components/privacy/privacy-shell";
import { PRIVACY_F } from "@/components/privacy/privacy-tokens";
import {
  DESIGNATION_HISTORY,
  PUBLIC_PRIVACY_OFFICER,
} from "@/lib/privacy/public-content";

// Step 65 Session A — public Privacy Officer page. Direct port of the
// officer view in `docs/prototypes/builtcrm_privacy_pages_paired.jsx`
// (View 02). Marketing aesthetic, no auth, no portal chrome. The
// officer fields are hardcoded as a session-A placeholder; Session B
// will swap to a read from the `privacy_officers` table.

export const metadata: Metadata = {
  title: "Privacy Officer · BuiltCRM",
  description:
    "BuiltCRM's designated Privacy Officer under Quebec Law 25 §3.1 — contact details, mandate, and escalation path.",
  robots: { index: true, follow: true },
};

const officer = PUBLIC_PRIVACY_OFFICER;

export default function PrivacyOfficerPage() {
  return (
    <PrivacyShell active="officer" breadcrumbLabel="Privacy Officer">
      {/* Hero card */}
      <div style={{ background: "linear-gradient(160deg,#fff 0%,#faf9f7 100%)", borderBottom: "1px solid #eeece8", padding: "60px 32px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
            <UserIcon />
            Designated Privacy Officer · Quebec Law 25 §3.1
          </span>
          <h1 style={{ fontFamily: PRIVACY_F.display, fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.1, margin: "12px 0 14px", maxWidth: 760, color: "#1a1714" }}>
            Meet the person responsible for privacy at BuiltCRM
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "#5a5249", maxWidth: 640, margin: 0 }}>
            Quebec&apos;s Law 25 requires every organization to designate a Privacy Officer accountable for the protection of personal information. Here&apos;s ours, and how to reach them.
          </p>

          <div
            style={{
              background: "#fff",
              border: "1px solid #eeece8",
              borderRadius: 20,
              padding: 36,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 32,
              alignItems: "start",
              boxShadow: "0 8px 28px rgba(26,23,20,.07)",
              marginTop: 32,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#2c2541,#5b4fc7)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: PRIVACY_F.display,
                fontSize: 32,
                fontWeight: 740,
                letterSpacing: "-.02em",
              }}
            >
              {officer.initials}
            </div>
            <div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: PRIVACY_F.display,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".07em",
                  textTransform: "uppercase",
                  background: "#eeedfb",
                  color: "#4a3fb0",
                  padding: "4px 10px",
                  borderRadius: 999,
                  marginBottom: 12,
                }}
              >
                <CheckCircle /> Active &amp; reachable
              </span>
              <h2 style={{ fontFamily: PRIVACY_F.display, fontSize: 32, fontWeight: 780, letterSpacing: "-.025em", color: "#1a1714", margin: "0 0 6px", lineHeight: 1.15 }}>
                {officer.name}
              </h2>
              <p style={{ fontFamily: PRIVACY_F.display, fontSize: 16, fontWeight: 560, color: "#5a5249", margin: "0 0 22px" }}>
                {officer.role}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                <ContactRow label="Email" value={officer.email} mono />
                <ContactRow label="Phone" value={officer.phone} />
                <ContactRow label="Postal address" value={officer.postal} small />
                <ContactRow label="Response time" value={`Within ${officer.responseSla}`} />
              </div>
              <div style={{ marginTop: 22, fontSize: 13, color: "#8b837a" }}>
                Designated {officer.designatedAt} · Listed publicly under Law 25 §3.1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 32px 80px" }}>
        {/* Mandate */}
        <BodySection title="What the Privacy Officer does">
          <p style={bodyParaStyle}>
            The Privacy Officer is internally accountable for our compliance with Quebec&apos;s Law 25 and analogous Canadian and international regimes. Their responsibilities include:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {[
              { ti: "Handles your privacy requests", desc: "Reviews and responds to all access, deletion, rectification, and portability requests within 30 days." },
              { ti: "Maintains the consent register", desc: "Tracks every consent given and revoked across the platform, with a complete audit trail." },
              { ti: "Logs and responds to incidents", desc: "Maintains the breach register, coordinates containment, notifies affected users, and reports to the CAI when required." },
              { ti: "Conducts privacy-impact assessments", desc: "Reviews new features, integrations, and cross-border transfers before they ship, per Law 25 §3.3." },
              { ti: "Trains the team", desc: "Runs annual privacy training for all employees and contractors with access to personal information." },
              { ti: "Publishes our privacy policy", desc: "Keeps this site, our policy, and our subprocessor list current. Announces material changes 30 days in advance." },
            ].map((m) => (
              <div key={m.ti} style={{ background: "#fff", border: "1px solid #eeece8", borderRadius: 14, padding: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "#eeedfb", color: "#4a3fb0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <ShieldIcon />
                </div>
                <div style={{ fontFamily: PRIVACY_F.display, fontSize: 14.5, fontWeight: 720, color: "#1a1714", marginBottom: 6, letterSpacing: "-.005em" }}>{m.ti}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5a5249" }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </BodySection>

        {/* DSAR CTA */}
        <BodySection title="Have a privacy request?">
          <p style={bodyParaStyle}>
            The fastest way to reach our Privacy Officer with a formal request is the secure intake form. You don&apos;t need a BuiltCRM account, and you&apos;ll receive a confirmation with a reference number within five minutes.
          </p>
          <div style={{ background: "linear-gradient(160deg,#2c2541 0%,#5b4fc7 100%)", color: "#fff", borderRadius: 20, padding: 32, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center", margin: "20px 0" }}>
            <div>
              <h3 style={{ fontFamily: PRIVACY_F.display, fontSize: 22, fontWeight: 780, color: "#fff", margin: "0 0 8px", letterSpacing: "-.018em" }}>Submit a privacy request</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "rgba(250,249,247,.82)", margin: 0 }}>Access · Rectification · Deletion · Portability · Withdrawal of consent</p>
            </div>
            <Link href="/privacy/dsar" style={{ background: "#fff", color: "#1a1714", fontFamily: PRIVACY_F.display, fontSize: 14, fontWeight: 680, padding: "12px 22px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", textDecoration: "none" }}>
              Open the request form <ArrowSm />
            </Link>
          </div>
        </BodySection>

        {/* Direct contact */}
        <BodySection title="Prefer email or phone?">
          <p style={bodyParaStyle}>
            You can also reach <strong style={{ color: "#1a1714" }}>{officer.name}</strong> directly. Please include enough detail to identify yourself and your request — we may need to verify your identity before sharing personal information.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, margin: "18px 0" }}>
            <DirectCard ti="Email"><span style={{ fontFamily: PRIVACY_F.mono, fontSize: 14, color: "#4a3fb0" }}>{officer.email}</span></DirectCard>
            <DirectCard ti="Phone"><span style={{ fontSize: 14 }}>{officer.phone}</span></DirectCard>
            <DirectCard ti="Postal mail"><span style={{ fontSize: 13.5 }}>{officer.postal}</span></DirectCard>
            <DirectCard ti="In-product">Logged-in users can manage consent and submit requests directly from <strong style={{ color: "#1a1714" }}>Settings → Privacy &amp; consents</strong>.</DirectCard>
          </div>
        </BodySection>

        {/* Escalation */}
        <BodySection title="Not satisfied with our response?">
          <p style={bodyParaStyle}>
            You always have the right to escalate. Quebec residents can file a complaint with the <strong style={{ color: "#1a1714" }}>Commission d&apos;accès à l&apos;information du Québec</strong> at any time, with or without first contacting us. Residents elsewhere in Canada can contact the <strong style={{ color: "#1a1714" }}>Office of the Privacy Commissioner of Canada</strong>.
          </p>
          <div style={{ background: "#e8f1fa", border: "1px solid #cfe1f3", borderRadius: 14, padding: 24, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", color: "#276299", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GlobeIcon />
            </div>
            <div>
              <div style={{ fontFamily: PRIVACY_F.display, fontSize: 16, fontWeight: 720, color: "#276299", marginBottom: 4, letterSpacing: "-.01em" }}>
                Commission d&apos;accès à l&apos;information du Québec
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#276299", margin: 0, opacity: 0.92 }}>
                525, boulevard René-Lévesque Est, Suite 2.36, Québec G1R 5S9 ·{" "}
                <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#276299", fontWeight: 640, textDecoration: "underline" }}>
                  cai.gouv.qc.ca
                </a>
              </p>
            </div>
            <a
              href="https://www.cai.gouv.qc.ca/citoyens/plaintes/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#fff",
                color: "#276299",
                fontFamily: PRIVACY_F.display,
                fontSize: 13,
                fontWeight: 660,
                border: "1px solid #cfe1f3",
                padding: "9px 16px",
                borderRadius: 6,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
              }}
            >
              File a complaint <ExternalIcon />
            </a>
          </div>
        </BodySection>

        {/* Designation history */}
        <BodySection title="Designation history">
          <p style={bodyParaStyle}>For transparency, we publish the designation history of this role.</p>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #eeece8", borderRadius: 14, overflow: "hidden", margin: "14px 0" }}>
            <thead>
              <tr>
                {["Period", "Privacy Officer", "Designated by"].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontFamily: PRIVACY_F.display, fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8b837a", padding: "12px 18px", background: "#f3efea", borderBottom: "1px solid #eeece8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DESIGNATION_HISTORY.map((row, i) => (
                <tr key={row.period}>
                  <td style={{ padding: "14px 18px", fontSize: 13.5, color: "#1a1714", fontFamily: PRIVACY_F.display, fontWeight: 640, borderBottom: i === DESIGNATION_HISTORY.length - 1 ? "none" : "1px solid #eeece8" }}>{row.period}</td>
                  <td style={{ padding: "14px 18px", fontSize: 13.5, color: "#5a5249", borderBottom: i === DESIGNATION_HISTORY.length - 1 ? "none" : "1px solid #eeece8" }}>{row.officer}</td>
                  <td style={{ padding: "14px 18px", fontSize: 13.5, color: "#5a5249", borderBottom: i === DESIGNATION_HISTORY.length - 1 ? "none" : "1px solid #eeece8" }}>{row.designatedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BodySection>
      </div>
    </PrivacyShell>
  );
}

const bodyParaStyle = { fontSize: 15, lineHeight: 1.7, color: "#5a5249", margin: "0 0 12px" } as const;

function BodySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 42 }}>
      <h2 style={{ fontFamily: PRIVACY_F.display, fontSize: 22, fontWeight: 760, letterSpacing: "-.02em", color: "#1a1714", margin: "0 0 14px" }}>{title}</h2>
      {children}
    </div>
  );
}

function ContactRow({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div style={{ background: "#f3efea", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontFamily: PRIVACY_F.display, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8b837a" }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 14, color: "#1a1714", fontWeight: 540, fontFamily: mono ? PRIVACY_F.mono : undefined }}>{value}</div>
    </div>
  );
}

function DirectCard({ ti, children }: { ti: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eeece8", borderRadius: 14, padding: 18 }}>
      <div style={{ fontFamily: PRIVACY_F.display, fontSize: 14.5, fontWeight: 700, color: "#1a1714", marginBottom: 6, letterSpacing: "-.005em" }}>{ti}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5a5249" }}>{children}</div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ArrowSm() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
