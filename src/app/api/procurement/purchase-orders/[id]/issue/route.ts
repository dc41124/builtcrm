import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { purchaseOrders } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { loadPoDetail } from "@/domain/loaders/procurement";
import { generateAndStorePoPdf } from "@/domain/procurement/pdf";
import { canTransition } from "@/domain/procurement/state-machine";

// POST /api/procurement/purchase-orders/[id]/issue
//
// Transitions a draft PO to `issued`, stamps ordered_at / ordered_by,
// renders the PO PDF, uploads it to R2, creates a documents row (Step
// 22 chain root), and links it to the PO via document_links. Returns
// the new document id.
//
// Email-to-vendor is optional and not yet wired — the wizard checkbox
// logs an audit event only. Once an email transport is in place, this
// route will enqueue a Trigger.dev send job.

export const runtime = "nodejs";

const BodySchema = z.object({
  sendEmailToVendor: z.boolean().optional(),
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

  // Pre-context lookup via admin pool — derive projectId for getEffectiveContext.
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
        "Only contractors can issue POs",
        "forbidden",
      );
    }
    if (po.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!canTransition(po.status, "issued")) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot issue a PO in status "${po.status}"`,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const result = await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({
          status: "issued",
          orderedAt: now,
          orderedByUserId: ctx.user.id,
          updatedAt: now,
        })
        .where(eq(purchaseOrders.id, id));

      const detail = await loadPoDetail(id, ctx);
      if (!detail) throw new Error("po_vanished");

      const { documentId } = await generateAndStorePoPdf(tx, ctx, detail);

      await writeAuditEvent(
        ctx,
        {
          action: "issued",
          resourceType: "purchase_order",
          resourceId: id,
          details: {
            previousState: { status: po.status },
            nextState: {
              status: "issued",
              orderedAt: now.toISOString(),
              documentId,
            },
            metadata: parsed.data.sendEmailToVendor
              ? { emailToVendorRequested: true }
              : null,
          },
        },
        tx,
      );
      return { id, documentId };
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
