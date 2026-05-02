"use client";

// Step 64 — Public marketing-site integration gallery UI.
//
// Marketing nav is duplicated inline (same five-tab nav as marketing-page
// and api-docs). No shared component. Catalog body comes from the shared
// IntegrationsGalleryBody used by both the public and contractor versions.

import Link from "next/link";

import { IntegrationsGalleryBody } from "@/components/integrations/IntegrationsGalleryBody";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
};

const ARR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export function PublicIntegrationsUI() {
  return (
    <div
      style={{
        background: "#faf9f7",
        color: "#1a1714",
        minHeight: "100vh",
        fontFamily: F.body,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Marketing nav — same four-tab nav as marketing-page.tsx and
          api-docs-ui.tsx. Integrations + API docs were folded into the
          footer to keep top-nav real estate tight. */}
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
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg,#2c2541,#5b4fc7)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg viewBox="0 0 80 80" width="19" height="19">
                <rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" />
                <rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" />
                <rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" />
              </svg>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 780, letterSpacing: "-.04em" }}>
              BuiltCRM
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Product</Link>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Solutions</Link>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Pricing</Link>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Resources</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/login"
              style={{
                height: 38,
                padding: "0 16px",
                fontSize: 13.5,
                fontWeight: 620,
                color: "#5e5850",
                background: "transparent",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                fontFamily: F.body,
              }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              style={{
                height: 38,
                padding: "0 20px",
                fontSize: 13.5,
                fontWeight: 650,
                color: "white",
                background: "#5b4fc7",
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
                fontFamily: F.body,
              }}
            >
              Get started free <span style={{ width: 14, height: 14, display: "block" }}>{ARR}</span>
            </Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 80px" }}>
        <IntegrationsGalleryBody variant="public" />
      </div>

      {/* Marketing footer — duplicated inline from marketing-page.tsx to
          match the rest of the public marketing surface. */}
      <footer style={{ background: "#2c2541", color: "rgba(250,249,247,.7)", padding: "72px 32px 36px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 64, marginBottom: 56 }}>
            <div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#5b4fc7,#7c6fe0)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                <svg viewBox="0 0 80 80" width="19" height="19"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" /><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" /><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" /></svg>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, maxWidth: 260, color: "rgba(250,249,247,.5)" }}>Construction project management built for the way real teams actually work.</p>
            </div>
            {([
              { h: "Product", links: [{ l: "Features" }, { l: "Pricing" }, { l: "Integrations", href: "/integrations" }, { l: "API docs", href: "/api-docs" }, { l: "Changelog" }, { l: "Roadmap" }] },
              { h: "Solutions", links: [{ l: "General Contractors" }, { l: "Subcontractors" }, { l: "Commercial Owners" }, { l: "Homeowners" }] },
              { h: "Privacy", links: [
                { l: "Privacy Policy", href: "/privacy" },
                { l: "Privacy Officer", href: "/privacy/officer" },
                { l: "Submit a request", href: "/privacy/dsar" },
                { l: "Cookie preferences", href: "/privacy#cookies" },
                { l: "Subprocessors", href: "/privacy#share" },
              ] },
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
              <Link href="/privacy" style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}>Privacy</Link>
              <span style={{ cursor: "pointer" }}>Terms</span>
              <span style={{ cursor: "pointer" }}>Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
