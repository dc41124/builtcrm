import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { dailyLogAmendments, dailyLogs } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/daily-logs/[id]/amend
//
// Request an amendment for a daily log that's past its 24-hour edit
// window. Stores a change record with { [field]: { before, after } }
// shape in `changed_fields`. Does NOT mutate the parent daily_logs row
// until the amendment is reviewed and approved (see the review endpoint
// below).
//
// Authorization: contractor only. Amendments are tracked at the log
// level — crew-entry reconciliations are a different workflow (see
// /api/daily-log-crew-entries/[id]/reconcile).

const AMENDABLE_FIELDS = [
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
] as const;

type AmendableField = (typeof AMENDABLE_FIELDS)[number];

const ChangedFieldsSchema = z
  .record(
    z.enum(AMENDABLE_FIELDS as unknown as [AmendableField, ...AmendableField[]]),
    z.object({ before: z.unknown(), after: z.unknown() }),
  )
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field change is required",
  });

const BodySchema = z.object({
  changeSummary: z.string().min(1).max(2000),
  changedFields: ChangedFieldsSchema,
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    const [logHead] = await dbAdmin
      .select({ id: dailyLogs.id, projectId: dailyLogs.projectId })
      .from(dailyLogs)
      .where(eq(dailyLogs.id, id))
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
        "Only contractors can request amendments",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .insert(dailyLogAmendments)
        .values({
          dailyLogId: id,
          changeSummary: input.changeSummary,
          // Zod's z.unknown() widens to `unknown | undefined` which doesn't
          // satisfy the jsonb column's `{ before: unknown; after: unknown }`
          // shape. Validated at the schema boundary — cast here.
          changedFields: input.changedFields as Record<
            string,
            { before: unknown; after: unknown }
          >,
          status: "pending",
          requestedByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "amendment_requested",
          resourceType: "daily_log",
          resourceId: id,
          details: {
            metadata: {
              amendmentId: row.id,
              fields: Object.keys(input.changedFields),
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({ id: result.id, status: result.status });
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
