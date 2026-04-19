import { createHmac, timingSafeEqual } from "node:crypto";

import type { IntegrationProviderKey } from "@/domain/loaders/integrations";

// Provider-specific inbound webhook signature verification.
//
// Every adapter takes the RAW request body (a string of the exact bytes the
// provider signed) plus the request headers. The raw body MUST be read before
// any JSON parsing — Next.js App Router allows exactly one body read, so the
// caller must: req.text() → verify → JSON.parse. Reversing any of these steps
// leaves the signature check operating on re-encoded text and the verification
// will fail silently.
//
// Result shape carries `verified: false` with a machine-readable `reason` so
// the route handler can audit the failure without trusting the payload.

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
// QuickBooks Online
// --------------------------------------------------------------------------
// Intuit's webhook verifier: base64(HMAC-SHA256(rawBody, verifierToken)),
// delivered in the `intuit-signature` header.
// https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
export const verifyQuickbooks: Verifier = ({ rawBody, headers }) => {
  const sig = headers.get("intuit-signature");
  if (!sig) return { verified: false, reason: "missing_header" };
  const secret = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
  if (!secret) return { verified: false, reason: "missing_secret" };
  return hmacSha256Base64(rawBody, secret, sig);
};

// --------------------------------------------------------------------------
// Xero
// --------------------------------------------------------------------------
// Xero's webhook key: base64(HMAC-SHA256(rawBody, webhookKey)),
// delivered in the `x-xero-signature` header.
// https://developer.xero.com/documentation/guides/webhooks/overview
export const verifyXero: Verifier = ({ rawBody, headers }) => {
  const sig = headers.get("x-xero-signature");
  if (!sig) return { verified: false, reason: "missing_header" };
  const secret = process.env.XERO_WEBHOOK_KEY;
  if (!secret) return { verified: false, reason: "missing_secret" };
  return hmacSha256Base64(rawBody, secret, sig);
};

// --------------------------------------------------------------------------
// Sage Business Cloud
// --------------------------------------------------------------------------
// Sage docs on webhook HMAC are sparse; assume base64 HMAC-SHA256 pattern
// with header `x-sage-signature`. Revisit when the live endpoint is wired.
export const verifySage: Verifier = ({ rawBody, headers }) => {
  const sig = headers.get("x-sage-signature");
  if (!sig) return { verified: false, reason: "missing_header" };
  const secret = process.env.SAGE_WEBHOOK_SECRET;
  if (!secret) return { verified: false, reason: "missing_secret" };
  return hmacSha256Base64(rawBody, secret, sig);
};

// --------------------------------------------------------------------------
// Google Calendar — NOT IMPLEMENTED
// --------------------------------------------------------------------------
// Google Calendar push notifications don't use HMAC. They use a channel-
// token scheme: when creating a watch/subscription, the caller supplies a
// per-channel secret token; Google echoes it back on every notification in
// the `X-Goog-Channel-Token` header. Verification means "this channel was
// created by us with this token." Forcing that into the HMAC adapter shape
// would leak abstraction boundaries; wire it separately when the Calendar
// connector ships.
// TODO(google-calendar-inbound): distinct verifier that reads
//   integration_connections.mapping_config.channelToken and compares against
//   the X-Goog-Channel-Token header. Route handler should 501 until then.
export const verifyGoogleCalendar: Verifier = () => ({
  verified: false,
  reason: "provider_not_implemented",
});

// --------------------------------------------------------------------------
// Registry
// --------------------------------------------------------------------------

const VERIFIERS: Partial<Record<IntegrationProviderKey, Verifier>> = {
  quickbooks_online: verifyQuickbooks,
  xero: verifyXero,
  sage_business_cloud: verifySage,
  google_calendar: verifyGoogleCalendar,
};

export function getVerifier(provider: IntegrationProviderKey): Verifier | null {
  return VERIFIERS[provider] ?? null;
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

// --------------------------------------------------------------------------
// Payload → (organizationId, eventId) extraction
// --------------------------------------------------------------------------
//
// Inbound payloads don't carry a user session; we resolve the target org by
// looking up integration_connections where (provider, external_account_id)
// matches the identifier in the payload. Each provider names that identifier
// differently, so extraction lives here alongside verification.
//
// If an adapter can't extract an identifier, the route handler returns 202
// and writes an audit-only event — the row-level diagnostic trail is lost
// until the deferred nullable-org_id migration (see HANDOFF.md) lands.

export type PayloadIdentity = {
  externalAccountId: string | null; // provider-side account / realm / tenant
  eventId: string | null; // provider's idempotency key for this delivery
  eventType: string; // best-effort label (e.g. "invoice.created")
};

export type PayloadExtractor = (payload: unknown) => PayloadIdentity;

export const extractQuickbooks: PayloadExtractor = (payload) => {
  // Intuit payload shape: { eventNotifications: [{ realmId, dataChangeEvent: {...} }] }
  const p = asRecord(payload);
  const first = asRecordArray(p.eventNotifications)[0] ?? {};
  const realmId = typeof first.realmId === "string" ? first.realmId : null;
  const entities = asRecordArray(
    asRecord(first.dataChangeEvent).entities,
  );
  const firstEntity = entities[0] ?? {};
  return {
    externalAccountId: realmId,
    // QB doesn't send a globally-unique delivery id; synthesize one from the
    // realm + first entity id + operation so retries hash the same.
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

export const extractXero: PayloadExtractor = (payload) => {
  // Xero payload shape: { events: [{ resourceUrl, tenantId, eventCategory, eventType, eventDateUtc }], firstEventSequence, lastEventSequence }
  const p = asRecord(payload);
  const events = asRecordArray(p.events);
  const first = events[0] ?? {};
  const tenantId = typeof first.tenantId === "string" ? first.tenantId : null;
  const category = typeof first.eventCategory === "string" ? first.eventCategory : "unknown";
  const eventType = typeof first.eventType === "string" ? first.eventType : "unknown";
  const resourceId = typeof first.resourceId === "string" ? first.resourceId : "";
  const seq = typeof p.firstEventSequence === "number" ? p.firstEventSequence : null;
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

export const extractSage: PayloadExtractor = () => ({
  // Sage payload shape is TBD — stub extractor returns nulls so unmatched
  // events audit and no-op until the real connector lands.
  externalAccountId: null,
  eventId: null,
  eventType: "sage.unknown",
});

const EXTRACTORS: Partial<Record<IntegrationProviderKey, PayloadExtractor>> = {
  quickbooks_online: extractQuickbooks,
  xero: extractXero,
  sage_business_cloud: extractSage,
};

export function getExtractor(
  provider: IntegrationProviderKey,
): PayloadExtractor | null {
  return EXTRACTORS[provider] ?? null;
}

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
