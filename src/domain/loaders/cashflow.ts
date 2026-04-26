import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import {
  drawRequests,
  lienWaivers,
  milestones,
  paymentTransactions,
  projects,
  purchaseOrderLines,
  purchaseOrders,
  retainageReleases,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// Cashflow projection loader (Step 24.5 wiring).
//
// Produces a 12-week forward view of inflows, outflows, and running balance
// from BuiltCRM-tracked activity only. "Starting balance" is the contractor's
// recorded cash position derived from received draw payments minus accepted
// lien waivers — a proxy for actual cash, not a bank-connected figure. The
// projection never claims to cover off-platform activity (bank interest,
// overhead, payroll outside daily logs); it's bounded to the AR/AP signal
// the system already has.
//
// Bucketing rule: events land in the week their expected date falls in;
// anything already overdue lands in week 0 so it doesn't vanish. Weeks are
// ISO-week-aligned (Monday start, UTC) to match finance team conventions.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type CashflowWeek = {
  weekIso: string;          // "W17"
  weekStartIso: string;     // Monday 00:00 UTC as ISO string
  weekLabel: string;        // "Apr 20"
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  balanceCents: number;
};

export type CashflowProjection = {
  startingBalanceCents: number;
  weeks: CashflowWeek[];
  totals: {
    totalInflowCents: number;
    totalOutflowCents: number;
    endBalanceCents: number;
    minBalanceCents: number;
    minBalanceWeekIso: string | null;
  };
  generatedAtIso: string;
};

// ---------------------------------------------------------------
// Tuning constants — keep here so future calibration is localized.
// ---------------------------------------------------------------

// Standard net-30 from review. If a draw has been reviewed but not paid,
// expect payment ~30 days out. If not yet reviewed, add another 15 days
// for the review cycle (45d from submit).
const DAYS_REVIEW_TO_PAY = 30;
const DAYS_SUBMIT_TO_REVIEW = 15;

// Sub payments follow lien waiver issuance by about a week in practice.
const DAYS_WAIVER_TO_PAY = 7;

// Horizon length in weeks.
const WEEKS_HORIZON = 12;

const DAY_MS = 86_400_000;

// Draw statuses that represent "cash expected but not yet received".
const INFLOW_DRAW_STATUSES = [
  "submitted",
  "under_review",
  "ready_for_review",
  "approved",
  "approved_with_note",
  "revised",
] as const;

// POs with cash yet to go out. `invoiced`/`closed` are already spent;
// `draft`/`cancelled` are not yet committed (draft) or voided.
const OUTFLOW_PO_STATUSES = [
  "issued",
  "revised",
  "partially_received",
  "fully_received",
] as const;

// Retainage releases that are still going to pay out. `held` is not yet
// scheduled; consumed entries have been rolled into a draw and counted there.
const OUTFLOW_RETAINAGE_STATUSES = [
  "release_requested",
  "approved",
] as const;

// Lien waivers with cash still owed to the sub. `accepted` counts toward
// starting balance; `rejected`/`waived` never pay.
const OUTFLOW_WAIVER_STATUSES = ["requested", "submitted"] as const;

// ---------------------------------------------------------------
// Loader
// ---------------------------------------------------------------

type LoaderInput = { session: SessionLike | null | undefined };

