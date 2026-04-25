import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getClientProjectView,
  type ClientProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialPaymentsView } from "./payments-view";

export default async function CommercialPaymentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ClientProjectView;
  try {
    view = await getClientProjectView({
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
    <CommercialPaymentsView
      projectId={projectId}
      projectName={view.project.name}
      drawRequests={view.drawRequests}
      approvals={view.approvals}
    />
  );
}
