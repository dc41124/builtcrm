import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { scheduleOfValues, sovLineItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { recomputeSovTotals } from "../../_totals";

const BodySchema = z.object({
  itemNumber: z.string().min(1).max(40),
  costCode: z.string().max(40).optional(),
  description: z.string().min(1).max(500),
  scheduledValueCents: z.number().int().nonnegative(),
  lineItemType: z.enum(["original", "change_order"]).optional(),
  changeOrderId: z.string().uuid().optional(),
  retainagePercentOverride: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sovId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Entry-point dbAdmin: tenant unknown until projectId resolved.
    const [sov] = await dbAdmin
      .select()
      .from(scheduleOfValues)
      .where(eq(scheduleOfValues.id, sovId))
      .limit(1);
    if (!sov) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      sov.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit Schedule of Values line items",
        "forbidden",
      );
    }

    if (sov.sovStatus !== "draft") {
      return NextResponse.json(
        { error: "invalid_state", state: sov.sovStatus },
        { status: 409 },
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .insert(sovLineItems)
        .values({
          sovId,
          itemNumber: parsed.data.itemNumber,
          costCode: parsed.data.costCode ?? null,
          description: parsed.data.description,
          scheduledValueCents: parsed.data.scheduledValueCents,
          lineItemType: parsed.data.lineItemType ?? "original",
          changeOrderId: parsed.data.changeOrderId ?? null,
          retainagePercentOverride:
            parsed.data.retainagePercentOverride ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
        })
        .returning();

      await recomputeSovTotals(tx, sovId);

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "sov_line_item",
          resourceId: row.id,
          details: {
            nextState: {
              sovId,
              itemNumber: row.itemNumber,
              description: row.description,
              scheduledValueCents: row.scheduledValueCents,
              lineItemType: row.lineItemType,
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      itemNumber: result.itemNumber,
      scheduledValueCents: result.scheduledValueCents,
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
