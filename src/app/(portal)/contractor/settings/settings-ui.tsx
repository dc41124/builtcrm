"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type {
  ContractorIntegrationsView,
  IntegrationCardRow,
  IntegrationProviderKey,
} from "@/domain/loaders/integrations";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

const C = {
  surface0: "#eef0f3",
  surface1: "#ffffff",
  surface2: "#f3f4f6",
  surface3: "#e2e5e9",
  surface4: "#d1d5db",
  surfaceHover: "#f5f6f8",
  textPrimary: "#1a1714",
  textSecondary: "#6b655b",
  textTertiary: "#9c958a",
  accent: "#5b4fc7",
  accentHover: "#4f44b3",
  accentSoft: "#eeedfb",
  accentText: "#4a3fb0",
  accentMuted: "#c7c2ea",
  success: "#2d8a5e",
  successSoft: "#edf7f1",
  successText: "#1e6b46",
  warning: "#c17a1a",
  warningSoft: "#fdf4e6",
  warningText: "#96600f",
  danger: "#c93b3b",
  dangerSoft: "#fdeaea",
  dangerText: "#a52e2e",
  info: "#3178b9",
  infoSoft: "#e8f1fa",
  infoText: "#276299",
};

export type TeamMember = {
  userId: string;
  email: string;
  displayName: string | null;
  roleKey: string;
  isPrimary: boolean;
};

// ── Provider presentation (logos, gradients, copy) ──────────────────────
type ProviderPresentation = {
  logo: ReactNode;
  provider: string;
  accent: string;
};

const PROVIDER_LOGOS: Record<IntegrationProviderKey, ProviderPresentation> = {
  quickbooks_online: {
    provider: "Accounting · Intuit",
    accent: "linear-gradient(135deg,#2ca01c,#108a00)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#2ca01c,#108a00)")}>
        <span style={logoText(16)}>QB</span>
      </div>
    ),
  },
  xero: {
    provider: "Accounting · Xero Limited",
    accent: "linear-gradient(135deg,#13b5ea,#0d9dd5)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#13b5ea,#0d9dd5)")}>
        <span style={logoText(13)}>X</span>
      </div>
    ),
  },
  sage_business_cloud: {
    provider: "Accounting · Sage Group",
    accent: "linear-gradient(135deg,#00d639,#00b62f)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#00d639,#00b62f)")}>
        <span style={logoText(13)}>S</span>
      </div>
    ),
  },
  stripe: {
    provider: "Payment processing · ACH & Card",
    accent: "linear-gradient(135deg,#635bff,#4f46d6)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#635bff,#4f46d6)")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 8c0-2 2-3 5-3s5 1 5 3-2 2.5-5 3.5-5 1.5-5 3.5 2 3 5 3 5-1 5-3"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
  },
  google_calendar: {
    provider: "iCal feed · Google / Outlook / Apple",
    accent: "linear-gradient(135deg,#4285f4,#34a853)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#4285f4,#34a853)")}>
        <svg
          width="20"
          height="20"
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
    provider: "Calendar · Microsoft 365",
    accent: "linear-gradient(135deg,#0078d4,#106ebe)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#0078d4,#106ebe)")}>
        <span style={logoText(12)}>O</span>
      </div>
    ),
  },
  postmark: {
    provider: "Transactional email · Reply-by-email",
    accent: "linear-gradient(135deg,#f59e0b,#d97706)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#f59e0b,#d97706)")}>
        <svg
          width="20"
          height="20"
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
    provider: "Transactional email · SendGrid",
    accent: "linear-gradient(135deg,#1a82e2,#0d6bc5)",
    logo: (
      <div style={logoBox("linear-gradient(135deg,#1a82e2,#0d6bc5)")}>
        <span style={logoText(13)}>SG</span>
      </div>
    ),
  },
};

