import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  dailyLogAmendments,
  dailyLogDelays,
  dailyLogs,
  projects,
  users,
} from "@/db/schema";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  getDailyLogs,
  type DailyLogListRow,
  type DailyLogAmendmentStatus,
} from "@/domain/loaders/daily-logs";
import { addDays, todayInProjectTimezone } from "@/lib/daily-logs/date-utils";

// Page-level view for the contractor daily-logs list page. Bundles the
// list rows, current-month calendar, week summary stats, and the most
// recent amendments into a single object so the server page component
// makes one loader call and hands the workspace a fully-shaped prop set.
//
// Authorization inherits from getDailyLogs / getEffectiveContext — if
// the caller isn't a contractor on the project, every downstream loader
// throws AuthorizationError before returning data.

export type ContractorDailyLogsPageView = {
  project: {
    id: string;
    name: string;
    timezone: string;
  };
  today: string; // YYYY-MM-DD in project tz
  // Logs for the current calendar month (covers the calendar grid).
  monthLogs: DailyLogListRow[];
  // Last 7 submitted logs (feeds the "Recent logs" list section).
  recentLogs: DailyLogListRow[];
  kpis: {
    logsThisWeek: number;
    workDaysThisWeek: number;
    delayHoursLast30: number;
    delayCountLast30: number;
    missingLogsLast30: number;
    photosThisWeek: number;
    pendingAmendments: number;
  };
  weekSummary: {
    logsSubmitted: number;
    workDays: number;
    totalCrewHours: number;
    delayHours: number;
    photos: number;
  };
  amendments: Array<{
    id: string;
    dailyLogId: string;
    logDate: string;
    changeSummary: string;
    status: DailyLogAmendmentStatus;
    requestedByName: string | null;
    requestedAt: string;
  }>;
};

export type GetContractorDailyLogsPageViewInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getContractorDailyLogsPageView(
  input: GetContractorDailyLogsPageViewInput,
): Promise<ContractorDailyLogsPageView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Only contractors can view the contractor daily-logs page",
      "forbidden",
    );
  }

  const [projectRow] = await db
    .select({
      id: projects.id,
      name: projects.name,
      timezone: projects.timezone,
    })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!projectRow) {
    throw new AuthorizationError("Project not found", "not_found");
  }

  const today = todayInProjectTimezone(projectRow.timezone);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const weekStart = addDays(today, -6);
  const last30Start = addDays(today, -29);

  // Month logs — drives calendar + list section.
  const monthLogs = await getDailyLogs({
    session: input.session,
    projectId: input.projectId,
    from: monthStart,
    to: monthEnd,
  });

  // Last 30 days (might overlap the month range but cheap enough).
  const last30Logs =
    last30Start >= monthStart && addDays(monthEnd, 0) >= today
      ? monthLogs
      : await getDailyLogs({
          session: input.session,
          projectId: input.projectId,
          from: last30Start,
          to: today,
        });

  const submittedLast30 = last30Logs.filter((l) => l.status === "submitted");
  const recentLogs = submittedLast30.slice(0, 7);

  const weekLogs = submittedLast30.filter((l) => l.logDate >= weekStart);
  const delayHoursLast30 = await sumDelayHoursFor(
    last30Logs.map((l) => l.id),
  );
  const delayCountLast30 = last30Logs.reduce((a, l) => a + l.delayCount, 0);
  const photosThisWeek = weekLogs.reduce((a, l) => a + l.photoCount, 0);

  const workDaysThisWeek = countWorkDays(weekStart, today);
  const missingLogsLast30 = countMissingWorkDays(submittedLast30, last30Start, today);

  const [pendingAmendmentsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(dailyLogAmendments)
    .innerJoin(dailyLogs, eq(dailyLogs.id, dailyLogAmendments.dailyLogId))
    .where(
      and(
        eq(dailyLogs.projectId, input.projectId),
        eq(dailyLogAmendments.status, "pending"),
      ),
    );

  const recentAmendments = await db
    .select({
      id: dailyLogAmendments.id,
      dailyLogId: dailyLogAmendments.dailyLogId,
      logDate: dailyLogs.logDate,
      changeSummary: dailyLogAmendments.changeSummary,
      status: dailyLogAmendments.status,
      requestedByName: users.displayName,
      requestedAt: dailyLogAmendments.requestedAt,
    })
    .from(dailyLogAmendments)
    .innerJoin(dailyLogs, eq(dailyLogs.id, dailyLogAmendments.dailyLogId))
    .leftJoin(users, eq(users.id, dailyLogAmendments.requestedByUserId))
    .where(eq(dailyLogs.projectId, input.projectId))
    .orderBy(sql`${dailyLogAmendments.requestedAt} desc`)
    .limit(5);

  const totalCrewHoursThisWeek = weekLogs.reduce(
    (a, l) => a + l.totalCrewHours,
    0,
  );

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      timezone: projectRow.timezone,
    },
    today,
    monthLogs,
    recentLogs,
    kpis: {
      logsThisWeek: weekLogs.length,
      workDaysThisWeek,
      delayHoursLast30,
      delayCountLast30,
      missingLogsLast30,
      photosThisWeek,
      pendingAmendments: pendingAmendmentsRow?.c ?? 0,
    },
    weekSummary: {
      logsSubmitted: weekLogs.length,
      workDays: workDaysThisWeek,
      totalCrewHours: totalCrewHoursThisWeek,
      delayHours: weekLogs.reduce((a, l) => a + (l.delayCount > 0 ? 1 : 0), 0),
      photos: photosThisWeek,
    },
    amendments: recentAmendments.map((a) => ({
      id: a.id,
      dailyLogId: a.dailyLogId,
      logDate: a.logDate,
      changeSummary: a.changeSummary,
      status: a.status,
      requestedByName: a.requestedByName,
      requestedAt: a.requestedAt.toISOString(),
    })),
  };
}

