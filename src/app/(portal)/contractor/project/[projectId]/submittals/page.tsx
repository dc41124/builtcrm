import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  organizations,
  projectOrganizationMemberships,
  projects,
} from "@/db/schema";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let items: SubmittalListRow[] = [];
  let projectName = "";
  try {
    items = await getSubmittals({
      session: session.session as unknown as { appUserId?: string | null },
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
  const subOrgs = await db
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
    .orderBy(organizations.name);

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
