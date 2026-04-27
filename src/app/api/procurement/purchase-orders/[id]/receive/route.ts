import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { purchaseOrderLines, purchaseOrders } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  deriveReceivingStatus,
} from "@/domain/procurement/totals";

// POST /api/procurement/purchase-orders/[id]/receive
//
// Updates per-line received quantities. Auto-transitions the parent PO
// between `issued` / `revised` / `partially_received` / `fully_received`
// based on the aggregated receive state. Accepts a sparse map of
// { lineId: receivedQuantity } so partial deliveries can be logged one
// line at a time.

const BodySchema = z.object({
  received: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        receivedQuantity: z.number().min(0),
      }),
    )
    .min(1),
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

  const [po] = await dbAdmin
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
      throw new AuthorizationError(
        "Only contractors can record receiving",
        "forbidden",
      );
    }
    if (po.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // Can only receive on issued / revised / partially_received.
    if (
      po.status !== "issued" &&
      po.status !== "revised" &&
      po.status !== "partially_received"
    ) {
      return NextResponse.json(
        {
          error: "not_receivable",
          message: `Cannot record receiving when PO status is "${po.status}"`,
        },
        { status: 409 },
      );
    }

    const lineIds = parsed.data.received.map((r) => r.lineId);

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const lineRows = await tx
        .select({
          id: purchaseOrderLines.id,
          purchaseOrderId: purchaseOrderLines.purchaseOrderId,
          quantity: purchaseOrderLines.quantity,
        })
        .from(purchaseOrderLines)
        .where(inArray(purchaseOrderLines.id, lineIds));
      // All lines must belong to this PO.
      for (const row of lineRows) {
        if (row.purchaseOrderId !== id) {
          throw new LineMismatchError();
        }
      }
      // Received qty can't exceed line qty (stops over-receive nonsense).
      for (const patch of parsed.data.received) {
        const line = lineRows.find((l) => l.id === patch.lineId);
        if (!line) continue;
        if (patch.receivedQuantity > parseFloat(line.quantity)) {
          throw new OverReceivedError(patch.lineId);
        }
      }

      for (const patch of parsed.data.received) {
        await tx
          .update(purchaseOrderLines)
          .set({
            receivedQuantity: patch.receivedQuantity.toFixed(3),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(purchaseOrderLines.id, patch.lineId),
              eq(purchaseOrderLines.purchaseOrderId, id),
            ),
          );
      }

      // Recompute status from the full set of lines after the update.
      const allLines = await tx
        .select({
          id: purchaseOrderLines.id,
          quantity: purchaseOrderLines.quantity,
          receivedQuantity: purchaseOrderLines.receivedQuantity,
        })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.purchaseOrderId, id));
      const recvState = deriveReceivingStatus(allLines);

      let nextStatus = po.status;
      if (recvState === "full") nextStatus = "fully_received";
      else if (recvState === "partial") nextStatus = "partially_received";
      else if (po.status === "partially_received" && recvState === "none") {
        // Rollback: if everything gets zeroed out again, drop back to issued
        nextStatus = "issued";
      }

      if (nextStatus !== po.status) {
        await tx
          .update(purchaseOrders)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(purchaseOrders.id, id));
      }

      await writeAuditEvent(
        ctx,
        {
          action: "received",
          resourceType: "purchase_order",
          resourceId: id,
          details: {
            previousState: { status: po.status },
            nextState: { status: nextStatus },
            metadata: {
              lineCount: parsed.data.received.length,
              receivedMap: parsed.data.received,
            },
          },
        },
        tx,
      );

      return { id, status: nextStatus };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LineMismatchError) {
      return NextResponse.json({ error: "line_mismatch" }, { status: 400 });
    }
    if (err instanceof OverReceivedError) {
      return NextResponse.json(
        {
          error: "over_received",
          message: `Cannot receive more than line quantity on ${err.lineId}`,
        },
        { status: 400 },
      );
    }
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

class LineMismatchError extends Error {}
class OverReceivedError extends Error {
  constructor(public lineId: string) {
    super();
  }
}
