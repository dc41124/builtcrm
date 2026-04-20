import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { weeklyReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getEffectiveContext } from "@/domain/context";
import { getClientWeeklyReportDetail } from "@/domain/loaders/weekly-reports";
import { getResidentialWeeklyReportDetail } from "@/domain/loaders/weekly-reports-residential";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/weekly-reports/[reportId]/pdf?portal=commercial|residential
//
// Server-side renders the report via @react-pdf/renderer and returns the
// PDF binary as an attachment. Clients only see status='sent' reports
// (matches the read-loader gate).
//
// PDF components live under src/lib/weekly-reports/pdf/ and are
// dynamic-imported here so @react-pdf/renderer's substantial bundle
// stays out of the client. Auth + load are done before the dynamic
// import so unauthenticated requests fail fast.
//
// `portal` query param picks which renderer + which loader (residential
// goes through the reshaper). Inferred from the caller's role if not
// supplied — contractor previews currently route to commercial.

export const runtime = "nodejs"; // @react-pdf/renderer needs Node, not edge

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const url = new URL(req.url);
  const portalParam = url.searchParams.get("portal");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

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

  // Determine effective portal for the render. Explicit ?portal= wins
  // (lets the contractor preview either client variant); otherwise infer.
  const effectivePortal: "commercial" | "residential" =
    portalParam === "commercial"
      ? "commercial"
      : portalParam === "residential"
        ? "residential"
        : ctx.role === "residential_client"
          ? "residential"
          : "commercial";

  let pdfBuffer: Buffer;
  let filenameStem: string;

  try {
    // Dynamic-import the PDF lib so it only ships in this route's
    // server bundle, never in client pages.
    const { pdf } = await import("@react-pdf/renderer");

    if (effectivePortal === "residential") {
      const detail = await getResidentialWeeklyReportDetail({
        session: sessionLike,
        projectId: report.projectId,
        reportId,
      });
      const { ResidentialReportDocument } = await import(
        "@/lib/weekly-reports/pdf/residential-pdf"
      );
      const stream = await pdf(
        createElement(ResidentialReportDocument, {
          reshaped: detail.reshaped,
          homeName: detail.project.name,
        }) as ReactElement<DocumentProps>,
      ).toBuffer();
      pdfBuffer = await streamToBuffer(stream);
      filenameStem = `this-week-${report.weekStart}`;
    } else {
      const detail = await getClientWeeklyReportDetail({
        session: sessionLike,
        projectId: report.projectId,
        reportId,
      });
      const { CommercialReportDocument } = await import(
        "@/lib/weekly-reports/pdf/commercial-pdf"
      );
      const stream = await pdf(
        createElement(CommercialReportDocument, {
          detail,
        }) as ReactElement<DocumentProps>,
      ).toBuffer();
      pdfBuffer = await streamToBuffer(stream);
      filenameStem = `weekly-report-${report.weekStart}`;
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
