import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import {
  changeOrders,
  drawRequests,
  organizations,
  paymentTransactions,
  projectOrganizationMemberships,
  projects,
  retainageReleases,
  selectionDecisions,
  selectionItems,
  selectionOptions,
  users,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import {
  AuthorizationError,
  assertCan,
  type Resource,
} from "@/domain/permissions";
import {
  PaymentReceiptDocument,
  type PaymentReceiptData,
} from "@/lib/pdf/payment-receipt-template";

// Payment receipt PDF. Canonical endpoint: /api/export/payment/[id].
// The user-facing /receipts/[id] route delegates here for non-Stripe rows
// and 302s to the Stripe-hosted receiptUrl for Stripe rows.
//
// Authorization: the caller must have project access (getEffectiveContext
// throws 403 otherwise) AND read access on the related entity's resource.
// Non-existent ids return 404; "exists but not yours" returns 403 because
// project access fails before the id leaks into the response.

export const runtime = "nodejs";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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

async function resolveRelatedSummary(
  type: string,
  id: string,
  callerOrgId: string,
): Promise<{ label: string; description: string | null }> {
  if (type === "draw_request") {
    const [row] = await db
      .select({
        drawNumber: drawRequests.drawNumber,
        periodFrom: drawRequests.periodFrom,
        periodTo: drawRequests.periodTo,
      })
      .from(drawRequests)
      .where(eq(drawRequests.id, id))
      .limit(1);
    if (!row) return { label: "Draw request", description: null };
    const periodFrom = new Date(row.periodFrom).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const periodTo = new Date(row.periodTo).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return {
      label: `Draw #${row.drawNumber}`,
      description: `Billing period ${periodFrom} – ${periodTo}`,
    };
  }
  if (type === "retainage_release") {
    const [row] = await db
      .select({
        releaseAmountCents: retainageReleases.releaseAmountCents,
      })
      .from(retainageReleases)
      .where(eq(retainageReleases.id, id))
      .limit(1);
    if (!row) return { label: "Retainage release", description: null };
    return {
      label: `Retainage release ${id.slice(0, 8).toUpperCase()}`,
      description: null,
    };
  }
  if (type === "selection_decision") {
    const [row] = await db
      .select({
        itemTitle: selectionItems.title,
        optionName: selectionOptions.name,
      })
      .from(selectionDecisions)
      .innerJoin(
        selectionItems,
        eq(selectionItems.id, selectionDecisions.selectionItemId),
      )
      .innerJoin(
        selectionOptions,
        eq(selectionOptions.id, selectionDecisions.selectedOptionId),
      )
      .where(eq(selectionDecisions.id, id))
      .limit(1);
    if (!row) return { label: "Selection decision", description: null };
    return {
      label: `Selection: ${row.itemTitle}`,
      description: row.optionName ? `Option: ${row.optionName}` : null,
    };
  }
  if (type === "change_order") {
    const [row] = await withTenant(callerOrgId, (tx) =>
      tx
        .select({
          changeOrderNumber: changeOrders.changeOrderNumber,
          title: changeOrders.title,
        })
        .from(changeOrders)
        .where(eq(changeOrders.id, id))
        .limit(1),
    );
    if (!row) return { label: "Change order", description: null };
    return {
      label: `Change Order #${row.changeOrderNumber}`,
      description: row.title ?? null,
    };
  }
  return { label: type, description: null };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paymentTransactionId: string }> },
) {
  const { paymentTransactionId } = await params;
  const { session } = await requireServerSession();
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, paymentTransactionId))
    .limit(1);
  if (!txn) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      txn.projectId,
    );
    assertCan(ctx.permissions, resourceForRelatedType(txn.relatedEntityType), "read");

    const [contractorOrg] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, txn.organizationId))
      .limit(1);

    const [clientMembership] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select({ name: organizations.name })
        .from(projectOrganizationMemberships)
        .innerJoin(
          organizations,
          eq(organizations.id, projectOrganizationMemberships.organizationId),
        )
        .where(
          and(
            eq(projectOrganizationMemberships.projectId, txn.projectId),
            eq(projectOrganizationMemberships.membershipType, "client"),
            eq(projectOrganizationMemberships.membershipStatus, "active"),
          ),
        )
        .limit(1),
    );

    const [initiatedByUser] = txn.initiatedByUserId
      ? await db
          .select({
            displayName: users.displayName,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, txn.initiatedByUserId))
          .limit(1)
      : [null];

    const related = await resolveRelatedSummary(
      txn.relatedEntityType,
      txn.relatedEntityId,
      ctx.organization.id,
    );

    const [project] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, txn.projectId))
      .limit(1);

    // Payer attribution: clients pay the contractor. When a contractor
    // records a manual payment on a client's behalf, we still show the
    // client org as "Paid by" and fall back to the initiating user only
    // when no client membership is on file.
    const payerName =
      clientMembership?.name ??
      initiatedByUser?.displayName ??
      initiatedByUser?.email ??
      null;

    const data: PaymentReceiptData = {
      projectName: project?.name ?? "Project",
      contractorName: contractorOrg?.name ?? ctx.organization.name,
      payerName,
      transaction: {
        id: txn.id,
        paymentMethodType: txn.paymentMethodType,
        transactionStatus: txn.transactionStatus,
        grossAmountCents: txn.grossAmountCents,
        processingFeeCents: txn.processingFeeCents,
        platformFeeCents: txn.platformFeeCents,
        netAmountCents: txn.netAmountCents,
        currency: txn.currency,
        initiatedAt: txn.initiatedAt,
        succeededAt: txn.succeededAt,
        stripePaymentIntentId: txn.stripePaymentIntentId,
        stripeChargeId: txn.stripeChargeId,
        paymentMethodDetails: txn.paymentMethodDetails,
        externalReference: txn.externalReference,
        note: txn.note,
      },
      related: {
        type: txn.relatedEntityType,
        label: related.label,
        description: related.description,
      },
    };

    const buffer = await renderToBuffer(PaymentReceiptDocument({ data }));

    await writeAuditEvent(ctx, {
      action: "payment.exported",
      resourceType: "payment_transaction",
      resourceId: txn.id,
      details: {
        metadata: {
          relatedEntityType: txn.relatedEntityType,
          relatedEntityId: txn.relatedEntityId,
          grossAmountCents: txn.grossAmountCents,
          channel: "pdf",
        },
      },
    });

    const shortId = txn.id.slice(0, 8);
    const filename = `payment-${slug(contractorOrg?.name ?? "builtcrm")}-${shortId}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
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
