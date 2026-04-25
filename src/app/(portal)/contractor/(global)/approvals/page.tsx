import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getContractorCrossProjectApprovals,
  type ContractorCrossProjectApprovalsView,
} from "@/domain/loaders/cross-project";
import { AuthorizationError } from "@/domain/permissions";

import { CrossProjectApprovalsWorkspace } from "./approvals-portfolio-ui";

// Step 37 / 4D #37 — contractor-wide pending approvals. Follows the
// Reports page pattern: `revalidate = 60` so PMs refreshing rapidly hit
// the cache rather than re-running a cross-project query.
export const revalidate = 60;

export default async function ContractorCrossProjectApprovalsPage() {
  const { session } = await requireServerSession();
  let view: ContractorCrossProjectApprovalsView;
  try {
    view = await getContractorCrossProjectApprovals({
      session: session,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <CrossProjectApprovalsWorkspace view={view} />;
}
