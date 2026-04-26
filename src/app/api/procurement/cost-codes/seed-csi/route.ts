import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";

import { costCodes } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { CSI_STARTER_CODES } from "@/domain/procurement/csi-starter";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

// Seeds the CSI division starter set (~25 codes) for the caller's org.
// Idempotent: existing (organizationId, code) rows are left alone via
// `ON CONFLICT DO NOTHING`. Returns the count of rows that were newly
// inserted, so the UI can tell the contractor "24 codes added" vs.
// "nothing — your catalog already has them."
//
// First-run prompt on the procurement page fires this when the org has
// zero cost codes configured.

export async function POST() {
  const { session } = await requireServerSession();
  try {
    const ctx = await getContractorOrgContext(
      session,
    );

    const orgId = ctx.organization.id;
    const values = CSI_STARTER_CODES.map((c) => ({
      organizationId: orgId,
      code: c.code,
      description: c.description,
      sortOrder: c.sortOrder,
    }));

    const result = await withTenant(orgId, (tx) =>
      tx
        .insert(costCodes)
        .values(values)
        .onConflictDoNothing({
          target: [costCodes.organizationId, costCodes.code],
        })
        .returning({ id: costCodes.id }),
    );

    return NextResponse.json({
      insertedCount: result.length,
      totalAttempted: values.length,
    });
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
