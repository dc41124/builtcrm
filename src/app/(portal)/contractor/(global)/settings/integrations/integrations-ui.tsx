"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Modal } from "@/components/modal";
import type {
  ContractorIntegrationsView,
  IntegrationCardRow,
  IntegrationProviderKey,
  OrgProject,
  ProjectMapping,
  SyncEventRow,
} from "@/domain/loaders/integrations";
import { formatMoneyCentsCompact } from "@/lib/format/money";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

const C = {
  surface0: "var(--s0)",
  surface1: "var(--s1)",
  surface2: "var(--s2)",
  surface3: "var(--s3)",
  surface4: "var(--s4)",
  surfaceHover: "var(--sh)",
  textPrimary: "var(--t1)",
  textSecondary: "var(--t2)",
  textTertiary: "var(--t3)",
  accent: "var(--ac)",
  accentHover: "var(--ac-h)",
  accentSoft: "var(--ac-s)",
  accentText: "var(--ac-t)",
  accentMuted: "var(--ac-s)",
  success: "var(--ok)",
  successSoft: "var(--ok-s)",
  successText: "var(--ok-t)",
  warning: "var(--wr)",
  warningSoft: "var(--wr-s)",
  warningText: "var(--wr-t)",
  danger: "var(--dg)",
  dangerSoft: "var(--dg-s)",
  dangerText: "var(--dg-t)",
  info: "var(--in)",
  infoSoft: "var(--in-s)",
  infoText: "var(--in-t)",
};

// ── Provider presentation ──────────────────────────────────────────────
type ProviderPresentation = {
  logo: ReactNode;
  providerLabel: string;
  connectLabel: string;
};

const PROVIDER_LOGOS: Record<IntegrationProviderKey, ProviderPresentation> = {
  quickbooks_online: {
    providerLabel: "Accounting · Intuit",
    connectLabel: "Connect QuickBooks",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#2ca01c,#108a00)")}>
        <span style={logoText(19)}>QB</span>
      </div>
    ),
  },
  xero: {
    providerLabel: "Accounting · Xero Limited",
    connectLabel: "Connect Xero",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#13b5ea,#0d9dd5)")}>
        <span style={logoText(18)}>X</span>
      </div>
    ),
  },
  sage_business_cloud: {
    providerLabel: "Accounting · Sage Group",
    connectLabel: "Connect Sage",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#00d639,#00b62f)")}>
        <span style={logoText(18)}>S</span>
      </div>
    ),
  },
  stripe: {
    providerLabel: "Payment processing · ACH & Card",
    connectLabel: "Connect Stripe",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#635bff,#4f46d6)")}>
        <span style={logoText(18)}>S</span>
      </div>
    ),
  },
  google_calendar: {
    providerLabel: "iCal feed · Google Calendar",
    connectLabel: "Generate feed URL",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#4285f4,#34a853)")}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
    ),
  },
  outlook_365: {
    providerLabel: "Calendar · Microsoft 365",
    connectLabel: "Connect Outlook",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#0078d4,#106ebe)")}>
        <span style={logoText(17)}>O</span>
      </div>
    ),
  },
  postmark: {
    providerLabel: "Transactional email · Reply-by-email",
    connectLabel: "Connect Postmark",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#f59e0b,#d97706)")}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
    ),
  },
  sendgrid: {
    providerLabel: "Transactional email · SendGrid",
    connectLabel: "Connect SendGrid",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#1a82e2,#0d6bc5)")}>
        <span style={logoText(16)}>SG</span>
      </div>
    ),
  },
};

function logoBox(bg: string): CSSProperties {
  return {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: bg,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  };
}
function logoText(size: number): CSSProperties {
  return {
    color: "white",
    fontFamily: F.display,
    fontSize: size,
    fontWeight: 800,
    letterSpacing: "-.02em",
  };
}

// ── Root ─────────────────────────────────────────────────────────────────
export function IntegrationsView({
  view,
  nowMs,
}: {
  view: ContractorIntegrationsView;
  nowMs: number;
}) {
  const canManage = view.context.role === "contractor_admin";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        fontFamily: F.body,
        color: C.textPrimary,
      }}
    >
      <PageHeader
        title="Integrations"
        subtitle="Connect your accounting, payment, and productivity tools. Integrations sync automatically — no manual data entry required."
      />
      <OAuthReturnBanner />
      <IntegrationsSection view={view} canManage={canManage} nowMs={nowMs} />
    </div>
  );
}

