import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  auditEvents,
  costCodes,
  documentLinks,
  documents,
  organizations,
  projects,
  purchaseOrderLines,
  purchaseOrders,
  users,
  vendors,
  poStatusEnum,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import { computePoTotals } from "@/domain/procurement/totals";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";
import { getContractorOrgContext } from "./integrations";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type PoStatus = (typeof poStatusEnum.enumValues)[number];

export type PoLineRow = {
  id: string;
  sortOrder: number;
  description: string;
  quantity: string;
  unit: string;
  unitCostCents: number;
  receivedQuantity: string;
  lineTotalCents: number;
};

export type PoListRow = {
  id: string;
  poNumber: string;
  status: PoStatus;
  orderedAt: Date | null;
  expectedDeliveryAt: Date | null;
  vendorId: string;
  vendorName: string;
  costCodeId: string | null;
  costCodeLabel: string | null;
  lineCount: number;
  linesReceivedLabel: string;
  subtotalCents: number;
  taxAmountCents: number;
  totalCents: number;
  revisionNumber: number;
};

export type PoDocumentRow = {
  id: string;
  title: string;
  category: string;
  fileSizeBytes: number | null;
  isSuperseded: boolean;
  createdAt: Date;
};

export type PoActivityEntry = {
  id: string;
  action: string;
  actorDisplayName: string | null;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
};

export type PoDetailView = {
  id: string;
  poNumber: string;
  status: PoStatus;
  vendorId: string;
  vendorName: string;
  vendorContactName: string | null;
  vendorContactEmail: string | null;
  paymentTerms: string | null;
  projectId: string;
  projectName: string;
  costCodeId: string | null;
  costCodeLabel: string | null;
  taxRatePercent: string;
  orderedAt: Date | null;
  orderedByDisplayName: string | null;
  expectedDeliveryAt: Date | null;
  notes: string | null;
  revisionNumber: number;
  lastRevisedAt: Date | null;
  lines: PoLineRow[];
  subtotalCents: number;
  taxAmountCents: number;
  totalCents: number;
  documents: PoDocumentRow[];
  activity: PoActivityEntry[];
};

export type VendorRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  paymentTerms: string | null;
  rating: "preferred" | "standard";
  notes: string | null;
  active: boolean;
  activePoCount: number;
  spendYtdCents: number;
};

export type CostCodeRow = {
  id: string;
  code: string;
  description: string;
  active: boolean;
  sortOrder: number;
  poCount: number;
};

export type ProcurementKpis = {
  openPoCount: number;
  committedCents: number;
  awaitingInvoiceCount: number;
  spentYtdCents: number;
  closedYtdCount: number;
};

// Client-safe. `context` is intentionally omitted — `EffectiveContext`
// carries the `permissions.can()` function from domain/permissions, and
// Next.js refuses to serialize functions across the server→client
// boundary. Pages pass projectId separately to the workspace.
export type ProcurementProjectView = {
  projectId: string;
  projectName: string;
  defaultTaxRatePercent: string;
  kpis: ProcurementKpis;
  purchaseOrders: PoListRow[];
  activePo: PoDetailView | null;
  vendors: VendorRow[];
  costCodes: CostCodeRow[];
};

export type VendorsPortfolioView = {
  vendors: VendorRow[];
  summary: {
    totalVendors: number;
    preferredCount: number;
    activePoCount: number;
    spendYtdCents: number;
    topVendorId: string | null;
  };
};

export type CostCodesPortfolioView = {
  costCodes: CostCodeRow[];
  defaultTaxRatePercent: string;
};

// Subset of PO fields aggregated into the Reports page tile (Step 24.5).
export type ProcurementReportView = {
  openPoCount: number;
  committedCents: number;
  awaitingInvoiceCount: number;
  closedYtdCount: number;
  spendYtdCents: number;
  byVendor: Array<{
    vendorId: string;
    vendorName: string;
    openCount: number;
    committedCents: number;
    spendYtdCents: number;
  }>;
  byStatus: Array<{ status: PoStatus; count: number }>;
  byAging: Array<{ bucket: "0_7" | "8_14" | "15_30" | "30_plus"; count: number }>;
};

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

