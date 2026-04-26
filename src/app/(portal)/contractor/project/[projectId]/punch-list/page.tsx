import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import { organizations, projectOrganizationMemberships, projects } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import {
  getPunchItems,
  type PunchItemListRow,
} from "@/domain/loaders/punch-list";
import { AuthorizationError } from "@/domain/permissions";

import { PunchListWorkspace } from "./workspace";

export default async function ContractorPunchListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let items: PunchItemListRow[] = [];
  let projectName = "";
  let callerOrgId = "";
  try {
    const ctx = await getEffectiveContext(session, projectId);
    callerOrgId = ctx.organization.id;
    items = await getPunchItems({
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

  // Pull the list of sub orgs on this project for the New Item assignee
  // dropdown. Contractor-only, so we fetch here on the server. Filters
  // to membershipType='subcontractor' + status='active' — the GC's own
  // org + any other non-sub orgs (clients, consultants) don't belong
  // in a punch-item assignee picker.
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
    <PunchListWorkspace
      role="contractor"
      projectId={projectId}
      projectName={projectName}
      items={items}
      subOrgs={subOrgs.filter((o) => !!o.name)}
    />
  );
}
