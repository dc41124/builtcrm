import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { retainageReleases } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { recomputeProjectDraftDraws } from "../../draw-requests/_totals";

type ReleaseRow = typeof retainageReleases.$inferSelect;
type UpdateValues = Partial<typeof retainageReleases.$inferInsert>;

const CONTRACTOR_ROLES = ["contractor_admin", "contractor_pm"] as const;
const CLIENT_ROLES = ["commercial_client", "residential_client"] as const;

type Role = string;

type TransitionRule<TBody> = {
  allowedRoles: readonly Role[];
  fromStates: ReadonlyArray<ReleaseRow["releaseStatus"]>;
  toState: ReleaseRow["releaseStatus"];
  label: string;
  forbiddenMessage: string;
  bodySchema?: z.ZodType<TBody>;
  buildUpdate?: (body: TBody, release: ReleaseRow) => UpdateValues;
};

export type RetainageReleaseTransitionKind = "submit" | "approve" | "reject";

const approveBody = z.object({ note: z.string().max(2000).optional() });
const rejectBody = z.object({ note: z.string().min(1).max(2000) });

const RULES: {
  submit: TransitionRule<Record<string, never>>;
  approve: TransitionRule<z.infer<typeof approveBody>>;
  reject: TransitionRule<z.infer<typeof rejectBody>>;
} = {
  submit: {
    allowedRoles: CONTRACTOR_ROLES,
    fromStates: ["held"],
    toState: "release_requested",
    label: "submitted",
    forbiddenMessage: "Only contractors can submit a retainage release",
    buildUpdate: () => ({ requestedAt: new Date() }),
  },
  approve: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["release_requested"],
    toState: "released",
    label: "approved",
    forbiddenMessage: "Only the client can approve a retainage release",
    bodySchema: approveBody,
    buildUpdate: (body) => ({
      approvedAt: new Date(),
      approvalNote: body.note ?? null,
    }),
  },
  reject: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["release_requested"],
    toState: "held",
    label: "rejected",
    forbiddenMessage: "Only the client can reject a retainage release",
    bodySchema: rejectBody,
    buildUpdate: (body) => ({
      requestedAt: null,
      approvalNote: body.note,
    }),
  },
};

export async function handleRetainageReleaseTransition(
  req: Request,
  id: string,
  kind: RetainageReleaseTransitionKind,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const rule = RULES[kind] as TransitionRule<unknown>;

  let body: unknown = {};
  if (rule.bodySchema) {
    const raw = await req.json().catch(() => null);
    const parsed = rule.bodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    body = parsed.data;
  }

  try {
    const [release] = await db
      .select()
      .from(retainageReleases)
      .where(eq(retainageReleases.id, id))
      .limit(1);
    if (!release) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      release.projectId,
    );
    if (!rule.allowedRoles.includes(ctx.role)) {
      throw new AuthorizationError(rule.forbiddenMessage, "forbidden");
    }

    if (!rule.fromStates.includes(release.releaseStatus)) {
      return NextResponse.json(
        { error: "invalid_state", state: release.releaseStatus },
        { status: 409 },
      );
    }

    const previousState = { status: release.releaseStatus };
    const extraFields = rule.buildUpdate ? rule.buildUpdate(body, release) : {};
    const isClientDecision = kind === "approve" || kind === "reject";

    await db.transaction(async (tx) => {
      await tx
        .update(retainageReleases)
        .set({
          releaseStatus: rule.toState,
          ...(isClientDecision ? { approvedByUserId: ctx.user.id } : {}),
          ...extraFields,
        })
        .where(eq(retainageReleases.id, release.id));

      if (kind === "approve") {
        await recomputeProjectDraftDraws(tx, release.projectId);
      }

      await writeAuditEvent(
        ctx,
        {
          action: rule.label,
          resourceType: "retainage_release",
          resourceId: release.id,
          details: { previousState, nextState: { status: rule.toState } },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Retainage release ${rule.label}`,
          relatedObjectType: "retainage_release",
          relatedObjectId: release.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: release.id, status: rule.toState });
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