// OAuth callback from Step 25 redirects back here with
// ?provider=…&oauth=connected|failed&reason=…. Show a flash banner once,
// then clean the query string so a refresh doesn't re-show it.
function OAuthReturnBanner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const provider = search.get("provider");
  const oauth = search.get("oauth");
  const reason = search.get("reason");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!provider || !oauth) return;
    // Defer the URL clean-up to the next tick so the effect doesn't race
    // with the state we just read.
    const t = window.setTimeout(() => {
      router.replace(pathname);
    }, 0);
    return () => window.clearTimeout(t);
  }, [provider, oauth, router, pathname]);

  if (dismissed || !provider || !oauth) return null;

  const success = oauth === "connected";
  const label = providerCatalogName(provider);
  return (
    <div
      role="status"
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: success ? C.successSoft : C.dangerSoft,
        border: `1px solid ${success ? C.success : C.danger}33`,
        color: success ? C.successText : C.dangerText,
        fontSize: 13,
        fontWeight: 560,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        {success
          ? `${label} connected. First sync will run shortly.`
          : `${label} connection failed${reason ? ` — ${reason}` : ""}. Please try again or contact support.`}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontWeight: 620,
          fontSize: 18,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function providerCatalogName(key: string): string {
  switch (key) {
    case "quickbooks_online":
      return "QuickBooks Online";
    case "xero":
      return "Xero";
    case "sage_business_cloud":
      return "Sage Business Cloud";
    case "stripe":
      return "Stripe Connect";
    case "google_calendar":
      return "Google Calendar";
    case "outlook_365":
      return "Outlook / Microsoft 365";
    case "postmark":
      return "Postmark";
    case "sendgrid":
      return "SendGrid";
    default:
      return key;
  }
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h1
        style={{
          fontFamily: F.display,
          fontSize: 26,
          fontWeight: 820,
          letterSpacing: "-.035em",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 14,
          color: C.textSecondary,
          marginTop: 6,
          marginBottom: 0,
          maxWidth: 680,
          fontWeight: 520,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

// ── Integrations section ─────────────────────────────────────────────────
function IntegrationsSection({
  view,
  canManage,
  nowMs,
}: {
  view: ContractorIntegrationsView;
  canManage: boolean;
  nowMs: number;
}) {
  const isCardConnected = (c: IntegrationCardRow) =>
    c.connection != null &&
    c.connection.status !== "disconnected" &&
    c.connection.status !== "error";

  const connectedCards = view.cards.filter(isCardConnected);
  const connectedCount = connectedCards.length;

  // Default to the first connected card if any; otherwise fall back to the
  // first card in the catalog so the detail container is always populated.
  const [selectedProvider, setSelectedProvider] =
    useState<IntegrationProviderKey | null>(
      connectedCards[0]?.provider ?? view.cards[0]?.provider ?? null,
    );
  const [filter, setFilter] = useState<"all" | "connected" | "available">(
    "all",
  );

  const filteredCards = view.cards.filter((c) => {
    if (filter === "all") return true;
    const connected = isCardConnected(c);
    if (filter === "connected") return connected;
    return !connected;
  });

  const selectedCard =
    selectedProvider != null
      ? view.cards.find((c) => c.provider === selectedProvider) ?? null
      : null;

  return (
    <section>
      <FilterTabs
        filter={filter}
        setFilter={setFilter}
        connectedCount={connectedCount}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 20,
        }}
      >
        {filteredCards.map((card) => (
          <IntegrationCard
            key={card.provider}
            card={card}
            canManage={canManage}
            selected={selectedProvider === card.provider}
            onSelect={() =>
              setSelectedProvider(
                selectedProvider === card.provider ? null : card.provider,
              )
            }
            nowMs={nowMs}
          />
        ))}
        {filteredCards.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 32,
              textAlign: "center",
              color: C.textTertiary,
              fontSize: 13,
              fontWeight: 520,
              border: `1px dashed ${C.surface3}`,
              borderRadius: 14,
            }}
          >
            {filter === "connected"
              ? "No integrations connected yet."
              : "No integrations available."}
          </div>
        )}
      </div>

      {selectedCard &&
        (selectedCard.connection ? (
          <IntegrationDetailPanel
            card={selectedCard}
            view={view}
            canManage={canManage}
            nowMs={nowMs}
            onClose={() => setSelectedProvider(null)}
          />
        ) : (
          <NotConnectedPanel
            card={selectedCard}
            canManage={canManage}
            onClose={() => setSelectedProvider(null)}
          />
        ))}
    </section>
  );
}

// ── Not-connected panel (fills the detail container until a connection exists)
function NotConnectedPanel({
  card,
  canManage,
  onClose,
}: {
  card: IntegrationCardRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const presentation = PROVIDER_LOGOS[card.provider];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    // OAuth 2.0 providers (QB / Xero / Sage / Google) + Stripe Connect kick
    // off with a browser navigation to /api/oauth/[provider]/start (Step 25),
    // which 302s to the provider's authorize URL. We never return to this
    // handler — the callback brings the user back to this page with
    // ?oauth=connected|failed query params picked up by OAuthReturnBanner.
    if (card.flow === "oauth2_code" || card.flow === "stripe_connect") {
      setPending(true);
      window.location.href = `/api/oauth/${card.provider}/start`;
      return;
    }
    // flow === 'none' (postmark / sendgrid): legacy stub endpoint. Real wiring
    // lands when those connectors ship.
    setPending(true);
    const res = await fetch("/api/integrations/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: card.provider }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "connect_failed");
      return;
    }
    router.refresh();
  }

  const benefits = providerBenefits(card.provider);

  return (
    <div
      style={{
        marginTop: 24,
        background: C.surface1,
        border: `1px solid ${C.surface3}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(26,23,20,.06)",
      }}
    >
      <div
        style={{
          padding: 20,
          borderBottom: `1px solid ${C.surface3}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flex: 1,
            minWidth: 260,
          }}
        >
          {presentation.logo}
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontFamily: F.display,
                fontSize: 17,
                fontWeight: 720,
                letterSpacing: "-.015em",
                margin: 0,
              }}
            >
              {card.name}
            </h3>
            <div
              style={{
                fontSize: 12,
                color: C.textSecondary,
                marginTop: 3,
                fontWeight: 520,
              }}
            >
              {presentation.providerLabel}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button
            disabled={!canManage || pending}
            onClick={connect}
            style={btnPrimary(canManage && !pending)}
          >
            {pending ? "Connecting…" : presentation.connectLabel}
          </button>
          <button onClick={onClose} style={smBtnStyle(false)}>
            Close
          </button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        <div
          style={{
            fontSize: 14,
            color: C.textSecondary,
            fontWeight: 520,
            lineHeight: 1.55,
            marginBottom: 20,
            maxWidth: 780,
          }}
        >
          {card.description}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {benefits.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "14px 14px",
                background: C.surface2,
                border: `1px solid ${C.surface3}`,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: C.accentSoft,
                  color: C.accentText,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontFamily: F.display,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 13, fontWeight: 520, lineHeight: 1.5 }}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: 13,
                    fontWeight: 650,
                    marginBottom: 3,
                  }}
                >
                  {b.title}
                </div>
                <div style={{ color: C.textSecondary }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={pillStyle("gray")}>{card.minTier}</span>
          {card.phase1 || card.provider === "stripe" ? (
            <span style={pillStyle("green")}>Available</span>
          ) : card.flow === "oauth2_code" ? (
            <span style={pillStyle("orange")}>Sandbox</span>
          ) : (
            <span style={pillStyle("orange")}>Stub · Phase 2</span>
          )}
          <span
            style={{
              fontSize: 12,
              color: C.textTertiary,
              fontWeight: 520,
            }}
          >
            {card.flow === "oauth2_code" && !card.phase1 && card.provider !== "stripe"
              ? "Sandbox connection only — production sync requires provider app review."
              : "No data will sync until you connect."}
          </span>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: C.dangerText,
              fontWeight: 520,
            }}
          >
            {error}
          </div>
        )}

        {!canManage && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: C.textTertiary,
              fontWeight: 520,
            }}
          >
            Only organization admins can connect integrations.
          </div>
        )}
      </div>
    </div>
  );
}

