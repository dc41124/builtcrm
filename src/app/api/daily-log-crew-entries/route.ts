import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { dailyLogCrewEntries, dailyLogs } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { isIsoDate } from "@/lib/daily-logs/date-utils";

// POST /api/daily-log-crew-entries
//
// Subcontractor submits their crew entry for a (project, date). Can
// be called BEFORE the GC has created a daily_log for that date —
// dailyLogId is nullable and auto-attaches when the GC creates the
// log (see POST /api/daily-logs).
//
// Also callable by a contractor (submittedByRole = 'contractor') as
// an "I'll fill this in on behalf of the sub" path if the sub didn't
// get to it. The only difference is submittedByRole for audit.
//
// Upsert semantics: if an entry already exists for (project, date,
// org), we UPDATE it in place. The unique index on
// (project_id, log_date, org_id) guarantees one row per trio.

const BodySchema = z.object({
  projectId: z.string().uuid(),
  logDate: z.string().refine(isIsoDate, "logDate must be YYYY-MM-DD"),
  orgId: z.string().uuid(),
  trade: z.string().max(120).optional().nullable(),
  headcount: z.number().int().min(0).max(500),
  hours: z.number().min(0).max(9999),
  submittedNote: z.string().max(2000).optional().nullable(),
  submittedIssues: z.string().max(2000).optional().nullable(),
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

    // Subs can only submit for their own org. Contractors can submit
    // for any sub on the project (sometimes they fill in a crew's
    // numbers when the sub didn't log in time).
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isSub = ctx.role === "subcontractor_user";
    if (!isContractor && !isSub) {
      throw new AuthorizationError(
        "Only contractors and subcontractors submit crew entries",
        "forbidden",
      );
    }
    if (isSub && input.orgId !== ctx.organization.id) {
      throw new AuthorizationError(
        "Subcontractors can only submit entries for their own org",
        "forbidden",
      );
    }

    const submittedByRole = isContractor ? "contractor" : "sub";

    // Look up a matching log (if one exists) so we can auto-attach.
    // Otherwise dailyLogId stays null until the GC creates the log.
    const [matchingLog] = await db
      .select({ id: dailyLogs.id })
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.projectId, input.projectId),
          eq(dailyLogs.logDate, input.logDate),
        ),
      )
      .limit(1);

    const result = await db.transaction(async (tx) => {
      // Upsert by (projectId, logDate, orgId). Postgres ON CONFLICT
      // lets us collapse the "submit or update my entry" call into
      // one round-trip.
      const [row] = await tx
        .insert(dailyLogCrewEntries)
        .values({
          dailyLogId: matchingLog?.id ?? null,
          projectId: input.projectId,
          logDate: input.logDate,
          orgId: input.orgId,
          trade: input.trade ?? null,
          headcount: input.headcount,
          hours: input.hours.toString(),
          submittedNote: input.submittedNote ?? null,
          submittedIssues: input.submittedIssues ?? null,
          submittedByUserId: ctx.user.id,
          submittedByRole,
        })
        .onConflictDoUpdate({
          target: [
            dailyLogCrewEntries.projectId,
            dailyLogCrewEntries.logDate,
            dailyLogCrewEntries.orgId,
          ],
          set: {
            trade: input.trade ?? null,
            headcount: input.headcount,
            hours: input.hours.toString(),
            submittedNote: input.submittedNote ?? null,
            submittedIssues: input.submittedIssues ?? null,
            submittedByUserId: ctx.user.id,
            submittedByRole,
            submittedAt: new Date(),
            // If the sub re-submits after a reconciliation, the
            // reconciled overrides stay — GC has to re-reconcile
            // explicitly. Don't clear them here.
          },
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "crew_entry_submitted",
          resourceType: "daily_log_crew_entry",
          resourceId: row.id,
          details: {
            nextState: {
              projectId: row.projectId,
              logDate: row.logDate,
              orgId: row.orgId,
              headcount: row.headcount,
              hours: row.hours,
              submittedByRole: row.submittedByRole,
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      dailyLogId: result.dailyLogId,
      projectId: result.projectId,
      logDate: result.logDate,
      orgId: result.orgId,
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
