import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { loadRbqCacheAdminView } from "@/domain/loaders/rbq-cache-admin";
import { AuthorizationError } from "@/domain/permissions";

import { RbqCacheAdminUI } from "./rbq-cache-admin-ui";

// Step 66 — RBQ cache admin (View 02 of the prototype).
//
// Contractor-admin gated. Cross-org cache view: KPIs at top, paginated
// table of every cached lookup with filter pills, search, bulk + per-row
// force-refresh.

export const dynamic = "force-dynamic";

export default async function RbqCacheAdminPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);
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

  const view = await loadRbqCacheAdminView();
  return <RbqCacheAdminUI view={view} />;
}