function providerBenefits(
  provider: IntegrationProviderKey,
): Array<{ title: string; desc: string }> {
  switch (provider) {
    case "quickbooks_online":
    case "xero":
    case "sage_business_cloud":
      return [
        {
          title: "Auto-push invoices",
          desc: "Approved draws become invoices in your accounting system, with the correct customer and job mapping.",
        },
        {
          title: "Pull payment confirmations",
          desc: "When customers pay the invoice in your accounting system, the matching draw is automatically marked paid.",
        },
        {
          title: "Reconciliation loop",
          desc: "Daily reconciliation compares BuiltCRM and the accounting system and surfaces discrepancies for review.",
        },
      ];
    case "stripe":
      return [
        {
          title: "ACH + card payments",
          desc: "Accept bank transfers (0.8% capped at $5) and credit/debit cards (2.9% + $0.30) on draw invoices.",
        },
        {
          title: "Direct payouts",
          desc: "Funds route to your connected Stripe account on your chosen payout schedule.",
        },
        {
          title: "Reconciled automatically",
          desc: "Successful payments update the draw status to Paid without any manual bookkeeping.",
        },
      ];
    case "google_calendar":
    case "outlook_365":
      return [
        {
          title: "Milestones on your calendar",
          desc: "Project milestones, inspections, and deadlines become calendar events you can subscribe to.",
        },
        {
          title: "iCal feed URL",
          desc: "Generate a private iCal URL to subscribe from Google, Outlook, or Apple Calendar — updates automatically.",
        },
        {
          title: "Per-project calendars",
          desc: "Optionally split calendars per project so teams subscribe only to what's relevant to them.",
        },
      ];
    case "postmark":
    case "sendgrid":
      return [
        {
          title: "Transactional email",
          desc: "Reliable delivery of RFI, approval, draw, and message notifications to all stakeholders.",
        },
        {
          title: "Reply-by-email",
          desc: "Recipients can reply directly from their inbox and their response is posted back into BuiltCRM.",
        },
        {
          title: "Delivery visibility",
          desc: "Track opens, bounces, and replies so you know whether a message was received and read.",
        },
      ];
    default:
      return [
        {
          title: "Bidirectional sync",
          desc: "Keep data consistent between BuiltCRM and this external system.",
        },
      ];
  }
}

