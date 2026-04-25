import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { auditEvents, integrationConnections } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  mappingConfig: z.record(z.string(), z.unknown()).optional(),
  syncPreferences: z.record(z.string(), z.unknown()).optional(),
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

  try {
    const ctx = await getContractorOrgContext(
      session,
    );
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only org admins can modify integration settings",
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

    await db.transaction(async (tx) => {
      await tx
        .update(integrationConnections)
        .set({
          mappingConfig: parsed.data.mappingConfig ?? existing.mappingConfig,
          syncPreferences:
            parsed.data.syncPreferences ?? existing.syncPreferences,
        })
        .where(eq(integrationConnections.id, id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "integration_connection",
        objectId: id,
        actionName: "settings_updated",
        previousState: {
          mappingConfig: existing.mappingConfig,
          syncPreferences: existing.syncPreferences,
        },
        nextState: {
          mappingConfig: parsed.data.mappingConfig ?? existing.mappingConfig,
          syncPreferences:
            parsed.data.syncPreferences ?? existing.syncPreferences,
        },
      });
    });

    return NextResponse.json({ id, ok: true });
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
