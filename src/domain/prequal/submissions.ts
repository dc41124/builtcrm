import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  organizations,
  prequalSubmissions,
  prequalTemplates,
} from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext, type SessionLike } from "@/domain/context";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import {
  type PrequalQuestion,
  type PrequalScoringRules,
} from "@/domain/loaders/prequal";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { requireFeature } from "@/domain/policies/plan";
import { emitNotifications } from "@/lib/notifications/emit";

import { computeScore } from "./score";

// -----------------------------------------------------------------------------
// Submission lifecycle: invite (contractor) → save draft (sub) → submit (sub)
// → decide (contractor). Each action runs identity → role gate → org-match
// check → state validation → mutation in txn → audit.
// -----------------------------------------------------------------------------

async function ensureContractorFeature(
  orgId: string,
  orgType: string,
): Promise<void> {
  if (orgType !== "contractor") {
    throw new AuthorizationError("Contractor-only action", "forbidden");
  }
  const planCtx = await getOrgPlanContext(orgId);
  requireFeature(planCtx, "prequalification");
}

// -----------------------------------------------------------------------------
// invite-sub-to-prequalify
// -----------------------------------------------------------------------------

export async function inviteSubToPrequalify(input: {
  session: SessionLike | null | undefined;
  subOrgId: string;
  // Optional explicit template override; falls back to default template
  // resolution when omitted.
  templateId?: string;
}): Promise<{ submissionId: string; status: "draft" }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "approve");
  await ensureContractorFeature(ctx.organization.id, ctx.organization.type);

  // Verify sub org exists and is a subcontractor.
  const [subOrg] = await db
    .select({
      id: organizations.id,
      type: organizations.organizationType,
      trade: organizations.primaryTrade,
    })
    .from(organizations)
    .where(eq(organizations.id, input.subOrgId))
    .limit(1);
  if (!subOrg) throw new AuthorizationError("Sub org not found", "not_found");
  if (subOrg.type !== "subcontractor") {
    throw new AuthorizationError(
      "Target org is not a subcontractor",
      "forbidden",
    );
  }

  // Resolve template: explicit pick, else default-by-trade.
  let templateId = input.templateId ?? null;
  if (templateId) {
    const [t] = await db
      .select({ orgId: prequalTemplates.orgId, archivedAt: prequalTemplates.archivedAt })
      .from(prequalTemplates)
      .where(eq(prequalTemplates.id, templateId))
      .limit(1);
    if (!t) throw new AuthorizationError("Template not found", "not_found");
    if (t.orgId !== ctx.organization.id) {
      throw new AuthorizationError("Template not yours", "forbidden");
    }
    if (t.archivedAt) {
      throw new AuthorizationError(
        "Archived templates cannot be used for new invitations",
        "forbidden",
      );
    }
  } else {
    const { resolveDefaultTemplate } = await import("./templates");
    templateId = await resolveDefaultTemplate({
      contractorOrgId: ctx.organization.id,
      subTrade: subOrg.trade ?? null,
    });
    if (!templateId) {
      throw new AuthorizationError(
        "No default prequalification template configured for this trade.",
        "not_found",
      );
    }
  }

  // If there's already an in-flight submission (draft / submitted /
  // under_review) for this pair, return it instead of creating a duplicate.
  const [existing] = await db
    .select({ id: prequalSubmissions.id, status: prequalSubmissions.status })
    .from(prequalSubmissions)
    .where(
      and(
        eq(prequalSubmissions.contractorOrgId, ctx.organization.id),
        eq(prequalSubmissions.submittedByOrgId, input.subOrgId),
      ),
    )
    .orderBy(desc(prequalSubmissions.createdAt))
    .limit(1);
  if (
    existing &&
    (existing.status === "draft" ||
      existing.status === "submitted" ||
      existing.status === "under_review")
  ) {
    return { submissionId: existing.id, status: "draft" };
  }

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(prequalSubmissions)
      .values({
        templateId: templateId!,
        submittedByOrgId: input.subOrgId,
        contractorOrgId: ctx.organization.id,
        status: "draft",
      })
      .returning({ id: prequalSubmissions.id });

    await writeOrgAuditEvent(
      ctx,
      {
        action: "invited",
        resourceType: "prequal_submission",
        resourceId: row.id,
        details: {
          metadata: {
            subOrgId: input.subOrgId,
            templateId: templateId!,
          },
        },
      },
      tx,
    );
    return row;
  });

  await emitNotifications({
    eventId: "prequal_invited",
    actorUserId: ctx.user.id,
    projectId: null,
    relatedObjectType: "prequal_submission",
    relatedObjectId: result.id,
    targetOrganizationId: input.subOrgId,
    vars: {
      contractorOrgName: ctx.organization.name,
      contractorOrgId: ctx.organization.id,
    },
  });

  return { submissionId: result.id, status: "draft" };
}

