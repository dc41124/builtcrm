import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { rfis } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

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
    // Entry-point dbAdmin: tenant unknown until we resolve project
    // from the RFI row. Slice 3 pattern.
    const [rfi] = await dbAdmin.select().from(rfis).where(eq(rfis.id, id)).limit(1);
    if (!rfi) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      rfi.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can reopen RFIs",
        "forbidden",
      );
    }

    if (rfi.rfiStatus !== "answered" && rfi.rfiStatus !== "closed") {
      return NextResponse.json(
        { error: "invalid_state", state: rfi.rfiStatus },
        { status: 409 },
      );
    }

    const previousState = rfi.rfiStatus;

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(rfis)
        .set({ rfiStatus: "open", respondedAt: null, closedAt: null })
        .where(eq(rfis.id, rfi.id));

      await writeAuditEvent(
        ctx,
        {
          action: "reopened",
          resourceType: "rfi",
          resourceId: rfi.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "open" },
            metadata: { reason: parsed.data.reason ?? null },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `RFI-${String(rfi.sequentialNumber).padStart(3, "0")} reopened: ${rfi.subject}`,
          body: parsed.data.reason ?? null,
          relatedObjectType: "rfi",
          relatedObjectId: rfi.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: rfi.id, status: "open" });
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
