// PATCH /api/drawings/comments/[commentId] — resolve / unresolve / edit text
// POST  /api/drawings/comments/[commentId]/reply — already handled in a
//       subdirectory route; this file is resolve/edit/delete on the
//       root (or reply) comment itself.

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { drawingComments, drawingSets, drawingSheets } from "@/db/schema";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { resolveSheetAccess } from "@/lib/drawings/access";

const PatchSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  resolved: z.boolean().optional(),
});

async function loadComment(commentId: string) {
  const [row] = await db
    .select({
      comment: drawingComments,
      sheetId: drawingSheets.id,
      projectId: drawingSets.projectId,
    })
    .from(drawingComments)
    .innerJoin(drawingSheets, eq(drawingSheets.id, drawingComments.sheetId))
    .innerJoin(drawingSets, eq(drawingSets.id, drawingSheets.setId))
    .where(eq(drawingComments.id, commentId))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;
  if (body.text === undefined && body.resolved === undefined) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const loaded = await loadComment(commentId);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const access = await resolveSheetAccess({
      session: session.session as unknown as { appUserId?: string | null },
      sheetId: loaded.sheetId,
    });
    assertCan(access.ctx.permissions, "drawing_markup", "write");

    // Text edits: author-only. Resolution toggle: author OR contractor
    // (contractors arbitrate conflicts, so they get to close threads even
    // on comments authored by others).
    const isAuthor = access.ctx.user.id === loaded.comment.userId;
    const isContractor =
      access.ctx.role === "contractor_admin" ||
      access.ctx.role === "contractor_pm";

    if (body.text !== undefined && !isAuthor) {
      return NextResponse.json(
        { error: "forbidden", message: "only the author can edit the text" },
        { status: 403 },
      );
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.text !== undefined) patch.text = body.text;
    if (body.resolved !== undefined) {
      if (!isAuthor && !isContractor) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: "only the author or a contractor can resolve",
          },
          { status: 403 },
        );
      }
      patch.resolved = body.resolved;
      patch.resolvedAt = body.resolved ? new Date() : null;
      patch.resolvedByUserId = body.resolved ? access.ctx.user.id : null;
    }

    await db
      .update(drawingComments)
      .set(patch)
      .where(eq(drawingComments.id, commentId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}

// DELETE — author-only; contractors can also delete to clean up spam.
// Replies cascade automatically via the parent_comment_id FK.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const loaded = await loadComment(commentId);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const access = await resolveSheetAccess({
      session: session.session as unknown as { appUserId?: string | null },
      sheetId: loaded.sheetId,
    });
    assertCan(access.ctx.permissions, "drawing_markup", "write");
    const isAuthor = access.ctx.user.id === loaded.comment.userId;
    const isContractor =
      access.ctx.role === "contractor_admin" ||
      access.ctx.role === "contractor_pm";
    if (!isAuthor && !isContractor) {
      return NextResponse.json(
        { error: "forbidden", message: "only the author or a contractor can delete" },
        { status: 403 },
      );
    }
    await db.delete(drawingComments).where(eq(drawingComments.id, commentId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}

