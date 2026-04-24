import * as Sentry from "@sentry/nextjs";

// Edge runtime Sentry init. Bootstrapped from instrumentation.ts when
// NEXT_RUNTIME === "edge". Currently the app has middleware at the edge;
// this covers any exceptions thrown in that path.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
});
