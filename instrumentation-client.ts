import * as Sentry from "@sentry/nextjs";

// Client-side Sentry init. NEXT_PUBLIC_SENTRY_DSN ships in the browser
// bundle by design — Sentry DSNs are intended to be public (they're
// rate-limit-keyed identifiers, not secrets).
//
// Session replay is deliberately NOT enabled here. BuiltCRM handles
// tax IDs, banking routing fields, and financial data — DOM recordings
// could capture that material even through Sentry's scrubbing. Revisit
// only with a documented privacy review.
//
// This file replaces the legacy sentry.client.config.ts location;
// Next.js 15.3+ and Sentry v10+ both prefer instrumentation-client.ts
// because it works under Turbopack as well as webpack.
//
// See docs/specs/security_posture.md.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
});

// Enables router-transition tracing (client-side navigation spans).
// Requires Next.js 15.3+ — safe no-op on older runtimes.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
