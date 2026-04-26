import { and, between, desc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  changeOrders,
  dailyLogIssues,
  dailyLogPhotos,
  dailyLogs,
  milestones,
  projects,
  rfis,
  users,
  weeklyReportSections,
  weeklyReports,
} from "@/db/schema";

import { computeReportWindow, type WeekWindow } from "./window";

// Pure-ish weekly-report generator. Reads source tables for the given
// week window, composes structured per-section snapshots, and upserts
// `weekly_reports` + `weekly_report_sections` rows.
//
// Idempotency rules:
//   - If a report row exists for (projectId, weekStart) AND its status is
//     `auto_draft`, sections are replaced in place. Useful when a contractor
//     hits "Generate off-cycle" mid-week to refresh after late activity.
//   - If status is `editing`, `sent`, or `archived`, the function returns
//     the existing row unchanged. We never overwrite contractor edits.
//
// Activity gate:
//   - If every source produces zero items AND no row exists yet, the
//     function returns `{ status: "skipped_empty" }` and writes nothing.
//     Avoids cluttering the list with empty drafts.
//
// Section IDs:
//   - Section content carries source row IDs so the UI can deep-link
//     back to RFIs / COs / etc. Future re-fetches can reconcile against
//     current source state if needed.

type SectionType =
  | "daily_logs"
  | "photos"
  | "milestones"
  | "rfis"
  | "change_orders"
  | "issues";

export type GenerateWeeklyReportInput = {
  projectId: string;
  /** Optional override; defaults to "now" in project tz. */
  asOfMs?: number;
  /** Null for the Trigger.dev cron, set when a contractor uses Generate-now. */
  generatedByUserId?: string | null;
};

export type GenerateWeeklyReportResult =
  | {
      status: "created" | "regenerated";
      reportId: string;
      sectionCount: number;
      window: WeekWindow;
    }
  | {
      status: "skipped_empty" | "skipped_locked";
      reportId: string | null;
      window: WeekWindow;
    };

export async function generateWeeklyReport(
  input: GenerateWeeklyReportInput,
): Promise<GenerateWeeklyReportResult> {
  const asOfMs = input.asOfMs ?? Date.now();

  // Need the project to know its timezone for window computation.
  // Also grab the contractor org id — every downstream project-scoped
  // read uses it as the RLS GUC, including the Trigger.dev cron path
  // (the job iterates per project, so each project iteration runs with
  // its own contractor-org GUC rather than bypassing RLS wholesale).
  // Pre-tenant lookup — admin pool (Slice 3 entry-point pattern). The
  // contractor-org GUC is exactly what we're trying to discover here.
  const [project] = await dbAdmin
    .select({
      id: projects.id,
      timezone: projects.timezone,
      contractorOrganizationId: projects.contractorOrganizationId,
    })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) {
    throw new Error(`generateWeeklyReport: project ${input.projectId} not found`);
  }
  const contractorOrgId = project.contractorOrganizationId;

  const window = computeReportWindow(asOfMs, project.timezone);

  // Prior-art lookup — short-circuits on locked statuses. Cron sweep
  // runs per-project with each project's contractor org as the GUC.
  const [existing] = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: weeklyReports.id,
        status: weeklyReports.status,
      })
      .from(weeklyReports)
      .where(
        and(
          eq(weeklyReports.projectId, input.projectId),
          eq(weeklyReports.weekStart, window.weekStartLocalDate),
        ),
      )
      .limit(1),
  );

  if (existing && existing.status !== "auto_draft") {
    return { status: "skipped_locked", reportId: existing.id, window };
  }

  // Pull source data for the week in parallel.
  const sectionPayloads = await loadSectionPayloads({
    projectId: input.projectId,
    window,
    contractorOrgId,
  });

  const totalItems = sectionPayloads.reduce(
    (n, s) => n + (s.itemCount ?? 0),
    0,
  );

  if (!existing && totalItems === 0) {
    return { status: "skipped_empty", reportId: null, window };
  }

  // Upsert the report row + its sections inside a single transaction so a
  // partial write can't leave a report with inconsistent sections.
  const result = await withTenant(contractorOrgId, async (tx) => {
    let reportId: string;
    let createdNew: boolean;

    if (existing) {
      reportId = existing.id;
      createdNew = false;
      // Refresh generated_at so the UI reflects the latest pull. Do NOT
      // reset summary_text — even an auto_draft might have a contractor-typed
      // summary that should survive a regeneration.
      await tx
        .update(weeklyReports)
        .set({
          generatedAt: new Date(),
          generatedByUserId: input.generatedByUserId ?? null,
        })
        .where(eq(weeklyReports.id, reportId));
    } else {
      const [row] = await tx
        .insert(weeklyReports)
        .values({
          projectId: input.projectId,
          weekStart: window.weekStartLocalDate,
          weekEnd: window.weekEndLocalDate,
          status: "auto_draft",
          generatedByUserId: input.generatedByUserId ?? null,
        })
        .returning({ id: weeklyReports.id });
      reportId = row.id;
      createdNew = true;
    }

    // Replace sections in place. Delete-then-insert is simpler than a
    // per-row upsert and matches the unique (report_id, section_type) index.
    if (!createdNew) {
      await tx
        .delete(weeklyReportSections)
        .where(eq(weeklyReportSections.reportId, reportId));
    }

    if (sectionPayloads.length > 0) {
      await tx.insert(weeklyReportSections).values(
        sectionPayloads.map((s, idx) => ({
          reportId,
          sectionType: s.sectionType,
          content: s.content,
          orderIndex: idx,
        })),
      );
    }

    return { reportId, createdNew };
  });

  return {
    status: result.createdNew ? "created" : "regenerated",
    reportId: result.reportId,
    sectionCount: sectionPayloads.length,
    window,
  };
}

