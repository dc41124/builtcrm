import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { activityFeedItems, auditEvents, uploadRequests } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  targetOrganizationId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  expectedFileType: z.string().min(1).max(120),
  dueDate: z.string().datetime().optional(),
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

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        projectId: ctx.project.id,
        organizationId: ctx.organization.id,
        objectType: "upload_request",
        objectId: row.id,
        actionName: "created",
        nextState: {
          status: row.requestStatus,
          targetOrganizationId: row.requestedFromOrganizationId,
          title: row.title,
        },
      });

      await tx.insert(activityFeedItems).values({
        projectId: ctx.project.id,
        actorUserId: ctx.user.id,
        activityType: "approval_requested",
        surfaceType: "feed_item",
        title: `Upload request: ${row.title}`,
        body: parsed.data.description ?? null,
        relatedObjectType: "upload_request",
        relatedObjectId: row.id,
        visibilityScope: "subcontractor_scoped",
      });

      return row;
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
