import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { loadCommercialProjectPhotos } from "@/domain/loaders/commercial-photos";
import { getClientProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialPhotosView } from "./photos-view";

export default async function CommercialPhotosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let callerOrgId: string;
  try {
    const view = await getClientProjectView({
      session: session,
      projectId,
    });
    callerOrgId = view.context.organization.id;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const data = await loadCommercialProjectPhotos(projectId, callerOrgId);

  return <CommercialPhotosView projectId={projectId} data={data} nowMs={Date.now()} />;
}
