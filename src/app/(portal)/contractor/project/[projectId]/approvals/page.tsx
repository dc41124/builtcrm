import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getContractorApprovals,
  type ContractorApprovalView,
} from "@/domain/loaders/approvals";
import { AuthorizationError } from "@/domain/permissions";

import { ContractorApprovalsWorkspace } from "./approvals-workspace";

export default async function ContractorApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ open?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { open } = await searchParams;
  const { session } = await requireServerSession();
  let view: ContractorApprovalView;
  try {
    view = await getContractorApprovals({
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

  // `?open=<approvalId>` supports deep-linking from the portfolio
  // approvals page. Validate the id exists in the loaded rows before
  // passing through so a stale link can't poison selection state.
  const openParam = Array.isArray(open) ? open[0] : open;
  const initialSelectedId =
    openParam && view.rows.some((r) => r.id === openParam)
      ? openParam
      : null;

  return (
    <ContractorApprovalsWorkspace
      nowMs={Date.now()}
      rows={view.rows}
      totals={view.totals}
      initialSelectedId={initialSelectedId}
    />
  );
}
