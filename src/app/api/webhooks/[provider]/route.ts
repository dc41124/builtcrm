import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, integrationConnections, webhookEvents } from "@/db/schema";
import type { IntegrationProviderKey } from "@/domain/loaders/integrations";
import { getSystemUserId } from "@/domain/system-user";
import {
  getExtractor,
  getVerifier,
  type PayloadIdentity,
} from "@/lib/integrations/webhook-verify";

// POST /api/webhooks/[provider]
//
// Generic inbound webhook receiver for OAuth-connected providers (QuickBooks,
// Xero, Sage, Google Calendar). Stripe webhooks KEEP their dedicated static
// route at /api/webhooks/stripe — Next.js resolves static paths before
// dynamic ones, so Stripe traffic never reaches this handler.
//
// Body read order is load-bearing. Next.js App Router allows exactly one
// body read, so we must:
//   1. req.text()      — capture raw bytes for signature verification
//   2. verifier(raw)   — HMAC / channel-token check against raw bytes
//   3. JSON.parse(raw) — only after verify passes
// Reading .json() first, or parsing before verifying, silently breaks the
// signature check.

const VALID_PROVIDERS = new Set<IntegrationProviderKey>([
  "quickbooks_online",
  "xero",
  "sage_business_cloud",
  "google_calendar",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!VALID_PROVIDERS.has(provider as IntegrationProviderKey)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  }
  const providerKey = provider as IntegrationProviderKey;

  // Google Calendar uses a channel-token scheme, not HMAC. We don't ship it
  // in Step 26 — 501 with a clear TODO anchor so the handler is easy to find.
  // TODO(google-calendar-inbound): replace with channel-token verification
  // that reads integration_connections.mapping_config.channelToken.
  if (providerKey === "google_calendar") {
    return NextResponse.json(
      { error: "not_implemented", message: "Google Calendar inbound webhooks ship with the Calendar connector." },
      { status: 501 },
    );
  }

  // Step 1 — raw body first. Do not parse.
  const rawBody = await req.text();

  // Step 2 — verify against raw bytes.
  const verifier = getVerifier(providerKey);
  if (!verifier) {
    return NextResponse.json({ error: "no_verifier" }, { status: 500 });
  }
  const verification = verifier({ rawBody, headers: req.headers });
  if (!verification.verified) {
    // Audit the failure WITHOUT storing the payload — we don't trust forged
    // data. Use the system user as actor since there's no session context.
    await dbAdmin.insert(auditEvents).values({
      actorUserId: await getSystemUserId(),
      organizationId: null,
      objectType: "webhook_event",
      objectId: "00000000-0000-0000-0000-000000000000",
      actionName: "webhook.failed",
      metadataJson: {
        provider: providerKey,
        stage: "signature",
        reason: verification.reason,
      },
    });
    return NextResponse.json(
      { error: "invalid_signature", reason: verification.reason },
      { status: 400 },
    );
  }

  // Step 3 — parse after verify.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  const extractor = getExtractor(providerKey);
  const identity: PayloadIdentity = extractor
    ? extractor(payload)
    : { externalAccountId: null, eventId: null, eventType: "unknown" };

  // Resolve target org by looking up the connection. If we can't (delivery
  // doesn't match any registered integration_connection), persist the row
  // anyway with organizationId=null — the column is nullable specifically
  // for this case, so we keep full row-level forensic context for unmatched
  // deliveries instead of just an audit breadcrumb.
  let organizationId: string | null = null;
  if (identity.externalAccountId) {
    // Pre-tenant lookup — webhook arrives with only the provider's
    // externalAccountId, no session. Admin pool to derive orgId.
    const [conn] = await dbAdmin
      .select({ id: integrationConnections.organizationId })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.provider, providerKey),
          eq(integrationConnections.externalAccountId, identity.externalAccountId),
        ),
      )
      .limit(1);
    organizationId = conn?.id ?? null;
  }

  const now = new Date();
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const eventId = identity.eventId ?? `synthetic:${payloadHash.slice(0, 32)}`;

  // Dedup check — today a narrow SELECT/INSERT race. See the deferred
  // migration note in HANDOFF.md: a partial unique index on
  // (source_provider, event_id) where webhook_direction = 'inbound' makes
  // this atomic via ON CONFLICT DO NOTHING once it lands. Until then we
  // accept the ms-scale race; volume in a portfolio build is single-digit
  // webhooks/day.
  // Webhook handler is pre-tenant by nature (anonymous external delivery,
  // no session). dbAdmin end-to-end — matches the reviewer-token + transmittal
  // anonymous-access precedents.
  const [existing] = await dbAdmin
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.sourceProvider, providerKey),
        eq(webhookEvents.eventId, eventId),
        eq(webhookEvents.webhookDirection, "inbound"),
      ),
    )
    .limit(1);

  if (existing) {
    await dbAdmin.insert(auditEvents).values({
      actorUserId: await getSystemUserId(),
      organizationId,
      objectType: "webhook_event",
      objectId: existing.id,
      actionName: "webhook.duplicate",
      metadataJson: {
        provider: providerKey,
        eventId,
        eventType: identity.eventType,
      },
    });
    return NextResponse.json({ status: "duplicate", id: existing.id });
  }

  const payloadJson =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : { _wrapped: payload };

  const [inserted] = await dbAdmin
    .insert(webhookEvents)
    .values({
      organizationId,
      webhookDirection: "inbound",
      deliveryStatus: "received",
      eventType: identity.eventType.slice(0, 255),
      eventId: eventId.slice(0, 255),
      sourceProvider: providerKey,
      endpointUrl: new URL(req.url).pathname,
      payloadHash,
      payload: payloadJson,
      signatureVerified: true,
      receivedAt: now,
    })
    .returning({ id: webhookEvents.id });

  await dbAdmin.insert(auditEvents).values({
    actorUserId: await getSystemUserId(),
    organizationId,
    objectType: "webhook_event",
    objectId: inserted.id,
    actionName: "webhook.received",
    metadataJson: {
      provider: providerKey,
      eventId,
      eventType: identity.eventType,
      ...(organizationId ? {} : { unmatched: true, externalAccountId: identity.externalAccountId }),
    },
  });

  // Unmatched deliveries 202 (accepted-but-no-tenant-routing); matched 200.
  // Either way the row is persisted, providers see 2xx and don't retry, and
  // operators can replay/forensic via dbAdmin reads on the row.
  if (!organizationId) {
    return NextResponse.json({ status: "unmatched", id: inserted.id }, { status: 202 });
  }
  return NextResponse.json({ status: "received", id: inserted.id });
}
