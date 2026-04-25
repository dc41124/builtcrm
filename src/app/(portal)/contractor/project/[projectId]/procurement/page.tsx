import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getProcurementProjectView } from "@/domain/loaders/procurement";
import { AuthorizationError } from "@/domain/permissions";

import { ProcurementWorkspace } from "./procurement-workspace";

type SearchParams = Promise<{ po?: string }>;

export default async function ContractorProcurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: SearchParams;
}) {
  const { projectId } = await params;
  const { po } = await searchParams;
  const { session } = await requireServerSession();
  try {
    const view = await getProcurementProjectView({
      session: session,
      projectId,
      activePoId: po,
    });
    return <ProcurementWorkspace view={view} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
