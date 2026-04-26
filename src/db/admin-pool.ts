import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Runtime BYPASSRLS pool. Used by pre-tenant entry points and
// background-job sweeps — anything that legitimately needs to read or
// write rows without an `app.current_org_id` GUC set.
//
// Two legitimate use cases (everything else MUST go through `withTenant`):
//
//   1. **Pre-tenant entry points** — auth callbacks, webhook handlers,
//      and token-resolved routes that look up a row by an external ID
//      to discover which org the request belongs to (SAML providerId,
//      Stripe subscription ID, invitation token). These run before any
//      session/tenant context exists.
//
//   2. **Cross-org sweeps** — Trigger.dev background jobs that purge
//      expired rows or reconcile state across every org (e.g.
//      data-export-cleanup). The runtime pool would silently return
//      empty under RLS; the admin pool sees the truth.
//
// Distinct from `src/db/admin-client.ts` (`adminDb`), which is the
// CLI-tooling pool used by `npm run db:seed` and similar scripts. That
// file is not imported by the Next.js server. This one is.
//
// REQUIRES DATABASE_ADMIN_URL — no fallback to DATABASE_URL because
// in production DATABASE_URL connects as `builtcrm_app` (NOBYPASSRLS),
// so a silent fallback would let RLS fire on lookups that need to span
// tenants — breaking SSO sign-in, webhook handling, and job sweeps.
//
// Pool sized for the auth-chokepoint hot path: every authenticated
// request resolves the tenant via `getEffectiveContext` /
// `getOrgContext` / portal-specific resolvers, all of which now run
// through this pool because the tables they query
// (`role_assignments`, `project_user_memberships`,
// `project_organization_memberships`, `users`, `organizations`,
// `projects`) are read pre-tenant. `max: 20` is the same order of
// magnitude as the runtime pool — bumped from the original `max: 5`
// when the auth chokepoint shifted onto this pool.
//
// See docs/specs/rls_sprint_plan.md §3.3 / §3.4.

const adminUrl = process.env.DATABASE_ADMIN_URL;

if (!adminUrl) {
  throw new Error(
    "DATABASE_ADMIN_URL is not set. Required for SSO callbacks, Stripe webhooks, and background-job sweeps. See .env.example.",
  );
}

const adminClient = postgres(adminUrl, { max: 20, prepare: false });

export const dbAdmin = drizzle(adminClient, { schema });
export type DbAdmin = typeof dbAdmin;
