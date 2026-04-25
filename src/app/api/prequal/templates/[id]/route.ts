import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import {
  archivePrequalTemplate,
  setDefaultPrequalTemplate,
  updatePrequalTemplate,
} from "@/domain/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

const QuestionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  type: z.enum([
    "short_text",
    "long_text",
    "yes_no",
    "number",
    "select_one",
    "multi_select",
  ]),
  required: z.boolean(),
  helpText: z.string().optional(),
  weight: z.number().int().optional(),
  unit: z.string().optional(),
  options: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        points: z.number().int().optional(),
      }),
    )
    .optional(),
  scoreBands: z
    .array(
      z.object({
        min: z.number(),
        max: z.number(),
        points: z.number().int(),
      }),
    )
    .optional(),
  gating: z.boolean().optional(),
});

// PATCH: update template fields, or run a sub-action via `action` field.
const BodySchema = z.union([
  z.object({
    action: z.enum(["archive", "set_default"]),
  }),
  z.object({
    action: z.undefined().optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    tradeCategory: z.string().max(120).nullable().optional(),
    validityMonths: z.number().int().nullable().optional(),
    questions: z.array(QuestionSchema).optional(),
    scoringRules: z
      .object({
        passThreshold: z.number().int(),
        gatingFailValues: z.record(
          z.string(),
          z.union([z.string(), z.boolean(), z.array(z.string())]),
        ),
      })
      .optional(),
  }),
]);

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
  if (err instanceof Error) {
    return NextResponse.json(
      { error: "validation", message: err.message },
      { status: 400 },
    );
  }
  throw err;
}

export async function PATCH(
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
  const body = parsed.data;
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  try {
    if ("action" in body && body.action === "archive") {
      await archivePrequalTemplate({ session: sessionLike, templateId: id });
      return NextResponse.json({ ok: true });
    }
    if ("action" in body && body.action === "set_default") {
      await setDefaultPrequalTemplate({
        session: sessionLike,
        templateId: id,
      });
      return NextResponse.json({ ok: true });
    }
    await updatePrequalTemplate({
      session: sessionLike,
      templateId: id,
      patch: body as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
