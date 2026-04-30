"use client";

import { useCallback, useEffect, useState } from "react";

import type { DailyLogCreatePayload, OutboxRow, OutboxStatus } from "@/lib/offline/db";

type RowView = OutboxRow;

const STATUS_LABEL: Record<OutboxStatus, string> = {
  pending: "Pending",
  syncing: "Syncing…",
  conflict: "Conflict — needs your input",
  failed_permanent: "Failed",
};

const STATUS_BG: Record<OutboxStatus, string> = {
  pending: "rgba(196, 112, 11, 0.12)",
  syncing: "rgba(49, 120, 185, 0.12)",
  conflict: "rgba(201, 69, 69, 0.12)",
  failed_permanent: "rgba(201, 69, 69, 0.12)",
};

const STATUS_TEXT: Record<OutboxStatus, string> = {
  pending: "#96600f",
  syncing: "#276299",
  conflict: "#a52e2e",
  failed_permanent: "#a52e2e",
};

function formatAge(enqueuedAt: number, now: number): string {
  const ms = Math.max(0, now - enqueuedAt);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function describePayload(row: OutboxRow): { title: string; subtitle: string } {
  if (row.kind === "daily_log_create") {
    const p = row.payload as DailyLogCreatePayload;
    return {
      title: `Daily log — ${p.logDate}`,
      subtitle: p.intent === "submit" ? "Pending submit" : "Pending draft save",
    };
  }
  // Future producers add cases here.
  return { title: row.kind, subtitle: "" };
}

export function OfflineQueueClient() {
  const [rows, setRows] = useState<RowView[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const { listPending } = await import("@/lib/offline/queue");
    const pending = await listPending();
    setRows(pending);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const onSyncNow = async () => {
    setSyncing(true);
    try {
      const { drainQueue } = await import("@/lib/offline/queue");
      await drainQueue();
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  const onRetry = async (clientId: string) => {
    const { retryRow, drainQueue } = await import("@/lib/offline/queue");
    await retryRow(clientId);
    await drainQueue();
    await refresh();
  };

  const onDiscard = async (clientId: string) => {
    if (!window.confirm("Discard this offline write? This can't be undone.")) return;
    const { dropPending } = await import("@/lib/offline/queue");
    const { dropPhotosForLog } = await import("@/lib/offline/photos");
    await dropPending(clientId);
    await dropPhotosForLog(clientId);
    await refresh();
  };

  if (loading) {
    return (
      <div style={{ color: "var(--t3)", fontSize: 13, fontWeight: 540 }}>
        Loading queue…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          background: "var(--s1)",
          border: "1px dashed var(--s3)",
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          color: "var(--t2)",
        }}
      >
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--t1)", marginBottom: 4 }}>
          Nothing pending
        </div>
        <div style={{ fontSize: 13, fontWeight: 520 }}>
          Daily logs you save while offline will appear here until they sync.
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={onSyncNow}
          disabled={syncing}
          style={{
            padding: "8px 14px",
            border: "1px solid var(--ac, #5b4fc7)",
            background: "var(--ac, #5b4fc7)",
            color: "#fff",
            borderRadius: 8,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 620,
            fontSize: 13,
            cursor: syncing ? "wait" : "pointer",
            opacity: syncing ? 0.7 : 1,
          }}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        <span style={{ fontSize: 12.5, color: "var(--t3)", fontWeight: 540 }}>
          {rows.length} pending
        </span>
      </div>

      <div
        style={{
          background: "var(--s1)",
          border: "1px solid var(--sa)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {rows.map((row) => {
          const { title, subtitle } = describePayload(row);
          return (
            <div
              key={row.clientId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid var(--sa)",
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      background: STATUS_BG[row.status],
                      color: STATUS_TEXT[row.status],
                    }}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 660, fontSize: 13.5 }}>
                    {title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--t2)", fontWeight: 540, marginBottom: 2 }}>
                  {subtitle}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--t3)", fontWeight: 520 }}>
                  Saved {formatAge(row.enqueuedAt, now)}
                  {row.attempts > 0 && ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}`}
                  {row.lastError && ` · ${row.lastError}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {(row.status === "conflict" || row.status === "failed_permanent") && (
                  <button
                    onClick={() => onRetry(row.clientId)}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid var(--s4, #d1d5db)",
                      background: "var(--s1)",
                      borderRadius: 6,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 620,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => onDiscard(row.clientId)}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid var(--s4, #d1d5db)",
                    background: "var(--s1)",
                    color: "var(--t2)",
                    borderRadius: 6,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 620,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
