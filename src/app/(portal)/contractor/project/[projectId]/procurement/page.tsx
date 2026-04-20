import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getProcurementProjectView({
      session: session.session as unknown as { appUserId?: string | null },
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
