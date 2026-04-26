import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  activityFeedItems,
  approvals,
  documentLinks,
  documents,
  organizations,
  projects,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

export type ApprovalSupportingDoc = {
  id: string;
  title: string;
  documentType: string;
  linkRole: string;
};

export type ApprovalActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  actorName: string | null;
  createdAt: Date;
};

export type ApprovalRow = {
  id: string;
  approvalNumber: number;
  category: string;
  title: string;
  description: string | null;
  approvalStatus: string;
  impactCostCents: number;
  impactScheduleDays: number;
  submittedAt: Date | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  requestedByName: string | null;
  decidedByName: string | null;
  assignedToOrganizationName: string | null;
  createdAt: Date;
  updatedAt: Date;
  supportingDocuments: ApprovalSupportingDoc[];
  activityTrail: ApprovalActivityEvent[];
};

export type ApprovalTotals = {
  total: number;
  pending: number;
  overdue: number;
  approvedThisPeriod: number;
  returned: number;
  pendingCostCents: number;
};

export type ContractorApprovalView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  rows: ApprovalRow[];
  totals: ApprovalTotals;
};

export type ClientApprovalView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  isResidential: boolean;
  rows: ApprovalRow[];
  totals: ApprovalTotals;
  originalContractCents: number;
};

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

const CLIENT_VISIBLE_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "needs_revision",
] as const;

async function loadApprovalEnrichment(
  approvalIds: string[],
  callerOrgId: string,
): Promise<{
  docsById: Map<string, ApprovalSupportingDoc[]>;
  activityById: Map<string, ApprovalActivityEvent[]>;
}> {
  const docsById = new Map<string, ApprovalSupportingDoc[]>();
  const activityById = new Map<string, ApprovalActivityEvent[]>();
  if (approvalIds.length === 0) return { docsById, activityById };

  const [docRows, activityRows] = await withTenant(callerOrgId, (tx) =>
    Promise.all([
      tx
        .select({
          linkedObjectId: documentLinks.linkedObjectId,
          documentId: documents.id,
          title: documents.title,
          documentType: documents.documentType,
          linkRole: documentLinks.linkRole,
        })
        .from(documentLinks)
        .innerJoin(documents, eq(documents.id, documentLinks.documentId))
        .where(
          and(
            eq(documentLinks.linkedObjectType, "approval"),
            inArray(documentLinks.linkedObjectId, approvalIds),
          ),
        ),
      tx
        .select({
        id: activityFeedItems.id,
        relatedObjectId: activityFeedItems.relatedObjectId,
        title: activityFeedItems.title,
        body: activityFeedItems.body,
        activityType: activityFeedItems.activityType,
        createdAt: activityFeedItems.createdAt,
        actorName: users.displayName,
      })
        .from(activityFeedItems)
        .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
        .where(
          and(
            eq(activityFeedItems.relatedObjectType, "approval"),
            inArray(activityFeedItems.relatedObjectId, approvalIds),
          ),
        )
        .orderBy(desc(activityFeedItems.createdAt)),
    ]),
  );

  for (const d of docRows) {
    const arr = docsById.get(d.linkedObjectId) ?? [];
    arr.push({
      id: d.documentId,
      title: d.title,
      documentType: d.documentType,
      linkRole: d.linkRole,
    });
    docsById.set(d.linkedObjectId, arr);
  }

  for (const a of activityRows) {
    if (!a.relatedObjectId) continue;
    const arr = activityById.get(a.relatedObjectId) ?? [];
    arr.push({
      id: a.id,
      title: a.title,
      body: a.body,
      activityType: a.activityType,
      actorName: a.actorName,
      createdAt: a.createdAt,
    });
    activityById.set(a.relatedObjectId, arr);
  }

  return { docsById, activityById };
}

