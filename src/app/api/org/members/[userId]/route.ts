import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, organizationUsers, roleAssignments } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { countAdminsInOrganization } from "@/domain/loaders/organization-members";
import { AuthorizationError } from "@/domain/permissions";

function isAdminRole(roleKey: string): boolean {
  return /admin|owner/i.test(roleKey);
}

// Soft-remove: flip membershipStatus to "removed" instead of deleting rows.
// Keeps the historical trail intact for audit and project-level records.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;

  try {
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );

    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only organization admins can remove members",
        "forbidden",
      );
    }

    if (targetUserId === ctx.user.id) {
      return NextResponse.json(
        {
          error: "self_remove",
          message:
            "You can't remove yourself. Ask another Admin or leave via account settings.",
        },
        { status: 409 },
      );
    }

    const [membership] = await db
      .select({
        id: organizationUsers.id,
        status: organizationUsers.membershipStatus,
      })
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.userId, targetUserId),
          eq(organizationUsers.organizationId, ctx.organization.id),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new AuthorizationError(
        "Member not found in this organization",
        "not_found",
      );
    }
    if (membership.status === "removed") {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    // If target is an admin, make sure we won't leave the org admin-less.
    const [targetRole] = await db
      .select({ roleKey: roleAssignments.roleKey })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, targetUserId),
          eq(roleAssignments.organizationId, ctx.organization.id),
          eq(roleAssignments.portalType, "contractor"),
        ),
      )
      .limit(1);
    if (targetRole && isAdminRole(targetRole.roleKey)) {
      const adminCount = await countAdminsInOrganization(ctx.organization.id);
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "last_admin",
            message:
              "You can't remove the only Admin. Promote someone else first.",
          },
          { status: 409 },
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(organizationUsers)
        .set({ membershipStatus: "removed" })
        .where(eq(organizationUsers.id, membership.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "membership",
        objectId: membership.id,
        actionName: "removed",
        previousState: { membershipStatus: membership.status },
        nextState: { membershipStatus: "removed" },
        metadataJson: { targetUserId },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}
