import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  changeOrders,
  drawRequests,
  milestones,
  organizations,
  projectOrganizationMemberships,
  projects,
  purchaseOrderLines,
  purchaseOrders,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { computePercentComplete } from "@/lib/reports/math";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// WIP Schedule loader (Step 24.5 wiring).
//
// One row per contractor project. Columns mirror the construction-standard
// WIP schedule (contract + COs, cost-to-date, % complete, earned, billed,
// over/under, backlog). The % complete weighting is the schedule-based value
// from the existing milestones loader — not a cost-based percentage, since
// the schema doesn't carry per-project budgets for a true estimate-to-complete.
// That choice is documented on the UI caption; both approaches are defensible
// and schedule-% is derivable from data we already own.
//
// Cost-to-date is derived from received PO lines: sum of (min(received, qty)
// × unit cost) across non-cancelled POs for the project. This understates
// self-performed labor and any cost not routed through a PO — flagged on the
// UI as "PO-tracked cost" to avoid misrepresenting it as a GL-grade figure.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type WIPRow = {
  projectId: string;
  projectName: string;
  phase: string | null;
  clientName: string | null;
  contractValueCents: number;
  approvedCoCents: number;
  contractWithCoCents: number;
  costToDateCents: number;
  // 0..1 schedule-based percent complete (milestone weighting)
  percentComplete: number;
  earnedCents: number;
  billedCents: number;
  // Positive = underbilled (earned > billed). Negative = overbilled.
  overUnderCents: number;
  backlogCents: number;
};

export type WIPReportView = {
  rows: WIPRow[];
  totals: {
    contractWithCoCents: number;
    costToDateCents: number;
    earnedCents: number;
    billedCents: number;
    overUnderCents: number;
    backlogCents: number;
  };
  generatedAtIso: string;
};

type LoaderInput = { session: SessionLike | null | undefined };

// Cost-to-date: received PO lines only. A PO line's consumed value is
// min(received, ordered) * unitCost — PO revisions adjust `quantity`, so
// capping at ordered prevents a historical over-receive from inflating cost.
const COST_PO_STATUSES = [
  "issued",
  "revised",
  "partially_received",
  "fully_received",
  "invoiced",
  "closed",
] as const;

