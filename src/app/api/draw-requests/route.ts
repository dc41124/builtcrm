import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  drawLineItems,
  drawRequests,
  scheduleOfValues,
  sovLineItems,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { computeLineFields, loadPreviousPeriodMap } from "./_totals";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  sovId: z.string().uuid(),
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      parsed.data.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create a Draw Request",
        "forbidden",
      );
    }

    const [sov] = await db
      .select()
      .from(scheduleOfValues)
      .where(eq(scheduleOfValues.id, parsed.data.sovId))
      .limit(1);
    if (!sov || sov.projectId !== ctx.project.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (sov.sovStatus !== "active" && sov.sovStatus !== "locked") {
      return NextResponse.json(
        { error: "invalid_sov_state", state: sov.sovStatus },
        { status: 409 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [nextRow] = await tx
        .select({
          next: sql<number>`coalesce(max(${drawRequests.drawNumber}), 0) + 1`,
        })
        .from(drawRequests)
        .where(eq(drawRequests.projectId, ctx.project.id));
      const drawNumber = Number(nextRow?.next ?? 1);

      const contractSumToDateCents =
        sov.totalOriginalContractCents + sov.totalChangeOrdersCents;

      const [draw] = await tx
        .insert(drawRequests)
        .values({
          projectId: ctx.project.id,
          sovId: sov.id,
          drawNumber,
          periodFrom: new Date(parsed.data.periodFrom),
          periodTo: new Date(parsed.data.periodTo),
          drawRequestStatus: "draft",
          originalContractSumCents: sov.totalOriginalContractCents,
          netChangeOrdersCents: sov.totalChangeOrdersCents,
          contractSumToDateCents,
          balanceToFinishCents: contractSumToDateCents,
          createdByUserId: ctx.user.id,
        })
        .returning();

      const activeLines = await tx
        .select()
        .from(sovLineItems)
        .where(
          and(eq(sovLineItems.sovId, sov.id), eq(sovLineItems.isActive, true)),
        )
        .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber));

      const prevMap = await loadPreviousPeriodMap(
        tx,
        ctx.project.id,
        drawNumber,
      );

      if (activeLines.length > 0) {
        const rows = activeLines.map((l) => {
          const retainagePct =
            l.retainagePercentOverride ?? sov.defaultRetainagePercent;
          const workCompletedPreviousCents = prevMap.get(l.id) ?? 0;
          const fields = computeLineFields({
            workCompletedPreviousCents,
            workCompletedThisPeriodCents: 0,
            materialsPresentlyStoredCents: 0,
            scheduledValueCents: l.scheduledValueCents,
            retainagePercentApplied: retainagePct,
          });
          return {
            drawRequestId: draw.id,
            sovLineItemId: l.id,
            workCompletedPreviousCents,
            workCompletedThisPeriodCents: 0,
            materialsPresentlyStoredCents: 0,
            retainagePercentApplied: retainagePct,
            ...fields,
          };
        });
        await tx.insert(drawLineItems).values(rows);
      }

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "draw_request",
          resourceId: draw.id,
          details: {
            nextState: {
              status: draw.drawRequestStatus,
              drawNumber: draw.drawNumber,
              sovId: sov.id,
              contractSumToDateCents,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Draw #${draw.drawNumber} created`,
          relatedObjectType: "draw_request",
          relatedObjectId: draw.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return draw;
    });

    return NextResponse.json({
      id: result.id,
      drawNumber: result.drawNumber,
      status: result.drawRequestStatus,
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
