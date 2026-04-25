import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";

import { db } from "@/db/client";
import { purchaseOrders } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { canTransition } from "@/domain/procurement/state-machine";

// POST /api/procurement/purchase-orders/[id]/close
//
// Terminal state. Invoiced → closed. After close, the PO is archived
// for reporting and no further transitions are possible (blocked by
// state machine).

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!po) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      po.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("Only contractors can close POs", "forbidden");
    }
    if (po.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!canTransition(po.status, "closed")) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot close a PO in status "${po.status}"`,
        },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
      await writeAuditEvent(
        ctx,
        {
          action: "closed",
          resourceType: "purchase_order",
          resourceId: id,
          details: {
            previousState: { status: po.status },
            nextState: { status: "closed" },
          },
        },
        tx,
      );
    });
    return NextResponse.json({ id, status: "closed" });
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
