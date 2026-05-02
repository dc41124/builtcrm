import { eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { rbqLicenseCache } from "@/db/schema";

// Step 66 — RBQ (Régie du bâtiment du Québec) license lookup.
//
// Public registry data from donneesquebec.ca, hydrated nightly via the
// `rbq-cache-refresh` Trigger.dev job. App reads always come from the
// cache — there is no live fetch on the request path. Force-refresh
// from the admin UI re-probes a single number against the most recent
// snapshot via `forceRefreshSingle()`.
//
// PRODUCTION NOTE: the real CSV download URL on donneesquebec.ca and
// its column schema have not been wired up yet. Today the fetcher is a
// no-op stub that returns the existing cache row unchanged, and the
// nightly job is a no-op that just emits a `run_complete` audit event.
// To finish the production hookup:
//   1. Confirm the dataset slug at
//      https://www.donneesquebec.ca/recherche/dataset/?q=RBQ
//   2. Implement `downloadRbqOpenDataDiff()` to fetch + parse the CSV
//      and yield a stream of `{ rbqNumber, legalName, status, ... }`
//      records.
//   3. Have `rbq-cache-refresh.ts` upsert each record with
//      `lastCheckedAt = now()` and `sourceVersion` set to the dataset
//      version label (typically embedded in the CSV header or filename).
// Tracked in docs/specs/prod_cutover_prep.md.

export type RbqLicenseStatus = "active" | "expired" | "suspended" | "not_found";

export interface RbqSubclass {
  code: string;
  label: string;
}

export interface RbqLookupResult {
  rbqNumber: string;
  legalName: string | null;
  status: RbqLicenseStatus;
  issuedAt: string | null;
  expiryDate: string | null;
  subclasses: RbqSubclass[];
  lastCheckedAt: Date;
  sourceVersion: string | null;
  // Number of days from today until expiry. Negative = already expired.
  // null when there is no expiry on file (typically `not_found`).
  daysToExpiry: number | null;
  // Convenience flag — `expiryDate` is in the future but within 30 days.
  expiringSoon: boolean;
}

// Validate RBQ number shape: ####-####-## (12 chars including dashes).
// Used at write-time on the org profile mutation. Format reference:
// https://www.rbq.gouv.qc.ca/citoyen/le-permis-rbq.html
const RBQ_FORMAT = /^\d{4}-\d{4}-\d{2}$/;

export function isValidRbqFormat(input: string): boolean {
  return RBQ_FORMAT.test(input);
}

// Lightweight helper for the input field — accepts loose user input
// ("5641903201" or "5641 9032 01") and normalizes to canonical
// "5641-9032-01" form. Returns null if 10 digits cannot be extracted.
export function normalizeRbqNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

function computeDerived(row: typeof rbqLicenseCache.$inferSelect) {
  let daysToExpiry: number | null = null;
  let expiringSoon = false;
  if (row.expiryDate) {
    const expiryMs = new Date(row.expiryDate).getTime();
    daysToExpiry = Math.floor((expiryMs - Date.now()) / (24 * 60 * 60 * 1000));
    expiringSoon = daysToExpiry > 0 && daysToExpiry <= 30;
  }
  return { daysToExpiry, expiringSoon };
}

function rowToResult(
  row: typeof rbqLicenseCache.$inferSelect,
): RbqLookupResult {
  const { daysToExpiry, expiringSoon } = computeDerived(row);
  return {
    rbqNumber: row.rbqNumber,
    legalName: row.legalName,
    status: row.status,
    issuedAt: row.issuedAt,
    expiryDate: row.expiryDate,
    subclasses: (row.subclasses as RbqSubclass[] | null) ?? [],
    lastCheckedAt: row.lastCheckedAt,
    sourceVersion: row.sourceVersion,
    daysToExpiry,
    expiringSoon,
  };
}

// Read the cache for a single RBQ number. Returns null when nothing has
// been probed yet for this number (caller should typically follow up
// with `forceRefreshSingle()` to insert a `not_found` placeholder).
export async function lookupRbqLicense(
  rbqNumber: string,
): Promise<RbqLookupResult | null> {
  const rows = await dbAdmin
    .select()
    .from(rbqLicenseCache)
    .where(eq(rbqLicenseCache.rbqNumber, rbqNumber))
    .limit(1);
  if (rows.length === 0) return null;
  return rowToResult(rows[0]);
}

// Batch read for the cache admin / project compliance views.
export async function lookupRbqLicensesBatch(
  rbqNumbers: string[],
): Promise<Map<string, RbqLookupResult>> {
  if (rbqNumbers.length === 0) return new Map();
  const rows = await dbAdmin.select().from(rbqLicenseCache);
  const wanted = new Set(rbqNumbers);
  const map = new Map<string, RbqLookupResult>();
  for (const row of rows) {
    if (wanted.has(row.rbqNumber)) {
      map.set(row.rbqNumber, rowToResult(row));
    }
  }
  return map;
}

// Force-refresh a single RBQ number. Today this is a stub that
// upserts a placeholder cache row so the UI has something to render.
// Production hookup will replace the body with a real registry probe.
export async function forceRefreshSingle(
  rbqNumber: string,
): Promise<RbqLookupResult> {
  const stubRecord = stubFetcher(rbqNumber);
  const now = new Date();
  await dbAdmin
    .insert(rbqLicenseCache)
    .values({
      rbqNumber,
      legalName: stubRecord.legalName,
      status: stubRecord.status,
      issuedAt: stubRecord.issuedAt,
      expiryDate: stubRecord.expiryDate,
      subclasses: stubRecord.subclasses,
      lastCheckedAt: now,
      sourceVersion: stubRecord.sourceVersion,
    })
    .onConflictDoUpdate({
      target: rbqLicenseCache.rbqNumber,
      set: {
        legalName: stubRecord.legalName,
        status: stubRecord.status,
        issuedAt: stubRecord.issuedAt,
        expiryDate: stubRecord.expiryDate,
        subclasses: stubRecord.subclasses,
        lastCheckedAt: now,
        sourceVersion: stubRecord.sourceVersion,
      },
    });
  const result = await lookupRbqLicense(rbqNumber);
  if (!result) {
    throw new Error(`RBQ refresh upsert succeeded but row not found: ${rbqNumber}`);
  }
  return result;
}

// Stub fetcher that pretends to hit donneesquebec.ca. Determinist —
// the same RBQ number always returns the same shape so dev/demo data
// is stable across reloads.
//
// Determinism rule:
//   - "0000-0000-00" → not_found
//   - first digit 1 → expired
//   - first digit 2 → expiring (<30 days)
//   - first digit 3 → suspended
//   - else → active with a far-out expiry
function stubFetcher(rbqNumber: string): {
  legalName: string | null;
  status: RbqLicenseStatus;
  issuedAt: string | null;
  expiryDate: string | null;
  subclasses: RbqSubclass[];
  sourceVersion: string;
} {
  const sourceVersion = `RBQ Open Data ${new Date().toISOString().slice(0, 10)} (stub)`;

  if (rbqNumber === "0000-0000-00") {
    return {
      legalName: null,
      status: "not_found",
      issuedAt: null,
      expiryDate: null,
      subclasses: [],
      sourceVersion,
    };
  }

  const firstDigit = rbqNumber.charAt(0);
  const today = new Date();
  const expired = new Date(today);
  expired.setDate(expired.getDate() - 76);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 21);
  const farOut = new Date(today.getFullYear() + 1, today.getMonth() + 4, 17);
  const issued = new Date(today.getFullYear() - 7, 3, 14);

  const baseSubclasses: RbqSubclass[] = [
    { code: "1.2", label: "Building shell contractor" },
    { code: "4.1", label: "Concrete foundation contractor" },
    { code: "4.2", label: "Concrete formwork contractor" },
    { code: "5.1", label: "Carpentry & framing contractor" },
  ];

  if (firstDigit === "1") {
    return {
      legalName: stubLegalName(rbqNumber),
      status: "expired",
      issuedAt: issued.toISOString().slice(0, 10),
      expiryDate: expired.toISOString().slice(0, 10),
      subclasses: baseSubclasses.slice(0, 2),
      sourceVersion,
    };
  }
  if (firstDigit === "2") {
    return {
      legalName: stubLegalName(rbqNumber),
      status: "active",
      issuedAt: issued.toISOString().slice(0, 10),
      expiryDate: soon.toISOString().slice(0, 10),
      subclasses: baseSubclasses,
      sourceVersion,
    };
  }
  if (firstDigit === "3") {
    return {
      legalName: stubLegalName(rbqNumber),
      status: "suspended",
      issuedAt: issued.toISOString().slice(0, 10),
      expiryDate: farOut.toISOString().slice(0, 10),
      subclasses: baseSubclasses.slice(0, 1),
      sourceVersion,
    };
  }

  return {
    legalName: stubLegalName(rbqNumber),
    status: "active",
    issuedAt: issued.toISOString().slice(0, 10),
    expiryDate: farOut.toISOString().slice(0, 10),
    subclasses: baseSubclasses,
    sourceVersion,
  };
}

function stubLegalName(rbqNumber: string): string {
  const seeds = [
    "Construction Bétonneau Inc.",
    "Couvreurs Falardeau & Frères",
    "Plomberie Lavallée 2018 Inc.",
    "Électricité Boisclair Ltée",
    "Excavation Tremblay-Hudon",
    "Vitres Côté Inc.",
    "Charpenterie Beauregard",
    "Mécanique du Bâtiment Pelletier",
    "Peinture Industrielle Bisson",
    "Isolation Beaudry & Associés",
  ];
  const idx = parseInt(rbqNumber.replace(/\D/g, ""), 10) % seeds.length;
  return seeds[idx];
}
