import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getClientApprovals,
  type ClientApprovalView,
} from "@/domain/loaders/approvals";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialDecisionsReview } from "./decisions-review";

export default async function ResidentialDecisionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ClientApprovalView;
  try {
    view = await getClientApprovals({
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

  if (!view.isResidential) {
    return <pre>Forbidden: residential portal required.</pre>;
  }

  return (
    <ResidentialDecisionsReview
      rows={view.rows}
      totals={view.totals}
    />
  );
}
