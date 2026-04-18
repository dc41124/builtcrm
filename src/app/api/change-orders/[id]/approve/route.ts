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
import { emitNotifications } from "@/lib/notifications/emit";

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
    if (
      ctx.role !== "commercial_client" &&
      ctx.role !== "residential_client"
    ) {
      throw new AuthorizationError(
        "Only the client can approve change orders",
        "forbidden",
      );
    }

    if (co.changeOrderStatus !== "pending_client_approval") {
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
          changeOrderStatus: "approved",
          approvedAt: new Date(),
          approvedByUserId: ctx.user.id,
        })
        .where(eq(changeOrders.id, co.id));

      await writeAuditEvent(
        ctx,
        {
          action: "approved",
          resourceType: "change_order",
          resourceId: co.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "approved" },
            metadata: { amountCents: co.amountCents },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_completed",
          summary: `CO-${String(co.changeOrderNumber).padStart(3, "0")} approved: ${co.title}`,
          relatedObjectType: "change_order",
          relatedObjectId: co.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    await emitNotifications({
      eventId: "co_approved",
      actorUserId: ctx.user.id,
      projectId: co.projectId,
      relatedObjectType: "change_order",
      relatedObjectId: co.id,
      vars: {
        number: co.changeOrderNumber,
        title: co.title,
        actorName: ctx.user.displayName ?? ctx.user.email,
      },
    });

    return NextResponse.json({ id: co.id, status: "approved" });
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
