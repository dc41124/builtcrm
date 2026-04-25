import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getContractorReportsData,
  type ReportsView,
} from "@/domain/loaders/reports";
import { AuthorizationError } from "@/domain/permissions";

import { ReportsWorkspace } from "./reports-ui";

// Reports dashboard — contractor-only portfolio surface.
//
// Page-level revalidate keeps the aggregate responsive without
// hammering the DB: PMs refreshing every few seconds hit the cache
// rather than re-running seven cross-project queries. The 60-second
// window is plenty for a status view where the input data moves on
// the order of days, not seconds.
export const revalidate = 60;

export default async function ContractorReportsPage() {
  const { session } = await requireServerSession();
  let view: ReportsView;
  try {
    view = await getContractorReportsData({
      session: session,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <ReportsWorkspace view={view} />;
}
