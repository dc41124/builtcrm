import { and, eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  organizations,
  projects,
  projectUserMemberships,
  roleAssignments,
  users,
} from "@/db/schema";

import {
  AuthorizationError,
  buildPermissions,
  type Permissions,
} from "./permissions";

// Auth chokepoint: every authenticated request resolves the tenant
// via `getEffectiveContext` / `getOrgContext` BEFORE any GUC is set.
// Since `role_assignments` and `project_user_memberships` are
// RLS-enabled, those reads must use the BYPASSRLS admin pool —
// otherwise the resolution itself would return empty under RLS and
// every authenticated request would fail closed. The auth chokepoint
// is the legitimate place to bypass RLS; the rest of the request
// runs inside `withTenant(orgId, ...)` with the tenant the
// chokepoint resolved.

// The five effective roles the rest of the app reasons about. Raw role_key
// values in role_assignments can be richer than this (e.g. "contractor_owner",
// "contractor_estimator"), but authorization collapses them into one of
// these buckets.
export type EffectiveRole =
  | "contractor_admin"
  | "contractor_pm"
  | "subcontractor_user"
  | "commercial_client"
  | "residential_client";

export type SessionLike = {
  appUserId?: string | null;
  userId?: string;
  // Better Auth additionalField — present on AppSessionRow at runtime,
  // optional here so callers passing minimal session objects (tests) still
  // type-check. Loaders that need user-scoped RLS (withTenantUser) read this.
  organizationId?: string | null;
};

export type EffectiveContext = {
  user: { id: string; email: string; displayName: string | null };
  organization: { id: string; name: string; type: string };
  project: { id: string; name: string; contractorOrganizationId: string };
  role: EffectiveRole;
  permissions: Permissions;
  membership: {
    source: "project_user_membership" | "contractor_org_staff";
    projectUserMembershipId: string | null;
    phaseScope: string | null;
    workScope: string | null;
  };
};

// Single gate every loader and action calls. Returns a fully-resolved
// authorization context or throws. Never returns null — callers should not
// have to handle "maybe authorized".
export async function getEffectiveContext(
  session: SessionLike | null | undefined,
  projectId: string,
): Promise<EffectiveContext> {
  if (!session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const appUserId = session.appUserId;

  const [user] = await dbAdmin
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

  const [project] = await dbAdmin
    .select({
      id: projects.id,
      name: projects.name,
      contractorOrganizationId: projects.contractorOrganizationId,
      clientSubtype: projects.clientSubtype,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    throw new AuthorizationError("Project not found", "not_found");
  }

  // Preferred path: explicit project membership. This also carries any
  // project-level scope overrides the policy layer needs.
  const [membership] = await dbAdmin
    .select({
      id: projectUserMemberships.id,
      organizationId: projectUserMemberships.organizationId,
      roleAssignmentId: projectUserMemberships.roleAssignmentId,
      accessState: projectUserMemberships.accessState,
      membershipStatus: projectUserMemberships.membershipStatus,
      phaseScope: projectUserMemberships.phaseScope,
      workScope: projectUserMemberships.workScope,
      portalType: roleAssignments.portalType,
      roleKey: roleAssignments.roleKey,
      clientSubtype: roleAssignments.clientSubtype,
    })
    .from(projectUserMemberships)
    .innerJoin(
      roleAssignments,
      eq(roleAssignments.id, projectUserMemberships.roleAssignmentId),
    )
    .where(
      and(
        eq(projectUserMemberships.projectId, projectId),
        eq(projectUserMemberships.userId, appUserId),
      ),
    )
    .limit(1);

  let orgId: string;
  let portalType: string;
  let roleKey: string;
  let clientSubtype: string | null;
  let source: EffectiveContext["membership"]["source"];
  let projectUserMembershipId: string | null;
  let phaseScope: string | null;
  let workScope: string | null;

  if (membership) {
    if (
      membership.membershipStatus !== "active" ||
      membership.accessState !== "active"
    ) {
      throw new AuthorizationError(
        "Project access is not active",
        "forbidden",
      );
    }
    orgId = membership.organizationId;
    portalType = membership.portalType;
    roleKey = membership.roleKey;
    clientSubtype = membership.clientSubtype;
    source = "project_user_membership";
    projectUserMembershipId = membership.id;
    phaseScope = membership.phaseScope;
    workScope = membership.workScope;
  } else {
    // Fallback: contractor staff get implicit access to every project owned
    // by their organization, even without an explicit project_user_memberships
    // row. Subs and clients do NOT get this fallback — they must be invited
    // onto the specific project.
    const [staff] = await dbAdmin
      .select({
        organizationId: roleAssignments.organizationId,
        portalType: roleAssignments.portalType,
        roleKey: roleAssignments.roleKey,
        clientSubtype: roleAssignments.clientSubtype,
      })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, appUserId),
          eq(roleAssignments.organizationId, project.contractorOrganizationId),
          eq(roleAssignments.portalType, "contractor"),
        ),
      )
      .limit(1);
    if (!staff) {
      throw new AuthorizationError(
        "No access to this project",
        "forbidden",
      );
    }
    orgId = staff.organizationId;
    portalType = staff.portalType;
    roleKey = staff.roleKey;
    clientSubtype = staff.clientSubtype;
    source = "contractor_org_staff";
    projectUserMembershipId = null;
    phaseScope = null;
    workScope = null;
  }

  const [org] = await dbAdmin
    .select({
      id: organizations.id,
      name: organizations.name,
      type: organizations.organizationType,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) {
    throw new AuthorizationError("Organization not found", "forbidden");
  }

  const role = resolveEffectiveRole({ portalType, roleKey, clientSubtype });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    organization: org,
    project: {
      id: project.id,
      name: project.name,
      contractorOrganizationId: project.contractorOrganizationId,
    },
    role,
    permissions: buildPermissions(role),
    membership: {
      source,
      projectUserMembershipId,
      phaseScope,
      workScope,
    },
  };
}

