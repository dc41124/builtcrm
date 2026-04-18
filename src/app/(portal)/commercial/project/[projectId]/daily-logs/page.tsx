import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getCommercialDailyLogsPageView,
  type CommercialDailyLogsPageView,
} from "@/domain/loaders/commercial-daily-logs-page";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialDailyLogsWorkspace } from "./daily-logs-workspace";

export default async function CommercialDailyLogsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: CommercialDailyLogsPageView;
  try {
    view = await getCommercialDailyLogsPageView({
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

  return <CommercialDailyLogsWorkspace view={view} />;
}
