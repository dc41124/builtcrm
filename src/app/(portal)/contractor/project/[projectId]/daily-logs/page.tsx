import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getContractorDailyLogsPageView,
  type ContractorDailyLogsPageView,
} from "@/domain/loaders/contractor-daily-logs-page";
import { AuthorizationError } from "@/domain/permissions";

import { ContractorDailyLogsWorkspace } from "./daily-logs-workspace";

export default async function ContractorDailyLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ContractorDailyLogsPageView;
  try {
    view = await getContractorDailyLogsPageView({
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

  return <ContractorDailyLogsWorkspace view={view} />;
}
