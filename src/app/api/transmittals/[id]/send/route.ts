import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  organizations,
  projects,
  transmittalDocuments,
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

// POST /api/transmittals/:id/send — transition a draft to sent.
//
// Inside a single transaction:
//   1. Atomic bump of projects.transmittal_counter → sequential_number
//   2. Generate per-recipient access tokens (plaintext → digest at rest)
//   3. Flip status to 'sent', stamp sent_at + sent_by_user_id
//   4. Write audit event + activity feed item
//   5. Fire the stubbed email path (structured log + in-app notifications
//      for internal-user matches)
//
// The response includes the per-recipient share URLs — the only time
// the plaintext token is ever exposed. The sender copies them into
// their own email client until a real provider is wired.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const [head] = await db
      .select({
        id: transmittals.id,
        projectId: transmittals.projectId,
        status: transmittals.status,
        subject: transmittals.subject,
      })
      .from(transmittals)
      .where(eq(transmittals.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can send transmittals",
        "forbidden",
      );
    }

    if (head.status === "sent") {
      return NextResponse.json(
        { error: "already_sent" },
        { status: 409 },
      );
    }

    // Pre-flight: need at least one recipient and one document.
    const recipientRows = await db
      .select({
        id: transmittalRecipients.id,
        email: transmittalRecipients.email,
        name: transmittalRecipients.name,
      })
      .from(transmittalRecipients)
      .where(eq(transmittalRecipients.transmittalId, id));
    const [docCountRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(transmittalDocuments)
      .where(eq(transmittalDocuments.transmittalId, id));
    const docCount = docCountRow?.c ?? 0;
    if (recipientRows.length === 0) {
      return NextResponse.json(
        { error: "no_recipients" },
        { status: 409 },
      );
    }
    if (docCount === 0) {
      return NextResponse.json(
        { error: "no_documents" },
        { status: 409 },
      );
    }

    // Generate tokens outside the transaction — crypto doesn't need
    // to hold a DB lock, and we want these in memory to return in the
    // response.
    const tokensByRecipientId = new Map<
      string,
      { plaintext: string; digest: string }
    >();
    for (const r of recipientRows) {
      tokensByRecipientId.set(r.id, generateAccessToken());
    }

    const senderDisplayName = ctx.user.displayName ?? ctx.user.email;
    const [contractorOrg] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, ctx.project.contractorOrganizationId))
      .limit(1);

    const result = await db.transaction(async (tx) => {
      const [bumped] = await tx
        .update(projects)
        .set({ transmittalCounter: sql`${projects.transmittalCounter} + 1` })
        .where(eq(projects.id, head.projectId))
        .returning({ n: projects.transmittalCounter });
      const sequentialNumber = bumped.n;
      const numberLabel = padTransmittalNumber(sequentialNumber);

      for (const r of recipientRows) {
        const token = tokensByRecipientId.get(r.id)!;
        await tx
          .update(transmittalRecipients)
          .set({ accessTokenDigest: token.digest })
          .where(eq(transmittalRecipients.id, r.id));
      }

      await tx
        .update(transmittals)
        .set({
          sequentialNumber,
          status: "sent",
          sentAt: new Date(),
          sentByUserId: ctx.user.id,
        })
        .where(eq(transmittals.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "sent",
          resourceType: "transmittal",
          resourceId: id,
          details: {
            nextState: {
              sequentialNumber,
              recipientCount: recipientRows.length,
              documentCount: docCount,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${numberLabel}: ${head.subject}`,
          body: `Sent to ${recipientRows.length} recipient${recipientRows.length === 1 ? "" : "s"}.`,
          relatedObjectType: "transmittal",
          relatedObjectId: id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      // Build the share URLs. Base URL comes from env — never use
      // request host because forwarding proxies can spoof it.
      const base = env.BETTER_AUTH_URL;
      const emailPayloads = recipientRows.map((r) => {
        const token = tokensByRecipientId.get(r.id)!;
        return {
          recipientId: r.id,
          email: r.email,
          name: r.name,
          shareUrl: buildShareUrl(base, token.plaintext),
        };
      });

      await sendTransmittalEmails(tx, {
        projectId: head.projectId,
        transmittalId: id,
        transmittalNumberLabel: numberLabel,
        subject: head.subject,
        message: "",
        senderName: senderDisplayName,
        senderOrgName: contractorOrg?.name ?? null,
        actorUserId: ctx.user.id,
        recipients: emailPayloads,
      });

      return { sequentialNumber, numberLabel, emailPayloads };
    });

    return NextResponse.json({
      ok: true,
      sequentialNumber: result.sequentialNumber,
      numberLabel: result.numberLabel,
      // The only time plaintext tokens are exposed — the sender UI
      // surfaces these in the sent-transmittal detail view so the
      // GC can copy/send manually while email delivery is stubbed.
      shareUrls: result.emailPayloads.map((p) => ({
        recipientId: p.recipientId,
        email: p.email,
        name: p.name,
        shareUrl: p.shareUrl,
      })),
    });
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
