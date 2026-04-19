import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import {
  getPunchItems,
  type PunchItemListRow,
} from "@/domain/loaders/punch-list";
import { AuthorizationError } from "@/domain/permissions";

import { PunchListWorkspace } from "../../../../contractor/project/[projectId]/punch-list/workspace";

// Subcontractor sees the same workspace surface but the loader filters
// to items where `assigneeOrgId = their org`. Pass `role="subcontractor"`
// so the workspace swaps the accent color + available actions + summary
// strip layout per the paired JSX spec.

export default async function SubcontractorPunchListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let items: PunchItemListRow[] = [];
  let projectName = "";
  try {
    items = await getPunchItems({
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

  return (
    <PunchListWorkspace
      role="subcontractor"
      projectId={projectId}
      projectName={projectName}
      items={items}
      subOrgs={[]}
    />
  );
}
