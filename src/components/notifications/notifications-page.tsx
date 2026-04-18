"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { PortalType } from "@/lib/portal-colors";

// Persistent /notifications page. Paginated list, filter by project id,
// filter by event type. Shared across all four portals via a thin
// server page that passes portalType + the project filter options.

type NotificationRow = {
  id: string;
  portalType: PortalType;
  eventId: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  projectId: string | null;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
  createdAt: string;
  readAt: string | null;
};

type ApiResponse = {
  notifications: NotificationRow[];
  unreadCount: number;
};

type ProjectOption = { id: string; name: string };

const PAGE_SIZE = 30;

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function NotificationsPage({
  portalType,
  projects,
}: {
  portalType: PortalType;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [markAllPending, setMarkAllPending] = useState(false);
  const reqId = useRef(0);

  const eventTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(r.eventId);
    return Array.from(seen).sort();
  }, [rows]);

  const fetchPage = useCallback(
    async (nextOffset: number, reset: boolean) => {
      const myReq = ++reqId.current;
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
          portalType,
        });
        if (unreadOnly) qs.set("unread", "1");
        if (projectFilter) qs.set("projectId", projectFilter);
        if (eventFilter) qs.set("eventId", eventFilter);

        const res = await fetch(`/api/notifications?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as ApiResponse;
        // Discard stale responses when filters change fast.
        if (myReq !== reqId.current) return;
        setUnread(data.unreadCount);
        setHasMore(data.notifications.length === PAGE_SIZE);
        setRows((prev) =>
          reset ? data.notifications : [...prev, ...data.notifications],
        );
        setOffset(nextOffset + data.notifications.length);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    },
    [portalType, projectFilter, unreadOnly, eventFilter],
  );

  // Refetch from the top whenever filters change.
  useEffect(() => {
    setOffset(0);
    void fetchPage(0, true);
  }, [fetchPage]);

  async function onRowClick(row: NotificationRow) {
    if (!row.readAt) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, readAt: new Date().toISOString() } : r,
        ),
      );
      setUnread((u) => Math.max(0, u - 1));
      void fetch(`/api/notifications/${row.id}`, { method: "PATCH" }).catch(
        () => {},
      );
    }
    if (row.linkUrl) router.push(row.linkUrl);
  }

  async function onMarkAll() {
    if (markAllPending || unread === 0) return;
    setMarkAllPending(true);
    try {
      await fetch(`/api/notifications/mark-all-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalType }),
      });
      await fetchPage(0, true);
    } finally {
      setMarkAllPending(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "'DM Sans',system-ui,sans-serif",
            fontSize: 26,
            fontWeight: 750,
            letterSpacing: "-.03em",
            margin: 0,
          }}
        >
          Notifications
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--t2)",
            marginTop: 4,
            marginBottom: 0,
            fontWeight: 520,
            lineHeight: 1.5,
          }}
        >
          Everything the system has sent you, filterable by project and type.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "12px 14px",
          border: "1px solid var(--s3)",
          borderRadius: "var(--r-m)",
          background: "var(--s1)",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--fd)",
            fontSize: 12.5,
            fontWeight: 580,
            color: "var(--t2)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only {unread > 0 && <span style={{ color: "var(--t3)" }}>({unread})</span>}
        </label>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            height: 32,
            border: "1px solid var(--s3)",
            borderRadius: "var(--r-s)",
            background: "var(--s1)",
            color: "var(--t1)",
            fontFamily: "var(--fd)",
            fontSize: 12.5,
            fontWeight: 580,
          }}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            height: 32,
            border: "1px solid var(--s3)",
            borderRadius: "var(--r-s)",
            background: "var(--s1)",
            color: "var(--t1)",
            fontFamily: "var(--fd)",
            fontSize: 12.5,
            fontWeight: 580,
          }}
          disabled={eventTypes.length === 0}
        >
          <option value="">All types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onMarkAll}
          disabled={unread === 0 || markAllPending}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            height: 32,
            border: "1px solid var(--s3)",
            borderRadius: "var(--r-s)",
            background: unread === 0 ? "var(--s2)" : "var(--ac-s)",
            color: unread === 0 ? "var(--t3)" : "var(--ac-t)",
            fontFamily: "var(--fd)",
            fontSize: 12.5,
            fontWeight: 650,
            cursor: unread === 0 ? "default" : "pointer",
          }}
        >
          {markAllPending ? "Marking…" : "Mark all read"}
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--s3)",
          borderRadius: "var(--r-m)",
          background: "var(--s1)",
          overflow: "hidden",
        }}
      >
        {loading && rows.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {unreadOnly
              ? "No unread notifications."
              : "No notifications yet."}
          </div>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onRowClick(row)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                width: "100%",
                padding: "14px 16px",
                border: "none",
                borderBottom: "1px solid var(--s2)",
                background: row.readAt ? "transparent" : "var(--ac-s)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 13.5,
                    fontWeight: 680,
                    color: "var(--t1)",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {row.title}
                  {!row.readAt && (
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "var(--ac)",
                      }}
                      aria-label="Unread"
                    />
                  )}
                </div>
                {row.body && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--t2)",
                      marginTop: 3,
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {row.body}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                    fontSize: 11,
                    color: "var(--t3)",
                    marginTop: 6,
                    fontWeight: 620,
                    letterSpacing: ".02em",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <span>{formatRelativeTime(row.createdAt)}</span>
                  <span style={{ textTransform: "uppercase" }}>
                    {row.eventId.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}

        {hasMore && (
          <div
            style={{
              padding: 12,
              textAlign: "center",
              borderTop: "1px solid var(--s2)",
            }}
          >
            <button
              type="button"
              onClick={() => void fetchPage(offset, false)}
              disabled={loading}
              style={{
                padding: "6px 16px",
                height: 30,
                border: "1px solid var(--s3)",
                borderRadius: "var(--r-s)",
                background: "var(--s1)",
                color: "var(--t2)",
                fontFamily: "var(--fd)",
                fontSize: 12.5,
                fontWeight: 620,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <Link
          href={`/${portalType}/settings?tab=notifications`}
          style={{
            fontFamily: "var(--fd)",
            fontSize: 12.5,
            color: "var(--t3)",
            textDecoration: "none",
            fontWeight: 580,
          }}
        >
          Notification preferences →
        </Link>
      </div>
    </div>
  );
}
