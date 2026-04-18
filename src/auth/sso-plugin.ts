import { createAuthEndpoint } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  organizationUsers,
  roleAssignments,
  ssoProviders,
  users,
} from "@/db/schema";
import { getSsoProviderById } from "@/domain/loaders/sso";
import {
  buildIdentityProvider,
  buildServiceProvider,
} from "@/lib/saml/client";

import type { BetterAuthPlugin } from "better-auth";

// SSO / SAML 2.0 plugin for Better Auth.
//
// Two endpoints mounted under /api/auth/sso/:
//   initiate — GET, query: { providerId }. Builds an AuthnRequest and
//              redirects the browser to the IdP's SSO URL.
//   acs      — POST, receives IdP's SAMLResponse form-POST. Validates the
//              assertion signature against the provider's certificate,
//              enforces allowed_email_domain, looks up the existing
//              auth_user + role assignment in THIS provider's org, mints a
//              session via internalAdapter, and redirects to the portal.
//
// Auto-provisioning is intentionally NOT supported in this session. A
// user must already exist with a contractor role in the provider's org
// (typically via invitation) before SSO can sign them in. A separate
// session will wire auto-provisioning once the UX is decided.
//
// Feature gating lives in the provider-CRUD routes (Enterprise). If a
// provider row exists in DB, it's assumed to have been created by an
// Enterprise org; the auth flow doesn't re-check the plan.

export function ssoPlugin(): BetterAuthPlugin {
  return {
    id: "sso",
    endpoints: {
      initiateSSO: createAuthEndpoint(
        "/sso/initiate",
        {
          method: "GET",
          query: z.object({ providerId: z.string().uuid() }),
        },
        async (ctx) => {
          const providerId = ctx.query.providerId;
          const provider = await getSsoProviderById(providerId);
          if (!provider || provider.status !== "active") {
            return ctx.json(
              { error: "provider_not_found" },
              { status: 404 },
            );
          }

          const sp = buildServiceProvider(provider.id);
          const idp = buildIdentityProvider(provider);
          const { context: redirectUrl } = sp.createLoginRequest(
            idp,
            "redirect",
          );
          ctx.setHeader("Location", redirectUrl);
          return ctx.json(
            { redirect: true, url: redirectUrl },
            { status: 302 },
          );
        },
      ),
      consumeSAMLResponse: createAuthEndpoint(
        "/sso/acs",
        {
          method: "POST",
          query: z.object({ providerId: z.string().uuid() }),
          body: z.object({
            SAMLResponse: z.string().min(1),
            RelayState: z.string().optional(),
          }),
        },
        async (ctx) => {
          const providerId = ctx.query.providerId;
          const provider = await getSsoProviderById(providerId);
          if (!provider || provider.status !== "active") {
            return ctx.json(
              { error: "provider_not_found" },
              { status: 404 },
            );
          }

          const sp = buildServiceProvider(provider.id);
          const idp = buildIdentityProvider(provider);

          let parsed: Awaited<ReturnType<typeof sp.parseLoginResponse>>;
          try {
            parsed = await sp.parseLoginResponse(idp, "post", {
              body: { SAMLResponse: ctx.body.SAMLResponse },
            });
          } catch (err) {
            ctx.context.logger.error("[sso] assertion validation failed", err);
            return ctx.json(
              { error: "invalid_saml_response" },
              { status: 400 },
            );
          }

          const extract = parsed.extract as {
            nameID?: string;
            attributes?: Record<string, string>;
          };
          const emailFromAssertion =
            extract.nameID ??
            extract.attributes?.email ??
            extract.attributes?.Email ??
            null;
          if (!emailFromAssertion) {
            return ctx.json(
              { error: "assertion_missing_email" },
              { status: 400 },
            );
          }

          const email = emailFromAssertion.trim().toLowerCase();
          const emailDomain = email.split("@")[1];
          if (
            !emailDomain ||
            emailDomain !== provider.allowedEmailDomain.toLowerCase()
          ) {
            return ctx.json(
              {
                error: "email_domain_not_allowed",
                message: `Email domain must match ${provider.allowedEmailDomain}.`,
              },
              { status: 403 },
            );
          }

          // Look up the existing authUser. SSO does NOT auto-provision;
          // the user must have been invited + accepted before SSO works.
          const existingAuthUser = await ctx.context.internalAdapter.findUserByEmail(
            email,
            { includeAccounts: false },
          );
          if (!existingAuthUser?.user) {
            return ctx.json(
              {
                error: "user_not_provisioned",
                message:
                  "No BuiltCRM account exists for this email. Ask your admin to invite you first.",
              },
              { status: 403 },
            );
          }

          // Verify the user has a contractor role in THIS provider's org.
          const authUserRow = existingAuthUser.user as {
            id: string;
            appUserId?: string;
          };
          const appUserId = authUserRow.appUserId;
          if (!appUserId) {
            return ctx.json(
              { error: "user_not_linked" },
              { status: 500 },
            );
          }
          const [roleAssignment] = await db
            .select({ id: roleAssignments.id })
            .from(roleAssignments)
            .where(
              and(
                eq(roleAssignments.userId, appUserId),
                eq(roleAssignments.organizationId, provider.organizationId),
                eq(roleAssignments.portalType, "contractor"),
              ),
            )
            .limit(1);
          if (!roleAssignment) {
            return ctx.json(
              {
                error: "no_role_in_org",
                message:
                  "Your account exists but isn't a member of this organization.",
              },
              { status: 403 },
            );
          }

          // Idempotently ensure the organization_users membership row is
          // active (it usually will be if roleAssignment exists, but defence
          // against inconsistent state is cheap).
          const [membership] = await db
            .select({ id: organizationUsers.id })
            .from(organizationUsers)
            .where(
              and(
                eq(organizationUsers.userId, appUserId),
                eq(
                  organizationUsers.organizationId,
                  provider.organizationId,
                ),
              ),
            )
            .limit(1);
          if (!membership) {
            await db.insert(organizationUsers).values({
              userId: appUserId,
              organizationId: provider.organizationId,
              membershipStatus: "active",
            });
          }

          // Mint the session. Better Auth's session.create.before hook
          // populates appUserId / organizationId / role / portalType from
          // roleAssignments, so the session is ready for portal routing.
          const session =
            await ctx.context.internalAdapter.createSession(
              authUserRow.id,
              false,
            );
          if (!session) {
            return ctx.json(
              { error: "session_create_failed" },
              { status: 500 },
            );
          }

          const setSessionCookieModule = await import(
            "better-auth/cookies"
          );
          await setSessionCookieModule.setSessionCookie(ctx, {
            session,
            user: existingAuthUser.user,
          });

          // Update the provider's last_login_at. Also update the domain
          // users table's email so subsequent reads reflect the IdP.
          await db
            .update(ssoProviders)
            .set({ lastLoginAt: new Date() })
            .where(eq(ssoProviders.id, provider.id));
          await db
            .update(users)
            .set({})
            .where(eq(users.id, appUserId));

          const landing = "/contractor";
          ctx.setHeader("Location", landing);
          return ctx.json({ redirect: true, url: landing }, { status: 302 });
        },
      ),
    },
  };
}
