import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession } from "@/auth/session";
import {
  decidePrequalSubmission,
  moveSubmissionToUnderReview,
  savePrequalSubmissionDraft,
  submitPrequalSubmission,
} from "@/domain/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

// PATCH /api/prequal/submissions/[id]
//
// Three actions on a submission, distinguished by `action`:
//   - "save_draft"   (sub) → upsert answers, status stays draft
//   - "submit"       (sub) → answers + transition draft → submitted
//   - "decide"       (contractor) → approve/reject + reviewer notes

const SaveDraftSchema = z.object({
  action: z.literal("save_draft"),
  answers: z.record(z.string(), z.unknown()),
});

const SubmitSchema = z.object({
  action: z.literal("submit"),
  answers: z.record(z.string(), z.unknown()),
});

const DecideSchema = z.object({
  action: z.literal("decide"),
  decision: z.enum(["approve", "reject"]),
  reviewerNotes: z.string().nullable().optional(),
  overrideGating: z.boolean().optional(),
});

const MoveUnderReviewSchema = z.object({
  action: z.literal("move_under_review"),
});

const BodySchema = z.union([
  SaveDraftSchema,
  SubmitSchema,
  DecideSchema,
  MoveUnderReviewSchema,
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
  const sessionData = await getServerSession();
  if (!sessionData) {
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
  const sessionLike = sessionData.session;

  try {
    if (body.action === "save_draft") {
      await savePrequalSubmissionDraft({
        session: sessionLike,
        submissionId: id,
        answers: body.answers,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "submit") {
      const result = await submitPrequalSubmission({
        session: sessionLike,
        submissionId: id,
        answers: body.answers,
      });
      return NextResponse.json(result);
    }
    if (body.action === "move_under_review") {
      await moveSubmissionToUnderReview({
        session: sessionLike,
        submissionId: id,
      });
      return NextResponse.json({ ok: true });
    }
    // decide
    if (body.decision === "reject" && !body.reviewerNotes?.trim()) {
      return NextResponse.json(
        { error: "validation", message: "Reject requires reviewer notes" },
        { status: 400 },
      );
    }
    await decidePrequalSubmission({
      session: sessionLike,
      submissionId: id,
      decision:
        body.decision === "approve"
          ? { kind: "approve", reviewerNotes: body.reviewerNotes ?? null }
          : { kind: "reject", reviewerNotes: body.reviewerNotes ?? "" },
      overrideGating: body.overrideGating ?? false,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
