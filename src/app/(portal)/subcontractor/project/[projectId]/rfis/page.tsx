import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getSubcontractorProjectView,
  type SubcontractorProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { SubRfiResponseWorkspace } from "./rfi-response-workspace";

export default async function SubcontractorRfisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: SubcontractorProjectView;
  try {
    view = await getSubcontractorProjectView({
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
    <SubRfiResponseWorkspace
      nowMs={Date.now()}
      projectName={view.project.name}
      rfis={view.assignedRfis}
    />
  );
}
