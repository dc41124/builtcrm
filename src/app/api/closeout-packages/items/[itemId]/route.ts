import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  closeoutPackageItems,
  closeoutPackageSections,
  closeoutPackages,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
});

async function loadItem(itemId: string) {
  const [row] = await db
    .select({
      id: closeoutPackageItems.id,
      sectionId: closeoutPackageItems.sectionId,
      documentId: closeoutPackageItems.documentId,
      notes: closeoutPackageItems.notes,
      packageId: closeoutPackageSections.packageId,
      projectId: closeoutPackages.projectId,
      status: closeoutPackages.status,
    })
    .from(closeoutPackageItems)
    .innerJoin(
      closeoutPackageSections,
      eq(closeoutPackageSections.id, closeoutPackageItems.sectionId),
    )
    .innerJoin(
      closeoutPackages,
      eq(closeoutPackages.id, closeoutPackageSections.packageId),
    )
    .where(eq(closeoutPackageItems.id, itemId))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const row = await loadItem(itemId);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      row.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("forbidden", "forbidden");
    }
    if (row.status !== "building" && row.status !== "review") {
      return NextResponse.json({ error: "not_editable" }, { status: 409 });
    }

    if (parsed.data.notes === undefined) {
      return NextResponse.json({ ok: true });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(closeoutPackageItems)
        .set({ notes: parsed.data.notes ?? null })
        .where(eq(closeoutPackageItems.id, itemId));
      await writeAuditEvent(
        ctx,
        {
          action: "item_note_updated",
          resourceType: "closeout_package",
          resourceId: row.packageId,
          details: { metadata: { itemId } },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const { session } = await requireServerSession();
  try {
    const row = await loadItem(itemId);
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      row.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("forbidden", "forbidden");
    }
    if (row.status !== "building" && row.status !== "review") {
      return NextResponse.json({ error: "not_editable" }, { status: 409 });
    }

    await db.transaction(async (tx) => {
      await writeAuditEvent(
        ctx,
        {
          action: "item_removed",
          resourceType: "closeout_package",
          resourceId: row.packageId,
          details: {
            previousState: { sectionId: row.sectionId, documentId: row.documentId },
          },
        },
        tx,
      );
      await tx
        .delete(closeoutPackageItems)
        .where(eq(closeoutPackageItems.id, itemId));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
