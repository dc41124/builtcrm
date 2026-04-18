import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { stripeCustomers } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Returns a Stripe Customer Portal URL for the caller's org. Covers card
// updates, invoice PDF downloads, and subscription cancellation. Portal
// behavior (what the customer is allowed to do there) is configured in the
// Stripe dashboard, not here.

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as { appUserId?: string | null };

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can open the billing portal",
        "forbidden",
      );
    }

    const [customer] = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.organizationId, ctx.organization.id))
      .limit(1);

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
