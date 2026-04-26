import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { vendors } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  name: z.string().min(1).max(255),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().max(320).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  paymentTerms: z.string().max(120).optional().nullable(),
  rating: z.enum(["preferred", "standard"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(req: Request) {
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

    const orgId = ctx.organization.id;
    const body = parsed.data;

    const [row] = await withTenant(orgId, (tx) =>
      tx
        .insert(vendors)
        .values({
          organizationId: orgId,
          name: body.name,
          contactName: body.contactName ?? null,
          contactEmail: body.contactEmail ?? null,
          contactPhone: body.contactPhone ?? null,
          address: body.address ?? null,
          paymentTerms: body.paymentTerms ?? null,
          rating: body.rating ?? "standard",
          notes: body.notes ?? null,
        })
        .returning(),
    );

    // Vendor creation is org-scoped; audit events log project=null via the
    // single shared writer. Skipped here — no project in scope.

    return NextResponse.json({ vendor: row });
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