function FilterTabs({
  filter,
  setFilter,
  connectedCount,
}: {
  filter: "all" | "connected" | "available";
  setFilter: (f: "all" | "connected" | "available") => void;
  connectedCount: number;
}) {
  const tabs: Array<{
    key: "all" | "connected" | "available";
    label: string;
  }> = [
    { key: "all", label: "All integrations" },
    { key: "connected", label: "Connected" },
    { key: "available", label: "Available" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter integrations"
      style={{
        display: "inline-flex",
        gap: 4,
        background: C.surface2,
        borderRadius: 14,
        padding: 4,
      }}
    >
      {tabs.map((t) => {
        const active = filter === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => setFilter(t.key)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: active ? 650 : 620,
              fontFamily: F.display,
              color: active ? C.textPrimary : C.textSecondary,
              background: active ? C.surface1 : "transparent",
              boxShadow: active ? "0 1px 3px rgba(26,23,20,.06)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {t.key === "connected" && (
              <span
                style={{
                  minWidth: 18,
                  height: 16,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: C.accentSoft,
                  color: C.accentText,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: F.display,
                }}
              >
                {connectedCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Integration card ────────────────────────────────────────────────────
function IntegrationCard({
  card,
  canManage,
  selected,
  onSelect,
  nowMs,
}: {
  card: IntegrationCardRow;
  canManage: boolean;
  selected: boolean;
  onSelect: () => void;
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presentation = PROVIDER_LOGOS[card.provider];
  const connection = card.connection;
  const isConnected =
    connection != null &&
    connection.status !== "disconnected" &&
    connection.status !== "error";

  async function connect(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    // OAuth 2.0 + Stripe Connect kick off with a browser navigation to the
    // Step-25 start route. The callback brings us back with a query-string
    // result that OAuthReturnBanner picks up.
    if (card.flow === "oauth2_code" || card.flow === "stripe_connect") {
      setPending(true);
      window.location.href = `/api/oauth/${card.provider}/start`;
      return;
    }
    // flow === 'none' — stubbed in-place connect for postmark/sendgrid.
    setPending(true);
    const res = await fetch("/api/integrations/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: card.provider }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  const borderColor = selected
    ? C.accent
    : isConnected
      ? C.accentMuted
      : C.surface3;

  const expiringSoon = isTokenExpiringSoon(connection, nowMs);
  const isSandbox =
    card.flow === "oauth2_code" && !card.phase1 && card.provider !== "stripe";

  // Context pills computed from real data.
  const contextPills: Array<{ text: string; tone?: "green" | "orange" }> = [];
  if (isConnected && connection) {
    if (expiringSoon) {
      // Show expiring warning first so it's the most prominent signal.
      contextPills.push({ text: "Token expiring soon", tone: "orange" });
    } else if (
      connection.consecutiveErrors === 0 &&
      !connection.lastErrorMessage
    ) {
      contextPills.push({ text: "Healthy", tone: "green" });
    }
    if (connection.projectMappings.length > 0) {
      contextPills.push({
        text: `${connection.projectMappings.length} project${connection.projectMappings.length === 1 ? "" : "s"} mapped`,
      });
    }
    const totalSyncs = connection.pushCount + connection.pullCount;
    if (totalSyncs > 0) {
      contextPills.push({ text: `${totalSyncs} sync${totalSyncs === 1 ? "" : "s"}` });
    }
  }

  return (
    <div
      onClick={onSelect}
      style={{
        background: C.surface1,
        border: `1px solid ${borderColor}`,
        borderRadius: 18,
        padding: 24,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 200ms",
        boxShadow: selected ? "0 4px 16px rgba(91,79,199,.12)" : "none",
        display: "flex",
        flexDirection: "column",
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
            background: `linear-gradient(90deg,${C.accent},${C.accentMuted})`,
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {presentation.logo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-.015em",
              lineHeight: 1.25,
            }}
          >
            {card.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.textTertiary,
              marginTop: 4,
              fontWeight: 520,
              lineHeight: 1.35,
            }}
          >
            {presentation.providerLabel}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 13,
          color: C.textSecondary,
          lineHeight: 1.55,
          marginBottom: 18,
          fontWeight: 520,
          minHeight: 80,
        }}
      >
        {card.description}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: isConnected ? C.success : C.surface4,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 650,
            color: isConnected ? C.successText : C.textTertiary,
          }}
        >
          {statusLabel(card)}
        </span>
        {connection?.lastSyncAt && (
          <span
            style={{
              fontSize: 11.5,
              color: C.textTertiary,
              marginLeft: "auto",
              fontWeight: 520,
            }}
          >
            {formatRelative(connection.lastSyncAt, nowMs)}
          </span>
        )}
      </div>
      {isConnected && contextPills.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {contextPills.map((p, i) => (
            <span key={i} style={pillStyle(p.tone ?? "gray")}>
              {p.text}
            </span>
          ))}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={pillStyle("gray")}>{card.minTier}</span>
        {card.phase1 || card.provider === "stripe" ? (
          <span style={pillStyle("green")}>Available</span>
        ) : isSandbox ? (
          <span style={pillStyle("orange")}>Sandbox</span>
        ) : (
          <span style={pillStyle("orange")}>Stub · Phase 2</span>
        )}
        <div style={{ flex: 1 }} />
        {!isConnected && (
          <button
            disabled={!canManage || pending}
            onClick={connect}
            style={btnPrimary(canManage && !pending)}
          >
            {pending ? "Connecting…" : presentation.connectLabel}
          </button>
        )}
      </div>
      {isSandbox && !isConnected && (
        <div
          style={{
            fontSize: 10.5,
            color: C.textTertiary,
            marginTop: 10,
            fontWeight: 520,
            lineHeight: 1.45,
          }}
        >
          Sandbox connection only — production sync requires provider app
          review.
        </div>
      )}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: C.dangerText,
            marginTop: 8,
            fontWeight: 520,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function statusLabel(card: IntegrationCardRow): string {
  const s = card.connection?.status;
  if (s === "connected") return "Connected";
  if (s === "needs_reauth") return "Needs re-auth";
  if (s === "error") return "Error";
  if (s === "connecting") return "Connecting…";
  return "Not connected";
}

// Token is "expiring soon" when its remaining lifetime is under 24 hours.
// Populated only for OAuth 2.0 providers (QB / Xero / Sage / Google);
// postmark, sendgrid, and Stripe Connect have null tokenExpiresAt.
const EXPIRY_WARNING_MS = 24 * 60 * 60 * 1000;
function isTokenExpiringSoon(
  connection: { tokenExpiresAt: Date | null } | null,
  nowMs: number,
): boolean {
  if (!connection?.tokenExpiresAt) return false;
  const remaining = connection.tokenExpiresAt.getTime() - nowMs;
  return remaining > 0 && remaining < EXPIRY_WARNING_MS;
}

function formatRelative(d: Date | string, now: number): string {
  const when = typeof d === "string" ? new Date(d) : d;
  const mins = Math.round((now - when.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// ── Integration detail panel (4-tab) ────────────────────────────────────
type DetailTab = "overview" | "mapping" | "activity" | "settings";

function IntegrationDetailPanel({
  card,
  view,
  canManage,
  onClose,
  nowMs,
}: {
  card: IntegrationCardRow;
  view: ContractorIntegrationsView;
  canManage: boolean;
  onClose: () => void;
  nowMs: number;
}) {
  const presentation = PROVIDER_LOGOS[card.provider];
  const connection = card.connection;
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [syncPending, setSyncPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (!connection) return null;

  const events = view.recentSyncEvents.filter(
    (e) => e.connectionId === connection.id,
  );

  async function syncNow() {
    if (!connection) return;
    setSyncPending(true);
    setActionError(null);
    const res = await fetch(`/api/integrations/${connection.id}/sync-now`, {
      method: "POST",
    });
    setSyncPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.message ?? body.error ?? "sync_failed");
      return;
    }
    router.refresh();
  }

  async function disconnect() {
    if (!connection) return;
    setSyncPending(true);
    setActionError(null);
    const res = await fetch(
      `/api/integrations/${connection.id}/disconnect`,
      { method: "POST" },
    );
    setSyncPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.message ?? body.error ?? "disconnect_failed");
      return;
    }
    setConfirmDisconnect(false);
    router.refresh();
  }

  const accountIdLabel = providerAccountLabel(card.provider);

  return (
    <div
      style={{
        marginTop: 24,
        background: C.surface1,
        border: `1px solid ${C.surface3}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(26,23,20,.06)",
      }}
    >
      <div
        style={{
          padding: 20,
          borderBottom: `1px solid ${C.surface3}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 260 }}
        >
          {presentation.logo}
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontFamily: F.display,
                fontSize: 17,
                fontWeight: 720,
                letterSpacing: "-.015em",
                margin: 0,
              }}
            >
              {card.name}
            </h3>
            <div
              style={{
                fontSize: 12,
                color: C.textSecondary,
                marginTop: 3,
                fontWeight: 520,
              }}
            >
              {connection.externalAccountName ? (
                <>
                  Connected to &quot;{connection.externalAccountName}&quot;
                  {connection.externalAccountId && (
                    <>
                      {" "}· {accountIdLabel}:{" "}
                      <span style={{ fontFamily: F.mono, fontSize: 11 }}>
                        {connection.externalAccountId}
                      </span>
                    </>
                  )}
                </>
              ) : (
                presentation.providerLabel
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button
            onClick={syncNow}
            disabled={!canManage || syncPending}
            style={smBtnStyle(false)}
          >
            {syncPending ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={() => setTab("mapping")}
            disabled={!canManage}
            style={smBtnStyle(false)}
          >
            Edit mapping
          </button>
          <button
            onClick={() => setConfirmDisconnect(true)}
            disabled={!canManage || syncPending}
            style={smBtnStyle(true)}
          >
            Disconnect
          </button>
          <button onClick={onClose} style={smBtnStyle(false)}>
            Close
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        <DetailTabBar tab={tab} setTab={setTab} />
      </div>

      <div style={{ padding: 20 }}>
        {actionError && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              background: C.dangerSoft,
              border: `1px solid ${C.danger}33`,
              borderRadius: 10,
              fontSize: 12,
              color: C.dangerText,
              fontWeight: 520,
            }}
          >
            {actionError}
          </div>
        )}

        {tab === "overview" && (
          <OverviewTab
            card={card}
            projects={view.projects}
            events={events}
            nowMs={nowMs}
            onEditMapping={() => setTab("mapping")}
            onViewAllActivity={() => setTab("activity")}
          />
        )}
        {tab === "mapping" && (
          <ProjectMappingTab
            card={card}
            projects={view.projects}
            canManage={canManage}
          />
        )}
        {tab === "activity" && <SyncActivityTab events={events} nowMs={nowMs} />}
        {tab === "settings" && (
          <SettingsTab card={card} canManage={canManage} />
        )}

        {!card.phase1 && card.provider !== "stripe" && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: C.warningSoft,
              border: `1px solid ${C.warning}33`,
              borderRadius: 10,
              fontSize: 12,
              color: C.warningText,
              fontWeight: 520,
            }}
          >
            {card.flow === "oauth2_code"
              ? "Sandbox connection only — the OAuth handshake and token lifecycle are live, but production data sync requires provider app review."
              : "Stub connector — full OAuth and sync loops ship with the provider's Phase 2 release."}
          </div>
        )}

        {!canManage && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: C.textTertiary,
              fontWeight: 520,
            }}
          >
            Only organization admins can change integration settings.
          </div>
        )}
      </div>

      <Modal
        open={confirmDisconnect}
        onClose={() => (syncPending ? undefined : setConfirmDisconnect(false))}
        title={`Disconnect ${card.name}?`}
        subtitle={
          connection.externalAccountName
            ? `This revokes the connection to "${connection.externalAccountName}" and clears the stored tokens. Past sync history is kept.`
            : `This revokes the stored credentials. Past sync history is kept.`
        }
        width={460}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={() => setConfirmDisconnect(false)}
              disabled={syncPending}
              style={smBtnStyle(false)}
            >
              Cancel
            </button>
            <button
              onClick={disconnect}
              disabled={syncPending}
              style={{
                ...smBtnStyle(true),
                background: C.danger,
                color: "#fff",
                borderColor: C.danger,
              }}
            >
              {syncPending ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        }
      >
        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55 }}>
          You can reconnect at any time — sync mappings and preferences are
          preserved across reconnects. Any in-flight sync will be allowed to
          finish and then stop.
        </div>
      </Modal>
    </div>
  );
}

