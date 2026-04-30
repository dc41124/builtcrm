"use client";

import { useEffect } from "react";

// Registers /sw.js (emitted by @serwist/next at build time) on first paint.
// Skipped in dev (the Serwist plugin disables emit there too — registration
// would 404). Step 50.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Quiet failure: a missing/blocked SW shouldn't crash the app.
      }
    };

    // Defer until window load to avoid contending with the initial paint.
    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
