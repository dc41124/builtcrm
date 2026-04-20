import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  projects,
  purchaseOrderLines,
  purchaseOrders,
} from "@/db/schema";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// Job Cost loader (Step 24.5 wiring).
//
// One row per project with four canonical cost columns:
//   budget    — source-of-truth approved budget
//   committed — dollars locked into POs/contracts (expected spend)
//   actual    — dollars already delivered (received PO lines)
//   projected — best-estimate final cost
//
// Budget source: projects.contractValueCents. That's the CONTRACT value,
// not the COST budget — a production-grade service would surface a separate
// `project_budget_line_items` source of truth (see
// docs/specs/production_grade_upgrades/wip_cost_based_percent_complete.md).
// Until that ships, using the contract as a budget proxy makes the report
// meaningful for a demo while clearly over-stating the denominator.
//
// Projected = max(committed, actual). This is an honest floor — the final
// cost won't be less than what's already spent or already committed. It
// understates: the real "estimate at completion" = actual + ETC, and ETC
// requires a forecast that doesn't live in the schema yet.
//
// Per-PO handling:
//   - cancelled / closed: cap committed at actual (no more $$ on that PO)
//   - draft: skip entirely (not yet committed)
//   - everything else: committed = quantity × unitCost per line,
//     actual = min(received, quantity) × unitCost

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type JobCostRow = {
  projectId: string;
  projectName: string;
  budgetCents: number;
  committedCents: number;
  actualCents: number;
  projectedCents: number;
  varianceCents: number;       // projected - budget (positive = overrun)
  variancePct: number;         // variance / budget
  costUsedPct: number;         // actual / budget
};

export type JobCostReportView = {
  rows: JobCostRow[];
  totals: {
    budgetCents: number;
    committedCents: number;
    actualCents: number;
    projectedCents: number;
    varianceCents: number;
  };
  generatedAtIso: string;
};

type LoaderInput = { session: SessionLike | null | undefined };

// PO statuses that contribute to committed + actual.
// Draft = nothing locked in yet. Cancelled = capped at received (see rollup).
const ACTIVE_PO_STATUSES = [
  "issued",
  "revised",
  "partially_received",
  "fully_received",
  "invoiced",
  "closed",
  "cancelled",
] as const;

// Statuses that treat committed as capped at actual ("no more money will flow").
const COMMITTED_CAPPED_STATUSES = new Set(["cancelled"]);

export async function getJobCostReport(
  input: LoaderInput,
): Promise<JobCostReportView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) {
    return { rows: [], totals: emptyTotals(), generatedAtIso: now.toISOString() };
  }

  // Fetch POs + lines for these projects. Use innerJoin so the line scan is
  // bounded to the contractor's POs.
  const [poRows, poLineRows] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        projectId: purchaseOrders.projectId,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          inArray(purchaseOrders.projectId, projectIds),
          inArray(purchaseOrders.status, [...ACTIVE_PO_STATUSES]),
        ),
      ),
    db
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
          inArray(purchaseOrders.status, [...ACTIVE_PO_STATUSES]),
        ),
      ),
  ]);

  // Index PO → (projectId, status)
  const poMeta = new Map<string, { projectId: string; status: string }>();
  for (const po of poRows) {
    poMeta.set(po.id, { projectId: po.projectId, status: po.status });
  }

  // Rollup per project: committed + actual cents.
  const committedByProject = new Map<string, number>();
  const actualByProject = new Map<string, number>();
  for (const line of poLineRows) {
    const meta = poMeta.get(line.purchaseOrderId);
    if (!meta) continue;
    const qty = Number.parseFloat(line.quantity);
    const received = Number.parseFloat(line.receivedQuantity);
    const consumedQty = Math.min(received, qty);
    const lineActualCents = Math.round(consumedQty * line.unitCostCents);
    const lineCommittedCents = COMMITTED_CAPPED_STATUSES.has(meta.status)
      ? lineActualCents
      : Math.round(qty * line.unitCostCents);

    committedByProject.set(
      meta.projectId,
      (committedByProject.get(meta.projectId) ?? 0) + lineCommittedCents,
    );
    actualByProject.set(
      meta.projectId,
      (actualByProject.get(meta.projectId) ?? 0) + lineActualCents,
    );
  }

  // Build rows + totals
  const rows: JobCostRow[] = projectRows
    .map((p) => {
      const budget = p.contractValueCents ?? 0;
      const committed = committedByProject.get(p.id) ?? 0;
      const actual = actualByProject.get(p.id) ?? 0;
      const projected = Math.max(committed, actual);
      const variance = projected - budget;
      return {
        projectId: p.id,
        projectName: p.name,
        budgetCents: budget,
        committedCents: committed,
        actualCents: actual,
        projectedCents: projected,
        varianceCents: variance,
        variancePct: budget > 0 ? variance / budget : 0,
        costUsedPct: budget > 0 ? actual / budget : 0,
      };
    })
    // Hide projects with no meaningful cost signal at all — no budget, no
    // committed, no actual. They'd render as a row of zeros.
    .filter(
      (r) =>
        r.budgetCents > 0 ||
        r.committedCents > 0 ||
        r.actualCents > 0,
    )
    .sort((a, b) => b.projectedCents - a.projectedCents);

  const totals = rows.reduce(
    (a, r) => ({
      budgetCents: a.budgetCents + r.budgetCents,
      committedCents: a.committedCents + r.committedCents,
      actualCents: a.actualCents + r.actualCents,
      projectedCents: a.projectedCents + r.projectedCents,
      varianceCents: a.varianceCents + r.varianceCents,
    }),
    emptyTotals(),
  );

  return { rows, totals, generatedAtIso: now.toISOString() };
}

function emptyTotals(): JobCostReportView["totals"] {
  return {
    budgetCents: 0,
    committedCents: 0,
    actualCents: 0,
    projectedCents: 0,
    varianceCents: 0,
  };
}
