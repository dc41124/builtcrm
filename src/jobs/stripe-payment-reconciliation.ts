import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db/client";
import {
  auditEvents,
  integrationConnections,
  paymentTransactions,
} from "@/db/schema";
import { getSystemUserId } from "@/domain/system-user";
import { getStripe } from "@/lib/stripe";

// Step 33 — nightly Stripe payment reconciliation.
//
// The `payment_transactions` write path already ships: the Stripe webhook
// handler at /api/webhooks/stripe creates + advances rows through the
// payment lifecycle (charge.succeeded → status=succeeded, etc.). This job
// catches the two failure modes the webhook path can't catch on its own:
//
//   (a) Missing locally — Stripe has a payment intent in the last 7 days
//       that BuiltCRM has no row for. Usually means a webhook delivery was
//       dropped (Stripe retries exhausted, endpoint was offline, etc.).
//       Can't auto-create the local row because we don't know the entity
//       mapping (draw vs. selection, which project). Audits + waits for a
//       human to triage.
//
//   (b) Stuck status — a local row has been in `pending` or `processing`
//       for more than 7 days. Usually means the follow-up webhook that
//       would have terminated the status was lost. Terminal statuses
//       (succeeded / failed / refunded / canceled / disputed) never fire.
//
// Scope per org is the connected Stripe account (via Stripe Connect),
// not the platform account — platform subscription invoices use a separate
// reconciliation path owned by Stripe's own retry machinery.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STRIPE_LIST_LIMIT = 100;

