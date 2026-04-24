import * as Sentry from "@sentry/nextjs";

// Server-side Sentry init. Bootstrapped from instrumentation.ts when
// NEXT_RUNTIME === "nodejs". When SENTRY_DSN is absent (e.g. local dev
// with no Sentry project provisioned yet), Sentry.init() no-ops and the
// app runs normally without error monitoring.
//
// See docs/specs/security_posture.md for the observability rationale.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Lower in prod (every traced request is a Sentry unit); 1.0 for dev
  // since we want full visibility while developing.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Ignore errors that fire during dev-server hot reload / build mismatch
  // noise; real errors still land. Extend this list if Sentry starts
  // collecting uninteresting events.
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
});
