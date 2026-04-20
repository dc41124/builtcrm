import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  drawRequests,
  organizations,
  paymentTransactions,
  projectOrganizationMemberships,
  projects,
} from "@/db/schema";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// AR Aging loader (Step 24.5 wiring).
//
// Groups unpaid draw balances by client organization and days-past-due
// bucket. "Days past due" is measured against a derived due date:
//   reviewedAt + 30d  — the standard net-30 from approval
//   submittedAt + 45d — covers the review cycle when no review date is set
// Draws without a submittedAt (drafts) don't contribute to AR.
//
// Payment progress uses payment_transactions (succeeded rows, per draw),
// matching the pattern in cross-project-payments.ts so "current payment
// due minus paid sum" reflects actual partial payments.
//
// Trend: 8 weekly snapshots ending at now. Each point is the total
// outstanding AR as-of that week's end — draws reviewed before the week
// end that weren't yet paid by it.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type ARBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90p";

export type ARClientRow = {
  clientOrganizationId: string;
  clientName: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90p: number;
  totalCents: number;
};

export type ARReportView = {
  rows: ARClientRow[];
  totalsByBucket: Record<ARBucket, number>;
  totalCents: number;
  pastDueCents: number;
  // 8 weekly "as-of" snapshots of total outstanding AR in cents,
  // oldest-first. The last value equals the current total.
  trendCents: number[];
  generatedAtIso: string;
};

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

// Draws that can plausibly owe money. Exclude `draft` (nothing owed yet)
// and `closed` (already settled). Paid draws are filtered by outstanding
// balance, not status, so `paid` is retained — a paid draw with a refund
// still has zero outstanding.
const AR_DRAW_STATUSES = [
  "submitted",
  "under_review",
  "ready_for_review",
  "approved",
  "approved_with_note",
  "revised",
  "returned",
  "paid",
] as const;

const DAYS_REVIEW_TO_DUE = 30;
const DAYS_SUBMIT_TO_DUE = 45;
const DAY_MS = 86_400_000;
const TREND_WEEKS = 8;

// ---------------------------------------------------------------
// Loader
// ---------------------------------------------------------------

type LoaderInput = { session: SessionLike | null | undefined };

