import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { DocumentsWorkspace } from "@/components/documents-workspace";
import { getDocumentsView } from "@/domain/loaders/documents";
import { AuthorizationError } from "@/domain/permissions";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getDocumentsView(
      {
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      },
      "subcontractor",
    );
    return (
      <DocumentsWorkspace
        portal="subcontractor"
        projectId={view.project.id}
        projectName={view.project.name}
        currentUserId={view.currentUserId}
        canWrite={view.canWrite}
        canManageAnyDoc={view.canManageAnyDoc}
        documents={view.documents}
        linkableItems={view.linkableItems}
      />
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
