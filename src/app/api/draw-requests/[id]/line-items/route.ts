import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  drawLineItems,
  drawRequests,
  scheduleOfValues,
  sovLineItems,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { computeLineFields } from "../../_totals";

const BodySchema = z.object({
  sovLineItemId: z.string().uuid(),
  workCompletedThisPeriodCents: z.number().int().nonnegative(),
  materialsPresentlyStoredCents: z.number().int().nonnegative(),
  retainagePercentOverride: z.number().int().min(0).max(100).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: drawId } = await params;
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
    const [draw] = await dbAdmin
      .select()
      .from(drawRequests)
      .where(eq(drawRequests.id, drawId))
      .limit(1);
    if (!draw) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      draw.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit draw line items",
        "forbidden",
      );
    }
    if (
      draw.drawRequestStatus !== "draft" &&
      draw.drawRequestStatus !== "revised"
    ) {
      return NextResponse.json(
        { error: "invalid_state", state: draw.drawRequestStatus },
        { status: 409 },
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [sov] = await tx
        .select()
        .from(scheduleOfValues)
        .where(eq(scheduleOfValues.id, draw.sovId))
        .limit(1);
      if (!sov) {
        throw new SovMissingError();
      }

      const [sovLine] = await tx
        .select()
        .from(sovLineItems)
        .where(
          and(
            eq(sovLineItems.id, parsed.data.sovLineItemId),
            eq(sovLineItems.sovId, sov.id),
            eq(sovLineItems.isActive, true),
          ),
        )
        .limit(1);
      if (!sovLine) {
        throw new SovLineNotFoundError();
      }

      const [existing] = await tx
        .select()
        .from(drawLineItems)
        .where(
          and(
            eq(drawLineItems.drawRequestId, drawId),
            eq(drawLineItems.sovLineItemId, sovLine.id),
          ),
        )
        .limit(1);

      const retainagePct =
        parsed.data.retainagePercentOverride ??
        sovLine.retainagePercentOverride ??
        sov.defaultRetainagePercent;

      const workCompletedPreviousCents =
        existing?.workCompletedPreviousCents ?? 0;

      const fields = computeLineFields({
        workCompletedPreviousCents,
        workCompletedThisPeriodCents: parsed.data.workCompletedThisPeriodCents,
        materialsPresentlyStoredCents:
          parsed.data.materialsPresentlyStoredCents,
        scheduledValueCents: sovLine.scheduledValueCents,
        retainagePercentApplied: retainagePct,
      });

      if (existing) {
        const [row] = await tx
          .update(drawLineItems)
          .set({
            workCompletedThisPeriodCents: parsed.data.workCompletedThisPeriodCents,
            materialsPresentlyStoredCents:
              parsed.data.materialsPresentlyStoredCents,
            retainagePercentApplied: retainagePct,
            ...fields,
          })
          .where(eq(drawLineItems.id, existing.id))
          .returning();

        await writeAuditEvent(
          ctx,
          {
            action: "updated",
            resourceType: "draw_line_item",
            resourceId: row.id,
            details: {
              nextState: {
                workCompletedThisPeriodCents: row.workCompletedThisPeriodCents,
                materialsPresentlyStoredCents: row.materialsPresentlyStoredCents,
                totalCompletedStoredToDateCents:
                  row.totalCompletedStoredToDateCents,
              },
            },
          },
          tx,
        );
        return row;
      }

      const [row] = await tx
        .insert(drawLineItems)
        .values({
          drawRequestId: drawId,
          sovLineItemId: sovLine.id,
          workCompletedPreviousCents,
          workCompletedThisPeriodCents: parsed.data.workCompletedThisPeriodCents,
          materialsPresentlyStoredCents: parsed.data.materialsPresentlyStoredCents,
          retainagePercentApplied: retainagePct,
          ...fields,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "draw_line_item",
          resourceId: row.id,
          details: {
            nextState: {
              sovLineItemId: sovLine.id,
              totalCompletedStoredToDateCents: row.totalCompletedStoredToDateCents,
            },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({
      id: result.id,
      totalCompletedStoredToDateCents: result.totalCompletedStoredToDateCents,
      percentCompleteBasisPoints: result.percentCompleteBasisPoints,
      balanceToFinishCents: result.balanceToFinishCents,
      retainageCents: result.retainageCents,
    });
  } catch (err) {
    if (err instanceof SovMissingError) {
      return NextResponse.json({ error: "sov_missing" }, { status: 404 });
    }
    if (err instanceof SovLineNotFoundError) {
      return NextResponse.json({ error: "sov_line_not_found" }, { status: 404 });
    }
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

class SovMissingError extends Error {}
class SovLineNotFoundError extends Error {}
