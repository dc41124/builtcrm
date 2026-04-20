import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { savedReports, users } from "@/db/schema";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// Saved Reports loader (Step 24.5 wiring).
//
// One row per saved report for the contractor's organization. Recipients are
// stored as a jsonb array of email strings; kept as strings end-to-end since
// the rows only ever read the full list (fan-out is small). Schedule fields
// are presentation-ready: `scheduleLabel` for the library list, full cron +
// timezone live on the table for the delivery job to consume later.
//
// Owner display name comes from the users join — saved reports persist past
// a user's departure (ON DELETE RESTRICT on owner FK) so the owner always
// resolves to a real name.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type SavedReportRow = {
  id: string;
  name: string;
  reportType: string;
  scopeDescription: string | null;
  scheduleLabel: string | null;
  recipients: string[];
  lastRunAt: Date | null;
  ownerUserId: string;
  ownerName: string;
  createdAt: Date;
};

export type SavedReportsView = {
  rows: SavedReportRow[];
  totals: {
    total: number;
    scheduledCount: number;
    uniqueRecipients: number;
  };
  generatedAtIso: string;
};

type LoaderInput = { session: SessionLike | null | undefined };

export async function getSavedReports(
  input: LoaderInput,
): Promise<SavedReportsView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  const rows = await db
    .select({
      id: savedReports.id,
      name: savedReports.name,
      reportType: savedReports.reportType,
      scopeDescription: savedReports.scopeDescription,
      scheduleCron: savedReports.scheduleCron,
      scheduleLabel: savedReports.scheduleLabel,
      recipients: savedReports.recipients,
      lastRunAt: savedReports.lastRunAt,
      ownerUserId: savedReports.ownerUserId,
      ownerDisplayName: users.displayName,
      ownerEmail: users.email,
      createdAt: savedReports.createdAt,
    })
    .from(savedReports)
    .innerJoin(users, eq(savedReports.ownerUserId, users.id))
    .where(eq(savedReports.organizationId, orgId))
    .orderBy(desc(savedReports.createdAt));

  const normalized: SavedReportRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    reportType: r.reportType,
    scopeDescription: r.scopeDescription,
    // scheduleLabel is optional; if schedule is set but no label was
    // persisted, fall back to the cron expression so the row still renders
    // something intelligible.
    scheduleLabel: r.scheduleLabel ?? r.scheduleCron ?? null,
    recipients: normalizeRecipients(r.recipients),
    lastRunAt: r.lastRunAt,
    ownerUserId: r.ownerUserId,
    ownerName: r.ownerDisplayName ?? r.ownerEmail,
    createdAt: r.createdAt,
  }));

  const uniqueRecipientSet = new Set<string>();
  let scheduledCount = 0;
  for (const r of normalized) {
    if (r.scheduleLabel) scheduledCount += 1;
    for (const email of r.recipients) uniqueRecipientSet.add(email);
  }

  return {
    rows: normalized,
    totals: {
      total: normalized.length,
      scheduledCount,
      uniqueRecipients: uniqueRecipientSet.size,
    },
    generatedAtIso: now.toISOString(),
  };
}

// Defensive read: the column is jsonb + DEFAULT '[]'::jsonb + NOT NULL, but
// type narrowing doesn't know that. Filter to strings so the UI never sees
// a malformed row.
function normalizeRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
