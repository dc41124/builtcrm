import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  dsarRequests,
  organizationUsers,
  privacyOfficers,
  roleAssignments,
  users,
} from "@/db/schema";

// Step 65 Session B — privacy admin loader.
//
// Returns the data the contractor `/settings/privacy` page needs:
//   - currently designated Privacy Officer (or null)
//   - the DSAR queue for this org
//   - the candidate users who could be designated officer (active org
//     admins / members with a contractor role)
//
// `dsar_requests` is intentionally not RLS'd (see security_posture.md
// §6); we scope reads by organization_id explicitly. `privacy_officers`
// IS RLS'd, so we use withTenant for that read so the policy enforces
// the same constraint as the WHERE clause does — defense in depth.

export type PrivacyOfficerView = {
  id: string;
  userId: string;
  name: string;
  email: string;
  initials: string;
  designatedAt: Date;
  designatedByName: string | null;
};

export type PrivacyOfficerCandidate = {
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  initials: string;
};

export type DsarRequestRow = {
  id: string;
  referenceCode: string;
  requesterName: string;
  requesterEmail: string;
  accountEmail: string | null;
  province: string;
  requestType: "access" | "deletion" | "rectification" | "portability";
  description: string;
  status: "received" | "in_progress" | "completed" | "rejected";
  receivedAt: Date;
  slaDueAt: Date;
  completedAt: Date | null;
  notes: string | null;
  projectContext: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  subjectUserId: string | null;
  daysRemaining: number;
};

export type PrivacyAdminView = {
  organizationId: string;
  organizationName: string;
  officer: PrivacyOfficerView | null;
  candidates: PrivacyOfficerCandidate[];
  dsars: DsarRequestRow[];
  nowMs: number;
};

function deriveInitials(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  const parts = source.split(/\s+|@/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "??";
}

export async function loadPrivacyAdminView(input: {
  organizationId: string;
  organizationName: string;
}): Promise<PrivacyAdminView> {
  // Officer + designator name. RLS-scoped read so the policy enforces.
  const officerRows = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        id: privacyOfficers.id,
        userId: privacyOfficers.userId,
        userEmail: users.email,
        userDisplayName: users.displayName,
        designatedAt: privacyOfficers.designatedAt,
        designatedByUserId: privacyOfficers.designatedByUserId,
      })
      .from(privacyOfficers)
      .innerJoin(users, eq(users.id, privacyOfficers.userId))
      .where(eq(privacyOfficers.organizationId, input.organizationId))
      .limit(1),
  );
  const officerRow = officerRows[0] ?? null;

  let designatedByName: string | null = null;
  if (officerRow?.designatedByUserId) {
    const [designator] = await dbAdmin
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, officerRow.designatedByUserId))
      .limit(1);
    designatedByName = designator?.displayName ?? designator?.email ?? null;
  }

  const officer: PrivacyOfficerView | null = officerRow
    ? {
        id: officerRow.id,
        userId: officerRow.userId,
        name: officerRow.userDisplayName ?? officerRow.userEmail,
        email: officerRow.userEmail,
        initials: deriveInitials(officerRow.userDisplayName, officerRow.userEmail),
        designatedAt: officerRow.designatedAt,
        designatedByName,
      }
    : null;

  // Candidate pool: contractor org members with an active role assignment.
  // We don't restrict to admins because the prototype's picker shows all
  // active members; the calling endpoint enforces "designator must be admin",
  // not "candidate must be admin".
  const candidateRows = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        roleKey: roleAssignments.roleKey,
      })
      .from(organizationUsers)
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .innerJoin(
        roleAssignments,
        and(
          eq(roleAssignments.userId, organizationUsers.userId),
          eq(roleAssignments.organizationId, organizationUsers.organizationId),
          eq(roleAssignments.portalType, "contractor"),
        ),
      )
      .where(
        and(
          eq(organizationUsers.organizationId, input.organizationId),
          eq(organizationUsers.membershipStatus, "active"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(users.displayName)),
  );

  const candidates: PrivacyOfficerCandidate[] = candidateRows.map((r) => ({
    userId: r.userId,
    name: r.displayName ?? r.email,
    email: r.email,
    roleKey: r.roleKey,
    initials: deriveInitials(r.displayName, r.email),
  }));

  // DSAR queue. dbAdmin since the table is intentionally un-RLS'd; scope
  // by organization_id in the WHERE explicitly.
  const dsarRows = await dbAdmin
    .select({
      id: dsarRequests.id,
      referenceCode: dsarRequests.referenceCode,
      requesterName: dsarRequests.requesterName,
      requesterEmail: dsarRequests.requesterEmail,
      accountEmail: dsarRequests.accountEmail,
      province: dsarRequests.province,
      requestType: dsarRequests.requestType,
      description: dsarRequests.description,
      status: dsarRequests.status,
      receivedAt: dsarRequests.receivedAt,
      slaDueAt: dsarRequests.slaDueAt,
      completedAt: dsarRequests.completedAt,
      notes: dsarRequests.notes,
      projectContext: dsarRequests.projectContext,
      assignedToUserId: dsarRequests.assignedToUserId,
      assignedToName: users.displayName,
      assignedToEmail: users.email,
      subjectUserId: dsarRequests.subjectUserId,
    })
    .from(dsarRequests)
    .leftJoin(users, eq(users.id, dsarRequests.assignedToUserId))
    .where(eq(dsarRequests.organizationId, input.organizationId))
    .orderBy(desc(dsarRequests.receivedAt));

  const now = Date.now();
  const dsars: DsarRequestRow[] = dsarRows.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    accountEmail: r.accountEmail,
    province: r.province,
    requestType: r.requestType,
    description: r.description,
    status: r.status,
    receivedAt: r.receivedAt,
    slaDueAt: r.slaDueAt,
    completedAt: r.completedAt,
    notes: r.notes,
    projectContext: r.projectContext,
    assignedToUserId: r.assignedToUserId,
    assignedToName: r.assignedToName ?? r.assignedToEmail ?? null,
    subjectUserId: r.subjectUserId,
    daysRemaining: Math.ceil((r.slaDueAt.getTime() - now) / (24 * 60 * 60 * 1000)),
  }));

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    officer,
    candidates,
    dsars,
    nowMs: now,
  };
}
