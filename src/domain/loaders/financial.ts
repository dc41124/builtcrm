import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  changeOrders,
  drawRequests,
  lienWaivers,
  milestones,
  organizations,
  projectOrganizationMemberships,
  projects,
  retainageReleases,
  scheduleOfValues,
  sovLineItems,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

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
  // Read through from project_organization_memberships.workScope. Free-text
  // label the GC entered for this sub's scope on this project (e.g.
  // "Structural Steel", "HVAC", "Deck & railings"). Null when unset.
  // Residential portal should render this as "Scope"; commercial as "Trade".
  tradeScope: string | null;
  contractValueCents: number; // Phase 1: sum of accepted lien waivers
  earnedCents: number;
  paidCents: number;
  outstandingCents: number;
  status: "current" | "outstanding" | "held";
};

// Step 43: "Pending Financials" summary card. Four action-oriented
// metrics the contractor PM wants to triage at a glance. Each pair is
// count + total; the UI renders them as clickable tiles.
export type PendingFinancialsSummary = {
  drawsUnderReview: { count: number; totalCents: number };
  invoicesAwaitingPayment: { count: number; totalCents: number };
  // Retainage releases (held or release_requested) whose resolved
  // scheduled date falls within the next 30 days. Resolution: milestone
  // trigger date first (retainage_releases.release_trigger_milestone_id
  // → milestones.scheduled_date), free-form retainage_releases
  // .scheduled_release_at second, null (invisible) third. See migration
  // 0022 context.
  retainageReleasingSoon: { count: number; totalCents: number };
  changeOrdersPendingApproval: { count: number; totalCents: number };
};

export type ContractorFinancialView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  role: EffectiveContext["role"];
  // Drives the "Trade" vs "Scope" label on the sub payment rollup.
  isResidential: boolean;
  pendingFinancials: PendingFinancialsSummary;
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
  // Step 43 wire-up: data for the ContractorRetainagePanel's release log
  // + create form. Panel renders below the Retainage Summary card.
  retainageReleases: RetainageReleaseRow[];
  sovLineOptions: SovLineOption[];
  milestoneOptions: MilestoneOption[];
};

export type RetainageReleaseRow = {
  id: string;
  sovLineItemId: string | null;
  releaseStatus: "held" | "release_requested" | "released" | "forfeited";
  releaseAmountCents: number;
  totalRetainageHeldCents: number;
  approvalNote: string | null;
  requestedAt: Date | null;
  approvedAt: Date | null;
  consumedByDrawRequestId: string | null;
  consumedAt: Date | null;
  scheduledReleaseAt: Date | null;
  releaseTriggerMilestoneId: string | null;
  createdAt: Date;
};

export type SovLineOption = {
  id: string;
  itemNumber: string;
  description: string;
};

