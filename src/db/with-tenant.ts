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

const ORG_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidOrgId(orgId: string): void {
  if (!ORG_ID_PATTERN.test(orgId)) {
    // GUCs accept arbitrary strings; a malformed orgId would silently
    // be set as the tenant context and fail later in a subtle way.
    // Validate at the entry point so the failure is loud and local.
    throw new Error(
      `withTenant: orgId is not a UUID (got: ${JSON.stringify(orgId)})`,
    );
  }
}

export async function withTenant<T>(
  orgId: string,
  fn: TxCallback<T>,
): Promise<T> {
  assertValidOrgId(orgId);
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
