"use client";

import { useEffect, useState } from "react";

// Persistent banner shown while the device is offline. Step 50 introduced it
// as a binary online/offline strip; Step 51 extends it to also show pending
// outbox count whenever there's queued work — so the user can see "3 pending
// sync" even when they reconnect, and click through to /contractor/settings/
// offline-queue to inspect.
export function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    let cancelled = false;
    const refreshPending = async () => {
      try {
        const { listPending } = await import("@/lib/offline/queue");
        const rows = await listPending();
        if (!cancelled) setPendingCount(rows.length);
      } catch {
        // idb unavailable in this context (e.g. very old browser) — silently skip.
      }
    };
    void refreshPending();
    const interval = setInterval(refreshPending, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && pendingCount === 0) return null;

  const message = !online
    ? pendingCount > 0
      ? `You're offline. ${pendingCount} pending sync — drains automatically when you reconnect.`
      : "You're offline. Cached pages still work; uploads and new messages will queue until you're back online."
    : `${pendingCount} pending sync from earlier offline use — review in the offline queue.`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: !online ? "#1f2937" : "#3b3a48",
        color: "#fef3c7",
        padding: "8px 16px",
        fontSize: 13,
        fontFamily:
          "'Instrument Sans', system-ui, -apple-system, sans-serif",
        fontWeight: 520,
        textAlign: "center",
        borderBottom: "1px solid rgba(0,0,0,0.2)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }}
    >
      {message}
      {pendingCount > 0 && (
        <>
          {" "}
          <a
            href="/contractor/settings/offline-queue"
            style={{ color: "#fef3c7", textDecoration: "underline", fontWeight: 620 }}
          >
            View queue
          </a>
        </>
      )}
    </div>
  );
}
