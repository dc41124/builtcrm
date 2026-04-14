import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  approvals,
  changeOrders,
  drawRequests,
  milestones,
  projectUserMemberships,
  rfiResponses,
  rfis,
  uploadRequests,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

// Fetches RFIs for a project (optionally scoped by assigned org) with their
// responses + responder display names folded in. Two queries, grouped in JS.
async function loadRfisWithResponses(
  projectId: string,
  opts: { assignedToOrganizationId?: string } = {},
): Promise<RfiRow[]> {
  const whereClause = opts.assignedToOrganizationId
    ? and(
        eq(rfis.projectId, projectId),
        eq(rfis.assignedToOrganizationId, opts.assignedToOrganizationId),
      )
    : eq(rfis.projectId, projectId);

  const rfiRows = await db
    .select({
      id: rfis.id,
      sequentialNumber: rfis.sequentialNumber,
      subject: rfis.subject,
      body: rfis.body,
      rfiStatus: rfis.rfiStatus,
      assignedToOrganizationId: rfis.assignedToOrganizationId,
      assignedToUserId: rfis.assignedToUserId,
      dueAt: rfis.dueAt,
      respondedAt: rfis.respondedAt,
      closedAt: rfis.closedAt,
      drawingReference: rfis.drawingReference,
      specificationReference: rfis.specificationReference,
      locationDescription: rfis.locationDescription,
      createdAt: rfis.createdAt,
    })
    .from(rfis)
    .where(whereClause)
    .orderBy(desc(rfis.createdAt));

  if (rfiRows.length === 0) return [];

  const ids = rfiRows.map((r) => r.id);
  const responseRows = await db
    .select({
      id: rfiResponses.id,
      rfiId: rfiResponses.rfiId,
      body: rfiResponses.body,
      respondedByUserId: rfiResponses.respondedByUserId,
      respondedByName: users.displayName,
      isOfficialResponse: rfiResponses.isOfficialResponse,
      createdAt: rfiResponses.createdAt,
    })
    .from(rfiResponses)
    .leftJoin(users, eq(users.id, rfiResponses.respondedByUserId))
    .where(inArray(rfiResponses.rfiId, ids))
    .orderBy(asc(rfiResponses.createdAt));

  const grouped = new Map<string, RfiResponseRow[]>();
  for (const r of responseRows) {
    const arr = grouped.get(r.rfiId) ?? [];
    arr.push({
      id: r.id,
      body: r.body,
      respondedByUserId: r.respondedByUserId,
      respondedByName: r.respondedByName,
      isOfficialResponse: r.isOfficialResponse,
      createdAt: r.createdAt,
    });
    grouped.set(r.rfiId, arr);
  }

  return rfiRows.map((r) => ({ ...r, responses: grouped.get(r.id) ?? [] }));
}

export type RfiResponseRow = {
  id: string;
  body: string;
  respondedByUserId: string;
  respondedByName: string | null;
  isOfficialResponse: boolean;
  createdAt: Date;
};

export type RfiRow = {
  id: string;
  sequentialNumber: number;
  subject: string;
  body: string | null;
  rfiStatus: string;
  assignedToOrganizationId: string | null;
  assignedToUserId: string | null;
  dueAt: Date | null;
  respondedAt: Date | null;
  closedAt: Date | null;
  drawingReference: string | null;
  specificationReference: string | null;
  locationDescription: string | null;
  createdAt: Date;
  responses: RfiResponseRow[];
};

export type ContractorProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  teamCount: number;
  milestones: Array<{
    id: string;
    title: string;
    milestoneStatus: string;
    scheduledDate: Date;
  }>;
  rfis: RfiRow[];
  changeOrders: Array<{ id: string; title: string; changeOrderStatus: string }>;
  drawRequests: Array<{
    id: string;
    drawNumber: number;
    drawRequestStatus: string;
    currentPaymentDueCents: number;
  }>;
  uploadRequests: Array<{
    id: string;
    title: string;
    requestStatus: string;
    requestedFromOrganizationId: string | null;
    expectedFileType: string | null;
    dueAt: Date | null;
    submittedDocumentId: string | null;
  }>;
  approvals: Array<{
    id: string;
    approvalNumber: number;
    title: string;
    category: string;
    approvalStatus: string;
    impactCostCents: number;
    impactScheduleDays: number;
    decisionNote: string | null;
  }>;
};

