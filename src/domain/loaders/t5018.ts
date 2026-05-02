import { and, desc, eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, organizations, t5018Filings } from "@/db/schema";
import {
  aggregateT5018ForFiscalYear,
  type T5018SubAggregateRow,
} from "@/lib/integrations/cra-t5018/aggregate";
import { decryptBusinessNumberOrNull } from "@/lib/integrations/crypto";

// Step 67 — T5018 admin loader. Returns everything the server-rendered
// page needs to draw the workspace + history + audit drawer.

export type T5018ReporterView = {
  legalName: string;
  businessNumber: string | null;
  craReceiverCode: string | null;
  taxJurisdiction: "CA" | "US" | "OTHER" | null;
  addr1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  filingContactName: string | null;
  filingContactEmail: string | null;
};

export type T5018FilingHistoryRow = {
  id: string;
  fiscalYear: number;
  status: "generated" | "filed";
  generatedAt: Date;
  generatedByName: string | null;
  slipCount: number;
  totalAmountCents: number;
  xmlChecksum: string;
  filedAt: Date | null;
  filedByName: string | null;
  craConfirmationCode: string | null;
};

export type T5018AuditEvent = {
  action: string;
  actorName: string | null;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
};

export type T5018WorkspaceView = {
  reporter: T5018ReporterView;
  fiscalYear: number;
  // Tier-classified status of the in-flight fiscal year vs. an existing
  // filed/generated row.
  yearStatus: "draft" | "ready" | "generated" | "filed";
  // Aggregation for the current fiscal year (current means: the one the
  // page is currently focused on, NOT necessarily the calendar year).
  aggregate: {
    rows: T5018SubAggregateRow[];
    eligibleCount: number;
    belowCount: number;
    missingDataCount: number;
    totalEligibleCents: number;
  };
  // Existing filing for `fiscalYear`, if one exists.
  currentFiling: T5018FilingHistoryRow | null;
  filingHistory: T5018FilingHistoryRow[];
  recentAuditEvents: T5018AuditEvent[];
};

const HISTORY_LIMIT = 20;
const AUDIT_LIMIT = 30;

