// PUT /api/drawings/sheets/[sheetId]/measurement
//
// Same pattern as markup — one jsonb doc per (sheet_id, user_id). Kept
// separate from markups because measurements are calibration-dependent
// (the label string reflects the sheet's current scale) and live on a
// distinct overlay layer in the viewer.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { drawingMeasurements } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { resolveSheetAccess } from "@/lib/drawings/access";

const MeasurementShape = z.union([
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal("linear"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    label: z.string().min(1).max(80),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal("area"),
    points: z.array(z.tuple([z.number(), z.number()])).min(3).max(40),
    label: z.string().min(1).max(80),
  }),
]);

const BodySchema = z.object({
  measurementData: z.array(MeasurementShape).max(200),
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

    const now = new Date();
    await withTenant(access.ctx.organization.id, (tx) =>
      tx
        .insert(drawingMeasurements)
        .values({
          sheetId,
          userId: access.ctx.user.id,
          measurementData: parsed.data.measurementData,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            drawingMeasurements.sheetId,
            drawingMeasurements.userId,
          ],
          set: {
            measurementData: parsed.data.measurementData,
            updatedAt: now,
          },
        }),
    );

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

    await withTenant(access.ctx.organization.id, (tx) =>
      tx
        .delete(drawingMeasurements)
        .where(
          and(
            eq(drawingMeasurements.sheetId, sheetId),
            eq(drawingMeasurements.userId, access.ctx.user.id),
          ),
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
