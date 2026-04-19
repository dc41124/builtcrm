import { createHmac, timingSafeEqual } from "node:crypto";

import { getProviderConfig } from "./registry";
import type {
  IntegrationProviderKey,
  PayloadExtractor,
  PayloadIdentity,
  WebhooksConfig,
} from "./types";

// Re-export for legacy importers (Step 26 route handler pulls PayloadIdentity
// from here). Canonical source is `@/lib/integrations/types`.
export type { PayloadIdentity };

// Inbound webhook signature verification.
//
// Step 29 refactor (plan A): this module no longer owns a per-provider map of
// hand-rolled verifiers. Instead it reads each provider's `webhooks`
// sub-object via `getProviderConfig()` from the authoritative registry
// (`src/lib/integrations/registry.ts`) and dispatches on `signatureScheme`.
// The shared HMAC-SHA256 base64 path handles QuickBooks, Xero, Sage, and
// anything else that signs with the same primitive — only the header name
// and env-var key differ.
//
// Caller contract (unchanged from Step 26):
//   const rawBody = await req.text();
//   const verifier = getVerifier(providerKey);
//   const result = verifier({ rawBody, headers: req.headers });
//   if (!result.verified) return 400;
//   const payload = JSON.parse(rawBody);
//   const identity = getExtractor(providerKey)?.(payload);
//
// The raw body MUST be read before any JSON parsing — Next.js App Router
// allows exactly one body read.

export type VerifyResult =
  | { verified: true }
  | { verified: false; reason: VerifyFailReason };

export type VerifyFailReason =
  | "missing_header"
  | "missing_secret"
  | "bad_signature"
  | "provider_not_implemented";

export type Verifier = (args: {
  rawBody: string;
  headers: Headers;
}) => VerifyResult;

// --------------------------------------------------------------------------
// Public registry lookups — everything else is helpers
// --------------------------------------------------------------------------

export function getVerifier(
  provider: IntegrationProviderKey,
): Verifier | null {
  const cfg = getProviderConfig(provider)?.webhooks;
  if (!cfg) return null;
  return buildVerifier(cfg);
}

export function getExtractor(
  provider: IntegrationProviderKey,
): PayloadExtractor | null {
  return getProviderConfig(provider)?.webhooks?.extractIdentity ?? null;
}

// --------------------------------------------------------------------------
// Scheme dispatch
// --------------------------------------------------------------------------

function buildVerifier(cfg: WebhooksConfig): Verifier {
  switch (cfg.signatureScheme) {
    case "hmac-sha256-b64":
      return buildHmacB64Verifier(cfg);
    case "google-channel-token":
      // TODO(google-calendar-inbound): replace with a channel-token verifier
      // that compares the X-Goog-Channel-Token header against the per-channel
      // secret stored on integration_connections.mapping_config at watch-
      // creation time. Ships with the Calendar connector.
      return () => ({ verified: false, reason: "provider_not_implemented" });
    case "stripe":
      // Stripe's inbound webhook uses its own static route at
      // /api/webhooks/stripe with stripe.webhooks.constructEvent(). If this
      // path fires, the generic route was pointed at a Stripe provider —
      // which shouldn't happen because Next.js static-route precedence
      // sends /api/webhooks/stripe to the dedicated handler. Fail loud.
      return () => ({ verified: false, reason: "provider_not_implemented" });
    case "custom":
      return () => ({ verified: false, reason: "provider_not_implemented" });
  }
}

function buildHmacB64Verifier(cfg: WebhooksConfig): Verifier {
  const header = cfg.signatureHeader;
  const secretEnv = cfg.secretEnvVar;
  return ({ rawBody, headers }) => {
    const sig = headers.get(header);
    if (!sig) return { verified: false, reason: "missing_header" };
    if (!secretEnv) return { verified: false, reason: "missing_secret" };
    const secret = process.env[secretEnv];
    if (!secret) return { verified: false, reason: "missing_secret" };
    return hmacSha256Base64(rawBody, secret, sig);
  };
}

// --------------------------------------------------------------------------
// Shared HMAC-SHA256 base64 comparison (constant-time)
// --------------------------------------------------------------------------

function hmacSha256Base64(
  rawBody: string,
  secret: string,
  providedB64: string,
): VerifyResult {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(providedB64, "base64");
  } catch {
    return { verified: false, reason: "bad_signature" };
  }
  if (provided.length !== expected.length) {
    return { verified: false, reason: "bad_signature" };
  }
  return timingSafeEqual(provided, expected)
    ? { verified: true }
    : { verified: false, reason: "bad_signature" };
}
