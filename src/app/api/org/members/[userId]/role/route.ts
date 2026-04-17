import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, roleAssignments } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userId: targetUserId } = await params;

  try {
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );

    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only organization admins can change roles",
        "forbidden",
      );
    }

    const [existing] = await db
      .select({
        id: roleAssignments.id,
        roleKey: roleAssignments.roleKey,
      })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, targetUserId),
          eq(roleAssignments.organizationId, ctx.organization.id),
          eq(roleAssignments.portalType, "contractor"),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new AuthorizationError(
        "Member not found in this organization",
        "not_found",
      );
    }

    if (existing.roleKey === parsed.data.roleKey) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    // Last-admin guard: refuse to demote the only admin.
    if (
      isAdminRole(existing.roleKey) &&
      !isAdminRole(parsed.data.roleKey)
    ) {
      const adminCount = await countAdminsInOrganization(ctx.organization.id);
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "last_admin",
            message:
              "You can't demote the only Admin. Promote someone else first.",
          },
          { status: 409 },
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(roleAssignments)
        .set({ roleKey: parsed.data.roleKey })
        .where(eq(roleAssignments.id, existing.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "membership",
        objectId: existing.id,
        actionName: "role_changed",
        previousState: { roleKey: existing.roleKey },
        nextState: { roleKey: parsed.data.roleKey },
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
