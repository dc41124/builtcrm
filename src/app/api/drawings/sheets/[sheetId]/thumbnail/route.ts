// POST /api/drawings/sheets/[sheetId]/thumbnail
//
// Per-sheet thumbnails are rendered in the browser (react-pdf + a canvas)
// on first visit to the sheet index, then persisted back here so future
// visitors load them straight from R2 instead of re-rendering. This trades
// a one-time render per sheet for zero repeated rendering cost.
//
// Two-step handshake:
//   GET  (?action=presign) — returns a presigned PUT URL + storage key.
//   POST — called by the client once the PUT completes; updates the
//          drawing_sheets row with the thumbnail_key.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { drawingSets, drawingSheets } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { buildThumbnailKey } from "@/lib/drawings/storage";
import { objectExists, presignUploadUrl } from "@/lib/storage";

async function loadSheetWithSet(sheetId: string) {
  const [row] = await db
    .select({
      sheet: drawingSheets,
      set: drawingSets,
    })
    .from(drawingSheets)
    .innerJoin(drawingSets, eq(drawingSets.id, drawingSheets.setId))
    .where(eq(drawingSheets.id, sheetId))
    .limit(1);
  return row ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const { sheetId } = await params;
  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "presign") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
  const { session } = await requireServerSession();
  const row = await loadSheetWithSet(sheetId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const ctx = await getEffectiveContext(
      session,
      row.set.projectId,
    );
    // Anyone who can read drawings can render thumbnails. We don't gate
    // this write on 'drawing:write' because rendering is a view-time
    // concern that shouldn't require contractor role.
    assertCan(ctx.permissions, "drawing", "read");

    const key = buildThumbnailKey({
      orgId: ctx.project.contractorOrganizationId,
      projectId: ctx.project.id,
      setId: row.set.id,
      pageIndex: row.sheet.pageIndex,
    });
    const uploadUrl = await presignUploadUrl({
      key,
      contentType: "image/png",
    });
    return NextResponse.json({ uploadUrl, storageKey: key });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}

const BodySchema = z.object({
  storageKey: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const { sheetId } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { session } = await requireServerSession();
  const row = await loadSheetWithSet(sheetId);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const ctx = await getEffectiveContext(
      session,
      row.set.projectId,
    );
    assertCan(ctx.permissions, "drawing", "read");

    const expected = buildThumbnailKey({
      orgId: ctx.project.contractorOrganizationId,
      projectId: ctx.project.id,
      setId: row.set.id,
      pageIndex: row.sheet.pageIndex,
    });
    if (parsed.data.storageKey !== expected) {
      return NextResponse.json(
        { error: "key_mismatch", message: "unexpected storage key" },
        { status: 400 },
      );
    }

    const exists = await objectExists(parsed.data.storageKey);
    if (!exists) {
      return NextResponse.json(
        { error: "upload_incomplete" },
        { status: 409 },
      );
    }

    await db
      .update(drawingSheets)
      .set({ thumbnailKey: parsed.data.storageKey })
      .where(eq(drawingSheets.id, sheetId));

    return NextResponse.json({ sheetId, thumbnailKey: parsed.data.storageKey });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}
