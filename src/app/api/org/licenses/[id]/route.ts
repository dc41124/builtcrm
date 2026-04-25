import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import { auditEvents, organizationLicenses } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

const PatchSchema = z.object({
  kind: z.string().trim().min(1).max(200).optional(),
  licenseNumber: z.string().trim().min(1).max(120).optional(),
  stateRegion: z.string().trim().max(80).nullable().optional(),
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO date YYYY-MM-DD")
    .nullable()
    .optional(),
});

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const sessionShim = session;
  const { id } = await params;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    const patch = parsed.data;
    const updates: Record<string, unknown> = {};
    if (patch.kind != null) updates.kind = patch.kind;
    if (patch.licenseNumber != null) updates.licenseNumber = patch.licenseNumber;
    if (patch.stateRegion !== undefined)
      updates.stateRegion = patch.stateRegion || null;
    if (patch.expiresOn !== undefined)
      updates.expiresOn = patch.expiresOn || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, noop: true });
    }

    // organization_licenses has RLS enabled (Phase 2 of the RLS sprint);
    // wrap the read+update+audit triple so the existing-row lookup,
    // the UPDATE's WITH CHECK, and the audit-event INSERT all run
    // inside one tenant-scoped transaction.
    const result = await withTenant(orgId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(organizationLicenses)
        .where(
          and(
            eq(organizationLicenses.id, id),
            eq(organizationLicenses.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!existing) return null;

      await tx
        .update(organizationLicenses)
        .set(updates)
        .where(eq(organizationLicenses.id, existing.id));

      const prev: Record<string, unknown> = {};
      for (const k of Object.keys(updates)) {
        prev[k] = (existing as unknown as Record<string, unknown>)[k];
      }
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization_license",
        objectId: existing.id,
        actionName: "updated",
        previousState: prev,
        nextState: updates,
      });
      return existing;
    });
    if (!result) {
      throw new AuthorizationError("License not found", "not_found");
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

// Hard-delete: licenses are small, recoverable from source of truth, and don't
// carry enough audit value to merit soft-delete. The audit event records the
// removal.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const sessionShim = session;
  const { id } = await params;

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    const result = await withTenant(orgId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(organizationLicenses)
        .where(
          and(
            eq(organizationLicenses.id, id),
            eq(organizationLicenses.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!existing) return null;

      await tx
        .delete(organizationLicenses)
        .where(eq(organizationLicenses.id, existing.id));
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization_license",
        objectId: existing.id,
        actionName: "deleted",
        previousState: {
          kind: existing.kind,
          licenseNumber: existing.licenseNumber,
          stateRegion: existing.stateRegion,
          expiresOn: existing.expiresOn,
        },
      });
      return existing;
    });
    if (!result) {
      throw new AuthorizationError("License not found", "not_found");
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
