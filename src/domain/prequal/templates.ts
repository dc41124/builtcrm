import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { prequalSubmissions, prequalTemplates } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext, type SessionLike } from "@/domain/context";
import {
  type PrequalQuestion,
  type PrequalScoringRules,
} from "@/domain/loaders/prequal";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { requireFeature } from "@/domain/policies/plan";

// -----------------------------------------------------------------------------
// Template CRUD actions. Org-scoped, contractor-only. Per-row org-match
// (template.orgId === ctx.organization.id) is enforced after every load.
// -----------------------------------------------------------------------------

async function ensureFeature(orgId: string, orgType: string): Promise<void> {
  if (orgType !== "contractor") {
    throw new AuthorizationError(
      "Only contractor orgs can manage prequal templates",
      "forbidden",
    );
  }
  const planCtx = await getOrgPlanContext(orgId);
  requireFeature(planCtx, "prequalification");
}

// Validates a single question definition. Throws on shape problems —
// bubbles up to the API layer as a 400.
function validateQuestion(q: PrequalQuestion, idx: number): void {
  if (!q.key || typeof q.key !== "string") {
    throw new Error(`Question ${idx}: missing or invalid key`);
  }
  if (!/^[a-z0-9_]+$/.test(q.key)) {
    throw new Error(
      `Question ${idx}: key "${q.key}" must be snake_case (a-z, 0-9, _).`,
    );
  }
  if (!q.label || typeof q.label !== "string") {
    throw new Error(`Question ${idx}: missing label`);
  }
  const validTypes = new Set([
    "short_text",
    "long_text",
    "yes_no",
    "number",
    "select_one",
    "multi_select",
  ]);
  if (!validTypes.has(q.type)) {
    throw new Error(`Question ${idx}: invalid type "${q.type}"`);
  }
  if ((q.type === "select_one" || q.type === "multi_select") && (!q.options || q.options.length === 0)) {
    throw new Error(`Question ${idx}: ${q.type} questions need options`);
  }
}

function validateQuestionsArray(arr: PrequalQuestion[]): void {
  const seen = new Set<string>();
  arr.forEach((q, idx) => {
    validateQuestion(q, idx);
    if (seen.has(q.key)) {
      throw new Error(`Duplicate question key: "${q.key}"`);
    }
    seen.add(q.key);
  });
}

export type CreatePrequalTemplateInput = {
  session: SessionLike | null | undefined;
  name: string;
  description?: string | null;
  tradeCategory?: string | null;
  validityMonths?: number | null;
  questions?: PrequalQuestion[];
  scoringRules?: PrequalScoringRules;
};

export async function createPrequalTemplate(
  input: CreatePrequalTemplateInput,
): Promise<{ id: string }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_template", "write");
  await ensureFeature(ctx.organization.id, ctx.organization.type);

  const questions = input.questions ?? [];
  validateQuestionsArray(questions);
  const scoring: PrequalScoringRules = input.scoringRules ?? {
    passThreshold: 0,
    gatingFailValues: {},
  };

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(prequalTemplates)
      .values({
        orgId: ctx.organization.id,
        name: input.name,
        description: input.description ?? null,
        tradeCategory: input.tradeCategory ?? null,
        validityMonths: input.validityMonths ?? 12,
        questionsJson: questions,
        scoringRules: scoring,
        createdByUserId: ctx.user.id,
      })
      .returning({ id: prequalTemplates.id });

    await writeOrgAuditEvent(
      ctx,
      {
        action: "created",
        resourceType: "prequal_template",
        resourceId: row.id,
        details: {
          nextState: {
            name: input.name,
            tradeCategory: input.tradeCategory ?? null,
            validityMonths: input.validityMonths ?? 12,
            questionCount: questions.length,
          },
        },
      },
      tx,
    );

    return row;
  });

  return { id: result.id };
}

export type UpdatePrequalTemplateInput = {
  session: SessionLike | null | undefined;
  templateId: string;
  patch: {
    name?: string;
    description?: string | null;
    tradeCategory?: string | null;
    validityMonths?: number | null;
    questions?: PrequalQuestion[];
    scoringRules?: PrequalScoringRules;
  };
};