function DetailTabBar({
  tab,
  setTab,
}: {
  tab: DetailTab;
  setTab: (t: DetailTab) => void;
}) {
  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "mapping", label: "Project mapping" },
    { key: "activity", label: "Sync activity" },
    { key: "settings", label: "Settings" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Integration sections"
      style={{
        display: "inline-flex",
        gap: 4,
        background: C.surface2,
        borderRadius: 14,
        padding: 4,
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t.key)}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: active ? 650 : 620,
              fontFamily: F.display,
              color: active ? C.textPrimary : C.textSecondary,
              background: active ? C.surface1 : "transparent",
              boxShadow: active ? "0 1px 3px rgba(26,23,20,.06)" : "none",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function providerAccountLabel(provider: IntegrationProviderKey): string {
  switch (provider) {
    case "quickbooks_online":
      return "Realm ID";
    case "xero":
      return "Tenant ID";
    case "stripe":
      return "Account ID";
    case "google_calendar":
    case "outlook_365":
      return "Calendar ID";
    default:
      return "External ID";
  }
}

// ── Overview tab ────────────────────────────────────────────────────────
function OverviewTab({
  card,
  projects,
  events,
  nowMs,
  onEditMapping,
  onViewAllActivity,
}: {
  card: IntegrationCardRow;
  projects: OrgProject[];
  events: SyncEventRow[];
  nowMs: number;
  onEditMapping: () => void;
  onViewAllActivity: () => void;
}) {
  return (
    <div>
      <OverviewStats card={card} nowMs={nowMs} />
      <OverviewProjectMapping
        card={card}
        projects={projects}
        onEdit={onEditMapping}
      />
      <OverviewRecentActivity
        events={events}
        nowMs={nowMs}
        onViewAll={onViewAllActivity}
      />
    </div>
  );
}

function OverviewStats({
  card,
  nowMs,
}: {
  card: IntegrationCardRow;
  nowMs: number;
}) {
  const connection = card.connection!;
  const healthy =
    connection.status === "connected" && connection.consecutiveErrors === 0;
  const statusMeta =
    connection.lastErrorMessage ??
    (connection.consecutiveErrors > 0
      ? `${connection.consecutiveErrors} consecutive error(s)`
      : healthy
        ? "0 errors in last 7 days"
        : "Awaiting next sync");

  const { pushLabel, pullLabel } = countLabels(card.provider);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
      }}
    >
      <StatCard
        label="Status"
        value={healthy ? "Healthy" : statusLabel(card)}
        meta={statusMeta}
        tone={
          connection.status === "connected"
            ? "success"
            : connection.status === "error"
              ? "danger"
              : "neutral"
        }
      />
      <StatCard
        label="Last sync"
        value={
          connection.lastSyncAt
            ? formatRelative(connection.lastSyncAt, nowMs)
            : "Never"
        }
        meta={
          connection.connectedAt
            ? `Connected ${formatRelative(connection.connectedAt, nowMs)}`
            : "Not yet connected"
        }
      />
      <StatCard
        label={pushLabel.label}
        value={String(connection.pushCount)}
        meta={pushLabel.meta}
      />
      <StatCard
        label={pullLabel.label}
        value={String(connection.pullCount)}
        meta={pullLabel.meta}
      />
    </div>
  );
}

