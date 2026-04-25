import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getDailyLog,
  type DailyLogDetailFull,
} from "@/domain/loaders/daily-logs";
import { AuthorizationError } from "@/domain/permissions";

import { SubDailyLogDetail } from "./log-detail";

export default async function SubcontractorDailyLogDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; logId: string }>;
}) {
  const { projectId, logId } = await params;
  const { session } = await requireServerSession();
  let log: DailyLogDetailFull;
  try {
    const result = await getDailyLog({
      session: session,
      logId,
    });
    if (result.mode !== "full") {
      // The detail loader serves both contractors and subs in "full" mode.
      // If the session resolves to a client role, we'd get "redacted" —
      // shouldn't happen from the sub portal but defend against mis-routing.
      notFound();
    }
    log = result;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <SubDailyLogDetail projectId={projectId} log={log} />;
}
