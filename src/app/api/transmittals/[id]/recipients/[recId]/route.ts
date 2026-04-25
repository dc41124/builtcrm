import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  organizations,
  transmittalRecipients,
  transmittals,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padTransmittalNumber } from "@/domain/loaders/transmittals";
import { AuthorizationError } from "@/domain/permissions";
import { env } from "@/lib/env";
import { sendTransmittalEmails } from "@/lib/transmittals/email";
import {
  buildShareUrl,
  generateAccessToken,
} from "@/lib/transmittals/token";

// PATCH /api/transmittals/:id/recipients/:recId
//
// Actions supported:
//   { action: "regenerate" } — rotate the access token for this
//     recipient. Invalidates the existing link (old digest dropped),
//     returns the new plaintext URL once. Treated as a "resend" —
//     writes an audit + activity row, and re-emits email stubs.
//   { action: "revoke" } — stamp revoked_at + clear the digest so the
//     existing link stops resolving. No new URL returned.
//
// Both require contractor auth + a sent transmittal (the draft editor
// doesn't surface these actions).

const BodySchema = z.object({
  action: z.enum(["regenerate", "revoke"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; recId: string }> },
) {
  const { id, recId } = await params;
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
  const { action } = parsed.data;

  try {
    const [row] = await db
      .select({
        recipientId: transmittalRecipients.id,
        email: transmittalRecipients.email,
        name: transmittalRecipients.name,
        revokedAt: transmittalRecipients.revokedAt,
        transmittalId: transmittals.id,
        projectId: transmittals.projectId,
        subject: transmittals.subject,
        sequentialNumber: transmittals.sequentialNumber,
        status: transmittals.status,
      })
      .from(transmittalRecipients)
      .innerJoin(
        transmittals,
        eq(transmittals.id, transmittalRecipients.transmittalId),
      )
      .where(
        and(
          eq(transmittalRecipients.id, recId),
          eq(transmittalRecipients.transmittalId, id),
        ),
      )
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      row.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can modify recipients",
        "forbidden",
      );
    }
    if (row.status !== "sent") {
      return NextResponse.json(
        {
          error: "not_sent",
          message: "Regenerate/revoke only apply to sent transmittals",
        },
        { status: 409 },
      );
    }

    const numberLabel = padTransmittalNumber(row.sequentialNumber);

    if (action === "regenerate") {
      if (row.revokedAt) {
        return NextResponse.json(
          { error: "revoked", message: "Recipient is revoked" },
          { status: 409 },
        );
      }
      const token = generateAccessToken();
      const [contractorOrg] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.project.contractorOrganizationId))
        .limit(1);

      await db.transaction(async (tx) => {
        await tx
          .update(transmittalRecipients)
          .set({ accessTokenDigest: token.digest })
          .where(eq(transmittalRecipients.id, recId));

        await writeAuditEvent(
          ctx,
          {
            action: "token_regenerated",
            resourceType: "transmittal_recipient",
            resourceId: recId,
            details: { metadata: { transmittalId: id } },
          },
          tx,
        );

        await writeActivityFeedItem(
          ctx,
          {
            activityType: "project_update",
            summary: `${numberLabel} — resent to ${row.name}`,
            body: `New share URL generated for ${row.email}.`,
            relatedObjectType: "transmittal",
            relatedObjectId: id,
            visibilityScope: "internal_only",
          },
          tx,
        );

        const shareUrl = buildShareUrl(env.BETTER_AUTH_URL, token.plaintext);
        await sendTransmittalEmails(tx, {
          projectId: row.projectId,
          transmittalId: id,
          transmittalNumberLabel: numberLabel,
          subject: row.subject,
          message: "",
          senderName: ctx.user.displayName ?? ctx.user.email,
          senderOrgName: contractorOrg?.name ?? null,
          actorUserId: ctx.user.id,
          recipients: [
            {
              recipientId: row.recipientId,
              email: row.email,
              name: row.name,
              shareUrl,
            },
          ],
        });
      });

      return NextResponse.json({
        ok: true,
        shareUrl: buildShareUrl(env.BETTER_AUTH_URL, token.plaintext),
      });
    }

    // action === "revoke"
    if (row.revokedAt) {
      return NextResponse.json({ ok: true, alreadyRevoked: true });
    }
    await db.transaction(async (tx) => {
      await tx
        .update(transmittalRecipients)
        .set({
          revokedAt: new Date(),
          revokedByUserId: ctx.user.id,
          // Drop the digest so the URL stops resolving even if
          // someone saved it before.
          accessTokenDigest: null,
        })
        .where(eq(transmittalRecipients.id, recId));

      await writeAuditEvent(
        ctx,
        {
          action: "recipient_revoked",
          resourceType: "transmittal_recipient",
          resourceId: recId,
          details: {
            previousState: { email: row.email },
            nextState: { revoked: true },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${numberLabel} — revoked ${row.name}`,
          body: `Access disabled for ${row.email}.`,
          relatedObjectType: "transmittal",
          relatedObjectId: id,
          visibilityScope: "internal_only",
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
