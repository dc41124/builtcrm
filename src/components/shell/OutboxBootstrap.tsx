"use client";

import { useEffect } from "react";

/**
 * Mounts the offline outbox subsystem at app startup:
 *   1. Lazily imports the producer registry + daily-log producer (so the
 *      idb code only ships to the browser when the layout mounts, never
 *      on the server).
 *   2. Registers the daily_log_create producer.
 *   3. Drains any pending rows on initial mount (handles the "user reopened
 *      the app while online — sync now" path) and on every `online` event.
 *
 * Step 51 — see docs/specs/phase_4plus_build_guide.md.
 */
export function OutboxBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let drainOnReconnect: (() => void) | null = null;

    (async () => {
      const [
        { drainQueue },
        { registerDailyLogProducer },
        { registerSafetyFormProducer },
        { registerRfiQuickCreateProducer },
      ] = await Promise.all([
        import("@/lib/offline/queue"),
        import("@/lib/offline/dailyLogs"),
        import("@/lib/offline/safetyForms"),
        import("@/lib/offline/rfis"),
      ]);
      if (cancelled) return;

      registerDailyLogProducer();
      registerSafetyFormProducer();
      registerRfiQuickCreateProducer();

      // Initial drain — covers the case where rows were enqueued in a
      // previous session and the user is now online.
      if (navigator.onLine) {
        void drainQueue();
      }

      drainOnReconnect = () => {
        void drainQueue();
      };
      window.addEventListener("online", drainOnReconnect);
    })();

    return () => {
      cancelled = true;
      if (drainOnReconnect) {
        window.removeEventListener("online", drainOnReconnect);
      }
    };
  }, []);

  return null;
}
