import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { costCodes } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  code: z.string().min(1).max(40).optional(),
  description: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
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

    const [existing] = await db
      .select({ id: costCodes.id, organizationId: costCodes.organizationId })
      .from(costCodes)
      .where(eq(costCodes.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (existing.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const p = parsed.data;
    try {
      const [row] = await db
        .update(costCodes)
        .set({
          ...(p.code !== undefined && { code: p.code }),
          ...(p.description !== undefined && { description: p.description }),
          ...(p.active !== undefined && { active: p.active }),
          ...(p.sortOrder !== undefined && { sortOrder: p.sortOrder }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(costCodes.id, id),
            eq(costCodes.organizationId, ctx.organization.id),
          ),
        )
        .returning();
      return NextResponse.json({ costCode: row });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cost_codes_org_code_unique")) {
        return NextResponse.json(
          { error: "duplicate_code" },
          { status: 409 },
        );
      }
      throw err;
    }
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
