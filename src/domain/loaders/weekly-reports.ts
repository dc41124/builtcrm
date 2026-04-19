import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  weeklyReportSections,
  weeklyReports,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

// Weekly-report read loaders. Three surfaces — contractor (full), client
// portals (sent-only). All scoped through getEffectiveContext so the
// project-membership gate enforces who can read which project's reports.

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type WeeklyReportSummaryRow = {
  id: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;
  status: "auto_draft" | "editing" | "sent" | "archived";
  summaryText: string | null;
  generatedAt: Date;
  sentAt: Date | null;
  sentByName: string | null;
  sectionCount: number;
};

export type WeeklyReportSection = {
  id: string;
  sectionType:
    | "daily_logs"
    | "photos"
    | "milestones"
    | "rfis"
    | "change_orders"
    | "issues";
  content: Record<string, unknown>;
  orderIndex: number;
};

export type WeeklyReportDetail = {
  id: string;
  projectId: string;
  weekStart: string;
  weekEnd: string;
  status: "auto_draft" | "editing" | "sent" | "archived";
  summaryText: string | null;
  generatedAt: Date;
  generatedByName: string | null;
  sentAt: Date | null;
  sentByName: string | null;
  sections: WeeklyReportSection[];
};

export type ContractorWeeklyReportsView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  reports: WeeklyReportSummaryRow[];
};

export type ContractorWeeklyReportDetailView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  report: WeeklyReportDetail;
};

type ProjectInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

type ReportInput = ProjectInput & { reportId: string };

// --------------------------------------------------------------------------
// Contractor loaders
// --------------------------------------------------------------------------

export async function getContractorWeeklyReports(
  input: ProjectInput,
): Promise<ContractorWeeklyReportsView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "contractor_admin" &&
    context.role !== "contractor_pm"
  ) {
    throw new AuthorizationError(
      "Contractor weekly-reports view requires a contractor role",
      "forbidden",
    );
  }

  const reports = await loadReportSummaries(context.project.id, false);
  return {
    context,
    project: context.project,
    reports,
  };
}

export async function getContractorWeeklyReportDetail(
  input: ReportInput,
): Promise<ContractorWeeklyReportDetailView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "contractor_admin" &&
    context.role !== "contractor_pm"
  ) {
    throw new AuthorizationError(
      "Contractor weekly-reports view requires a contractor role",
      "forbidden",
    );
  }

  const report = await loadReportDetail({
    projectId: context.project.id,
    reportId: input.reportId,
    sentOnly: false,
  });
  if (!report) {
    throw new AuthorizationError(
      "Weekly report not found in this project",
      "not_found",
    );
  }
  return { context, project: context.project, report };
}

// --------------------------------------------------------------------------
// Client loaders (commercial + residential share the same shape; the
// residential reshaper in a later commit transforms the SAME detail into
// the warmer card layout)
// --------------------------------------------------------------------------

export type ClientWeeklyReportsView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  reports: WeeklyReportSummaryRow[]; // sent-only
};

export type ClientWeeklyReportDetailView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  report: WeeklyReportDetail;
};

export async function getClientWeeklyReports(
  input: ProjectInput,
): Promise<ClientWeeklyReportsView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "commercial_client" &&
    context.role !== "residential_client"
  ) {
    throw new AuthorizationError(
      "Client weekly-reports view requires a client role",
      "forbidden",
    );
  }

  const reports = await loadReportSummaries(context.project.id, true);
  return { context, project: context.project, reports };
}

export async function getClientWeeklyReportDetail(
  input: ReportInput,
): Promise<ClientWeeklyReportDetailView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "commercial_client" &&
    context.role !== "residential_client"
  ) {
    throw new AuthorizationError(
      "Client weekly-reports view requires a client role",
      "forbidden",
    );
  }

  const report = await loadReportDetail({
    projectId: context.project.id,
    reportId: input.reportId,
    sentOnly: true, // clients never see drafts
  });
  if (!report) {
    throw new AuthorizationError(
      "Weekly report not found or not yet sent",
      "not_found",
    );
  }
  return { context, project: context.project, report };
}

// --------------------------------------------------------------------------
// Internal — shared queries
// --------------------------------------------------------------------------

