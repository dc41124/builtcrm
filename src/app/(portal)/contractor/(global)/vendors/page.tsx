import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getVendorsPortfolioView } from "@/domain/loaders/procurement";
import { AuthorizationError } from "@/domain/permissions";

import { VendorsWorkspace } from "./vendors-workspace";

export default async function ContractorVendorsPage() {
  const { session } = await requireServerSession();
  try {
    const view = await getVendorsPortfolioView({
      session: session,
    });
    return <VendorsWorkspace view={view} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
