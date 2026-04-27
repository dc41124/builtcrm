import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { weeklyReportSections, weeklyReports } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/weekly-reports/[reportId]/sections/[sectionId]
//   { content: { ...arbitrary jsonb }, narrativeOverlay?: string }
//
// Replaces the section's content jsonb in place. Most callers will
// only edit `narrativeOverlay` (the contractor's prose layered on
// top of the auto-pulled snapshot); the full content is accepted for
// future custom editors per section type.
//
// Same auto_draft → editing transition as the summary edit.

const BodySchema = z.object({
  content: z.record(z.unknown()).optional(),
  narrativeOverlay: z.string().max(20_000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ reportId: string; sectionId: string }>;
  },
) {
  const { reportId, sectionId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (
    parsed.data.content === undefined &&
    parsed.data.narrativeOverlay === undefined
  ) {
    return NextResponse.json(
      { error: "no_changes", message: "Provide content or narrativeOverlay" },
      { status: 400 },
    );
  }

  try {
    // Pre-tenant head lookup: caller passed only the section id, so we
    // read via the admin pool. The follow-up read of weeklyReports below
    // also routes through dbAdmin to derive projectId for getEffectiveContext.
    const [section] = await dbAdmin
      .select({
        id: weeklyReportSections.id,
        reportId: weeklyReportSections.reportId,
        sectionType: weeklyReportSections.sectionType,
        content: weeklyReportSections.content,
      })
      .from(weeklyReportSections)
      .where(
        and(
          eq(weeklyReportSections.id, sectionId),
          eq(weeklyReportSections.reportId, reportId),
        ),
      )
      .limit(1);
    if (!section) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const [report] = await dbAdmin
      .select({
        id: weeklyReports.id,
        projectId: weeklyReports.projectId,
        status: weeklyReports.status,
      })
      .from(weeklyReports)
      .where(eq(weeklyReports.id, reportId))
      .limit(1);
    if (!report) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      report.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit weekly reports",
        "forbidden",
      );
    }

    if (report.status === "sent" || report.status === "archived") {
      return NextResponse.json(
        { error: "report_locked", message: `Report is ${report.status}` },
        { status: 409 },
      );
    }

    // Compose new content: full replacement when `content` is provided,
    // otherwise merge `narrativeOverlay` into existing.
    const nextContent: Record<string, unknown> =
      parsed.data.content !== undefined
        ? parsed.data.content
        : {
            ...section.content,
            narrativeOverlay: parsed.data.narrativeOverlay,
          };

    await withTenant(ctx.organization.id, async (tx) => {
      await tx
        .update(weeklyReportSections)
        .set({ content: nextContent })
        .where(eq(weeklyReportSections.id, sectionId));

      if (report.status === "auto_draft") {
        await tx
          .update(weeklyReports)
          .set({ status: "editing" })
          .where(eq(weeklyReports.id, reportId));
      }

      await writeAuditEvent(
        ctx,
        {
          action: "weekly_report.section_edited",
          resourceType: "weekly_report",
          resourceId: reportId,
          details: {
            metadata: {
              sectionId,
              sectionType: section.sectionType,
            },
          },
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