// ---------------------------------------------------------------------------
// Source-data composition. One block per section type. Each returns the
// section's content jsonb plus an itemCount used by the activity gate.
// ---------------------------------------------------------------------------

type SectionPayload = {
  sectionType: SectionType;
  content: Record<string, unknown>;
  itemCount: number;
};

async function loadSectionPayloads(args: {
  projectId: string;
  window: WeekWindow;
  contractorOrgId: string;
}): Promise<SectionPayload[]> {
  const { projectId, window, contractorOrgId } = args;

  const [
    dailyLogsSection,
    photosSection,
    milestonesSection,
    rfisSection,
    changeOrdersSection,
    issuesSection,
  ] = await Promise.all([
    loadDailyLogsSection(projectId, window, contractorOrgId),
    loadPhotosSection(projectId, window, contractorOrgId),
    loadMilestonesSection(projectId, window, contractorOrgId),
    loadRfisSection(projectId, window, contractorOrgId),
    loadChangeOrdersSection(projectId, window, contractorOrgId),
    loadIssuesSection(projectId, window, contractorOrgId),
  ]);

  // Order matches the prototype's editor layout: logs → photos → milestones
  // → RFIs → COs → issues.
  return [
    dailyLogsSection,
    photosSection,
    milestonesSection,
    rfisSection,
    changeOrdersSection,
    issuesSection,
  ];
}

async function loadDailyLogsSection(
  projectId: string,
  window: WeekWindow,
  contractorOrgId: string,
): Promise<SectionPayload> {
  const rows = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: dailyLogs.id,
        logDate: dailyLogs.logDate,
        reporterName: users.displayName,
        notes: dailyLogs.notes,
        clientSummary: dailyLogs.clientSummary,
        weatherConditions: dailyLogs.weatherConditions,
        weatherHighC: dailyLogs.weatherHighC,
        weatherLowC: dailyLogs.weatherLowC,
      })
      .from(dailyLogs)
      .leftJoin(users, eq(users.id, dailyLogs.reportedByUserId))
      .where(
        and(
          eq(dailyLogs.projectId, projectId),
          eq(dailyLogs.status, "submitted"),
          gte(dailyLogs.logDate, window.weekStartLocalDate),
          lte(dailyLogs.logDate, window.weekEndLocalDate),
        ),
      )
      .orderBy(dailyLogs.logDate),
  );

  const entries = rows.map((r) => ({
    logId: r.id,
    date: r.logDate,
    reporterName: r.reporterName ?? null,
    summary: r.clientSummary ?? r.notes ?? null,
    weather: r.weatherConditions
      ? {
          condition: r.weatherConditions,
          highC: r.weatherHighC,
          lowC: r.weatherLowC,
        }
      : null,
  }));

  return {
    sectionType: "daily_logs",
    content: { entries },
    itemCount: entries.length,
  };
}

