import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  integrationConnections,
  paymentTransactions,
  projects,
  selectionDecisions,
  selectionItems,
  selectionOptions,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getEffectiveContext } from "@/domain/context";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { AuthorizationError } from "@/domain/permissions";
import { requireFeature, PlanGateError } from "@/domain/policies/plan";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Residential client pays the overage on a confirmed selection that
// exceeds the item's allowance. Mirrors the draw payment flow: Stripe
// Checkout in payment mode, routed via Connect to the contractor's
// connected account, payment_transactions tracked, webhook confirms via
// charge.succeeded.
//
// Pro+ contractor plan required (`stripe.client_pays_selections`). Card
// only per the original spec — selection upgrades are typically small
// amounts where ACH's 3-5 day settlement is a worse experience than
// same-day card.

const RESIDENTIAL_ROLE = "residential_client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: decisionId } = await params;
  const { session } = await requireServerSession();
  try {
    // Pre-tenant head lookup: tenant unknown until project resolves.
    const [row] = await dbAdmin
      .select({
        decisionId: selectionDecisions.id,
        projectId: selectionDecisions.projectId,
        isConfirmed: selectionDecisions.isConfirmed,
        selectedOptionId: selectionDecisions.selectedOptionId,
        optionPriceCents: selectionOptions.priceCents,
        allowanceCents: selectionItems.allowanceCents,
        itemTitle: selectionItems.title,
        projectName: projects.name,
      })
      .from(selectionDecisions)
      .innerJoin(
        selectionOptions,
        eq(selectionOptions.id, selectionDecisions.selectedOptionId),
      )
      .innerJoin(
        selectionItems,
        eq(selectionItems.id, selectionDecisions.selectionItemId),
      )
      .innerJoin(projects, eq(projects.id, selectionDecisions.projectId))
      .where(eq(selectionDecisions.id, decisionId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      row.projectId,
    );
    if (ctx.role !== RESIDENTIAL_ROLE) {
      throw new AuthorizationError(
        "Only the residential client can pay a selection upgrade",
        "forbidden",
      );
    }
    if (!row.isConfirmed) {
      return NextResponse.json(
        { error: "not_confirmed", message: "Confirm the selection first." },
        { status: 409 },
      );
    }

    const upgradeCents = row.optionPriceCents - row.allowanceCents;
    if (upgradeCents <= 0) {
      return NextResponse.json(
        {
          error: "no_upgrade",
          message: "This selection is within allowance — nothing to pay.",
        },
        { status: 409 },
      );
    }

    // Plan gate — contractor must have Pro+ for client-pays-selections.
    const contractorOrgId = ctx.project.contractorOrganizationId;
    const planCtx = await getOrgPlanContext(contractorOrgId);
    requireFeature(planCtx, "stripe.client_pays_selections");

    // Refuse double-charge.
    const existing = await db
      .select({
        id: paymentTransactions.id,
        status: paymentTransactions.transactionStatus,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.relatedEntityType, "selection_decision"),
          eq(paymentTransactions.relatedEntityId, row.decisionId),
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
            "A payment for this selection is already in progress or completed.",
          existingStatus: existing[0].status,
        },
        { status: 409 },
      );
    }

    const [connectRow] = await withTenant(contractorOrgId, (tx) =>
      tx
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
        .limit(1),
    );
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

    const stripe = getStripe();
    const appUrl = getAppUrl();
    const returnUrl = `${appUrl}/residential/project/${row.projectId}/selections?pay=`;

    const [ptRow] = await db
      .insert(paymentTransactions)
      .values({
        organizationId: contractorOrgId,
        projectId: row.projectId,
        relatedEntityType: "selection_decision",
        relatedEntityId: row.decisionId,
        paymentMethodType: "card",
        transactionStatus: "pending",
        grossAmountCents: upgradeCents,
        processingFeeCents: 0,
        platformFeeCents: 0,
        netAmountCents: upgradeCents,
        currency: "cad",
        initiatedByUserId: ctx.user.id,
      })
      .returning({ id: paymentTransactions.id });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: upgradeCents,
            product_data: {
              name: `Selection upgrade — ${row.itemTitle}`,
              description: `${row.projectName} · over allowance`,
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
          selectionDecisionId: row.decisionId,
          projectId: row.projectId,
          organizationId: contractorOrgId,
          payerUserId: ctx.user.id,
        },
      },
      metadata: {
        paymentTransactionId: ptRow.id,
        selectionDecisionId: row.decisionId,
        projectId: row.projectId,
        organizationId: contractorOrgId,
        payerUserId: ctx.user.id,
        scope: "selection_upgrade",
      },
      success_url: `${returnUrl}success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}canceled`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe Checkout did not return a session URL");
    }

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      paymentTransactionId: ptRow.id,
      upgradeCents,
    });
  } catch (err) {
    if (err instanceof PlanGateError) {
      return NextResponse.json(
        {
          error: "plan_gate",
          reason: err.reason,
          required: err.required,
          message: err.message,
        },
        { status: 402 },
      );
    }
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
