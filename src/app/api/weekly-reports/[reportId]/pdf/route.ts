import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, weeklyReports } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import {
  getClientWeeklyReportDetail,
  getContractorWeeklyReportDetail,
  type WeeklyReportDetail,
} from "@/domain/loaders/weekly-reports";
import { getResidentialWeeklyReportDetail } from "@/domain/loaders/weekly-reports-residential";
import { AuthorizationError } from "@/domain/permissions";
import { presignDownloadUrl } from "@/lib/storage";

// GET /api/weekly-reports/[reportId]/pdf?portal=commercial|residential|contractor
//
// Server-side renders the report via @react-pdf/renderer and returns the
// PDF binary as an attachment. Three rendering modes:
//
//   commercial   — sent-only filter, document-style PDF
//   residential  — sent-only filter, warm card-style PDF (uses reshaper)
//   contractor   — any status (incl. drafts), document-style PDF for
//                  contractor preview / archival
//
// PDF components live under src/lib/weekly-reports/pdf/ and are
// dynamic-imported here so @react-pdf/renderer's substantial bundle
// stays out of the client. Auth + load happen before the dynamic
// import so unauthenticated requests fail fast.
//
// Photo rendering: the route walks the report's photos section,
// presigns a 60-second R2 download URL per documentId, and passes a
// Map<documentId, url> to the PDF component. Missing URLs fall back
// to caption tiles so an R2 hiccup doesn't kill the whole render.

export const runtime = "nodejs"; // @react-pdf/renderer needs Node, not edge

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const url = new URL(req.url);
  const portalParam = url.searchParams.get("portal");
  const { session } = await requireServerSession();
  const sessionLike = session;

  // Look up the project so we can resolve the caller's role + scope.
  const [report] = await db
    .select({
      id: weeklyReports.id,
      projectId: weeklyReports.projectId,
      weekStart: weeklyReports.weekStart,
    })
    .from(weeklyReports)
    .where(eq(weeklyReports.id, reportId))
    .limit(1);
  if (!report) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let ctx: Awaited<ReturnType<typeof getEffectiveContext>>;
  try {
    ctx = await getEffectiveContext(sessionLike, report.projectId);
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

  // Determine effective portal for the render. Explicit ?portal= wins;
  // otherwise infer from role.
  let effectivePortal: "commercial" | "residential" | "contractor";
  if (portalParam === "commercial") effectivePortal = "commercial";
  else if (portalParam === "residential") effectivePortal = "residential";
  else if (portalParam === "contractor") effectivePortal = "contractor";
  else if (ctx.role === "residential_client") effectivePortal = "residential";
  else if (ctx.role === "contractor_admin" || ctx.role === "contractor_pm")
    effectivePortal = "contractor";
  else effectivePortal = "commercial";

  // Contractor mode requires a contractor caller — clients can't preview
  // unsent drafts via the contractor renderer.
  if (
    effectivePortal === "contractor" &&
    ctx.role !== "contractor_admin" &&
    ctx.role !== "contractor_pm"
  ) {
    return NextResponse.json(
      { error: "forbidden", message: "Contractor preview requires a contractor role" },
      { status: 403 },
    );
  }

  let pdfBuffer: Buffer;
  let filenameStem: string;

  try {
    const { pdf } = await import("@react-pdf/renderer");

    if (effectivePortal === "residential") {
      const detail = await getResidentialWeeklyReportDetail({
        session: sessionLike,
        projectId: report.projectId,
        reportId,
      });
      const photoUrls = await buildPhotoUrlMap(
        collectPhotoDocumentIdsFromReshaped(detail.reshaped),
      );
      const { ResidentialReportDocument } = await import(
        "@/lib/weekly-reports/pdf/residential-pdf"
      );
      const stream = await pdf(
        createElement(ResidentialReportDocument, {
          reshaped: detail.reshaped,
          homeName: detail.project.name,
          photoUrls,
        }) as ReactElement<DocumentProps>,
      ).toBuffer();
      pdfBuffer = await streamToBuffer(stream);
      filenameStem = `this-week-${report.weekStart}`;
    } else {
      // commercial OR contractor: same renderer, different loader.
      const detail =
        effectivePortal === "contractor"
          ? await getContractorWeeklyReportDetail({
              session: sessionLike,
              projectId: report.projectId,
              reportId,
            })
          : await getClientWeeklyReportDetail({
              session: sessionLike,
              projectId: report.projectId,
              reportId,
            });
      const photoUrls = await buildPhotoUrlMap(
        collectPhotoDocumentIds(detail.report),
      );
      const { CommercialReportDocument } = await import(
        "@/lib/weekly-reports/pdf/commercial-pdf"
      );
      const stream = await pdf(
        createElement(CommercialReportDocument, {
          detail: { project: detail.project, report: detail.report },
          photoUrls,
        }) as ReactElement<DocumentProps>,
      ).toBuffer();
      pdfBuffer = await streamToBuffer(stream);
      filenameStem =
        effectivePortal === "contractor"
          ? `weekly-report-draft-${report.weekStart}`
          : `weekly-report-${report.weekStart}`;
    }
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

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameStem}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PhotoLite = { documentId: string };

function collectPhotoDocumentIds(report: WeeklyReportDetail): string[] {
  const photosSection = report.sections.find(
    (s) => s.sectionType === "photos",
  );
  if (!photosSection) return [];
  const items = (photosSection.content.items as PhotoLite[] | undefined) ?? [];
  return items.map((p) => p.documentId).filter(Boolean);
}

function collectPhotoDocumentIdsFromReshaped(
  reshaped: { photos: Array<{ documentId: string }> },
): string[] {
  return reshaped.photos.map((p) => p.documentId).filter(Boolean);
}

// Look up storage_keys for the requested documentIds and presign each.
// Returns an empty map on any failure so the PDF still renders (with
// caption-tile fallbacks). 60-second TTL is plenty for the render to
// complete.
async function buildPhotoUrlMap(
  documentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (documentIds.length === 0) return map;

  try {
    const rows = await db
      .select({ id: documents.id, storageKey: documents.storageKey })
      .from(documents)
      .where(inArray(documents.id, documentIds));

    await Promise.all(
      rows.map(async (r) => {
        try {
          const url = await presignDownloadUrl({
            key: r.storageKey,
            expiresInSeconds: 60,
          });
          map.set(r.id, url);
        } catch {
          // skip — PDF falls back to caption tile for this photo
        }
      }),
    );
  } catch {
    // skip — empty map → all photos render as caption tiles
  }
  return map;
}

// `pdf().toBuffer()` returns a Node Readable stream in @react-pdf/renderer
// v4 — collect it into a Buffer so we can hand a fixed payload to the
// Response constructor.
async function streamToBuffer(
  stream: NodeJS.ReadableStream | Buffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
