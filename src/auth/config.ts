import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
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
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Dev stub: no email infrastructure is wired up yet (see Phase 1 build
      // notes — Postmark/SendGrid integration is catalog-only). Log the link
      // so a developer running locally can click through the reset flow.
      // Replace with a Trigger.dev email job once an SMTP provider is live.
      console.log(`[auth] Password reset link for ${user.email}: ${url}`);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
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
          return {
            data: {
              ...session,
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
  plugins: [nextCookies()],
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