async function loadReportSummaries(
  projectId: string,
  sentOnly: boolean,
): Promise<WeeklyReportSummaryRow[]> {
  const baseWhere = sentOnly
    ? and(
        eq(weeklyReports.projectId, projectId),
        eq(weeklyReports.status, "sent"),
      )
    : eq(weeklyReports.projectId, projectId);

  const rows = await db
    .select({
      id: weeklyReports.id,
      weekStart: weeklyReports.weekStart,
      weekEnd: weeklyReports.weekEnd,
      status: weeklyReports.status,
      summaryText: weeklyReports.summaryText,
      generatedAt: weeklyReports.generatedAt,
      sentAt: weeklyReports.sentAt,
      sentByName: users.displayName,
    })
    .from(weeklyReports)
    .leftJoin(users, eq(users.id, weeklyReports.sentByUserId))
    .where(baseWhere)
    .orderBy(desc(weeklyReports.weekStart));

  if (rows.length === 0) return [];

  // Section counts in one batched query.
  const reportIds = rows.map((r) => r.id);
  const counts = await db
    .select({
      reportId: weeklyReportSections.reportId,
      sectionType: weeklyReportSections.sectionType,
    })
    .from(weeklyReportSections)
    .where(inArray(weeklyReportSections.reportId, reportIds));

  const countByReport = new Map<string, number>();
  for (const c of counts) {
    countByReport.set(c.reportId, (countByReport.get(c.reportId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    status: r.status,
    summaryText: r.summaryText,
    generatedAt: r.generatedAt,
    sentAt: r.sentAt,
    sentByName: r.sentByName,
    sectionCount: countByReport.get(r.id) ?? 0,
  }));
}

async function loadReportDetail(args: {
  projectId: string;
  reportId: string;
  sentOnly: boolean;
}): Promise<WeeklyReportDetail | null> {
  const baseWhere = args.sentOnly
    ? and(
        eq(weeklyReports.id, args.reportId),
        eq(weeklyReports.projectId, args.projectId),
        eq(weeklyReports.status, "sent"),
      )
    : and(
        eq(weeklyReports.id, args.reportId),
        eq(weeklyReports.projectId, args.projectId),
      );

  const [reportRow] = await db
    .select({
      id: weeklyReports.id,
      projectId: weeklyReports.projectId,
      weekStart: weeklyReports.weekStart,
      weekEnd: weeklyReports.weekEnd,
      status: weeklyReports.status,
      summaryText: weeklyReports.summaryText,
      generatedAt: weeklyReports.generatedAt,
      generatedByUserId: weeklyReports.generatedByUserId,
      sentAt: weeklyReports.sentAt,
      sentByUserId: weeklyReports.sentByUserId,
    })
    .from(weeklyReports)
    .where(baseWhere)
    .limit(1);
  if (!reportRow) return null;

  const sectionRows = await db
    .select({
      id: weeklyReportSections.id,
      sectionType: weeklyReportSections.sectionType,
      content: weeklyReportSections.content,
      orderIndex: weeklyReportSections.orderIndex,
    })
    .from(weeklyReportSections)
    .where(eq(weeklyReportSections.reportId, reportRow.id))
    .orderBy(asc(weeklyReportSections.orderIndex));

  // Resolve actor names if any.
  const userIds = [
    reportRow.generatedByUserId,
    reportRow.sentByUserId,
  ].filter((v): v is string => !!v);
  const nameById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of userRows) nameById.set(u.id, u.displayName);
  }

  return {
    id: reportRow.id,
    projectId: reportRow.projectId,
    weekStart: reportRow.weekStart,
    weekEnd: reportRow.weekEnd,
    status: reportRow.status,
    summaryText: reportRow.summaryText,
    generatedAt: reportRow.generatedAt,
    generatedByName: reportRow.generatedByUserId
      ? nameById.get(reportRow.generatedByUserId) ?? null
      : null,
    sentAt: reportRow.sentAt,
    sentByName: reportRow.sentByUserId
      ? nameById.get(reportRow.sentByUserId) ?? null
      : null,
    sections: sectionRows.map((s) => ({
      id: s.id,
      sectionType: s.sectionType,
      content: s.content,
      orderIndex: s.orderIndex,
    })),
  };
}

