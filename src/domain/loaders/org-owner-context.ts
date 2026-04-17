import { AuthorizationError } from "../permissions";
import type { SessionLike } from "../context";

import { getContractorOrgContext } from "./integrations";
import { getSubcontractorOrgContext } from "./subcontractor-compliance";
import {
  getCommercialClientOrgContext,
  getResidentialClientOrgContext,
} from "./client-context";

// Unified org-admin gate for org-settings API routes. Tries each portal in a
// fixed order (contractor → sub → commercial → residential) and returns the
// first context where the caller has an owner/admin role.
//
// Returning a normalized shape lets every route write `if (!ctx.isAdmin)`
// instead of juggling per-portal role checks, and the `portal` field makes
// audit-event metadata possible without an extra DB hit.

export type OrgOwnerContext = {
  portal: "contractor" | "subcontractor" | "commercial" | "residential";
  orgId: string;
  orgName: string;
  userId: string;
  userEmail: string;
  isAdmin: boolean;
};

type Candidate = {
  portal: OrgOwnerContext["portal"];
  run: (session: SessionLike | null | undefined) => Promise<{
    user: { id: string; email: string };
    organization: { id: string; name: string };
    isAdmin: boolean;
  }>;
};

const CANDIDATES: Candidate[] = [
  {
    portal: "contractor",
    run: async (session) => {
      const ctx = await getContractorOrgContext(session);
      return {
        user: { id: ctx.user.id, email: ctx.user.email },
        organization: ctx.organization,
        isAdmin: ctx.role === "contractor_admin",
      };
    },
  },
  {
    portal: "subcontractor",
    run: async (session) => {
      const ctx = await getSubcontractorOrgContext(session);
      return {
        user: { id: ctx.user.id, email: ctx.user.email },
        organization: ctx.organization,
        isAdmin: ctx.role === "subcontractor_owner",
      };
    },
  },
  {
    portal: "commercial",
    run: async (session) => {
      const ctx = await getCommercialClientOrgContext(session);
      return {
        user: { id: ctx.user.id, email: ctx.user.email },
        organization: ctx.organization,
        isAdmin: ctx.role === "owner",
      };
    },
  },
  {
    portal: "residential",
    run: async (session) => {
      const ctx = await getResidentialClientOrgContext(session);
      return {
        user: { id: ctx.user.id, email: ctx.user.email },
        organization: ctx.organization,
        isAdmin: ctx.role === "owner",
      };
    },
  },
];

// Resolve the caller's org context, trying every portal. Throws
// AuthorizationError("forbidden") if the user isn't assigned to any portal;
// throws AuthorizationError("unauthenticated") if no session.
export async function resolveOrgOwnerContext(
  session: SessionLike | null | undefined,
): Promise<OrgOwnerContext> {
  let lastAuthError: AuthorizationError | null = null;
  for (const c of CANDIDATES) {
    try {
      const r = await c.run(session);
      return {
        portal: c.portal,
        orgId: r.organization.id,
        orgName: r.organization.name,
        userId: r.user.id,
        userEmail: r.user.email,
        isAdmin: r.isAdmin,
      };
    } catch (err) {
      if (err instanceof AuthorizationError) {
        // "unauthenticated" is fatal — no session means no further candidates
        // will succeed either.
        if (err.code === "unauthenticated") throw err;
        lastAuthError = err;
        continue;
      }
      throw err;
    }
  }
  throw (
    lastAuthError ??
    new AuthorizationError("No org assignment for this user", "forbidden")
  );
}

// Admin-only variant: resolves the context and throws forbidden if the user
// doesn't have owner/admin rights. Shorthand for routes that always require
// admin (member mutations, invitations, profile PATCH, etc.).
export async function requireOrgAdminContext(
  session: SessionLike | null | undefined,
): Promise<OrgOwnerContext> {
  const ctx = await resolveOrgOwnerContext(session);
  if (!ctx.isAdmin) {
    throw new AuthorizationError(
      "Owner or admin role required",
      "forbidden",
    );
  }
  return ctx;
}
