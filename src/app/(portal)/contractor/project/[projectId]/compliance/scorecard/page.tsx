import { notFound, redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { loadProjectRbqScorecardView } from "@/domain/loaders/project-rbq-scorecard";
import { AuthorizationError } from "@/domain/permissions";

import { ProjectRbqScorecardUI } from "./project-rbq-scorecard-ui";

// Step 66 — Project compliance scorecard (View 03 of the prototype).
//
// Per-sub rollup of RBQ + Insurance + CNESST + CCQ status across every
// non-contractor org on the project. The existing project compliance
// page at ../page.tsx is record-centric (one row per compliance record);
// this is sub-centric (one row per org).

export const dynamic = "force-dynamic";

export default async function ProjectComplianceScorecardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  let contractorOrgId: string;
  let isAdmin = false;
  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    contractorOrgId = ctx.organization.id;
    isAdmin = ctx.role === "contractor_admin";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div style={{ padding: 24, fontFamily: "'Instrument Sans',sans-serif" }}>
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }

  const view = await loadProjectRbqScorecardView(projectId, contractorOrgId);
  if (!view) notFound();

  return <ProjectRbqScorecardUI view={view} isAdmin={isAdmin} />;
}
