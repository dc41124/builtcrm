import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, inArray, not } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  drawRequests,
  lienWaivers,
  projectOrganizationMemberships,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import type { EffectiveContext } from "@/domain/context";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

import {
  consumeUnassignedReleases,
  recomputeDrawHeaderTotals,
  recomputeProjectDraftDraws,
} from "../_totals";

type DrawRow = typeof drawRequests.$inferSelect;
type UpdateValues = Partial<typeof drawRequests.$inferInsert>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type HookArgs = { tx: Tx; draw: DrawRow; ctx: EffectiveContext };

const CONTRACTOR_ROLES = ["contractor_admin", "contractor_pm"] as const;
const CLIENT_ROLES = ["commercial_client", "residential_client"] as const;

type Role = string;

class TransitionBlockedError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TransitionBlockedError";
  }
}

type TransitionRule<TBody> = {
  allowedRoles: readonly Role[];
  fromStates: ReadonlyArray<DrawRow["drawRequestStatus"]>;
  toState: DrawRow["drawRequestStatus"];
  label: string;
  forbiddenMessage: string;
  bodySchema?: z.ZodType<TBody>;
  recomputeTotals?: boolean;
  buildUpdate?: (body: TBody, draw: DrawRow) => UpdateValues;
  precheck?: (args: HookArgs) => Promise<void>;
  afterUpdate?: (args: HookArgs) => Promise<void>;
};

async function ensureWaiversAcceptedForMarkPaid({
  tx,
  draw,
}: HookArgs): Promise<void> {
  const blocking = await tx
    .select({ id: lienWaivers.id, status: lienWaivers.lienWaiverStatus })
    .from(lienWaivers)
    .where(
      and(
        eq(lienWaivers.drawRequestId, draw.id),
        eq(lienWaivers.lienWaiverType, "conditional_progress"),
        not(inArray(lienWaivers.lienWaiverStatus, ["accepted", "waived"])),
      ),
    );
  if (blocking.length > 0) {
    throw new TransitionBlockedError(
      "lien_waiver_required",
      "Conditional lien waiver must be accepted or waived before marking paid",
      409,
      { waiverIds: blocking.map((w) => w.id) },
    );
  }
}

async function lockInRetainageReleases({ tx, draw }: HookArgs): Promise<void> {
  await consumeUnassignedReleases(tx, draw.projectId, draw.id);
  await recomputeDrawHeaderTotals(tx, draw.id);
  await recomputeProjectDraftDraws(tx, draw.projectId, draw.id);
}

// Fan out lien waivers when a draw transitions to submitted (conditional)
// or paid (unconditional). Two waiver tiers per draw:
//
//   1. The contractor's own waiver to the lender — single row, full draw
//      amount, organizationId = contractor's org. Real-world purpose:
//      contractor signs that they've received funds for the period.
//
//   2. Sub waivers — one row per active subcontractor on the project.
//      Each acknowledges the sub has been (will be) paid for their share
//      of the draw period. AMOUNT ALLOCATION: equal split of
//      currentPaymentDueCents across all active subs, rounding remainder
//      assigned to the last sub so totals stay exact. This is a placeholder
//      until a per-sub-per-SOV-line allocation feature lands — when it
//      does, replace `splitAmountAcrossSubs` with the real per-sub sums.
//      No subs on the project → fan-out is a no-op (only contractor
//      waiver lands).
//
// Idempotent via the unique index on (drawRequestId, organizationId,
// lienWaiverType) — re-runs no-op rather than duplicating. Audit event
// `waivers.fanned_out` fires once per call with sub count + per-sub
// amount metadata.

