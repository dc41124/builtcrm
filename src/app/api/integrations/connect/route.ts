import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { auditEvents, integrationConnections } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import {
  getContractorOrgContext,
  type IntegrationProviderKey,
} from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { getProviderConfig } from "@/lib/integrations/registry";

const ProviderEnum = z.enum([
  "quickbooks_online",
  "xero",
  "sage_business_cloud",
  "stripe",
  "google_calendar",
  "outlook_365",
  "postmark",
  "sendgrid",
]);

const BodySchema = z.object({
  provider: ProviderEnum,
  externalAccountName: z.string().min(1).max(255).optional(),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getContractorOrgContext(
      session,
    );
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only org admins can connect integrations",
        "forbidden",
      );
    }

    const provider = parsed.data.provider as IntegrationProviderKey;
    const catalog = getProviderConfig(provider);
    if (!catalog) {
      return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
    }

    // Phase 1 only ships the email connectors. Other providers can be
    // recorded as "connected" (stub) so the UI behaves end-to-end, but we
    // refuse a real OAuth dance here — that's deferred to later phases.
    const externalAccountName =
      parsed.data.externalAccountName ?? `${catalog.name} (sandbox)`;

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .insert(integrationConnections)
        .values({
          organizationId: ctx.organization.id,
          provider,
          connectionStatus: "connected",
          connectedByUserId: ctx.user.id,
          externalAccountName,
          connectedAt: new Date(),
        })
        .returning();

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "integration_connection",
        objectId: row.id,
        actionName: "connected",
        nextState: { provider, externalAccountName },
      });

      return row;
    });

    return NextResponse.json({
      id: result.id,
      provider: result.provider,
      status: result.connectionStatus,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}
