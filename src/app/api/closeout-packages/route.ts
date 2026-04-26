import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { closeoutPackages } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { allocateCloseoutSequence } from "@/lib/closeout-packages/counter";
import { formatCloseoutNumber } from "@/domain/loaders/closeout-packages";

// POST /api/closeout-packages — create a new closeout package on a project.
// Contractor-only. Sequence number is assigned NOW (not on delivery) so
// the contractor has a stable reference during assembly. Sequence is
// per-contractor-org-per-year.

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().max(255).optional(),
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
  const input = parsed.data;

  try {
    const ctx = await getEffectiveContext(
      session,
      input.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create closeout packages",
        "forbidden",
      );
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const orgId = ctx.project.contractorOrganizationId;

    const result = await withTenant(orgId, async (tx) => {
      const seq = await allocateCloseoutSequence(tx, {
        organizationId: orgId,
        year,
      });
      const numberLabel = formatCloseoutNumber(year, seq);
      const [row] = await tx
        .insert(closeoutPackages)
        .values({
          projectId: input.projectId,
          organizationId: orgId,
          sequenceYear: year,
          sequenceNumber: seq,
          title: input.title ?? "Project closeout package",
          status: "building",
          preparedByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "closeout_package",
          resourceId: row.id,
          details: {
            nextState: { status: "building", number: numberLabel },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${numberLabel}: closeout package created`,
          body: null,
          relatedObjectType: "closeout_package",
          relatedObjectId: row.id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      return { id: row.id, numberLabel };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
