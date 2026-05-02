// Step 65 Session B — public-DSAR org resolver.
//
// Public POST has no session, so the requester does not pick an org.
// Resolution order:
//   1. PLATFORM_DEFAULT_ORG_ID env var (explicit override).
//   2. The single contractor org with a designated Privacy Officer.
//   3. None — caller returns 503 (we cannot route the request).
//
// Documented in privacy_compliance_boundary.md and
// security_posture.md §6 (dsarRequests row in the un-RLS'd table).

import { eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { organizations, privacyOfficers } from "@/db/schema";

export type DsarRoutingResult =
  | { ok: true; organizationId: string }
  | { ok: false; reason: "no_designated_officer" | "ambiguous" };

export async function resolvePublicDsarOrg(): Promise<DsarRoutingResult> {
  const explicit = process.env.PLATFORM_DEFAULT_ORG_ID?.trim();
  if (explicit) {
    return { ok: true, organizationId: explicit };
  }

  const rows = await dbAdmin
    .select({
      organizationId: privacyOfficers.organizationId,
      organizationType: organizations.organizationType,
    })
    .from(privacyOfficers)
    .innerJoin(organizations, eq(organizations.id, privacyOfficers.organizationId))
    .where(eq(organizations.organizationType, "contractor"))
    .limit(2);

  if (rows.length === 0) return { ok: false, reason: "no_designated_officer" };
  if (rows.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, organizationId: rows[0].organizationId };
}