export async function getCashflowProjection(
  input: LoaderInput,
): Promise<CashflowProjection> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();
  const weekStarts = buildWeekStarts(now, WEEKS_HORIZON);

  // ---- Project ids for the contractor ----
  // The caller `getContractorReportsData` already loads this, but we re-query
  // here so the loader can be called standalone and stays self-contained.
  const projectIdRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));

  const projectIds = projectIdRows.map((r) => r.id);
  if (projectIds.length === 0) {
    return emptyProjection(now, weekStarts);
  }

  // ---- Parallel slice queries ----
  const [
    drawRows,
    paymentTxRows,
    poRows,
    poLineRows,
    waiverRows,
    retainageRows,
  ] = await Promise.all([
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
      .where(inArray(drawRequests.projectId, projectIds)),
    db
      .select({
        relatedEntityId: paymentTransactions.relatedEntityId,
        grossAmountCents: paymentTransactions.grossAmountCents,
        status: paymentTransactions.transactionStatus,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.organizationId, orgId),
          eq(paymentTransactions.relatedEntityType, "draw_request"),
        ),
      ),
    withTenant(orgId, (tx) =>
      tx
        .select({
          id: purchaseOrders.id,
          status: purchaseOrders.status,
          expectedDeliveryAt: purchaseOrders.expectedDeliveryAt,
          orderedAt: purchaseOrders.orderedAt,
        })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            inArray(purchaseOrders.projectId, projectIds),
            inArray(purchaseOrders.status, [...OUTFLOW_PO_STATUSES]),
          ),
        ),
    ),
    // Filtered via innerJoin so we never fetch lines outside the
    // contractor's open-PO set. Keeps the line pull tight for large
    // orgs. The join target purchaseOrders is RLS-enabled so the
    // wrapper sets the GUC.
    withTenant(orgId, (tx) =>
      tx
        .select({
          purchaseOrderId: purchaseOrderLines.purchaseOrderId,
          quantity: purchaseOrderLines.quantity,
          unitCostCents: purchaseOrderLines.unitCostCents,
          receivedQuantity: purchaseOrderLines.receivedQuantity,
        })
        .from(purchaseOrderLines)
        .innerJoin(
          purchaseOrders,
          eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id),
        )
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            inArray(purchaseOrders.projectId, projectIds),
            inArray(purchaseOrders.status, [...OUTFLOW_PO_STATUSES]),
          ),
        ),
    ),
    withTenant(orgId, (tx) =>
      tx
        .select({
          id: lienWaivers.id,
          status: lienWaivers.lienWaiverStatus,
          amountCents: lienWaivers.amountCents,
          requestedAt: lienWaivers.requestedAt,
          submittedAt: lienWaivers.submittedAt,
          acceptedAt: lienWaivers.acceptedAt,
        })
        .from(lienWaivers)
        .where(inArray(lienWaivers.projectId, projectIds)),
    ),
    db
      .select({
        id: retainageReleases.id,
        status: retainageReleases.releaseStatus,
        releaseAmountCents: retainageReleases.releaseAmountCents,
        scheduledReleaseAt: retainageReleases.scheduledReleaseAt,
        releaseTriggerMilestoneId: retainageReleases.releaseTriggerMilestoneId,
        consumedByDrawRequestId: retainageReleases.consumedByDrawRequestId,
      })
      .from(retainageReleases)
      .where(inArray(retainageReleases.projectId, projectIds)),
  ]);

  // ---- Starting balance ----
  // "Cash-in-from-draws-paid" minus "cash-out-from-subs-accepted".
  const paidFromDrawsCents = paymentTxRows.reduce(
    (sum, r) => (r.status === "succeeded" ? sum + r.grossAmountCents : sum),
    0,
  );
  const paidToSubsCents = waiverRows.reduce(
    (sum, w) =>
      w.status === "accepted" && w.acceptedAt && w.acceptedAt <= now
        ? sum + w.amountCents
        : sum,
    0,
  );
  const startingBalanceCents = paidFromDrawsCents - paidToSubsCents;

  // ---- paidSum per draw (same pattern as cross-project-payments) ----
  const paidSumByDrawId = new Map<string, number>();
  for (const tx of paymentTxRows) {
    if (tx.status !== "succeeded") continue;
    paidSumByDrawId.set(
      tx.relatedEntityId,
      (paidSumByDrawId.get(tx.relatedEntityId) ?? 0) + tx.grossAmountCents,
    );
  }

  // ---- Milestones referenced by retainage releases (for scheduled dates) ----
  const milestoneIds = Array.from(
    new Set(
      retainageRows
        .map((r) => r.releaseTriggerMilestoneId)
        .filter((v): v is string => !!v),
    ),
  );
  const milestoneDateById = new Map<string, Date>();
  if (milestoneIds.length > 0) {
    const msRows = await db
      .select({ id: milestones.id, scheduledDate: milestones.scheduledDate })
      .from(milestones)
      .where(
        and(
          inArray(milestones.id, milestoneIds),
          isNotNull(milestones.scheduledDate),
        ),
      );
    for (const m of msRows) {
      if (m.scheduledDate) milestoneDateById.set(m.id, m.scheduledDate);
    }
  }

  // ---- Bucket events into weeks ----
  const bucket = weekStarts.map(() => ({ inflow: 0, outflow: 0 }));
  const horizonEndMs =
    weekStarts[weekStarts.length - 1].getTime() + 7 * DAY_MS;

  // Inflows: pending draws
  for (const d of drawRows) {
    if (!(INFLOW_DRAW_STATUSES as readonly string[]).includes(d.status)) continue;
    if (d.paidAt) continue;
    const paid = paidSumByDrawId.get(d.id) ?? 0;
    const outstanding = d.currentPaymentDueCents - paid;
    if (outstanding <= 0) continue;
    const expectedAt = expectedDrawPayDate(d.submittedAt, d.reviewedAt);
    if (!expectedAt) continue;
    const idx = bucketIndex(expectedAt, weekStarts, horizonEndMs);
    if (idx == null) continue;
    bucket[idx].inflow += outstanding;
  }

  // Outflows: open POs
  const poLinesByPoId = new Map<string, typeof poLineRows>();
  for (const line of poLineRows) {
    const list = poLinesByPoId.get(line.purchaseOrderId) ?? [];
    list.push(line);
    poLinesByPoId.set(line.purchaseOrderId, list);
  }
  for (const po of poRows) {
    const lines = poLinesByPoId.get(po.id) ?? [];
    const outstanding = lines.reduce((sum, l) => {
      const qty = Number.parseFloat(l.quantity);
      const received = Number.parseFloat(l.receivedQuantity);
      const remainingQty = Math.max(0, qty - received);
      return sum + Math.round(remainingQty * l.unitCostCents);
    }, 0);
    if (outstanding <= 0) continue;
    const expectedAt = po.expectedDeliveryAt ?? po.orderedAt;
    if (!expectedAt) continue;
    const idx = bucketIndex(expectedAt, weekStarts, horizonEndMs);
    if (idx == null) continue;
    bucket[idx].outflow += outstanding;
  }

  // Outflows: pending lien waivers
  for (const w of waiverRows) {
    if (!(OUTFLOW_WAIVER_STATUSES as readonly string[]).includes(w.status)) continue;
    const anchor = w.submittedAt ?? w.requestedAt;
    if (!anchor) continue;
    const expectedAt = new Date(anchor.getTime() + DAYS_WAIVER_TO_PAY * DAY_MS);
    const idx = bucketIndex(expectedAt, weekStarts, horizonEndMs);
    if (idx == null) continue;
    bucket[idx].outflow += w.amountCents;
  }

  // Outflows: scheduled retainage releases
  for (const r of retainageRows) {
    if (!(OUTFLOW_RETAINAGE_STATUSES as readonly string[]).includes(r.status))
      continue;
    if (r.consumedByDrawRequestId) continue;
    const expectedAt = r.releaseTriggerMilestoneId
      ? milestoneDateById.get(r.releaseTriggerMilestoneId) ?? r.scheduledReleaseAt
      : r.scheduledReleaseAt;
    if (!expectedAt) continue;
    const idx = bucketIndex(expectedAt, weekStarts, horizonEndMs);
    if (idx == null) continue;
    bucket[idx].outflow += r.releaseAmountCents;
  }

  // ---- Running balance + totals ----
  let runningBalance = startingBalanceCents;
  let totalInflow = 0;
  let totalOutflow = 0;
  let minBalance = runningBalance;
  let minBalanceWeekIso: string | null = null;

  const weeks: CashflowWeek[] = weekStarts.map((ws, i) => {
    const inflow = bucket[i].inflow;
    const outflow = bucket[i].outflow;
    const net = inflow - outflow;
    runningBalance += net;
    totalInflow += inflow;
    totalOutflow += outflow;
    const iso = isoWeekLabel(ws);
    if (runningBalance < minBalance) {
      minBalance = runningBalance;
      minBalanceWeekIso = iso;
    }
    return {
      weekIso: iso,
      weekStartIso: ws.toISOString(),
      weekLabel: shortDateLabel(ws),
      inflowCents: inflow,
      outflowCents: outflow,
      netCents: net,
      balanceCents: runningBalance,
    };
  });

  return {
    startingBalanceCents,
    weeks,
    totals: {
      totalInflowCents: totalInflow,
      totalOutflowCents: totalOutflow,
      endBalanceCents: runningBalance,
      minBalanceCents: minBalance,
      minBalanceWeekIso,
    },
    generatedAtIso: now.toISOString(),
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function buildWeekStarts(now: Date, count: number): Date[] {
  const monday = mondayOf(now);
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(monday.getTime() + i * 7 * DAY_MS));
  }
  return out;
}

