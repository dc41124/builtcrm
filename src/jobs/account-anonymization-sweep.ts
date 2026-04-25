import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { anonymizeUserRow } from "@/domain/user-deletion";

// Daily anonymization sweep. Finds every users row whose
// pending_deletion_at has elapsed and runs the anonymization payload
// (see src/domain/user-deletion.ts). Each user processed in its own
// transaction so one failure doesn't block the others.
//
// Scheduled at 05:00 UTC daily, after the 04:00 / 04:15 / 04:30
// retention purges to keep the daily ops window contiguous.
//
// See docs/specs/user_deletion_and_export_plan.md.

export const accountAnonymizationSweep = schedules.task({
  id: "account-anonymization-sweep",
  cron: "0 5 * * *",
  maxDuration: 600,
  run: async (payload) => {
    const cutoff = payload.timestamp;

    const due = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          isNotNull(users.pendingDeletionAt),
          lte(users.pendingDeletionAt, cutoff),
        ),
      );

    let anonymized = 0;
    let errored = 0;

    for (const row of due) {
      try {
        await anonymizeUserRow(row.id);

        // Note: Better Auth sessions on other devices are not
        // programmatically revoked here. The auth.session.create hook
        // blocks future sign-ins (pendingDeletionAt is null after
        // anonymization, but the user record's isActive=false +
        // tombstoned email mean any reuse is benign). Active
        // already-authenticated sessions expire naturally via the 24h
        // idle timeout. A follow-up could add an Upstash scan-based
        // revoker for harder cutoff guarantees.

        await writeSystemAuditEvent({
          resourceType: "user",
          resourceId: row.id,
          action: "user.account_anonymized",
          details: {
            metadata: {
              completedAt: new Date().toISOString(),
            },
          },
        });
        anonymized++;
      } catch (err) {
        errored++;
        logger.error("anonymization failed", {
          userId: row.id,
          error: (err as Error).message,
        });
      }
    }

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "account-anonymization-sweep.run_complete",
      details: {
        metadata: {
          jobId: "account-anonymization-sweep",
          cutoff: cutoff.toISOString(),
          anonymizedCount: anonymized,
          erroredCount: errored,
        },
      },
    });

    return { anonymized, errored };
  },
});