export async function updatePrequalTemplate(
  input: UpdatePrequalTemplateInput,
): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_template", "write");
  await ensureFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select()
    .from(prequalTemplates)
    .where(eq(prequalTemplates.id, input.templateId))
    .limit(1);
  if (!row) throw new AuthorizationError("Template not found", "not_found");
  if (row.orgId !== ctx.organization.id) {
    throw new AuthorizationError("Template not yours", "forbidden");
  }
  if (row.archivedAt) {
    throw new AuthorizationError("Cannot edit archived template", "forbidden");
  }

  if (input.patch.questions) validateQuestionsArray(input.patch.questions);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.patch.name !== undefined) updates.name = input.patch.name;
  if (input.patch.description !== undefined)
    updates.description = input.patch.description;
  if (input.patch.tradeCategory !== undefined)
    updates.tradeCategory = input.patch.tradeCategory;
  if (input.patch.validityMonths !== undefined)
    updates.validityMonths = input.patch.validityMonths;
  if (input.patch.questions !== undefined)
    updates.questionsJson = input.patch.questions;
  if (input.patch.scoringRules !== undefined)
    updates.scoringRules = input.patch.scoringRules;

  await db.transaction(async (tx) => {
    await tx
      .update(prequalTemplates)
      .set(updates)
      .where(eq(prequalTemplates.id, input.templateId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "updated",
        resourceType: "prequal_template",
        resourceId: input.templateId,
        details: {
          metadata: {
            fieldsChanged: Object.keys(updates).filter((k) => k !== "updatedAt"),
          },
        },
      },
      tx,
    );
  });
}

export async function archivePrequalTemplate(input: {
  session: SessionLike | null | undefined;
  templateId: string;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_template", "write");
  await ensureFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select()
    .from(prequalTemplates)
    .where(eq(prequalTemplates.id, input.templateId))
    .limit(1);
  if (!row) throw new AuthorizationError("Template not found", "not_found");
  if (row.orgId !== ctx.organization.id) {
    throw new AuthorizationError("Template not yours", "forbidden");
  }
  if (row.archivedAt) return;

  await db.transaction(async (tx) => {
    await tx
      .update(prequalTemplates)
      .set({
        archivedAt: new Date(),
        isDefault: false, // archived templates can't be defaults
        updatedAt: new Date(),
      })
      .where(eq(prequalTemplates.id, input.templateId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "archived",
        resourceType: "prequal_template",
        resourceId: input.templateId,
      },
      tx,
    );
  });
}

// Mark a template as the default for its (orgId, tradeCategory) tuple.
// Un-defaults the previous default in the same tuple atomically.
export async function setDefaultPrequalTemplate(input: {
  session: SessionLike | null | undefined;
  templateId: string;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_template", "write");
  await ensureFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select()
    .from(prequalTemplates)
    .where(eq(prequalTemplates.id, input.templateId))
    .limit(1);
  if (!row) throw new AuthorizationError("Template not found", "not_found");
  if (row.orgId !== ctx.organization.id) {
    throw new AuthorizationError("Template not yours", "forbidden");
  }
  if (row.archivedAt) {
    throw new AuthorizationError(
      "Archived templates cannot be defaults",
      "forbidden",
    );
  }
  if (row.isDefault) return; // already the default

  await db.transaction(async (tx) => {
    // Un-default any sibling for the same (org, trade) tuple.
    await tx
      .update(prequalTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(prequalTemplates.orgId, ctx.organization.id),
          row.tradeCategory == null
            ? isNull(prequalTemplates.tradeCategory)
            : eq(prequalTemplates.tradeCategory, row.tradeCategory),
          eq(prequalTemplates.isDefault, true),
        ),
      );

    await tx
      .update(prequalTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(prequalTemplates.id, input.templateId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "marked_default",
        resourceType: "prequal_template",
        resourceId: input.templateId,
        details: {
          nextState: { tradeCategory: row.tradeCategory ?? null },
        },
      },
      tx,
    );
  });
}

// Used by the invite action to pick the right template if the contractor
// doesn't specify one explicitly.
export async function resolveDefaultTemplate(input: {
  contractorOrgId: string;
  subTrade: string | null;
}): Promise<string | null> {
  const candidates = await db
    .select({
      id: prequalTemplates.id,
      tradeCategory: prequalTemplates.tradeCategory,
    })
    .from(prequalTemplates)
    .where(
      and(
        eq(prequalTemplates.orgId, input.contractorOrgId),
        isNull(prequalTemplates.archivedAt),
        eq(prequalTemplates.isDefault, true),
      ),
    );
  return (
    candidates.find((c) => input.subTrade && c.tradeCategory === input.subTrade)
      ?.id ??
    candidates.find((c) => c.tradeCategory == null)?.id ??
    null
  );
}

// Internal helper used by sub-side draft action — returns the latest
// non-rejected/non-expired submission for the (sub, contractor) pair so
// we don't create dupes.
export async function getActiveDraftSubmission(input: {
  contractorOrgId: string;
  subOrgId: string;
}): Promise<{ id: string; templateId: string } | null> {
  const [row] = await db
    .select({
      id: prequalSubmissions.id,
      templateId: prequalSubmissions.templateId,
      status: prequalSubmissions.status,
    })
    .from(prequalSubmissions)
    .where(
      and(
        eq(prequalSubmissions.contractorOrgId, input.contractorOrgId),
        eq(prequalSubmissions.submittedByOrgId, input.subOrgId),
      ),
    )
    .orderBy(prequalSubmissions.createdAt)
    .limit(1);
  if (!row) return null;
  if (row.status === "draft" || row.status === "submitted" || row.status === "under_review") {
    return { id: row.id, templateId: row.templateId };
  }
  return null;
}
