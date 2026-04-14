import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  changeOrders,
  drawRequests,
  milestones,
  projectUserMemberships,
  rfis,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

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
  rfis: Array<{ id: string; subject: string; rfiStatus: string }>;
  changeOrders: Array<{ id: string; title: string; changeOrderStatus: string }>;
  drawRequests: Array<{
    id: string;
    drawNumber: number;
    drawRequestStatus: string;
    currentPaymentDueCents: number;
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

  const [milestoneRows, rfiRows, coRows, drawRows, teamRows] = await Promise.all([
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
    db
      .select({
        id: rfis.id,
        subject: rfis.subject,
        rfiStatus: rfis.rfiStatus,
      })
      .from(rfis)
      .where(eq(rfis.projectId, projectId))
      .orderBy(desc(rfis.createdAt)),
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
  ]);

  return {
    context,
    project: context.project,
    teamCount: teamRows.length,
    milestones: milestoneRows,
    rfis: rfiRows,
    changeOrders: coRows,
    drawRequests: drawRows,
  };
}

export type SubcontractorProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  scope: { workScope: string | null; phaseScope: string | null };
  assignedRfis: Array<{ id: string; subject: string; rfiStatus: string }>;
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

  const [rfiRows, coRows, milestoneRows] = await Promise.all([
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
          eq(rfis.assignedToOrganizationId, subOrgId),
        ),
      )
      .orderBy(desc(rfis.createdAt)),
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

  const [milestoneRows, coRows, rfiRows] = await Promise.all([
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
  ]);

  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    milestones: milestoneRows.map(({ visibilityScope: _v, ...rest }) => rest),
    decisions: coRows,
    openRequests: rfiRows,
  };
}
