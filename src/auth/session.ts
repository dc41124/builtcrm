import { headers } from "next/headers";

import { AuthorizationError } from "@/domain/permissions";

import { auth } from "./config";

// Typed wrapper around Better Auth's `auth.api.getSession()` for server-side
// callers (API routes, loaders, server components). Two reasons this exists:
//
// 1. Type safety: Better Auth's getSession return type does not surface the
//    `additionalFields` we configured in `session.additionalFields`
//    (appUserId, organizationId, role, portalType, clientSubtype) — those
//    fields exist at runtime but TypeScript can't see them. Without this
//    helper, every caller does `session.session as unknown as { appUserId?: ... }`,
//    defeating the type system at the most security-critical boundary.
//
// 2. Boilerplate: every authenticated route had the same 4 lines:
//      const session = await auth.api.getSession({ headers: await headers() });
//      if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
//    `requireServerSession()` collapses this to one call that throws
//    AuthorizationError, which `withErrorHandler` already maps to a 401.

type RawSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

// The runtime shape of session.session — Better Auth's standard fields
// plus the additionalFields configured in src/auth/config.ts. Keep this
// type in lock-step with the `session.additionalFields` block in config.ts;
// adding a field there without updating here means callers won't see it.
export type AppSessionRow = RawSession["session"] & {
  appUserId: string | null;
  organizationId: string | null;
  role: string | null;
  portalType: string | null;
  clientSubtype: string | null;
};

export type AppSession = {
  session: AppSessionRow;
  user: RawSession["user"];
};

export async function getServerSession(): Promise<AppSession | null> {
  const raw = await auth.api.getSession({ headers: await headers() });
  return raw as AppSession | null;
}

export async function requireServerSession(): Promise<AppSession> {
  const s = await getServerSession();
  if (!s) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  return s;
}
