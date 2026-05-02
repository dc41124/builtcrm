import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { dsarRequests } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { withErrorHandler } from "@/lib/api/error-handler";
import { generateDsarReferenceCode } from "@/lib/privacy/reference-code";

// Step 65 Session C — authenticated DSAR submission.
//
// Exception to the per-portal API pattern: a DSAR is portal-agnostic
// (the data shape is identical for contractor, subcontractor, commercial,
// residential — same Zod schema, same audit, same insert). Per-portal
// handlers would just be 4 copies of the same file. Single shared route
// here, with `getOrgContext` driving org/user resolution from the session
// the same way it would in a per-portal handler.
//
// Behavior differs from the public POST in three ways:
//   1. No Turnstile — the session itself is the proof of identity.
//   2. No rate limit — auth flow already throttles abuse paths.
//   3. `subject_user_id` is set; the requester's email is pulled from
//      their account row, not user-supplied.
//
// Confirmation + officer-notification emails are stubbed via audit
// events (same as the public POST) until prod email cutover.

const REQUEST_TYPES = [
  "access",
  "deletion",
  "rectification",
  "portability",
] as const;

const BodySchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  description: z.string().trim().min(10).max(4000),
  projectContext: z.string().trim().max(200).optional(),
});

const SLA_DAYS = 30;

export async function POST(req: Request) {
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
      const body = parsed.data;

      const now = new Date();
      const slaDueAt = new Date(now.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);

      let referenceCode = generateDsarReferenceCode(now);
      let inserted: { id: string } | null = null;
      for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
        try {
          const rows = await dbAdmin
            .insert(dsarRequests)
            .values({
              referenceCode,
              organizationId: ctx.organization.id,
              requesterName: ctx.user.displayName ?? ctx.user.email,
              requesterEmail: ctx.user.email,
              accountEmail: null,
              province: "QC",
              subjectUserId: ctx.user.id,
              requestType: body.requestType,
              description: body.description,
              projectContext: body.projectContext ?? null,
              receivedAt: now,
              slaDueAt,
            })
            .returning({ id: dsarRequests.id });
          inserted = rows[0] ?? null;
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "23505" && attempt === 0) {
            referenceCode = generateDsarReferenceCode(now);
            continue;
          }
          throw err;
        }
      }
      if (!inserted) {
        return NextResponse.json({ error: "insert_failed" }, { status: 500 });
      }

      await writeOrgAuditEvent(ctx, {
        action: "privacy.dsar.received",
        resourceType: "dsar_request",
        resourceId: inserted.id,
        details: {
          nextState: {
            referenceCode,
            requestType: body.requestType,
          },
          metadata: {
            source: "authenticated_intake",
            requesterUserId: ctx.user.id,
          },
        },
      });
      await writeOrgAuditEvent(ctx, {
        action: "privacy.dsar.requester_confirmation_stubbed",
        resourceType: "dsar_request",
        resourceId: inserted.id,
        details: {
          metadata: {
            recipient: ctx.user.email,
            referenceCode,
            note: "Real send deferred until prod email cutover.",
          },
        },
      });
      await writeOrgAuditEvent(ctx, {
        action: "privacy.dsar.officer_notification_stubbed",
        resourceType: "dsar_request",
        resourceId: inserted.id,
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
    { path: "/api/privacy/dsar/authenticated", method: "POST" },
  );
}
