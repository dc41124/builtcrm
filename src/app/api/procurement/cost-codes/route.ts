import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { costCodes } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  code: z.string().min(1).max(40),
  description: z.string().min(1).max(255),
  sortOrder: z.number().int().nonnegative().optional(),
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

    try {
      const [row] = await withTenant(ctx.organization.id, (tx) =>
        tx
          .insert(costCodes)
          .values({
            organizationId: ctx.organization.id,
            code: parsed.data.code,
            description: parsed.data.description,
            sortOrder: parsed.data.sortOrder ?? 0,
          })
          .returning(),
      );
      return NextResponse.json({ costCode: row });
    } catch (err) {
      // Unique (organizationId, code) violation — surface as clean 409
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cost_codes_org_code_unique")) {
        return NextResponse.json(
          { error: "duplicate_code", message: "This code already exists for your org" },
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
