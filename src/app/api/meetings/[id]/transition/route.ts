import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { meetings } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padMeetingNumber } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/meetings/:id/transition — flip the meeting's status.
// Single state-machine endpoint: scheduled → in_progress → completed,
// scheduled|in_progress → cancelled. Completion is terminal. Cancel
// accepts a reason string. Contractor-only. Idempotent on target.

const BodySchema = z.object({
  action: z.enum(["start", "complete", "cancel"]),
  reason: z.string().max(500).nullable().optional(),
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
  const { action, reason } = parsed.data;

  try {
    // Entry-point dbAdmin: tenant unknown until we resolve project
    // from the meeting row. Slice 3 pattern.
    const [head] = await dbAdmin
      .select({
        id: meetings.id,
        projectId: meetings.projectId,
        status: meetings.status,
        sequentialNumber: meetings.sequentialNumber,
        title: meetings.title,
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
        "Only contractors can transition meetings",
        "forbidden",
      );
    }

    // State machine: compute target + validate transition.
    let target: "scheduled" | "in_progress" | "completed" | "cancelled";
    if (action === "start") target = "in_progress";
    else if (action === "complete") target = "completed";
    else target = "cancelled";

    if (head.status === target) {
      return NextResponse.json({ ok: true, alreadyInTargetState: true });
    }
    const canStart = action === "start" && head.status === "scheduled";
    const canComplete = action === "complete" && head.status === "in_progress";
    const canCancel =
      action === "cancel" &&
      (head.status === "scheduled" || head.status === "in_progress");
    if (!canStart && !canComplete && !canCancel) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot ${action} a meeting in status ${head.status}`,
        },
        { status: 409 },
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      const patch: Record<string, unknown> = { status: target };
      if (target === "completed") patch.completedAt = new Date();
      if (target === "cancelled") patch.cancelledReason = reason ?? null;
      await tx.update(meetings).set(patch).where(eq(meetings.id, id));

      await writeAuditEvent(
        ctx,
        {
          action:
            target === "in_progress"
              ? "started"
              : target === "completed"
                ? "completed"
                : "cancelled",
          resourceType: "meeting",
          resourceId: id,
          details: {
            previousState: { status: head.status },
            nextState: { status: target, cancelledReason: reason ?? null },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary:
            target === "completed"
              ? `${padMeetingNumber(head.sequentialNumber)} completed`
              : target === "cancelled"
                ? `${padMeetingNumber(head.sequentialNumber)} cancelled`
                : `${padMeetingNumber(head.sequentialNumber)} started`,
          body:
            target === "cancelled" && reason
              ? `Reason: ${reason}`
              : head.title,
          relatedObjectType: "meeting",
          relatedObjectId: id,
          visibilityScope: "internal_only",
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, status: target });
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
