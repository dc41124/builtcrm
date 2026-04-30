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
import { PlanGateError, requireFeature } from "@/domain/policies/plan";
import { appendOrgDocumentsToArchive } from "@/lib/exports/builders";
import { slugForFilename } from "@/lib/exports/csv";

// Documents ZIP export — Professional+ gate (`data_exports.full_archive`).
// Synchronous: delegates to appendOrgDocumentsToArchive (shared with the
// full-archive route) to stream each R2 object into the ZIP, then buffers
// the output for the response.
//
// Synchronous is correct for portfolio scope (< ~100 docs, < ~100MB). For
// real-world orgs with thousands of documents this would block a request
// for minutes — the Trigger.dev-v3 async pattern is flagged as a future
// polish item. Response size is bounded only by the org's document payload.

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

    const summary = await appendOrgDocumentsToArchive(
      archive,
      ctx.organization.id,
    );

    // Manifest at archive root so consumers have a machine-readable index
    // and can tell which documents were skipped (missing R2 object, etc.).
    const manifest = {
      generatedAt: new Date().toISOString(),
      organizationId: ctx.organization.id,
      documentCount: summary.total,
      skippedCount: summary.skippedIds.length,
      documents: summary.documents,
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
          exportKind: "documents_zip",
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
        exportKind: "documents_zip",
        documentCount: summary.total,
        skippedCount: summary.skippedIds.length,
        zipBytes: zipBuffer.length,
      },
    });

    const slug = slugForFilename(orgRow?.name ?? "documents");
    const filename = `${slug}_documents_${now.toISOString().slice(0, 10)}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
        "X-Export-Id": exportRow.id,
        "X-Document-Count": String(summary.total),
        "X-Skipped-Count": String(summary.skippedIds.length),
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
