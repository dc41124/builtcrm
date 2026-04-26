import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { documents, punchItemPhotos, punchItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/punch-item-photos
//
// Link a previously-uploaded document to a punch item. The upload
// itself goes through the existing R2 presign → PUT → finalize flow
// (src/app/api/upload/request + finalize); this endpoint just creates
// the join row.
//
// Authorization: contractor OR the assigned sub org. Subs can attach
// "before / progress / after" photos; contractors can attach anywhere.
// Document must be on the same project as the punch item (defense in
// depth — prevents referencing unrelated project documents).
//
// Sort order: computed as max+1 server-side when not provided, so
// photos land in insertion order without any client bookkeeping.

const BodySchema = z.object({
  punchItemId: z.string().uuid(),
  documentId: z.string().uuid(),
  caption: z.string().max(500).nullable().optional(),
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
  const input = parsed.data;

  try {
    // Entry-point dbAdmin: tenant unknown until we resolve project from
    // the punch item row (punch_items not yet RLS-enabled).
    const [itemHead] = await dbAdmin
      .select({
        id: punchItems.id,
        projectId: punchItems.projectId,
        assigneeOrgId: punchItems.assigneeOrgId,
      })
      .from(punchItems)
      .where(eq(punchItems.id, input.punchItemId))
      .limit(1);
    if (!itemHead) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      itemHead.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isAssignedSub =
      ctx.role === "subcontractor_user" &&
      itemHead.assigneeOrgId === ctx.organization.id;
    if (!isContractor && !isAssignedSub) {
      throw new AuthorizationError(
        "Only contractors and the assigned sub can attach photos",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Validate document is on the same project — runs inside withTenant
      // so the documents read passes RLS.
      const [doc] = await tx
        .select({ id: documents.id, projectId: documents.projectId })
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1);
      if (!doc || doc.projectId !== itemHead.projectId) {
        throw new InvalidDocumentError();
      }

      // Compute next sort order as max+1 (falls back to 0 for the
      // first photo). Same pattern as RFI sequentialNumber —
      // concurrent inserts are unlikely here and would just collide
      // on identical sort_order, which is visually harmless.
      const [{ nextOrder }] = await tx
        .select({
          nextOrder: sql<number>`coalesce(max(${punchItemPhotos.sortOrder}), -1) + 1`,
        })
        .from(punchItemPhotos)
        .where(eq(punchItemPhotos.punchItemId, input.punchItemId));

      const [row] = await tx
        .insert(punchItemPhotos)
        .values({
          punchItemId: input.punchItemId,
          documentId: input.documentId,
          caption: input.caption ?? null,
          sortOrder: nextOrder,
          uploadedByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "photo_attached",
          resourceType: "punch_item",
          resourceId: input.punchItemId,
          details: {
            nextState: { photoId: row.id, caption: row.caption },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({ id: result.id });
  } catch (err) {
    if (err instanceof InvalidDocumentError) {
      return NextResponse.json(
        { error: "invalid_document", message: "Document not on this project" },
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
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}

class InvalidDocumentError extends Error {}
