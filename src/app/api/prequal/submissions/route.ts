import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { inviteSubToPrequalify } from "@/domain/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

// POST /api/prequal/submissions — contractor invites a sub to prequalify.
// Idempotent: if there's already an in-flight submission for the (sub,
// contractor) pair, returns it instead of creating a duplicate.

const BodySchema = z.object({
  subOrgId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await inviteSubToPrequalify({
      session: session,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (err) {
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
}
