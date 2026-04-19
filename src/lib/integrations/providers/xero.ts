import type { OAuth2ProviderConfig } from "./types";

// Xero — OAuth 2.0 with PKCE optional. Xero returns the tenant list via a
// subsequent call to `/connections`; for Step 25 scaffolding we only capture
// what's in the token response. Tenant selection happens in Step 30-33 when
// scope-specific logic lands.
//
// Token TTL: access tokens last 30 minutes. The Trigger.dev refresh job
// (cadence 30 min) will be tight for Xero — the refresh query pulls anything
// expiring within 5 minutes, so the first request past the 25-minute mark
// refreshes before the token dies. If we see misses in production, shorten
// the cron to */15 or */10.
export const xeroProvider: OAuth2ProviderConfig = {
  key: "xero",
  authorizeUrl: "https://login.xero.com/identity/connect/authorize",
  tokenUrl: "https://identity.xero.com/connect/token",
  revokeUrl: "https://identity.xero.com/connect/revocation",
  scopes: [
    "offline_access",
    "accounting.transactions",
    "accounting.contacts",
    "accounting.settings",
  ],
  clientIdEnvVar: "XERO_CLIENT_ID",
  clientSecretEnvVar: "XERO_CLIENT_SECRET",
};
