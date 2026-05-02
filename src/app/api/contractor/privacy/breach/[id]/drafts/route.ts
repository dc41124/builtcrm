import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { breachRegister } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { generateBreachNotificationDrafts } from "@/domain/privacy/breach";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 65 Session C — generate per-subject email drafts for a breach.
// Officer-only. Drafts NEVER auto-send — the officer reviews each row
// and marks it sent (a manual attestation, not a real send) via
// PATCH /api/contractor/privacy/breach/[id]/drafts/[draftId].

const RecipientSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  userId: z.string().uuid().nullable().optional(),
  displayName: z.string().trim().max(200).nullable().optional(),
});

const BodySchema = z
  .object({
    recipients: z.array(RecipientSchema).max(10000).optional(),
    subjectLine: z.string().trim().min(1).max(300).optional(),
    bodyText: z.string().trim().min(1).max(20000).optional(),
  })
  .default({});

export async function POST(
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
          "Only contractor admins can generate breach notification drafts.",
          "forbidden",
        );
      }

      const json = await req.json().catch(() => ({}));
      const parsed = BodySchema.safeParse(json ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }
      const body = parsed.data;

      const result = await withTenant(ctx.organization.id, async (tx) => {
        // Confirm the breach exists in this org (RLS would also block,
        // but a sharp 404 is friendlier).
        const [breach] = await tx
          .select({ id: breachRegister.id })
          .from(breachRegister)
          .where(
            and(
              eq(breachRegister.id, id),
              eq(breachRegister.organizationId, ctx.organization.id),
            ),
          )
          .limit(1);
        if (!breach) return null;

        const generated = await generateBreachNotificationDrafts({
          breachId: id,
          organizationId: ctx.organization.id,
          recipients: (body.recipients ?? []).map((r) => ({
            email: r.email,
            userId: r.userId ?? null,
            displayName: r.displayName ?? null,
          })),
          template:
            body.subjectLine || body.bodyText
              ? { subjectLine: body.subjectLine, bodyText: body.bodyText }
              : undefined,
          tx,
        });

        await writeOrgAuditEvent(
          ctx,
          {
            action: "privacy.breach.notification_drafted",
            resourceType: "breach_register",
            resourceId: id,
            details: {
              metadata: {
                recipientCount: generated.recipientCount,
                draftIds: generated.draftIds.slice(0, 50),
                note: "Drafts only — never auto-sent.",
              },
            },
          },
          tx,
        );

        return generated;
      });

      if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json(
        { ok: true, recipientCount: result.recipientCount, draftIds: result.draftIds },
        { status: 201 },
      );
    },
    {
      path: "/api/contractor/privacy/breach/[id]/drafts",
      method: "POST",
    },
  );
}
