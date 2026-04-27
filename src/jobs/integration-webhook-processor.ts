import { logger, schedules } from "@trigger.dev/sdk/v3";
import { eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, webhookEvents } from "@/db/schema";
import type { IntegrationProviderKey } from "@/domain/loaders/integrations";
import { getSystemUserId } from "@/domain/system-user";

// Inbound webhook processor — picks up rows written by
// /api/webhooks/[provider]/route.ts and dispatches to provider-specific
// processors.
//
// Cadence: every minute. Sub-minute latency isn't the right tool for this —
// if volume ever demands faster turnaround, migrate to Trigger.dev's event-
// triggered tasks (or a proper queue), don't speed up the poll.
//
// Concurrency: claim is atomic via
//   UPDATE … WHERE id IN (SELECT id FROM … FOR UPDATE SKIP LOCKED).
// Two processor runs never see the same row.
//
// Retry curve: retry_count++ on failure, next_retry_at = now + 2^attempt * 10s
// with +/-20% jitter. After maxRetries (schema default 6) we mark the row
// 'exhausted' and fire webhook.failed. The connection UI in Step 28 will
// surface exhausted events for manual re-drive.

const CLAIM_LIMIT = 25;
const BASE_BACKOFF_SEC = 10;

export const integrationWebhookProcessor = schedules.task({
  id: "integration-webhook-processor",
  cron: "* * * * *", // every minute
  maxDuration: 300,
  run: async (payload) => {
    const now = payload.timestamp;

    // Atomic claim: flip up to N eligible rows from received|retrying to
    // 'queued' and return them. `FOR UPDATE SKIP LOCKED` makes sibling runs
    // no-op against rows this one is already taking.
    const claimed = (
      await dbAdmin.execute<ClaimedRow>(sql`
        UPDATE webhook_events
        SET delivery_status = 'queued',
            updated_at = NOW()
        WHERE id IN (
          SELECT id FROM webhook_events
          WHERE webhook_direction = 'inbound'
            AND (
              delivery_status = 'received'
              OR (delivery_status = 'retrying' AND (next_retry_at IS NULL OR next_retry_at <= ${now}))
            )
          ORDER BY created_at
          LIMIT ${CLAIM_LIMIT}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, source_provider, event_type, event_id, payload,
                  retry_count, max_retries, organization_id
      `)
    ) as unknown as ClaimedRow[];

    logger.info("webhook processor claimed", { count: claimed.length });

    if (claimed.length === 0) {
      return { claimed: 0, processed: 0, retrying: 0, exhausted: 0 };
    }

    let processed = 0;
    let retrying = 0;
    let exhausted = 0;
    const systemUserId = await getSystemUserId();

    for (const row of claimed) {
      const start = Date.now();
      try {
        await dispatch(row);
        const duration = Date.now() - start;
        await dbAdmin
          .update(webhookEvents)
          .set({
            deliveryStatus: "processed",
            processedAt: new Date(),
            processingDurationMs: duration,
            errorMessage: null,
          })
          .where(eq(webhookEvents.id, row.id));
        await dbAdmin.insert(auditEvents).values({
          actorUserId: systemUserId,
          organizationId: row.organization_id,
          objectType: "webhook_event",
          objectId: row.id,
          actionName: "webhook.processed",
          metadataJson: {
            provider: row.source_provider,
            eventType: row.event_type,
            durationMs: duration,
          },
        });
        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const nextAttempt = row.retry_count + 1;
        if (nextAttempt >= row.max_retries) {
          await dbAdmin
            .update(webhookEvents)
            .set({
              deliveryStatus: "exhausted",
              retryCount: nextAttempt,
              errorMessage: message,
              processingDurationMs: Date.now() - start,
            })
            .where(eq(webhookEvents.id, row.id));
          await dbAdmin.insert(auditEvents).values({
            actorUserId: systemUserId,
            organizationId: row.organization_id,
            objectType: "webhook_event",
            objectId: row.id,
            actionName: "webhook.failed",
            metadataJson: {
              provider: row.source_provider,
              eventType: row.event_type,
              error: message,
              exhausted: true,
              attempts: nextAttempt,
            },
          });
          exhausted += 1;
        } else {
          const backoffSec = BASE_BACKOFF_SEC * 2 ** nextAttempt;
          const jitter = 1 + (Math.random() * 0.4 - 0.2); // ±20%
          const nextRetryAt = new Date(
            Date.now() + backoffSec * 1000 * jitter,
          );
          await dbAdmin
            .update(webhookEvents)
            .set({
              deliveryStatus: "retrying",
              retryCount: nextAttempt,
              nextRetryAt,
              errorMessage: message,
              processingDurationMs: Date.now() - start,
            })
            .where(eq(webhookEvents.id, row.id));
          retrying += 1;
          logger.warn("webhook processing failed; scheduled retry", {
            id: row.id,
            provider: row.source_provider,
            attempt: nextAttempt,
            nextRetryAt,
            error: message,
          });
        }
      }
    }

    logger.info("webhook processor batch done", {
      claimed: claimed.length,
      processed,
      retrying,
      exhausted,
    });

    return {
      claimed: claimed.length,
      processed,
      retrying,
      exhausted,
    };
  },
});

// --------------------------------------------------------------------------
// Dispatch — provider-specific handlers. Step 26 ships stubs that ACK each
// row as processed without acting on it. Real handlers (invoice sync, payment
// reconciliation, etc.) land with Steps 30-33 and replace the stub bodies.
// --------------------------------------------------------------------------

type ClaimedRow = {
  id: string;
  source_provider: IntegrationProviderKey;
  event_type: string;
  event_id: string;
  payload: unknown;
  retry_count: number;
  max_retries: number;
  organization_id: string;
};

async function dispatch(row: ClaimedRow): Promise<void> {
  switch (row.source_provider) {
    case "quickbooks_online":
      return processQuickbooks(row);
    case "xero":
      return processXero(row);
    case "sage_business_cloud":
      return processSage(row);
    case "google_calendar":
      // Shouldn't reach here — the route 501s before insertion — but keep
      // the switch exhaustive so a future wiring error is loud.
      throw new Error("google_calendar processor not implemented");
    default:
      throw new Error(`no processor registered for ${row.source_provider}`);
  }
}

// All three stubs: acknowledge the event without side-effects. When the real
// syncers ship (Steps 30-33), replace the stub with actual entity upsert /
// payment reconciliation logic.

async function processQuickbooks(row: ClaimedRow): Promise<void> {
  logger.info("qbo webhook stub ack", {
    id: row.id,
    eventType: row.event_type,
  });
}

async function processXero(row: ClaimedRow): Promise<void> {
  logger.info("xero webhook stub ack", {
    id: row.id,
    eventType: row.event_type,
  });
}

async function processSage(row: ClaimedRow): Promise<void> {
  logger.info("sage webhook stub ack", {
    id: row.id,
    eventType: row.event_type,
  });
}
