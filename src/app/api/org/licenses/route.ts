import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import { auditEvents, organizationLicenses } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  kind: z.string().trim().min(1).max(200),
  licenseNumber: z.string().trim().min(1).max(120),
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

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const sessionShim = session;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    // organization_licenses has RLS enabled (Phase 2 of the RLS sprint);
    // withTenant scopes both the INSERT (WITH CHECK) and the audit-event
    // write to this org's policy.
    const [row] = await withTenant(orgId, async (tx) => {
      const inserted = await tx
        .insert(organizationLicenses)
        .values({
          organizationId: orgId,
          kind: parsed.data.kind,
          licenseNumber: parsed.data.licenseNumber,
          stateRegion: parsed.data.stateRegion ?? null,
          expiresOn: parsed.data.expiresOn ?? null,
        })
        .returning();

      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization_license",
        objectId: inserted[0].id,
        actionName: "created",
        nextState: {
          kind: inserted[0].kind,
          licenseNumber: inserted[0].licenseNumber,
          stateRegion: inserted[0].stateRegion,
          expiresOn: inserted[0].expiresOn,
        },
      });

      return inserted;
    });

    return NextResponse.json({ ok: true, license: row });
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
