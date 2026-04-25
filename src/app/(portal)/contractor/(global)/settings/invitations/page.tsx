import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getContractorOrgContext } from "@/domain/loaders/integrations";
import {
  listInvitationsForOrganization,
  listProjectsForOrganization,
} from "@/domain/loaders/invitations";
import { AuthorizationError } from "@/domain/permissions";

import { InvitationsView } from "./invitations-ui";

export default async function ContractorInvitationsPage() {
  const { session } = await requireServerSession();
  let context;
  try {
    context = await getContractorOrgContext(
      session,
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const [projectList, invitationList] = await Promise.all([
    listProjectsForOrganization(context.organization.id),
    listInvitationsForOrganization(context.organization.id),
  ]);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <InvitationsView
        organizationName={context.organization.name}
        projects={projectList}
        invitations={invitationList}
      />
    </main>
  );
}
