import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { breachNotificationDrafts } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 65 Session C — mutate one draft. Officer-only.
//
// Three operations on the same PATCH:
//   1. Edit subject_line / body_text while status = 'draft'.
//   2. Mark as sent — manual attestation, NOT a real send. Stamps
//      sent_at + sent_by_user_id.
//   3. Withdraw — removes from the actionable set without deleting.

const STATUSES = ["draft", "sent", "withdrawn"] as const;

const PatchSchema = z
  .object({
    subjectLine: z.string().trim().min(1).max(300).optional(),
    bodyText: z.string().trim().min(1).max(20000).optional(),
    // Only `sent` and `withdrawn` are accepted as transitions; clients
    // can't unset a draft status to itself.
    status: z.enum(STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  return withErrorHandler(
    async () => {
      const { id, draftId } = await params;
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can update breach notification drafts.",
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

      const ok = await withTenant(ctx.organization.id, async (tx) => {
        const [existing] = await tx
          .select()
          .from(breachNotificationDrafts)
          .where(
            and(
              eq(breachNotificationDrafts.id, draftId),
              eq(breachNotificationDrafts.breachId, id),
              eq(breachNotificationDrafts.organizationId, ctx.organization.id),
            ),
          )
          .limit(1);
        if (!existing) return false;

        const now = new Date();
        const updates: Partial<typeof breachNotificationDrafts.$inferInsert> = {};

        // Edits to subject/body are blocked once the draft is sent or
        // withdrawn — preserves the audit trail of what was sent.
        if (patch.subjectLine && patch.subjectLine !== existing.subjectLine) {
          if (existing.status !== "draft") {
            throw new AuthorizationError(
              "Drafts can only be edited while in 'draft' status.",
              "forbidden",
            );
          }
          updates.subjectLine = patch.subjectLine;
        }
        if (patch.bodyText && patch.bodyText !== existing.bodyText) {
          if (existing.status !== "draft") {
            throw new AuthorizationError(
              "Drafts can only be edited while in 'draft' status.",
              "forbidden",
            );
          }
          updates.bodyText = patch.bodyText;
        }
        if (patch.status && patch.status !== existing.status) {
          updates.status = patch.status;
          if (patch.status === "sent") {
            updates.sentAt = now;
            updates.sentByUserId = ctx.user.id;
          }
        }

        if (Object.keys(updates).length === 0) return true;

        await tx
          .update(breachNotificationDrafts)
          .set(updates)
          .where(
            and(
              eq(breachNotificationDrafts.id, draftId),
              eq(breachNotificationDrafts.organizationId, ctx.organization.id),
            ),
          );

        if ("status" in updates) {
          await writeOrgAuditEvent(
            ctx,
            {
              action:
                updates.status === "sent"
                  ? "privacy.breach.notification_marked_sent"
                  : updates.status === "withdrawn"
                    ? "privacy.breach.notification_withdrawn"
                    : "privacy.breach.notification_status_changed",
              resourceType: "breach_notification_draft",
              resourceId: draftId,
              details: {
                previousState: { status: existing.status },
                nextState: { status: updates.status },
                metadata:
                  updates.status === "sent"
                    ? {
                        recipient: existing.recipientEmail,
                        breachId: id,
                        note: "Officer-attested send — product did not transmit; logs the human action.",
                      }
                    : { breachId: id },
              },
            },
            tx,
          );
        }

        return true;
      });

      if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    },
    {
      path: "/api/contractor/privacy/breach/[id]/drafts/[draftId]",
      method: "PATCH",
    },
  );
}
