import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db/client";
import {
  changeOrders,
  drawRequests,
  integrationConnections,
  paymentTransactions,
  projects,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import { AuthorizationError } from "../permissions";
import type { SessionLike } from "../context";

import {
  getContractorOrgContext,
  type ContractorOrgContext,
} from "./integrations";

export type StripeConnectionInfo = {
  id: string;
  status: string;
  externalAccountId: string | null;
  externalAccountName: string | null;
  connectedAt: Date | null;
  lastSyncAt: Date | null;
};

export type PaymentMethodDetails = {
  type: string | null;
  bankName: string | null;
  last4: string | null;
  brand: string | null;
};

export type PaymentRow = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  paymentMethodType: string;
  transactionStatus: string;
  grossAmountCents: number;
  processingFeeCents: number;
  netAmountCents: number;
  currency: string;
  methodDetails: PaymentMethodDetails;
  payerName: string | null;
  externalReference: string | null;
  initiatedAt: Date | null;
  succeededAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
};

export type ContractorPaymentsView = {
  context: ContractorOrgContext;
  stripeConnection: StripeConnectionInfo | null;
  stripeConnectionConnectedAndHealthy: boolean;
  totalProcessedCents: number;
  totalFeesCents: number;
  processedCount: number;
  projectsWithPaymentsCount: number;
  payments: PaymentRow[];
};

export async function getContractorPaymentsView(input: {
  session: SessionLike | null | undefined;
}): Promise<ContractorPaymentsView> {
  const context = await getContractorOrgContext(input.session);

  const [stripeRow] = await withTenant(context.organization.id, (tx) =>
    tx
      .select({
        id: integrationConnections.id,
        status: integrationConnections.connectionStatus,
        externalAccountId: integrationConnections.externalAccountId,
        externalAccountName: integrationConnections.externalAccountName,
        connectedAt: integrationConnections.connectedAt,
        lastSyncAt: integrationConnections.lastSyncAt,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, context.organization.id),
          eq(integrationConnections.provider, "stripe"),
          ne(integrationConnections.connectionStatus, "disconnected"),
        ),
      )
      .limit(1),
  );

  const stripeConnection: StripeConnectionInfo | null = stripeRow
    ? {
        id: stripeRow.id,
        status: stripeRow.status,
        externalAccountId: stripeRow.externalAccountId,
        externalAccountName: stripeRow.externalAccountName,
        connectedAt: stripeRow.connectedAt,
        lastSyncAt: stripeRow.lastSyncAt,
      }
    : null;

  const stripeConnectionConnectedAndHealthy =
    stripeConnection?.status === "connected";

  const paymentRows = await db
    .select({
      id: paymentTransactions.id,
      projectId: paymentTransactions.projectId,
      projectName: projects.name,
      relatedEntityType: paymentTransactions.relatedEntityType,
      relatedEntityId: paymentTransactions.relatedEntityId,
      paymentMethodType: paymentTransactions.paymentMethodType,
      transactionStatus: paymentTransactions.transactionStatus,
      grossAmountCents: paymentTransactions.grossAmountCents,
      processingFeeCents: paymentTransactions.processingFeeCents,
      netAmountCents: paymentTransactions.netAmountCents,
      currency: paymentTransactions.currency,
      paymentMethodDetails: paymentTransactions.paymentMethodDetails,
      initiatedByUserId: paymentTransactions.initiatedByUserId,
      externalReference: paymentTransactions.externalReference,
      initiatedAt: paymentTransactions.initiatedAt,
      succeededAt: paymentTransactions.succeededAt,
      failedAt: paymentTransactions.failedAt,
      createdAt: paymentTransactions.createdAt,
    })
    .from(paymentTransactions)
    .innerJoin(projects, eq(projects.id, paymentTransactions.projectId))
    .where(eq(paymentTransactions.organizationId, context.organization.id))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(100);

  // Resolve human-friendly titles: look up sequential numbers for
  // draw-request / change-order related entities and fold them into titles.
  const drawIds = paymentRows
    .filter((r) => r.relatedEntityType === "draw_request")
    .map((r) => r.relatedEntityId);
  const changeIds = paymentRows
    .filter((r) => r.relatedEntityType === "change_order")
    .map((r) => r.relatedEntityId);

  const drawNumbers = new Map<string, number>();
  if (drawIds.length > 0) {
    const rows = await db
      .select({ id: drawRequests.id, drawNumber: drawRequests.drawNumber })
      .from(drawRequests)
      .where(inArray(drawRequests.id, drawIds));
    for (const r of rows) drawNumbers.set(r.id, r.drawNumber);
  }

  const changeNumbers = new Map<string, number>();
  if (changeIds.length > 0) {
    const rows = await db
      .select({
        id: changeOrders.id,
        changeOrderNumber: changeOrders.changeOrderNumber,
      })
      .from(changeOrders)
      .where(inArray(changeOrders.id, changeIds));
    for (const r of rows) changeNumbers.set(r.id, r.changeOrderNumber);
  }

  const payerIds = Array.from(
    new Set(
      paymentRows
        .map((r) => r.initiatedByUserId)
        .filter((v): v is string => v != null),
    ),
  );
  const payerNames = new Map<string, string>();
  if (payerIds.length > 0) {
    const rows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, payerIds));
    for (const r of rows) {
      payerNames.set(r.id, r.displayName ?? r.email);
    }
  }

  const payments: PaymentRow[] = paymentRows.map((r) => {
    const title = buildPaymentTitle({
      relatedEntityType: r.relatedEntityType,
      relatedEntityId: r.relatedEntityId,
      projectName: r.projectName,
      drawNumbers,
      changeNumbers,
    });
    const details = extractMethodDetails(r.paymentMethodDetails);
    return {
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      title,
      paymentMethodType: r.paymentMethodType,
      transactionStatus: r.transactionStatus,
      grossAmountCents: r.grossAmountCents,
      processingFeeCents: r.processingFeeCents,
      netAmountCents: r.netAmountCents,
      currency: r.currency,
      methodDetails: details,
      payerName: r.initiatedByUserId
        ? payerNames.get(r.initiatedByUserId) ?? null
        : null,
      externalReference: r.externalReference,
      initiatedAt: r.initiatedAt,
      succeededAt: r.succeededAt,
      failedAt: r.failedAt,
      createdAt: r.createdAt,
    };
  });

  const succeeded = payments.filter((p) => p.transactionStatus === "succeeded");
  const totalProcessedCents = succeeded.reduce(
    (sum, p) => sum + p.grossAmountCents,
    0,
  );
  const totalFeesCents = succeeded.reduce(
    (sum, p) => sum + p.processingFeeCents,
    0,
  );
  const projectsWithPaymentsCount = new Set(succeeded.map((p) => p.projectId))
    .size;

  return {
    context,
    stripeConnection,
    stripeConnectionConnectedAndHealthy,
    totalProcessedCents,
    totalFeesCents,
    processedCount: succeeded.length,
    projectsWithPaymentsCount,
    payments,
  };
}

