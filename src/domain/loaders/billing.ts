import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  organizations,
  organizationSubscriptions,
  stripeCustomers,
  subscriptionInvoices,
  subscriptionPlans,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import type {
  PlanContext,
  PlanTier,
  SubscriptionStatus,
} from "@/domain/policies/plan";

export type BillingPlanView = {
  id: string;
  slug: PlanTier;
  name: string;
  priceMonthlyCents: number | null;
  priceAnnualCents: number | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  projectLimit: number | null; // null = unlimited
  teamLimit: number | null;
  storageLimitGb: number | null;
  isSelfServePurchasable: boolean;
  displayOrder: number;
};

export type BillingSubscriptionView = {
  id: string;
  status: SubscriptionStatus;
  billingCycle: "monthly" | "annual";
  trialEnd: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  // False for legacy/manual orgs (stripe_subscription_id IS NULL). These
  // orgs render the tab as if they're on Professional but cannot update
  // card or view invoice PDFs until they complete a real Checkout.
  hasStripeSubscription: boolean;
};

export type BillingInvoiceView = {
  id: string;
  stripeInvoiceId: string;
  number: string | null;
  amountPaidCents: number;
  currency: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

export type ContractorBillingView = {
  currentPlan: BillingPlanView;
  subscription: BillingSubscriptionView;
  availablePlans: BillingPlanView[];
  usage: {
    projectCount: number;
    teamCount: number;
    storageBytes: number;
  };
  invoices: BillingInvoiceView[];
  hasStripeCustomer: boolean;
};

// Thin read for policy-gate decisions. Avoids loading the full billing view
// when callers (e.g. API routes) only need tier + status to evaluate
// requireFeature / requireTier. Returns `{ tier: null, status: null }` when
// no subscription exists — isSuspended() then fails all write-gates.
export async function getOrgPlanContext(
  organizationId: string,
): Promise<PlanContext> {
  const [row] = await withTenant(organizationId, (tx) =>
    tx
      .select({
        slug: subscriptionPlans.slug,
        status: organizationSubscriptions.status,
      })
      .from(organizationSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, organizationSubscriptions.planId),
      )
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .limit(1),
  );
  if (!row) return { tier: null, status: null };
  return {
    tier: row.slug as PlanTier,
    status: row.status as SubscriptionStatus,
  };
}

function mapPlanRow(row: typeof subscriptionPlans.$inferSelect): BillingPlanView {
  return {
    id: row.id,
    slug: row.slug as PlanTier,
    name: row.name,
    priceMonthlyCents: row.priceMonthlyCents,
    priceAnnualCents: row.priceAnnualCents,
    stripePriceIdMonthly: row.stripePriceIdMonthly,
    stripePriceIdAnnual: row.stripePriceIdAnnual,
    projectLimit: row.projectLimit,
    teamLimit: row.teamLimit,
    storageLimitGb: row.storageLimitGb,
    isSelfServePurchasable: row.isSelfServePurchasable,
    displayOrder: row.displayOrder,
  };
}

export async function getContractorBillingSummary(
  organizationId: string,
): Promise<ContractorBillingView | null> {
  const [org] = await db
    .select({
      id: organizations.id,
      usageProjectCount: organizations.usageProjectCount,
      usageTeamCount: organizations.usageTeamCount,
      usageStorageBytes: organizations.usageStorageBytes,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;

  const [subRow] = await withTenant(organizationId, (tx) =>
    tx
      .select()
      .from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .limit(1),
  );

  // Every active plan row, ordered for UI display.
  const planRows = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.active, true))
    .orderBy(asc(subscriptionPlans.displayOrder));

  const availablePlans = planRows.map(mapPlanRow);

  // No subscription row at all (pre-backfill contractor, or non-contractor
  // caller threading through by mistake). Return null — caller renders the
  // static / upgrade-first UI.
  if (!subRow) return null;

  const [planRow] = planRows.filter((p) => p.id === subRow.planId);
  if (!planRow) return null;

  const [customer] = await withTenant(organizationId, (tx) =>
    tx
      .select({ id: stripeCustomers.stripeCustomerId })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.organizationId, organizationId))
      .limit(1),
  );

  const invoiceRows = await db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.organizationSubscriptionId, subRow.id))
    .orderBy(desc(subscriptionInvoices.periodStart))
    .limit(12);

  return {
    currentPlan: mapPlanRow(planRow),
    subscription: {
      id: subRow.id,
      status: subRow.status as SubscriptionStatus,
      billingCycle: subRow.billingCycle as "monthly" | "annual",
      trialEnd: subRow.trialEnd,
      currentPeriodStart: subRow.currentPeriodStart,
      currentPeriodEnd: subRow.currentPeriodEnd,
      cancelAtPeriodEnd: subRow.cancelAtPeriodEnd,
      canceledAt: subRow.canceledAt,
      hasStripeSubscription: subRow.stripeSubscriptionId !== null,
    },
    availablePlans,
    usage: {
      projectCount: org.usageProjectCount,
      teamCount: org.usageTeamCount,
      storageBytes: org.usageStorageBytes,
    },
    invoices: invoiceRows.map((r) => ({
      id: r.id,
      stripeInvoiceId: r.stripeInvoiceId,
      number: r.number,
      amountPaidCents: r.amountPaidCents,
      currency: r.currency,
      status: r.status,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      hostedInvoiceUrl: r.hostedInvoiceUrl,
      invoicePdfUrl: r.invoicePdfUrl,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    })),
    hasStripeCustomer: !!customer,
  };
}
