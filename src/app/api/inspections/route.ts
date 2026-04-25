import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  type InspectionLineItemDef,
  inspectionTemplates,
  inspections,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/inspections — contractor creates an inspection from a template
// and assigns it to a sub org. Captures a snapshot of the template's
// line items at create time (template_snapshot_json) so later template
// edits don't rewrite historical checklists.

const BodySchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  zone: z.string().min(1).max(80),
  assignedOrgId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
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
        "Only contractors can create inspections",
        "forbidden",
      );
    }

    // Template must belong to the viewer's contractor org.
    const [tpl] = await db
      .select({
        id: inspectionTemplates.id,
        orgId: inspectionTemplates.orgId,
        lineItemsJson: inspectionTemplates.lineItemsJson,
        isArchived: inspectionTemplates.isArchived,
      })
      .from(inspectionTemplates)
      .where(eq(inspectionTemplates.id, input.templateId))
      .limit(1);
    if (!tpl || tpl.orgId !== ctx.organization.id || tpl.isArchived) {
      throw new AuthorizationError(
        "Template not available to this org",
        "not_found",
      );
    }

    const snapshot = (tpl.lineItemsJson as InspectionLineItemDef[]) ?? [];

    const result = await db.transaction(async (tx) => {
      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${inspections.sequentialNumber}), 0) + 1`,
        })
        .from(inspections)
        .where(eq(inspections.projectId, input.projectId));

      const [row] = await tx
        .insert(inspections)
        .values({
          projectId: input.projectId,
          sequentialNumber: nextNumber,
          templateId: input.templateId,
          templateSnapshotJson: snapshot,
          zone: input.zone,
          assignedOrgId: input.assignedOrgId ?? null,
          assignedUserId: input.assignedUserId ?? null,
          scheduledDate: input.scheduledDate ?? null,
          status: "scheduled",
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "inspection",
          resourceId: row.id,
          details: {
            nextState: {
              sequentialNumber: row.sequentialNumber,
              templateId: row.templateId,
              assignedOrgId: row.assignedOrgId,
              scheduledDate: row.scheduledDate,
              itemCount: snapshot.length,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `INS-${String(row.sequentialNumber).padStart(4, "0")}: ${input.zone}`,
          body: `Inspection scheduled from template`,
          relatedObjectType: "inspection",
          relatedObjectId: row.id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      sequentialNumber: result.sequentialNumber,
      status: result.status,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
