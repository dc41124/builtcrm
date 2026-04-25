import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  closeoutPackageItems,
  closeoutPackageSections,
  closeoutPackages,
  projects,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { formatCloseoutNumber } from "@/domain/loaders/closeout-packages";
import { notifyCloseoutDelivered } from "@/lib/closeout-packages/notify";

// POST /api/closeout-packages/:id/deliver — transition. The payload
// says which target state the contractor intends:
//   "review"    building → review     (internal QA; no client notification)
//   "delivered" building|review → delivered (client notified; package locks)
//
// Pre-flight: at least one item across all sections — we do not send
// empty packages.

const BodySchema = z.object({
  to: z.enum(["review", "delivered"]),
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
  const target = parsed.data.to;

  try {
    const [head] = await db
      .select({
        id: closeoutPackages.id,
        projectId: closeoutPackages.projectId,
        status: closeoutPackages.status,
        title: closeoutPackages.title,
        sequenceYear: closeoutPackages.sequenceYear,
        sequenceNumber: closeoutPackages.sequenceNumber,
      })
      .from(closeoutPackages)
      .where(eq(closeoutPackages.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("forbidden", "forbidden");
    }

    // Legal transitions.
    const ok =
      (target === "review" && head.status === "building") ||
      (target === "delivered" &&
        (head.status === "building" || head.status === "review"));
    if (!ok) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot move ${head.status} → ${target}`,
        },
        { status: 409 },
      );
    }

    // Empty-package guard.
    const [itemCount] = await db
      .select({ n: sql<number>`count(${closeoutPackageItems.id})::int` })
      .from(closeoutPackageItems)
      .innerJoin(
        closeoutPackageSections,
        eq(closeoutPackageSections.id, closeoutPackageItems.sectionId),
      )
      .where(eq(closeoutPackageSections.packageId, id));
    if ((itemCount?.n ?? 0) === 0) {
      return NextResponse.json(
        { error: "empty_package", message: "Add at least one document before moving forward." },
        { status: 400 },
      );
    }

    const numberLabel = formatCloseoutNumber(
      head.sequenceYear,
      head.sequenceNumber,
    );

    const [projectRow] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, head.projectId))
      .limit(1);

    await db.transaction(async (tx) => {
      if (target === "review") {
        await tx
          .update(closeoutPackages)
          .set({ status: "review", updatedAt: new Date() })
          .where(eq(closeoutPackages.id, id));
        await writeAuditEvent(
          ctx,
          {
            action: "moved_to_review",
            resourceType: "closeout_package",
            resourceId: id,
            details: {
              previousState: { status: head.status },
              nextState: { status: "review" },
            },
          },
          tx,
        );
        await writeActivityFeedItem(
          ctx,
          {
            activityType: "project_update",
            summary: `${numberLabel}: moved to internal review`,
            body: null,
            relatedObjectType: "closeout_package",
            relatedObjectId: id,
            visibilityScope: "internal_only",
          },
          tx,
        );
        return;
      }

      // target === "delivered"
      const now = new Date();
      await tx
        .update(closeoutPackages)
        .set({
          status: "delivered",
          deliveredAt: now,
          deliveredByUserId: ctx.user.id,
          updatedAt: now,
        })
        .where(eq(closeoutPackages.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "delivered",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            previousState: { status: head.status },
            nextState: { status: "delivered", deliveredAt: now.toISOString() },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${numberLabel}: delivered to client`,
          body: head.title,
          relatedObjectType: "closeout_package",
          relatedObjectId: id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      await notifyCloseoutDelivered(tx, {
        projectId: head.projectId,
        packageId: id,
        numberLabel,
        projectName: projectRow?.name ?? "your project",
        actorUserId: ctx.user.id,
        actorName: ctx.user.displayName,
      });
    });

    return NextResponse.json({ ok: true, status: target, numberLabel });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
