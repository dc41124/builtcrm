import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getContractorProjectView,
  type ContractorProjectView,
} from "@/domain/loaders/project-home";
import {
  getActivePrequalForPair,
  type PrequalBadgeStatus,
} from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";

import {
  ContractorComplianceWorkspace,
  type PrequalBadgeData,
} from "./compliance-workspace";

import "../../../../prequalification.css";

export default async function ContractorCompliancePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ContractorProjectView;
  try {
    view = await getContractorProjectView({
      session: session.session as unknown as { appUserId?: string | null },
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

  // Resolve a prequal badge for every distinct sub org that appears in
  // the compliance records. The loader is request-memoized via react.cache,
  // so multiple compliance rows for the same sub still hit the DB once.
  const subOrgIds = Array.from(
    new Set(view.complianceRecords.map((r) => r.organizationId)),
  );
  const contractorOrgId = view.project.contractorOrganizationId;
  const prequalEntries = await Promise.all(
    subOrgIds.map(async (subOrgId) => {
      try {
        const active = await getActivePrequalForPair(contractorOrgId, subOrgId);
        return [subOrgId, active] as const;
      } catch {
        return [
          subOrgId,
          { status: "none" as PrequalBadgeStatus, expiresAt: undefined },
        ] as const;
      }
    }),
  );
  const prequalByOrg: Record<string, PrequalBadgeData> = {};
  for (const [orgId, active] of prequalEntries) {
    prequalByOrg[orgId] = {
      status: active.status,
      expiresAt: active.expiresAt ? active.expiresAt.toISOString() : null,
    };
  }

  return (
    <ContractorComplianceWorkspace
      nowMs={Date.now()}
      projectId={view.project.id}
      projectName={view.project.name}
      records={view.complianceRecords}
      prequalByOrg={prequalByOrg}
    />
  );
}
