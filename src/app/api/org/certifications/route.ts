import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { db } from "@/db/client";
import { auditEvents, organizationCertifications } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

// Self-managed entries: holder/issued/expires are free-form because real
// certs carry labels like "Various" or "Annual renewal" that don't fit
// structured types.
const BodySchema = z.object({
  kind: z.string().trim().min(1).max(200),
  holder: z.string().trim().max(200).nullable().optional(),
  issuedOn: z.string().trim().max(60).nullable().optional(),
  expiresOn: z.string().trim().max(60).nullable().optional(),
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

    const [row] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(organizationCertifications)
        .values({
          organizationId: orgId,
          kind: parsed.data.kind,
          holder: parsed.data.holder ?? null,
          issuedOn: parsed.data.issuedOn ?? null,
          expiresOn: parsed.data.expiresOn ?? null,
        })
        .returning();

      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization_certification",
        objectId: inserted[0].id,
        actionName: "created",
        nextState: {
          kind: inserted[0].kind,
          holder: inserted[0].holder,
          issuedOn: inserted[0].issuedOn,
          expiresOn: inserted[0].expiresOn,
        },
      });

      return inserted;
    });

    return NextResponse.json({ ok: true, certification: row });
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
