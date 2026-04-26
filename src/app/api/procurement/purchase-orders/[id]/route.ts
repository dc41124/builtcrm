import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import {
  costCodes,
  purchaseOrderLines,
  purchaseOrders,
  vendors,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { areLinesImmutable } from "@/domain/procurement/state-machine";

// PATCH /api/procurement/purchase-orders/[id]
//
// Only valid while the PO is in `draft`. Once issued, lines become
// immutable (per the state-machine enforcement rule) and changes go
// through the /revise endpoint. We also guard cost code + vendor
// membership against the caller's org.

const LineSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1).max(2000),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(32),
  unitCostCents: z.number().int().nonnegative(),
});

const BodySchema = z.object({
  vendorId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  expectedDeliveryAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  lines: z.array(LineSchema).min(1).max(100).optional(),
});

export async function PATCH(
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

  // Pre-context lookup — caller passes only the PO id, so we read via
  // admin pool to derive projectId for getEffectiveContext.
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
        "Only contractors can edit purchase orders",
        "forbidden",
      );
    }
    if (po.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Enforcement rule: lines immutable post-draft. Header fields
    // (expectedDeliveryAt, notes, taxRatePercent) also lock here to
    // prevent silent drift of what the vendor has already seen on the
    // issued PDF. Real post-issue edits go through /revise.
    if (areLinesImmutable(po.status)) {
      return NextResponse.json(
        {
          error: "po_not_editable",
          message:
            "This PO has been issued — use the 'Revise PO' action to change it.",
        },
        { status: 409 },
      );
    }

    const p = parsed.data;
    if (p.vendorId) {
      const [vendor] = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({
            id: vendors.id,
            organizationId: vendors.organizationId,
          })
          .from(vendors)
          .where(eq(vendors.id, p.vendorId!))
          .limit(1),
      );
      if (!vendor || vendor.organizationId !== ctx.organization.id) {
        return NextResponse.json({ error: "invalid_vendor" }, { status: 400 });
      }
    }
    if (p.costCodeId) {
      const [code] = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({
            id: costCodes.id,
            organizationId: costCodes.organizationId,
          })
          .from(costCodes)
          .where(eq(costCodes.id, p.costCodeId!))
          .limit(1),
      );
      if (!code || code.organizationId !== ctx.organization.id) {
        return NextResponse.json({ error: "invalid_cost_code" }, { status: 400 });
      }
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({
          ...(p.vendorId !== undefined && { vendorId: p.vendorId }),
          ...(p.costCodeId !== undefined && { costCodeId: p.costCodeId }),
          ...(p.taxRatePercent !== undefined && {
            taxRatePercent: p.taxRatePercent.toFixed(2),
          }),
          ...(p.expectedDeliveryAt !== undefined && {
            expectedDeliveryAt: p.expectedDeliveryAt
              ? new Date(p.expectedDeliveryAt)
              : null,
          }),
          ...(p.notes !== undefined && { notes: p.notes }),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id));

      if (p.lines) {
        // Replace-all strategy for lines during draft. Simple and
        // matches the wizard's add/remove UX. Once the PO is issued
        // we're no longer allowed to touch lines anyway.
        await tx
          .delete(purchaseOrderLines)
          .where(eq(purchaseOrderLines.purchaseOrderId, id));
        for (let i = 0; i < p.lines.length; i++) {
          const l = p.lines[i];
          await tx.insert(purchaseOrderLines).values({
            purchaseOrderId: id,
            sortOrder: i,
            description: l.description,
            quantity: l.quantity.toFixed(3),
            unit: l.unit,
            unitCostCents: l.unitCostCents,
          });
        }
      }

      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "purchase_order",
          resourceId: id,
          details: {
            previousState: {
              vendorId: po.vendorId,
              costCodeId: po.costCodeId,
              taxRatePercent: po.taxRatePercent,
              expectedDeliveryAt: po.expectedDeliveryAt,
            },
            nextState: {
              ...(p.vendorId !== undefined && { vendorId: p.vendorId }),
              ...(p.costCodeId !== undefined && { costCodeId: p.costCodeId }),
              ...(p.taxRatePercent !== undefined && {
                taxRatePercent: p.taxRatePercent.toFixed(2),
              }),
              ...(p.expectedDeliveryAt !== undefined && {
                expectedDeliveryAt: p.expectedDeliveryAt,
              }),
              ...(p.lines && { lineCount: p.lines.length }),
            },
          },
        },
        tx,
      );
      return { id };
    });

    return NextResponse.json(result);
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
