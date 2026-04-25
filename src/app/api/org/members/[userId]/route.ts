import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents, organizationUsers, roleAssignments } from "@/db/schema";
import { requireOrgAdminContext } from "@/domain/loaders/org-owner-context";
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
  const { session } = await requireServerSession();
  const { userId: targetUserId } = await params;

  try {
    const ctx = await requireOrgAdminContext(
      session,
    );

    if (targetUserId === ctx.userId) {
      return NextResponse.json(
        {
          error: "self_remove",
          message:
            "You can't remove yourself. Ask another Owner/Admin or leave via account settings.",
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
          eq(organizationUsers.organizationId, ctx.orgId),
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

    const portalFilter =
      ctx.portal === "contractor"
        ? eq(roleAssignments.portalType, "contractor")
        : ctx.portal === "subcontractor"
          ? eq(roleAssignments.portalType, "subcontractor")
          : eq(roleAssignments.portalType, "client");

    // If target is an owner/admin, make sure we won't leave the org admin-less.
    const [targetRole] = await db
      .select({ roleKey: roleAssignments.roleKey })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, targetUserId),
          eq(roleAssignments.organizationId, ctx.orgId),
          portalFilter,
        ),
      )
      .limit(1);
    if (targetRole && isAdminRole(targetRole.roleKey)) {
      const adminCount = await countAdminsInOrganization(ctx.orgId, ctx.portal);
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "last_admin",
            message:
              "You can't remove the only Owner/Admin. Promote someone else first.",
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
        actorUserId: ctx.userId,
        organizationId: ctx.orgId,
        objectType: "membership",
        objectId: membership.id,
        actionName: "removed",
        previousState: { membershipStatus: membership.status },
        nextState: { membershipStatus: "removed" },
        metadataJson: { targetUserId, portal: ctx.portal },
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
