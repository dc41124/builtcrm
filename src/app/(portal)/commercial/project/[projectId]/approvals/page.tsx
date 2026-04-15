import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getClientApprovals,
  type ClientApprovalView,
} from "@/domain/loaders/approvals";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialApprovalsReview } from "./approvals-review";

export default async function CommercialApprovalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ClientApprovalView;
  try {
    view = await getClientApprovals({
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

  return (
    <CommercialApprovalsReview
      projectName={view.project.name}
      rows={view.rows}
      totals={view.totals}
      originalContractCents={view.originalContractCents}
    />
  );
}
