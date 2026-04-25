import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents, dataExports, organizations } from "@/db/schema";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { listOrganizationAuditEvents } from "@/domain/loaders/audit-log";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, requireFeature } from "@/domain/policies/plan";
import {
  csvLine,
  formatCsvTimestamp,
  slugForFilename,
} from "@/lib/exports/csv";

// Audit log CSV export — Enterprise-only gate (`audit.csv_export`).
// Synchronous: reads the full audit history via the existing loader with
// unbounded:true, emits a CSV row per event. Same inline-delivery pattern
// as projects-csv (no R2 round-trip, logs a data_exports row).

const CSV_COLUMNS = [
  "created_at",
  "category",
  "actor",
  "object_type",
  "object_id",
  "action",
  "detail",
] as const;

export async function POST() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can export the audit log",
        "forbidden",
      );
    }

    const planCtx = await getOrgPlanContext(ctx.organization.id);
    requireFeature(planCtx, "audit.csv_export");

    const events = await listOrganizationAuditEvents(ctx.organization.id, {
      unbounded: true,
    });

    const lines: string[] = [csvLine(CSV_COLUMNS)];
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
    const body = lines.join("\r\n") + "\r\n";

    const now = new Date();
    const [orgRow] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, ctx.organization.id))
      .limit(1);
    const [exportRow] = await db
      .insert(dataExports)
      .values({
        organizationId: ctx.organization.id,
        requestedByUserId: ctx.user.id,
        exportKind: "audit_log_csv",
        scope: null,
        status: "ready",
        storageKey: null,
        expiresAt: null,
        startedAt: now,
        completedAt: now,
      })
      .returning({ id: dataExports.id });

    await db.insert(auditEvents).values({
      actorUserId: ctx.user.id,
      organizationId: ctx.organization.id,
      objectType: "data_export",
      objectId: exportRow.id,
      actionName: "generated",
      nextState: {
        exportKind: "audit_log_csv",
        rowCount: events.length,
      },
    });

    const slug = slugForFilename(orgRow?.name ?? "audit");
    const filename = `${slug}_audit-log_${now.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Id": exportRow.id,
        "X-Export-Row-Count": String(events.length),
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