export async function getContractorProjectView(
  input: LoaderInput,
): Promise<ContractorProjectView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "contractor_admin" &&
    context.role !== "contractor_pm"
  ) {
    throw new AuthorizationError(
      "Contractor project view requires a contractor role",
      "forbidden",
    );
  }
  const projectId = context.project.id;

  const [
    milestoneRows,
    rfiRows,
    coRows,
    drawRows,
    teamRows,
    uploadRequestRows,
    approvalRows,
  ] = await Promise.all([
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        milestoneStatus: milestones.milestoneStatus,
        scheduledDate: milestones.scheduledDate,
      })
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(milestones.scheduledDate),
    loadRfisWithResponses(projectId),
    db
      .select({
        id: changeOrders.id,
        title: changeOrders.title,
        changeOrderStatus: changeOrders.changeOrderStatus,
      })
      .from(changeOrders)
      .where(eq(changeOrders.projectId, projectId))
      .orderBy(desc(changeOrders.createdAt)),
    db
      .select({
        id: drawRequests.id,
        drawNumber: drawRequests.drawNumber,
        drawRequestStatus: drawRequests.drawRequestStatus,
        currentPaymentDueCents: drawRequests.currentPaymentDueCents,
      })
      .from(drawRequests)
      .where(eq(drawRequests.projectId, projectId))
      .orderBy(desc(drawRequests.drawNumber)),
    db
      .select({ id: projectUserMemberships.id })
      .from(projectUserMemberships)
      .where(eq(projectUserMemberships.projectId, projectId)),
    db
      .select({
        id: uploadRequests.id,
        title: uploadRequests.title,
        requestStatus: uploadRequests.requestStatus,
        requestedFromOrganizationId: uploadRequests.requestedFromOrganizationId,
        expectedFileType: uploadRequests.expectedFileType,
        dueAt: uploadRequests.dueAt,
        submittedDocumentId: uploadRequests.submittedDocumentId,
      })
      .from(uploadRequests)
      .where(eq(uploadRequests.projectId, projectId))
      .orderBy(desc(uploadRequests.createdAt)),
    db
      .select({
        id: approvals.id,
        approvalNumber: approvals.approvalNumber,
        title: approvals.title,
        category: approvals.category,
        approvalStatus: approvals.approvalStatus,
        impactCostCents: approvals.impactCostCents,
        impactScheduleDays: approvals.impactScheduleDays,
        decisionNote: approvals.decisionNote,
      })
      .from(approvals)
      .where(eq(approvals.projectId, projectId))
      .orderBy(desc(approvals.createdAt)),
  ]);

  return {
    context,
    project: context.project,
    teamCount: teamRows.length,
    milestones: milestoneRows,
    rfis: rfiRows,
    changeOrders: coRows,
    drawRequests: drawRows,
    uploadRequests: uploadRequestRows,
    approvals: approvalRows,
  };
}

export type SubcontractorProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  scope: { workScope: string | null; phaseScope: string | null };
  assignedRfis: RfiRow[];
  assignedChangeOrders: Array<{
    id: string;
    title: string;
    changeOrderStatus: string;
  }>;
  myMilestones: Array<{
    id: string;
    title: string;
    milestoneStatus: string;
    scheduledDate: Date;
  }>;
  pendingUploadRequests: Array<{
    id: string;
    title: string;
    description: string | null;
    requestStatus: string;
    expectedFileType: string | null;
    dueAt: Date | null;
    revisionNote: string | null;
  }>;
};

