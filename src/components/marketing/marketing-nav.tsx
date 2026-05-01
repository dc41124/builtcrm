"use client";

// Shared marketing-site nav, used by both `<MarketingPage>` and the public
// API docs page at /api-docs. Owns its own mobile-menu state + body-scroll
// lock so callers don't have to.
//
// Two interaction modes for the four marketing tabs (Product / Solutions /
// Pricing / Resources):
//   - In-place: `onNavClick` is provided (we're already on /). Clicking a
//     tab flips the parent's page state and scrolls to top.
//   - Hard link: `onNavClick` is omitted (we're on /api-docs). Clicking a
//     tab routes to /. The marketing page always lands on Product/home;
//     no deep-link plumbing.
// "API docs" is always a hard link to /api-docs because it lives on a
// different route.
//
// Right-side CTAs depend on session:
//   - Signed out  → "Log in" + "Get started free"
//   - Signed in   → "Open dashboard" → user's portal home (single portal),
//                   /select-portal (multi), or /no-portal (none).
// On the api-docs variant we additionally render a context-aware
// "Get an API key" pill that resolves to the contractor API-keys settings
// page if available, otherwise /login.

import Link from "next/link";
import { useEffect, useState } from "react";

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

export type MarketingPageKey = "home" | "solutions" | "pricing" | "resources";
export type MarketingNavCurrent = MarketingPageKey | "api-docs";

export type MarketingSession = {
  signedIn: boolean;
  /** Where "Open dashboard" links to. Null only when signedIn=false. */
  dashboardHref: string | null;
  /** Where "Get an API key" CTA on the api-docs variant links to.
   *  Null when the user has no contractor portal access — in that case
   *  the CTA falls back to /login (signed out) or hides (signed in). */
  apiKeysHref: string | null;
};

type MarketingNavProps = {
  currentPage: MarketingNavCurrent;
  /** Provided by the in-place marketing page. Omit on /api-docs so taps
   *  hard-route to /?page=<key>. */
  onNavClick?: (page: MarketingPageKey) => void;
  session: MarketingSession;
  /** Tweaks the right-side CTA stack. Defaults to the marketing variant. */
  variant?: "default" | "api-docs";
};

const TABS: [MarketingPageKey, string][] = [
  ["home", "Product"],
  ["solutions", "Solutions"],
  ["pricing", "Pricing"],
  ["resources", "Resources"],
];

// All marketing tabs route to the marketing root. We deliberately don't
// deep-link to the active tab — keeping it a plain hyperlink avoids the
// session/redirect edge cases that come with query-string plumbing.
function tabHref(_key: MarketingPageKey): string {
  return "/";
}