// -----------------------------------------------------------------------------
// Org-scoped context (no project)
//
// Most prequalification surfaces aren't project-scoped — template management,
// review queue, sub list of contractors, settings. The standard
// `getEffectiveContext(session, projectId)` requires a project and throws
// `not_found` without one. This sibling resolves user → primary org → role
// without touching projects so org-scoped loaders compile and authorize
// cleanly.
//
// Uses the same role-collapse rules as `getEffectiveContext`. Picks the
// user's first active role assignment if they have multiple; multi-role
// users in this codebase are extremely rare and always within the same org
// (admin + estimator etc.). If a user truly belongs to multiple orgs, we'd
// need a session-stored "current org" — out of scope for v1 prequal.
// -----------------------------------------------------------------------------

export type OrgContext = {
  user: { id: string; email: string; displayName: string | null };
  organization: { id: string; name: string; type: string };
  role: EffectiveRole;
  permissions: Permissions;
};

export async function getOrgContext(
  session: SessionLike | null | undefined,
): Promise<OrgContext> {
  if (!session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const appUserId = session.appUserId;

  const [user] = await dbAdmin
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
    throw new AuthorizationError(
      "User not found or inactive",
      "unauthenticated",
    );
  }

  const [assignment] = await dbAdmin
    .select({
      organizationId: roleAssignments.organizationId,
      portalType: roleAssignments.portalType,
      roleKey: roleAssignments.roleKey,
      clientSubtype: roleAssignments.clientSubtype,
    })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, appUserId))
    .limit(1);
  if (!assignment) {
    throw new AuthorizationError(
      "No active organization membership",
      "forbidden",
    );
  }

  const [org] = await dbAdmin
    .select({
      id: organizations.id,
      name: organizations.name,
      type: organizations.organizationType,
    })
    .from(organizations)
    .where(eq(organizations.id, assignment.organizationId))
    .limit(1);
  if (!org) {
    throw new AuthorizationError("Organization not found", "forbidden");
  }

  const role = resolveEffectiveRole({
    portalType: assignment.portalType,
    roleKey: assignment.roleKey,
    clientSubtype: assignment.clientSubtype,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    organization: org,
    role,
    permissions: buildPermissions(role),
  };
}

function resolveEffectiveRole(input: {
  portalType: string;
  roleKey: string;
  clientSubtype: string | null;
}): EffectiveRole {
  const { portalType, roleKey, clientSubtype } = input;
  if (portalType === "contractor") {
    // Any "owner"/"admin" variant collapses to contractor_admin; everything
    // else on the contractor side is contractor_pm. Estimators, coordinators,
    // and PMs all share the same policy surface for now.
    if (/admin|owner/i.test(roleKey)) return "contractor_admin";
    return "contractor_pm";
  }
  if (portalType === "subcontractor") {
    return "subcontractor_user";
  }
  if (portalType === "client") {
    return clientSubtype === "residential"
      ? "residential_client"
      : "commercial_client";
  }
  throw new AuthorizationError(
    `Unknown portal type: ${portalType}`,
    "forbidden",
  );
}
