import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  auditEvents,
  invitations,
  organizationUsers,
  projectUserMemberships,
  roleAssignments,
  users,
} from "@/db/schema";
import { withErrorHandler } from "@/lib/api/error-handler";
import { hashInvitationToken } from "@/lib/invitations/token";
import { enforceLimit, inviteLimiter } from "@/lib/ratelimit";

const BodySchema = z.object({
  token: z.string().min(1),
});

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

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const appUserId = (session.session as unknown as { appUserId?: string | null })
      .appUserId;
    if (!appUserId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const [invitation] = await db
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
      await db
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
    const result = await db.transaction(async (tx) => {
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

      return {
        portalType: invitation.portalType,
        clientSubtype: invitation.clientSubtype,
        projectId: invitation.projectId,
      };
    });

    return NextResponse.json({
      ok: true,
      portalType: result.portalType,
      clientSubtype: result.clientSubtype,
      projectId: result.projectId,
    });
  }, { path: "/api/invitations/accept", method: "POST" });
}
