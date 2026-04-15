import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getContractorSelections,
  type ContractorSelectionsView,
} from "@/domain/loaders/selections";
import { AuthorizationError } from "@/domain/permissions";

import { ContractorSelectionsWorkspace } from "./selections-workspace";

export default async function ContractorSelectionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ContractorSelectionsView;
  try {
    view = await getContractorSelections({
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
    <ContractorSelectionsWorkspace
      projectId={view.project.id}
      projectName={view.project.name}
      categories={view.categories}
      totals={view.totals}
    />
  );
}
