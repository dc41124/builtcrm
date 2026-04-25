import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { milestones } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import {
  MILESTONE_TYPE_VALUES,
  MILESTONE_VISIBILITY_VALUES,
} from "@/domain/loaders/schedule";
import { AuthorizationError, assertCan } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  milestoneType: z.enum(MILESTONE_TYPE_VALUES).default("custom"),
  scheduledDate: z.string().datetime(),
  phase: z.string().max(60).optional(),
  visibilityScope: z.enum(MILESTONE_VISIBILITY_VALUES).default("project_wide"),
  assignedToUserId: z.string().uuid().optional(),
  assignedToOrganizationId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
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

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      parsed.data.projectId,
    );
    assertCan(ctx.permissions, "milestone", "write");

    const [row] = await db
      .insert(milestones)
      .values({
        projectId: ctx.project.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        milestoneType: parsed.data.milestoneType,
        milestoneStatus: "scheduled",
        kind: "marker",
        scheduledDate: new Date(parsed.data.scheduledDate),
        phase: parsed.data.phase ?? null,
        visibilityScope: parsed.data.visibilityScope,
        assignedToUserId: parsed.data.assignedToUserId ?? null,
        assignedToOrganizationId: parsed.data.assignedToOrganizationId ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();

    await writeAuditEvent(ctx, {
      action: "created",
      resourceType: "milestone",
      resourceId: row.id,
      details: {
        nextState: {
          title: row.title,
          milestoneType: row.milestoneType,
          milestoneStatus: row.milestoneStatus,
          scheduledDate: row.scheduledDate.toISOString(),
          phase: row.phase,
          visibilityScope: row.visibilityScope,
          assignedToUserId: row.assignedToUserId,
          assignedToOrganizationId: row.assignedToOrganizationId,
        },
      },
    });

    return NextResponse.json({ id: row.id });
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
