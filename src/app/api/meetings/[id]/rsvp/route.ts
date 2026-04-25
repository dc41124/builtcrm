import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { meetingAttendees, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padMeetingNumber } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";
import { emitMeetingRsvpChange } from "@/lib/meetings/notify";

// POST /api/meetings/:id/rsvp — the current user updates their own RSVP
// for a meeting they're invited to. Fires a notification to the chair
// with the new status and (if declining) the reason text. A user's own
// RSVP is the only thing they can write about a meeting from the sub
// portal.

const BodySchema = z.object({
  status: z.enum(["accepted", "tentative", "declined"]),
  declineReason: z.string().max(500).nullable().optional(),
});

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
  const { status, declineReason } = parsed.data;

  try {
    const [head] = await db
      .select({
        id: meetings.id,
        projectId: meetings.projectId,
        sequentialNumber: meetings.sequentialNumber,
        title: meetings.title,
        chairUserId: meetings.chairUserId,
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

    // Accept the RSVP if the current user has an attendee row either
    // directly (userId match) or via any row at their org (fallback for
    // "invited the sub company, materialized as a specific person").
    const [attRow] = await db
      .select({
        id: meetingAttendees.id,
        userId: meetingAttendees.userId,
        orgId: meetingAttendees.orgId,
        attendedStatus: meetingAttendees.attendedStatus,
      })
      .from(meetingAttendees)
      .where(
        and(
          eq(meetingAttendees.meetingId, id),
          or(
            eq(meetingAttendees.userId, ctx.user.id),
            eq(meetingAttendees.orgId, ctx.organization.id),
          ),
        ),
      )
      .limit(1);
    if (!attRow) {
      throw new AuthorizationError(
        "You are not on the attendee list",
        "forbidden",
      );
    }

    if (head.status === "completed" || head.status === "cancelled") {
      return NextResponse.json(
        { error: "terminal_state", message: "Meeting is no longer open" },
        { status: 409 },
      );
    }

    const previousStatus = attRow.attendedStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(meetingAttendees)
        .set({
          attendedStatus: status,
          declineReason: status === "declined" ? declineReason ?? null : null,
          respondedAt: new Date(),
          // Auto-bind the row to this user if it wasn't already (org-level
          // invite case: first person to respond claims the seat).
          userId: attRow.userId ?? ctx.user.id,
        })
        .where(eq(meetingAttendees.id, attRow.id));

      await writeAuditEvent(
        ctx,
        {
          action: "rsvp_updated",
          resourceType: "meeting_attendee",
          resourceId: attRow.id,
          details: {
            previousState: { attendedStatus: previousStatus },
            nextState: {
              attendedStatus: status,
              declineReason: status === "declined" ? declineReason ?? null : null,
            },
          },
        },
        tx,
      );

      await emitMeetingRsvpChange(tx, {
        actorUserId: ctx.user.id,
        projectId: head.projectId,
        meetingId: id,
        meetingNumberLabel: padMeetingNumber(head.sequentialNumber),
        meetingTitle: head.title,
        chairUserId: head.chairUserId,
        actorName: ctx.user.displayName ?? ctx.user.email,
        rsvp: status,
        declineReason: status === "declined" ? declineReason ?? null : null,
      });
    });

    return NextResponse.json({ ok: true, status });
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
