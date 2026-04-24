import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { meetingActionItems, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitMeetingActionStatusChange } from "@/lib/meetings/notify";

// PATCH /api/meetings/:id/action-items/:itemId — update a meeting
// action item. Status change (open → in_progress → done) is the common
// case. Writable by:
//   - The contractor (any state, any field — can reassign, set due
//     date, rewrite description)
//   - The current assignee (status only) — a sub can move their own
//     action to in_progress or done from the sub portal
// Status transitions fire a notification to the chair of the source
// meeting so they see the progress back.
//
// DELETE same path — contractor-only.

const PatchSchema = z.object({
  status: z.enum(["open", "in_progress", "done"]).optional(),
  description: z.string().min(1).max(2000).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  assignedOrgId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

async function loadItem(meetingId: string, itemId: string) {
  const [row] = await db
    .select({
      id: meetingActionItems.id,
      meetingId: meetingActionItems.meetingId,
      assignedUserId: meetingActionItems.assignedUserId,
      assignedOrgId: meetingActionItems.assignedOrgId,
      description: meetingActionItems.description,
      status: meetingActionItems.status,
      projectId: meetings.projectId,
    })
    .from(meetingActionItems)
    .innerJoin(meetings, eq(meetings.id, meetingActionItems.meetingId))
    .where(
      and(
        eq(meetingActionItems.id, itemId),
        eq(meetingActionItems.meetingId, meetingId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const item = await loadItem(id, itemId);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      item.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isAssignedUser =
      item.assignedUserId !== null && item.assignedUserId === ctx.user.id;
    const isAssignedOrgSub =
      ctx.role === "subcontractor_user" &&
      item.assignedOrgId !== null &&
      item.assignedOrgId === ctx.organization.id;

    const statusOnlyPatch =
      input.status !== undefined &&
      input.description === undefined &&
      input.assignedUserId === undefined &&
      input.assignedOrgId === undefined &&
      input.dueDate === undefined;

    if (!isContractor) {
      if (!statusOnlyPatch) {
        throw new AuthorizationError(
          "Only contractors can edit fields beyond status",
          "forbidden",
        );
      }
      if (!isAssignedUser && !isAssignedOrgSub) {
        throw new AuthorizationError(
          "Only the assignee can move status",
          "forbidden",
        );
      }
    }

    const previousStatus = item.status;
    const nextStatus = input.status ?? previousStatus;

    await db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.description !== undefined)
        patch.description = input.description;
      if (input.assignedUserId !== undefined)
        patch.assignedUserId = input.assignedUserId;
      if (input.assignedOrgId !== undefined)
        patch.assignedOrgId = input.assignedOrgId;
      if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

      await tx
        .update(meetingActionItems)
        .set(patch)
        .where(eq(meetingActionItems.id, itemId));

      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "meeting_action_item",
          resourceId: itemId,
          details: {
            previousState: { status: previousStatus },
            nextState: patch as Record<string, unknown>,
          },
        },
        tx,
      );

      if (input.status !== undefined && input.status !== previousStatus) {
        await emitMeetingActionStatusChange(tx, {
          actorUserId: ctx.user.id,
          projectId: item.projectId,
          meetingId: item.meetingId,
          description: item.description,
          status: nextStatus,
          actorName: ctx.user.displayName ?? ctx.user.email,
        });
      }
    });

    return NextResponse.json({ ok: true, status: nextStatus });
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const item = await loadItem(id, itemId);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      item.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can delete action items",
        "forbidden",
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(meetingActionItems)
        .where(eq(meetingActionItems.id, itemId));
      await writeAuditEvent(
        ctx,
        {
          action: "deleted",
          resourceType: "meeting_action_item",
          resourceId: itemId,
          details: {
            previousState: {
              meetingId: item.meetingId,
              description: item.description,
              status: item.status,
            },
          },
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
