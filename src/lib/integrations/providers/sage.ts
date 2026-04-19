import type { PayloadExtractor, ProviderConfig } from "../types";

// Sage Business Cloud Accounting — OAuth 2.0. Regional endpoints vary (UK/
// IE vs US/CA); the URLs below target the `.ca` region matching BuiltCRM's
// Canadian focus. A future US customer connecting would want the subdomain
// switched via env — flagged as a follow-up when Sage traffic shows up.
//
// Webhook signing: Sage's webhook docs are sparse. We assume an HMAC-SHA256
// base64 pattern with header `x-sage-signature`. Revisit when the live
// endpoint ships.

const extractIdentity: PayloadExtractor = () => ({
  // Sage payload shape is TBD — stub returns nulls so unmatched events
  // audit cleanly until the real connector lands.
  externalAccountId: null,
  eventId: null,
  eventType: "sage.unknown",
});

const sage: ProviderConfig = {
  provider: "sage_business_cloud",
  name: "Sage Business Cloud",
  description:
    "Sage accounting connector with scheduled reconciliation.",
  category: "accounting",
  minTier: "professional",
  phase1: false,
  flow: "oauth2_code",
  oauth: {
    authorizeUrl: "https://www.sageone.com/oauth2/auth/central",
    tokenUrl: "https://oauth.accounting.sage.com/token",
    scopes: ["full_access"],
    clientIdEnvVar: "SAGE_CLIENT_ID",
    clientSecretEnvVar: "SAGE_CLIENT_SECRET",
    // Sage requires `country` in the authorize URL to pre-select the
    // accounting region. Default to CA; surface as a per-connection
    // choice in the UI when a US customer signs up.
    extraAuthorizeParams: {
      country: "CA",
      locale: "en-CA",
    },
  },
  webhooks: {
    signatureScheme: "hmac-sha256-b64",
    signatureHeader: "x-sage-signature",
    secretEnvVar: "SAGE_WEBHOOK_SECRET",
    extractIdentity,
  },
  sync: {
    entities: ["invoice", "payment", "contact"],
  },
};

export default sage;