async function loadRows(
  projectId: string,
  clientScoped: boolean,
  callerOrgId: string,
): Promise<ApprovalRow[]> {
  const baseWhere = clientScoped
    ? and(
        eq(approvals.projectId, projectId),
        inArray(approvals.approvalStatus, [...CLIENT_VISIBLE_STATUSES]),
        isNotNull(approvals.submittedAt),
      )
    : eq(approvals.projectId, projectId);

  // approvals is not RLS-enabled (deferred); user/org lookups are also
  // not RLS-enabled. dbAdmin is fine here for the parent set.
  const rows = await dbAdmin
    .select({
      id: approvals.id,
      approvalNumber: approvals.approvalNumber,
      category: approvals.category,
      title: approvals.title,
      description: approvals.description,
      approvalStatus: approvals.approvalStatus,
      impactCostCents: approvals.impactCostCents,
      impactScheduleDays: approvals.impactScheduleDays,
      submittedAt: approvals.submittedAt,
      decidedAt: approvals.decidedAt,
      decisionNote: approvals.decisionNote,
      requestedByUserId: approvals.requestedByUserId,
      decidedByUserId: approvals.decidedByUserId,
      assignedToOrganizationId: approvals.assignedToOrganizationId,
      createdAt: approvals.createdAt,
      updatedAt: approvals.updatedAt,
    })
    .from(approvals)
    .where(baseWhere)
    .orderBy(desc(approvals.approvalNumber));

  const userIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.requestedByUserId, r.decidedByUserId].filter(
          (v): v is string => !!v,
        ),
      ),
    ),
  );
  const nameMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const uRows = await dbAdmin
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of uRows) nameMap.set(u.id, u.displayName);
  }

  const orgIds = Array.from(
    new Set(
      rows
        .map((r) => r.assignedToOrganizationId)
        .filter((v): v is string => !!v),
    ),
  );
  const orgMap = new Map<string, string>();
  if (orgIds.length > 0) {
    const oRows = await dbAdmin
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
    for (const o of oRows) orgMap.set(o.id, o.name);
  }

  const { docsById, activityById } = await loadApprovalEnrichment(
    rows.map((r) => r.id),
    callerOrgId,
  );

  return rows.map<ApprovalRow>((r) => ({
    id: r.id,
    approvalNumber: r.approvalNumber,
    category: r.category,
    title: r.title,
    description: r.description,
    approvalStatus: r.approvalStatus,
    impactCostCents: r.impactCostCents,
    impactScheduleDays: r.impactScheduleDays,
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt,
    decisionNote: r.decisionNote,
    requestedByName: r.requestedByUserId
      ? nameMap.get(r.requestedByUserId) ?? null
      : null,
    decidedByName: r.decidedByUserId
      ? nameMap.get(r.decidedByUserId) ?? null
      : null,
    assignedToOrganizationName: r.assignedToOrganizationId
      ? orgMap.get(r.assignedToOrganizationId) ?? null
      : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    supportingDocuments: docsById.get(r.id) ?? [],
    activityTrail: activityById.get(r.id) ?? [],
  }));
}

function computeTotals(rows: ApprovalRow[]): ApprovalTotals {
  const now = Date.now();
  const threeDaysMs = 3 * 86400000;
  const thirtyDaysMs = 30 * 86400000;

  let pending = 0;
  let overdue = 0;
  let approvedThisPeriod = 0;
  let returned = 0;
  let pendingCostCents = 0;

  for (const r of rows) {
    if (r.approvalStatus === "pending_review") {
      pending += 1;
      pendingCostCents += r.impactCostCents;
      if (r.submittedAt && now - r.submittedAt.getTime() > threeDaysMs) {
        overdue += 1;
      }
    } else if (r.approvalStatus === "approved") {
      if (r.decidedAt && now - r.decidedAt.getTime() <= thirtyDaysMs) {
        approvedThisPeriod += 1;
      }
    } else if (r.approvalStatus === "needs_revision") {
      returned += 1;
    }
  }

  return {
    total: rows.length,
    pending,
    overdue,
    approvedThisPeriod,
    returned,
    pendingCostCents,
  };
}

async function loadContractValueCents(projectId: string): Promise<number> {
  const [row] = await dbAdmin
    .select({ contractValueCents: projects.contractValueCents })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.contractValueCents ?? 0;
}

export async function getContractorApprovals(
  input: LoaderInput,
): Promise<ContractorApprovalView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (context.role !== "contractor_admin" && context.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Contractor approvals view requires a contractor role",
      "forbidden",
    );
  }
  const rows = await loadRows(context.project.id, false, context.organization.id);
  return {
    context,
    project: context.project,
    rows,
    totals: computeTotals(rows),
  };
}

export async function getClientApprovals(
  input: LoaderInput,
): Promise<ClientApprovalView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "commercial_client" &&
    context.role !== "residential_client"
  ) {
    throw new AuthorizationError(
      "Client approvals view requires a client role",
      "forbidden",
    );
  }
  const projectId = context.project.id;
  const [rows, originalContractCents] = await Promise.all([
    loadRows(projectId, true, context.organization.id),
    loadContractValueCents(projectId),
  ]);
  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    rows,
    totals: computeTotals(rows),
    originalContractCents,
  };
}
