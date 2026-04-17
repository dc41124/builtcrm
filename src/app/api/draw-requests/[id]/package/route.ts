import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import archiver from "archiver";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  documentLinks,
  documents,
  drawLineItems,
  drawRequests,
  lienWaivers,
  organizations,
  projects,
  sovLineItems,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { G702Document } from "@/lib/pdf/g702-template";
import { G703Document } from "@/lib/pdf/g703-template";
import { r2, R2_BUCKET } from "@/lib/storage";

// archiver + R2 SDK streaming are Node-only APIs; Edge runtime would reject both.
export const runtime = "nodejs";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: drawId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [draw] = await db
    .select({
      id: drawRequests.id,
      projectId: drawRequests.projectId,
      drawNumber: drawRequests.drawNumber,
      drawRequestStatus: drawRequests.drawRequestStatus,
      periodFrom: drawRequests.periodFrom,
      periodTo: drawRequests.periodTo,
      // G702 summary fields — flow straight into the PDF template
      originalContractSumCents: drawRequests.originalContractSumCents,
      netChangeOrdersCents: drawRequests.netChangeOrdersCents,
      contractSumToDateCents: drawRequests.contractSumToDateCents,
      totalCompletedToDateCents: drawRequests.totalCompletedToDateCents,
      retainageOnCompletedCents: drawRequests.retainageOnCompletedCents,
      retainageOnStoredCents: drawRequests.retainageOnStoredCents,
      totalRetainageCents: drawRequests.totalRetainageCents,
      totalEarnedLessRetainageCents:
        drawRequests.totalEarnedLessRetainageCents,
      previousCertificatesCents: drawRequests.previousCertificatesCents,
      currentPaymentDueCents: drawRequests.currentPaymentDueCents,
      balanceToFinishCents: drawRequests.balanceToFinishCents,
    })
    .from(drawRequests)
    .where(eq(drawRequests.id, drawId))
    .limit(1);
  if (!draw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      draw.projectId,
    );
    assertCan(ctx.permissions, "draw_request", "read");
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can package draw documents",
        "forbidden",
      );
    }

    if (draw.drawRequestStatus === "draft") {
      return NextResponse.json(
        {
          error: "not_packageable",
          message: "Package available after draw is submitted",
        },
        { status: 409 },
      );
    }

    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, draw.projectId))
      .limit(1);

    const supportingFiles = await db
      .select({
        documentId: documents.id,
        title: documents.title,
        storageKey: documents.storageKey,
        linkRole: documentLinks.linkRole,
      })
      .from(documentLinks)
      .innerJoin(documents, eq(documents.id, documentLinks.documentId))
      .where(
        and(
          eq(documentLinks.linkedObjectType, "draw_request"),
          eq(documentLinks.linkedObjectId, drawId),
        ),
      );

    const waivers = await db
      .select({
        id: lienWaivers.id,
        type: lienWaivers.lienWaiverType,
        status: lienWaivers.lienWaiverStatus,
        amountCents: lienWaivers.amountCents,
        throughDate: lienWaivers.throughDate,
        requestedAt: lienWaivers.requestedAt,
        acceptedAt: lienWaivers.acceptedAt,
        organizationName: organizations.name,
      })
      .from(lienWaivers)
      .leftJoin(organizations, eq(organizations.id, lienWaivers.organizationId))
      .where(eq(lienWaivers.drawRequestId, drawId));

    const today = new Date().toISOString().slice(0, 10);
    const projectSlug = slug(project?.name ?? "project");
    const zipFilename = `draw-${String(draw.drawNumber).padStart(3, "0")}-${projectSlug}-${today}.zip`;

    const manifest = {
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.user.displayName ?? ctx.user.email,
      project: { id: project?.id ?? null, name: project?.name ?? null },
      draw: {
        id: draw.id,
        drawNumber: draw.drawNumber,
        status: draw.drawRequestStatus,
        periodFrom: draw.periodFrom,
        periodTo: draw.periodTo,
        currentPaymentDueCents: draw.currentPaymentDueCents,
      },
      supportingFileCount: supportingFiles.length,
      lienWaiverCount: waivers.length,
    };

    const csvHeader =
      "waiver_id,type,status,organization,amount_cents,through_date,requested_at,accepted_at";
    const csvRows = waivers.map((w) =>
      [
        w.id,
        w.type,
        w.status,
        JSON.stringify(w.organizationName ?? ""),
        w.amountCents,
        w.throughDate ? new Date(w.throughDate).toISOString() : "",
        w.requestedAt ? new Date(w.requestedAt).toISOString() : "",
        w.acceptedAt ? new Date(w.acceptedAt).toISOString() : "",
      ].join(","),
    );
    const lienWaiversCsv = [csvHeader, ...csvRows].join("\n");

    // Pull draw line items joined to their SOV rows for the G703 continuation
    // sheet. Ordered by SOV sortOrder so the PDF matches the on-screen table.
    const g703Lines = await db
      .select({
        itemNumber: sovLineItems.itemNumber,
        description: sovLineItems.description,
        scheduledValueCents: sovLineItems.scheduledValueCents,
        workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
        workCompletedThisPeriodCents:
          drawLineItems.workCompletedThisPeriodCents,
        materialsPresentlyStoredCents:
          drawLineItems.materialsPresentlyStoredCents,
        totalCompletedStoredToDateCents:
          drawLineItems.totalCompletedStoredToDateCents,
        percentCompleteBasisPoints: drawLineItems.percentCompleteBasisPoints,
        balanceToFinishCents: drawLineItems.balanceToFinishCents,
        retainageCents: drawLineItems.retainageCents,
      })
      .from(drawLineItems)
      .innerJoin(
        sovLineItems,
        eq(sovLineItems.id, drawLineItems.sovLineItemId),
      )
      .where(eq(drawLineItems.drawRequestId, drawId))
      .orderBy(sovLineItems.sortOrder);

    // Render G702 + G703 PDFs up-front (before archive streaming starts).
    // Components are called as plain functions (not via createElement) so the
    // return type is ReactElement<DocumentProps>, which is what renderToBuffer
    // requires. Awaiting inline means any template failure surfaces as a clean
    // 500 instead of a truncated ZIP.
    const g702Buffer = await renderToBuffer(
      G702Document({
        data: {
          projectName: project?.name ?? "",
          contractorName: ctx.organization.name,
          clientName: null,
          drawNumber: draw.drawNumber,
          applicationDate: new Date(),
          periodFrom: draw.periodFrom,
          periodTo: draw.periodTo,
          originalContractSumCents: draw.originalContractSumCents,
          netChangeOrdersCents: draw.netChangeOrdersCents,
          contractSumToDateCents: draw.contractSumToDateCents,
          totalCompletedToDateCents: draw.totalCompletedToDateCents,
          retainageOnCompletedCents: draw.retainageOnCompletedCents,
          retainageOnStoredCents: draw.retainageOnStoredCents,
          totalRetainageCents: draw.totalRetainageCents,
          totalEarnedLessRetainageCents: draw.totalEarnedLessRetainageCents,
          previousCertificatesCents: draw.previousCertificatesCents,
          currentPaymentDueCents: draw.currentPaymentDueCents,
          balanceToFinishCents: draw.balanceToFinishCents,
        },
      }),
    );

    const g703Buffer = await renderToBuffer(
      G703Document({
        data: {
          projectName: project?.name ?? "",
          contractorName: ctx.organization.name,
          drawNumber: draw.drawNumber,
          applicationDate: new Date(),
          periodFrom: draw.periodFrom,
          periodTo: draw.periodTo,
          lines: g703Lines.map((l) => ({
            itemNumber: l.itemNumber,
            description: l.description,
            scheduledValueCents: l.scheduledValueCents,
            workCompletedPreviousCents: l.workCompletedPreviousCents,
            workCompletedThisPeriodCents: l.workCompletedThisPeriodCents,
            materialsPresentlyStoredCents: l.materialsPresentlyStoredCents,
            totalCompletedStoredToDateCents: l.totalCompletedStoredToDateCents,
            percentCompleteBasisPoints: l.percentCompleteBasisPoints,
            balanceToFinishCents: l.balanceToFinishCents,
            retainageCents: l.retainageCents,
          })),
        },
      }),
    );

    // zlib level 6 is the standard speed/compression tradeoff — ~equivalent to
    // `zip -6` on the command line. Higher levels barely shrink PDFs/images
    // (already compressed) and cost noticeable CPU on large packages.
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(lienWaiversCsv, { name: "lien-waivers.csv" });
    archive.append(g702Buffer, {
      name: `G702-draw-${String(draw.drawNumber).padStart(3, "0")}.pdf`,
    });
    archive.append(g703Buffer, {
      name: `G703-draw-${String(draw.drawNumber).padStart(3, "0")}.pdf`,
    });

    for (const f of supportingFiles) {
      const res = await r2.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: f.storageKey }),
      );
      if (!res.Body) continue;
      const nodeStream = res.Body as Readable;
      const folder = (f.linkRole || "files").replace(/[\\/]/g, "_");
      const name = safeFilename(f.title || f.documentId);
      archive.append(nodeStream, { name: `${folder}/${name}` });
    }

    // finalize() returns a Promise that resolves when the zip trailer is
    // written. We kick it off but don't await — the response stream below
    // must start being consumed so archiver has backpressure to drain into.
    archive.finalize().catch((err) => {
      console.error("archive.finalize failed", err);
      archive.destroy(err as Error);
    });

    await writeAuditEvent(ctx, {
      action: "draw.package_downloaded",
      resourceType: "draw_request",
      resourceId: draw.id,
      details: {
        metadata: {
          drawNumber: draw.drawNumber,
          supportingFileCount: supportingFiles.length,
          lienWaiverCount: waivers.length,
        },
      },
    });

    const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
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
