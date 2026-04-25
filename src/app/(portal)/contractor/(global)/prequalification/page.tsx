import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getPrequalQueueView,
  getPrequalSubmissionDetailView,
  type PrequalSubmissionListRow,
} from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

import "../../../prequalification.css";
import { ContractorQueueWorkspace } from "./workspace";

export default async function ContractorPrequalReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    selected?: string;
    trade?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  let view: Awaited<ReturnType<typeof getPrequalQueueView>>;
  try {
    view = await getPrequalQueueView({ session: sessionLike });
  } catch (err) {
    if (err instanceof PlanGateError) {
      return (
        <div className="pq-content">
          <div className="pq-empty">
            <div className="pq-empty-title">
              Prequalification is a Professional plan feature
            </div>
          </div>
        </div>
      );
    }
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="pq-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }

  // Pick selected submission for the detail pane. URL ?selected=… wins;
  // otherwise the first row of the active tab.
  const tab = (sp.tab as string) || "review";
  const filtered = filterByTab(view.rows, tab);
  const selectedId = sp.selected ?? filtered[0]?.id ?? null;

  const selectedDetail = selectedId
    ? await getPrequalSubmissionDetailView({
        session: sessionLike,
        submissionId: selectedId,
      }).catch(() => null)
    : null;

  return (
    <div className="pq-content">
      <ContractorQueueWorkspace
        rows={view.rows}
        counts={view.counts}
        tab={tab}
        selectedId={selectedId}
        selectedDetail={selectedDetail}
        tradeFilter={sp.trade ?? "all"}
      />
    </div>
  );
}

function filterByTab(
  rows: PrequalSubmissionListRow[],
  tab: string,
): PrequalSubmissionListRow[] {
  const cutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
  switch (tab) {
    case "review":
      return rows.filter((r) => r.status === "submitted");
    case "under_review":
      return rows.filter((r) => r.status === "under_review");
    case "approved":
      return rows.filter((r) => r.status === "approved");
    case "expiring":
      return rows.filter(
        (r) =>
          r.status === "approved" &&
          r.expiresAt != null &&
          new Date(r.expiresAt).getTime() <= cutoff,
      );
    case "rejected":
      return rows.filter((r) => r.status === "rejected");
    default:
      return rows;
  }
}

