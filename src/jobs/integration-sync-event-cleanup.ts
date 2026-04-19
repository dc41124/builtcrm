import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db/client";
import { syncEvents } from "@/db/schema";

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

    await db
      .delete(syncEvents)
      .where(
        and(
          eq(syncEvents.syncEventStatus, "succeeded"),
          lt(syncEvents.createdAt, cutoff),
        ),
      );

    logger.info("sync_events cleanup complete", {
      cutoff: cutoff.toISOString(),
    });

    return { cutoff: cutoff.toISOString() };
  },
});
