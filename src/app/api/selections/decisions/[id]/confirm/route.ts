import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

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
import { emitNotifications } from "@/lib/notifications/emit";

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
    const [decision] = await db
      .select()
      .from(selectionDecisions)
      .where(eq(selectionDecisions.id, id))
      .limit(1);
    if (!decision) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
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

    const [item] = await db
      .select()
      .from(selectionItems)
      .where(eq(selectionItems.id, decision.selectionItemId))
      .limit(1);
    if (!item) {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }

    const now = new Date();
    const revisionExpires = new Date(
      now.getTime() + item.revisionWindowHours * 60 * 60 * 1000,
    );

    await db.transaction(async (tx) => {
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
    });

    const [option] = await db
      .select({ name: selectionOptions.name })
      .from(selectionOptions)
      .where(eq(selectionOptions.id, decision.selectedOptionId))
      .limit(1);

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
