"use client";

import { useEffect, useState } from "react";

// Custom install prompt for the PWA. Shown only on field-context pages
// (subcontractor /today, daily-logs, punch-list — see where this is mounted).
// Hooks the `beforeinstallprompt` event on Android Chrome / desktop Chrome /
// Edge. iOS Safari doesn't fire that event — we render a lightweight tip
// there instead (see `iosTip` below).
//
// Dismissals are tracked in localStorage with a 30-day cool-off so the prompt
// doesn't keep nagging. Cleared if the user installs (`appinstalled` event)
// or signs out (no — different concern; the tip is per-device, not per-user).
// Step 50.

const DISMISS_KEY = "builtcrm-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30d

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosTip, setIosTip] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed? `display-mode: standalone` is the cross-platform
    // signal that the app is launched as a PWA.
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS uses navigator.standalone instead of display-mode.
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    ) {
      return;
    }

    // Recently dismissed? Sit out the cool-off.
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const ts = Number.parseInt(dismissed, 10);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS) {
          return;
        }
      }
    } catch {
      // ignore localStorage errors (private mode, etc.)
    }

    // Android / Chrome / Edge: capture the deferred prompt.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari: no prompt event. Detect iOS UA + non-standalone, show tip.
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIos) setIosTip(true);

    // After install, hide for good.
    const onInstalled = () => {
      setHidden(true);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        // ignore
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;
  if (!deferred && !iosTip) return null;

  const onInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setHidden(true);
    }
    setDeferred(null);
  };

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setHidden(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Install BuiltCRM"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9998,
        maxWidth: 320,
        background: "var(--surface, #ffffff)",
        color: "var(--text, #111827)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        padding: 16,
        fontFamily:
          "'Instrument Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontWeight: 720,
          fontSize: 15,
          marginBottom: 4,
        }}
      >
        Install BuiltCRM
      </div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        {iosTip ? (
          <>Tap the share icon, then &ldquo;Add to Home Screen&rdquo; to install. Faster launches and offline access on the job site.</>
        ) : (
          <>Faster launches and offline access on the job site.</>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 620,
            background: "transparent",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 6,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          Not now
        </button>
        {deferred ? (
          <button
            type="button"
            onClick={onInstall}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 650,
              background: "#5b4fc7",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Install
          </button>
        ) : null}
      </div>
    </div>
  );
}
