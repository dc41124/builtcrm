import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { punchItems } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

// POST /api/punch-items — create a new punch-list item.
//
// Authorization: contractor only. Subs cannot create items per the
// Step 19 auth matrix. The sequentialNumber is computed inside the
// transaction as max+1 to avoid concurrent-insert races; the unique
// index on (projectId, sequentialNumber) will still reject a colliding
// duplicate, which the client can retry.
//
// On successful create, emits `punch_item_assigned` if an assigneeOrg
// is set so the sub org's members get notified.

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(10000),
  location: z.string().max(2000).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assigneeOrgId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  clientFacingNote: z.string().max(4000).nullable().optional(),
});

export async function POST(req: Request) {
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
  const input = parsed.data;

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      input.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create punch items",
        "forbidden",
      );
    }

    const result = await db.transaction(async (tx) => {
      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${punchItems.sequentialNumber}), 0) + 1`,
        })
        .from(punchItems)
        .where(eq(punchItems.projectId, input.projectId));

      const [row] = await tx
        .insert(punchItems)
        .values({
          projectId: input.projectId,
          sequentialNumber: nextNumber,
          title: input.title,
          description: input.description,
          location: input.location ?? null,
          priority: input.priority,
          status: "open",
          assigneeOrgId: input.assigneeOrgId ?? null,
          assigneeUserId: input.assigneeUserId ?? null,
          dueDate: input.dueDate ?? null,
          createdByUserId: ctx.user.id,
          clientFacingNote: input.clientFacingNote ?? null,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "punch_item",
          resourceId: row.id,
          details: {
            nextState: {
              sequentialNumber: row.sequentialNumber,
              status: row.status,
              priority: row.priority,
              assigneeOrgId: row.assigneeOrgId,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `PI-${String(row.sequentialNumber).padStart(3, "0")}: ${row.title}`,
          body: row.description,
          relatedObjectType: "punch_item",
          relatedObjectId: row.id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      return row;
    });

    if (result.assigneeOrgId) {
      await emitNotifications({
        eventId: "punch_item_assigned",
        actorUserId: ctx.user.id,
        projectId: input.projectId,
        targetOrganizationId: result.assigneeOrgId,
        relatedObjectType: "punch_item",
        relatedObjectId: result.id,
        vars: {
          number: `PI-${String(result.sequentialNumber).padStart(3, "0")}`,
          title: result.title,
          actorName: ctx.user.displayName ?? ctx.user.email,
        },
      });
    }

    return NextResponse.json({
      id: result.id,
      sequentialNumber: result.sequentialNumber,
      status: result.status,
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
