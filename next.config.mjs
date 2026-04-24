import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/marketing", destination: "/marketing.html" },
    ];
  },
};

// Conditional Sentry wrap: when SENTRY_DSN is unset (e.g. first-time
// checkout with no Sentry project yet), the plain nextConfig is used and
// the Sentry webpack plugin stays out of the build. Set SENTRY_DSN in
// .env.local to activate.
const sentryOptions = {
  // Populated from env only when source-map uploads are desired (requires
  // SENTRY_ORG + SENTRY_PROJECT + SENTRY_AUTH_TOKEN). Unset = no upload;
  // fine for dev.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    // Strip Sentry SDK debug logs from prod bundle.
    treeshake: { removeDebugLogging: true },
    // We deploy on Render, not Vercel — skip Vercel-specific monitors.
    automaticVercelMonitors: false,
  },
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
