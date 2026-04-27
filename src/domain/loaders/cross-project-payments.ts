import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  drawRequests,
  lienWaivers,
  organizations,
  paymentTransactions,
  projects,
  retainageReleases,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import type { SessionLike } from "../context";
import {
  getContractorOrgContext,
  type ContractorOrgContext,
} from "./integrations";

// Cross-project payment tracking (Step 38 / 4D #38). Two views:
//   - Inbound: contractor → client billing (rows are drawRequests)
//   - Outbound: contractor → sub payments (rows are lienWaivers, used as
//     a sub-payment proxy since the current schema does not carry a
//     dedicated sub_payments table)
//
// All queries are scoped to projects the caller's contractor org owns.

// --------------------------------------------------------------------------
// Delinquency + partial-payment heuristics
// --------------------------------------------------------------------------
//
// Measure the payment clock from the APPROVAL transition, not from
// submission. A draw can sit in submitted → under_review → approved for
// legitimate reasons before anyone owes money. Ontario's prompt-payment
// rule is 28 days on a proper invoice; 30 is the conservative internal
// threshold. Tune here when Phase 9-lite's compliance surface lands.
export const DELINQUENT_AFTER_DAYS = 30;

// Draw statuses that imply "client owes money." Kept as a tuple so it
// doubles as the eligibility filter for delinquency + as a
// Postgres IN list.
const APPROVED_DRAW_STATUSES = ["approved", "approved_with_note"] as const;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type InboundEffectiveStatus =
  | "draft"
  | "ready_for_review"
  | "submitted"
  | "under_review"
  | "approved"
  | "approved_with_note"
  | "returned"
  | "revised"
  | "paid"
  | "closed"
  | "delinquent"
  | "partially_paid";

export type InboundRow = {
  id: string;
  projectId: string;
  projectName: string;
  drawNumber: number;
  rawStatus: string;
  effectiveStatus: InboundEffectiveStatus;
  currentPaymentDueCents: number;
  paidSumCents: number;
  paymentMethod: string | null; // null when no payment_transactions attached
  paymentReferenceName: string | null;
  createdByName: string | null;
  periodFrom: Date | null;
  periodTo: Date | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  paidAt: Date | null;
  // Days since the payment clock started. Only non-null when the draw is
  // in an approved state and not yet paid.
  agingDays: number | null;
};

export type OutboundRow = {
  id: string; // lien waiver id
  projectId: string;
  projectName: string;
  drawRequestId: string;
  drawNumber: number;
  subOrganizationName: string | null;
  lienWaiverType: string;
  lienWaiverStatus: string;
  amountCents: number;
  throughDate: Date | null;
  requestedAt: Date | null;
  submittedAt: Date | null;
  acceptedAt: Date | null;
  ageDays: number | null;
};

export type InboundTotals = {
  totalDraws: number;
  totalOutstandingCents: number; // sum of currentPaymentDue for unpaid draws
  totalPaidCents: number; // sum of succeeded payment_transactions gross
  delinquentCount: number;
  partiallyPaidCount: number;
};

export type OutboundTotals = {
  totalWaivers: number;
  totalAmountCents: number;
  pendingWaiverCount: number; // requested | submitted
  totalRetainageHeldCents: number;
};

export type ProjectOption = {
  id: string;
  name: string;
};

export type ContractorCrossProjectPaymentsView = {
  context: ContractorOrgContext;
  inbound: {
    rows: InboundRow[];
    totals: InboundTotals;
  };
  outbound: {
    rows: OutboundRow[];
    totals: OutboundTotals;
  };
  projectOptions: ProjectOption[];
  generatedAtMs: number;
};

type LoaderInput = { session: SessionLike | null | undefined };

// Tightest summary shape for the Reports-page tile — no rows, just
// headline totals and a per-project aging split.
export type PaymentTrackingReportSummary = {
  generatedAtMs: number;
  inbound: InboundTotals;
  outbound: OutboundTotals;
  topDelinquentProjects: Array<{
    projectId: string;
    projectName: string;
    delinquentCount: number;
    delinquentOutstandingCents: number;
  }>;
};

// --------------------------------------------------------------------------
// Loader — full view for the /contractor/payment-tracking page
// --------------------------------------------------------------------------

