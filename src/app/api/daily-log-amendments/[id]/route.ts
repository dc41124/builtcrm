import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { dailyLogAmendments, dailyLogs } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/daily-log-amendments/[id]
//
// Review an amendment request. On approve: merge `changedFields.<k>.after`
// values into the parent daily_logs row in the same transaction, set
// appliedAt. The `before` values stay in changed_fields as the audit
// record — do not copy them back anywhere, the row IS the audit log.
//
// Only contractors can review. A sub/client that slips past the UI gets
// a 403.

const BodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(2000).optional().nullable(),
});

// The set of columns an amendment is allowed to mutate. Mirrors the
// AMENDABLE_FIELDS enum on the request side so a malformed
// changed_fields JSON can't rewrite id/projectId/etc.
const APPLY_ALLOWED = new Set([
  "weatherConditions",
  "weatherHighC",
  "weatherLowC",
  "weatherPrecipPct",
  "weatherWindKmh",
  "notes",
  "clientSummary",
  "clientHighlights",
  "milestone",
  "milestoneType",
  "residentialHeroTitle",
  "residentialSummary",
  "residentialMood",
  "residentialTeamNote",
]);

// Maps camelCase patch keys onto drizzle column keys (identical here, but
// the mapping is explicit so rename refactors don't silently break this).
const COLUMN_BY_FIELD: Record<string, keyof typeof dailyLogs.$inferInsert> = {
  weatherConditions: "weatherConditions",
  weatherHighC: "weatherHighC",
  weatherLowC: "weatherLowC",
  weatherPrecipPct: "weatherPrecipPct",
  weatherWindKmh: "weatherWindKmh",
  notes: "notes",
  clientSummary: "clientSummary",
  clientHighlights: "clientHighlights",
  milestone: "milestone",
  milestoneType: "milestoneType",
  residentialHeroTitle: "residentialHeroTitle",
  residentialSummary: "residentialSummary",
  residentialMood: "residentialMood",
  residentialTeamNote: "residentialTeamNote",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: amendmentId } = await params;
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
    const [amendment] = await db
      .select({
        id: dailyLogAmendments.id,
        dailyLogId: dailyLogAmendments.dailyLogId,
        status: dailyLogAmendments.status,
        changedFields: dailyLogAmendments.changedFields,
      })
      .from(dailyLogAmendments)
      .where(eq(dailyLogAmendments.id, amendmentId))
      .limit(1);
    if (!amendment) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (amendment.status !== "pending") {
      return NextResponse.json(
        {
          error: "already_reviewed",
          message: `Amendment already ${amendment.status}.`,
        },
        { status: 409 },
      );
    }

    const [logHead] = await dbAdmin
      .select({ id: dailyLogs.id, projectId: dailyLogs.projectId })
      .from(dailyLogs)
      .where(eq(dailyLogs.id, amendment.dailyLogId))
      .limit(1);
    if (!logHead) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      logHead.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can review amendments",
        "forbidden",
      );
    }

    const now = new Date();

    const result = await withTenant(ctx.organization.id, async (tx) => {
      if (input.status === "approved") {
        // Merge `changedFields.<k>.after` into the parent log. Skip any
        // key not in APPLY_ALLOWED defensively, even though the request
        // path validates the same set.
        const patch: Partial<typeof dailyLogs.$inferInsert> = {};
        const cf = (amendment.changedFields ?? {}) as Record<
          string,
          { before: unknown; after: unknown }
        >;
        for (const [field, diff] of Object.entries(cf)) {
          if (!APPLY_ALLOWED.has(field)) continue;
          const column = COLUMN_BY_FIELD[field];
          if (!column) continue;
          (patch as Record<string, unknown>)[column] = diff.after;
        }
        if (Object.keys(patch).length > 0) {
          await tx
            .update(dailyLogs)
            .set(patch)
            .where(eq(dailyLogs.id, amendment.dailyLogId));
        }
      }

      const [row] = await tx
        .update(dailyLogAmendments)
        .set({
          status: input.status,
          reviewedByUserId: ctx.user.id,
          reviewedAt: now,
          reviewNote: input.reviewNote ?? null,
          appliedAt: input.status === "approved" ? now : null,
        })
        .where(eq(dailyLogAmendments.id, amendmentId))
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action:
            input.status === "approved"
              ? "amendment_approved"
              : "amendment_rejected",
          resourceType: "daily_log",
          resourceId: amendment.dailyLogId,
          details: {
            metadata: {
              amendmentId,
              reviewNote: input.reviewNote ?? null,
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
      appliedAt: result.appliedAt?.toISOString() ?? null,
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
