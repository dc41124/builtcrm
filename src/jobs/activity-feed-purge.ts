import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { lt } from "drizzle-orm";

import { db } from "@/db/client";
import { activityFeedItems } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";

// Daily retention purge for activity_feed_items. The feed is a "what's
// happening" surface — anything more than 90 days old has effectively
// fallen out of scroll and is not the system of record for the
// underlying state change (audit_events is). Bounded retention keeps
// the table small without losing meaningful history.
//
// Scheduled at 04:30 UTC daily, after the other purges to avoid pool
// overlap.
//
// See docs/specs/security_posture.md §6 for the retention rationale.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const activityFeedPurge = schedules.task({
  id: "activity-feed-purge",
  cron: "30 4 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const cutoff = new Date(payload.timestamp.getTime() - NINETY_DAYS_MS);

    const deleted = await db
      .delete(activityFeedItems)
      .where(lt(activityFeedItems.createdAt, cutoff))
      .returning({ id: activityFeedItems.id });

    logger.info("activity_feed_items purge complete", {
      cutoff: cutoff.toISOString(),
      deletedCount: deleted.length,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "activity-feed-purge.run_complete",
      details: {
        metadata: {
          jobId: "activity-feed-purge",
          cutoff: cutoff.toISOString(),
          deletedCount: deleted.length,
          retentionDays: 90,
        },
      },
    });

    return { cutoff: cutoff.toISOString(), deletedCount: deleted.length };
  },
});
