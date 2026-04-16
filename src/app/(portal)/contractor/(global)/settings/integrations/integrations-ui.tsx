"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ContractorIntegrationsView,
  IntegrationCardRow,
} from "@/domain/loaders/integrations";

export function IntegrationsView({
  view,
}: {
  view: ContractorIntegrationsView;
}) {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <h2 style={{ margin: 0 }}>Settings · Integrations</h2>
        <p style={{ color: "var(--t2)", marginTop: 4 }}>
          Connect external systems to {view.context.organization.name}. Phase 1
          ships email notifications and CSV export; other connectors record a
          stub connection so the workflow can be tested end-to-end.
        </p>
      </header>

      <section style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Available Integrations</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))",
            gap: 12,
          }}
        >
          {view.cards.map((card) => (
            <IntegrationCard
              key={card.provider}
              card={card}
              canManage={view.context.role === "contractor_admin"}
            />
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>CSV Export</h3>
        <p style={{ color: "var(--t2)", margin: 0 }}>
          Available on every plan tier. Download a snapshot of any module
          scoped to your organization.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {view.exportableEntities.map((e) => (
            <a
              key={e.key}
              href={`/api/integrations/export?entity=${e.key}`}
              style={{
                padding: "6px 12px",
                border: "1px solid var(--s3)",
                borderRadius: 6,
                textDecoration: "none",
                color: "var(--t1)",
                fontSize: 13,
              }}
            >
              Export {e.label} (.csv)
            </a>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Recent Sync Activity</h3>
        {view.recentSyncEvents.length === 0 ? (
          <p style={{ color: "var(--t3)", margin: 0 }}>
            No sync events recorded yet.
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--s3)" }}>
                <th style={{ padding: "6px 8px" }}>When</th>
                <th style={{ padding: "6px 8px" }}>Provider</th>
                <th style={{ padding: "6px 8px" }}>Direction</th>
                <th style={{ padding: "6px 8px" }}>Status</th>
                <th style={{ padding: "6px 8px" }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {view.recentSyncEvents.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--s2)" }}>
                  <td style={{ padding: "6px 8px" }}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{e.provider ?? "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{e.syncDirection}</td>
                  <td style={{ padding: "6px 8px" }}>{e.syncEventStatus}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {e.summary ?? e.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function IntegrationCard({
  card,
  canManage,
}: {
  card: IntegrationCardRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = card.connection;
  const isConnected =
    connection != null &&
    connection.status !== "disconnected" &&
    connection.status !== "error";

  async function connect() {
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

  async function disconnect() {
    if (!connection) return;
    setPending(true);
    setError(null);
    const res = await fetch(
      `/api/integrations/${connection.id}/disconnect`,
      { method: "POST" },
    );
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  return (
    <div
      style={{
        border: "1px solid var(--s3)",
        borderRadius: 12,
        padding: 16,
        background: "var(--s1)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <strong style={{ fontSize: 14 }}>{card.name}</strong>
          <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase" }}>
            {card.category} · {card.minTier}
          </div>
        </div>
        <StatusBadge status={connection?.status ?? null} phase1={card.phase1} />
      </div>
      <p style={{ fontSize: 12, color: "var(--t2)", margin: 0 }}>
        {card.description}
      </p>
      {connection?.externalAccountName && (
        <div style={{ fontSize: 12, color: "var(--t1)" }}>
          Account: {connection.externalAccountName}
        </div>
      )}
      {connection?.lastSyncAt && (
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
        </div>
      )}
      {connection?.lastErrorMessage && (
        <div style={{ fontSize: 11, color: "var(--dg-t)" }}>
          {connection.lastErrorMessage}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {!isConnected && (
          <button
            disabled={!canManage || pending}
            onClick={connect}
            style={btnPrimary(canManage && !pending)}
          >
            {pending ? "Connecting…" : "Connect"}
          </button>
        )}
        {isConnected && (
          <button
            disabled={!canManage || pending}
            onClick={disconnect}
            style={btnSecondary(canManage && !pending)}
          >
            {pending ? "…" : "Disconnect"}
          </button>
        )}
      </div>
      {!card.phase1 && (
        <div style={{ fontSize: 11, color: "var(--wr-t)" }}>
          Stub connector — full OAuth lands in a later phase.
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: "var(--dg-t)" }}>{error}</div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  phase1,
}: {
  status: string | null;
  phase1: boolean;
}) {
  const label = status ?? (phase1 ? "Available" : "Stub");
  const color =
    status === "connected"
      ? "var(--ok-t)"
      : status === "needs_reauth"
        ? "var(--wr-t)"
        : status === "error"
          ? "var(--dg-t)"
          : "var(--t2)";
  const bg =
    status === "connected"
      ? "var(--ok-s)"
      : status === "needs_reauth"
        ? "var(--wr-s)"
        : status === "error"
          ? "var(--dg-s)"
          : "var(--s2)";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        background: bg,
        padding: "2px 8px",
        borderRadius: 999,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        height: 18,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {label}
    </span>
  );
}

function btnPrimary(enabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: enabled ? "var(--ac)" : "var(--ac-s)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function btnSecondary(enabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: "var(--s1)",
    color: "var(--t1)",
    border: "1px solid var(--s3)",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
