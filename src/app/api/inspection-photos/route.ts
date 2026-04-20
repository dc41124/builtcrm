import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  documents,
  inspectionResultPhotos,
  inspectionResults,
  inspections,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/inspection-photos
//
// Link a previously-uploaded document to an inspection result. The
// upload itself goes through the existing R2 presign → PUT → finalize
// flow (src/app/api/upload/request + finalize); this endpoint just
// creates the join row.
//
// Authorization: contractor on the project OR the assigned sub org.
// Document must be on the same project as the inspection (defense in
// depth — prevents referencing unrelated project documents).

const BodySchema = z.object({
  inspectionResultId: z.string().uuid(),
  documentId: z.string().uuid(),
  caption: z.string().max(500).nullable().optional(),
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
  const input = parsed.data;

  try {
    // Resolve the result → parent inspection → project for auth + doc validation.
    const [row] = await db
      .select({
        resultId: inspectionResults.id,
        inspectionId: inspectionResults.inspectionId,
        projectId: inspections.projectId,
        assignedOrgId: inspections.assignedOrgId,
        status: inspections.status,
      })
      .from(inspectionResults)
      .innerJoin(
        inspections,
        eq(inspections.id, inspectionResults.inspectionId),
      )
      .where(eq(inspectionResults.id, input.inspectionResultId))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      row.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isAssignedSub =
      ctx.role === "subcontractor_user" &&
      row.assignedOrgId === ctx.organization.id;
    if (!isContractor && !isAssignedSub) {
      throw new AuthorizationError(
        "Only contractors and the assigned sub can attach photos",
        "forbidden",
      );
    }
    if (row.status === "cancelled") {
      throw new AuthorizationError(
        "Inspection is cancelled",
        "forbidden",
      );
    }

    const [doc] = await db
      .select({ id: documents.id, projectId: documents.projectId })
      .from(documents)
      .where(eq(documents.id, input.documentId))
      .limit(1);
    if (!doc || doc.projectId !== row.projectId) {
      return NextResponse.json(
        { error: "invalid_document", message: "Document not on this project" },
        { status: 400 },
      );
    }

    const result = await db.transaction(async (tx) => {
      // max+1 sort order so photos land in upload order without any
      // client-side bookkeeping. Concurrent uploads would collide on
      // sort_order but that's visually harmless.
      const [{ nextOrder }] = await tx
        .select({
          nextOrder: sql<number>`coalesce(max(${inspectionResultPhotos.sortOrder}), -1) + 1`,
        })
        .from(inspectionResultPhotos)
        .where(
          eq(inspectionResultPhotos.inspectionResultId, input.inspectionResultId),
        );

      const [photo] = await tx
        .insert(inspectionResultPhotos)
        .values({
          inspectionResultId: input.inspectionResultId,
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
          resourceType: "inspection_result",
          resourceId: input.inspectionResultId,
          details: {
            nextState: { photoId: photo.id, caption: photo.caption },
          },
        },
        tx,
      );
      return photo;
    });

    return NextResponse.json({ id: result.id });
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
