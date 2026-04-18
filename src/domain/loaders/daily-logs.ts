import { and, asc, between, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  dailyLogAmendments,
  dailyLogCrewEntries,
  dailyLogDelays,
  dailyLogIssues,
  dailyLogPhotos,
  dailyLogs,
  documents,
  organizations,
  projects,
  users,
} from "@/db/schema";
import { getEffectiveContext, type EffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { presignDownloadUrl } from "@/lib/storage";
import type { WeatherConditions } from "@/lib/weather/types";

// Authorization rules enforced at this layer (per DoD rule #2):
//   - Contractor (context.role ∈ {contractor_admin, contractor_pm}):
//       full detail.
//   - Subcontractor: full detail for logs on projects they're on
//       (getEffectiveContext already gates project access), but sub-side
//       views highlight the sub's own crew row.
//   - Commercial + Residential client: REDACTED view only — weather,
//       clientSummary, clientHighlights, milestone, photos. Never crew
//       entries, delays, issues, full notes, or amendments.
//
// A client that slips past the UI and hits a /api/daily-logs endpoint
// directly will still only see the redacted shape because every loader
// call below branches on context.role.

// -----------------------------------------------------------------------------
// Shared types
// -----------------------------------------------------------------------------

export type DailyLogStatus = "draft" | "submitted";
export type DailyLogMilestoneType = "ok" | "warn" | "info";
export type DailyLogResidentialMood = "great" | "good" | "slow";
export type DailyLogDelayType =
  | "weather"
  | "material"
  | "inspection"
  | "subcontractor_no_show"
  | "coordination"
  | "other";
export type DailyLogIssueType =
  | "safety_near_miss"
  | "safety_incident"
  | "coordination"
  | "quality"
  | "other";
export type DailyLogAmendmentStatus = "pending" | "approved" | "rejected";
export type DailyLogCrewSubmittedByRole = "sub" | "contractor";

export type DailyLogWeather = {
  conditions: WeatherConditions | null;
  highC: number | null;
  lowC: number | null;
  precipPct: number | null;
  windKmh: number | null;
  source: "manual" | "api";
  capturedAt: string | null;
};

export type DailyLogPhoto = {
  id: string;
  dailyLogId: string;
  documentId: string;
  caption: string | null;
  sortOrder: number;
  isHero: boolean;
  storageKey: string;
  title: string;
  // Short-lived R2 presigned URL so client-side <img> tags can render
  // the thumbnail directly. Expires in 10 minutes — long enough for an
  // active user session to view and click through, short enough that
  // a captured URL doesn't leak indefinitely.
  url: string;
};

export type DailyLogCrewRow = {
  id: string;
  orgId: string;
  orgName: string;
  trade: string | null;
  headcount: number;
  hours: number;
  submittedNote: string | null;
  submittedIssues: string | null;
  submittedAt: string;
  submittedByRole: DailyLogCrewSubmittedByRole;
  reconciledHeadcount: number | null;
  reconciledHours: number | null;
  reconciledAt: string | null;
  subAckedReconciliationAt: string | null;
  requiresAck: boolean;
};

export type DailyLogDelayRow = {
  id: string;
  delayType: DailyLogDelayType;
  description: string;
  hoursLost: number;
  impactedActivity: string | null;
};

export type DailyLogIssueRow = {
  id: string;
  issueType: DailyLogIssueType;
  description: string;
};

export type DailyLogAmendmentRow = {
  id: string;
  changeSummary: string;
  changedFields: Record<string, { before: unknown; after: unknown }>;
  status: DailyLogAmendmentStatus;
  requestedByUserId: string;
  requestedByName: string | null;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  appliedAt: string | null;
};

// -----------------------------------------------------------------------------
// Summary (used by the list view, both full and redacted consumers).
// -----------------------------------------------------------------------------

export type DailyLogListRow = {
  id: string;
  projectId: string;
  projectName: string;
  logDate: string; // YYYY-MM-DD
  status: DailyLogStatus;
  weather: DailyLogWeather;
  reportedByUserId: string;
  reportedByName: string | null;
  submittedAt: string | null;
  editWindowClosesAt: string | null;
  photoCount: number;
  delayCount: number;
  issueCount: number;
  crewCount: number;
  totalCrewHeadcount: number;
  totalCrewHours: number;
  hasAmendments: boolean;
  // Client-facing summary bits (populated on full view too — they're just
  // written by the GC). Clients ONLY see these when they hit the redacted
  // loader path.
  clientSummary: string | null;
  clientHighlights: string[] | null;
  milestone: string | null;
  milestoneType: DailyLogMilestoneType | null;
  // Contractor/sub-only fields. Null in the redacted view.
  notes: string | null;
  // Residential-only fields — populated regardless of role but only the
  // residential portal view should render them.
  residentialHeroTitle: string | null;
  residentialSummary: string | null;
  residentialMood: DailyLogResidentialMood | null;
};

export type DailyLogDetailFull = DailyLogListRow & {
  mode: "full";
  crew: DailyLogCrewRow[];
  delays: DailyLogDelayRow[];
  issues: DailyLogIssueRow[];
  photos: DailyLogPhoto[];
  amendments: DailyLogAmendmentRow[];
  residentialTeamNote: string | null;
  residentialTeamNoteByUserId: string | null;
  residentialTeamNoteByName: string | null;
};

export type DailyLogDetailRedacted = {
  mode: "redacted";
  id: string;
  projectId: string;
  projectName: string;
  logDate: string;
  status: DailyLogStatus;
  weather: DailyLogWeather;
  // Safe-for-client bits only.
  clientSummary: string | null;
  clientHighlights: string[] | null;
  milestone: string | null;
  milestoneType: DailyLogMilestoneType | null;
  photos: DailyLogPhoto[];
  // Residential-only — always fetched (cheap), residential portal view
  // renders them, commercial view ignores.
  residentialHeroTitle: string | null;
  residentialSummary: string | null;
  residentialMood: DailyLogResidentialMood | null;
  residentialTeamNote: string | null;
  residentialTeamNoteByUserId: string | null;
  residentialTeamNoteByName: string | null;
  // Hint for UI badge — whether the commercial "weather event" pill shows.
  hadWeatherDelay: boolean;
};

// -----------------------------------------------------------------------------
// getDailyLogs — list view. Project-scoped, date-range filtered.
// -----------------------------------------------------------------------------

export type GetDailyLogsInput = {
  session: SessionLike | null | undefined;
  projectId: string;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

export async function getDailyLogs(
  input: GetDailyLogsInput,
): Promise<DailyLogListRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const rows = await queryLogsBase(ctx, {
    projectIds: [input.projectId],
    from: input.from,
    to: input.to,
  });
  return rows;
}

// -----------------------------------------------------------------------------
// getDailyLog — single log, portal-aware shape.
//   - contractor / sub: returns full shape with crew, delays, issues, photos,
//     amendments, notes.
//   - client: returns redacted shape.
// Callers should check `result.mode` to narrow the union.
// -----------------------------------------------------------------------------

export type GetDailyLogInput = {
  session: SessionLike | null | undefined;
  logId: string;
};

export async function getDailyLog(
  input: GetDailyLogInput,
): Promise<DailyLogDetailFull | DailyLogDetailRedacted> {
  // First hop: resolve the log's projectId without any auth check so we
  // can then call getEffectiveContext(projectId) for the real gate.
  // Missing log → 404 via AuthorizationError with code 'not_found'.
  const [logHead] = await db
    .select({ id: dailyLogs.id, projectId: dailyLogs.projectId })
    .from(dailyLogs)
    .where(eq(dailyLogs.id, input.logId))
    .limit(1);
  if (!logHead) {
    throw new AuthorizationError("Daily log not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, logHead.projectId);
  const isClient =
    ctx.role === "commercial_client" || ctx.role === "residential_client";

  const [head] = await queryLogsBase(ctx, {
    projectIds: [logHead.projectId],
    logIds: [input.logId],
  });
  if (!head) {
    throw new AuthorizationError("Daily log not found", "not_found");
  }

  const photos = await queryPhotos(input.logId);

  if (isClient) {
    return {
      mode: "redacted",
      id: head.id,
      projectId: head.projectId,
      projectName: head.projectName,
      logDate: head.logDate,
      status: head.status,
      weather: head.weather,
      clientSummary: head.clientSummary,
      clientHighlights: head.clientHighlights,
      milestone: head.milestone,
      milestoneType: head.milestoneType,
      photos,
      residentialHeroTitle: head.residentialHeroTitle,
      residentialSummary: head.residentialSummary,
      residentialMood: head.residentialMood,
      residentialTeamNote: await queryResidentialTeamNote(input.logId),
      residentialTeamNoteByUserId: null,
      residentialTeamNoteByName: null,
      hadWeatherDelay: head.delayCount > 0,
    };
  }

  const [crew, delays, issues, amendments, teamNote] = await Promise.all([
    queryCrew(input.logId, ctx),
    queryDelays(input.logId),
    queryIssues(input.logId),
    queryAmendments(input.logId),
    queryResidentialTeamNoteWithAuthor(input.logId),
  ]);

  return {
    ...head,
    mode: "full",
    crew,
    delays,
    issues,
    photos,
    amendments,
    residentialTeamNote: teamNote?.note ?? null,
    residentialTeamNoteByUserId: teamNote?.byUserId ?? null,
    residentialTeamNoteByName: teamNote?.byName ?? null,
  };
}

// -----------------------------------------------------------------------------
// getCrewEntriesForWeek — sub cross-project view. Returns the sub's own
// crew entries across every project they're on for the given date range.
// Used by the subcontractor daily-logs page "By project / This week" rail.
// -----------------------------------------------------------------------------

export type GetCrewEntriesForWeekInput = {
  session: SessionLike | null | undefined;
  from: string;
  to: string;
};

export type SubCrewEntryRow = {
  id: string;
  projectId: string;
  projectName: string;
  logDate: string;
  orgId: string;
  trade: string | null;
  headcount: number;
  hours: number;
  submittedNote: string | null;
  submittedAt: string;
  reconciledHeadcount: number | null;
  reconciledHours: number | null;
  reconciledAt: string | null;
  subAckedReconciliationAt: string | null;
  requiresAck: boolean;
};

export async function getCrewEntriesForWeek(
  input: GetCrewEntriesForWeekInput,
): Promise<SubCrewEntryRow[]> {
  // This loader is special: we don't have a projectId to derive context
  // from. We still need to know WHICH user is calling so we can scope to
  // their sub org. Re-implement the minimum auth check here.
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }

  const rows = await db
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
        eq(dailyLogCrewEntries.submittedByUserId, input.session.appUserId),
        between(dailyLogCrewEntries.logDate, input.from, input.to),
      ),
    )
    .orderBy(desc(dailyLogCrewEntries.logDate));

  return rows.map((r) => {
    const requiresAck =
      r.reconciledAt != null && r.subAckedReconciliationAt == null;
    return {
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName,
      logDate: r.logDate,
      orgId: r.orgId,
      trade: r.trade,
      headcount: r.headcount,
      hours: numericToFloat(r.hours),
      submittedNote: r.submittedNote,
      submittedAt: isoDate(r.submittedAt),
      reconciledHeadcount: r.reconciledHeadcount,
      reconciledHours: r.reconciledHours != null ? numericToFloat(r.reconciledHours) : null,
      reconciledAt: r.reconciledAt ? isoDate(r.reconciledAt) : null,
      subAckedReconciliationAt: r.subAckedReconciliationAt
        ? isoDate(r.subAckedReconciliationAt)
        : null,
      requiresAck,
    };
  });
}

