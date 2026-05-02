import { and, eq, gte, inArray, lt } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  drawRequests,
  lienWaivers,
  organizations,
  projects,
} from "@/db/schema";
import { decryptBusinessNumberOrNull } from "@/lib/integrations/crypto";

// Step 67 — Aggregate sub payments for a contractor's fiscal year.
//
// Walks: lien_waivers (status submitted/accepted) → draw_requests
// (paid_at non-null AND inside fiscal year) → projects (contractor_org_id
// = our org) → group by sub org_id → sum amount_cents.
//
// Why lien_waivers? In BuiltCRM the sub recipient + the per-draw amount
// the contractor actually paid them lives on the lien_waivers row (one
// per sub per draw). draw_requests itself has only the project + the
// G702 totals; it doesn't carry recipient identity. Mirrors the per-
// project aggregation already used by `loadFinancialView` in
// src/domain/loaders/financial.ts.
//
// CRA $500 CAD threshold filter is applied AFTER summing — a sub paid
// $400 across two draws is still excluded.
//
// Output is the input shape the XML / PDF / ZIP generators consume.

const CRA_THRESHOLD_CENTS = 50_000; // $500.00 CAD

// Lien-waiver statuses that count as "paid" for T5018 reporting. We
// include `submitted` because by the time a sub has signed and submitted
// a waiver the corresponding draw payment has gone out the door — CRA's
// "paid" definition is cash-basis. `requested` rows aren't yet a payment.
const COUNTING_LIEN_STATUSES = ["submitted", "accepted"] as const;

export interface T5018SubAggregateRow {
  subOrgId: string;
  legalName: string;
  // Decrypted at aggregation time so the caller can populate slip
  // snapshots without re-encrypting/re-decrypting later. Null when the
  // sub has no BN on file (the row is flagged as a blocker by the
  // generation flow — UI shows it under "missing data").
  businessNumber: string | null;
  // Single-line mailing address derived from organizations.addr1 + city
  // + stateRegion + postalCode + country. Snapshotted onto the slip at
  // generation time so future edits don't retroactively alter the slip.
  mailingAddress: string | null;
  totalAmountCents: number;
  // Number of distinct lien-waiver rows that contributed to the total.
  // The prototype labels this "Payments" — close enough for the UI; a
  // single draw can produce multiple waiver rows (final + partial), but
  // CRA only cares about the dollar total.
  paymentCount: number;
  status: "eligible" | "below_threshold" | "missing_data";
}

export interface T5018AggregationResult {
  fiscalYear: number;
  rows: T5018SubAggregateRow[];
  // Counts split by status for the UI's KPI tiles.
  eligibleCount: number;
  belowCount: number;
  missingDataCount: number;
  totalEligibleCents: number;
}

export async function aggregateT5018ForFiscalYear(input: {
  contractorOrgId: string;
  fiscalYear: number;
}): Promise<T5018AggregationResult> {
  const yearStart = new Date(Date.UTC(input.fiscalYear, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(input.fiscalYear + 1, 0, 1, 0, 0, 0));

  // First pass: project ids the contractor owns. We bound the join here
  // so we never read lien_waivers from projects this contractor isn't on.
  const ownedProjectIds = await dbAdmin
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, input.contractorOrgId));

  if (ownedProjectIds.length === 0) {
    return {
      fiscalYear: input.fiscalYear,
      rows: [],
      eligibleCount: 0,
      belowCount: 0,
      missingDataCount: 0,
      totalEligibleCents: 0,
    };
  }
  const projectIdList = ownedProjectIds.map((p) => p.id);

  // Second pass: read every qualifying lien-waiver row joined to the
  // draw, filtered to the fiscal year by draw_requests.paid_at, and
  // count + sum in JS. Volume is small (subs × draws per year, low
  // hundreds at the high end), so a single query + in-memory rollup is
  // simpler than fighting drizzle's COUNT() / GROUP BY type inference.
  const allWaivers = await dbAdmin
    .select({
      subOrgId: lienWaivers.organizationId,
      amountCents: lienWaivers.amountCents,
    })
    .from(lienWaivers)
    .innerJoin(drawRequests, eq(drawRequests.id, lienWaivers.drawRequestId))
    .where(
      and(
        inArray(lienWaivers.projectId, projectIdList),
        inArray(lienWaivers.lienWaiverStatus, [...COUNTING_LIEN_STATUSES]),
        gte(drawRequests.paidAt, yearStart),
        lt(drawRequests.paidAt, yearEnd),
      ),
    );

  const counts = new Map<string, number>();
  const sums = new Map<string, number>();
  for (const w of allWaivers) {
    counts.set(w.subOrgId, (counts.get(w.subOrgId) ?? 0) + 1);
    sums.set(w.subOrgId, (sums.get(w.subOrgId) ?? 0) + w.amountCents);
  }

  // Resolve sub-org identity rows for everyone in the aggregate.
  const subOrgIds = Array.from(counts.keys());
  if (subOrgIds.length === 0) {
    return {
      fiscalYear: input.fiscalYear,
      rows: [],
      eligibleCount: 0,
      belowCount: 0,
      missingDataCount: 0,
      totalEligibleCents: 0,
    };
  }

  const orgRows = await dbAdmin
    .select({
      id: organizations.id,
      legalName: organizations.legalName,
      name: organizations.name,
      businessNumberEncrypted: organizations.businessNumber,
      addr1: organizations.addr1,
      city: organizations.city,
      stateRegion: organizations.stateRegion,
      postalCode: organizations.postalCode,
      country: organizations.country,
    })
    .from(organizations)
    .where(inArray(organizations.id, subOrgIds));

  const rows: T5018SubAggregateRow[] = orgRows.map((org) => {
    const totalCents = sums.get(org.id) ?? 0;
    const paymentCount = counts.get(org.id) ?? 0;
    const businessNumber = decryptBusinessNumberOrNull(
      org.businessNumberEncrypted,
    );
    const status: T5018SubAggregateRow["status"] =
      totalCents <= CRA_THRESHOLD_CENTS
        ? "below_threshold"
        : !businessNumber
          ? "missing_data"
          : "eligible";
    const addressParts = [
      org.addr1,
      org.city && org.stateRegion
        ? `${org.city}, ${org.stateRegion}`
        : (org.city ?? org.stateRegion),
      org.postalCode,
      org.country && org.country !== "Canada" ? org.country : null,
    ].filter((p): p is string => Boolean(p && p.length > 0));
    const mailingAddress =
      addressParts.length > 0 ? addressParts.join(" · ") : null;
    return {
      subOrgId: org.id,
      legalName: org.legalName ?? org.name,
      businessNumber,
      mailingAddress,
      totalAmountCents: totalCents,
      paymentCount,
      status,
    };
  });

  // Sort by total desc — the UI mirrors the prototype's default sort.
  rows.sort((a, b) => b.totalAmountCents - a.totalAmountCents);

  let eligibleCount = 0;
  let belowCount = 0;
  let missingDataCount = 0;
  let totalEligibleCents = 0;
  for (const row of rows) {
    if (row.status === "eligible") {
      eligibleCount++;
      totalEligibleCents += row.totalAmountCents;
    } else if (row.status === "below_threshold") {
      belowCount++;
    } else {
      missingDataCount++;
    }
  }

  return {
    fiscalYear: input.fiscalYear,
    rows,
    eligibleCount,
    belowCount,
    missingDataCount,
    totalEligibleCents,
  };
}
