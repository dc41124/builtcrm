"use client";

// Step 64 — Integration gallery body, card, and consent-mockup modal.
// One file because the three pieces are tightly coupled (state lives
// in the body; cards open the modal). Used by:
//   - /contractor/integrations              (portal — variant="portal")
//   - /integrations                         (public marketing — variant="public")
//
// The body is presentational. Catalog data is imported from
// @/lib/integrations/galleryCatalog so the data + the rendering can
// evolve independently.

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  getCatalogCounts,
  INTEGRATION_CATALOG,
  INTEGRATION_CATEGORIES,
  INTEGRATION_SCOPES,
  scopeLabel,
  type IntegrationCategoryId,
  type IntegrationEntry,
} from "@/lib/integrations/galleryCatalog";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

const I = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  ext: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" /></svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
  ),
  cog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
  ),
};

const STATE_META: Record<
  IntegrationEntry["state"],
  { label: string; bg: string; fg: string; border: string; dot: string }
> = {
  connected: { label: "Connected", bg: "#edf7f1", fg: "#1e6b46", border: "#a7d9be", dot: "#2d8a5e" },
  available: { label: "Available", bg: "#eeedfb", fg: "#4a3fb0", border: "#c7c2ea", dot: "#5b4fc7" },
  soon:      { label: "Coming soon", bg: "#f3f4f6", fg: "#9c958a", border: "#e2e5e9", dot: "#d1d5db" },
};

/** Where the contractor portal version of this gallery lives. The
 *  public marketing variant routes "Sign in to connect" CTAs to /login. */
const PORTAL_INTEGRATIONS_HREF = "/contractor/integrations";

export type GalleryVariant = "portal" | "public";

