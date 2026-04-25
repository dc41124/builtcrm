import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";

import { ssoPlugin } from "./sso-plugin";
import { betterAuthSecondaryStorage } from "./secondary-storage";

import { db } from "@/db/client";
import {
  authAccount,
  authSession,
  authTwoFactor,
  authUser,
  authVerification,
  organizations,
  roleAssignments,
  users,
} from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
      twoFactor: authTwoFactor,
    },
  }),
  // Sessions live in Upstash Redis, not Postgres. See
  // docs/specs/security_posture.md §4.
  secondaryStorage: betterAuthSecondaryStorage,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    // Pinned default — password-reset tokens expire after 30 minutes.
    // Tighter than Better Auth's default (~24h); reset is a high-value
    // attacker target and email pipes are usually fast enough that 30m
    // is comfortable. See docs/specs/security_posture.md §7.
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      // Dev stub: no email infrastructure is wired up yet (see Phase 1 build
      // notes — Postmark/SendGrid integration is catalog-only). Log the link
      // so a developer running locally can click through the reset flow.
      // Replace with a Trigger.dev email job once an SMTP provider is live.
      console.log(`[auth] Password reset link for ${user.email}: ${url}`);
    },
  },
  // Email-verification tokens: 24h is the Better Auth default; pinned
  // explicitly so a future library default-flip is visible.
  // See docs/specs/security_posture.md §7.
  emailVerification: {
    expiresIn: 60 * 60 * 24,
  },
  session: {
    // 24-hour idle window. Combined with updateAge below, this gives
    // sliding-window idle-timeout semantics: any request within
    // updateAge bumps expiresAt by another 24h, so an active user
    // stays signed in indefinitely while an idle user is signed out
    // after 24 hours of no activity. See docs/specs/security_posture.md
    // §7. The earlier 7-day value gave a much wider idle window;
    // tightened 2026-04-25.
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60 * 24,
    // Pinned default — sessions must not be mirrored to Postgres.
    // This pin is load-bearing: flipping it back would silently
    // reintroduce session tokens to Postgres and defeat the §4 threat
    // model. See docs/specs/security_posture.md §7.
    storeSessionInDatabase: false,
    // Pinned default — sensitive ops use fresh-age.
    // See docs/specs/security_posture.md §7.
    freshAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
      // Pinned default — prevents a future library default-flip to "jwe"
      // from silently changing cookie cryptography.
      // See docs/specs/security_posture.md §7.
      strategy: "compact",
    },
    additionalFields: {
      appUserId: { type: "string", required: false },
      organizationId: { type: "string", required: false },
      role: { type: "string", required: false },
      portalType: { type: "string", required: false },
      clientSubtype: { type: "string", required: false },
    },
  },
  user: {
    additionalFields: {
      appUserId: { type: "string", required: false, input: false },
    },
  },
  // Hash password-reset / email-verification identifiers at rest.
  // See docs/specs/security_posture.md §2.
  verification: {
    storeIdentifier: "hashed",
  },
  // Encrypt OAuth tokens at rest. Inert today (no social providers
  // configured); future-proofing so the day social login is enabled,
  // encryption is already in place.
  // See docs/specs/security_posture.md §2.
  account: {
    encryptOAuthTokens: true,
  },
  databaseHooks: {
    user: {
      create: {
        // When a new Better Auth user is created, mint a matching domain
        // `users` row (or link to an existing one by email) so app-side
        // features have a stable uuid to key off.
        before: async (user) => {
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);
          let appUserId = existing[0]?.id;
          if (!appUserId) {
            const [row] = await db
              .insert(users)
              .values({
                email: user.email,
                displayName: user.name ?? user.email,
              })
              .returning({ id: users.id });
            appUserId = row.id;
          }
          return { data: { ...user, appUserId } };
        },
      },
    },
    session: {
      create: {
        // Resolve primary role + organization at session-create time so
        // every request has portal context without re-querying.
        before: async (session) => {
          const [u] = await db
            .select({ appUserId: authUser.appUserId })
            .from(authUser)
            .where(eq(authUser.id, session.userId))
            .limit(1);
          if (!u?.appUserId) return { data: session };

          const [primary] = await db
            .select()
            .from(roleAssignments)
            .where(
              and(eq(roleAssignments.userId, u.appUserId), eq(roleAssignments.isPrimary, true)),
            )
            .limit(1);

          const fallback = primary
            ? null
            : (
                await db
                  .select()
                  .from(roleAssignments)
                  .where(eq(roleAssignments.userId, u.appUserId))
                  .limit(1)
              )[0];

          const r = primary ?? fallback;

          // Org-level sign-in enforcement — cheap reads here because
          // session.create fires once per login, not per request.
          // 1. Require-2FA org-wide: block login if org demands it and
          //    the user hasn't enrolled.
          // 2. Session-timeout: shorten expiresAt to createdAt + orgMinutes
          //    when org has configured a stricter cap. Better Auth handles
          //    the expiry check on every subsequent getSession.
          let effectiveExpiresAt = session.expiresAt;
          if (r?.organizationId) {
            const [org] = await db
              .select({
                requireTwoFactorOrg: organizations.requireTwoFactorOrg,
                sessionTimeoutMinutes: organizations.sessionTimeoutMinutes,
              })
              .from(organizations)
              .where(eq(organizations.id, r.organizationId))
              .limit(1);

            if (org?.requireTwoFactorOrg) {
              const [authRow] = await db
                .select({ twoFactorEnabled: authUser.twoFactorEnabled })
                .from(authUser)
                .where(eq(authUser.id, session.userId))
                .limit(1);
              if (!authRow?.twoFactorEnabled) {
                throw new Error(
                  "TWO_FACTOR_REQUIRED: Your organization requires two-factor authentication. Enable it on your account before signing in.",
                );
              }
            }

            if (org?.sessionTimeoutMinutes) {
              const orgCap = new Date(
                Date.now() + org.sessionTimeoutMinutes * 60 * 1000,
              );
              if (orgCap < effectiveExpiresAt) {
                effectiveExpiresAt = orgCap;
              }
            }
          }

          return {
            data: {
              ...session,
              expiresAt: effectiveExpiresAt,
              appUserId: u.appUserId,
              organizationId: r?.organizationId ?? null,
              role: r?.roleKey ?? null,
              portalType: r?.portalType ?? null,
              clientSubtype: r?.clientSubtype ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "BuiltCRM",
    }),
    ssoPlugin(),
    nextCookies(),
  ],
});

export type Auth = typeof auth;

export function resolvePortalPath(session: {
  portalType: string | null;
  clientSubtype: string | null;
}): string {
  if (session.portalType === "contractor") return "/contractor";
  if (session.portalType === "subcontractor") return "/subcontractor";
  if (session.portalType === "client") {
    return session.clientSubtype === "residential"
      ? "/residential"
      : "/commercial";
  }
  return "/no-portal";
}
