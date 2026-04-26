import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { meetingMinutes, meetings } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padMeetingNumber } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";
import { emitMeetingMinutesPublished } from "@/lib/meetings/notify";

// POST /api/meetings/:id/minutes/finalize — publish the minutes. Flips
// finalizedAt, fires a notification to every attendee (with a userId),
// and writes an audit + activity entry. One-way: finalized minutes
// cannot be un-finalized. The meeting itself must be in `completed`
// state to finalize minutes (matches the prototype — you don't publish
// minutes on a cancelled or in-progress meeting).

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const [head] = await dbAdmin
      .select({
        id: meetings.id,
        projectId: meetings.projectId,
        sequentialNumber: meetings.sequentialNumber,
        title: meetings.title,
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
        "Only contractors can finalize minutes",
        "forbidden",
      );
    }
    if (head.status !== "completed") {
      return NextResponse.json(
        { error: "invalid_state", message: "Complete the meeting first" },
        { status: 409 },
      );
    }

    const [existing] = await db
      .select({
        id: meetingMinutes.id,
        content: meetingMinutes.content,
        finalizedAt: meetingMinutes.finalizedAt,
      })
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json(
        { error: "no_minutes", message: "Draft minutes first" },
        { status: 409 },
      );
    }
    if (existing.finalizedAt) {
      return NextResponse.json({ ok: true, alreadyFinalized: true });
    }

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(meetingMinutes)
        .set({
          finalizedAt: new Date(),
          finalizedByUserId: ctx.user.id,
        })
        .where(eq(meetingMinutes.id, existing.id));

      await writeAuditEvent(
        ctx,
        {
          action: "finalized",
          resourceType: "meeting_minutes",
          resourceId: id,
          details: {
            nextState: { contentLength: existing.content.length },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${padMeetingNumber(head.sequentialNumber)} minutes published`,
          body: head.title,
          relatedObjectType: "meeting",
          relatedObjectId: id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      await emitMeetingMinutesPublished(tx, {
        actorUserId: ctx.user.id,
        projectId: head.projectId,
        meetingId: id,
        meetingNumberLabel: padMeetingNumber(head.sequentialNumber),
        meetingTitle: head.title,
        actorName: ctx.user.displayName ?? ctx.user.email,
      });
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
