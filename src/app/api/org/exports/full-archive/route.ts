import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import archiver from "archiver";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, dataExports, organizations } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError, hasFeature, requireFeature } from "@/domain/policies/plan";
import {
  appendOrgDocumentsToArchive,
  buildAuditLogCsv,
  buildFinancialCsvs,
  buildProjectsCsv,
} from "@/lib/exports/builders";
import { slugForFilename } from "@/lib/exports/csv";

// Full archive — Professional+ gate. One ZIP containing:
//   _manifest.json
//   projects.csv
//   audit-log.csv            (only when Enterprise gate is met)
//   financial/draws.csv
//   financial/sov.csv
//   financial/lien_waivers.csv
//   documents/{project_slug}/{doc_type}/{file}
//
// Synchronous — same portfolio-scope caveat as documents-zip.

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

    // Audit log respects its own gate — Professional orgs get a full archive
    // minus audit-log.csv. Manifest records the omission for transparency.
    const includeAuditLog = hasFeature(planCtx, "audit.csv_export");

    const [projectsCsv, financials, auditLog] = await Promise.all([
      buildProjectsCsv(ctx.organization.id),
      buildFinancialCsvs(ctx.organization.id),
      includeAuditLog
        ? buildAuditLogCsv(ctx.organization.id)
        : Promise.resolve(null),
    ]);

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (c) => chunks.push(c));
    const archiveDone = new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("warning", (err) => {
        if ((err as { code?: string }).code !== "ENOENT") reject(err);
      });
      archive.on("error", reject);
    });

    archive.append(projectsCsv.csv, { name: "projects.csv" });
    archive.append(financials.draws.csv, { name: "financial/draws.csv" });
    archive.append(financials.sov.csv, { name: "financial/sov.csv" });
    archive.append(financials.lienWaivers.csv, {
      name: "financial/lien_waivers.csv",
    });
    if (auditLog) {
      archive.append(auditLog.csv, { name: "audit-log.csv" });
    }

    const documentSummary = await appendOrgDocumentsToArchive(
      archive,
      ctx.organization.id,
      { pathPrefix: "documents/" },
    );

    const manifest = {
      generatedAt: new Date().toISOString(),
      organizationId: ctx.organization.id,
      planTier: planCtx.tier,
      contents: {
        projectsCsv: { rowCount: projectsCsv.rowCount },
        auditLogCsv: auditLog
          ? { rowCount: auditLog.rowCount }
          : { omitted: true, reason: "requires Enterprise tier" },
        financial: {
          draws: { rowCount: financials.draws.rowCount },
          sov: { rowCount: financials.sov.rowCount },
          lienWaivers: { rowCount: financials.lienWaivers.rowCount },
        },
        documents: {
          total: documentSummary.total,
          skippedCount: documentSummary.skippedIds.length,
          items: documentSummary.documents,
        },
      },
    };
    archive.append(JSON.stringify(manifest, null, 2), {
      name: "_manifest.json",
    });

    await archive.finalize();
    await archiveDone;
    const zipBuffer = Buffer.concat(chunks);

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
          exportKind: "full_archive",
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
        exportKind: "full_archive",
        planTier: planCtx.tier,
        auditLogIncluded: !!auditLog,
        projectCount: projectsCsv.rowCount,
        drawCount: financials.draws.rowCount,
        sovLineCount: financials.sov.rowCount,
        lienWaiverCount: financials.lienWaivers.rowCount,
        documentTotal: documentSummary.total,
        documentSkipped: documentSummary.skippedIds.length,
        zipBytes: zipBuffer.length,
      },
    });

    const slug = slugForFilename(orgRow?.name ?? "archive");
    const filename = `${slug}_archive_${now.toISOString().slice(0, 10)}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
        "X-Export-Id": exportRow.id,
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
