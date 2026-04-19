import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents, integrationConnections } from "@/db/schema";
import type { IntegrationProviderKey } from "@/domain/loaders/integrations";

import { completeSyncEvent, startSyncEvent, SyncLogError } from "./sync-log";

// Shared scaffolding for stubbed accounting connectors (Steps 34–36).
// Each provider supplies its own `wouldSend` payload shape (the fake
// outbound API body) and a one-line review-gate reason; this helper runs
// the repetitive parts: connection lookup, sync_events start/complete with
// status='skipped', and the `integration.sync.stubbed` audit write.
//
// Why status='skipped' and not 'stubbed': the `sync_event_status` pg enum
// doesn't include a 'stubbed' value and adding one would require a schema
// migration. 'skipped' is already in the enum and semantically close —
// queryable via `resultData->>'stubbed'=true` when a real "skipped"
// outcome needs to be distinguished from a stubbed one later.

export type StubSyncRequest = {
  providerKey: IntegrationProviderKey;
  orgId: string;
  actorUserId: string;
  direction: "push" | "reconciliation";
  entityType?: string;
  entityId?: string;
  wouldSend: unknown;
  reviewGate: string; // e.g. "Intuit app review", "Xero app review"
};

export type StubSyncResult = {
  eventId: string;
  stubbed: true;
  wouldSend: unknown;
};

export async function runStubSync(
  input: StubSyncRequest,
): Promise<StubSyncResult> {
  const connectionId = await resolveConnectionId(input.orgId, input.providerKey);

  const summary = `Stubbed — production sync requires ${input.reviewGate}`;

  const { id: eventId } = await startSyncEvent({
    orgId: input.orgId,
    providerKey: input.providerKey,
    direction: input.direction,
    entityType: input.entityType,
    entityId: input.entityId,
    summary,
  });

  await completeSyncEvent({
    id: eventId,
    status: "skipped",
    summary,
    resultData: {
      stubbed: true,
      reason: `Production sync requires ${input.reviewGate}. See README § Third-party integrations.`,
      wouldSend: input.wouldSend,
    },
  });

  await db.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    organizationId: input.orgId,
    objectType: "integration_connection",
    objectId: connectionId,
    actionName: "integration.sync.stubbed",
    metadataJson: {
      provider: input.providerKey,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      syncEventId: eventId,
    },
  });

  return { eventId, stubbed: true, wouldSend: input.wouldSend };
}

async function resolveConnectionId(
  orgId: string,
  providerKey: IntegrationProviderKey,
): Promise<string> {
  const [conn] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, orgId),
        eq(integrationConnections.provider, providerKey),
      ),
    )
    .orderBy(desc(integrationConnections.createdAt))
    .limit(1);
  if (!conn) {
    throw new SyncLogError(
      "no_connection",
      `No ${providerKey} connection on record for organization ${orgId}`,
    );
  }
  return conn.id;
}
