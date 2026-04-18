import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  getDailyLogs,
  type DailyLogListRow,
} from "@/domain/loaders/daily-logs";
import { todayInProjectTimezone } from "@/lib/daily-logs/date-utils";

// Page-level view for the residential "Journal" page. Same underlying
// loader as the commercial view (redaction by role in getDailyLogs),
// but the page surfaces the residential-specific fields —
// heroTitle, summary, mood, teamNote — in a feed-style layout.
//
// The progress strip at the top of the journal uses the project's
// timeline dates to compute a rough "X% through the build" indicator.
// This is a time-based approximation, not a real milestone-weighted
// progress metric — flagged as tech debt, good enough for portfolio.

export type ResidentialJournalPageView = {
  project: {
    id: string;
    name: string;
    timezone: string;
    currentPhase: string;
    phaseLabel: string;
    pctComplete: number;
    targetMoveInLabel: string | null;
  };
  today: string;
  entries: DailyLogListRow[];
};

const PHASE_LABELS: Record<string, string> = {
  preconstruction: "Preconstruction",
  phase_1: "Foundation & framing",
  phase_2: "Rough-in",
  phase_3: "Interior finishes",
  closeout: "Final walk-through",
};

export type GetResidentialJournalPageViewInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getResidentialJournalPageView(
  input: GetResidentialJournalPageViewInput,
): Promise<ResidentialJournalPageView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "residential_client") {
    throw new AuthorizationError(
      "Only residential clients can view the journal",
      "forbidden",
    );
  }

  const [projectRow] = await db
    .select({
      id: projects.id,
      name: projects.name,
      timezone: projects.timezone,
      currentPhase: projects.currentPhase,
      startDate: projects.startDate,
      targetCompletionDate: projects.targetCompletionDate,
    })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!projectRow) {
    throw new AuthorizationError("Project not found", "not_found");
  }

  const today = todayInProjectTimezone(projectRow.timezone);

  // Time-based progress — clamp 0-100. If we don't have both dates, just
  // fall back to a phase-based estimate.
  const pctComplete = computePctComplete(
    projectRow.startDate,
    projectRow.targetCompletionDate,
    projectRow.currentPhase,
  );

  // Pull the last ~60 days of submitted logs to give the journal a
  // reasonable feed even on quieter projects.
  const fromIso = addDays(today, -60);
  const monthLogs = await getDailyLogs({
    session: input.session,
    projectId: input.projectId,
    from: fromIso,
    to: today,
  });
  const submitted = monthLogs
    .filter((l) => l.status === "submitted")
    .sort((a, b) => (a.logDate < b.logDate ? 1 : -1));

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      timezone: projectRow.timezone,
      currentPhase: projectRow.currentPhase,
      phaseLabel:
        PHASE_LABELS[projectRow.currentPhase] ?? projectRow.currentPhase,
      pctComplete,
      targetMoveInLabel: projectRow.targetCompletionDate
        ? projectRow.targetCompletionDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null,
    },
    today,
    entries: submitted,
  };
}

function computePctComplete(
  start: Date | null,
  end: Date | null,
  phase: string,
): number {
  if (start && end) {
    const total = end.getTime() - start.getTime();
    if (total > 0) {
      const elapsed = Date.now() - start.getTime();
      const pct = Math.round((elapsed / total) * 100);
      return Math.max(0, Math.min(100, pct));
    }
  }
  // Phase-based fallback.
  switch (phase) {
    case "preconstruction":
      return 5;
    case "phase_1":
      return 25;
    case "phase_2":
      return 50;
    case "phase_3":
      return 75;
    case "closeout":
      return 95;
    default:
      return 0;
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
