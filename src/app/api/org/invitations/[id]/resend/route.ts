import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { auditEvents, invitations } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { requireOrgAdminContext } from "@/domain/loaders/org-owner-context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";
import { enforceLimit, inviteLimiter } from "@/lib/ratelimit";

const INVITE_TTL_DAYS = 14;

// Resend a pending invite — bumps expiresAt forward by the TTL and writes an
// audit event. Today this is a stub: once an outbound email provider is wired
// (Postmark/SendGrid via Trigger.dev), we'll trigger the invite email from
// here as well.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    const ctx = await requireOrgAdminContext(
      session,
    );

    const newExpires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    type ResendOutcome =
      | { kind: "not_found" }
      | { kind: "invalid_state"; status: string }
      | { kind: "ok" };

    const outcome = await withTenant(ctx.orgId, async (tx): Promise<ResendOutcome> => {
      const [invite] = await tx
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

      if (!invite) return { kind: "not_found" };
      if (invite.status !== "pending" && invite.status !== "expired") {
        return { kind: "invalid_state", status: invite.status };
      }

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
      return { kind: "ok" };
    });

    if (outcome.kind === "not_found") {
      throw new AuthorizationError("Invitation not found", "not_found");
    }
    if (outcome.kind === "invalid_state") {
      return NextResponse.json(
        {
          error: "invalid_state",
          message: `Invitation is ${outcome.status}, can't resend.`,
        },
        { status: 409 },
      );
    }

    // No inviteUrl in response: the DB only stores the token hash, so we
    // cannot reconstruct the original plaintext URL here. Admin relies on
    // the URL captured at creation time; if lost, revoke + recreate.
    return NextResponse.json({
      ok: true,
      expiresAt: newExpires,
    });
  }, { path: "/api/org/invitations/[id]/resend", method: "POST" });
}
