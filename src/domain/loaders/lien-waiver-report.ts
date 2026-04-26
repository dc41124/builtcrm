import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  drawRequests,
  lienWaivers,
  organizations,
  projects,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import type { SessionLike } from "../context";
import {
  getContractorOrgContext,
  type ContractorOrgContext,
} from "./integrations";

// Lien-waiver log for the Reports page tile (Step 40 / 4D #40 wiring
// for Step 24.5). Lists every waiver across the contractor's portfolio
// with the data needed to spot what's outstanding: status, amount,
// draw#, sub name, requested/accepted dates. The Reports page renders
// this as a filterable table.
//
// Scoped to the caller's contractor org via the same model the other
// portfolio loaders use (cross-project-payments, weekly-reports
// aggregate). Out-of-org waivers never surface here.

export type LienWaiverLogRow = {
  id: string;
  projectId: string;
  projectName: string;
  drawRequestId: string;
  drawNumber: number;
  organizationId: string;
  organizationName: string;
  organizationKind: "contractor" | "sub";
  lienWaiverType: string;
  lienWaiverStatus: string;
  amountCents: number;
  throughDate: Date | null;
  requestedAt: Date | null;
  submittedAt: Date | null;
  acceptedAt: Date | null;
  ageDays: number | null; // since requestedAt
};

export type LienWaiverLogTotals = {
  totalCount: number;
  outstandingCount: number; // status in (requested, submitted)
  outstandingAmountCents: number;
  acceptedCount: number;
  rejectedCount: number;
};

export type LienWaiverLogReport = {
  context: ContractorOrgContext;
  rows: LienWaiverLogRow[];
  totals: LienWaiverLogTotals;
  generatedAtMs: number;
};

const OUTSTANDING_STATUSES = ["requested", "submitted"] as const;

export async function getLienWaiverLogReport(input: {
  session: SessionLike | null | undefined;
}): Promise<LienWaiverLogReport> {
  const ctx = await getContractorOrgContext(input.session);
  const orgId = ctx.organization.id;
  const now = Date.now();

  // Project scope.
  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  if (projectRows.length === 0) {
    return {
      context: ctx,
      rows: [],
      totals: emptyTotals(),
      generatedAtMs: now,
    };
  }
  const projectIds = projectRows.map((p) => p.id);
  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));

  // Every waiver across scoped projects. Contractor scope — multi-org
  // policy clause B (project ownership) returns sub waivers too.
  const rawRows = await withTenant(orgId, (tx) =>
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
      .where(inArray(lienWaivers.projectId, projectIds))
      .orderBy(desc(lienWaivers.requestedAt)),
  );

  if (rawRows.length === 0) {
    return {
      context: ctx,
      rows: [],
      totals: emptyTotals(),
      generatedAtMs: now,
    };
  }

  // Enrichment — draw numbers + organization names in two batched
  // lookups rather than per-row joins.
  const drawIds = Array.from(new Set(rawRows.map((r) => r.drawRequestId)));
  const orgIds = Array.from(new Set(rawRows.map((r) => r.organizationId)));

  const [drawRowsResult, orgRowsResult] = await Promise.all([
    db
      .select({
        id: drawRequests.id,
        drawNumber: drawRequests.drawNumber,
      })
      .from(drawRequests)
      .where(inArray(drawRequests.id, drawIds)),
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        type: organizations.organizationType,
      })
      .from(organizations)
      .where(inArray(organizations.id, orgIds)),
  ]);

  const drawNumberById = new Map(
    drawRowsResult.map((d) => [d.id, d.drawNumber] as const),
  );
  const orgNameById = new Map(
    orgRowsResult.map((o) => [o.id, o.name] as const),
  );
  const orgKindById = new Map(
    orgRowsResult.map(
      (o) =>
        [
          o.id,
          o.type === "contractor"
            ? ("contractor" as const)
            : ("sub" as const),
        ] as const,
    ),
  );

  const rows: LienWaiverLogRow[] = rawRows.map((r) => {
    const ageDays = r.requestedAt
      ? Math.floor((now - r.requestedAt.getTime()) / 86_400_000)
      : null;
    return {
      id: r.id,
      projectId: r.projectId,
      projectName: projectNameById.get(r.projectId) ?? "Unknown project",
      drawRequestId: r.drawRequestId,
      drawNumber: drawNumberById.get(r.drawRequestId) ?? 0,
      organizationId: r.organizationId,
      organizationName:
        orgNameById.get(r.organizationId) ?? "Unknown organization",
      organizationKind: orgKindById.get(r.organizationId) ?? "sub",
      lienWaiverType: r.lienWaiverType,
      lienWaiverStatus: r.lienWaiverStatus,
      amountCents: r.amountCents,
      throughDate: r.throughDate,
      requestedAt: r.requestedAt,
      submittedAt: r.submittedAt,
      acceptedAt: r.acceptedAt,
      ageDays,
    };
  });

  // Totals.
  const totals = computeTotals(rows);

  return {
    context: ctx,
    rows,
    totals,
    generatedAtMs: now,
  };
}

function computeTotals(rows: LienWaiverLogRow[]): LienWaiverLogTotals {
  let outstandingCount = 0;
  let outstandingAmountCents = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  for (const r of rows) {
    if (
      (OUTSTANDING_STATUSES as readonly string[]).includes(r.lienWaiverStatus)
    ) {
      outstandingCount += 1;
      outstandingAmountCents += r.amountCents;
    } else if (r.lienWaiverStatus === "accepted") {
      acceptedCount += 1;
    } else if (r.lienWaiverStatus === "rejected") {
      rejectedCount += 1;
    }
  }
  return {
    totalCount: rows.length,
    outstandingCount,
    outstandingAmountCents,
    acceptedCount,
    rejectedCount,
  };
}

function emptyTotals(): LienWaiverLogTotals {
  return {
    totalCount: 0,
    outstandingCount: 0,
    outstandingAmountCents: 0,
    acceptedCount: 0,
    rejectedCount: 0,
  };
}

