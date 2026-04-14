import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { drawRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { recomputeDrawHeaderTotals } from "../_totals";

type Transition = "submit" | "start-review";

const RULES = {
  submit: {
    from: "draft" as const,
    to: "submitted" as const,
    label: "submitted",
  },
  "start-review": {
    from: "submitted" as const,
    to: "under_review" as const,
    label: "under review",
  },
};

export async function handleDrawTransition(
  _req: Request,
  id: string,
  kind: Transition,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const [draw] = await db
      .select()
      .from(drawRequests)
      .where(eq(drawRequests.id, id))
      .limit(1);
    if (!draw) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      draw.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can transition a draw request in this phase",
        "forbidden",
      );
    }

    const rule = RULES[kind];
    if (draw.drawRequestStatus !== rule.from) {
      return NextResponse.json(
        { error: "invalid_state", state: draw.drawRequestStatus },
        { status: 409 },
      );
    }

    const previousState = { status: draw.drawRequestStatus };

    await db.transaction(async (tx) => {
      if (kind === "submit") {
        await recomputeDrawHeaderTotals(tx, draw.id);
      }
      await tx
        .update(drawRequests)
        .set({
          drawRequestStatus: rule.to,
          ...(kind === "submit" ? { submittedAt: new Date() } : {}),
        })
        .where(eq(drawRequests.id, draw.id));

      await writeAuditEvent(
        ctx,
        {
          action: rule.label,
          resourceType: "draw_request",
          resourceId: draw.id,
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
          summary: `Draw #${draw.drawNumber} ${rule.label}`,
          relatedObjectType: "draw_request",
          relatedObjectId: draw.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: draw.id, status: rule.to });
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
