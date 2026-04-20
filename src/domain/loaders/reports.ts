import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  approvals,
  changeOrders,
  complianceRecords,
  drawRequests,
  milestones,
  projects,
  punchItems,
  rfis,
} from "@/db/schema";

import { getContractorOrgContext, type ContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

import {
  agingBucket,
  AGING_BUCKET_ORDER,
  computePercentComplete,
  computeScheduleVariance,
  daysOpen,
  type AgingBucket,
} from "@/lib/reports/math";

// Reports dashboard loader (Step 24). Single cross-project aggregate
// for the contractor portal's /reports page.
//
// Query strategy: one SELECT per metric, each filtered by
// `projectId IN (...)` for the contractor's project set. Per-project
// rollups computed in-memory from those flat result sets — no N+1
// walks. Mirrors the batched pattern in getContractorDashboardData.
//
// Caching: the page uses Next.js route-level revalidate so this
// function is hit at most once per 60s per org. Live-updating isn't
// the point of a reports view.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type ReportsKpis = {
  // Financial (in cents, formatted at the component layer)
  totalContractCents: number;
  totalBilledCents: number;
  totalUnpaidCents: number;
  // Operational
  activeProjects: number;
  openRfis: number;
  openChangeOrders: number;
  // Risk
  complianceAlerts: number;
  scheduleAtRisk: number;
};

export type ProjectReportRow = {
  id: string;
  name: string;
  status: string;
  phase: string | null;
  contractValueCents: number;
  billedCents: number;
  percentComplete: number | null;
  percentCompleteMode: "duration" | "unweighted";
  scheduleVarianceDays: number | null;
  complianceStatus: "ok" | "expiring" | "alert";
  openItemsCount: number;
};

export type AgingChartData = Array<{
  bucket: AgingBucket;
  label: string;
  rfis: number;
  changeOrders: number;
}>;

import {
  getPaymentTrackingReport,
  type PaymentTrackingReportSummary,
} from "./cross-project-payments";
import {
  getWeeklyReportsAggregate,
  type WeeklyReportsAggregate,
} from "./weekly-reports";
import {
  getLienWaiverLogReport,
  type LienWaiverLogReport,
} from "./lien-waiver-report";
import {
  getProcurementReport,
  type ProcurementReportView,
} from "./procurement";

export type ReportsView = {
  context: ContractorOrgContext;
  generatedAtIso: string;
  kpis: ReportsKpis;
  projects: ProjectReportRow[];
  aging: AgingChartData;
  // Step 38 wiring — live cross-project payment tracking summary. Null
  // when loading the report slice fails so the Reports page still renders
  // every other built tile.
  paymentTracking: PaymentTrackingReportSummary | null;
  // Step 39 wiring — recent sent weekly reports across the portfolio.
  weeklyReports: WeeklyReportsAggregate | null;
  // Step 40 wiring — every lien waiver across the portfolio with status,
  // amount, draw#, sub. Powers the Reports page lien-waivers tile.
  lienWaivers: LienWaiverLogReport | null;
  // Step 41 wiring — PO aggregates across the portfolio (open count,
  // committed $, aging bucket, by-vendor rollup). Powers the Reports
  // page procurement tile.
  procurement: ProcurementReportView | null;
};

// ---------------------------------------------------------------
// Loader
// ---------------------------------------------------------------

type LoaderInput = { session: SessionLike | null | undefined };

const OPEN_RFI_STATUSES = ["open", "pending_response"] as const;
const OPEN_CO_STATUSES = [
  "draft",
  "pending_review",
  "pending_client_approval",
] as const;
const ACTIVE_DRAW_STATUSES = [
  "approved",
  "approved_with_note",
  "submitted",
  "under_review",
] as const;
const COMPLIANCE_ALERT_STATUSES = ["expired", "rejected"] as const;
const OPEN_PUNCH_STATUSES = ["open", "in_progress", "ready_to_verify", "rejected"] as const;

