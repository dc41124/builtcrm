import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import {
  grantProjectExemption,
  revokeProjectExemption,
  setPrequalEnforcementMode,
} from "@/domain/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

// PATCH /api/prequal/enforcement
//
// One of:
//   - { action: "set_mode", mode }
//   - { action: "grant_exemption", projectId, subOrgId, reason, expiresAt? }
//   - { action: "revoke_exemption", exemptionId }

const SetModeSchema = z.object({
  action: z.literal("set_mode"),
  mode: z.enum(["off", "warn", "block"]),
});
const GrantSchema = z.object({
  action: z.literal("grant_exemption"),
  projectId: z.string().uuid(),
  subOrgId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
  expiresAt: z.string().datetime().nullable().optional(),
});
const RevokeSchema = z.object({
  action: z.literal("revoke_exemption"),
  exemptionId: z.string().uuid(),
});
const BodySchema = z.union([SetModeSchema, GrantSchema, RevokeSchema]);

function mapError(err: unknown) {
  if (err instanceof AuthorizationError) {
    const code =
      err.code === "unauthenticated"
        ? 401
        : err.code === "not_found"
          ? 404
          : 403;
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: code },
    );
  }
  if (err instanceof PlanGateError) {
    return NextResponse.json(
      { error: "plan_gate", message: err.message },
      { status: 402 },
    );
  }
  throw err;
}

export async function PATCH(req: Request) {
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
  const body = parsed.data;
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  try {
    if (body.action === "set_mode") {
      await setPrequalEnforcementMode({
        session: sessionLike,
        mode: body.mode,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "grant_exemption") {
      const result = await grantProjectExemption({
        session: sessionLike,
        projectId: body.projectId,
        subOrgId: body.subOrgId,
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      });
      return NextResponse.json(result);
    }
    await revokeProjectExemption({
      session: sessionLike,
      exemptionId: body.exemptionId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
