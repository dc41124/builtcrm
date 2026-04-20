import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  costCodes,
  organizations,
  purchaseOrderLines,
  purchaseOrders,
  vendors,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { allocateNextPoNumber } from "@/domain/procurement/po-number";

// POST /api/procurement/purchase-orders — creates a draft PO.
//
// Takes a project, vendor, cost code, tax rate override (optional; defaults
// from the org), and an initial array of line items. Subtotal + tax + total
// are never sent over the wire — they're computed on read from the line
// rows + `tax_rate_percent`.

const LineSchema = z.object({
  description: z.string().min(1).max(2000),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(32),
  unitCostCents: z.number().int().nonnegative(),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid(),
  costCodeId: z.string().uuid().nullable().optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  expectedDeliveryAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  lines: z.array(LineSchema).min(1).max(100),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      parsed.data.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create purchase orders",
        "forbidden",
      );
    }

    const orgId = ctx.organization.id;

    // Vendor + cost code (if any) must belong to the same org.
    const [vendor] = await db
      .select({ id: vendors.id, organizationId: vendors.organizationId })
      .from(vendors)
      .where(eq(vendors.id, parsed.data.vendorId))
      .limit(1);
    if (!vendor || vendor.organizationId !== orgId) {
      return NextResponse.json({ error: "invalid_vendor" }, { status: 400 });
    }
    if (parsed.data.costCodeId) {
      const [code] = await db
        .select({ id: costCodes.id, organizationId: costCodes.organizationId })
        .from(costCodes)
        .where(eq(costCodes.id, parsed.data.costCodeId))
        .limit(1);
      if (!code || code.organizationId !== orgId) {
        return NextResponse.json(
          { error: "invalid_cost_code" },
          { status: 400 },
        );
      }
    }

    // Default tax rate from org settings if not overridden.
    let taxRatePercentStr: string;
    if (parsed.data.taxRatePercent !== undefined) {
      taxRatePercentStr = parsed.data.taxRatePercent.toFixed(2);
    } else {
      const [org] = await db
        .select({ defaultTaxRatePercent: organizations.defaultTaxRatePercent })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      taxRatePercentStr = org?.defaultTaxRatePercent ?? "0.00";
    }

    const result = await db.transaction(async (tx) => {
      const poNumber = await allocateNextPoNumber(tx, orgId);
      const [poRow] = await tx
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          projectId: parsed.data.projectId,
          poNumber,
          vendorId: parsed.data.vendorId,
          costCodeId: parsed.data.costCodeId ?? null,
          status: "draft",
          expectedDeliveryAt: parsed.data.expectedDeliveryAt
            ? new Date(parsed.data.expectedDeliveryAt)
            : null,
          taxRatePercent: taxRatePercentStr,
          notes: parsed.data.notes ?? null,
          revisionNumber: 1,
        })
        .returning();

      for (let i = 0; i < parsed.data.lines.length; i++) {
        const l = parsed.data.lines[i];
        await tx.insert(purchaseOrderLines).values({
          purchaseOrderId: poRow.id,
          sortOrder: i,
          description: l.description,
          quantity: l.quantity.toFixed(3),
          unit: l.unit,
          unitCostCents: l.unitCostCents,
        });
      }

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "purchase_order",
          resourceId: poRow.id,
          details: {
            nextState: {
              poNumber: poRow.poNumber,
              vendorId: poRow.vendorId,
              costCodeId: poRow.costCodeId,
              lineCount: parsed.data.lines.length,
              status: "draft",
            },
          },
        },
        tx,
      );
      return poRow;
    });

    return NextResponse.json({ purchaseOrder: result });
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