export async function getContractorReportsData(
  input: LoaderInput,
): Promise<ReportsView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // ---- Projects ----
  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.projectStatus,
      phase: projects.currentPhase,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));

  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) {
    return {
      context,
      generatedAtIso: now.toISOString(),
      kpis: emptyKpis(),
      projects: [],
      aging: emptyAging(),
      paymentTracking: null,
      weeklyReports: null,
      lienWaivers: null,
      procurement: null,
    };
  }

  // ---- Parallel per-table queries ----
  const [
    rfiRows,
    coRows,
    approvalAgg,
    drawRows,
    complianceRows,
    milestoneRows,
    punchAgg,
  ] = await Promise.all([
    // RFIs for aging charts + open counts
    db
      .select({
        id: rfis.id,
        projectId: rfis.projectId,
        rfiStatus: rfis.rfiStatus,
        createdAt: rfis.createdAt,
      })
      .from(rfis)
      .where(
        and(
          inArray(rfis.projectId, projectIds),
          inArray(rfis.rfiStatus, [...OPEN_RFI_STATUSES]),
        ),
      ),
    // Change orders for aging charts + open counts
    db
      .select({
        id: changeOrders.id,
        projectId: changeOrders.projectId,
        changeOrderStatus: changeOrders.changeOrderStatus,
        createdAt: changeOrders.createdAt,
      })
      .from(changeOrders)
      .where(
        and(
          inArray(changeOrders.projectId, projectIds),
          inArray(changeOrders.changeOrderStatus, [...OPEN_CO_STATUSES]),
        ),
      ),
    // Pending approvals — not a per-project column in the reports
    // KPIs but counted in each project's open-items total.
    db
      .select({
        projectId: approvals.projectId,
        c: sql<number>`count(*)::int`,
      })
      .from(approvals)
      .where(
        and(
          inArray(approvals.projectId, projectIds),
          inArray(approvals.approvalStatus, ["pending_review", "needs_revision"]),
        ),
      )
      .groupBy(approvals.projectId),
    // Draw requests for billed / unpaid rollups
    db
      .select({
        projectId: drawRequests.projectId,
        drawRequestStatus: drawRequests.drawRequestStatus,
        totalCompletedToDateCents: drawRequests.totalCompletedToDateCents,
        currentPaymentDueCents: drawRequests.currentPaymentDueCents,
        paidAt: drawRequests.paidAt,
      })
      .from(drawRequests)
      .where(inArray(drawRequests.projectId, projectIds)),
    // Compliance — alerts plus expiring-soon records
    db
      .select({
        id: complianceRecords.id,
        projectId: complianceRecords.projectId,
        complianceStatus: complianceRecords.complianceStatus,
        expiresAt: complianceRecords.expiresAt,
      })
      .from(complianceRecords)
      .where(
        and(
          isNotNull(complianceRecords.projectId),
          inArray(complianceRecords.projectId, projectIds),
          or(
            inArray(complianceRecords.complianceStatus, [
              ...COMPLIANCE_ALERT_STATUSES,
            ]),
            and(
              isNotNull(complianceRecords.expiresAt),
              lt(complianceRecords.expiresAt, soon),
            ),
          ),
        ),
      ),
    // Milestones for % complete + schedule variance
    db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        startDate: milestones.startDate,
        scheduledDate: milestones.scheduledDate,
        completedDate: milestones.completedDate,
        milestoneStatus: milestones.milestoneStatus,
      })
      .from(milestones)
      .where(inArray(milestones.projectId, projectIds)),
    // Punch items for open counts per project
    db
      .select({
        projectId: punchItems.projectId,
        c: sql<number>`count(*)::int`,
      })
      .from(punchItems)
      .where(
        and(
          inArray(punchItems.projectId, projectIds),
          inArray(punchItems.status, [...OPEN_PUNCH_STATUSES]),
        ),
      )
      .groupBy(punchItems.projectId),
  ]);

  // ---- Per-project rollups (in-memory) ----

  // Milestones per project
  const milestonesByProject = groupBy(milestoneRows, (m) => m.projectId);
  // Draws per project
  const drawsByProject = groupBy(drawRows, (d) => d.projectId);
  // RFI + CO counts per project
  const rfiCountByProject = countBy(rfiRows, (r) => r.projectId);
  const coCountByProject = countBy(coRows, (r) => r.projectId);
  const approvalCountByProject = new Map(
    approvalAgg.map((r) => [r.projectId, r.c]),
  );
  const punchCountByProject = new Map(
    punchAgg.map((r) => [r.projectId, r.c]),
  );
  // Compliance per project — alert when any row is in alert statuses;
  // expiring when the only concerning rows are soon-expiring.
  const complianceByProject = groupBy(complianceRows, (c) => c.projectId!);

  const projectReports: ProjectReportRow[] = projectRows.map((p) => {
    const msForProject = milestonesByProject.get(p.id) ?? [];
    const { pct, weightingMode } = computePercentComplete(msForProject);
    const variance = computeScheduleVariance(msForProject, now);

    // Billed = the highest totalCompletedToDateCents across the
    // project's draws (each draw is cumulative). Unpaid isn't used
    // at the row level but contributes to the portfolio KPI.
    const drawsForProject = drawsByProject.get(p.id) ?? [];
    const billedCents = drawsForProject.reduce(
      (m, d) => Math.max(m, d.totalCompletedToDateCents),
      0,
    );

    // Compliance rollup for this project's row
    const complianceForProject = complianceByProject.get(p.id) ?? [];
    const complianceStatus: ProjectReportRow["complianceStatus"] = (() => {
      const hasAlert = complianceForProject.some((c) =>
        (COMPLIANCE_ALERT_STATUSES as readonly string[]).includes(c.complianceStatus),
      );
      if (hasAlert) return "alert";
      if (complianceForProject.length > 0) return "expiring";
      return "ok";
    })();

    // Open-items count: RFIs + COs + approvals + punch items on this
    // project. Documents and other non-workflow surfaces stay out.
    const openItemsCount =
      (rfiCountByProject.get(p.id) ?? 0) +
      (coCountByProject.get(p.id) ?? 0) +
      (approvalCountByProject.get(p.id) ?? 0) +
      (punchCountByProject.get(p.id) ?? 0);

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      phase: p.phase,
      contractValueCents: p.contractValueCents ?? 0,
      billedCents,
      percentComplete: pct,
      percentCompleteMode: weightingMode,
      scheduleVarianceDays: variance,
      complianceStatus,
      openItemsCount,
    };
  });

  // ---- Portfolio KPIs ----

  const totalContractCents = projectRows.reduce(
    (s, p) => s + (p.contractValueCents ?? 0),
    0,
  );
  const totalBilledCents = projectReports.reduce(
    (s, r) => s + r.billedCents,
    0,
  );
  const totalUnpaidCents = drawRows.reduce((s, d) => {
    if (!(ACTIVE_DRAW_STATUSES as readonly string[]).includes(d.drawRequestStatus)) {
      return s;
    }
    if (d.paidAt) return s;
    return s + (d.currentPaymentDueCents ?? 0);
  }, 0);

  const activeProjects = projectRows.filter(
    (p) => p.status === "active",
  ).length;

  const openRfis = rfiRows.length;
  const openChangeOrders = coRows.length;
  const complianceAlerts = complianceRows.length;
  // Schedule-at-risk = any project with a positive variance > 7 days
  // (a week slip is the threshold most PMs flag as a real signal).
  const scheduleAtRisk = projectReports.filter(
    (r) => (r.scheduleVarianceDays ?? 0) > 7,
  ).length;

  // ---- Aging chart (RFIs + COs combined) ----

  const aging = computeAging(rfiRows, coRows, now);

  // ---- Payment tracking slice (Step 38) ----
  // Reuses the full cross-project payments loader; strips to the
  // summary shape. Isolated in a try so an unrelated failure here
  // doesn't black out the Reports page.
  let paymentTracking: PaymentTrackingReportSummary | null = null;
  try {
    paymentTracking = await getPaymentTrackingReport(input);
  } catch {
    paymentTracking = null;
  }

  // ---- Weekly reports aggregate (Step 39) ----
  let weeklyReportsAggregate: WeeklyReportsAggregate | null = null;
  try {
    weeklyReportsAggregate = await getWeeklyReportsAggregate(input);
  } catch {
    weeklyReportsAggregate = null;
  }

  // ---- Lien waiver log (Step 40) ----
  let lienWaiverLog: LienWaiverLogReport | null = null;
  try {
    lienWaiverLog = await getLienWaiverLogReport(input);
  } catch {
    lienWaiverLog = null;
  }

  // ---- Procurement aggregate (Step 41) ----
  let procurement: ProcurementReportView | null = null;
  try {
    procurement = await getProcurementReport(input);
  } catch {
    procurement = null;
  }

  return {
    context,
    generatedAtIso: now.toISOString(),
    kpis: {
      totalContractCents,
      totalBilledCents,
      totalUnpaidCents,
      activeProjects,
      openRfis,
      openChangeOrders,
      complianceAlerts,
      scheduleAtRisk,
    },
    projects: projectReports,
    aging,
    paymentTracking,
    weeklyReports: weeklyReportsAggregate,
    lienWaivers: lienWaiverLog,
    procurement,
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function emptyKpis(): ReportsKpis {
  return {
    totalContractCents: 0,
    totalBilledCents: 0,
    totalUnpaidCents: 0,
    activeProjects: 0,
    openRfis: 0,
    openChangeOrders: 0,
    complianceAlerts: 0,
    scheduleAtRisk: 0,
  };
}

function emptyAging(): AgingChartData {
  return AGING_BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: bucketLabel(bucket),
    rfis: 0,
    changeOrders: 0,
  }));
}

