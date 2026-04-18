import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { dailyLogCrewEntries } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

// PATCH /api/daily-log-crew-entries/[id]/reconcile
//
// Contractor adjusts a sub's submitted headcount/hours (e.g. after
// timesheet review). Writes to reconciledHeadcount / reconciledHours.
// The original submitted values stay intact — the "before/after" is
// reconstructable from submittedHeadcount+submittedHours vs the
// reconciled fields.
//
// Critical rule: every reconciliation clears subAckedReconciliationAt
// to null in the same transaction, so the sub's "Review required"
// badge re-fires even if they'd previously acked an earlier change.

const BodySchema = z
  .object({
    reconciledHeadcount: z.number().int().min(0).max(500).nullable().optional(),
    reconciledHours: z.number().min(0).max(9999).nullable().optional(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine(
    (v) =>
      v.reconciledHeadcount !== undefined || v.reconciledHours !== undefined,
    { message: "At least one field (headcount or hours) must be provided" },
  );

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
    const [entry] = await db
      .select({
        id: dailyLogCrewEntries.id,
        projectId: dailyLogCrewEntries.projectId,
        orgId: dailyLogCrewEntries.orgId,
        logDate: dailyLogCrewEntries.logDate,
        headcount: dailyLogCrewEntries.headcount,
        hours: dailyLogCrewEntries.hours,
        reconciledHeadcount: dailyLogCrewEntries.reconciledHeadcount,
        reconciledHours: dailyLogCrewEntries.reconciledHours,
        submittedByUserId: dailyLogCrewEntries.submittedByUserId,
      })
      .from(dailyLogCrewEntries)
      .where(eq(dailyLogCrewEntries.id, id))
      .limit(1);
    if (!entry) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      entry.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can reconcile crew entries",
        "forbidden",
      );
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const patch: Partial<typeof dailyLogCrewEntries.$inferInsert> = {
        reconciledByUserId: ctx.user.id,
        reconciledAt: now,
        // Re-fire rule: ANY reconcile clears the ack so the sub's
        // "Review required" badge returns. Critical for multi-step
        // reconciliation flows (e.g. contractor adjusts twice).
        subAckedReconciliationAt: null,
      };
      if (input.reconciledHeadcount !== undefined) {
        patch.reconciledHeadcount = input.reconciledHeadcount;
      }
      if (input.reconciledHours !== undefined) {
        patch.reconciledHours =
          input.reconciledHours == null ? null : input.reconciledHours.toString();
      }

      const [row] = await tx
        .update(dailyLogCrewEntries)
        .set(patch)
        .where(eq(dailyLogCrewEntries.id, id))
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "crew_entry_reconciled",
          resourceType: "daily_log_crew_entry",
          resourceId: id,
          details: {
            previousState: {
              reconciledHeadcount: entry.reconciledHeadcount,
              reconciledHours: entry.reconciledHours,
            },
            nextState: {
              reconciledHeadcount: row.reconciledHeadcount,
              reconciledHours: row.reconciledHours,
            },
            metadata: { reason: input.reason ?? null },
          },
        },
        tx,
      );

      return row;
    });

    // Notify the sub that submitted the original entry. We route the
    // notification at the project level rather than direct-to-user so
    // recipient resolution stays centralized in recipients.ts.
    await emitNotifications({
      eventId: "daily_log_crew_reconciled",
      actorUserId: ctx.user.id,
      projectId: entry.projectId,
      targetOrganizationId: entry.orgId,
      relatedObjectType: "daily_log_crew_entry",
      relatedObjectId: id,
      vars: {
        projectName: ctx.project.name,
        logDate: entry.logDate,
        actorName: ctx.user.displayName ?? ctx.user.email,
      },
    });

    return NextResponse.json({
      id: result.id,
      reconciledHeadcount: result.reconciledHeadcount,
      reconciledHours: result.reconciledHours,
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
