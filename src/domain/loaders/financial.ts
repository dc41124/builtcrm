import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  changeOrders,
  drawRequests,
  lienWaivers,
  organizations,
  projectOrganizationMemberships,
  projects,
  retainageReleases,
  scheduleOfValues,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError, assertCan } from "../permissions";

// ---- Types --------------------------------------------------------------

export type ContractorDrawRow = {
  id: string;
  drawNumber: number;
  periodFrom: Date;
  periodTo: Date;
  status: string;
  currentPaymentDueCents: number;
  totalEarnedLessRetainageCents: number;
  paidAt: Date | null;
  paymentReferenceName: string | null;
};

export type SubPaymentRollupRow = {
  organizationId: string;
  organizationName: string;
  contractValueCents: number; // Phase 1: sum of accepted lien waivers
  earnedCents: number;
  paidCents: number;
  outstandingCents: number;
  status: "current" | "outstanding" | "held";
};

export type ContractorFinancialView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  role: EffectiveContext["role"];
  contract: {
    originalContractCents: number;
    approvedChangeOrderCents: number;
    approvedChangeOrderCount: number;
    revisedContractCents: number;
    billedToDateCents: number;
    remainingToBillCents: number;
    asOfLabel: string;
  };
  progress: {
    paidCents: number;
    approvedUnpaidCents: number;
    underReviewCents: number;
    retainageHeldCents: number;
    remainingCents: number;
    billedPct: number;
  };
  draws: ContractorDrawRow[];
  draftCount: number;
  completedDrawCount: number;
  subPayments: SubPaymentRollupRow[];
  retainage: {
    heldCents: number;
    releasedCents: number;
    balanceCents: number;
    defaultPercent: number;
  };
};

export type SubLienWaiverRow = {
  id: string;
  drawNumber: number;
  lienWaiverType: string;
  lienWaiverStatus: string;
  amountCents: number;
  submittedAt: Date | null;
};

export type SubPaymentHistoryRow = {
  drawId: string;
  drawNumber: number;
  drawStatus: string;
  amountCents: number;
  submittedAt: Date | null;
  paidAt: Date | null;
  paymentReferenceName: string | null;
};

export type SubcontractorFinancialView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  role: EffectiveContext["role"];
  organizationName: string;
  contract: {
    earnedCents: number;
    paidCents: number;
    approvedUnpaidCents: number;
    retainageHeldCents: number;
    remainingCents: number; // Phase 1: unknown per-sub contract, shown as null-safe
  };
  progress: {
    paidCents: number;
    approvedUnpaidCents: number;
    retainageHeldCents: number;
    earnedCents: number;
    paidPct: number;
  };
  paymentHistory: SubPaymentHistoryRow[];
  lienWaivers: SubLienWaiverRow[];
  retainage: {
    heldCents: number;
    releasedCents: number;
    defaultPercent: number;
  };
};

type LoaderInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

// ---- Contractor loader --------------------------------------------------

// A subcontractor's lien waiver is treated as "paid" once its parent draw
// has entered the paid/closed state. Under review = submitted/under_review.
// Approved-unpaid = approved / approved_with_note but not yet paid.
const PAID_DRAW_STATUSES = ["paid", "closed"] as const;
const APPROVED_UNPAID_STATUSES = ["approved", "approved_with_note"] as const;
const UNDER_REVIEW_STATUSES = ["submitted", "under_review"] as const;

