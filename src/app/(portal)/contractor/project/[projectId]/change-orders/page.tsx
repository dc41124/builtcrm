import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getContractorChangeOrders,
  type ContractorChangeOrderView,
} from "@/domain/loaders/change-orders";
import { AuthorizationError } from "@/domain/permissions";

import { ContractorChangeOrderWorkspace } from "./change-order-workspace";

export default async function ContractorChangeOrdersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ContractorChangeOrderView;
  try {
    view = await getContractorChangeOrders({
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

  return (
    <ContractorChangeOrderWorkspace
      nowMs={Date.now()}
      projectId={view.project.id}
      projectName={view.project.name}
      rows={view.rows}
      totals={view.totals}
    />
  );
}