// Read-only mapping preview inside Overview. Click "Add mapping" or row click
// routes into the full Project mapping tab for edits.
function OverviewProjectMapping({
  card,
  projects,
  onEdit,
}: {
  card: IntegrationCardRow;
  projects: OrgProject[];
  onEdit: () => void;
}) {
  const connection = card.connection!;
  const mappings = connection.projectMappings;
  const customerHeader = providerCustomerHeader(card.provider);

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 720,
              letterSpacing: "-.01em",
              margin: 0,
            }}
          >
            Project mapping
          </h3>
          <div
            style={{
              fontSize: 12,
              color: C.textSecondary,
              marginTop: 2,
              fontWeight: 520,
            }}
          >
            BuiltCRM projects matched to {card.name} {customerHeader.toLowerCase()}.
          </div>
        </div>
        <button onClick={onEdit} style={smBtnStyle(false)}>
          {mappings.length === 0 ? "Add mapping" : "Edit mapping"}
        </button>
      </div>

      {mappings.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: C.textTertiary,
            fontSize: 12.5,
            fontWeight: 520,
            border: `1px dashed ${C.surface3}`,
            borderRadius: 12,
          }}
        >
          No project mappings yet. Click &quot;Add mapping&quot; to start syncing.
        </div>
      ) : (
        <div
          style={{
            overflow: "hidden",
            border: `1px solid ${C.surface3}`,
            borderRadius: 14,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "BuiltCRM Project",
                  "",
                  `${customerHeader} / Job`,
                  "Status",
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "left",
                      fontFamily: F.display,
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.textTertiary,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      padding: "8px 12px",
                      borderBottom: `2px solid ${C.surface3}`,
                      background: C.surface2,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => {
                const project = projects.find((p) => p.id === m.projectId);
                const hasExternal =
                  !!m.externalCustomerName || !!m.externalJobId;
                return (
                  <tr
                    key={`${m.projectId}-${i}`}
                    onClick={onEdit}
                    style={{ cursor: "pointer" }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: F.display,
                          fontWeight: 650,
                        }}
                      >
                        {project?.name ?? "Unknown project"}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.textTertiary,
                          marginTop: 2,
                          fontWeight: 520,
                        }}
                      >
                        {project?.clientSubtype
                          ? `${project.clientSubtype} · ${formatMoney(project.contractValueCents)}`
                          : formatMoney(project?.contractValueCents ?? null)}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                        color: C.textTertiary,
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      →
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                      }}
                    >
                      {hasExternal ? (
                        <span
                          style={{
                            fontFamily: F.mono,
                            fontSize: 12,
                            color: C.accentText,
                            background: C.accentSoft,
                            padding: "2px 8px",
                            borderRadius: 6,
                            display: "inline-block",
                          }}
                        >
                          {m.externalCustomerName ?? "—"}
                          {m.externalJobId ? ` : ${m.externalJobId}` : ""}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: C.textTertiary,
                            fontStyle: "italic",
                            fontWeight: 520,
                          }}
                        >
                          Unmapped
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                      }}
                    >
                      <span
                        style={pillStyle(hasExternal ? "green" : "orange")}
                      >
                        {hasExternal ? "Synced" : "Needs setup"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverviewRecentActivity({
  events,
  nowMs,
  onViewAll,
}: {
  events: SyncEventRow[];
  nowMs: number;
  onViewAll: () => void;
}) {
  const preview = events.slice(0, 6);
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 720,
              letterSpacing: "-.01em",
              margin: 0,
            }}
          >
            Recent sync activity
          </h3>
          <div
            style={{
              fontSize: 12,
              color: C.textSecondary,
              marginTop: 2,
              fontWeight: 520,
            }}
          >
            Last {preview.length} sync operation{preview.length === 1 ? "" : "s"}
          </div>
        </div>
        {events.length > preview.length && (
          <button onClick={onViewAll} style={smBtnStyle(false)}>
            View all
          </button>
        )}
      </div>

      {preview.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: C.textTertiary,
            fontSize: 12.5,
            fontWeight: 520,
            border: `1px dashed ${C.surface3}`,
            borderRadius: 12,
          }}
        >
          No sync events recorded for this connection yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {preview.map((e) => {
            const sym =
              e.syncDirection === "push"
                ? "↑"
                : e.syncDirection === "pull"
                  ? "↓"
                  : "✓";
            const ok = /success|ok|completed|succeeded/i.test(
              e.syncEventStatus,
            );
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  border: `1px solid ${C.surface3}`,
                  borderRadius: 10,
                  background: C.surface1,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    background: ok ? C.successSoft : C.dangerSoft,
                    color: ok ? C.successText : C.dangerText,
                  }}
                >
                  {sym}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 13,
                      fontWeight: 650,
                    }}
                  >
                    {e.entityType ?? e.syncDirection} · {e.syncEventStatus}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textSecondary,
                      lineHeight: 1.45,
                      marginTop: 2,
                      fontWeight: 520,
                    }}
                  >
                    {e.summary ?? e.errorMessage ?? "—"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textTertiary,
                      fontFamily: F.display,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatRelative(e.createdAt, nowMs)}
                  </span>
                  <span style={pillStyle(ok ? "green" : "orange")}>
                    {ok ? "Success" : e.syncEventStatus}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function countLabels(provider: IntegrationProviderKey) {
  switch (provider) {
    case "quickbooks_online":
    case "xero":
    case "sage_business_cloud":
      return {
        pushLabel: { label: "Invoices pushed", meta: "Draws sent to accounting" },
        pullLabel: {
          label: "Payments pulled",
          meta: "Payment confirmations received",
        },
      };
    case "stripe":
      return {
        pushLabel: { label: "Charges initiated", meta: "Payment intents created" },
        pullLabel: {
          label: "Webhooks received",
          meta: "Payment status updates",
        },
      };
    case "google_calendar":
    case "outlook_365":
      return {
        pushLabel: { label: "Events pushed", meta: "Milestones + inspections" },
        pullLabel: {
          label: "Calendar updates",
          meta: "External edits detected",
        },
      };
    case "postmark":
    case "sendgrid":
      return {
        pushLabel: { label: "Emails sent", meta: "Transactional notifications" },
        pullLabel: {
          label: "Replies processed",
          meta: "Reply-by-email ingests",
        },
      };
    default:
      return {
        pushLabel: { label: "Outbound syncs", meta: "BuiltCRM → external" },
        pullLabel: { label: "Inbound syncs", meta: "External → BuiltCRM" },
      };
  }
}

