import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { auditEvents, integrationConnections } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const ctx = await getContractorOrgContext(
      session,
    );
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only org admins can disconnect integrations",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.id, id),
            eq(integrationConnections.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);
      if (!existing) return { notFound: true as const };


      await tx
        .update(integrationConnections)
        .set({
          connectionStatus: "disconnected",
          disconnectedAt: new Date(),
          accessTokenEnc: null,
          refreshTokenEnc: null,
          tokenExpiresAt: null,
        })
        .where(eq(integrationConnections.id, id));

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "integration_connection",
        objectId: id,
        actionName: "disconnected",
        previousState: { status: existing.connectionStatus },
        nextState: { status: "disconnected" },
      });
      return { notFound: false as const };
    });

    if (result.notFound) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ id, status: "disconnected" });
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
