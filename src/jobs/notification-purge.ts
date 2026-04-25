import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, isNotNull, lt } from "drizzle-orm";

import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";

// Daily retention purge for notifications. The table grows monotonically
// — every state-change emission writes one row per recipient — and read
// rows have no further utility once the user has acknowledged them.
//
// Scope: only rows the user has read (`read_at IS NOT NULL`). Unread
// notifications retain indefinitely because they're presumed actionable
// and the bell badge is the user's working surface.
//
// Scheduled at 04:00 UTC daily, after the 03:30 sync-event-cleanup and
// 03:45 webhook-payload-purge to avoid overlap on the same DB pool.
//
// See docs/specs/security_posture.md §6 for the retention-vs-encryption
// trade-off rationale.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const notificationPurge = schedules.task({
  id: "notification-purge",
  cron: "0 4 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const cutoff = new Date(payload.timestamp.getTime() - NINETY_DAYS_MS);

    const deleted = await db
      .delete(notifications)
      .where(
        and(
          isNotNull(notifications.readAt),
          lt(notifications.readAt, cutoff),
        ),
      )
      .returning({ id: notifications.id });

    logger.info("notifications purge complete", {
      cutoff: cutoff.toISOString(),
      deletedCount: deleted.length,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "notification-purge.run_complete",
      details: {
        metadata: {
          jobId: "notification-purge",
          cutoff: cutoff.toISOString(),
          deletedCount: deleted.length,
          retentionDays: 90,
        },
      },
    });

    return { cutoff: cutoff.toISOString(), deletedCount: deleted.length };
  },
});
