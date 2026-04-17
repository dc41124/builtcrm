import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, organizationCertifications } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

async function resolveAdminOrg(sessionShim: { appUserId?: string | null }) {
  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") throw new AuthorizationError("Forbidden", "forbidden");
    return { orgId: ctx.organization.id, userId: ctx.user.id };
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err;
    const ctx = await getSubcontractorOrgContext(sessionShim);
    if (ctx.role !== "subcontractor_owner") throw new AuthorizationError("Forbidden", "forbidden");
    return { orgId: ctx.organization.id, userId: ctx.user.id };
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as { appUserId?: string | null };
  const { id } = await params;

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    const [existing] = await db
      .select()
      .from(organizationCertifications)
      .where(
        and(
          eq(organizationCertifications.id, id),
          eq(organizationCertifications.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new AuthorizationError("Certification not found", "not_found");
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(organizationCertifications)
        .where(eq(organizationCertifications.id, existing.id));
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization_certification",
        objectId: existing.id,
        actionName: "deleted",
        previousState: {
          kind: existing.kind,
          holder: existing.holder,
          issuedOn: existing.issuedOn,
          expiresOn: existing.expiresOn,
        },
      });
    });

    return NextResponse.json({ ok: true });
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
