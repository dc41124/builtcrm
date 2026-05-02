import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  organizations,
  projectOrganizationMemberships,
  projects,
  rbqLicenseCache,
} from "@/db/schema";
import type { RbqSubclass } from "@/lib/integrations/rbq";

// Step 66 — Project compliance scorecard loader (View 03 of the
// prototype). Returns one row per non-contractor org on the project
// (subs + clients), with their RBQ status pulled from the cache.
//
// CNESST + CCQ status columns are placeholders today — those modules
// haven't shipped. The shape leaves room to populate them once they do.

type Tone = "valid" | "expiring" | "expired" | "suspended" | "not_found" | "muted";

export type ScorecardRow = {
  orgId: string;
  orgName: string;
  legalName: string | null;
  primaryTrade: string | null;
  rbqNumber: string | null;
  rbqState: Tone;
  rbqExpiry: string | null;
  // Compliance signals — placeholder values until those modules ship.
  insuranceState: Tone;
  cnesstState: Tone;
  ccqState: Tone;
};

export type ProjectRbqScorecardView = {
  project: {
    id: string;
    name: string;
    city: string | null;
    provinceCode: string | null;
  };
  // True only when province_code = 'QC'. The page renders a "hidden"
  // banner when false.
  isQuebecProject: boolean;
  rows: ScorecardRow[];
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function rbqUiState(
  rbqNumber: string | null,
  cacheRow:
    | {
        status: "active" | "expired" | "suspended" | "not_found";
        expiryDate: string | null;
      }
    | null,
): Tone {
  if (!rbqNumber) return "muted";
  if (!cacheRow) return "muted";
  if (cacheRow.status === "not_found") return "not_found";
  if (cacheRow.status === "expired") return "expired";
  if (cacheRow.status === "suspended") return "suspended";
  if (cacheRow.expiryDate) {
    const ms = new Date(cacheRow.expiryDate).getTime() - Date.now();
    if (ms < 0) return "expired";
    if (ms <= THIRTY_DAYS_MS) return "expiring";
  }
  return "valid";
}

export async function loadProjectRbqScorecardView(
  projectId: string,
  contractorOrgId: string,
): Promise<ProjectRbqScorecardView | null> {
  const projectRows = await dbAdmin
    .select({
      id: projects.id,
      name: projects.name,
      city: projects.city,
      provinceCode: projects.provinceCode,
      contractorOrgId: projects.contractorOrganizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (projectRows.length === 0) return null;
  const project = projectRows[0];
  if (project.contractorOrgId !== contractorOrgId) return null;

  // Every non-contractor org membership on this project. Subs + clients
  // both render in the scorecard so the contractor sees the full
  // compliance posture for the project at a glance.
  const memberships = await dbAdmin
    .select({
      organizationId: projectOrganizationMemberships.organizationId,
    })
    .from(projectOrganizationMemberships)
    .where(
      and(
        eq(projectOrganizationMemberships.projectId, projectId),
        ne(projectOrganizationMemberships.organizationId, contractorOrgId),
      ),
    );

  const orgIds = memberships.map((m) => m.organizationId);
  if (orgIds.length === 0) {
    return {
      project: {
        id: project.id,
        name: project.name,
        city: project.city,
        provinceCode: project.provinceCode,
      },
      isQuebecProject: project.provinceCode === "QC",
      rows: [],
    };
  }

  const orgRows = await dbAdmin
    .select({
      id: organizations.id,
      name: organizations.name,
      legalName: organizations.legalName,
      primaryTrade: organizations.primaryTrade,
      rbqNumber: organizations.rbqNumber,
    })
    .from(organizations)
    .where(inArray(organizations.id, orgIds));

  const rbqNumbers = Array.from(
    new Set(
      orgRows
        .map((o) => o.rbqNumber)
        .filter((n): n is string => typeof n === "string" && n.length > 0),
    ),
  );

  const cacheByNumber = new Map<
    string,
    { status: "active" | "expired" | "suspended" | "not_found"; expiryDate: string | null; subclasses: RbqSubclass[] }
  >();
  if (rbqNumbers.length > 0) {
    const cacheHits = await dbAdmin
      .select({
        rbqNumber: rbqLicenseCache.rbqNumber,
        status: rbqLicenseCache.status,
        expiryDate: rbqLicenseCache.expiryDate,
        subclasses: rbqLicenseCache.subclasses,
      })
      .from(rbqLicenseCache)
      .where(inArray(rbqLicenseCache.rbqNumber, rbqNumbers));
    for (const hit of cacheHits) {
      cacheByNumber.set(hit.rbqNumber, {
        status: hit.status,
        expiryDate: hit.expiryDate,
        subclasses: (hit.subclasses as RbqSubclass[] | null) ?? [],
      });
    }
  }

  const rows: ScorecardRow[] = orgRows.map((o) => {
    const cache = o.rbqNumber ? cacheByNumber.get(o.rbqNumber) ?? null : null;
    return {
      orgId: o.id,
      orgName: o.name,
      legalName: o.legalName,
      primaryTrade: o.primaryTrade,
      rbqNumber: o.rbqNumber,
      rbqState: rbqUiState(o.rbqNumber, cache),
      rbqExpiry: cache?.expiryDate ?? null,
      // CNESST + CCQ are placeholder until those modules ship. Insurance
      // is also a placeholder today; the existing compliance_records
      // table is record-centric and would require a per-org rollup the
      // current loader doesn't provide. Wire up in a follow-up step.
      insuranceState: "muted",
      cnesstState: "muted",
      ccqState: "muted",
    };
  });

  // Sort: problem states first (expired, not_found, suspended, expiring),
  // then valid, then muted.
  const order: Record<Tone, number> = {
    expired: 0,
    not_found: 1,
    suspended: 2,
    expiring: 3,
    valid: 4,
    muted: 5,
  };
  rows.sort((a, b) => order[a.rbqState] - order[b.rbqState]);

  return {
    project: {
      id: project.id,
      name: project.name,
      city: project.city,
      provinceCode: project.provinceCode,
    },
    isQuebecProject: project.provinceCode === "QC",
    rows,
  };
}

void isNotNull;
