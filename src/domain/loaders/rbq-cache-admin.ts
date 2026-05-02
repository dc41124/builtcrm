import { count, desc, eq, isNotNull, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { organizations, rbqLicenseCache } from "@/db/schema";
import type {
  RbqLicenseStatus,
  RbqSubclass,
} from "@/lib/integrations/rbq";

// Step 66 — RBQ cache admin loader.
//
// Powers the /contractor/settings/compliance/rbq-cache page. KPIs +
// per-row table of every cached lookup. Cross-org because the cache
// itself is BuiltCRM-wide; the admin sees every sub regardless of
// which contractor entered the number originally.

export type CacheRow = {
  rbqNumber: string;
  legalName: string | null;
  subclassesCount: number;
  status: RbqLicenseStatus;
  expiryDate: string | null;
  lastCheckedAt: Date;
  // Names + ids of org(s) that reference this RBQ number — typically
  // one, but a number could be shared if multiple sub orgs claim it.
  // The id is used to deep-link the row into the sub profile widget.
  associatedOrgs: Array<{ id: string; name: string }>;
  // Derived label for the UI (e.g. "Expiring soon", "License expired").
  uiState: "valid" | "expiring" | "expired" | "suspended" | "not_found";
};

export type RbqCacheAdminView = {
  totalCached: number;
  validCount: number;
  expiringCount: number;
  expiredCount: number;
  notFoundCount: number;
  suspendedCount: number;
  rows: CacheRow[];
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function deriveUiState(
  status: RbqLicenseStatus,
  expiryDate: string | null,
): CacheRow["uiState"] {
  if (status === "not_found") return "not_found";
  if (status === "expired") return "expired";
  if (status === "suspended") return "suspended";
  if (expiryDate) {
    const expiryMs = new Date(expiryDate).getTime();
    const ms = expiryMs - Date.now();
    if (ms < 0) return "expired";
    if (ms <= THIRTY_DAYS_MS) return "expiring";
  }
  return "valid";
}

export async function loadRbqCacheAdminView(): Promise<RbqCacheAdminView> {
  const rows = await dbAdmin
    .select({
      rbqNumber: rbqLicenseCache.rbqNumber,
      legalName: rbqLicenseCache.legalName,
      status: rbqLicenseCache.status,
      expiryDate: rbqLicenseCache.expiryDate,
      lastCheckedAt: rbqLicenseCache.lastCheckedAt,
      subclasses: rbqLicenseCache.subclasses,
    })
    .from(rbqLicenseCache)
    .orderBy(desc(rbqLicenseCache.lastCheckedAt));

  // Per-row org association lookup (single query — group by rbq_number).
  const orgAssoc = await dbAdmin
    .select({
      rbqNumber: organizations.rbqNumber,
      orgId: organizations.id,
      orgName: organizations.name,
    })
    .from(organizations)
    .where(isNotNull(organizations.rbqNumber));

  const orgsByNumber = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of orgAssoc) {
    if (!row.rbqNumber) continue;
    const entry = { id: row.orgId, name: row.orgName };
    const existing = orgsByNumber.get(row.rbqNumber);
    if (existing) {
      existing.push(entry);
    } else {
      orgsByNumber.set(row.rbqNumber, [entry]);
    }
  }

  const cacheRows: CacheRow[] = rows.map((r) => {
    const subclasses = (r.subclasses as RbqSubclass[] | null) ?? [];
    return {
      rbqNumber: r.rbqNumber,
      legalName: r.legalName,
      subclassesCount: subclasses.length,
      status: r.status,
      expiryDate: r.expiryDate,
      lastCheckedAt: r.lastCheckedAt,
      associatedOrgs: orgsByNumber.get(r.rbqNumber) ?? [],
      uiState: deriveUiState(r.status, r.expiryDate),
    };
  });

  // Totals from the derived state, not the raw status (so "expiring"
  // counts the rows whose expiry is within 30 days even though status
  // is still 'active').
  const totalCached = cacheRows.length;
  let validCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let notFoundCount = 0;
  let suspendedCount = 0;
  for (const r of cacheRows) {
    if (r.uiState === "valid") validCount++;
    else if (r.uiState === "expiring") expiringCount++;
    else if (r.uiState === "expired") expiredCount++;
    else if (r.uiState === "not_found") notFoundCount++;
    else if (r.uiState === "suspended") suspendedCount++;
  }

  return {
    totalCached,
    validCount,
    expiringCount,
    expiredCount,
    notFoundCount,
    suspendedCount,
    rows: cacheRows,
  };
}

// Suppress unused-import warnings for symbols kept for future SQL
// extensions (e.g. server-side filtered counts).
void count;
void eq;
void sql;
