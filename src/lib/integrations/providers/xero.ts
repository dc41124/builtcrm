import type { PayloadExtractor, ProviderConfig } from "../types";

// Xero — OAuth 2.0 with PKCE optional. Xero returns its tenant list via a
// subsequent call to `/connections`; Step 29 only captures what's in the
// token response. Tenant selection happens in the accounting-connector
// steps when scope-specific logic lands.
//
// Xero access tokens last 30 minutes. The */30 token-refresh cron is tight
// — the refresh query pulls anything expiring within 5 minutes, so the
// first request past the 25-minute mark refreshes before the token dies.
// If production telemetry shows misses, tighten the cron to */15 or */10.

const extractIdentity: PayloadExtractor = (payload) => {
  const p = asRecord(payload);
  const events = asRecordArray(p.events);
  const first = events[0] ?? {};
  const tenantId = typeof first.tenantId === "string" ? first.tenantId : null;
  const category =
    typeof first.eventCategory === "string" ? first.eventCategory : "unknown";
  const eventType =
    typeof first.eventType === "string" ? first.eventType : "unknown";
  const resourceId =
    typeof first.resourceId === "string" ? first.resourceId : "";
  const seq =
    typeof p.firstEventSequence === "number" ? p.firstEventSequence : null;
  return {
    externalAccountId: tenantId,
    eventId:
      tenantId && seq !== null
        ? `${tenantId}:${seq}`
        : tenantId && resourceId
          ? `${tenantId}:${resourceId}:${eventType}`
          : null,
    eventType: `xero.${category.toLowerCase()}.${eventType.toLowerCase()}`,
  };
};

const xero: ProviderConfig = {
  provider: "xero",
  name: "Xero",
  description:
    "Bidirectional invoice and payment sync with Xero accounting.",
  category: "accounting",
  minTier: "professional",
  phase1: false,
  flow: "oauth2_code",
  oauth: {
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
  },
  webhooks: {
    signatureScheme: "hmac-sha256-b64",
    signatureHeader: "x-xero-signature",
    secretEnvVar: "XERO_WEBHOOK_KEY",
    extractIdentity,
  },
  sync: {
    entities: ["invoice", "payment", "contact"],
  },
};

export default xero;

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
}

function asRecordArray(x: unknown): Record<string, unknown>[] {
  return Array.isArray(x)
    ? x.filter(
        (item): item is Record<string, unknown> =>
          item != null && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}
