import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  complianceRecords,
  organizations,
  projectOrganizationMemberships,
  projects,
} from "@/db/schema";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// Compliance report loader (Step 24.5 wiring).
//
// Two surfaces:
//
//   1. "Expiring in 90 days" list — flat roll-up of soon-to-expire records
//      across every subcontractor on every contractor-owned project.
//   2. Sub compliance matrix — one row per sub, columns keyed by the
//      most-common compliance types seen across that contractor's subs.
//      Columns are dynamic (not GL/WC/Auto/Bond/W-9/License enums) because
//      the schema stores compliance_type as free-form varchar; production-
//      grade would taxonomize this into a configurable catalog.
//
// Severity:
//   critical = expired OR expiring in ≤14 days OR missing document
//   warning  = expiring 15–45 days
//   ok       = expiring 46+ days or a freshly-active record
//
// Status pipeline mirrors `listSubOrgComplianceRecords` in
// subcontractor-compliance.ts so the two surfaces agree on what "current"
// means. Kept separate to avoid cross-wiring a per-org helper into a
// cross-org contractor loader.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type ComplianceSeverity = "critical" | "warning" | "ok";

export type ComplianceExpiringRow = {
  subOrganizationId: string;
  subName: string;
  complianceType: string;
  expiresAt: Date | null;
  daysUntilExpiry: number | null; // null if document is missing / rejected
  severity: ComplianceSeverity;
};

export type ComplianceCell =
  | "ok"
  | "expiring"
  | "expired"
  | "missing"
  | "n/a";

export type ComplianceMatrixRow = {
  subOrganizationId: string;
  subName: string;
  primaryTrade: string | null;
  cells: Record<string, ComplianceCell>;
};

export type ComplianceReportView = {
  expiring: ComplianceExpiringRow[];
  matrix: {
    columns: string[];
    rows: ComplianceMatrixRow[];
  };
  totals: {
    criticalCount: number;
    warningCount: number;
    subsTracked: number;
  };
  generatedAtIso: string;
};

type LoaderInput = { session: SessionLike | null | undefined };

const DAY_MS = 86_400_000;
const CRITICAL_DAYS = 14;
const WARNING_DAYS = 45;
const EXPIRING_WINDOW_DAYS = 90;
const MAX_MATRIX_COLUMNS = 8;

// ---------------------------------------------------------------
// Loader
// ---------------------------------------------------------------

