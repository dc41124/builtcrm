import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getContractorWeeklyReportDetail,
  getContractorWeeklyReports,
  type ContractorWeeklyReportDetailView,
  type ContractorWeeklyReportsView,
} from "@/domain/loaders/weekly-reports";
import { AuthorizationError } from "@/domain/permissions";

import { WeeklyReportsWorkspace } from "./weekly-reports-workspace";

// Step 39 / 4D #39 — contractor per-project weekly reports surface.
// Single page that mirrors the prototype's 3-column contractor view:
// list (left) | editor (center) | rail (right). Selected report ID
// is in the URL (?report=<id>) so refresh + share keep the same focus.

export default async function ContractorWeeklyReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ report?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { report: reportParam } = await searchParams;
  const { session } = await requireServerSession();
  let listView: ContractorWeeklyReportsView;
  try {
    listView = await getContractorWeeklyReports({
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

  // Pick the active report: explicit ?report= takes priority, otherwise
  // the most recent (the loader returns rows sorted by week_start desc).
  const requestedId = Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const validRequestedId =
    requestedId && listView.reports.some((r) => r.id === requestedId)
      ? requestedId
      : null;
  const activeId = validRequestedId ?? listView.reports[0]?.id ?? null;

  let detail: ContractorWeeklyReportDetailView | null = null;
  if (activeId) {
    try {
      detail = await getContractorWeeklyReportDetail({
        session: session,
        projectId,
        reportId: activeId,
      });
    } catch {
      // fall through with detail=null; the workspace handles it
      detail = null;
    }
  }

  // Strip `context` before handing off to the client component — it carries
  // permissions.can (a function), which Next.js can't serialize across the
  // server/client boundary. The workspace doesn't need context.
  const { context: _lvCtx, ...listViewProps } = listView;
  const detailProps = detail
    ? (() => {
        const { context: _dCtx, ...rest } = detail;
        return rest;
      })()
    : null;

  return (
    <WeeklyReportsWorkspace
      projectId={projectId}
      listView={listViewProps}
      detail={detailProps}
    />
  );
}
