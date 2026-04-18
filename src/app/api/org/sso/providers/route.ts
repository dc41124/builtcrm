import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, ssoProviders } from "@/db/schema";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, requireFeature } from "@/domain/policies/plan";

// SSO provider configuration — Enterprise-only. One provider per org, so
// this endpoint is upsert: POST creates or replaces. DELETE removes it.
// Actual SAML sign-in traffic goes through /api/auth/sso/* via the Better
// Auth plugin — this module only manages the DB row.

const UpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  entityId: z.string().trim().min(1),
  ssoUrl: z.string().trim().url(),
  certificatePem: z.string().trim().min(1),
  allowedEmailDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Invalid domain")
    .max(253),
  status: z.enum(["active", "disabled"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as {
    appUserId?: string | null;
  };

  const parsed = UpsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can configure SSO",
        "forbidden",
      );
    }
    const planCtx = await getOrgPlanContext(ctx.organization.id);
    requireFeature(planCtx, "sso.saml");

    const values = {
      organizationId: ctx.organization.id,
      name: parsed.data.name,
      entityId: parsed.data.entityId,
      ssoUrl: parsed.data.ssoUrl,
      certificatePem: parsed.data.certificatePem,
      allowedEmailDomain: parsed.data.allowedEmailDomain,
      status: parsed.data.status ?? "active",
    };

    const [existing] = await db
      .select({ id: ssoProviders.id })
      .from(ssoProviders)
      .where(eq(ssoProviders.organizationId, ctx.organization.id))
      .limit(1);

    const result = await db.transaction(async (tx) => {
      if (existing) {
        const [updated] = await tx
          .update(ssoProviders)
          .set(values)
          .where(eq(ssoProviders.id, existing.id))
          .returning({ id: ssoProviders.id });
        await tx.insert(auditEvents).values({
          actorUserId: ctx.user.id,
          organizationId: ctx.organization.id,
          objectType: "sso_provider",
          objectId: updated.id,
          actionName: "updated",
          nextState: {
            name: values.name,
            entityId: values.entityId,
            ssoUrl: values.ssoUrl,
            allowedEmailDomain: values.allowedEmailDomain,
            status: values.status,
          },
        });
        return { id: updated.id, created: false };
      }
      const [created] = await tx
        .insert(ssoProviders)
        .values(values)
        .returning({ id: ssoProviders.id });
      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "sso_provider",
        objectId: created.id,
        actionName: "created",
        nextState: {
          name: values.name,
          entityId: values.entityId,
          ssoUrl: values.ssoUrl,
          allowedEmailDomain: values.allowedEmailDomain,
          status: values.status,
        },
      });
      return { id: created.id, created: true };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof PlanGateError) {
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

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as {
    appUserId?: string | null;
  };

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can remove SSO",
        "forbidden",
      );
    }
    // No plan gate on DELETE — if the row exists it was created by an
    // Enterprise org, and deletion is always allowed (e.g. downgrade
    // cleanup).

    const [existing] = await db
      .select({ id: ssoProviders.id })
      .from(ssoProviders)
      .where(eq(ssoProviders.organizationId, ctx.organization.id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ ok: true, noop: true });
    }

    await db.transaction(async (tx) => {
      await tx.delete(ssoProviders).where(eq(ssoProviders.id, existing.id));
      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "sso_provider",
        objectId: existing.id,
        actionName: "deleted",
      });
    });

    return NextResponse.json({ ok: true });
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
