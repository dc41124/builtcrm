import { withSentryConfig } from "@sentry/nextjs";

// Security headers applied globally. CSP is intentionally NOT set here —
// a working CSP for a Next.js + Sentry + frappe-gantt + react-pdf wasm
// app needs per-vendor allowlists and is its own sprint. See
// docs/specs/security_posture.md §8 (Apps pillar) for backlog status.
const SECURITY_HEADERS = [
  // 2 years, includeSubDomains, preload — standard hardened HSTS.
  // Only takes effect when served over HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Disallow framing entirely — clickjacking defense. We do not embed
  // ourselves in iframes anywhere.
  { key: "X-Frame-Options", value: "DENY" },
  // Disable MIME-type sniffing in old IE/Edge.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send origin only on cross-origin nav; full URL same-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser APIs we don't use. Re-enable per-route
  // if a future feature legitimately needs them.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output bundles a minimal `server.js` + only the runtime
  // deps the build actually used. Required for the Docker prod image
  // (~150 MB instead of ~1.5 GB). See docs/specs/prod_cutover_prep.md §2.
  output: "standalone",
  async rewrites() {
    return [
      { source: "/marketing", destination: "/marketing.html" },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
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
