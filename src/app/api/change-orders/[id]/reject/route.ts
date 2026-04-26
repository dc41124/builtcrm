import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { changeOrders } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

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
    if (
      ctx.role !== "commercial_client" &&
      ctx.role !== "residential_client"
    ) {
      throw new AuthorizationError(
        "Only the client can reject change orders",
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

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(changeOrders)
        .set({
          changeOrderStatus: "rejected",
          rejectedAt: new Date(),
          rejectionReason: parsed.data.reason,
        })
        .where(eq(changeOrders.id, co.id));

      await writeAuditEvent(
        ctx,
        {
          action: "rejected",
          resourceType: "change_order",
          resourceId: co.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "rejected" },
            metadata: { reason: parsed.data.reason },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_completed",
          summary: `CO-${String(co.changeOrderNumber).padStart(3, "0")} rejected: ${co.title}`,
          body: parsed.data.reason,
          relatedObjectType: "change_order",
          relatedObjectId: co.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: co.id, status: "rejected" });
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
