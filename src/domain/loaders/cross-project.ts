import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import { approvals, organizations, projects, users } from "@/db/schema";

import type { SessionLike } from "../context";
import {
  getContractorOrgContext,
  type ContractorOrgContext,
} from "./integrations";

// Cross-project loaders for the contractor portfolio surfaces in Phase 4D.
// Every query here is scoped to the caller's contractor organization —
// never "all approvals in the DB". The authoritative filter is
// `projects.contractor_organization_id = <caller's contractor org>`,
// matching the same access model the reports loader uses.

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type DerivedPriority = "high" | "medium" | "low";

export type CrossProjectApprovalRow = {
  id: string;
  projectId: string;
  projectName: string;
  approvalNumber: number;
  category: string;
  title: string;
  description: string | null;
  impactCostCents: number;
  impactScheduleDays: number;
  submittedAt: Date | null;
  requestedByName: string | null;
  assignedToOrganizationName: string | null;
  priority: DerivedPriority;
  ageDays: number | null;
};

export type CrossProjectApprovalTotals = {
  totalPending: number;
  overdue: number;
  oldestAgeDays: number | null;
  byCategory: Record<string, number>;
  byPriority: Record<DerivedPriority, number>;
};

export type ProjectOption = {
  id: string;
  name: string;
};

export type ContractorCrossProjectApprovalsView = {
  context: ContractorOrgContext;
  rows: CrossProjectApprovalRow[];
  totals: CrossProjectApprovalTotals;
  projectOptions: ProjectOption[];
  generatedAtMs: number;
};

type LoaderInput = { session: SessionLike | null | undefined };

// Derived-priority thresholds. Kept as module-level constants so they can
// be tuned in one place without combing every call site.
const HIGH_IMPACT_CENTS = 5_000_000; // $50k
const HIGH_IMPACT_SCHEDULE_DAYS = 5;
const OVERDUE_DAYS = 3;
const DUE_SOON_DAYS = 2;

// --------------------------------------------------------------------------
// Loader
// --------------------------------------------------------------------------

export async function getContractorCrossProjectApprovals(
  input: LoaderInput,
): Promise<ContractorCrossProjectApprovalsView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = Date.now();

  // Project scope — every project the caller's contractor org owns.
  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));

  if (projectRows.length === 0) {
    return {
      context,
      rows: [],
      totals: emptyTotals(),
      projectOptions: [],
      generatedAtMs: now,
    };
  }

  const projectIds = projectRows.map((p) => p.id);
  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));

  // Every pending approval across those projects. `pending_review` implies
  // `submitted_at IS NOT NULL` by workflow, but the isNotNull guard keeps
  // the age math safe if a row slips through with unexpected state.
  const rawRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: approvals.id,
        projectId: approvals.projectId,
        approvalNumber: approvals.approvalNumber,
        category: approvals.category,
        title: approvals.title,
        description: approvals.description,
        impactCostCents: approvals.impactCostCents,
        impactScheduleDays: approvals.impactScheduleDays,
        submittedAt: approvals.submittedAt,
        requestedByUserId: approvals.requestedByUserId,
        assignedToOrganizationId: approvals.assignedToOrganizationId,
      })
      .from(approvals)
      .where(
        and(
          inArray(approvals.projectId, projectIds),
          eq(approvals.approvalStatus, "pending_review"),
          isNotNull(approvals.submittedAt),
        ),
      ),
  );

  // Enrichment — requester display names + assigned-org names. Two small
  // parallel lookups rather than a join per row.
  const userIds = Array.from(
    new Set(rawRows.map((r) => r.requestedByUserId).filter((v): v is string => !!v)),
  );
  const assignedOrgIds = Array.from(
    new Set(
      rawRows
        .map((r) => r.assignedToOrganizationId)
        .filter((v): v is string => !!v),
    ),
  );

  const [userRows, orgRows] = await Promise.all([
    userIds.length > 0
      ? db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([] as Array<{ id: string; displayName: string | null }>),
    assignedOrgIds.length > 0
      ? db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, assignedOrgIds))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ]);

  const userNameById = new Map(userRows.map((u) => [u.id, u.displayName]));
  const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

  const rows: CrossProjectApprovalRow[] = rawRows.map((r) => {
    const ageDays = r.submittedAt
      ? Math.floor((now - r.submittedAt.getTime()) / 86_400_000)
      : null;
    const priority = derivePriority(
      ageDays,
      r.impactCostCents,
      r.impactScheduleDays,
    );
    return {
      id: r.id,
      projectId: r.projectId,
      projectName: projectNameById.get(r.projectId) ?? "Unknown project",
      approvalNumber: r.approvalNumber,
      category: r.category,
      title: r.title,
      description: r.description,
      impactCostCents: r.impactCostCents,
      impactScheduleDays: r.impactScheduleDays,
      submittedAt: r.submittedAt,
      requestedByName: r.requestedByUserId
        ? userNameById.get(r.requestedByUserId) ?? null
        : null,
      assignedToOrganizationName: r.assignedToOrganizationId
        ? orgNameById.get(r.assignedToOrganizationId) ?? null
        : null,
      priority,
      ageDays,
    };
  });

  // Sort newest-worst first — overdue at the top, then medium, then fresh.
  // Within each bucket, sort by age desc.
  rows.sort((a, b) => {
    const priorityRank = { high: 0, medium: 1, low: 2 } as const;
    const dp = priorityRank[a.priority] - priorityRank[b.priority];
    if (dp !== 0) return dp;
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });

  // Totals
  const byCategory: Record<string, number> = {};
  const byPriority: Record<DerivedPriority, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  let overdue = 0;
  let oldestAgeDays: number | null = null;
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byPriority[r.priority] += 1;
    if (r.ageDays != null && r.ageDays > OVERDUE_DAYS) overdue += 1;
    if (
      r.ageDays != null &&
      (oldestAgeDays == null || r.ageDays > oldestAgeDays)
    ) {
      oldestAgeDays = r.ageDays;
    }
  }

  // Project options for the filter bar — only projects that actually have
  // pending approvals, so the dropdown stays short.
  const pendingProjectIds = new Set(rows.map((r) => r.projectId));
  const projectOptions: ProjectOption[] = projectRows
    .filter((p) => pendingProjectIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    context,
    rows,
    totals: {
      totalPending: rows.length,
      overdue,
      oldestAgeDays,
      byCategory,
      byPriority,
    },
    projectOptions,
    generatedAtMs: now,
  };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function derivePriority(
  ageDays: number | null,
  impactCostCents: number,
  impactScheduleDays: number,
): DerivedPriority {
  const bigImpact =
    impactCostCents > HIGH_IMPACT_CENTS ||
    impactScheduleDays > HIGH_IMPACT_SCHEDULE_DAYS;
  const overdue = ageDays != null && ageDays > OVERDUE_DAYS;
  if (overdue || bigImpact) return "high";
  const dueSoon = ageDays != null && ageDays > DUE_SOON_DAYS;
  if (dueSoon) return "medium";
  return "low";
}

function emptyTotals(): CrossProjectApprovalTotals {
  return {
    totalPending: 0,
    overdue: 0,
    oldestAgeDays: null,
    byCategory: {},
    byPriority: { high: 0, medium: 0, low: 0 },
  };
}
