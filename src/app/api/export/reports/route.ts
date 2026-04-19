import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { auth } from "@/auth/config";
import { getContractorReportsData } from "@/domain/loaders/reports";
import { AuthorizationError } from "@/domain/permissions";
import { ReportsDocument, type ReportsPdfData } from "@/lib/pdf/reports-template";

// GET /api/export/reports
//
// Returns the contractor's portfolio reports dashboard as a PDF.
// Uses @react-pdf/renderer with the same renderToBuffer pattern as
// the payment-receipt + draw-package endpoints. No args — the loader
// resolves the signed-in contractor's org automatically.

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const view = await getContractorReportsData({
      session: session.session as unknown as { appUserId?: string | null },
    });

    const data: ReportsPdfData = {
      generatedAtIso: view.generatedAtIso,
      organizationName: view.context.organization.name,
      kpis: view.kpis,
      projects: view.projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        phase: p.phase,
        contractValueCents: p.contractValueCents,
        billedCents: p.billedCents,
        percentComplete: p.percentComplete,
        scheduleVarianceDays: p.scheduleVarianceDays,
        complianceStatus: p.complianceStatus,
        openItemsCount: p.openItemsCount,
      })),
      aging: view.aging.map((a) => ({
        label: a.label,
        rfis: a.rfis,
        changeOrders: a.changeOrders,
      })),
    };

    // The renderToBuffer signature accepts DocumentElement; the cast
    // mirrors how draw-package handles the same typing situation.
    const buffer = await renderToBuffer(ReportsDocument({ data }));

    const filename = `reports-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
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
