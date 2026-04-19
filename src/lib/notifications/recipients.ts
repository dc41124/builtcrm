import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  conversationParticipants,
  projects,
  projectUserMemberships,
  roleAssignments,
  users,
} from "@/db/schema";
import type { SettingsPortalType } from "@/lib/notification-catalog";

// Who gets a given event. Each rule returns a list of (userId, portalType)
// pairs. The emit helper then applies per-user notification preferences
// and skips the actor so callers don't notify themselves.
//
// Keeping the rules in one file means recipient logic stays consistent
// across every route that emits — "who sees a CO submission" shouldn't
// drift between /api/change-orders/route.ts and /api/change-orders/[id]/submit.

export type Recipient = {
  userId: string;
  portalType: SettingsPortalType;
};

// Project members via explicit project_user_memberships — this is the
// canonical source for sub + client access. Contractor staff get picked
// up separately via projectContractorStaff below (they don't always
// have PUM rows; org-wide staff get implicit project access).
async function projectMembershipsByPortal(
  projectId: string,
  portals: SettingsPortalType[],
): Promise<Recipient[]> {
  if (portals.length === 0) return [];

  const rows = await db
    .select({
      userId: projectUserMemberships.userId,
      portalType: roleAssignments.portalType,
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
        eq(projectUserMemberships.membershipStatus, "active"),
        eq(projectUserMemberships.accessState, "active"),
      ),
    );

  const wanted = new Set(portals);
  const out: Recipient[] = [];
  for (const r of rows) {
    const resolved: SettingsPortalType =
      r.portalType === "contractor"
        ? "contractor"
        : r.portalType === "subcontractor"
          ? "subcontractor"
          : r.clientSubtype === "residential"
            ? "residential"
            : "commercial";
    if (wanted.has(resolved)) {
      out.push({ userId: r.userId, portalType: resolved });
    }
  }
  return out;
}

// Every contractor-portal user assigned to the project's contractor org.
// Mirrors getEffectiveContext's fallback for contractor staff — they
// get implicit access to every project the org owns.
async function projectContractorStaff(
  projectId: string,
): Promise<Recipient[]> {
  const [project] = await db
    .select({ contractorOrganizationId: projects.contractorOrganizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return [];

  const staff = await db
    .select({
      userId: roleAssignments.userId,
      isActive: users.isActive,
    })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        eq(roleAssignments.organizationId, project.contractorOrganizationId),
        eq(roleAssignments.portalType, "contractor"),
      ),
    );

  return staff
    .filter((s) => s.isActive)
    .map((s) => ({ userId: s.userId, portalType: "contractor" as const }));
}

