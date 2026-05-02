// Step 66.5 — Retention tier metadata and `retention_until` formulas.
//
// The retention-sweep job, the per-row write paths, and the admin UI all
// read from this file. Changing a tier's floor here changes it everywhere.
//
// Floors are non-overridable for statutory tiers (CRA, ON/QC construction
// records) and for `contract_signature_audit`. Operational tier is the
// only tier with an org-configurable shorter retention; the floor (30 days)
// is enforced server-side.

import type { RetentionTier } from "@/db/schema/_shared";

export type TierMode =
  | "static" // retention_until known at insert (e.g., signed_at + 10y)
  | "closeout" // retention_until populated when project.closed_at fires
  | "activity" // retention_until = last_activity_at + N days, refreshed on touch
  | "expiry" // retention_until = expires_at + 7 days (auth tokens)
  | "manual" // retention_until set when row reaches a terminal state (privacy)
  | "forever"; // retention_until is always null

export interface TierMeta {
  tier: RetentionTier;
  label: string;
  floorDescription: string;
  mode: TierMode;
  // Days from the trigger event to retention_until. Null for `forever` and
  // for tiers whose duration depends on per-row business state.
  defaultDays: number | null;
  // Operational tier only: minimum allowed when an org shortens retention.
  minimumDays?: number;
  configurable: boolean;
  rationale: string;
}

export const TIER_META: Record<RetentionTier, TierMeta> = {
  statutory_tax: {
    tier: "statutory_tax",
    label: "Statutory tax",
    floorDescription: "6 years from end of tax year",
    mode: "static",
    // 7 years from created_at covers "6 years from end of tax year" in
    // every fiscal-year edge case. Computed at insert.
    defaultDays: 365 * 7,
    configurable: false,
    rationale:
      "CRA s.230 requires payers to keep payment/tax-slip source records " +
      "for 6 years after the end of the tax year the record covers. " +
      "Computed as created_at + 7 years to safely cover the calendar-year boundary.",
  },
  statutory_construction: {
    tier: "statutory_construction",
    label: "Statutory construction",
    floorDescription: "7 years from project closeout (ON/QC); 6 years elsewhere",
    mode: "closeout",
    defaultDays: 365 * 7,
    configurable: false,
    rationale:
      "Provincial construction record retention. ON Construction Act and " +
      "QC Civil Code limitation periods both reach to 6+ years after final " +
      "project close. 7 years is the conservative floor used here.",
  },
  project_record: {
    tier: "project_record",
    label: "Project record",
    floorDescription: "2 years post-closeout",
    mode: "closeout",
    defaultDays: 365 * 2,
    configurable: true, // org can extend, not shorten
    rationale:
      "Day-to-day project records (RFIs, submittals, daily logs, punch, " +
      "transmittals, meetings, weekly reports). 2 years post-closeout is " +
      "the practical floor for warranty/handover support.",
  },
  operational: {
    tier: "operational",
    label: "Operational",
    floorDescription: "90 days from last activity (org-configurable, 30-day floor)",
    mode: "activity",
    defaultDays: 90,
    minimumDays: 30,
    configurable: true,
    rationale:
      "Transient/conversational data (messages, notifications, activity " +
      "feed, sync events). PIPEDA/Law 25 minimization argues for short " +
      "retention. Floor is 30 days; default 90 lets feeds settle.",
  },
  auth_ephemeral: {
    tier: "auth_ephemeral",
    label: "Auth ephemeral",
    floorDescription: "Token expiry + 7 days",
    mode: "expiry",
    defaultDays: 7,
    configurable: false,
    rationale:
      "Sessions, refresh tokens, magic links, password resets, invitation " +
      "tokens. Hard-deleted 7 days after their natural expiry to give a " +
      "small audit window without hoarding credential rows.",
  },
  design_archive: {
    tier: "design_archive",
    label: "Design archive",
    floorDescription: "Retained indefinitely",
    mode: "forever",
    defaultDays: null,
    configurable: false,
    rationale:
      "BIM/IFC files, drawings, sheets, markups, measurements, photo " +
      "pins. As-built design provenance is required for liability defense " +
      "indefinitely; never auto-deleted.",
  },
  privacy_fulfillment: {
    tier: "privacy_fulfillment",
    label: "Privacy fulfillment",
    floorDescription:
      "DSAR: 30d post-fulfillment. Breach: 7y. Consent: forever (current state); rolled-up history annually.",
    mode: "manual",
    defaultDays: null, // varies per row type — set at terminal state
    configurable: false,
    rationale:
      "Law 25 / PIPEDA fulfillment artifacts. Per-table retention triggers " +
      "live in the loader/action that transitions the row to its terminal " +
      "state; the sweep job only enforces what those triggers wrote.",
  },
  contract_signature_audit: {
    tier: "contract_signature_audit",
    label: "Contract signature audit",
    floorDescription: "10 years from signature",
    mode: "static",
    defaultDays: 365 * 10,
    configurable: false,
    rationale:
      "E-signature audit rows (canvas blob, IP, UA, content hash, timestamp). " +
      "10 years exceeds every Canadian provincial limitation period for " +
      "contract disputes. Required for non-repudiation defense.",
  },
};

// One day in ms — exported for the sweep job's batch math.
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Compute retention_until at insert time for static-mode tiers. Returns
// null for tiers whose retention_until is set later (closeout, manual, etc.).
export function computeStaticRetentionUntil(
  tier: RetentionTier,
  insertedAt: Date,
): Date | null {
  const meta = TIER_META[tier];
  if (meta.mode !== "static" || meta.defaultDays === null) return null;
  return new Date(insertedAt.getTime() + meta.defaultDays * ONE_DAY_MS);
}

// Compute retention_until for closeout-tier rows when a project transitions
// to closed. Returns null for rows whose tier is not closeout-driven.
export function computeCloseoutRetentionUntil(
  tier: RetentionTier,
  closedAt: Date,
): Date | null {
  const meta = TIER_META[tier];
  if (meta.mode !== "closeout" || meta.defaultDays === null) return null;
  return new Date(closedAt.getTime() + meta.defaultDays * ONE_DAY_MS);
}

// Compute retention_until for activity-tier rows. Org override is clamped
// to the minimum floor.
export function computeActivityRetentionUntil(
  tier: RetentionTier,
  lastActivityAt: Date,
  orgOverrideDays?: number,
): Date | null {
  const meta = TIER_META[tier];
  if (meta.mode !== "activity" || meta.defaultDays === null) return null;
  const floor = meta.minimumDays ?? meta.defaultDays;
  const days = orgOverrideDays !== undefined
    ? Math.max(orgOverrideDays, floor)
    : meta.defaultDays;
  return new Date(lastActivityAt.getTime() + days * ONE_DAY_MS);
}

// Compute retention_until for auth_ephemeral rows from their natural expiry.
export function computeEphemeralRetentionUntil(
  tier: RetentionTier,
  expiresAt: Date,
): Date | null {
  const meta = TIER_META[tier];
  if (meta.mode !== "expiry" || meta.defaultDays === null) return null;
  return new Date(expiresAt.getTime() + meta.defaultDays * ONE_DAY_MS);
}
