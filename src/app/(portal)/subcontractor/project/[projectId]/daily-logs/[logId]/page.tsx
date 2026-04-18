import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let log: DailyLogDetailFull;
  try {
    const result = await getDailyLog({
      session: session.session as unknown as { appUserId?: string | null },
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
