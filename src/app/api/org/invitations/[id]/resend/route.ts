import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, invitations } from "@/db/schema";
import { requireOrgAdminContext } from "@/domain/loaders/org-owner-context";
import { AuthorizationError } from "@/domain/permissions";

const INVITE_TTL_DAYS = 14;

// Resend a pending invite — bumps expiresAt forward by the TTL and writes an
// audit event. Today this is a stub: once an outbound email provider is wired
// (Postmark/SendGrid via Trigger.dev), we'll trigger the invite email from
// here as well.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ctx = await requireOrgAdminContext(
      session.session as unknown as { appUserId?: string | null },
    );

    const [invite] = await db
      .select({
        id: invitations.id,
        status: invitations.invitationStatus,
        invitedEmail: invitations.invitedEmail,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.organizationId, ctx.orgId),
        ),
      )
      .limit(1);

    if (!invite) {
      throw new AuthorizationError("Invitation not found", "not_found");
    }
    if (invite.status !== "pending" && invite.status !== "expired") {
      return NextResponse.json(
        {
          error: "invalid_state",
          message: `Invitation is ${invite.status}, can't resend.`,
        },
        { status: 409 },
      );
    }

    const newExpires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx
        .update(invitations)
        .set({
          expiresAt: newExpires,
          invitationStatus: "pending",
        })
        .where(eq(invitations.id, invite.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.userId,
        organizationId: ctx.orgId,
        objectType: "invitation",
        objectId: invite.id,
        actionName: "resent",
        metadataJson: {
          invitedEmail: invite.invitedEmail,
          expiresAt: newExpires.toISOString(),
          portal: ctx.portal,
        },
      });
    });

    // No inviteUrl in response: the DB only stores the token hash, so we
    // cannot reconstruct the original plaintext URL here. Admin relies on
    // the URL captured at creation time; if lost, revoke + recreate.
    return NextResponse.json({
      ok: true,
      expiresAt: newExpires,
    });
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