function logoBox(bg: string): CSSProperties {
  return {
    width: 44,
    height: 44,
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
export function SettingsView({
  view,
  team,
}: {
  view: ContractorIntegrationsView;
  team: TeamMember[];
}) {
  const [selectedProvider, setSelectedProvider] =
    useState<IntegrationProviderKey | null>(null);

  const selectedCard =
    selectedProvider != null
      ? view.cards.find((c) => c.provider === selectedProvider) ?? null
      : null;

  const connectedCount = view.cards.filter(
    (c) =>
      c.connection != null &&
      c.connection.status !== "disconnected" &&
      c.connection.status !== "error",
  ).length;

  const canManage = view.context.role === "contractor_admin";

  return (
    <main
      style={{
        fontFamily: F.body,
        background: C.surface0,
        color: C.textPrimary,
        minHeight: "100vh",
        padding: "24px 32px 48px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Breadcrumb organization={view.context.organization.name} />

        <PageHeader
          title="Settings"
          subtitle={`Manage your organization, team, and integrations for ${view.context.organization.name}.`}
        />

        <OrganizationSection
          orgName={view.context.organization.name}
          canManage={canManage}
        />

        <TeamSection team={team} canManage={canManage} />

        <section style={{ marginTop: 32 }}>
          <SectionHeader
            title="Integrations"
            subtitle="Connect your accounting, payment, and productivity tools. Integrations sync automatically — no manual data entry required."
            rightNode={
              <span style={pillStyle("purple")}>{connectedCount} connected</span>
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))",
              gap: 14,
              marginTop: 20,
            }}
          >
            {view.cards.map((card) => (
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
              />
            ))}
          </div>

          {selectedCard && (
            <ConfigurationPanel
              card={selectedCard}
              recentEvents={view.recentSyncEvents.filter(
                (e) => e.provider === selectedCard.provider,
              )}
              canManage={canManage}
              onClose={() => setSelectedProvider(null)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

// ── Sub-sections ─────────────────────────────────────────────────────────
function Breadcrumb({ organization }: { organization: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: C.textTertiary,
        marginBottom: 16,
      }}
    >
      <span style={{ fontFamily: F.mono, fontSize: 11 }}>{organization}</span>
      <span style={{ color: C.surface4 }}>/</span>
      <span style={{ color: C.textPrimary, fontWeight: 650 }}>Settings</span>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
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
          fontSize: 13,
          color: C.textSecondary,
          marginTop: 4,
          maxWidth: 680,
          fontWeight: 520,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  rightNode,
}: {
  title: string;
  subtitle: string;
  rightNode?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        borderBottom: `1px solid ${C.surface3}`,
        paddingBottom: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: F.display,
            fontSize: 18,
            fontWeight: 740,
            letterSpacing: "-.02em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 12.5,
            color: C.textSecondary,
            marginTop: 3,
            maxWidth: 640,
            fontWeight: 520,
          }}
        >
          {subtitle}
        </p>
      </div>
      {rightNode}
    </div>
  );
}

function OrganizationSection({
  orgName,
  canManage,
}: {
  orgName: string;
  canManage: boolean;
}) {
  const [name, setName] = useState(orgName);
  const [address, setAddress] = useState("");

  return (
    <section style={{ marginTop: 8 }}>
      <SectionHeader
        title="Organization"
        subtitle="Your company identity — appears on draws, invoices, and client-facing documents."
      />
      <div
        style={{
          marginTop: 20,
          background: C.surface1,
          border: `1px solid ${C.surface3}`,
          borderRadius: 18,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "160px 1fr",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <LogoUpload disabled={!canManage} />

        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Organization name">
            <input
              value={name}
              disabled={!canManage}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Business address">
            <textarea
              value={address}
              disabled={!canManage}
              placeholder="Street, city, state, postal code"
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              style={{ ...inputStyle(), resize: "vertical" }}
            />
          </Field>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              disabled={!canManage}
              style={btnPrimary(canManage)}
              onClick={() => {
                /* Org settings persistence lands in Phase 2 */
              }}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoUpload({ disabled }: { disabled: boolean }) {
  return (
    <div
      style={{
        width: 160,
        height: 160,
        borderRadius: 18,
        background: C.surface2,
        border: `1px dashed ${C.surface4}`,
        display: "grid",
        placeItems: "center",
        color: C.textTertiary,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div style={{ textAlign: "center", padding: 12 }}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <div
          style={{
            fontSize: 11,
            fontFamily: F.display,
            fontWeight: 650,
            marginTop: 8,
          }}
        >
          Upload logo
        </div>
        <div style={{ fontSize: 10, marginTop: 2, fontWeight: 520 }}>
          PNG, SVG · 2MB max
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontFamily: F.display,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          color: C.textTertiary,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): CSSProperties {
  return {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: `1px solid ${C.surface3}`,
    background: C.surface1,
    color: C.textPrimary,
    fontFamily: F.body,
    fontSize: 13,
    fontWeight: 520,
    outline: "none",
  };
}

function TeamSection({
  team,
  canManage,
}: {
  team: TeamMember[];
  canManage: boolean;
}) {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionHeader
        title="Team members"
        subtitle="People in your organization with access to projects, draws, and documents."
        rightNode={
          <button disabled={!canManage} style={btnPrimary(canManage)}>
            Invite member
          </button>
        }
      />
      <div
        style={{
          marginTop: 20,
          background: C.surface1,
          border: `1px solid ${C.surface3}`,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {team.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              fontSize: 13,
              color: C.textTertiary,
            }}
          >
            No team members yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Email", "Role", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontFamily: F.display,
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.textTertiary,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      padding: "10px 16px",
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
              {team.map((m) => (
                <tr key={m.userId}>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${C.surface3}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Avatar name={m.displayName ?? m.email} />
                      <div>
                        <div
                          style={{
                            fontFamily: F.display,
                            fontSize: 13,
                            fontWeight: 650,
                          }}
                        >
                          {m.displayName ?? m.email.split("@")[0]}
                        </div>
                        {m.isPrimary && (
                          <div
                            style={{
                              fontSize: 10,
                              color: C.accentText,
                              fontWeight: 700,
                              fontFamily: F.display,
                              marginTop: 2,
                            }}
                          >
                            PRIMARY CONTACT
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${C.surface3}`,
                      fontFamily: F.mono,
                      fontSize: 12,
                      color: C.textSecondary,
                    }}
                  >
                    {m.email}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${C.surface3}`,
                    }}
                  >
                    <span style={pillStyle(/admin|owner/i.test(m.roleKey) ? "purple" : "gray")}>
                      {formatRole(m.roleKey)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${C.surface3}`,
                      textAlign: "right",
                    }}
                  >
                    <button disabled={!canManage} style={smBtnStyle(false)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: `linear-gradient(135deg,${C.accent},${C.accentMuted})`,
        color: "white",
        display: "grid",
        placeItems: "center",
        fontFamily: F.display,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {initials || "?"}
    </div>
  );
}

function formatRole(roleKey: string): string {
  return roleKey
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Integration card ────────────────────────────────────────────────────
function IntegrationCard({
  card,
  canManage,
  selected,
  onSelect,
}: {
  card: IntegrationCardRow;
  canManage: boolean;
  selected: boolean;
  onSelect: () => void;
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
    setPending(true);
    setError(null);
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

  async function disconnect(e: React.MouseEvent) {
    e.stopPropagation();
    if (!connection) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/integrations/${connection.id}/disconnect`, {
      method: "POST",
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

  return (
    <div
      onClick={onSelect}
      style={{
        background: C.surface1,
        border: `1px solid ${borderColor}`,
        borderRadius: 18,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 200ms",
        boxShadow: selected ? "0 4px 16px rgba(91,79,199,.12)" : "none",
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
          gap: 14,
          marginBottom: 14,
        }}
      >
        {presentation.logo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-.01em",
            }}
          >
            {card.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.textTertiary,
              marginTop: 2,
              fontWeight: 520,
            }}
          >
            {presentation.provider}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: C.textSecondary,
          lineHeight: 1.5,
          marginBottom: 16,
          fontWeight: 520,
          minHeight: 54,
        }}
      >
        {card.description}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isConnected ? C.success : C.surface4,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 620,
            color: isConnected ? C.successText : C.textTertiary,
          }}
        >
          {statusLabel(card)}
        </span>
        {connection?.lastSyncAt && (
          <span
            style={{
              fontSize: 11,
              color: C.textTertiary,
              marginLeft: "auto",
              fontWeight: 520,
            }}
          >
            Last sync {formatRelative(connection.lastSyncAt)}
          </span>
        )}
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
        {card.phase1 ? (
          <span style={pillStyle("green")}>Available</span>
        ) : (
          <span style={pillStyle("orange")}>Stub · Phase 2</span>
        )}
        <div style={{ flex: 1 }} />
        {!isConnected ? (
          <button
            disabled={!canManage || pending}
            onClick={connect}
            style={btnPrimary(canManage && !pending)}
          >
            {pending ? "Connecting…" : "Connect"}
          </button>
        ) : (
          <button
            disabled={!canManage || pending}
            onClick={disconnect}
            style={btnSecondary(canManage && !pending, true)}
          >
            {pending ? "…" : "Disconnect"}
          </button>
        )}
      </div>
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

function formatRelative(d: Date | string): string {
  const when = typeof d === "string" ? new Date(d) : d;
  const mins = Math.round((Date.now() - when.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// ── Slide-out configuration panel ───────────────────────────────────────
function ConfigurationPanel({
  card,
  recentEvents,
  canManage,
  onClose,
}: {
  card: IntegrationCardRow;
  recentEvents: ContractorIntegrationsView["recentSyncEvents"];
  canManage: boolean;
  onClose: () => void;
}) {
  const presentation = PROVIDER_LOGOS[card.provider];
  const connection = card.connection;

  return (
    <div
      style={{
        marginTop: 20,
        background: C.surface1,
        border: `1px solid ${C.surface3}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(26,23,20,.06)",
        animation: "slideDown 240ms ease-out",
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
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}
        >
          {presentation.logo}
          <div>
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
              {presentation.provider}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={smBtnStyle(false)}>
          Close
        </button>
      </div>

      <div style={{ padding: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <StatCard
            label="Status"
            value={statusLabel(card)}
            meta={
              connection?.lastErrorMessage ?? "Healthy in the last 7 days"
            }
            tone={
              connection?.status === "connected"
                ? "success"
                : connection?.status === "error"
                  ? "danger"
                  : "neutral"
            }
          />
          <StatCard
            label="Last sync"
            value={
              connection?.lastSyncAt
                ? formatRelative(connection.lastSyncAt)
                : "Never"
            }
            meta={
              connection?.connectedAt
                ? `Connected ${formatRelative(connection.connectedAt)}`
                : "Not yet connected"
            }
          />
          <StatCard
            label="External account"
            value={connection?.externalAccountName ?? "—"}
            meta={`Plan tier: ${card.minTier}`}
          />
        </div>

        <h4
          style={{
            fontFamily: F.display,
            fontSize: 13,
            fontWeight: 720,
            margin: "0 0 10px",
          }}
        >
          Recent sync activity
        </h4>
        {recentEvents.length === 0 ? (
          <div
            style={{
              padding: 20,
              border: `1px dashed ${C.surface3}`,
              borderRadius: 12,
              textAlign: "center",
              color: C.textTertiary,
              fontSize: 12.5,
              fontWeight: 520,
            }}
          >
            No sync events recorded for this integration yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentEvents.slice(0, 5).map((e) => {
              const sym =
                e.syncDirection === "push"
                  ? "↑"
                  : e.syncDirection === "pull"
                    ? "↓"
                    : "✓";
              const ok = /success|ok|completed/i.test(e.syncEventStatus);
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
                      {e.entityType ?? e.syncDirection} ·{" "}
                      {e.syncEventStatus}
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
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textTertiary,
                      fontFamily: F.display,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatRelative(e.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!card.phase1 && (
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
            Stub connector — full OAuth and sync loops ship in Phase 2.
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

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

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
      ? "#a7d9be"
      : tone === "danger"
        ? "#f3b6b6"
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

function btnSecondary(enabled: boolean, danger = false): CSSProperties {
  return {
    height: 34,
    padding: "0 14px",
    borderRadius: 10,
    background: C.surface1,
    color: danger ? C.dangerText : C.textPrimary,
    border: `1px solid ${danger ? C.danger : C.surface3}`,
    fontFamily: F.display,
    fontSize: 12.5,
    fontWeight: 620,
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
      green: { bg: C.successSoft, color: C.successText, border: "#a7d9be" },
      orange: { bg: C.warningSoft, color: C.warningText, border: "#f5d6a0" },
      gray: { bg: C.surface2, color: C.textTertiary, border: C.surface3 },
      blue: { bg: C.infoSoft, color: C.infoText, border: "#b3d4ee" },
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