async function loadPhotosSection(
  projectId: string,
  window: WeekWindow,
  contractorOrgId: string,
): Promise<SectionPayload> {
  // Two-step: find this week's logs, then their photos. Avoids a join
  // that would inflate row count when a log has many photos.
  const logIds = (
    await withTenant(contractorOrgId, (tx) =>
      tx
        .select({ id: dailyLogs.id })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.projectId, projectId),
            eq(dailyLogs.status, "submitted"),
            gte(dailyLogs.logDate, window.weekStartLocalDate),
            lte(dailyLogs.logDate, window.weekEndLocalDate),
          ),
        ),
    )
  ).map((r) => r.id);

  if (logIds.length === 0) {
    return { sectionType: "photos", content: { items: [] }, itemCount: 0 };
  }

  const photoRows = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: dailyLogPhotos.id,
        documentId: dailyLogPhotos.documentId,
        caption: dailyLogPhotos.caption,
        sortOrder: dailyLogPhotos.sortOrder,
        isHero: dailyLogPhotos.isHero,
        createdAt: dailyLogPhotos.createdAt,
      })
      .from(dailyLogPhotos)
      .where(inArray(dailyLogPhotos.dailyLogId, logIds))
      .orderBy(desc(dailyLogPhotos.isHero), dailyLogPhotos.sortOrder)
      .limit(24), // upper bound to keep section payload bounded
  );

  const items = photoRows.map((p) => ({
    photoId: p.id,
    documentId: p.documentId,
    caption: p.caption ?? null,
    isHero: p.isHero,
    takenAt: p.createdAt.toISOString(),
  }));

  return {
    sectionType: "photos",
    content: { items },
    itemCount: items.length,
  };
}

async function loadMilestonesSection(
  projectId: string,
  window: WeekWindow,
  contractorOrgId: string,
): Promise<SectionPayload> {
  const closed = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: milestones.id,
        title: milestones.title,
        completedDate: milestones.completedDate,
        scheduledDate: milestones.scheduledDate,
      })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          eq(milestones.milestoneStatus, "completed"),
          isNotNull(milestones.completedDate),
          between(
            milestones.completedDate,
            window.weekStartUtc,
            window.weekEndUtc,
          ),
        ),
      ),
  );

  // "Upcoming next week" = scheduled in the 7 days following weekEnd.
  const nextWeekEnd = new Date(window.weekEndUtc.getTime() + 7 * 86_400_000);
  const upcoming = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: milestones.id,
        title: milestones.title,
        scheduledDate: milestones.scheduledDate,
      })
      .from(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          inArray(milestones.milestoneStatus, ["scheduled", "in_progress"]),
          gte(milestones.scheduledDate, window.weekEndUtc),
          lte(milestones.scheduledDate, nextWeekEnd),
        ),
      )
      .orderBy(milestones.scheduledDate),
  );

  const closedItems = closed.map((m) => ({
    milestoneId: m.id,
    title: m.title,
    closedAt: (m.completedDate ?? m.scheduledDate).toISOString(),
  }));
  const upcomingItems = upcoming.map((m) => ({
    milestoneId: m.id,
    title: m.title,
    dueDate: m.scheduledDate.toISOString(),
  }));

  return {
    sectionType: "milestones",
    content: { closed: closedItems, upcoming: upcomingItems },
    itemCount: closedItems.length + upcomingItems.length,
  };
}