const OPEN_STATUSES: PoStatus[] = [
  "issued",
  "revised",
  "partially_received",
];
const COMMITTED_STATUSES: PoStatus[] = [
  "issued",
  "revised",
  "partially_received",
  "fully_received",
];
const AWAITING_INVOICE_STATUSES: PoStatus[] = ["fully_received"];
const SPENT_STATUSES: PoStatus[] = ["invoiced", "closed"];

function assertContractor(ctx: EffectiveContext): void {
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Only contractors can view procurement",
      "forbidden",
    );
  }
}

function buildCostCodeLabel(
  code: string | null,
  description: string | null,
): string | null {
  if (!code && !description) return null;
  if (!code) return description;
  if (!description) return code;
  return `${code} ${description}`;
}

// Loads lines for a set of PO ids. Returns rows keyed by poId plus the
// computed line total (compute-on-read — no stored aggregate). orgId
// scopes the call into withTenant — purchase_order_lines is RLS'd
// nested-via-parent.
async function loadLinesForPos(
  poIds: string[],
  orgId: string,
): Promise<Map<string, PoLineRow[]>> {
  if (poIds.length === 0) return new Map();
  const rows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: purchaseOrderLines.id,
        purchaseOrderId: purchaseOrderLines.purchaseOrderId,
        sortOrder: purchaseOrderLines.sortOrder,
        description: purchaseOrderLines.description,
        quantity: purchaseOrderLines.quantity,
        unit: purchaseOrderLines.unit,
        unitCostCents: purchaseOrderLines.unitCostCents,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
      })
      .from(purchaseOrderLines)
      .where(inArray(purchaseOrderLines.purchaseOrderId, poIds))
      .orderBy(
        asc(purchaseOrderLines.purchaseOrderId),
        asc(purchaseOrderLines.sortOrder),
      ),
  );

  const grouped = new Map<string, PoLineRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.purchaseOrderId) ?? [];
    const totals = computePoTotals({
      lines: [{ quantity: r.quantity, unitCostCents: r.unitCostCents }],
      taxRatePercent: 0,
    });
    list.push({
      id: r.id,
      sortOrder: r.sortOrder,
      description: r.description,
      quantity: r.quantity,
      unit: r.unit,
      unitCostCents: r.unitCostCents,
      receivedQuantity: r.receivedQuantity,
      lineTotalCents: totals.subtotalCents,
    });
    grouped.set(r.purchaseOrderId, list);
  }
  return grouped;
}

function buildLinesReceivedLabel(lines: PoLineRow[]): string {
  if (lines.length === 0) return "—";
  let allReceived = 0;
  for (const l of lines) {
    const qty = parseFloat(l.quantity);
    const recv = parseFloat(l.receivedQuantity);
    if (recv >= qty && qty > 0) allReceived++;
  }
  return `${allReceived} of ${lines.length}`;
}

// -----------------------------------------------------------------------------
// Project-scoped loader (powers the procurement page)
// -----------------------------------------------------------------------------

type ProjectInput = {
  session: SessionLike | null | undefined;
  projectId: string;
  activePoId?: string;
};