export async function getContractorCrossProjectPayments(
  input: LoaderInput,
): Promise<ContractorCrossProjectPaymentsView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = Date.now();

  // Project scope — every project this contractor org owns.
  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));

  if (projectRows.length === 0) {
    return {
      context,
      inbound: { rows: [], totals: emptyInboundTotals() },
      outbound: { rows: [], totals: emptyOutboundTotals() },
      projectOptions: [],
      generatedAtMs: now,
    };
  }

  const projectIds = projectRows.map((p) => p.id);
  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));

  // Parallel cross-project queries.
  const [drawRows, waiverRows, retainageRows, paymentAgg] = await Promise.all([
    db
      .select({
        id: drawRequests.id,
        projectId: drawRequests.projectId,
        drawNumber: drawRequests.drawNumber,
        drawRequestStatus: drawRequests.drawRequestStatus,
        currentPaymentDueCents: drawRequests.currentPaymentDueCents,
        paymentReferenceName: drawRequests.paymentReferenceName,
        createdByUserId: drawRequests.createdByUserId,
        periodFrom: drawRequests.periodFrom,
        periodTo: drawRequests.periodTo,
        submittedAt: drawRequests.submittedAt,
        reviewedAt: drawRequests.reviewedAt,
        paidAt: drawRequests.paidAt,
      })
      .from(drawRequests)
      .where(inArray(drawRequests.projectId, projectIds)),
    // Contractor reading every sub's waivers across their projects —
    // multi-org policy clause B (project ownership) authorises.
    withTenant(orgId, (tx) =>
      tx
        .select({
          id: lienWaivers.id,
          projectId: lienWaivers.projectId,
          drawRequestId: lienWaivers.drawRequestId,
          organizationId: lienWaivers.organizationId,
          lienWaiverType: lienWaivers.lienWaiverType,
          lienWaiverStatus: lienWaivers.lienWaiverStatus,
          amountCents: lienWaivers.amountCents,
          throughDate: lienWaivers.throughDate,
          requestedAt: lienWaivers.requestedAt,
          submittedAt: lienWaivers.submittedAt,
          acceptedAt: lienWaivers.acceptedAt,
        })
        .from(lienWaivers)
        .where(inArray(lienWaivers.projectId, projectIds)),
    ),
    db
      .select({
        projectId: retainageReleases.projectId,
        totalRetainageHeldCents: retainageReleases.totalRetainageHeldCents,
        releaseStatus: retainageReleases.releaseStatus,
      })
      .from(retainageReleases)
      .where(inArray(retainageReleases.projectId, projectIds)),
    withTenant(orgId, (tx) =>
      tx
        .select({
          relatedEntityId: paymentTransactions.relatedEntityId,
          paymentMethodType: paymentTransactions.paymentMethodType,
          transactionStatus: paymentTransactions.transactionStatus,
          grossAmountCents: paymentTransactions.grossAmountCents,
        })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.organizationId, orgId),
            eq(paymentTransactions.relatedEntityType, "draw_request"),
          ),
        ),
    ),
  ]);

  // Aggregate paid-sum and payment-method per draw from payment_transactions.
  const paidSumByDrawId = new Map<string, number>();
  const methodByDrawId = new Map<string, string>();
  for (const tx of paymentAgg) {
    if (tx.transactionStatus === "succeeded") {
      paidSumByDrawId.set(
        tx.relatedEntityId,
        (paidSumByDrawId.get(tx.relatedEntityId) ?? 0) + tx.grossAmountCents,
      );
    }
    // Remember the most-recent method seen. A draw with multiple split
    // payments picks the latest — the aggregate sums across all of them.
    if (!methodByDrawId.has(tx.relatedEntityId)) {
      methodByDrawId.set(tx.relatedEntityId, tx.paymentMethodType);
    }
  }

  // User-name enrichment for inbound
  const createdByIds = Array.from(
    new Set(
      drawRows.map((d) => d.createdByUserId).filter((v): v is string => !!v),
    ),
  );
  const subOrgIds = Array.from(
    new Set(
      waiverRows.map((w) => w.organizationId).filter((v): v is string => !!v),
    ),
  );
  const [userRows, subOrgRows] = await Promise.all([
    createdByIds.length > 0
      ? db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, createdByIds))
      : Promise.resolve([] as Array<{ id: string; displayName: string | null }>),
    subOrgIds.length > 0
      ? db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, subOrgIds))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ]);
  const userNameById = new Map(userRows.map((u) => [u.id, u.displayName]));
  const subOrgNameById = new Map(subOrgRows.map((o) => [o.id, o.name]));

  // Draw number index for outbound row enrichment.
  const drawNumberById = new Map(
    drawRows.map((d) => [d.id, d.drawNumber] as const),
  );

  // --- Inbound rows ---------------------------------------------------
  const inboundRows: InboundRow[] = drawRows.map((d) => {
    const paidSum = paidSumByDrawId.get(d.id) ?? 0;
    const effectiveStatus = deriveInboundEffectiveStatus({
      rawStatus: d.drawRequestStatus,
      paidAt: d.paidAt,
      reviewedAt: d.reviewedAt,
      submittedAt: d.submittedAt,
      paidSumCents: paidSum,
      currentPaymentDueCents: d.currentPaymentDueCents,
      nowMs: now,
    });
    const payableAt = derivePayableAt(d.drawRequestStatus, d.reviewedAt, d.submittedAt);
    const agingDays =
      payableAt && !d.paidAt
        ? Math.floor((now - payableAt.getTime()) / 86_400_000)
        : null;
    return {
      id: d.id,
      projectId: d.projectId,
      projectName: projectNameById.get(d.projectId) ?? "Unknown project",
      drawNumber: d.drawNumber,
      rawStatus: d.drawRequestStatus,
      effectiveStatus,
      currentPaymentDueCents: d.currentPaymentDueCents,
      paidSumCents: paidSum,
      paymentMethod: methodByDrawId.get(d.id) ?? null,
      paymentReferenceName: d.paymentReferenceName,
      createdByName: d.createdByUserId
        ? userNameById.get(d.createdByUserId) ?? null
        : null,
      periodFrom: d.periodFrom,
      periodTo: d.periodTo,
      submittedAt: d.submittedAt,
      reviewedAt: d.reviewedAt,
      paidAt: d.paidAt,
      agingDays,
    };
  });

  // Sort: delinquent first, then by aging desc; paid rows last.
  const statusRank: Record<InboundEffectiveStatus, number> = {
    delinquent: 0,
    partially_paid: 1,
    approved: 2,
    approved_with_note: 2,
    under_review: 3,
    ready_for_review: 3,
    submitted: 3,
    returned: 4,
    revised: 4,
    draft: 5,
    paid: 6,
    closed: 7,
  };
  inboundRows.sort((a, b) => {
    const dr = statusRank[a.effectiveStatus] - statusRank[b.effectiveStatus];
    if (dr !== 0) return dr;
    return (b.agingDays ?? 0) - (a.agingDays ?? 0);
  });

  // --- Outbound rows --------------------------------------------------
  const outboundRows: OutboundRow[] = waiverRows.map((w) => {
    const ageAnchor = w.submittedAt ?? w.requestedAt;
    return {
      id: w.id,
      projectId: w.projectId,
      projectName: projectNameById.get(w.projectId) ?? "Unknown project",
      drawRequestId: w.drawRequestId,
      drawNumber: drawNumberById.get(w.drawRequestId) ?? 0,
      subOrganizationName: subOrgNameById.get(w.organizationId) ?? null,
      lienWaiverType: w.lienWaiverType,
      lienWaiverStatus: w.lienWaiverStatus,
      amountCents: w.amountCents,
      throughDate: w.throughDate,
      requestedAt: w.requestedAt,
      submittedAt: w.submittedAt,
      acceptedAt: w.acceptedAt,
      ageDays: ageAnchor
        ? Math.floor((now - ageAnchor.getTime()) / 86_400_000)
        : null,
    };
  });
  outboundRows.sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

  // --- Totals ---------------------------------------------------------
  const inboundTotals = computeInboundTotals(inboundRows);
  const outboundTotals = computeOutboundTotals(outboundRows, retainageRows);

  // --- Project options ------------------------------------------------
  // Show only projects that have at least one draw or waiver so the
  // dropdown stays short.
  const activeProjectIds = new Set<string>([
    ...inboundRows.map((r) => r.projectId),
    ...outboundRows.map((r) => r.projectId),
  ]);
  const projectOptions = projectRows
    .filter((p) => activeProjectIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    context,
    inbound: { rows: inboundRows, totals: inboundTotals },
    outbound: { rows: outboundRows, totals: outboundTotals },
    projectOptions,
    generatedAtMs: now,
  };
}

