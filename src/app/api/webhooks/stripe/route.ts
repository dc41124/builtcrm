import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db/client";
import {
  organizations,
  organizationSubscriptions,
  subscriptionInvoices,
  subscriptionPlans,
} from "@/db/schema";
import { getStripe, getWebhookSecret } from "@/lib/stripe";

// Note: this endpoint does not write audit_events rows. audit_events.actor_user_id
// is non-nullable and webhook events have no user actor. Follow-up (schema
// change — stop-trigger) is to either create a "system" user and use its ID,
// or to make actor_user_id nullable. The change-plan route still audits when
// a user acts — we only lose observability for trial-end charges and
// Stripe-portal-initiated changes (card updates, cancellation).

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
  const [existing] = await db
    .select({ id: organizationSubscriptions.id })
    .from(organizationSubscriptions)
    .where(eq(organizationSubscriptions.organizationId, organizationId))
    .limit(1);

  if (existing) {
    await db
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
    await db.insert(organizationSubscriptions).values({
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

  await db
    .update(organizations)
    .set({ currentPlanSlug: planSlug })
    .where(eq(organizations.id, organizationId));
}

async function handleSubscriptionChanged(
  sub: Stripe.Subscription,
  eventType: "customer.subscription.updated" | "customer.subscription.deleted",
) {
  const [row] = await db
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

  await db
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
    .where(eq(organizationSubscriptions.id, row.id));

  if (newPlanSlug) {
    await db
      .update(organizations)
      .set({ currentPlanSlug: newPlanSlug })
      .where(eq(organizations.id, row.organizationId));
  }
}

async function handleInvoice(
  invoice: Stripe.Invoice,
  eventType: "invoice.paid" | "invoice.payment_failed",
) {
  // Platform subscription invoices only — ignore one-off invoices etc.
  // In Stripe SDK 22+, the subscription link moved to parent.subscription_details.
  const parentSubId = extractSubscriptionId(invoice);
  if (!parentSubId) return;

  const [row] = await db
    .select({ id: organizationSubscriptions.id })
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
