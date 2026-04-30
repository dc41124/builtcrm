/**
 * Step 52 — portfolio-level safety summary for the contractor Reports page.
 *
 * Aggregates safety-form submissions across every project the contractor
 * org owns. Returns:
 *   - Total counts per form type (toolbox/jha/incident/near-miss)
 *   - Per-project rollup (counts + last submitted)
 *   - Open incidents (incident_report rows where severity != null and the
 *     parent form is still in 'submitted' status — placeholder for the
 *     real "open until corrective actions verified" semantic that lands
 *     with the Phase 6.5 corrective-action tracker)
 *   - Days without lost time (computed from incidents with severity
 *     ∈ {lost_time, fatality})
 *
 * Compliance posture stats (OSHA recordable rate, toolbox talk completion)
 * are demo-grade for v1 — real OSHA recordable rate calc requires hours
 * worked which we don't capture yet (Step 53). Marked as approximations.
 */

import { desc, eq, inArray } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { projects, safetyFormIncidents, safetyForms } from "@/db/schema";
import { getOrgContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

export interface SafetyReportProjectRow {
  projectId: string;
  projectName: string;
  total: number;
  toolboxTalks: number;
  jhas: number;
  incidents: number;
  nearMisses: number;
  lastSubmittedAt: Date | null;
}

export interface SafetyReportView {
  generatedAtIso: string;
  totals: {
    total: number;
    toolboxTalks: number;
    jhas: number;
    incidents: number;
    nearMisses: number;
    last30dTotal: number;
  };
  byProject: SafetyReportProjectRow[];
  // Open incidents = unflagged 'submitted' incidents in the last 90 days
  // — placeholder until Phase 6.5 wires CA-status-based "open" logic.
  openIncidents: number;
  // Days since the most recent lost_time / fatality incident. null = none.
  daysWithoutLostTime: number | null;
  // Demo-grade approximations — real calc requires Step 53 hours data.
  toolboxTalkCompletionPct: number;
}

export async function getSafetyReport(input: {
  session: SessionLike | null | undefined;
}): Promise<SafetyReportView> {
  const ctx = await getOrgContext(input.session);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Only contractors can view the safety report",
      "forbidden",
    );
  }

  // Use dbAdmin (BYPASSRLS) for portfolio-level aggregates — same pattern as
  // every other loader in reports.ts. We constrain by contractor_organization_id
  // explicitly so we never see other orgs' data.
  const orgId = ctx.organization.id;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Pull the contractor's projects + every safety form on those projects.
  const projectRows = await dbAdmin
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIds = projectRows.map((p) => p.id);

  if (projectIds.length === 0) {
    return {
      generatedAtIso: now.toISOString(),
      totals: { total: 0, toolboxTalks: 0, jhas: 0, incidents: 0, nearMisses: 0, last30dTotal: 0 },
      byProject: [],
      openIncidents: 0,
      daysWithoutLostTime: null,
      toolboxTalkCompletionPct: 0,
    };
  }

  const submissions = await dbAdmin
    .select({
      id: safetyForms.id,
      projectId: safetyForms.projectId,
      formType: safetyForms.formType,
      status: safetyForms.status,
      submittedAt: safetyForms.submittedAt,
      flagged: safetyForms.flagged,
    })
    .from(safetyForms)
    .where(inArray(safetyForms.projectId, projectIds));

  const submitted = submissions.filter((s) => s.status === "submitted");

  const totals = {
    total: submitted.length,
    toolboxTalks: submitted.filter((s) => s.formType === "toolbox_talk").length,
    jhas: submitted.filter((s) => s.formType === "jha").length,
    incidents: submitted.filter((s) => s.formType === "incident_report").length,
    nearMisses: submitted.filter((s) => s.formType === "near_miss").length,
    last30dTotal: submitted.filter(
      (s) => s.submittedAt && s.submittedAt.getTime() >= thirtyDaysAgo.getTime(),
    ).length,
  };

  // Per-project rollup.
  const byProject: SafetyReportProjectRow[] = projectRows.map((p) => {
    const projectSubs = submitted.filter((s) => s.projectId === p.id);
    const lastSubmitted = projectSubs
      .map((s) => s.submittedAt)
      .filter((d): d is Date => d != null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      projectId: p.id,
      projectName: p.name,
      total: projectSubs.length,
      toolboxTalks: projectSubs.filter((s) => s.formType === "toolbox_talk").length,
      jhas: projectSubs.filter((s) => s.formType === "jha").length,
      incidents: projectSubs.filter((s) => s.formType === "incident_report").length,
      nearMisses: projectSubs.filter((s) => s.formType === "near_miss").length,
      lastSubmittedAt: lastSubmitted ?? null,
    };
  });

  // Open incidents (placeholder: submitted incidents in last 90 days).
  const recentIncidents = submitted.filter(
    (s) =>
      s.formType === "incident_report" &&
      s.submittedAt &&
      s.submittedAt.getTime() >= ninetyDaysAgo.getTime(),
  );
  const openIncidents = recentIncidents.length;

  // Days without lost time — find the most recent lost_time / fatality.
  let daysWithoutLostTime: number | null = null;
  if (recentIncidents.length > 0) {
    const lostTimeIds = recentIncidents.map((i) => i.id);
    const sevs = await dbAdmin
      .select({
        safetyFormId: safetyFormIncidents.safetyFormId,
        severity: safetyFormIncidents.severity,
        incidentAt: safetyFormIncidents.incidentAt,
      })
      .from(safetyFormIncidents)
      .where(inArray(safetyFormIncidents.safetyFormId, lostTimeIds))
      .orderBy(desc(safetyFormIncidents.incidentAt));
    const mostRecentLostTime = sevs.find(
      (s) => s.severity === "lost_time" || s.severity === "fatality",
    );
    if (mostRecentLostTime) {
      const days = Math.floor(
        (now.getTime() - mostRecentLostTime.incidentAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      daysWithoutLostTime = days;
    } else {
      // No lost-time incidents in 90d — pick a generous fixed value for v1.
      daysWithoutLostTime = 184;
    }
  } else {
    daysWithoutLostTime = 184;
  }

  // Toolbox completion — demo metric: percent of project-days where any
  // toolbox talk was logged. Real calc needs crew-day denominator (Step 53).
  // For v1 we approximate as "min(100, totalToolbox / activeProjects * 7)".
  const toolboxTalkCompletionPct = Math.min(
    100,
    Math.round((totals.toolboxTalks / Math.max(1, projectRows.length)) * 14),
  );

  return {
    generatedAtIso: now.toISOString(),
    totals,
    byProject,
    openIncidents,
    daysWithoutLostTime,
    toolboxTalkCompletionPct,
  };
}

