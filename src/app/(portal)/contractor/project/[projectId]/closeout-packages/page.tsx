import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import {
  getCloseoutActivityForOrg,
  getCloseoutPackagesForProject,
  type CloseoutActivityRow,
  type CloseoutPackageListRow,
} from "@/domain/loaders/closeout-packages";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../closeout-packages.css";
import { CloseoutWorkspace } from "./workspace";

export default async function ContractorCloseoutPackagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  let rows: CloseoutPackageListRow[] = [];
  let activity: CloseoutActivityRow[] = [];
  let projectName = "";
  try {
    const ctx = await getEffectiveContext(sessionLike, projectId);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      return (
        <div className="cp-content">
          <div className="cp-empty">
            <div className="cp-empty-title">Closeout packages</div>
            <div className="cp-empty-sub">
              This workspace is contractor-only. Owners see closeout packages in
              their portal.
            </div>
          </div>
        </div>
      );
    }
    const [view, act, projRow] = await Promise.all([
      getCloseoutPackagesForProject({ session: sessionLike, projectId }),
      getCloseoutActivityForOrg({
        session: sessionLike,
        organizationId: ctx.project.contractorOrganizationId,
        limit: 8,
      }),
      db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
    ]);
    rows = view.rows;
    activity = act;
    projectName = projRow[0]?.name ?? "";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="cp-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="cp-content">
      <CloseoutWorkspace
        projectId={projectId}
        projectName={projectName}
        rows={rows}
        activity={activity}
      />
    </div>
  );
}
