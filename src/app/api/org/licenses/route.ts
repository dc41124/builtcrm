import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as { appUserId?: string | null };

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    const [row] = await db.transaction(async (tx) => {
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
