import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { ContractorFinancialPanel } from "@/components/financial-view";
import { getContractorFinancialView } from "@/domain/loaders/financial";
import { AuthorizationError } from "@/domain/permissions";

export default async function ContractorFinancialsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getContractorFinancialView({
      session: session.session as unknown as { appUserId?: string | null },
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
