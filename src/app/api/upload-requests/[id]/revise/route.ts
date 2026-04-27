import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { uploadRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  note: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Entry-point dbAdmin: tenant unknown until projectId resolved.
    const [request] = await dbAdmin
      .select()
      .from(uploadRequests)
      .where(eq(uploadRequests.id, id))
      .limit(1);
    if (!request) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      request.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can request revisions",
        "forbidden",
      );
    }
    if (request.requestStatus !== "submitted") {
      return NextResponse.json(
        { error: "invalid_state", state: request.requestStatus },
        { status: 409 },
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(uploadRequests)
        .set({
          requestStatus: "revision_requested",
          revisionNote: parsed.data.note,
        })
        .where(eq(uploadRequests.id, request.id));

      await writeAuditEvent(
        ctx,
        {
          action: "revision_requested",
          resourceType: "upload_request",
          resourceId: request.id,
          details: {
            previousState: { status: "submitted" },
            nextState: {
              status: "revision_requested",
              note: parsed.data.note,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `Revision requested: ${request.title}`,
          body: parsed.data.note,
          relatedObjectType: "upload_request",
          relatedObjectId: request.id,
          visibilityScope: "subcontractor_scoped",
        },
        tx,
      );
    });

    return NextResponse.json({ id: request.id, status: "revision_requested" });
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
