import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getCostCodesPortfolioView } from "@/domain/loaders/procurement";
import { AuthorizationError } from "@/domain/permissions";

import { CostCodesWorkspace } from "./cost-codes-workspace";

export default async function ContractorCostCodesPage() {
  const { session } = await requireServerSession();
  try {
    const view = await getCostCodesPortfolioView({
      session: session,
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