// -----------------------------------------------------------------------------
// save-submission-draft (sub edits in-flight)
// -----------------------------------------------------------------------------

export async function savePrequalSubmissionDraft(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
  answers: Record<string, unknown>;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "write");

  const [row] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, input.submissionId))
    .limit(1);
  if (!row) throw new AuthorizationError("Submission not found", "not_found");
  if (row.submittedByOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Not your submission", "forbidden");
  }
  if (row.status !== "draft") {
    throw new AuthorizationError(
      "Cannot edit a submitted submission",
      "forbidden",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(prequalSubmissions)
      .set({ answersJson: input.answers, updatedAt: new Date() })
      .where(eq(prequalSubmissions.id, input.submissionId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "draft_saved",
        resourceType: "prequal_submission",
        resourceId: input.submissionId,
      },
      tx,
    );
  });
}

// -----------------------------------------------------------------------------
// submit-submission (status draft → submitted; computes score+gating)
// -----------------------------------------------------------------------------

export async function submitPrequalSubmission(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
  answers: Record<string, unknown>;
}): Promise<{ scoreTotal: number; gatingFailures: string[] }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "write");

  const [row] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, input.submissionId))
    .limit(1);
  if (!row) throw new AuthorizationError("Submission not found", "not_found");
  if (row.submittedByOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Not your submission", "forbidden");
  }
  if (row.status !== "draft") {
    throw new AuthorizationError(
      "Submission already sent",
      "forbidden",
    );
  }

  const [template] = await db
    .select()
    .from(prequalTemplates)
    .where(eq(prequalTemplates.id, row.templateId))
    .limit(1);
  if (!template) {
    throw new AuthorizationError(
      "Template missing — contact the contractor",
      "not_found",
    );
  }

  const questions = (template.questionsJson as PrequalQuestion[]) ?? [];
  const scoring = (template.scoringRules as PrequalScoringRules) ?? {
    passThreshold: 0,
    gatingFailValues: {},
  };

  const { scoreTotal, gatingFailures } = computeScore(
    { questionsJson: questions, scoringRules: scoring },
    input.answers,
  );

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(prequalSubmissions)
      .set({
        answersJson: input.answers,
        scoreTotal,
        gatingFailures,
        status: "submitted",
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(prequalSubmissions.id, input.submissionId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "submitted",
        resourceType: "prequal_submission",
        resourceId: input.submissionId,
        details: {
          nextState: {
            scoreTotal,
            gatingFailureCount: gatingFailures.length,
          },
        },
      },
      tx,
    );
  });

  await emitNotifications({
    eventId: "prequal_submitted",
    actorUserId: ctx.user.id,
    projectId: null,
    relatedObjectType: "prequal_submission",
    relatedObjectId: input.submissionId,
    targetOrganizationId: row.contractorOrgId,
    vars: {
      subOrgName: ctx.organization.name,
      submissionId: input.submissionId,
    },
  });

  return { scoreTotal, gatingFailures };
}

// -----------------------------------------------------------------------------
// decide-submission (contractor approves/rejects)
// -----------------------------------------------------------------------------

export type DecidePrequalDecision =
  | { kind: "approve"; reviewerNotes?: string | null }
  | { kind: "reject"; reviewerNotes: string };

