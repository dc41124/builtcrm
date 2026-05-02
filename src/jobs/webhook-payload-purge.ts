import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, inArray, lt } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { webhookEvents } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";

// Daily retention purge for webhook_events. The `payload` column holds
// provider-supplied JSON (Stripe events, QuickBooks/Xero/Sage webhook
// bodies, etc.) — plaintext, potentially sensitive, and not encryption-
// friendly without hurting debuggability. Bounded retention is the
// trade-off: 90 days of look-back, then the whole row is deleted.
//
// Scope: only rows that are `processed` or `delivered` (successful
// terminal states). Failure states — `exhausted`, `processing_failed`,
// `delivery_failed`, `retrying` — are kept indefinitely because they
// carry diagnostic value a human will likely need to trace later. The
// upstream processor already writes a `webhook.processed` /
// `webhook.failed` audit event per row, so even purged rows have a
// metadata footprint in audit_events (provider, event type, duration)
// — just not the full payload.
//
// Scheduled at 03:45 UTC daily, 15 min after the sync-event-cleanup job
// to avoid overlap on the same DB connection pool.
//
// See docs/specs/security_posture.md §6 for the retention-vs-encryption
// trade-off rationale.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const webhookPayloadPurge = schedules.task({
  id: "webhook-payload-purge",
  cron: "45 3 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const cutoff = new Date(payload.timestamp.getTime() - NINETY_DAYS_MS);

    // Cross-org system purge — webhook_events RLS gates by org_id,
    // a cron sweep has no caller context. dbAdmin is the right tool.
    // legal_hold = true overrides scheduled deletion (Step 66.5).
    const deleted = await dbAdmin
      .delete(webhookEvents)
      .where(
        and(
          inArray(webhookEvents.deliveryStatus, ["processed", "delivered"]),
          lt(webhookEvents.createdAt, cutoff),
          eq(webhookEvents.legalHold, false),
        ),
      )
      .returning({ id: webhookEvents.id });

    logger.info("webhook_events payload purge complete", {
      cutoff: cutoff.toISOString(),
      deletedCount: deleted.length,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "webhook-payload-purge.run_complete",
      details: {
        metadata: {
          jobId: "webhook-payload-purge",
          cutoff: cutoff.toISOString(),
          deletedCount: deleted.length,
          retentionDays: 90,
        },
      },
    });

    return { cutoff: cutoff.toISOString(), deletedCount: deleted.length };
  },
});
