import { and, eq, gt, gte, isNull, lt, ne, or, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  projectOrganizationMemberships,
  timeEntries,
  timeEntryAmendments,
  type TimeEntrySnapshot,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import type { SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { minutesBetween } from "@/lib/time-tracking/format";

// ─────────────────────────────────────────────────────────────────────────
// Time-entry actions. Every state-changing API route delegates here.
//
// Authorization rules enforced:
//   - Worker actions (clockIn / clockOut / edit / submit / manualEntry) act
//     on rows where userId === caller. The action layer is the gate; RLS
//     gives org-wide read so workers can see colleagues in roster context.
//   - Admin actions (approve / reject / amend) require the caller's role to
//     be `subcontractor_owner`. The acting user can amend their own entry
//     too (they're an admin first), but cannot approve their own — see
//     `approveEntry`.
//   - Submitted entries are read-only to the worker; only admin amend can
//     change them. The action layer enforces this; the page uses the same
//     rule to decide which action buttons render.
//   - Overlap prevention: clockIn / manualEntry / editDraft all run a
//     range-overlap check against the same user's other entries. Open
//     (clock_out_at IS NULL) entries treat NOW() as their end.
// ─────────────────────────────────────────────────────────────────────────

export class OverlapError extends Error {
  constructor(message = "Overlapping time entry exists for this worker") {
    super(message);
  }
}

export class StateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ProjectAccessError extends Error {
  constructor() {
    super("Project not accessible to this subcontractor");
  }
}

interface BaseInput {
  session: SessionLike | null | undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// clockIn — start a new running entry. Idempotent on clientUuid (returns
// the existing row). Fails if the user already has a running entry (the
// partial unique index will also reject; we check first to give a friendly
// error).
// ─────────────────────────────────────────────────────────────────────────

export interface ClockInInput extends BaseInput {
  projectId: string;
  taskLabel?: string | null;
  taskCode?: string | null;
  notes?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  clientUuid?: string | null;
}

export async function clockIn(input: ClockInInput): Promise<{ id: string }> {
  const ctx = await getSubcontractorOrgContext(input.session);
  await assertSubOnProject(ctx.organization.id, input.projectId);
  const now = new Date();

  return withTenant(ctx.organization.id, async (tx) => {
    if (input.clientUuid) {
      const [prior] = await tx
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(eq(timeEntries.clientUuid, input.clientUuid))
        .limit(1);
      if (prior) return { id: prior.id };
    }

    const [running] = await tx
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, ctx.user.id),
          eq(timeEntries.status, "running"),
        ),
      )
      .limit(1);
    if (running) {
      throw new StateError(
        "You already have a running entry. Clock out first.",
      );
    }

    const [row] = await tx
      .insert(timeEntries)
      .values({
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        projectId: input.projectId,
        taskLabel: input.taskLabel ?? null,
        taskCode: input.taskCode ?? null,
        clockInAt: now,
        clockOutAt: null,
        durationMinutes: null,
        locationLat:
          input.locationLat != null ? String(input.locationLat) : null,
        locationLng:
          input.locationLng != null ? String(input.locationLng) : null,
        notes: input.notes ?? null,
        status: "running",
        clientUuid: input.clientUuid ?? null,
      })
      .returning({ id: timeEntries.id });

    return { id: row.id };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// clockOut — close the caller's running entry. Idempotent: calling on a
// row that is already non-running returns the row id without changes.
// ─────────────────────────────────────────────────────────────────────────

export interface ClockOutInput extends BaseInput {
  notes?: string | null;
}

export async function clockOut(input: ClockOutInput): Promise<{ id: string } | null> {
  const ctx = await getSubcontractorOrgContext(input.session);
  const now = new Date();

  return withTenant(ctx.organization.id, async (tx) => {
    const [running] = await tx
      .select({
        id: timeEntries.id,
        clockInAt: timeEntries.clockInAt,
        notes: timeEntries.notes,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, ctx.user.id),
          eq(timeEntries.status, "running"),
        ),
      )
      .limit(1);
    if (!running) return null;

    const minutes = minutesBetween(running.clockInAt, now);
    const mergedNotes =
      input.notes && input.notes.trim().length
        ? input.notes
        : running.notes;
    await tx
      .update(timeEntries)
      .set({
        clockOutAt: now,
        durationMinutes: minutes,
        status: "draft",
        notes: mergedNotes,
      })
      .where(eq(timeEntries.id, running.id));
    return { id: running.id };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// editDraft — worker edits one of their own draft entries. Submitted+ rows
// are read-only here.
// ─────────────────────────────────────────────────────────────────────────

export interface EditDraftInput extends BaseInput {
  id: string;
  clockInAt?: Date;
  clockOutAt?: Date | null;
  projectId?: string;
  taskLabel?: string | null;
  taskCode?: string | null;
  notes?: string | null;
}

export async function editDraft(input: EditDraftInput): Promise<void> {
  const ctx = await getSubcontractorOrgContext(input.session);

  await withTenant(ctx.organization.id, async (tx) => {
    const [row] = await tx
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        status: timeEntries.status,
        clockInAt: timeEntries.clockInAt,
        clockOutAt: timeEntries.clockOutAt,
      })
      .from(timeEntries)
      .where(eq(timeEntries.id, input.id))
      .limit(1);
    if (!row) {
      throw new AuthorizationError("Entry not found", "not_found");
    }
    if (row.userId !== ctx.user.id) {
      throw new AuthorizationError(
        "Workers can only edit their own entries",
        "forbidden",
      );
    }
    if (row.status !== "draft" && row.status !== "running") {
      throw new StateError(
        "Submitted entries cannot be edited by the worker. Ask an admin to amend.",
      );
    }
    if (input.projectId) {
      await assertSubOnProject(ctx.organization.id, input.projectId);
    }

    const newClockIn = input.clockInAt ?? row.clockInAt;
    const newClockOut =
      input.clockOutAt !== undefined ? input.clockOutAt : row.clockOutAt;
    if (newClockOut && newClockOut <= newClockIn) {
      throw new StateError("End time must be after start time.");
    }
    await assertNoOverlap(
      tx,
      ctx.user.id,
      newClockIn,
      newClockOut,
      input.id,
    );

    await tx
      .update(timeEntries)
      .set({
        clockInAt: newClockIn,
        clockOutAt: newClockOut ?? null,
        durationMinutes: newClockOut
          ? minutesBetween(newClockIn, newClockOut)
          : null,
        projectId: input.projectId ?? undefined,
        taskLabel:
          input.taskLabel !== undefined ? input.taskLabel : undefined,
        taskCode: input.taskCode !== undefined ? input.taskCode : undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
      })
      .where(eq(timeEntries.id, input.id));
  });
}

// ─────────────────────────────────────────────────────────────────────────
// manualEntry — worker backfills a missed punch. Always created as draft.
// Same overlap protection as edits.
// ─────────────────────────────────────────────────────────────────────────

export interface ManualEntryInput extends BaseInput {
  projectId: string;
  taskLabel?: string | null;
  taskCode?: string | null;
  clockInAt: Date;
  clockOutAt: Date;
  notes?: string | null;
  reason: string;
}

export async function manualEntry(
  input: ManualEntryInput,
): Promise<{ id: string }> {
  const ctx = await getSubcontractorOrgContext(input.session);
  await assertSubOnProject(ctx.organization.id, input.projectId);

  if (input.clockOutAt <= input.clockInAt) {
    throw new StateError("End time must be after start time.");
  }
  if (!input.reason.trim()) {
    throw new StateError("Manual entries require a reason.");
  }

  return withTenant(ctx.organization.id, async (tx) => {
    await assertNoOverlap(
      tx,
      ctx.user.id,
      input.clockInAt,
      input.clockOutAt,
      null,
    );
    const minutes = minutesBetween(input.clockInAt, input.clockOutAt);
    const [row] = await tx
      .insert(timeEntries)
      .values({
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        projectId: input.projectId,
        taskLabel: input.taskLabel ?? null,
        taskCode: input.taskCode ?? null,
        clockInAt: input.clockInAt,
        clockOutAt: input.clockOutAt,
        durationMinutes: minutes,
        notes: `[Manual entry] ${input.reason}${input.notes ? ` — ${input.notes}` : ""}`,
        status: "draft",
      })
      .returning({ id: timeEntries.id });
    return { id: row.id };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// submitWeek — flip every draft entry of the caller in the given week to
// 'submitted'. Returns the count actually submitted. The running entry, if
// any, is left alone (the prototype banner warns the user about this).
// ─────────────────────────────────────────────────────────────────────────

export interface SubmitWeekInput extends BaseInput {
  weekStart: Date;
  weekEnd: Date;
}

export async function submitWeek(
  input: SubmitWeekInput,
): Promise<{ submitted: number }> {
  const ctx = await getSubcontractorOrgContext(input.session);
  const now = new Date();

  return withTenant(ctx.organization.id, async (tx) => {
    const drafts = await tx
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, ctx.user.id),
          eq(timeEntries.status, "draft"),
          gte(timeEntries.clockInAt, input.weekStart),
          lt(timeEntries.clockInAt, input.weekEnd),
        ),
      );
    if (drafts.length === 0) return { submitted: 0 };

    for (const draft of drafts) {
      const [before] = await tx
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.id, draft.id))
        .limit(1);
      await tx
        .update(timeEntries)
        .set({ status: "submitted", submittedAt: now })
        .where(eq(timeEntries.id, draft.id));
      await tx.insert(timeEntryAmendments).values({
        timeEntryId: draft.id,
        actorUserId: ctx.user.id,
        action: "submitted",
        beforeJson: snapshot(before),
        afterJson: { ...snapshot(before), status: "submitted" },
        reason: null,
      });
    }
    return { submitted: drafts.length };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// approveEntry — admin approves a submitted entry. Workers cannot approve
// their own entries. Approved is a terminal state for the row's lifecycle
// from the worker's perspective.
// ─────────────────────────────────────────────────────────────────────────

export interface DecideEntryInput extends BaseInput {
  id: string;
  reason?: string | null;
}

export async function approveEntry(input: DecideEntryInput): Promise<void> {
  await decide(input, "approved");
}

export async function rejectEntry(input: DecideEntryInput): Promise<void> {
  await decide(input, "rejected", true);
}

async function decide(
  input: DecideEntryInput,
  newStatus: "approved" | "rejected",
  reasonRequired = false,
): Promise<void> {
  const ctx = await getSubcontractorOrgContext(input.session);
  if (ctx.role !== "subcontractor_owner") {
    throw new AuthorizationError(
      "Only sub admins can approve or reject entries",
      "forbidden",
    );
  }
  if (reasonRequired && !input.reason?.trim()) {
    throw new StateError("A reason is required when rejecting.");
  }
  const now = new Date();

  await withTenant(ctx.organization.id, async (tx) => {
    const [row] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, input.id))
      .limit(1);
    if (!row) throw new AuthorizationError("Entry not found", "not_found");
    if (row.status !== "submitted") {
      throw new StateError(
        `Entry is in '${row.status}' state — only submitted entries can be ${newStatus}.`,
      );
    }
    if (row.userId === ctx.user.id && newStatus === "approved") {
      throw new AuthorizationError(
        "Admins cannot approve their own entries",
        "forbidden",
      );
    }
    await tx
      .update(timeEntries)
      .set({
        status: newStatus,
        decidedByUserId: ctx.user.id,
        decidedAt: now,
      })
      .where(eq(timeEntries.id, input.id));
    await tx.insert(timeEntryAmendments).values({
      timeEntryId: input.id,
      actorUserId: ctx.user.id,
      action: newStatus,
      beforeJson: snapshot(row),
      afterJson: { ...snapshot(row), status: newStatus },
      reason: input.reason ?? null,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// amendEntry — admin edits a submitted/approved/rejected/amended row.
// Always writes an amendment audit row with before/after snapshots and the
// admin's reason. The row's terminal status becomes 'amended'.
// ─────────────────────────────────────────────────────────────────────────

export interface AmendEntryInput extends BaseInput {
  id: string;
  clockInAt?: Date;
  clockOutAt?: Date | null;
  projectId?: string;
  taskLabel?: string | null;
  taskCode?: string | null;
  notes?: string | null;
  reason: string;
}

export async function amendEntry(input: AmendEntryInput): Promise<void> {
  const ctx = await getSubcontractorOrgContext(input.session);
  if (ctx.role !== "subcontractor_owner") {
    throw new AuthorizationError(
      "Only sub admins can amend entries",
      "forbidden",
    );
  }
  if (!input.reason.trim()) {
    throw new StateError("A reason is required when amending.");
  }
  const now = new Date();

  await withTenant(ctx.organization.id, async (tx) => {
    const [row] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, input.id))
      .limit(1);
    if (!row) throw new AuthorizationError("Entry not found", "not_found");
    if (row.status === "running") {
      throw new StateError(
        "Cannot amend a running entry. The worker must clock out first.",
      );
    }
    if (input.projectId) {
      await assertSubOnProject(ctx.organization.id, input.projectId);
    }
    const newClockIn = input.clockInAt ?? row.clockInAt;
    const newClockOut =
      input.clockOutAt !== undefined ? input.clockOutAt : row.clockOutAt;
    if (newClockOut && newClockOut <= newClockIn) {
      throw new StateError("End time must be after start time.");
    }
    await assertNoOverlap(tx, row.userId, newClockIn, newClockOut, input.id);

    await tx
      .update(timeEntries)
      .set({
        clockInAt: newClockIn,
        clockOutAt: newClockOut ?? null,
        durationMinutes: newClockOut
          ? minutesBetween(newClockIn, newClockOut)
          : null,
        projectId: input.projectId ?? undefined,
        taskLabel:
          input.taskLabel !== undefined ? input.taskLabel : undefined,
        taskCode: input.taskCode !== undefined ? input.taskCode : undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
        status: "amended",
        decidedByUserId: ctx.user.id,
        decidedAt: now,
      })
      .where(eq(timeEntries.id, input.id));

    const after: TimeEntrySnapshot = {
      clockInAt: newClockIn.toISOString(),
      clockOutAt: newClockOut ? newClockOut.toISOString() : null,
      durationMinutes: newClockOut
        ? minutesBetween(newClockIn, newClockOut)
        : null,
      projectId: input.projectId ?? row.projectId,
      taskLabel:
        input.taskLabel !== undefined ? input.taskLabel : row.taskLabel,
      notes: input.notes !== undefined ? input.notes : row.notes,
      status: "amended",
    };
    await tx.insert(timeEntryAmendments).values({
      timeEntryId: input.id,
      actorUserId: ctx.user.id,
      action: "amended",
      beforeJson: snapshot(row),
      afterJson: after,
      reason: input.reason,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

function snapshot(row: {
  clockInAt: Date;
  clockOutAt: Date | null;
  durationMinutes: number | null;
  projectId: string;
  taskLabel: string | null;
  notes: string | null;
  status: string;
}): TimeEntrySnapshot {
  return {
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
    durationMinutes: row.durationMinutes,
    projectId: row.projectId,
    taskLabel: row.taskLabel,
    notes: row.notes,
    status: row.status,
  };
}

async function assertSubOnProject(
  orgId: string,
  projectId: string,
): Promise<void> {
  const [m] = await dbAdmin
    .select({ id: projectOrganizationMemberships.id })
    .from(projectOrganizationMemberships)
    .where(
      and(
        eq(projectOrganizationMemberships.organizationId, orgId),
        eq(projectOrganizationMemberships.projectId, projectId),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    )
    .limit(1);
  if (!m) throw new ProjectAccessError();
}

// Overlap check: the new range [clockInAt, clockOutAt|now) must not
// overlap any of the same user's other entries' [clockInAt, clockOutAt|now)
// ranges, excluding the row being edited (`excludeId`). Open entries treat
// NOW() as their end.
async function assertNoOverlap(
  tx: Parameters<Parameters<typeof withTenant<unknown>>[1]>[0],
  userId: string,
  newStart: Date,
  newEnd: Date | null,
  excludeId: string | null,
): Promise<void> {
  const effectiveEnd = newEnd ?? new Date();
  const conflicts = await tx
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        excludeId ? ne(timeEntries.id, excludeId) : sql`true`,
        // Range overlap: existing.clockIn < newEnd AND (existing.clockOut > newStart OR existing.clockOut IS NULL)
        lt(timeEntries.clockInAt, effectiveEnd),
        or(
          isNull(timeEntries.clockOutAt),
          gt(timeEntries.clockOutAt, newStart),
        ),
      ),
    )
    .limit(1);
  if (conflicts.length > 0) throw new OverlapError();
}
