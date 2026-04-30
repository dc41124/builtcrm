import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import {
  safetyFormIncidents,
  safetyFormTemplateAssignments,
  safetyFormTemplates,
  safetyForms,
  type SafetyTemplateField,
} from "@/db/schema";
import { organizations, users } from "@/db/schema";
import { getEffectiveContext, getOrgContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  SAFETY_FORM_TYPE_LABELS,
  SAFETY_SEVERITY_CONFIG,
  type SafetyFormType,
  type SafetySeverity,
} from "@/lib/safety-forms/severity-labels";

// ─────────────────────────────────────────────────────────────────────────
// Workspace loader — contractor's project safety-forms page.
// Returns submissions list (with severity for incidents), KPI totals,
// type breakdown for the right rail, and recent activity.
// ─────────────────────────────────────────────────────────────────────────

export interface SafetyFormSubmissionRow {
  id: string;
  formNumber: string;
  title: string;
  formType: SafetyFormType;
  status: "draft" | "submitted";
  submittedAt: Date | null;
  submittedByUserName: string;
  submittedByOrgName: string;
  flagged: boolean;
  flagReason: string | null;
  severity: SafetySeverity | null;
  attendeesCount: number;
  hasPhoto: boolean;
  hasSignature: boolean;
}

export interface SafetyFormsWorkspaceView {
  projectId: string;
  rows: SafetyFormSubmissionRow[];
  kpis: {
    total: number;
    toolboxTalks: number;
    incidents: number;
    nearMisses: number;
    openOrQueued: number;
  };
  typeSummary: Array<{
    type: SafetyFormType;
    submitted: number;
    last7d: number;
  }>;
}

