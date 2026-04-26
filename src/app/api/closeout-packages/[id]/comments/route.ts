import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import {
  closeoutPackageComments,
  closeoutPackageItems,
  closeoutPackageSections,
  closeoutPackages,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { formatCloseoutNumber } from "@/domain/loaders/closeout-packages";
import { notifyCloseoutCommented } from "@/lib/closeout-packages/notify";

// POST /api/closeout-packages/:id/comments — client posts a comment on a
// delivered package. V1 is client-write-only: contractors reply via
// messages/email, not through this surface. If that changes, split into
// a new event rather than broadening closeout_package_commented.

const BodySchema = z.object({
  scope: z.enum(["package", "section", "item"]),
  sectionId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  body: z.string().min(1).max(4000),
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
  const input = parsed.data;

  // Shape check in app layer (DB check constraint is backup).
  if (
    (input.scope === "package" && (input.sectionId || input.itemId)) ||
    (input.scope === "section" && (!input.sectionId || input.itemId)) ||
    (input.scope === "item" && (!input.sectionId || !input.itemId))
  ) {
    return NextResponse.json(
      { error: "invalid_scope_shape" },
      { status: 400 },
    );
  }

  try {
    // Pre-context lookup via admin pool. The downstream
    // closeout_package_comments INSERT and section/item validations
    // touch tables without RLS yet, so they stay on `db`.
    const [head] = await dbAdmin
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
    // Client-only write path (V1). Contractor reads comments but doesn't
    // post through this route.
    if (
      ctx.role !== "commercial_client" &&
      ctx.role !== "residential_client"
    ) {
      throw new AuthorizationError(
        "Only the client can post comments on this surface",
        "forbidden",
      );
    }
    // Delivered-only (comments don't appear before the package lands).
    // Accepted packages keep the thread on record but new comments are
    // frozen.
    if (head.status !== "delivered") {
      return NextResponse.json(
        { error: "not_commentable", message: "Package is not open for comments" },
        { status: 409 },
      );
    }

    const numberLabel = formatCloseoutNumber(
      head.sequenceYear,
      head.sequenceNumber,
    );

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // If sectionId / itemId present, validate they belong to this package.
      if (input.sectionId) {
        const [sec] = await tx
          .select({ id: closeoutPackageSections.id })
          .from(closeoutPackageSections)
          .where(
            and(
              eq(closeoutPackageSections.id, input.sectionId),
              eq(closeoutPackageSections.packageId, id),
            ),
          )
          .limit(1);
        if (!sec) return { kind: "section_not_found" as const };
      }
      if (input.itemId) {
        const [it] = await tx
          .select({ id: closeoutPackageItems.id })
          .from(closeoutPackageItems)
          .where(
            and(
              eq(closeoutPackageItems.id, input.itemId),
              eq(closeoutPackageItems.sectionId, input.sectionId!),
            ),
          )
          .limit(1);
        if (!it) return { kind: "item_not_found" as const };
      }

      const [inserted] = await tx
        .insert(closeoutPackageComments)
        .values({
          packageId: id,
          scope: input.scope,
          sectionId: input.sectionId ?? null,
          itemId: input.itemId ?? null,
          authorUserId: ctx.user.id,
          body: input.body,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "comment_added",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            metadata: {
              scope: input.scope,
              sectionId: input.sectionId ?? null,
              itemId: input.itemId ?? null,
              commentId: inserted.id,
            },
          },
        },
        tx,
      );

      await notifyCloseoutCommented(tx, {
        projectId: head.projectId,
        packageId: id,
        numberLabel,
        actorUserId: ctx.user.id,
        actorName: ctx.user.displayName,
        preview: input.body,
      });

      return { kind: "ok" as const, row: inserted };
    });

    if (result.kind === "section_not_found") {
      return NextResponse.json({ error: "section_not_found" }, { status: 400 });
    }
    if (result.kind === "item_not_found") {
      return NextResponse.json({ error: "item_not_found" }, { status: 400 });
    }

    return NextResponse.json({ id: result.row.id });
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
