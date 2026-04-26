import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { selectionItems, selectionOptions } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    // Pre-tenant head lookup: tenant unknown until project resolves.
    const [item] = await dbAdmin
      .select()
      .from(selectionItems)
      .where(eq(selectionItems.id, id))
      .limit(1);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      item.projectId,
    );
    assertCan(ctx.permissions, "selection", "write");
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can publish selection items",
        "forbidden",
      );
    }

    if (item.isPublished) {
      return NextResponse.json({ error: "already_published" }, { status: 409 });
    }

    const now = new Date();
    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(selectionOptions)
        .where(eq(selectionOptions.selectionItemId, id));
      if (Number(count) < 2) {
        return "minimum_two_options_required" as const;
      }
      await tx
        .update(selectionItems)
        .set({
          isPublished: true,
          publishedAt: now,
          publishedByUserId: ctx.user.id,
          selectionItemStatus: "exploring",
          updatedAt: now,
        })
        .where(eq(selectionItems.id, id));
      await writeAuditEvent(
        ctx,
        {
          action: "published",
          resourceType: "selection_item",
          resourceId: id,
          details: {
            previousState: { status: item.selectionItemStatus },
            nextState: { status: "exploring", publishedAt: now.toISOString() },
          },
        },
        tx,
      );
      return "ok" as const;
    });
    if (result !== "ok") {
      return NextResponse.json(
        { error: "minimum_two_options_required" },
        { status: 409 },
      );
    }

    return NextResponse.json({ id, selectionItemStatus: "exploring" });
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
