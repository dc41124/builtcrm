import type { PayloadExtractor, ProviderConfig } from "../types";

// QuickBooks Online — Intuit OAuth 2.0. Signature verification: Intuit's
// "Verifier Token" used as an HMAC-SHA256 key against the raw request body;
// result is base64-encoded and delivered in the `intuit-signature` header.
//
// Note on realmId: Intuit returns the company/realm identifier on the
// callback URL as a query parameter, NOT in the token response body. The
// `extractAccount` hook below pulls it from callbackQuery so the resulting
// integration_connections row has `external_account_id = realmId`. Webhooks
// identify the same realm on delivery, so `extractIdentity` below uses it
// as the org-lookup key.

const extractIdentity: PayloadExtractor = (payload) => {
  const p = asRecord(payload);
  const first = asRecordArray(p.eventNotifications)[0] ?? {};
  const realmId = typeof first.realmId === "string" ? first.realmId : null;
  const entities = asRecordArray(asRecord(first.dataChangeEvent).entities);
  const firstEntity = entities[0] ?? {};
  return {
    externalAccountId: realmId,
    // Intuit doesn't ship a globally-unique delivery id — synthesize one
    // from realm + first entity so retries hash to the same key.
    eventId:
      realmId && typeof firstEntity.id === "string"
        ? `${realmId}:${firstEntity.id}:${firstEntity.operation ?? "unknown"}`
        : null,
    eventType:
      typeof firstEntity.name === "string"
        ? `qbo.${firstEntity.name}.${firstEntity.operation ?? "event"}`
        : "qbo.unknown",
  };
};

const quickbooks: ProviderConfig = {
  provider: "quickbooks_online",
  name: "QuickBooks Online",
  description:
    "Push approved draws as invoices, pull payment status, reconcile retainage.",
  category: "accounting",
  minTier: "professional",
  phase1: false,
  flow: "oauth2_code",
  oauth: {
    authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer_tokens",
    revokeUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
    scopes: ["com.intuit.quickbooks.accounting"],
    clientIdEnvVar: "QUICKBOOKS_CLIENT_ID",
    clientSecretEnvVar: "QUICKBOOKS_CLIENT_SECRET",
    extractAccount: ({ callbackQuery }) => ({
      externalAccountId: callbackQuery.get("realmId"),
      externalAccountName: null, // company name fetched after first API call
    }),
  },
  webhooks: {
    signatureScheme: "hmac-sha256-b64",
    signatureHeader: "intuit-signature",
    secretEnvVar: "QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN",
    extractIdentity,
  },
  sync: {
    entities: ["invoice", "payment", "customer"],
  },
};

export default quickbooks;

// Defensive payload helpers — keep webhook extraction tolerant to the
// provider shipping unexpected payload shapes.
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
