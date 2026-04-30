/**
 * IndexedDB schema + open helper for the Step 51 offline outbox.
 *
 * One database (`builtcrm-offline`), three stores:
 *
 *   outbox    — pending writes. Key: clientId (UUID minted by the producer).
 *               Generic-by-design: `kind` discriminates the producer (Step 51
 *               only registers `daily_log_create`; future producers documented
 *               in docs/specs/production_grade_upgrades/offline_outbox_generic_producers.md).
 *   photos    — raw blobs awaiting R2 upload. Key: photoClientId. References
 *               an outbox row via dailyLogClientId so the photo follows its
 *               parent log on drain.
 *   meta      — single-row store for schema version + last-drain timestamp.
 *
 * The schema is intentionally tied to the file via DB_VERSION + onupgradeneeded
 * — when we add new producers / new stores, bump the version + add the store
 * in the upgrade callback. Browsers run upgrades atomically with old/new pages
 * blocked until the upgrade resolves.
 *
 * IMPORTANT: this file imports `idb`, which is browser-only. The service-worker
 * variant lives in queue.sw.ts (deferred — see offline_background_sync_api.md).
 */

import { type DBSchema, type IDBPDatabase, openDB } from "idb";

export const DB_NAME = "builtcrm-offline";
export const DB_VERSION = 1;

// ----- Outbox row shape -----------------------------------------------------

export type OutboxKind = "daily_log_create";

export type OutboxStatus =
  | "pending" // waiting to drain
  | "syncing" // currently being drained
  | "conflict" // server said 409 (project,date) — needs user resolution
  | "failed_permanent"; // backoff exhausted, manual retry only

export interface OutboxRowBase {
  clientId: string; // UUID; idempotency key for the API
  kind: OutboxKind;
  status: OutboxStatus;
  enqueuedAt: number; // Date.now() at enqueue
  lastAttemptAt: number; // Date.now() of last drain attempt; equals enqueuedAt before first attempt
  attempts: number;
  lastError: string | null;
  // Free-form payload — drainer reads kind, branches.
  payload: unknown;
}

// Producer-specific payload types — one entry per registered kind.
export interface DailyLogCreatePayload {
  projectId: string;
  logDate: string; // YYYY-MM-DD
  intent: "draft" | "submit";
  // Hybrid clock data: when the user hit submit on their device.
  clientSubmittedAt: string | null;
  // Mirror the API BodySchema — typed as unknown here, validated at drain.
  body: Record<string, unknown>;
  // Client IDs of any photos that should follow this log (drained AFTER the
  // log create resolves, with the parent's server id substituted in).
  photoClientIds: string[];
}

export type OutboxRow = OutboxRowBase & {
  kind: "daily_log_create";
  payload: DailyLogCreatePayload;
};

// ----- Photo row shape ------------------------------------------------------

export interface PhotoRow {
  photoClientId: string; // UUID
  dailyLogClientId: string; // FK into outbox row.clientId
  blob: Blob;
  mimeType: string;
  caption: string | null;
  sortOrder: number;
  isHero: boolean;
  thumbDataUrl: string; // 160x160 base64 for in-app preview
  capturedAt: number; // Date.now() at capture
}

// ----- Meta row -------------------------------------------------------------

export interface MetaRow {
  key: "singleton";
  schemaVersion: number;
  lastDrainAt: number | null;
}

// ----- Combined DB schema ---------------------------------------------------

interface OfflineSchema extends DBSchema {
  outbox: {
    key: string;
    value: OutboxRow;
    indexes: {
      "by-status": OutboxStatus;
      "by-enqueued-at": number;
    };
  };
  photos: {
    key: string;
    value: PhotoRow;
    indexes: {
      "by-daily-log-client-id": string;
    };
  };
  meta: {
    key: string;
    value: MetaRow;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<OfflineSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const outbox = db.createObjectStore("outbox", { keyPath: "clientId" });
          outbox.createIndex("by-status", "status");
          outbox.createIndex("by-enqueued-at", "enqueuedAt");

          const photos = db.createObjectStore("photos", { keyPath: "photoClientId" });
          photos.createIndex("by-daily-log-client-id", "dailyLogClientId");

          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Test-only — drop the singleton handle so each test reopens fresh.
 * Closes the underlying connection if it was opened so deleteDatabase
 * isn't blocked. */
export async function __resetDbHandleForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
  }
  dbPromise = null;
}