export function IntegrationsGalleryBody({ variant }: { variant: GalleryVariant }) {
  const isPublic = variant === "public";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IntegrationCategoryId>("all");
  const [showOnlySoon, setShowOnlySoon] = useState(false);
  const [consent, setConsent] = useState<IntegrationEntry | null>(null);

  const filtered = useMemo(() => {
    return INTEGRATION_CATALOG.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (showOnlySoon && c.state !== "soon") return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.name.toLowerCase().includes(s) && !c.desc.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [category, search, showOnlySoon]);

  const counts = getCatalogCounts();
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const cat of INTEGRATION_CATEGORIES) {
      m[cat.id] = cat.id === "all"
        ? INTEGRATION_CATALOG.length
        : INTEGRATION_CATALOG.filter((c) => c.category === cat.id).length;
    }
    return m;
  }, []);

  const surfaceBg = isPublic ? "#fff" : "var(--surface-1, #ffffff)";
  const surfaceBorder = isPublic ? "#eeece8" : "var(--surface-3, #e2e5e9)";
  const altBg = isPublic ? "#f3f1ec" : "var(--surface-2, #f3f4f6)";
  const textPrimary = isPublic ? "#1a1714" : "var(--text-primary, #1a1714)";
  const textSecondary = isPublic ? "#5e5850" : "var(--text-secondary, #6b655b)";
  const textTertiary = isPublic ? "#928b80" : "var(--text-tertiary, #9c958a)";

  return (
    <div>
      {/* ═══ Header ═══ */}
      <div style={{ marginBottom: 28 }}>
        {isPublic && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px 5px 8px",
              background: "#eeedfb",
              border: "1px solid rgba(91,79,199,.12)",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 620,
              color: "#4a3fb0",
              marginBottom: 16,
              fontFamily: F.body,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5b4fc7" }} />
            Integrations
          </div>
        )}
        <h1
          style={{
            fontFamily: F.display,
            fontSize: isPublic ? 42 : 26,
            fontWeight: isPublic ? 820 : 780,
            letterSpacing: "-.04em",
            margin: 0,
            lineHeight: 1.1,
            color: textPrimary,
          }}
        >
          {isPublic ? "Built to fit the tools you already use" : "Integrations"}
        </h1>
        <p
          style={{
            fontSize: isPublic ? 16 : 13,
            color: textSecondary,
            marginTop: isPublic ? 12 : 6,
            maxWidth: 680,
            fontWeight: 520,
            lineHeight: 1.55,
          }}
        >
          {isPublic
            ? "BuiltCRM connects with the accounting, payment, document, and project-management tools your team relies on. Live integrations are ready today; partner-gated providers ship as we complete app reviews."
            : "Browse the full ecosystem. Connected and Available providers are ready to wire up; Coming-soon providers are partner-gated and notify you when the integration ships."}
        </p>

        {isPublic && (
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 28,
              paddingTop: 24,
              borderTop: `1px solid ${surfaceBorder}`,
            }}
          >
            {[
              { k: "Live integrations", v: counts.connected + counts.available },
              { k: "On the roadmap", v: counts.soon },
              { k: "Categories covered", v: INTEGRATION_CATEGORIES.length - 1 },
            ].map((s) => (
              <div key={s.k}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: 28,
                    fontWeight: 820,
                    letterSpacing: "-.03em",
                    color: "#5b4fc7",
                  }}
                >
                  {s.v}
                </div>
                <div style={{ fontSize: 12, color: textTertiary, fontWeight: 580, marginTop: 2 }}>
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Toolbar ═══ */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: textTertiary,
            }}
          >
            {I.search}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or capability…"
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px 0 36px",
              borderRadius: 10,
              border: `1px solid ${surfaceBorder}`,
              background: surfaceBg,
              color: textPrimary,
              fontSize: 13,
              fontFamily: F.body,
              fontWeight: 520,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowOnlySoon(!showOnlySoon)}
          style={{
            height: 38,
            padding: "0 14px",
            borderRadius: 10,
            border: `1px solid ${showOnlySoon ? "#5b4fc7" : surfaceBorder}`,
            background: showOnlySoon ? "#eeedfb" : surfaceBg,
            color: showOnlySoon ? "#4a3fb0" : textSecondary,
            fontSize: 12.5,
            fontWeight: 620,
            cursor: "pointer",
            fontFamily: F.display,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ width: 12, height: 12, display: "block" }}>{I.filter}</span>
          Coming soon only
          {showOnlySoon && (
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#5b4fc7",
                color: "white",
                display: "grid",
                placeItems: "center",
                fontSize: 8,
                fontWeight: 800,
              }}
            >
              {counts.soon}
            </span>
          )}
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: textTertiary, fontWeight: 520 }}>
          Showing {filtered.length} of {INTEGRATION_CATALOG.length}
        </div>
      </div>

      {/* ═══ Category chip rail ═══ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {INTEGRATION_CATEGORIES.map((cat) => {
          const isSel = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 999,
                border: `1px solid ${isSel ? "#5b4fc7" : surfaceBorder}`,
                background: isSel ? "#5b4fc7" : surfaceBg,
                color: isSel ? "white" : textSecondary,
                fontSize: 12,
                fontWeight: isSel ? 650 : 580,
                cursor: "pointer",
                fontFamily: F.display,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {cat.label}
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isSel ? "rgba(255,255,255,.22)" : altBg,
                  color: isSel ? "white" : textTertiary,
                  fontFamily: F.display,
                }}
              >
                {categoryCounts[cat.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ Card grid ═══ */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "80px 24px",
            textAlign: "center",
            border: `2px dashed ${surfaceBorder}`,
            borderRadius: 16,
          }}
        >
          <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            No integrations match
          </div>
          <div style={{ fontSize: 13, color: textTertiary, fontWeight: 520 }}>
            Try clearing the search or selecting a different category.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))",
            gap: 14,
          }}
        >
          {filtered.map((p) => (
            <IntegrationCard
              key={p.id}
              entry={p}
              variant={variant}
              onComingSoon={() => setConsent(p)}
            />
          ))}
        </div>
      )}

      {/* ═══ Footer note ═══ */}
      <div
        style={{
          marginTop: 36,
          padding: 16,
          border: `1px solid ${surfaceBorder}`,
          borderRadius: 12,
          background: surfaceBg,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ width: 18, height: 18, color: "#5b4fc7", flexShrink: 0, marginTop: 1 }}>
          {I.shield}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: textSecondary,
            fontWeight: 520,
            lineHeight: 1.55,
          }}
        >
          <b style={{ color: textPrimary, fontWeight: 680 }}>Don&apos;t see what you need?</b> Use our public REST API or webhook subscriptions to wire up anything.{" "}
          <a
            href="/api-docs"
            style={{ color: "#5b4fc7", textDecoration: "none", fontWeight: 600 }}
          >
            Read API docs →
          </a>
        </div>
      </div>

      {/* ═══ Consent mockup modal ═══ */}
      {consent && (
        <ConsentMockupModal provider={consent} onClose={() => setConsent(null)} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────────

function IntegrationCard({
  entry,
  variant,
  onComingSoon,
}: {
  entry: IntegrationEntry;
  variant: GalleryVariant;
  onComingSoon: () => void;
}) {
  const isPublic = variant === "public";
  const meta = STATE_META[entry.state];
  const cat = INTEGRATION_CATEGORIES.find((c) => c.id === entry.category);
  const isSoon = entry.state === "soon";
  const isConnected = entry.state === "connected";

  const cardBg = isPublic ? "#fff" : "var(--surface-1, #ffffff)";
  const cardBorder = isPublic
    ? isConnected
      ? "#c7c2ea"
      : "#eeece8"
    : isConnected
      ? "var(--accent-muted, #c7c2ea)"
      : "var(--surface-3, #e2e5e9)";
  const textPrimary = isPublic ? "#1a1714" : "var(--text-primary, #1a1714)";
  const textSecondary = isPublic ? "#5e5850" : "var(--text-secondary, #6b655b)";
  const textTertiary = isPublic ? "#928b80" : "var(--text-tertiary, #9c958a)";
  const altBg = isPublic ? "#f3f1ec" : "var(--surface-2, #f3f4f6)";

  return (
    <div
      style={{
        position: "relative",
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 16,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      {isConnected && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #5b4fc7, #c7c2ea)",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <Logo
          text={entry.logoText}
          bg={entry.logoBg}
          size={44}
          br={12}
          fz={entry.logoFontSize ?? 16}
        />
        <span
          style={{
            height: 22,
            padding: "0 9px",
            borderRadius: 999,
            border: `1px solid ${meta.border}`,
            background: meta.bg,
            color: meta.fg,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            fontWeight: 720,
            fontFamily: F.display,
            textTransform: "uppercase",
            letterSpacing: ".02em",
            flexShrink: 0,
          }}
        >
          {isSoon ? (
            <span style={{ width: 8, height: 8, display: "block" }}>{I.lock}</span>
          ) : (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot }} />
          )}
          {meta.label}
        </span>
      </div>

      <div>
        <h3
          style={{
            fontFamily: F.display,
            fontSize: 15,
            fontWeight: 720,
            letterSpacing: "-.015em",
            margin: 0,
            marginBottom: 4,
            color: textPrimary,
          }}
        >
          {entry.name}
        </h3>
        {cat && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 4,
              background: altBg,
              color: textTertiary,
              fontFamily: F.display,
              textTransform: "uppercase",
              letterSpacing: ".04em",
            }}
          >
            {cat.label}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: textSecondary,
          lineHeight: 1.55,
          fontWeight: 520,
          flex: 1,
        }}
      >
        {entry.desc}
      </div>

      {entry.sandboxNote && (
        <div
          style={{
            fontSize: 11,
            color: textTertiary,
            fontWeight: 520,
            padding: "6px 8px",
            background: isPublic ? "#f9f7f2" : "var(--surface-2, #f3f4f6)",
            borderRadius: 6,
            border: `1px dashed ${isPublic ? "#eeece8" : "var(--surface-3, #e2e5e9)"}`,
          }}
        >
          {entry.sandboxNote}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        {isConnected && (
          <a
            href={isPublic ? "/login" : `${PORTAL_INTEGRATIONS_HREF}/manage/${entry.id}`}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: `1px solid ${isPublic ? "#eeece8" : "var(--surface-3, #e2e5e9)"}`,
              background: cardBg,
              color: textPrimary,
              fontSize: 12,
              fontWeight: 620,
              cursor: "pointer",
              fontFamily: F.display,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
            }}
          >
            <span style={{ width: 12, height: 12, display: "block" }}>{I.cog}</span>
            Manage
          </a>
        )}
        {entry.state === "available" &&
          (isPublic ? (
            <a
              href="/login"
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                border: "none",
                background: "#5b4fc7",
                color: "white",
                fontSize: 12,
                fontWeight: 650,
                cursor: "pointer",
                fontFamily: F.display,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
              }}
            >
              Sign in to connect
            </a>
          ) : (
            <a
              href={`${PORTAL_INTEGRATIONS_HREF}/connect/${entry.id}`}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                border: "none",
                background: "#5b4fc7",
                color: "white",
                fontSize: 12,
                fontWeight: 650,
                cursor: "pointer",
                fontFamily: F.display,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
              }}
            >
              Connect
              <span style={{ width: 12, height: 12, display: "block" }}>{I.arrow}</span>
            </a>
          ))}
        {isSoon && (
          <button
            type="button"
            onClick={onComingSoon}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: `1px solid ${isPublic ? "#eeece8" : "var(--surface-3, #e2e5e9)"}`,
              background: cardBg,
              color: textSecondary,
              fontSize: 12,
              fontWeight: 620,
              cursor: "pointer",
              fontFamily: F.display,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Request access
            <span style={{ width: 12, height: 12, display: "block" }}>{I.arrow}</span>
          </button>
        )}
        <div
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            color: textTertiary,
            fontWeight: 600,
            fontFamily: F.mono,
            letterSpacing: ".02em",
          }}
        >
          {entry.id}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Consent mockup modal