function buildPaymentTitle(input: {
  relatedEntityType: string;
  relatedEntityId: string;
  projectName: string;
  drawNumbers: Map<string, number>;
  changeNumbers: Map<string, number>;
}): string {
  if (input.relatedEntityType === "draw_request") {
    const n = input.drawNumbers.get(input.relatedEntityId);
    return n != null
      ? `Draw #${n} — ${input.projectName}`
      : `Draw — ${input.projectName}`;
  }
  if (input.relatedEntityType === "change_order") {
    const n = input.changeNumbers.get(input.relatedEntityId);
    return n != null
      ? `Change order #${n} — ${input.projectName}`
      : `Change order — ${input.projectName}`;
  }
  if (input.relatedEntityType === "selection_decision") {
    return `Selection upgrade — ${input.projectName}`;
  }
  if (input.relatedEntityType === "retainage_release") {
    return `Retainage release — ${input.projectName}`;
  }
  return `Payment — ${input.projectName}`;
}

function extractMethodDetails(
  raw: Record<string, unknown> | null,
): PaymentMethodDetails {
  if (!raw) {
    return { type: null, bankName: null, last4: null, brand: null };
  }
  return {
    type: typeof raw.type === "string" ? raw.type : null,
    bankName: typeof raw.bank_name === "string" ? raw.bank_name : null,
    last4: typeof raw.last4 === "string" ? raw.last4 : null,
    brand: typeof raw.brand === "string" ? raw.brand : null,
  };
}

// Ensure AuthorizationError is reachable for callers to narrow on.
export { AuthorizationError };