export async function getProcurementProjectView(
  input: ProjectInput,
): Promise<ProcurementProjectView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  assertContractor(ctx);

  const orgId = ctx.organization.id;

  const [orgRow] = await db
    .select({ defaultTaxRatePercent: organizations.defaultTaxRatePercent })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  // ---- PO rows for this project ----
  const poRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        orderedAt: purchaseOrders.orderedAt,
        expectedDeliveryAt: purchaseOrders.expectedDeliveryAt,
        vendorId: purchaseOrders.vendorId,
        vendorName: vendors.name,
        costCodeId: purchaseOrders.costCodeId,
        costCodeCode: costCodes.code,
        costCodeDescription: costCodes.description,
        taxRatePercent: purchaseOrders.taxRatePercent,
        revisionNumber: purchaseOrders.revisionNumber,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .leftJoin(costCodes, eq(costCodes.id, purchaseOrders.costCodeId))
      .where(eq(purchaseOrders.projectId, input.projectId))
      .orderBy(desc(purchaseOrders.createdAt)),
  );

  const poIds = poRows.map((p) => p.id);
  const linesByPo = await loadLinesForPos(poIds, orgId);

  const listRows: PoListRow[] = poRows.map((p) => {
    const lines = linesByPo.get(p.id) ?? [];
    const totals = computePoTotals({
      lines: lines.map((l) => ({
        quantity: l.quantity,
        unitCostCents: l.unitCostCents,
      })),
      taxRatePercent: p.taxRatePercent,
    });
    return {
      id: p.id,
      poNumber: p.poNumber,
      status: p.status,
      orderedAt: p.orderedAt,
      expectedDeliveryAt: p.expectedDeliveryAt,
      vendorId: p.vendorId,
      vendorName: p.vendorName,
      costCodeId: p.costCodeId,
      costCodeLabel: buildCostCodeLabel(
        p.costCodeCode,
        p.costCodeDescription,
      ),
      lineCount: lines.length,
      linesReceivedLabel: buildLinesReceivedLabel(lines),
      subtotalCents: totals.subtotalCents,
      taxAmountCents: totals.taxAmountCents,
      totalCents: totals.totalCents,
      revisionNumber: p.revisionNumber,
    };
  });

  // ---- Active PO detail (default to first in list if no id passed) ----
  const activePoId =
    input.activePoId && poRows.some((p) => p.id === input.activePoId)
      ? input.activePoId
      : poRows[0]?.id;
  const activePo = activePoId
    ? await loadPoDetail(activePoId, ctx)
    : null;

  // ---- Vendors (org-wide, for vendors tab + create wizard) ----
  const vendorList = await loadVendorListForOrg(orgId);

  // ---- Cost codes (org-wide) ----
  const costCodeList = await loadCostCodeListForOrg(orgId);

  // ---- KPIs (scoped to this project) ----
  const kpis = computeKpisFromList(listRows);

  return {
    projectId: ctx.project.id,
    projectName: ctx.project.name,
    defaultTaxRatePercent: orgRow?.defaultTaxRatePercent ?? "0.00",
    kpis,
    purchaseOrders: listRows,
    activePo,
    vendors: vendorList,
    costCodes: costCodeList,
  };
}

function computeKpisFromList(list: PoListRow[]): ProcurementKpis {
  let openPoCount = 0;
  let committedCents = 0;
  let awaitingInvoiceCount = 0;
  let spentYtdCents = 0;
  let closedYtdCount = 0;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  for (const row of list) {
    if (OPEN_STATUSES.includes(row.status)) openPoCount++;
    if (COMMITTED_STATUSES.includes(row.status)) committedCents += row.totalCents;
    if (AWAITING_INVOICE_STATUSES.includes(row.status)) awaitingInvoiceCount++;
    if (SPENT_STATUSES.includes(row.status)) {
      if (row.orderedAt && row.orderedAt >= yearStart) {
        spentYtdCents += row.totalCents;
      }
    }
    if (row.status === "closed") {
      if (row.orderedAt && row.orderedAt >= yearStart) closedYtdCount++;
    }
  }
  return {
    openPoCount,
    committedCents,
    awaitingInvoiceCount,
    spentYtdCents,
    closedYtdCount,
  };
}

// -----------------------------------------------------------------------------
// Detail loader (also exported for single-PO API responses)
// -----------------------------------------------------------------------------

