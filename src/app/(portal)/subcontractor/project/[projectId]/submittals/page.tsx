import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects } from "@/db/schema";
import {
  getSubmittals,
  type SubmittalListRow,
} from "@/domain/loaders/submittals";
import { AuthorizationError } from "@/domain/permissions";

import { SubmittalsWorkspace } from "../../../../contractor/project/[projectId]/submittals/workspace";

export default async function SubcontractorSubmittalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let items: SubmittalListRow[] = [];
  let projectName = "";
  try {
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

  // Sub doesn't need the sub-org picker — they always submit for their
  // own org. Empty array; workspace hides the dropdown in sub mode.
  return (
    <SubmittalsWorkspace
      role="subcontractor"
      projectId={projectId}
      projectName={projectName}
      items={items}
      subOrgs={[]}
    />
  );
}
