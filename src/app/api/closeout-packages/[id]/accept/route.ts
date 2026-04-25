import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { closeoutPackages, projects } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { formatCloseoutNumber } from "@/domain/loaders/closeout-packages";
import { notifyCloseoutAccepted } from "@/lib/closeout-packages/notify";

// POST /api/closeout-packages/:id/accept — client-only click-wrap.
// Transitions: delivered → accepted. Side effects inside the same txn:
//   - flip projects.project_status = 'closed'
//   - set projects.actual_completion_date = now
//   - write audit events (package acceptance + project close)
//   - emit closeout_package_accepted to contractor staff

const BodySchema = z.object({
  acceptedSigner: z.string().min(1).max(160),
  acceptanceNote: z.string().max(4000).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const input = parsed.data;

  try {
    const [head] = await db
      .select({
        id: closeoutPackages.id,
        projectId: closeoutPackages.projectId,
        status: closeoutPackages.status,
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
      session.session as unknown as { appUserId?: string | null },
      head.projectId,
    );
    if (
      ctx.role !== "commercial_client" &&
      ctx.role !== "residential_client"
    ) {
      throw new AuthorizationError(
        "Only the client can accept the package",
        "forbidden",
      );
    }
    if (head.status !== "delivered") {
      return NextResponse.json(
        { error: "invalid_transition", message: "Package is not awaiting acceptance" },
        { status: 409 },
      );
    }

    const numberLabel = formatCloseoutNumber(
      head.sequenceYear,
      head.sequenceNumber,
    );

    await db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .update(closeoutPackages)
        .set({
          status: "accepted",
          acceptedAt: now,
          acceptedByUserId: ctx.user.id,
          acceptedSigner: input.acceptedSigner,
          acceptanceNote: input.acceptanceNote ?? null,
          updatedAt: now,
        })
        .where(eq(closeoutPackages.id, id));

      // Flip project to closed.
      await tx
        .update(projects)
        .set({
          projectStatus: "closed",
          actualCompletionDate: now,
        })
        .where(eq(projects.id, head.projectId));

      await writeAuditEvent(
        ctx,
        {
          action: "accepted",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            previousState: { status: "delivered" },
            nextState: {
              status: "accepted",
              acceptedSigner: input.acceptedSigner,
              hasNote: !!input.acceptanceNote,
            },
          },
        },
        tx,
      );

      await writeAuditEvent(
        ctx,
        {
          action: "project_closed",
          resourceType: "project",
          resourceId: head.projectId,
          details: {
            metadata: {
              via: "closeout_package_acceptance",
              closeoutPackageId: id,
              number: numberLabel,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${numberLabel}: accepted by ${input.acceptedSigner}`,
          body: input.acceptanceNote ?? null,
          relatedObjectType: "closeout_package",
          relatedObjectId: id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      await notifyCloseoutAccepted(tx, {
        projectId: head.projectId,
        packageId: id,
        numberLabel,
        actorUserId: ctx.user.id,
        actorName: input.acceptedSigner,
      });
    });

    return NextResponse.json({ ok: true });
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
