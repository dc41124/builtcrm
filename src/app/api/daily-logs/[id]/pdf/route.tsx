import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { renderToBuffer } from "@react-pdf/renderer";

import { db } from "@/db/client";
import { dailyLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getEffectiveContext } from "@/domain/context";
import { getDailyLog } from "@/domain/loaders/daily-logs";
import { AuthorizationError } from "@/domain/permissions";
import {
  CommercialClientDailyLogPdf,
  ContractorDailyLogPdf,
  ResidentialClientDailyLogPdf,
} from "@/lib/pdf/daily-log";

// GET /api/daily-logs/[id]/pdf
//
// Streams a PDF rendering of a single daily log. Role-aware:
//   - contractor / subcontractor → full detail PDF
//   - commercial_client → redacted PDF (no crew, no delays, no amendments)
//   - residential_client → journal-style PDF with residential fields
//
// Redaction happens at loader time (getDailyLog returns mode=redacted for
// clients). There is NO way for a client to pull the contractor PDF via
// URL tampering — the loader won't give us the data to render it.

// React-PDF's layout engine is pure JS but noticeably slow under the
// Edge runtime. Force Node runtime so we use the bundled pdfkit and
// get proper fs / stream support.
export const runtime = "nodejs";
// Downloads are always current — don't let Next cache the buffer.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const log = await getDailyLog({
      session: session,
      logId: id,
    });

    // Pick the right template. For "redacted" shape we also need the
    // caller's role to know whether to use the commercial or residential
    // template. Fetch effective context off the log's projectId.
    let element: React.ReactElement;
    let fileLabel: string;

    if (log.mode === "full") {
      element = <ContractorDailyLogPdf log={log} />;
      fileLabel = `daily-log-${log.logDate}`;
    } else {
      // Redacted — use role to pick template. Roundtrip through
      // getEffectiveContext is redundant with the loader but keeps this
      // branch self-contained; could be optimized later by threading
      // role through getDailyLog's return.
      const [row] = await db
        .select({ projectId: dailyLogs.projectId })
        .from(dailyLogs)
        .where(eq(dailyLogs.id, id))
        .limit(1);
      if (!row) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      const ctx = await getEffectiveContext(
        session,
        row.projectId,
      );
      if (ctx.role === "residential_client") {
        element = <ResidentialClientDailyLogPdf log={log} />;
        fileLabel = `project-journal-${log.logDate}`;
      } else {
        element = <CommercialClientDailyLogPdf log={log} />;
        fileLabel = `site-update-${log.logDate}`;
      }
    }

    const pdfBuffer = await renderToBuffer(element);
    // Node Buffer / Uint8Array resist assignment to Web BodyInit under
    // Next's TS types. Slice to a clean ArrayBuffer (copies the bytes
    // so the returned object is decoupled from Node internals) and
    // wrap in a Blob — the most portable BodyInit.
    const ab = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(new Blob([ab], { type: "application/pdf" }), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileLabel}.pdf"`,
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
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