async function createWaiverForDraw(
  args: HookArgs,
  waiverType: "conditional_progress" | "unconditional_progress",
): Promise<void> {
  const { tx, draw, ctx } = args;

  const [fresh] = await tx
    .select({ currentPaymentDueCents: drawRequests.currentPaymentDueCents })
    .from(drawRequests)
    .where(eq(drawRequests.id, draw.id))
    .limit(1);
  const totalAmount =
    fresh?.currentPaymentDueCents ?? draw.currentPaymentDueCents;

  // 1) Contractor's own waiver — full draw amount.
  await tx
    .insert(lienWaivers)
    .values({
      projectId: draw.projectId,
      drawRequestId: draw.id,
      organizationId: ctx.project.contractorOrganizationId,
      lienWaiverType: waiverType,
      lienWaiverStatus: "requested",
      amountCents: totalAmount,
      throughDate: draw.periodTo,
      requestedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        lienWaivers.drawRequestId,
        lienWaivers.organizationId,
        lienWaivers.lienWaiverType,
      ],
    });

  // 2) Per-sub waivers — one per active sub on the project.
  const subRows = await tx
    .select({ organizationId: projectOrganizationMemberships.organizationId })
    .from(projectOrganizationMemberships)
    .where(
      and(
        eq(projectOrganizationMemberships.projectId, draw.projectId),
        eq(projectOrganizationMemberships.membershipType, "subcontractor"),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    );
  const subOrgIds = subRows.map((r) => r.organizationId);

  if (subOrgIds.length === 0 || totalAmount <= 0) {
    return; // contractor waiver only; nothing more to fan out
  }

  const allocations = splitAmountAcrossSubs(totalAmount, subOrgIds.length);
  await tx
    .insert(lienWaivers)
    .values(
      subOrgIds.map((orgId, idx) => ({
        projectId: draw.projectId,
        drawRequestId: draw.id,
        organizationId: orgId,
        lienWaiverType: waiverType,
        lienWaiverStatus: "requested" as const,
        amountCents: allocations[idx],
        throughDate: draw.periodTo,
        requestedAt: new Date(),
      })),
    )
    .onConflictDoNothing({
      target: [
        lienWaivers.drawRequestId,
        lienWaivers.organizationId,
        lienWaivers.lienWaiverType,
      ],
    });

  await writeAuditEvent(
    ctx,
    {
      action: "waivers.fanned_out",
      resourceType: "draw_request",
      resourceId: draw.id,
      details: {
        metadata: {
          waiverType,
          subCount: subOrgIds.length,
          totalAmountCents: totalAmount,
          allocations: subOrgIds.map((orgId, idx) => ({
            organizationId: orgId,
            amountCents: allocations[idx],
          })),
          allocationStrategy: "equal_split_with_rounding_on_last",
        },
      },
    },
    tx,
  );
}

// Splits `total` into `count` parts as evenly as possible, with any
// rounding remainder applied to the last part so the sum equals `total`
// exactly. Returns cents (integers).
function splitAmountAcrossSubs(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const result = new Array<number>(count).fill(base);
  result[count - 1] = total - base * (count - 1);
  return result;
}

export type DrawTransitionKind =
  | "submit"
  | "revise"
  | "start-review"
  | "approve"
  | "approve-with-note"
  | "return"
  | "mark-paid";

const approveNoteBody = z.object({ note: z.string().min(1).max(2000) });
const returnBody = z.object({ reason: z.string().min(1).max(2000) });
const markPaidBody = z.object({ paymentReferenceName: z.string().min(1).max(255) });

const RULES: {
  submit: TransitionRule<Record<string, never>>;
  revise: TransitionRule<Record<string, never>>;
  "start-review": TransitionRule<Record<string, never>>;
  approve: TransitionRule<Record<string, never>>;
  "approve-with-note": TransitionRule<z.infer<typeof approveNoteBody>>;
  return: TransitionRule<z.infer<typeof returnBody>>;
  "mark-paid": TransitionRule<z.infer<typeof markPaidBody>>;
} = {
  submit: {
    allowedRoles: CONTRACTOR_ROLES,
    fromStates: ["draft", "revised"],
    toState: "submitted",
    label: "submitted",
    forbiddenMessage: "Only contractors can submit a draw request",
    recomputeTotals: true,
    buildUpdate: () => ({ submittedAt: new Date() }),
    afterUpdate: (args) => createWaiverForDraw(args, "conditional_progress"),
  },
  revise: {
    allowedRoles: CONTRACTOR_ROLES,
    fromStates: ["returned"],
    toState: "revised",
    label: "reopened for revision",
    forbiddenMessage: "Only contractors can reopen a returned draw",
  },
  "start-review": {
    allowedRoles: CONTRACTOR_ROLES,
    fromStates: ["submitted"],
    toState: "under_review",
    label: "under review",
    forbiddenMessage: "Only contractors can move a draw into review",
  },
  approve: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["under_review"],
    toState: "approved",
    label: "approved",
    forbiddenMessage: "Only the client can approve a draw request",
    buildUpdate: () => ({ reviewedAt: new Date(), reviewNote: null }),
    afterUpdate: lockInRetainageReleases,
  },
  "approve-with-note": {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["under_review"],
    toState: "approved_with_note",
    label: "approved with note",
    forbiddenMessage: "Only the client can approve a draw request",
    bodySchema: approveNoteBody,
    buildUpdate: (body) => ({ reviewedAt: new Date(), reviewNote: body.note }),
    afterUpdate: lockInRetainageReleases,
  },
  return: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["under_review"],
    toState: "returned",
    label: "returned",
    forbiddenMessage: "Only the client can return a draw request",
    bodySchema: returnBody,
    buildUpdate: (body) => ({ returnedAt: new Date(), returnReason: body.reason }),
  },
  "mark-paid": {
    allowedRoles: CONTRACTOR_ROLES,
    fromStates: ["approved", "approved_with_note"],
    toState: "paid",
    label: "marked paid",
    forbiddenMessage: "Only contractors can mark a draw as paid",
    bodySchema: markPaidBody,
    buildUpdate: (body) => ({
      paidAt: new Date(),
      paymentReferenceName: body.paymentReferenceName,
    }),
    precheck: ensureWaiversAcceptedForMarkPaid,
    afterUpdate: (args) => createWaiverForDraw(args, "unconditional_progress"),
  },
};

