import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getClientProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

export default async function ClientProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
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

  const decisionsLabel = view.isResidential ? "Scope Changes" : "Change Orders";
  const requestsLabel = view.isResidential ? "Questions" : "Open RFIs";

  return (
    <main>
      <h1>
        {view.isResidential ? "Residential" : "Commercial"} Client ·{" "}
        {view.project.name}
      </h1>

      <h2>Milestones</h2>
      <ul>
        {view.milestones.map((m) => (
          <li key={m.id}>
            {m.scheduledDate.toISOString().slice(0, 10)} — {m.title} [{m.milestoneStatus}]
          </li>
        ))}
      </ul>

      <h2>{decisionsLabel}</h2>
      <ul>
        {view.decisions.map((d) => (
          <li key={d.id}>{d.title} [{d.changeOrderStatus}]</li>
        ))}
      </ul>

      <h2>{requestsLabel}</h2>
      <ul>
        {view.openRequests.map((r) => (
          <li key={r.id}>{r.subject} [{r.rfiStatus}]</li>
        ))}
      </ul>
    </main>
  );
}
