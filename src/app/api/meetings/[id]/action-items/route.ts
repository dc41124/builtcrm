import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { meetingActionItems, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padMeetingNumber } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";
import { emitMeetingActionAssigned } from "@/lib/meetings/notify";

// POST /api/meetings/:id/action-items — contractor adds a new action
// item to a meeting. Fires a notification to the assigned user.
// Creating action items is allowed in any non-cancelled state (both
// during the meeting and after, while still drafting minutes).

const BodySchema = z.object({
  description: z.string().min(1).max(2000),
  assignedUserId: z.string().uuid().nullable().optional(),
  assignedOrgId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  originAgendaItemId: z.string().uuid().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const input = parsed.data;

  try {
    const [head] = await db
      .select({
        id: meetings.id,
        projectId: meetings.projectId,
        sequentialNumber: meetings.sequentialNumber,
        status: meetings.status,
      })
      .from(meetings)
      .where(eq(meetings.id, id))
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
        "Only contractors can create action items",
        "forbidden",
      );
    }
    if (head.status === "cancelled") {
      return NextResponse.json(
        { error: "invalid_state", message: "Meeting is cancelled" },
        { status: 409 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(meetingActionItems)
        .values({
          meetingId: id,
          description: input.description,
          assignedUserId: input.assignedUserId ?? null,
          assignedOrgId: input.assignedOrgId ?? null,
          dueDate: input.dueDate ?? null,
          originAgendaItemId: input.originAgendaItemId ?? null,
          status: "open",
          createdByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "meeting_action_item",
          resourceId: row.id,
          details: {
            nextState: {
              meetingId: id,
              assignedUserId: row.assignedUserId,
              assignedOrgId: row.assignedOrgId,
              dueDate: row.dueDate,
            },
          },
        },
        tx,
      );

      if (input.assignedUserId) {
        await emitMeetingActionAssigned(tx, {
          actorUserId: ctx.user.id,
          projectId: head.projectId,
          meetingId: id,
          meetingNumberLabel: padMeetingNumber(head.sequentialNumber),
          assignedUserId: input.assignedUserId,
          description: input.description,
          dueDate: input.dueDate ?? null,
        });
      }

      return row;
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