export function MarketingNav({
  currentPage,
  onNavClick,
  session,
  variant = "default",
}: MarketingNavProps) {
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (!mobileMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenu]);

  const handleTabClick = (key: MarketingPageKey) => {
    setMobileMenu(false);
    if (onNavClick) onNavClick(key);
  };

  const renderTab = (key: MarketingPageKey, label: string) => {
    const isActive = currentPage === key;
    const baseStyle = {
      padding: "8px 14px",
      fontSize: 14,
      fontWeight: isActive ? 640 : 560,
      color: isActive ? "#1a1714" : "#5e5850",
      borderRadius: 10,
      cursor: "pointer",
      transition: "all 120ms",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      fontFamily: F.body,
    } as const;
    if (onNavClick) {
      return (
        <button
          key={key}
          type="button"
          onClick={() => handleTabClick(key)}
          style={{ ...baseStyle, background: "transparent", border: "none" }}
        >
          {label}
        </button>
      );
    }
    return (
      <Link key={key} href={tabHref(key)} style={baseStyle}>
        {label}
      </Link>
    );
  };

  const apiDocsTab = () => {
    const isActive = currentPage === "api-docs";
    return (
      <Link
        key="api-docs"
        href="/api-docs"
        style={{
          padding: "8px 14px",
          fontSize: 14,
          fontWeight: isActive ? 640 : 560,
          color: isActive ? "#1a1714" : "#5e5850",
          borderRadius: 10,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          fontFamily: F.body,
        }}
      >
        API docs
      </Link>
    );
  };

  const apiKeyCtaHref = session.apiKeysHref ?? (session.signedIn ? null : "/login");
  const showApiKeyCta = variant === "api-docs" && apiKeyCtaHref !== null;

  return (
    <>
      {/* ── STICKY NAV ── */}
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
            onClick={() => {
              setMobileMenu(false);
              if (onNavClick) onNavClick("home");
            }}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textDecoration: "none", color: "inherit" }}
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
            {TABS.map(([k, l]) => renderTab(k, l))}
            {apiDocsTab()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {showApiKeyCta && apiKeyCtaHref && (
              <Link
                href={apiKeyCtaHref}
                className="mkt-nav-apikey"
                style={{
                  height: 38,
                  padding: "0 14px",
                  fontSize: 13.5,
                  fontWeight: 620,
                  color: "#4a3fb0",
                  background: "#eeedfb",
                  border: "1px solid #c7c2ea",
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  textDecoration: "none",
                  fontFamily: F.body,
                }}
              >
                Get an API key
              </Link>
            )}
            {session.signedIn ? (
              <Link
                href={session.dashboardHref ?? "/no-portal"}
                className="mkt-nav-signup"
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
                Open dashboard <span style={{ width: 14, height: 14, display: "block" }}>{ARR}</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="mkt-nav-login"
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
                  className="mkt-nav-signup"
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
              </>
            )}
            <button
              type="button"
              aria-label={mobileMenu ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenu(!mobileMenu)}
              className="mkt-hamburger"
              style={{
                display: "none",
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1px solid #e5e2dc",
                background: "white",
                cursor: "pointer",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1714" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenu ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE DRAWER ── */}
      {mobileMenu && (
        <div
          className="mkt-mobile-menu"
          style={{
            position: "fixed",
            top: 58,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#faf9f7",
            zIndex: 99,
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
          }}
        >
          {TABS.map(([k, l]) => {
            const isActive = currentPage === k;
            const style = {
              textAlign: "left" as const,
              padding: "16px 14px",
              fontFamily: F.display,
              fontSize: 18,
              fontWeight: isActive ? 720 : 620,
              color: isActive ? "#5b4fc7" : "#1a1714",
              background: isActive ? "#eeedfb" : "transparent",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              textDecoration: "none",
              display: "block",
            };
            if (onNavClick) {
              return (
                <button key={k} type="button" onClick={() => handleTabClick(k)} style={style}>
                  {l}
                </button>
              );
            }
            return (
              <Link key={k} href={tabHref(k)} onClick={() => setMobileMenu(false)} style={style}>
                {l}
              </Link>
            );
          })}
          <Link
            href="/api-docs"
            onClick={() => setMobileMenu(false)}
            style={{
              padding: "16px 14px",
              fontFamily: F.display,
              fontSize: 18,
              fontWeight: currentPage === "api-docs" ? 720 : 620,
              color: currentPage === "api-docs" ? "#5b4fc7" : "#1a1714",
              background: currentPage === "api-docs" ? "#eeedfb" : "transparent",
              borderRadius: 12,
              textDecoration: "none",
              display: "block",
            }}
          >
            API docs
          </Link>
          <div style={{ height: 1, background: "#eeece8", margin: "12px 0" }} />
          {session.signedIn ? (
            <Link
              href={session.dashboardHref ?? "/no-portal"}
              onClick={() => setMobileMenu(false)}
              style={{
                marginTop: 4,
                height: 50,
                borderRadius: 12,
                background: "#5b4fc7",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 15,
                fontWeight: 680,
                textDecoration: "none",
                fontFamily: F.body,
              }}
            >
              Open dashboard <span style={{ width: 16, height: 16, display: "block" }}>{ARR}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMobileMenu(false)}
                style={{
                  padding: "14px 14px",
                  fontSize: 15,
                  fontWeight: 620,
                  color: "#5e5850",
                  textDecoration: "none",
                  fontFamily: F.body,
                }}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenu(false)}
                style={{
                  marginTop: 8,
                  height: 50,
                  borderRadius: 12,
                  background: "#5b4fc7",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 680,
                  textDecoration: "none",
                  fontFamily: F.body,
                }}
              >
                Get started free <span style={{ width: 16, height: 16, display: "block" }}>{ARR}</span>
              </Link>
            </>
          )}
          {showApiKeyCta && apiKeyCtaHref && (
            <Link
              href={apiKeyCtaHref}
              onClick={() => setMobileMenu(false)}
              style={{
                marginTop: 8,
                height: 50,
                borderRadius: 12,
                background: "#eeedfb",
                color: "#4a3fb0",
                border: "1px solid #c7c2ea",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 15,
                fontWeight: 680,
                textDecoration: "none",
                fontFamily: F.body,
              }}
            >
              Get an API key
            </Link>
          )}
        </div>
      )}
    </>
  );
}
