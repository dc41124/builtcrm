import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getSubDailyLogsPageView,
  type SubDailyLogsPageView,
} from "@/domain/loaders/subcontractor-daily-logs-page";
import { AuthorizationError } from "@/domain/permissions";

import { SubcontractorDailyLogsWorkspace } from "./daily-logs-workspace";

export default async function SubcontractorDailyLogsPage() {
  const { session } = await requireServerSession();
  let view: SubDailyLogsPageView;
  try {
    view = await getSubDailyLogsPageView({
      session: session,
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