export async function getComplianceReport(
  input: LoaderInput,
): Promise<ComplianceReportView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  // Project set for the contractor.
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) return emptyView(now);

  // Subs active on any of those projects. Distinct org ids.
  const subMembershipRows = await db
    .select({
      organizationId: projectOrganizationMemberships.organizationId,
      orgName: organizations.name,
      primaryTrade: organizations.primaryTrade,
    })
    .from(projectOrganizationMemberships)
    .innerJoin(
      organizations,
      eq(projectOrganizationMemberships.organizationId, organizations.id),
    )
    .where(
      and(
        inArray(projectOrganizationMemberships.projectId, projectIds),
        eq(projectOrganizationMemberships.membershipType, "subcontractor"),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    );

  const subsById = new Map<
    string,
    { id: string; name: string; primaryTrade: string | null }
  >();
  for (const m of subMembershipRows) {
    if (!subsById.has(m.organizationId)) {
      subsById.set(m.organizationId, {
        id: m.organizationId,
        name: m.orgName,
        primaryTrade: m.primaryTrade,
      });
    }
  }
  if (subsById.size === 0) return emptyView(now);

  // Pull every compliance record for those sub orgs, latest-first.
  // Dedupe in-memory to keep the latest per (orgId, complianceType).
  const recordRows = await db
    .select({
      id: complianceRecords.id,
      organizationId: complianceRecords.organizationId,
      complianceType: complianceRecords.complianceType,
      complianceStatus: complianceRecords.complianceStatus,
      expiresAt: complianceRecords.expiresAt,
      createdAt: complianceRecords.createdAt,
    })
    .from(complianceRecords)
    .where(inArray(complianceRecords.organizationId, Array.from(subsById.keys())))
    .orderBy(desc(complianceRecords.createdAt));

  const latestByOrgType = new Map<string, (typeof recordRows)[number]>();
  for (const r of recordRows) {
    const key = `${r.organizationId}::${r.complianceType}`;
    if (!latestByOrgType.has(key)) latestByOrgType.set(key, r);
  }

  // --- Expiring list (≤90d + missing) ---
  const expiring: ComplianceExpiringRow[] = [];
  for (const rec of latestByOrgType.values()) {
    const sub = subsById.get(rec.organizationId);
    if (!sub) continue;
    const cell = cellFromRecord(rec, now);
    const daysUntil =
      rec.expiresAt != null
        ? Math.floor((rec.expiresAt.getTime() - now.getTime()) / DAY_MS)
        : null;
    const severity = severityForCell(cell, daysUntil);
    // Filter: include expiring/expired/missing within 90-day window, or
    // missing records outright.
    const inWindow =
      daysUntil !== null && daysUntil <= EXPIRING_WINDOW_DAYS;
    const include = cell === "missing" || cell === "expired" || inWindow;
    if (!include) continue;
    if (cell === "ok") continue; // belt-and-suspenders: "ok" rows shouldn't leak in
    expiring.push({
      subOrganizationId: sub.id,
      subName: sub.name,
      complianceType: rec.complianceType,
      expiresAt: rec.expiresAt,
      daysUntilExpiry: daysUntil,
      severity,
    });
  }
  // Sort: most urgent first (missing → lowest daysUntilExpiry).
  expiring.sort((a, b) => {
    const severityRank: Record<ComplianceSeverity, number> = {
      critical: 0,
      warning: 1,
      ok: 2,
    };
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    const ad = a.daysUntilExpiry ?? -Infinity;
    const bd = b.daysUntilExpiry ?? -Infinity;
    return ad - bd;
  });

  // --- Matrix ---
  // Columns = top-N compliance types by prevalence across subs.
  const typeCounts = new Map<string, number>();
  for (const rec of latestByOrgType.values()) {
    typeCounts.set(
      rec.complianceType,
      (typeCounts.get(rec.complianceType) ?? 0) + 1,
    );
  }
  const columns = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_MATRIX_COLUMNS)
    .map(([type]) => type);

  const rows: ComplianceMatrixRow[] = Array.from(subsById.values()).map((sub) => {
    const cells: Record<string, ComplianceCell> = {};
    for (const col of columns) {
      const key = `${sub.id}::${col}`;
      const rec = latestByOrgType.get(key);
      cells[col] = rec ? cellFromRecord(rec, now) : "missing";
    }
    return {
      subOrganizationId: sub.id,
      subName: sub.name,
      primaryTrade: sub.primaryTrade,
      cells,
    };
  });
  rows.sort((a, b) => a.subName.localeCompare(b.subName));

  const totals = {
    criticalCount: expiring.filter((e) => e.severity === "critical").length,
    warningCount: expiring.filter((e) => e.severity === "warning").length,
    subsTracked: subsById.size,
  };

  return {
    expiring,
    matrix: { columns, rows },
    totals,
    generatedAtIso: now.toISOString(),
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function cellFromRecord(
  rec: {
    complianceStatus: string;
    expiresAt: Date | null;
  },
  now: Date,
): ComplianceCell {
  if (rec.complianceStatus === "waived") return "n/a";
  if (rec.complianceStatus === "rejected") return "expired";
  if (rec.complianceStatus === "expired") return "expired";
  if (rec.complianceStatus === "pending") return "expiring";
  // "active"
  if (!rec.expiresAt) return "ok";
  const delta = rec.expiresAt.getTime() - now.getTime();
  if (delta < 0) return "expired";
  if (delta < WARNING_DAYS * DAY_MS) return "expiring";
  return "ok";
}

function severityForCell(
  cell: ComplianceCell,
  daysUntil: number | null,
): ComplianceSeverity {
  if (cell === "missing" || cell === "expired") return "critical";
  if (cell === "ok" || cell === "n/a") return "ok";
  // "expiring"
  if (daysUntil == null) return "critical";
  if (daysUntil <= CRITICAL_DAYS) return "critical";
  if (daysUntil <= WARNING_DAYS) return "warning";
  return "ok";
}

function emptyView(now: Date): ComplianceReportView {
  return {
    expiring: [],
    matrix: { columns: [], rows: [] },
    totals: { criticalCount: 0, warningCount: 0, subsTracked: 0 },
    generatedAtIso: now.toISOString(),
  };
}
