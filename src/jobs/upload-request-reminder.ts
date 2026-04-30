import { randomUUID } from "node:crypto";

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { and, eq, lt } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { activityFeedItems, uploadRequests } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { redis } from "@/lib/redis";
import { emitNotifications } from "@/lib/notifications/emit";

// Dedupe key: set of upload_request IDs that have already received an
// overdue reminder. Stale IDs for closed requests stay in the set harmlessly.
const REMINDED_SET_KEY = "reminders:upload-requests:overdue-sent";

export const uploadRequestReminder = schedules.task({
  id: "upload-request-reminder",
  cron: "0 13 * * *", // 13:00 UTC daily (~9am ET)
  maxDuration: 300,
  run: async (payload) => {
    const now = payload.timestamp;

    // Cross-org sweep — uploadRequests is RLS'd (Slice A bucket 3). dbAdmin
    // matches the prequal-expiry-sweep precedent: no session, no GUC, must
    // see every org's overdue rows.
    const overdue = await dbAdmin
      .select({
        id: uploadRequests.id,
        projectId: uploadRequests.projectId,
        title: uploadRequests.title,
        dueAt: uploadRequests.dueAt,
        visibilityScope: uploadRequests.visibilityScope,
        requestedFromOrganizationId: uploadRequests.requestedFromOrganizationId,
      })
      .from(uploadRequests)
      .where(
        and(eq(uploadRequests.requestStatus, "open"), lt(uploadRequests.dueAt, now)),
      );

    logger.info("overdue upload requests found", { count: overdue.length });

    if (overdue.length === 0) {
      await writeSystemAuditEvent({
        resourceType: "background_job",
        resourceId: randomUUID(),
        action: "upload-request-reminder.run_complete",
        details: {
          metadata: {
            jobId: "upload-request-reminder",
            checked: 0,
            reminded: 0,
          },
        },
      });
      return { checked: 0, reminded: 0 };
    }

    const ids = overdue.map((r) => r.id);
    const alreadyReminded = await redis.smismember(REMINDED_SET_KEY, ids);
    const toRemind = overdue.filter((_, i) => alreadyReminded[i] === 0);

    if (toRemind.length === 0) {
      logger.info("all overdue requests already reminded", { total: overdue.length });
      await writeSystemAuditEvent({
        resourceType: "background_job",
        resourceId: randomUUID(),
        action: "upload-request-reminder.run_complete",
        details: {
          metadata: {
            jobId: "upload-request-reminder",
            checked: overdue.length,
            reminded: 0,
          },
        },
      });
      return { checked: overdue.length, reminded: 0 };
    }

    // Re-sync the set with currently-open overdue IDs so that entries for
    // requests which have since closed can be re-added if they ever reopen.
    // (Not strictly required for correctness, just keeps the set bounded.)
    await dbAdmin.transaction(async (tx) => {
      await tx.insert(activityFeedItems).values(
        toRemind.map((r) => {
          const daysOverdue = Math.max(
            1,
            Math.floor((now.getTime() - r.dueAt!.getTime()) / (1000 * 60 * 60 * 24)),
          );
          return {
            projectId: r.projectId,
            actorUserId: null,
            activityType: "project_update" as const,
            surfaceType: "notification_source" as const,
            title: `Overdue: ${r.title}`,
            body: `Upload request is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past its due date.`,
            relatedObjectType: "upload_request",
            relatedObjectId: r.id,
            visibilityScope: r.visibilityScope,
          };
        }),
      );
    });

    const [firstId, ...restIds] = toRemind.map((r) => r.id);
    await redis.sadd(REMINDED_SET_KEY, firstId, ...restIds);

    // Dual-write to notifications so the sub sees an entry in the bell
    // alongside the activityFeedItems row. Fire-and-forget per request —
    // emitNotifications is internally best-effort, so a per-row failure
    // doesn't fail the reminder pass.
    await Promise.all(
      toRemind.map((r) => {
        const daysOverdue = Math.max(
          1,
          Math.floor((now.getTime() - r.dueAt!.getTime()) / (1000 * 60 * 60 * 24)),
        );
        return emitNotifications({
          eventId: "upload_request",
          actorUserId: "",
          projectId: r.projectId,
          targetOrganizationId:
            r.requestedFromOrganizationId ?? undefined,
          relatedObjectType: "upload_request",
          relatedObjectId: r.id,
          vars: {
            title: `Overdue: ${r.title}`,
            actorName: `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past due`,
          },
        });
      }),
    );

    logger.info("reminders written", {
      reminded: toRemind.length,
      checked: overdue.length,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "upload-request-reminder.run_complete",
      details: {
        metadata: {
          jobId: "upload-request-reminder",
          checked: overdue.length,
          reminded: toRemind.length,
        },
      },
    });

    return { checked: overdue.length, reminded: toRemind.length };
  },
});
