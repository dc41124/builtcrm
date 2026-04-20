import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  getDailyLogs,
  type DailyLogListRow,
} from "@/domain/loaders/daily-logs";
import { endOfMonth, startOfMonth } from "@/lib/daily-logs/calendar";
import { addDays, todayInProjectTimezone } from "@/lib/daily-logs/date-utils";

// Page-level view for the commercial client daily-logs page.
//
// Authorization: gated through getEffectiveContext. Role must resolve
// to `commercial_client`. The underlying getDailyLogs loader already
// redacts crew counts, delay counts, issues, notes, amendments for
// client roles — clients see weather + clientSummary + clientHighlights
// + milestone + photos only.

export type CommercialDailyLogsPageView = {
  project: {
    id: string;
    name: string;
    timezone: string;
  };
  today: string;
  monthLogs: DailyLogListRow[];
  recentLogs: DailyLogListRow[];
  kpis: {
    updatesThisWeek: number;
    milestonesThisMonth: number;
    weatherDays: number;
    photosThisMonth: number;
  };
};

export type GetCommercialDailyLogsPageViewInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getCommercialDailyLogsPageView(
  input: GetCommercialDailyLogsPageViewInput,
): Promise<CommercialDailyLogsPageView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "commercial_client") {
    throw new AuthorizationError(
      "Only commercial clients can view the commercial daily-logs page",
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

  const monthLogs = await getDailyLogs({
    session: input.session,
    projectId: input.projectId,
    from: monthStart,
    to: monthEnd,
  });

  // Only show submitted logs to clients — drafts stay internal.
  const visibleLogs = monthLogs.filter((l) => l.status === "submitted");

  // Sort newest first for the list.
  const recentLogs = [...visibleLogs]
    .sort((a, b) => (a.logDate < b.logDate ? 1 : -1))
    .slice(0, 10);

  const updatesThisWeek = visibleLogs.filter(
    (l) => l.logDate >= weekStart,
  ).length;

  const milestonesThisMonth = visibleLogs.filter(
    (l) => l.milestone && l.milestone.length > 0,
  ).length;

  // Weather days: count logs whose weather conditions indicate slowed
  // site work (rain or snow). We don't expose the redacted delay count
  // to clients, but weather conditions are safe to surface.
  const weatherDays = visibleLogs.filter((l) => {
    const c = l.weather.conditions;
    return c === "light_rain" || c === "heavy_rain" || c === "snow";
  }).length;

  const photosThisMonth = visibleLogs.reduce((a, l) => a + l.photoCount, 0);

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      timezone: projectRow.timezone,
    },
    today,
    monthLogs: visibleLogs,
    recentLogs,
    kpis: {
      updatesThisWeek,
      milestonesThisMonth,
      weatherDays,
      photosThisMonth,
    },
  };
}

