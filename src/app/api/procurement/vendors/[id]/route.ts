import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { vendors } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().max(320).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  paymentTerms: z.string().max(120).optional().nullable(),
  rating: z.enum(["preferred", "standard"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );

    // Vendor must belong to caller's org.
    const [existing] = await db
      .select({
        id: vendors.id,
        organizationId: vendors.organizationId,
      })
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (existing.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const patch = parsed.data;
    const [row] = await db
      .update(vendors)
      .set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.contactName !== undefined && { contactName: patch.contactName }),
        ...(patch.contactEmail !== undefined && { contactEmail: patch.contactEmail }),
        ...(patch.contactPhone !== undefined && { contactPhone: patch.contactPhone }),
        ...(patch.address !== undefined && { address: patch.address }),
        ...(patch.paymentTerms !== undefined && { paymentTerms: patch.paymentTerms }),
        ...(patch.rating !== undefined && { rating: patch.rating }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.active !== undefined && { active: patch.active }),
        updatedAt: new Date(),
      })
      .where(
        and(eq(vendors.id, id), eq(vendors.organizationId, ctx.organization.id)),
      )
      .returning();

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
