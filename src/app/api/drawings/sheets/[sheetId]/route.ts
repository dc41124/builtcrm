// PATCH /api/drawings/sheets/[sheetId]
//
// Contractor-only. Exposes sheet_number / sheet_title / discipline edits
// so the auto-extraction misses (sheet with auto_detected=false, etc.)
// can be corrected without re-uploading the PDF. Any manual edit flips
// auto_detected to false so downstream consumers know this row is hand-
// curated. Discipline is a single char (A/S/E/M/P/…) or null to clear.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { drawingSets, drawingSheets } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const DISCIPLINE_RE = /^[A-Z]$/;

const BodySchema = z.object({
  sheetNumber: z.string().min(1).max(40).optional(),
  sheetTitle: z.string().min(1).max(255).optional(),
  discipline: z
    .string()
    .regex(DISCIPLINE_RE, "discipline must be a single uppercase letter")
    .nullable()
    .optional(),
});

export async function PATCH(
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
  const body = parsed.data;
  if (
    body.sheetNumber === undefined &&
    body.sheetTitle === undefined &&
    body.discipline === undefined
  ) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }
  const { session } = await requireServerSession();
  // Pre-tenant head lookup: tenant unknown until project resolves.
  const [row] = await dbAdmin
    .select({
      projectId: drawingSets.projectId,
    })
    .from(drawingSheets)
    .innerJoin(drawingSets, eq(drawingSets.id, drawingSheets.setId))
    .where(eq(drawingSheets.id, sheetId))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const ctx = await getEffectiveContext(
      session,
      row.projectId,
    );
    assertCan(ctx.permissions, "drawing", "write");

    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
      autoDetected: false,
    };
    if (body.sheetNumber !== undefined) patch.sheetNumber = body.sheetNumber;
    if (body.sheetTitle !== undefined) patch.sheetTitle = body.sheetTitle;
    if (body.discipline !== undefined) patch.discipline = body.discipline;

    await withTenant(ctx.organization.id, (tx) =>
      tx
        .update(drawingSheets)
        .set(patch)
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