export async function getContractorFinancialView(
  input: LoaderInput,
): Promise<ContractorFinancialView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  assertCan(context.permissions, "draw_request", "read");
  if (context.role !== "contractor_admin" && context.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Contractor financial view is contractor-only",
      "forbidden",
    );
  }
  const projectId = context.project.id;

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const originalContractCents = project?.contractValueCents ?? 0;

  // Approved change orders — treat approved as "baked into revised contract".
  const [coAgg] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${changeOrders.amountCents}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(changeOrders)
    .where(
      and(
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.changeOrderStatus, "approved"),
      ),
    );
  const approvedChangeOrderCents = Number(coAgg?.totalCents ?? 0);
  const approvedChangeOrderCount = Number(coAgg?.count ?? 0);

  // SOV — used for default retainage percent.
  const [sov] = await db
    .select({
      defaultRetainagePercent: scheduleOfValues.defaultRetainagePercent,
    })
    .from(scheduleOfValues)
    .where(eq(scheduleOfValues.projectId, projectId))
    .orderBy(desc(scheduleOfValues.version))
    .limit(1);
  const defaultRetainagePercent = sov?.defaultRetainagePercent ?? 10;

  // All draws, newest first. Draft rows are excluded from billing totals
  // but still shown in the history table.
  const drawRows = await db
    .select({
      id: drawRequests.id,
      drawNumber: drawRequests.drawNumber,
      periodFrom: drawRequests.periodFrom,
      periodTo: drawRequests.periodTo,
      status: drawRequests.drawRequestStatus,
      currentPaymentDueCents: drawRequests.currentPaymentDueCents,
      totalCompletedToDateCents: drawRequests.totalCompletedToDateCents,
      totalEarnedLessRetainageCents: drawRequests.totalEarnedLessRetainageCents,
      totalRetainageCents: drawRequests.totalRetainageCents,
      paidAt: drawRequests.paidAt,
      paymentReferenceName: drawRequests.paymentReferenceName,
    })
    .from(drawRequests)
    .where(eq(drawRequests.projectId, projectId))
    .orderBy(desc(drawRequests.drawNumber));

  let paidCents = 0;
  let approvedUnpaidCents = 0;
  let underReviewCents = 0;
  let billedToDateCents = 0;
  let latestApprovedDrawNumber: number | null = null;
  let completedDrawCount = 0;
  let draftCount = 0;

  for (const r of drawRows) {
    if (r.status === "draft" || r.status === "returned") {
      if (r.status === "draft") draftCount++;
      continue;
    }
    // totalCompletedToDateCents is the cumulative billed through this draw,
    // so the latest non-draft draw is the billed-to-date amount.
    billedToDateCents = Math.max(billedToDateCents, r.totalCompletedToDateCents);

    if ((PAID_DRAW_STATUSES as readonly string[]).includes(r.status)) {
      paidCents += r.currentPaymentDueCents;
      completedDrawCount++;
    } else if (
      (APPROVED_UNPAID_STATUSES as readonly string[]).includes(r.status)
    ) {
      approvedUnpaidCents += r.currentPaymentDueCents;
      completedDrawCount++;
      if (
        latestApprovedDrawNumber === null ||
        r.drawNumber > latestApprovedDrawNumber
      ) {
        latestApprovedDrawNumber = r.drawNumber;
      }
    } else if ((UNDER_REVIEW_STATUSES as readonly string[]).includes(r.status)) {
      underReviewCents += r.currentPaymentDueCents;
    }
  }

  // Retainage currently held = retainage on latest non-draft draw minus any
  // released retainage.
  const latestNonDraft = drawRows.find(
    (r) => r.status !== "draft" && r.status !== "returned",
  );
  const retainageOnBooksCents = latestNonDraft?.totalRetainageCents ?? 0;

  const [releaseAgg] = await db
    .select({
      releasedCents: sql<number>`coalesce(sum(${retainageReleases.releaseAmountCents}), 0)`,
    })
    .from(retainageReleases)
    .where(
      and(
        eq(retainageReleases.projectId, projectId),
        eq(retainageReleases.releaseStatus, "released"),
      ),
    );
  const releasedCents = Number(releaseAgg?.releasedCents ?? 0);
  const retainageHeldCents = Math.max(0, retainageOnBooksCents - releasedCents);

  const revisedContractCents = originalContractCents + approvedChangeOrderCents;
  const remainingToBillCents = Math.max(
    0,
    revisedContractCents - billedToDateCents,
  );
  const billedPct =
    revisedContractCents > 0
      ? Math.round((billedToDateCents / revisedContractCents) * 100)
      : 0;

  // Sub payment rollup via lien waivers.
  const subOrgs = await db
    .select({
      organizationId: projectOrganizationMemberships.organizationId,
      organizationName: organizations.name,
    })
    .from(projectOrganizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, projectOrganizationMemberships.organizationId),
    )
    .where(
      and(
        eq(projectOrganizationMemberships.projectId, projectId),
        eq(projectOrganizationMemberships.membershipType, "subcontractor"),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    );

  const subPayments: SubPaymentRollupRow[] = [];
  if (subOrgs.length > 0) {
    const waiverRows = await db
      .select({
        organizationId: lienWaivers.organizationId,
        amountCents: lienWaivers.amountCents,
        drawStatus: drawRequests.drawRequestStatus,
      })
      .from(lienWaivers)
      .innerJoin(drawRequests, eq(drawRequests.id, lienWaivers.drawRequestId))
      .where(
        and(
          eq(lienWaivers.projectId, projectId),
          inArray(
            lienWaivers.organizationId,
            subOrgs.map((s) => s.organizationId),
          ),
          inArray(lienWaivers.lienWaiverStatus, ["submitted", "accepted"]),
        ),
      );

    const byOrg = new Map<
      string,
      { earned: number; paid: number; outstanding: number }
    >();
    for (const w of waiverRows) {
      const entry = byOrg.get(w.organizationId) ?? {
        earned: 0,
        paid: 0,
        outstanding: 0,
      };
      entry.earned += w.amountCents;
      if ((PAID_DRAW_STATUSES as readonly string[]).includes(w.drawStatus)) {
        entry.paid += w.amountCents;
      } else if (
        (APPROVED_UNPAID_STATUSES as readonly string[]).includes(w.drawStatus)
      ) {
        entry.outstanding += w.amountCents;
      }
      byOrg.set(w.organizationId, entry);
    }

    for (const org of subOrgs) {
      const agg = byOrg.get(org.organizationId) ?? {
        earned: 0,
        paid: 0,
        outstanding: 0,
      };
      const status: SubPaymentRollupRow["status"] =
        agg.outstanding > 0 ? "outstanding" : "current";
      subPayments.push({
        organizationId: org.organizationId,
        organizationName: org.organizationName,
        contractValueCents: agg.earned, // Phase 1 proxy — no sub-contracts table yet
        earnedCents: agg.earned,
        paidCents: agg.paid,
        outstandingCents: agg.outstanding,
        status,
      });
    }
    subPayments.sort((a, b) =>
      a.organizationName.localeCompare(b.organizationName),
    );
  }

  const asOfLabel =
    latestApprovedDrawNumber !== null
      ? `As of Draw #${latestApprovedDrawNumber}`
      : billedToDateCents > 0
        ? "As of latest draw"
        : "No draws submitted";

  return {
    context,
    project: context.project,
    role: context.role,
    contract: {
      originalContractCents,
      approvedChangeOrderCents,
      approvedChangeOrderCount,
      revisedContractCents,
      billedToDateCents,
      remainingToBillCents,
      asOfLabel,
    },
    progress: {
      paidCents,
      approvedUnpaidCents,
      underReviewCents,
      retainageHeldCents,
      remainingCents: remainingToBillCents,
      billedPct,
    },
    draws: drawRows.map((r) => ({
      id: r.id,
      drawNumber: r.drawNumber,
      periodFrom: r.periodFrom,
      periodTo: r.periodTo,
      status: r.status,
      currentPaymentDueCents: r.currentPaymentDueCents,
      totalEarnedLessRetainageCents: r.totalEarnedLessRetainageCents,
      paidAt: r.paidAt,
      paymentReferenceName: r.paymentReferenceName,
    })),
    draftCount,
    completedDrawCount,
    subPayments,
    retainage: {
      heldCents: retainageHeldCents,
      releasedCents,
      balanceCents: retainageHeldCents,
      defaultPercent: defaultRetainagePercent,
    },
  };
}

