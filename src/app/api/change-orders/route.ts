import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { changeOrders, rfis } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  amountCents: z.number().int(),
  reason: z.string().max(2000).optional(),
  originatingRfiId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      parsed.data.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create change orders",
        "forbidden",
      );
    }

    if (parsed.data.originatingRfiId) {
      // Explicit projectId filter is the security check; dbAdmin head
      // lookup is safe (this runs after getEffectiveContext approves
      // the project, and the eq narrows to that project's RFIs).
      const [rfi] = await dbAdmin
        .select({ id: rfis.id })
        .from(rfis)
        .where(
          and(
            eq(rfis.id, parsed.data.originatingRfiId),
            eq(rfis.projectId, ctx.project.id),
          ),
        )
        .limit(1);
      if (!rfi) {
        return NextResponse.json({ error: "rfi_not_found" }, { status: 404 });
      }
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {

      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${changeOrders.changeOrderNumber}), 0) + 1`,
        })
        .from(changeOrders)
        .where(eq(changeOrders.projectId, ctx.project.id));

      const [row] = await tx
        .insert(changeOrders)
        .values({
          projectId: ctx.project.id,
          changeOrderNumber: nextNumber,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          amountCents: parsed.data.amountCents,
          reason: parsed.data.reason ?? null,
          originatingRfiId: parsed.data.originatingRfiId ?? null,
          requestedByUserId: ctx.user.id,
          changeOrderStatus: "draft",
          visibilityScope: "client_visible",
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "change_order",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.changeOrderStatus,
              changeOrderNumber: row.changeOrderNumber,
              title: row.title,
              amountCents: row.amountCents,
              originatingRfiId: row.originatingRfiId,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `CO-${String(row.changeOrderNumber).padStart(3, "0")}: ${row.title}`,
          body: parsed.data.description ?? null,
          relatedObjectType: "change_order",
          relatedObjectId: row.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      changeOrderNumber: result.changeOrderNumber,
      status: result.changeOrderStatus,
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
