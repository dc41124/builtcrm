import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

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
  const { session } = await requireServerSession();
  let view: ContractorDailyLogsPageView;
  try {
    view = await getContractorDailyLogsPageView({
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

  return <ContractorDailyLogsWorkspace view={view} />;
}
