import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { weeklyReports } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { loadWeeklyReportRecipients } from "@/domain/loaders/weekly-reports";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

// POST /api/weekly-reports/[reportId]/send
//
// Flips status to 'sent', captures sentAt + sentByUserId, writes the
// audit event, and fires a `weekly_update` notification to every
// active client member on the project.
//
// Refuses to send if there are zero client recipients on the project —
// the contractor editor disables the button in that case, but a hand-
// crafted POST shouldn't silently no-op either.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const { session } = await requireServerSession();
  try {
    const [existing] = await dbAdmin
      .select({
        id: weeklyReports.id,
        projectId: weeklyReports.projectId,
        status: weeklyReports.status,
        weekStart: weeklyReports.weekStart,
        weekEnd: weeklyReports.weekEnd,
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
        "Only contractors can send weekly reports",
        "forbidden",
      );
    }

    if (existing.status === "sent") {
      return NextResponse.json(
        { error: "already_sent", message: "Report has already been sent" },
        { status: 409 },
      );
    }
    if (existing.status === "archived") {
      return NextResponse.json(
        { error: "report_archived", message: "Report is archived" },
        { status: 409 },
      );
    }

    const recipients = await loadWeeklyReportRecipients(
      existing.projectId,
      ctx.organization.id,
    );
    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error: "no_recipients",
          message:
            "No client members on this project. Add one in Team before sending.",
        },
        { status: 422 },
      );
    }

    const sentAt = new Date();
    const weekRange = formatWeekRange(existing.weekStart, existing.weekEnd);

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(weeklyReports)
        .set({
          status: "sent",
          sentAt,
          sentByUserId: ctx.user.id,
        })
        .where(eq(weeklyReports.id, reportId));

      await writeAuditEvent(
        ctx,
        {
          action: "weekly_report.sent",
          resourceType: "weekly_report",
          resourceId: reportId,
          details: {
            metadata: {
              recipientCount: recipients.length,
              weekStart: existing.weekStart,
              weekEnd: existing.weekEnd,
            },
          },
        },
        tx,
      );

      // Fire one notification row per eligible client recipient. Errors
      // here are swallowed by emitNotifications — the send transition
      // remains durable even if an inbox row fails to write.
      await emitNotifications(
        {
          eventId: "weekly_update",
          actorUserId: ctx.user.id,
          projectId: existing.projectId,
          relatedObjectType: "weekly_report",
          relatedObjectId: reportId,
          vars: {
            weekStart: existing.weekStart,
            weekRange,
            actorName: ctx.user.displayName ?? "Your contractor",
          },
        },
        tx,
      );
    });

    return NextResponse.json({
      ok: true,
      sentAt: sentAt.toISOString(),
      recipientCount: recipients.length,
    });
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

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const a = parseLocalDate(weekStart);
  const b = parseLocalDate(weekEnd);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(a)}–${fmt(b)}`;
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
