import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { approvals } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({ note: z.string().max(2000).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
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
      session,
      apv.projectId,
    );
    if (
      ctx.role !== "commercial_client" &&
      ctx.role !== "residential_client"
    ) {
      throw new AuthorizationError(
        "Only the client can approve approvals",
        "forbidden",
      );
    }

    if (apv.approvalStatus !== "pending_review") {
      return NextResponse.json(
        { error: "invalid_state", state: apv.approvalStatus },
        { status: 409 },
      );
    }

    const previousState = apv.approvalStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(approvals)
        .set({
          approvalStatus: "approved",
          decidedAt: new Date(),
          decidedByUserId: ctx.user.id,
          decisionNote: parsed.data.note ?? null,
        })
        .where(eq(approvals.id, apv.id));

      await writeAuditEvent(
        ctx,
        {
          action: "approved",
          resourceType: "approval",
          resourceId: apv.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "approved" },
            metadata: {
              impactCostCents: apv.impactCostCents,
              impactScheduleDays: apv.impactScheduleDays,
              note: parsed.data.note ?? null,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_completed",
          summary: `APV-${String(apv.approvalNumber).padStart(3, "0")} approved: ${apv.title}`,
          relatedObjectType: "approval",
          relatedObjectId: apv.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: apv.id, status: "approved" });
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
