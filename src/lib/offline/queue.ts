/**
 * Outbox API for the Step 51 offline write queue.
 *
 * Generic-by-design: every producer (only `daily_log_create` registered today)
 * registers a drain handler via `registerProducer`. Drain orchestration lives
 * here; producer-specific HTTP calls + conflict semantics live in the producer
 * file (see dailyLogs.ts).
 *
 * Drain order: oldest-enqueued first, one row in flight at a time. Photos
 * chained off a daily-log-create are drained AFTER the parent succeeds (the
 * producer reads photoClientIds and uploads them itself; queue.ts doesn't
 * need to know about photo storage).
 *
 * Backoff schedule on transient failure (network, 5xx):
 *   attempt 0 → 0s
 *   attempt 1 → 5s
 *   attempt 2 → 30s
 *   attempt 3 → 5min
 *   attempt 4 → 30min
 *   attempt 5 → mark failed_permanent
 *
 * Permanent failures stay in the outbox for manual retry / discard via the
 * /contractor/settings/offline-queue page.
 *
 * Conflict (server returned 409 for genuine collision) → status="conflict",
 * surfaces in the queue page with a user choice. Idempotent retries (server
 * returned 200 with idempotent:true) drain successfully — that's the whole
 * point of clientUuid.
 */

import { getDb, type OutboxKind, type OutboxRow, type OutboxStatus } from "./db";

// ---------- Producer registry -----------------------------------------------

export type DrainOutcome =
  | { type: "ok"; serverId: string }
  | { type: "idempotent"; serverId: string }
  | { type: "conflict"; reason: string; serverData?: Record<string, unknown> }
  | { type: "transient"; reason: string }
  | { type: "permanent"; reason: string };

export type Producer<T = unknown> = {
  kind: OutboxKind;
  /** Drain a single row. Implementation makes the network call(s). */
  drain: (row: OutboxRow & { payload: T }) => Promise<DrainOutcome>;
  /** Human-readable description for the queue UI. */
  describe: (payload: T) => { title: string; subtitle?: string };
};

const producers = new Map<OutboxKind, Producer>();

export function registerProducer<T>(producer: Producer<T>): void {
  producers.set(producer.kind, producer as Producer);
}

export function getProducer(kind: OutboxKind): Producer | undefined {
  return producers.get(kind);
}

// ---------- Backoff ---------------------------------------------------------

export const BACKOFF_MS = [0, 5_000, 30_000, 5 * 60_000, 30 * 60_000];
const MAX_ATTEMPTS = BACKOFF_MS.length; // attempts >= this → permanent

/** Pure helper — exported for tests. */
export function shouldRetry(attempts: number, lastAttemptAt: number, now: number): boolean {
  if (attempts >= MAX_ATTEMPTS) return false;
  const waitMs = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
  return now - lastAttemptAt >= waitMs;
}

// ---------- API -------------------------------------------------------------

/** Enqueue a write. Returns the row's clientId. */
export async function enqueueWrite(input: {
  clientId: string;
  kind: OutboxKind;
  payload: unknown;
  now?: () => number;
}): Promise<string> {
  const db = await getDb();
  const t = (input.now ?? Date.now)();
  // The discriminated-union OutboxRow requires (kind, payload) to match;
  // here we assemble a generic row from the producer's input. Cast through
  // unknown is required because `payload: unknown` doesn't narrow into the
  // discriminated payload type. Producers register their drain handlers
  // with explicit types, so the safety check happens at the drain call.
  const row = {
    clientId: input.clientId,
    kind: input.kind,
    status: "pending" as const,
    enqueuedAt: t,
    lastAttemptAt: t,
    attempts: 0,
    lastError: null,
    payload: input.payload,
  } as unknown as OutboxRow;
  await db.put("outbox", row);
  return row.clientId;
}

/** List pending + conflict + failed rows, oldest first. */
export async function listPending(): Promise<OutboxRow[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("outbox", "by-enqueued-at");
  return all.filter((r) => r.status !== "syncing");
}

/** List rows in a given status, oldest first. */
export async function listByStatus(status: OutboxStatus): Promise<OutboxRow[]> {
  const db = await getDb();
  return await db.getAllFromIndex("outbox", "by-status", status);
}

/** Drop a row entirely (used for "discard" on conflict / permanent fail). */
export async function dropPending(clientId: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", clientId);
}

/** Force-retry a failed_permanent or conflict row by resetting attempts. */
export async function retryRow(clientId: string): Promise<void> {
  const db = await getDb();
  const row = await db.get("outbox", clientId);
  if (!row) return;
  row.status = "pending";
  row.attempts = 0;
  row.lastError = null;
  row.lastAttemptAt = Date.now();
  await db.put("outbox", row);
}

let drainInFlight = false;

/**
 * Drain pending rows. One in flight at a time per process — concurrent calls
 * coalesce. Returns an outcome summary so the caller can toast the user.
 */
export async function drainQueue(now: () => number = Date.now): Promise<{
  drained: number;
  conflicted: number;
  permanent: number;
  remaining: number;
}> {
  if (drainInFlight) {
    return { drained: 0, conflicted: 0, permanent: 0, remaining: 0 };
  }
  drainInFlight = true;

  let drained = 0;
  let conflicted = 0;
  let permanent = 0;

  try {
    const db = await getDb();
    const ordered = await db.getAllFromIndex("outbox", "by-enqueued-at");

    for (const row of ordered) {
      if (row.status === "conflict" || row.status === "failed_permanent") continue;
      if (row.status === "syncing") continue;
      if (!shouldRetry(row.attempts, row.lastAttemptAt, now())) continue;

      const producer = producers.get(row.kind);
      if (!producer) {
        // Producer not registered — skip; will retry once registered.
        continue;
      }

      // Mark in-flight, persist, then attempt.
      row.status = "syncing";
      row.lastAttemptAt = now();
      await db.put("outbox", row);

      let outcome: DrainOutcome;
      try {
        outcome = await producer.drain(row);
      } catch (err) {
        outcome = {
          type: "transient",
          reason: err instanceof Error ? err.message : String(err),
        };
      }

      if (outcome.type === "ok" || outcome.type === "idempotent") {
        await db.delete("outbox", row.clientId);
        drained += 1;
        continue;
      }

      if (outcome.type === "conflict") {
        row.status = "conflict";
        row.lastError = outcome.reason;
        await db.put("outbox", row);
        conflicted += 1;
        continue;
      }

      if (outcome.type === "permanent") {
        row.status = "failed_permanent";
        row.lastError = outcome.reason;
        await db.put("outbox", row);
        permanent += 1;
        continue;
      }

      // transient
      row.attempts += 1;
      row.lastError = outcome.reason;
      row.status = row.attempts >= MAX_ATTEMPTS ? "failed_permanent" : "pending";
      if (row.status === "failed_permanent") permanent += 1;
      await db.put("outbox", row);
    }

    // Touch meta with last-drain timestamp.
    await db.put("meta", {
      key: "singleton",
      schemaVersion: 1,
      lastDrainAt: now(),
    });

    const remaining = (await listPending()).length;
    return { drained, conflicted, permanent, remaining };
  } finally {
    drainInFlight = false;
  }
}

/** Test-only — clear the in-flight latch. */
export function __resetDrainLatchForTests(): void {
  drainInFlight = false;
}

/** Test-only — clear all registered producers. */
export function __clearProducersForTests(): void {
  producers.clear();
}
