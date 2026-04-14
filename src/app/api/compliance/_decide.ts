import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { complianceRecords } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

type Decision = "accept" | "reject" | "waive";

const BodySchema = z.object({ note: z.string().max(2000).optional() });

const DECISION_MAP = {
  accept: { next: "active" as const, action: "accepted", label: "accepted" },
  reject: { next: "rejected" as const, action: "rejected", label: "rejected" },
  waive: { next: "waived" as const, action: "waived", label: "waived" },
};

export async function handleDecision(
  req: Request,
  id: string,
  decision: Decision,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [record] = await db
      .select()
      .from(complianceRecords)
      .where(eq(complianceRecords.id, id))
      .limit(1);
    if (!record || !record.projectId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      record.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can decide on compliance records",
        "forbidden",
      );
    }

    if (decision === "accept" && record.complianceStatus !== "pending") {
      return NextResponse.json(
        { error: "invalid_state", state: record.complianceStatus },
        { status: 409 },
      );
    }
    if (
      decision === "reject" &&
      record.complianceStatus !== "pending"
    ) {
      return NextResponse.json(
        { error: "invalid_state", state: record.complianceStatus },
        { status: 409 },
      );
    }

    const previousState = record.complianceStatus;
    const { next, action, label } = DECISION_MAP[decision];

    await db.transaction(async (tx) => {
      await tx
        .update(complianceRecords)
        .set({ complianceStatus: next })
        .where(eq(complianceRecords.id, record.id));

      await writeAuditEvent(
        ctx,
        {
          action,
          resourceType: "compliance_record",
          resourceId: record.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: next },
            metadata: { note: parsed.data.note ?? null },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Compliance ${label}: ${record.complianceType}`,
          body: parsed.data.note ?? null,
          relatedObjectType: "compliance_record",
          relatedObjectId: record.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: record.id, status: next });
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
