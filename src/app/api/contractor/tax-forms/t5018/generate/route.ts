import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";
import { generateT5018Package } from "@/lib/integrations/cra-t5018/generate";

// Step 67 — Generate (or re-generate) a T5018 package for a fiscal year.
// Contractor-admin gated. Body carries the fiscal year; the contractor
// org is resolved from the session.
//
// Re-generation UPDATEs the existing t5018_filings row (one per
// contractor + year via UNIQUE constraint), replaces the slip rows, and
// re-uploads the artifacts to R2 under a fresh prefix. The prior R2
// blobs become orphans and get swept by the existing r2-orphan-purge
// job (Step 66.5).

const BodySchema = z.object({
  fiscalYear: z
    .number()
    .int()
    .min(2018, "T5018 was introduced in CRA's 2018 tax year")
    .max(2100),
});

export async function POST(req: Request) {
  return withErrorHandler(
    async () => {
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can generate T5018 packages.",
          "forbidden",
        );
      }

      const json = await req.json().catch(() => null);
      const parsed = BodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }
      const { fiscalYear } = parsed.data;

      const result = await generateT5018Package({
        contractorOrgId: ctx.organization.id,
        fiscalYear,
        generatedByUserId: ctx.user.id,
      }).catch((err) => {
        // Validation/business-rule failures (missing BN, no eligible
        // slips, etc.) come back as plain Errors; surface as 400 instead
        // of letting them bubble to the system audit log.
        const message =
          err instanceof Error ? err.message : "Generation failed.";
        throw Object.assign(new Error(message), { status: 400 });
      });

      await writeOrgAuditEvent(ctx, {
        resourceType: "t5018_filing",
        resourceId: result.filingId,
        action: "tax.t5018.generated",
        details: {
          metadata: {
            fiscalYear: result.fiscalYear,
            slipCount: result.slipCount,
            totalAmountCents: result.totalAmountCents,
            xmlChecksum: result.xmlChecksum,
          },
        },
      });

      return NextResponse.json({ ok: true, ...result });
    },
    { path: "/api/contractor/tax-forms/t5018/generate", method: "POST" },
  );
}
