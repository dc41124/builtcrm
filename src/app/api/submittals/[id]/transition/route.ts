import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { submittalDocuments, submittals } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";
import {
  isTransitionAllowed,
  formatNumber,
  type ActorRole,
  type SubmittalStatus,
} from "@/lib/submittals/config";

// POST /api/submittals/[id]/transition
//
// Drives the submittal state machine.
//  - Validates (fromStatus, actorRole, toStatus) against
//    ALLOWED_TRANSITIONS in lib/submittals/config.ts
//  - `rejected` requires a rejectionReason.
//  - `submitted` stamps submittedAt; reviewer-response statuses stamp
//    returnedAt (action-layer convenience for the UI).
//  - Emits submittal_submitted when sub (or GC) moves draft→submitted so
//    GC staff see it in their inbox.

const BodySchema = z.object({
  to: z.enum([
    "submitted",
    "under_review",
    "returned_approved",
    "returned_as_noted",
    "revise_resubmit",
    "rejected",
    "closed",
  ]),
  rejectionReason: z.string().min(1).max(4000).optional(),
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
    const [current] = await db
      .select({
        id: submittals.id,
        projectId: submittals.projectId,
        sequentialNumber: submittals.sequentialNumber,
        title: submittals.title,
        status: submittals.status,
        submittedByOrgId: submittals.submittedByOrgId,
      })
      .from(submittals)
      .where(eq(submittals.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      current.projectId,
    );

    let actorRole: ActorRole;
    if (ctx.role === "contractor_admin" || ctx.role === "contractor_pm") {
      actorRole = "contractor";
    } else if (ctx.role === "subcontractor_user") {
      actorRole = "subcontractor";
      // Sub can only transition submittals from their own org.
      if (current.submittedByOrgId !== ctx.organization.id) {
        throw new AuthorizationError(
          "Submittal is from another org",
          "forbidden",
        );
      }
    } else {
      throw new AuthorizationError(
        "Clients cannot transition submittals",
        "forbidden",
      );
    }

    const from = current.status as SubmittalStatus;
    const to = input.to;
    if (!isTransitionAllowed(from, to, actorRole)) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `${actorRole} cannot move submittal from ${from} to ${to}`,
        },
        { status: 409 },
      );
    }

    if (to === "rejected" && !input.rejectionReason) {
      return NextResponse.json(
        { error: "missing_reason", message: "rejectionReason is required" },
        { status: 400 },
      );
    }

    // draft → submitted requires at least one attached package document.
    // A submittal with no package is meaningless; enforce here so a
    // misconfigured client can't skip the UI guard.
    if (from === "draft" && to === "submitted") {
      const [{ packageCount }] = await db
        .select({
          packageCount: sql<number>`count(*)::int`,
        })
        .from(submittalDocuments)
        .where(
          and(
            eq(submittalDocuments.submittalId, id),
            eq(submittalDocuments.role, "package"),
          ),
        );
      if (packageCount === 0) {
        return NextResponse.json(
          {
            error: "missing_package",
            message:
              "Attach at least one package document before submitting.",
          },
          { status: 409 },
        );
      }
    }

    const now = new Date();
    const actorName = ctx.user.displayName ?? ctx.user.email;

    await db.transaction(async (tx) => {
      const patch: Partial<typeof submittals.$inferInsert> = {
        status: to,
        lastTransitionAt: now,
      };
      if (to === "submitted") patch.submittedAt = now;
      if (
        to === "returned_approved" ||
        to === "returned_as_noted" ||
        to === "revise_resubmit" ||
        to === "rejected"
      ) {
        patch.returnedAt = now;
      }
      if (to === "rejected") {
        patch.rejectionReason = input.rejectionReason ?? null;
      }

      await tx.update(submittals).set(patch).where(eq(submittals.id, id));

      // Step 22 pin: when a submittal reaches a reviewer-decided
      // state (or closed), freeze the linked package/stamp/comments
      // documents at their current versions. Downstream UIs honour
      // the pin by displaying the specific linked doc rather than
      // walking forward to the chain head — critical for legal
      // integrity on approved submittals.
      const isTerminalForPin =
        to === "returned_approved" ||
        to === "returned_as_noted" ||
        to === "revise_resubmit" ||
        to === "rejected" ||
        to === "closed";
      if (isTerminalForPin) {
        await tx
          .update(submittalDocuments)
          .set({ pinVersion: true })
          .where(eq(submittalDocuments.submittalId, id));
      }

      await writeAuditEvent(
        ctx,
        {
          action: `transitioned_to_${to}`,
          resourceType: "submittal",
          resourceId: id,
          details: {
            previousState: { status: from },
            nextState: { status: to },
            metadata: {
              rejectionReason: input.rejectionReason ?? null,
            },
          },
        },
        tx,
      );
    });

    // Post-txn notifications. One fire path for Step 20:
    // draft→submitted notifies GC staff on the project.
    const number = formatNumber(current.sequentialNumber);
    if (to === "submitted") {
      await emitNotifications({
        eventId: "submittal_submitted",
        actorUserId: ctx.user.id,
        projectId: current.projectId,
        relatedObjectType: "submittal",
        relatedObjectId: id,
        vars: {
          number,
          title: current.title,
          actorName,
        },
      });
    }

    return NextResponse.json({ id, newStatus: to });
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
