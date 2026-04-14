import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getSubcontractorProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { SubComplianceList } from "./compliance-ui";
import { SubRfisList } from "./rfis-ui";
import { PendingUploadRequestsList } from "./upload-requests-ui";

export default async function SubcontractorProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getSubcontractorProjectView({
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
    <main>
      <h1>Subcontractor · {view.project.name}</h1>
      <p>
        Org: {view.context.organization.name} · Work scope:{" "}
        {view.scope.workScope ?? "—"} · Phase scope: {view.scope.phaseScope ?? "—"}
      </p>

      <h2>My Milestones</h2>
      <ul>
        {view.myMilestones.map((m) => (
          <li key={m.id}>
            {m.scheduledDate.toISOString().slice(0, 10)} — {m.title} [{m.milestoneStatus}]
          </li>
        ))}
      </ul>

      <h2>RFIs Assigned to Me</h2>
      <SubRfisList rfis={view.assignedRfis} />

      <h2>Pending Upload Requests</h2>
      <PendingUploadRequestsList
        projectId={view.project.id}
        requests={view.pendingUploadRequests}
      />

      <h2>Change Orders</h2>
      <ul>
        {view.assignedChangeOrders.map((c) => (
          <li key={c.id}>{c.title} [{c.changeOrderStatus}]</li>
        ))}
      </ul>

      <h2>Compliance</h2>
      <SubComplianceList
        projectId={view.project.id}
        records={view.complianceRecords}
      />
    </main>
  );
}
