import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getClientProjectView,
  type ClientProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialBudgetView } from "./budget-view";

export default async function ResidentialBudgetPage({
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
    <ResidentialBudgetView
      drawRequests={view.drawRequests}
      milestones={view.milestones}
      selections={view.selections}
    />
  );
}
