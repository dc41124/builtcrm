import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { scheduleOfValues, sovLineItems } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

type Transition = "activate" | "lock";

const RULES = {
  activate: { from: "draft" as const, to: "active" as const, label: "activated" },
  lock: { from: "active" as const, to: "locked" as const, label: "locked" },
};

export async function handleTransition(_req: Request, id: string, kind: Transition) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const [sov] = await db
      .select()
      .from(scheduleOfValues)
      .where(eq(scheduleOfValues.id, id))
      .limit(1);
    if (!sov) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      sov.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can transition a Schedule of Values",
        "forbidden",
      );
    }

    const rule = RULES[kind];
    if (sov.sovStatus !== rule.from) {
      return NextResponse.json(
        { error: "invalid_state", state: sov.sovStatus },
        { status: 409 },
      );
    }

    if (kind === "activate") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sovLineItems)
        .where(
          and(eq(sovLineItems.sovId, sov.id), eq(sovLineItems.isActive, true)),
        );
      if (!count || count === 0) {
        return NextResponse.json(
          { error: "empty_sov", message: "Cannot activate an SOV with no line items" },
          { status: 409 },
        );
      }
    }

    const previousState = { status: sov.sovStatus };

    await db.transaction(async (tx) => {
      await tx
        .update(scheduleOfValues)
        .set({
          sovStatus: rule.to,
          ...(kind === "activate"
            ? { approvedByUserId: ctx.user.id, approvedAt: new Date() }
            : {}),
        })
        .where(eq(scheduleOfValues.id, sov.id));

      await writeAuditEvent(
        ctx,
        {
          action: rule.label,
          resourceType: "schedule_of_values",
          resourceId: sov.id,
          details: {
            previousState,
            nextState: { status: rule.to },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Schedule of Values ${rule.label} (v${sov.version})`,
          relatedObjectType: "schedule_of_values",
          relatedObjectId: sov.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: sov.id, status: rule.to });
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