export type MilestoneOption = {
  id: string;
  title: string;
  scheduledDate: Date;
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
  scopeLabel: string | null;
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
      clientSubtype: projects.clientSubtype,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const originalContractCents = project?.contractValueCents ?? 0;
  const isResidential = project?.clientSubtype === "residential";

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
      reviewedAt: drawRequests.reviewedAt,
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
  let latestApprovedDrawAt: Date | null = null;
  let completedDrawCount = 0;
  let draftCount = 0;

  // Step 43 pending-financials counts (paired with the cent sums above).
  let drawsUnderReviewCount = 0;
  let invoicesAwaitingPaymentCount = 0;

  for (const r of drawRows) {
    if (r.status === "draft" || r.status === "returned") {
      if (r.status === "draft") draftCount++;
      continue;
    }
    // totalCompletedToDateCents is the cumulative billed through this draw,
    // so the latest non-draft draw is the billed-to-date amount.
    billedToDateCents = Math.max(billedToDateCents, r.totalCompletedToDateCents);

    const isApproved =
      (APPROVED_UNPAID_STATUSES as readonly string[]).includes(r.status) ||
      (PAID_DRAW_STATUSES as readonly string[]).includes(r.status);

    if ((PAID_DRAW_STATUSES as readonly string[]).includes(r.status)) {
      paidCents += r.currentPaymentDueCents;
      completedDrawCount++;
    } else if (
      (APPROVED_UNPAID_STATUSES as readonly string[]).includes(r.status)
    ) {
      approvedUnpaidCents += r.currentPaymentDueCents;
      completedDrawCount++;
      // Approved but not yet paid → "invoice awaiting payment"
      if (!r.paidAt) invoicesAwaitingPaymentCount++;
    } else if ((UNDER_REVIEW_STATUSES as readonly string[]).includes(r.status)) {
      underReviewCents += r.currentPaymentDueCents;
      drawsUnderReviewCount++;
    }

    if (
      isApproved &&
      (latestApprovedDrawNumber === null ||
        r.drawNumber > latestApprovedDrawNumber)
    ) {
      latestApprovedDrawNumber = r.drawNumber;
      latestApprovedDrawAt = r.reviewedAt ?? r.paidAt ?? null;
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

  // Step 43: two extra pending aggregates — retainage releases expected
  // in the next 30 days (resolver rule: milestone-tied date wins, else
  // the free-form scheduled_release_at), and change orders with a
  // non-zero financial impact in pending statuses.
  //
  // Resolver sql: `coalesce(milestones.scheduled_date, scheduled_release_at)`
  // returns null when neither hook is set, keeping those rows out of the
  // card until the GC configures a trigger.
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // Resolved release date: milestone-tied value wins, else free-form
  // scheduledReleaseAt. Compared via a cast-to-timestamptz parameter
  // (drizzle's raw `sql` tag doesn't coerce JS Date into postgres.js
  // params; explicit cast avoids the "Received an instance of Date" driver
  // error).
  const resolvedReleaseDate = sql<Date>`coalesce(${milestones.scheduledDate}, ${retainageReleases.scheduledReleaseAt})`;
  const [retainagePendingAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${retainageReleases.releaseAmountCents}), 0)::int`,
    })
    .from(retainageReleases)
    .leftJoin(
      milestones,
      eq(milestones.id, retainageReleases.releaseTriggerMilestoneId),
    )
    .where(
      and(
        eq(retainageReleases.projectId, projectId),
        inArray(retainageReleases.releaseStatus, ["held", "release_requested"]),
        sql`${resolvedReleaseDate} is not null`,
        sql`${resolvedReleaseDate} <= ${thirtyDaysOut.toISOString()}::timestamptz`,
      ),
    );
  const [coPendingAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${changeOrders.amountCents}), 0)::int`,
    })
    .from(changeOrders)
    .where(
      and(
        eq(changeOrders.projectId, projectId),
        inArray(changeOrders.changeOrderStatus, [
          "pending_review",
          "pending_client_approval",
        ]),
        // "Financial impact" filter — zero-dollar COs (pure scope/schedule
        // changes) don't belong on a money-focused summary card.
        sql`${changeOrders.amountCents} <> 0`,
      ),
    );

  const pendingFinancials: PendingFinancialsSummary = {
    drawsUnderReview: {
      count: drawsUnderReviewCount,
      totalCents: underReviewCents,
    },
    invoicesAwaitingPayment: {
      count: invoicesAwaitingPaymentCount,
      totalCents: approvedUnpaidCents,
    },
    retainageReleasingSoon: {
      count: Number(retainagePendingAgg?.count ?? 0),
      totalCents: Number(retainagePendingAgg?.total ?? 0),
    },
    changeOrdersPendingApproval: {
      count: Number(coPendingAgg?.count ?? 0),
      totalCents: Number(coPendingAgg?.total ?? 0),
    },
  };

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
      // Free-text scope label the GC set on invite. May be null; rendered
      // as "Trade" on commercial projects, "Scope" on residential.
      workScope: projectOrganizationMemberships.workScope,
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
    // Contractor reading sub-org rows: multi-org policy clause B
    // (project ownership) lets it through.
    const waiverRows = await withTenant(context.organization.id, (tx) =>
      tx
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
        tradeScope: org.workScope,
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
      ? latestApprovedDrawAt != null
        ? `As of Draw #${latestApprovedDrawNumber} · Approved ${formatAsOfDate(latestApprovedDrawAt)}`
        : `As of Draw #${latestApprovedDrawNumber}`
      : billedToDateCents > 0
        ? "As of latest draw"
        : "No draws submitted";

  // Step 43 wire-up: retainage release log + dropdown options for the
  // create form. Three parallel queries: releases (all states, newest
  // first), SOV lines (for "per-line" scoping), and milestones (for the
  // trigger-milestone option).
  const [releaseRows, sovLineRows, milestoneRows] = await Promise.all([
    db
      .select({
        id: retainageReleases.id,
        sovLineItemId: retainageReleases.sovLineItemId,
        releaseStatus: retainageReleases.releaseStatus,
        releaseAmountCents: retainageReleases.releaseAmountCents,
        totalRetainageHeldCents: retainageReleases.totalRetainageHeldCents,
        approvalNote: retainageReleases.approvalNote,
        requestedAt: retainageReleases.requestedAt,
        approvedAt: retainageReleases.approvedAt,
        consumedByDrawRequestId: retainageReleases.consumedByDrawRequestId,
        consumedAt: retainageReleases.consumedAt,
        scheduledReleaseAt: retainageReleases.scheduledReleaseAt,
        releaseTriggerMilestoneId: retainageReleases.releaseTriggerMilestoneId,
        createdAt: retainageReleases.createdAt,
      })
      .from(retainageReleases)
      .where(eq(retainageReleases.projectId, projectId))
      .orderBy(desc(retainageReleases.createdAt)),
    db
      .select({
        id: sovLineItems.id,
        itemNumber: sovLineItems.itemNumber,
        description: sovLineItems.description,
        sovId: sovLineItems.sovId,
      })
      .from(sovLineItems)
      .innerJoin(
        scheduleOfValues,
        eq(scheduleOfValues.id, sovLineItems.sovId),
      )
      .where(
        and(
          eq(scheduleOfValues.projectId, projectId),
          eq(sovLineItems.isActive, true),
        ),
      )
      .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber)),
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        scheduledDate: milestones.scheduledDate,
      })
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(asc(milestones.scheduledDate)),
  ]);

  const retainageReleasesView: RetainageReleaseRow[] = releaseRows.map((r) => ({
    id: r.id,
    sovLineItemId: r.sovLineItemId,
    releaseStatus: r.releaseStatus,
    releaseAmountCents: r.releaseAmountCents,
    totalRetainageHeldCents: r.totalRetainageHeldCents,
    approvalNote: r.approvalNote,
    requestedAt: r.requestedAt,
    approvedAt: r.approvedAt,
    consumedByDrawRequestId: r.consumedByDrawRequestId,
    consumedAt: r.consumedAt,
    scheduledReleaseAt: r.scheduledReleaseAt,
    releaseTriggerMilestoneId: r.releaseTriggerMilestoneId,
    createdAt: r.createdAt,
  }));

  return {
    context,
    project: context.project,
    role: context.role,
    isResidential,
    pendingFinancials,
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
    retainageReleases: retainageReleasesView,
    sovLineOptions: sovLineRows.map((r) => ({
      id: r.id,
      itemNumber: r.itemNumber,
      description: r.description,
    })),
    milestoneOptions: milestoneRows.map((r) => ({
      id: r.id,
      title: r.title,
      scheduledDate: r.scheduledDate,
    })),
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

  // Work scope for this sub on this project — surfaces as
  // "{orgName} — {scope} scope" on the contract summary card.
  const [membership] = await db
    .select({
      workScope: projectOrganizationMemberships.workScope,
    })
    .from(projectOrganizationMemberships)
    .where(
      and(
        eq(projectOrganizationMemberships.projectId, projectId),
        eq(projectOrganizationMemberships.organizationId, orgId),
      ),
    )
    .limit(1);
  const scopeLabel = membership?.workScope?.trim() || null;

  // Lien waivers for this sub on this project, with their parent draw
  // status. Sub viewing their own waivers — multi-org policy clause A
  // (organization_id = GUC) satisfies.
  const waivers = await withTenant(orgId, (tx) =>
    tx
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
      .orderBy(desc(drawRequests.drawNumber)),
  );

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
    scopeLabel,
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

// ---- Sub pending-financials helper --------------------------------------
//
// Canonical definition (see phase_4plus_build_guide.md Step 42.5):
//   "pending financials" for a sub = sum of the sub's lien waiver amounts
//   where the parent draw's status is in UNDER_REVIEW_STATUSES
//   ('submitted' or 'under_review').
//
// The sub doesn't own draw line items directly — the GC authors the draw
// at the GC→client layer. The sub's attribution into a draw comes through
// lien_waivers.organizationId + lien_waivers.draw_request_id. So the
// "draw line-item amount" the spec refers to is the sub's lien waiver
// amount on that draw. Waiver-status filter matches the sub payment
// rollup: `submitted` or `accepted`, excluding `rejected`/`waived`/
// `requested` (those aren't active claims against the draw).
//
// Scope:
//   - subOrgId required
//   - projectId optional — pass to scope to one project; omit for a
//     cross-project sum across every project the sub has a membership on.
export async function getSubPendingFinancialsCents(opts: {
  subOrgId: string;
  projectId?: string;
}): Promise<number> {
  const filters = [
    eq(lienWaivers.organizationId, opts.subOrgId),
    inArray(lienWaivers.lienWaiverStatus, ["submitted", "accepted"]),
    inArray(drawRequests.drawRequestStatus, [...UNDER_REVIEW_STATUSES]),
  ];
  if (opts.projectId) {
    filters.push(eq(lienWaivers.projectId, opts.projectId));
  }
  // Sum is scoped to a specific subOrgId — multi-org policy clause A
  // satisfies under withTenant(subOrgId).
  const [agg] = await withTenant(opts.subOrgId, (tx) =>
    tx
      .select({
        total: sql<number>`coalesce(sum(${lienWaivers.amountCents}), 0)::int`,
      })
      .from(lienWaivers)
      .innerJoin(drawRequests, eq(drawRequests.id, lienWaivers.drawRequestId))
      .where(and(...filters)),
  );
  return agg?.total ?? 0;
}

// ---- Formatting helpers (pure) ------------------------------------------

export function formatPeriodRange(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)}–${fmt(to)}`;
}

function formatAsOfDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
