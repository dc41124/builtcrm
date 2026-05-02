import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { loadT5018WorkspaceView } from "@/domain/loaders/t5018";
import { AuthorizationError } from "@/domain/permissions";

import { T5018WorkspaceUI } from "./t5018-workspace-ui";

// Step 67 — T5018 admin page. Contractor-admin gated. Renders the
// jurisdiction banner whether or not tax_jurisdiction = 'CA'; if not
// 'CA' the workspace below shows an "enable jurisdiction" banner and
// hides the generation panel — matches the prototype's amber-banner
// non-Canadian state.
//
// `?year=` query param controls the focused fiscal year. Defaults to
// the previous calendar year (most likely the active filing window).

export const dynamic = "force-dynamic";

export default async function T5018Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  let contractorOrgId: string;
  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    contractorOrgId = ctx.organization.id;
    if (ctx.role !== "contractor_admin") {
      return (
        <div style={{ padding: 24, fontFamily: "'Instrument Sans',sans-serif" }}>
          <pre>Forbidden: contractor admin role required.</pre>
        </div>
      );
    }
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

  const params = await searchParams;
  const requestedYear = params.year ? parseInt(params.year, 10) : NaN;
  const fallbackYear = new Date().getFullYear() - 1;
  const fiscalYear =
    Number.isFinite(requestedYear) && requestedYear >= 2018 && requestedYear <= 2100
      ? requestedYear
      : fallbackYear;

  const view = await loadT5018WorkspaceView({
    contractorOrgId,
    fiscalYear,
  });

  return <T5018WorkspaceUI view={view} />;
}
