import { and, desc, eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { integrationConnections, syncEvents } from "@/db/schema";
import type { IntegrationProviderKey } from "@/domain/loaders/integrations";

// Sync-event audit log (Step 27). Every integration action — push, pull,
// reconciliation — writes a row here. Callers typically:
//
//   const { id } = await startSyncEvent({ orgId, providerKey, direction, … });
//   try {
//     const result = await doTheThing();
//     await completeSyncEvent({ id, status: "succeeded", resultData: result });
//   } catch (err) {
//     await completeSyncEvent({ id, status: "failed", errorMessage: String(err) });
//     throw err;
//   }
//
// For idempotent operations (same logical outcome from repeated calls), wrap
// the body in `withIdempotency(input, fn)` — it skips execution and returns
// the prior `resultData` if a previously-succeeded event matches the
// idempotency key.

export type SyncDirection = "push" | "pull" | "reconciliation";
export type SyncStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "skipped"
  | "partial"
  | "mapping_error";
export type TerminalStatus = Exclude<SyncStatus, "pending" | "in_progress">;

export class SyncLogError extends Error {
  constructor(
    public code: "no_connection" | "event_not_found",
    message: string,
  ) {
    super(message);
    this.name = "SyncLogError";
  }
}

// --------------------------------------------------------------------------
// Shared input shapes
// --------------------------------------------------------------------------

export type StartSyncEventInput = {
  orgId: string;
  providerKey: IntegrationProviderKey;
  direction: SyncDirection;
  entityType?: string;
  entityId?: string;
  externalEntityType?: string;
  externalEntityId?: string;
  idempotencyKey?: string;
  summary?: string;
  jobId?: string;
};

export type CompleteSyncEventInput = {
  id: string;
  status: TerminalStatus;
  resultData?: Record<string, unknown>;
  summary?: string;
  errorCode?: string;
  errorMessage?: string;
  externalEntityType?: string;
  externalEntityId?: string;
};

// --------------------------------------------------------------------------
// Primary API
// --------------------------------------------------------------------------

export async function startSyncEvent(
  input: StartSyncEventInput,
): Promise<{ id: string }> {
  const connectionId = await resolveConnectionId(
    input.orgId,
    input.providerKey,
  );
  const [row] = await dbAdmin
    .insert(syncEvents)
    .values({
      integrationConnectionId: connectionId,
      organizationId: input.orgId,
      syncDirection: input.direction,
      syncEventStatus: "in_progress",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      externalEntityType: input.externalEntityType ?? null,
      externalEntityId: input.externalEntityId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      summary: input.summary ?? null,
      jobId: input.jobId ?? null,
      startedAt: new Date(),
    })
    .returning({ id: syncEvents.id });
  return { id: row.id };
}

export async function completeSyncEvent(
  input: CompleteSyncEventInput,
): Promise<void> {
  // sync-log is shared machinery (jobs + tenant routes); writes route
  // through dbAdmin since authorization was enforced by the caller.
  const [existing] = await dbAdmin
    .select({ id: syncEvents.id })
    .from(syncEvents)
    .where(eq(syncEvents.id, input.id))
    .limit(1);
  if (!existing) {
    throw new SyncLogError(
      "event_not_found",
      `sync_events row ${input.id} not found`,
    );
  }
  await dbAdmin
    .update(syncEvents)
    .set({
      syncEventStatus: input.status,
      resultData: input.resultData ?? undefined,
      summary: input.summary ?? undefined,
      errorCode: input.errorCode ?? undefined,
      errorMessage: input.errorMessage ?? undefined,
      externalEntityType: input.externalEntityType ?? undefined,
      externalEntityId: input.externalEntityId ?? undefined,
      completedAt: new Date(),
    })
    .where(eq(syncEvents.id, input.id));
}

// --------------------------------------------------------------------------
// Single-entrypoint umbrella — matches the Step 27 task prompt's signature.
// Callers who prefer two functions should use startSyncEvent/completeSyncEvent
// directly; this is a convenience that forwards based on the presence of `id`.
// --------------------------------------------------------------------------

export function logSyncEvent(
  input: StartSyncEventInput,
): Promise<{ id: string }>;
export function logSyncEvent(
  input: CompleteSyncEventInput,
): Promise<{ id: string }>;
export async function logSyncEvent(
  input: StartSyncEventInput | CompleteSyncEventInput,
): Promise<{ id: string }> {
  if ("id" in input) {
    await completeSyncEvent(input);
    return { id: input.id };
  }
  return startSyncEvent(input);
}

// --------------------------------------------------------------------------
// Idempotency wrapper
// --------------------------------------------------------------------------

export type IdempotencyInput = StartSyncEventInput & {
  idempotencyKey: string; // required here, unlike the base shape
};

export type IdempotencyResult<T> = {
  result: T;
  cached: boolean;
  eventId: string;
};

export type IdempotencyBody<T> = (eventId: string) => Promise<{
  result: T;
  resultData?: Record<string, unknown>;
  externalEntityType?: string;
  externalEntityId?: string;
  summary?: string;
}>;

// Runs `fn` at most once per (org, provider-connection, idempotencyKey) tuple.
// On cache hit, returns the previously-stored `resultData` cast to `T`.
// On cache miss, starts a new sync_events row, runs fn, and logs the outcome.
// Caller is responsible for ensuring T is JSON-serializable — the cached
// path pulls from jsonb storage, which loses class identity and Dates.
export async function withIdempotency<T>(
  input: IdempotencyInput,
  fn: IdempotencyBody<T>,
): Promise<IdempotencyResult<T>> {
  const connectionId = await resolveConnectionId(input.orgId, input.providerKey);

  const [prior] = await dbAdmin
    .select({
      id: syncEvents.id,
      resultData: syncEvents.resultData,
      syncEventStatus: syncEvents.syncEventStatus,
    })
    .from(syncEvents)
    .where(
      and(
        eq(syncEvents.organizationId, input.orgId),
        eq(syncEvents.integrationConnectionId, connectionId),
        eq(syncEvents.idempotencyKey, input.idempotencyKey),
        eq(syncEvents.syncEventStatus, "succeeded"),
      ),
    )
    .orderBy(desc(syncEvents.createdAt))
    .limit(1);

  if (prior) {
    return {
      result: (prior.resultData ?? {}) as T,
      cached: true,
      eventId: prior.id,
    };
  }

  const started = await startSyncEvent(input);

  try {
    const body = await fn(started.id);
    await completeSyncEvent({
      id: started.id,
      status: "succeeded",
      resultData: body.resultData,
      externalEntityType: body.externalEntityType,
      externalEntityId: body.externalEntityId,
      summary: body.summary,
    });
    return { result: body.result, cached: false, eventId: started.id };
  } catch (err) {
    await completeSyncEvent({
      id: started.id,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// --------------------------------------------------------------------------
// Internal — provider → connection resolution
// --------------------------------------------------------------------------

async function resolveConnectionId(
  orgId: string,
  providerKey: IntegrationProviderKey,
): Promise<string> {
  // Most-recent connection for (org, provider), regardless of status. A
  // disconnected connection can still receive final sync events tied to it
  // (e.g. a push that was already in flight when the user revoked). If no
  // connection has ever existed, bail — you can't sync without one.
  // Sync-log is shared machinery — runs from background jobs and from
  // tenant-scoped sync triggers. Use admin pool so the orgId/provider
  // lookup works regardless of which path called in. Authorisation is
  // already enforced by the caller (jobs are cross-org by design;
  // tenant routes resolve ctx before calling).
  const [conn] = await dbAdmin
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
