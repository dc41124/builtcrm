// POST /api/drawings/comments/[commentId]/reply
//
// Creates a reply to an existing root comment. Replies live in the same
// drawing_comments table with parent_comment_id set and pin_number NULL —
// they piggyback on the root's numbered pin. The reply inherits the
// root's x/y coords for convenience (the viewer renders replies under
// the root pin in the side panel; the coords aren't used positionally
// for replies).

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { drawingComments, drawingSets, drawingSheets } from "@/db/schema";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { resolveSheetAccess } from "@/lib/drawings/access";

const BodySchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [parent] = await db
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
  if (!parent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Replies anchor to the root comment — reject replies-to-replies so the
  // thread stays one level deep. Matches the prototype's side-panel UI.
  if (parent.comment.parentCommentId !== null) {
    return NextResponse.json(
      { error: "invalid_parent", message: "can only reply to a root comment" },
      { status: 400 },
    );
  }

  try {
    const access = await resolveSheetAccess({
      session: session.session as unknown as { appUserId?: string | null },
      sheetId: parent.sheetId,
    });
    assertCan(access.ctx.permissions, "drawing_markup", "write");

    const [inserted] = await db
      .insert(drawingComments)
      .values({
        sheetId: parent.sheetId,
        parentCommentId: commentId,
        userId: access.ctx.user.id,
        pinNumber: null,
        x: parent.comment.x,
        y: parent.comment.y,
        text: parsed.data.text,
      })
      .returning({ id: drawingComments.id });

    return NextResponse.json({ id: inserted.id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}