async function loadFilingHistory(
  contractorOrgId: string,
): Promise<T5018FilingHistoryRow[]> {
  const filings = await dbAdmin
    .select({
      id: t5018Filings.id,
      fiscalYear: t5018Filings.fiscalYear,
      status: t5018Filings.status,
      generatedAt: t5018Filings.generatedAt,
      generatedByUserId: t5018Filings.generatedByUserId,
      slipCount: t5018Filings.slipCount,
      totalAmountCents: t5018Filings.totalAmountCents,
      xmlChecksum: t5018Filings.xmlChecksum,
      filedAt: t5018Filings.filedAt,
      filedByUserId: t5018Filings.filedByUserId,
      craConfirmationCode: t5018Filings.craConfirmationCode,
    })
    .from(t5018Filings)
    .where(eq(t5018Filings.contractorOrgId, contractorOrgId))
    .orderBy(desc(t5018Filings.fiscalYear))
    .limit(HISTORY_LIMIT);

  if (filings.length === 0) return [];

  // Resolve user names for the generated_by / filed_by columns in one
  // pass.
  const userIds = Array.from(
    new Set(
      filings.flatMap((f) =>
        [f.generatedByUserId, f.filedByUserId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
  );
  let userNameById = new Map<string, string>();
  if (userIds.length > 0) {
    // We deliberately don't import users here to keep the import shape
    // tight; the loader is read-only and doesn't need the full users
    // table. Using audit_events lookups would also work but is overkill.
    const { users } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    const userRows = await dbAdmin
      .select({
        id: users.id,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, userIds));
    userNameById = new Map(
      userRows.map((u) => [
        u.id,
        u.displayName ??
          [u.firstName, u.lastName].filter(Boolean).join(" ") ??
          u.email,
      ]),
    );
  }

  return filings.map((f) => ({
    id: f.id,
    fiscalYear: f.fiscalYear,
    status: f.status,
    generatedAt: f.generatedAt,
    generatedByName: userNameById.get(f.generatedByUserId) ?? null,
    slipCount: f.slipCount,
    totalAmountCents: f.totalAmountCents,
    xmlChecksum: f.xmlChecksum,
    filedAt: f.filedAt,
    filedByName: f.filedByUserId
      ? (userNameById.get(f.filedByUserId) ?? null)
      : null,
    craConfirmationCode: f.craConfirmationCode,
  }));
}

async function loadRecentAuditEvents(
  contractorOrgId: string,
): Promise<T5018AuditEvent[]> {
  const { like, or } = await import("drizzle-orm");
  const { users } = await import("@/db/schema");
  const rows = await dbAdmin
    .select({
      action: auditEvents.actionName,
      createdAt: auditEvents.createdAt,
      metadata: auditEvents.metadataJson,
      actorDisplayName: users.displayName,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
      actorEmail: users.email,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(
      and(
        eq(auditEvents.organizationId, contractorOrgId),
        or(
          like(auditEvents.actionName, "tax.t5018.%"),
          eq(auditEvents.actionName, "tax.t5018.generated"),
        ),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(AUDIT_LIMIT);
  return rows.map((r) => ({
    action: r.action,
    actorName:
      r.actorDisplayName ??
      [r.actorFirstName, r.actorLastName].filter(Boolean).join(" ") ??
      r.actorEmail,
    createdAt: r.createdAt,
    metadata: (r.metadata ?? null) as Record<string, unknown> | null,
  }));
}

export async function loadT5018WorkspaceView(input: {
  contractorOrgId: string;
  fiscalYear: number;
}): Promise<T5018WorkspaceView> {
  const orgRows = await dbAdmin
    .select({
      id: organizations.id,
      name: organizations.name,
      legalName: organizations.legalName,
      businessNumberEncrypted: organizations.businessNumber,
      craReceiverCode: organizations.craReceiverCode,
      taxJurisdiction: organizations.taxJurisdiction,
      addr1: organizations.addr1,
      city: organizations.city,
      stateRegion: organizations.stateRegion,
      postalCode: organizations.postalCode,
      country: organizations.country,
      primaryContactName: organizations.primaryContactName,
      primaryContactEmail: organizations.primaryContactEmail,
    })
    .from(organizations)
    .where(eq(organizations.id, input.contractorOrgId))
    .limit(1);

  if (orgRows.length === 0) {
    throw new Error(`Contractor org ${input.contractorOrgId} not found`);
  }
  const org = orgRows[0];
  const reporter: T5018ReporterView = {
    legalName: org.legalName ?? org.name,
    businessNumber: decryptBusinessNumberOrNull(org.businessNumberEncrypted),
    craReceiverCode: org.craReceiverCode,
    taxJurisdiction: org.taxJurisdiction,
    addr1: org.addr1,
    city: org.city,
    province: org.stateRegion,
    postalCode: org.postalCode,
    country: org.country,
    filingContactName: org.primaryContactName,
    filingContactEmail: org.primaryContactEmail,
  };

  // Aggregation runs for the page's selected fiscal year regardless of
  // jurisdiction. The page itself renders an "enable jurisdiction"
  // banner if it's not 'CA'.
  const aggregate = await aggregateT5018ForFiscalYear({
    contractorOrgId: input.contractorOrgId,
    fiscalYear: input.fiscalYear,
  });

  const filingHistory = await loadFilingHistory(input.contractorOrgId);
  const currentFiling =
    filingHistory.find((f) => f.fiscalYear === input.fiscalYear) ?? null;

  let yearStatus: T5018WorkspaceView["yearStatus"] = "draft";
  if (currentFiling?.status === "filed") yearStatus = "filed";
  else if (currentFiling?.status === "generated") yearStatus = "generated";
  else if (aggregate.eligibleCount > 0) yearStatus = "ready";

  const recentAuditEvents = await loadRecentAuditEvents(input.contractorOrgId);

  return {
    reporter,
    fiscalYear: input.fiscalYear,
    yearStatus,
    aggregate: {
      rows: aggregate.rows,
      eligibleCount: aggregate.eligibleCount,
      belowCount: aggregate.belowCount,
      missingDataCount: aggregate.missingDataCount,
      totalEligibleCents: aggregate.totalEligibleCents,
    },
    currentFiling,
    filingHistory,
    recentAuditEvents,
  };
}
