import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { t5018Filings } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 67 — Mark a generated T5018 filing as "filed with CRA". The
// system never auto-files; this endpoint is the explicit user
// attestation that they uploaded the XML to CRA's Internet File
// Transfer service. Body carries the optional CRA confirmation code.

const BodySchema = z.object({
  craConfirmationCode: z.string().trim().min(1).max(64).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ filingId: string }> },
) {
  return withErrorHandler(
    async () => {
      const { filingId } = await params;
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can mark a T5018 filing as filed.",
          "forbidden",
        );
      }

      const json = await req.json().catch(() => ({}));
      const parsed = BodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      const rows = await dbAdmin
        .select({
          id: t5018Filings.id,
          fiscalYear: t5018Filings.fiscalYear,
          status: t5018Filings.status,
        })
        .from(t5018Filings)
        .where(
          and(
            eq(t5018Filings.id, filingId),
            eq(t5018Filings.contractorOrgId, ctx.organization.id),
          ),
        )
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      const filing = rows[0];

      const filedAt = new Date();
      await dbAdmin
        .update(t5018Filings)
        .set({
          status: "filed",
          filedAt,
          filedByUserId: ctx.user.id,
          craConfirmationCode: parsed.data.craConfirmationCode ?? null,
          notes: parsed.data.notes ?? null,
        })
        .where(eq(t5018Filings.id, filingId));

      await writeOrgAuditEvent(ctx, {
        resourceType: "t5018_filing",
        resourceId: filing.id,
        action: "tax.t5018.marked_filed",
        details: {
          metadata: {
            fiscalYear: filing.fiscalYear,
            craConfirmationCode: parsed.data.craConfirmationCode ?? null,
            previousStatus: filing.status,
          },
        },
      });

      return NextResponse.json({ ok: true, filedAt: filedAt.toISOString() });
    },
    {
      path: "/api/contractor/tax-forms/t5018/[filingId]/mark-filed",
      method: "PATCH",
    },
  );
}
