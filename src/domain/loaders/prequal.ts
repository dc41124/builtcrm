import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import {
  organizations,
  prequalDocuments,
  prequalProjectExemptions,
  prequalSubmissions,
  prequalTemplates,
  users,
} from "@/db/schema";
import { getOrgContext, type SessionLike } from "@/domain/context";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { requireFeature } from "@/domain/policies/plan";

// -----------------------------------------------------------------------------
// Shared row types
// -----------------------------------------------------------------------------

export type PrequalSubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export type PrequalDocumentType =
  | "bond"
  | "insurance"
  | "safety_manual"
  | "references"
  | "financial_statements";

export type PrequalEnforcementMode = "off" | "warn" | "block";

// Public projection of a submission's badge state. Used by the badge
// component and the assignment hook. Drafts collapse to "none" so the
// public surface doesn't leak in-flight work the contractor never saw.
export type PrequalBadgeStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "expired"
  | "none";

export type PrequalTemplateRow = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  tradeCategory: string | null;
  isDefault: boolean;
  validityMonths: number | null;
  questionCount: number;
  passThreshold: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrequalQuestion = {
  key: string;
  label: string;
  type:
    | "short_text"
    | "long_text"
    | "yes_no"
    | "number"
    | "select_one"
    | "multi_select";
  required: boolean;
  helpText?: string;
  weight?: number;
  unit?: string;
  options?: Array<{ key: string; label: string; points?: number }>;
  scoreBands?: Array<{ min: number; max: number; points: number }>;
  gating?: boolean;
};

export type PrequalScoringRules = {
  passThreshold: number;
  gatingFailValues: Record<string, string | boolean | string[]>;
};

export type PrequalTemplateDetail = PrequalTemplateRow & {
  questions: PrequalQuestion[];
  scoringRules: PrequalScoringRules;
};

