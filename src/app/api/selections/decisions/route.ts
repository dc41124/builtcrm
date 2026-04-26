import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import {
  selectionDecisions,
  selectionItems,
  selectionOptions,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  selectionItemId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
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

  try {
    // Pre-tenant head lookup: tenant unknown until project resolves.
    const [item] = await dbAdmin
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
      session,
      item.projectId,
    );
    assertCan(ctx.permissions, "selection", "write");
    if (ctx.role !== "residential_client") {
      throw new AuthorizationError(
        "Only residential clients can make selection decisions",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [option] = await tx
        .select()
        .from(selectionOptions)
        .where(
          and(
            eq(selectionOptions.id, parsed.data.selectedOptionId),
            eq(selectionOptions.selectionItemId, item.id),
          ),
        )
        .limit(1);
      if (!option) return { kind: "option_not_found" as const };
      if (!option.isAvailable) return { kind: "option_unavailable" as const };

      const [latestDecision] = await tx
        .select()
        .from(selectionDecisions)
        .where(eq(selectionDecisions.selectionItemId, item.id))
        .orderBy(desc(selectionDecisions.createdAt))
        .limit(1);

      if (latestDecision?.isLocked) {
        return { kind: "already_locked" as const };
      }

      const priceDelta = option.priceCents - item.allowanceCents;
      const scheduleDelta = option.additionalScheduleDays ?? 0;

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
      return { kind: "ok" as const, row };
    });

    if (result.kind === "option_not_found") {
      return NextResponse.json({ error: "option_not_found" }, { status: 404 });
    }
    if (result.kind === "option_unavailable") {
      return NextResponse.json({ error: "option_unavailable" }, { status: 409 });
    }
    if (result.kind === "already_locked") {
      return NextResponse.json({ error: "already_locked" }, { status: 409 });
    }

    return NextResponse.json({
      id: result.row.id,
      selectedOptionId: result.row.selectedOptionId,
      isProvisional: result.row.isProvisional,
      priceDeltaCents: result.row.priceDeltaCents,
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