function mondayOf(d: Date): Date {
  const utc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = utc.getUTCDay(); // 0 = Sunday, 1 = Monday
  const delta = dow === 0 ? -6 : 1 - dow;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc;
}

function bucketIndex(
  when: Date,
  weekStarts: Date[],
  horizonEndMs: number,
): number | null {
  const t = when.getTime();
  // Overdue items land in week 0.
  if (t < weekStarts[0].getTime()) return 0;
  if (t >= horizonEndMs) return null;
  for (let i = weekStarts.length - 1; i >= 0; i--) {
    if (t >= weekStarts[i].getTime()) return i;
  }
  return 0;
}

function expectedDrawPayDate(
  submittedAt: Date | null,
  reviewedAt: Date | null,
): Date | null {
  if (reviewedAt) {
    return new Date(reviewedAt.getTime() + DAYS_REVIEW_TO_PAY * DAY_MS);
  }
  if (submittedAt) {
    return new Date(
      submittedAt.getTime() +
        (DAYS_SUBMIT_TO_REVIEW + DAYS_REVIEW_TO_PAY) * DAY_MS,
    );
  }
  return null;
}

function isoWeekLabel(d: Date): string {
  // Standard ISO-8601 week-of-year. Thursday of the week determines which
  // calendar year the week belongs to, so the week falls where finance
  // teams expect (matches Excel's WEEKNUM with return_type=21).
  const target = new Date(d.getTime());
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
  );
  return `W${weekNo}`;
}

function shortDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function emptyProjection(now: Date, weekStarts: Date[]): CashflowProjection {
  const weeks = weekStarts.map((ws) => ({
    weekIso: isoWeekLabel(ws),
    weekStartIso: ws.toISOString(),
    weekLabel: shortDateLabel(ws),
    inflowCents: 0,
    outflowCents: 0,
    netCents: 0,
    balanceCents: 0,
  }));
  return {
    startingBalanceCents: 0,
    weeks,
    totals: {
      totalInflowCents: 0,
      totalOutflowCents: 0,
      endBalanceCents: 0,
      minBalanceCents: 0,
      minBalanceWeekIso: null,
    },
    generatedAtIso: now.toISOString(),
  };
}
