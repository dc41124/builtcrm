import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";

// Daily retention purge for audit_events. The table grows monotonically
// — every state-changing user action plus every batch-level system event
// writes one row — and the user has chosen 90d retention to match the
// webhook-payload precedent. This is a deliberate trade against deeper
// forensics history; if a future incident needs longer look-back, this
// number is the dial to turn.
//
// `notifications.source_audit_event_id` is ON DELETE SET NULL, so purging
// a referenced event nulls the back-link on any unread notification that
// pointed to it. The notification itself retains its own title/body copy
// (notifications are written denormalized), so the user-facing surface is
// unaffected — only the audit-event traceability link is lost.
//
// Scheduled at 04:15 UTC daily. Each run writes its own audit event,
// which itself becomes auditable history of the purge job.
//
// See docs/specs/security_posture.md §6 for the retention rationale.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const auditEventPurge = schedules.task({
  id: "audit-event-purge",
  cron: "15 4 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const cutoff = new Date(payload.timestamp.getTime() - NINETY_DAYS_MS);

    // legal_hold = true overrides scheduled deletion (Step 66.5). Rows
    // under hold remain regardless of age until the hold is released.
    const deleted = await db
      .delete(auditEvents)
      .where(
        and(
          lt(auditEvents.createdAt, cutoff),
          eq(auditEvents.legalHold, false),
        ),
      )
      .returning({ id: auditEvents.id });

    logger.info("audit_events purge complete", {
      cutoff: cutoff.toISOString(),
      deletedCount: deleted.length,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "audit-event-purge.run_complete",
      details: {
        metadata: {
          jobId: "audit-event-purge",
          cutoff: cutoff.toISOString(),
          deletedCount: deleted.length,
          retentionDays: 90,
        },
      },
    });

    return { cutoff: cutoff.toISOString(), deletedCount: deleted.length };
  },
});