// ────────────────────────────────────────────────────────────────────

function ConsentMockupModal({
  provider,
  onClose,
}: {
  provider: IntegrationEntry;
  onClose: () => void;
}) {
  const scopes = INTEGRATION_SCOPES[provider.id] ?? ["account.read"];
  const [notify, setNotify] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,18,24,.55)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540,
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 16px 48px rgba(26,23,20,.18)",
          border: "1px solid #e2e5e9",
          color: "#1a1714",
          fontFamily: F.body,
        }}
      >
        <div
          style={{
            padding: "22px 24px 18px",
            borderBottom: "1px solid #e2e5e9",
            background: "#f3f4f6",
            borderRadius: "18px 18px 0 0",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#9c958a",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Close"
          >
            <span style={{ width: 14, height: 14, display: "block" }}>{I.x}</span>
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Logo
              text="B"
              bg="linear-gradient(135deg,#2c2541,#5b4fc7)"
              size={48}
              br={14}
              fz={18}
            />
            <Dots />
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                fontFamily: F.display,
                fontSize: 18,
                fontWeight: 800,
                background: provider.accent,
                color: "white",
              }}
            >
              {provider.id.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <h2
            style={{
              fontFamily: F.display,
              fontSize: 18,
              fontWeight: 720,
              letterSpacing: "-.02em",
              margin: 0,
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            BuiltCRM wants to connect to your {provider.name} account
          </h2>
          <p
            style={{
              fontSize: 12.5,
              color: "#6b655b",
              marginTop: 6,
              fontWeight: 520,
              textAlign: "center",
            }}
          >
            Preview of the consent screen you&apos;ll see when this integration ships
          </p>
        </div>

        <div style={{ padding: 24 }}>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 11,
              fontWeight: 720,
              color: "#9c958a",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              marginBottom: 10,
            }}
          >
            BuiltCRM will be able to
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
            {scopes.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid #e2e5e9",
                  borderRadius: 10,
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "#edf7f1",
                    color: "#1e6b46",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ width: 12, height: 12, display: "block" }}>{I.check}</span>
                </div>
                <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 520, color: "#1a1714" }}>
                  {s}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10.5,
                    color: "#9c958a",
                    fontWeight: 580,
                    fontFamily: F.display,
                  }}
                >
                  {scopeLabel(s)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "#fdf4e6",
              border: "1px solid #f5d6a0",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 18,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div style={{ width: 18, height: 18, color: "#96600f", flexShrink: 0, marginTop: 1 }}>
              {I.lock}
            </div>
            <div>
              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#96600f",
                  marginBottom: 4,
                }}
              >
                This integration isn&apos;t ready yet
              </div>
              <div style={{ fontSize: 12.5, color: "#6b655b", fontWeight: 520, lineHeight: 1.55 }}>
                Production integration with {provider.name} requires{" "}
                <b style={{ color: "#1a1714" }}>{provider.gateReason ?? "partner approval"}</b>.
                We&apos;re working on it. Sign up below and we&apos;ll email you the moment it
                goes live.
              </div>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 12,
              border: `1px solid ${notify ? "#5b4fc7" : "#e2e5e9"}`,
              borderRadius: 12,
              background: notify ? "#eeedfb" : "#ffffff",
              cursor: "pointer",
              marginBottom: 18,
            }}
          >
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              style={{ accentColor: "#5b4fc7", width: 16, height: 16 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 650 }}>
                Notify me when this is available
              </div>
              <div style={{ fontSize: 11.5, color: "#9c958a", fontWeight: 520, marginTop: 2 }}>
                One email when {provider.name} ships. We won&apos;t send marketing.
              </div>
            </div>
          </label>

          {submitted && (
            <div
              style={{
                marginBottom: 18,
                padding: "10px 12px",
                background: "#edf7f1",
                border: "1px solid #a7d9be",
                borderRadius: 10,
                fontSize: 12.5,
                color: "#1e6b46",
                fontWeight: 580,
                lineHeight: 1.5,
              }}
            >
              Thanks — we&apos;ll let you know when {provider.name} is live.
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e5e9",
            background: "#f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            borderRadius: "0 0 18px 18px",
          }}
        >
          <button
            type="button"
            style={{
              height: 36,
              padding: "0 6px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#9c958a",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: F.display,
            }}
          >
            View {provider.name} site
            <span style={{ width: 11, height: 11, display: "block" }}>{I.ext}</span>
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 10,
                border: "1px solid #e2e5e9",
                background: "#ffffff",
                color: "#6b655b",
                fontSize: 12,
                fontWeight: 620,
                cursor: "pointer",
                fontFamily: F.display,
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (!notify) return;
                setSubmitted(true);
                // V1: no backend wire-up — the toggle persists user intent
                // visually only. Production wire to a signups table when
                // the marketing site grows beyond brochureware.
              }}
              disabled={!notify || submitted}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: notify ? "#5b4fc7" : "#e2e5e9",
                color: "white",
                fontSize: 12,
                fontWeight: 650,
                cursor: notify && !submitted ? "pointer" : "not-allowed",
                fontFamily: F.display,
                opacity: notify && !submitted ? 1 : 0.6,
              }}
            >
              {submitted ? "Thanks" : "Notify me"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", gap: 6, color: "#9c958a" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
    </div>
  );
}

function Logo({
  text,
  bg,
  size,
  br,
  fz,
}: {
  text: string;
  bg: string;
  size: number;
  br: number;
  fz: number;
}): ReactNode {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: bg,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        fontFamily: F.display,
        fontSize: fz,
        fontWeight: 800,
        letterSpacing: "-.02em",
      }}
    >
      {text}
    </div>
  );
}
