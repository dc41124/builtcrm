import { and, eq, ne } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { organizations, roleAssignments } from "@/db/schema";

// Sole-owner check: returns the names of any orgs where the user is the
// only admin/owner. Deletion is blocked when this returns a non-empty
// list — the user must transfer ownership first.
//
// "Owner-class" role keys are determined by suffix: anything ending in
// `_admin` or `_owner` (contractor_admin, subcontractor_owner, etc.).
// Sub-admin / client-collaborator-style roles are not considered
// owners; they can leave without breaking org administration.
//
// Cross-org by design — a user about to be deleted can hold roles in
// many orgs, and we have to inspect every one of them. Reads against
// RLS-enabled `role_assignments` route through `dbAdmin`.
//
// See docs/specs/user_deletion_and_export_plan.md §6 q6.

const OWNER_SUFFIX = /(_admin|_owner)$/;

export async function listOrgsUserSolelyOwns(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const userAdminRoles = await dbAdmin
    .select({
      organizationId: roleAssignments.organizationId,
      roleKey: roleAssignments.roleKey,
    })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, userId));

  const ownedOrgIds = userAdminRoles
    .filter((r) => OWNER_SUFFIX.test(r.roleKey))
    .map((r) => r.organizationId);

  if (ownedOrgIds.length === 0) return [];

  const sole: { id: string; name: string }[] = [];
  for (const orgId of ownedOrgIds) {
    const otherAdmins = await dbAdmin
      .select({
        userId: roleAssignments.userId,
        roleKey: roleAssignments.roleKey,
      })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.organizationId, orgId),
          ne(roleAssignments.userId, userId),
        ),
      );
    const hasOtherOwner = otherAdmins.some((r) =>
      OWNER_SUFFIX.test(r.roleKey),
    );
    if (!hasOtherOwner) {
      const [org] = await dbAdmin
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      if (org) sole.push({ id: orgId, name: org.name });
    }
  }
  return sole;
}
