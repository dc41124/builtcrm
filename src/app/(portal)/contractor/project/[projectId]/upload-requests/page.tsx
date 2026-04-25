import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getContractorProjectView,
  type ContractorProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { ContractorUploadRequestsWorkspace } from "./upload-request-workspace";

export default async function ContractorUploadRequestsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view: ContractorProjectView;
  try {
    view = await getContractorProjectView({
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

  const subcontractorOrgs = Array.from(
    new Map(
      view.teamMembers
        .filter((m) => m.organizationType === "subcontractor" && m.organizationName)
        .map((m) => [m.organizationId, { id: m.organizationId, name: m.organizationName! }]),
    ).values(),
  );

  return (
    <ContractorUploadRequestsWorkspace
      nowMs={Date.now()}
      projectId={view.project.id}
      projectName={view.project.name}
      requests={view.uploadRequests}
      subcontractorOrgs={subcontractorOrgs}
    />
  );
}
