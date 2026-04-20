import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getCostCodesPortfolioView } from "@/domain/loaders/procurement";
import { AuthorizationError } from "@/domain/permissions";

import { CostCodesWorkspace } from "./cost-codes-workspace";

export default async function ContractorCostCodesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getCostCodesPortfolioView({
      session: session.session as unknown as { appUserId?: string | null },
    });
    return <CostCodesWorkspace view={view} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
