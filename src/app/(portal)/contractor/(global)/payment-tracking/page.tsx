import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getContractorCrossProjectPayments,
  type ContractorCrossProjectPaymentsView,
} from "@/domain/loaders/cross-project-payments";
import { AuthorizationError } from "@/domain/permissions";

import { PaymentTrackingWorkspace } from "./payment-tracking-ui";

// Step 38 / 4D #38 — contractor portfolio payment tracking. Matches the
// Reports + Approvals pages: `revalidate = 60` so repeated refreshes hit
// the cache rather than re-running the cross-project aggregate.
export const revalidate = 60;

export default async function ContractorPaymentTrackingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ContractorCrossProjectPaymentsView;
  try {
    view = await getContractorCrossProjectPayments({
      session: session.session as unknown as { appUserId?: string | null },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <PaymentTrackingWorkspace view={view} />;
}