// --------------------------------------------------------------------------
// Reports-page summary — reuses the full loader, strips detail rows
// --------------------------------------------------------------------------

export async function getPaymentTrackingReport(
  input: LoaderInput,
): Promise<PaymentTrackingReportSummary> {
  const view = await getContractorCrossProjectPayments(input);

  // Aggregate delinquency by project for the top-offenders strip.
  const byProject = new Map<
    string,
    { projectId: string; projectName: string; count: number; outstanding: number }
  >();
  for (const r of view.inbound.rows) {
    if (r.effectiveStatus !== "delinquent") continue;
    const entry = byProject.get(r.projectId) ?? {
      projectId: r.projectId,
      projectName: r.projectName,
      count: 0,
      outstanding: 0,
    };
    entry.count += 1;
    entry.outstanding += r.currentPaymentDueCents - r.paidSumCents;
    byProject.set(r.projectId, entry);
  }
  const topDelinquentProjects = Array.from(byProject.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5)
    .map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      delinquentCount: p.count,
      delinquentOutstandingCents: p.outstanding,
    }));

  return {
    generatedAtMs: view.generatedAtMs,
    inbound: view.inbound.totals,
    outbound: view.outbound.totals,
    topDelinquentProjects,
  };
}

// --------------------------------------------------------------------------
// Derivation helpers
// --------------------------------------------------------------------------

