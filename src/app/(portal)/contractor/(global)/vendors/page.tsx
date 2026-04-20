import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getVendorsPortfolioView } from "@/domain/loaders/procurement";
import { AuthorizationError } from "@/domain/permissions";

import { VendorsWorkspace } from "./vendors-workspace";

export default async function ContractorVendorsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getVendorsPortfolioView({
      session: session.session as unknown as { appUserId?: string | null },
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
