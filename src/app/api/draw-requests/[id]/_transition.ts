import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { drawRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import { recomputeDrawHeaderTotals } from "../_totals";

type DrawRow = typeof drawRequests.$inferSelect;
type UpdateValues = Partial<typeof drawRequests.$inferInsert>;

const CONTRACTOR_ROLES = ["contractor_admin", "contractor_pm"] as const;
const CLIENT_ROLES = ["commercial_client", "residential_client"] as const;

type Role = string;

type TransitionRule<TBody> = {
  allowedRoles: readonly Role[];
  fromStates: ReadonlyArray<DrawRow["drawRequestStatus"]>;
  toState: DrawRow["drawRequestStatus"];
  label: string;
  forbiddenMessage: string;
  bodySchema?: z.ZodType<TBody>;
  recomputeTotals?: boolean;
  buildUpdate?: (body: TBody, draw: DrawRow) => UpdateValues;
};

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
  },
  "approve-with-note": {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["under_review"],
    toState: "approved_with_note",
    label: "approved with note",
    forbiddenMessage: "Only the client can approve a draw request",
    bodySchema: approveNoteBody,
    buildUpdate: (body) => ({ reviewedAt: new Date(), reviewNote: body.note }),
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

    return NextResponse.json({ id: draw.id, status: rule.toState });
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
