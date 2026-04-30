import { randomUUID } from "node:crypto";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { asc, eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { r2OrphanQueue } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { r2, R2_BUCKET } from "@/lib/storage";

// Daily R2 orphan purge. Reads `pending` rows from r2_orphan_queue (populated
// by AFTER DELETE/UPDATE triggers — see migration 0044), batches up to
// BATCH_SIZE per run, calls DeleteObjectCommand on each, and marks the row
// `deleted` on success or `failed_permanent` after MAX_ATTEMPTS retries.
//
// R2's DeleteObjectCommand is idempotent — deleting a non-existent key
// returns 200, so duplicate processing is safe.
//
// Scheduled at 04:45 UTC, 15 min after the existing retention jobs
// (notification-purge, audit-event-purge, activity-feed-purge at 04:00 /
// 04:15 / 04:30) to avoid pool overlap.
//
// See docs/specs/security_posture.md §6 "R2 orphan cleanup" for the design
// rationale and the deferred path-5 (failed-upload) follow-up.

const BATCH_SIZE = 200;
const MAX_ATTEMPTS = 5;

export const r2OrphanPurge = schedules.task({
  id: "r2-orphan-purge",
  cron: "45 4 * * *",
  maxDuration: 600,
  run: async () => {
    // Pick up the oldest pending rows. The status index makes the where-clause
    // cheap; queued_at ordering gives FIFO so a backlog drains in arrival order.
    const pending = await dbAdmin
      .select({
        id: r2OrphanQueue.id,
        storageKey: r2OrphanQueue.storageKey,
        attemptCount: r2OrphanQueue.attemptCount,
      })
      .from(r2OrphanQueue)
      .where(eq(r2OrphanQueue.status, "pending"))
      .orderBy(asc(r2OrphanQueue.queuedAt))
      .limit(BATCH_SIZE);

    let deletedCount = 0;
    let failedPermanentCount = 0;
    let retryCount = 0;

    for (const row of pending) {
      try {
        await r2.send(
          new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.storageKey }),
        );
        await dbAdmin
          .update(r2OrphanQueue)
          .set({
            status: "deleted",
            attemptedAt: new Date(),
            attemptCount: row.attemptCount + 1,
          })
          .where(eq(r2OrphanQueue.id, row.id));
        deletedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const nextAttempt = row.attemptCount + 1;
        const giveUp = nextAttempt >= MAX_ATTEMPTS;
        await dbAdmin
          .update(r2OrphanQueue)
          .set({
            status: giveUp ? "failed_permanent" : "pending",
            attemptedAt: new Date(),
            attemptCount: nextAttempt,
            lastError: message.slice(0, 1000),
          })
          .where(eq(r2OrphanQueue.id, row.id));
        if (giveUp) {
          failedPermanentCount++;
          logger.error("r2-orphan-purge: gave up on key", {
            storageKey: row.storageKey,
            attempts: nextAttempt,
            error: message,
          });
        } else {
          retryCount++;
        }
      }
    }

    // Lightweight bookkeeping: how many `deleted` rows are still around?
    // Kept ~7d for observability before a future GC pass purges them.
    const [{ pendingTotal, deletedTotal, failedTotal }] = await dbAdmin
      .select({
        pendingTotal: sql<number>`count(*) filter (where ${r2OrphanQueue.status} = 'pending')`,
        deletedTotal: sql<number>`count(*) filter (where ${r2OrphanQueue.status} = 'deleted')`,
        failedTotal: sql<number>`count(*) filter (where ${r2OrphanQueue.status} = 'failed_permanent')`,
      })
      .from(r2OrphanQueue);

    logger.info("r2-orphan-purge complete", {
      processed: pending.length,
      deletedCount,
      retryCount,
      failedPermanentCount,
      queueState: { pendingTotal, deletedTotal, failedTotal },
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "r2-orphan-purge.run_complete",
      details: {
        metadata: {
          jobId: "r2-orphan-purge",
          processed: pending.length,
          deletedCount,
          retryCount,
          failedPermanentCount,
          batchSize: BATCH_SIZE,
          maxAttempts: MAX_ATTEMPTS,
        },
      },
    });

    return {
      processed: pending.length,
      deletedCount,
      retryCount,
      failedPermanentCount,
    };
  },
});
