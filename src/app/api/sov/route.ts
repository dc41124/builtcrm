import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { scheduleOfValues } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  defaultRetainagePercent: z.number().int().min(0).max(100).optional(),
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
        "Only contractors can create a Schedule of Values",
        "forbidden",
      );
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: scheduleOfValues.id })
        .from(scheduleOfValues)
        .where(
          and(
            eq(scheduleOfValues.projectId, ctx.project.id),
            inArray(scheduleOfValues.sovStatus, ["draft", "active"]),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        throw new AuthorizationError(
          "A draft or active SOV already exists for this project",
          "forbidden",
        );
      }

      const [row] = await tx
        .insert(scheduleOfValues)
        .values({
          projectId: ctx.project.id,
          version: 1,
          sovStatus: "draft",
          defaultRetainagePercent: parsed.data.defaultRetainagePercent ?? 10,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "schedule_of_values",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.sovStatus,
              defaultRetainagePercent: row.defaultRetainagePercent,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Schedule of Values created (v${row.version})`,
          relatedObjectType: "schedule_of_values",
          relatedObjectId: row.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      status: result.sovStatus,
      version: result.version,
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
