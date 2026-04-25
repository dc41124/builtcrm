import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { sendDeletionReminderEmail } from "@/lib/user-deletion/email";
import { generateCancelDeletionToken } from "@/lib/user-deletion/token";

// Daily reminder sweep. Emails users whose pending_deletion_at falls
// 7 days from now, giving them a final nudge to use the cancel link.
// Idempotent at the granularity of "did the user receive a reminder
// today" — runs once per day, so each pending user gets exactly one
// reminder when their cutoff is in the 7-day window.
//
// The original confirmation email's cancel token is hashed at rest, so
// the reminder cannot reuse it. Each reminder rotates the token: a new
// plaintext is generated, the hash is written to users, and the
// plaintext goes out in the reminder. The previous token is invalidated.
//
// Scheduled at 14:00 UTC daily (mid-day for North-American users so
// the email lands in business hours).
//
// See docs/specs/user_deletion_and_export_plan.md.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const deletionReminderSweep = schedules.task({
  id: "deletion-reminder-sweep",
  cron: "0 14 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const reminderWindowStart = new Date(
      payload.timestamp.getTime() + SEVEN_DAYS_MS - ONE_DAY_MS / 2,
    );
    const reminderWindowEnd = new Date(
      payload.timestamp.getTime() + SEVEN_DAYS_MS + ONE_DAY_MS / 2,
    );

    const due = await db
      .select({
        id: users.id,
        email: users.email,
        pendingDeletionAt: users.pendingDeletionAt,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.pendingDeletionAt),
          gte(users.pendingDeletionAt, reminderWindowStart),
          lte(users.pendingDeletionAt, reminderWindowEnd),
        ),
      );

    let sent = 0;
    let errored = 0;

    for (const row of due) {
      if (!row.pendingDeletionAt) continue;
      try {
        const { plaintext, hash } = generateCancelDeletionToken();
        await db
          .update(users)
          .set({ pendingDeletionTokenHash: hash })
          .where(eq(users.id, row.id));
        await sendDeletionReminderEmail({
          toEmail: row.email,
          cancelToken: plaintext,
          scheduledForAnonymizationAt: row.pendingDeletionAt,
        });
        sent++;
      } catch (err) {
        errored++;
        logger.error("deletion reminder failed", {
          userId: row.id,
          error: (err as Error).message,
        });
      }
    }

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "deletion-reminder-sweep.run_complete",
      details: {
        metadata: {
          jobId: "deletion-reminder-sweep",
          windowStart: reminderWindowStart.toISOString(),
          windowEnd: reminderWindowEnd.toISOString(),
          sentCount: sent,
          erroredCount: errored,
        },
      },
    });

    return { sent, errored };
  },
});
