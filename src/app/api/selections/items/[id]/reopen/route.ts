import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { selectionItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
        "Only contractors can reopen selection items",
        "forbidden",
      );
    }

    if (!item.isPublished) {
      return NextResponse.json({ error: "not_published" }, { status: 409 });
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(selectionItems)
        .set({
          selectionItemStatus: "revision_open",
          urgencyNote: parsed.data.reason,
          updatedAt: now,
        })
        .where(eq(selectionItems.id, id));
      await writeAuditEvent(
        ctx,
        {
          action: "reopened",
          resourceType: "selection_item",
          resourceId: id,
          details: {
            previousState: { status: item.selectionItemStatus },
            nextState: { status: "revision_open", reason: parsed.data.reason },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ id, selectionItemStatus: "revision_open" });
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
