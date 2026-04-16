import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { organizations, projects } from "@/db/schema";
import {
  getClientProjectView,
  type ClientProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialProjectHome } from "./project-home";

export default async function CommercialProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ClientProjectView;
  try {
    view = await getClientProjectView({
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
    <CommercialProjectHome
      projectId={projectId}
      projectName={view.project.name}
      contractorName={view.contractorOrganizationName ?? "Your contractor"}
      currentPhase={view.currentPhase}
      milestones={view.milestones}
      approvals={view.approvals}
      openRequests={view.openRequests}
      drawRequests={view.drawRequests}
      decisions={view.decisions}
      activityTrail={view.activityTrail}
      gcContacts={view.gcContacts ?? []}
      conversations={view.conversations}
    />
  );
}
