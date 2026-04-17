import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getContractorPaymentsView } from "@/domain/loaders/payments";
import { AuthorizationError } from "@/domain/permissions";

import { PaymentsView } from "./payments-ui";

export default async function ContractorPaymentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getContractorPaymentsView({
      session: session.session as unknown as { appUserId?: string | null },
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
