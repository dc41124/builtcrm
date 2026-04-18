import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { paymentTransactions } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import {
  AuthorizationError,
  assertCan,
  type Resource,
} from "@/domain/permissions";

// User-facing receipt URL. Keyed by payment_transactions.id, so any row
// — Stripe or manual — resolves through the same link. Dispatches on row
// shape:
//   - Stripe row with receiptUrl → 302 to Stripe's hosted receipt page
//   - Anything else → 302 to /api/export/payment/[id] which renders the PDF
//
// Both paths require the same access check (project membership + read on
// the related entity's resource) so the URL never leaks the existence of
// a row the caller can't see — 401/403/404 mapping is identical to the
// canonical export endpoint.

export const runtime = "nodejs";

function resourceForRelatedType(type: string): Resource {
  switch (type) {
    case "draw_request":
    case "retainage_release":
      return "draw_request";
    case "selection_decision":
      return "selection";
    case "change_order":
      return "change_order";
    default:
      return "project";
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ paymentTransactionId: string }> },
) {
  const { paymentTransactionId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [txn] = await db
    .select({
      id: paymentTransactions.id,
      projectId: paymentTransactions.projectId,
      relatedEntityType: paymentTransactions.relatedEntityType,
      stripePaymentIntentId: paymentTransactions.stripePaymentIntentId,
      receiptUrl: paymentTransactions.receiptUrl,
    })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, paymentTransactionId))
    .limit(1);
  if (!txn) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      txn.projectId,
    );
    assertCan(
      ctx.permissions,
      resourceForRelatedType(txn.relatedEntityType),
      "read",
    );

    if (txn.stripePaymentIntentId && txn.receiptUrl) {
      await writeAuditEvent(ctx, {
        action: "payment.exported",
        resourceType: "payment_transaction",
        resourceId: txn.id,
        details: {
          metadata: {
            relatedEntityType: txn.relatedEntityType,
            channel: "stripe_receipt_url",
          },
        },
      });
      return NextResponse.redirect(txn.receiptUrl, 302);
    }

    const exportUrl = new URL(
      `/api/export/payment/${txn.id}`,
      req.url,
    );
    // The canonical export route performs its own audit write on success;
    // we don't double-log here so the audit trail stays clean.
    return NextResponse.redirect(exportUrl, 302);
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
