import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { meetingMinutes, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PUT /api/meetings/:id/minutes — upsert the draft minutes for a
// meeting. Creates the meeting_minutes row on first call. Contractor-
// only. Cannot edit once finalized — finalize is a one-way trip via
// /api/meetings/:id/minutes/finalize.

const BodySchema = z.object({
  content: z.string().max(64_000),
});

export async function PUT(
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
  const { content } = parsed.data;

  try {
    const [head] = await db
      .select({ id: meetings.id, projectId: meetings.projectId })
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
        "Only contractors can edit minutes",
        "forbidden",
      );
    }

    const [existing] = await db
      .select({
        id: meetingMinutes.id,
        finalizedAt: meetingMinutes.finalizedAt,
      })
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, id))
      .limit(1);
    if (existing?.finalizedAt) {
      return NextResponse.json(
        { error: "already_finalized" },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(meetingMinutes)
          .set({ content, draftedByUserId: ctx.user.id })
          .where(eq(meetingMinutes.id, existing.id));
      } else {
        await tx.insert(meetingMinutes).values({
          meetingId: id,
          content,
          draftedByUserId: ctx.user.id,
        });
      }
      await writeAuditEvent(
        ctx,
        {
          action: "draft_updated",
          resourceType: "meeting_minutes",
          resourceId: id,
          details: { metadata: { contentLength: content.length } },
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