async function loadRfisSection(
  projectId: string,
  window: WeekWindow,
  contractorOrgId: string,
): Promise<SectionPayload> {
  // RFIs touched this week — opened (createdAt in window) OR closed
  // (closedAt in window). Same row may appear in both lists if it cycled.
  const rows = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: rfis.id,
        number: rfis.sequentialNumber,
        subject: rfis.subject,
        status: rfis.rfiStatus,
        createdAt: rfis.createdAt,
        closedAt: rfis.closedAt,
      })
      .from(rfis)
      .where(
        and(
          eq(rfis.projectId, projectId),
          or(
            between(rfis.createdAt, window.weekStartUtc, window.weekEndUtc),
            between(rfis.closedAt, window.weekStartUtc, window.weekEndUtc),
          ),
        ),
      ),
  );

  const opened: Array<Record<string, unknown>> = [];
  const closed: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (
      r.createdAt >= window.weekStartUtc &&
      r.createdAt <= window.weekEndUtc
    ) {
      opened.push({
        id: r.id,
        number: r.number,
        subject: r.subject,
        status: r.status,
        openedAt: r.createdAt.toISOString(),
      });
    }
    if (
      r.closedAt &&
      r.closedAt >= window.weekStartUtc &&
      r.closedAt <= window.weekEndUtc
    ) {
      closed.push({
        id: r.id,
        number: r.number,
        subject: r.subject,
        closedAt: r.closedAt.toISOString(),
        turnaroundDays: Math.max(
          0,
          Math.round(
            (r.closedAt.getTime() - r.createdAt.getTime()) / 86_400_000,
          ),
        ),
      });
    }
  }

  return {
    sectionType: "rfis",
    content: { opened, closed },
    itemCount: opened.length + closed.length,
  };
}

async function loadChangeOrdersSection(
  projectId: string,
  window: WeekWindow,
  contractorOrgId: string,
): Promise<SectionPayload> {
  const rows = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: changeOrders.id,
        number: changeOrders.changeOrderNumber,
        title: changeOrders.title,
        status: changeOrders.changeOrderStatus,
        amountCents: changeOrders.amountCents,
        submittedAt: changeOrders.submittedAt,
        approvedAt: changeOrders.approvedAt,
      })
      .from(changeOrders)
      .where(
        and(
          eq(changeOrders.projectId, projectId),
          or(
            between(
              changeOrders.submittedAt,
              window.weekStartUtc,
              window.weekEndUtc,
            ),
            between(
              changeOrders.approvedAt,
              window.weekStartUtc,
              window.weekEndUtc,
            ),
          ),
        ),
      ),
  );

  const submitted: Array<Record<string, unknown>> = [];
  const approved: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (
      r.submittedAt &&
      r.submittedAt >= window.weekStartUtc &&
      r.submittedAt <= window.weekEndUtc
    ) {
      submitted.push({
        id: r.id,
        number: r.number,
        title: r.title,
        amountCents: r.amountCents,
        status: r.status,
        submittedAt: r.submittedAt.toISOString(),
      });
    }
    if (
      r.approvedAt &&
      r.approvedAt >= window.weekStartUtc &&
      r.approvedAt <= window.weekEndUtc
    ) {
      approved.push({
        id: r.id,
        number: r.number,
        title: r.title,
        amountCents: r.amountCents,
        approvedAt: r.approvedAt.toISOString(),
      });
    }
  }

  return {
    sectionType: "change_orders",
    content: { submitted, approved },
    itemCount: submitted.length + approved.length,
  };
}

async function loadIssuesSection(
  projectId: string,
  window: WeekWindow,
  contractorOrgId: string,
): Promise<SectionPayload> {
  // Issues source = daily_log_issues for this week's logs. The build guide
  // anticipated punch_list as another source eventually; that wiring lands
  // when a "weekly issue rollup" surface is built. For now, daily-log
  // issues are the only feed.
  const logIds = (
    await withTenant(contractorOrgId, (tx) =>
      tx
        .select({ id: dailyLogs.id })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.projectId, projectId),
            eq(dailyLogs.status, "submitted"),
            gte(dailyLogs.logDate, window.weekStartLocalDate),
            lte(dailyLogs.logDate, window.weekEndLocalDate),
          ),
        ),
    )
  ).map((r) => r.id);

  if (logIds.length === 0) {
    return { sectionType: "issues", content: { items: [] }, itemCount: 0 };
  }

  const issueRows = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({
        id: dailyLogIssues.id,
        dailyLogId: dailyLogIssues.dailyLogId,
        issueType: dailyLogIssues.issueType,
        description: dailyLogIssues.description,
        createdAt: dailyLogIssues.createdAt,
      })
      .from(dailyLogIssues)
      .where(inArray(dailyLogIssues.dailyLogId, logIds)),
  );

  const items = issueRows.map((i) => ({
    source: "daily_log" as const,
    sourceId: i.id,
    dailyLogId: i.dailyLogId,
    issueType: i.issueType,
    description: i.description,
    raisedAt: i.createdAt.toISOString(),
  }));

  return {
    sectionType: "issues",
    content: { items },
    itemCount: items.length,
  };
}
