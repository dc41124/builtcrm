import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documents, lienWaivers } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

type WaiverRow = typeof lienWaivers.$inferSelect;
type UpdateValues = Partial<typeof lienWaivers.$inferInsert>;

const CONTRACTOR_ROLES = ["contractor_admin", "contractor_pm"] as const;
const CLIENT_ROLES = ["commercial_client", "residential_client"] as const;
const SUB_ROLES = ["subcontractor_user"] as const;
const SUBMIT_ROLES = [...CONTRACTOR_ROLES, ...SUB_ROLES] as const;

type Role = string;

type TransitionRule<TBody> = {
  allowedRoles: readonly Role[];
  fromStates: ReadonlyArray<WaiverRow["lienWaiverStatus"]>;
  toState: WaiverRow["lienWaiverStatus"];
  label: string;
  forbiddenMessage: string;
  requireOwnerOrg?: boolean;
  bodySchema?: z.ZodType<TBody>;
  buildUpdate?: (body: TBody, waiver: WaiverRow) => UpdateValues;
};

export type LienWaiverTransitionKind = "submit" | "accept" | "reject" | "waive";

const submitBody = z.object({ documentId: z.string().uuid() });
const noteBody = z.object({ note: z.string().min(1).max(2000).optional() });

const RULES: {
  submit: TransitionRule<z.infer<typeof submitBody>>;
  accept: TransitionRule<Record<string, never>>;
  reject: TransitionRule<z.infer<typeof noteBody>>;
  waive: TransitionRule<z.infer<typeof noteBody>>;
} = {
  submit: {
    allowedRoles: SUBMIT_ROLES,
    fromStates: ["requested"],
    toState: "submitted",
    label: "submitted",
    forbiddenMessage: "Only the paying organization can submit this waiver",
    requireOwnerOrg: true,
    bodySchema: submitBody,
    buildUpdate: (body) => ({
      documentId: body.documentId,
      submittedAt: new Date(),
    }),
  },
  accept: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["submitted"],
    toState: "accepted",
    label: "accepted",
    forbiddenMessage: "Only the client can accept a lien waiver",
  },
  reject: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["submitted"],
    toState: "requested",
    label: "rejected",
    forbiddenMessage: "Only the client can reject a lien waiver",
    bodySchema: noteBody,
    buildUpdate: () => ({ submittedAt: null, documentId: null }),
  },
  waive: {
    allowedRoles: CLIENT_ROLES,
    fromStates: ["requested", "submitted"],
    toState: "waived",
    label: "waived",
    forbiddenMessage: "Only the client can waive a lien waiver",
    bodySchema: noteBody,
  },
};

export async function handleLienWaiverTransition(
  req: Request,
  id: string,
  kind: LienWaiverTransitionKind,
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
    const [waiver] = await db
      .select()
      .from(lienWaivers)
      .where(eq(lienWaivers.id, id))
      .limit(1);
    if (!waiver) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      waiver.projectId,
    );
    if (!rule.allowedRoles.includes(ctx.role)) {
      throw new AuthorizationError(rule.forbiddenMessage, "forbidden");
    }
    if (rule.requireOwnerOrg && waiver.organizationId !== ctx.organization.id) {
      throw new AuthorizationError(rule.forbiddenMessage, "forbidden");
    }

    if (!rule.fromStates.includes(waiver.lienWaiverStatus)) {
      return NextResponse.json(
        { error: "invalid_state", state: waiver.lienWaiverStatus },
        { status: 409 },
      );
    }

    if (kind === "submit") {
      const documentId = (body as z.infer<typeof submitBody>).documentId;
      const [doc] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(eq(documents.id, documentId), eq(documents.projectId, waiver.projectId)),
        )
        .limit(1);
      if (!doc) {
        return NextResponse.json(
          { error: "document_not_found" },
          { status: 404 },
        );
      }
    }

    const previousState = { status: waiver.lienWaiverStatus };
    const extraFields = rule.buildUpdate ? rule.buildUpdate(body, waiver) : {};

    await db.transaction(async (tx) => {
      await tx
        .update(lienWaivers)
        .set({
          lienWaiverStatus: rule.toState,
          ...(kind === "accept"
            ? { acceptedAt: new Date(), acceptedByUserId: ctx.user.id }
            : {}),
          ...extraFields,
        })
        .where(eq(lienWaivers.id, waiver.id));

      await writeAuditEvent(
        ctx,
        {
          action: rule.label,
          resourceType: "lien_waiver",
          resourceId: waiver.id,
          details: { previousState, nextState: { status: rule.toState } },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `Lien waiver ${rule.label} (draw ref)`,
          relatedObjectType: "lien_waiver",
          relatedObjectId: waiver.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: waiver.id, status: rule.toState });
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
