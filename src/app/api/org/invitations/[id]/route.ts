import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { auditEvents, invitations } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { requireOrgAdminContext } from "@/domain/loaders/org-owner-context";
import { AuthorizationError } from "@/domain/permissions";

// Cancel/revoke a pending invitation. Hard-refuse accepted invites.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const { id } = await params;

  try {
    const ctx = await requireOrgAdminContext(
      session,
    );

    type RevokeOutcome = "not_found" | "already_accepted" | "noop" | "revoked";
    const outcome = await withTenant(ctx.orgId, async (tx): Promise<RevokeOutcome> => {
      const [invite] = await tx
        .select({
          id: invitations.id,
          status: invitations.invitationStatus,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.id, id),
            eq(invitations.organizationId, ctx.orgId),
          ),
        )
        .limit(1);

      if (!invite) return "not_found";
      if (invite.status === "accepted") return "already_accepted";
      if (invite.status === "revoked") return "noop";

      await tx
        .update(invitations)
        .set({ invitationStatus: "revoked" })
        .where(eq(invitations.id, invite.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.userId,
        organizationId: ctx.orgId,
        objectType: "invitation",
        objectId: invite.id,
        actionName: "revoked",
        previousState: { invitationStatus: invite.status },
        nextState: { invitationStatus: "revoked" },
        metadataJson: { portal: ctx.portal },
      });
      return "revoked";
    });

    if (outcome === "not_found") {
      throw new AuthorizationError("Invitation not found", "not_found");
    }
    if (outcome === "already_accepted") {
      return NextResponse.json(
        {
          error: "already_accepted",
          message: "This invitation has already been accepted.",
        },
        { status: 409 },
      );
    }
    if (outcome === "noop") {
      return NextResponse.json({ ok: true, unchanged: true });
    }

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
