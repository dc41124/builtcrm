import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { dailyLogs } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { getDailyLog } from "@/domain/loaders/daily-logs";
import { AuthorizationError } from "@/domain/permissions";
import {
  computeEditWindowClosesAt,
  isWithinEditWindow,
} from "@/lib/daily-logs/config";
import { WEATHER_CONDITIONS } from "@/lib/weather/types";

// GET /api/daily-logs/[id]
//
// Fetch a single log's full detail. Role-aware via getDailyLog: clients
// get the redacted shape; contractors/subs get the full shape. Used by
// the contractor list page to populate the detail drawer client-side
// when a log row is clicked.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const log = await getDailyLog({
      session: session.session as unknown as { appUserId?: string | null },
      logId: id,
    });
    return NextResponse.json(log);
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

// PATCH /api/daily-logs/[id]
//
// In-place update of a daily log — allowed only within the 24-hour edit
// window after submittedAt (or freely while the log is still a draft).
// Past the window, clients must POST /api/daily-logs/[id]/amend instead.
//
// Only the original author or any contractor on the project can edit.
// This endpoint never edits crew entries, delays, issues, or photos —
// those have their own routes.

const BodySchema = z.object({
  intent: z.enum(["save_draft", "submit"]).optional(),
  weather: z
    .object({
      conditions: z
        .enum(WEATHER_CONDITIONS as unknown as [string, ...string[]])
        .optional(),
      highC: z.number().int().min(-60).max(60).nullable().optional(),
      lowC: z.number().int().min(-60).max(60).nullable().optional(),
      precipPct: z.number().int().min(0).max(100).nullable().optional(),
      windKmh: z.number().int().min(0).max(300).nullable().optional(),
      source: z.enum(["manual", "api"]).optional(),
      capturedAt: z.string().datetime().nullable().optional(),
    })
    .optional(),
  notes: z.string().max(10000).nullable().optional(),
  clientSummary: z.string().max(4000).nullable().optional(),
  clientHighlights: z.array(z.string().min(1).max(240)).max(8).nullable().optional(),
  milestone: z.string().max(240).nullable().optional(),
  milestoneType: z.enum(["ok", "warn", "info"]).nullable().optional(),
  residentialHeroTitle: z.string().max(240).nullable().optional(),
  residentialSummary: z.string().max(4000).nullable().optional(),
  residentialMood: z.enum(["great", "good", "slow"]).nullable().optional(),
  residentialTeamNote: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const [logHead] = await db
      .select({
        id: dailyLogs.id,
        projectId: dailyLogs.projectId,
        status: dailyLogs.status,
        submittedAt: dailyLogs.submittedAt,
        editWindowClosesAt: dailyLogs.editWindowClosesAt,
        reportedByUserId: dailyLogs.reportedByUserId,
      })
      .from(dailyLogs)
      .where(eq(dailyLogs.id, id))
      .limit(1);
    if (!logHead) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      logHead.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit daily logs",
        "forbidden",
      );
    }

    // Edit window check — draft logs edit freely; submitted logs edit
    // only within 24h of submission.
    if (
      logHead.status === "submitted" &&
      !isWithinEditWindow(logHead.editWindowClosesAt)
    ) {
      return NextResponse.json(
        {
          error: "edit_window_closed",
          message:
            "This log was submitted more than 24 hours ago. Request an amendment instead.",
          editWindowClosesAt: logHead.editWindowClosesAt,
        },
        { status: 409 },
      );
    }

    const willSubmit =
      input.intent === "submit" && logHead.status === "draft";
    const now = new Date();

    const previousState = {
      status: logHead.status,
      submittedAt: logHead.submittedAt?.toISOString() ?? null,
    };

    const result = await db.transaction(async (tx) => {
      const patch: Partial<typeof dailyLogs.$inferInsert> = {};
      if (input.weather) {
        if (input.weather.conditions !== undefined)
          patch.weatherConditions = input.weather.conditions as never;
        if (input.weather.highC !== undefined)
          patch.weatherHighC = input.weather.highC;
        if (input.weather.lowC !== undefined)
          patch.weatherLowC = input.weather.lowC;
        if (input.weather.precipPct !== undefined)
          patch.weatherPrecipPct = input.weather.precipPct;
        if (input.weather.windKmh !== undefined)
          patch.weatherWindKmh = input.weather.windKmh;
        if (input.weather.source !== undefined)
          patch.weatherSource = input.weather.source;
        if (input.weather.capturedAt !== undefined)
          patch.weatherCapturedAt = input.weather.capturedAt
            ? new Date(input.weather.capturedAt)
            : null;
      }
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.clientSummary !== undefined)
        patch.clientSummary = input.clientSummary;
      if (input.clientHighlights !== undefined)
        patch.clientHighlights = input.clientHighlights;
      if (input.milestone !== undefined) patch.milestone = input.milestone;
      if (input.milestoneType !== undefined)
        patch.milestoneType = input.milestoneType;
      if (input.residentialHeroTitle !== undefined)
        patch.residentialHeroTitle = input.residentialHeroTitle;
      if (input.residentialSummary !== undefined)
        patch.residentialSummary = input.residentialSummary;
      if (input.residentialMood !== undefined)
        patch.residentialMood = input.residentialMood;
      if (input.residentialTeamNote !== undefined) {
        patch.residentialTeamNote = input.residentialTeamNote;
        patch.residentialTeamNoteByUserId = input.residentialTeamNote
          ? ctx.user.id
          : null;
      }

      if (willSubmit) {
        patch.status = "submitted";
        patch.submittedAt = now;
        patch.editWindowClosesAt = computeEditWindowClosesAt(now);
      }

      const [row] = await tx
        .update(dailyLogs)
        .set(patch)
        .where(eq(dailyLogs.id, id))
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: willSubmit ? "submitted" : "updated",
          resourceType: "daily_log",
          resourceId: row.id,
          details: {
            previousState,
            nextState: {
              status: row.status,
              submittedAt: row.submittedAt?.toISOString() ?? null,
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      status: result.status,
      submittedAt: result.submittedAt?.toISOString() ?? null,
      editWindowClosesAt: result.editWindowClosesAt?.toISOString() ?? null,
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
