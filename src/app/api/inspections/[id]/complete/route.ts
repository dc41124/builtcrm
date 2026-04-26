import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  type InspectionLineItemDef,
  inspectionResults,
  inspections,
  punchItems,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/inspections/:id/complete — marks an inspection completed and
// auto-spawns punch items for every fail/conditional result that doesn't
// already have one. Idempotent: repeating the call on a completed
// inspection is a no-op (the FOR UPDATE check short-circuits and we skip
// any result that already has a linked punch).
//
// Authorized: contractor (any) OR the assigned sub user. Sub is allowed
// so the mobile walk-through can complete inspections without requiring
// a contractor round-trip.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const [head] = await dbAdmin
      .select({
        id: inspections.id,
        projectId: inspections.projectId,
        status: inspections.status,
        assignedOrgId: inspections.assignedOrgId,
        templateSnapshotJson: inspections.templateSnapshotJson,
        sequentialNumber: inspections.sequentialNumber,
        zone: inspections.zone,
      })
      .from(inspections)
      .where(eq(inspections.id, id))
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
        "Only contractors and the assigned sub may complete",
        "forbidden",
      );
    }

    if (head.status === "completed" || head.status === "cancelled") {
      // Idempotent success — already terminal.
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const snapshot =
      (head.templateSnapshotJson as InspectionLineItemDef[]) ?? [];
    const itemLabelByKey = new Map(snapshot.map((li) => [li.key, li.label]));

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Flip inspection to completed.
      const [updated] = await tx
        .update(inspections)
        .set({
          status: "completed",
          completedByUserId: ctx.user.id,
          completedAt: new Date(),
        })
        .where(eq(inspections.id, id))
        .returning();

      // Collect fail + conditional results that don't already have a
      // linked punch item.
      const failConditional = await tx
        .select({
          id: inspectionResults.id,
          lineItemKey: inspectionResults.lineItemKey,
          outcome: inspectionResults.outcome,
          notes: inspectionResults.notes,
        })
        .from(inspectionResults)
        .where(
          and(
            eq(inspectionResults.inspectionId, id),
            sql`${inspectionResults.outcome} in ('fail', 'conditional')`,
          ),
        );

      const existingPunches = await tx
        .select({
          sourceResultId: punchItems.sourceInspectionResultId,
        })
        .from(punchItems)
        .where(eq(punchItems.sourceInspectionId, id));
      const already = new Set(
        existingPunches
          .map((p) => p.sourceResultId)
          .filter((v): v is string => !!v),
      );

      const spawned: Array<{ id: string; sequentialNumber: number }> = [];
      for (const r of failConditional) {
        if (already.has(r.id)) continue;
        const [{ nextNumber }] = await tx
          .select({
            nextNumber: sql<number>`coalesce(max(${punchItems.sequentialNumber}), 0) + 1`,
          })
          .from(punchItems)
          .where(eq(punchItems.projectId, head.projectId));
        const lineLabel = itemLabelByKey.get(r.lineItemKey) ?? r.lineItemKey;
        const priority = r.outcome === "fail" ? "high" : "normal";
        const [piRow] = await tx
          .insert(punchItems)
          .values({
            projectId: head.projectId,
            sequentialNumber: nextNumber,
            title: `${lineLabel.slice(0, 80)}${lineLabel.length > 80 ? "…" : ""}`,
            description:
              r.notes && r.notes.trim().length > 0
                ? r.notes
                : `Auto-generated from INS-${String(head.sequentialNumber).padStart(4, "0")} · ${r.outcome} on "${lineLabel}"`,
            location: `${head.zone} (INS-${String(head.sequentialNumber).padStart(4, "0")})`,
            priority,
            status: "open",
            assigneeOrgId: head.assignedOrgId ?? null,
            assigneeUserId: null,
            dueDate: null,
            createdByUserId: ctx.user.id,
            sourceInspectionId: head.id,
            sourceInspectionResultId: r.id,
          })
          .returning();
        spawned.push({ id: piRow.id, sequentialNumber: piRow.sequentialNumber });

        await writeAuditEvent(
          ctx,
          {
            action: "auto_created_from_inspection",
            resourceType: "punch_item",
            resourceId: piRow.id,
            details: {
              nextState: {
                sequentialNumber: piRow.sequentialNumber,
                sourceInspectionId: head.id,
                sourceInspectionResultId: r.id,
              },
            },
          },
          tx,
        );
      }

      await writeAuditEvent(
        ctx,
        {
          action: "completed",
          resourceType: "inspection",
          resourceId: id,
          details: {
            nextState: {
              status: "completed",
              punchItemsSpawned: spawned.length,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `INS-${String(head.sequentialNumber).padStart(4, "0")} completed${spawned.length ? ` · ${spawned.length} punch${spawned.length === 1 ? "" : "es"} auto-created` : ""}`,
          body: null,
          relatedObjectType: "inspection",
          relatedObjectId: id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      return { updated, spawned };
    });

    return NextResponse.json({
      ok: true,
      id: result.updated.id,
      completedAt: result.updated.completedAt,
      spawnedPunchIds: result.spawned.map((s) => s.id),
      spawnedCount: result.spawned.length,
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
