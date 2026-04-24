import * as Sentry from "@sentry/nextjs";

// Next.js 15+ instrumentation hook. Runs once per runtime at boot.
// Delegates to the appropriate sentry config based on which runtime is
// active. No-ops gracefully when SENTRY_DSN is unset.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js 15's route-handler error hook — captures exceptions thrown by
// route handlers even outside our withErrorHandler wrapper.
export const onRequestError = Sentry.captureRequestError;
