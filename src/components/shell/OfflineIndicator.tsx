"use client";

import { useEffect, useState } from "react";

// Persistent banner shown while the device is offline. Subtle (not modal)
// since cached pages still load — just sets expectations on what's stale
// or queued. Step 50.
export function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

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
        background: "#1f2937",
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
      You&apos;re offline. Cached pages still work; uploads and new messages will queue until you&apos;re back online.
    </div>
  );
}
