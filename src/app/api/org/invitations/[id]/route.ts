import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, invitations } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

// Cancel/revoke a pending invitation. Hard-refuse accepted invites.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );

    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only organization admins can cancel invitations",
        "forbidden",
      );
    }

    const [invite] = await db
      .select({
        id: invitations.id,
        status: invitations.invitationStatus,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.organizationId, ctx.organization.id),
        ),
      )
      .limit(1);

    if (!invite) {
      throw new AuthorizationError("Invitation not found", "not_found");
    }
    if (invite.status === "accepted") {
      return NextResponse.json(
        {
          error: "already_accepted",
          message: "This invitation has already been accepted.",
        },
        { status: 409 },
      );
    }
    if (invite.status === "revoked") {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(invitations)
        .set({ invitationStatus: "revoked" })
        .where(eq(invitations.id, invite.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "invitation",
        objectId: invite.id,
        actionName: "revoked",
        previousState: { invitationStatus: invite.status },
        nextState: { invitationStatus: "revoked" },
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
