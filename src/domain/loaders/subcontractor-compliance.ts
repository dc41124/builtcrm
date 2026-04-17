import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  complianceRecords,
  documents,
  organizations,
  roleAssignments,
  users,
} from "@/db/schema";

import { AuthorizationError } from "../permissions";
import type { SessionLike } from "../context";

// Sub org auth context. Mirrors getContractorOrgContext but scoped to
// portalType=subcontractor and with a simpler role split (owner vs member).
export type SubcontractorOrgContext = {
  user: { id: string; email: string; displayName: string | null };
  organization: { id: string; name: string };
  role: "subcontractor_owner" | "subcontractor_user";
};

export async function getSubcontractorOrgContext(
  session: SessionLike | null | undefined,
): Promise<SubcontractorOrgContext> {
  if (!session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const appUserId = session.appUserId;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  if (!user || !user.isActive) {
    throw new AuthorizationError("User not found or inactive", "unauthenticated");
  }

  const [assignment] = await db
    .select({
      organizationId: roleAssignments.organizationId,
      roleKey: roleAssignments.roleKey,
      organizationName: organizations.name,
    })
    .from(roleAssignments)
    .innerJoin(organizations, eq(organizations.id, roleAssignments.organizationId))
    .where(
      and(
        eq(roleAssignments.userId, appUserId),
        eq(roleAssignments.portalType, "subcontractor"),
      ),
    )
    .limit(1);
  if (!assignment) {
    throw new AuthorizationError(
      "No subcontractor organization for this user",
      "forbidden",
    );
  }

  const role: SubcontractorOrgContext["role"] = /owner|admin/i.test(assignment.roleKey)
    ? "subcontractor_owner"
    : "subcontractor_user";

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    organization: {
      id: assignment.organizationId,
      name: assignment.organizationName,
    },
    role,
  };
}

// Compliance-snapshot view for the sub settings page. Latest record per
// compliance_type for the given org. Returns a structured row the UI can
// render directly — status → pill tone, a derived detail string when the
// linked document has a storage key, etc.

export type SubComplianceStatus =
  | "current"
  | "expiring"
  | "expired"
  | "missing"
  | "na";

export type SubComplianceRow = {
  id: string;
  complianceType: string;
  status: SubComplianceStatus;
  expiresAt: Date | null;
  expiresLabel: string;
  documentFilename: string | null;
  documentId: string | null;
  projectId: string | null;
  // Free-form metadata from metadata_json. Keys expected by the sub settings
  // compliance snapshot: `carrier`, `coverage`, `detail`. Unknown values stay
  // on the row so future presentation layers can read them without a loader
  // change.
  carrier: string | null;
  coverage: string | null;
  detail: string | null;
};

// Map the DB-level complianceStatusEnum ("pending"/"approved"/"rejected"/"expired")
// plus expiry-window logic into the five visual statuses the UI consumes.
function derivePresentStatus(
  dbStatus: string,
  expiresAt: Date | null,
  nowMs: number,
): SubComplianceStatus {
  if (dbStatus === "rejected") return "expired"; // treat rejected docs as expired visually
  if (dbStatus === "pending") return "expiring"; // needs attention
  if (!expiresAt) return dbStatus === "approved" ? "current" : "na";
  const delta = expiresAt.getTime() - nowMs;
  if (delta < 0) return "expired";
  if (delta < 45 * 24 * 60 * 60 * 1000) return "expiring"; // 45-day soon-window
  return "current";
}

function formatExpires(expiresAt: Date | null): string {
  if (!expiresAt) return "—";
  return expiresAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function listSubOrgComplianceRecords(
  organizationId: string,
  opts: { nowMs?: number } = {},
): Promise<SubComplianceRow[]> {
  const nowMs = opts.nowMs ?? Date.now();

  // Pull the latest record per compliance_type. We sort by createdAt desc and
  // dedupe in-memory — over a small org-scoped set this is cheaper than a
  // DISTINCT ON + window function.
  const rows = await db
    .select({
      id: complianceRecords.id,
      complianceType: complianceRecords.complianceType,
      complianceStatus: complianceRecords.complianceStatus,
      expiresAt: complianceRecords.expiresAt,
      createdAt: complianceRecords.createdAt,
      documentId: complianceRecords.documentId,
      projectId: complianceRecords.projectId,
      documentFilename: documents.title,
      metadataJson: complianceRecords.metadataJson,
    })
    .from(complianceRecords)
    .leftJoin(documents, eq(documents.id, complianceRecords.documentId))
    .where(eq(complianceRecords.organizationId, organizationId))
    .orderBy(desc(complianceRecords.createdAt));

  const seen = new Set<string>();
  const result: SubComplianceRow[] = [];
  for (const r of rows) {
    if (seen.has(r.complianceType)) continue;
    seen.add(r.complianceType);
    const meta = (r.metadataJson ?? null) as Record<string, unknown> | null;
    const carrier = typeof meta?.carrier === "string" ? meta.carrier : null;
    const coverage = typeof meta?.coverage === "string" ? meta.coverage : null;
    const detail = typeof meta?.detail === "string" ? meta.detail : null;
    result.push({
      id: r.id,
      complianceType: r.complianceType,
      status: derivePresentStatus(r.complianceStatus, r.expiresAt, nowMs),
      expiresAt: r.expiresAt,
      expiresLabel: formatExpires(r.expiresAt),
      documentFilename: r.documentFilename,
      documentId: r.documentId,
      projectId: r.projectId,
      carrier,
      coverage,
      detail,
    });
  }

  return result;
}
