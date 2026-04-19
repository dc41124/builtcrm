// Integration type definitions (Step 29).
//
// The Step 29 refactor consolidated Step 25's split-brain setup — where
// UI-catalog metadata lived in `src/domain/loaders/integrations.ts` and
// OAuth transport config lived in `src/lib/integrations/providers/*` — into
// a single `ProviderConfig` shape. The authoritative registry lives at
// `src/lib/integrations/registry.ts`, composed from per-provider files
// under `./providers/`, each default-exporting one of these.
//
// To add a new provider: create `src/lib/integrations/providers/{key}.ts`
// with `export default { ...ProviderConfig }` and add the import to
// `registry.ts`. Transport concerns (OAuth handshake, webhook verification)
// read from the new entry via the `oauth?` / `webhooks?` sub-objects — no
// separate maps to keep in sync.

// --------------------------------------------------------------------------
// Provider identity + taxonomy
// --------------------------------------------------------------------------
// Must match the `integration_provider` enum in the DB schema exactly —
// these strings are stored on `integration_connections.provider`.
export type IntegrationProviderKey =
  | "quickbooks_online"
  | "xero"
  | "sage_business_cloud"
  | "stripe"
  | "google_calendar"
  | "outlook_365"
  | "postmark"
  | "sendgrid";

export type IntegrationCategory =
  | "accounting"
  | "payments"
  | "calendar"
  | "email"
  | "storage"
  | "other";

export type PlanTier = "starter" | "professional" | "enterprise";

// Connection-flow discriminator. The OAuth 2.0 authorization_code handler in
// src/lib/integrations/oauth.ts only drives `oauth2_code`. `stripe_connect`
// routes to the pre-existing /api/contractor/stripe/connect/onboard entry.
// `none` providers (postmark, sendgrid) still appear in the catalog so the
// UI can render them, but have no live connect handshake yet.
export type IntegrationFlow = "oauth2_code" | "stripe_connect" | "none";

// --------------------------------------------------------------------------
// OAuth 2.0 transport (for flow: "oauth2_code")
// --------------------------------------------------------------------------

export type OAuth2TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: unknown;
};

export type OAuthExtractAccount = (args: {
  callbackQuery: URLSearchParams;
  tokenResponse: OAuth2TokenResponse;
}) => {
  externalAccountId: string | null;
  externalAccountName: string | null;
};

export type OAuth2Config = {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  extraAuthorizeParams?: Record<string, string>;
  // Intuit returns realmId on the callback URL (not in the token body); this
  // hook lets each provider pluck the external account identity out of
  // whichever channel it actually travels on.
  extractAccount?: OAuthExtractAccount;
};

// --------------------------------------------------------------------------
// Inbound webhook transport
// --------------------------------------------------------------------------

export type PayloadIdentity = {
  externalAccountId: string | null;
  eventId: string | null;
  eventType: string;
};

export type PayloadExtractor = (payload: unknown) => PayloadIdentity;

// Signature scheme discriminator. QB (intuit), Xero, and Sage all land on
// hmac-sha256-b64 under the hood — only the header name differs. `stripe`
// is handled by its dedicated static route, not the generic handler.
// `google-channel-token` is reserved for the Google Calendar inbound flow
// (ships with the Calendar connector; see
// TODO(google-calendar-inbound) in webhook-verify.ts).
export type WebhookSignatureScheme =
  | "hmac-sha256-b64"
  | "stripe"
  | "google-channel-token"
  | "custom";

export type WebhooksConfig = {
  signatureScheme: WebhookSignatureScheme;
  signatureHeader: string;
  secretEnvVar?: string;
  // Payload → (org identity, event id, event type) extractor used after
  // signature verification passes. The route handler resolves the
  // externalAccountId against integration_connections to find the target org.
  extractIdentity?: PayloadExtractor;
};

// --------------------------------------------------------------------------
// Sync scheduling (forward-facing; consumed by Steps 30+)
// --------------------------------------------------------------------------

export type SyncConfig = {
  entities: string[];
  // Standard 5-field cron. When set, a Trigger.dev scheduled task will pull
  // updates for this provider on this cadence. Unused in Step 29; wired in
  // the accounting-connector steps.
  pullScheduleCron?: string;
};

// --------------------------------------------------------------------------
// ProviderConfig — the single shape each per-provider file default-exports
// --------------------------------------------------------------------------

export type ProviderConfig = {
  // Catalog metadata (drives the UI cards; keys match the legacy
  // ProviderCatalogEntry shape for drop-in compatibility).
  provider: IntegrationProviderKey;
  name: string;
  description: string;
  category: IntegrationCategory;
  minTier: PlanTier;
  phase1: boolean;
  flow: IntegrationFlow;

  oauth?: OAuth2Config;
  webhooks?: WebhooksConfig;
  sync?: SyncConfig;

  // Optional raw SVG for the card logo. The UI today uses an inline
  // JSX gradient-box map (`PROVIDER_LOGOS` in integrations-ui.tsx); future
  // providers that ship with a real svg mark can populate this field and
  // the UI can adopt it incrementally.
  logoSvg?: string;
};

// Backwards-compatible alias. Internal/external consumers that still import
// `ProviderCatalogEntry` continue to work while downstream code migrates.
export type ProviderCatalogEntry = ProviderConfig;
