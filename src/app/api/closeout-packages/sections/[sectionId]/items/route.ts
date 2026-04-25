import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, max } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  closeoutPackageItems,
  closeoutPackageSections,
  closeoutPackages,
  documents,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  documentId: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId } = await params;
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
    const [sec] = await db
      .select({
        packageId: closeoutPackageSections.packageId,
        projectId: closeoutPackages.projectId,
        status: closeoutPackages.status,
      })
      .from(closeoutPackageSections)
      .innerJoin(
        closeoutPackages,
        eq(closeoutPackages.id, closeoutPackageSections.packageId),
      )
      .where(eq(closeoutPackageSections.id, sectionId))
      .limit(1);
    if (!sec) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      sec.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("forbidden", "forbidden");
    }
    if (sec.status !== "building" && sec.status !== "review") {
      return NextResponse.json({ error: "not_editable" }, { status: 409 });
    }

    // Document must belong to this project.
    const [doc] = await db
      .select({ id: documents.id, projectId: documents.projectId })
      .from(documents)
      .where(eq(documents.id, input.documentId))
      .limit(1);
    if (!doc) {
      return NextResponse.json(
        { error: "document_not_found" },
        { status: 400 },
      );
    }
    if (doc.projectId !== sec.projectId) {
      throw new AuthorizationError(
        "Document is not on this project",
        "forbidden",
      );
    }

    const row = await db.transaction(async (tx) => {
      const [highest] = await tx
        .select({ max: max(closeoutPackageItems.sortOrder) })
        .from(closeoutPackageItems)
        .where(eq(closeoutPackageItems.sectionId, sectionId));
      const nextOrder = (highest?.max ?? 0) + 1;

      const [inserted] = await tx
        .insert(closeoutPackageItems)
        .values({
          sectionId,
          documentId: input.documentId,
          notes: input.notes ?? null,
          sortOrder: nextOrder,
          attachedByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "item_added",
          resourceType: "closeout_package",
          resourceId: sec.packageId,
          details: {
            nextState: { sectionId, documentId: input.documentId },
          },
        },
        tx,
      );
      return inserted;
    });

    return NextResponse.json({ id: row.id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    if (err instanceof Error && /unique/i.test(err.message)) {
      return NextResponse.json(
        { error: "duplicate_document", message: "That document is already in this section." },
        { status: 409 },
      );
    }
    throw err;
  }
}
