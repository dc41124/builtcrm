import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  activityFeedItems,
  changeOrders,
  documentLinks,
  documents,
  projects,
  rfis,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

export type ChangeOrderSupportingDoc = {
  id: string;
  title: string;
  documentType: string;
  linkRole: string;
};

export type ChangeOrderActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  actorName: string | null;
  createdAt: Date;
};

export type ChangeOrderRow = {
  id: string;
  changeOrderNumber: number;
  title: string;
  description: string | null;
  reason: string | null;
  changeOrderStatus: string;
  amountCents: number;
  scheduleImpactDays: number;
  originatingRfiId: string | null;
  originatingRfiNumber: number | null;
  requestedByName: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  supportingDocuments: ChangeOrderSupportingDoc[];
  activityTrail: ChangeOrderActivityEvent[];
};

export type ChangeOrderTotals = {
  originalContractCents: number;
  approvedChangesCents: number;
  pendingChangesCents: number;
  currentContractCents: number;
};

export type ContractorChangeOrderView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  rows: ChangeOrderRow[];
  totals: ChangeOrderTotals;
};

export type ClientChangeOrderView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  isResidential: boolean;
  rows: ChangeOrderRow[];
  totals: ChangeOrderTotals;
};

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

async function loadRows(projectId: string, clientScoped: boolean) {
  const baseWhere = clientScoped
    ? and(
        eq(changeOrders.projectId, projectId),
        inArray(changeOrders.changeOrderStatus, [
          "pending_client_approval",
          "approved",
          "rejected",
        ]),
      )
    : eq(changeOrders.projectId, projectId);

  const rows = await db
    .select({
      id: changeOrders.id,
      changeOrderNumber: changeOrders.changeOrderNumber,
      title: changeOrders.title,
      description: changeOrders.description,
      reason: changeOrders.reason,
      changeOrderStatus: changeOrders.changeOrderStatus,
      amountCents: changeOrders.amountCents,
      scheduleImpactDays: changeOrders.scheduleImpactDays,
      originatingRfiId: changeOrders.originatingRfiId,
      originatingRfiNumber: rfis.sequentialNumber,
      requestedByUserId: changeOrders.requestedByUserId,
      approvedByUserId: changeOrders.approvedByUserId,
      approvedAt: changeOrders.approvedAt,
      rejectedAt: changeOrders.rejectedAt,
      rejectionReason: changeOrders.rejectionReason,
      submittedAt: changeOrders.submittedAt,
      createdAt: changeOrders.createdAt,
      updatedAt: changeOrders.updatedAt,
    })
    .from(changeOrders)
    .leftJoin(rfis, eq(rfis.id, changeOrders.originatingRfiId))
    .where(baseWhere)
    .orderBy(desc(changeOrders.changeOrderNumber));

  if (rows.length === 0) return [];

  const coIds = rows.map((r) => r.id);

  const userIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.requestedByUserId, r.approvedByUserId].filter(
          (v): v is string => !!v,
        ),
      ),
    ),
  );
  const nameMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const uRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of uRows) nameMap.set(u.id, u.displayName);
  }

  // Supporting docs: join document_links → documents, filter to this CO set
  const docRows = await db
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
        eq(documentLinks.linkedObjectType, "change_order"),
        inArray(documentLinks.linkedObjectId, coIds),
      ),
    );
  const docsByCo = new Map<string, ChangeOrderSupportingDoc[]>();
  for (const d of docRows) {
    const arr = docsByCo.get(d.linkedObjectId) ?? [];
    arr.push({
      id: d.documentId,
      title: d.title,
      documentType: d.documentType,
      linkRole: d.linkRole,
    });
    docsByCo.set(d.linkedObjectId, arr);
  }

  // Activity trail: filter to events that reference each CO
  const activityRows = await db
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
        eq(activityFeedItems.relatedObjectType, "change_order"),
        inArray(activityFeedItems.relatedObjectId, coIds),
      ),
    )
    .orderBy(asc(activityFeedItems.createdAt));
  const activityByCo = new Map<string, ChangeOrderActivityEvent[]>();
  for (const a of activityRows) {
    if (!a.relatedObjectId) continue;
    const arr = activityByCo.get(a.relatedObjectId) ?? [];
    arr.push({
      id: a.id,
      title: a.title,
      body: a.body,
      activityType: a.activityType,
      actorName: a.actorName,
      createdAt: a.createdAt,
    });
    activityByCo.set(a.relatedObjectId, arr);
  }

  return rows.map<ChangeOrderRow>((r) => ({
    id: r.id,
    changeOrderNumber: r.changeOrderNumber,
    title: r.title,
    description: r.description,
    reason: r.reason,
    changeOrderStatus: r.changeOrderStatus,
    amountCents: r.amountCents,
    scheduleImpactDays: r.scheduleImpactDays,
    originatingRfiId: r.originatingRfiId,
    originatingRfiNumber: r.originatingRfiNumber,
    requestedByName: r.requestedByUserId
      ? nameMap.get(r.requestedByUserId) ?? null
      : null,
    approvedByName: r.approvedByUserId
      ? nameMap.get(r.approvedByUserId) ?? null
      : null,
    approvedAt: r.approvedAt,
    rejectedAt: r.rejectedAt,
    rejectionReason: r.rejectionReason,
    submittedAt: r.submittedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    supportingDocuments: docsByCo.get(r.id) ?? [],
    activityTrail: activityByCo.get(r.id) ?? [],
  }));
}

function computeTotals(
  originalContractCents: number,
  rows: ChangeOrderRow[],
): ChangeOrderTotals {
  let approvedChangesCents = 0;
  let pendingChangesCents = 0;
  for (const r of rows) {
    if (r.changeOrderStatus === "approved") approvedChangesCents += r.amountCents;
    else if (
      r.changeOrderStatus === "pending_client_approval" ||
      r.changeOrderStatus === "pending_review"
    )
      pendingChangesCents += r.amountCents;
  }
  return {
    originalContractCents,
    approvedChangesCents,
    pendingChangesCents,
    currentContractCents: originalContractCents + approvedChangesCents,
  };
}

async function loadContractValueCents(projectId: string): Promise<number> {
  const [row] = await db
    .select({ contractValueCents: projects.contractValueCents })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.contractValueCents ?? 0;
}

export async function getContractorChangeOrders(
  input: LoaderInput,
): Promise<ContractorChangeOrderView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (context.role !== "contractor_admin" && context.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Contractor change orders view requires a contractor role",
      "forbidden",
    );
  }
  const projectId = context.project.id;
  const [rows, originalContractCents] = await Promise.all([
    loadRows(projectId, false),
    loadContractValueCents(projectId),
  ]);
  return {
    context,
    project: context.project,
    rows,
    totals: computeTotals(originalContractCents, rows),
  };
}

export async function getClientChangeOrders(
  input: LoaderInput,
): Promise<ClientChangeOrderView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "commercial_client" &&
    context.role !== "residential_client"
  ) {
    throw new AuthorizationError(
      "Client change orders view requires a client role",
      "forbidden",
    );
  }
  const projectId = context.project.id;
  const [rows, originalContractCents] = await Promise.all([
    loadRows(projectId, true),
    loadContractValueCents(projectId),
  ]);
  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    rows,
    totals: computeTotals(originalContractCents, rows),
  };
}
