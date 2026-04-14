import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { changeOrders } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const [co] = await db
      .select()
      .from(changeOrders)
      .where(eq(changeOrders.id, id))
      .limit(1);
    if (!co) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      co.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can submit change orders",
        "forbidden",
      );
    }

    if (co.changeOrderStatus !== "draft") {
      return NextResponse.json(
        { error: "invalid_state", state: co.changeOrderStatus },
        { status: 409 },
      );
    }

    const previousState = co.changeOrderStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(changeOrders)
        .set({
          changeOrderStatus: "pending_client_approval",
          submittedAt: new Date(),
        })
        .where(eq(changeOrders.id, co.id));

      await writeAuditEvent(
        ctx,
        {
          action: "submitted",
          resourceType: "change_order",
          resourceId: co.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "pending_client_approval" },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `CO-${String(co.changeOrderNumber).padStart(3, "0")} submitted for approval: ${co.title}`,
          relatedObjectType: "change_order",
          relatedObjectId: co.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: co.id, status: "pending_client_approval" });
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
