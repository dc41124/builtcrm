import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

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
import { emitNotifications } from "@/lib/notifications/emit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    // Pre-tenant head lookup: tenant unknown until project resolves.
    const [decision] = await dbAdmin
      .select()
      .from(selectionDecisions)
      .where(eq(selectionDecisions.id, id))
      .limit(1);
    if (!decision) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      decision.projectId,
    );
    assertCan(ctx.permissions, "selection", "approve");
    if (ctx.role !== "residential_client") {
      throw new AuthorizationError(
        "Only residential clients can confirm selections",
        "forbidden",
      );
    }

    if (decision.isConfirmed || decision.isLocked) {
      return NextResponse.json(
        { error: "already_confirmed" },
        { status: 409 },
      );
    }
    if (decision.decidedByUserId !== ctx.user.id) {
      // A different client on the project shouldn't confirm another's pick.
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    const now = new Date();
    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [item] = await tx
        .select()
        .from(selectionItems)
        .where(eq(selectionItems.id, decision.selectionItemId))
        .limit(1);
      if (!item) return { kind: "item_not_found" as const };

      const revisionExpires = new Date(
        now.getTime() + item.revisionWindowHours * 60 * 60 * 1000,
      );

      await tx
        .update(selectionDecisions)
        .set({
          isProvisional: false,
          isConfirmed: true,
          confirmedAt: now,
          revisionExpiresAt: revisionExpires,
          updatedAt: now,
        })
        .where(eq(selectionDecisions.id, id));

      await tx
        .update(selectionItems)
        .set({ selectionItemStatus: "confirmed", updatedAt: now })
        .where(eq(selectionItems.id, item.id));

      await writeAuditEvent(
        ctx,
        {
          action: "confirmed",
          resourceType: "selection_decision",
          resourceId: id,
          details: {
            nextState: {
              confirmedAt: now.toISOString(),
              revisionExpiresAt: revisionExpires.toISOString(),
            },
          },
        },
        tx,
      );

      const [option] = await tx
        .select({ name: selectionOptions.name })
        .from(selectionOptions)
        .where(eq(selectionOptions.id, decision.selectedOptionId))
        .limit(1);

      return { kind: "ok" as const, item, option, revisionExpires };
    });

    if (result.kind === "item_not_found") {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }
    const { item, option, revisionExpires } = result;

    await emitNotifications({
      eventId: "selection_confirmed",
      actorUserId: ctx.user.id,
      projectId: decision.projectId,
      relatedObjectType: "selection_decision",
      relatedObjectId: decision.id,
      vars: {
        itemTitle: item.title,
        optionName: option?.name ?? null,
      },
    });

    return NextResponse.json({
      id,
      confirmedAt: now.toISOString(),
      revisionExpiresAt: revisionExpires.toISOString(),
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