// Sum delay hours by joining delays across a list of log ids.
async function sumDelayHoursFor(logIds: string[]): Promise<number> {
  if (logIds.length === 0) return 0;
  const [row] = await db
    .select({
      sum: sql<string>`coalesce(sum(${dailyLogDelays.hoursLost}), 0)`,
    })
    .from(dailyLogDelays)
    .where(inArray(dailyLogDelays.dailyLogId, logIds));
  return parseFloat(row?.sum ?? "0") || 0;
}

function startOfMonth(isoDate: string): string {
  return isoDate.slice(0, 7) + "-01";
}

function endOfMonth(isoDate: string): string {
  // Day 0 of next month = last day of current month.
  const [y, m] = isoDate.split("-").map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

// Mon-Fri treated as work days. Weekend tracking isn't per-project yet;
// this mirrors the spec's calendar which shades Sat/Sun grey.
function countWorkDays(fromIso: string, toIso: string): number {
  let count = 0;
  let cur = fromIso;
  while (cur <= toIso) {
    const d = new Date(cur + "T12:00:00Z");
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

function countMissingWorkDays(
  logs: DailyLogListRow[],
  fromIso: string,
  toIso: string,
): number {
  const logged = new Set(logs.map((l) => l.logDate));
  let missing = 0;
  let cur = fromIso;
  while (cur <= toIso) {
    const d = new Date(cur + "T12:00:00Z");
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !logged.has(cur)) missing++;
    cur = addDays(cur, 1);
  }
  // Don't count today as missing — the day isn't over yet.
  const todayDow = new Date(toIso + "T12:00:00Z").getUTCDay();
  if (todayDow !== 0 && todayDow !== 6 && !logged.has(toIso)) missing--;
  return Math.max(missing, 0);
}

// Re-exported so the server page component can reference the shape.
export type { GetDailyLogsInput } from "@/domain/loaders/daily-logs";
