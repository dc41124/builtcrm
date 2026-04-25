import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { createPrequalTemplate } from "@/domain/prequal";
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

const BodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  tradeCategory: z.string().max(120).nullable().optional(),
  validityMonths: z.number().int().nullable().optional(),
  questions: z.array(QuestionSchema).default([]),
  scoringRules: z
    .object({
      passThreshold: z.number().int(),
      gatingFailValues: z.record(
        z.string(),
        z.union([z.string(), z.boolean(), z.array(z.string())]),
      ),
    })
    .optional(),
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
    const result = await createPrequalTemplate({
      session: session,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
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
}
