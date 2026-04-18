"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { PortalType } from "@/lib/portal-colors";

// Topbar bell + dropdown for in-app notifications.
//
// Data refresh: poll every 60s while visible, refetch on window focus.
// SSE was considered and rejected for portfolio scope — stateless
// runtime on Render, long-lived connections aren't worth the complexity.
//
// Mark-read behavior: only on explicit row click or "Mark all read".
// Opening the dropdown does NOT mark rows read (that pattern is
// aggressive and annoying).

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

const POLL_MS = 60_000;
const DROPDOWN_LIMIT = 10;

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

function displayCount(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}

function iconFor(eventId: string): ReactNode {
  // Inline SVGs only — matches CLAUDE.md "no emojis" rule.
  if (eventId.startsWith("co_") || eventId === "scope_change") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (eventId.startsWith("draw_") || eventId.startsWith("payment_")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    );
  }
  if (eventId.startsWith("rfi_")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (eventId === "message_new") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (eventId.startsWith("upload_")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    );
  }
  if (eventId === "selection_confirmed" || eventId === "decision_needed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (eventId.startsWith("approval_")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 L15 8 L22 9 L17 14 L18 21 L12 17 L6 21 L7 14 L2 9 L9 8 Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function NotificationBell({ portalType }: { portalType: PortalType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [markAllPending, setMarkAllPending] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const fetchFor = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(DROPDOWN_LIMIT),
          portalType,
        });
        const res = await fetch(`/api/notifications?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as ApiResponse;
        setRows(data.notifications);
        setUnread(data.unreadCount);
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [portalType],
  );

  // Initial fetch + poll + refocus refetch. Poll interval runs only
  // while the tab is visible to avoid burning fetches in background tabs.
  useEffect(() => {
    void fetchFor();
    let interval: number | null = null;
    const start = () => {
      if (interval != null) return;
      interval = window.setInterval(() => void fetchFor({ silent: true }), POLL_MS);
    };
    const stop = () => {
      if (interval == null) return;
      window.clearInterval(interval);
      interval = null;
    };
    const onFocus = () => {
      void fetchFor({ silent: true });
      start();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchFor]);

  // Click outside closes. Escape closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onRowClick(row: NotificationRow) {
    setOpen(false);
    // Optimistic: flip readAt locally so the row de-emphasises
    // immediately, then POST in the background.
    if (!row.readAt) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, readAt: new Date().toISOString() } : r,
        ),
      );
      setUnread((u) => Math.max(0, u - 1));
      void fetch(`/api/notifications/${row.id}`, { method: "PATCH" }).catch(
        () => {
          // If the PATCH fails, the next poll will reconcile. Don't
          // block the navigation on this.
        },
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
      await fetchFor({ silent: true });
    } finally {
      setMarkAllPending(false);
    }
  }

  const countLabel = displayCount(unread);

  return (
    <div className="b-nbell" ref={rootRef}>
      <button
        type="button"
        className="b-tbb b-nbell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {unread > 0 && <span className="b-nbell-badge">{countLabel}</span>}
      </button>
      {open && (
        <div className="b-nbell-panel" role="dialog" aria-label="Notifications">
          <div className="b-nbell-head">
            <div className="b-nbell-title">
              Notifications
              {unread > 0 && <span className="b-nbell-count">{unread}</span>}
            </div>
            <button
              type="button"
              className="b-nbell-markall"
              onClick={onMarkAll}
              disabled={unread === 0 || markAllPending}
            >
              {markAllPending ? "Marking…" : "Mark all read"}
            </button>
          </div>
          <div className="b-nbell-list">
            {loading && rows.length === 0 ? (
              <div className="b-nbell-empty">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="b-nbell-empty">You&apos;re all caught up.</div>
            ) : (
              rows.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className={`b-nbell-row${row.readAt ? "" : " unread"}`}
                  onClick={() => onRowClick(row)}
                >
                  <span className="b-nbell-ic" aria-hidden>
                    {iconFor(row.eventId)}
                  </span>
                  <span className="b-nbell-body">
                    <span className="b-nbell-ttl">{row.title}</span>
                    {row.body && <span className="b-nbell-sub">{row.body}</span>}
                    <span className="b-nbell-time">
                      {formatRelativeTime(row.createdAt)}
                    </span>
                  </span>
                  {!row.readAt && <span className="b-nbell-dot" aria-hidden />}
                </button>
              ))
            )}
          </div>
          <div className="b-nbell-foot">
            <Link
              href={`/${portalType}/notifications`}
              className="b-nbell-seeall"
              onClick={() => setOpen(false)}
            >
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