// ---- Subcontractor loader -----------------------------------------------

export async function getSubcontractorFinancialView(
  input: LoaderInput,
): Promise<SubcontractorFinancialView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  assertCan(context.permissions, "draw_request", "read");
  if (context.role !== "subcontractor_user") {
    throw new AuthorizationError(
      "Subcontractor financial view is subcontractor-only",
      "forbidden",
    );
  }
  const projectId = context.project.id;
  const orgId = context.organization.id;

  const [sov] = await db
    .select({
      defaultRetainagePercent: scheduleOfValues.defaultRetainagePercent,
    })
    .from(scheduleOfValues)
    .where(eq(scheduleOfValues.projectId, projectId))
    .orderBy(desc(scheduleOfValues.version))
    .limit(1);
  const defaultRetainagePercent = sov?.defaultRetainagePercent ?? 10;

  // Lien waivers for this sub on this project, with their parent draw status.
  const waivers = await db
    .select({
      id: lienWaivers.id,
      amountCents: lienWaivers.amountCents,
      lienWaiverType: lienWaivers.lienWaiverType,
      lienWaiverStatus: lienWaivers.lienWaiverStatus,
      submittedAt: lienWaivers.submittedAt,
      drawId: drawRequests.id,
      drawNumber: drawRequests.drawNumber,
      drawStatus: drawRequests.drawRequestStatus,
      drawPaidAt: drawRequests.paidAt,
      drawPaymentReferenceName: drawRequests.paymentReferenceName,
    })
    .from(lienWaivers)
    .innerJoin(drawRequests, eq(drawRequests.id, lienWaivers.drawRequestId))
    .where(
      and(
        eq(lienWaivers.projectId, projectId),
        eq(lienWaivers.organizationId, orgId),
      ),
    )
    .orderBy(desc(drawRequests.drawNumber));

  let earnedCents = 0;
  let paidCents = 0;
  let approvedUnpaidCents = 0;
  const paymentByDraw = new Map<string, SubPaymentHistoryRow>();

  for (const w of waivers) {
    // Count waivers that are at least submitted toward the earned total;
    // rejected/waived are ignored.
    if (w.lienWaiverStatus === "submitted" || w.lienWaiverStatus === "accepted") {
      earnedCents += w.amountCents;
      if ((PAID_DRAW_STATUSES as readonly string[]).includes(w.drawStatus)) {
        paidCents += w.amountCents;
      } else if (
        (APPROVED_UNPAID_STATUSES as readonly string[]).includes(w.drawStatus)
      ) {
        approvedUnpaidCents += w.amountCents;
      }
      const existing = paymentByDraw.get(w.drawId);
      const amount = (existing?.amountCents ?? 0) + w.amountCents;
      paymentByDraw.set(w.drawId, {
        drawId: w.drawId,
        drawNumber: w.drawNumber,
        drawStatus: w.drawStatus,
        amountCents: amount,
        submittedAt: w.submittedAt,
        paidAt: w.drawPaidAt,
        paymentReferenceName: w.drawPaymentReferenceName,
      });
    }
  }

  const retainageHeldCents = Math.round(
    (earnedCents * defaultRetainagePercent) / 100,
  );
  const paidPct =
    earnedCents > 0 ? Math.round((paidCents / earnedCents) * 100) : 0;

  const paymentHistory = [...paymentByDraw.values()].sort(
    (a, b) => b.drawNumber - a.drawNumber,
  );

  const lienWaiverRows: SubLienWaiverRow[] = waivers
    .map((w) => ({
      id: w.id,
      drawNumber: w.drawNumber,
      lienWaiverType: w.lienWaiverType,
      lienWaiverStatus: w.lienWaiverStatus,
      amountCents: w.amountCents,
      submittedAt: w.submittedAt,
    }))
    .sort((a, b) => b.drawNumber - a.drawNumber);

  // Remaining: Phase 1 has no per-sub contract value → we report 0 here
  // and the UI surfaces "—" so users aren't misled by a fake number.
  const remainingCents = 0;

  return {
    context,
    project: context.project,
    role: context.role,
    organizationName: context.organization.name,
    contract: {
      earnedCents,
      paidCents,
      approvedUnpaidCents,
      retainageHeldCents,
      remainingCents,
    },
    progress: {
      paidCents,
      approvedUnpaidCents,
      retainageHeldCents,
      earnedCents,
      paidPct,
    },
    paymentHistory,
    lienWaivers: lienWaiverRows,
    retainage: {
      heldCents: retainageHeldCents,
      releasedCents: 0,
      defaultPercent: defaultRetainagePercent,
    },
  };
}

// ---- Formatting helpers (pure) ------------------------------------------

export function formatMoneyCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatPeriodRange(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)}–${fmt(to)}`;
}
