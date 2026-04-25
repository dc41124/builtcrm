import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { milestones } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import {
  MILESTONE_STATUS_VALUES,
  MILESTONE_TYPE_VALUES,
  MILESTONE_VISIBILITY_VALUES,
  type MilestoneStatus,
} from "@/domain/loaders/schedule";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

const PatchSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(10000).nullable().optional(),
    milestoneType: z.enum(MILESTONE_TYPE_VALUES).optional(),
    milestoneStatus: z.enum(MILESTONE_STATUS_VALUES).optional(),
    // Step 23: nullable start for duration tasks; set via Gantt drag
    // or milestone edit form. When null, the row reverts to marker
    // semantics.
    startDate: z.string().datetime().nullable().optional(),
    scheduledDate: z.string().datetime().optional(),
    phase: z.string().max(60).nullable().optional(),
    visibilityScope: z.enum(MILESTONE_VISIBILITY_VALUES).optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    assignedToOrganizationId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no_fields" })
  .refine(
    (v) => {
      // If both are provided in one update, start must be <= scheduled.
      // Guard against a drag that inverted the endpoints.
      if (v.startDate && v.scheduledDate) {
        return new Date(v.startDate).getTime() <= new Date(v.scheduledDate).getTime();
      }
      return true;
    },
    { message: "start_after_end" },
  );

// Valid state transitions. `missed` is NOT terminal: a late finish can still
// flip it to `completed`. `cancelled` is terminal.
const TRANSITIONS: Record<MilestoneStatus, ReadonlySet<MilestoneStatus>> = {
  scheduled: new Set(["in_progress", "completed", "missed", "cancelled"]),
  in_progress: new Set(["completed", "missed", "cancelled"]),
  missed: new Set(["in_progress", "completed", "cancelled"]),
  completed: new Set([]),
  cancelled: new Set([]),
};

function assertValidTransition(from: MilestoneStatus, to: MilestoneStatus) {
  if (from === to) return;
  if (!TRANSITIONS[from].has(to)) {
    throw new AuthorizationError(
      `Cannot move milestone from ${from} to ${to}`,
      "forbidden",
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withErrorHandler(
    async () => {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }

      const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      const [existing] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, id))
        .limit(1);
      if (!existing) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      const ctx = await getEffectiveContext(
        session.session as unknown as { appUserId?: string | null },
        existing.projectId,
      );
      assertCan(ctx.permissions, "milestone", "write");

      const updates = parsed.data;
      const nextStatus = updates.milestoneStatus;
      const statusChanged =
        nextStatus !== undefined && nextStatus !== existing.milestoneStatus;
      if (statusChanged) {
        assertValidTransition(
          existing.milestoneStatus as MilestoneStatus,
          nextStatus!,
        );
      }

      // Stamp completedDate automatically on transition to completed; clear it
      // if moving out of completed (back to missed/in_progress etc).
      let completedDate: Date | null | undefined = undefined;
      if (statusChanged) {
        if (nextStatus === "completed") {
          completedDate = new Date();
        } else if (existing.milestoneStatus === "completed") {
          completedDate = null;
        }
      }

      const previousState = {
        title: existing.title,
        description: existing.description,
        milestoneType: existing.milestoneType,
        milestoneStatus: existing.milestoneStatus,
        scheduledDate: existing.scheduledDate.toISOString(),
        completedDate: existing.completedDate?.toISOString() ?? null,
        phase: existing.phase,
        visibilityScope: existing.visibilityScope,
        assignedToUserId: existing.assignedToUserId,
        assignedToOrganizationId: existing.assignedToOrganizationId,
        sortOrder: existing.sortOrder,
      };

      const [updated] = await db
        .update(milestones)
        .set({
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.description !== undefined && {
            description: updates.description,
          }),
          ...(updates.milestoneType !== undefined && {
            milestoneType: updates.milestoneType,
          }),
          ...(updates.milestoneStatus !== undefined && {
            milestoneStatus: updates.milestoneStatus,
          }),
          ...(updates.scheduledDate !== undefined && {
            scheduledDate: new Date(updates.scheduledDate),
          }),
          ...(updates.startDate !== undefined && {
            startDate: updates.startDate ? new Date(updates.startDate) : null,
            kind: updates.startDate ? "task" : "marker",
          }),
          ...(updates.phase !== undefined && { phase: updates.phase }),
          ...(updates.visibilityScope !== undefined && {
            visibilityScope: updates.visibilityScope,
          }),
          ...(updates.assignedToUserId !== undefined && {
            assignedToUserId: updates.assignedToUserId,
          }),
          ...(updates.assignedToOrganizationId !== undefined && {
            assignedToOrganizationId: updates.assignedToOrganizationId,
          }),
          ...(updates.sortOrder !== undefined && { sortOrder: updates.sortOrder }),
          ...(completedDate !== undefined && { completedDate }),
          updatedAt: new Date(),
        })
        .where(eq(milestones.id, id))
        .returning();

      await writeAuditEvent(ctx, {
        action: statusChanged ? "status_changed" : "updated",
        resourceType: "milestone",
        resourceId: id,
        details: {
          previousState,
          nextState: {
            title: updated.title,
            description: updated.description,
            milestoneType: updated.milestoneType,
            milestoneStatus: updated.milestoneStatus,
            scheduledDate: updated.scheduledDate.toISOString(),
            completedDate: updated.completedDate?.toISOString() ?? null,
            phase: updated.phase,
            visibilityScope: updated.visibilityScope,
            assignedToUserId: updated.assignedToUserId,
            assignedToOrganizationId: updated.assignedToOrganizationId,
            sortOrder: updated.sortOrder,
          },
        },
      });

      return NextResponse.json({ id: updated.id });
    },
    { path: "/api/milestones/[id]", method: "PATCH" },
  );
}
