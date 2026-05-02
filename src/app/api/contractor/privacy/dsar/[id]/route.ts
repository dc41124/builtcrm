import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { dsarRequests, organizationUsers } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 65 Session B — mutate a DSAR row from the contractor admin queue.
//
// Contractor admins only. Supports three operations on one PATCH:
//   - assign: set assignedToUserId (must be an active member)
//   - status: transition status (received → in_progress → completed/rejected)
//   - notes: edit internal notes (officer-only)
//
// `dsar_requests` is intentionally not RLS'd; we scope by org_id explicitly
// and use dbAdmin throughout. The UPDATE WHERE clause includes both id and
// organization_id so a forged id from another org becomes a 0-row update.

const STATUSES = ["received", "in_progress", "completed", "rejected"] as const;

const PatchSchema = z
  .object({
    assignedToUserId: z.string().uuid().nullable().optional(),
    status: z.enum(STATUSES).optional(),
    notes: z.string().max(8000).nullable().optional(),
    projectContext: z.string().max(200).nullable().optional(),
  })
  .refine(
    (v) =>
      v.assignedToUserId !== undefined ||
      v.status !== undefined ||
      v.notes !== undefined ||
      v.projectContext !== undefined,
    { message: "At least one field must be provided" },
  );

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandler(
    async () => {
      const { id } = await params;
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can update DSAR requests.",
          "forbidden",
        );
      }

      const json = await req.json().catch(() => null);
      const parsed = PatchSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }
      const patch = parsed.data;

      // Load the existing row (org-scoped) so we can validate transitions
      // and write the audit previousState.
      const existingRows = await dbAdmin
        .select({
          id: dsarRequests.id,
          status: dsarRequests.status,
          assignedToUserId: dsarRequests.assignedToUserId,
          notes: dsarRequests.notes,
          projectContext: dsarRequests.projectContext,
          completedAt: dsarRequests.completedAt,
        })
        .from(dsarRequests)
        .where(
          and(
            eq(dsarRequests.id, id),
            eq(dsarRequests.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      // Validate assignee is an active member of this org.
      if (patch.assignedToUserId) {
        const member = await dbAdmin
          .select({ userId: organizationUsers.userId })
          .from(organizationUsers)
          .where(
            and(
              eq(organizationUsers.organizationId, ctx.organization.id),
              eq(organizationUsers.userId, patch.assignedToUserId),
              eq(organizationUsers.membershipStatus, "active"),
            ),
          )
          .limit(1);
        if (member.length === 0) {
          return NextResponse.json(
            { error: "invalid_assignee" },
            { status: 400 },
          );
        }
      }

      const updates: Partial<typeof dsarRequests.$inferInsert> = {};
      const auditChanges: Record<string, { from: unknown; to: unknown }> = {};

      if (patch.assignedToUserId !== undefined && patch.assignedToUserId !== existing.assignedToUserId) {
        updates.assignedToUserId = patch.assignedToUserId;
        auditChanges.assignedToUserId = { from: existing.assignedToUserId, to: patch.assignedToUserId };
      }
      if (patch.status !== undefined && patch.status !== existing.status) {
        updates.status = patch.status;
        auditChanges.status = { from: existing.status, to: patch.status };
        // Stamp completedAt when closing the request.
        if ((patch.status === "completed" || patch.status === "rejected") && !existing.completedAt) {
          updates.completedAt = new Date();
        }
        // If reopening (closed → in_progress/received), clear completedAt.
        if ((patch.status === "received" || patch.status === "in_progress") && existing.completedAt) {
          updates.completedAt = null;
        }
      }
      if (patch.notes !== undefined && patch.notes !== existing.notes) {
        updates.notes = patch.notes;
        // Don't echo notes content into the audit row — just flag changed.
        auditChanges.notes = { from: existing.notes ? "[set]" : null, to: patch.notes ? "[set]" : null };
      }
      if (patch.projectContext !== undefined && patch.projectContext !== existing.projectContext) {
        updates.projectContext = patch.projectContext;
        auditChanges.projectContext = { from: existing.projectContext, to: patch.projectContext };
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ ok: true, noop: true });
      }

      await dbAdmin
        .update(dsarRequests)
        .set(updates)
        .where(
          and(
            eq(dsarRequests.id, id),
            eq(dsarRequests.organizationId, ctx.organization.id),
          ),
        );

      // Audit: per-mutation rows so the queue history shows exact
      // transitions (assigned_at, status_changed_at, notes_edited_at).
      // Cheaper than parsing a single combined row at read time.
      if ("status" in updates) {
        await writeOrgAuditEvent(
          ctx,
          {
            action: "privacy.dsar.status_changed",
            resourceType: "dsar_request",
            resourceId: id,
            details: {
              previousState: { status: existing.status },
              nextState: { status: updates.status },
            },
          },
        );
      }
      if ("assignedToUserId" in updates) {
        await writeOrgAuditEvent(
          ctx,
          {
            action: "privacy.dsar.assigned",
            resourceType: "dsar_request",
            resourceId: id,
            details: {
              previousState: { assignedToUserId: existing.assignedToUserId },
              nextState: { assignedToUserId: updates.assignedToUserId },
            },
          },
        );
      }
      if ("notes" in updates || "projectContext" in updates) {
        await writeOrgAuditEvent(
          ctx,
          {
            action: "privacy.dsar.notes_updated",
            resourceType: "dsar_request",
            resourceId: id,
            details: {
              metadata: auditChanges,
            },
          },
        );
      }

      return NextResponse.json({ ok: true });
    },
    { path: "/api/contractor/privacy/dsar/[id]", method: "PATCH" },
  );
}
