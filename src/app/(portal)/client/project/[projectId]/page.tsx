import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getClientProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { ClientApprovalsList } from "./approvals-ui";
import { DocumentsPanel } from "@/components/documents-ui";
import { MessagesPanel } from "@/components/messages-ui";
import { ClientDrawReviewPanel } from "./draw-review-ui";
import { ClientRetainagePanel } from "./retainage-releases-ui";
import { ClientSelectionsPanel } from "./selections-ui";

export default async function ClientProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getClientProjectView({
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

  const decisionsLabel = view.isResidential ? "Scope Changes" : "Change Orders";
  const requestsLabel = view.isResidential ? "Questions" : "Open RFIs";
  const approvalsLabel = view.isResidential ? "Decisions" : "Approval Center";

  return (
    <main>
      <h1>
        {view.isResidential ? "Residential" : "Commercial"} Client ·{" "}
        {view.project.name}
      </h1>

      <h2>
        {view.isResidential ? "Your Timeline" : "Schedule"} ·{" "}
        <a href={`/client/project/${view.project.id}/schedule`}>
          View full schedule →
        </a>
      </h2>
      <ul>
        {view.milestones.slice(0, 5).map((m) => (
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

      <h2>{approvalsLabel}</h2>
      <ClientApprovalsList
        approvals={view.approvals}
        isResidential={view.isResidential}
      />

      <h2>{requestsLabel}</h2>
      <ul>
        {view.openRequests.map((r) => (
          <li key={r.id}>{r.subject} [{r.rfiStatus}]</li>
        ))}
      </ul>

      <h2>{view.isResidential ? "Progress Billings" : "Draw Requests"}</h2>
      <ClientDrawReviewPanel
        draws={view.drawRequests}
        isResidential={view.isResidential}
      />

      <h2>Retainage Releases</h2>
      <ClientRetainagePanel releases={view.retainageReleases} />

      <h2>Documents</h2>
      <DocumentsPanel
        projectId={view.project.id}
        documents={view.documents}
        currentUserId={view.context.user.id}
        canWrite={false}
      />

      <h2>Messages</h2>
      <MessagesPanel
        projectId={view.project.id}
        conversations={view.conversations}
        currentUserId={view.context.user.id}
        canCreate={false}
      />

      {view.isResidential && (
        <>
          <h2>Selections</h2>
          <ClientSelectionsPanel categories={view.selections} />
        </>
      )}
    </main>
  );
}
