import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  auditEvents,
  drawRequests,
  integrationConnections,
  organizations,
  organizationSubscriptions,
  paymentTransactions,
  subscriptionInvoices,
  subscriptionPlans,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getSystemUserId } from "@/domain/system-user";
import { getStripe, getWebhookSecret } from "@/lib/stripe";

// Audit events on this endpoint use the synthetic SYSTEM_USER_ID as
// actor_user_id — webhook events have no user actor but audit_events
// requires one. See src/domain/system-user.ts for the seed-if-not-exists
// helper. Each mutation below writes one audit_event so the full Stripe-
// initiated lifecycle is observable in the Org security audit log.

// Stripe webhook endpoint. Events handled:
//   - checkout.session.completed      → create/link the org_subscription
//   - customer.subscription.updated   → sync status + period + cancel flag
//   - customer.subscription.deleted   → mark canceled, org flips to suspended
//   - invoice.paid / invoice.payment_failed → upsert a subscription_invoices row
//
// Idempotency: handlers are upsert-based on Stripe IDs (subscription ID,
// invoice ID). Duplicate deliveries overwrite with identical state. No
// separate stripe_webhook_events log table yet — flagged as a follow-up in
// the Billing phase handoff.
//
// Signature verification is required on every call. Next.js 14 App Router
// requires raw body access via `req.text()` before Stripe can verify.

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();
  const secret = getWebhookSecret();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verification_failed";
    return NextResponse.json(
      { error: "invalid_signature", detail: msg },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(
          event.data.object as Stripe.Subscription,
          event.type,
        );
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        await handleInvoice(event.data.object as Stripe.Invoice, event.type);
        break;
      case "account.updated":
        await handleConnectAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "charge.succeeded":
      case "charge.failed":
        await handleChargeStatus(
          event.data.object as Stripe.Charge,
          event.type,
        );
        break;
      default:
        // Not an event we care about — ack with 200 so Stripe doesn't retry.
        break;
    }
  } catch (err) {
    // Log + 500 so Stripe retries. The raw error surfaces in the Stripe
    // dashboard's "webhook attempts" view.
    console.error(`[stripe-webhook] ${event.type} failed:`, err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    await handleCheckoutPaymentCompleted(session);
    return;
  }
  if (session.mode !== "subscription") return;

  const organizationId = session.metadata?.organizationId;
  const planSlug = session.metadata?.planSlug;
  const billingCycle = session.metadata?.billingCycle as
    | "monthly"
    | "annual"
    | undefined;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!organizationId || !planSlug || !billingCycle || !subscriptionId) {
    console.warn(
      "[stripe-webhook] checkout.session.completed missing metadata",
      { organizationId, planSlug, billingCycle, subscriptionId },
    );
    return;
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, planSlug))
    .limit(1);
  if (!plan) {
    console.warn(
      `[stripe-webhook] plan slug ${planSlug} not found — cannot finalize`,
    );
    return;
  }

  const periods = periodsFromSubscription(sub);

  // Upsert on (organization_id unique). Legacy backfilled orgs already have
  // a row — overwrite its plan_id + status + stripe_subscription_id.
  // orgId is known here (came in via session.metadata) so all
  // organization_subscriptions DML can run inside `withTenant`.
  await withTenant(organizationId, async (tx) => {
    const [existing] = await tx
      .select({ id: organizationSubscriptions.id })
      .from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .limit(1);

    if (existing) {
      await tx
        .update(organizationSubscriptions)
        .set({
          planId: plan.id,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          billingCycle,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodStart: periods.start,
          currentPeriodEnd: periods.end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        })
        .where(eq(organizationSubscriptions.id, existing.id));
    } else {
      await tx.insert(organizationSubscriptions).values({
        organizationId,
        planId: plan.id,
        stripeSubscriptionId: sub.id,
        status: sub.status,
        billingCycle,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        currentPeriodStart: periods.start,
        currentPeriodEnd: periods.end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      });
    }
  });

  await db
    .update(organizations)
    .set({ currentPlanSlug: planSlug })
    .where(eq(organizations.id, organizationId));

  await db.insert(auditEvents).values({
    actorUserId: await getSystemUserId(),
    organizationId,
    objectType: "subscription",
    objectId: sub.id,
    actionName: "created",
    nextState: {
      planSlug,
      billingCycle,
      status: sub.status,
      trialEnd: sub.trial_end,
    },
  });
}

