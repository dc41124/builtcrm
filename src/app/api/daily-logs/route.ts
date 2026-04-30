import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import {
  dailyLogCrewEntries,
  dailyLogDelays,
  dailyLogIssues,
  dailyLogs,
  projects,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { computeEditWindowClosesAt } from "@/lib/daily-logs/config";
import { isIsoDate } from "@/lib/daily-logs/date-utils";
import { emitNotifications } from "@/lib/notifications/emit";
import { WEATHER_CONDITIONS } from "@/lib/weather/types";

// POST /api/daily-logs
//
// Create a daily log for a project + date. One log per (project, date) —
// the unique index on daily_logs.(project_id, log_date) will reject
// duplicates; the UI should call GET on the existing log and open it
// for editing instead. We return a 409 with the existing log's id so
// the client can redirect.
//
// Authorization: contractor only. Subs submit their own crew entries
// via POST /api/daily-log-crew-entries; clients never author logs.
//
// Atomicity: the insert + orphan crew-entry auto-attach + audit +
// activity + (optional delays/issues inserts) run in one transaction.

const DelayInput = z.object({
  delayType: z.enum([
    "weather",
    "material",
    "inspection",
    "subcontractor_no_show",
    "coordination",
    "other",
  ]),
  description: z.string().min(1).max(2000),
  hoursLost: z.number().nonnegative(),
  impactedActivity: z.string().max(500).optional().nullable(),
});

const IssueInput = z.object({
  issueType: z.enum([
    "safety_near_miss",
    "safety_incident",
    "coordination",
    "quality",
    "other",
  ]),
  description: z.string().min(1).max(2000),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  logDate: z.string().refine(isIsoDate, "logDate must be YYYY-MM-DD"),
  intent: z.enum(["draft", "submit"]).default("draft"),
  weather: z
    .object({
      conditions: z.enum(WEATHER_CONDITIONS as unknown as [string, ...string[]]),
      highC: z.number().int().min(-60).max(60).nullable().optional(),
      lowC: z.number().int().min(-60).max(60).nullable().optional(),
      precipPct: z.number().int().min(0).max(100).nullable().optional(),
      windKmh: z.number().int().min(0).max(300).nullable().optional(),
      source: z.enum(["manual", "api"]).default("manual"),
      capturedAt: z.string().datetime().nullable().optional(),
    })
    .optional(),
  notes: z.string().max(10000).optional().nullable(),
  clientSummary: z.string().max(4000).optional().nullable(),
  clientHighlights: z.array(z.string().min(1).max(240)).max(8).optional().nullable(),
  milestone: z.string().max(240).optional().nullable(),
  milestoneType: z.enum(["ok", "warn", "info"]).optional().nullable(),
  residentialHeroTitle: z.string().max(240).optional().nullable(),
  residentialSummary: z.string().max(4000).optional().nullable(),
  residentialMood: z.enum(["great", "good", "slow"]).optional().nullable(),
  residentialTeamNote: z.string().max(2000).optional().nullable(),
  delays: z.array(DelayInput).max(20).default([]),
  issues: z.array(IssueInput).max(20).default([]),

  // Step 51 — offline outbox idempotency. Client mints a UUID before any
  // network attempt and includes it on every retry. Two semantics:
  //  (a) post-success-network-died retry: server already has the row, returns 200 with that row.
  //  (b) genuine duplicate (project+date collision): server returns 409 as before.
  // Optional for backwards compat — direct online submits don't need it.
  clientUuid: z.string().uuid().optional().nullable(),

  // Step 51 — hybrid clock authority for offline submits. If the client was
  // offline and queued the submit at clientSubmittedAt, the server uses it
  // when it's within 48h of drain (server time); otherwise falls back to
  // server-receipt time. Optional, ignored when intent !== "submit".
  clientSubmittedAt: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const ctx = await getEffectiveContext(
      session,
      input.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can author daily logs",
        "forbidden",
      );
    }

    // Step 51 idempotency: if the client included a clientUuid we've seen
    // before, treat as a successful retry of the original write. This is
    // distinct from the (project, date) 409 path below — that's a genuine
    // collision between two distinct payloads (e.g. two devices same date).
    if (input.clientUuid) {
      const [prior] = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({ id: dailyLogs.id })
          .from(dailyLogs)
          .where(eq(dailyLogs.clientUuid, input.clientUuid!))
          .limit(1),
      );
      if (prior) {
        return NextResponse.json(
          { id: prior.id, idempotent: true },
          { status: 200 },
        );
      }
    }

    // Reject duplicates explicitly so the UI gets a 409 (not a 500) and
    // can redirect to the existing log for editing.
    const [existing] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select({ id: dailyLogs.id })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.projectId, input.projectId),
            eq(dailyLogs.logDate, input.logDate),
          ),
        )
        .limit(1),
    );
    if (existing) {
      return NextResponse.json(
        {
          error: "log_exists",
          message: "A log already exists for this date. Open it to edit.",
          existingLogId: existing.id,
        },
        { status: 409 },
      );
    }

    const now = new Date();

    // Hybrid clock per Step-51 Decision 3: trust the client's offline
    // submittedAt only when it's within 48h of server-receipt; otherwise
    // fall back to now. Caps clock-skew abuse without penalising the legit
    // overnight-no-signal field user.
    const HYBRID_WINDOW_MS = 48 * 60 * 60 * 1000;
    const clientSubmittedAt = input.clientSubmittedAt
      ? new Date(input.clientSubmittedAt)
      : null;
    const honourClientClock =
      clientSubmittedAt &&
      clientSubmittedAt.getTime() <= now.getTime() &&
      now.getTime() - clientSubmittedAt.getTime() <= HYBRID_WINDOW_MS;
    const submittedAt =
      input.intent === "submit"
        ? honourClientClock
          ? clientSubmittedAt
          : now
        : null;
    const editWindowClosesAt = submittedAt
      ? computeEditWindowClosesAt(submittedAt)
      : null;

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .insert(dailyLogs)
        .values({
          projectId: input.projectId,
          logDate: input.logDate,
          status: input.intent === "submit" ? "submitted" : "draft",
          reportedByUserId: ctx.user.id,
          submittedAt,
          editWindowClosesAt,
          weatherConditions: input.weather?.conditions as never,
          weatherHighC: input.weather?.highC ?? null,
          weatherLowC: input.weather?.lowC ?? null,
          weatherPrecipPct: input.weather?.precipPct ?? null,
          weatherWindKmh: input.weather?.windKmh ?? null,
          weatherSource: input.weather?.source ?? "manual",
          weatherCapturedAt: input.weather?.capturedAt
            ? new Date(input.weather.capturedAt)
            : null,
          notes: input.notes ?? null,
          clientSummary: input.clientSummary ?? null,
          clientHighlights: input.clientHighlights ?? null,
          milestone: input.milestone ?? null,
          milestoneType: input.milestoneType ?? null,
          residentialHeroTitle: input.residentialHeroTitle ?? null,
          residentialSummary: input.residentialSummary ?? null,
          residentialMood: input.residentialMood ?? null,
          residentialTeamNote: input.residentialTeamNote ?? null,
          residentialTeamNoteByUserId: input.residentialTeamNote
            ? ctx.user.id
            : null,
          clientUuid: input.clientUuid ?? null,
        })
        .returning();

      // Auto-attach orphan crew entries: any sub that submitted their
      // crew for this (project, date) BEFORE the GC created the log
      // now gets linked. Same transaction so the ids stay consistent.
      await tx
        .update(dailyLogCrewEntries)
        .set({ dailyLogId: row.id })
        .where(
          and(
            eq(dailyLogCrewEntries.projectId, input.projectId),
            eq(dailyLogCrewEntries.logDate, input.logDate),
            isNull(dailyLogCrewEntries.dailyLogId),
          ),
        );

      if (input.delays.length > 0) {
        await tx.insert(dailyLogDelays).values(
          input.delays.map((d) => ({
            dailyLogId: row.id,
            delayType: d.delayType,
            description: d.description,
            hoursLost: d.hoursLost.toString(),
            impactedActivity: d.impactedActivity ?? null,
          })),
        );
      }

      if (input.issues.length > 0) {
        await tx.insert(dailyLogIssues).values(
          input.issues.map((i) => ({
            dailyLogId: row.id,
            issueType: i.issueType,
            description: i.description,
          })),
        );
      }

      await writeAuditEvent(
        ctx,
        {
          action: input.intent === "submit" ? "submitted" : "created",
          resourceType: "daily_log",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.status,
              logDate: row.logDate,
              delayCount: input.delays.length,
              issueCount: input.issues.length,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary:
            input.intent === "submit"
              ? `Daily log submitted for ${row.logDate}`
              : `Daily log drafted for ${row.logDate}`,
          body: input.clientSummary ?? input.notes ?? null,
          relatedObjectType: "daily_log",
          relatedObjectId: row.id,
          visibilityScope:
            input.intent === "submit" && input.clientSummary
              ? "client_visible"
              : "internal_only",
        },
        tx,
      );

      return row;
    });

    // Notifications fire only on actual submission, not drafts.
    if (result.status === "submitted") {
      const [projectRow] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      const vars = {
        projectName: projectRow?.name ?? ctx.project.name,
        logDate: result.logDate,
        actorName: ctx.user.displayName ?? ctx.user.email,
      };
      const emitBase = {
        actorUserId: ctx.user.id,
        projectId: input.projectId,
        relatedObjectType: "daily_log",
        relatedObjectId: result.id,
        vars,
      };
      await emitNotifications({ ...emitBase, eventId: "daily_log_posted" });
    }

    return NextResponse.json({
      id: result.id,
      status: result.status,
      logDate: result.logDate,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