export type PrequalSubmissionListRow = {
  id: string;
  templateId: string;
  templateName: string;
  tradeCategory: string | null;
  submittedByOrgId: string;
  submittedByOrgName: string;
  contractorOrgId: string;
  contractorOrgName: string;
  status: PrequalSubmissionStatus;
  scoreTotal: number | null;
  passThreshold: number;
  hasGatingFailures: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type PrequalDocumentRow = {
  id: string;
  documentType: PrequalDocumentType;
  title: string;
  fileSizeBytes: number;
  mimeType: string;
  label: string | null;
  uploadedByUserId: string;
  uploadedByName: string | null;
  createdAt: string;
};

export type PrequalSubmissionDetail = PrequalSubmissionListRow & {
  template: PrequalTemplateDetail;
  answers: Record<string, unknown>;
  gatingFailures: string[];
  reviewerNotes: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  documents: PrequalDocumentRow[];
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseQuestions(json: unknown): PrequalQuestion[] {
  if (!Array.isArray(json)) return [];
  return json as PrequalQuestion[];
}

function parseScoringRules(json: unknown): PrequalScoringRules {
  const fallback: PrequalScoringRules = {
    passThreshold: 0,
    gatingFailValues: {},
  };
  if (!json || typeof json !== "object") return fallback;
  const obj = json as Partial<PrequalScoringRules>;
  return {
    passThreshold:
      typeof obj.passThreshold === "number" ? obj.passThreshold : 0,
    gatingFailValues:
      obj.gatingFailValues && typeof obj.gatingFailValues === "object"
        ? obj.gatingFailValues
        : {},
  };
}

async function ensureContractorPlanFeature(
  orgId: string,
  organizationType: string,
): Promise<void> {
  // Plan gating only applies to contractor orgs (subs + clients never pay).
  // Subcontractor surfaces of the prequal feature read freely — they're
  // responding to a contractor that's already paying.
  if (organizationType !== "contractor") return;
  const planCtx = await getOrgPlanContext(orgId);
  requireFeature(planCtx, "prequalification");
}

function rowToTemplateRow(
  row: typeof prequalTemplates.$inferSelect & {
    submissionCount?: number;
  },
): PrequalTemplateRow {
  const questions = parseQuestions(row.questionsJson);
  const scoring = parseScoringRules(row.scoringRules);
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    tradeCategory: row.tradeCategory,
    isDefault: row.isDefault,
    validityMonths: row.validityMonths,
    questionCount: questions.length,
    passThreshold: scoring.passThreshold,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Contractor surfaces (org-scoped)
// -----------------------------------------------------------------------------

export async function getPrequalTemplatesView(input: {
  session: SessionLike | null | undefined;
}): Promise<{ rows: PrequalTemplateRow[] }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_template", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const rows = await db
    .select()
    .from(prequalTemplates)
    .where(eq(prequalTemplates.orgId, ctx.organization.id))
    .orderBy(
      // Active templates first, archived at the bottom; within each group,
      // defaults float to the top.
      asc(prequalTemplates.archivedAt),
      desc(prequalTemplates.isDefault),
      asc(prequalTemplates.name),
    );

  return { rows: rows.map(rowToTemplateRow) };
}

export async function getPrequalTemplateDetailView(input: {
  session: SessionLike | null | undefined;
  templateId: string;
}): Promise<PrequalTemplateDetail> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_template", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select()
    .from(prequalTemplates)
    .where(eq(prequalTemplates.id, input.templateId))
    .limit(1);
  if (!row) {
    throw new AuthorizationError("Template not found", "not_found");
  }
  if (row.orgId !== ctx.organization.id) {
    throw new AuthorizationError("Template not visible", "forbidden");
  }

  const head = rowToTemplateRow(row);
  return {
    ...head,
    questions: parseQuestions(row.questionsJson),
    scoringRules: parseScoringRules(row.scoringRules),
  };
}

// -----------------------------------------------------------------------------
// Review queue (cross-project inbox of submissions for a contractor)
// -----------------------------------------------------------------------------

export type PrequalReviewQueueFilters = {
  statuses?: PrequalSubmissionStatus[];
  tradeCategory?: string;
  subOrgId?: string;
  expiringWithinDays?: number;
};

export async function getPrequalReviewQueueView(input: {
  session: SessionLike | null | undefined;
  filters?: PrequalReviewQueueFilters;
}): Promise<{ rows: PrequalSubmissionListRow[] }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const filters = input.filters ?? {};
  const statusFilter =
    filters.statuses && filters.statuses.length > 0
      ? filters.statuses
      : (["submitted", "under_review"] as PrequalSubmissionStatus[]);

  const conditions = [
    eq(prequalSubmissions.contractorOrgId, ctx.organization.id),
    inArray(prequalSubmissions.status, statusFilter),
  ];
  if (filters.subOrgId) {
    conditions.push(
      eq(prequalSubmissions.submittedByOrgId, filters.subOrgId),
    );
  }
  if (filters.expiringWithinDays != null) {
    conditions.push(
      sql`${prequalSubmissions.expiresAt} IS NOT NULL AND ${prequalSubmissions.expiresAt} <= now() + (${filters.expiringWithinDays} || ' days')::interval`,
    );
  }

  const rows = await db
    .select({
      id: prequalSubmissions.id,
      templateId: prequalSubmissions.templateId,
      templateName: prequalTemplates.name,
      tradeCategory: prequalTemplates.tradeCategory,
      scoringRules: prequalTemplates.scoringRules,
      submittedByOrgId: prequalSubmissions.submittedByOrgId,
      submittedByOrgName: organizations.name,
      contractorOrgId: prequalSubmissions.contractorOrgId,
      status: prequalSubmissions.status,
      scoreTotal: prequalSubmissions.scoreTotal,
      gatingFailures: prequalSubmissions.gatingFailures,
      submittedAt: prequalSubmissions.submittedAt,
      reviewedAt: prequalSubmissions.reviewedAt,
      expiresAt: prequalSubmissions.expiresAt,
      createdAt: prequalSubmissions.createdAt,
    })
    .from(prequalSubmissions)
    .innerJoin(
      prequalTemplates,
      eq(prequalTemplates.id, prequalSubmissions.templateId),
    )
    .innerJoin(
      organizations,
      eq(organizations.id, prequalSubmissions.submittedByOrgId),
    )
    .where(and(...conditions))
    .orderBy(desc(prequalSubmissions.submittedAt));

  // Optional trade-category filter — applied post-query because it's on
  // template, not submission. Cheap (review queues are small).
  const filtered = filters.tradeCategory
    ? rows.filter((r) => r.tradeCategory === filters.tradeCategory)
    : rows;

  return {
    rows: filtered.map((r) => {
      const scoring = parseScoringRules(r.scoringRules);
      const gatingArr = Array.isArray(r.gatingFailures)
        ? (r.gatingFailures as string[])
        : [];
      return {
        id: r.id,
        templateId: r.templateId,
        templateName: r.templateName,
        tradeCategory: r.tradeCategory,
        submittedByOrgId: r.submittedByOrgId,
        submittedByOrgName: r.submittedByOrgName,
        contractorOrgId: r.contractorOrgId,
        contractorOrgName: ctx.organization.name,
        status: r.status as PrequalSubmissionStatus,
        scoreTotal: r.scoreTotal,
        passThreshold: scoring.passThreshold,
        hasGatingFailures: gatingArr.length > 0,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  };
}

// -----------------------------------------------------------------------------
// Submission detail (review side)
// -----------------------------------------------------------------------------

export async function getPrequalSubmissionDetailView(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
}): Promise<PrequalSubmissionDetail> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const [row] = await db
    .select({
      sub: prequalSubmissions,
      template: prequalTemplates,
    })
    .from(prequalSubmissions)
    .innerJoin(
      prequalTemplates,
      eq(prequalTemplates.id, prequalSubmissions.templateId),
    )
    .where(eq(prequalSubmissions.id, input.submissionId))
    .limit(1);
  if (!row) {
    throw new AuthorizationError("Submission not found", "not_found");
  }

  // Per-row org scoping: contractor side or sub side.
  const isContractorReader =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSubReader = ctx.role === "subcontractor_user";
  const orgMatches =
    (isContractorReader && row.sub.contractorOrgId === ctx.organization.id) ||
    (isSubReader && row.sub.submittedByOrgId === ctx.organization.id);
  if (!orgMatches) {
    throw new AuthorizationError("Submission not visible", "forbidden");
  }

  const [submittedByOrg, contractorOrg, reviewer] = await Promise.all([
    db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, row.sub.submittedByOrgId))
      .limit(1),
    db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, row.sub.contractorOrgId))
      .limit(1),
    row.sub.reviewedByUserId
      ? db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.sub.reviewedByUserId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const docRows = await db
    .select({
      id: prequalDocuments.id,
      documentType: prequalDocuments.documentType,
      title: prequalDocuments.title,
      fileSizeBytes: prequalDocuments.fileSizeBytes,
      mimeType: prequalDocuments.mimeType,
      label: prequalDocuments.label,
      uploadedByUserId: prequalDocuments.uploadedByUserId,
      uploadedByName: users.displayName,
      createdAt: prequalDocuments.createdAt,
    })
    .from(prequalDocuments)
    .leftJoin(users, eq(users.id, prequalDocuments.uploadedByUserId))
    .where(eq(prequalDocuments.submissionId, row.sub.id))
    .orderBy(asc(prequalDocuments.createdAt));

  const scoring = parseScoringRules(row.template.scoringRules);
  const questions = parseQuestions(row.template.questionsJson);
  const templateHead = rowToTemplateRow(row.template);
  const templateDetail: PrequalTemplateDetail = {
    ...templateHead,
    questions,
    scoringRules: scoring,
  };

  const gatingArr = Array.isArray(row.sub.gatingFailures)
    ? (row.sub.gatingFailures as string[])
    : [];
  const answers =
    row.sub.answersJson && typeof row.sub.answersJson === "object"
      ? (row.sub.answersJson as Record<string, unknown>)
      : {};

  return {
    id: row.sub.id,
    templateId: row.sub.templateId,
    templateName: row.template.name,
    tradeCategory: row.template.tradeCategory,
    submittedByOrgId: row.sub.submittedByOrgId,
    submittedByOrgName: submittedByOrg[0]?.name ?? "",
    contractorOrgId: row.sub.contractorOrgId,
    contractorOrgName: contractorOrg[0]?.name ?? "",
    status: row.sub.status as PrequalSubmissionStatus,
    scoreTotal: row.sub.scoreTotal,
    passThreshold: scoring.passThreshold,
    hasGatingFailures: gatingArr.length > 0,
    submittedAt: row.sub.submittedAt
      ? row.sub.submittedAt.toISOString()
      : null,
    reviewedAt: row.sub.reviewedAt ? row.sub.reviewedAt.toISOString() : null,
    expiresAt: row.sub.expiresAt ? row.sub.expiresAt.toISOString() : null,
    createdAt: row.sub.createdAt.toISOString(),
    template: templateDetail,
    answers,
    gatingFailures: gatingArr,
    reviewerNotes: row.sub.reviewerNotes,
    reviewedByUserId: row.sub.reviewedByUserId,
    reviewedByName: reviewer[0]?.displayName ?? null,
    documents: docRows.map((d) => ({
      id: d.id,
      documentType: d.documentType as PrequalDocumentType,
      title: d.title,
      fileSizeBytes: Number(d.fileSizeBytes ?? 0),
      mimeType: d.mimeType,
      label: d.label,
      uploadedByUserId: d.uploadedByUserId,
      uploadedByName: d.uploadedByName,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

// -----------------------------------------------------------------------------
// Per-sub history (contractor side)
// -----------------------------------------------------------------------------

export async function getPrequalSubcontractorHistoryView(input: {
  session: SessionLike | null | undefined;
  subOrgId: string;
}): Promise<{ rows: PrequalSubmissionListRow[] }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const rows = await db
    .select({
      id: prequalSubmissions.id,
      templateId: prequalSubmissions.templateId,
      templateName: prequalTemplates.name,
      tradeCategory: prequalTemplates.tradeCategory,
      scoringRules: prequalTemplates.scoringRules,
      submittedByOrgId: prequalSubmissions.submittedByOrgId,
      submittedByOrgName: organizations.name,
      contractorOrgId: prequalSubmissions.contractorOrgId,
      status: prequalSubmissions.status,
      scoreTotal: prequalSubmissions.scoreTotal,
      gatingFailures: prequalSubmissions.gatingFailures,
      submittedAt: prequalSubmissions.submittedAt,
      reviewedAt: prequalSubmissions.reviewedAt,
      expiresAt: prequalSubmissions.expiresAt,
      createdAt: prequalSubmissions.createdAt,
    })
    .from(prequalSubmissions)
    .innerJoin(
      prequalTemplates,
      eq(prequalTemplates.id, prequalSubmissions.templateId),
    )
    .innerJoin(
      organizations,
      eq(organizations.id, prequalSubmissions.submittedByOrgId),
    )
    .where(
      and(
        eq(prequalSubmissions.contractorOrgId, ctx.organization.id),
        eq(prequalSubmissions.submittedByOrgId, input.subOrgId),
      ),
    )
    .orderBy(desc(prequalSubmissions.createdAt));

  return {
    rows: rows.map((r) => {
      const scoring = parseScoringRules(r.scoringRules);
      const gatingArr = Array.isArray(r.gatingFailures)
        ? (r.gatingFailures as string[])
        : [];
      return {
        id: r.id,
        templateId: r.templateId,
        templateName: r.templateName,
        tradeCategory: r.tradeCategory,
        submittedByOrgId: r.submittedByOrgId,
        submittedByOrgName: r.submittedByOrgName,
        contractorOrgId: r.contractorOrgId,
        contractorOrgName: ctx.organization.name,
        status: r.status as PrequalSubmissionStatus,
        scoreTotal: r.scoreTotal,
        passThreshold: scoring.passThreshold,
        hasGatingFailures: gatingArr.length > 0,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  };
}

// -----------------------------------------------------------------------------
// Enforcement settings
// -----------------------------------------------------------------------------

export type PrequalEnforcementSettingsView = {
  mode: PrequalEnforcementMode;
  activeExemptions: Array<{
    id: string;
    projectId: string;
    subOrgId: string;
    subOrgName: string;
    grantedAt: string;
    grantedByName: string | null;
    expiresAt: string | null;
    reason: string;
  }>;
};

export async function getPrequalEnforcementSettingsView(input: {
  session: SessionLike | null | undefined;
}): Promise<PrequalEnforcementSettingsView> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_enforcement_settings", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const [org] = await db
    .select({ mode: organizations.prequalEnforcementMode })
    .from(organizations)
    .where(eq(organizations.id, ctx.organization.id))
    .limit(1);

  const exemptions = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({
        id: prequalProjectExemptions.id,
        projectId: prequalProjectExemptions.projectId,
        subOrgId: prequalProjectExemptions.subOrgId,
        subOrgName: organizations.name,
        grantedAt: prequalProjectExemptions.grantedAt,
        grantedByName: users.displayName,
        expiresAt: prequalProjectExemptions.expiresAt,
        reason: prequalProjectExemptions.reason,
      })
      .from(prequalProjectExemptions)
      .innerJoin(
        organizations,
        eq(organizations.id, prequalProjectExemptions.subOrgId),
      )
      .leftJoin(users, eq(users.id, prequalProjectExemptions.grantedByUserId))
      .where(
        and(
          eq(prequalProjectExemptions.contractorOrgId, ctx.organization.id),
          isNull(prequalProjectExemptions.revokedAt),
        ),
      )
      .orderBy(desc(prequalProjectExemptions.grantedAt)),
  );

  return {
    mode: (org?.mode ?? "off") as PrequalEnforcementMode,
    activeExemptions: exemptions.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      subOrgId: e.subOrgId,
      subOrgName: e.subOrgName,
      grantedAt: e.grantedAt.toISOString(),
      grantedByName: e.grantedByName,
      expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
      reason: e.reason,
    })),
  };
}

// -----------------------------------------------------------------------------
// Subcontractor surfaces
// -----------------------------------------------------------------------------

export type SubPrequalListRow = {
  contractorOrgId: string;
  contractorOrgName: string;
  // The most recent submission for this contractor, if any. Drives the
  // status pill on the sub's "Prequalification" landing.
  latestSubmissionId: string | null;
  latestStatus: PrequalSubmissionStatus | null;
  latestSubmittedAt: string | null;
  latestReviewedAt: string | null;
  latestExpiresAt: string | null;
};

export async function getSubPrequalListView(input: {
  session: SessionLike | null | undefined;
}): Promise<{ rows: SubPrequalListRow[] }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "read");
  // Subs don't pay; no plan feature gate on the sub side. The contractor
  // who invited them is the paying party — if they don't have the feature,
  // the invite never gets created in the first place.

  if (ctx.role !== "subcontractor_user") {
    throw new AuthorizationError(
      "This view is for subcontractor users only",
      "forbidden",
    );
  }

  // One row per contractor that has any submission from this sub. Pick the
  // most recent submission per contractor via window-style aggregation.
  const subs = await db
    .select({
      id: prequalSubmissions.id,
      contractorOrgId: prequalSubmissions.contractorOrgId,
      status: prequalSubmissions.status,
      submittedAt: prequalSubmissions.submittedAt,
      reviewedAt: prequalSubmissions.reviewedAt,
      expiresAt: prequalSubmissions.expiresAt,
      createdAt: prequalSubmissions.createdAt,
    })
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.submittedByOrgId, ctx.organization.id))
    .orderBy(desc(prequalSubmissions.createdAt));

  // Group by contractor; first row per contractor is most recent because
  // the query is sorted desc.
  const byContractor = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    if (!byContractor.has(s.contractorOrgId)) {
      byContractor.set(s.contractorOrgId, s);
    }
  }

  const contractorIds = Array.from(byContractor.keys());
  const orgRows = contractorIds.length
    ? await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(inArray(organizations.id, contractorIds))
    : [];
  const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

  return {
    rows: contractorIds.map((cid) => {
      const sub = byContractor.get(cid)!;
      return {
        contractorOrgId: cid,
        contractorOrgName: orgNameById.get(cid) ?? "Unknown contractor",
        latestSubmissionId: sub.id,
        latestStatus: sub.status as PrequalSubmissionStatus,
        latestSubmittedAt: sub.submittedAt
          ? sub.submittedAt.toISOString()
          : null,
        latestReviewedAt: sub.reviewedAt
          ? sub.reviewedAt.toISOString()
          : null,
        latestExpiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
      };
    }),
  };
}

