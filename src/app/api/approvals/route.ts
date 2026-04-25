import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { approvals } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  category: z
    .enum(["general", "design", "procurement", "change_order", "other"])
    .optional(),
  impactCostCents: z.number().int().optional(),
  impactScheduleDays: z.number().int().optional(),
  assignedToOrganizationId: z.string().uuid().optional(),
  relatedObjectType: z.string().max(120).optional(),
  relatedObjectId: z.string().uuid().optional(),
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
        "Only contractors can create approvals",
        "forbidden",
      );
    }

    const result = await db.transaction(async (tx) => {
      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${approvals.approvalNumber}), 0) + 1`,
        })
        .from(approvals)
        .where(eq(approvals.projectId, ctx.project.id));

      const [row] = await tx
        .insert(approvals)
        .values({
          projectId: ctx.project.id,
          approvalNumber: nextNumber,
          category: parsed.data.category ?? "general",
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          impactCostCents: parsed.data.impactCostCents ?? 0,
          impactScheduleDays: parsed.data.impactScheduleDays ?? 0,
          requestedByUserId: ctx.user.id,
          assignedToOrganizationId: parsed.data.assignedToOrganizationId ?? null,
          relatedObjectType: parsed.data.relatedObjectType ?? null,
          relatedObjectId: parsed.data.relatedObjectId ?? null,
          approvalStatus: "draft",
          visibilityScope: "client_visible",
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "approval",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.approvalStatus,
              approvalNumber: row.approvalNumber,
              title: row.title,
              category: row.category,
              impactCostCents: row.impactCostCents,
              impactScheduleDays: row.impactScheduleDays,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `APV-${String(row.approvalNumber).padStart(3, "0")}: ${row.title}`,
          body: parsed.data.description ?? null,
          relatedObjectType: "approval",
          relatedObjectId: row.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      approvalNumber: result.approvalNumber,
      status: result.approvalStatus,
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
