import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dailyLogCrewEntries } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/daily-log-crew-entries/[id]/ack
//
// Subcontractor acknowledges a GC reconciliation of their crew entry.
// Stamps subAckedReconciliationAt — which, together with reconciledAt,
// is how the loader decides whether the sub portal shows a "Review
// required" banner on the row.
//
// Authorization: only the sub who owns the entry (by org match) can ack.
// A contractor acking on behalf of the sub doesn't make sense —
// reconciliation is literally "GC says X, sub confirms" — so we block it.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const [entry] = await db
      .select({
        id: dailyLogCrewEntries.id,
        projectId: dailyLogCrewEntries.projectId,
        orgId: dailyLogCrewEntries.orgId,
        reconciledAt: dailyLogCrewEntries.reconciledAt,
        subAckedReconciliationAt: dailyLogCrewEntries.subAckedReconciliationAt,
      })
      .from(dailyLogCrewEntries)
      .where(eq(dailyLogCrewEntries.id, id))
      .limit(1);
    if (!entry) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!entry.reconciledAt) {
      return NextResponse.json(
        {
          error: "nothing_to_ack",
          message: "This entry has no pending reconciliation.",
        },
        { status: 409 },
      );
    }

    const ctx = await getEffectiveContext(
      session,
      entry.projectId,
    );
    if (ctx.role !== "subcontractor_user") {
      throw new AuthorizationError(
        "Only the subcontractor can acknowledge reconciliation",
        "forbidden",
      );
    }
    if (entry.orgId !== ctx.organization.id) {
      throw new AuthorizationError(
        "This entry is not for your organization",
        "forbidden",
      );
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(dailyLogCrewEntries)
        .set({ subAckedReconciliationAt: now })
        .where(eq(dailyLogCrewEntries.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "crew_reconciliation_acked",
          resourceType: "daily_log_crew_entry",
          resourceId: id,
          details: {
            nextState: {
              subAckedReconciliationAt: now.toISOString(),
            },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ id, ackedAt: now.toISOString() });
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