// Form data the sub sees when filling for a specific contractor: the active
// (or default) template + their current draft (if any). Tells the renderer
// what to draw and what to prefill.
export type SubPrequalFormView = {
  contractorOrgId: string;
  contractorOrgName: string;
  template: PrequalTemplateDetail;
  submission: {
    id: string;
    status: PrequalSubmissionStatus;
    answers: Record<string, unknown>;
    documents: PrequalDocumentRow[];
    submittedAt: string | null;
    reviewerNotes: string | null;
  } | null;
};

export async function getSubPrequalFormView(input: {
  session: SessionLike | null | undefined;
  contractorOrgId: string;
}): Promise<SubPrequalFormView> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "write");
  if (ctx.role !== "subcontractor_user") {
    throw new AuthorizationError("Sub-only surface", "forbidden");
  }

  const [contractorOrg] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, input.contractorOrgId))
    .limit(1);
  if (!contractorOrg) {
    throw new AuthorizationError("Contractor not found", "not_found");
  }

  // Most-recent submission for this (sub, contractor) pair. The renderer
  // either continues a draft or shows the read-only view of the latest
  // submission depending on its status.
  const [latestSub] = await db
    .select()
    .from(prequalSubmissions)
    .where(
      and(
        eq(prequalSubmissions.submittedByOrgId, ctx.organization.id),
        eq(prequalSubmissions.contractorOrgId, input.contractorOrgId),
      ),
    )
    .orderBy(desc(prequalSubmissions.createdAt))
    .limit(1);

  // Resolve template: either the one the sub is filling against, or the
  // contractor's current default. The default-resolution rule prefers a
  // sub-trade match, falls back to the global default.
  let templateRow: typeof prequalTemplates.$inferSelect | undefined;
  if (latestSub) {
    [templateRow] = await db
      .select()
      .from(prequalTemplates)
      .where(eq(prequalTemplates.id, latestSub.templateId))
      .limit(1);
  } else {
    const [subOrg] = await db
      .select({ trade: organizations.primaryTrade })
      .from(organizations)
      .where(eq(organizations.id, ctx.organization.id))
      .limit(1);
    const candidateTemplates = await db
      .select()
      .from(prequalTemplates)
      .where(
        and(
          eq(prequalTemplates.orgId, input.contractorOrgId),
          isNull(prequalTemplates.archivedAt),
          eq(prequalTemplates.isDefault, true),
        ),
      );
    templateRow =
      candidateTemplates.find(
        (t) => subOrg?.trade && t.tradeCategory === subOrg.trade,
      ) ?? candidateTemplates.find((t) => t.tradeCategory == null);
  }
  if (!templateRow) {
    throw new AuthorizationError(
      "No prequalification template available from this contractor yet.",
      "not_found",
    );
  }

  const templateHead = rowToTemplateRow(templateRow);
  const template: PrequalTemplateDetail = {
    ...templateHead,
    questions: parseQuestions(templateRow.questionsJson),
    scoringRules: parseScoringRules(templateRow.scoringRules),
  };

  let submissionView: SubPrequalFormView["submission"] = null;
  if (latestSub) {
    const docRows = await db
      .select({
        id: prequalDocuments.id,
        documentType: prequalDocuments.documentType,
        title: prequalDocuments.title,
        fileSizeBytes: prequalDocuments.fileSizeBytes,
        mimeType: prequalDocuments.mimeType,
        label: prequalDocuments.label,
        uploadedByUserId: prequalDocuments.uploadedByUserId,
        uploadedByName: users.displayName,
        createdAt: prequalDocuments.createdAt,
      })
      .from(prequalDocuments)
      .leftJoin(users, eq(users.id, prequalDocuments.uploadedByUserId))
      .where(eq(prequalDocuments.submissionId, latestSub.id))
      .orderBy(asc(prequalDocuments.createdAt));

    submissionView = {
      id: latestSub.id,
      status: latestSub.status as PrequalSubmissionStatus,
      answers:
        latestSub.answersJson && typeof latestSub.answersJson === "object"
          ? (latestSub.answersJson as Record<string, unknown>)
          : {},
      documents: docRows.map((d) => ({
        id: d.id,
        documentType: d.documentType as PrequalDocumentType,
        title: d.title,
        fileSizeBytes: Number(d.fileSizeBytes ?? 0),
        mimeType: d.mimeType,
        label: d.label,
        uploadedByUserId: d.uploadedByUserId,
        uploadedByName: d.uploadedByName,
        createdAt: d.createdAt.toISOString(),
      })),
      submittedAt: latestSub.submittedAt
        ? latestSub.submittedAt.toISOString()
        : null,
      reviewerNotes: latestSub.reviewerNotes,
    };
  }

  return {
    contractorOrgId: contractorOrg.id,
    contractorOrgName: contractorOrg.name,
    template,
    submission: submissionView,
  };
}

