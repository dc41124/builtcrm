import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { scheduleOfValues, sovLineItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { recomputeSovTotals } from "../../../_totals";

const PatchSchema = z.object({
  itemNumber: z.string().min(1).max(40).optional(),
  costCode: z.string().max(40).nullable().optional(),
  description: z.string().min(1).max(500).optional(),
  scheduledValueCents: z.number().int().nonnegative().optional(),
  retainagePercentOverride: z.number().int().min(0).max(100).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

async function loadContext(sovId: string, lineId: string, sessionLike: unknown) {
  // Entry-point dbAdmin: tenant unknown until projectId resolved.
  const [joined] = await dbAdmin
    .select({
      line: sovLineItems,
      sov: scheduleOfValues,
    })
    .from(sovLineItems)
    .innerJoin(scheduleOfValues, eq(scheduleOfValues.id, sovLineItems.sovId))
    .where(and(eq(sovLineItems.id, lineId), eq(sovLineItems.sovId, sovId)))
    .limit(1);
  if (!joined) return null;

  const ctx = await getEffectiveContext(
    sessionLike as { appUserId?: string | null },
    joined.sov.projectId,
  );
  return { line: joined.line, sov: joined.sov, ctx };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id: sovId, lineId } = await params;
  const { session } = await requireServerSession();

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const loaded = await loadContext(sovId, lineId, session);
    if (!loaded) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const { line, sov, ctx } = loaded;

    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit SOV line items",
        "forbidden",
      );
    }
    if (sov.sovStatus !== "draft") {
      return NextResponse.json(
        { error: "invalid_state", state: sov.sovStatus },
        { status: 409 },
      );
    }

    const previousState = {
      itemNumber: line.itemNumber,
      description: line.description,
      scheduledValueCents: line.scheduledValueCents,
    };

    const updated = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .update(sovLineItems)
        .set({
          itemNumber: parsed.data.itemNumber ?? line.itemNumber,
          costCode:
            parsed.data.costCode === undefined
              ? line.costCode
              : parsed.data.costCode,
          description: parsed.data.description ?? line.description,
          scheduledValueCents:
            parsed.data.scheduledValueCents ?? line.scheduledValueCents,
          retainagePercentOverride:
            parsed.data.retainagePercentOverride === undefined
              ? line.retainagePercentOverride
              : parsed.data.retainagePercentOverride,
          sortOrder: parsed.data.sortOrder ?? line.sortOrder,
        })
        .where(eq(sovLineItems.id, lineId))
        .returning();

      await recomputeSovTotals(tx, sovId);

      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "sov_line_item",
          resourceId: lineId,
          details: {
            previousState,
            nextState: {
              itemNumber: row.itemNumber,
              description: row.description,
              scheduledValueCents: row.scheduledValueCents,
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: updated.id,
      itemNumber: updated.itemNumber,
      scheduledValueCents: updated.scheduledValueCents,
    });
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
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id: sovId, lineId } = await params;
  const { session } = await requireServerSession();

  try {
    const loaded = await loadContext(sovId, lineId, session);
    if (!loaded) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const { line, sov, ctx } = loaded;

    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can deactivate SOV line items",
        "forbidden",
      );
    }
    if (sov.sovStatus !== "draft") {
      return NextResponse.json(
        { error: "invalid_state", state: sov.sovStatus },
        { status: 409 },
      );
    }
    if (!line.isActive) {
      return NextResponse.json({ id: lineId, isActive: false });
    }

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(sovLineItems)
        .set({ isActive: false })
        .where(eq(sovLineItems.id, lineId));

      await recomputeSovTotals(tx, sovId);

      await writeAuditEvent(
        ctx,
        {
          action: "deactivated",
          resourceType: "sov_line_item",
          resourceId: lineId,
          details: {
            previousState: { isActive: true },
            nextState: { isActive: false },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ id: lineId, isActive: false });
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
