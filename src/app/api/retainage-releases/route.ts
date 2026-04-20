import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  drawLineItems,
  drawRequests,
  milestones,
  retainageReleases,
  scheduleOfValues,
  sovLineItems,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z
  .object({
    projectId: z.string().uuid(),
    releaseAmountCents: z.number().int().positive(),
    sovLineItemId: z.string().uuid().optional(),
    // Exactly one of these two release-date hooks may be set. Both null
    // is legal (release date unknown; row is invisible to the "<30 days"
    // Pending Financials card until the GC later fills it in).
    scheduledReleaseAt: z.string().datetime().optional(),
    releaseTriggerMilestoneId: z.string().uuid().optional(),
  })
  .refine(
    (v) => !(v.scheduledReleaseAt && v.releaseTriggerMilestoneId),
    {
      message:
        "Pick either a scheduled release date or a trigger milestone, not both.",
      path: ["releaseTriggerMilestoneId"],
    },
  );

const RELEASE_COUNTED_DRAW_STATUSES = [
  "approved",
  "approved_with_note",
  "paid",
  "closed",
] as const;

const ACTIVE_RELEASE_STATUSES = ["release_requested", "released"] as const;

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
        "Only contractors can create retainage release requests",
        "forbidden",
      );
    }

    // Compute retainage held so far for the target scope. For an
    // SOV-line-scoped release, sum retainage cents from draw_line_items
    // on that SOV line across certified-for-payment draws. For a
    // project-wide release (sovLineItemId null), sum the project's draw
    // retainageOnCompletedCents across the same draw states.
    let heldCents = 0;
    if (parsed.data.sovLineItemId) {
      const [sovLine] = await db
        .select({ id: sovLineItems.id, sovId: sovLineItems.sovId })
        .from(sovLineItems)
        .innerJoin(scheduleOfValues, eq(scheduleOfValues.id, sovLineItems.sovId))
        .where(
          and(
            eq(sovLineItems.id, parsed.data.sovLineItemId),
            eq(scheduleOfValues.projectId, ctx.project.id),
          ),
        )
        .limit(1);
      if (!sovLine) {
        return NextResponse.json(
          { error: "sov_line_not_found" },
          { status: 404 },
        );
      }

      const [row] = await db
        .select({
          sum: sql<number>`coalesce(sum(${drawLineItems.retainageCents}), 0)`,
        })
        .from(drawLineItems)
        .innerJoin(drawRequests, eq(drawRequests.id, drawLineItems.drawRequestId))
        .where(
          and(
            eq(drawLineItems.sovLineItemId, sovLine.id),
            eq(drawRequests.projectId, ctx.project.id),
            inArray(drawRequests.drawRequestStatus, [
              ...RELEASE_COUNTED_DRAW_STATUSES,
            ]),
          ),
        );
      heldCents = Number(row?.sum ?? 0);
    } else {
      const [row] = await db
        .select({
          sum: sql<number>`coalesce(sum(${drawRequests.retainageOnCompletedCents}), 0)`,
        })
        .from(drawRequests)
        .where(
          and(
            eq(drawRequests.projectId, ctx.project.id),
            inArray(drawRequests.drawRequestStatus, [
              ...RELEASE_COUNTED_DRAW_STATUSES,
            ]),
          ),
        );
      heldCents = Number(row?.sum ?? 0);
    }

    // Subtract any already-active releases (requested or released) for
    // the same scope so a contractor can't double-claim.
    const scopeFilter = parsed.data.sovLineItemId
      ? eq(retainageReleases.sovLineItemId, parsed.data.sovLineItemId)
      : isNull(retainageReleases.sovLineItemId);
    const [existingRow] = await db
      .select({
        sum: sql<number>`coalesce(sum(${retainageReleases.releaseAmountCents}), 0)`,
      })
      .from(retainageReleases)
      .where(
        and(
          eq(retainageReleases.projectId, ctx.project.id),
          inArray(retainageReleases.releaseStatus, [...ACTIVE_RELEASE_STATUSES]),
          scopeFilter,
        ),
      );
    const alreadyClaimed = Number(existingRow?.sum ?? 0);
    const availableCents = heldCents - alreadyClaimed;

    if (parsed.data.releaseAmountCents > availableCents) {
      return NextResponse.json(
        {
          error: "exceeds_held_retainage",
          heldCents,
          alreadyClaimed,
          availableCents,
        },
        { status: 409 },
      );
    }

    // Trigger milestone, if passed, must belong to the same project.
    if (parsed.data.releaseTriggerMilestoneId) {
      const [ms] = await db
        .select({ id: milestones.id, projectId: milestones.projectId })
        .from(milestones)
        .where(eq(milestones.id, parsed.data.releaseTriggerMilestoneId))
        .limit(1);
      if (!ms || ms.projectId !== ctx.project.id) {
        return NextResponse.json(
          { error: "invalid_trigger_milestone" },
          { status: 400 },
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(retainageReleases)
        .values({
          projectId: ctx.project.id,
          sovLineItemId: parsed.data.sovLineItemId ?? null,
          releaseStatus: "held",
          releaseAmountCents: parsed.data.releaseAmountCents,
          totalRetainageHeldCents: heldCents,
          requestedByUserId: ctx.user.id,
          scheduledReleaseAt: parsed.data.scheduledReleaseAt
            ? new Date(parsed.data.scheduledReleaseAt)
            : null,
          releaseTriggerMilestoneId:
            parsed.data.releaseTriggerMilestoneId ?? null,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "retainage_release",
          resourceId: row.id,
          details: {
            nextState: {
              releaseAmountCents: row.releaseAmountCents,
              sovLineItemId: row.sovLineItemId,
              status: row.releaseStatus,
            },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({
      id: result.id,
      releaseStatus: result.releaseStatus,
      releaseAmountCents: result.releaseAmountCents,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
