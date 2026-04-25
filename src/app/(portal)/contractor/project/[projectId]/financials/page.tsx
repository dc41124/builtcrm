import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { ContractorFinancialPanel } from "@/components/financial-view";
import { getContractorFinancialView } from "@/domain/loaders/financial";
import { AuthorizationError } from "@/domain/permissions";

export default async function ContractorFinancialsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getContractorFinancialView({
      session: session,
      projectId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <main style={{ padding: 24 }}>
      <ContractorFinancialPanel view={view} />
    </main>
  );
}
