import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { dailyLogPhotos, dailyLogs, documents } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/daily-log-photos
//
// Link a previously-uploaded document to a daily log as a photo.
// The upload itself happens through the existing R2 presigned-URL +
// documents write path; this endpoint just creates the join row.
//
// Authorization: contractor only (photos are authored with the log).
// Subs don't add photos to GC logs; that stays a GC action.
//
// Hero flip: if isHero=true, we clear any existing hero for this log
// in the same transaction BEFORE inserting, because the partial unique
// index (daily_log_photos_one_hero_per_log) would otherwise reject.

const BodySchema = z.object({
  dailyLogId: z.string().uuid(),
  documentId: z.string().uuid(),
  caption: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  isHero: z.boolean().default(false),
});

export async function POST(req: Request) {
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
    const [logHead] = await dbAdmin
      .select({ id: dailyLogs.id, projectId: dailyLogs.projectId })
      .from(dailyLogs)
      .where(eq(dailyLogs.id, input.dailyLogId))
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
        "Only contractors can attach photos to daily logs",
        "forbidden",
      );
    }

    // Defense in depth: the document must exist on the same project as
    // the log. Prevents attaching a document owned by a different project
    // even if the caller guesses the uuid.
    const [doc] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select({ id: documents.id, projectId: documents.projectId })
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1),
    );
    if (!doc || doc.projectId !== logHead.projectId) {
      return NextResponse.json(
        { error: "invalid_document", message: "Document not on this project" },
        { status: 400 },
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      if (input.isHero) {
        await tx
          .update(dailyLogPhotos)
          .set({ isHero: false })
          .where(
            and(
              eq(dailyLogPhotos.dailyLogId, input.dailyLogId),
              eq(dailyLogPhotos.isHero, true),
            ),
          );
      }

      const [row] = await tx
        .insert(dailyLogPhotos)
        .values({
          dailyLogId: input.dailyLogId,
          documentId: input.documentId,
          caption: input.caption ?? null,
          sortOrder: input.sortOrder,
          isHero: input.isHero,
          uploadedByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "photo_attached",
          resourceType: "daily_log",
          resourceId: input.dailyLogId,
          details: {
            nextState: {
              photoId: row.id,
              isHero: row.isHero,
              caption: row.caption,
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      dailyLogId: result.dailyLogId,
      isHero: result.isHero,
    });
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