// Dedup a list of (userId, portalType) pairs. Earlier wins on collision.
function dedup(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of recipients) {
    const key = `${r.userId}:${r.portalType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// All contractor-portal users connected to the project: explicit PUM
// rows plus org-staff fallback. Most contractor-side events target this
// union.
async function projectContractors(projectId: string): Promise<Recipient[]> {
  const [fromPum, fromStaff] = await Promise.all([
    projectMembershipsByPortal(projectId, ["contractor"]),
    projectContractorStaff(projectId),
  ]);
  return dedup([...fromPum, ...fromStaff]);
}

async function projectClients(
  projectId: string,
  subtype?: "commercial" | "residential",
): Promise<Recipient[]> {
  const portals: SettingsPortalType[] =
    subtype === "commercial"
      ? ["commercial"]
      : subtype === "residential"
        ? ["residential"]
        : ["commercial", "residential"];
  return projectMembershipsByPortal(projectId, portals);
}

async function projectSubs(
  projectId: string,
  organizationId?: string,
): Promise<Recipient[]> {
  const rows = await db
    .select({
      userId: projectUserMemberships.userId,
      organizationId: projectUserMemberships.organizationId,
      portalType: roleAssignments.portalType,
    })
    .from(projectUserMemberships)
    .innerJoin(
      roleAssignments,
      eq(roleAssignments.id, projectUserMemberships.roleAssignmentId),
    )
    .where(
      and(
        eq(projectUserMemberships.projectId, projectId),
        eq(projectUserMemberships.membershipStatus, "active"),
        eq(projectUserMemberships.accessState, "active"),
        eq(roleAssignments.portalType, "subcontractor"),
      ),
    );
  const scoped = organizationId
    ? rows.filter((r) => r.organizationId === organizationId)
    : rows;
  return scoped.map((r) => ({
    userId: r.userId,
    portalType: "subcontractor" as const,
  }));
}

async function conversationParticipantsFor(
  conversationId: string,
): Promise<Recipient[]> {
  // The conversation's portal context varies per participant; pull each
  // participant's roleAssignments and resolve portal per user. Assume
  // one assignment per user per org for portfolio scope; pick the first.
  const participants = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));

  if (participants.length === 0) return [];

  const userIds = participants.map((p) => p.userId);
  const assignments = await db
    .select({
      userId: roleAssignments.userId,
      portalType: roleAssignments.portalType,
      clientSubtype: roleAssignments.clientSubtype,
    })
    .from(roleAssignments)
    .where(inArray(roleAssignments.userId, userIds));

  // First assignment wins. Ordering is non-deterministic in PG without
  // ORDER BY — acceptable for now, portfolio scope has one role per user.
  const portalByUser = new Map<string, SettingsPortalType>();
  for (const a of assignments) {
    if (portalByUser.has(a.userId)) continue;
    const resolved: SettingsPortalType =
      a.portalType === "contractor"
        ? "contractor"
        : a.portalType === "subcontractor"
          ? "subcontractor"
          : a.clientSubtype === "residential"
            ? "residential"
            : "commercial";
    portalByUser.set(a.userId, resolved);
  }

  return participants
    .map((p) => {
      const portal = portalByUser.get(p.userId);
      return portal ? { userId: p.userId, portalType: portal } : null;
    })
    .filter((r): r is Recipient => r !== null);
}

// Public resolver. Caller passes the actor id so self-notifications
// get filtered out before the emit helper writes rows.
export type RecipientResolveOptions = {
  actorUserId: string;
  projectId: string | null;
  conversationId?: string;
  targetOrganizationId?: string;
};

export async function getEventRecipients(
  eventId: string,
  opts: RecipientResolveOptions,
): Promise<Recipient[]> {
  const { actorUserId, projectId, conversationId, targetOrganizationId } = opts;

  let recipients: Recipient[] = [];

  if (!projectId && !conversationId) return [];

  switch (eventId) {
    case "co_submitted":
    case "co_approved":
    case "draw_submitted":
    case "draw_approved":
    case "rfi_new":
    case "selection_confirmed":
    case "upload_completed":
    case "daily_log_crew_submitted":
    case "punch_item_ready_to_verify":
    case "submittal_submitted":
    case "submittal_reviewer_responded":
      if (projectId) recipients = await projectContractors(projectId);
      break;

    case "co_needs_approval":
    case "approval_needed":
    case "approval_new":
    case "draw_review":
      if (projectId) recipients = await projectClients(projectId, "commercial");
      break;

    case "scope_change":
      if (projectId) recipients = await projectClients(projectId, "residential");
      break;

    case "rfi_assigned":
    case "upload_request":
    case "daily_log_crew_reconciled":
    case "punch_item_assigned":
    case "punch_item_verified":
    case "punch_item_rejected":
    case "submittal_returned":
      if (projectId)
        recipients = await projectSubs(projectId, targetOrganizationId);
      break;

    case "daily_log_posted":
      // Clients (both commercial + residential) see posted daily logs.
      // Each portal's catalog + routing handles redacted copy separately.
      if (projectId) recipients = await projectClients(projectId);
      break;

    case "message_new":
      if (conversationId)
        recipients = await conversationParticipantsFor(conversationId);
      break;

    default:
      recipients = [];
  }

  return recipients.filter((r) => r.userId !== actorUserId);
}