export async function decidePrequalSubmission(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
  decision: DecidePrequalDecision;
  // When true, allow approval even with gating failures present. Writes a
  // separate audit action so the override is auditable on its own.
  overrideGating?: boolean;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "approve");
  await ensureContractorFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, input.submissionId))
    .limit(1);
  if (!row) throw new AuthorizationError("Submission not found", "not_found");
  if (row.contractorOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Not your submission to review", "forbidden");
  }
  if (row.status !== "submitted" && row.status !== "under_review") {
    throw new AuthorizationError(
      `Cannot decide a submission in state "${row.status}"`,
      "forbidden",
    );
  }

  const [template] = await db
    .select({ validityMonths: prequalTemplates.validityMonths })
    .from(prequalTemplates)
    .where(eq(prequalTemplates.id, row.templateId))
    .limit(1);

  const gating = Array.isArray(row.gatingFailures)
    ? (row.gatingFailures as string[])
    : [];
  const hasGating = gating.length > 0;

  if (input.decision.kind === "approve" && hasGating && !input.overrideGating) {
    throw new AuthorizationError(
      "Submission has gating failures — override required to approve",
      "forbidden",
    );
  }

  const now = new Date();
  let expiresAt: Date | null = null;
  if (input.decision.kind === "approve") {
    if (template?.validityMonths != null) {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + template.validityMonths);
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(prequalSubmissions)
      .set({
        status: input.decision.kind === "approve" ? "approved" : "rejected",
        reviewedByUserId: ctx.user.id,
        reviewedAt: now,
        reviewerNotes: input.decision.reviewerNotes ?? null,
        expiresAt,
        updatedAt: now,
      })
      .where(eq(prequalSubmissions.id, input.submissionId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: input.decision.kind === "approve" ? "approved" : "rejected",
        resourceType: "prequal_submission",
        resourceId: input.submissionId,
        details: {
          previousState: { status: row.status },
          nextState: {
            status: input.decision.kind === "approve" ? "approved" : "rejected",
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            gatingFailures: gating,
          },
        },
      },
      tx,
    );

    if (input.overrideGating && hasGating && input.decision.kind === "approve") {
      await writeOrgAuditEvent(
        ctx,
        {
          action: "gating_override",
          resourceType: "prequal_submission",
          resourceId: input.submissionId,
          details: {
            metadata: { gatingFailures: gating },
          },
        },
        tx,
      );
    }
  });

  await emitNotifications({
    eventId:
      input.decision.kind === "approve" ? "prequal_approved" : "prequal_rejected",
    actorUserId: ctx.user.id,
    projectId: null,
    relatedObjectType: "prequal_submission",
    relatedObjectId: input.submissionId,
    targetOrganizationId: row.submittedByOrgId,
    vars: {
      contractorOrgName: ctx.organization.name,
      contractorOrgId: ctx.organization.id,
      reviewerNotes: input.decision.reviewerNotes ?? "",
      expiresAt: expiresAt ? expiresAt.toLocaleDateString() : "",
    },
  });
}

// -----------------------------------------------------------------------------
// move-to-under-review — contractor stages a submitted submission as
// actively-being-reviewed without deciding yet. Useful when reviewer wants
// to claim the submission so others know it's being worked.
// -----------------------------------------------------------------------------

export async function moveSubmissionToUnderReview(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "approve");
  await ensureContractorFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, input.submissionId))
    .limit(1);
  if (!row) throw new AuthorizationError("Submission not found", "not_found");
  if (row.contractorOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Not your submission", "forbidden");
  }
  if (row.status !== "submitted") {
    throw new AuthorizationError(
      "Only submitted submissions can be moved to under review",
      "forbidden",
    );
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(prequalSubmissions)
      .set({
        status: "under_review",
        reviewedByUserId: ctx.user.id,
        updatedAt: now,
      })
      .where(eq(prequalSubmissions.id, input.submissionId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "moved_to_under_review",
        resourceType: "prequal_submission",
        resourceId: input.submissionId,
        details: {
          previousState: { status: "submitted" },
          nextState: { status: "under_review" },
        },
      },
      tx,
    );
  });
}
