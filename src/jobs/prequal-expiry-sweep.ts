import { randomUUID } from "node:crypto";

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { organizations, prequalSubmissions } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { emitNotifications } from "@/lib/notifications/emit";

// Step 49 — daily prequalification expiry sweep.
//
// Two passes per run:
//   1. EXPIRE: any approved submission whose expires_at has passed →
//      flip status to 'expired', write audit event, fire `prequal_expired`
//      to both the contractor and the sub.
//   2. WARN: any approved submission whose expires_at falls within
//      30 / 14 / 7 days → fire `prequal_expiring_soon` once per
//      threshold per submission. Idempotency lives on the submission row
//      itself in `reminders_sent_json` (e.g. `{"30":"2026-04-12T..."}`),
//      so multiple sweep runs in a day don't duplicate.
//
// Schedule: 02:00 UTC daily — off-peak, after end-of-day in NA timezones.

const REMINDER_DAYS = [30, 14, 7] as const;
type ReminderKey = (typeof REMINDER_DAYS)[number];

export const prequalExpirySweep = schedules.task({
  id: "prequal-expiry-sweep",
  cron: "0 2 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const now = payload.timestamp;
    const runId = randomUUID();

    // ── Pass 1: expire ───────────────────────────────────────────────
    const expiredRows = await db
      .select({
        id: prequalSubmissions.id,
        contractorOrgId: prequalSubmissions.contractorOrgId,
        submittedByOrgId: prequalSubmissions.submittedByOrgId,
        expiresAt: prequalSubmissions.expiresAt,
      })
      .from(prequalSubmissions)
      .where(
        and(
          eq(prequalSubmissions.status, "approved"),
          isNotNull(prequalSubmissions.expiresAt),
          lt(prequalSubmissions.expiresAt, now),
        ),
      );

    for (const row of expiredRows) {
      await db
        .update(prequalSubmissions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(prequalSubmissions.id, row.id));

      await writeSystemAuditEvent({
        resourceType: "prequal_submission",
        resourceId: row.id,
        action: "expired",
        organizationId: row.contractorOrgId,
        details: {
          previousState: { status: "approved" },
          nextState: { status: "expired" },
        },
      });

      // Fire to both sides. Each call resolves to one org via
      // targetOrganizationByPortal (Step 49 — recipients.ts).
      const [contractorName, subName] = await Promise.all([
        db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, row.contractorOrgId))
          .limit(1)
          .then((rows) => rows[0]?.name ?? "Your contractor"),
        db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, row.submittedByOrgId))
          .limit(1)
          .then((rows) => rows[0]?.name ?? "A subcontractor"),
      ]);

      await emitNotifications({
        eventId: "prequal_expired",
        actorUserId: "",
        projectId: null,
        relatedObjectType: "prequal_submission",
        relatedObjectId: row.id,
        targetOrganizationByPortal: {
          orgId: row.contractorOrgId,
          portalType: "contractor",
        },
        vars: {
          subOrgName: subName,
          subOrgId: row.submittedByOrgId,
        },
      });
      await emitNotifications({
        eventId: "prequal_expired",
        actorUserId: "",
        projectId: null,
        relatedObjectType: "prequal_submission",
        relatedObjectId: row.id,
        targetOrganizationByPortal: {
          orgId: row.submittedByOrgId,
          portalType: "subcontractor",
        },
        vars: {
          contractorOrgName: contractorName,
          contractorOrgId: row.contractorOrgId,
        },
      });
    }

    // ── Pass 2: expiring-soon reminders ─────────────────────────────
    // Pull every approved row whose expires_at is within the longest
    // threshold; do per-row threshold matching + remindersSentJson
    // dedupe in app code (small set, simple).
    const upcomingRows = await db
      .select({
        id: prequalSubmissions.id,
        contractorOrgId: prequalSubmissions.contractorOrgId,
        submittedByOrgId: prequalSubmissions.submittedByOrgId,
        expiresAt: prequalSubmissions.expiresAt,
        remindersSentJson: prequalSubmissions.remindersSentJson,
      })
      .from(prequalSubmissions)
      .where(
        and(
          eq(prequalSubmissions.status, "approved"),
          isNotNull(prequalSubmissions.expiresAt),
          sql`${prequalSubmissions.expiresAt} <= ${now} + interval '30 days'`,
          sql`${prequalSubmissions.expiresAt} > ${now}`,
        ),
      );

    let remindersSent = 0;
    for (const row of upcomingRows) {
      if (!row.expiresAt) continue;
      const daysRemaining = Math.ceil(
        (row.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      // Pick the largest threshold the row is within and hasn't yet been
      // reminded for (e.g. if 14 days remain and we already sent 30,
      // send 14).
      const reminders =
        (row.remindersSentJson && typeof row.remindersSentJson === "object"
          ? (row.remindersSentJson as Record<string, string | null>)
          : {}) as Record<string, string | null>;
      let due: ReminderKey | null = null;
      for (const k of REMINDER_DAYS) {
        if (daysRemaining <= k && !reminders[String(k)]) {
          due = k;
          break;
        }
      }
      if (!due) continue;

      const nextReminders = { ...reminders, [String(due)]: now.toISOString() };
      await db
        .update(prequalSubmissions)
        .set({ remindersSentJson: nextReminders, updatedAt: now })
        .where(eq(prequalSubmissions.id, row.id));

      const [contractorName, subName] = await Promise.all([
        db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, row.contractorOrgId))
          .limit(1)
          .then((rows) => rows[0]?.name ?? "Your contractor"),
        db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, row.submittedByOrgId))
          .limit(1)
          .then((rows) => rows[0]?.name ?? "A subcontractor"),
      ]);

      await emitNotifications({
        eventId: "prequal_expiring_soon",
        actorUserId: "",
        projectId: null,
        relatedObjectType: "prequal_submission",
        relatedObjectId: row.id,
        targetOrganizationByPortal: {
          orgId: row.contractorOrgId,
          portalType: "contractor",
        },
        vars: {
          subOrgName: subName,
          subOrgId: row.submittedByOrgId,
          daysRemaining: due,
        },
      });
      await emitNotifications({
        eventId: "prequal_expiring_soon",
        actorUserId: "",
        projectId: null,
        relatedObjectType: "prequal_submission",
        relatedObjectId: row.id,
        targetOrganizationByPortal: {
          orgId: row.submittedByOrgId,
          portalType: "subcontractor",
        },
        vars: {
          contractorOrgName: contractorName,
          contractorOrgId: row.contractorOrgId,
          daysRemaining: due,
        },
      });
      remindersSent += 1;
    }

    logger.info("prequal expiry sweep complete", {
      expired: expiredRows.length,
      remindersChecked: upcomingRows.length,
      remindersSent,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: runId,
      action: "prequal-expiry-sweep.run_complete",
      details: {
        metadata: {
          jobId: "prequal-expiry-sweep",
          expired: expiredRows.length,
          remindersChecked: upcomingRows.length,
          remindersSent,
        },
      },
    });

    return {
      expired: expiredRows.length,
      remindersChecked: upcomingRows.length,
      remindersSent,
    };
  },
});