// Read-only sub view of one submission. Reuses the contractor detail loader
// and strips the score (subs never see the score).
export async function getSubPrequalSubmissionView(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
}): Promise<Omit<PrequalSubmissionDetail, "scoreTotal">> {
  const detail = await getPrequalSubmissionDetailView({
    session: input.session,
    submissionId: input.submissionId,
  });
  // The detail loader already enforces sub-org-match for sub readers.
  // Strip the score before returning — design proposal §2.7 ("Subs do
  // NOT see the score they got").
  const { scoreTotal: _scoreTotal, ...rest } = detail;
  void _scoreTotal;
  return rest;
}

// -----------------------------------------------------------------------------
// Shared — getActivePrequalForPair
//
// First use of `react.cache` in this codebase. It memoizes per-request so a
// page rendering N badges only hits the DB once per (contractorOrgId,
// subOrgId) pair, even if the badges live on different subtrees.
// -----------------------------------------------------------------------------

// Workspace-shaped view used by the contractor queue page (master-detail).
// Returns ALL submissions for the contractor org plus a precomputed per-tab
// bucket count and active-exemption count so the page renders the stat strip,
// tab counts, and selected-detail without separate calls.
export type PrequalQueueView = {
  rows: PrequalSubmissionListRow[];
  counts: {
    review: number;
    under_review: number;
    approved: number;
    expiring: number;
    rejected: number;
    overrides: number;
  };
};

