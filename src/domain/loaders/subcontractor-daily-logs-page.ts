import { and, between, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  dailyLogCrewEntries,
  dailyLogPhotos,
  dailyLogs,
  organizations,
  projectOrganizationMemberships,
  projects,
  roleAssignments,
  users,
} from "@/db/schema";
import type { SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import type {
  DailyLogListRow,
  SubCrewEntryRow,
} from "@/domain/loaders/daily-logs";
import { countWorkDays } from "@/lib/daily-logs/calendar";
import { addDays, todayInProjectTimezone } from "@/lib/daily-logs/date-utils";
import type { WeatherConditions } from "@/lib/weather/types";

// Page-level view for the subcontractor daily-logs page. Cross-project
// by default (subs usually work across 2-5 projects at once), with
// project tabs for single-project focus.
//
// Authorization: the loader resolves the user's sub organization by
// looking at role_assignments, then scopes every downstream query to
// projects where that org has an active subcontractor membership.
// No projectId gate up front — access is row-filtered by org membership.

export type SubDailyLogsProject = {
  id: string;
  name: string;
  timezone: string;
  contractorOrganizationId: string;
};

export type SubDailyLogsCrewEntry = SubCrewEntryRow;

export type SubDailyLogsGcLog = {
  id: string;
  projectId: string;
  projectName: string;
  logDate: string;
  status: "draft" | "submitted";
  reportedByName: string | null;
  weather: {
    conditions: WeatherConditions | null;
    highC: number | null;
    lowC: number | null;
  };
  notes: string | null;
  clientSummary: string | null;
  photoCount: number;
  // Nested: the sub's own crew row on this log (if they submitted one).
  myEntry: SubDailyLogsCrewEntry | null;
};

export type SubDailyLogsPageView = {
  user: { id: string; displayName: string | null };
  organization: { id: string; name: string };
  today: string;
  projects: SubDailyLogsProject[];
  crewEntries: SubDailyLogsCrewEntry[];
  gcLogs: SubDailyLogsGcLog[];
  kpis: {
    myCrewHoursThisWeek: number;
    entriesSubmittedThisWeek: number;
    workDaysThisWeek: number;
    outstandingToday: number;
    gcLogsThisWeek: number;
    reconciliationsToReview: number;
  };
};

export type GetSubDailyLogsPageViewInput = {
  session: SessionLike | null | undefined;
};

export async function getSubDailyLogsPageView(
  input: GetSubDailyLogsPageViewInput,
): Promise<SubDailyLogsPageView> {
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const userId = input.session.appUserId;

  // Resolve the sub's organization membership. A user can belong to
  // multiple orgs in principle but the sub portal shows one at a time.
  // Pick the first subcontractor-portal role assignment.
  const [assignment] = await db
    .select({
      organizationId: roleAssignments.organizationId,
      orgName: organizations.name,
    })
    .from(roleAssignments)
    .innerJoin(organizations, eq(organizations.id, roleAssignments.organizationId))
    .where(
      and(
        eq(roleAssignments.userId, userId),
        eq(roleAssignments.portalType, "subcontractor"),
      ),
    )
    .limit(1);
  if (!assignment) {
    throw new AuthorizationError(
      "No subcontractor access for this user",
      "forbidden",
    );
  }

  const [user] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new AuthorizationError("User not found", "unauthenticated");
  }

  // Projects the sub org is an active subcontractor on.
  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      timezone: projects.timezone,
      contractorOrganizationId: projects.contractorOrganizationId,
    })
    .from(projectOrganizationMemberships)
    .innerJoin(projects, eq(projects.id, projectOrganizationMemberships.projectId))
    .where(
      and(
        eq(
          projectOrganizationMemberships.organizationId,
          assignment.organizationId,
        ),
        eq(projectOrganizationMemberships.membershipType, "subcontractor"),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    )
    .orderBy(projects.name);

  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) {
    return {
      user: { id: user.id, displayName: user.displayName },
      organization: { id: assignment.organizationId, name: assignment.orgName },
      today: todayInProjectTimezone("UTC"),
      projects: [],
      crewEntries: [],
      gcLogs: [],
      kpis: {
        myCrewHoursThisWeek: 0,
        entriesSubmittedThisWeek: 0,
        workDaysThisWeek: 5,
        outstandingToday: 0,
        gcLogsThisWeek: 0,
        reconciliationsToReview: 0,
      },
    };
  }

  // Pick the timezone of the sub's most common project as the "today"
  // anchor. If they span zones, this is a rough choice — the calendar
  // still renders dates the same way.
  const anchorTimezone = projectRows[0].timezone;
  const today = todayInProjectTimezone(anchorTimezone);
  const weekStart = addDays(today, -6);
  const last30Start = addDays(today, -29);

  // Sub's own crew entries across all projects for last 30 days.
  const crewRows = await db
    .select({
      id: dailyLogCrewEntries.id,
      projectId: dailyLogCrewEntries.projectId,
      projectName: projects.name,
      logDate: dailyLogCrewEntries.logDate,
      orgId: dailyLogCrewEntries.orgId,
      trade: dailyLogCrewEntries.trade,
      headcount: dailyLogCrewEntries.headcount,
      hours: dailyLogCrewEntries.hours,
      submittedNote: dailyLogCrewEntries.submittedNote,
      submittedAt: dailyLogCrewEntries.submittedAt,
      reconciledHeadcount: dailyLogCrewEntries.reconciledHeadcount,
      reconciledHours: dailyLogCrewEntries.reconciledHours,
      reconciledAt: dailyLogCrewEntries.reconciledAt,
      subAckedReconciliationAt: dailyLogCrewEntries.subAckedReconciliationAt,
    })
    .from(dailyLogCrewEntries)
    .innerJoin(projects, eq(projects.id, dailyLogCrewEntries.projectId))
    .where(
      and(
        eq(dailyLogCrewEntries.orgId, assignment.organizationId),
        between(dailyLogCrewEntries.logDate, last30Start, today),
      ),
    )
    .orderBy(desc(dailyLogCrewEntries.logDate));

  const crewEntries: SubDailyLogsCrewEntry[] = crewRows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    logDate: r.logDate,
    orgId: r.orgId,
    trade: r.trade,
    headcount: r.headcount,
    hours: parseFloat(r.hours),
    submittedNote: r.submittedNote,
    submittedAt: r.submittedAt.toISOString(),
    reconciledHeadcount: r.reconciledHeadcount,
    reconciledHours:
      r.reconciledHours != null ? parseFloat(r.reconciledHours) : null,
    reconciledAt: r.reconciledAt ? r.reconciledAt.toISOString() : null,
    subAckedReconciliationAt: r.subAckedReconciliationAt
      ? r.subAckedReconciliationAt.toISOString()
      : null,
    requiresAck:
      r.reconciledAt != null && r.subAckedReconciliationAt == null,
  }));

  // Index crew entries by (projectId, logDate) for quick attach to GC logs.
  const crewByKey = new Map<string, SubDailyLogsCrewEntry>();
  for (const c of crewEntries) {
    crewByKey.set(`${c.projectId}::${c.logDate}`, c);
  }

  // GC-posted daily logs on the sub's projects, last 30 days.
  const gcRows = await db
    .select({
      id: dailyLogs.id,
      projectId: dailyLogs.projectId,
      projectName: projects.name,
      logDate: dailyLogs.logDate,
      status: dailyLogs.status,
      reportedByName: users.displayName,
      weatherConditions: dailyLogs.weatherConditions,
      weatherHighC: dailyLogs.weatherHighC,
      weatherLowC: dailyLogs.weatherLowC,
      notes: dailyLogs.notes,
      clientSummary: dailyLogs.clientSummary,
    })
    .from(dailyLogs)
    .innerJoin(projects, eq(projects.id, dailyLogs.projectId))
    .leftJoin(users, eq(users.id, dailyLogs.reportedByUserId))
    .where(
      and(
        inArray(dailyLogs.projectId, projectIds),
        eq(dailyLogs.status, "submitted"),
        between(dailyLogs.logDate, last30Start, today),
      ),
    )
    .orderBy(desc(dailyLogs.logDate));

  const gcLogIds = gcRows.map((g) => g.id);
  const photoCountsByLog = gcLogIds.length > 0
    ? await db
        .select({
          logId: dailyLogPhotos.dailyLogId,
          c: sql<number>`count(*)::int`,
        })
        .from(dailyLogPhotos)
        .where(inArray(dailyLogPhotos.dailyLogId, gcLogIds))
        .groupBy(dailyLogPhotos.dailyLogId)
    : [];
  const photoMap = new Map(photoCountsByLog.map((p) => [p.logId, p.c]));

  const gcLogs: SubDailyLogsGcLog[] = gcRows.map((g) => {
    const myEntry = crewByKey.get(`${g.projectId}::${g.logDate}`) ?? null;
    return {
      id: g.id,
      projectId: g.projectId,
      projectName: g.projectName,
      logDate: g.logDate,
      status: g.status,
      reportedByName: g.reportedByName,
      weather: {
        conditions: g.weatherConditions,
        highC: g.weatherHighC,
        lowC: g.weatherLowC,
      },
      notes: g.notes,
      clientSummary: g.clientSummary,
      photoCount: photoMap.get(g.id) ?? 0,
      myEntry,
    };
  });

  // KPIs.
  const weekEntries = crewEntries.filter((c) => c.logDate >= weekStart);
  const myCrewHoursThisWeek = weekEntries.reduce(
    (a, c) => a + (c.reconciledHours ?? c.hours),
    0,
  );
  const entriesSubmittedThisWeek = weekEntries.length;
  const workDaysThisWeek = countWorkDays(weekStart, today);

  // Today outstanding: for each project the sub is on, was there a crew
  // entry submitted today? Simple count of missing-today projects.
  const todayKeys = new Set(
    crewEntries.filter((c) => c.logDate === today).map((c) => c.projectId),
  );
  const outstandingToday = projectIds.reduce(
    (a, id) => (todayKeys.has(id) ? a : a + 1),
    0,
  );

  const gcLogsThisWeek = gcLogs.filter((g) => g.logDate >= weekStart).length;
  const reconciliationsToReview = crewEntries.filter(
    (c) => c.requiresAck,
  ).length;

  return {
    user: { id: user.id, displayName: user.displayName },
    organization: { id: assignment.organizationId, name: assignment.orgName },
    today,
    projects: projectRows,
    crewEntries,
    gcLogs,
    kpis: {
      myCrewHoursThisWeek,
      entriesSubmittedThisWeek,
      workDaysThisWeek,
      outstandingToday,
      gcLogsThisWeek,
      reconciliationsToReview,
    },
  };
}

// Also used by the list-row type on the workspace, exported for typing.
export type SubGcLogList = SubDailyLogsGcLog[];

// Re-export base type so the workspace doesn't need to import from two places.
export type { DailyLogListRow };