// -----------------------------------------------------------------------------
// getAmendmentsForLog — standalone fetch for the amendments-only rail.
// -----------------------------------------------------------------------------

export async function getAmendmentsForLog(
  session: SessionLike | null | undefined,
  logId: string,
): Promise<DailyLogAmendmentRow[]> {
  const [logHead] = await db
    .select({ projectId: dailyLogs.projectId })
    .from(dailyLogs)
    .where(eq(dailyLogs.id, logId))
    .limit(1);
  if (!logHead) {
    throw new AuthorizationError("Daily log not found", "not_found");
  }
  // Context gate — clients never see amendments.
  const ctx = await getEffectiveContext(session, logHead.projectId);
  if (ctx.role === "commercial_client" || ctx.role === "residential_client") {
    return [];
  }
  return queryAmendments(logId);
}

// -----------------------------------------------------------------------------
// Internal query helpers
// -----------------------------------------------------------------------------

type BaseQueryOpts = {
  projectIds: string[];
  logIds?: string[];
  from?: string;
  to?: string;
};

async function queryLogsBase(
  ctx: EffectiveContext,
  opts: BaseQueryOpts,
): Promise<DailyLogListRow[]> {
  // Pull logs, join reporter name, aggregate child counts in one pass.
  const logs = await db
    .select({
      id: dailyLogs.id,
      projectId: dailyLogs.projectId,
      projectName: projects.name,
      logDate: dailyLogs.logDate,
      status: dailyLogs.status,
      reportedByUserId: dailyLogs.reportedByUserId,
      reportedByName: users.displayName,
      submittedAt: dailyLogs.submittedAt,
      editWindowClosesAt: dailyLogs.editWindowClosesAt,
      weatherConditions: dailyLogs.weatherConditions,
      weatherHighC: dailyLogs.weatherHighC,
      weatherLowC: dailyLogs.weatherLowC,
      weatherPrecipPct: dailyLogs.weatherPrecipPct,
      weatherWindKmh: dailyLogs.weatherWindKmh,
      weatherSource: dailyLogs.weatherSource,
      weatherCapturedAt: dailyLogs.weatherCapturedAt,
      notes: dailyLogs.notes,
      clientSummary: dailyLogs.clientSummary,
      clientHighlights: dailyLogs.clientHighlights,
      milestone: dailyLogs.milestone,
      milestoneType: dailyLogs.milestoneType,
      residentialHeroTitle: dailyLogs.residentialHeroTitle,
      residentialSummary: dailyLogs.residentialSummary,
      residentialMood: dailyLogs.residentialMood,
    })
    .from(dailyLogs)
    .innerJoin(projects, eq(projects.id, dailyLogs.projectId))
    .leftJoin(users, eq(users.id, dailyLogs.reportedByUserId))
    .where(
      and(
        inArray(dailyLogs.projectId, opts.projectIds),
        opts.logIds ? inArray(dailyLogs.id, opts.logIds) : undefined,
        opts.from && opts.to
          ? between(dailyLogs.logDate, opts.from, opts.to)
          : undefined,
      ),
    )
    .orderBy(desc(dailyLogs.logDate));
  if (logs.length === 0) return [];

  const logIds = logs.map((l) => l.id);

  // Count children in three grouped queries.
  const [photoCounts, delayCounts, issueCounts, crewAgg, amendCounts] =
    await Promise.all([
      db
        .select({
          dailyLogId: dailyLogPhotos.dailyLogId,
          c: sql<number>`count(*)::int`,
        })
        .from(dailyLogPhotos)
        .where(inArray(dailyLogPhotos.dailyLogId, logIds))
        .groupBy(dailyLogPhotos.dailyLogId),
      db
        .select({
          dailyLogId: dailyLogDelays.dailyLogId,
          c: sql<number>`count(*)::int`,
        })
        .from(dailyLogDelays)
        .where(inArray(dailyLogDelays.dailyLogId, logIds))
        .groupBy(dailyLogDelays.dailyLogId),
      db
        .select({
          dailyLogId: dailyLogIssues.dailyLogId,
          c: sql<number>`count(*)::int`,
        })
        .from(dailyLogIssues)
        .where(inArray(dailyLogIssues.dailyLogId, logIds))
        .groupBy(dailyLogIssues.dailyLogId),
      db
        .select({
          dailyLogId: dailyLogCrewEntries.dailyLogId,
          c: sql<number>`count(*)::int`,
          headSum: sql<number>`coalesce(sum(${dailyLogCrewEntries.headcount}), 0)::int`,
          hoursSum: sql<string>`coalesce(sum(${dailyLogCrewEntries.hours}), 0)`,
        })
        .from(dailyLogCrewEntries)
        .where(inArray(dailyLogCrewEntries.dailyLogId, logIds))
        .groupBy(dailyLogCrewEntries.dailyLogId),
      db
        .select({
          dailyLogId: dailyLogAmendments.dailyLogId,
          c: sql<number>`count(*)::int`,
        })
        .from(dailyLogAmendments)
        .where(inArray(dailyLogAmendments.dailyLogId, logIds))
        .groupBy(dailyLogAmendments.dailyLogId),
    ]);

  const photoBy = indexBy(photoCounts, (r) => r.dailyLogId);
  const delayBy = indexBy(delayCounts, (r) => r.dailyLogId);
  const issueBy = indexBy(issueCounts, (r) => r.dailyLogId);
  const crewBy = indexBy(crewAgg, (r) => r.dailyLogId ?? "");
  const amendBy = indexBy(amendCounts, (r) => r.dailyLogId);

  // Role-based redaction on the returned shape.
  const isClient =
    ctx.role === "commercial_client" || ctx.role === "residential_client";

  return logs.map((l) => ({
    id: l.id,
    projectId: l.projectId,
    projectName: l.projectName,
    logDate: l.logDate,
    status: l.status,
    weather: {
      conditions: l.weatherConditions,
      highC: l.weatherHighC,
      lowC: l.weatherLowC,
      precipPct: l.weatherPrecipPct,
      windKmh: isClient ? null : l.weatherWindKmh,
      source: l.weatherSource,
      capturedAt: l.weatherCapturedAt ? isoDate(l.weatherCapturedAt) : null,
    },
    reportedByUserId: isClient ? "" : l.reportedByUserId,
    reportedByName: isClient ? null : l.reportedByName,
    submittedAt: l.submittedAt ? isoDate(l.submittedAt) : null,
    editWindowClosesAt: l.editWindowClosesAt
      ? isoDate(l.editWindowClosesAt)
      : null,
    photoCount: photoBy.get(l.id)?.c ?? 0,
    delayCount: isClient ? 0 : delayBy.get(l.id)?.c ?? 0,
    issueCount: isClient ? 0 : issueBy.get(l.id)?.c ?? 0,
    crewCount: isClient ? 0 : crewBy.get(l.id)?.c ?? 0,
    totalCrewHeadcount: isClient ? 0 : crewBy.get(l.id)?.headSum ?? 0,
    totalCrewHours: isClient
      ? 0
      : numericToFloat(crewBy.get(l.id)?.hoursSum ?? "0"),
    hasAmendments: isClient ? false : (amendBy.get(l.id)?.c ?? 0) > 0,
    clientSummary: l.clientSummary,
    clientHighlights: l.clientHighlights ?? null,
    milestone: l.milestone,
    milestoneType: l.milestoneType,
    notes: isClient ? null : l.notes,
    residentialHeroTitle: l.residentialHeroTitle,
    residentialSummary: l.residentialSummary,
    residentialMood: l.residentialMood,
  }));
}

