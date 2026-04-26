import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { punchItemComments, punchItems } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  isTransitionAllowed,
  systemCommentBody,
  type ActorRole,
  type PunchStatus,
} from "@/lib/punch-list/config";
import { emitNotifications } from "@/lib/notifications/emit";

// POST /api/punch-items/[id]/transition
//
// Drives the punch-item state machine. Validates (fromStatus, actorRole,
// toStatus) against the ALLOWED_TRANSITIONS table. Enforces required
// reasons for `rejected` and `void`. Auto-clears `rejectionReason` when
// transitioning `rejected → in_progress`. Stamps `verifiedByUserId` and
// `verifiedAt` on `ready_to_verify → verified`.
//
// Every successful transition writes a row to punch_item_comments with
// isSystem=true using the locked phrasing from
// src/lib/punch-list/config.ts. Emits the appropriate notification
// event (assigneeOrg for verified/rejected, contractor for
// ready_to_verify).

const BodySchema = z.object({
  to: z.enum([
    "in_progress",
    "ready_to_verify",
    "verified",
    "rejected",
    "void",
  ]),
  rejectionReason: z.string().min(1).max(4000).optional(),
  voidReason: z.string().min(1).max(4000).optional(),
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
  const input = parsed.data;

  try {
    // Pre-tenant head lookup: tenant unknown until project resolves.
    const [current] = await dbAdmin
      .select({
        id: punchItems.id,
        projectId: punchItems.projectId,
        sequentialNumber: punchItems.sequentialNumber,
        title: punchItems.title,
        status: punchItems.status,
        assigneeOrgId: punchItems.assigneeOrgId,
      })
      .from(punchItems)
      .where(eq(punchItems.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      current.projectId,
    );

    // Role → ActorRole (bucketed for the transition table).
    let actorRole: ActorRole;
    if (ctx.role === "contractor_admin" || ctx.role === "contractor_pm") {
      actorRole = "contractor";
    } else if (ctx.role === "subcontractor_user") {
      actorRole = "subcontractor";
      // Sub must be assigned to the item's assignee org.
      if (
        !current.assigneeOrgId ||
        current.assigneeOrgId !== ctx.organization.id
      ) {
        throw new AuthorizationError(
          "Not assigned to your organization",
          "forbidden",
        );
      }
    } else {
      throw new AuthorizationError(
        "Clients cannot transition punch items",
        "forbidden",
      );
    }

    const from = current.status as PunchStatus;
    const to = input.to;
    if (!isTransitionAllowed(from, to, actorRole)) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `${actorRole} cannot move item from ${from} to ${to}`,
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
    if (to === "void" && !input.voidReason) {
      return NextResponse.json(
        { error: "missing_reason", message: "voidReason is required" },
        { status: 400 },
      );
    }

    const now = new Date();
    const actorName = ctx.user.displayName ?? ctx.user.email;

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const patch: Partial<typeof punchItems.$inferInsert> = {
        status: to,
        lastTransitionAt: now,
      };
      // On rejected → in_progress, clear the stale reason so the next
      // review cycle starts fresh.
      if (to === "in_progress" && from === "rejected") {
        patch.rejectionReason = null;
      }
      if (to === "rejected") {
        patch.rejectionReason = input.rejectionReason ?? null;
      }
      if (to === "void") {
        patch.voidReason = input.voidReason ?? null;
      }
      if (to === "verified") {
        patch.verifiedByUserId = ctx.user.id;
        patch.verifiedAt = now;
      }

      await tx.update(punchItems).set(patch).where(eq(punchItems.id, id));

      // Auto-post system comment with locked phrasing.
      await tx.insert(punchItemComments).values({
        punchItemId: id,
        authorUserId: null,
        body: systemCommentBody({
          actorName,
          toStatus: to,
          rejectionReason: input.rejectionReason,
          voidReason: input.voidReason,
        }),
        isSystem: true,
      });

      await writeAuditEvent(
        ctx,
        {
          action: `transitioned_to_${to}`,
          resourceType: "punch_item",
          resourceId: id,
          details: {
            previousState: { status: from },
            nextState: { status: to },
            metadata: {
              rejectionReason: input.rejectionReason ?? null,
              voidReason: input.voidReason ?? null,
            },
          },
        },
        tx,
      );

      return { id, newStatus: to };
    });

    // Notifications fire post-txn. Non-blocking; failures are swallowed
    // by emitNotifications so the transition stays durable.
    const number = `PI-${String(current.sequentialNumber).padStart(3, "0")}`;
    const base = {
      actorUserId: ctx.user.id,
      projectId: current.projectId,
      relatedObjectType: "punch_item",
      relatedObjectId: id,
      vars: {
        number,
        title: current.title,
        actorName,
      },
    };
    if (to === "ready_to_verify") {
      await emitNotifications({ ...base, eventId: "punch_item_ready_to_verify" });
    } else if (to === "verified" && current.assigneeOrgId) {
      await emitNotifications({
        ...base,
        eventId: "punch_item_verified",
        targetOrganizationId: current.assigneeOrgId,
      });
    } else if (to === "rejected" && current.assigneeOrgId) {
      await emitNotifications({
        ...base,
        eventId: "punch_item_rejected",
        targetOrganizationId: current.assigneeOrgId,
        vars: {
          ...base.vars,
          reason: input.rejectionReason ?? "",
        },
      });
    }

    return NextResponse.json(result);
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