async function handleSubscriptionChanged(
  sub: Stripe.Subscription,
  eventType: "customer.subscription.updated" | "customer.subscription.deleted",
) {
  // Pre-tenant lookup — discover which org this Stripe subscription
  // belongs to. Uses admin pool because the webhook entry has no
  // session/GUC.
  const [row] = await dbAdmin
    .select()
    .from(organizationSubscriptions)
    .where(eq(organizationSubscriptions.stripeSubscriptionId, sub.id))
    .limit(1);
  if (!row) {
    console.warn(
      `[stripe-webhook] ${eventType} for unknown subscription ${sub.id}`,
    );
    return;
  }

  const periods = periodsFromSubscription(sub);

  // If the line item's price changed, reflect it by switching plan_id. Map
  // via stripe_price_id_{monthly,annual}.
  const firstItem = sub.items.data[0];
  let newPlanId = row.planId;
  let newBillingCycle = row.billingCycle;
  let newPlanSlug: string | null = null;
  if (firstItem?.price?.id) {
    const priceId = firstItem.price.id;
    const matches = await db.select().from(subscriptionPlans);
    const hit = matches.find(
      (p) =>
        p.stripePriceIdMonthly === priceId ||
        p.stripePriceIdAnnual === priceId,
    );
    if (hit) {
      newPlanId = hit.id;
      newBillingCycle =
        hit.stripePriceIdAnnual === priceId ? "annual" : "monthly";
      newPlanSlug = hit.slug;
    }
  }

  // orgId now known from row.organizationId — RLS-protect the update.
  await withTenant(row.organizationId, (tx) =>
    tx
      .update(organizationSubscriptions)
      .set({
        planId: newPlanId,
        billingCycle: newBillingCycle,
        status: sub.status,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        currentPeriodStart: periods.start,
        currentPeriodEnd: periods.end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      })
      .where(eq(organizationSubscriptions.id, row.id)),
  );

  if (newPlanSlug) {
    await db
      .update(organizations)
      .set({ currentPlanSlug: newPlanSlug })
      .where(eq(organizations.id, row.organizationId));
  }

  await db.insert(auditEvents).values({
    actorUserId: await getSystemUserId(),
    organizationId: row.organizationId,
    objectType: "subscription",
    objectId: sub.id,
    actionName:
      eventType === "customer.subscription.deleted" ? "canceled" : "updated",
    previousState: {
      status: row.status,
      planId: row.planId,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    },
    nextState: {
      status: sub.status,
      planSlug: newPlanSlug,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

async function handleInvoice(
  invoice: Stripe.Invoice,
  eventType: "invoice.paid" | "invoice.payment_failed",
) {
  // Platform subscription invoices only — ignore one-off invoices etc.
  // In Stripe SDK 22+, the subscription link moved to parent.subscription_details.
  const parentSubId = extractSubscriptionId(invoice);
  if (!parentSubId) return;

  // Pre-tenant lookup via admin pool — same shape as
  // handleSubscriptionChanged. The subscriptionInvoices upsert below
  // doesn't yet have RLS, so it stays on `db`; once invoices get
  // RLS the upsert moves into a withTenant(row.organizationId, ...)
  // wrapper.
  const [row] = await dbAdmin
    .select({
      id: organizationSubscriptions.id,
      organizationId: organizationSubscriptions.organizationId,
    })
    .from(organizationSubscriptions)
    .where(eq(organizationSubscriptions.stripeSubscriptionId, parentSubId))
    .limit(1);
  if (!row) {
    console.warn(
      `[stripe-webhook] ${eventType} for unknown subscription ${parentSubId}`,
    );
    return;
  }

  const line = invoice.lines.data[0];
  const periodStart = line?.period?.start
    ? new Date(line.period.start * 1000)
    : invoice.created
      ? new Date(invoice.created * 1000)
      : new Date();
  const periodEnd = line?.period?.end
    ? new Date(line.period.end * 1000)
    : periodStart;

  const [existing] = await db
    .select({ id: subscriptionInvoices.id })
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.stripeInvoiceId, invoice.id ?? ""))
    .limit(1);

  const values = {
    organizationSubscriptionId: row.id,
    stripeInvoiceId: invoice.id ?? "",
    number: invoice.number,
    amountPaidCents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    status: invoice.status ?? "open",
    periodStart,
    periodEnd,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdfUrl: invoice.invoice_pdf,
    paidAt:
      eventType === "invoice.paid" && invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
  };

  if (existing) {
    await db
      .update(subscriptionInvoices)
      .set(values)
      .where(eq(subscriptionInvoices.id, existing.id));
  } else {
    await db.insert(subscriptionInvoices).values(values);
  }

  await db.insert(auditEvents).values({
    actorUserId: await getSystemUserId(),
    organizationId: row.organizationId,
    objectType: "subscription_invoice",
    objectId: invoice.id ?? parentSubId,
    actionName: eventType === "invoice.paid" ? "paid" : "payment_failed",
    nextState: {
      invoiceNumber: invoice.number,
      amountPaidCents: invoice.amount_paid ?? 0,
      status: invoice.status ?? "open",
    },
  });
}

// ---------------------------------------------------------------------------

type Periods = { start: Date; end: Date };

function periodsFromSubscription(sub: Stripe.Subscription): Periods {
  // Stripe SDK 22 moved per-item period fields to items.data[].current_period_*.
  // Fall back to subscription-level fields (older API shapes) and finally to
  // trial_end / billing_cycle_anchor so we always have something to store.
  const item = sub.items.data[0];
  const itemAny = item as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const subAny = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  const startSec =
    itemAny.current_period_start ??
    subAny.current_period_start ??
    sub.billing_cycle_anchor ??
    sub.start_date;
  const endSec =
    itemAny.current_period_end ??
    subAny.current_period_end ??
    sub.trial_end ??
    (startSec ? startSec + 60 * 60 * 24 * 30 : null);

  const now = new Date();
  return {
    start: startSec ? new Date(startSec * 1000) : now,
    end: endSec ? new Date(endSec * 1000) : now,
  };
}

// ---------------------------------------------------------------------------
// Draw payment flow — checkout.session.completed (mode=payment). Links the
// Checkout session back to the pre-inserted payment_transactions row via
// metadata.paymentTransactionId, advances status to 'processing', and
// stores the payment_intent id for later charge.succeeded / .failed events
// to correlate against.

async function handleCheckoutPaymentCompleted(
  session: Stripe.Checkout.Session,
) {
  const ptId = session.metadata?.paymentTransactionId;
  if (!ptId) {
    console.warn("[stripe-webhook] payment checkout without pt metadata");
    return;
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  // Pre-tenant: webhook arrives with no session. Resolve orgId via
  // dbAdmin head lookup, then route the write through withTenant.
  const [pt] = await dbAdmin
    .select({ organizationId: paymentTransactions.organizationId })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, ptId))
    .limit(1);
  if (!pt) {
    console.warn(`[stripe-webhook] payment_transactions row ${ptId} missing`);
    return;
  }
  await withTenant(pt.organizationId, (tx) =>
    tx
      .update(paymentTransactions)
      .set({
        transactionStatus: "processing",
        stripePaymentIntentId: paymentIntentId ?? null,
        initiatedAt: new Date(),
      })
      .where(eq(paymentTransactions.id, ptId)),
  );
}

async function handleChargeStatus(
  charge: Stripe.Charge,
  eventType: "charge.succeeded" | "charge.failed",
) {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!piId) return;

  // Pre-tenant: webhook arrives with no session. dbAdmin for the lookup;
  // pt.organizationId then routes the follow-up writes through withTenant.
  const [pt] = await dbAdmin
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.stripePaymentIntentId, piId))
    .limit(1);
  if (!pt) {
    console.warn(
      `[stripe-webhook] ${eventType} for unknown payment_intent ${piId}`,
    );
    return;
  }

  if (eventType === "charge.succeeded") {
    const methodDetails = extractPaymentMethodDetails(charge);
    const feeCents = charge.balance_transaction
      ? null
      : null; // Stripe fee resolves async; we don't fetch balance_transaction here for simplicity
    await withTenant(pt.organizationId, (tx) =>
      tx
        .update(paymentTransactions)
        .set({
          transactionStatus: "succeeded",
          stripeChargeId: charge.id,
          paymentMethodDetails: methodDetails ?? undefined,
          processingFeeCents: feeCents ?? pt.processingFeeCents,
          netAmountCents: pt.grossAmountCents - (feeCents ?? 0),
          receiptUrl: charge.receipt_url ?? null,
          succeededAt: new Date(),
        })
        .where(eq(paymentTransactions.id, pt.id)),
    );

    if (pt.relatedEntityType === "draw_request") {
      await db
        .update(drawRequests)
        .set({
          drawRequestStatus: "paid",
          paidAt: new Date(),
          paymentReferenceName: `Stripe ${charge.id}`,
        })
        .where(eq(drawRequests.id, pt.relatedEntityId));
    }

    await db.insert(auditEvents).values({
      actorUserId: await getSystemUserId(),
      organizationId: pt.organizationId,
      projectId: pt.projectId,
      objectType: "payment_transaction",
      objectId: pt.id,
      actionName: "charge_succeeded",
      nextState: {
        grossAmountCents: pt.grossAmountCents,
        stripeChargeId: charge.id,
        relatedEntityType: pt.relatedEntityType,
        relatedEntityId: pt.relatedEntityId,
      },
    });
    return;
  }

  // charge.failed
  await withTenant(pt.organizationId, (tx) =>
    tx
      .update(paymentTransactions)
      .set({
        transactionStatus: "failed",
        stripeChargeId: charge.id,
        failedAt: new Date(),
        failureReason:
          charge.failure_message ??
          charge.outcome?.seller_message ??
          "charge_failed",
      })
      .where(eq(paymentTransactions.id, pt.id)),
  );

  await db.insert(auditEvents).values({
    actorUserId: await getSystemUserId(),
    organizationId: pt.organizationId,
    projectId: pt.projectId,
    objectType: "payment_transaction",
    objectId: pt.id,
    actionName: "charge_failed",
    nextState: {
      stripeChargeId: charge.id,
      failureReason: charge.failure_message ?? charge.outcome?.seller_message ?? "charge_failed",
      relatedEntityType: pt.relatedEntityType,
      relatedEntityId: pt.relatedEntityId,
    },
  });
}