export async function loadPoDetail(
  poId: string,
  ctx: EffectiveContext,
): Promise<PoDetailView | null> {
  const [row] = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        vendorId: purchaseOrders.vendorId,
        vendorName: vendors.name,
        vendorContactName: vendors.contactName,
        vendorContactEmail: vendors.contactEmail,
        paymentTerms: vendors.paymentTerms,
        projectId: purchaseOrders.projectId,
        projectName: projects.name,
        costCodeId: purchaseOrders.costCodeId,
        costCodeCode: costCodes.code,
        costCodeDescription: costCodes.description,
        taxRatePercent: purchaseOrders.taxRatePercent,
        orderedAt: purchaseOrders.orderedAt,
        orderedByUserId: purchaseOrders.orderedByUserId,
        orderedByDisplayName: users.displayName,
        expectedDeliveryAt: purchaseOrders.expectedDeliveryAt,
        notes: purchaseOrders.notes,
        revisionNumber: purchaseOrders.revisionNumber,
        lastRevisedAt: purchaseOrders.lastRevisedAt,
        organizationId: purchaseOrders.organizationId,
      })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .innerJoin(projects, eq(projects.id, purchaseOrders.projectId))
      .leftJoin(costCodes, eq(costCodes.id, purchaseOrders.costCodeId))
      .leftJoin(users, eq(users.id, purchaseOrders.orderedByUserId))
      .where(eq(purchaseOrders.id, poId))
      .limit(1),
  );
  if (!row) return null;

  // Scope guard: the PO must belong to ctx's org. getEffectiveContext
  // already gated the project, but a PO could in theory live under a
  // different org on the same project if data is malformed — don't
  // leak it.
  if (row.organizationId !== ctx.organization.id) {
    throw new AuthorizationError(
      "Purchase order belongs to another org",
      "forbidden",
    );
  }

  const linesByPo = await loadLinesForPos([poId], ctx.organization.id);
  const lines = linesByPo.get(poId) ?? [];
  const totals = computePoTotals({
    lines: lines.map((l) => ({
      quantity: l.quantity,
      unitCostCents: l.unitCostCents,
    })),
    taxRatePercent: row.taxRatePercent,
  });
  const linesWithTotals: PoLineRow[] = lines.map((l, i) => ({
    ...l,
    lineTotalCents: totals.lineTotalsCents[i] ?? 0,
  }));

  // ---- Linked documents (via document_links) ----
  const docRows = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({
        id: documents.id,
        title: documents.title,
        category: documents.category,
        fileSizeBytes: documents.fileSizeBytes,
        isSuperseded: documents.isSuperseded,
        createdAt: documents.createdAt,
      })
      .from(documentLinks)
      .innerJoin(documents, eq(documents.id, documentLinks.documentId))
      .where(
        and(
          eq(documentLinks.linkedObjectType, "purchase_order"),
          eq(documentLinks.linkedObjectId, poId),
        ),
      )
      .orderBy(desc(documents.createdAt)),
  );
  const poDocs: PoDocumentRow[] = docRows.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    fileSizeBytes: d.fileSizeBytes,
    isSuperseded: d.isSuperseded,
    createdAt: d.createdAt,
  }));

  // ---- Activity (audit events for this PO) ----
  const activity = await loadPoActivity(poId);

  return {
    id: row.id,
    poNumber: row.poNumber,
    status: row.status,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    vendorContactName: row.vendorContactName,
    vendorContactEmail: row.vendorContactEmail,
    paymentTerms: row.paymentTerms,
    projectId: row.projectId,
    projectName: row.projectName,
    costCodeId: row.costCodeId,
    costCodeLabel: buildCostCodeLabel(row.costCodeCode, row.costCodeDescription),
    taxRatePercent: row.taxRatePercent,
    orderedAt: row.orderedAt,
    orderedByDisplayName: row.orderedByDisplayName,
    expectedDeliveryAt: row.expectedDeliveryAt,
    notes: row.notes,
    revisionNumber: row.revisionNumber,
    lastRevisedAt: row.lastRevisedAt,
    lines: linesWithTotals,
    subtotalCents: totals.subtotalCents,
    taxAmountCents: totals.taxAmountCents,
    totalCents: totals.totalCents,
    documents: poDocs,
    activity,
  };
}

async function loadPoActivity(poId: string): Promise<PoActivityEntry[]> {
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.actionName,
      actorDisplayName: users.displayName,
      createdAt: auditEvents.createdAt,
      metadataJson: auditEvents.metadataJson,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(
      and(
        eq(auditEvents.objectType, "purchase_order"),
        eq(auditEvents.objectId, poId),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(25);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorDisplayName: r.actorDisplayName,
    createdAt: r.createdAt,
    metadata: (r.metadataJson as Record<string, unknown> | null) ?? null,
  }));
}

// -----------------------------------------------------------------------------
// Vendor + cost code loaders
// -----------------------------------------------------------------------------

