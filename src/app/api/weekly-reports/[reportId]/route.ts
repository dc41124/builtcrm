import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { weeklyReports } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/weekly-reports/[reportId]
//   { summaryText?: string }
//
// Updates the editable narrative on a weekly report and transitions
// status from auto_draft → editing on first edit. The "sent" status
// can only be reached via the dedicated /send route (Commit 6); this
// route never touches `sent_at` / `sent_by_user_id`.

const BodySchema = z.object({
  summaryText: z.string().max(20_000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [existing] = await db
      .select({
        id: weeklyReports.id,
        projectId: weeklyReports.projectId,
        status: weeklyReports.status,
        summaryText: weeklyReports.summaryText,
      })
      .from(weeklyReports)
      .where(eq(weeklyReports.id, reportId))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      existing.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit weekly reports",
        "forbidden",
      );
    }

    if (existing.status === "sent" || existing.status === "archived") {
      return NextResponse.json(
        { error: "report_locked", message: `Report is ${existing.status}` },
        { status: 409 },
      );
    }

    const previousState = { summaryText: existing.summaryText };
    const nextState = {
      summaryText:
        parsed.data.summaryText === undefined
          ? existing.summaryText
          : parsed.data.summaryText,
    };

    await db.transaction(async (tx) => {
      await tx
        .update(weeklyReports)
        .set({
          summaryText: nextState.summaryText,
          status: existing.status === "auto_draft" ? "editing" : existing.status,
        })
        .where(
          and(
            eq(weeklyReports.id, reportId),
            eq(weeklyReports.projectId, existing.projectId),
          ),
        );

      await writeAuditEvent(
        ctx,
        {
          action: "weekly_report.summary_edited",
          resourceType: "weekly_report",
          resourceId: reportId,
          details: { previousState, nextState },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}