async function queryPhotos(logId: string): Promise<DailyLogPhoto[]> {
  const rows = await db
    .select({
      id: dailyLogPhotos.id,
      dailyLogId: dailyLogPhotos.dailyLogId,
      documentId: dailyLogPhotos.documentId,
      caption: dailyLogPhotos.caption,
      sortOrder: dailyLogPhotos.sortOrder,
      isHero: dailyLogPhotos.isHero,
      storageKey: documents.storageKey,
      title: documents.title,
    })
    .from(dailyLogPhotos)
    .innerJoin(documents, eq(documents.id, dailyLogPhotos.documentId))
    .where(eq(dailyLogPhotos.dailyLogId, logId))
    .orderBy(desc(dailyLogPhotos.isHero), asc(dailyLogPhotos.sortOrder));

  // Presign every photo's download URL in parallel. 10-minute TTL is
  // plenty for a user to view the drawer and click through, and short
  // enough that any copied URL stops working quickly.
  const urls = await Promise.all(
    rows.map((r) =>
      presignDownloadUrl({ key: r.storageKey, expiresInSeconds: 600 }).catch(
        () => "",
      ),
    ),
  );
  return rows.map((r, i) => ({ ...r, url: urls[i] }));
}

async function queryCrew(
  logId: string,
  ctx: EffectiveContext,
): Promise<DailyLogCrewRow[]> {
  const rows = await db
    .select({
      id: dailyLogCrewEntries.id,
      orgId: dailyLogCrewEntries.orgId,
      orgName: organizations.name,
      trade: dailyLogCrewEntries.trade,
      headcount: dailyLogCrewEntries.headcount,
      hours: dailyLogCrewEntries.hours,
      submittedNote: dailyLogCrewEntries.submittedNote,
      submittedIssues: dailyLogCrewEntries.submittedIssues,
      submittedAt: dailyLogCrewEntries.submittedAt,
      submittedByRole: dailyLogCrewEntries.submittedByRole,
      reconciledHeadcount: dailyLogCrewEntries.reconciledHeadcount,
      reconciledHours: dailyLogCrewEntries.reconciledHours,
      reconciledAt: dailyLogCrewEntries.reconciledAt,
      subAckedReconciliationAt: dailyLogCrewEntries.subAckedReconciliationAt,
    })
    .from(dailyLogCrewEntries)
    .innerJoin(organizations, eq(organizations.id, dailyLogCrewEntries.orgId))
    .where(eq(dailyLogCrewEntries.dailyLogId, logId))
    .orderBy(asc(organizations.name));

  // Subs only see their own crew rows' submitted notes/issues? No —
  // per spec, subs see all crew orgs on the log (headcount + hours table),
  // but each sub's own note is highlighted and visible. Keep all fields
  // visible to subcontractor role; hide notes/issues from clients (they
  // don't get this loader output anyway).
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    orgName: r.orgName,
    trade: r.trade,
    headcount: r.headcount,
    hours: numericToFloat(r.hours),
    submittedNote:
      ctx.role === "subcontractor_user" && r.orgId !== ctx.organization.id
        ? null
        : r.submittedNote,
    submittedIssues:
      ctx.role === "subcontractor_user" && r.orgId !== ctx.organization.id
        ? null
        : r.submittedIssues,
    submittedAt: isoDate(r.submittedAt),
    submittedByRole: r.submittedByRole,
    reconciledHeadcount: r.reconciledHeadcount,
    reconciledHours: r.reconciledHours != null ? numericToFloat(r.reconciledHours) : null,
    reconciledAt: r.reconciledAt ? isoDate(r.reconciledAt) : null,
    subAckedReconciliationAt: r.subAckedReconciliationAt
      ? isoDate(r.subAckedReconciliationAt)
      : null,
    requiresAck:
      r.reconciledAt != null && r.subAckedReconciliationAt == null,
  }));
}

