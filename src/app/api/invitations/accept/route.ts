import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  auditEvents,
  invitations,
  organizationUsers,
  projectUserMemberships,
  projects,
  roleAssignments,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { checkPrequalForAssignment } from "@/domain/prequal";
import { withErrorHandler } from "@/lib/api/error-handler";
import { hashInvitationToken } from "@/lib/invitations/token";
import { enforceLimit, inviteLimiter } from "@/lib/ratelimit";
import { recordSignupConsents } from "@/domain/privacy/consents";
import { ALL_CONSENT_KEYS } from "@/lib/privacy/consent-catalog";

const ConsentTypeSchema = z.enum(ALL_CONSENT_KEYS as never as [string, ...string[]]);

const BodySchema = z.object({
  token: z.string().min(1),
  // Step 65 Session C — consent checklist captured during signup. Required
  // consents are always granted by the helper; this map only carries the
  // user's optional toggles. Older clients can omit it; the helper falls
  // back to catalog defaults.
  optionalConsents: z.record(ConsentTypeSchema, z.boolean()).optional(),
});

// Thrown inside the accept transaction when prequal enforcement is set to
// `block` and the sub doesn't have an active approved prequalification (or
// a project exemption). The txn rolls back; the route returns 403 with the
// reason so the inviting contractor knows to either approve a pending
// prequal or grant an exemption.
class PrequalBlockedError extends Error {
  constructor(
    message: string,
    public readonly detail: {
      activeStatus: string;
      submissionId?: string;
    },
  ) {
    super(message);
    this.name = "PrequalBlockedError";
  }
}