export async function getContractorSafetyFormsWorkspace(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<SafetyFormsWorkspaceView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Only contractors can view the safety-forms workspace",
      "forbidden",
    );
  }

  const rows = await withTenant(ctx.organization.id, async (tx) => {
    const list = await tx
      .select({
        id: safetyForms.id,
        formNumber: safetyForms.formNumber,
        title: safetyForms.title,
        formType: safetyForms.formType,
        status: safetyForms.status,
        submittedAt: safetyForms.submittedAt,
        submittedByUserId: safetyForms.submittedByUserId,
        submittedByOrgId: safetyForms.submittedByOrgId,
        dataJson: safetyForms.dataJson,
        flagged: safetyForms.flagged,
        flagReason: safetyForms.flagReason,
        createdAt: safetyForms.createdAt,
      })
      .from(safetyForms)
      .where(eq(safetyForms.projectId, input.projectId))
      .orderBy(desc(safetyForms.createdAt));

    if (list.length === 0) return [];

    const userIds = Array.from(new Set(list.map((r) => r.submittedByUserId)));
    const orgIds = Array.from(new Set(list.map((r) => r.submittedByOrgId)));

    const [usersRes, orgsRes, incidentRes] = await Promise.all([
      tx
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, userIds)),
      tx
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(inArray(organizations.id, orgIds)),
      tx
        .select({
          safetyFormId: safetyFormIncidents.safetyFormId,
          severity: safetyFormIncidents.severity,
        })
        .from(safetyFormIncidents)
        .where(
          inArray(
            safetyFormIncidents.safetyFormId,
            list
              .filter((r) => r.formType === "incident_report")
              .map((r) => r.id),
          ),
        ),
    ]);

    const userById = new Map(usersRes.map((u) => [u.id, u.displayName] as const));
    const orgById = new Map(orgsRes.map((o) => [o.id, o.name] as const));
    const sevById = new Map(incidentRes.map((i) => [i.safetyFormId, i.severity] as const));

    return list.map((r): SafetyFormSubmissionRow => {
      const data = (r.dataJson as Record<string, unknown>) ?? {};
      const attendees = Array.isArray(data.attendees) ? data.attendees.length : 0;
      const hasPhoto = Object.values(data).some(
        (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && (v[0] as string).startsWith("IMG_"),
      );
      const hasSignature = Object.values(data).some(
        (v) => typeof v === "string" && v.startsWith("data:image/"),
      );
      return {
        id: r.id,
        formNumber: r.formNumber,
        title: r.title,
        formType: r.formType as SafetyFormType,
        status: r.status as "draft" | "submitted",
        submittedAt: r.submittedAt,
        submittedByUserName: userById.get(r.submittedByUserId) ?? "—",
        submittedByOrgName: orgById.get(r.submittedByOrgId) ?? "—",
        flagged: r.flagged,
        flagReason: r.flagReason,
        severity: (sevById.get(r.id) ?? null) as SafetySeverity | null,
        attendeesCount: attendees,
        hasPhoto,
        hasSignature,
      };
    });
  });

  // KPIs
  const submitted = rows.filter((r) => r.status === "submitted");
  const kpis = {
    total: submitted.length,
    toolboxTalks: submitted.filter((r) => r.formType === "toolbox_talk").length,
    incidents: submitted.filter((r) => r.formType === "incident_report").length,
    nearMisses: submitted.filter((r) => r.formType === "near_miss").length,
    openOrQueued: rows.filter((r) => r.status === "draft").length,
  };

  // Type summary — last 7 days submission counts.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const typeSummary: SafetyFormsWorkspaceView["typeSummary"] = (
    Object.keys(SAFETY_FORM_TYPE_LABELS) as SafetyFormType[]
  ).map((type) => {
    const allOfType = submitted.filter((r) => r.formType === type);
    const last7d = allOfType.filter(
      (r) => r.submittedAt && r.submittedAt.getTime() >= sevenDaysAgo,
    ).length;
    return { type, submitted: allOfType.length, last7d };
  });

  return {
    projectId: input.projectId,
    rows,
    kpis,
    typeSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Detail loader — single submission with full incident subtype if present.
// ─────────────────────────────────────────────────────────────────────────

export interface SafetyFormDetailView {
  form: {
    id: string;
    formNumber: string;
    title: string;
    formType: SafetyFormType;
    status: "draft" | "submitted";
    submittedAt: Date | null;
    submittedByUserName: string;
    submittedByOrgName: string;
    projectId: string;
    projectName: string;
    templateId: string;
    templateName: string;
    templateFields: SafetyTemplateField[];
    dataJson: Record<string, unknown>;
    flagged: boolean;
    flagReason: string | null;
  };
  incident: {
    severity: SafetySeverity;
    severityLabel: string;
    incidentAt: Date;
    location: string;
    description: string | null;
    rootCauseText: string | null;
    injured: Array<{ name: string; role?: string | null; bodyPart?: string | null; nature?: string | null }>;
    correctiveActions: Array<{ id: string; action: string; owner: string; due: string }>;
    photoCount: number;
  } | null;
}

export async function getSafetyFormDetail(input: {
  session: SessionLike | null | undefined;
  formId: string;
}): Promise<SafetyFormDetailView> {
  const { dbAdmin } = await import("@/db/admin-pool");
  const [head] = await dbAdmin
    .select({ id: safetyForms.id, projectId: safetyForms.projectId })
    .from(safetyForms)
    .where(eq(safetyForms.id, input.formId))
    .limit(1);
  if (!head) {
    throw new AuthorizationError("Safety form not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, head.projectId);

  return await withTenant(ctx.organization.id, async (tx) => {
    const [row] = await tx
      .select()
      .from(safetyForms)
      .where(eq(safetyForms.id, input.formId))
      .limit(1);
    if (!row) {
      throw new AuthorizationError("Safety form not visible", "not_found");
    }

    const [tpl] = await tx
      .select({
        id: safetyFormTemplates.id,
        name: safetyFormTemplates.name,
        fieldsJson: safetyFormTemplates.fieldsJson,
      })
      .from(safetyFormTemplates)
      .where(eq(safetyFormTemplates.id, row.templateId))
      .limit(1);

    const [submitterUser] = await tx
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, row.submittedByUserId))
      .limit(1);
    const [submitterOrg] = await tx
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, row.submittedByOrgId))
      .limit(1);

    let incident: SafetyFormDetailView["incident"] = null;
    if (row.formType === "incident_report") {
      const [inc] = await tx
        .select()
        .from(safetyFormIncidents)
        .where(eq(safetyFormIncidents.safetyFormId, row.id))
        .limit(1);
      if (inc) {
        const sevCfg = SAFETY_SEVERITY_CONFIG[inc.severity as SafetySeverity];
        incident = {
          severity: inc.severity as SafetySeverity,
          severityLabel: sevCfg?.label ?? inc.severity,
          incidentAt: inc.incidentAt,
          location: inc.location,
          description: inc.description,
          rootCauseText: inc.rootCauseText,
          injured: inc.injuredJson,
          correctiveActions: inc.correctiveActionsJson,
          photoCount: inc.photoCount,
        };
      }
    }

    return {
      form: {
        id: row.id,
        formNumber: row.formNumber,
        title: row.title,
        formType: row.formType as SafetyFormType,
        status: row.status as "draft" | "submitted",
        submittedAt: row.submittedAt,
        submittedByUserName: submitterUser?.displayName ?? "—",
        submittedByOrgName: submitterOrg?.name ?? "—",
        projectId: row.projectId,
        projectName: ctx.project.name,
        templateId: row.templateId,
        templateName: tpl?.name ?? "—",
        templateFields: (tpl?.fieldsJson as SafetyTemplateField[]) ?? [],
        dataJson: row.dataJson as Record<string, unknown>,
        flagged: row.flagged,
        flagReason: row.flagReason,
      },
      incident,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Templates index — contractor settings list of templates.
// ─────────────────────────────────────────────────────────────────────────

export interface SafetyFormTemplateRow {
  id: string;
  name: string;
  formType: SafetyFormType;
  description: string | null;
  fieldCount: number;
  timesUsed: number;
  isArchived: boolean;
  updatedAt: Date;
  fields: SafetyTemplateField[];
}

export async function getSafetyFormTemplates(input: {
  session: SessionLike | null | undefined;
}): Promise<SafetyFormTemplateRow[]> {
  const ctx = await getOrgContext(input.session);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Only contractors can list safety templates",
      "forbidden",
    );
  }
  const rows = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select()
      .from(safetyFormTemplates)
      .where(eq(safetyFormTemplates.organizationId, ctx.organization.id))
      .orderBy(asc(safetyFormTemplates.formType), asc(safetyFormTemplates.name)),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    formType: r.formType as SafetyFormType,
    description: r.description,
    fieldCount: ((r.fieldsJson as SafetyTemplateField[]) ?? []).length,
    timesUsed: r.timesUsed,
    isArchived: r.isArchived,
    updatedAt: r.updatedAt,
    fields: (r.fieldsJson as SafetyTemplateField[]) ?? [],
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Sub list — templates assigned to the sub on a project + their recent
// submissions.
// ─────────────────────────────────────────────────────────────────────────

export interface SubSafetyFormsView {
  projectId: string;
  assignedTemplates: SafetyFormTemplateRow[];
  recentSubmissions: SafetyFormSubmissionRow[];
}

export async function getSubSafetyFormsView(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<SubSafetyFormsView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "subcontractor_user") {
    throw new AuthorizationError(
      "Only subcontractors see this view",
      "forbidden",
    );
  }

  const [assigned, recent] = await withTenant(ctx.organization.id, async (tx) => {
    // Assigned templates: rows in safety_form_template_assignments where
    // organizationId=sub_org and projectId IN (NULL, projectId).
    const assignmentRows = await tx
      .select({
        templateId: safetyFormTemplateAssignments.templateId,
        projectId: safetyFormTemplateAssignments.projectId,
      })
      .from(safetyFormTemplateAssignments)
      .where(
        and(
          eq(safetyFormTemplateAssignments.organizationId, ctx.organization.id),
          // Project = NULL (org-wide) OR matching project.
          sql`(${safetyFormTemplateAssignments.projectId} IS NULL OR ${safetyFormTemplateAssignments.projectId} = ${input.projectId})`,
        ),
      );
    const tplIds = Array.from(new Set(assignmentRows.map((a) => a.templateId)));
    const templates: typeof safetyFormTemplates.$inferSelect[] = tplIds.length
      ? await tx
          .select()
          .from(safetyFormTemplates)
          .where(
            and(
              inArray(safetyFormTemplates.id, tplIds),
              eq(safetyFormTemplates.isArchived, false),
            ),
          )
      : [];

    // Recent submissions BY THIS SUB ORG on this project.
    const submissions = await tx
      .select({
        id: safetyForms.id,
        formNumber: safetyForms.formNumber,
        title: safetyForms.title,
        formType: safetyForms.formType,
        status: safetyForms.status,
        submittedAt: safetyForms.submittedAt,
        flagged: safetyForms.flagged,
        flagReason: safetyForms.flagReason,
        dataJson: safetyForms.dataJson,
      })
      .from(safetyForms)
      .where(
        and(
          eq(safetyForms.projectId, input.projectId),
          eq(safetyForms.submittedByOrgId, ctx.organization.id),
        ),
      )
      .orderBy(desc(safetyForms.createdAt))
      .limit(10);

    return [templates, submissions] as const;
  });

  const assignedTemplates: SafetyFormTemplateRow[] = assigned.map((r) => ({
    id: r.id,
    name: r.name,
    formType: r.formType as SafetyFormType,
    description: r.description,
    fieldCount: ((r.fieldsJson as SafetyTemplateField[]) ?? []).length,
    timesUsed: r.timesUsed,
    isArchived: r.isArchived,
    updatedAt: r.updatedAt,
    fields: (r.fieldsJson as SafetyTemplateField[]) ?? [],
  }));

  const recentSubmissions: SafetyFormSubmissionRow[] = recent.map((r) => {
    const data = (r.dataJson as Record<string, unknown>) ?? {};
    const attendees = Array.isArray(data.attendees) ? data.attendees.length : 0;
    return {
      id: r.id,
      formNumber: r.formNumber,
      title: r.title,
      formType: r.formType as SafetyFormType,
      status: r.status as "draft" | "submitted",
      submittedAt: r.submittedAt,
      submittedByUserName: ctx.user.displayName ?? "—",
      submittedByOrgName: ctx.organization.name,
      flagged: r.flagged,
      flagReason: r.flagReason,
      severity: null,
      attendeesCount: attendees,
      hasPhoto: false,
      hasSignature: false,
    };
  });

  return {
    projectId: input.projectId,
    assignedTemplates,
    recentSubmissions,
  };
}
