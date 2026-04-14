import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { approvals } from "@/db/schema";
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
    const [apv] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .limit(1);
    if (!apv) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      apv.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can submit approvals",
        "forbidden",
      );
    }

    if (
      apv.approvalStatus !== "draft" &&
      apv.approvalStatus !== "needs_revision"
    ) {
      return NextResponse.json(
        { error: "invalid_state", state: apv.approvalStatus },
        { status: 409 },
      );
    }

    const previousState = apv.approvalStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(approvals)
        .set({ approvalStatus: "pending_review", submittedAt: new Date() })
        .where(eq(approvals.id, apv.id));

      await writeAuditEvent(
        ctx,
        {
          action: "submitted",
          resourceType: "approval",
          resourceId: apv.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "pending_review" },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `APV-${String(apv.approvalNumber).padStart(3, "0")} submitted for review: ${apv.title}`,
          relatedObjectType: "approval",
          relatedObjectId: apv.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: apv.id, status: "pending_review" });
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
