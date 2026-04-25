import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import {
  drawRequests,
  integrationConnections,
  paymentTransactions,
  projects,
} from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { AuthorizationError } from "@/domain/permissions";
import { hasFeature } from "@/domain/policies/plan";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Client-initiated draw payment. Creates a Stripe Checkout session in
// payment mode, routed via Connect to the contractor's connected account.
// The payment_transactions row is inserted here with status='pending';
// webhook handlers progress it through processing → succeeded/failed and
// flip the draw's drawRequestStatus to 'paid' on success.
//
// Payment method availability is gated by the CONTRACTOR's plan:
//   Starter     — ACH only        (stripe.cards absent)
//   Professional— ACH + card      (stripe.cards present)
//   Enterprise  — same as Pro, plus future custom payout schedules
//
// application_fee_amount is 0 for portfolio scope. Currency is CAD to match
// the project default; Stripe supports multi-currency Connect if needed.

const CLIENT_ROLES = new Set(["commercial_client", "residential_client"]);
const PAYABLE_STATUSES = new Set(["approved", "approved_with_note"]);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: drawId } = await params;
  const { session } = await requireServerSession();
  try {
    const [draw] = await db
      .select()
      .from(drawRequests)
      .where(eq(drawRequests.id, drawId))
      .limit(1);
    if (!draw) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      draw.projectId,
    );
    if (!CLIENT_ROLES.has(ctx.role)) {
      throw new AuthorizationError(
        "Only the project's client can pay a draw request",
        "forbidden",
      );
    }
    if (!PAYABLE_STATUSES.has(draw.drawRequestStatus)) {
      return NextResponse.json(
        { error: "invalid_state", state: draw.drawRequestStatus },
        { status: 409 },
      );
    }
    if (draw.currentPaymentDueCents <= 0) {
      return NextResponse.json(
        { error: "nothing_due", message: "This draw has no payment due." },
        { status: 409 },
      );
    }

    // Refuse to double-charge — if any non-terminal payment_transactions
    // row exists for this draw, return 409. Callers can cancel/refund the
    // prior attempt via the contractor dashboard if needed.
    const existing = await db
      .select({
        id: paymentTransactions.id,
        status: paymentTransactions.transactionStatus,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.relatedEntityType, "draw_request"),
          eq(paymentTransactions.relatedEntityId, draw.id),
          ne(paymentTransactions.transactionStatus, "failed"),
          ne(paymentTransactions.transactionStatus, "canceled"),
          ne(paymentTransactions.transactionStatus, "refunded"),
        ),
      );
    if (existing.length > 0) {
      return NextResponse.json(
        {
          error: "payment_in_progress",
          message:
            "A payment for this draw is already in progress or has been completed.",
          existingStatus: existing[0].status,
        },
        { status: 409 },
      );
    }

    // Look up contractor's Connect account + plan.
    const contractorOrgId = ctx.project.contractorOrganizationId;
    const [projectRow] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, draw.projectId))
      .limit(1);
    const projectName = projectRow?.name ?? "Project";

    const [connectRow] = await db
      .select({
        externalAccountId: integrationConnections.externalAccountId,
        connectionStatus: integrationConnections.connectionStatus,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, contractorOrgId),
          eq(integrationConnections.provider, "stripe"),
        ),
      )
      .limit(1);
    if (
      !connectRow ||
      !connectRow.externalAccountId ||
      connectRow.connectionStatus !== "connected"
    ) {
      return NextResponse.json(
        {
          error: "contractor_not_payable",
          message:
            "Your builder hasn't finished setting up payments yet. Ask them to complete Stripe onboarding.",
        },
        { status: 409 },
      );
    }

    const planCtx = await getOrgPlanContext(contractorOrgId);
    const cardsAllowed = hasFeature(planCtx, "stripe.cards");
    const paymentMethodTypes: Array<
      "us_bank_account" | "card"
    > = cardsAllowed ? ["us_bank_account", "card"] : ["us_bank_account"];

    const stripe = getStripe();
    const appUrl = getAppUrl();
    const clientBasePath =
      ctx.role === "residential_client" ? "/residential" : "/commercial";
    const returnUrl = `${appUrl}${clientBasePath}/project/${draw.projectId}/billing?pay=`;

    // Insert pending row FIRST so the metadata we set on Stripe is keyed
    // to a known payment_transactions row. Webhook updates this row by id.
    const [ptRow] = await db
      .insert(paymentTransactions)
      .values({
        organizationId: contractorOrgId,
        projectId: draw.projectId,
        relatedEntityType: "draw_request",
        relatedEntityId: draw.id,
        paymentMethodType: "ach_debit",
        transactionStatus: "pending",
        grossAmountCents: draw.currentPaymentDueCents,
        processingFeeCents: 0,
        platformFeeCents: 0,
        netAmountCents: draw.currentPaymentDueCents,
        currency: "cad",
        initiatedByUserId: ctx.user.id,
      })
      .returning({ id: paymentTransactions.id });

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: paymentMethodTypes,
        line_items: [
          {
            price_data: {
              currency: "cad",
              unit_amount: draw.currentPaymentDueCents,
              product_data: {
                name: `Draw #${draw.drawNumber} — ${projectName}`,
                description: `Payment period ${formatDate(draw.periodFrom)} to ${formatDate(draw.periodTo)}`,
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: 0,
          transfer_data: {
            destination: connectRow.externalAccountId,
          },
          metadata: {
            paymentTransactionId: ptRow.id,
            drawRequestId: draw.id,
            projectId: draw.projectId,
            organizationId: contractorOrgId,
            payerUserId: ctx.user.id,
          },
        },
        metadata: {
          paymentTransactionId: ptRow.id,
          drawRequestId: draw.id,
          projectId: draw.projectId,
          organizationId: contractorOrgId,
          payerUserId: ctx.user.id,
          scope: "draw_payment",
        },
        success_url: `${returnUrl}success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}canceled`,
      },
    );

    if (!checkoutSession.url) {
      throw new Error("Stripe Checkout did not return a session URL");
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      paymentTransactionId: ptRow.id,
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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
