import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import {
  organizations,
  projectOrganizationMemberships,
  projects,
} from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import {
  getSubmittals,
  type SubmittalListRow,
} from "@/domain/loaders/submittals";
import { AuthorizationError } from "@/domain/permissions";

import { SubmittalsWorkspace } from "./workspace";

export default async function ContractorSubmittalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let items: SubmittalListRow[] = [];
  let projectName = "";
  let callerOrgId = "";
  try {
    const ctx = await getEffectiveContext(session, projectId);
    callerOrgId = ctx.organization.id;
    items = await getSubmittals({
      session: session,
      projectId,
    });
    const [row] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    projectName = row?.name ?? "";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  // Sub org options for the "submit on behalf of" dropdown in the
  // contractor New Submittal drawer. Active sub memberships only.
  // Contractor caller; multi-org POM policy clause B (project ownership)
  // returns every sub POM on the project.
  const subOrgs = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        id: organizations.id,
        name: organizations.name,
      })
      .from(projectOrganizationMemberships)
      .innerJoin(
        organizations,
        eq(organizations.id, projectOrganizationMemberships.organizationId),
      )
      .where(
        and(
          eq(projectOrganizationMemberships.projectId, projectId),
          eq(projectOrganizationMemberships.membershipType, "subcontractor"),
          eq(projectOrganizationMemberships.membershipStatus, "active"),
        ),
      )
      .orderBy(organizations.name),
  );

  return (
    <SubmittalsWorkspace
      role="contractor"
      projectId={projectId}
      projectName={projectName}
      items={items}
      subOrgs={subOrgs.filter((o) => !!o.name)}
    />
  );
}
