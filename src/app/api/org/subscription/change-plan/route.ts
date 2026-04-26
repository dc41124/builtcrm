import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  auditEvents,
  organizationSubscriptions,
  stripeCustomers,
  subscriptionPlans,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Handles two distinct paths in one endpoint:
//   (A) No existing Stripe subscription (legacy/backfilled orgs, or any org
//       that has never completed Checkout) → create a Stripe Checkout session
//       for initial payment. Response includes { url } to redirect to.
//   (B) Existing Stripe subscription → swap the item's price via the Stripe
//       API directly (no Checkout redirect). Proration behavior is
//       "create_prorations" so the user pays a partial amount now.
//
// Payment-method updates, cancellation, and invoice PDFs all go through the
// /api/org/subscription/portal endpoint (Stripe Customer Portal).

const BodySchema = z.object({
  planSlug: z.enum(["starter", "professional", "enterprise"]),
  billingCycle: z.enum(["monthly", "annual"]),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const sessionShim = session;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { planSlug, billingCycle } = parsed.data;

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can change the subscription plan",
        "forbidden",
      );
    }

    // Enterprise has no self-serve Checkout path — the DB row has
    // stripe_price_id_* columns as null by design. Redirect the user to
    // contact sales instead.
    if (planSlug === "enterprise") {
      return NextResponse.json(
        {
          error: "enterprise_requires_sales",
          message: "Enterprise plans are provisioned via sales contact.",
        },
        { status: 400 },
      );
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, planSlug))
      .limit(1);
    if (!plan || !plan.active) {
      return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
    }

    const priceId =
      billingCycle === "monthly"
        ? plan.stripePriceIdMonthly
        : plan.stripePriceIdAnnual;
    if (!priceId) {
      return NextResponse.json(
        {
          error: "plan_not_provisioned",
          message: `Stripe price ID missing for ${planSlug}/${billingCycle}. Populate subscription_plans.stripe_price_id_* first.`,
        },
        { status: 503 },
      );
    }

    const [existingSub] = await db
      .select()
      .from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, ctx.organization.id))
      .limit(1);

    const stripe = getStripe();

    // Path B: we have a real Stripe subscription — mutate it directly, no
    // Checkout redirect. Swap the single line item to the new price.
    if (existingSub?.stripeSubscriptionId) {
      const current = await stripe.subscriptions.retrieve(
        existingSub.stripeSubscriptionId,
      );
      const currentItem = current.items.data[0];
      if (!currentItem) {
        throw new Error(
          `Stripe subscription ${existingSub.stripeSubscriptionId} has no line items`,
        );
      }
      await stripe.subscriptions.update(existingSub.stripeSubscriptionId, {
        items: [{ id: currentItem.id, price: priceId }],
        proration_behavior: "create_prorations",
      });

      await db.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "subscription",
        objectId: existingSub.id,
        actionName: "plan_changed",
        previousState: { planId: existingSub.planId },
        nextState: { planId: plan.id, billingCycle },
      });

      return NextResponse.json({ ok: true, mode: "updated" });
    }

    // Path A: no Stripe subscription yet. Create / reuse Stripe customer,
    // then create a Checkout session with a 14-day trial (first-charge-at-
    // day-14 per the signup spec). Webhook finalizes the subscription.
    const [customer] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select()
        .from(stripeCustomers)
        .where(eq(stripeCustomers.organizationId, ctx.organization.id))
        .limit(1),
    );

    let stripeCustomerId: string;
    if (customer) {
      stripeCustomerId = customer.stripeCustomerId;
    } else {
      const [userRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      if (!userRow) {
        throw new AuthorizationError("User not found", "not_found");
      }
      const created = await stripe.customers.create({
        email: userRow.email,
        metadata: { organizationId: ctx.organization.id },
      });
      stripeCustomerId = created.id;
      await withTenant(ctx.organization.id, (tx) =>
        tx.insert(stripeCustomers).values({
          organizationId: ctx.organization.id,
          stripeCustomerId: created.id,
          email: userRow.email,
        }),
      );
    }

    const appUrl = getAppUrl();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          organizationId: ctx.organization.id,
          planSlug,
          billingCycle,
        },
      },
      success_url: `${appUrl}/contractor/settings?billing=success`,
      cancel_url: `${appUrl}/contractor/settings?billing=canceled`,
      metadata: {
        organizationId: ctx.organization.id,
        planSlug,
        billingCycle,
      },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe Checkout did not return a session URL");
    }

    return NextResponse.json({
      ok: true,
      mode: "checkout",
      url: checkoutSession.url,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}
