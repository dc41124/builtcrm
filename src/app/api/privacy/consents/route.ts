import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { recordConsent } from "@/domain/privacy/consents";
import { withErrorHandler } from "@/lib/api/error-handler";
import { ALL_CONSENT_KEYS, getConsentMeta } from "@/lib/privacy/consent-catalog";

// Step 65 Session C — authenticated consent toggle.
//
// Same per-portal exemption as the authenticated DSAR endpoint: a
// consent toggle is portal-agnostic — same data shape, same audit,
// same insert. One shared route; org/user resolved from the session.
//
// Required consents (`data_processing`) are denied at this layer with
// a 400 — the catalog flags them as required and the helper enforces.

const ConsentTypeSchema = z.enum(ALL_CONSENT_KEYS as never as [string, ...string[]]);

const BodySchema = z.object({
  consentType: ConsentTypeSchema,
  granted: z.boolean(),
  source: z.string().trim().max(64).default("preferences_page"),
});

export async function PATCH(req: Request) {
  return withErrorHandler(
    async () => {
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);

      const json = await req.json().catch(() => null);
      const parsed = BodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }
      const { consentType, granted, source } = parsed.data;

      const meta = getConsentMeta(consentType as never);
      if (meta.required && !granted) {
        return NextResponse.json(
          {
            error: "required_consent",
            message: `${meta.label} cannot be revoked while the account is active.`,
          },
          { status: 400 },
        );
      }

      // Insert the new row + audit inside a single tenant-scoped tx so
      // RLS enforces and a failure on either rolls back together.
      const result = await withTenant(ctx.organization.id, async (tx) => {
        const recorded = await recordConsent({
          organizationId: ctx.organization.id,
          subject: { kind: "user", userId: ctx.user.id },
          consentType: consentType as never,
          granted,
          source,
          tx,
        });

        await writeOrgAuditEvent(
          ctx,
          {
            action: granted ? "privacy.consent.granted" : "privacy.consent.revoked",
            resourceType: "consent_record",
            resourceId: recorded.id,
            details: {
              nextState: {
                consentType,
                granted,
                source,
              },
              metadata: {
                subjectUserId: ctx.user.id,
              },
            },
          },
          tx,
        );

        return recorded;
      });

      return NextResponse.json({ ok: true, id: result.id });
    },
    { path: "/api/privacy/consents", method: "PATCH" },
  );
}
