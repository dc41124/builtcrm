import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { rfis } from "@/db/schema";
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
    const [rfi] = await db.select().from(rfis).where(eq(rfis.id, id)).limit(1);
    if (!rfi) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      rfi.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("Only contractors can close RFIs", "forbidden");
    }

    if (rfi.rfiStatus !== "answered" && rfi.rfiStatus !== "open") {
      return NextResponse.json(
        { error: "invalid_state", state: rfi.rfiStatus },
        { status: 409 },
      );
    }

    const previousState = rfi.rfiStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(rfis)
        .set({ rfiStatus: "closed", closedAt: new Date() })
        .where(eq(rfis.id, rfi.id));

      await writeAuditEvent(
        ctx,
        {
          action: "closed",
          resourceType: "rfi",
          resourceId: rfi.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "closed" },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_completed",
          summary: `RFI-${String(rfi.sequentialNumber).padStart(3, "0")} closed: ${rfi.subject}`,
          relatedObjectType: "rfi",
          relatedObjectId: rfi.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: rfi.id, status: "closed" });
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
