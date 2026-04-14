import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { selectionItems, selectionOptions } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const [item] = await db
      .select()
      .from(selectionItems)
      .where(eq(selectionItems.id, id))
      .limit(1);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
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

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(selectionOptions)
      .where(eq(selectionOptions.selectionItemId, id));
    if (Number(count) < 2) {
      return NextResponse.json(
        { error: "minimum_two_options_required" },
        { status: 409 },
      );
    }

    const now = new Date();
    await db.transaction(async (tx) => {
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
    });

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
