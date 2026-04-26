import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
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
  const { session } = await requireServerSession();
  try {
    // Entry-point dbAdmin: tenant unknown until we resolve project
    // from the change order row. Slice 3 pattern.
    const [co] = await dbAdmin
      .select()
      .from(changeOrders)
      .where(eq(changeOrders.id, id))
      .limit(1);
    if (!co) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
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

    await withTenant(ctx.organization.id, async (tx) => {
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

    // Fire notifications after the transaction commits. `emitNotifications`
    // is best-effort — never throws, so a failure here won't undo the
    // submission the user just made. We fan out for three events: the
    // contractor-side confirmation and both client-side flavors; each
    // event's recipient resolver filters down to the right audience.
    const actorName = ctx.user.displayName ?? ctx.user.email;
    const coVars = {
      number: co.changeOrderNumber,
      title: co.title,
      actorName,
    };
    const emitBase = {
      actorUserId: ctx.user.id,
      projectId: co.projectId,
      relatedObjectType: "change_order",
      relatedObjectId: co.id,
      vars: coVars,
    };
    await Promise.all([
      emitNotifications({ ...emitBase, eventId: "co_submitted" }),
      emitNotifications({ ...emitBase, eventId: "co_needs_approval" }),
      emitNotifications({ ...emitBase, eventId: "scope_change" }),
    ]);

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
