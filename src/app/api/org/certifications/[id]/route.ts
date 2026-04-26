import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
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
  const { session } = await requireServerSession();
  const sessionShim = session;
  const { id } = await params;

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    // organization_certifications has RLS enabled (Phase 3 of the
    // RLS sprint). Mirrors the organization_licenses pattern.
    const result = await withTenant(orgId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(organizationCertifications)
        .where(
          and(
            eq(organizationCertifications.id, id),
            eq(organizationCertifications.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!existing) return null;

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
      return existing;
    });
    if (!result) {
      throw new AuthorizationError("Certification not found", "not_found");
    }

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
