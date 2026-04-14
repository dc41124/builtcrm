import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { drawLineItems, drawRequests } from "@/db/schema";
import type { DB } from "@/db/client";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const PRIOR_COUNTED_STATUSES = [
  "approved",
  "approved_with_note",
  "paid",
  "closed",
] as const;

const PREVIOUS_CERTIFICATES_STATUSES = [
  "approved",
  "approved_with_note",
  "paid",
  "closed",
] as const;

export function computeLineFields(input: {
  workCompletedPreviousCents: number;
  workCompletedThisPeriodCents: number;
  materialsPresentlyStoredCents: number;
  scheduledValueCents: number;
  retainagePercentApplied: number;
}): {
  totalCompletedStoredToDateCents: number;
  percentCompleteBasisPoints: number;
  balanceToFinishCents: number;
  retainageCents: number;
} {
  const total =
    input.workCompletedPreviousCents +
    input.workCompletedThisPeriodCents +
    input.materialsPresentlyStoredCents;
  const balance = Math.max(0, input.scheduledValueCents - total);
  const pct =
    input.scheduledValueCents > 0
      ? Math.round((total / input.scheduledValueCents) * 10000)
      : 0;
  const retainage = Math.round((total * input.retainagePercentApplied) / 100);
  return {
    totalCompletedStoredToDateCents: total,
    percentCompleteBasisPoints: pct,
    balanceToFinishCents: balance,
    retainageCents: retainage,
  };
}

// Look up the most recent cumulative installed-work value for a given SOV line
// from prior non-draft draws on the same project. Materials stored are not
// carried forward — they roll into installed work as the next period begins.
export async function loadPreviousPeriodMap(
  tx: Tx,
  projectId: string,
  currentDrawNumber: number,
): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      sovLineItemId: drawLineItems.sovLineItemId,
      drawNumber: drawRequests.drawNumber,
      workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
      workCompletedThisPeriodCents: drawLineItems.workCompletedThisPeriodCents,
    })
    .from(drawLineItems)
    .innerJoin(drawRequests, eq(drawRequests.id, drawLineItems.drawRequestId))
    .where(
      and(
        eq(drawRequests.projectId, projectId),
        lt(drawRequests.drawNumber, currentDrawNumber),
        inArray(drawRequests.drawRequestStatus, [...PRIOR_COUNTED_STATUSES]),
      ),
    );

  const latest = new Map<string, { drawNumber: number; cumulative: number }>();
  for (const r of rows) {
    const cumulative =
      r.workCompletedPreviousCents + r.workCompletedThisPeriodCents;
    const prev = latest.get(r.sovLineItemId);
    if (!prev || r.drawNumber > prev.drawNumber) {
      latest.set(r.sovLineItemId, { drawNumber: r.drawNumber, cumulative });
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of latest) out.set(k, v.cumulative);
  return out;
}

export async function recomputeDrawHeaderTotals(
  tx: Tx,
  drawId: string,
): Promise<void> {
  const [draw] = await tx
    .select()
    .from(drawRequests)
    .where(eq(drawRequests.id, drawId))
    .limit(1);
  if (!draw) return;

  const lines = await tx
    .select({
      workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
      workCompletedThisPeriodCents: drawLineItems.workCompletedThisPeriodCents,
      materialsPresentlyStoredCents: drawLineItems.materialsPresentlyStoredCents,
      retainagePercentApplied: drawLineItems.retainagePercentApplied,
    })
    .from(drawLineItems)
    .where(eq(drawLineItems.drawRequestId, drawId));

  let totalCompleted = 0;
  let retainageCompleted = 0;
  let retainageStored = 0;
  for (const l of lines) {
    const completedPortion =
      l.workCompletedPreviousCents + l.workCompletedThisPeriodCents;
    totalCompleted += completedPortion + l.materialsPresentlyStoredCents;
    retainageCompleted += Math.round(
      (completedPortion * l.retainagePercentApplied) / 100,
    );
    retainageStored += Math.round(
      (l.materialsPresentlyStoredCents * l.retainagePercentApplied) / 100,
    );
  }
  const totalRetainage = retainageCompleted + retainageStored;
  const totalEarnedLessRetainage = totalCompleted - totalRetainage;

  const [prev] = await tx
    .select({
      sum: sql<number>`coalesce(sum(${drawRequests.currentPaymentDueCents}), 0)`,
    })
    .from(drawRequests)
    .where(
      and(
        eq(drawRequests.projectId, draw.projectId),
        lt(drawRequests.drawNumber, draw.drawNumber),
        inArray(drawRequests.drawRequestStatus, [...PREVIOUS_CERTIFICATES_STATUSES]),
      ),
    );
  const previousCertificates = Number(prev?.sum ?? 0);
  const currentPaymentDue = totalEarnedLessRetainage - previousCertificates;
  const balanceToFinish = draw.contractSumToDateCents - totalCompleted;

  await tx
    .update(drawRequests)
    .set({
      totalCompletedToDateCents: totalCompleted,
      retainageOnCompletedCents: retainageCompleted,
      retainageOnStoredCents: retainageStored,
      totalRetainageCents: totalRetainage,
      totalEarnedLessRetainageCents: totalEarnedLessRetainage,
      previousCertificatesCents: previousCertificates,
      currentPaymentDueCents: currentPaymentDue,
      balanceToFinishCents: balanceToFinish,
    })
    .where(eq(drawRequests.id, drawId));
}
