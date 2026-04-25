import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { changeOrders } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
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
      session,
      co.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can void change orders",
        "forbidden",
      );
    }

    if (
      co.changeOrderStatus !== "draft" &&
      co.changeOrderStatus !== "pending_review" &&
      co.changeOrderStatus !== "pending_client_approval"
    ) {
      return NextResponse.json(
        { error: "invalid_state", state: co.changeOrderStatus },
        { status: 409 },
      );
    }

    const previousState = co.changeOrderStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(changeOrders)
        .set({ changeOrderStatus: "voided" })
        .where(eq(changeOrders.id, co.id));

      await writeAuditEvent(
        ctx,
        {
          action: "voided",
          resourceType: "change_order",
          resourceId: co.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "voided" },
            metadata: { reason: parsed.data.reason ?? null },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_completed",
          summary: `CO-${String(co.changeOrderNumber).padStart(3, "0")} voided: ${co.title}`,
          body: parsed.data.reason ?? null,
          relatedObjectType: "change_order",
          relatedObjectId: co.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: co.id, status: "voided" });
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
