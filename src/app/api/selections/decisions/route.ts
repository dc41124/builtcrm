import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  selectionDecisions,
  selectionItems,
  selectionOptions,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  selectionItemId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
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

  try {
    const [item] = await db
      .select()
      .from(selectionItems)
      .where(eq(selectionItems.id, parsed.data.selectionItemId))
      .limit(1);
    if (!item) {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }
    if (!item.isPublished) {
      return NextResponse.json({ error: "not_published" }, { status: 409 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      item.projectId,
    );
    assertCan(ctx.permissions, "selection", "write");
    if (ctx.role !== "residential_client") {
      throw new AuthorizationError(
        "Only residential clients can make selection decisions",
        "forbidden",
      );
    }

    const [option] = await db
      .select()
      .from(selectionOptions)
      .where(
        and(
          eq(selectionOptions.id, parsed.data.selectedOptionId),
          eq(selectionOptions.selectionItemId, item.id),
        ),
      )
      .limit(1);
    if (!option) {
      return NextResponse.json({ error: "option_not_found" }, { status: 404 });
    }
    if (!option.isAvailable) {
      return NextResponse.json({ error: "option_unavailable" }, { status: 409 });
    }

    const [latestDecision] = await db
      .select()
      .from(selectionDecisions)
      .where(eq(selectionDecisions.selectionItemId, item.id))
      .orderBy(desc(selectionDecisions.createdAt))
      .limit(1);

    if (latestDecision?.isLocked) {
      return NextResponse.json({ error: "already_locked" }, { status: 409 });
    }

    const priceDelta = option.priceCents - item.allowanceCents;
    const scheduleDelta = option.additionalScheduleDays ?? 0;

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(selectionDecisions)
        .values({
          selectionItemId: item.id,
          projectId: item.projectId,
          selectedOptionId: option.id,
          decidedByUserId: ctx.user.id,
          isProvisional: true,
          isConfirmed: false,
          isLocked: false,
          previousOptionId: latestDecision?.selectedOptionId ?? null,
          priceDeltaCents: priceDelta,
          scheduleDeltaDays: scheduleDelta,
        })
        .returning();

      await tx
        .update(selectionItems)
        .set({
          selectionItemStatus: "provisional",
          updatedAt: new Date(),
        })
        .where(eq(selectionItems.id, item.id));

      await writeAuditEvent(
        ctx,
        {
          action: "provisional_selected",
          resourceType: "selection_decision",
          resourceId: row.id,
          details: {
            nextState: {
              selectedOptionId: option.id,
              priceDeltaCents: priceDelta,
            },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({
      id: result.id,
      selectedOptionId: result.selectedOptionId,
      isProvisional: result.isProvisional,
      priceDeltaCents: result.priceDeltaCents,
    });
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
