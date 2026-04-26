import { sql } from "drizzle-orm";

import { db, type DB } from "./client";

// withTenant — chokepoint that wraps every tenant-scoped DB operation
// in a transaction whose first statement sets `app.current_org_id` via
// set_config(..., is_local := true). Future RLS policies read that
// GUC via current_setting('app.current_org_id', true)::uuid; a query
// that bypasses this helper has no setting, current_setting returns
// NULL, and the policy comparison `org_id = NULL` is falsy → row is
// denied. That's the load-bearing safety property — failure mode is
// closed.
//
// Phase 1 ships the plumbing only. No table has RLS enabled yet, so
// queries through `withTenant` and bare `db.select()` behave identically
// against the data layer. The point of phase 1 is to verify the
// SET LOCAL semantics + pool-reuse + transaction-isolation behavior
// hold before any policy goes live.
//
// See docs/specs/rls_sprint_plan.md.
//
// Usage:
//   await withTenant(ctx.organization.id, async (tx) => {
//     const rows = await tx.select().from(milestones).where(...);
//     await tx.insert(milestones).values(...);
//   });

type DrizzleTx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type TxCallback<T> = (tx: DrizzleTx) => Promise<T>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    // GUCs accept arbitrary strings; a malformed id would silently
    // be set as the tenant context and fail later in a subtle way.
    // Validate at the entry point so the failure is loud and local.
    throw new Error(
      `${label}: not a UUID (got: ${JSON.stringify(value)})`,
    );
  }
}

export async function withTenant<T>(
  orgId: string,
  fn: TxCallback<T>,
): Promise<T> {
  assertValidUuid("withTenant: orgId", orgId);
  return db.transaction(async (tx) => {
    // set_config with is_local=true is the parameterized equivalent of
    // SET LOCAL — value is scoped to the current transaction and clears
    // on COMMIT/ROLLBACK. Postgres GUC names are restricted to
    // [a-z_], so the namespace `app.current_org_id` is safe; the
    // value goes through the SQL parameter slot, not interpolation.
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
    );
    return fn(tx);
  });
}

// withTenantUser — extension of withTenant that ALSO sets
// `app.current_user_id`. Used for user-scoped tables whose policy
// gates on the recipient/owner user (notifications today; future
// candidates: user_notification_preferences, anything explicitly
// per-user rather than per-org).
//
// Policies on user-scoped tables read the GUC via
// `nullif(current_setting('app.current_user_id', true), '')::uuid`
// — the nullif handles the "no GUC set" case (returns NULL → policy
// comparison falsy → row denied). Failure mode is closed.
//
// Writes that target other users (system emissions like notification
// fan-out) must route through `dbAdmin` — the WITH CHECK clause would
// otherwise deny inserts where recipient_user_id != current GUC.
export async function withTenantUser<T>(
  orgId: string,
  userId: string,
  fn: TxCallback<T>,
): Promise<T> {
  assertValidUuid("withTenantUser: orgId", orgId);
  assertValidUuid("withTenantUser: userId", userId);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
    );
    return fn(tx);
  });
}
