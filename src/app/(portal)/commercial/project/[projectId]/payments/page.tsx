import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getClientProjectView,
  type ClientProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialPaymentsView } from "./payments-view";

export default async function CommercialPaymentsPage({
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
    <CommercialPaymentsView
      projectId={projectId}
      projectName={view.project.name}
      drawRequests={view.drawRequests}
      approvals={view.approvals}
    />
  );
}