export async function loadVendorListForOrg(
  orgId: string,
): Promise<VendorRow[]> {
  const vendorRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: vendors.id,
        name: vendors.name,
        contactName: vendors.contactName,
        contactEmail: vendors.contactEmail,
        contactPhone: vendors.contactPhone,
        address: vendors.address,
        paymentTerms: vendors.paymentTerms,
        rating: vendors.rating,
        notes: vendors.notes,
        active: vendors.active,
      })
      .from(vendors)
      .where(eq(vendors.organizationId, orgId))
      .orderBy(asc(vendors.name)),
  );

  if (vendorRows.length === 0) return [];

  const vendorIds = vendorRows.map((v) => v.id);

  // Active PO count per vendor (open states only).
  const activePoAgg = await withTenant(orgId, (tx) =>
    tx
      .select({
        vendorId: purchaseOrders.vendorId,
        c: sql<number>`count(*)::int`,
      })
      .from(purchaseOrders)
      .where(
        and(
          inArray(purchaseOrders.vendorId, vendorIds),
          inArray(purchaseOrders.status, [...OPEN_STATUSES]),
        ),
      )
      .groupBy(purchaseOrders.vendorId),
  );
  const activeCountMap = new Map(activePoAgg.map((r) => [r.vendorId, r.c]));

  // YTD spend per vendor: sum of (subtotal + tax) for POs ordered this year
  // in spent statuses. Compute on read — pull the lines + tax rates and
  // aggregate in memory so we don't double-persist any derived number.
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const spendRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: purchaseOrders.id,
        vendorId: purchaseOrders.vendorId,
        taxRatePercent: purchaseOrders.taxRatePercent,
      })
      .from(purchaseOrders)
      .where(
        and(
          inArray(purchaseOrders.vendorId, vendorIds),
          inArray(purchaseOrders.status, [...SPENT_STATUSES]),
          gte(purchaseOrders.orderedAt, yearStart),
        ),
      ),
  );
  const spendPoIds = spendRows.map((r) => r.id);
  const spendLinesByPo = await loadLinesForPos(spendPoIds, orgId);
  const spendByVendor = new Map<string, number>();
  for (const r of spendRows) {
    const lines = spendLinesByPo.get(r.id) ?? [];
    const totals = computePoTotals({
      lines: lines.map((l) => ({
        quantity: l.quantity,
        unitCostCents: l.unitCostCents,
      })),
      taxRatePercent: r.taxRatePercent,
    });
    spendByVendor.set(
      r.vendorId,
      (spendByVendor.get(r.vendorId) ?? 0) + totals.totalCents,
    );
  }

  return vendorRows.map((v) => ({
    id: v.id,
    name: v.name,
    contactName: v.contactName,
    contactEmail: v.contactEmail,
    contactPhone: v.contactPhone,
    address: v.address,
    paymentTerms: v.paymentTerms,
    rating: v.rating,
    notes: v.notes,
    active: v.active,
    activePoCount: activeCountMap.get(v.id) ?? 0,
    spendYtdCents: spendByVendor.get(v.id) ?? 0,
  }));
}

export async function loadCostCodeListForOrg(
  orgId: string,
): Promise<CostCodeRow[]> {
  const rows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: costCodes.id,
        code: costCodes.code,
        description: costCodes.description,
        active: costCodes.active,
        sortOrder: costCodes.sortOrder,
      })
      .from(costCodes)
      .where(eq(costCodes.organizationId, orgId))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code)),
  );

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const countAgg = await withTenant(orgId, (tx) =>
    tx
      .select({
        costCodeId: purchaseOrders.costCodeId,
        c: sql<number>`count(*)::int`,
      })
      .from(purchaseOrders)
      .where(inArray(purchaseOrders.costCodeId, ids))
      .groupBy(purchaseOrders.costCodeId),
  );
  const countMap = new Map(countAgg.map((r) => [r.costCodeId, r.c]));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    active: r.active,
    sortOrder: r.sortOrder,
    poCount: countMap.get(r.id) ?? 0,
  }));
}

// -----------------------------------------------------------------------------
// Org-wide vendor view (for /contractor/vendors)
// -----------------------------------------------------------------------------

export async function getVendorsPortfolioView(
  input: { session: SessionLike | null | undefined },
): Promise<VendorsPortfolioView> {
  const context = await getContractorOrgContext(input.session);
  const vendorList = await loadVendorListForOrg(context.organization.id);
  const preferredCount = vendorList.filter((v) => v.rating === "preferred").length;
  const activePoCount = vendorList.reduce((s, v) => s + v.activePoCount, 0);
  const spendYtdCents = vendorList.reduce((s, v) => s + v.spendYtdCents, 0);
  const top = vendorList.reduce<VendorRow | null>((best, v) => {
    if (!best) return v;
    return v.spendYtdCents > best.spendYtdCents ? v : best;
  }, null);
  return {
    vendors: vendorList,
    summary: {
      totalVendors: vendorList.length,
      preferredCount,
      activePoCount,
      spendYtdCents,
      topVendorId: top?.id ?? null,
    },
  };
}

// -----------------------------------------------------------------------------
// Org-wide cost codes view (for /contractor/cost-codes)
// -----------------------------------------------------------------------------

