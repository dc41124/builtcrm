import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { MessagesWorkspace } from "@/components/messages-workspace";
import { getMessagesView } from "@/domain/loaders/messages";
import { AuthorizationError } from "@/domain/permissions";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  try {
    const view = await getMessagesView(
      {
        session: session,
        projectId,
      },
      "commercial",
    );
    return (
      <MessagesWorkspace
        nowMs={Date.now()}
        portal="commercial"
        projectId={view.project.id}
        currentUserId={view.currentUserId}
        conversations={view.conversations}
        participantOptions={view.participantOptions}
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
