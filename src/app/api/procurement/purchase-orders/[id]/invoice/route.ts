import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { purchaseOrders } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { canTransition } from "@/domain/procurement/state-machine";

// POST /api/procurement/purchase-orders/[id]/invoice
//
// Transitions fully_received → invoiced. For V1 we're not capturing a
// vendor invoice number or amount — just flipping the state so AP knows
// the PO is ready to close. That metadata can ride on the audit event
// or a follow-up "linked invoice" document later.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

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
      session.session as unknown as { appUserId?: string | null },
      po.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can invoice POs",
        "forbidden",
      );
    }
    if (po.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!canTransition(po.status, "invoiced")) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot invoice a PO in status "${po.status}"`,
        },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({ status: "invoiced", updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
      await writeAuditEvent(
        ctx,
        {
          action: "invoiced",
          resourceType: "purchase_order",
          resourceId: id,
          details: {
            previousState: { status: po.status },
            nextState: { status: "invoiced" },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ id, status: "invoiced" });
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
