import { eq } from "drizzle-orm";
import type { Archiver } from "archiver";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { db } from "@/db/client";
import {
  documents,
  drawRequests,
  lienWaivers,
  organizations,
  projects,
  scheduleOfValues,
  sovLineItems,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { listOrganizationAuditEvents } from "@/domain/loaders/audit-log";

import {
  csvLine,
  formatCsvDate,
  formatCsvDollars,
  formatCsvTimestamp,
} from "./csv";
import { R2_BUCKET, r2 } from "../storage";

// Export builders — pure functions that produce the raw body of each export
// kind. Callers (standalone export routes, full-archive orchestrator) compose
// them without duplicating query logic. Each builder is org-scoped and never
// crosses a tenant boundary.

// ---------------------------------------------------------------------------
// Projects CSV
// ---------------------------------------------------------------------------

const PROJECTS_COLUMNS = [
  "project_code",
  "name",
  "project_type",
  "project_status",
  "current_phase",
  "start_date",
  "target_completion_date",
  "contract_value",
  "address_line_1",
  "address_line_2",
  "city",
  "state_province",
  "postal_code",
  "country",
  "created_at",
] as const;

export async function buildProjectsCsv(
  organizationId: string,
): Promise<{ csv: string; rowCount: number }> {
  const rows = await db
    .select({
      projectCode: projects.projectCode,
      name: projects.name,
      projectType: projects.projectType,
      projectStatus: projects.projectStatus,
      currentPhase: projects.currentPhase,
      startDate: projects.startDate,
      targetCompletionDate: projects.targetCompletionDate,
      contractValueCents: projects.contractValueCents,
      addressLine1: projects.addressLine1,
      addressLine2: projects.addressLine2,
      city: projects.city,
      stateProvince: projects.stateProvince,
      postalCode: projects.postalCode,
      country: projects.country,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, organizationId));

  const lines: string[] = [csvLine(PROJECTS_COLUMNS)];
  for (const r of rows) {
    lines.push(
      csvLine([
        r.projectCode,
        r.name,
        r.projectType,
        r.projectStatus,
        r.currentPhase,
        formatCsvDate(r.startDate),
        formatCsvDate(r.targetCompletionDate),
        formatCsvDollars(r.contractValueCents),
        r.addressLine1,
        r.addressLine2,
        r.city,
        r.stateProvince,
        r.postalCode,
        r.country,
        formatCsvDate(r.createdAt),
      ]),
    );
  }
  return { csv: lines.join("\r\n") + "\r\n", rowCount: rows.length };
}

// ---------------------------------------------------------------------------
// Audit log CSV
// ---------------------------------------------------------------------------

const AUDIT_COLUMNS = [
  "created_at",
  "category",
  "actor",
  "object_type",
  "object_id",
  "action",
  "detail",
] as const;

export async function buildAuditLogCsv(
  organizationId: string,
): Promise<{ csv: string; rowCount: number }> {
  const events = await listOrganizationAuditEvents(organizationId, {
    unbounded: true,
  });
  const lines: string[] = [csvLine(AUDIT_COLUMNS)];
  for (const e of events) {
    lines.push(
      csvLine([
        formatCsvTimestamp(e.createdAt),
        e.eventCategory,
        e.actor.name,
        e.objectType,
        e.objectId,
        e.actionName,
        e.detail,
      ]),
    );
  }
  return { csv: lines.join("\r\n") + "\r\n", rowCount: events.length };
}

// ---------------------------------------------------------------------------
// Financial CSVs — draws, SOV line items, lien waivers (one CSV each).
// ---------------------------------------------------------------------------

const DRAWS_COLUMNS = [
  "project_code",
  "project_name",
  "draw_number",
  "period_from",
  "period_to",
  "status",
  "contract_sum_to_date",
  "total_completed_to_date",
  "total_retainage",
  "current_payment_due",
  "balance_to_finish",
  "submitted_at",
  "paid_at",
] as const;

const SOV_COLUMNS = [
  "project_code",
  "project_name",
  "sov_version",
  "sov_status",
  "item_number",
  "cost_code",
  "description",
  "line_item_type",
  "scheduled_value",
  "is_active",
] as const;

const LIEN_WAIVERS_COLUMNS = [
  "project_code",
  "project_name",
  "draw_number",
  "waiver_type",
  "waiver_status",
  "amount",
  "through_date",
  "issuer_organization",
  "requested_at",
  "submitted_at",
  "accepted_at",
] as const;

export async function buildFinancialCsvs(organizationId: string): Promise<{
  draws: { csv: string; rowCount: number };
  sov: { csv: string; rowCount: number };
  lienWaivers: { csv: string; rowCount: number };
}> {
  // Draws — one row per draw request
  const drawRows = await db
    .select({
      projectCode: projects.projectCode,
      projectName: projects.name,
      drawNumber: drawRequests.drawNumber,
      periodFrom: drawRequests.periodFrom,
      periodTo: drawRequests.periodTo,
      status: drawRequests.drawRequestStatus,
      contractSumToDate: drawRequests.contractSumToDateCents,
      totalCompletedToDate: drawRequests.totalCompletedToDateCents,
      totalRetainage: drawRequests.totalRetainageCents,
      currentPaymentDue: drawRequests.currentPaymentDueCents,
      balanceToFinish: drawRequests.balanceToFinishCents,
      submittedAt: drawRequests.submittedAt,
      paidAt: drawRequests.paidAt,
    })
    .from(drawRequests)
    .innerJoin(projects, eq(projects.id, drawRequests.projectId))
    .where(eq(projects.contractorOrganizationId, organizationId));

  const drawsLines: string[] = [csvLine(DRAWS_COLUMNS)];
  for (const r of drawRows) {
    drawsLines.push(
      csvLine([
        r.projectCode,
        r.projectName,
        r.drawNumber,
        formatCsvDate(r.periodFrom),
        formatCsvDate(r.periodTo),
        r.status,
        formatCsvDollars(r.contractSumToDate),
        formatCsvDollars(r.totalCompletedToDate),
        formatCsvDollars(r.totalRetainage),
        formatCsvDollars(r.currentPaymentDue),
        formatCsvDollars(r.balanceToFinish),
        formatCsvTimestamp(r.submittedAt),
        formatCsvTimestamp(r.paidAt),
      ]),
    );
  }

  // SOV line items — joined through scheduleOfValues → projects
  const sovRows = await db
    .select({
      projectCode: projects.projectCode,
      projectName: projects.name,
      sovVersion: scheduleOfValues.version,
      sovStatus: scheduleOfValues.sovStatus,
      itemNumber: sovLineItems.itemNumber,
      costCode: sovLineItems.costCode,
      description: sovLineItems.description,
      lineItemType: sovLineItems.lineItemType,
      scheduledValueCents: sovLineItems.scheduledValueCents,
      isActive: sovLineItems.isActive,
    })
    .from(sovLineItems)
    .innerJoin(
      scheduleOfValues,
      eq(scheduleOfValues.id, sovLineItems.sovId),
    )
    .innerJoin(projects, eq(projects.id, scheduleOfValues.projectId))
    .where(eq(projects.contractorOrganizationId, organizationId));

  const sovLines: string[] = [csvLine(SOV_COLUMNS)];
  for (const r of sovRows) {
    sovLines.push(
      csvLine([
        r.projectCode,
        r.projectName,
        r.sovVersion,
        r.sovStatus,
        r.itemNumber,
        r.costCode,
        r.description,
        r.lineItemType,
        formatCsvDollars(r.scheduledValueCents),
        r.isActive ? "true" : "false",
      ]),
    );
  }

  // Lien waivers — joined through drawRequests → projects; issuer org name
  // resolved via a second join on organizations. Contractor full-archive
  // export — multi-org policy clause B (project ownership) returns sub
  // waivers too.
  const lwRows = await withTenant(organizationId, (tx) =>
    tx
      .select({
        projectCode: projects.projectCode,
        projectName: projects.name,
        drawNumber: drawRequests.drawNumber,
        waiverType: lienWaivers.lienWaiverType,
        waiverStatus: lienWaivers.lienWaiverStatus,
        amountCents: lienWaivers.amountCents,
        throughDate: lienWaivers.throughDate,
        issuerOrganization: organizations.name,
        requestedAt: lienWaivers.requestedAt,
        submittedAt: lienWaivers.submittedAt,
        acceptedAt: lienWaivers.acceptedAt,
      })
      .from(lienWaivers)
      .innerJoin(drawRequests, eq(drawRequests.id, lienWaivers.drawRequestId))
      .innerJoin(projects, eq(projects.id, drawRequests.projectId))
      .innerJoin(
        organizations,
        eq(organizations.id, lienWaivers.organizationId),
      )
      .where(eq(projects.contractorOrganizationId, organizationId)),
  );

  const lwLines: string[] = [csvLine(LIEN_WAIVERS_COLUMNS)];
  for (const r of lwRows) {
    lwLines.push(
      csvLine([
        r.projectCode,
        r.projectName,
        r.drawNumber,
        r.waiverType,
        r.waiverStatus,
        formatCsvDollars(r.amountCents),
        formatCsvDate(r.throughDate),
        r.issuerOrganization,
        formatCsvTimestamp(r.requestedAt),
        formatCsvTimestamp(r.submittedAt),
        formatCsvTimestamp(r.acceptedAt),
      ]),
    );
  }

  return {
    draws: {
      csv: drawsLines.join("\r\n") + "\r\n",
      rowCount: drawRows.length,
    },
    sov: {
      csv: sovLines.join("\r\n") + "\r\n",
      rowCount: sovRows.length,
    },
    lienWaivers: {
      csv: lwLines.join("\r\n") + "\r\n",
      rowCount: lwRows.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Documents — streams R2 objects into an already-open archiver archive.
// Reused by documents-zip + full-archive. Skipped documents are logged in
// the returned skippedIds so the caller can include them in a manifest.
// ---------------------------------------------------------------------------

function sanitizeSegment(s: string | null | undefined): string {
  if (!s) return "untitled";
  return s.replace(/[\\/]/g, "_").replace(/\s+/g, " ").trim() || "untitled";
}

function filenameFromKey(storageKey: string, fallbackTitle: string): string {
  const last = storageKey.split("/").pop() ?? "";
  const stripped = last.replace(/^\d+_/, "");
  if (stripped.length > 0 && stripped.includes(".")) return stripped;
  return sanitizeSegment(fallbackTitle);
}

export async function appendOrgDocumentsToArchive(
  archive: Archiver,
  organizationId: string,
  opts: { pathPrefix?: string } = {},
): Promise<{
  total: number;
  skippedIds: string[];
  documents: Array<{
    id: string;
    title: string;
    projectCode: string | null;
    projectName: string;
    documentType: string;
    storageKey: string;
    included: boolean;
  }>;
}> {
  const prefix = opts.pathPrefix ? `${opts.pathPrefix.replace(/\/$/, "")}/` : "";
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      documentType: documents.documentType,
      storageKey: documents.storageKey,
      projectCode: projects.projectCode,
      projectName: projects.name,
    })
    .from(documents)
    .innerJoin(projects, eq(projects.id, documents.projectId))
    .where(eq(projects.contractorOrganizationId, organizationId));

  const skippedIds: string[] = [];
  for (const doc of rows) {
    try {
      const obj = await r2.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: doc.storageKey }),
      );
      if (!obj.Body) {
        skippedIds.push(doc.id);
        continue;
      }
      const bytes = await obj.Body.transformToByteArray();
      const projSeg = sanitizeSegment(doc.projectCode ?? doc.projectName);
      const typeSeg = sanitizeSegment(doc.documentType);
      const fileSeg = filenameFromKey(doc.storageKey, doc.title);
      archive.append(Buffer.from(bytes), {
        name: `${prefix}${projSeg}/${typeSeg}/${fileSeg}`,
      });
    } catch {
      skippedIds.push(doc.id);
    }
  }

  return {
    total: rows.length,
    skippedIds,
    documents: rows.map((d) => ({
      id: d.id,
      title: d.title,
      projectCode: d.projectCode,
      projectName: d.projectName,
      documentType: d.documentType,
      storageKey: d.storageKey,
      included: !skippedIds.includes(d.id),
    })),
  };
}
