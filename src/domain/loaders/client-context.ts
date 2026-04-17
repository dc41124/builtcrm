import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { organizations, roleAssignments, users } from "@/db/schema";

import { AuthorizationError } from "../permissions";
import type { SessionLike } from "../context";

// Client-org auth contexts. Client orgs use roleAssignments.portalType="client"
// with clientSubtype discriminating between commercial and residential. A user
// can be assigned to at most one client org per subtype (enforced by app
// policy, not schema), so we pick the first match.

export type ClientOrgContext = {
  user: { id: string; email: string; displayName: string | null };
  organization: { id: string; name: string };
  role: "owner" | "member";
  subtype: "commercial" | "residential";
};

async function loadClientContext(
  session: SessionLike | null | undefined,
  subtype: "commercial" | "residential",
): Promise<ClientOrgContext> {
  if (!session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const appUserId = session.appUserId;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  if (!user || !user.isActive) {
    throw new AuthorizationError("User not found or inactive", "unauthenticated");
  }

  const [assignment] = await db
    .select({
      organizationId: roleAssignments.organizationId,
      roleKey: roleAssignments.roleKey,
      organizationName: organizations.name,
    })
    .from(roleAssignments)
    .innerJoin(organizations, eq(organizations.id, roleAssignments.organizationId))
    .where(
      and(
        eq(roleAssignments.userId, appUserId),
        eq(roleAssignments.portalType, "client"),
        eq(roleAssignments.clientSubtype, subtype),
      ),
    )
    .limit(1);
  if (!assignment) {
    throw new AuthorizationError(
      `No ${subtype} client organization for this user`,
      "forbidden",
    );
  }

  // Client portals use a uniform admin-role rule: any role_key containing
  // "owner" (covers commercial "owner" and residential "co_owner") has full
  // mutation perms; everyone else is member-level.
  const role: ClientOrgContext["role"] = /owner/i.test(assignment.roleKey)
    ? "owner"
    : "member";

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    organization: {
      id: assignment.organizationId,
      name: assignment.organizationName,
    },
    role,
    subtype,
  };
}

export function getCommercialClientOrgContext(
  session: SessionLike | null | undefined,
): Promise<ClientOrgContext> {
  return loadClientContext(session, "commercial");
}

export function getResidentialClientOrgContext(
  session: SessionLike | null | undefined,
): Promise<ClientOrgContext> {
  return loadClientContext(session, "residential");
}
