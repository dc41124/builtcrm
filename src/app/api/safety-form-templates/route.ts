import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import { safetyFormTemplates } from "@/db/schema";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/safety-form-templates — contractor's library. Org-scoped.
export async function GET() {
  const { session } = await requireServerSession();
  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can list safety templates",
        "forbidden",
      );
    }
    const rows = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select()
        .from(safetyFormTemplates)
        .where(eq(safetyFormTemplates.organizationId, ctx.organization.id)),
    );
    return NextResponse.json({ rows });
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