export async function getCostCodesPortfolioView(
  input: { session: SessionLike | null | undefined },
): Promise<CostCodesPortfolioView> {
  const context = await getContractorOrgContext(input.session);
  const [orgRow] = await db
    .select({ defaultTaxRatePercent: organizations.defaultTaxRatePercent })
    .from(organizations)
    .where(eq(organizations.id, context.organization.id))
    .limit(1);
  const list = await loadCostCodeListForOrg(context.organization.id);
  return {
    costCodes: list,
    defaultTaxRatePercent: orgRow?.defaultTaxRatePercent ?? "0.00",
  };
}

// -----------------------------------------------------------------------------
// Reports aggregate (Step 24.5 — /contractor/reports tile)
// -----------------------------------------------------------------------------

export async function getProcurementReport(
  input: { session: SessionLike | null | undefined },
): Promise<ProcurementReportView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;

  const poRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: purchaseOrders.id,
        status: purchaseOrders.status,
        vendorId: purchaseOrders.vendorId,
        vendorName: vendors.name,
        orderedAt: purchaseOrders.orderedAt,
        taxRatePercent: purchaseOrders.taxRatePercent,
      })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .where(eq(purchaseOrders.organizationId, orgId)),
  );

  const poIds = poRows.map((r) => r.id);
  const linesByPo = await loadLinesForPos(poIds, orgId);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();

  let openPoCount = 0;
  let committedCents = 0;
  let awaitingInvoiceCount = 0;
  let closedYtdCount = 0;
  let spendYtdCents = 0;

  const byVendorMap = new Map<
    string,
    {
      vendorId: string;
      vendorName: string;
      openCount: number;
      committedCents: number;
      spendYtdCents: number;
    }
  >();
  const byStatusMap = new Map<PoStatus, number>();
  const byAgingMap = {
    "0_7": 0,
    "8_14": 0,
    "15_30": 0,
    "30_plus": 0,
  };

  for (const r of poRows) {
    const lines = linesByPo.get(r.id) ?? [];
    const totals = computePoTotals({
      lines: lines.map((l) => ({
        quantity: l.quantity,
        unitCostCents: l.unitCostCents,
      })),
      taxRatePercent: r.taxRatePercent,
    });
    const totalCents = totals.totalCents;

    byStatusMap.set(r.status, (byStatusMap.get(r.status) ?? 0) + 1);

    const vAgg = byVendorMap.get(r.vendorId) ?? {
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      openCount: 0,
      committedCents: 0,
      spendYtdCents: 0,
    };

    if (OPEN_STATUSES.includes(r.status)) {
      openPoCount++;
      vAgg.openCount++;
      // Aging bucket — based on orderedAt (or createdAt fallback not used here)
      if (r.orderedAt) {
        const days = Math.floor(
          (now.getTime() - r.orderedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (days <= 7) byAgingMap["0_7"]++;
        else if (days <= 14) byAgingMap["8_14"]++;
        else if (days <= 30) byAgingMap["15_30"]++;
        else byAgingMap["30_plus"]++;
      }
    }
    if (COMMITTED_STATUSES.includes(r.status)) {
      committedCents += totalCents;
      vAgg.committedCents += totalCents;
    }
    if (AWAITING_INVOICE_STATUSES.includes(r.status)) {
      awaitingInvoiceCount++;
    }
    if (SPENT_STATUSES.includes(r.status) && r.orderedAt && r.orderedAt >= yearStart) {
      spendYtdCents += totalCents;
      vAgg.spendYtdCents += totalCents;
    }
    if (r.status === "closed" && r.orderedAt && r.orderedAt >= yearStart) {
      closedYtdCount++;
    }

    byVendorMap.set(r.vendorId, vAgg);
  }

  const byVendor = Array.from(byVendorMap.values()).sort(
    (a, b) =>
      b.committedCents + b.spendYtdCents - (a.committedCents + a.spendYtdCents),
  );
  const byStatus = Array.from(byStatusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));
  const byAging = (
    ["0_7", "8_14", "15_30", "30_plus"] as const
  ).map((bucket) => ({ bucket, count: byAgingMap[bucket] }));

  return {
    openPoCount,
    committedCents,
    awaitingInvoiceCount,
    closedYtdCount,
    spendYtdCents,
    byVendor,
    byStatus,
    byAging,
  };
}
