import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { meetingAttendees, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padMeetingNumber } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";
import { emitMeetingInvite } from "@/lib/meetings/notify";

// POST /api/meetings/:id/attendees — contractor adds a person to the
// attendee list after creation. Fires a meeting_invite notification to
// the added user (if internal). External/email-only attendees get the
// invite over email when the email-delivery job picks up the pending
// notification row.

const BodySchema = z.union([
  z.object({
    userId: z.string().uuid(),
    orgId: z.string().uuid().nullable().optional(),
    roleLabel: z.string().max(120).nullable().optional(),
    scope: z.enum(["internal", "sub", "external"]),
  }),
  z.object({
    email: z.string().email().max(255),
    displayName: z.string().max(160),
    orgId: z.string().uuid().nullable().optional(),
    roleLabel: z.string().max(120).nullable().optional(),
    scope: z.enum(["internal", "sub", "external"]),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const [head] = await dbAdmin
      .select({
        id: meetings.id,
        projectId: meetings.projectId,
        sequentialNumber: meetings.sequentialNumber,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        status: meetings.status,
      })
      .from(meetings)
      .where(eq(meetings.id, id))
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
        "Only contractors can invite attendees",
        "forbidden",
      );
    }
    if (head.status === "cancelled") {
      return NextResponse.json(
        { error: "invalid_state", message: "Meeting is cancelled" },
        { status: 409 },
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const row = {
        meetingId: id,
        orgId: body.orgId ?? null,
        roleLabel: body.roleLabel ?? null,
        scope: body.scope,
        attendedStatus: "invited" as const,
        isChair: 0,
        ...("userId" in body
          ? { userId: body.userId }
          : { email: body.email, displayName: body.displayName }),
      };
      const [inserted] = await tx
        .insert(meetingAttendees)
        .values(row)
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "attendee_added",
          resourceType: "meeting_attendee",
          resourceId: inserted.id,
          details: {
            metadata: {
              meetingId: id,
              userId: "userId" in body ? body.userId : null,
              email: "email" in body ? body.email : null,
              scope: body.scope,
            },
          },
        },
        tx,
      );

      if ("userId" in body) {
        await emitMeetingInvite(tx, {
          actorUserId: ctx.user.id,
          projectId: head.projectId,
          meetingId: id,
          meetingNumberLabel: padMeetingNumber(head.sequentialNumber),
          meetingTitle: head.title,
          scheduledAtLabel: head.scheduledAt.toUTCString(),
          inviteeUserIds: [body.userId],
        });
      }

      return inserted;
    });

    return NextResponse.json({ ok: true, id: result.id });
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
