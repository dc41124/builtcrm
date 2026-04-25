import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { generateWeeklyReport } from "@/lib/weekly-reports/generator";

// POST /api/weekly-reports/generate
//   { projectId }
//
// Manual "Generate off-cycle" trigger. Wraps the generator with auth +
// audit. Idempotent on (projectId, week start in project tz) — repeated
// clicks within the same week refresh source data into the existing
// auto_draft, or no-op if the row is already locked (editing/sent).

const BodySchema = z.object({
  projectId: z.string().uuid(),
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

  try {
    const ctx = await getEffectiveContext(
      session,
      parsed.data.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can generate weekly reports",
        "forbidden",
      );
    }

    const result = await generateWeeklyReport({
      projectId: parsed.data.projectId,
      generatedByUserId: ctx.user.id,
    });

    if (result.reportId) {
      await writeAuditEvent(ctx, {
        action: "weekly_report.generated_manual",
        resourceType: "weekly_report",
        resourceId: result.reportId,
        details: {
          metadata: {
            status: result.status,
            weekStart: result.window.weekStartLocalDate,
          },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      reportId: result.reportId,
      weekStart: result.window.weekStartLocalDate,
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
