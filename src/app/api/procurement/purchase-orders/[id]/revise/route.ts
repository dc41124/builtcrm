import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { purchaseOrderLines, purchaseOrders } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { loadPoDetail } from "@/domain/loaders/procurement";
import {
  findCurrentPoPdfDocumentId,
  generateAndStorePoPdf,
} from "@/domain/procurement/pdf";
import { canBeRevised } from "@/domain/procurement/state-machine";

// POST /api/procurement/purchase-orders/[id]/revise
//
// Post-issue edit flow. Bumps revisionNumber, flips status to
// `revised`, replaces lines with the new set, generates a new PDF
// versioned via Step 22's supersedes chain (old PDF marked superseded;
// new one created with `supersedes_document_id = oldId`), and captures
// the full pre/post diff on the audit event so reviewers can see what
// changed between revisions.
//
// State machine guard: only issued / revised / partially_received can
// be revised. Terminal (closed, invoiced, cancelled) and fully_received
// are intentionally excluded — at fully_received the deal is done and
// the next step is invoicing, not editing.

export const runtime = "nodejs";

const LineSchema = z.object({
  description: z.string().min(1).max(2000),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(32),
  unitCostCents: z.number().int().nonnegative(),
});

const BodySchema = z.object({
  reason: z.string().max(1000).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  expectedDeliveryAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  lines: z.array(LineSchema).min(1).max(100),
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
      throw new AuthorizationError("Only contractors can revise POs", "forbidden");
    }
    if (po.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (!canBeRevised(po.status)) {
      return NextResponse.json(
        {
          error: "cannot_revise",
          message: `Cannot revise a PO in status "${po.status}"`,
        },
        { status: 409 },
      );
    }

    // Capture the pre-revision snapshot (lines + header) for the audit
    // event. After the revise the old line rows are gone.
    const priorLines = await db
      .select({
        id: purchaseOrderLines.id,
        sortOrder: purchaseOrderLines.sortOrder,
        description: purchaseOrderLines.description,
        quantity: purchaseOrderLines.quantity,
        unit: purchaseOrderLines.unit,
        unitCostCents: purchaseOrderLines.unitCostCents,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, id))
      .orderBy(purchaseOrderLines.sortOrder);

    const priorPdfId = await findCurrentPoPdfDocumentId(id, ctx.organization.id);

    const now = new Date();
    const p = parsed.data;
    const nextRevision = po.revisionNumber + 1;

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Update header + bump revision number.
      await tx
        .update(purchaseOrders)
        .set({
          status: "revised",
          revisionNumber: nextRevision,
          lastRevisedAt: now,
          ...(p.taxRatePercent !== undefined && {
            taxRatePercent: p.taxRatePercent.toFixed(2),
          }),
          ...(p.expectedDeliveryAt !== undefined && {
            expectedDeliveryAt: p.expectedDeliveryAt
              ? new Date(p.expectedDeliveryAt)
              : null,
          }),
          ...(p.notes !== undefined && { notes: p.notes }),
          updatedAt: now,
        })
        .where(eq(purchaseOrders.id, id));

      // Replace lines. Received-quantity history dies here — a revision
      // is functionally a re-issue with potentially different line
      // structure, so carrying forward old receive state against
      // different line ids would be misleading.
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

      // Re-load detail (with new lines) so the PDF gets the new totals.
      const detail = await loadPoDetail(id, ctx);
      if (!detail) throw new Error("po_vanished");

      const { documentId } = await generateAndStorePoPdf(tx, ctx, detail, {
        supersedesDocumentId: priorPdfId ?? undefined,
      });

      await writeAuditEvent(
        ctx,
        {
          action: "revised",
          resourceType: "purchase_order",
          resourceId: id,
          details: {
            previousState: {
              status: po.status,
              revisionNumber: po.revisionNumber,
              taxRatePercent: po.taxRatePercent,
              expectedDeliveryAt: po.expectedDeliveryAt,
              lines: priorLines,
            },
            nextState: {
              status: "revised",
              revisionNumber: nextRevision,
              taxRatePercent: p.taxRatePercent?.toFixed(2) ?? po.taxRatePercent,
              expectedDeliveryAt:
                p.expectedDeliveryAt !== undefined
                  ? p.expectedDeliveryAt
                  : po.expectedDeliveryAt,
              lines: p.lines,
              documentId,
              supersedesDocumentId: priorPdfId,
            },
            metadata: p.reason ? { reason: p.reason } : null,
          },
        },
        tx,
      );
      return { id, revisionNumber: nextRevision, documentId };
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
