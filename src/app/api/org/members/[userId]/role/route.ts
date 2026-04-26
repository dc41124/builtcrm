import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auditEvents, roleAssignments } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { requireOrgAdminContext } from "@/domain/loaders/org-owner-context";
import { countAdminsInOrganization } from "@/domain/loaders/organization-members";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  roleKey: z.string().min(1).max(120),
});

function isAdminRole(roleKey: string): boolean {
  return /admin|owner/i.test(roleKey);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userId: targetUserId } = await params;

  try {
    const ctx = await requireOrgAdminContext(
      session,
    );

    // Role rows are portal-scoped. The caller's portal context decides which
    // assignment we target (contractor/subcontractor/client+subtype).
    const portalFilter =
      ctx.portal === "contractor"
        ? eq(roleAssignments.portalType, "contractor")
        : ctx.portal === "subcontractor"
          ? eq(roleAssignments.portalType, "subcontractor")
          : eq(roleAssignments.portalType, "client");

    const [existing] = await withTenant(ctx.orgId, (tx) =>
      tx
        .select({
          id: roleAssignments.id,
          roleKey: roleAssignments.roleKey,
        })
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.userId, targetUserId),
            eq(roleAssignments.organizationId, ctx.orgId),
            portalFilter,
          ),
        )
        .limit(1),
    );
    if (!existing) {
      throw new AuthorizationError(
        "Member not found in this organization",
        "not_found",
      );
    }

    if (existing.roleKey === parsed.data.roleKey) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    // Last-admin guard: refuse to demote the only admin/owner. countAdmins
    // looks for any role_key matching admin/owner patterns, which covers
    // contractor admin, sub owner, commercial owner, residential co_owner.
    if (
      isAdminRole(existing.roleKey) &&
      !isAdminRole(parsed.data.roleKey)
    ) {
      const adminCount = await countAdminsInOrganization(ctx.orgId, ctx.portal);
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "last_admin",
            message:
              "You can't demote the only Owner/Admin. Promote someone else first.",
          },
          { status: 409 },
        );
      }
    }

    await withTenant(ctx.orgId, async (tx) => {
      await tx
        .update(roleAssignments)
        .set({ roleKey: parsed.data.roleKey })
        .where(eq(roleAssignments.id, existing.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.userId,
        organizationId: ctx.orgId,
        objectType: "membership",
        objectId: existing.id,
        actionName: "role_changed",
        previousState: { roleKey: existing.roleKey },
        nextState: { roleKey: parsed.data.roleKey },
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
