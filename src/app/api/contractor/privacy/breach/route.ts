import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { logBreach } from "@/domain/privacy/breach";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 65 Session C — log a new breach. Contractor admins only.

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const BodySchema = z.object({
  discoveredAt: z.string().datetime().or(z.string().min(1)),
  occurredAt: z.string().datetime().or(z.string()).nullable().optional(),
  occurredAtNote: z.string().trim().max(120).nullable().optional(),
  severity: z.enum(SEVERITIES),
  affectedCount: z.number().int().min(0).nullable().optional(),
  affectedDescription: z.string().trim().min(1).max(2000),
  dataTypesAffected: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  containmentActions: z.string().trim().max(8000).nullable().optional(),
});

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  return withErrorHandler(
    async () => {
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can log breaches.",
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
      const body = parsed.data;

      const discoveredAt = parseDate(body.discoveredAt) ?? new Date();
      const occurredAt = parseDate(body.occurredAt ?? null);

      const result = await withTenant(ctx.organization.id, async (tx) => {
        const logged = await logBreach({
          organizationId: ctx.organization.id,
          loggedByUserId: ctx.user.id,
          discoveredAt,
          occurredAt,
          occurredAtNote: body.occurredAtNote ?? null,
          severity: body.severity,
          affectedCount: body.affectedCount ?? null,
          affectedDescription: body.affectedDescription,
          dataTypesAffected: body.dataTypesAffected,
          containmentActions: body.containmentActions ?? null,
          tx,
        });

        await writeOrgAuditEvent(
          ctx,
          {
            action: "privacy.breach.logged",
            resourceType: "breach_register",
            resourceId: logged.id,
            details: {
              nextState: {
                referenceCode: logged.referenceCode,
                severity: body.severity,
                affectedCount: body.affectedCount ?? null,
              },
            },
          },
          tx,
        );

        return logged;
      });

      return NextResponse.json(
        { ok: true, id: result.id, referenceCode: result.referenceCode },
        { status: 201 },
      );
    },
    { path: "/api/contractor/privacy/breach", method: "POST" },
  );
}
