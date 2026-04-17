import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    await getClientProjectView({
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

  const data = await loadCommercialProjectPhotos(projectId);

  return <CommercialPhotosView projectId={projectId} data={data} nowMs={Date.now()} />;
}
