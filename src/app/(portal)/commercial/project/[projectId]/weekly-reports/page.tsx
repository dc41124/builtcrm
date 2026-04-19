import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getClientWeeklyReportDetail,
  getClientWeeklyReports,
  type ClientWeeklyReportDetailView,
  type ClientWeeklyReportsView,
} from "@/domain/loaders/weekly-reports";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialWeeklyReportsView } from "./commercial-weekly-reports-view";

// Step 39 / 4D #39 — commercial client weekly reports surface.
// Read-only doc-style layout matching the prototype: timeline left,
// document-style read on the right. Clients only ever see status='sent'
// reports.

export default async function CommercialWeeklyReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ report?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { report: reportParam } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let listView: ClientWeeklyReportsView;
  try {
    listView = await getClientWeeklyReports({
      session: session.session as unknown as { appUserId?: string | null },
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

  // Default to most-recent sent report.
  const requestedId = Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const validRequestedId =
    requestedId && listView.reports.some((r) => r.id === requestedId)
      ? requestedId
      : null;
  const activeId = validRequestedId ?? listView.reports[0]?.id ?? null;

  let detail: ClientWeeklyReportDetailView | null = null;
  if (activeId) {
    try {
      detail = await getClientWeeklyReportDetail({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
        reportId: activeId,
      });
    } catch {
      detail = null;
    }
  }

  return (
    <CommercialWeeklyReportsView
      projectId={projectId}
      listView={listView}
      detail={detail}
    />
  );
}
