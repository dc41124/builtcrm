import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { db } from "@/db/client";
import { uploadRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  targetOrganizationId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  expectedFileType: z.string().min(1).max(120),
  dueDate: z.string().datetime().optional(),
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
        "Only contractors can create upload requests",
        "forbidden",
      );
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(uploadRequests)
        .values({
          projectId: ctx.project.id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          requestStatus: "open",
          requestedFromOrganizationId: parsed.data.targetOrganizationId,
          expectedFileType: parsed.data.expectedFileType,
          dueAt: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          createdByUserId: ctx.user.id,
          visibilityScope: "subcontractor_scoped",
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "upload_request",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.requestStatus,
              targetOrganizationId: row.requestedFromOrganizationId,
              title: row.title,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `Upload request: ${row.title}`,
          body: parsed.data.description ?? null,
          relatedObjectType: "upload_request",
          relatedObjectId: row.id,
          visibilityScope: "subcontractor_scoped",
        },
        tx,
      );

      return row;
    });

    await emitNotifications({
      eventId: "upload_request",
      actorUserId: ctx.user.id,
      projectId: ctx.project.id,
      targetOrganizationId: parsed.data.targetOrganizationId,
      relatedObjectType: "upload_request",
      relatedObjectId: result.id,
      vars: {
        title: result.title,
        actorName: ctx.user.displayName ?? ctx.user.email,
      },
    });

    return NextResponse.json({ id: result.id, status: result.requestStatus });
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
