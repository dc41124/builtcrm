import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  auditEvents,
  integrationConnections,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Start (or resume) Stripe Connect Standard-account onboarding for the
// caller's contractor org. If no Stripe account exists yet, creates one
// and records the mapping in integration_connections (provider='stripe').
// Always generates a fresh Stripe-hosted onboarding link and returns its
// URL — callers redirect the browser. Completion is confirmed
// asynchronously via the account.updated webhook handler.
//
// Standard accounts (vs. Express) chosen for simpler UX: Stripe owns the
// whole onboarding flow, compliance, and dashboard. Portfolio trade-off.

export async function POST() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can manage Stripe Connect",
        "forbidden",
      );
    }

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!userRow) {
      throw new AuthorizationError("User not found", "not_found");
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    // Find any existing stripe row (including disconnected). If it's
    // disconnected we can re-use the Stripe account (creating accounts is
    // expensive / impossible to delete) and flip the row back to
    // 'connecting' via onboarding.
    const [existing] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.organizationId, ctx.organization.id),
            eq(integrationConnections.provider, "stripe"),
          ),
        )
        .limit(1),
    );

    let accountId = existing?.externalAccountId ?? null;
    let connectionRowId = existing?.id ?? null;

    if (!accountId) {
      const created = await stripe.accounts.create({
        type: "standard",
        email: userRow.email,
        metadata: {
          organizationId: ctx.organization.id,
          connectedByUserId: ctx.user.id,
        },
      });
      accountId = created.id;

      await withTenant(ctx.organization.id, async (tx) => {
        if (existing) {
          // Row exists (disconnected leftover) but no account id — upgrade it.
          await tx
            .update(integrationConnections)
            .set({
              externalAccountId: accountId,
              externalAccountName: created.business_profile?.name ?? null,
              connectionStatus: "connecting",
              connectedByUserId: ctx.user.id,
              connectedAt: null,
              disconnectedAt: null,
            })
            .where(eq(integrationConnections.id, existing.id));
          connectionRowId = existing.id;
        } else {
          const [row] = await tx
            .insert(integrationConnections)
            .values({
              organizationId: ctx.organization.id,
              provider: "stripe",
              connectionStatus: "connecting",
              connectedByUserId: ctx.user.id,
              externalAccountId: accountId,
              externalAccountName: null,
            })
            .returning({ id: integrationConnections.id });
          connectionRowId = row.id;
        }

        await tx.insert(auditEvents).values({
          actorUserId: ctx.user.id,
          organizationId: ctx.organization.id,
          objectType: "stripe_connect_account",
          objectId: connectionRowId!,
          actionName: "created",
          nextState: { accountId, type: "standard" },
        });
      });
    } else if (existing?.connectionStatus === "disconnected") {
      // Account exists but row was flagged disconnected — resume it.
      await withTenant(ctx.organization.id, (tx) =>
        tx
          .update(integrationConnections)
          .set({
            connectionStatus: "connecting",
            disconnectedAt: null,
          })
          .where(eq(integrationConnections.id, existing.id)),
      );
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appUrl}/contractor/settings?payments=stripe_refresh`,
      return_url: `${appUrl}/contractor/settings?payments=stripe_return`,
    });

    return NextResponse.json({ ok: true, url: link.url });
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
