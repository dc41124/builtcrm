import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, projects } from "@/db/schema";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, requireFeature } from "@/domain/policies/plan";
import { CsvParseError, parseCsv } from "@/lib/imports/csv-parser";
import {
  validateProjectsImport,
  type FieldMapping,
} from "@/lib/imports/projects-import";

// Commit a project CSV import. Validates (same logic as preview), then
// inserts all valid rows in a single transaction. If any row is invalid,
// the commit is rejected outright — caller fixes the file and re-previews.
//
// Professional+ gated.

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const BodySchema = z.object({
  csv: z.string().min(1).max(MAX_BODY_BYTES),
  mapping: z.record(z.string(), z.number().int().min(0)),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionShim = session.session as unknown as {
    appUserId?: string | null;
  };

  const parsedBody = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can import organization data",
        "forbidden",
      );
    }
    const planCtx = await getOrgPlanContext(ctx.organization.id);
    requireFeature(planCtx, "import.csv_excel");

    let table;
    try {
      table = parseCsv(parsedBody.data.csv);
    } catch (err) {
      if (err instanceof CsvParseError) {
        return NextResponse.json(
          { error: "csv_parse_error", message: err.message, line: err.line },
          { status: 400 },
        );
      }
      throw err;
    }

    const mapping = parsedBody.data.mapping as FieldMapping;
    const result = validateProjectsImport(table, mapping);

    if (result.invalidRows.length > 0) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message:
            "Some rows are invalid. Fix them and re-preview before committing.",
          invalidCount: result.invalidRows.length,
          invalidRows: result.invalidRows.slice(0, 10).map((r) => ({
            rowNum: r.rowNum,
            errors: r.errors,
          })),
        },
        { status: 400 },
      );
    }
    if (result.validRows.length === 0) {
      return NextResponse.json(
        { error: "no_rows", message: "The CSV has no data rows to import." },
        { status: 400 },
      );
    }

    // Single transaction — all rows land or none do. Drizzle batches the
    // insert under the hood when we pass an array of values.
    const insertedIds = await db.transaction(async (tx) => {
      const ids = await tx
        .insert(projects)
        .values(
          result.validRows.map((r) => ({
            name: r.name,
            projectCode: r.projectCode,
            projectType: r.projectType,
            projectStatus: r.projectStatus,
            currentPhase: r.currentPhase,
            startDate: r.startDate,
            targetCompletionDate: r.targetCompletionDate,
            contractValueCents: r.contractValueCents,
            addressLine1: r.addressLine1,
            addressLine2: r.addressLine2,
            city: r.city,
            stateProvince: r.stateProvince,
            postalCode: r.postalCode,
            country: r.country,
            contractorOrganizationId: ctx.organization.id,
          })),
        )
        .returning({ id: projects.id });

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "data_import",
        objectId: ctx.organization.id,
        actionName: "projects_imported",
        nextState: {
          source: "csv",
          insertedCount: ids.length,
          totalRowsInFile: result.totalRows,
        },
      });

      return ids;
    });

    return NextResponse.json({
      ok: true,
      insertedCount: insertedIds.length,
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
