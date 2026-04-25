import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { loadCommercialProjectPhotos } from "@/domain/loaders/commercial-photos";
import {
  getClientProjectView,
  type ClientProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialProgressView } from "./progress-view";

export default async function ResidentialProgressPage({
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

  const photoData = await loadCommercialProjectPhotos(projectId);

  return (
    <ResidentialProgressView
      projectId={projectId}
      nowMs={Date.now()}
      contractorName={view.contractorOrganizationName ?? "Your builder"}
      currentPhase={view.currentPhase}
      activityTrail={view.activityTrail}
      milestones={view.milestones}
      photoData={photoData}
    />
  );
}