// ── Project mapping tab ─────────────────────────────────────────────────
function ProjectMappingTab({
  card,
  projects,
  canManage,
}: {
  card: IntegrationCardRow;
  projects: OrgProject[];
  canManage: boolean;
}) {
  const router = useRouter();
  const connection = card.connection!;
  const [mappings, setMappings] = useState<ProjectMapping[]>(
    connection.projectMappings,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mappedProjectIds = new Set(mappings.map((m) => m.projectId));
  const unmappedProjects = projects.filter(
    (p) => !mappedProjectIds.has(p.id),
  );

  function updateRow(index: number, patch: Partial<ProjectMapping>) {
    setSaved(false);
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  }

  function addRow(projectId: string) {
    setSaved(false);
    setMappings((prev) => [
      ...prev,
      {
        projectId,
        externalCustomerId: null,
        externalCustomerName: null,
        externalJobId: null,
      },
    ]);
  }

  function removeRow(index: number) {
    setSaved(false);
    setMappings((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const serialised = mappings.map((m) => ({
      project_id: m.projectId,
      external_customer_id: m.externalCustomerId ?? null,
      external_customer_name: m.externalCustomerName ?? null,
      external_job_id: m.externalJobId ?? null,
    }));
    const res = await fetch(`/api/integrations/${connection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mappingConfig: {
          ...(connection.mappingConfig ?? {}),
          project_mappings: serialised,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "save_failed");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const customerHeader = providerCustomerHeader(card.provider);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 720,
              letterSpacing: "-.01em",
              margin: 0,
            }}
          >
            Project mapping
          </h3>
          <div
            style={{
              fontSize: 12,
              color: C.textSecondary,
              marginTop: 2,
              fontWeight: 520,
            }}
          >
            BuiltCRM projects matched to {card.name} {customerHeader.toLowerCase()}.
          </div>
        </div>
        <AddMappingControl
          unmappedProjects={unmappedProjects}
          onAdd={addRow}
          disabled={!canManage || unmappedProjects.length === 0}
        />
      </div>

      <div
        style={{
          overflow: "hidden",
          border: `1px solid ${C.surface3}`,
          borderRadius: 14,
          marginBottom: 14,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[
                "BuiltCRM Project",
                "",
                customerHeader,
                "External job ID",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    fontFamily: F.display,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textTertiary,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    padding: "8px 12px",
                    borderBottom: `2px solid ${C.surface3}`,
                    background: C.surface2,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: C.textTertiary,
                    fontSize: 12.5,
                    fontWeight: 520,
                  }}
                >
                  No project mappings yet. Add one to start syncing.
                </td>
              </tr>
            ) : (
              mappings.map((m, i) => {
                const project = projects.find((p) => p.id === m.projectId);
                return (
                  <tr key={`${m.projectId}-${i}`}>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: F.display,
                          fontWeight: 650,
                        }}
                      >
                        {project?.name ?? "Unknown project"}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.textTertiary,
                          marginTop: 2,
                          fontWeight: 520,
                        }}
                      >
                        {project?.clientSubtype
                          ? `${project.clientSubtype} · ${formatMoney(project.contractValueCents)}`
                          : formatMoney(project?.contractValueCents ?? null)}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                        color: C.textTertiary,
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      →
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                      }}
                    >
                      <input
                        value={m.externalCustomerName ?? ""}
                        disabled={!canManage}
                        placeholder="e.g. Riverside Holdings LLC"
                        onChange={(e) =>
                          updateRow(i, {
                            externalCustomerName: e.target.value || null,
                          })
                        }
                        style={mappingInputStyle()}
                      />
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                      }}
                    >
                      <input
                        value={m.externalJobId ?? ""}
                        disabled={!canManage}
                        placeholder="Job ID"
                        onChange={(e) =>
                          updateRow(i, {
                            externalJobId: e.target.value || null,
                          })
                        }
                        style={{
                          ...mappingInputStyle(),
                          fontFamily: F.mono,
                          fontSize: 12,
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.surface3}`,
                        textAlign: "right",
                      }}
                    >
                      <button
                        disabled={!canManage}
                        onClick={() => removeRow(i)}
                        style={smBtnStyle(true)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {error && (
          <span
            style={{
              fontSize: 12,
              color: C.dangerText,
              fontWeight: 520,
              marginRight: "auto",
            }}
          >
            {error}
          </span>
        )}
        {saved && !error && (
          <span
            style={{
              fontSize: 12,
              color: C.successText,
              fontWeight: 620,
              fontFamily: F.display,
              marginRight: "auto",
            }}
          >
            Mapping saved
          </span>
        )}
        <button
          disabled={!canManage || saving}
          onClick={save}
          style={btnPrimary(canManage && !saving)}
        >
          {saving ? "Saving…" : "Save mapping"}
        </button>
      </div>
    </div>
  );
}

function providerCustomerHeader(provider: IntegrationProviderKey): string {
  switch (provider) {
    case "quickbooks_online":
      return "QuickBooks Customer";
    case "xero":
      return "Xero Contact";
    case "sage_business_cloud":
      return "Sage Customer";
    case "stripe":
      return "Stripe Customer";
    case "google_calendar":
    case "outlook_365":
      return "External Calendar";
    default:
      return "External Account";
  }
}

function AddMappingControl({
  unmappedProjects,
  onAdd,
  disabled,
}: {
  unmappedProjects: OrgProject[];
  onAdd: (projectId: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={smBtnStyle(false)}
      >
        Add mapping {unmappedProjects.length > 0 && `· ${unmappedProjects.length}`}
      </button>
      {open && unmappedProjects.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: 260,
            background: C.surface1,
            border: `1px solid ${C.surface3}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(26,23,20,.1)",
            padding: 6,
            zIndex: 10,
            maxHeight: 280,
            overflow: "auto",
          }}
        >
          {unmappedProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onAdd(p.id);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                border: "none",
                background: "transparent",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 520,
                cursor: "pointer",
                color: C.textPrimary,
                fontFamily: F.body,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = C.surfaceHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div style={{ fontFamily: F.display, fontWeight: 620 }}>
                {p.name}
              </div>
              {p.projectCode && (
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 11,
                    color: C.textTertiary,
                    marginTop: 2,
                  }}
                >
                  {p.projectCode}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function mappingInputStyle(): CSSProperties {
  return {
    height: 32,
    width: "100%",
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${C.surface3}`,
    background: C.surface1,
    color: C.textPrimary,
    fontFamily: F.body,
    fontSize: 13,
    fontWeight: 520,
    outline: "none",
  };
}

const formatMoney = (c: number | null) =>
  c === null || c === undefined ? "—" : formatMoneyCentsCompact(c);

// ── Sync activity tab ───────────────────────────────────────────────────
function SyncActivityTab({
  events,
  nowMs,
}: {
  events: SyncEventRow[];
  nowMs: number;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 720,
              letterSpacing: "-.01em",
              margin: 0,
            }}
          >
            Recent sync activity
          </h3>
          <div
            style={{
              fontSize: 12,
              color: C.textSecondary,
              marginTop: 2,
              fontWeight: 520,
            }}
          >
            Last {Math.min(events.length, 25)} sync operations for this connection
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div
          style={{
            padding: 24,
            border: `1px dashed ${C.surface3}`,
            borderRadius: 12,
            textAlign: "center",
            color: C.textTertiary,
            fontSize: 12.5,
            fontWeight: 520,
          }}
        >
          No sync events recorded for this connection yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {events.slice(0, 25).map((e) => {
            const sym =
              e.syncDirection === "push"
                ? "↑"
                : e.syncDirection === "pull"
                  ? "↓"
                  : "✓";
            const ok = /success|ok|completed|succeeded/i.test(
              e.syncEventStatus,
            );
            const iconBg = ok ? C.successSoft : C.dangerSoft;
            const iconColor = ok ? C.successText : C.dangerText;
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  border: `1px solid ${C.surface3}`,
                  borderRadius: 10,
                  background: C.surface1,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    background: iconBg,
                    color: iconColor,
                  }}
                >
                  {sym}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 13,
                      fontWeight: 650,
                    }}
                  >
                    {e.entityType ?? e.syncDirection} · {e.syncEventStatus}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.textSecondary,
                      lineHeight: 1.45,
                      marginTop: 2,
                      fontWeight: 520,
                    }}
                  >
                    {e.summary ?? e.errorMessage ?? "—"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textTertiary,
                      fontFamily: F.display,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatRelative(e.createdAt, nowMs)}
                  </span>
                  <span style={pillStyle(ok ? "green" : "orange")}>
                    {ok ? "Success" : e.syncEventStatus}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Settings tab ────────────────────────────────────────────────────────
type SyncPrefs = {
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  syncOnApproval: boolean;
  autoCreateCustomers: boolean;
  includeRetainage: boolean;
};

function readPrefs(prefs: Record<string, unknown> | null): SyncPrefs {
  const freq = prefs?.sync_frequency;
  const syncFrequency: SyncPrefs["syncFrequency"] =
    freq === "hourly" || freq === "daily" || freq === "manual"
      ? freq
      : "realtime";
  return {
    syncFrequency,
    syncOnApproval: prefs?.sync_on_approval !== false,
    autoCreateCustomers: prefs?.auto_create_customers === true,
    includeRetainage: prefs?.include_retainage_entries !== false,
  };
}

function SettingsTab({
  card,
  canManage,
}: {
  card: IntegrationCardRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const connection = card.connection!;
  const [prefs, setPrefs] = useState<SyncPrefs>(
    readPrefs(connection.syncPreferences),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SyncPrefs>(key: K, value: SyncPrefs[K]) {
    setSaved(false);
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/integrations/${connection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        syncPreferences: {
          sync_frequency: prefs.syncFrequency,
          sync_on_approval: prefs.syncOnApproval,
          auto_create_customers: prefs.autoCreateCustomers,
          include_retainage_entries: prefs.includeRetainage,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "save_failed");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <h3
        style={{
          fontFamily: F.display,
          fontSize: 15,
          fontWeight: 720,
          letterSpacing: "-.01em",
          margin: "0 0 4px",
        }}
      >
        Sync preferences
      </h3>
      <div
        style={{
          fontSize: 12,
          color: C.textSecondary,
          fontWeight: 520,
          marginBottom: 16,
        }}
      >
        Control how often BuiltCRM exchanges data with {card.name} and what gets synced.
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 620 }}>
        <SettingRow label="Sync frequency">
          <select
            value={prefs.syncFrequency}
            disabled={!canManage}
            onChange={(e) =>
              update(
                "syncFrequency",
                e.target.value as SyncPrefs["syncFrequency"],
              )
            }
            style={mappingInputStyle()}
          >
            <option value="realtime">Realtime (on every change)</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily reconciliation</option>
            <option value="manual">Manual only</option>
          </select>
        </SettingRow>
        <ToggleRow
          label="Push on approval"
          description="Automatically push draws, change orders, and invoices when approved."
          checked={prefs.syncOnApproval}
          onChange={(v) => update("syncOnApproval", v)}
          disabled={!canManage}
        />
        <ToggleRow
          label="Auto-create missing customers"
          description="Create a new customer/contact record if no mapping exists for a project."
          checked={prefs.autoCreateCustomers}
          onChange={(v) => update("autoCreateCustomers", v)}
          disabled={!canManage}
        />
        <ToggleRow
          label="Include retainage entries"
          description="Post retainage holdback and release entries as separate journal lines."
          checked={prefs.includeRetainage}
          onChange={(v) => update("includeRetainage", v)}
          disabled={!canManage}
        />
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {error && (
          <span
            style={{
              fontSize: 12,
              color: C.dangerText,
              fontWeight: 520,
              marginRight: "auto",
            }}
          >
            {error}
          </span>
        )}
        {saved && !error && (
          <span
            style={{
              fontSize: 12,
              color: C.successText,
              fontWeight: 620,
              fontFamily: F.display,
              marginRight: "auto",
            }}
          >
            Preferences saved
          </span>
        )}
        <button
          disabled={!canManage || saving}
          onClick={save}
          style={btnPrimary(canManage && !saving)}
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 16,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontFamily: F.display,
          fontWeight: 650,
          color: C.textPrimary,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 16,
        alignItems: "center",
        padding: "12px 14px",
        border: `1px solid ${C.surface3}`,
        borderRadius: 12,
        background: C.surface1,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            fontFamily: F.display,
            fontWeight: 650,
            color: C.textPrimary,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textSecondary,
            fontWeight: 520,
            marginTop: 2,
            lineHeight: 1.45,
          }}
        >
          {description}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          border: "none",
          background: checked ? C.accent : C.surface4,
          position: "relative",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "background 150ms",
          opacity: disabled ? 0.6 : 1,
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
            transition: "left 150ms",
          }}
        />
      </button>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  tone?: "success" | "danger" | "neutral";
}) {
  const bg =
    tone === "success"
      ? C.successSoft
      : tone === "danger"
        ? C.dangerSoft
        : C.surface2;
  const border =
    tone === "success"
      ? C.success
      : tone === "danger"
        ? C.danger
        : C.surface3;
  const valueColor =
    tone === "success"
      ? C.successText
      : tone === "danger"
        ? C.dangerText
        : C.textPrimary;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          color: C.textTertiary,
          fontWeight: 700,
          fontFamily: F.display,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 18,
          fontWeight: 820,
          letterSpacing: "-.03em",
          marginTop: 4,
          color: valueColor,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: C.textSecondary,
          marginTop: 3,
          fontWeight: 520,
        }}
      >
        {meta}
      </div>
    </div>
  );
}