const EXPIRING_DAYS = 30;

export async function getPrequalQueueView(input: {
  session: SessionLike | null | undefined;
}): Promise<PrequalQueueView> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "read");
  await ensureContractorPlanFeature(ctx.organization.id, ctx.organization.type);

  const rows = await db
    .select({
      id: prequalSubmissions.id,
      templateId: prequalSubmissions.templateId,
      templateName: prequalTemplates.name,
      tradeCategory: prequalTemplates.tradeCategory,
      scoringRules: prequalTemplates.scoringRules,
      submittedByOrgId: prequalSubmissions.submittedByOrgId,
      submittedByOrgName: organizations.name,
      contractorOrgId: prequalSubmissions.contractorOrgId,
      status: prequalSubmissions.status,
      scoreTotal: prequalSubmissions.scoreTotal,
      gatingFailures: prequalSubmissions.gatingFailures,
      submittedAt: prequalSubmissions.submittedAt,
      reviewedAt: prequalSubmissions.reviewedAt,
      expiresAt: prequalSubmissions.expiresAt,
      createdAt: prequalSubmissions.createdAt,
    })
    .from(prequalSubmissions)
    .innerJoin(
      prequalTemplates,
      eq(prequalTemplates.id, prequalSubmissions.templateId),
    )
    .innerJoin(
      organizations,
      eq(organizations.id, prequalSubmissions.submittedByOrgId),
    )
    .where(eq(prequalSubmissions.contractorOrgId, ctx.organization.id))
    .orderBy(desc(prequalSubmissions.createdAt));

  const list: PrequalSubmissionListRow[] = rows.map((r) => {
    const scoring = parseScoringRules(r.scoringRules);
    const gatingArr = Array.isArray(r.gatingFailures)
      ? (r.gatingFailures as string[])
      : [];
    return {
      id: r.id,
      templateId: r.templateId,
      templateName: r.templateName,
      tradeCategory: r.tradeCategory,
      submittedByOrgId: r.submittedByOrgId,
      submittedByOrgName: r.submittedByOrgName,
      contractorOrgId: r.contractorOrgId,
      contractorOrgName: ctx.organization.name,
      status: r.status as PrequalSubmissionStatus,
      scoreTotal: r.scoreTotal,
      passThreshold: scoring.passThreshold,
      hasGatingFailures: gatingArr.length > 0,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const cutoff = Date.now() + EXPIRING_DAYS * 24 * 60 * 60 * 1000;
  const exemptionRows = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({ id: prequalProjectExemptions.id })
      .from(prequalProjectExemptions)
      .where(
        and(
          eq(prequalProjectExemptions.contractorOrgId, ctx.organization.id),
          isNull(prequalProjectExemptions.revokedAt),
        ),
      ),
  );

  const counts = {
    review: list.filter((r) => r.status === "submitted").length,
    under_review: list.filter((r) => r.status === "under_review").length,
    approved: list.filter((r) => r.status === "approved").length,
    expiring: list.filter(
      (r) =>
        r.status === "approved" &&
        r.expiresAt != null &&
        new Date(r.expiresAt).getTime() <= cutoff,
    ).length,
    rejected: list.filter((r) => r.status === "rejected").length,
    overrides: exemptionRows.length,
  };

  return { rows: list, counts };
}

// Sub portal nav-visibility helper. Returns `true` if the signed-in
// subcontractor has at least one prequal_submissions row from any
// contractor — meaning at least one contractor has invited them, so
// the "Prequalification" nav entry is meaningful to render. Returns
// `false` for non-subcontractor users (the nav builder hides the entry
// regardless on contractor/client portals — this gate is sub-only).
export async function getSubPrequalNavVisibility(
  session: SessionLike | null | undefined,
): Promise<boolean> {
  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "subcontractor_user") return false;
    const [row] = await db
      .select({ id: prequalSubmissions.id })
      .from(prequalSubmissions)
      .where(eq(prequalSubmissions.submittedByOrgId, ctx.organization.id))
      .limit(1);
    return !!row;
  } catch {
    return false;
  }
}

