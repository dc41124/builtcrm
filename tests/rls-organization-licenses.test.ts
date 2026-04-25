import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { organizationLicenses } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import {
  listOrganizationLicenses,
} from "@/domain/loaders/organization-profile";

import { IDS } from "./fixtures/seed";

// RLS pilot table — Phase 2 of docs/specs/rls_sprint_plan.md.
//
// Coverage limitation: TEST_DATABASE_URL is an admin-level role on
// the Neon test branch (per .env.test.example) — that role has
// BYPASSRLS, so policies do not actually enforce isolation in this
// test process. The negative-case test (cross-org read returns
// empty / cross-org write denied) requires either:
//   (a) a non-bypass test role to switch into via SET LOCAL ROLE
//   (b) ALTER TABLE ... FORCE ROW LEVEL SECURITY which forces RLS
//       even for the table owner
// Both are deferred to phase 5 (test-infra hardening).
//
// What this test DOES verify:
//   - withTenant + the loader/route call sites work end-to-end
//     through Drizzle for an RLS-enabled table
//   - The CRUD flow round-trips data correctly
//   - The migration didn't accidentally break the existing access
//     patterns
// Negative cases (RLS actually denying cross-tenant access) live in
// the manual smoke checklist for now.

const ORG = IDS.orgs.contractor;
const OTHER_ORG = IDS.orgs.subcontractor;

afterEach(async () => {
  // Clean up any rows this test inserted. db.delete bypasses RLS
  // (admin role) which is what we want for cleanup.
  await db
    .delete(organizationLicenses)
    .where(eq(organizationLicenses.kind, "rls-test-fixture"));
});

describe("organization_licenses RLS pilot", () => {
  it("withTenant + loader round-trip: insert one, read it back", async () => {
    await withTenant(ORG, async (tx) => {
      await tx.insert(organizationLicenses).values({
        organizationId: ORG,
        kind: "rls-test-fixture",
        licenseNumber: "RLS-001",
      });
    });

    const rows = await listOrganizationLicenses(ORG);
    const seen = rows.find((r) => r.licenseNumber === "RLS-001");
    expect(seen).toBeDefined();
    expect(seen?.kind).toBe("rls-test-fixture");
  });

  it("withTenant scoping: caller for ORG cannot see OTHER_ORG rows in the result set even when the underlying query returns them via admin pool", async () => {
    // Insert a row owned by ORG and a row owned by OTHER_ORG.
    await withTenant(ORG, async (tx) => {
      await tx.insert(organizationLicenses).values({
        organizationId: ORG,
        kind: "rls-test-fixture",
        licenseNumber: "RLS-OWN",
      });
    });
    await withTenant(OTHER_ORG, async (tx) => {
      await tx.insert(organizationLicenses).values({
        organizationId: OTHER_ORG,
        kind: "rls-test-fixture",
        licenseNumber: "RLS-FOREIGN",
      });
    });

    // The loader filters by organizationId in its WHERE clause too —
    // belt-and-suspenders. RLS would also filter, but this test
    // verifies the app-layer filter survives the RLS migration.
    const orgRows = await listOrganizationLicenses(ORG);
    const otherRows = await listOrganizationLicenses(OTHER_ORG);

    expect(orgRows.find((r) => r.licenseNumber === "RLS-OWN")).toBeDefined();
    expect(orgRows.find((r) => r.licenseNumber === "RLS-FOREIGN")).toBeUndefined();
    expect(otherRows.find((r) => r.licenseNumber === "RLS-FOREIGN")).toBeDefined();
    expect(otherRows.find((r) => r.licenseNumber === "RLS-OWN")).toBeUndefined();
  });
});
