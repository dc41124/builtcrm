import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  invitations,
  organizations,
  projects,
  users,
} from "@/db/schema";
import { hashInvitationToken } from "@/lib/invitations/token";

import { AuthorizationError } from "../permissions";

export type InvitationView = {
  id: string;
  invitedEmail: string;
  invitedName: string | null;
  organization: { id: string; name: string };
  inviter: { id: string; displayName: string | null; email: string };
  portalType: "contractor" | "subcontractor" | "client";
  clientSubtype: "commercial" | "residential" | null;
  roleKey: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: Date;
  personalMessage: string | null;
  project: {
    id: string;
    name: string;
    projectStatus: string;
    clientSubtype: string | null;
  } | null;
};

// Public read: the invite landing page must be reachable without a session,
// since the recipient may not have an account yet. We still expose only the
// minimum needed to render the welcome card — never the inviter's full row.
export async function loadInvitationByToken(
  token: string,
): Promise<InvitationView> {
  if (!token) {
    throw new AuthorizationError("Invitation token missing", "not_found");
  }

  const [row] = await db
    .select({
      id: invitations.id,
      invitedEmail: invitations.invitedEmail,
      invitedName: invitations.invitedName,
      portalType: invitations.portalType,
      clientSubtype: invitations.clientSubtype,
      roleKey: invitations.roleKey,
      status: invitations.invitationStatus,
      expiresAt: invitations.expiresAt,
      personalMessage: invitations.personalMessage,
      projectId: invitations.projectId,
      organizationId: invitations.organizationId,
      organizationName: organizations.name,
      inviterId: users.id,
      inviterEmail: users.email,
      inviterDisplayName: users.displayName,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .innerJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(eq(invitations.tokenHash, hashInvitationToken(token)))
    .limit(1);

  if (!row) {
    throw new AuthorizationError("Invitation not found", "not_found");
  }

  let project: InvitationView["project"] = null;
  if (row.projectId) {
    const [p] = await db
      .select({
        id: projects.id,
        name: projects.name,
        projectStatus: projects.projectStatus,
        clientSubtype: projects.clientSubtype,
      })
      .from(projects)
      .where(eq(projects.id, row.projectId))
      .limit(1);
    if (p) project = p;
  }

  return {
    id: row.id,
    invitedEmail: row.invitedEmail,
    invitedName: row.invitedName,
    organization: { id: row.organizationId, name: row.organizationName },
    inviter: {
      id: row.inviterId,
      email: row.inviterEmail,
      displayName: row.inviterDisplayName,
    },
    portalType: row.portalType as InvitationView["portalType"],
    clientSubtype: (row.clientSubtype ?? null) as InvitationView["clientSubtype"],
    roleKey: row.roleKey,
    status: row.status,
    expiresAt: row.expiresAt,
    personalMessage: row.personalMessage,
    project,
  };
}

export function isInvitationAcceptable(view: InvitationView): {
  ok: boolean;
  reason?: "already_accepted" | "expired" | "revoked";
} {
  if (view.status === "accepted") return { ok: false, reason: "already_accepted" };
  if (view.status === "revoked") return { ok: false, reason: "revoked" };
  if (view.status === "expired" || view.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

// Contractor-side listing for the settings UI
export async function listInvitationsForOrganization(
  organizationId: string,
): Promise<
  Array<{
    id: string;
    invitedEmail: string;
    invitedName: string | null;
    portalType: string;
    roleKey: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
    projectId: string | null;
    projectName: string | null;
  }>
> {
  const rows = await db
    .select({
      id: invitations.id,
      invitedEmail: invitations.invitedEmail,
      invitedName: invitations.invitedName,
      portalType: invitations.portalType,
      roleKey: invitations.roleKey,
      status: invitations.invitationStatus,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      projectId: invitations.projectId,
      projectName: projects.name,
    })
    .from(invitations)
    .leftJoin(projects, eq(projects.id, invitations.projectId))
    .where(eq(invitations.organizationId, organizationId));

  return rows.map((r) => ({
    id: r.id,
    invitedEmail: r.invitedEmail,
    invitedName: r.invitedName,
    portalType: r.portalType,
    roleKey: r.roleKey,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    projectId: r.projectId,
    projectName: r.projectName,
  }));
}

export async function listProjectsForOrganization(
  organizationId: string,
): Promise<Array<{ id: string; name: string; projectCode: string | null }>> {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      projectCode: projects.projectCode,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, organizationId));
}

// Mark a stale invitation expired (cleanup helper used by accept route)
export async function markInvitationExpiredIfNeeded(
  invitationId: string,
  expiresAt: Date,
): Promise<void> {
  if (expiresAt.getTime() < Date.now()) {
    await db
      .update(invitations)
      .set({ invitationStatus: "expired" })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.invitationStatus, "pending"),
        ),
      );
  }
}
