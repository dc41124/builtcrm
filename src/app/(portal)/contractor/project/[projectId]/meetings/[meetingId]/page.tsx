import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import {
  organizations,
  projectUserMemberships,
  roleAssignments,
  users,
} from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import {
  getMeeting,
  getMeetingActivity,
  type MeetingActivityRow,
  type MeetingDetail,
} from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

import { MeetingDetailUI } from "./detail";
import "../../../../../meetings.css";

export default async function ContractorMeetingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; meetingId: string }>;
}) {
  const { projectId, meetingId } = await params;
  const { session } = await requireServerSession();
  let detail: MeetingDetail | null = null;
  let activity: MeetingActivityRow[] = [];
  let callerOrgId = "";
  try {
    const ctx = await getEffectiveContext(session, projectId);
    callerOrgId = ctx.organization.id;
    detail = await getMeeting({
      session: session,
      meetingId,
    });
    activity = await getMeetingActivity({
      session: session,
      projectId,
      limit: 8,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="mt-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
  if (!detail) notFound();

  // Attendee picker data for the "+ add attendee" action. Contractor
  // caller — multi-org PUM policy clause B (project ownership) returns
  // every member's PUM regardless of which org owns the row.
  const memberRows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        userId: projectUserMemberships.userId,
        userName: users.displayName,
        userEmail: users.email,
        orgId: projectUserMemberships.organizationId,
        orgName: organizations.name,
        portalType: roleAssignments.portalType,
      })
      .from(projectUserMemberships)
      .innerJoin(users, eq(users.id, projectUserMemberships.userId))
      .innerJoin(
        organizations,
        eq(organizations.id, projectUserMemberships.organizationId),
      )
      .innerJoin(
        roleAssignments,
        eq(roleAssignments.id, projectUserMemberships.roleAssignmentId),
      )
      .where(
        and(
          eq(projectUserMemberships.projectId, projectId),
          eq(projectUserMemberships.membershipStatus, "active"),
          eq(projectUserMemberships.accessState, "active"),
        ),
      ),
  );

  const people = memberRows.map((r) => ({
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    orgId: r.orgId,
    orgName: r.orgName ?? "",
    scope:
      r.portalType === "contractor"
        ? ("internal" as const)
        : r.portalType === "subcontractor"
          ? ("sub" as const)
          : ("external" as const),
  }));

  return (
    <div className="mt-content">
      <MeetingDetailUI
        projectId={projectId}
        meetingId={meetingId}
        detail={detail}
        people={people}
        activity={activity}
        viewerRole="contractor"
      />
    </div>
  );
}
