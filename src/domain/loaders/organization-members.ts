import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  authSession,
  authUser,
  organizationUsers,
  roleAssignments,
  users,
} from "@/db/schema";

export type OrganizationMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
  roleKey: string;
  roleAssignmentId: string | null;
  jobTitle: string | null;
  membershipStatus: string;
  lastActiveAt: Date | null;
  joinedAt: Date;
};

function deriveInitials(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  const parts = source.split(/\s+|@/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Bridge from our internal users.id to Better Auth sessions. Auth users are
// keyed by email, so we look up the max session updatedAt for the email that
// matches each member row. A correlated subquery keeps the whole read as one
// query instead of N+1 fetches per member.
const LAST_ACTIVE_SQL = sql<Date | null>`(
  select max(${authSession.updatedAt})
  from ${authSession}
  inner join ${authUser} on ${authUser.id} = ${authSession.userId}
  where ${authUser.email} = ${users.email}
)`;

export async function listOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMember[]> {
  const rows = await db
    .select({
      membershipId: organizationUsers.id,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      jobTitle: organizationUsers.jobTitle,
      membershipStatus: organizationUsers.membershipStatus,
      joinedAt: organizationUsers.createdAt,
      roleAssignmentId: roleAssignments.id,
      roleKey: roleAssignments.roleKey,
      lastActiveAt: LAST_ACTIVE_SQL,
    })
    .from(organizationUsers)
    .innerJoin(users, eq(users.id, organizationUsers.userId))
    .leftJoin(
      roleAssignments,
      and(
        eq(roleAssignments.userId, organizationUsers.userId),
        eq(roleAssignments.organizationId, organizationUsers.organizationId),
        eq(roleAssignments.portalType, "contractor"),
      ),
    )
    .where(eq(organizationUsers.organizationId, organizationId))
    .orderBy(desc(organizationUsers.createdAt));

  return rows.map((r) => ({
    id: r.membershipId,
    userId: r.userId,
    name: r.displayName ?? r.email,
    email: r.email,
    avatarUrl: r.avatarUrl,
    initials: deriveInitials(r.displayName, r.email),
    roleKey: r.roleKey ?? "viewer",
    roleAssignmentId: r.roleAssignmentId,
    jobTitle: r.jobTitle,
    membershipStatus: r.membershipStatus,
    lastActiveAt: r.lastActiveAt,
    joinedAt: r.joinedAt,
  }));
}

// Used by the role-change action as a last-admin guard. Matches any role key
// that looks like an admin/owner role (same rule used in getContractorOrgContext).
export async function countAdminsInOrganization(
  organizationId: string,
): Promise<number> {
  const rows = await db
    .select({ roleKey: roleAssignments.roleKey })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.organizationId, organizationId),
        eq(roleAssignments.portalType, "contractor"),
        or(
          sql`${roleAssignments.roleKey} ilike 'admin%'`,
          sql`${roleAssignments.roleKey} ilike '%owner%'`,
        ),
      ),
    );
  return rows.length;
}
