import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { closeoutPackages } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/closeout-packages/:id — edit title, or revert status from
// review → building. Content edits (sections/items/comments) live on
// nested routes. Sent-state changes (deliver/accept) live on dedicated
// transition routes.

const BodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  // Limited status changes: contractor can pull a review-state package
  // back to building. Forward transitions use /deliver and /accept.
  status: z.enum(["building"]).optional(),
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
  const input = parsed.data;

  try {
    const [head] = await db
      .select({
        id: closeoutPackages.id,
        projectId: closeoutPackages.projectId,
        status: closeoutPackages.status,
        title: closeoutPackages.title,
      })
      .from(closeoutPackages)
      .where(eq(closeoutPackages.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit closeout packages",
        "forbidden",
      );
    }

    if (head.status !== "building" && head.status !== "review") {
      return NextResponse.json(
        { error: "not_editable", message: "Delivered/accepted packages are immutable" },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.status === "building" && head.status === "review") {
        updates.status = "building";
      }
      if (Object.keys(updates).length === 0) return;

      await tx
        .update(closeoutPackages)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(closeoutPackages.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            previousState: { title: head.title, status: head.status },
            nextState: {
              title: updates.title ?? head.title,
              status: updates.status ?? head.status,
            },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const [head] = await db
      .select({
        id: closeoutPackages.id,
        projectId: closeoutPackages.projectId,
        status: closeoutPackages.status,
        sequenceYear: closeoutPackages.sequenceYear,
        sequenceNumber: closeoutPackages.sequenceNumber,
      })
      .from(closeoutPackages)
      .where(eq(closeoutPackages.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can delete closeout packages",
        "forbidden",
      );
    }
    if (head.status !== "building") {
      return NextResponse.json(
        {
          error: "not_deletable",
          message:
            "Only building-state packages can be discarded; move to review/delivered locks the package",
        },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await writeAuditEvent(
        ctx,
        {
          action: "discarded",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            previousState: {
              status: head.status,
              sequenceYear: head.sequenceYear,
              sequenceNumber: head.sequenceNumber,
            },
          },
        },
        tx,
      );
      await tx.delete(closeoutPackages).where(eq(closeoutPackages.id, id));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
