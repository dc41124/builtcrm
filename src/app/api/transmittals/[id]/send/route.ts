import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  organizations,
  projects,
  transmittalDocuments,
  transmittalRecipients,
  transmittals,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
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
  const { session } = await requireServerSession();
  try {
    // Pre-tenant head lookup: tenant unknown until project resolves.
    const [head] = await dbAdmin
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
      session,
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

    const senderDisplayName = ctx.user.displayName ?? ctx.user.email;

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Pre-flight: need at least one recipient and one document.
      const recipientRows = await tx
        .select({
          id: transmittalRecipients.id,
          email: transmittalRecipients.email,
          name: transmittalRecipients.name,
        })
        .from(transmittalRecipients)
        .where(eq(transmittalRecipients.transmittalId, id));
      const [docCountRow] = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(transmittalDocuments)
        .where(eq(transmittalDocuments.transmittalId, id));
      const docCount = docCountRow?.c ?? 0;
      if (recipientRows.length === 0) {
        throw new SendPreconditionError("no_recipients");
      }
      if (docCount === 0) {
        throw new SendPreconditionError("no_documents");
      }

      // Generate tokens up front — we need them in the response, and
      // crypto doesn't depend on DB state.
      const tokensByRecipientId = new Map<
        string,
        { plaintext: string; digest: string }
      >();
      for (const r of recipientRows) {
        tokensByRecipientId.set(r.id, generateAccessToken());
      }

      const [contractorOrg] = await tx
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.project.contractorOrganizationId))
        .limit(1);


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
    if (err instanceof SendPreconditionError) {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }
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

// Sentinel for inside-withTenant preconditions — keeps the original
// 409 response shape without forcing a return-from-transaction dance.
class SendPreconditionError extends Error {
  constructor(public readonly code: "no_recipients" | "no_documents") {
    super(code);
  }
}