async function queryDelays(logId: string): Promise<DailyLogDelayRow[]> {
  const rows = await db
    .select({
      id: dailyLogDelays.id,
      delayType: dailyLogDelays.delayType,
      description: dailyLogDelays.description,
      hoursLost: dailyLogDelays.hoursLost,
      impactedActivity: dailyLogDelays.impactedActivity,
    })
    .from(dailyLogDelays)
    .where(eq(dailyLogDelays.dailyLogId, logId))
    .orderBy(asc(dailyLogDelays.createdAt));
  return rows.map((r) => ({
    id: r.id,
    delayType: r.delayType,
    description: r.description,
    hoursLost: numericToFloat(r.hoursLost),
    impactedActivity: r.impactedActivity,
  }));
}

async function queryIssues(logId: string): Promise<DailyLogIssueRow[]> {
  const rows = await db
    .select({
      id: dailyLogIssues.id,
      issueType: dailyLogIssues.issueType,
      description: dailyLogIssues.description,
    })
    .from(dailyLogIssues)
    .where(eq(dailyLogIssues.dailyLogId, logId))
    .orderBy(asc(dailyLogIssues.createdAt));
  return rows;
}

async function queryAmendments(
  logId: string,
): Promise<DailyLogAmendmentRow[]> {
  const rows = await db
    .select({
      id: dailyLogAmendments.id,
      changeSummary: dailyLogAmendments.changeSummary,
      changedFields: dailyLogAmendments.changedFields,
      status: dailyLogAmendments.status,
      requestedByUserId: dailyLogAmendments.requestedByUserId,
      requestedByName: users.displayName,
      requestedAt: dailyLogAmendments.requestedAt,
      reviewedByUserId: dailyLogAmendments.reviewedByUserId,
      reviewedAt: dailyLogAmendments.reviewedAt,
      reviewNote: dailyLogAmendments.reviewNote,
      appliedAt: dailyLogAmendments.appliedAt,
    })
    .from(dailyLogAmendments)
    .leftJoin(users, eq(users.id, dailyLogAmendments.requestedByUserId))
    .where(eq(dailyLogAmendments.dailyLogId, logId))
    .orderBy(desc(dailyLogAmendments.requestedAt));

  // Look up reviewer names in a second pass (leftJoin twice on users
  // would alias-juggle; a tiny IN query is simpler).
  const reviewerIds = rows
    .map((r) => r.reviewedByUserId)
    .filter((id): id is string => !!id);
  const reviewerNames = new Map<string, string | null>();
  if (reviewerIds.length > 0) {
    const revs = await db
      .select({ id: users.id, name: users.displayName })
      .from(users)
      .where(inArray(users.id, reviewerIds));
    for (const r of revs) reviewerNames.set(r.id, r.name);
  }

  return rows.map((r) => ({
    id: r.id,
    changeSummary: r.changeSummary,
    changedFields: (r.changedFields ?? {}) as Record<
      string,
      { before: unknown; after: unknown }
    >,
    status: r.status,
    requestedByUserId: r.requestedByUserId,
    requestedByName: r.requestedByName,
    requestedAt: isoDate(r.requestedAt),
    reviewedByUserId: r.reviewedByUserId,
    reviewedByName: r.reviewedByUserId
      ? reviewerNames.get(r.reviewedByUserId) ?? null
      : null,
    reviewedAt: r.reviewedAt ? isoDate(r.reviewedAt) : null,
    reviewNote: r.reviewNote,
    appliedAt: r.appliedAt ? isoDate(r.appliedAt) : null,
  }));
}

async function queryResidentialTeamNote(logId: string): Promise<string | null> {
  const [row] = await db
    .select({ note: dailyLogs.residentialTeamNote })
    .from(dailyLogs)
    .where(eq(dailyLogs.id, logId))
    .limit(1);
  return row?.note ?? null;
}

async function queryResidentialTeamNoteWithAuthor(
  logId: string,
): Promise<{ note: string | null; byUserId: string | null; byName: string | null } | null> {
  const [row] = await db
    .select({
      note: dailyLogs.residentialTeamNote,
      byUserId: dailyLogs.residentialTeamNoteByUserId,
      byName: users.displayName,
    })
    .from(dailyLogs)
    .leftJoin(users, eq(users.id, dailyLogs.residentialTeamNoteByUserId))
    .where(eq(dailyLogs.id, logId))
    .limit(1);
  if (!row) return null;
  return { note: row.note, byUserId: row.byUserId, byName: row.byName };
}

// -----------------------------------------------------------------------------
// Small utilities
// -----------------------------------------------------------------------------

function indexBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T> {
  const m = new Map<K, T>();
  for (const x of arr) m.set(key(x), x);
  return m;
}

function numericToFloat(v: string | number): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(d: Date): string {
  return d.toISOString();
}