export async function getARReport(input: LoaderInput): Promise<ARReportView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) return emptyView(now);

  const [drawRows, paymentTxRows, clientRows] = await Promise.all([
    db
      .select({
        id: drawRequests.id,
        projectId: drawRequests.projectId,
        status: drawRequests.drawRequestStatus,
        currentPaymentDueCents: drawRequests.currentPaymentDueCents,
        submittedAt: drawRequests.submittedAt,
        reviewedAt: drawRequests.reviewedAt,
        paidAt: drawRequests.paidAt,
      })
      .from(drawRequests)
      .where(
        and(
          inArray(drawRequests.projectId, projectIds),
          inArray(drawRequests.drawRequestStatus, [...AR_DRAW_STATUSES]),
        ),
      ),
    db
      .select({
        relatedEntityId: paymentTransactions.relatedEntityId,
        grossAmountCents: paymentTransactions.grossAmountCents,
        status: paymentTransactions.transactionStatus,
        succeededAt: paymentTransactions.succeededAt,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.organizationId, orgId),
          eq(paymentTransactions.relatedEntityType, "draw_request"),
        ),
      ),
    db
      .select({
        projectId: projectOrganizationMemberships.projectId,
        clientOrganizationId: organizations.id,
        clientName: organizations.name,
      })
      .from(projectOrganizationMemberships)
      .innerJoin(
        organizations,
        eq(projectOrganizationMemberships.organizationId, organizations.id),
      )
      .where(
        and(
          inArray(projectOrganizationMemberships.projectId, projectIds),
          eq(projectOrganizationMemberships.membershipType, "client"),
          eq(projectOrganizationMemberships.membershipStatus, "active"),
        ),
      ),
  ]);

  // paid-sum per draw (only succeeded payments)
  const paidSumByDrawId = new Map<string, number>();
  for (const tx of paymentTxRows) {
    if (tx.status !== "succeeded") continue;
    paidSumByDrawId.set(
      tx.relatedEntityId,
      (paidSumByDrawId.get(tx.relatedEntityId) ?? 0) + tx.grossAmountCents,
    );
  }

  // First active client per project wins — a project should only have one.
  const clientByProject = new Map<
    string,
    { id: string; name: string }
  >();
  for (const row of clientRows) {
    if (!clientByProject.has(row.projectId)) {
      clientByProject.set(row.projectId, {
        id: row.clientOrganizationId,
        name: row.clientName,
      });
    }
  }

  // --- Current-as-of-now bucketing ---
  const clientBuckets = new Map<
    string,
    { name: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90p: number }
  >();

  for (const d of drawRows) {
    if (d.paidAt) continue;
    const paid = paidSumByDrawId.get(d.id) ?? 0;
    const outstanding = d.currentPaymentDueCents - paid;
    if (outstanding <= 0) continue;
    const dueAt = deriveDueDate(d.reviewedAt, d.submittedAt);
    if (!dueAt) continue;
    const daysPastDue = Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS);
    const bucket = bucketForDaysPastDue(daysPastDue);

    const client = clientByProject.get(d.projectId);
    const key = client?.id ?? d.projectId; // fallback for projects without a client org
    const name = client?.name ?? "Unassigned client";
    const entry = clientBuckets.get(key) ?? {
      name,
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90p: 0,
    };
    entry[bucket] += outstanding;
    clientBuckets.set(key, entry);
  }

  const rows: ARClientRow[] = Array.from(clientBuckets.entries())
    .map(([clientOrganizationId, b]) => ({
      clientOrganizationId,
      clientName: b.name,
      current: b.current,
      d1_30: b.d1_30,
      d31_60: b.d31_60,
      d61_90: b.d61_90,
      d90p: b.d90p,
      totalCents: b.current + b.d1_30 + b.d31_60 + b.d61_90 + b.d90p,
    }))
    .filter((r) => r.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents);

  const totalsByBucket: Record<ARBucket, number> = {
    current: rows.reduce((s, r) => s + r.current, 0),
    d1_30: rows.reduce((s, r) => s + r.d1_30, 0),
    d31_60: rows.reduce((s, r) => s + r.d31_60, 0),
    d61_90: rows.reduce((s, r) => s + r.d61_90, 0),
    d90p: rows.reduce((s, r) => s + r.d90p, 0),
  };
  const totalCents = rows.reduce((s, r) => s + r.totalCents, 0);
  const pastDueCents = totalCents - totalsByBucket.current;

  // --- 8-week trend: outstanding as-of each week end ---
  const trendCents: number[] = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const asOf = new Date(now.getTime() - i * 7 * DAY_MS);
    let snapshot = 0;
    for (const d of drawRows) {
      if (!d.reviewedAt && !d.submittedAt) continue;
      const dueAt = deriveDueDate(d.reviewedAt, d.submittedAt);
      if (!dueAt) continue;
      // The draw only contributes to this week's AR if it had been
      // submitted/reviewed before the snapshot (otherwise it didn't exist
      // as AR yet) and hadn't been paid by then.
      const anchor = d.reviewedAt ?? d.submittedAt!;
      if (anchor.getTime() > asOf.getTime()) continue;
      if (d.paidAt && d.paidAt.getTime() <= asOf.getTime()) continue;
      // Paid-sum as-of the snapshot (only succeeded txs that settled by then).
      const paidAsOf = paymentTxRows
        .filter(
          (t) =>
            t.relatedEntityId === d.id &&
            t.status === "succeeded" &&
            (!t.succeededAt || t.succeededAt.getTime() <= asOf.getTime()),
        )
        .reduce((s, t) => s + t.grossAmountCents, 0);
      const outstanding = d.currentPaymentDueCents - paidAsOf;
      if (outstanding > 0) snapshot += outstanding;
    }
    trendCents.push(snapshot);
  }

  return {
    rows,
    totalsByBucket,
    totalCents,
    pastDueCents,
    trendCents,
    generatedAtIso: now.toISOString(),
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function deriveDueDate(
  reviewedAt: Date | null,
  submittedAt: Date | null,
): Date | null {
  if (reviewedAt) {
    return new Date(reviewedAt.getTime() + DAYS_REVIEW_TO_DUE * DAY_MS);
  }
  if (submittedAt) {
    return new Date(submittedAt.getTime() + DAYS_SUBMIT_TO_DUE * DAY_MS);
  }
  return null;
}

function bucketForDaysPastDue(days: number): ARBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90p";
}

function emptyView(now: Date): ARReportView {
  return {
    rows: [],
    totalsByBucket: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 },
    totalCents: 0,
    pastDueCents: 0,
    trendCents: Array(TREND_WEEKS).fill(0),
    generatedAtIso: now.toISOString(),
  };
}