export const getActivePrequalForPair = cache(
  async (
    contractorOrgId: string,
    subOrgId: string,
  ): Promise<{
    status: PrequalBadgeStatus;
    submissionId?: string;
    expiresAt?: Date;
  }> => {
    const [latest] = await db
      .select({
        id: prequalSubmissions.id,
        status: prequalSubmissions.status,
        expiresAt: prequalSubmissions.expiresAt,
      })
      .from(prequalSubmissions)
      .where(
        and(
          eq(prequalSubmissions.contractorOrgId, contractorOrgId),
          eq(prequalSubmissions.submittedByOrgId, subOrgId),
        ),
      )
      .orderBy(desc(prequalSubmissions.createdAt))
      .limit(1);

    if (!latest) return { status: "none" };

    const dbStatus = latest.status as PrequalSubmissionStatus;
    let badgeStatus: PrequalBadgeStatus;
    switch (dbStatus) {
      case "draft":
        badgeStatus = "none";
        break;
      case "submitted":
      case "under_review":
        badgeStatus = "pending";
        break;
      case "approved":
        // Treat past-expiry "approved" rows as expired even if the daily
        // sweep hasn't flipped the column yet. Keeps the badge truthful.
        badgeStatus =
          latest.expiresAt && latest.expiresAt.getTime() < Date.now()
            ? "expired"
            : "approved";
        break;
      case "rejected":
        badgeStatus = "rejected";
        break;
      case "expired":
        badgeStatus = "expired";
        break;
    }

    return {
      status: badgeStatus,
      submissionId: latest.id,
      expiresAt: latest.expiresAt ?? undefined,
    };
  },
);
