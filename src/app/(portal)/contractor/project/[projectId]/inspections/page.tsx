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
  getInspections,
  getInspectionTemplates,
  type InspectionListRow,
  type InspectionTemplateRow,
} from "@/domain/loaders/inspections";
import { AuthorizationError } from "@/domain/permissions";

import { InspectionsWorkspace } from "./workspace";
import "../../../../inspections.css";

export default async function ContractorInspectionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let rows: InspectionListRow[] = [];
  let templates: InspectionTemplateRow[] = [];
  let projectName = "";
  let callerOrgId = "";
  try {
    const ctx = await getEffectiveContext(session, projectId);
    callerOrgId = ctx.organization.id;
    const [insList, tpls, projRow] = await Promise.all([
      getInspections({
        session: session,
        projectId,
      }),
      getInspectionTemplates({
        session: session,
        projectId,
      }),
      db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
    ]);
    rows = insList.rows;
    templates = tpls;
    projectName = projRow[0]?.name ?? "";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="in-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  // Sub orgs on this project for the create-modal assignee picker.
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
    <InspectionsWorkspace
      projectId={projectId}
      projectName={projectName}
      rows={rows}
      templates={templates.filter((t) => !t.isArchived)}
      subOrgs={subOrgs.filter((o) => !!o.name)}
    />
  );
}