export const stripePaymentReconciliation = schedules.task({
  id: "stripe-payment-reconciliation",
  cron: "0 4 * * *", // 04:00 UTC daily — clear of the 03:30 sync-events cleanup
  maxDuration: 300,
  run: async (payload) => {
    const now = payload.timestamp;
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
    const sevenDaysAgoUnix = Math.floor(sevenDaysAgo.getTime() / 1000);

    const stripe = getStripe();
    const systemUserId = await getSystemUserId();

    // Every connected Stripe account counts as a separate reconciliation
    // scope. A contractor org technically could have multiple Stripe
    // connections over time (disconnects + reconnects); we filter to
    // actively-connected rows only.
    const connections = await db
      .select({
        id: integrationConnections.id,
        organizationId: integrationConnections.organizationId,
        externalAccountId: integrationConnections.externalAccountId,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.provider, "stripe"),
          eq(integrationConnections.connectionStatus, "connected"),
        ),
      );

    const connectionsWithAccount = connections.filter(
      (c): c is typeof c & { externalAccountId: string } =>
        typeof c.externalAccountId === "string" && c.externalAccountId.length > 0,
    );

    logger.info("stripe reconciliation starting", {
      orgs: connectionsWithAccount.length,
      sevenDaysAgo: sevenDaysAgo.toISOString(),
    });

    if (connectionsWithAccount.length === 0) {
      return { organizations: 0, stripePayments: 0, missing: 0, stuck: 0 };
    }

    let totalStripePayments = 0;
    let totalMissing = 0;
    let totalStuck = 0;

    for (const conn of connectionsWithAccount) {
      try {
        // --- (a) Missing-locally scan --------------------------------------
        const list = await stripe.paymentIntents.list(
          {
            limit: STRIPE_LIST_LIMIT,
            created: { gte: sevenDaysAgoUnix },
          },
          { stripeAccount: conn.externalAccountId },
        );
        totalStripePayments += list.data.length;

        if (list.has_more) {
          // Volume check — portfolio builds shouldn't hit this, but when the
          // first real customer does we'll want a paging loop here.
          logger.warn("stripe list exceeded single page", {
            organizationId: conn.organizationId,
            stripeAccount: conn.externalAccountId,
            fetched: list.data.length,
          });
        }

        const stripeIds = list.data.map((pi) => pi.id);
        const locallyKnown =
          stripeIds.length === 0
            ? []
            : await db
                .select({
                  stripePaymentIntentId:
                    paymentTransactions.stripePaymentIntentId,
                })
                .from(paymentTransactions)
                .where(
                  and(
                    eq(
                      paymentTransactions.organizationId,
                      conn.organizationId,
                    ),
                    inArray(
                      paymentTransactions.stripePaymentIntentId,
                      stripeIds,
                    ),
                  ),
                );

        const knownSet = new Set(
          locallyKnown
            .map((r) => r.stripePaymentIntentId)
            .filter((id): id is string => typeof id === "string"),
        );

        const missing = list.data.filter((pi) => !knownSet.has(pi.id));
        for (const pi of missing) {
          await db.insert(auditEvents).values({
            actorUserId: systemUserId,
            organizationId: conn.organizationId,
            objectType: "payment_transaction",
            // No local row to reference — use the Stripe PI id as a synthetic
            // object id. Audit viewers can spot this by the `synthetic: true`
            // metadata flag and the non-UUID objectId.
            objectId: pi.id,
            actionName: "payment.reconciliation.missing_locally",
            metadataJson: {
              synthetic: true,
              stripePaymentIntentId: pi.id,
              stripeAccountId: conn.externalAccountId,
              amountCents: pi.amount,
              currency: pi.currency,
              stripeStatus: pi.status,
              stripeCreatedAt: new Date(pi.created * 1000).toISOString(),
            },
          });
          totalMissing += 1;
        }

        // --- (b) Stuck-status scan -----------------------------------------
        const stuckRows = await db
          .select({
            id: paymentTransactions.id,
            projectId: paymentTransactions.projectId,
            transactionStatus: paymentTransactions.transactionStatus,
            stripePaymentIntentId:
              paymentTransactions.stripePaymentIntentId,
            createdAt: paymentTransactions.createdAt,
          })
          .from(paymentTransactions)
          .where(
            and(
              eq(
                paymentTransactions.organizationId,
                conn.organizationId,
              ),
              inArray(paymentTransactions.transactionStatus, [
                "pending",
                "processing",
              ]),
              lt(paymentTransactions.createdAt, sevenDaysAgo),
            ),
          )
          .orderBy(desc(paymentTransactions.createdAt));

        for (const row of stuckRows) {
          const ageMs = now.getTime() - row.createdAt.getTime();
          const daysStuck = Math.floor(ageMs / (24 * 60 * 60 * 1000));
          await db.insert(auditEvents).values({
            actorUserId: systemUserId,
            organizationId: conn.organizationId,
            projectId: row.projectId,
            objectType: "payment_transaction",
            objectId: row.id,
            actionName: "payment.reconciliation.stuck_status",
            metadataJson: {
              transactionStatus: row.transactionStatus,
              daysStuck,
              stripePaymentIntentId: row.stripePaymentIntentId,
              stripeAccountId: conn.externalAccountId,
            },
          });
          totalStuck += 1;
        }
      } catch (err) {
        // One org's failure (deauthorized account, rate-limit, network) must
        // not abort the rest of the batch. Audit the run-level failure and
        // keep going.
        const message = err instanceof Error ? err.message : String(err);
        logger.error("reconciliation failed for connection", {
          connectionId: conn.id,
          organizationId: conn.organizationId,
          error: message,
        });
        await db.insert(auditEvents).values({
          actorUserId: systemUserId,
          organizationId: conn.organizationId,
          objectType: "integration_connection",
          objectId: conn.id,
          actionName: "payment.reconciliation.error",
          metadataJson: {
            stripeAccountId: conn.externalAccountId,
            error: message,
          },
        });
      }
    }

    logger.info("stripe reconciliation complete", {
      organizations: connectionsWithAccount.length,
      stripePayments: totalStripePayments,
      missing: totalMissing,
      stuck: totalStuck,
    });

    return {
      organizations: connectionsWithAccount.length,
      stripePayments: totalStripePayments,
      missing: totalMissing,
      stuck: totalStuck,
    };
  },
});
