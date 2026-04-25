import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getContractorPaymentsView } from "@/domain/loaders/payments";
import { AuthorizationError } from "@/domain/permissions";

import { PaymentsView } from "./payments-ui";

export default async function ContractorPaymentsPage() {
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getContractorPaymentsView({
      session: session,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <PaymentsView view={view} nowMs={Date.now()} />;
}