function bucketLabel(b: AgingBucket): string {
  switch (b) {
    case "0_7":
      return "0–7 days";
    case "8_14":
      return "8–14 days";
    case "15_30":
      return "15–30 days";
    case "30_plus":
      return "30+ days";
  }
}

function computeAging(
  rfis: Array<{ createdAt: Date }>,
  cos: Array<{ createdAt: Date }>,
  now: Date,
): AgingChartData {
  const counts: Record<AgingBucket, { rfis: number; cos: number }> = {
    "0_7": { rfis: 0, cos: 0 },
    "8_14": { rfis: 0, cos: 0 },
    "15_30": { rfis: 0, cos: 0 },
    "30_plus": { rfis: 0, cos: 0 },
  };
  for (const r of rfis) {
    counts[agingBucket(daysOpen(r.createdAt, now))].rfis += 1;
  }
  for (const c of cos) {
    counts[agingBucket(daysOpen(c.createdAt, now))].cos += 1;
  }
  return AGING_BUCKET_ORDER.map((b) => ({
    bucket: b,
    label: bucketLabel(b),
    rfis: counts[b].rfis,
    changeOrders: counts[b].cos,
  }));
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = out.get(k) ?? [];
    list.push(item);
    out.set(k, list);
  }
  return out;
}

function countBy<T, K>(arr: T[], key: (t: T) => K): Map<K, number> {
  const out = new Map<K, number>();
  for (const item of arr) {
    const k = key(item);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
