import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getClientProjectView,
  type ClientProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialProjectHome } from "./project-home";

export default async function ResidentialProjectHomePage({
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
    <ResidentialProjectHome
      nowMs={Date.now()}
      projectId={projectId}
      projectName={view.project.name}
      contractorName={view.contractorOrganizationName ?? "Your builder"}
      currentPhase={view.currentPhase}
      milestones={view.milestones}
      approvals={view.approvals}
      decisions={view.decisions}
      selections={view.selections}
      drawRequests={view.drawRequests}
      activityTrail={view.activityTrail}
      gcContacts={view.gcContacts ?? []}
      conversations={view.conversations}
    />
  );
}