// ── Buttons and pills ────────────────────────────────────────────────────
function btnPrimary(enabled: boolean): CSSProperties {
  return {
    height: 34,
    padding: "0 14px",
    borderRadius: 10,
    background: enabled ? C.accent : C.accentMuted,
    color: "white",
    border: "none",
    fontFamily: F.display,
    fontSize: 12.5,
    fontWeight: 650,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function smBtnStyle(danger: boolean): CSSProperties {
  return {
    height: 30,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${danger ? C.danger : C.surface3}`,
    background: C.surface1,
    color: danger ? C.dangerText : C.textPrimary,
    fontFamily: F.display,
    fontSize: 12,
    fontWeight: 620,
    cursor: "pointer",
  };
}

function pillStyle(
  tone: "purple" | "green" | "orange" | "gray" | "blue",
): CSSProperties {
  const map: Record<typeof tone, { bg: string; color: string; border: string }> =
    {
      purple: { bg: C.accentSoft, color: C.accentText, border: C.accentMuted },
      green: { bg: C.successSoft, color: C.successText, border: C.success },
      orange: { bg: C.warningSoft, color: C.warningText, border: C.warning },
      gray: { bg: C.surface2, color: C.textTertiary, border: C.surface3 },
      blue: { bg: C.infoSoft, color: C.infoText, border: C.info },
    };
  const s = map[tone];
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    fontFamily: F.display,
    background: s.bg,
    color: s.color,
    border: `1px solid ${s.border}`,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    whiteSpace: "nowrap",
  };
}
