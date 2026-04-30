import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  auditEvents,
  dataExports,
  organizations,
  projects,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, requireFeature } from "@/domain/policies/plan";
import {
  csvLine,
  formatCsvDate,
  formatCsvDollars,
  slugForFilename,
} from "@/lib/exports/csv";

// Projects CSV export — Professional+ gated. Synchronous: generates CSV in
// the request lifecycle, streams it to the browser, logs a data_exports row
// with storage_key=null (no R2 object; inline delivery). Heavy async
// exports in Session 2 will reuse the plan-gate + data_exports patterns
// but write to R2 and poll for status.

const CSV_COLUMNS = [
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

export async function POST() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can export organization data",
        "forbidden",
      );
    }

    const planCtx = await getOrgPlanContext(ctx.organization.id);
    requireFeature(planCtx, "data_exports.full_archive");

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
      .where(eq(projects.contractorOrganizationId, ctx.organization.id));

    const lines: string[] = [csvLine(CSV_COLUMNS)];
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
    const body = lines.join("\r\n") + "\r\n";

    // Record the export event. Synchronous + inline-delivered, so
    // storage_key / expires_at stay null; completed_at is now.
    const now = new Date();
    const [orgRow] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, ctx.organization.id))
      .limit(1);
    const [exportRow] = await withTenant(ctx.organization.id, (tx) =>
      tx
        .insert(dataExports)
        .values({
          organizationId: ctx.organization.id,
          requestedByUserId: ctx.user.id,
          exportKind: "projects_csv",
          scope: null,
          status: "ready",
          storageKey: null,
          expiresAt: null,
          startedAt: now,
          completedAt: now,
        })
        .returning({ id: dataExports.id }),
    );

    await dbAdmin.insert(auditEvents).values({
      actorUserId: ctx.user.id,
      organizationId: ctx.organization.id,
      objectType: "data_export",
      objectId: exportRow.id,
      actionName: "generated",
      nextState: {
        exportKind: "projects_csv",
        rowCount: rows.length,
      },
    });

    const slug = slugForFilename(orgRow?.name ?? "projects");
    const filename = `${slug}_projects_${now.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Id": exportRow.id,
        "X-Export-Row-Count": String(rows.length),
      },
    });
  } catch (err) {
    if (err instanceof PlanGateError) {
      return NextResponse.json(
        {
          error: "plan_gate",
          reason: err.reason,
          required: err.required,
          message: err.message,
        },
        { status: 402 },
      );
    }
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}
