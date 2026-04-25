import { getContractorOrgContext } from "./integrations";
import { getSubcontractorOrgContext } from "./subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

// Resolves the org-edit context for a session. Contractor takes priority —
// if a user has both assignments (rare), they edit the contractor org;
// sub-only users go through the sub gate.
//
// Used by /api/org/profile (PATCH) and /api/org/tax-id/reveal (POST).
// Extract before the third caller appears.
export async function resolveOrgEditContext(sessionLike: {
  appUserId?: string | null;
}) {
  try {
    const ctx = await getContractorOrgContext(sessionLike);
    return {
      kind: "contractor" as const,
      orgId: ctx.organization.id,
      userId: ctx.user.id,
      isAdmin: ctx.role === "contractor_admin",
    };
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err;
    const ctx = await getSubcontractorOrgContext(sessionLike);
    return {
      kind: "subcontractor" as const,
      orgId: ctx.organization.id,
      userId: ctx.user.id,
      isAdmin: ctx.role === "subcontractor_owner",
    };
  }
}
