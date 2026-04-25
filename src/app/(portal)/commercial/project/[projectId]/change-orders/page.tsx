import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getClientChangeOrders,
  type ClientChangeOrderView,
} from "@/domain/loaders/change-orders";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialChangeOrderReview } from "./change-order-review";

export default async function CommercialChangeOrdersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ClientChangeOrderView;
  try {
    view = await getClientChangeOrders({
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
    <CommercialChangeOrderReview
      projectName={view.project.name}
      rows={view.rows}
      totals={view.totals}
    />
  );
}
