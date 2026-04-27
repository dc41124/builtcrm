import { describe, it, expect } from "vitest";

// Static-analysis guard: forbid bare-db Drizzle ops against RLS-enabled tables.
//
// Why: org-scoped RLS policies cast `current_setting('app.current_org_id', true)::uuid`
// directly. A bare-db read of an RLS-enabled table fires that cast with the GUC unset
// (`''`) and Postgres throws `invalid input syntax for type uuid: ""`. See
// docs/specs/security_posture.md §6 for the incident write-up.
//
// The audit script auto-discovers RLS-enabled tables from src/db/schema/*.ts
// (any pgTable that ends in `).enableRLS()`) and walks every src/ file looking
// for `.from/.insert/.update/.delete(<rlsTable>)`. For each match it traces
// the receiver — `db` is unsafe; `tx`/`dbAdmin`/parameterized helpers are OK.
//
// If this test fails, run `node scripts/rls-audit.js` for the full report,
// then either wrap the call in `withTenant(orgId, tx => ...)` or route it
// through `dbAdmin` if the call is genuinely pre-tenant (e.g. a webhook
// resolving an org from an external id before getEffectiveContext can run).

import audit from "../scripts/rls-audit.js";

describe("RLS bare-db static guard", () => {
  it("has zero bare-db Drizzle ops against RLS-enabled tables", () => {
    const r = audit();
    if (r.unsafe.length > 0) {
      const lines = r.unsafe.map(
        (f: { file: string; line: number; table: string; snippet: string }) =>
          `  ${f.file}:${f.line} [${f.table}] ${f.snippet}`,
      );
      throw new Error(
        `Found ${r.unsafe.length} bare-db call(s) on RLS-enabled tables:\n` +
          lines.join("\n") +
          "\n\nWrap each in withTenant(orgId, tx => ...) or route through dbAdmin. " +
          "Run `node scripts/rls-audit.js` for the full report.",
      );
    }
    expect(r.unsafe).toHaveLength(0);
  });

  it("discovers the expected number of RLS-enabled tables", () => {
    // Sentinel: if the schema gains/loses RLS coverage, this fires so the
    // audit-tracking docs in security_posture.md §6 stay in sync.
    const r = audit();
    expect(r.rlsTables.length).toBeGreaterThanOrEqual(85);
  });
});
