import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getSubDailyLogsPageView,
  type SubDailyLogsPageView,
} from "@/domain/loaders/subcontractor-daily-logs-page";
import { AuthorizationError } from "@/domain/permissions";

import { SubcontractorDailyLogsWorkspace } from "./daily-logs-workspace";

export default async function SubcontractorDailyLogsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: SubDailyLogsPageView;
  try {
    view = await getSubDailyLogsPageView({
      session: session.session as unknown as { appUserId?: string | null },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <SubcontractorDailyLogsWorkspace view={view} />;
}