function extractPaymentMethodDetails(
  charge: Stripe.Charge,
): Record<string, unknown> | null {
  const details = charge.payment_method_details;
  if (!details) return null;
  if (details.card) {
    return {
      type: "card",
      brand: details.card.brand,
      last4: details.card.last4,
    };
  }
  if (details.us_bank_account) {
    return {
      type: "us_bank_account",
      bank_name: details.us_bank_account.bank_name,
      last4: details.us_bank_account.last4,
    };
  }
  return { type: details.type ?? "unknown" };
}

// ---------------------------------------------------------------------------
// Stripe Connect — account.updated. Fired whenever the contractor's Connect
// account state changes (onboarding submitted, charges/payouts enabled,
// requirements added). We mirror the salient booleans into syncPreferences
// and flip connectionStatus to 'connected' once the account is able to
// charge + payout.

async function handleConnectAccountUpdated(account: Stripe.Account) {
  // Pre-tenant lookup — webhook arrives with only the Stripe account
  // id, no session. Use admin pool to derive orgId from the row, then
  // wrap the follow-up update in withTenant.
  const [row] = await dbAdmin
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.provider, "stripe"),
        eq(integrationConnections.externalAccountId, account.id),
      ),
    )
    .limit(1);
  if (!row) {
    console.warn(
      `[stripe-webhook] account.updated for unknown Connect account ${account.id}`,
    );
    return;
  }

  const detailsSubmitted = Boolean(account.details_submitted);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);

  // "connected" means we can accept payments on the contractor's behalf.
  // Any unresolved verification state is "connecting". Disabled /
  // restricted accounts surface as "needs_reauth" so the UI prompts a
  // re-onboard link.
  const isFullyActive = detailsSubmitted && chargesEnabled && payoutsEnabled;
  const hasRequirements =
    (account.requirements?.disabled_reason ?? null) !== null ||
    (account.requirements?.currently_due ?? []).length > 0;
  const nextStatus: "connected" | "connecting" | "needs_reauth" = isFullyActive
    ? "connected"
    : hasRequirements && detailsSubmitted
      ? "needs_reauth"
      : "connecting";

  const existingPrefs =
    (row.syncPreferences as Record<string, unknown> | null) ?? {};
  const nextPrefs = {
    ...existingPrefs,
    stripe_details_submitted: detailsSubmitted,
    stripe_charges_enabled: chargesEnabled,
    stripe_payouts_enabled: payoutsEnabled,
    stripe_requirements_disabled_reason:
      account.requirements?.disabled_reason ?? null,
    stripe_requirements_currently_due:
      account.requirements?.currently_due ?? [],
  };

  await withTenant(row.organizationId, (tx) =>
    tx
      .update(integrationConnections)
      .set({
        connectionStatus: nextStatus,
        externalAccountName:
          account.business_profile?.name ?? row.externalAccountName,
        syncPreferences: nextPrefs,
        lastSyncAt: new Date(),
        connectedAt:
          isFullyActive && !row.connectedAt ? new Date() : row.connectedAt,
      })
      .where(eq(integrationConnections.id, row.id)),
  );

  if (row.connectionStatus !== nextStatus) {
    await db.insert(auditEvents).values({
      actorUserId: await getSystemUserId(),
      organizationId: row.organizationId,
      objectType: "stripe_connect_account",
      objectId: row.id,
      actionName: `status_${nextStatus}`,
      previousState: { status: row.connectionStatus },
      nextState: {
        status: nextStatus,
        detailsSubmitted,
        chargesEnabled,
        payoutsEnabled,
      },
    });
  }
}

// ---------------------------------------------------------------------------

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Invoice.subscription was removed in newer API versions; it lives on the
  // parent.subscription_details block now. Tolerate both shapes.
  const anyInvoice = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | null } | null } | null;
  };
  const fromParent = anyInvoice.parent?.subscription_details?.subscription;
  if (fromParent) return fromParent;
  const direct = anyInvoice.subscription;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object" && "id" in direct) {
    return direct.id ?? null;
  }
  return null;
}
