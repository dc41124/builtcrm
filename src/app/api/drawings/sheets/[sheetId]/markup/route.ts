// PUT /api/drawings/sheets/[sheetId]/markup
//
// Replaces the caller's markup doc for this sheet with the posted array.
// One row per (sheet_id, user_id) — the unique constraint means we upsert
// on the composite key. Clients should debounce their writes (800ms is
// the viewer default) so rapid pen strokes don't hammer the route.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { drawingMarkups } from "@/db/schema";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { resolveSheetAccess } from "@/lib/drawings/access";

// One-of the markup shapes our SVG overlay knows how to render. The
// viewer already encodes these types; we echo them in zod so a malformed
// client payload fails fast at the route instead of leaking into the
// jsonb column.
const MarkupShape = z.union([
  z.object({
    id: z.string().min(1).max(80),
    tool: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    label: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    tool: z.literal("circle"),
    x: z.number(),
    y: z.number(),
    r: z.number(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    tool: z.literal("pen"),
    path: z.string().min(1).max(16_000),
  }),
  z.object({
    id: z.string().min(1).max(80),
    tool: z.literal("text"),
    x: z.number(),
    y: z.number(),
    text: z.string().min(1).max(240),
  }),
]);

const BodySchema = z.object({
  markupData: z.array(MarkupShape).max(500),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const { sheetId } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { session } = await requireServerSession();
  try {
    const access = await resolveSheetAccess({
      session: session,
      sheetId,
    });
    assertCan(access.ctx.permissions, "drawing_markup", "write");

    // Upsert on (sheet_id, user_id). Drizzle's onConflictDoUpdate handles
    // the common case; we also bump updatedAt explicitly because the
    // $onUpdate hook only fires on UPDATE branches of an insert, not all
    // of them across pg drivers.
    const now = new Date();
    await db
      .insert(drawingMarkups)
      .values({
        sheetId,
        userId: access.ctx.user.id,
        markupData: parsed.data.markupData,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [drawingMarkups.sheetId, drawingMarkups.userId],
        set: {
          markupData: parsed.data.markupData,
          updatedAt: now,
        },
      });

    return NextResponse.json({ ok: true });
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

// DELETE — caller clears their own markup. Handy when a user wants to
// wipe their annotations without going through an empty-array PUT.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const { sheetId } = await params;
  const { session } = await requireServerSession();
  try {
    const access = await resolveSheetAccess({
      session: session,
      sheetId,
    });
    assertCan(access.ctx.permissions, "drawing_markup", "write");

    await db
      .delete(drawingMarkups)
      .where(
        and(
          eq(drawingMarkups.sheetId, sheetId),
          eq(drawingMarkups.userId, access.ctx.user.id),
        ),
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}