export async function POST(req: Request) {
  return withErrorHandler(async () => {
    const limit = await enforceLimit(inviteLimiter, req);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)),
          },
        },
      );
    }
  const { session } = await requireServerSession();
    const appUserId = (session)
      .appUserId;
    if (!appUserId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const optionalConsents = parsed.data.optionalConsents as
      | Record<string, boolean>
      | undefined;

    // Pre-tenant token lookup — orgId not yet known. Admin pool
    // bypasses RLS on invitations.
    const [invitation] = await dbAdmin
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashInvitationToken(parsed.data.token)))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (invitation.invitationStatus !== "pending") {
      return NextResponse.json(
        { error: "invitation_unavailable", status: invitation.invitationStatus },
        { status: 409 },
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      // Lazy expired-mark — same admin-pool reasoning as the read above.
      await dbAdmin
        .update(invitations)
        .set({ invitationStatus: "expired" })
        .where(eq(invitations.id, invitation.id));
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    // Confirm the signed-in user matches the invited email. We don't strictly
    // require the same address (a contractor admin could accept on behalf of
    // someone else), but the typical flow is recipient-driven.
    const [signedInUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, appUserId))
      .limit(1);
    if (!signedInUser) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    if (
      signedInUser.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()
    ) {
      return NextResponse.json({ error: "email_mismatch" }, { status: 403 });
    }

    // Idempotently provision: org membership → role assignment → optional
    // project membership → mark invitation accepted. Wrapped so a partial
    // failure leaves no half-accepted state.
    let result: {
      portalType: string;
      clientSubtype: string | null;
      projectId: string | null;
    };
    try {
      // Token resolved → invitation.organizationId known. Wrap the
      // whole accept transaction in withTenant so the organization_users
      // INSERT (and any future RLS-enforced sibling tables touched
      // here — roleAssignments, projectUserMemberships, invitations,
      // auditEvents) all run with the correct GUC.
      result = await withTenant(invitation.organizationId, async (tx) => {
      const existingOrgUser = await tx
        .select({ id: organizationUsers.id })
        .from(organizationUsers)
        .where(
          and(
            eq(organizationUsers.organizationId, invitation.organizationId),
            eq(organizationUsers.userId, appUserId),
          ),
        )
        .limit(1);
      if (existingOrgUser.length === 0) {
        await tx.insert(organizationUsers).values({
          organizationId: invitation.organizationId,
          userId: appUserId,
          membershipStatus: "active",
        });
      }

      const existingRole = await tx
        .select({
          id: roleAssignments.id,
          portalType: roleAssignments.portalType,
          clientSubtype: roleAssignments.clientSubtype,
        })
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.userId, appUserId),
            eq(roleAssignments.organizationId, invitation.organizationId),
            eq(
              roleAssignments.portalType,
              invitation.portalType as "contractor" | "subcontractor" | "client",
            ),
          ),
        )
        .limit(1);

      let roleAssignmentId: string;
      if (existingRole[0]) {
        roleAssignmentId = existingRole[0].id;
      } else {
        // First role assignment for this user becomes their primary so the
        // session hook has something to return for portal routing.
        const [hasAnyRole] = await tx
          .select({ id: roleAssignments.id })
          .from(roleAssignments)
          .where(eq(roleAssignments.userId, appUserId))
          .limit(1);
        const isPrimary = !hasAnyRole;

        const [newRole] = await tx
          .insert(roleAssignments)
          .values({
            userId: appUserId,
            organizationId: invitation.organizationId,
            portalType: invitation.portalType as
              | "contractor"
              | "subcontractor"
              | "client",
            roleKey: invitation.roleKey,
            clientSubtype: (invitation.clientSubtype ?? null) as
              | "commercial"
              | "residential"
              | null,
            isPrimary,
          })
          .returning({ id: roleAssignments.id });
        roleAssignmentId = newRole.id;
      }

      // Prequal-enforcement gate (Step 49). When a subcontractor is being
      // added to a project, consult the contractor org's enforcement
      // setting. `block` rejects the accept; `warn` proceeds but writes
      // an override audit event. `ok` flows through normally. Runs inside
      // the same transaction so a blocked accept leaves no partial state.
      let prequalOverride:
        | { activeStatus: string; submissionId?: string }
        | null = null;
      if (invitation.projectId && invitation.portalType === "subcontractor") {
        const [proj] = await tx
          .select({ contractorOrgId: projects.contractorOrganizationId })
          .from(projects)
          .where(eq(projects.id, invitation.projectId))
          .limit(1);
        if (proj?.contractorOrgId) {
          const decision = await checkPrequalForAssignment(
            proj.contractorOrgId,
            invitation.organizationId,
            invitation.projectId,
          );
          if (decision.kind === "block") {
            // Surface a controlled error; the txn will roll back.
            throw new PrequalBlockedError(decision.reason, decision);
          }
          if (decision.kind === "warn") {
            prequalOverride = {
              activeStatus: decision.activeStatus,
              submissionId: decision.submissionId,
            };
          }
        }
      }

      if (invitation.projectId) {
        const existingMembership = await tx
          .select({ id: projectUserMemberships.id })
          .from(projectUserMemberships)
          .where(
            and(
              eq(projectUserMemberships.projectId, invitation.projectId),
              eq(projectUserMemberships.userId, appUserId),
            ),
          )
          .limit(1);
        if (existingMembership.length === 0) {
          await tx.insert(projectUserMemberships).values({
            projectId: invitation.projectId,
            userId: appUserId,
            organizationId: invitation.organizationId,
            roleAssignmentId,
            membershipStatus: "active",
            accessState: "active",
          });
        }
      }

      if (prequalOverride) {
        await tx.insert(auditEvents).values({
          actorUserId: appUserId,
          projectId: invitation.projectId,
          organizationId: invitation.organizationId,
          objectType: "prequal_assignment_override",
          objectId: invitation.id,
          actionName: "warn_override_accepted",
          metadataJson: prequalOverride,
        });
      }

      await tx
        .update(invitations)
        .set({
          invitationStatus: "accepted",
          acceptedAt: new Date(),
          acceptedByUserId: appUserId,
        })
        .where(eq(invitations.id, invitation.id));

      await tx.insert(auditEvents).values({
        actorUserId: appUserId,
        projectId: invitation.projectId,
        organizationId: invitation.organizationId,
        objectType: "invitation",
        objectId: invitation.id,
        actionName: "accepted",
        nextState: {
          portalType: invitation.portalType,
          roleKey: invitation.roleKey,
          projectId: invitation.projectId,
        },
      });

      // Step 65 Session C — write the consent checklist captured at
      // signup. Required consents are always granted; optional consents
      // honor the user's toggles (or catalog defaults when absent). One
      // row per consent type, all inside this same accept transaction so
      // a failure rolls everything back together.
      await recordSignupConsents({
        organizationId: invitation.organizationId,
        userId: appUserId,
        acceptedOptional: optionalConsents ?? {},
        source: "signup_form",
        tx,
      });
      await tx.insert(auditEvents).values({
        actorUserId: appUserId,
        projectId: invitation.projectId,
        organizationId: invitation.organizationId,
        objectType: "user",
        objectId: appUserId,
        actionName: "privacy.consent.signup_recorded",
        metadataJson: { optionalConsents: optionalConsents ?? null },
      });

      return {
        portalType: invitation.portalType,
        clientSubtype: invitation.clientSubtype,
        projectId: invitation.projectId,
      };
    });
    } catch (err) {
      if (err instanceof PrequalBlockedError) {
        return NextResponse.json(
          {
            error: "prequal_blocked",
            message: err.message,
            activeStatus: err.detail.activeStatus,
            submissionId: err.detail.submissionId ?? null,
          },
          { status: 403 },
        );
      }
      throw err;
    }

    return NextResponse.json({
      ok: true,
      portalType: result.portalType,
      clientSubtype: result.clientSubtype,
      projectId: result.projectId,
    });
  }, { path: "/api/invitations/accept", method: "POST" });
}
