import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, integrationConnections, syncEvents } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

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
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only org admins can trigger syncs",
        "forbidden",
      );
    }

    const [existing] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, id),
          eq(integrationConnections.organizationId, ctx.organization.id),
        ),
      )
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (existing.connectionStatus === "disconnected") {
      return NextResponse.json(
        { error: "disconnected", message: "Connection is disconnected" },
        { status: 409 },
      );
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(syncEvents).values({
        integrationConnectionId: existing.id,
        organizationId: ctx.organization.id,
        syncDirection: "reconciliation",
        syncEventStatus: "succeeded",
        summary: `Manual sync triggered by ${ctx.user.displayName ?? ctx.user.email}.`,
        startedAt: now,
        completedAt: now,
      });

      await tx
        .update(integrationConnections)
        .set({
          lastSyncAt: now,
          lastSyncStatus: "succeeded",
          lastErrorMessage: null,
          consecutiveErrors: 0,
        })
        .where(eq(integrationConnections.id, existing.id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "integration_connection",
        objectId: existing.id,
        actionName: "sync_triggered",
        nextState: { triggeredAt: now.toISOString() },
      });
    });

    return NextResponse.json({ id, ok: true, syncedAt: now.toISOString() });
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
