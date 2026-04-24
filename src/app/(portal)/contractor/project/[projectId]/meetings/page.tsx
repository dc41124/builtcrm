import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  organizations,
  projects,
  projectUserMemberships,
  roleAssignments,
  users,
} from "@/db/schema";
import {
  getMeetingActivity,
  getMeetings,
  type MeetingActivityRow,
  type MeetingListRow,
} from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

import { MeetingsWorkspace } from "./workspace";
import "../../../../meetings.css";

export default async function ContractorMeetingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let rows: MeetingListRow[] = [];
  let activity: MeetingActivityRow[] = [];
  let projectName = "";
  try {
    const [view, act, projRow] = await Promise.all([
      getMeetings({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      }),
      getMeetingActivity({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
        limit: 10,
      }),
      db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
    ]);
    rows = view.rows;
    activity = act;
    projectName = projRow[0]?.name ?? "";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="mt-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  // People who can be invited as attendees: everyone with project access.
  // Includes the contractor org staff plus all members with a PUM row.
  // The create modal uses this for the attendee picker.
  const memberRows = await db
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
    );

  // Contractor staff on the project's contractor org (not always in PUM).
  const [project] = await db
    .select({
      contractorOrganizationId: projects.contractorOrganizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const contractorStaffRows = project
    ? await db
        .select({
          userId: users.id,
          userName: users.displayName,
          userEmail: users.email,
          orgId: organizations.id,
          orgName: organizations.name,
          portalType: roleAssignments.portalType,
        })
        .from(roleAssignments)
        .innerJoin(users, eq(users.id, roleAssignments.userId))
        .innerJoin(
          organizations,
          eq(organizations.id, roleAssignments.organizationId),
        )
        .where(
          and(
            eq(
              roleAssignments.organizationId,
              project.contractorOrganizationId,
            ),
            eq(roleAssignments.portalType, "contractor"),
          ),
        )
    : [];

  const peopleMap = new Map<
    string,
    {
      userId: string;
      userName: string | null;
      userEmail: string;
      orgId: string;
      orgName: string;
      scope: "internal" | "sub" | "external";
    }
  >();
  for (const r of contractorStaffRows) {
    if (!peopleMap.has(r.userId)) {
      peopleMap.set(r.userId, {
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        orgId: r.orgId,
        orgName: r.orgName ?? "",
        scope: "internal",
      });
    }
  }
  for (const r of memberRows) {
    if (peopleMap.has(r.userId)) continue;
    const scope: "internal" | "sub" | "external" =
      r.portalType === "contractor"
        ? "internal"
        : r.portalType === "subcontractor"
          ? "sub"
          : "external";
    peopleMap.set(r.userId, {
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      orgId: r.orgId,
      orgName: r.orgName ?? "",
      scope,
    });
  }
  const people = Array.from(peopleMap.values()).sort((a, b) =>
    (a.userName ?? a.userEmail).localeCompare(b.userName ?? b.userEmail),
  );

  return (
    <div className="mt-content">
      <MeetingsWorkspace
        projectId={projectId}
        projectName={projectName}
        rows={rows}
        activity={activity}
        people={people}
      />
    </div>
  );
}
