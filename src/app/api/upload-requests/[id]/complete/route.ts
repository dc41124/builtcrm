import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { uploadRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const [request] = await db
      .select()
      .from(uploadRequests)
      .where(eq(uploadRequests.id, id))
      .limit(1);
    if (!request) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      request.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can complete upload requests",
        "forbidden",
      );
    }
    if (request.requestStatus !== "submitted") {
      return NextResponse.json(
        { error: "invalid_state", state: request.requestStatus },
        { status: 409 },
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(uploadRequests)
        .set({
          requestStatus: "completed",
          completedAt: new Date(),
        })
        .where(eq(uploadRequests.id, request.id));

      await writeAuditEvent(
        ctx,
        {
          action: "completed",
          resourceType: "upload_request",
          resourceId: request.id,
          details: {
            previousState: { status: "submitted" },
            nextState: { status: "completed" },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_completed",
          summary: `Upload accepted: ${request.title}`,
          relatedObjectType: "upload_request",
          relatedObjectId: request.id,
          visibilityScope: "subcontractor_scoped",
        },
        tx,
      );
    });

    return NextResponse.json({ id: request.id, status: "completed" });
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
