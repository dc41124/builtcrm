import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, requireFeature } from "@/domain/policies/plan";
import { CsvParseError, parseCsv } from "@/lib/imports/csv-parser";
import {
  autoDetectMapping,
  PROJECT_FIELD_CATALOG,
  validateProjectsImport,
  type FieldMapping,
  type ProjectImportField,
} from "@/lib/imports/projects-import";

// Parse + validate a project CSV without committing. Returns the mapping
// used (so the client can render the user's choices), the list of valid
// rows (truncated for response size), and the invalid-row report.
//
// Professional+ gated. 2 MB body cap to keep request handling bounded —
// caller chunks larger files (out of scope for Session 4).

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const BodySchema = z.object({
  csv: z.string().min(1).max(MAX_BODY_BYTES),
  // Client may omit mapping to request auto-detection, or pass one when
  // re-previewing after a column swap.
  mapping: z
    .record(z.string(), z.number().int().min(0))
    .optional(),
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

    if (table.header.length === 0) {
      return NextResponse.json(
        { error: "empty_csv", message: "The CSV has no header row." },
        { status: 400 },
      );
    }

    const mapping: FieldMapping =
      (parsedBody.data.mapping as FieldMapping | undefined) ??
      autoDetectMapping(table.header);

    const result = validateProjectsImport(table, mapping);

    // Truncate previews for response size.
    const maxPreview = 10;
    return NextResponse.json({
      ok: true,
      header: table.header,
      mapping,
      catalog: PROJECT_FIELD_CATALOG.map((c) => ({
        field: c.field,
        label: c.label,
        required: c.required,
      })),
      totalRows: result.totalRows,
      validCount: result.validRows.length,
      invalidCount: result.invalidRows.length,
      invalidRows: result.invalidRows.slice(0, maxPreview).map((r) => ({
        rowNum: r.rowNum,
        errors: r.errors,
      })),
      samplePreview: result.validRows.slice(0, maxPreview).map((v) => ({
        name: v.name,
        projectCode: v.projectCode,
        projectStatus: v.projectStatus,
        currentPhase: v.currentPhase,
        contractValueCents: v.contractValueCents,
      })),
      fieldsList: PROJECT_FIELD_CATALOG.map(
        (c) => c.field,
      ) as ProjectImportField[],
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