export async function getSubcontractorProjectView(
  input: LoaderInput,
): Promise<SubcontractorProjectView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (context.role !== "subcontractor_user") {
    throw new AuthorizationError(
      "Subcontractor project view requires a subcontractor role",
      "forbidden",
    );
  }
  const projectId = context.project.id;
  const subOrgId = context.organization.id;

  const [rfiRows, coRows, milestoneRows, pendingRows] = await Promise.all([
    loadRfisWithResponses(projectId, { assignedToOrganizationId: subOrgId }),
    db
      .select({
        id: changeOrders.id,
        title: changeOrders.title,
        changeOrderStatus: changeOrders.changeOrderStatus,
      })
      .from(changeOrders)
      .where(eq(changeOrders.projectId, projectId))
      .orderBy(desc(changeOrders.createdAt)),
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        milestoneStatus: milestones.milestoneStatus,
        scheduledDate: milestones.scheduledDate,
      })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          eq(milestones.assignedToOrganizationId, subOrgId),
        ),
      )
      .orderBy(milestones.scheduledDate),
    db
      .select({
        id: uploadRequests.id,
        title: uploadRequests.title,
        description: uploadRequests.description,
        requestStatus: uploadRequests.requestStatus,
        expectedFileType: uploadRequests.expectedFileType,
        dueAt: uploadRequests.dueAt,
        revisionNote: uploadRequests.revisionNote,
      })
      .from(uploadRequests)
      .where(
        and(
          eq(uploadRequests.projectId, projectId),
          eq(uploadRequests.requestedFromOrganizationId, subOrgId),
          inArray(uploadRequests.requestStatus, ["open", "revision_requested"]),
        ),
      )
      .orderBy(desc(uploadRequests.createdAt)),
  ]);

  return {
    context,
    project: context.project,
    scope: {
      workScope: context.membership.workScope,
      phaseScope: context.membership.phaseScope,
    },
    assignedRfis: rfiRows,
    assignedChangeOrders: coRows,
    myMilestones: milestoneRows,
    pendingUploadRequests: pendingRows,
  };
}

export type ClientProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  isResidential: boolean;
  milestones: Array<{
    id: string;
    title: string;
    milestoneStatus: string;
    scheduledDate: Date;
  }>;
  decisions: Array<{ id: string; title: string; changeOrderStatus: string }>;
  openRequests: Array<{ id: string; subject: string; rfiStatus: string }>;
  approvals: Array<{
    id: string;
    approvalNumber: number;
    title: string;
    category: string;
    approvalStatus: string;
    impactCostCents: number;
    impactScheduleDays: number;
    description: string | null;
    decisionNote: string | null;
  }>;
};

export async function getClientProjectView(
  input: LoaderInput,
): Promise<ClientProjectView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "commercial_client" &&
    context.role !== "residential_client"
  ) {
    throw new AuthorizationError(
      "Client project view requires a client role",
      "forbidden",
    );
  }
  const projectId = context.project.id;

  const [milestoneRows, coRows, rfiRows, approvalRows] = await Promise.all([
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        milestoneStatus: milestones.milestoneStatus,
        scheduledDate: milestones.scheduledDate,
        visibilityScope: milestones.visibilityScope,
      })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          inArray(milestones.visibilityScope, ["project_wide", "client_visible"]),
        ),
      )
      .orderBy(milestones.scheduledDate),
    db
      .select({
        id: changeOrders.id,
        title: changeOrders.title,
        changeOrderStatus: changeOrders.changeOrderStatus,
      })
      .from(changeOrders)
      .where(
        and(
          eq(changeOrders.projectId, projectId),
          inArray(changeOrders.changeOrderStatus, [
            "pending_client_approval",
            "approved",
            "rejected",
          ]),
        ),
      )
      .orderBy(desc(changeOrders.createdAt)),
    db
      .select({
        id: rfis.id,
        subject: rfis.subject,
        rfiStatus: rfis.rfiStatus,
      })
      .from(rfis)
      .where(
        and(
          eq(rfis.projectId, projectId),
          inArray(rfis.rfiStatus, ["open", "answered"]),
        ),
      )
      .orderBy(desc(rfis.createdAt)),
    db
      .select({
        id: approvals.id,
        approvalNumber: approvals.approvalNumber,
        title: approvals.title,
        category: approvals.category,
        approvalStatus: approvals.approvalStatus,
        impactCostCents: approvals.impactCostCents,
        impactScheduleDays: approvals.impactScheduleDays,
        description: approvals.description,
        decisionNote: approvals.decisionNote,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.projectId, projectId),
          inArray(approvals.approvalStatus, [
            "pending_review",
            "approved",
            "rejected",
            "needs_revision",
          ]),
        ),
      )
      .orderBy(desc(approvals.createdAt)),
  ]);

  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    milestones: milestoneRows.map(({ visibilityScope: _v, ...rest }) => rest),
    decisions: coRows,
    openRequests: rfiRows,
    approvals: approvalRows,
  };
}
