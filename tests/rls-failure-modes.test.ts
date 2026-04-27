import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { IDS } from "./fixtures/seed";

// Failure-mode RLS test suite (Phase 5 close-out, RLS sprint plan §5).
//
// The main 103-test suite runs as the admin/BYPASSRLS role (see
// tests/global-setup.ts which promotes TEST_DATABASE_URL ->
// DATABASE_ADMIN_URL). Policies don't enforce on that connection, so
// negative cases — cross-tenant access denied, missing-GUC fail-closed,
// pool reuse not leaking GUC across transactions — can't be asserted
// from the main suite.
//
// This suite opens a separate connection as builtcrm_test (NOBYPASSRLS,
// provisioned by scripts/create-builtcrm-test-role.sql) via
// TEST_NONBYPASS_DATABASE_URL in .env.test. The seed fixtures from the
// main suite's globalSetup are visible because they're in the same DB;
// what differs is that policies actually fire on the queries this file
// issues.
//
// Coverage:
//   1. SELECT cross-tenant — non-owner GUC returns 0 rows (USING denies).
//   2. SELECT missing GUC — current_setting returns '', cast fails closed,
//      query throws (or returns 0 in nullif-pattern policies).
//   3. INSERT cross-tenant — WITH CHECK rejects writes targeting another org.
//   4. SET LOCAL is transaction-scoped — pool reuse can't leak GUC across
//      transactions (the load-bearing safety property §5 calls out).
//   5. nullif(..., '')::uuid pattern (notifications) fails closed cleanly
//      without a uuid-cast error when no GUC is set.

const NONBYPASS_URL = process.env.TEST_NONBYPASS_DATABASE_URL;

const ORG_A = IDS.orgs.contractor;
const ORG_B = IDS.orgs.subcontractor;
const UNRELATED = "00000000-0000-0000-0000-000000000000";

let nonBypass: ReturnType<typeof postgres>;

describe.skipIf(!NONBYPASS_URL)("RLS failure modes (non-bypass role)", () => {
  beforeAll(() => {
    if (!NONBYPASS_URL) return;
    // max:1 so postgres-js permits explicit BEGIN/COMMIT inside sql.begin.
    nonBypass = postgres(NONBYPASS_URL, { max: 1 });
  });

  afterAll(async () => {
    if (nonBypass) await nonBypass.end();
  });

  // ---- 1. SELECT cross-tenant — USING denies non-owner reads. ----------
  // Strong assertion: insert a sentinel row under ORG_A's GUC, then under
  // ORG_B's GUC verify it's invisible. Cleanup runs unconditionally.
  it("denies cross-tenant SELECT on an org-scoped table (organization_licenses)", async () => {
    const sentinel = `rls-failure-mode-${Date.now()}`;
    try {
      // Insert under ORG_A.
      await nonBypass.begin(async (tx) => {
        await tx`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
        await tx`
          INSERT INTO organization_licenses (id, organization_id, kind, license_number)
          VALUES (gen_random_uuid(), ${ORG_A}, ${sentinel}, 'X-1')
        `;
      });

      // ORG_A sees it.
      const ownerCount = await nonBypass.begin(async (tx) => {
        await tx`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
        const r = await tx`
          SELECT count(*)::int AS c FROM organization_licenses
          WHERE kind = ${sentinel}
        `;
        return r[0].c;
      });

      // ORG_B does NOT see it (this is the policy enforcement).
      const otherCount = await nonBypass.begin(async (tx) => {
        await tx`SELECT set_config('app.current_org_id', ${ORG_B}, true)`;
        const r = await tx`
          SELECT count(*)::int AS c FROM organization_licenses
          WHERE kind = ${sentinel}
        `;
        return r[0].c;
      });

      expect(ownerCount).toBe(1);
      expect(otherCount).toBe(0);
    } finally {
      // Cleanup as ORG_A so RLS allows the delete.
      await nonBypass.begin(async (tx) => {
        await tx`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
        await tx`DELETE FROM organization_licenses WHERE kind = ${sentinel}`;
      });
    }
  });

  // ---- 2. SELECT missing GUC — fails closed. -----------------------
  it("denies SELECT when no GUC is set (fail-closed cast or empty result)", async () => {
    // No set_config call. The org-scoped policies use
    //   current_setting('app.current_org_id', true)::uuid
    // which throws on empty-string cast in Postgres. This is the
    // load-bearing fail-closed property: a query that bypasses
    // withTenant has no GUC and dies loudly rather than returning
    // arbitrary rows.
    let threw = false;
    try {
      await nonBypass.begin(async (tx) => {
        // Note: NO set_config call here.
        await tx`SELECT count(*)::int AS c FROM rfis`;
      });
    } catch (err) {
      threw = true;
      // Expected error: "invalid input syntax for type uuid: """
      expect(String(err)).toMatch(/invalid input syntax for type uuid/i);
    }
    expect(threw).toBe(true);
  });

  // ---- 3. INSERT cross-tenant — WITH CHECK denies. ---------------------
  it("denies INSERT targeting a different organization (Pattern A WITH CHECK)", async () => {
    // organization_licenses is RLS-enabled (Phase 2 pilot), Pattern A:
    // organization_id = current_setting('app.current_org_id')::uuid.
    // Writing a row with organization_id != GUC must be rejected.
    let threw = false;
    try {
      await nonBypass.begin(async (tx) => {
        await tx`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
        // Try to insert a row claiming to belong to ORG_B while the
        // GUC says we're acting as ORG_A. WITH CHECK should reject.
        await tx`
          INSERT INTO organization_licenses (id, organization_id, kind, license_number)
          VALUES (gen_random_uuid(), ${ORG_B}, 'rls-failure-mode-test', 'X-1')
        `;
      });
    } catch (err) {
      threw = true;
      // Postgres reports "new row violates row-level security policy".
      expect(String(err)).toMatch(/row-level security/i);
    }
    expect(threw).toBe(true);
  });

  // ---- 4. SET LOCAL is transaction-scoped — pool reuse safety. --------
  it("does not leak GUC across transactions on the same pooled connection", async () => {
    // Run a transaction that sets GUC=ORG_A. Then run a fresh transaction
    // on the same pool — the second one must NOT see ORG_A's setting
    // even if it lands on the same physical connection. This is the
    // SET LOCAL guarantee that the whole RLS plumbing relies on.
    await nonBypass.begin(async (tx) => {
      await tx`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
      const inside = await tx`SELECT current_setting('app.current_org_id', true) AS v`;
      expect(inside[0].v).toBe(ORG_A);
    });
    // No setting in this second transaction. Postgres returns '' when a
    // GUC has never been set for this transaction; SET LOCAL from the
    // prior tx must have cleared on COMMIT.
    const after = await nonBypass.begin(async (tx) => {
      const r = await tx`SELECT current_setting('app.current_org_id', true) AS v`;
      return r[0].v;
    });
    expect(after).toBe("");
  });

  // ---- 5. nullif-pattern (notifications) fails closed without throwing. -
  it("notifications policy returns 0 rows when no user GUC is set (nullif fail-closed)", async () => {
    // The notifications policy uses
    //   recipient_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    // which collapses '' -> NULL before the uuid cast, so the comparison
    // evaluates to NULL (falsy) instead of throwing. This is the
    // user-scoped equivalent of the org fail-closed property.
    const count = await nonBypass.begin(async (tx) => {
      // No set_config for app.current_user_id.
      const r = await tx`SELECT count(*)::int AS c FROM notifications`;
      return r[0].c;
    });
    expect(count).toBe(0);
  });
});
