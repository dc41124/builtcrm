import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { dailyLogPhotos, dailyLogs } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/daily-log-photos/[id]
//
// Update an attached photo's caption, sort order, or hero flag. The
// hero flip follows the same "clear any existing hero on this log in
// the same txn before setting the new one" rule as the initial attach.
// DELETE is handled by cascading from documents, not by a bespoke
// delete endpoint (no DELETE on daily_log_photos for now — delete the
// underlying document instead).

const BodySchema = z
  .object({
    caption: z.string().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isHero: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.caption !== undefined ||
      v.sortOrder !== undefined ||
      v.isHero !== undefined,
    { message: "At least one field must be provided" },
  );

export async function PATCH(
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
  const input = parsed.data;

  try {
    const [photo] = await db
      .select({
        id: dailyLogPhotos.id,
        dailyLogId: dailyLogPhotos.dailyLogId,
        isHero: dailyLogPhotos.isHero,
      })
      .from(dailyLogPhotos)
      .where(eq(dailyLogPhotos.id, id))
      .limit(1);
    if (!photo) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const [logHead] = await db
      .select({ id: dailyLogs.id, projectId: dailyLogs.projectId })
      .from(dailyLogs)
      .where(eq(dailyLogs.id, photo.dailyLogId))
      .limit(1);
    if (!logHead) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      logHead.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can update daily-log photos",
        "forbidden",
      );
    }

    await db.transaction(async (tx) => {
      if (input.isHero === true && !photo.isHero) {
        await tx
          .update(dailyLogPhotos)
          .set({ isHero: false })
          .where(
            and(
              eq(dailyLogPhotos.dailyLogId, photo.dailyLogId),
              eq(dailyLogPhotos.isHero, true),
            ),
          );
      }
      const patch: Partial<typeof dailyLogPhotos.$inferInsert> = {};
      if (input.caption !== undefined) patch.caption = input.caption;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
      if (input.isHero !== undefined) patch.isHero = input.isHero;

      await tx.update(dailyLogPhotos).set(patch).where(eq(dailyLogPhotos.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "photo_updated",
          resourceType: "daily_log",
          resourceId: logHead.id,
          details: {
            metadata: { photoId: id, ...patch },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
