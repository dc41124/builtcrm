import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { DocumentsWorkspace } from "@/components/documents-workspace";
import { getDocumentsView } from "@/domain/loaders/documents";
import { AuthorizationError } from "@/domain/permissions";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  try {
    const view = await getDocumentsView(
      {
        session: session,
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
