import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getContractorProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import {
  ContractorApprovalsList,
  CreateApprovalForm,
} from "./approvals-ui";
import {
  ContractorComplianceList,
  CreateComplianceForm,
} from "./compliance-ui";
import { ContractorRfisList, CreateRfiForm } from "./rfis-ui";
import { ContractorDrawRequestsPanel } from "./draw-requests-ui";
import { ContractorRetainagePanel } from "./retainage-releases-ui";
import { ContractorSovPanel } from "./sov-ui";
import {
  ContractorUploadRequestsList,
  CreateUploadRequestForm,
} from "./upload-requests-ui";

export default async function ContractorProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getContractorProjectView({
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
      <h1>Contractor · {view.project.name}</h1>
      <p>Role: {view.context.role} · Team members: {view.teamCount}</p>

      <h2>Milestones</h2>
      <ul>
        {view.milestones.map((m) => (
          <li key={m.id}>
            {m.scheduledDate.toISOString().slice(0, 10)} — {m.title} [{m.milestoneStatus}]
          </li>
        ))}
      </ul>

      <h2>RFIs</h2>
      <ContractorRfisList rfis={view.rfis} />
      <CreateRfiForm projectId={view.project.id} />

      <h2>Change Orders</h2>
      <ul>
        {view.changeOrders.map((c) => (
          <li key={c.id}>{c.title} [{c.changeOrderStatus}]</li>
        ))}
      </ul>

      <h2>Upload Requests</h2>
      <ContractorUploadRequestsList requests={view.uploadRequests} />
      <CreateUploadRequestForm projectId={view.project.id} />

      <h2>Approvals</h2>
      <ContractorApprovalsList approvals={view.approvals} />
      <CreateApprovalForm projectId={view.project.id} />

      <h2>Compliance</h2>
      <ContractorComplianceList records={view.complianceRecords} />
      <CreateComplianceForm projectId={view.project.id} />

      <h2>Schedule of Values</h2>
      <ContractorSovPanel projectId={view.project.id} sov={view.scheduleOfValues} />

      <h2>Draw Requests</h2>
      <ContractorDrawRequestsPanel
        projectId={view.project.id}
        sovId={view.scheduleOfValues?.id ?? null}
        sovStatus={view.scheduleOfValues?.sovStatus ?? null}
        draws={view.drawRequests}
      />

      <h2>Retainage Releases</h2>
      <ContractorRetainagePanel
        projectId={view.project.id}
        releases={view.retainageReleases}
        sovLines={
          view.scheduleOfValues?.lineItems.map((l) => ({
            id: l.id,
            itemNumber: l.itemNumber,
            description: l.description,
          })) ?? []
        }
      />
    </main>
  );
}
