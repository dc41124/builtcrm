import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  approvals,
  changeOrders,
  complianceRecords,
  drawLineItems,
  drawRequests,
  lienWaivers,
  milestones,
  organizations,
  projectUserMemberships,
  retainageReleases,
  rfiResponses,
  rfis,
  scheduleOfValues,
  sovLineItems,
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

export type LienWaiverRow = {
  id: string;
  drawRequestId: string;
  organizationId: string;
  lienWaiverType: "conditional_progress" | "unconditional_progress" | "conditional_final" | "unconditional_final";
  lienWaiverStatus: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  amountCents: number;
  throughDate: Date | null;
  documentId: string | null;
  requestedAt: Date | null;
  submittedAt: Date | null;
  acceptedAt: Date | null;
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
  createdAt: Date;
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
    sovId: string;
    drawNumber: number;
    drawRequestStatus: string;
    periodFrom: Date;
    periodTo: Date;
    originalContractSumCents: number;
    netChangeOrdersCents: number;
    contractSumToDateCents: number;
    totalCompletedToDateCents: number;
    totalRetainageCents: number;
    totalEarnedLessRetainageCents: number;
    previousCertificatesCents: number;
    currentPaymentDueCents: number;
    balanceToFinishCents: number;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    returnedAt: Date | null;
    returnReason: string | null;
    paidAt: Date | null;
    paymentReferenceName: string | null;
    retainageReleasedCents: number;
    lineItems: Array<{
      id: string;
      sovLineItemId: string;
      itemNumber: string;
      description: string;
      scheduledValueCents: number;
      workCompletedPreviousCents: number;
      workCompletedThisPeriodCents: number;
      materialsPresentlyStoredCents: number;
      totalCompletedStoredToDateCents: number;
      percentCompleteBasisPoints: number;
      balanceToFinishCents: number;
      retainageCents: number;
      retainagePercentApplied: number;
    }>;
    lienWaivers: LienWaiverRow[];
  }>;
  retainageReleases: RetainageReleaseRow[];
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
  complianceRecords: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    complianceType: string;
    complianceStatus: string;
    expiresAt: Date | null;
    documentId: string | null;
  }>;
  scheduleOfValues: {
    id: string;
    version: number;
    sovStatus: string;
    totalScheduledValueCents: number;
    totalOriginalContractCents: number;
    totalChangeOrdersCents: number;
    defaultRetainagePercent: number;
    lineItems: Array<{
      id: string;
      itemNumber: string;
      costCode: string | null;
      description: string;
      lineItemType: string;
      scheduledValueCents: number;
      retainagePercentOverride: number | null;
      sortOrder: number;
      isActive: boolean;
    }>;
  } | null;
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
    complianceRows,
    sovRows,
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
      .select()
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
    db
      .select({
        id: complianceRecords.id,
        organizationId: complianceRecords.organizationId,
        organizationName: organizations.name,
        complianceType: complianceRecords.complianceType,
        complianceStatus: complianceRecords.complianceStatus,
        expiresAt: complianceRecords.expiresAt,
        documentId: complianceRecords.documentId,
      })
      .from(complianceRecords)
      .leftJoin(organizations, eq(organizations.id, complianceRecords.organizationId))
      .where(eq(complianceRecords.projectId, projectId))
      .orderBy(desc(complianceRecords.createdAt)),
    db
      .select({
        id: scheduleOfValues.id,
        version: scheduleOfValues.version,
        sovStatus: scheduleOfValues.sovStatus,
        totalScheduledValueCents: scheduleOfValues.totalScheduledValueCents,
        totalOriginalContractCents: scheduleOfValues.totalOriginalContractCents,
        totalChangeOrdersCents: scheduleOfValues.totalChangeOrdersCents,
        defaultRetainagePercent: scheduleOfValues.defaultRetainagePercent,
        createdAt: scheduleOfValues.createdAt,
      })
      .from(scheduleOfValues)
      .where(
        and(
          eq(scheduleOfValues.projectId, projectId),
          inArray(scheduleOfValues.sovStatus, ["draft", "active", "locked"]),
        ),
      )
      .orderBy(desc(scheduleOfValues.createdAt))
      .limit(1),
  ]);

  const drawIds = drawRows.map((d) => d.id);
  const [drawLineItemRows, waiverRows, releaseRows] = await Promise.all([
    drawIds.length
      ? db
          .select({
            id: drawLineItems.id,
            drawRequestId: drawLineItems.drawRequestId,
            sovLineItemId: drawLineItems.sovLineItemId,
            itemNumber: sovLineItems.itemNumber,
            description: sovLineItems.description,
            scheduledValueCents: sovLineItems.scheduledValueCents,
            workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
            workCompletedThisPeriodCents: drawLineItems.workCompletedThisPeriodCents,
            materialsPresentlyStoredCents:
              drawLineItems.materialsPresentlyStoredCents,
            totalCompletedStoredToDateCents:
              drawLineItems.totalCompletedStoredToDateCents,
            percentCompleteBasisPoints: drawLineItems.percentCompleteBasisPoints,
            balanceToFinishCents: drawLineItems.balanceToFinishCents,
            retainageCents: drawLineItems.retainageCents,
            retainagePercentApplied: drawLineItems.retainagePercentApplied,
            sortOrder: sovLineItems.sortOrder,
          })
          .from(drawLineItems)
          .innerJoin(sovLineItems, eq(sovLineItems.id, drawLineItems.sovLineItemId))
          .where(inArray(drawLineItems.drawRequestId, drawIds))
          .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber))
      : Promise.resolve([] as never[]),
    drawIds.length
      ? db
          .select()
          .from(lienWaivers)
          .where(inArray(lienWaivers.drawRequestId, drawIds))
          .orderBy(asc(lienWaivers.lienWaiverType), desc(lienWaivers.createdAt))
      : Promise.resolve([] as never[]),
    db
      .select()
      .from(retainageReleases)
      .where(eq(retainageReleases.projectId, projectId))
      .orderBy(desc(retainageReleases.createdAt)),
  ]);

  const drawLinesByDraw = new Map<string, typeof drawLineItemRows>();
  for (const l of drawLineItemRows) {
    const arr = drawLinesByDraw.get(l.drawRequestId) ?? [];
    arr.push(l);
    drawLinesByDraw.set(l.drawRequestId, arr);
  }

  const waiversByDraw = new Map<string, LienWaiverRow[]>();
  for (const w of waiverRows) {
    const row: LienWaiverRow = {
      id: w.id,
      drawRequestId: w.drawRequestId,
      organizationId: w.organizationId,
      lienWaiverType: w.lienWaiverType,
      lienWaiverStatus: w.lienWaiverStatus,
      amountCents: w.amountCents,
      throughDate: w.throughDate,
      documentId: w.documentId,
      requestedAt: w.requestedAt,
      submittedAt: w.submittedAt,
      acceptedAt: w.acceptedAt,
    };
    const arr = waiversByDraw.get(w.drawRequestId) ?? [];
    arr.push(row);
    waiversByDraw.set(w.drawRequestId, arr);
  }

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
    createdAt: r.createdAt,
  }));

  const drawRequestsView = drawRows.map((d) => ({
    id: d.id,
    sovId: d.sovId,
    drawNumber: d.drawNumber,
    drawRequestStatus: d.drawRequestStatus,
    periodFrom: d.periodFrom,
    periodTo: d.periodTo,
    originalContractSumCents: d.originalContractSumCents,
    netChangeOrdersCents: d.netChangeOrdersCents,
    contractSumToDateCents: d.contractSumToDateCents,
    totalCompletedToDateCents: d.totalCompletedToDateCents,
    totalRetainageCents: d.totalRetainageCents,
    totalEarnedLessRetainageCents: d.totalEarnedLessRetainageCents,
    previousCertificatesCents: d.previousCertificatesCents,
    currentPaymentDueCents: d.currentPaymentDueCents,
    balanceToFinishCents: d.balanceToFinishCents,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote,
    returnedAt: d.returnedAt,
    returnReason: d.returnReason,
    paidAt: d.paidAt,
    paymentReferenceName: d.paymentReferenceName,
    retainageReleasedCents: d.retainageReleasedCents,
    lineItems: (drawLinesByDraw.get(d.id) ?? []).map((l) => ({
      id: l.id,
      sovLineItemId: l.sovLineItemId,
      itemNumber: l.itemNumber,
      description: l.description,
      scheduledValueCents: l.scheduledValueCents,
      workCompletedPreviousCents: l.workCompletedPreviousCents,
      workCompletedThisPeriodCents: l.workCompletedThisPeriodCents,
      materialsPresentlyStoredCents: l.materialsPresentlyStoredCents,
      totalCompletedStoredToDateCents: l.totalCompletedStoredToDateCents,
      percentCompleteBasisPoints: l.percentCompleteBasisPoints,
      balanceToFinishCents: l.balanceToFinishCents,
      retainageCents: l.retainageCents,
      retainagePercentApplied: l.retainagePercentApplied,
    })),
    lienWaivers: waiversByDraw.get(d.id) ?? [],
  }));

  const sovRow = sovRows[0] ?? null;
  const sovLineItemRows = sovRow
    ? await db
        .select({
          id: sovLineItems.id,
          itemNumber: sovLineItems.itemNumber,
          costCode: sovLineItems.costCode,
          description: sovLineItems.description,
          lineItemType: sovLineItems.lineItemType,
          scheduledValueCents: sovLineItems.scheduledValueCents,
          retainagePercentOverride: sovLineItems.retainagePercentOverride,
          sortOrder: sovLineItems.sortOrder,
          isActive: sovLineItems.isActive,
        })
        .from(sovLineItems)
        .where(eq(sovLineItems.sovId, sovRow.id))
        .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber))
    : [];

  return {
    context,
    project: context.project,
    teamCount: teamRows.length,
    milestones: milestoneRows,
    rfis: rfiRows,
    changeOrders: coRows,
    drawRequests: drawRequestsView,
    retainageReleases: retainageReleasesView,
    uploadRequests: uploadRequestRows,
    approvals: approvalRows,
    complianceRecords: complianceRows,
    scheduleOfValues: sovRow
      ? {
          id: sovRow.id,
          version: sovRow.version,
          sovStatus: sovRow.sovStatus,
          totalScheduledValueCents: sovRow.totalScheduledValueCents,
          totalOriginalContractCents: sovRow.totalOriginalContractCents,
          totalChangeOrdersCents: sovRow.totalChangeOrdersCents,
          defaultRetainagePercent: sovRow.defaultRetainagePercent,
          lineItems: sovLineItemRows,
        }
      : null,
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
  complianceRecords: Array<{
    id: string;
    complianceType: string;
    complianceStatus: string;
    expiresAt: Date | null;
    documentId: string | null;
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

  const [rfiRows, coRows, milestoneRows, pendingRows, complianceRows] = await Promise.all([
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
    db
      .select({
        id: complianceRecords.id,
        complianceType: complianceRecords.complianceType,
        complianceStatus: complianceRecords.complianceStatus,
        expiresAt: complianceRecords.expiresAt,
        documentId: complianceRecords.documentId,
      })
      .from(complianceRecords)
      .where(
        and(
          eq(complianceRecords.projectId, projectId),
          eq(complianceRecords.organizationId, subOrgId),
        ),
      )
      .orderBy(desc(complianceRecords.createdAt)),
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
    complianceRecords: complianceRows,
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
  drawRequests: Array<{
    id: string;
    drawNumber: number;
    drawRequestStatus: string;
    periodFrom: Date;
    periodTo: Date;
    originalContractSumCents: number;
    netChangeOrdersCents: number;
    contractSumToDateCents: number;
    totalCompletedToDateCents: number;
    totalRetainageCents: number;
    totalEarnedLessRetainageCents: number;
    previousCertificatesCents: number;
    currentPaymentDueCents: number;
    balanceToFinishCents: number;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    returnedAt: Date | null;
    returnReason: string | null;
    paidAt: Date | null;
    paymentReferenceName: string | null;
    retainageReleasedCents: number;
    lienWaivers: LienWaiverRow[];
    lineItems: Array<{
      id: string;
      itemNumber: string;
      description: string;
      scheduledValueCents: number;
      workCompletedPreviousCents: number;
      workCompletedThisPeriodCents: number;
      materialsPresentlyStoredCents: number;
      totalCompletedStoredToDateCents: number;
      percentCompleteBasisPoints: number;
      balanceToFinishCents: number;
      retainageCents: number;
      retainagePercentApplied: number;
    }>;
  }>;
  retainageReleases: RetainageReleaseRow[];
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

  const [milestoneRows, coRows, rfiRows, approvalRows, drawRows] = await Promise.all([
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
    db
      .select()
      .from(drawRequests)
      .where(
        and(
          eq(drawRequests.projectId, projectId),
          inArray(drawRequests.drawRequestStatus, [
            "submitted",
            "under_review",
            "approved",
            "approved_with_note",
            "returned",
            "revised",
            "paid",
          ]),
        ),
      )
      .orderBy(desc(drawRequests.drawNumber)),
  ]);

  const clientDrawIds = drawRows.map((d) => d.id);
  const [clientDrawLineRows, clientWaiverRows, clientReleaseRows] =
    await Promise.all([
      clientDrawIds.length
        ? db
            .select({
              id: drawLineItems.id,
              drawRequestId: drawLineItems.drawRequestId,
              itemNumber: sovLineItems.itemNumber,
              description: sovLineItems.description,
              scheduledValueCents: sovLineItems.scheduledValueCents,
              workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
              workCompletedThisPeriodCents:
                drawLineItems.workCompletedThisPeriodCents,
              materialsPresentlyStoredCents:
                drawLineItems.materialsPresentlyStoredCents,
              totalCompletedStoredToDateCents:
                drawLineItems.totalCompletedStoredToDateCents,
              percentCompleteBasisPoints: drawLineItems.percentCompleteBasisPoints,
              balanceToFinishCents: drawLineItems.balanceToFinishCents,
              retainageCents: drawLineItems.retainageCents,
              retainagePercentApplied: drawLineItems.retainagePercentApplied,
              sortOrder: sovLineItems.sortOrder,
            })
            .from(drawLineItems)
            .innerJoin(
              sovLineItems,
              eq(sovLineItems.id, drawLineItems.sovLineItemId),
            )
            .where(inArray(drawLineItems.drawRequestId, clientDrawIds))
            .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber))
        : Promise.resolve([] as never[]),
      clientDrawIds.length
        ? db
            .select()
            .from(lienWaivers)
            .where(inArray(lienWaivers.drawRequestId, clientDrawIds))
            .orderBy(
              asc(lienWaivers.lienWaiverType),
              desc(lienWaivers.createdAt),
            )
        : Promise.resolve([] as never[]),
      db
        .select()
        .from(retainageReleases)
        .where(eq(retainageReleases.projectId, projectId))
        .orderBy(desc(retainageReleases.createdAt)),
    ]);

  const clientDrawLinesByDraw = new Map<string, typeof clientDrawLineRows>();
  for (const l of clientDrawLineRows) {
    const arr = clientDrawLinesByDraw.get(l.drawRequestId) ?? [];
    arr.push(l);
    clientDrawLinesByDraw.set(l.drawRequestId, arr);
  }

  const clientWaiversByDraw = new Map<string, LienWaiverRow[]>();
  for (const w of clientWaiverRows) {
    const row: LienWaiverRow = {
      id: w.id,
      drawRequestId: w.drawRequestId,
      organizationId: w.organizationId,
      lienWaiverType: w.lienWaiverType,
      lienWaiverStatus: w.lienWaiverStatus,
      amountCents: w.amountCents,
      throughDate: w.throughDate,
      documentId: w.documentId,
      requestedAt: w.requestedAt,
      submittedAt: w.submittedAt,
      acceptedAt: w.acceptedAt,
    };
    const arr = clientWaiversByDraw.get(w.drawRequestId) ?? [];
    arr.push(row);
    clientWaiversByDraw.set(w.drawRequestId, arr);
  }

  const clientRetainageReleasesView: RetainageReleaseRow[] = clientReleaseRows.map(
    (r) => ({
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
      createdAt: r.createdAt,
    }),
  );

  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    milestones: milestoneRows.map(({ visibilityScope: _v, ...rest }) => rest),
    decisions: coRows,
    openRequests: rfiRows,
    approvals: approvalRows,
    retainageReleases: clientRetainageReleasesView,
    drawRequests: drawRows.map((d) => ({
      id: d.id,
      drawNumber: d.drawNumber,
      drawRequestStatus: d.drawRequestStatus,
      periodFrom: d.periodFrom,
      periodTo: d.periodTo,
      originalContractSumCents: d.originalContractSumCents,
      netChangeOrdersCents: d.netChangeOrdersCents,
      contractSumToDateCents: d.contractSumToDateCents,
      totalCompletedToDateCents: d.totalCompletedToDateCents,
      totalRetainageCents: d.totalRetainageCents,
      totalEarnedLessRetainageCents: d.totalEarnedLessRetainageCents,
      previousCertificatesCents: d.previousCertificatesCents,
      currentPaymentDueCents: d.currentPaymentDueCents,
      balanceToFinishCents: d.balanceToFinishCents,
      submittedAt: d.submittedAt,
      reviewedAt: d.reviewedAt,
      reviewNote: d.reviewNote,
      returnedAt: d.returnedAt,
      returnReason: d.returnReason,
      paidAt: d.paidAt,
      paymentReferenceName: d.paymentReferenceName,
      retainageReleasedCents: d.retainageReleasedCents,
      lienWaivers: clientWaiversByDraw.get(d.id) ?? [],
      lineItems: (clientDrawLinesByDraw.get(d.id) ?? []).map((l) => ({
        id: l.id,
        itemNumber: l.itemNumber,
        description: l.description,
        scheduledValueCents: l.scheduledValueCents,
        workCompletedPreviousCents: l.workCompletedPreviousCents,
        workCompletedThisPeriodCents: l.workCompletedThisPeriodCents,
        materialsPresentlyStoredCents: l.materialsPresentlyStoredCents,
        totalCompletedStoredToDateCents: l.totalCompletedStoredToDateCents,
        percentCompleteBasisPoints: l.percentCompleteBasisPoints,
        balanceToFinishCents: l.balanceToFinishCents,
        retainageCents: l.retainageCents,
        retainagePercentApplied: l.retainagePercentApplied,
      })),
    })),
  };
}