export async function getWIPReport(input: LoaderInput): Promise<WIPReportView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  // Base projects.
  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      phase: projects.currentPhase,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));

  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) {
    return { rows: [], totals: emptyTotals(), generatedAtIso: now.toISOString() };
  }

  // ---- Parallel slice queries ----
  const [coRows, drawRows, clientRows, poRows, poLineRows, msRows] =
    await Promise.all([
      withTenant(orgId, (tx) =>
        tx
          .select({
            projectId: changeOrders.projectId,
            status: changeOrders.changeOrderStatus,
            amountCents: changeOrders.amountCents,
          })
          .from(changeOrders)
          .where(
            and(
              inArray(changeOrders.projectId, projectIds),
              eq(changeOrders.changeOrderStatus, "approved"),
            ),
          ),
      ),
      withTenant(orgId, (tx) =>
        tx
          .select({
            projectId: drawRequests.projectId,
            totalCompletedToDateCents: drawRequests.totalCompletedToDateCents,
          })
          .from(drawRequests)
          .where(inArray(drawRequests.projectId, projectIds)),
      ),
      // Contractor caller; multi-org POM policy clause B (project
      // ownership) returns every client POM on their projects.
      withTenant(orgId, (tx) =>
        tx
          .select({
            projectId: projectOrganizationMemberships.projectId,
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
      ),
      withTenant(orgId, (tx) =>
        tx
          .select({
            id: purchaseOrders.id,
            projectId: purchaseOrders.projectId,
          })
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.organizationId, orgId),
              inArray(purchaseOrders.projectId, projectIds),
              inArray(purchaseOrders.status, [...COST_PO_STATUSES]),
            ),
          ),
      ),
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
              inArray(purchaseOrders.status, [...COST_PO_STATUSES]),
            ),
          ),
      ),
      withTenant(orgId, (tx) =>
        tx
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
      ),
    ]);

  // ---- Rollups ----
  const approvedCoByProject = new Map<string, number>();
  for (const co of coRows) {
    approvedCoByProject.set(
      co.projectId,
      (approvedCoByProject.get(co.projectId) ?? 0) + co.amountCents,
    );
  }

  const billedByProject = new Map<string, number>();
  for (const d of drawRows) {
    const prev = billedByProject.get(d.projectId) ?? 0;
    if (d.totalCompletedToDateCents > prev) {
      billedByProject.set(d.projectId, d.totalCompletedToDateCents);
    }
  }

  const clientNameByProject = new Map<string, string>();
  for (const row of clientRows) {
    // First active client row wins — a project should only carry one.
    if (!clientNameByProject.has(row.projectId)) {
      clientNameByProject.set(row.projectId, row.clientName);
    }
  }

  const poProjectById = new Map<string, string>();
  for (const po of poRows) poProjectById.set(po.id, po.projectId);

  const costToDateByProject = new Map<string, number>();
  for (const line of poLineRows) {
    const pid = poProjectById.get(line.purchaseOrderId);
    if (!pid) continue;
    const qty = Number.parseFloat(line.quantity);
    const received = Number.parseFloat(line.receivedQuantity);
    const consumedQty = Math.min(received, qty);
    if (consumedQty <= 0) continue;
    const cents = Math.round(consumedQty * line.unitCostCents);
    costToDateByProject.set(
      pid,
      (costToDateByProject.get(pid) ?? 0) + cents,
    );
  }

  const milestonesByProject = new Map<string, typeof msRows>();
  for (const m of msRows) {
    const list = milestonesByProject.get(m.projectId) ?? [];
    list.push(m);
    milestonesByProject.set(m.projectId, list);
  }

  // ---- Per-project row + totals ----
  const rows: WIPRow[] = projectRows.map((p) => {
    const contract = p.contractValueCents ?? 0;
    const approvedCo = approvedCoByProject.get(p.id) ?? 0;
    const contractWithCo = contract + approvedCo;
    const costToDate = costToDateByProject.get(p.id) ?? 0;
    const billed = billedByProject.get(p.id) ?? 0;
    const { pct } = computePercentComplete(
      milestonesByProject.get(p.id) ?? [],
    );
    // computePercentComplete returns 0..100; normalize to 0..1 for
    // downstream math + UI (fmtPct multiplies by 100).
    const pctComplete = (pct ?? 0) / 100;
    const earned = Math.round(contractWithCo * pctComplete);
    const overUnder = earned - billed;
    const backlog = contractWithCo - billed;
    return {
      projectId: p.id,
      projectName: p.name,
      phase: p.phase,
      clientName: clientNameByProject.get(p.id) ?? null,
      contractValueCents: contract,
      approvedCoCents: approvedCo,
      contractWithCoCents: contractWithCo,
      costToDateCents: costToDate,
      percentComplete: pctComplete,
      earnedCents: earned,
      billedCents: billed,
      overUnderCents: overUnder,
      backlogCents: backlog,
    };
  });

  const totals = rows.reduce(
    (a, r) => ({
      contractWithCoCents: a.contractWithCoCents + r.contractWithCoCents,
      costToDateCents: a.costToDateCents + r.costToDateCents,
      earnedCents: a.earnedCents + r.earnedCents,
      billedCents: a.billedCents + r.billedCents,
      overUnderCents: a.overUnderCents + r.overUnderCents,
      backlogCents: a.backlogCents + r.backlogCents,
    }),
    emptyTotals(),
  );

  return { rows, totals, generatedAtIso: now.toISOString() };
}

function emptyTotals(): WIPReportView["totals"] {
  return {
    contractWithCoCents: 0,
    costToDateCents: 0,
    earnedCents: 0,
    billedCents: 0,
    overUnderCents: 0,
    backlogCents: 0,
  };
}
