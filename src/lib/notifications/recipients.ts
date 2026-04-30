import { and, eq, inArray } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
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
//
// Cross-org by design: a single project's recipient set spans the
// contractor org, every sub org with a POM, and every client org with
// a POM. Reads against the RLS-enabled `role_assignments` /
// `project_user_memberships` tables route through `dbAdmin`. The
// authorization gate is the action that triggers the emit; this
// resolver is the system-level "who's on this project" lookup.

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

  const rows = await dbAdmin
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
  const [project] = await dbAdmin
    .select({ contractorOrganizationId: projects.contractorOrganizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return [];

  const staff = await dbAdmin
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

// Step 49 — used by prequalification events. Routes to "all members of org
// X" without a project context. Mirrors the membership lookup that
// `getOrgContext` uses when resolving a user's primary org. Filters by
// portal type so contractor-only events skip subs/clients in the same org
// (theoretically rare; defensive).
export async function orgMembersByPortal(
  organizationId: string,
  portalType: SettingsPortalType,
): Promise<Recipient[]> {
  const rows = await dbAdmin
    .select({
      userId: roleAssignments.userId,
      portalType: roleAssignments.portalType,
      clientSubtype: roleAssignments.clientSubtype,
    })
    .from(roleAssignments)
    .where(eq(roleAssignments.organizationId, organizationId));

  const out: Recipient[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const resolved: SettingsPortalType =
      r.portalType === "contractor"
        ? "contractor"
        : r.portalType === "subcontractor"
          ? "subcontractor"
          : r.clientSubtype === "residential"
            ? "residential"
            : "commercial";
    if (resolved !== portalType) continue;
    const key = `${r.userId}:${resolved}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: r.userId, portalType: resolved });
  }
  return out;
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
  const rows = await dbAdmin
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
  const participants = await dbAdmin
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));

  if (participants.length === 0) return [];

  const userIds = participants.map((p) => p.userId);
  const assignments = await dbAdmin
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
  // Step 49 — explicit (orgId, portalType) target for events that emit
  // to multiple org directions (e.g. prequal_expired notifies both the
  // sub and the contractor; the action layer emits twice).
  targetOrganizationByPortal?: {
    orgId: string;
    portalType: SettingsPortalType;
  };
};

export async function getEventRecipients(
  eventId: string,
  opts: RecipientResolveOptions,
): Promise<Recipient[]> {
  const {
    actorUserId,
    projectId,
    conversationId,
    targetOrganizationId,
    targetOrganizationByPortal,
  } = opts;

  let recipients: Recipient[] = [];

  // Org-scoped events (Step 49 prequalification) may have no project
  // context. Allow them through when an org target is set.
  if (
    !projectId &&
    !conversationId &&
    !targetOrganizationId &&
    !targetOrganizationByPortal
  ) {
    return [];
  }

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
    case "safety_incident_reported":
    case "safety_form_submitted":
      // Step 52 — safety events fan out to all contractor staff on the
      // project (admin + PM). Same pattern as daily-log-crew/submittals
      // because the legitimate audience is the project's GC team.
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

    case "weekly_update":
      // Weekly progress reports go to all client members (both
      // commercial + residential). The contractor's send action also
      // surfaces this list in the "Sending to" footer.
      if (projectId) recipients = await projectClients(projectId);
      break;

    case "closeout_package_delivered":
      // Delivered closeout goes to all client members on the project.
      // Portal-specific copy is rendered in routing.ts.
      if (projectId) recipients = await projectClients(projectId);
      break;

    case "closeout_package_commented":
    case "closeout_package_accepted":
      // Client-driven events — go back to the contractor staff on the
      // project. V1 is client-write-only for comments; if bidirectional
      // ever ships, split into _commented_by_client / _commented_by_contractor
      // rather than broadening this event (notification preferences would
      // break otherwise).
      if (projectId) recipients = await projectContractors(projectId);
      break;

    // ── Prequalification (Step 49) — org-scoped, no project context ──
    // Each event targets one org direction. `targetOrganizationId` carries
    // the destination org; the case picks the right portal type.
    case "prequal_invited":
    case "prequal_approved":
    case "prequal_rejected":
      // Sub-direction: notify all subcontractor users in the sub org.
      if (targetOrganizationId) {
        recipients = await orgMembersByPortal(
          targetOrganizationId,
          "subcontractor",
        );
      }
      break;

    case "prequal_submitted":
    case "prequal_override_used":
      // Contractor-direction: notify all contractor users in the contractor org.
      if (targetOrganizationId) {
        recipients = await orgMembersByPortal(
          targetOrganizationId,
          "contractor",
        );
      }
      break;

    case "prequal_expired":
    case "prequal_expiring_soon":
      // Direction depends on which side is being notified. The action
      // layer emits this event twice (once per portal type), each call
      // setting `targetOrganizationByPortal` to the right (orgId,
      // portalType) tuple. The resolver branches on it.
      if (targetOrganizationByPortal) {
        recipients = await orgMembersByPortal(
          targetOrganizationByPortal.orgId,
          targetOrganizationByPortal.portalType,
        );
      }
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
