import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { stripeCustomers } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Returns a Stripe Customer Portal URL for the caller's org. Covers card
// updates, invoice PDF downloads, and subscription cancellation. Portal
// behavior (what the customer is allowed to do there) is configured in the
// Stripe dashboard, not here.

export async function POST() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can open the billing portal",
        "forbidden",
      );
    }

    const [customer] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select()
        .from(stripeCustomers)
        .where(eq(stripeCustomers.organizationId, ctx.organization.id))
        .limit(1),
    );

    if (!customer) {
      return NextResponse.json(
        {
          error: "no_stripe_customer",
          message:
            "This organization has no Stripe customer yet. Complete an initial Checkout first.",
        },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${getAppUrl()}/contractor/settings`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
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
