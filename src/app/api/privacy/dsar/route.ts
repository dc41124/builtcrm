import { NextResponse } from "next/server";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { dsarRequests } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { withErrorHandler } from "@/lib/api/error-handler";
import { resolvePublicDsarOrg } from "@/lib/privacy/dsar-routing";
import { generateDsarReferenceCode } from "@/lib/privacy/reference-code";
import { verifyTurnstileToken } from "@/lib/privacy/turnstile";
import {
  dsarSubmitLimiter,
  enforceLimit,
  identifierFromRequest,
} from "@/lib/ratelimit";

// Step 65 Session B — public DSAR intake POST.
//
// Anonymous endpoint. No session, no GUC. Writes via `dbAdmin` because
// `dsar_requests` is intentionally NOT RLS'd (see security_posture.md §6).
// Defense in depth: rate-limit by IP, verify Cloudflare Turnstile token,
// resolve receiving org, insert row, write audit + stub-email events.

const PROVINCES = ["QC", "ON", "BC", "AB", "OTHER"] as const;
const REQUEST_TYPES = [
  "access",
  "deletion",
  "rectification",
  "portability",
] as const;

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  accountEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(320)
    .optional()
    .or(z.literal("")),
  province: z.enum(PROVINCES).default("QC"),
  requestType: z.enum(REQUEST_TYPES),
  description: z.string().trim().min(10).max(4000),
  agreeIdentity: z.literal(true),
  turnstileToken: z.string().trim().min(1).optional(),
});

const SLA_DAYS = 30;

export async function POST(req: Request) {
  return withErrorHandler(
    async () => {
      const limit = await enforceLimit(dsarSubmitLimiter, req);
      if (!limit.ok) {
        return NextResponse.json(
          { error: "rate_limited", message: "Too many submissions. Try again later." },
          { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))) } },
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
      const body = parsed.data;

      const turnstile = await verifyTurnstileToken(
        body.turnstileToken,
        identifierFromRequest(req),
      );
      if (!turnstile.ok) {
        return NextResponse.json(
          { error: "captcha_failed", message: "Captcha verification did not pass." },
          { status: 400 },
        );
      }

      const routing = await resolvePublicDsarOrg();
      if (!routing.ok) {
        // No designated officer at any org → we cannot accept the request.
        // 503 not 500 because the failure is configuration, not bug.
        return NextResponse.json(
          {
            error: "no_recipient",
            message:
              "We can't accept new privacy requests right now. Please email privacy@builtcrm.ca instead.",
          },
          { status: 503 },
        );
      }

      const now = new Date();
      const slaDueAt = new Date(now.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);

      // Generate the reference code with a single retry on collision.
      let referenceCode = generateDsarReferenceCode(now);
      let inserted: { id: string } | null = null;
      for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
        try {
          const rows = await dbAdmin
            .insert(dsarRequests)
            .values({
              referenceCode,
              organizationId: routing.organizationId,
              requesterName: body.name,
              requesterEmail: body.email,
              accountEmail: body.accountEmail ? body.accountEmail : null,
              province: body.province,
              requestType: body.requestType,
              description: body.description,
              receivedAt: now,
              slaDueAt,
            })
            .returning({ id: dsarRequests.id });
          inserted = rows[0] ?? null;
        } catch (err) {
          // Unique violation on reference_code — regenerate and retry once.
          const code = (err as { code?: string } | null)?.code;
          if (code === "23505" && attempt === 0) {
            referenceCode = generateDsarReferenceCode(now);
            continue;
          }
          throw err;
        }
      }
      if (!inserted) {
        return NextResponse.json(
          { error: "insert_failed" },
          { status: 500 },
        );
      }

      // Audit the receipt + the two email-stub events. Real email send
      // is deferred until prod cutover (see memory: Resend deferred);
      // for now the audit row IS the artifact that proves the email
      // would have been sent. Privacy Officer drafts (Session C breach
      // notify) follow the same draft-then-review pattern.
      await writeSystemAuditEvent({
        resourceType: "dsar_request",
        resourceId: inserted.id,
        action: "privacy.dsar.received",
        organizationId: routing.organizationId,
        details: {
          nextState: {
            referenceCode,
            requestType: body.requestType,
            province: body.province,
          },
          metadata: {
            requesterEmail: body.email,
            requesterName: body.name,
            source: "public_intake",
          },
        },
      });

      await writeSystemAuditEvent({
        resourceType: "dsar_request",
        resourceId: inserted.id,
        action: "privacy.dsar.requester_confirmation_stubbed",
        organizationId: routing.organizationId,
        details: {
          metadata: {
            recipient: body.email,
            referenceCode,
            note: "Real send deferred until prod email cutover. Audit row stands in.",
          },
        },
      });

      await writeSystemAuditEvent({
        resourceType: "dsar_request",
        resourceId: inserted.id,
        action: "privacy.dsar.officer_notification_stubbed",
        organizationId: routing.organizationId,
        details: {
          metadata: {
            referenceCode,
            note: "Notification to designated Privacy Officer — real send deferred.",
          },
        },
      });

      return NextResponse.json(
        { ok: true, referenceCode, slaDueAt: slaDueAt.toISOString() },
        { status: 201 },
      );
    },
    { path: "/api/privacy/dsar", method: "POST" },
  );
}
