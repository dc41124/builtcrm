import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, lt } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { syncEvents } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";

// Daily cleanup of sync_events (Step 27). Removes `succeeded` rows older
// than 90 days; every other status (`failed`, `skipped`, `partial`,
// `mapping_error`, `pending`, `in_progress`) is kept indefinitely because
// those carry diagnostic signal a human may want to trace later.
//
// Scheduled at 03:30 UTC daily — off-peak, doesn't collide with the 30-min
// integration-token-refresh or 1-min integration-webhook-processor cadences.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const integrationSyncEventCleanup = schedules.task({
  id: "integration-sync-event-cleanup",
  cron: "30 3 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const cutoff = new Date(payload.timestamp.getTime() - NINETY_DAYS_MS);

    // Cross-org system cleanup. RLS on sync_events gates by organization_id;
    // a cron sweep has no caller context. dbAdmin bypasses uniformly.
    // legal_hold = true overrides scheduled deletion (Step 66.5).
    const deleted = await dbAdmin
      .delete(syncEvents)
      .where(
        and(
          eq(syncEvents.syncEventStatus, "succeeded"),
          lt(syncEvents.createdAt, cutoff),
          eq(syncEvents.legalHold, false),
        ),
      )
      .returning({ id: syncEvents.id });

    logger.info("sync_events cleanup complete", {
      cutoff: cutoff.toISOString(),
      deletedCount: deleted.length,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "integration-sync-event-cleanup.run_complete",
      details: {
        metadata: {
          jobId: "integration-sync-event-cleanup",
          cutoff: cutoff.toISOString(),
          deletedCount: deleted.length,
        },
      },
    });

    return { cutoff: cutoff.toISOString(), deletedCount: deleted.length };
  },
});
