import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";

// Phase 1 RLS plumbing tests. No policies enabled yet — these verify
// the SET LOCAL plumbing behaves correctly so that when phase 2 turns
// the first policy on, the safety properties are already proven.
//
// See docs/specs/rls_sprint_plan.md §5 for the failure-mode catalog.

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";

// drizzle-orm's `db.execute` and `tx.execute` share a structural shape
// for our purposes — accept both via a permissive signature.
type Executor = {
  execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
};

async function readContext(client: Executor): Promise<string | null> {
  const result = (await client.execute(
    sql`SELECT current_setting('app.current_org_id', true) as v`,
  )) as unknown as { rows?: Array<{ v: string | null }> } | Array<{ v: string | null }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  // Postgres returns "" when set_config has never been called on this
  // connection in any session; normalize to null.
  const v = rows[0]?.v;
  return v ? v : null;
}

describe("withTenant plumbing", () => {
  it("sets app.current_org_id inside the transaction", async () => {
    let inside: string | null = null;
    await withTenant(ORG_A, async (tx) => {
      inside = await readContext(tx);
    });
    expect(inside).toBe(ORG_A);
  });

  it("clears the GUC when the transaction commits", async () => {
    await withTenant(ORG_A, async (tx) => {
      const inside = await readContext(tx);
      expect(inside).toBe(ORG_A);
    });
    // After commit, a fresh bare query on the same pool must not see
    // the leftover setting. The pool may or may not reuse the same
    // physical connection; either way, current_setting on a new
    // top-level statement should be null because SET LOCAL is
    // transaction-scoped.
    const after = await readContext(db);
    expect(after).toBeNull();
  });

  it("isolates concurrent transactions", async () => {
    // Two withTenant calls in flight at the same time. Each sees its
    // own org context, never the other's — even if postgres-js routes
    // them to the same physical connection (which it generally won't,
    // but the test catches the regression if pool reuse semantics
    // ever change).
    const seen: Array<string | null> = [];
    await Promise.all([
      withTenant(ORG_A, async (tx) => {
        seen.push(await readContext(tx));
      }),
      withTenant(ORG_B, async (tx) => {
        seen.push(await readContext(tx));
      }),
    ]);
    expect(seen.sort()).toEqual([ORG_A, ORG_B]);
  });

  it("clears the GUC even on rollback", async () => {
    await expect(
      withTenant(ORG_A, async (tx) => {
        await readContext(tx);
        throw new Error("intentional rollback");
      }),
    ).rejects.toThrow("intentional rollback");
    const after = await readContext(db);
    expect(after).toBeNull();
  });

  it("rejects malformed orgId before issuing any SQL", async () => {
    await expect(
      withTenant("not-a-uuid; DROP TABLE users; --", async () => "ok"),
    ).rejects.toThrow(/not a UUID/);
  });
});
