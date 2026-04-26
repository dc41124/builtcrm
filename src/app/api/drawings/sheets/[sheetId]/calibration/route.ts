// PATCH /api/drawings/sheets/[sheetId]/calibration
//
// Sets the scale text + source on a sheet. Contractor staff only — sub
// edits would drift the shared scale everyone else's measurements key
// off. `source: 'manual'` is the normal path when the user has just
// recalibrated via two-point; `source: 'title_block'` is written by the
// extraction job when it reads the scale off the title block.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { drawingSheets } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { resolveSheetAccess } from "@/lib/drawings/access";

const BodySchema = z.object({
  scale: z.string().min(1).max(40),
  source: z.enum(["title_block", "manual"]).optional().default("manual"),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const { sheetId } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { session } = await requireServerSession();
  try {
    const access = await resolveSheetAccess({
      session: session,
      sheetId,
    });
    // Calibration is set-wide state. Subs don't own it — keep it to
    // contractor staff so trade scopes can't overwrite each other.
    assertCan(access.ctx.permissions, "drawing", "write");

    await withTenant(access.ctx.organization.id, (tx) =>
      tx
        .update(drawingSheets)
        .set({
          calibrationScale: parsed.data.scale,
          calibrationSource: parsed.data.source,
          calibratedByUserId: access.ctx.user.id,
          calibratedAt: new Date(),
        })
        .where(eq(drawingSheets.id, sheetId)),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}
