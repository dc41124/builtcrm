import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getResidentialWeeklyReportDetail,
  getResidentialWeeklyReports,
  type ResidentialWeeklyReportDetailView,
  type ResidentialWeeklyReportsView,
} from "@/domain/loaders/weekly-reports-residential";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialWeeklyReportsView as UI } from "./residential-weekly-reports-view";

// Step 39 / 4D #39 — residential client weekly reports surface ("This week
// at your home"). Same `weekly_reports` data as the contractor and
// commercial views; the residential reshaper at
// src/domain/loaders/weekly-reports-residential.ts projects the sections
// into warmer cards (progress / decisions / upcoming / questions) per
// the prototype.

export default async function ResidentialWeeklyReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ report?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { report: reportParam } = await searchParams;
  const { session } = await requireServerSession();
  let listView: ResidentialWeeklyReportsView;
  try {
    listView = await getResidentialWeeklyReports({
      session: session,
      projectId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const requestedId = Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const validRequestedId =
    requestedId && listView.reports.some((r) => r.id === requestedId)
      ? requestedId
      : null;
  const activeId = validRequestedId ?? listView.reports[0]?.id ?? null;

  let detail: ResidentialWeeklyReportDetailView | null = null;
  if (activeId) {
    try {
      detail = await getResidentialWeeklyReportDetail({
        session: session,
        projectId,
        reportId: activeId,
      });
    } catch {
      detail = null;
    }
  }

  // Strip `context` before passing to the client component — permissions.can
  // is a function and can't cross the server/client boundary.
  const { context: _lvCtx, ...listViewProps } = listView;
  const detailProps = detail
    ? (() => {
        const { context: _dCtx, ...rest } = detail;
        return rest;
      })()
    : null;

  return (
    <UI projectId={projectId} listView={listViewProps} detail={detailProps} />
  );
}