export async function handleDrawTransition(
  req: Request,
  id: string,
  kind: DrawTransitionKind,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const rule = RULES[kind] as TransitionRule<unknown>;

  let body: unknown = {};
  if (rule.bodySchema) {
    const raw = await req.json().catch(() => null);
    const parsed = rule.bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    body = parsed.data;
  }

  try {
    const [draw] = await db
      .select()
      .from(drawRequests)
      .where(eq(drawRequests.id, id))
      .limit(1);
    if (!draw) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      draw.projectId,
    );
    if (!rule.allowedRoles.includes(ctx.role)) {
      throw new AuthorizationError(rule.forbiddenMessage, "forbidden");
    }

    if (!rule.fromStates.includes(draw.drawRequestStatus)) {
      return NextResponse.json(
        { error: "invalid_state", state: draw.drawRequestStatus },
        { status: 409 },
      );
    }

    const previousState = { status: draw.drawRequestStatus };
    const extraFields = rule.buildUpdate ? rule.buildUpdate(body, draw) : {};
    const isClientDecision =
      kind === "approve" || kind === "approve-with-note" || kind === "return";

    await db.transaction(async (tx) => {
      if (rule.precheck) {
        await rule.precheck({ tx, draw, ctx });
      }
      if (rule.recomputeTotals) {
        await recomputeDrawHeaderTotals(tx, draw.id);
      }
      await tx
        .update(drawRequests)
        .set({
          drawRequestStatus: rule.toState,
          ...(isClientDecision ? { reviewedByUserId: ctx.user.id } : {}),
          ...extraFields,
        })
        .where(eq(drawRequests.id, draw.id));

      if (rule.afterUpdate) {
        await rule.afterUpdate({ tx, draw, ctx });
      }

      await writeAuditEvent(
        ctx,
        {
          action: rule.label,
          resourceType: "draw_request",
          resourceId: draw.id,
          details: {
            previousState,
            nextState: { status: rule.toState },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Draw #${draw.drawNumber} ${rule.label}`,
          relatedObjectType: "draw_request",
          relatedObjectId: draw.id,
          visibilityScope: kind === "mark-paid" ? "internal_only" : "project_wide",
        },
        tx,
      );
    });

    // Fire notifications for the subset of transitions that map to
    // user-facing events. Submit → draw_submitted (contractors), approve
    // and approve-with-note → draw_approved (contractors) + draw_review
    // bookkeeping is handled at the client's own submit flow. Keeping
    // this switch explicit so future states don't quietly start emitting.
    const amountLabel =
      typeof draw.currentPaymentDueCents === "number"
        ? `$${(draw.currentPaymentDueCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
        : null;
    const baseVars = {
      drawNumber: draw.drawNumber,
      amount: amountLabel,
      actorName: ctx.user.displayName ?? ctx.user.email,
    };
    const emitBase = {
      actorUserId: ctx.user.id,
      projectId: draw.projectId,
      relatedObjectType: "draw_request",
      relatedObjectId: draw.id,
      vars: baseVars,
    };
    if (kind === "submit") {
      // draw_submitted goes to contractor team (actor is filtered out).
      // draw_review goes to the client side so they know it's their turn.
      await Promise.all([
        emitNotifications({ ...emitBase, eventId: "draw_submitted" }),
        emitNotifications({ ...emitBase, eventId: "draw_review" }),
      ]);
    } else if (kind === "approve" || kind === "approve-with-note") {
      await emitNotifications({ ...emitBase, eventId: "draw_approved" });
    }

    return NextResponse.json({ id: draw.id, status: rule.toState });
  } catch (err) {
    if (err instanceof TransitionBlockedError) {
      return NextResponse.json(
        { error: err.code, message: err.message, ...(err.details ?? {}) },
        { status: err.status },
      );
    }
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
