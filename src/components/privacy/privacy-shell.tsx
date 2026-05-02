"use client";

// Step 65 Session A — shared marketing nav, privacy sub-nav, and footer
// for the public privacy pages (/privacy + /privacy/officer + /privacy/dsar).
//
// Lives next to the privacy pages rather than as a generic <MarketingShell>
// because (a) only the privacy surface uses this composition and (b) the
// sub-nav is privacy-specific. The inner marketing nav matches the trim
// four-tab nav in `marketing-page.tsx`.
//
// Marked "use client" so it can be imported from sibling "use client"
// pages (privacy-policy-ui, dsar-intake-ui) without a server/client
// boundary mismatch. /privacy/officer renders it from a server page;
// that direction is allowed in Next.js App Router.

import Link from "next/link";
import type { ReactNode } from "react";

import { PRIVACY_F, type PrivacyTab } from "./privacy-tokens";

const ARR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export function PrivacyShell({
  active,
  breadcrumbLabel,
  children,
}: {
  active: PrivacyTab;
  breadcrumbLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#faf9f7",
        color: "#1a1714",
        minHeight: "100vh",
        fontFamily: PRIVACY_F.body,
        WebkitFontSmoothing: "antialiased",
        lineHeight: 1.6,
        fontSize: 15,
      }}
    >
      <MarketingNav />
      <PrivacySubNav active={active} breadcrumbLabel={breadcrumbLabel} />
      {children}
      <MarketingFooter activePrivacyTab={active} />
    </div>
  );
}

function MarketingNav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(250,249,247,.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #eeece8",
        padding: "0 32px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textDecoration: "none", color: "inherit" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#2c2541,#5b4fc7)", display: "grid", placeItems: "center" }}>
            <svg viewBox="0 0 80 80" width="19" height="19">
              <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
              <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
              <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
            </svg>
          </div>
          <div style={{ fontFamily: PRIVACY_F.display, fontSize: 19, fontWeight: 780, letterSpacing: "-.04em" }}>BuiltCRM</div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/" style={navLinkStyle}>Product</Link>
          <Link href="/" style={navLinkStyle}>Solutions</Link>
          <Link href="/" style={navLinkStyle}>Pricing</Link>
          <Link href="/" style={navLinkStyle}>Resources</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" style={{ height: 38, padding: "0 16px", fontSize: 13.5, fontWeight: 620, color: "#5e5850", background: "transparent", borderRadius: 10, display: "inline-flex", alignItems: "center", textDecoration: "none", fontFamily: PRIVACY_F.body }}>Log in</Link>
          <Link href="/signup" style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 650, color: "white", background: "#5b4fc7", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontFamily: PRIVACY_F.body }}>
            Get started free <span style={{ width: 14, height: 14, display: "block" }}>{ARR}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

const navLinkStyle = {
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 560,
  color: "#5e5850",
  borderRadius: 10,
  cursor: "pointer",
  textDecoration: "none",
} as const;

function PrivacySubNav({ active, breadcrumbLabel }: { active: PrivacyTab; breadcrumbLabel: string }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #eeece8" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8b837a" }}>
          <span>Company</span>
          <span style={{ color: "#e3dfd8" }}>/</span>
          <span style={{ color: "#1a1714", fontWeight: 580 }}>{breadcrumbLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/privacy" style={subTabStyle(active === "policy")}>Privacy Policy</Link>
          <Link href="/privacy/officer" style={subTabStyle(active === "officer")}>Privacy Officer</Link>
          <Link
            href="/privacy/dsar"
            style={{
              fontFamily: PRIVACY_F.display,
              fontSize: 13,
              fontWeight: 620,
              color: "#fff",
              background: "#2c2541",
              border: "1px solid #2c2541",
              padding: "7px 14px",
              borderRadius: 999,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            Submit a privacy request
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px" }}>
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

function subTabStyle(current: boolean) {
  return {
    fontFamily: PRIVACY_F.display,
    fontSize: 13,
    fontWeight: 600,
    color: current ? "#4a3fb0" : "#5a5249",
    padding: "7px 14px",
    borderRadius: 999,
    background: current ? "#eeedfb" : "transparent",
    border: current ? "1px solid #d4cef0" : "1px solid transparent",
    cursor: "pointer",
    textDecoration: "none",
  } as const;
}

function MarketingFooter({ activePrivacyTab }: { activePrivacyTab: PrivacyTab }) {
  return (
    <footer style={{ background: "#2c2541", color: "rgba(250,249,247,.7)", padding: "72px 32px 36px", marginTop: 80 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            gap: 64,
            marginBottom: 56,
          }}
        >
          <div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#2c2541,#5b4fc7)", display: "grid", placeItems: "center", marginBottom: 14 }}>
              <svg viewBox="0 0 80 80" width="19" height="19">
                <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
                <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
                <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
              </svg>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, maxWidth: 260, color: "rgba(250,249,247,.5)" }}>
              Construction project management built for the way real teams actually work.
            </p>
          </div>
          {([
            { h: "Product", links: [{ l: "Features" }, { l: "Pricing" }, { l: "Integrations", href: "/integrations" }, { l: "API docs", href: "/api-docs" }, { l: "Changelog" }, { l: "Roadmap" }] },
            { h: "Solutions", links: [{ l: "General Contractors" }, { l: "Subcontractors" }, { l: "Commercial Owners" }, { l: "Homeowners" }] },
            { h: "Privacy", links: [
              { l: "Privacy Policy", href: "/privacy", current: activePrivacyTab === "policy" },
              { l: "Privacy Officer", href: "/privacy/officer", current: activePrivacyTab === "officer" },
              { l: "Submit a request", href: "/privacy/dsar", current: activePrivacyTab === "dsar" },
              { l: "Cookie preferences", href: "/privacy#cookies" },
              { l: "Subprocessors", href: "/privacy#share" },
            ] },
            { h: "Company", links: [{ l: "About" }, { l: "Blog" }, { l: "Careers" }, { l: "Contact" }, { l: "Security" }] },
          ] as { h: string; links: { l: string; href?: string; current?: boolean }[] }[]).map((col) => (
            <div key={col.h}>
              <h4 style={{ fontFamily: PRIVACY_F.display, fontSize: 11.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "rgba(250,249,247,.3)", marginBottom: 20 }}>{col.h}</h4>
              {col.links.map(({ l, href, current }) =>
                href ? (
                  <Link
                    key={l}
                    href={href}
                    style={{
                      display: "block",
                      fontSize: 13.5,
                      color: current ? "#fff" : "rgba(250,249,247,.6)",
                      fontWeight: current ? 560 : 480,
                      marginBottom: 12,
                      textDecoration: "none",
                    }}
                  >
                    {l}
                  </Link>
                ) : (
                  <div key={l} style={{ fontSize: 13.5, color: "rgba(250,249,247,.6)", fontWeight: 480, marginBottom: 12, cursor: "pointer" }}>{l}</div>
                ),
              )}
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: "rgba(250,249,247,.08)", marginBottom: 24 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "rgba(250,249,247,.35)" }}>
          <span>&copy; 2026 BuiltCRM. All rights reserved.</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/privacy" style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}>Privacy</Link>
            <span style={{ cursor: "pointer" }}>Terms</span>
            <span style={{ cursor: "pointer" }}>Security</span>
            <span style={{ cursor: "pointer" }}>Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