function derivePayableAt(
  status: string,
  reviewedAt: Date | null,
  submittedAt: Date | null,
): Date | null {
  // Only approved statuses owe money. Use the approval transition
  // (reviewedAt for approved/approved_with_note); fall back to
  // submittedAt only if reviewedAt is missing for some reason.
  if (!(APPROVED_DRAW_STATUSES as readonly string[]).includes(status)) {
    return null;
  }
  return reviewedAt ?? submittedAt;
}

export function isDelinquent(args: {
  status: string;
  paidAt: Date | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  nowMs: number;
}): boolean {
  if (!(APPROVED_DRAW_STATUSES as readonly string[]).includes(args.status)) {
    return false;
  }
  if (args.paidAt) return false;
  const payableAt = derivePayableAt(args.status, args.reviewedAt, args.submittedAt);
  if (!payableAt) return false;
  return args.nowMs - payableAt.getTime() > DELINQUENT_AFTER_DAYS * 86_400_000;
}

export function isPartiallyPaid(paidSumCents: number, dueCents: number): boolean {
  // sum === 0 is "approved unpaid" (caught by delinquent or by raw status);
  // sum >= due is "paid" (reconciled downstream). Only the (0, due) open
  // interval is the real partially-paid signal.
  return paidSumCents > 0 && paidSumCents < dueCents;
}

function deriveInboundEffectiveStatus(args: {
  rawStatus: string;
  paidAt: Date | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  paidSumCents: number;
  currentPaymentDueCents: number;
  nowMs: number;
}): InboundEffectiveStatus {
  // Delinquent wins over everything else when it applies. Next check
  // partial-paid before falling back to the raw status; the raw enum is
  // still the display truth for draft/submitted/returned/closed states.
  if (
    isDelinquent({
      status: args.rawStatus,
      paidAt: args.paidAt,
      reviewedAt: args.reviewedAt,
      submittedAt: args.submittedAt,
      nowMs: args.nowMs,
    })
  ) {
    return "delinquent";
  }
  if (
    (APPROVED_DRAW_STATUSES as readonly string[]).includes(args.rawStatus) &&
    !args.paidAt &&
    isPartiallyPaid(args.paidSumCents, args.currentPaymentDueCents)
  ) {
    return "partially_paid";
  }
  return args.rawStatus as InboundEffectiveStatus;
}

function computeInboundTotals(rows: InboundRow[]): InboundTotals {
  let totalOutstanding = 0;
  let totalPaid = 0;
  let delinquent = 0;
  let partial = 0;
  for (const r of rows) {
    totalPaid += r.paidSumCents;
    if (!r.paidAt) {
      totalOutstanding += Math.max(0, r.currentPaymentDueCents - r.paidSumCents);
    }
    if (r.effectiveStatus === "delinquent") delinquent += 1;
    if (r.effectiveStatus === "partially_paid") partial += 1;
  }
  return {
    totalDraws: rows.length,
    totalOutstandingCents: totalOutstanding,
    totalPaidCents: totalPaid,
    delinquentCount: delinquent,
    partiallyPaidCount: partial,
  };
}

function computeOutboundTotals(
  rows: OutboundRow[],
  retainageRows: Array<{
    projectId: string;
    totalRetainageHeldCents: number;
    releaseStatus: string;
  }>,
): OutboundTotals {
  let amount = 0;
  let pending = 0;
  for (const r of rows) {
    amount += r.amountCents;
    if (r.lienWaiverStatus === "requested" || r.lienWaiverStatus === "submitted") {
      pending += 1;
    }
  }
  // Retainage "held" = rows whose release_status is still "held". Each row
  // carries the project-level held total at the time of the release
  // request; pick the latest per project (max).
  const heldByProject = new Map<string, number>();
  for (const r of retainageRows) {
    if (r.releaseStatus !== "held") continue;
    const current = heldByProject.get(r.projectId) ?? 0;
    if (r.totalRetainageHeldCents > current) {
      heldByProject.set(r.projectId, r.totalRetainageHeldCents);
    }
  }
  let totalRetainageHeld = 0;
  for (const v of heldByProject.values()) totalRetainageHeld += v;

  return {
    totalWaivers: rows.length,
    totalAmountCents: amount,
    pendingWaiverCount: pending,
    totalRetainageHeldCents: totalRetainageHeld,
  };
}

function emptyInboundTotals(): InboundTotals {
  return {
    totalDraws: 0,
    totalOutstandingCents: 0,
    totalPaidCents: 0,
    delinquentCount: 0,
    partiallyPaidCount: 0,
  };
}

function emptyOutboundTotals(): OutboundTotals {
  return {
    totalWaivers: 0,
    totalAmountCents: 0,
    pendingWaiverCount: 0,
    totalRetainageHeldCents: 0,
  };
}

