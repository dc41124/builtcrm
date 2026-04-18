import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, organizations } from "@/db/schema";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, requireFeature } from "@/domain/policies/plan";

// Separate from /api/org/profile so sign-in policy changes get their own
// audit trail (actionName `security.updated`) and can be authorized
// independently later (e.g. requiring re-auth or an admin second-factor).
const BodySchema = z.object({
  // null or [] → unrestricted; ≥1 entry → lock enabled.
  allowedEmailDomains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid domain")
        .max(253),
    )
    .max(20)
    .nullable()
    .optional(),
  // 60..10080 minutes (1h..7d) matches the options surfaced in the UI.
  sessionTimeoutMinutes: z
    .number()
    .int()
    .min(60)
    .max(10080)
    .nullable()
    .optional(),
  // Gated to Professional+ via requireFeature("require_2fa_org"). The toggle
  // is one boolean regardless of enabling or disabling the requirement.
  requireTwoFactorOrg: z.boolean().optional(),
});

async function resolveAdminOrg(sessionShim: { appUserId?: string | null }) {
  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") throw new AuthorizationError("Forbidden", "forbidden");
    return { orgId: ctx.organization.id, userId: ctx.user.id };
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err;
    const ctx = await getSubcontractorOrgContext(sessionShim);
    if (ctx.role !== "subcontractor_owner") throw new AuthorizationError("Forbidden", "forbidden");
    return { orgId: ctx.organization.id, userId: ctx.user.id };
  }
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as { appUserId?: string | null };

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    const updates: Record<string, unknown> = {};
    if (parsed.data.allowedEmailDomains !== undefined) {
      const next = parsed.data.allowedEmailDomains;
      updates.allowedEmailDomains =
        next == null || next.length === 0 ? null : next;
    }
    if (parsed.data.sessionTimeoutMinutes !== undefined) {
      updates.sessionTimeoutMinutes = parsed.data.sessionTimeoutMinutes;
    }
    if (parsed.data.requireTwoFactorOrg !== undefined) {
      // Plan gate — only Professional+ can toggle this. Starter gets 402 with
      // a structured error so the client can show the upgrade CTA inline.
      const planCtx = await getOrgPlanContext(orgId);
      requireFeature(planCtx, "require_2fa_org");
      updates.requireTwoFactorOrg = parsed.data.requireTwoFactorOrg;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, noop: true });
    }

    const [before] = await db
      .select({
        allowedEmailDomains: organizations.allowedEmailDomains,
        sessionTimeoutMinutes: organizations.sessionTimeoutMinutes,
        requireTwoFactorOrg: organizations.requireTwoFactorOrg,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (!before) {
      throw new AuthorizationError("Organization not found", "not_found");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, orgId));

      const prevSnap: Record<string, unknown> = {};
      for (const key of Object.keys(updates)) {
        prevSnap[key] = (before as unknown as Record<string, unknown>)[key];
      }
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization_security",
        objectId: orgId,
        actionName: "updated",
        previousState: prevSnap,
        nextState: updates,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PlanGateError) {
      // 402 Payment Required — semantically "your plan doesn't permit this".
      return NextResponse.json(
        {
          error: "plan_gate",
          reason: err.reason,
          required: err.required,
          message: err.message,
        },
        { status: 402 },
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
