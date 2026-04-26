import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import { rfis } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  subject: z.string().min(1).max(255),
  body: z.string().max(10000).optional(),
  rfiType: z.enum(["formal", "issue"]).default("issue"),
  assignedToOrganizationId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  drawingReference: z.string().max(255).optional(),
  specificationReference: z.string().max(255).optional(),
  locationDescription: z.string().max(2000).optional(),
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

  if (!parsed.data.assignedToOrganizationId && !parsed.data.assignedToUserId) {
    return NextResponse.json(
      { error: "invalid_body", message: "Must assign to a user or organization" },
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
        "Only contractors can create RFIs",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Compute next sequential number per project. Unique index on
      // (project_id, sequential_number) will reject collisions from
      // concurrent inserts and surface as a 500 — acceptable for a
      // rare race in this minimal slice.
      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${rfis.sequentialNumber}), 0) + 1`,
        })
        .from(rfis)
        .where(eq(rfis.projectId, ctx.project.id));

      const [row] = await tx
        .insert(rfis)
        .values({
          projectId: ctx.project.id,
          sequentialNumber: nextNumber,
          subject: parsed.data.subject,
          body: parsed.data.body ?? null,
          rfiStatus: "open",
          rfiType: parsed.data.rfiType,
          createdByUserId: ctx.user.id,
          assignedToOrganizationId: parsed.data.assignedToOrganizationId ?? null,
          assignedToUserId: parsed.data.assignedToUserId ?? null,
          dueAt: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          drawingReference: parsed.data.drawingReference ?? null,
          specificationReference: parsed.data.specificationReference ?? null,
          locationDescription: parsed.data.locationDescription ?? null,
          visibilityScope: "project_wide",
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "rfi",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.rfiStatus,
              sequentialNumber: row.sequentialNumber,
              subject: row.subject,
              assignedToOrganizationId: row.assignedToOrganizationId,
              assignedToUserId: row.assignedToUserId,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `RFI-${String(row.sequentialNumber).padStart(3, "0")}: ${row.subject}`,
          body: parsed.data.body ?? null,
          relatedObjectType: "rfi",
          relatedObjectId: row.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return row;
    });

    const rfiVars = {
      title: `RFI-${String(result.sequentialNumber).padStart(3, "0")}: ${result.subject}`,
      actorName: ctx.user.displayName ?? ctx.user.email,
    };
    const emitBase = {
      actorUserId: ctx.user.id,
      projectId: ctx.project.id,
      relatedObjectType: "rfi",
      relatedObjectId: result.id,
      vars: rfiVars,
    };
    await Promise.all([
      emitNotifications({ ...emitBase, eventId: "rfi_new" }),
      emitNotifications({
        ...emitBase,
        eventId: "rfi_assigned",
        targetOrganizationId:
          parsed.data.assignedToOrganizationId ?? undefined,
      }),
    ]);

    return NextResponse.json({
      id: result.id,
      sequentialNumber: result.sequentialNumber,
      status: result.rfiStatus,
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
