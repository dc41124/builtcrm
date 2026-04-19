import { logger, schedules } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { generateWeeklyReport } from "@/lib/weekly-reports/generator";
import { isMondaySendWindow } from "@/lib/weekly-reports/window";

// Hourly cron — every project is evaluated each hour. For each active
// project, we ask "is the current local time within the Monday 06:00–06:59
// window in this project's tz?" If yes AND no draft already exists for the
// week ending the prior Sunday, the generator runs.
//
// Cost: 24 evaluations per project per day (cheap — single SELECT per
// project plus the timezone check), but the actual insert work fires only
// once per week per project. The generator itself is idempotent on
// (projectId, weekStart) — a stray re-fire within the same hour is a
// no-op for `auto_draft` rows, refreshing source data without overwriting
// the contractor's summary.
//
// Trigger.dev v3 `schedules.task` runs in UTC; the per-project tz logic
// happens inside the run handler.

export const weeklyReportGeneration = schedules.task({
  id: "weekly-report-generation",
  cron: "0 * * * *", // top of every UTC hour
  maxDuration: 300,
  run: async (payload) => {
    const asOfMs = payload.timestamp.getTime();

    const activeProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        timezone: projects.timezone,
      })
      .from(projects)
      .where(eq(projects.projectStatus, "active"));

    let evaluated = 0;
    let generated = 0;
    let regenerated = 0;
    let skippedEmpty = 0;
    let skippedLocked = 0;
    let skippedNotMondayWindow = 0;
    let errored = 0;

    for (const project of activeProjects) {
      evaluated += 1;

      if (!isMondaySendWindow(asOfMs, project.timezone)) {
        skippedNotMondayWindow += 1;
        continue;
      }

      try {
        const result = await generateWeeklyReport({
          projectId: project.id,
          asOfMs,
          // Auto-fire — no actor.
          generatedByUserId: null,
        });
        if (result.status === "created") generated += 1;
        else if (result.status === "regenerated") regenerated += 1;
        else if (result.status === "skipped_empty") skippedEmpty += 1;
        else if (result.status === "skipped_locked") skippedLocked += 1;

        logger.info("weekly_report_generation.project", {
          projectId: project.id,
          projectName: project.name,
          status: result.status,
          weekStart: result.window.weekStartLocalDate,
        });
      } catch (err) {
        errored += 1;
        logger.error("weekly_report_generation.project_failed", {
          projectId: project.id,
          projectName: project.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      evaluated,
      generated,
      regenerated,
      skippedEmpty,
      skippedLocked,
      skippedNotMondayWindow,
      errored,
    };
  },
});
