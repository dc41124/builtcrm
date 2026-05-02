import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { breachRegister } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 65 Session C — mutate a single breach row. Officer-only.
// Supports: severity / containment edits, notify decision, CAI flag,
// status open/closed.

const NOTIFY_DECISIONS = ["pending", "notify", "no_notify"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["open", "closed"] as const;

const PatchSchema = z
  .object({
    severity: z.enum(SEVERITIES).optional(),
    affectedCount: z.number().int().min(0).nullable().optional(),
    affectedDescription: z.string().trim().min(1).max(2000).optional(),
    dataTypesAffected: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    containmentActions: z.string().trim().max(8000).nullable().optional(),
    notifyUsersDecision: z.enum(NOTIFY_DECISIONS).optional(),
    // Officer-attested timestamps. Send `true` to stamp now(), or `null`
    // to clear. Real send / report happen out of product.
    notifiedUsersAt: z.union([z.literal(true), z.null()]).optional(),
    reportedToCaiAt: z.union([z.literal(true), z.null()]).optional(),
    status: z.enum(STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

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
          "Only contractor admins can update breach records.",
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

      const updated = await withTenant(ctx.organization.id, async (tx) => {
        const [existing] = await tx
          .select()
          .from(breachRegister)
          .where(
            and(
              eq(breachRegister.id, id),
              eq(breachRegister.organizationId, ctx.organization.id),
            ),
          )
          .limit(1);
        if (!existing) return null;

        const now = new Date();
        const updates: Partial<typeof breachRegister.$inferInsert> = {};
        const auditMeta: Record<string, unknown> = {};

        if (patch.severity && patch.severity !== existing.severity) {
          updates.severity = patch.severity;
          auditMeta.severity = { from: existing.severity, to: patch.severity };
        }
        if (patch.affectedCount !== undefined && patch.affectedCount !== existing.affectedCount) {
          updates.affectedCount = patch.affectedCount;
          auditMeta.affectedCount = { from: existing.affectedCount, to: patch.affectedCount };
        }
        if (patch.affectedDescription && patch.affectedDescription !== existing.affectedDescription) {
          updates.affectedDescription = patch.affectedDescription;
          auditMeta.affectedDescriptionChanged = true;
        }
        if (patch.dataTypesAffected) {
          updates.dataTypesAffected = patch.dataTypesAffected;
          auditMeta.dataTypesAffected = patch.dataTypesAffected;
        }
        if (patch.containmentActions !== undefined && patch.containmentActions !== existing.containmentActions) {
          updates.containmentActions = patch.containmentActions;
          auditMeta.containmentActionsChanged = true;
        }
        if (patch.notifyUsersDecision && patch.notifyUsersDecision !== existing.notifyUsersDecision) {
          updates.notifyUsersDecision = patch.notifyUsersDecision;
          auditMeta.notifyUsersDecision = {
            from: existing.notifyUsersDecision,
            to: patch.notifyUsersDecision,
          };
        }
        if (patch.notifiedUsersAt !== undefined) {
          updates.notifiedUsersAt = patch.notifiedUsersAt === true ? now : null;
          auditMeta.notifiedUsersAt = updates.notifiedUsersAt;
        }
        if (patch.reportedToCaiAt !== undefined) {
          updates.reportedToCaiAt = patch.reportedToCaiAt === true ? now : null;
          auditMeta.reportedToCaiAt = updates.reportedToCaiAt;
        }
        if (patch.status && patch.status !== existing.status) {
          updates.status = patch.status;
          if (patch.status === "closed") {
            updates.closedAt = now;
            updates.closedByUserId = ctx.user.id;
          } else {
            updates.closedAt = null;
            updates.closedByUserId = null;
          }
          auditMeta.status = { from: existing.status, to: patch.status };
        }

        if (Object.keys(updates).length === 0) return existing;

        await tx
          .update(breachRegister)
          .set(updates)
          .where(
            and(
              eq(breachRegister.id, id),
              eq(breachRegister.organizationId, ctx.organization.id),
            ),
          );

        // Per-mutation audit rows so the reading side can reconstruct
        // exact transitions.
        if ("severity" in updates) {
          await writeOrgAuditEvent(
            ctx,
            {
              action: "privacy.breach.severity_changed",
              resourceType: "breach_register",
              resourceId: id,
              details: { previousState: { severity: existing.severity }, nextState: { severity: updates.severity } },
            },
            tx,
          );
        }
        if ("notifiedUsersAt" in updates) {
          await writeOrgAuditEvent(
            ctx,
            {
              action: "privacy.breach.notified_users",
              resourceType: "breach_register",
              resourceId: id,
              details: { metadata: { notifiedUsersAt: updates.notifiedUsersAt } },
            },
            tx,
          );
        }
        if ("reportedToCaiAt" in updates) {
          await writeOrgAuditEvent(
            ctx,
            {
              action: "privacy.breach.reported_to_cai",
              resourceType: "breach_register",
              resourceId: id,
              details: {
                metadata: {
                  reportedToCaiAt: updates.reportedToCaiAt,
                  note: "Flag-only — no transmission to the Commission. See compliance boundary doc.",
                },
              },
            },
            tx,
          );
        }
        if ("status" in updates && updates.status === "closed") {
          await writeOrgAuditEvent(
            ctx,
            {
              action: "privacy.breach.closed",
              resourceType: "breach_register",
              resourceId: id,
              details: { previousState: { status: existing.status }, nextState: { status: "closed" } },
            },
            tx,
          );
        }
        if (Object.keys(auditMeta).length > 0 && !("severity" in updates) && !("status" in updates)) {
          await writeOrgAuditEvent(
            ctx,
            {
              action: "privacy.breach.updated",
              resourceType: "breach_register",
              resourceId: id,
              details: { metadata: auditMeta },
            },
            tx,
          );
        }

        return existing;
      });

      if (!updated) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    },
    { path: "/api/contractor/privacy/breach/[id]", method: "PATCH" },
  );
}
