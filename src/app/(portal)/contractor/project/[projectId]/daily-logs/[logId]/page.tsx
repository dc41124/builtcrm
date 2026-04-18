import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getDailyLog,
  type DailyLogDetailFull,
} from "@/domain/loaders/daily-logs";
import { AuthorizationError } from "@/domain/permissions";

import { ContractorDailyLogDetail } from "./log-detail";

export default async function ContractorDailyLogDetailPage({
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
      // Clients shouldn't hit the contractor detail route. Redirect them
      // to their own portal's path — but for defensive depth return 404.
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

  return <ContractorDailyLogDetail projectId={projectId} log={log} />;
}
