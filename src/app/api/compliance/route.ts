import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { complianceRecords } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
  complianceType: z.string().min(1).max(120),
  expiresAt: z.string().datetime().optional(),
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
    const ctx = await getEffectiveContext(
      session,
      parsed.data.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create compliance requirements",
        "forbidden",
      );
    }

    // Contractor creates a compliance requirement on their project for
    // a sub. Contractor's GUC -> multi-org policy clause B (project
    // ownership) authorises the INSERT (the row's organizationId may
    // be the sub's org, not the contractor's).
    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .insert(complianceRecords)
        .values({
          projectId: ctx.project.id,
          organizationId: parsed.data.organizationId,
          complianceType: parsed.data.complianceType,
          complianceStatus: "pending",
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "compliance_record",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.complianceStatus,
              complianceType: row.complianceType,
              organizationId: row.organizationId,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Compliance requirement requested: ${row.complianceType}`,
          relatedObjectType: "compliance_record",
          relatedObjectId: row.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      status: result.complianceStatus,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
