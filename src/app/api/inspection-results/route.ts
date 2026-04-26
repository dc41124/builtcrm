import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  type InspectionLineItemDef,
  inspectionResults,
  inspections,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PUT /api/inspection-results — upsert a line-item outcome on an in-
// progress inspection. Flips the inspection to `in_progress` on first
// recorded result if it was `scheduled`.
//
// Keyed by (inspectionId, lineItemKey) — unique in the DB. Re-submitting
// the same key updates the existing row.

const BodySchema = z.object({
  inspectionId: z.string().uuid(),
  lineItemKey: z.string().min(1).max(80),
  outcome: z.enum(["pass", "fail", "conditional", "na"]),
  notes: z.string().max(4000).nullable().optional(),
});

export async function PUT(req: Request) {
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
    const [head] = await dbAdmin
      .select({
        id: inspections.id,
        projectId: inspections.projectId,
        status: inspections.status,
        assignedOrgId: inspections.assignedOrgId,
        templateSnapshotJson: inspections.templateSnapshotJson,
      })
      .from(inspections)
      .where(eq(inspections.id, input.inspectionId))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isAssignedSub =
      ctx.role === "subcontractor_user" &&
      head.assignedOrgId === ctx.organization.id;
    if (!isContractor && !isAssignedSub) {
      throw new AuthorizationError(
        "Only contractors or the assigned sub may record results",
        "forbidden",
      );
    }
    if (head.status === "completed" || head.status === "cancelled") {
      throw new AuthorizationError(
        "Inspection is not editable",
        "forbidden",
      );
    }

    // Validate the key exists in the snapshot.
    const snapshot =
      (head.templateSnapshotJson as InspectionLineItemDef[]) ?? [];
    if (!snapshot.some((li) => li.key === input.lineItemKey)) {
      return NextResponse.json(
        { error: "unknown_line_item" },
        { status: 400 },
      );
    }

    const row = await withTenant(ctx.organization.id, async (tx) => {
      const [existing] = await tx
        .select({ id: inspectionResults.id, outcome: inspectionResults.outcome })
        .from(inspectionResults)
        .where(
          and(
            eq(inspectionResults.inspectionId, input.inspectionId),
            eq(inspectionResults.lineItemKey, input.lineItemKey),
          ),
        )
        .limit(1);

      let saved;
      if (existing) {
        const [u] = await tx
          .update(inspectionResults)
          .set({
            outcome: input.outcome,
            notes: input.notes ?? null,
            recordedByUserId: ctx.user.id,
            recordedAt: new Date(),
          })
          .where(eq(inspectionResults.id, existing.id))
          .returning();
        saved = u;
      } else {
        const [ins] = await tx
          .insert(inspectionResults)
          .values({
            inspectionId: input.inspectionId,
            lineItemKey: input.lineItemKey,
            outcome: input.outcome,
            notes: input.notes ?? null,
            recordedByUserId: ctx.user.id,
          })
          .returning();
        saved = ins;
      }

      // Flip to in_progress on first result if still scheduled.
      if (head.status === "scheduled") {
        await tx
          .update(inspections)
          .set({ status: "in_progress" })
          .where(eq(inspections.id, input.inspectionId));
      }

      await writeAuditEvent(
        ctx,
        {
          action: existing ? "updated" : "created",
          resourceType: "inspection_result",
          resourceId: saved.id,
          details: {
            previousState: existing ? { outcome: existing.outcome } : null,
            nextState: { outcome: saved.outcome, lineItemKey: saved.lineItemKey },
          },
        },
        tx,
      );

      return saved;
    });

    return NextResponse.json({ id: row.id, outcome: row.outcome });
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
